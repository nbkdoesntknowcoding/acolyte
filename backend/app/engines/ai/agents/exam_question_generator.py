"""Exam Question Generator — Section F1 of architecture document.

Faculty-facing Core IP agent. Shares the sub-agent pipeline with S2
(Practice Question Generator) but with critical differences:

1. Faculty has FULL parameter control (difficulty, Bloom's, competency,
   question type including SAQ/LAQ/EMQ/OSCE)
2. Human-in-the-loop is MANDATORY — every question requires faculty approval
3. Wider output types: MCQ + SAQ with rubrics + LAQ with rubrics
4. Approved questions feed INTO the Question Intelligence Layer (L4)
5. No Bridge Layer — faculty gets direct, complete output

Pipeline:
    START → retrieve_content → fetch_graph_data → generate_questions
          → validate_questions → prepare_review_package → END

Faculty review (async, after generation):
    handle_faculty_review() → approve/modify/reject
        On approve/modify: save to question bank + capture L4 pattern
        On reject: create AgentFeedback record only
"""

import json
import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.engines.ai.agents.practice_question_generator import (
    GeneratedMCQ,
    MCQOption,
    _build_generation_prompt,
    _format_passages,
    _format_question_for_validation,
)
from app.engines.ai.gateway import AIGateway
from app.engines.ai.models import AgentExecution, AgentFeedback
from app.engines.ai.pipelines.medical_safety import MedicalSafetyPipeline
from app.engines.ai.prompt_registry import PromptRegistry
from app.engines.ai.question_intelligence import get_question_intelligence_layer
from app.engines.ai.rag import get_rag_engine
from app.engines.ai.tools import get_tools_for_agent

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

AGENT_ID = "exam_question_generator"
MAX_RETRY_ATTEMPTS = 2


# ---------------------------------------------------------------------------
# Pydantic output schemas — SAQ/LAQ rubrics
# ---------------------------------------------------------------------------

class RubricCriterion(BaseModel):
    """A single rubric criterion for SAQ/LAQ grading."""

    model_config = ConfigDict(extra="forbid")

    criterion: str = Field(description="What is being assessed")
    max_marks: int = Field(ge=1, description="Maximum marks for this criterion")
    description: str = Field(description="What the examiner should look for")
    expected_points: list[str] = Field(
        description="Key points the student must cover",
    )
    partial_credit_guidelines: str = Field(
        description="How to award partial marks",
    )


class GeneratedSAQ(BaseModel):
    """A generated Short Answer Question with rubric."""

    model_config = ConfigDict(extra="forbid")

    question_text: str = Field(description="The SAQ question stem")
    total_marks: int = Field(ge=1, description="Total marks for this question")
    criteria: list[RubricCriterion] = Field(
        min_length=1, description="Rubric criteria for grading",
    )
    model_answer: str = Field(description="Reference answer for the examiner")
    common_mistakes: list[str] = Field(
        description="Common student errors to watch for",
    )
    competency_code: str = Field(
        description='NMC competency code (e.g., "PH 1.25")',
    )
    blooms_level: str = Field(
        description="remember, understand, apply, analyze, evaluate",
    )
    difficulty_rating: int = Field(ge=1, le=5, description="1-5 scale")
    source_citations: list[str] = Field(
        description="Which sources were used",
    )


class SubQuestion(BaseModel):
    """A sub-question within a LAQ."""

    model_config = ConfigDict(extra="forbid")

    text: str = Field(description="Sub-question text")
    marks: int = Field(ge=1, description="Marks allocated")
    expected_answer: str = Field(description="Expected answer for this part")


class GeneratedLAQ(BaseModel):
    """A generated Long Answer Question with detailed rubric."""

    model_config = ConfigDict(extra="forbid")

    question_text: str = Field(description="The LAQ question stem")
    total_marks: int = Field(ge=1, description="Total marks for this question")
    sub_questions: list[SubQuestion] = Field(
        min_length=1, description="Sub-parts with individual marks",
    )
    overall_rubric: list[RubricCriterion] = Field(
        min_length=1, description="Overall rubric criteria",
    )
    model_answer: str = Field(description="Complete reference answer")
    marking_scheme_notes: str = Field(
        description="Additional notes for the examiner on marking",
    )
    competency_code: str = Field(
        description='NMC competency code (e.g., "AN 10.1")',
    )
    blooms_level: str = Field(
        description="remember, understand, apply, analyze, evaluate",
    )
    source_citations: list[str] = Field(
        description="Which sources were used",
    )


