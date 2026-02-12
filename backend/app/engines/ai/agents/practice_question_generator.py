"""Practice Question Generator — Section S2 of architecture document.

LangGraph supervisor graph with sub-agent pipeline for generating
practice MCQs for students. The KEY differentiator: it learns from
faculty question patterns via the Question Intelligence Layer (L4)
so student practice mirrors their actual college's exam style.

Pipeline:
    START → load_college_profile → retrieve_content → fetch_graph_data
          → generate_questions → validate_questions
                                   ├─ (rejected, retry<2) → retry_failed → validate_questions
                                   └─ (all validated OR retry≥2) → assemble_output → END

Bridge Layer: EMBEDDED — questions ARE the Bridge Layer. They make
students think rather than providing answers.
"""

import json
import logging
from typing import Any
from uuid import UUID

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.engines.ai.gateway import AIGateway
from app.engines.ai.pipelines.medical_safety import MedicalSafetyPipeline
from app.engines.ai.prompt_registry import PromptRegistry
from app.engines.ai.question_intelligence import (
    CollegeQuestionProfile,
    get_question_intelligence_layer,
)
from app.engines.ai.rag import get_rag_engine
from app.engines.ai.tools import get_tools_for_agent

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

AGENT_ID = "practice_question_generator"
MAX_RETRY_ATTEMPTS = 2


# ---------------------------------------------------------------------------
# Pydantic output schemas (constrained decoding)
# ---------------------------------------------------------------------------

class MCQOption(BaseModel):
    """A single MCQ option with explanation."""

    model_config = ConfigDict(extra="forbid")

    text: str
    is_correct: bool
    explanation: str = Field(
        description="Why this option is right/wrong — shown after answering",
    )


class GeneratedMCQ(BaseModel):
    """A complete generated MCQ with metadata."""

    model_config = ConfigDict(extra="forbid")

    stem: str = Field(description="The clinical vignette or question setup")
    lead_in: str = Field(
        description='The actual question ("What is the most likely diagnosis?")',
    )
    options: list[MCQOption] = Field(
        min_length=4, max_length=4, description="Exactly 4 options",
    )
    correct_answer_index: int = Field(ge=0, le=3, description="0-3 index")
    competency_code: str = Field(
        description='NMC competency code (e.g., "PH 1.25")',
    )
    blooms_level: str = Field(
        description="remember, understand, apply, analyze, evaluate",
    )
    difficulty_rating: int = Field(ge=1, le=5, description="1-5 scale")
    subject: str
    topic: str
    source_citations: list[str] = Field(
        description="Which sources were used",
    )
    distractor_reasoning: list[str] = Field(
        description="Why each distractor is plausible but wrong",
    )
    clinical_pearl: str = Field(
        description="One-line teaching point shown after answering",
    )


class PracticeQuestionBatch(BaseModel):
    """Batch of generated practice questions with metadata."""

    model_config = ConfigDict(extra="forbid")

    questions: list[GeneratedMCQ]
    generation_metadata: dict[str, Any] = Field(
        description="College profile used, model, tokens, etc.",
    )


# ---------------------------------------------------------------------------
# LangGraph state
# ---------------------------------------------------------------------------

from typing import TypedDict  # noqa: E402


class QuestionGenState(TypedDict):
    """Typed state schema for LangGraph."""

    # Input
    college_id: str  # UUID as string
    student_id: str
    request: dict  # subject, topic, difficulty, blooms_level, count, etc.

    # L4 — College question profile
    college_question_profile: dict

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

async def load_college_profile(
    state: QuestionGenState,
    *,
    db: AsyncSession,
) -> dict:
    """Node 1: Load college-specific question patterns from L4.

    Delegates to QuestionIntelligenceLayer.get_college_question_profile()
    which aggregates faculty-approved patterns into a CollegeQuestionProfile.
    If fewer than 20 patterns exist (new college), returns platform defaults.
    """
    college_id = UUID(state["college_id"])
    request = state["request"]
    subject = request.get("subject")

    layer = get_question_intelligence_layer()
    profile = await layer.get_college_question_profile(
        db, college_id, subject=subject,
    )

    return {
        "college_question_profile": profile.model_dump(exclude={"college_id"}),
    }


