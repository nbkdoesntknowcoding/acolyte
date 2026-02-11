"""Central AI Engine — API Routes.

Prefix: /api/v1/ai
"""

import json
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import (
    get_current_user,
    get_tenant_db,
    require_compliance,
    require_faculty_or_above,
    require_student,
)
from app.engines.ai.copilot import CopilotStreamEvent
from app.engines.ai.copilot_configs import (
    COPILOT_CONFIGS,
    ROLE_TO_COPILOT,
    create_copilot,
)
from app.engines.ai.gateway_deps import get_ai_gateway
from app.engines.ai.prompt_registry import get_prompt_registry
from app.middleware.clerk_auth import CurrentUser

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Request/Response schemas
# ---------------------------------------------------------------------------

class CopilotQueryRequest(BaseModel):
    """Request body for copilot query endpoint."""

    message: str = Field(..., min_length=1, max_length=10000)
    conversation_history: list[dict[str, Any]] = Field(default_factory=list)
    context: dict[str, Any] | None = Field(default=None)
    copilot_name: str | None = Field(
        default=None,
        description=(
            "Which copilot to use. If omitted, auto-selects based on "
            "user role. Options: " + ", ".join(COPILOT_CONFIGS.keys())
        ),
    )
    admin_sub_role: str | None = Field(
        default=None,
        description="For admin_copilot only: accounts, hr, it_admin, warden, library",
    )
    stream: bool = Field(
        default=True,
        description="Whether to stream the response via SSE",
    )


class CopilotQueryResponse(BaseModel):
    """Non-streaming response from copilot query."""

    text: str
    copilot_used: str
    model_used: str
    tool_calls: list[dict[str, Any]] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Copilot endpoint
# ---------------------------------------------------------------------------