# Union type for all question types
GeneratedQuestion = GeneratedMCQ | GeneratedSAQ | GeneratedLAQ


class ExamQuestionDraft(BaseModel):
    """Output sent to faculty for review."""

    model_config = ConfigDict(extra="forbid")

    questions: list[dict[str, Any]] = Field(
        description="Generated questions (MCQ, SAQ, or LAQ dicts)",
    )
    review_status: str = Field(
        default="pending_review",
        description="Always pending_review on generation",
    )
    generation_metadata: dict[str, Any] = Field(
        description="Model, tokens, retries, etc.",
    )
    execution_id: str = Field(
        description="Execution UUID for tracking review actions",
    )


# ---------------------------------------------------------------------------
# LangGraph state
# ---------------------------------------------------------------------------

from typing import TypedDict  # noqa: E402


class ExamGenState(TypedDict):
    """Typed state schema for the Exam Question Generator graph."""

    # Input
    college_id: str  # UUID as string
    faculty_id: str
    request: dict  # subject, topic, difficulty, blooms_level, count, question_type, etc.

    # RAG context
    retrieved_content: list[dict]

    # Knowledge graph data (differentials, relationships)
    knowledge_graph_data: dict

    # Generation pipeline
    generated_questions: list[dict]
    validated_questions: list[dict]
    rejected_questions: list[dict]
    retry_count: int

    # Output
    final_output: dict


# ---------------------------------------------------------------------------
# Node functions
# ---------------------------------------------------------------------------

async def retrieve_content(
    state: ExamGenState,
    *,
    db: AsyncSession,
) -> dict:
    """Node 1: Retrieve relevant medical content via RAG.

    Same as S2 but uses faculty's exact parameters.
    """
    college_id = UUID(state["college_id"])
    request = state["request"]
    subject = request.get("subject", "")
    topic = request.get("topic", "")
    competency_code = request.get("competency_code")

    # RAG retrieval
    engine = get_rag_engine()
    filters: dict[str, Any] = {}
    if subject:
        filters["subject"] = subject

    rag_result = await engine.retrieve(
        db=db,
        query=f"{subject}: {topic}",
        college_id=college_id,
        filters=filters if filters else None,
        top_k=5,
    )

    passages = []
    for r in rag_result.passages:
        meta = r.source_metadata
        passages.append({
            "content": r.content[:800],
            "title": meta.get("title", ""),
            "book": meta.get("book", ""),
            "chapter": meta.get("chapter", ""),
            "page": meta.get("page", ""),
            "source_reference": meta.get("source_reference", ""),
            "score": r.score,
        })

    # Competency details if code provided
    competency_info: dict[str, Any] | None = None
    if competency_code:
        _, executor = get_tools_for_agent(AGENT_ID, db, college_id)
        competency_info = await executor(
            "get_competency_details",
            {"competency_code": competency_code},
        )

    content_data = {
        "passages": passages,
        "formatted_context": rag_result.formatted_context,
        "competency_info": competency_info,
    }

    return {"retrieved_content": [content_data]}


async def fetch_graph_data(
    state: ExamGenState,
    *,
    db: AsyncSession,
) -> dict:
    """Node 2: Fetch knowledge graph data for distractor/rubric generation."""
    college_id = UUID(state["college_id"])
    request = state["request"]
    topic = request.get("topic", "")

    _, executor = get_tools_for_agent(AGENT_ID, db, college_id)

    graph_data = await executor(
        "get_differential_diagnoses",
        {"primary_diagnosis": topic, "max_results": 8},
    )

    return {"knowledge_graph_data": graph_data}