async def retrieve_content(
    state: QuestionGenState,
    *,
    db: AsyncSession,
) -> dict:
    """Node 2: Retrieve relevant medical content via RAG.

    Uses the 4-layer hybrid retrieval engine to get source passages
    for the requested subject and topic. Also calls get_competency_details
    if a competency code was specified.
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
    state: QuestionGenState,
    *,
    db: AsyncSession,
) -> dict:
    """Node 3: Fetch knowledge graph data for distractor generation.

    Uses get_differential_diagnoses to find related entities that
    serve as clinically plausible distractors.
    """
    college_id = UUID(state["college_id"])
    request = state["request"]
    topic = request.get("topic", "")

    _, executor = get_tools_for_agent(AGENT_ID, db, college_id)

    # Query differentials for the topic (useful for distractor generation)
    graph_data = await executor(
        "get_differential_diagnoses",
        {"primary_diagnosis": topic, "max_results": 8},
    )

    return {"knowledge_graph_data": graph_data}


async def generate_questions(
    state: QuestionGenState,
    *,
    db: AsyncSession,
    gateway: AIGateway,
    prompt_registry: PromptRegistry,
) -> dict:
    """Node 4: Generate MCQs using Sonnet 4.5 — THE CORE NODE.

    System prompt includes:
    - The college's question profile (difficulty, stem style)
    - Retrieved medical content with source citations
    - Knowledge graph data (differentials for distractors)
    - NBME item-writing standards (avoid the 19 common flaws)
    - Bloom's level requirements

    Uses constrained decoding (complete_structured) for valid output.
    Generates one question at a time for quality.
    """
    college_id = UUID(state["college_id"])
    student_id = UUID(state["student_id"])
    request = state["request"]

    subject = request.get("subject", "General")
    topic = request.get("topic", "")
    difficulty = request.get("difficulty", 3)
    blooms_level = request.get("blooms_level", "apply")
    count = request.get("count", 5)
    competency_code = request.get("competency_code", "")

    # Build context from previous nodes
    profile = state.get("college_question_profile", {})
    retrieved = state.get("retrieved_content", [{}])
    content_data = retrieved[0] if retrieved else {}
    graph_data = state.get("knowledge_graph_data", {})

    # Format source passages for prompt
    passages_text = _format_passages(content_data.get("passages", []))

    # Format differentials for distractor hints
    differentials = graph_data.get("differentials", [])
    diff_text = "\n".join(
        f"- {d.get('diagnosis', '')}: {d.get('reasoning', '')}"
        for d in differentials[:6]
    ) or "No differentials available — generate distractors from related conditions."

    # Format competency info
    comp_info = content_data.get("competency_info")
    comp_text = ""
    if comp_info and comp_info.get("found"):
        comp_text = (
            f"Competency: {comp_info.get('competency_code', '')} — "
            f"{comp_info.get('description', '')}\n"
            f"Level: {comp_info.get('level', '')}\n"
            f"Subject: {comp_info.get('subject', '')}"
        )

    # Build system prompt
    system_prompt = _build_generation_prompt(
        profile=profile,
        passages_text=passages_text,
        diff_text=diff_text,
        comp_text=comp_text,
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

    # Generate one question at a time for quality
    generated: list[dict] = []

    for i in range(count):
        user_message = (
            f"Generate practice MCQ #{i + 1} of {count}.\n\n"
            f"Subject: {subject}\n"
            f"Topic: {topic}\n"
            f"Target difficulty: {difficulty}/5\n"
            f"Target Bloom's level: {blooms_level}\n"
            f"Competency code: {competency_code or 'any relevant'}\n"
            f"{rejection_context}"
        )

        if i > 0 and generated:
            # Avoid duplicating previous questions
            prev_stems = [q.get("lead_in", "") for q in generated]
            user_message += (
                f"\nAlready generated lead-ins (do NOT repeat these):\n"
                + "\n".join(f"- {s}" for s in prev_stems)
            )

        try:
            mcq = await gateway.complete_structured(
                db,
                system_prompt=system_prompt,
                user_message=user_message,
                output_schema=GeneratedMCQ,
                model="claude-sonnet-4-5-20250929",
                college_id=college_id,
                user_id=student_id,
                agent_id=AGENT_ID,
                task_type="practice_question_gen",
                cache_system_prompt=True,
                max_tokens=2048,
                temperature=1.0,
            )
            generated.append(mcq.model_dump())
        except Exception as e:
            logger.error(
                "MCQ generation failed for question %d: %s", i + 1, e,
            )
            # Skip this question, continue with others

    return {"generated_questions": generated}


async def validate_questions(
    state: QuestionGenState,
    *,
    db: AsyncSession,
    gateway: AIGateway,
) -> dict:
    """Node 5: Validate each question through the Medical Safety Pipeline.

    Runs all 5 checks: source grounding, clinical accuracy,
    item-writing flaws, Bloom's verification, bias detection.

    Questions that pass → validated_questions.
    Questions that fail → rejected_questions with failure reasons.
    """
    college_id = UUID(state["college_id"])
    pipeline = MedicalSafetyPipeline(gateway)

    # Merge newly generated with previously validated (from retries)
    generated = state.get("generated_questions", [])
    already_validated = state.get("validated_questions", [])

    newly_validated: list[dict] = []
    newly_rejected: list[dict] = []

    # Format source context from retrieved passages
    retrieved = state.get("retrieved_content", [{}])
    content_data = retrieved[0] if retrieved else {}
    source_context = content_data.get("formatted_context", "")

    for q in generated:
        # Serialize question for safety pipeline
        question_text = _format_question_for_validation(q)

        result = await pipeline.validate(
            db,
            content=question_text,
            content_type="mcq",
            college_id=college_id,
            source_context=source_context,
            declared_blooms_level=q.get("blooms_level"),
            is_summative=False,  # Practice questions are formative
        )

        if result.passed:
            newly_validated.append(q)
        else:
            q_with_reasons = {**q, "rejection_reasons": result.rejection_reasons}
            newly_rejected.append(q_with_reasons)
            logger.info(
                "Question rejected (confidence=%.2f): %s",
                result.overall_confidence,
                result.rejection_reasons[:2],
            )

    return {
        "validated_questions": already_validated + newly_validated,
        "rejected_questions": newly_rejected,
        # Clear generated — they've been processed
        "generated_questions": [],
    }


async def retry_failed(
    state: QuestionGenState,
    *,
    db: AsyncSession,
    gateway: AIGateway,
    prompt_registry: PromptRegistry,
) -> dict:
    """Node 6: Regenerate rejected questions with failure-specific instructions.

    Passes the specific rejection reasons into the generation prompt
    so the model avoids the same issues.
    """
    retry_count = state.get("retry_count", 0) + 1

    logger.info(
        "Retrying %d rejected questions (attempt %d/%d)",
        len(state.get("rejected_questions", [])),
        retry_count,
        MAX_RETRY_ATTEMPTS,
    )

    # The rejected questions already have rejection_reasons attached.
    # generate_questions reads them from state.rejected_questions.
    # We trigger regeneration by calling generate_questions again.
    result = await generate_questions(
        state,
        db=db,
        gateway=gateway,
        prompt_registry=prompt_registry,
    )

    return {
        **result,
        "retry_count": retry_count,
        # Clear rejected — they'll be re-evaluated after regeneration
        "rejected_questions": [],
    }


async def assemble_output(state: QuestionGenState) -> dict:
    """Node 7: Assemble the final PracticeQuestionBatch.

    Combines all validated questions with generation metadata.
    """
    validated = state.get("validated_questions", [])
    profile = state.get("college_question_profile", {})
    request = state.get("request", {})
    retry_count = state.get("retry_count", 0)

    return {
        "final_output": {
            "questions": validated,
            "generation_metadata": {
                "requested_count": request.get("count", 5),
                "generated_count": len(validated),
                "subject": request.get("subject", ""),
                "topic": request.get("topic", ""),
                "difficulty": request.get("difficulty", 3),
                "blooms_level": request.get("blooms_level", "apply"),
                "college_profile_sample_size": profile.get("sample_size", 0),
                "retries_used": retry_count,
                "model": "claude-sonnet-4-5-20250929",
            },
        },
    }


# ---------------------------------------------------------------------------
# Conditional edge: validation routing
# ---------------------------------------------------------------------------

def _route_after_validation(state: QuestionGenState) -> str:
    """Route based on validation results.

    - All validated OR no rejected → assemble_output
    - Has rejected AND retry_count < MAX → retry_failed
    - Has rejected AND retry_count >= MAX → assemble_output (take what we have)
    """
    rejected = state.get("rejected_questions", [])
    retry_count = state.get("retry_count", 0)

    if not rejected:
        return "assemble_output"

    if retry_count < MAX_RETRY_ATTEMPTS:
        return "retry_failed"

    # Max retries exhausted — deliver what we have
    logger.warning(
        "Max retries (%d) exhausted with %d rejected questions — "
        "delivering %d validated",
        MAX_RETRY_ATTEMPTS,
        len(rejected),
        len(state.get("validated_questions", [])),
    )
    return "assemble_output"


# ---------------------------------------------------------------------------
# Graph builder
# ---------------------------------------------------------------------------

def build_question_gen_graph(
    *,
    db: AsyncSession,
    gateway: AIGateway,
    prompt_registry: PromptRegistry,
    checkpointer: Any = None,
) -> Any:
    """Build the Practice Question Generator LangGraph.

    Returns a compiled graph ready for invocation.
    """
    # Bind dependencies via closures
    async def _load_profile(state: QuestionGenState) -> dict:
        return await load_college_profile(state, db=db)

    async def _retrieve(state: QuestionGenState) -> dict:
        return await retrieve_content(state, db=db)

    async def _fetch_graph(state: QuestionGenState) -> dict:
        return await fetch_graph_data(state, db=db)

    async def _generate(state: QuestionGenState) -> dict:
        return await generate_questions(
            state, db=db, gateway=gateway, prompt_registry=prompt_registry,
        )

    async def _validate(state: QuestionGenState) -> dict:
        return await validate_questions(state, db=db, gateway=gateway)

    async def _retry(state: QuestionGenState) -> dict:
        return await retry_failed(
            state, db=db, gateway=gateway, prompt_registry=prompt_registry,
        )

    async def _assemble(state: QuestionGenState) -> dict:
        return await assemble_output(state)

    # Build the graph
    graph = StateGraph(QuestionGenState)

    graph.add_node("load_college_profile", _load_profile)
    graph.add_node("retrieve_content", _retrieve)
    graph.add_node("fetch_graph_data", _fetch_graph)
    graph.add_node("generate_questions", _generate)
    graph.add_node("validate_questions", _validate)
    graph.add_node("retry_failed", _retry)
    graph.add_node("assemble_output", _assemble)

    # Edges
    graph.add_edge(START, "load_college_profile")
    graph.add_edge("load_college_profile", "retrieve_content")
    graph.add_edge("retrieve_content", "fetch_graph_data")
    graph.add_edge("fetch_graph_data", "generate_questions")
    graph.add_edge("generate_questions", "validate_questions")

    # Conditional: validation routing
    graph.add_conditional_edges(
        "validate_questions",
        _route_after_validation,
        {
            "assemble_output": "assemble_output",
            "retry_failed": "retry_failed",
        },
    )

    # Retry loops back to validation
    graph.add_edge("retry_failed", "validate_questions")

    # Terminal
    graph.add_edge("assemble_output", END)

    if checkpointer is None:
        checkpointer = MemorySaver()

    return graph.compile(checkpointer=checkpointer)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

async def generate_practice_questions(
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
    student_id: UUID,
    college_id: UUID,
) -> PracticeQuestionBatch:
    """Run the Practice Question Generator agent.

    Args:
        subject: Medical subject (e.g., "Pharmacology").
        topic: Specific topic (e.g., "Beta-blockers").
        difficulty: Target difficulty 1-5.
        blooms_level: Target Bloom's level.
        count: Number of questions to generate (1-10).
        question_type: "mcq" (others in future phases).
        competency_code: Optional NMC competency code.
        student_id: Authenticated student UUID.
        college_id: Tenant UUID.

    Returns:
        PracticeQuestionBatch with validated questions and metadata.
    """
    # Clamp count
    count = max(1, min(count, 10))

    initial_state: dict[str, Any] = {
        "college_id": str(college_id),
        "student_id": str(student_id),
        "request": {
            "subject": subject,
            "topic": topic,
            "difficulty": difficulty,
            "blooms_level": blooms_level,
            "count": count,
            "question_type": question_type,
            "competency_code": competency_code or "",
        },
        "college_question_profile": {},
        "retrieved_content": [],
        "knowledge_graph_data": {},
        "generated_questions": [],
        "validated_questions": [],
        "rejected_questions": [],
        "retry_count": 0,
        "final_output": {},
    }

    graph = build_question_gen_graph(
        db=db,
        gateway=gateway,
        prompt_registry=prompt_registry,
    )

    config = {"configurable": {"thread_id": f"qgen_{student_id}_{college_id}"}}

    final_state = await graph.ainvoke(initial_state, config=config)

    output = final_state.get("final_output", {})
    questions = [
        GeneratedMCQ.model_validate(q)
        for q in output.get("questions", [])
    ]

    return PracticeQuestionBatch(
        questions=questions,
        generation_metadata=output.get("generation_metadata", {}),
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _format_passages(passages: list[dict]) -> str:
    """Format retrieved passages into a readable block for the prompt."""
    if not passages:
        return "No passages retrieved."

    lines = []
    for i, p in enumerate(passages[:5], 1):
        title = p.get("title", "Unknown")
        book = p.get("book", "")
        chapter = p.get("chapter", "")
        page = p.get("page", "")
        content = p.get("content", "")[:400]

        source = f"{book} Ch.{chapter} p.{page}" if book else title
        lines.append(f"[{i}] {source}:\n{content}")

    return "\n\n".join(lines)


def _format_question_for_validation(q: dict) -> str:
    """Format a generated MCQ into text for the safety pipeline."""
    options = q.get("options", [])
    option_text = "\n".join(
        f"  {'ABCD'[i]}. {o.get('text', '')}"
        for i, o in enumerate(options[:4])
    )
    correct_idx = q.get("correct_answer_index", 0)
    correct_letter = "ABCD"[correct_idx] if 0 <= correct_idx <= 3 else "?"

    return (
        f"Stem: {q.get('stem', '')}\n"
        f"Lead-in: {q.get('lead_in', '')}\n"
        f"Options:\n{option_text}\n"
        f"Correct answer: {correct_letter}\n"
        f"Bloom's level: {q.get('blooms_level', '')}\n"
        f"Difficulty: {q.get('difficulty_rating', '')}/5\n"
        f"Competency: {q.get('competency_code', '')}"
    )


def _build_generation_prompt(
    *,
    profile: dict,
    passages_text: str,
    diff_text: str,
    comp_text: str,
) -> str:
    """Build the system prompt for MCQ generation."""
    # Format college profile
    diff_dist = profile.get("difficulty_distribution", {})
    blooms_dist = profile.get("blooms_distribution", {})
    vignette_style = profile.get("preferred_vignette_style", "detailed_clinical")
    sample_size = profile.get("sample_size", 0)

    profile_section = ""
    if sample_size > 0:
        profile_section = (
            f"\n## THIS COLLEGE'S EXAM STYLE (learned from {sample_size} "
            f"faculty-approved questions)\n"
            f"- Difficulty distribution: {json.dumps(diff_dist)}\n"
            f"- Bloom's distribution: {json.dumps(blooms_dist)}\n"
            f"- Preferred vignette style: {vignette_style}\n"
            f"- Match this style in your generated questions.\n"
        )
    else:
        profile_section = (
            "\n## EXAM STYLE\n"
            "No college-specific pattern data available yet. Use standard "
            "NBME-style clinical vignettes with detailed clinical scenarios.\n"
        )

    return f"""\
