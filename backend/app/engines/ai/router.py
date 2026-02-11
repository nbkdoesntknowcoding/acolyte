"""Central AI Engine — Consolidated API Router.

Organizes all AI endpoints into 5 tagged groups:
  1. Student AI    — /student/*    (study buddy, practice Qs, analytics, archetype)
  2. Faculty AI    — /faculty/*    (exam Qs, review, mentoring, department analytics)
  3. Compliance AI — /compliance/* (copilot; more endpoints in Phase 4)
  4. Admin AI      — /admin/*      (copilot; more endpoints in Phase 4)
  5. AI Management — /manage/*     (budget, executions, prompt registry)

Registered in main.py at prefix /api/v1/ai.
Architecture reference: CENTRAL_AI_ENGINE_ARCHITECTURE.md Section 10.1.
"""

import json
import logging
from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import (
    get_current_user,
    get_tenant_db,
    require_college_admin,
    require_compliance,
    require_faculty_or_above,
    require_student,
)
from app.engines.ai.copilot_configs import (
    COPILOT_CONFIGS,
    ROLE_TO_COPILOT,
    create_copilot,
)
from app.engines.ai.gateway_deps import get_ai_gateway
from app.engines.ai.prompt_registry import get_prompt_registry
from app.middleware.clerk_auth import CurrentUser

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════
# Sub-routers
# ═══════════════════════════════════════════════════════════════════════════

student_router = APIRouter(prefix="/student", tags=["Student AI"])
faculty_router = APIRouter(prefix="/faculty", tags=["Faculty AI"])
compliance_router = APIRouter(prefix="/compliance", tags=["Compliance AI"])
admin_router = APIRouter(prefix="/admin", tags=["Admin AI"])
manage_router = APIRouter(prefix="/manage", tags=["AI Management"])


# ═══════════════════════════════════════════════════════════════════════════
# Shared request/response schemas
# ═══════════════════════════════════════════════════════════════════════════

class CopilotQueryRequest(BaseModel):
    """Request body for copilot query endpoint."""

    message: str = Field(..., min_length=1, max_length=10000)
    conversation_history: list[dict[str, Any]] = Field(default_factory=list)
    context: dict[str, Any] | None = Field(default=None)
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


# ═══════════════════════════════════════════════════════════════════════════
# Shared copilot SSE helpers
# ═══════════════════════════════════════════════════════════════════════════