async def generate_questions(
    state: ExamGenState,
    *,
    db: AsyncSession,
    gateway: AIGateway,
    prompt_registry: PromptRegistry,
) -> dict:
    """Node 3: Generate questions using faculty's exact specifications.

    Handles MCQ, SAQ, and LAQ types. Uses constrained decoding for each type.
    Faculty parameters override everything — no college profile adaptation.
    """
    college_id = UUID(state["college_id"])
    faculty_id = UUID(state["faculty_id"])
    request = state["request"]

    subject = request.get("subject", "General")
    topic = request.get("topic", "")
    difficulty = request.get("difficulty", 3)
    blooms_level = request.get("blooms_level", "apply")
    count = request.get("count", 5)
    question_type = request.get("question_type", "mcq")
    competency_code = request.get("competency_code", "")
    clinical_vignette = request.get("clinical_vignette", True)
    aetcom_integration = request.get("aetcom_integration", False)
    image_based = request.get("image_based", False)

    # Build context from previous nodes
    retrieved = state.get("retrieved_content", [{}])
    content_data = retrieved[0] if retrieved else {}
    graph_data = state.get("knowledge_graph_data", {})

    passages_text = _format_passages(content_data.get("passages", []))

    differentials = graph_data.get("differentials", [])
    diff_text = "\n".join(
        f"- {d.get('diagnosis', '')}: {d.get('reasoning', '')}"
        for d in differentials[:6]
    ) or "No differentials available — generate distractors from related conditions."

    comp_info = content_data.get("competency_info")
    comp_text = ""
    if comp_info and comp_info.get("found"):
        comp_text = (
            f"Competency: {comp_info.get('competency_code', '')} — "
            f"{comp_info.get('description', '')}\n"
            f"Level: {comp_info.get('level', '')}\n"
            f"Subject: {comp_info.get('subject', '')}"
        )

    # Rejection context from retries
    rejected = state.get("rejected_questions", [])
    rejection_context = ""
    if rejected:
        rejection_context = (
            "\n\nPREVIOUS QUESTIONS WERE REJECTED. Avoid these specific issues:\n"
        )
        for rq in rejected:
            reasons = rq.get("rejection_reasons", [])
            rejection_context += f"- {'; '.join(reasons)}\n"

    # Select schema and prompt based on question type
    if question_type == "saq":
        output_schema = GeneratedSAQ
        system_prompt = _build_saq_prompt(
            passages_text=passages_text,
            comp_text=comp_text,
        )
    elif question_type == "laq":
        output_schema = GeneratedLAQ
        system_prompt = _build_laq_prompt(
            passages_text=passages_text,
            comp_text=comp_text,
        )
    else:
        # MCQ — reuse S2 prompt builder with empty profile (faculty controls)
        output_schema = GeneratedMCQ
        system_prompt = _build_generation_prompt(
            profile={},  # No college profile — faculty sets own params
            passages_text=passages_text,
            diff_text=diff_text,
            comp_text=comp_text,
        )

    # Additional faculty instructions
    faculty_addendum = _build_faculty_addendum(
        clinical_vignette=clinical_vignette,
        aetcom_integration=aetcom_integration,
        image_based=image_based,
    )
    system_prompt += faculty_addendum

    # Generate one question at a time for quality
    generated: list[dict] = []

    for i in range(count):
        user_message = (
            f"Generate exam {question_type.upper()} #{i + 1} of {count}.\n\n"
            f"Subject: {subject}\n"
            f"Topic: {topic}\n"
            f"EXACT difficulty: {difficulty}/5 (faculty-specified, do not deviate)\n"
            f"EXACT Bloom's level: {blooms_level} (faculty-specified)\n"
            f"Competency code: {competency_code or 'any relevant'}\n"
            f"{rejection_context}"
        )

        if i > 0 and generated:
            prev_texts = [
                q.get("lead_in", q.get("question_text", "")) for q in generated
            ]
            user_message += (
                f"\nAlready generated (do NOT repeat):\n"
                + "\n".join(f"- {s}" for s in prev_texts)
            )

        try:
            question = await gateway.complete_structured(
                db,
                system_prompt=system_prompt,
                user_message=user_message,
                output_schema=output_schema,
                model="claude-sonnet-4-5-20250929",
                college_id=college_id,
                user_id=faculty_id,
                agent_id=AGENT_ID,
                task_type="exam_question_gen",
                cache_system_prompt=True,
                max_tokens=4096,  # Larger for SAQ/LAQ rubrics
                temperature=1.0,
            )
            q_dict = question.model_dump()
            q_dict["_question_type"] = question_type
            generated.append(q_dict)
        except Exception as e:
            logger.error(
                "Exam question generation failed for question %d: %s", i + 1, e,
            )

    return {"generated_questions": generated}


