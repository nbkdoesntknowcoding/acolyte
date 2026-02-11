"""Central AI Engine — API Routes.

Prefix: /api/v1/ai
"""

import json
import logging
from typing import Any

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import (
    get_current_user,
    get_tenant_db,
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


@router.post("/generate/flashcards")
async def generate_flashcards():
    """Generate flashcards from content."""
    return {"flashcards": []}


@router.post("/generate/lesson-plan")
async def generate_lesson_plan():
    """Generate a lesson plan."""
    return {"lesson_plan": None}


@router.get("/usage")
async def get_ai_usage():
    """Get AI token usage and cost for the current tenant."""
    return {"total_tokens": 0, "cost_usd": 0.0, "budget_remaining": 0.0}