@router.post("/copilot/query")
async def copilot_query(
    body: CopilotQueryRequest,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Copilot query endpoint — serves all 7 copilot agents.

    Determines which copilot to use based on the user's role or
    explicit copilot_name. Returns SSE streaming (default) or
    JSON response.
    """
    gateway = get_ai_gateway()
    registry = get_prompt_registry()

    # Determine which copilot to use
    copilot_name = body.copilot_name or ROLE_TO_COPILOT.get(
        user.role.value, "admin_copilot"
    )

    # Create the copilot instance
    # Preservation pipeline is only needed for student copilot (bridge layer)
    preservation = None
    if copilot_name == "student_copilot":
        from app.engines.ai.pipelines.cognitive_preservation import (
            CognitivePreservationPipeline,
        )
        preservation = CognitivePreservationPipeline(gateway, registry)

    copilot = create_copilot(
        copilot_name,
        ai_gateway=gateway,
        prompt_registry=registry,
        preservation_pipeline=preservation,
        admin_sub_role=body.admin_sub_role,
    )

    if body.stream:
        # SSE streaming response
        return StreamingResponse(
            _sse_generator(
                copilot, db,
                message=body.message,
                conversation_history=body.conversation_history,
                college_id=user.college_id,
                user_id_str=user.user_id,
                user_role=user.role.value,
                context=body.context,
                copilot_name=copilot_name,
            ),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Copilot-Used": copilot_name,
            },
        )

    # Non-streaming response
    from uuid import UUID as _UUID

    result = await copilot.query(
        db,
        message=body.message,
        conversation_history=body.conversation_history,
        college_id=user.college_id,
        user_id=_UUID(user.user_id) if user.user_id else user.college_id,
        user_role=user.role.value,
        context=body.context,
    )

    return CopilotQueryResponse(
        text=result.text,
        copilot_used=copilot_name,
        model_used=result.model_used,
        tool_calls=result.tool_calls,
    )


async def _sse_generator(
    copilot,
    db: AsyncSession,
    *,
    message: str,
    conversation_history: list[dict[str, Any]],
    college_id,
    user_id_str: str,
    user_role: str,
    context: dict[str, Any] | None,
    copilot_name: str,
):
    """Generate SSE events from copilot stream."""
    from uuid import UUID as _UUID

    user_id = _UUID(user_id_str) if user_id_str else college_id

    try:
        async for event in copilot.stream_query(
            db,
            message=message,
            conversation_history=conversation_history,
            college_id=college_id,
            user_id=user_id,
            user_role=user_role,
            context=context,
        ):
            yield f"event: {event.event}\ndata: {event.data}\n\n"
    except Exception as e:
        logger.error("Copilot %s stream error: %s", copilot_name, e)
        error_data = json.dumps({"error": str(e)})
        yield f"event: error\ndata: {error_data}\n\n"


# ---------------------------------------------------------------------------
# Available copilots endpoint
# ---------------------------------------------------------------------------

@router.get("/copilot/configs")
async def list_copilot_configs(
    user: CurrentUser = Depends(get_current_user),
):
    """List available copilot configurations for the current user."""
    default_copilot = ROLE_TO_COPILOT.get(user.role.value, "admin_copilot")

    configs = []
    for name, config in COPILOT_CONFIGS.items():
        entry = {
            "name": name,
            "description": config.description,
            "is_default": name == default_copilot,
        }
        if config.role_configs:
            entry["sub_roles"] = list(config.role_configs.keys())
        configs.append(entry)

    return {"copilots": configs, "default": default_copilot}


# ---------------------------------------------------------------------------
# Socratic Study Buddy (S1 — LangGraph agent)
# ---------------------------------------------------------------------------

class StudyBuddyRequest(BaseModel):
    """Request body for the Socratic Study Buddy endpoint."""

    question: str = Field(..., min_length=1, max_length=10000)
    active_pdf: str | None = Field(
        default=None,
        description="Currently open PDF/book name for context filtering",
    )
    active_chapter: str | None = Field(default=None)
    active_page: int | None = Field(default=None, ge=1)
    conversation_id: str | None = Field(
        default=None,
        description="Thread ID for multi-turn conversation continuity",
    )


class StudyBuddyResponse(BaseModel):
    """Non-streaming response from the Socratic Study Buddy."""

    response: str
    scaffolding_level: str
    turn_count: int
    regeneration_count: int
    preservation_passed: bool
    knowledge_level: str
    conversation_id: str


@router.post("/student/study-buddy")
async def study_buddy(
    body: StudyBuddyRequest,
    user: CurrentUser = Depends(require_student),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Socratic Study Buddy — the flagship student AI interaction.

    Runs a LangGraph supervisor graph with:
    - RAG context retrieval from the student's materials
    - Knowledge assessment from the metacognitive profile
    - Misconception detection
    - Scaffolded Socratic response generation
    - Mandatory Bridge Layer preservation gate

    Every response is architecturally guaranteed to never give direct answers.

    Returns SSE stream by default for progressive rendering.
    """
    from uuid import UUID as _UUID

    from app.engines.ai.agents.socratic_study_buddy import (
        run_socratic_study_buddy,
        stream_socratic_study_buddy,
    )

    gateway = get_ai_gateway()
    registry = get_prompt_registry()

    student_id = _UUID(user.user_id) if user.user_id else user.college_id

    # SSE streaming response (default behavior)
    return StreamingResponse(
        _study_buddy_sse_generator(
            db=db,
            gateway=gateway,
            registry=registry,
            question=body.question,
            student_id=student_id,
            college_id=user.college_id,
            active_pdf=body.active_pdf,
            active_chapter=body.active_chapter,
            active_page=body.active_page,
            conversation_id=body.conversation_id,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Agent": "socratic_study_buddy",
        },
    )


async def _study_buddy_sse_generator(
    *,
    db: AsyncSession,
    gateway,
    registry,
    question: str,
    student_id,
    college_id,
    active_pdf: str | None,
    active_chapter: str | None,
    active_page: int | None,
    conversation_id: str | None,
):
    """Generate SSE events from the Socratic Study Buddy stream."""
    from app.engines.ai.agents.socratic_study_buddy import (
        stream_socratic_study_buddy,
    )

    try:
        async for chunk in stream_socratic_study_buddy(
            db=db,
            gateway=gateway,
            prompt_registry=registry,
            question=question,
            student_id=student_id,
            college_id=college_id,
            active_pdf=active_pdf,
            active_chapter=active_chapter,
            active_page=active_page,
            conversation_id=conversation_id,
        ):
            if chunk.type == "text":
                data = json.dumps({"text": chunk.text})
                yield f"event: text\ndata: {data}\n\n"
            elif chunk.type == "end":
                yield f"event: done\ndata: {{}}\n\n"
    except Exception as e:
        logger.error("Study buddy stream error: %s", e, exc_info=True)
        error_data = json.dumps({"error": str(e)})
        yield f"event: error\ndata: {error_data}\n\n"


# ---------------------------------------------------------------------------
# Practice Question Generator (S2 — LangGraph agent)
# ---------------------------------------------------------------------------

class PracticeQuestionsRequest(BaseModel):
    """Request body for the Practice Question Generator endpoint."""

    subject: str = Field(..., min_length=1, max_length=200)
    topic: str = Field(..., min_length=1, max_length=500)
    difficulty: int = Field(default=3, ge=1, le=5, description="1-5 scale")
    blooms_level: str = Field(
        default="apply",
        description="remember, understand, apply, analyze, evaluate",
    )
    count: int = Field(default=5, ge=1, le=10, description="1-10 questions")
    question_type: str = Field(default="mcq", description="mcq (others in future)")
    competency_code: str | None = Field(
        default=None,
        description="Optional NMC competency code (e.g., PH 1.25)",
    )


@router.post("/student/generate-practice-questions")
async def generate_practice_questions_endpoint(
    body: PracticeQuestionsRequest,
    user: CurrentUser = Depends(require_student),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Practice Question Generator — generates MCQs that mirror college exam style.

    Runs a LangGraph sub-agent pipeline:
    1. Load college question profile (L4 Question Intelligence Layer)
    2. Retrieve relevant medical content via RAG
    3. Fetch knowledge graph data for distractor generation
    4. Generate MCQs with Sonnet (constrained decoding)
    5. Validate through Medical Safety Pipeline (L3)
    6. Retry rejected questions (up to 2 attempts)

    Returns validated PracticeQuestionBatch as JSON.
    """
    from uuid import UUID as _UUID

    from app.engines.ai.agents.practice_question_generator import (
        generate_practice_questions,
    )

    gateway = get_ai_gateway()
    registry = get_prompt_registry()

    student_id = _UUID(user.user_id) if user.user_id else user.college_id

    result = await generate_practice_questions(
        db=db,
        gateway=gateway,
        prompt_registry=registry,
        subject=body.subject,
        topic=body.topic,
        difficulty=body.difficulty,
        blooms_level=body.blooms_level,
        count=body.count,
        question_type=body.question_type,
        competency_code=body.competency_code,
        student_id=student_id,
        college_id=user.college_id,
    )

    return result.model_dump()


# ---------------------------------------------------------------------------
# Exam Question Generator (F1 — LangGraph agent, faculty-facing)
# ---------------------------------------------------------------------------

class ExamQuestionsRequest(BaseModel):
    """Request body for the Exam Question Generator endpoint."""

    subject: str = Field(..., min_length=1, max_length=200)
    topic: str = Field(..., min_length=1, max_length=500)
    difficulty: int = Field(default=3, ge=1, le=5, description="1-5 scale")
    blooms_level: str = Field(
        default="apply",
        description="remember, understand, apply, analyze, evaluate",
    )
    count: int = Field(default=5, ge=1, le=10, description="1-10 questions")
    question_type: str = Field(
        default="mcq",
        description="mcq, saq, or laq",
    )
    competency_code: str | None = Field(
        default=None,
        description="Optional NMC competency code (e.g., PH 1.25)",
    )
    clinical_vignette: bool = Field(
        default=True,
        description="Whether to include a clinical vignette",
    )
    aetcom_integration: bool = Field(
        default=False,
        description="Whether to integrate AETCOM competencies",
    )
    image_based: bool = Field(
        default=False,
        description="Whether to generate image-based questions",
    )


class ReviewQuestionRequest(BaseModel):
    """Request body for faculty question review."""

    execution_id: str = Field(
        ..., description="The execution UUID from generation",
    )
    question_index: int = Field(
        ..., ge=0, description="Index of the question in the batch",
    )
    action: str = Field(
        ..., description="approve, modify, or reject",
    )
    modifications: dict[str, Any] | None = Field(
        default=None,
        description="Modified question data (required for 'modify')",
    )


@router.post("/faculty/generate-exam-questions")
async def generate_exam_questions_endpoint(
    body: ExamQuestionsRequest,
    user: CurrentUser = Depends(require_faculty_or_above),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Exam Question Generator — faculty-facing Core IP agent.

    Generates assessment-grade questions (MCQ, SAQ, LAQ) with:
    - Faculty's exact parameter specifications (difficulty, Bloom's, type)
    - Detailed rubrics for SAQ/LAQ
    - Medical Safety Pipeline validation
    - MANDATORY human-in-the-loop review (every question)

    Approved questions feed into the Question Intelligence Layer (L4),
    which trains the student practice generators to mirror exam style.

    Returns ExamQuestionDraft with review_status="pending_review".
    """
    from uuid import UUID as _UUID

    from app.engines.ai.agents.exam_question_generator import (
        generate_exam_questions,
    )

    gateway = get_ai_gateway()
    registry = get_prompt_registry()

    faculty_id = _UUID(user.user_id) if user.user_id else user.college_id

    result = await generate_exam_questions(
        db=db,
        gateway=gateway,
        prompt_registry=registry,
        subject=body.subject,
        topic=body.topic,
        difficulty=body.difficulty,
        blooms_level=body.blooms_level,
        count=body.count,
        question_type=body.question_type,
        competency_code=body.competency_code,
        clinical_vignette=body.clinical_vignette,
        aetcom_integration=body.aetcom_integration,
        image_based=body.image_based,
        faculty_id=faculty_id,
        college_id=user.college_id,
    )

    return result.model_dump()


@router.post("/faculty/review-question")
async def review_question_endpoint(
    body: ReviewQuestionRequest,
    user: CurrentUser = Depends(require_faculty_or_above),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Faculty question review — approve, modify, or reject.

    On approve/modify:
    - Saves AgentFeedback record
    - Captures faculty pattern in Question Intelligence Layer (L4)
    - The L4 pattern makes S2 (Practice Question Generator) mirror
      this faculty's exam style for students

    On reject:
    - Saves AgentFeedback record only
    - Does NOT capture pattern (rejected = not representative)
    """
    from uuid import UUID as _UUID

    from app.engines.ai.agents.exam_question_generator import (
        handle_faculty_review,
    )

    faculty_id = _UUID(user.user_id) if user.user_id else user.college_id

    result = await handle_faculty_review(
        db=db,
        execution_id=_UUID(body.execution_id),
        question_index=body.question_index,
        action=body.action,
        modifications=body.modifications,
        faculty_id=faculty_id,
        college_id=user.college_id,
    )

    return result


# ---------------------------------------------------------------------------
# Metacognitive Analytics (S8 — data pipeline, no LLM)
# ---------------------------------------------------------------------------

class CaptureEventRequest(BaseModel):
    """Request body for capturing a metacognitive event."""

    event_type: str = Field(
        ...,
        description=(
            "question_answered, page_viewed, flashcard_reviewed, "
            "study_session_started, study_session_ended, ai_interaction"
        ),
    )
    event_data: dict[str, Any] = Field(
        ..., description="Event-type-specific payload",
    )
    subject: str | None = Field(default=None)
    topic: str | None = Field(default=None)
    competency_code: str | None = Field(default=None)


@router.post("/student/capture-event")
async def capture_metacognitive_event(
    body: CaptureEventRequest,
    user: CurrentUser = Depends(require_student),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Capture a student interaction event for metacognitive analytics.

    Called from student-facing endpoints (practice tests, PDF viewer,
    flashcards, AI chat) whenever meaningful events occur.
    Updates the student's real-time analytics profile.
    """
    from uuid import UUID as _UUID

    from app.engines.ai.analytics.metacognitive import (
        MetacognitiveEventInput,
        get_analytics_engine,
    )

    engine = get_analytics_engine()
    student_id = _UUID(user.user_id) if user.user_id else user.college_id

    event = MetacognitiveEventInput(
        student_id=student_id,
        college_id=user.college_id,
        event_type=body.event_type,
        event_data=body.event_data,
        subject=body.subject,
        topic=body.topic,
        competency_code=body.competency_code,
    )

    await engine.capture_event(db, event)
    return {"status": "captured"}


@router.get("/student/my-analytics")
async def get_my_analytics(
    user: CurrentUser = Depends(require_student),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Return the student's own analytics summary.

    Includes: mastery heatmap data, risk areas, study patterns,
    streak, accuracy breakdown by subject/topic.
    """
    from uuid import UUID as _UUID

    from app.engines.ai.analytics.metacognitive import get_analytics_engine

    engine = get_analytics_engine()
    student_id = _UUID(user.user_id) if user.user_id else user.college_id

    summary = await engine.get_student_summary(db, student_id, user.college_id)
    return summary.model_dump()


@router.get("/faculty/student-analytics/{student_id}")
async def get_student_analytics(
    student_id: str,
    user: CurrentUser = Depends(require_faculty_or_above),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Return detailed analytics for a specific student (faculty view).

    Used by F7 (Student Analytics & Mentoring) for faculty mentoring.
    Faculty can see any student in their college (RLS-scoped).
    """
    from uuid import UUID as _UUID

    from app.engines.ai.analytics.metacognitive import get_analytics_engine

    engine = get_analytics_engine()
    sid = _UUID(student_id)

    summary = await engine.get_student_summary(db, sid, user.college_id)
    return summary.model_dump()


@router.get("/faculty/at-risk-students")
async def get_at_risk_students(
    department: str | None = None,
    risk_level: str = "high",
    user: CurrentUser = Depends(require_faculty_or_above),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Return at-risk students in the faculty's college.

    Used by F7 (Student Analytics & Mentoring). Faculty can filter
    by department and risk level threshold.
    """
    from app.engines.ai.analytics.metacognitive import get_analytics_engine

    engine = get_analytics_engine()

    students = await engine.get_at_risk_students(
        db,
        college_id=user.college_id,
        department=department,
        risk_level=risk_level,
    )

    return {"at_risk_students": [s.model_dump() for s in students]}


# ---------------------------------------------------------------------------
# Archetype system (S8 — Layer 1 + Layer 2)
# ---------------------------------------------------------------------------

class ArchetypeQuestionnaireRequest(BaseModel):
    """Request body for submitting the 25-question OCEAN questionnaire."""

    responses: list[dict[str, int]] = Field(
        ...,
        min_length=25,
        max_length=25,
        description=(
            "List of 25 responses, each {question_id: int, rating: int (1-5)}"
        ),
    )


@router.post("/student/archetype-questionnaire")
async def submit_archetype_questionnaire(
    body: ArchetypeQuestionnaireRequest,
    user: CurrentUser = Depends(require_student),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Submit the 25-question OCEAN personality questionnaire.

    Layer 1 of the dual-layer archetype system. Computes OCEAN scores,
    classifies the student into one of 5 archetypes using the Assessment
    Matrix from the Archetype Framework document.

    Returns ArchetypeAssessment with OCEAN scores and primary archetype.
    """
    from uuid import UUID as _UUID

    from app.engines.ai.analytics.metacognitive import get_analytics_engine
    from app.engines.ai.analytics.schemas import QuestionnaireResponse

    engine = get_analytics_engine()
    student_id = _UUID(user.user_id) if user.user_id else user.college_id

    responses = [
        QuestionnaireResponse(
            question_id=r["question_id"],
            rating=r["rating"],
        )
        for r in body.responses
    ]

    assessment = await engine.assess_personality_layer1(
        db, student_id, user.college_id, responses,
    )

    return assessment.model_dump()


@router.get("/student/my-archetype")
async def get_my_archetype(
    user: CurrentUser = Depends(require_student),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Return the student's archetype profile (Layer 1 + Layer 2).

    Includes self-reported archetype, behavioral archetype (if computed
    after 30+ days), and the metacognitive reveal insight if available.
    """
    from uuid import UUID as _UUID

    from sqlalchemy import select

    from app.engines.ai.models import StudentArchetypeProfile

    student_id = _UUID(user.user_id) if user.user_id else user.college_id

    result = await db.execute(
        select(StudentArchetypeProfile).where(
            StudentArchetypeProfile.college_id == user.college_id,
            StudentArchetypeProfile.student_id == student_id,
        )
    )
    profile = result.scalars().first()

    if not profile:
        return {
            "has_profile": False,
            "message": "Complete the archetype questionnaire first.",
        }

    data: dict[str, Any] = {
        "has_profile": True,
        "self_reported_archetype": profile.self_reported_archetype,
        "ocean_scores": profile.ocean_scores,
        "self_reported_confidence": profile.self_reported_confidence,
        "layer1_assessed_at": (
            profile.layer1_assessed_at.isoformat()
            if profile.layer1_assessed_at else None
        ),
        "behavioral_archetype": profile.behavioral_archetype,
        "behavioral_confidence": profile.behavioral_confidence,
        "layer2_computed_at": (
            profile.layer2_computed_at.isoformat()
            if profile.layer2_computed_at else None
        ),
        "reveal_available": profile.reveal_generated,
        "reveal_insight": profile.reveal_insight if profile.reveal_generated else None,
        "reveal_recommendations": (
            profile.reveal_recommendations if profile.reveal_generated else None
        ),
    }

    return data


@router.get("/faculty/department-analytics")
async def get_department_analytics(
    department: str | None = None,
    user: CurrentUser = Depends(require_faculty_or_above),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Return aggregate analytics for a department.

    Used by F7 (Student Analytics & Mentoring) for department-level
    oversight. Includes topic mastery, risk distribution, engagement
    trends, and common weak areas.
    """
    from app.engines.ai.analytics.metacognitive import get_analytics_engine

    engine = get_analytics_engine()

    analytics = await engine.get_department_analytics(
        db,
        college_id=user.college_id,
        department=department,
    )

    return analytics.model_dump()


# ---------------------------------------------------------------------------
# Compliance AI Operations (C1 — rule-agnostic compliance engine)
# ---------------------------------------------------------------------------

class RunComplianceCheckRequest(BaseModel):
    """Request body for triggering a manual compliance check."""

    category: str | None = Field(
        default=None,
        description="Filter by category (e.g., 'attendance', 'faculty'). "
                    "Omit to check all categories.",
    )
    snapshot_type: str = Field(
        default="manual",
        description="manual, pre_inspection, monthly_report",
    )


@router.post("/compliance/run-check")
async def run_compliance_check_endpoint(
    body: RunComplianceCheckRequest,
    user: CurrentUser = Depends(require_compliance),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Trigger a manual compliance check.

    Runs the full LangGraph compliance pipeline:
    1. Evaluate all active standards (deterministic)
    2. Create alerts for non-compliant items
    3. Analyze trends from historical snapshots
    4. Generate executive summary (Sonnet)
    5. Save ComplianceCheckSnapshot

    Returns ComplianceEvaluation with all results.
    """
    from uuid import UUID as _UUID

    from app.engines.ai.agents.compliance_monitor import run_compliance_check

    gateway = get_ai_gateway()
    user_id = _UUID(user.user_id) if user.user_id else None

    evaluation = await run_compliance_check(
        db,
        gateway,
        college_id=user.college_id,
        category=body.category,
        snapshot_type=body.snapshot_type,
        user_id=user_id,
    )

    return evaluation.model_dump()


@router.get("/compliance/dashboard")
async def get_compliance_ai_dashboard(
    user: CurrentUser = Depends(require_compliance),
    db: AsyncSession = Depends(get_tenant_db),
):
    """AI-powered compliance dashboard.

    Returns current status from the latest snapshot + active alerts.
    For a fresh evaluation, use POST /compliance/run-check first.
    """
    from sqlalchemy import select, func, desc

    from app.engines.ai.agents.compliance_schemas import (
        ComplianceAlertResponse,
        ComplianceDashboardResponse,
    )
    from app.engines.compliance.models import (
        ComplianceAlert,
        ComplianceCheckSnapshot,
    )

    # Latest snapshot
    snap_result = await db.execute(
        select(ComplianceCheckSnapshot)
        .order_by(desc(ComplianceCheckSnapshot.snapshot_date))
        .limit(1)
    )
    latest = snap_result.scalars().first()

    # Active alerts
    alerts_result = await db.execute(
        select(ComplianceAlert)
        .where(ComplianceAlert.status == "active")
        .order_by(desc(ComplianceAlert.created_at))
        .limit(20)
    )
    active_alerts = alerts_result.scalars().all()

    if not latest:
        return ComplianceDashboardResponse(
            overall_status="unknown",
            standards_checked=0,
            standards_compliant=0,
            standards_at_risk=0,
            standards_breached=0,
            data_gaps_count=0,
            active_alerts=[],
            latest_snapshot_date=None,
            compliance_pct=0.0,
        ).model_dump()

    total = latest.standards_checked or 1
    compliance_pct = round((latest.standards_compliant or 0) / total * 100, 1)
    data_gaps_count = len(latest.data_gaps) if latest.data_gaps else 0

    alert_responses = []
    for a in active_alerts:
        alert_responses.append(ComplianceAlertResponse(
            id=str(a.id),
            standard_id=str(a.standard_id) if a.standard_id else None,
            severity=a.severity,
            category=a.category,
            title=a.title,
            details=a.details,
            current_value=a.current_value,
            threshold_value=a.threshold_value,
            gap_description=a.gap_description,
            recommended_action=a.recommended_action,
            deadline=a.deadline,
            auto_escalation_date=a.auto_escalation_date,
            status=a.status,
            acknowledged_by=str(a.acknowledged_by) if a.acknowledged_by else None,
            acknowledged_at=a.acknowledged_at,
            resolved_by=str(a.resolved_by) if a.resolved_by else None,
            resolved_at=a.resolved_at,
            resolution_notes=a.resolution_notes,
            created_at=a.created_at,
        ))

    return ComplianceDashboardResponse(
        overall_status=latest.overall_status,
        standards_checked=latest.standards_checked,
        standards_compliant=latest.standards_compliant,
        standards_at_risk=latest.standards_at_risk,
        standards_breached=latest.standards_breached,
        data_gaps_count=data_gaps_count,
        active_alerts=alert_responses,
        latest_snapshot_date=latest.snapshot_date,
        compliance_pct=compliance_pct,
    ).model_dump()


@router.get("/compliance/trends")
async def get_compliance_trends(
    days: int = Query(90, ge=7, le=365),
    user: CurrentUser = Depends(require_compliance),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Historical compliance trend data from snapshots.

    Returns data points for charting compliance status over time.
    """
    from datetime import date, timedelta

    from sqlalchemy import select

    from app.engines.compliance.models import ComplianceCheckSnapshot

    since = date.today() - timedelta(days=days)

    result = await db.execute(
        select(ComplianceCheckSnapshot)
        .where(ComplianceCheckSnapshot.snapshot_date >= since)
        .order_by(ComplianceCheckSnapshot.snapshot_date.asc())
    )
    snapshots = result.scalars().all()

    data_points = []
    for snap in snapshots:
        total = snap.standards_checked or 1
        data_points.append({
            "snapshot_date": snap.snapshot_date.isoformat(),
            "overall_status": snap.overall_status,
            "standards_checked": snap.standards_checked,
            "standards_compliant": snap.standards_compliant,
            "standards_at_risk": snap.standards_at_risk,
            "standards_breached": snap.standards_breached,
            "compliance_pct": round(
                (snap.standards_compliant or 0) / total * 100, 1,
            ),
        })

    # Simple trend calculation
    trend_direction = "insufficient_data"
    if len(data_points) >= 3:
        half = len(data_points) // 2
        first_avg = sum(d["compliance_pct"] for d in data_points[:half]) / max(half, 1)
        second_avg = sum(
            d["compliance_pct"] for d in data_points[half:]
        ) / max(len(data_points) - half, 1)

        diff = second_avg - first_avg
        if diff > 2:
            trend_direction = "improving"
        elif diff < -2:
            trend_direction = "declining"
        else:
            trend_direction = "stable"

    return {
        "data_points": data_points,
        "trend_direction": trend_direction,
        "days_of_data": len(data_points),
        "period_days": days,
    }


@router.get("/compliance/data-gaps")
async def get_compliance_data_gaps(
    user: CurrentUser = Depends(require_compliance),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Standards that can't be checked due to missing data sources.

    Runs a quick evaluation of all standards and returns only
    those with data_unavailable status.
    """
    from app.engines.ai.agents.compliance_monitor import ComplianceRulesEngine

    engine = ComplianceRulesEngine()
    evaluation = await engine.evaluate_all(
        db, user.college_id, snapshot_type="data_gap_check",
    )

    return {
        "data_gaps": [g.model_dump() for g in evaluation.data_gaps],
        "total_gaps": len(evaluation.data_gaps),
        "total_standards": evaluation.standards_checked + len(evaluation.data_gaps),
    }


@router.get("/compliance/data-sources")
async def list_data_sources(
    user: CurrentUser = Depends(require_compliance),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List registered data source fetchers and their status."""
    from app.engines.ai.agents.compliance_monitor import ComplianceDataFetcher
    from app.engines.ai.agents.compliance_schemas import DataSourceStatus

    registered = ComplianceDataFetcher.get_registered_sources()
    fetcher = ComplianceDataFetcher()

    sources = []
    for source_type in registered:
        result = await fetcher.fetch(
            db, source_type, {}, user.college_id,
        )
        sources.append(DataSourceStatus(
            source_type=source_type,
            registered=True,
            status=result.status,
            message=result.message,
        ))

    return {"data_sources": [s.model_dump() for s in sources]}


@router.get("/compliance/data-sources/{source_type}/test")
async def test_data_source(
    source_type: str,
    user: CurrentUser = Depends(require_compliance),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Test a specific data source fetcher."""
    from app.engines.ai.agents.compliance_monitor import ComplianceDataFetcher

    fetcher = ComplianceDataFetcher()
    result = await fetcher.fetch(
        db, source_type, {}, user.college_id,
    )

    return {
        "source_type": source_type,
        "status": result.status,
        "value": result.value,
        "message": result.message,
        "fetched_at": result.fetched_at.isoformat() if result.fetched_at else None,
    }


# ---------------------------------------------------------------------------
# SAF Auto-Generation (C2 — template-driven document generation)
# ---------------------------------------------------------------------------

# --- Template management (Jason's interface) ---

@router.get("/compliance/templates")
async def list_saf_templates(
    regulatory_body: str | None = Query(None),
    is_active: bool | None = Query(None),
    user: CurrentUser = Depends(require_compliance),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List available form templates."""
    from sqlalchemy import select

    from app.engines.compliance.models import SAFTemplate

    query = select(SAFTemplate).order_by(SAFTemplate.template_code)
    if regulatory_body:
        query = query.where(SAFTemplate.regulatory_body == regulatory_body)
    if is_active is not None:
        query = query.where(SAFTemplate.is_active == is_active)

    result = await db.execute(query)
    templates = result.scalars().all()

    return [
        {
            "id": str(t.id),
            "template_code": t.template_code,
            "title": t.title,
            "description": t.description,
            "regulatory_body": t.regulatory_body,
            "version": t.version,
            "is_active": t.is_active,
            "total_sections": len(t.sections) if t.sections else 0,
            "total_fields": sum(
                len(s.get("fields", []))
                for s in (t.sections or [])
            ),
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in templates
    ]


@router.post("/compliance/templates", status_code=201)
async def create_saf_template(
    body: dict[str, Any],
    user: CurrentUser = Depends(require_compliance),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Create a new form template.

    Accepts the full template structure as JSON. See
    scripts/saf_template_example.json for the expected format.
    """
    from uuid import UUID as _UUID

    from app.engines.ai.agents.saf_schemas import SAFTemplateCreate
    from app.engines.compliance.models import SAFTemplate

    parsed = SAFTemplateCreate(**body)

    template = SAFTemplate(
        template_code=parsed.template_code,
        title=parsed.title,
        description=parsed.description,
        regulatory_body=parsed.regulatory_body,
        version=parsed.version,
        sections=[s.model_dump() for s in parsed.sections],
        created_by=_UUID(user.user_id) if user.user_id else None,
    )
    db.add(template)
    await db.flush()
    await db.refresh(template)

    return {
        "id": str(template.id),
        "template_code": template.template_code,
        "title": template.title,
        "message": "Template created successfully",
    }


@router.put("/compliance/templates/{template_id}")
async def update_saf_template(
    template_id: str,
    body: dict[str, Any],
    user: CurrentUser = Depends(require_compliance),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Update an existing form template."""
    from datetime import datetime as dt, timezone as tz
    from uuid import UUID as _UUID

    from sqlalchemy import select

    from app.engines.ai.agents.saf_schemas import SAFTemplateUpdate
    from app.engines.compliance.models import SAFTemplate

    tid = _UUID(template_id)
    result = await db.execute(
        select(SAFTemplate).where(SAFTemplate.id == tid),
    )
    template = result.scalars().first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    parsed = SAFTemplateUpdate(**body)
    update_data = parsed.model_dump(exclude_unset=True)

    if "sections" in update_data and update_data["sections"] is not None:
        update_data["sections"] = [
            s.model_dump() if hasattr(s, "model_dump") else s
            for s in update_data["sections"]
        ]

    for field, value in update_data.items():
        setattr(template, field, value)

    template.updated_at = dt.now(tz.utc)
    await db.flush()

    return {"status": "updated", "template_id": template_id}


@router.get("/compliance/templates/{template_id}/preview")
async def preview_saf_template(
    template_id: str,
    user: CurrentUser = Depends(require_compliance),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Preview template structure — sections and fields without data."""
    from uuid import UUID as _UUID

    from sqlalchemy import select

    from app.engines.compliance.models import SAFTemplate

    tid = _UUID(template_id)
    result = await db.execute(
        select(SAFTemplate).where(SAFTemplate.id == tid),
    )
    template = result.scalars().first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    sections = template.sections or []
    total_fields = 0
    required_fields = 0
    narrative_fields = 0
    data_source_fields = 0
    manual_only_fields = 0

    for section in sections:
        for field in section.get("fields", []):
            total_fields += 1
            if field.get("is_required", True):
                required_fields += 1
            if field.get("requires_narrative", False):
                narrative_fields += 1
            if field.get("data_source"):
                data_source_fields += 1
            elif not field.get("requires_narrative", False):
                manual_only_fields += 1

    return {
        "template_code": template.template_code,
        "title": template.title,
        "regulatory_body": template.regulatory_body,
        "version": template.version,
        "total_sections": len(sections),
        "total_fields": total_fields,
        "required_fields": required_fields,
        "narrative_fields": narrative_fields,
        "data_source_fields": data_source_fields,
        "manual_only_fields": manual_only_fields,
        "sections": sections,
    }


# --- Document generation ---

@router.post("/compliance/documents/generate")
async def generate_document_endpoint(
    body: dict[str, Any],
    user: CurrentUser = Depends(require_compliance),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Generate a compliance document from a template.

    Runs the LangGraph SAF generation pipeline:
    1. Load template and fill fields from data sources
    2. Generate narratives for narrative fields (Sonnet)
    3. Identify data gaps needing manual entry
    4. Save draft record

    Always sets requires_human_review = True.
    """
    from uuid import UUID as _UUID

    from app.engines.ai.agents.saf_generator import run_saf_generation
    from app.engines.ai.agents.saf_schemas import GenerateDocumentRequest

    parsed = GenerateDocumentRequest(**body)
    gateway = get_ai_gateway()
    user_id = _UUID(user.user_id) if user.user_id else user.college_id

    result = await run_saf_generation(
        db,
        gateway,
        college_id=user.college_id,
        template_id=_UUID(parsed.template_id),
        academic_year=parsed.academic_year,
        parameters=parsed.parameters,
        requested_by=user_id,
    )

    return result.model_dump()


@router.get("/compliance/documents")
async def list_document_drafts(
    status_filter: str | None = Query(None, alias="status"),
    limit: int = Query(20, ge=1, le=100),
    user: CurrentUser = Depends(require_compliance),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List compliance document drafts for the current college."""
    from sqlalchemy import select, desc

    from app.engines.compliance.models import (
        ComplianceDocumentDraft,
        SAFTemplate,
    )

    query = (
        select(ComplianceDocumentDraft, SAFTemplate.template_code)
        .join(SAFTemplate, ComplianceDocumentDraft.template_id == SAFTemplate.id)
        .order_by(desc(ComplianceDocumentDraft.created_at))
        .limit(limit)
    )

    if status_filter:
        query = query.where(ComplianceDocumentDraft.status == status_filter)

    result = await db.execute(query)
    rows = result.all()

    return [
        {
            "id": str(draft.id),
            "template_id": str(draft.template_id),
            "template_code": tpl_code,
            "academic_year": draft.academic_year,
            "status": draft.status,
            "auto_fill_percentage": draft.auto_fill_percentage,
            "data_gaps_count": len(draft.data_gaps) if draft.data_gaps else 0,
            "generated_at": draft.generated_at.isoformat() if draft.generated_at else None,
            "approved_at": draft.approved_at.isoformat() if draft.approved_at else None,
            "created_at": draft.created_at.isoformat() if draft.created_at else None,
        }
        for draft, tpl_code in rows
    ]


@router.get("/compliance/documents/{document_id}")
async def get_document_draft(
    document_id: str,
    user: CurrentUser = Depends(require_compliance),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get a specific compliance document draft."""
    from uuid import UUID as _UUID

    from sqlalchemy import select

    from app.engines.compliance.models import ComplianceDocumentDraft

    did = _UUID(document_id)
    result = await db.execute(
        select(ComplianceDocumentDraft).where(
            ComplianceDocumentDraft.id == did,
        ),
    )
    draft = result.scalars().first()
    if not draft:
        raise HTTPException(status_code=404, detail="Document not found")

    return {
        "id": str(draft.id),
        "template_id": str(draft.template_id),
        "academic_year": draft.academic_year,
        "status": draft.status,
        "filled_data": draft.filled_data,
        "data_gaps": draft.data_gaps,
        "auto_fill_percentage": draft.auto_fill_percentage,
        "narrative_sections": draft.narrative_sections,
        "review_comments": draft.review_comments,
        "generated_by": str(draft.generated_by),
        "generated_at": draft.generated_at.isoformat() if draft.generated_at else None,
        "approved_by": str(draft.approved_by) if draft.approved_by else None,
        "approved_at": draft.approved_at.isoformat() if draft.approved_at else None,
        "submitted_at": draft.submitted_at.isoformat() if draft.submitted_at else None,
        "execution_id": str(draft.execution_id) if draft.execution_id else None,
        "created_at": draft.created_at.isoformat() if draft.created_at else None,
    }


@router.put("/compliance/documents/{document_id}")
async def update_document_draft(
    document_id: str,
    body: dict[str, Any],
    user: CurrentUser = Depends(require_compliance),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Update a draft — manual field entries by compliance officer."""
    from datetime import datetime as dt, timezone as tz
    from uuid import UUID as _UUID

    from sqlalchemy import select

    from app.engines.ai.agents.saf_schemas import DocumentUpdateRequest
    from app.engines.compliance.models import ComplianceDocumentDraft

    did = _UUID(document_id)
    result = await db.execute(
        select(ComplianceDocumentDraft).where(
            ComplianceDocumentDraft.id == did,
        ),
    )
    draft = result.scalars().first()
    if not draft:
        raise HTTPException(status_code=404, detail="Document not found")

    if draft.status not in ("draft", "in_review"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot update document in '{draft.status}' status",
        )

    parsed = DocumentUpdateRequest(**body)

    # Merge field updates into existing filled_data
    current_data = dict(draft.filled_data or {})
    current_data.update(parsed.field_updates)
    draft.filled_data = current_data

    # Remove updated fields from data_gaps
    if draft.data_gaps:
        updated_codes = set(parsed.field_updates.keys())
        draft.data_gaps = [
            gap for gap in draft.data_gaps
            if gap.get("field_code") not in updated_codes
        ]

    # Recalculate auto_fill_percentage (approximate)
    if draft.data_gaps is not None:
        total_gap_fields = len(draft.data_gaps)
        total_filled = len(current_data)
        total = total_filled + total_gap_fields
        if total > 0:
            draft.auto_fill_percentage = round(total_filled / total * 100, 1)

    # Add review comment if provided
    if parsed.review_comment:
        comments = list(draft.review_comments or [])
        comments.append({
            "by": user.user_id,
            "at": dt.now(tz.utc).isoformat(),
            "comment": parsed.review_comment,
        })
        draft.review_comments = comments

    draft.status = "in_review"
    draft.updated_at = dt.now(tz.utc)
    await db.flush()

    return {"status": "updated", "document_id": document_id}


@router.post("/compliance/documents/{document_id}/approve")
async def approve_document_draft(
    document_id: str,
    user: CurrentUser = Depends(require_compliance),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Approve a compliance document draft."""
    from datetime import datetime as dt, timezone as tz
    from uuid import UUID as _UUID

    from sqlalchemy import select

    from app.engines.compliance.models import ComplianceDocumentDraft

    did = _UUID(document_id)
    result = await db.execute(
        select(ComplianceDocumentDraft).where(
            ComplianceDocumentDraft.id == did,
        ),
    )
    draft = result.scalars().first()
    if not draft:
        raise HTTPException(status_code=404, detail="Document not found")

    if draft.status not in ("draft", "in_review"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot approve document in '{draft.status}' status",
        )

    draft.status = "approved"
    draft.approved_by = _UUID(user.user_id) if user.user_id else None
    draft.approved_at = dt.now(tz.utc)
    draft.updated_at = dt.now(tz.utc)
    await db.flush()

    return {"status": "approved", "document_id": document_id}


@router.get("/compliance/documents/{document_id}/gaps")
async def get_document_gaps(
    document_id: str,
    user: CurrentUser = Depends(require_compliance),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List unfilled fields in a document."""
    from uuid import UUID as _UUID

    from sqlalchemy import select

    from app.engines.compliance.models import ComplianceDocumentDraft

    did = _UUID(document_id)
    result = await db.execute(
        select(ComplianceDocumentDraft).where(
            ComplianceDocumentDraft.id == did,
        ),
    )
    draft = result.scalars().first()
    if not draft:
        raise HTTPException(status_code=404, detail="Document not found")

    filled_count = len(draft.filled_data or {})
    gaps = draft.data_gaps or []

    return {
        "draft_id": document_id,
        "total_fields": filled_count + len(gaps),
        "filled_fields": filled_count,
        "unfilled_fields": len(gaps),
        "gaps": gaps,
    }


@router.post("/compliance/templates/{template_id}/test")
async def test_template(
    template_id: str,
    user: CurrentUser = Depends(require_compliance),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Test a template with sample data — dry run without saving a draft.

    Runs the data fetcher for each field and reports which fields
    can be auto-filled vs which need manual entry.
    """
    from uuid import UUID as _UUID

    from sqlalchemy import select

    from app.engines.ai.agents.compliance_monitor import ComplianceDataFetcher
    from app.engines.compliance.models import SAFTemplate

    tid = _UUID(template_id)
    result = await db.execute(
        select(SAFTemplate).where(SAFTemplate.id == tid),
    )
    template = result.scalars().first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    fetcher = ComplianceDataFetcher()
    sections_report: list[dict[str, Any]] = []

    for section in (template.sections or []):
        fields_report: list[dict[str, Any]] = []
        for field in section.get("fields", []):
            data_source = field.get("data_source")
            if not data_source:
                fields_report.append({
                    "field_code": field.get("field_code"),
                    "label": field.get("label"),
                    "status": "manual_only" if not field.get("requires_narrative") else "narrative",
                })
                continue

            source_type = data_source.split(".")[0] if "." in data_source else data_source
            fetch = await fetcher.fetch(
                db, source_type, field.get("data_query_config", {}), user.college_id,
            )
            fields_report.append({
                "field_code": field.get("field_code"),
                "label": field.get("label"),
                "data_source": data_source,
                "fetch_status": fetch.status,
                "fetch_message": fetch.message,
                "can_auto_fill": fetch.status == "ok",
            })

        sections_report.append({
            "section_code": section.get("section_code"),
            "title": section.get("title"),
            "fields": fields_report,
        })

    return {
        "template_code": template.template_code,
        "title": template.title,
        "sections": sections_report,
    }


# ---------------------------------------------------------------------------
# NEET-PG Exam Prep (S3 — specialized agent, student-facing)
# ---------------------------------------------------------------------------

@router.post("/student/neetpg/generate-mock")
async def generate_neetpg_mock_test(
    body: dict[str, Any],
    user: CurrentUser = Depends(require_student),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Generate a NEET-PG mock test.

    Test types:
    - "full": 200 questions, 3.5 hours, all subjects (NBE blueprint)
    - "mini": 50 questions, ~53 minutes, proportional distribution
    - "subject": 30 questions, ~32 minutes, single subject focus

    If weak_area_focus=True, weights question distribution towards
    the student's weak topics from their metacognitive profile.

    Returns NEETPGMockTest with questions, duration, and blueprint.
    """
    from uuid import UUID as _UUID

    from app.engines.ai.agents.neet_pg_prep import generate_neetpg_mock_test
    from app.engines.ai.agents.neet_pg_schemas import GenerateMockTestRequest

    parsed = GenerateMockTestRequest(**body)
    gateway = get_ai_gateway()
    registry = get_prompt_registry()

    student_id = _UUID(user.user_id) if user.user_id else user.college_id

    result = await generate_neetpg_mock_test(
        db=db,
        gateway=gateway,
        prompt_registry=registry,
        student_id=student_id,
        college_id=user.college_id,
        test_type=parsed.test_type,
        subject_focus=parsed.subject_focus,
        weak_area_focus=parsed.weak_area_focus,
    )

    return result.model_dump()


@router.post("/student/neetpg/submit-test")
async def submit_neetpg_test(
    body: dict[str, Any],
    user: CurrentUser = Depends(require_student),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Submit NEET-PG mock test answers and get detailed analytics.

    Computes:
    - Raw score with NEET-PG marking scheme (+4/-1)
    - Subject-wise and topic-wise breakdowns
    - Difficulty-tier accuracy analysis
    - Time analysis with correlation metrics
    - Predicted rank range vs historical cutoffs
    - AI-generated improvement plan (via Sonnet)
    - High-yield topic focus areas

    Request body:
    {
        "test_id": "uuid",
        "answers": [...],
        "questions": [...]  (optional, for full detailed analysis)
    }

    Returns NEETPGAnalysis with comprehensive post-test analytics.
    """
    from uuid import UUID as _UUID

    from app.engines.ai.agents.neet_pg_prep import (
        NEETPGPrepAgent,
        analyze_neetpg_result,
    )
    from app.engines.ai.agents.neet_pg_schemas import (
        AnswerSubmission,
        NEETPGQuestion,
        SubmitMockTestRequest,
    )

    parsed = SubmitMockTestRequest(**body)
    gateway = get_ai_gateway()
    registry = get_prompt_registry()

    student_id = _UUID(user.user_id) if user.user_id else user.college_id
    test_id = _UUID(parsed.test_id)

    # Full analysis requires the original questions for correctness checking.
    # Client caches questions from generate-mock and sends them back here.
    questions_data = body.get("questions", [])

    if questions_data:
        questions = [NEETPGQuestion(**q) for q in questions_data]
        answers = [AnswerSubmission(**a) for a in body["answers"]]

        result = await analyze_neetpg_result(
            db=db,
            gateway=gateway,
            prompt_registry=registry,
            student_id=student_id,
            college_id=user.college_id,
            test_id=test_id,
            questions=questions,
            answers=answers,
        )
    else:
        # Basic analysis without question data — store attempt
        agent = NEETPGPrepAgent(db, gateway, registry)
        answers = [AnswerSubmission(**a) for a in body["answers"]]
        result = await agent.analyze_mock_test_result(
            student_id=student_id,
            college_id=user.college_id,
            test_id=test_id,
            answers=answers,
        )

    return result.model_dump()


@router.get("/student/neetpg/high-yield-topics")
async def get_neetpg_high_yield_topics_endpoint(
    days_until_exam: int = Query(90, ge=1, le=365),
    user: CurrentUser = Depends(require_student),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get prioritized high-yield topics for NEET-PG preparation.

    Returns topics sorted by priority score based on:
    1. Historical NEET-PG topic frequency (last 10 years)
    2. Student's current mastery per topic
    3. Days remaining until exam (urgency weighting)

    Each topic includes historical_frequency, student_mastery,
    priority_score, estimated_questions_in_exam, recommended_hours.
    """
    from uuid import UUID as _UUID

    from app.engines.ai.agents.neet_pg_prep import get_neetpg_high_yield_topics

    gateway = get_ai_gateway()
    registry = get_prompt_registry()

    student_id = _UUID(user.user_id) if user.user_id else user.college_id

    topics = await get_neetpg_high_yield_topics(
        db=db,
        gateway=gateway,
        prompt_registry=registry,
        student_id=student_id,
        college_id=user.college_id,
        days_until_exam=days_until_exam,
    )

    return {"topics": [t.model_dump() for t in topics], "days_until_exam": days_until_exam}


@router.get("/student/neetpg/history")
async def get_neetpg_history_endpoint(
    user: CurrentUser = Depends(require_student),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Return past NEET-PG mock test results and progress trend.

    Includes list of past tests with scores, percentiles, and
    score trend (improving/declining/stable).
    """
    from uuid import UUID as _UUID

    from app.engines.ai.agents.neet_pg_prep import get_neetpg_history

    gateway = get_ai_gateway()
    registry = get_prompt_registry()

    student_id = _UUID(user.user_id) if user.user_id else user.college_id

    history = await get_neetpg_history(
        db=db,
        gateway=gateway,
        prompt_registry=registry,
        student_id=student_id,
        college_id=user.college_id,
    )

    return history.model_dump()


# ---------------------------------------------------------------------------
# Flashcard Generator (S5 — AI-powered flashcards + SM-2)
# ---------------------------------------------------------------------------

@router.post("/student/flashcards/generate-from-pdf")
async def generate_flashcards_from_pdf_endpoint(
    body: dict[str, Any],
    user: CurrentUser = Depends(require_student),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Generate flashcards from a PDF document.

    Uses RAG to retrieve content from the PDF, then Sonnet
    constrained decoding to produce structured flashcards.
    Each flashcard follows the ONE concept principle.

    Returns FlashcardBatch with generated cards stored in DB.
    """
    from uuid import UUID as _UUID

    from app.engines.ai.agents.flashcard_generator import (
        generate_flashcards_from_pdf,
    )
    from app.engines.ai.agents.flashcard_schemas import GenerateFromPDFRequest

    parsed = GenerateFromPDFRequest(**body)
    gateway = get_ai_gateway()
    registry = get_prompt_registry()

    student_id = _UUID(user.user_id) if user.user_id else user.college_id

    result = await generate_flashcards_from_pdf(
        db=db,
        gateway=gateway,
        prompt_registry=registry,
        student_id=student_id,
        college_id=user.college_id,
        pdf_id=parsed.pdf_id,
        page_range=parsed.page_range,
        subject=parsed.subject,
        topic=parsed.topic,
        count=parsed.count,
        card_types=parsed.card_types,
    )

    return result.model_dump()


@router.post("/student/flashcards/generate-from-topic")
async def generate_flashcards_from_topic_endpoint(
    body: dict[str, Any],
    user: CurrentUser = Depends(require_student),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Generate flashcards from a medical topic.

    Focus modes:
    - comprehensive: balanced coverage of the topic
    - high_yield: exam-relevant concepts only
    - weak_areas: targets weak topics from metacognitive profile

    Returns FlashcardBatch with generated cards stored in DB.
    """
    from uuid import UUID as _UUID

    from app.engines.ai.agents.flashcard_generator import (
        generate_flashcards_from_topic,
    )
    from app.engines.ai.agents.flashcard_schemas import GenerateFromTopicRequest

    parsed = GenerateFromTopicRequest(**body)
    gateway = get_ai_gateway()
    registry = get_prompt_registry()

    student_id = _UUID(user.user_id) if user.user_id else user.college_id

    result = await generate_flashcards_from_topic(
        db=db,
        gateway=gateway,
        prompt_registry=registry,
        student_id=student_id,
        college_id=user.college_id,
        subject=parsed.subject,
        topic=parsed.topic,
        count=parsed.count,
        focus=parsed.focus,
    )

    return result.model_dump()


@router.get("/student/flashcards/review-session")
async def get_review_session_endpoint(
    max_cards: int = Query(20, ge=1, le=50),
    subject: str | None = Query(None),
    user: CurrentUser = Depends(require_student),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get flashcards due for review (SM-2 scheduling).

    Returns cards in priority order:
    1. Overdue cards (past their review date)
    2. Cards due today
    3. New cards (never reviewed)

    Each card includes ease_factor, interval, and days_overdue.
    """
    from uuid import UUID as _UUID

    from app.engines.ai.agents.flashcard_generator import get_review_session

    gateway = get_ai_gateway()
    registry = get_prompt_registry()

    student_id = _UUID(user.user_id) if user.user_id else user.college_id

    result = await get_review_session(
        db=db,
        gateway=gateway,
        prompt_registry=registry,
        student_id=student_id,
        college_id=user.college_id,
        max_cards=max_cards,
        subject=subject,
    )

    return result.model_dump()


@router.post("/student/flashcards/{card_id}/review")
async def review_flashcard_endpoint(
    card_id: str,
    body: dict[str, Any],
    user: CurrentUser = Depends(require_student),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Process a flashcard review using SM-2 algorithm.

    SM-2 quality scale:
    0 = complete blackout
    1 = wrong but recognized
    2 = wrong but easy to recall
    3 = correct with difficulty
    4 = correct with some hesitation
    5 = perfect recall

    Returns updated SM-2 state: new ease_factor, interval,
    repetition_count, and next_review_date.

    Also fires a metacognitive event for the analytics engine.
    """
    from uuid import UUID as _UUID

    from app.engines.ai.agents.flashcard_generator import process_flashcard_review
    from app.engines.ai.agents.flashcard_schemas import ReviewRequest

    parsed = ReviewRequest(**body)
    gateway = get_ai_gateway()
    registry = get_prompt_registry()

    student_id = _UUID(user.user_id) if user.user_id else user.college_id

    result = await process_flashcard_review(
        db=db,
        gateway=gateway,
        prompt_registry=registry,
        student_id=student_id,
        college_id=user.college_id,
        card_id=_UUID(card_id),
        quality=parsed.response_quality,
        response_time_ms=parsed.response_time_ms,
    )

    return result.model_dump()


@router.get("/student/flashcards/stats")
async def get_flashcard_stats_endpoint(
    user: CurrentUser = Depends(require_student),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get the student's flashcard statistics.

    Returns: total_cards, active, due_today, overdue, mastered,
    learning, new_cards, per-subject breakdown, avg_ease_factor,
    total_reviews, and streak_days.
    """
    from uuid import UUID as _UUID

    from app.engines.ai.agents.flashcard_generator import get_flashcard_stats

    gateway = get_ai_gateway()
    registry = get_prompt_registry()

    student_id = _UUID(user.user_id) if user.user_id else user.college_id

    result = await get_flashcard_stats(
        db=db,
        gateway=gateway,
        prompt_registry=registry,
        student_id=student_id,
        college_id=user.college_id,
    )

    return result.model_dump()


# ---------------------------------------------------------------------------
# Recommendation Engine (S6 — LangGraph supervisor, student-facing)
# ---------------------------------------------------------------------------

@router.get("/student/recommendations")
async def get_recommendations_endpoint(
    user: CurrentUser = Depends(require_student),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get the student's current active recommendations.

    Returns personalized study recommendations based on:
    - Knowledge gaps from metacognitive profile
    - Improvement/decline trends
    - Workload and burnout assessment
    - Student archetype (personalization)

    If no recommendations exist, triggers fresh generation.
    """
    from uuid import UUID as _UUID

    from app.engines.ai.agents.recommendation_engine import (
        get_current_recommendations,
        run_recommendations,
    )

    gateway = get_ai_gateway()
    registry = get_prompt_registry()

    student_id = _UUID(user.user_id) if user.user_id else user.college_id

    # Try to get existing recommendations first
    result = await get_current_recommendations(
        db,
        student_id=student_id,
        college_id=user.college_id,
    )

    # If no active recommendations, generate fresh ones
    if result.total == 0:
        result = await run_recommendations(
            db, gateway, registry,
            student_id=student_id,
            college_id=user.college_id,
            trigger="manual",
        )

    return result.model_dump()


@router.get("/student/study-plan")
async def get_study_plan_endpoint(
    user: CurrentUser = Depends(require_student),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get the student's current weekly study plan.

    Returns a 7-day study schedule with:
    - Daily topic allocations
    - Flashcard review sessions
    - Practice test slots
    - Break recommendations (archetype-personalized)
    - Focus subjects and weekly goal

    Plans are generated weekly via Celery task or on-demand
    by calling POST /student/recommendations with trigger="weekly".
    """
    from uuid import UUID as _UUID

    from app.engines.ai.agents.recommendation_engine import (
        get_current_study_plan,
    )

    student_id = _UUID(user.user_id) if user.user_id else user.college_id

    plan = await get_current_study_plan(
        db,
        student_id=student_id,
        college_id=user.college_id,
    )

    if not plan:
        return {
            "has_plan": False,
            "message": "No active study plan. One will be generated on Sunday evening, "
                       "or you can request recommendations to trigger generation.",
        }

    return {"has_plan": True, **plan.model_dump()}


@router.post("/student/recommendations/{recommendation_id}/dismiss")
async def dismiss_recommendation_endpoint(
    recommendation_id: str,
    body: dict[str, Any],
    user: CurrentUser = Depends(require_student),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Dismiss a recommendation the student doesn't want to follow.

    Captures optional dismissal reason as feedback for improving
    future recommendations.
    """
    from uuid import UUID as _UUID

    from app.engines.ai.agents.recommendation_engine import (
        dismiss_recommendation,
    )
    from app.engines.ai.agents.recommendation_schemas import DismissRequest

    parsed = DismissRequest(**body)
    student_id = _UUID(user.user_id) if user.user_id else user.college_id

    result = await dismiss_recommendation(
        db,
        student_id=student_id,
        college_id=user.college_id,
        recommendation_id=_UUID(recommendation_id),
        reason=parsed.reason,
    )

    if result["status"] == "not_found":
        raise HTTPException(status_code=404, detail="Recommendation not found")

    return result


@router.post("/student/recommendations/{recommendation_id}/complete")
async def complete_recommendation_endpoint(
    recommendation_id: str,
    body: dict[str, Any],
    user: CurrentUser = Depends(require_student),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Mark a recommendation as completed.

    Fires a metacognitive event to track that the student
    followed through on the recommendation.
    """
    from uuid import UUID as _UUID

    from app.engines.ai.agents.recommendation_engine import (
        complete_recommendation,
    )
    from app.engines.ai.agents.recommendation_schemas import CompleteRequest

    parsed = CompleteRequest(**body)
    student_id = _UUID(user.user_id) if user.user_id else user.college_id

    result = await complete_recommendation(
        db,
        student_id=student_id,
        college_id=user.college_id,
        recommendation_id=_UUID(recommendation_id),
        feedback=parsed.feedback,
    )

    if result["status"] == "not_found":
        raise HTTPException(status_code=404, detail="Recommendation not found")

    return result


# ---------------------------------------------------------------------------
# Existing stub endpoints (to be implemented with LangGraph agents)
# ---------------------------------------------------------------------------

@router.post("/chat")
async def chat():
    """Socratic AI chat endpoint."""
    return {"response": "AI chat not yet implemented"}


@router.post("/generate/mcq")
async def generate_mcq():
    """Generate MCQs for a given competency."""
    return {"questions": []}


@router.post("/generate/lesson-plan")
async def generate_lesson_plan():
    """Generate a lesson plan."""
    return {"lesson_plan": None}


@router.get("/usage")
async def get_ai_usage():
    """Get AI token usage and cost for the current tenant."""
    return {"total_tokens": 0, "cost_usd": 0.0, "budget_remaining": 0.0}