async def validate_questions(
    state: ExamGenState,
    *,
    db: AsyncSession,
    gateway: AIGateway,
) -> dict:
    """Node 4: Validate questions through the Medical Safety Pipeline.

    CRITICAL: ALWAYS sets requires_human_review=True. Faculty approval
    is a hard requirement for all exam questions — no auto-approve.
    """
    college_id = UUID(state["college_id"])
    pipeline = MedicalSafetyPipeline(gateway)

    generated = state.get("generated_questions", [])
    already_validated = state.get("validated_questions", [])

    retrieved = state.get("retrieved_content", [{}])
    content_data = retrieved[0] if retrieved else {}
    source_context = content_data.get("formatted_context", "")

    newly_validated: list[dict] = []
    newly_rejected: list[dict] = []

    for q in generated:
        q_type = q.get("_question_type", "mcq")

        if q_type == "mcq":
            question_text = _format_question_for_validation(q)
        else:
            question_text = _format_saq_laq_for_validation(q)

        result = await pipeline.validate(
            db,
            content=question_text,
            content_type=q_type,
            college_id=college_id,
            source_context=source_context,
            declared_blooms_level=q.get("blooms_level"),
            # ALWAYS summative for exam questions — requires human review
            is_summative=True,
        )

        if result.passed:
            # Mark that it STILL needs human review (summative = always review)
            q["_safety_passed"] = True
            q["_safety_confidence"] = result.overall_confidence
            newly_validated.append(q)
        else:
            q_with_reasons = {**q, "rejection_reasons": result.rejection_reasons}
            newly_rejected.append(q_with_reasons)
            logger.info(
                "Exam question rejected (confidence=%.2f): %s",
                result.overall_confidence,
                result.rejection_reasons[:2],
            )

    return {
        "validated_questions": already_validated + newly_validated,
        "rejected_questions": newly_rejected,
        "generated_questions": [],
    }


async def retry_failed(
    state: ExamGenState,
    *,
    db: AsyncSession,
    gateway: AIGateway,
    prompt_registry: PromptRegistry,
) -> dict:
    """Node 5: Regenerate rejected questions with failure-specific instructions."""
    retry_count = state.get("retry_count", 0) + 1

    logger.info(
        "Retrying %d rejected exam questions (attempt %d/%d)",
        len(state.get("rejected_questions", [])),
        retry_count,
        MAX_RETRY_ATTEMPTS,
    )

    result = await generate_questions(
        state,
        db=db,
        gateway=gateway,
        prompt_registry=prompt_registry,
    )

    return {
        **result,
        "retry_count": retry_count,
        "rejected_questions": [],
    }


async def prepare_review_package(state: ExamGenState) -> dict:
    """Node 6: Format the output for the faculty review UI.

    Assembles the ExamQuestionDraft with review_status="pending_review".
    Faculty will review each question individually via handle_faculty_review().
    """
    validated = state.get("validated_questions", [])
    request = state.get("request", {})
    retry_count = state.get("retry_count", 0)

    # Clean internal fields before sending to faculty
    clean_questions = []
    for q in validated:
        clean_q = {
            k: v for k, v in q.items()
            if not k.startswith("_")
        }
        clean_questions.append(clean_q)

    return {
        "final_output": {
            "questions": clean_questions,
            "review_status": "pending_review",
            "generation_metadata": {
                "requested_count": request.get("count", 5),
                "generated_count": len(clean_questions),
                "subject": request.get("subject", ""),
                "topic": request.get("topic", ""),
                "difficulty": request.get("difficulty", 3),
                "blooms_level": request.get("blooms_level", "apply"),
                "question_type": request.get("question_type", "mcq"),
                "retries_used": retry_count,
                "model": "claude-sonnet-4-5-20250929",
                "requires_human_review": True,
            },
        },
    }