You are a medical education MCQ generator following NBME (National Board \
of Medical Examiners) Item-Writing Guide standards. You create high-quality \
single-best-answer MCQs for medical student practice.

## CRITICAL RULES
1. NEVER use "all of the above" or "none of the above" as options
2. NEVER use absolute terms (always, never, all, none) in stem or options
3. NEVER use negative stems ("Which is NOT...") — rephrase positively
4. ALL distractors must be clinically plausible — no throwaway options
5. Each distractor should represent a real differential diagnosis or a \
common misconception
6. The correct answer must be unambiguously the SINGLE BEST answer
7. Stem should contain all information needed to answer — options should \
NOT add new clinical data
8. Options should be similar in length and grammatical structure
9. Clinical vignettes should include: age, sex, presenting complaint, \
relevant history, examination/investigation findings
10. ALWAYS cite the source material for your correct answer

## BLOOM'S TAXONOMY LEVELS
- remember: Direct recall of facts (drug names, normal values)
- understand: Explain concepts, classify, compare
- apply: Use knowledge in a clinical scenario to reach a diagnosis
- analyze: Break down complex clinical data, identify patterns
- evaluate: Judge the best management, prioritize differentials
{profile_section}
## SOURCE MATERIAL
{passages_text}

## DIFFERENTIAL DIAGNOSES (for distractor generation)
{diff_text}
{f'''
## COMPETENCY DETAILS
{comp_text}
''' if comp_text else ''}
## OUTPUT REQUIREMENTS
Generate a SINGLE practice MCQ with:
- A clinical vignette appropriate for the requested Bloom's level
- Exactly 4 options (one correct, three distractors)
- Each distractor must be a real differential or common misconception
- Explanations for ALL options (shown post-answer for learning)
- Source citations from the provided material
- A clinical pearl (one-line teaching point)"""