async def _copilot_handler(
    body: CopilotQueryRequest,
    user: CurrentUser,
    db: AsyncSession,
    copilot_name: str,
):
    """Shared copilot logic — creates copilot, streams or returns JSON."""
    from uuid import UUID as _UUID

    gateway = get_ai_gateway()
    registry = get_prompt_registry()

    # Bridge Layer only for student copilot
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
    )

    user_id = _UUID(user.user_id) if user.user_id else user.college_id

    if body.stream:
        return StreamingResponse(
            _sse_generator(
                copilot, db,
                message=body.message,
                conversation_history=body.conversation_history,
                college_id=user.college_id,
                user_id=user_id,
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
    result = await copilot.query(
        db,
        message=body.message,
        conversation_history=body.conversation_history,
        college_id=user.college_id,
        user_id=user_id,
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
    user_id,
    user_role: str,
    context: dict[str, Any] | None,
    copilot_name: str,
):
    """Generate SSE events from copilot stream."""
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


# ═══════════════════════════════════════════════════════════════════════════
# 1. STUDENT AI  —  /api/v1/ai/student/*
# ═══════════════════════════════════════════════════════════════════════════

# ----- Socratic Study Buddy (S1) -----------------------------------------

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


@student_router.post("/study-buddy")
async def study_buddy(
    body: StudyBuddyRequest,
    user: CurrentUser = Depends(require_student),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Socratic Study Buddy — the flagship student AI interaction.

    Runs a LangGraph supervisor graph with RAG context retrieval,
    knowledge assessment, misconception detection, scaffolded Socratic
    response generation, and mandatory Bridge Layer preservation gate.

    Every response is architecturally guaranteed to never give direct answers.
    Returns SSE stream for progressive rendering.
    """
    from uuid import UUID as _UUID

    gateway = get_ai_gateway()
    registry = get_prompt_registry()
    student_id = _UUID(user.user_id) if user.user_id else user.college_id

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


# ----- Practice Question Generator (S2) ----------------------------------

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


@student_router.post("/generate-practice-questions")
async def generate_practice_questions_endpoint(
    body: PracticeQuestionsRequest,
    user: CurrentUser = Depends(require_student),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Practice Question Generator — generates MCQs that mirror college exam style.

    Runs a LangGraph sub-agent pipeline: load college question profile,
    retrieve medical content via RAG, generate MCQs with constrained
    decoding, validate through Medical Safety Pipeline.
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


# ----- Metacognitive Analytics (S8) — Student-facing ----------------------

class CaptureEventRequest(BaseModel):
    """Request body for capturing a metacognitive event."""

    event_type: str = Field(
        ...,
        description=(
            "question_answered, page_viewed, flashcard_reviewed, "
            "study_session_started, study_session_ended, ai_interaction, "
            "confidence_rated, navigation_event"
        ),
    )
    event_data: dict[str, Any] = Field(
        ..., description="Event-type-specific payload",
    )
    subject: str | None = Field(default=None)
    topic: str | None = Field(default=None)
    competency_code: str | None = Field(default=None)


@student_router.post("/capture-event")
async def capture_metacognitive_event(
    body: CaptureEventRequest,
    user: CurrentUser = Depends(require_student),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Capture a student interaction event for metacognitive analytics.

    Called from student-facing endpoints whenever meaningful events occur.
    Updates the student's real-time analytics profile.
    """
    from uuid import UUID as _UUID

    from app.engines.ai.analytics.metacognitive import get_analytics_engine
    from app.engines.ai.analytics.schemas import MetacognitiveEventInput

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


@student_router.get("/my-analytics")
async def get_my_analytics(
    user: CurrentUser = Depends(require_student),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Return the student's own analytics summary.

    Includes mastery heatmap data, risk areas, study patterns,
    streak, accuracy breakdown, and archetype info.
    """
    from uuid import UUID as _UUID

    from app.engines.ai.analytics.metacognitive import get_analytics_engine

    engine = get_analytics_engine()
    student_id = _UUID(user.user_id) if user.user_id else user.college_id

    summary = await engine.get_student_summary(db, student_id, user.college_id)
    return summary.model_dump()


# ----- Archetype System (S8 — Layer 1 + Layer 2) -------------------------

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


@student_router.post("/archetype-questionnaire")
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


@student_router.get("/my-archetype")
async def get_my_archetype(
    user: CurrentUser = Depends(require_student),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Return the student's archetype profile (Layer 1 + Layer 2).

    Includes self-reported archetype, behavioral archetype (if computed
    after 30+ days), and the metacognitive reveal insight if available.
    """
    from uuid import UUID as _UUID

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

    return {
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
        "reveal_insight": (
            profile.reveal_insight if profile.reveal_generated else None
        ),
        "reveal_recommendations": (
            profile.reveal_recommendations if profile.reveal_generated else None
        ),
    }


# ----- Student Copilot (S9) ----------------------------------------------

@student_router.post("/copilot")
async def student_copilot(
    body: CopilotQueryRequest,
    user: CurrentUser = Depends(require_student),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Student Copilot Chat — general assistant with Bridge Layer.

    Answers logistical queries directly (exam schedule, attendance,
    progress). Redirects academic/medical questions to the Socratic
    Study Buddy (S1). SSE stream by default.
    """
    return await _copilot_handler(body, user, db, "student_copilot")


# ═══════════════════════════════════════════════════════════════════════════
# 2. FACULTY AI  —  /api/v1/ai/faculty/*
# ═══════════════════════════════════════════════════════════════════════════

# ----- Exam Question Generator (F1) --------------------------------------

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


@faculty_router.post("/generate-exam-questions")
async def generate_exam_questions_endpoint(
    body: ExamQuestionsRequest,
    user: CurrentUser = Depends(require_faculty_or_above),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Exam Question Generator — faculty-facing Core IP agent.

    Generates assessment-grade questions (MCQ, SAQ, LAQ) with faculty's
    exact parameter specifications, detailed rubrics for SAQ/LAQ,
    Medical Safety Pipeline validation, and MANDATORY human-in-the-loop
    review. Approved questions feed into the Question Intelligence Layer.
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


@faculty_router.post("/review-question")
async def review_question_endpoint(
    body: ReviewQuestionRequest,
    user: CurrentUser = Depends(require_faculty_or_above),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Faculty question review — approve, modify, or reject.

    On approve/modify: saves AgentFeedback record, captures faculty
    pattern in Question Intelligence Layer (L4).
    On reject: saves AgentFeedback record only.
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


# ----- Faculty Analytics (F7) — Student Mentoring -------------------------

@faculty_router.get("/student-analytics/{student_id}")
async def get_student_analytics(
    student_id: str,
    user: CurrentUser = Depends(require_faculty_or_above),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Return detailed analytics for a specific student (faculty view).

    Used by F7 (Student Analytics & Mentoring). Faculty can see any
    student in their college (RLS-scoped).
    """
    from uuid import UUID as _UUID

    from app.engines.ai.analytics.metacognitive import get_analytics_engine

    engine = get_analytics_engine()
    sid = _UUID(student_id)

    summary = await engine.get_student_summary(db, sid, user.college_id)
    return summary.model_dump()


@faculty_router.get("/at-risk-students")
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


@faculty_router.get("/department-analytics")
async def get_department_analytics(
    department: str | None = None,
    user: CurrentUser = Depends(require_faculty_or_above),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Return aggregate analytics for a department.

    Used by F7 for department-level oversight. Includes topic mastery,
    risk distribution, engagement trends, and common weak areas.
    """
    from app.engines.ai.analytics.metacognitive import get_analytics_engine

    engine = get_analytics_engine()

    analytics = await engine.get_department_analytics(
        db,
        college_id=user.college_id,
        department=department,
    )

    return analytics.model_dump()


# ----- Faculty Copilot (F8) -----------------------------------------------

@faculty_router.post("/copilot")
async def faculty_copilot(
    body: CopilotQueryRequest,
    user: CurrentUser = Depends(require_faculty_or_above),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Faculty Copilot Chat — assessment assistance and student insights.

    Helps with question generation, rubric design, student performance
    queries, and pedagogical guidance. No Bridge Layer — faculty gets
    direct answers. SSE stream by default.
    """
    return await _copilot_handler(body, user, db, "faculty_copilot")


# ═══════════════════════════════════════════════════════════════════════════
# 3. COMPLIANCE AI  —  /api/v1/ai/compliance/*
# ═══════════════════════════════════════════════════════════════════════════

@compliance_router.post("/copilot")
async def compliance_copilot(
    body: CopilotQueryRequest,
    user: CurrentUser = Depends(require_compliance),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Compliance Copilot Chat — NMC/NAAC/NBA regulatory guidance.

    Answers queries about MSR norms, AEBAS compliance, SAF generation,
    inspection readiness, and accreditation requirements.
    More compliance-specific endpoints come in Phase 4.
    SSE stream by default.
    """
    return await _copilot_handler(body, user, db, "compliance_copilot")


# ═══════════════════════════════════════════════════════════════════════════
# 4. ADMIN AI  —  /api/v1/ai/admin/*
# ═══════════════════════════════════════════════════════════════════════════

@admin_router.post("/copilot")
async def admin_copilot(
    body: CopilotQueryRequest,
    user: CurrentUser = Depends(require_college_admin),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Admin Copilot Chat — institutional operations assistant.

    Handles queries about admissions, fee management, HR/payroll,
    infrastructure, and hostel/transport operations.
    More admin-specific endpoints come in Phase 4. SSE stream by default.
    """
    return await _copilot_handler(body, user, db, "admin_copilot")


# ═══════════════════════════════════════════════════════════════════════════
# 5. AI MANAGEMENT  —  /api/v1/ai/manage/*
# ═══════════════════════════════════════════════════════════════════════════

# ----- Budget usage -------------------------------------------------------

@manage_router.get("/budget")
async def get_ai_budget(
    user: CurrentUser = Depends(require_college_admin),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get current AI budget usage for the college.

    Returns the active monthly budget, usage breakdown by engine,
    and remaining capacity.
    """
    from app.engines.ai.models import AIBudget

    today = date.today()
    result = await db.execute(
        select(AIBudget).where(
            AIBudget.college_id == user.college_id,
            AIBudget.period_start <= today,
            AIBudget.period_end >= today,
        ).order_by(AIBudget.period_start.desc()).limit(1)
    )
    budget = result.scalars().first()

    if not budget:
        return {
            "has_budget": False,
            "message": "No AI budget configured for this period.",
        }

    return {
        "has_budget": True,
        "period_start": budget.period_start.isoformat(),
        "period_end": budget.period_end.isoformat(),
        "total_budget_usd": float(budget.total_budget_usd),
        "used_amount_usd": float(budget.used_amount_usd),
        "remaining_usd": float(
            budget.total_budget_usd - budget.used_amount_usd,
        ),
        "usage_pct": round(
            float(budget.used_amount_usd / budget.total_budget_usd * 100), 1,
        ) if budget.total_budget_usd else 0,
        "token_count_input": budget.token_count_input,
        "token_count_output": budget.token_count_output,
        "token_count_cached": budget.token_count_cached,
        "engine_breakdown": budget.engine_breakdown,
        "budget_status": budget.budget_status,
    }


# ----- Execution logs -----------------------------------------------------

@manage_router.get("/executions")
async def get_ai_executions(
    agent_id: str | None = Query(
        default=None, description="Filter by agent ID",
    ),
    status: str | None = Query(
        default=None, description="Filter by status",
    ),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: CurrentUser = Depends(require_college_admin),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get recent AI execution logs for the college.

    Provides observability into AI operations: which agents ran,
    token usage, latency, and status.
    """
    from app.engines.ai.models import AgentExecution

    query = (
        select(AgentExecution)
        .where(AgentExecution.college_id == user.college_id)
        .order_by(AgentExecution.started_at.desc())
        .limit(limit)
        .offset(offset)
    )

    if agent_id:
        query = query.where(AgentExecution.agent_id == agent_id)
    if status:
        query = query.where(AgentExecution.status == status)

    result = await db.execute(query)
    executions = result.scalars().all()

    # Total count for pagination
    count_query = (
        select(func.count())
        .select_from(AgentExecution)
        .where(AgentExecution.college_id == user.college_id)
    )
    if agent_id:
        count_query = count_query.where(AgentExecution.agent_id == agent_id)
    if status:
        count_query = count_query.where(AgentExecution.status == status)

    total = (await db.execute(count_query)).scalar() or 0

    return {
        "executions": [
            {
                "id": str(e.id),
                "agent_id": e.agent_id,
                "task_type": e.task_type,
                "status": e.status,
                "started_at": (
                    e.started_at.isoformat() if e.started_at else None
                ),
                "completed_at": (
                    e.completed_at.isoformat() if e.completed_at else None
                ),
                "input_tokens": e.input_tokens,
                "output_tokens": e.output_tokens,
                "cost_usd": float(e.cost_usd) if e.cost_usd else None,
                "model_used": e.model_used,
                "error_message": e.error_message,
            }
            for e in executions
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


# ----- Prompt registry management -----------------------------------------

class CreatePromptRequest(BaseModel):
    """Request body for creating a new prompt version."""

    prompt_text: str = Field(..., min_length=10, max_length=50000)
    variables: list[str] | None = Field(
        default=None,
        description="Template variable names used in the prompt",
    )
    metadata: dict[str, Any] | None = Field(default=None)


class ActivatePromptRequest(BaseModel):
    """Request body for activating a specific prompt version."""

    version: int = Field(..., ge=1)


@manage_router.get("/prompts/{agent_id}")
async def get_active_prompt(
    agent_id: str,
    user: CurrentUser = Depends(require_college_admin),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get the active prompt for an agent.

    Returns the prompt text, version, and metadata. Checks for
    college-specific override first, then falls back to default.
    """
    registry = get_prompt_registry()

    try:
        prompt = await registry.get_with_metadata(
            db, agent_id=agent_id, college_id=user.college_id,
        )
    except Exception:
        return {
            "found": False,
            "agent_id": agent_id,
            "message": f"No active prompt found for agent '{agent_id}'.",
        }

    return {
        "found": True,
        "agent_id": prompt.agent_id,
        "version": prompt.version,
        "template_id": str(prompt.template_id),
        "prompt_text": prompt.prompt_text,
        "variables": prompt.variables,
        "metadata": prompt.metadata,
    }


@manage_router.post("/prompts/{agent_id}")
async def create_prompt_version(
    agent_id: str,
    body: CreatePromptRequest,
    user: CurrentUser = Depends(require_college_admin),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Create a new prompt version for an agent.

    The new version is NOT automatically activated. Use the
    /activate endpoint to switch to it after testing.
    """
    registry = get_prompt_registry()

    template = await registry.create_version(
        db,
        agent_id=agent_id,
        prompt_text=body.prompt_text,
        variables=body.variables,
        college_id=user.college_id,
        metadata=body.metadata,
    )
    await db.commit()

    return {
        "template_id": str(template.id),
        "agent_id": template.agent_id,
        "version": template.version,
        "is_active": template.is_active,
    }


@manage_router.post("/prompts/{agent_id}/activate")
async def activate_prompt_version(
    agent_id: str,
    body: ActivatePromptRequest,
    user: CurrentUser = Depends(require_college_admin),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Activate a specific prompt version for an agent.

    Deactivates the currently active version and activates the
    specified one. College-scoped — only affects this college's
    prompt override.
    """
    registry = get_prompt_registry()

    await registry.activate(
        db,
        agent_id=agent_id,
        version=body.version,
        college_id=user.college_id,
    )
    await db.commit()

    return {
        "agent_id": agent_id,
        "activated_version": body.version,
        "status": "active",
    }


# ----- Content Ingestion (L1 — RAG Pipeline) ------------------------------

@manage_router.post("/ingest-content")
async def ingest_content(
    file: UploadFile = File(
        ..., description="PDF file to ingest",
    ),
    source_type: str = Query(
        default="textbook",
        description="Content type: textbook, lecture_notes, guidelines, etc.",
    ),
    platform_wide: bool = Query(
        default=False,
        description="If true, content is platform-wide (no college scope).",
    ),
    user: CurrentUser = Depends(require_college_admin),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Ingest a medical PDF into the RAG knowledge base.

    Pipeline: PDF → text extraction (PyMuPDF) → chunking (500-800 tokens,
    100 overlap) → metadata classification (Haiku) → embedding
    (text-embedding-3-large, 1536 dims) → MedicalContent table.

    Duplicate chunks (by SHA-256 content hash) are automatically skipped.
    Upload the PDF as multipart form data with field name 'file'.
    """
    from app.config import get_settings
    from app.engines.ai.ingestion.pdf_processor import MedicalContentIngester

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        from fastapi import HTTPException
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported. Upload a .pdf file.",
        )

    settings = get_settings()
    gateway = get_ai_gateway()
    ingester = MedicalContentIngester(
        openai_api_key=settings.OPENAI_API_KEY,
        gateway=gateway,
    )

    file_bytes = await file.read()
    college_id = None if platform_wide else user.college_id

    result = await ingester.ingest_pdf(
        db=db,
        file_bytes=file_bytes,
        filename=file.filename,
        college_id=college_id,
        source_type=source_type,
    )

    await db.commit()
    return result.to_dict()


@manage_router.get("/content-stats")
async def get_content_stats(
    user: CurrentUser = Depends(require_college_admin),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get content statistics for the college's RAG knowledge base.

    Returns: total documents, total/active chunks, embedding coverage,
    breakdowns by source type and subject.
    """
    from app.engines.ai.ingestion.pdf_processor import MedicalContentIngester

    stats = await MedicalContentIngester.get_content_stats(
        db, college_id=user.college_id,
    )

    return stats.to_dict()


# ----- Available copilots (informational) ---------------------------------

@manage_router.get("/copilots")
async def list_copilot_configs(
    user: CurrentUser = Depends(get_current_user),
):
    """List available copilot configurations for the current user."""
    default_copilot = ROLE_TO_COPILOT.get(user.role.value, "admin_copilot")

    configs = []
    for name, config in COPILOT_CONFIGS.items():
        entry: dict[str, Any] = {
            "name": name,
            "description": config.description,
            "is_default": name == default_copilot,
        }
        if config.role_configs:
            entry["sub_roles"] = list(config.role_configs.keys())
        configs.append(entry)

    return {"copilots": configs, "default": default_copilot}


# ═══════════════════════════════════════════════════════════════════════════
# Main router — aggregates all sub-routers
# ═══════════════════════════════════════════════════════════════════════════

router = APIRouter()
router.include_router(student_router)
router.include_router(faculty_router)
router.include_router(compliance_router)
router.include_router(admin_router)
router.include_router(manage_router)