# ---------------------------------------------------------------------------
# Conditional edge: validation routing
# ---------------------------------------------------------------------------

def _route_after_validation(state: ExamGenState) -> str:
    """Route based on validation results.

    Same logic as S2 — retry rejected if under max attempts.
    """
    rejected = state.get("rejected_questions", [])
    retry_count = state.get("retry_count", 0)

    if not rejected:
        return "prepare_review_package"

    if retry_count < MAX_RETRY_ATTEMPTS:
        return "retry_failed"

    logger.warning(
        "Max retries (%d) exhausted with %d rejected exam questions — "
        "delivering %d validated",
        MAX_RETRY_ATTEMPTS,
        len(rejected),
        len(state.get("validated_questions", [])),
    )
    return "prepare_review_package"


# ---------------------------------------------------------------------------
# Graph builder
# ---------------------------------------------------------------------------

def build_exam_gen_graph(
    *,
    db: AsyncSession,
    gateway: AIGateway,
    prompt_registry: PromptRegistry,
    checkpointer: Any = None,
) -> Any:
    """Build the Exam Question Generator LangGraph.

    Returns a compiled graph ready for invocation.
    """
    # Bind dependencies via closures
    async def _retrieve(state: ExamGenState) -> dict:
        return await retrieve_content(state, db=db)

    async def _fetch_graph(state: ExamGenState) -> dict:
        return await fetch_graph_data(state, db=db)

    async def _generate(state: ExamGenState) -> dict:
        return await generate_questions(
            state, db=db, gateway=gateway, prompt_registry=prompt_registry,
        )

    async def _validate(state: ExamGenState) -> dict:
        return await validate_questions(state, db=db, gateway=gateway)

    async def _retry(state: ExamGenState) -> dict:
        return await retry_failed(
            state, db=db, gateway=gateway, prompt_registry=prompt_registry,
        )

    async def _prepare_review(state: ExamGenState) -> dict:
        return await prepare_review_package(state)

    # Build the graph — no load_college_profile (faculty sets params)
    graph = StateGraph(ExamGenState)

    graph.add_node("retrieve_content", _retrieve)
    graph.add_node("fetch_graph_data", _fetch_graph)
    graph.add_node("generate_questions", _generate)
    graph.add_node("validate_questions", _validate)
    graph.add_node("retry_failed", _retry)
    graph.add_node("prepare_review_package", _prepare_review)

    # Edges
    graph.add_edge(START, "retrieve_content")
    graph.add_edge("retrieve_content", "fetch_graph_data")
    graph.add_edge("fetch_graph_data", "generate_questions")
    graph.add_edge("generate_questions", "validate_questions")

    # Conditional: validation routing
    graph.add_conditional_edges(
        "validate_questions",
        _route_after_validation,
        {
            "prepare_review_package": "prepare_review_package",
            "retry_failed": "retry_failed",
        },
    )

    graph.add_edge("retry_failed", "validate_questions")
    graph.add_edge("prepare_review_package", END)

    if checkpointer is None:
        checkpointer = MemorySaver()

    return graph.compile(checkpointer=checkpointer)


# ---------------------------------------------------------------------------
# Entry point — generate exam questions
# ---------------------------------------------------------------------------

