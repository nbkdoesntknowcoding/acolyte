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

from app.dependencies.auth import get_current_user, get_tenant_db, require_student
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