async def generate_exam_questions(
    *,
    db: AsyncSession,
    gateway: AIGateway,
    prompt_registry: PromptRegistry,
    subject: str,
    topic: str,
    difficulty: int = 3,
    blooms_level: str = "apply",
    count: int = 5,
    question_type: str = "mcq",
    competency_code: str | None = None,
    clinical_vignette: bool = True,
    aetcom_integration: bool = False,
    image_based: bool = False,
    faculty_id: UUID,
    college_id: UUID,
) -> ExamQuestionDraft:
    """Run the Exam Question Generator agent.

    Args:
        subject: Medical subject (e.g., "Pharmacology").
        topic: Specific topic (e.g., "Antihypertensives").
        difficulty: Target difficulty 1-5 (faculty-specified, exact).
        blooms_level: Target Bloom's level (faculty-specified, exact).
        count: Number of questions to generate (1-10).
        question_type: "mcq", "saq", or "laq".
        competency_code: Optional NMC competency code.
        clinical_vignette: Whether to include clinical vignettes.
        aetcom_integration: Whether to integrate AETCOM competencies.
        image_based: Whether to generate image-based questions.
        faculty_id: Authenticated faculty UUID.
        college_id: Tenant UUID.

    Returns:
        ExamQuestionDraft with questions pending faculty review.
    """
    count = max(1, min(count, 10))

    # Create an AgentExecution record for tracking
    execution = AgentExecution(
        college_id=college_id,
        user_id=faculty_id,
        agent_id=AGENT_ID,
        task_type="exam_question_gen",
        status="running",
        model_requested="claude-sonnet-4-5-20250929",
        model_used="claude-sonnet-4-5-20250929",
        requires_human_review=True,
        request_summary=f"{question_type.upper()} generation: {subject}/{topic} x{count}",
        started_at=datetime.now(timezone.utc),
    )
    db.add(execution)
    await db.flush()
    execution_id = str(execution.id)

    initial_state: dict[str, Any] = {
        "college_id": str(college_id),
        "faculty_id": str(faculty_id),
        "request": {
            "subject": subject,
            "topic": topic,
            "difficulty": difficulty,
            "blooms_level": blooms_level,
            "count": count,
            "question_type": question_type,
            "competency_code": competency_code or "",
            "clinical_vignette": clinical_vignette,
            "aetcom_integration": aetcom_integration,
            "image_based": image_based,
        },
        "retrieved_content": [],
        "knowledge_graph_data": {},
        "generated_questions": [],
        "validated_questions": [],
        "rejected_questions": [],
        "retry_count": 0,
        "final_output": {},
    }

    graph = build_exam_gen_graph(
        db=db,
        gateway=gateway,
        prompt_registry=prompt_registry,
    )

    config = {"configurable": {"thread_id": f"examgen_{faculty_id}_{college_id}"}}

    final_state = await graph.ainvoke(initial_state, config=config)

    output = final_state.get("final_output", {})

    # Update execution record
    await db.execute(
        update(AgentExecution)
        .where(AgentExecution.id == execution.id)
        .values(
            status="pending_review",
            human_review_status="pending",
            response_summary=f"Generated {len(output.get('questions', []))} questions",
            completed_at=datetime.now(timezone.utc),
        )
    )

    return ExamQuestionDraft(
        questions=output.get("questions", []),
        review_status="pending_review",
        generation_metadata=output.get("generation_metadata", {}),
        execution_id=execution_id,
    )


# ---------------------------------------------------------------------------
# Faculty review handler
# ---------------------------------------------------------------------------

async def handle_faculty_review(
    *,
    db: AsyncSession,
    execution_id: UUID,
    question_index: int,
    action: str,
    modifications: dict | None = None,
    faculty_id: UUID,
    college_id: UUID,
) -> dict:
    """Handle faculty review of a generated exam question.

    Called when faculty reviews a question from the ExamQuestionDraft.

    Args:
        execution_id: The AgentExecution UUID from generation.
        question_index: Index of the question in the draft batch.
        action: "approve", "modify", or "reject".
        modifications: Modified question data (required for "modify").
        faculty_id: The reviewing faculty member's UUID.
        college_id: Tenant UUID.

    Returns:
        dict with status and optional question_bank_id.

    On "approve":
        - Create AgentFeedback record (type="approved")
        - Capture faculty pattern in Question Intelligence Layer (L4)

    On "modify":
        - Create AgentFeedback with original + corrected output
        - Capture pattern from MODIFIED version (represents faculty preference)

    On "reject":
        - Create AgentFeedback record (type="rejected")
        - Do NOT capture pattern (rejected = not representative)
    """
    # Validate action
    if action not in ("approve", "modify", "reject"):
        raise ValueError(f"Invalid review action: {action}")

    # Load the execution to get the generated question
    result = await db.execute(
        select(AgentExecution).where(
            AgentExecution.id == execution_id,
            AgentExecution.college_id == college_id,
        )
    )
    execution = result.scalar_one_or_none()
    if not execution:
        from app.shared.exceptions import NotFoundException
        raise NotFoundException("AgentExecution", str(execution_id))

    now = datetime.now(timezone.utc)

    if action == "approve":
        # Create feedback record
        feedback = AgentFeedback(
            college_id=college_id,
            execution_id=execution_id,
            feedback_type="approved",
            feedback_notes="Faculty approved without changes",
            given_by=faculty_id,
            given_at=now,
        )
        db.add(feedback)

        # Capture pattern for L4 — approved version represents faculty preference
        layer = get_question_intelligence_layer()
        await layer.capture_faculty_pattern(
            db,
            question={},  # Original data from execution (approve without changes)
            college_id=college_id,
            faculty_id=faculty_id,
            execution_id=execution_id,
            question_index=question_index,
            review_action="approved",
        )

        # Update execution review status
        await db.execute(
            update(AgentExecution)
            .where(AgentExecution.id == execution_id)
            .values(
                human_review_status="approved",
                reviewed_by=faculty_id,
                reviewed_at=now,
            )
        )

        return {"status": "approved", "message": "Question approved and pattern captured"}

    elif action == "modify":
        if not modifications:
            raise ValueError("Modifications required for 'modify' action")

        # Create feedback with original + modified
        feedback = AgentFeedback(
            college_id=college_id,
            execution_id=execution_id,
            feedback_type="modified",
            corrected_output=modifications,
            feedback_notes="Faculty modified the generated question",
            given_by=faculty_id,
            given_at=now,
        )
        db.add(feedback)

        # Capture pattern from MODIFIED version — this is what faculty actually wants
        layer = get_question_intelligence_layer()
        await layer.capture_faculty_pattern(
            db,
            question=modifications,
            college_id=college_id,
            faculty_id=faculty_id,
            execution_id=execution_id,
            question_index=question_index,
            review_action="modified",
        )

        await db.execute(
            update(AgentExecution)
            .where(AgentExecution.id == execution_id)
            .values(
                human_review_status="modified",
                reviewed_by=faculty_id,
                reviewed_at=now,
            )
        )

        return {"status": "modified", "message": "Question modified and pattern captured"}

    else:  # reject
        feedback = AgentFeedback(
            college_id=college_id,
            execution_id=execution_id,
            feedback_type="rejected",
            feedback_notes=(
                modifications.get("rejection_reason", "Faculty rejected")
                if modifications else "Faculty rejected"
            ),
            given_by=faculty_id,
            given_at=now,
        )
        db.add(feedback)

        await db.execute(
            update(AgentExecution)
            .where(AgentExecution.id == execution_id)
            .values(
                human_review_status="rejected",
                reviewed_by=faculty_id,
                reviewed_at=now,
            )
        )

        # Do NOT capture pattern — rejected = not representative
        return {"status": "rejected", "message": "Question rejected, no pattern captured"}


# ---------------------------------------------------------------------------
# Prompt builders for SAQ/LAQ
# ---------------------------------------------------------------------------

def _build_saq_prompt(
    *,
    passages_text: str,
    comp_text: str,
) -> str:
    """Build the system prompt for SAQ generation with rubrics."""
    return f"""\
You are a medical education SAQ (Short Answer Question) generator creating \
assessment-grade questions with detailed rubrics for faculty use.

## CRITICAL RULES
1. Question must be clear, unambiguous, and answerable from the source material
2. Total marks must equal the sum of all rubric criterion marks
3. Model answer must be comprehensive but concise
4. Rubric criteria must be specific and measurable — no vague terms
5. Partial credit guidelines must be explicit ("award X marks for...")
6. Common mistakes should reflect actual student errors seen in exams
7. Expected points must be concrete facts, not general descriptions
8. Questions should test understanding, not just recall (unless specified)

## RUBRIC GUIDELINES
- Break the question into 2-5 rubric criteria
- Each criterion should test a distinct aspect of knowledge
- Partial credit: provide specific point values for partial answers
- Expected points: list exactly what facts/concepts earn marks
- Model answer: write as if you are a high-scoring student

## SOURCE MATERIAL
{passages_text}
{f'''
## COMPETENCY DETAILS
{comp_text}
''' if comp_text else ''}
## OUTPUT REQUIREMENTS
Generate a SINGLE SAQ with:
- Clear question text appropriate for the requested Bloom's level
- Detailed rubric with mark allocation
- Comprehensive model answer
- List of common student mistakes"""


def _build_laq_prompt(
    *,
    passages_text: str,
    comp_text: str,
) -> str:
    """Build the system prompt for LAQ generation with rubrics."""
    return f"""\
You are a medical education LAQ (Long Answer Question / Essay Question) generator \
creating assessment-grade questions with detailed rubrics and sub-parts for faculty use.

## CRITICAL RULES
1. LAQ must have 2-5 sub-questions, each with allocated marks
2. Total marks must equal the sum of sub-question marks
3. Overall rubric provides holistic grading criteria beyond sub-questions
4. Model answer should be thorough (500-1000 words)
5. Marking scheme notes guide the examiner on interpretation
6. Sub-questions should progress in cognitive complexity (recall → analysis)
7. Each sub-question must be answerable independently

## RUBRIC GUIDELINES
- Sub-questions: each has text, marks, and expected answer
- Overall rubric: holistic criteria (organization, clinical reasoning, etc.)
- Marking scheme notes: guidance on borderline cases, alternative answers
- Model answer: write as a comprehensive reference answer

## SOURCE MATERIAL
{passages_text}
{f'''
## COMPETENCY DETAILS
{comp_text}
''' if comp_text else ''}
## OUTPUT REQUIREMENTS
Generate a SINGLE LAQ with:
- Main question stem with clear context
- 2-5 sub-questions with mark allocation
- Overall rubric criteria
- Comprehensive model answer (500-1000 words)
- Marking scheme notes for the examiner"""


def _build_faculty_addendum(
    *,
    clinical_vignette: bool,
    aetcom_integration: bool,
    image_based: bool,
) -> str:
    """Build additional instructions based on faculty toggles."""
    parts = []

    if clinical_vignette:
        parts.append(
            "\n## CLINICAL VIGNETTE REQUIRED\n"
            "Include a realistic clinical scenario with: patient demographics, "
            "presenting complaint, relevant history, and examination/investigation "
            "findings. The vignette should be the foundation of the question."
        )
    else:
        parts.append(
            "\n## NO CLINICAL VIGNETTE\n"
            "Generate a direct knowledge-based question without a clinical scenario."
        )

    if aetcom_integration:
        parts.append(
            "\n## AETCOM INTEGRATION\n"
            "Integrate AETCOM (Attitude, Ethics, and Communication) competencies. "
            "Include an ethical dimension, communication challenge, or "
            "professionalism scenario in the question."
        )

    if image_based:
        parts.append(
            "\n## IMAGE-BASED QUESTION\n"
            "Design the question to accompany a clinical image. Describe what "
            "the image would show (e.g., 'Image shows: chest X-ray with bilateral "
            "hilar lymphadenopathy'). The question should require image interpretation."
        )

    return "\n".join(parts) if parts else ""


def _format_saq_laq_for_validation(q: dict) -> str:
    """Format an SAQ or LAQ for the safety pipeline validation."""
    q_type = q.get("_question_type", "saq")
    parts = [f"Question ({q_type.upper()}): {q.get('question_text', '')}"]

    if q_type == "saq":
        parts.append(f"Total marks: {q.get('total_marks', 0)}")
        parts.append(f"Model answer: {q.get('model_answer', '')}")
        for i, c in enumerate(q.get("criteria", []), 1):
            if isinstance(c, dict):
                parts.append(
                    f"Criterion {i}: {c.get('criterion', '')} "
                    f"({c.get('max_marks', 0)} marks)"
                )
    elif q_type == "laq":
        parts.append(f"Total marks: {q.get('total_marks', 0)}")
        for i, sq in enumerate(q.get("sub_questions", []), 1):
            if isinstance(sq, dict):
                parts.append(
                    f"Sub-Q {i} ({sq.get('marks', 0)} marks): {sq.get('text', '')}"
                )
        parts.append(f"Model answer: {q.get('model_answer', '')}")

    parts.append(f"Bloom's level: {q.get('blooms_level', '')}")
    parts.append(f"Competency: {q.get('competency_code', '')}")

    return "\n".join(parts)
