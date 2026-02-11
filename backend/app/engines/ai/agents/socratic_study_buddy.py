"""Socratic Study Buddy — Section S1 of architecture document.

THE FLAGSHIP STUDENT AI INTERACTION. A LangGraph supervisor graph with
mandatory Bridge Layer (L2) enforcement. This is NOT a simple prompt chain —
it has multiple nodes with conditional routing, state checkpointing across
sessions, and deterministic preservation gate enforcement.

Graph structure:
    START → retrieve_context → assess_knowledge → detect_misconceptions
          → build_scaffold → preservation_gate
                                   ├─ (pass) → deliver_response → END
                                   └─ (fail, <3) → regenerate → preservation_gate
                                   └─ (fail, >=3) → deliver_response (fallback) → END

Every response passes through the CognitivePreservationPipeline before
delivery. The AI CANNOT give direct answers — this is an architectural
guarantee, not a prompt instruction.
"""

import json
import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Annotated, Any
from uuid import UUID

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from sqlalchemy.ext.asyncio import AsyncSession

from app.engines.ai.gateway import AIGateway, StreamChunk
from app.engines.ai.models import MetacognitiveEvent
from app.engines.ai.pipelines.cognitive_preservation import (
    CognitivePreservationPipeline,
    PreservationResult,
)
from app.engines.ai.prompt_registry import PromptRegistry
from app.engines.ai.rag import get_rag_engine
from app.engines.ai.tools import get_tools_for_agent

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

AGENT_ID = "socratic_study_buddy"
MAX_REGENERATION_ATTEMPTS = 3

# Scaffolding levels — ordered from least to most supportive.
# Escalation moves DOWN this list on preservation failures.
SCAFFOLDING_LEVELS = ("hint", "guided_question", "decomposition", "analogy")

# ZPD thresholds — mastery_score → starting scaffolding level
_ZPD_THRESHOLDS = (
    (0.85, "hint"),              # Advanced — just a nudge
    (0.65, "guided_question"),   # Intermediate — needs context
    (0.40, "decomposition"),     # Novice — needs step-by-step
    (0.00, "analogy"),           # Struggling — needs analogies
)


# ---------------------------------------------------------------------------
# State schema
# ---------------------------------------------------------------------------

class SocraticEngineState(dict):
    """LangGraph state for the Socratic Study Buddy.

    Uses TypedDict-style annotations for LangGraph's state management.
    The `messages` field uses the `add_messages` reducer to automatically
    append and deduplicate across graph invocations.
    """

    # --- Input ---
    student_id: UUID
    college_id: UUID
    question: str
    active_pdf: str | None
    active_chapter: str | None
    active_page: int | None

    # --- Conversation ---
    messages: Annotated[list[BaseMessage], add_messages]
    turn_count: int

    # --- Student model (from S8 metacognitive engine) ---
    student_knowledge_level: str  # "novice", "intermediate", "advanced"
    known_concepts: list[str]
    identified_misconceptions: list[str]
    zone_of_proximal_development: str

    # --- RAG context ---
    retrieved_passages: list[dict[str, Any]]
    source_citations: list[dict[str, Any]]

    # --- Scaffolding state ---
    current_scaffolding_level: str
    scaffolding_attempts: int

    # --- Output ---
    response: str
    preservation_passed: bool
    regeneration_count: int
    regeneration_instructions: str


# We need proper TypedDict for LangGraph StateGraph:

from typing import TypedDict  # noqa: E402


class SocraticState(TypedDict):
    """Typed state schema for LangGraph."""

    # Input
    student_id: str  # UUID as string for JSON serialization
    college_id: str
    question: str
    active_pdf: str
    active_chapter: str
    active_page: int

    # Conversation
    messages: Annotated[list[BaseMessage], add_messages]
    turn_count: int

    # Student model
    student_knowledge_level: str
    known_concepts: list[str]
    identified_misconceptions: list[str]
    zone_of_proximal_development: str

    # RAG context
    retrieved_passages: list[dict]
    source_citations: list[dict]

    # Scaffolding
    current_scaffolding_level: str
    scaffolding_attempts: int

    # Output
    response: str
    preservation_passed: bool
    regeneration_count: int
    regeneration_instructions: str


# ---------------------------------------------------------------------------
# Node functions
# ---------------------------------------------------------------------------

async def retrieve_context(
    state: SocraticState,
    *,
    db: AsyncSession,
) -> dict:
    """Node 1: Retrieve relevant medical content via RAG (L1).

    Uses the 4-layer hybrid retrieval engine:
    1. Agentic router classifies query
    2. BM25 keyword search for exact terms
    3. pgvector semantic search for concepts
    4. RRF fusion + reranking
    """
    college_id = UUID(state["college_id"])
    question = state["question"]

    engine = get_rag_engine()

    # Build filters from active context
    filters: dict[str, Any] | None = None
    if state.get("active_pdf"):
        filters = {}
        # If student is reading a specific book, prioritize it
        filters["source_reference"] = state["active_pdf"]

    result = await engine.retrieve(
        db=db,
        query=question,
        college_id=college_id,
        filters=filters,
        top_k=5,
    )

    # Convert to serializable dicts
    passages = []
    citations = []
    for r in result.passages:
        meta = r.source_metadata
        passages.append({
            "content_id": str(r.content_id),
            "content": r.content[:800],  # Truncate for context window
            "score": r.score,
            "layer_source": r.layer_source,
            "title": meta.get("title", ""),
            "source_type": meta.get("source_type", ""),
        })
        citations.append({
            "book": meta.get("book", meta.get("title", "")),
            "chapter": meta.get("chapter", ""),
            "page": meta.get("page", ""),
            "source_reference": meta.get("source_reference", ""),
        })

    return {
        "retrieved_passages": passages,
        "source_citations": citations,
    }


async def assess_knowledge(
    state: SocraticState,
    *,
    db: AsyncSession,
) -> dict:
    """Node 2: Assess student's current knowledge level.

    Queries the StudentMetacognitiveProfile (S8) to determine:
    - What the student already knows about this topic
    - Their mastery score and confidence calibration
    - Zone of Proximal Development
    """
    from sqlalchemy import select

    from app.engines.ai.models import StudentMetacognitiveProfile

    college_id = UUID(state["college_id"])
    student_id = UUID(state["student_id"])

    # Query metacognitive profile for relevant topics
    result = await db.execute(
        select(StudentMetacognitiveProfile).where(
            StudentMetacognitiveProfile.college_id == college_id,
            StudentMetacognitiveProfile.student_id == student_id,
        ).order_by(
            StudentMetacognitiveProfile.mastery_score.desc()
        ).limit(20)
    )
    profiles = result.scalars().all()

    if not profiles:
        # New student — no data yet, default to intermediate
        return {
            "student_knowledge_level": "intermediate",
            "known_concepts": [],
            "zone_of_proximal_development": "guided_question",
        }

    # Calculate overall mastery across topics
    total_mastery = sum(p.mastery_score for p in profiles)
    avg_mastery = total_mastery / len(profiles) if profiles else 0.5

    # Determine knowledge level
    if avg_mastery >= 0.85:
        level = "advanced"
    elif avg_mastery >= 0.50:
        level = "intermediate"
    else:
        level = "novice"

    # Extract concepts with high mastery
    known = [
        f"{p.subject}: {p.topic}"
        for p in profiles
        if p.mastery_score >= 0.70
    ]

    # Determine ZPD from mastery score
    zpd = "guided_question"  # default
    for threshold, zpd_level in _ZPD_THRESHOLDS:
        if avg_mastery >= threshold:
            zpd = zpd_level
            break

    return {
        "student_knowledge_level": level,
        "known_concepts": known[:10],  # Cap at 10 for prompt length
        "zone_of_proximal_development": zpd,
    }


async def detect_misconceptions(
    state: SocraticState,
    *,
    db: AsyncSession,
) -> dict:
    """Node 3: Detect common misconceptions for this topic.

    Uses MedicalKnowledgeServer's get_misconceptions tool to find
    known student misconceptions, and analyzes question phrasing
    for patterns that indicate misunderstanding.
    """
    college_id = UUID(state["college_id"])
    question = state["question"]

    # Get tool executor for misconception lookup
    _, executor = get_tools_for_agent(AGENT_ID, db, college_id)

    # Query the misconceptions tool
    result = await executor("get_misconceptions", {
        "topic": question,  # Use question as topic query
    })

    misconceptions = []
    if isinstance(result, dict) and "misconceptions" in result:
        for m in result["misconceptions"]:
            if isinstance(m, dict):
                misconceptions.append(m.get("misconception", str(m)))
            else:
                misconceptions.append(str(m))

    return {
        "identified_misconceptions": misconceptions[:5],
    }


async def build_scaffold(
    state: SocraticState,
    *,
    db: AsyncSession,
    gateway: AIGateway,
    prompt_registry: PromptRegistry,
) -> dict:
    """Node 4: Generate the Socratic response — THE CORE NODE.

    Loads the system prompt from PromptRegistry, renders it with all
    state variables (student profile, retrieved passages, scaffolding
    level), and calls Sonnet 4.5 to generate the response.

    This node may be called multiple times during regeneration.
    Each call uses the current scaffolding level and any regeneration
    instructions from the preservation gate.
    """
    college_id = UUID(state["college_id"])

    # Load system prompt
    try:
        system_prompt = await prompt_registry.render(
            db,
            agent_id=AGENT_ID,
            college_id=college_id,
            variables={
                "active_pdf": state.get("active_pdf") or "their study materials",
                "active_chapter": state.get("active_chapter") or "current chapter",
                "active_page": str(state.get("active_page") or ""),
                "student_knowledge_level": state.get(
                    "student_knowledge_level", "intermediate"
                ),
                "known_concepts": ", ".join(
                    state.get("known_concepts", [])
                ) or "none identified yet",
                "identified_misconceptions": ", ".join(
                    state.get("identified_misconceptions", [])
                ) or "none identified yet",
                "retrieved_passages": _format_passages_for_prompt(
                    state.get("retrieved_passages", [])
                ),
            },
        )
    except Exception:
        logger.warning("Prompt not found for %s, using minimal default", AGENT_ID)
        system_prompt = _DEFAULT_SYSTEM_PROMPT

    # Add scaffolding level instruction
    level = state.get("current_scaffolding_level", "guided_question")
    system_prompt += (
        f"\n\nCURRENT SCAFFOLDING LEVEL: {level}\n"
        f"Use {level}-style scaffolding for this response."
    )

    # Add regeneration instructions if this is a retry
    regen_instructions = state.get("regeneration_instructions", "")
    if regen_instructions:
        system_prompt += (
            f"\n\nIMPORTANT CORRECTION FROM PREVIOUS ATTEMPT:\n"
            f"{regen_instructions}\n"
            f"Fix these issues in your response."
        )

    # Build conversation messages
    messages = list(state.get("messages", []))

    # Build the user message with context
    user_content = state["question"]

    # Add source citations context
    citations = state.get("source_citations", [])
    if citations:
        cite_text = "\n".join(
            f"- {c.get('book', '')} Ch.{c.get('chapter', '')} p.{c.get('page', '')}"
            for c in citations[:5]
            if c.get("book")
        )
        if cite_text:
            user_content += f"\n\n[Available source references:\n{cite_text}]"

    # Call the AI Gateway
    ai_response = await gateway.complete(
        db,
        system_prompt=system_prompt,
        user_message=user_content,
        messages=messages if messages else None,
        model="claude-sonnet-4-5-20250929",
        college_id=college_id,
        user_id=UUID(state["student_id"]),
        agent_id=AGENT_ID,
        task_type="socratic_dialogue",
        cache_system_prompt=True,
        max_tokens=1024,
        temperature=1.0,
    )

    return {
        "response": ai_response.content,
        "scaffolding_attempts": state.get("scaffolding_attempts", 0) + 1,
    }


async def preservation_gate(
    state: SocraticState,
    *,
    db: AsyncSession,
    gateway: AIGateway,
    prompt_registry: PromptRegistry,
) -> dict:
    """Node 5: Run the Cognitive Preservation Pipeline (L2).

    THE ARCHITECTURAL GUARANTEE: every student-facing response passes
    through this deterministic gate. If the response gives direct answers,
    it is REJECTED.
    """
    college_id = UUID(state["college_id"])

    pipeline = CognitivePreservationPipeline(gateway, prompt_registry)

    student_profile = {
        "knowledge_level": state.get("student_knowledge_level", "intermediate"),
        "mastery_score": "unknown",
        "known_concepts": state.get("known_concepts", []),
        "misconceptions": state.get("identified_misconceptions", []),
    }

    context = {
        "active_pdf": state.get("active_pdf", ""),
        "active_chapter": state.get("active_chapter", ""),
        "active_page": state.get("active_page", ""),
        "active_source": state.get("active_pdf") or "their study materials",
    }

    result = await pipeline.evaluate(
        db,
        student_question=state["question"],
        ai_response=state["response"],
        student_profile=student_profile,
        context=context,
        college_id=college_id,
    )

    if result.passed:
        return {
            "preservation_passed": True,
            "regeneration_instructions": "",
        }

    return {
        "preservation_passed": False,
        "regeneration_instructions": result.regeneration_instructions or "",
        "regeneration_count": state.get("regeneration_count", 0) + 1,
    }


async def regenerate(state: SocraticState) -> dict:
    """Node 6: Escalate scaffolding level for regeneration.

    Called when preservation_gate fails. Moves to the next scaffolding
    level (more supportive) before looping back to build_scaffold.
    """
    current_level = state.get("current_scaffolding_level", "hint")

    # Find current position and escalate
    try:
        idx = SCAFFOLDING_LEVELS.index(current_level)
        next_idx = min(idx + 1, len(SCAFFOLDING_LEVELS) - 1)
        new_level = SCAFFOLDING_LEVELS[next_idx]
    except ValueError:
        new_level = "decomposition"  # Safe default

    regen_count = state.get("regeneration_count", 0)
    logger.info(
        "Socratic regeneration: attempt %d, escalating %s → %s",
        regen_count, current_level, new_level,
    )

    return {
        "current_scaffolding_level": new_level,
    }


async def deliver_response(
    state: SocraticState,
    *,
    db: AsyncSession,
) -> dict:
    """Node 7: Deliver the approved response.

    If preservation failed after max attempts, use the fallback
    Socratic template. Otherwise, use the approved response.

    Appends the exchange to the messages list for checkpointing,
    and logs a MetacognitiveEvent.
    """
    response = state["response"]
    regen_count = state.get("regeneration_count", 0)
    passed = state.get("preservation_passed", True)

    # If all regeneration attempts failed, use fallback
    if not passed and regen_count >= MAX_REGENERATION_ATTEMPTS:
        topic = state.get(
            "active_chapter",
            state.get("active_pdf", "this topic"),
        )
        response = (
            "That's a great question! Let me help you think through this "
            "step by step.\n\n"
            "Before I guide you further, I want to understand your current "
            "thinking:\n\n"
            f"1. What do you already know about {topic}?\n"
            "2. What part of this concept is unclear or confusing?\n\n"
            "Once you share your thoughts, I can point you to the exact "
            "sections in your materials that will help you work through "
            "the answer.\n\n"
            "Take a moment to think about it — there's no rush. The best "
            "learning happens when you reason through it yourself."
        )
        logger.warning(
            "Socratic: all %d regeneration attempts failed, using fallback",
            MAX_REGENERATION_ATTEMPTS,
        )

    # Log metacognitive event
    college_id = UUID(state["college_id"])
    student_id = UUID(state["student_id"])

    event = MetacognitiveEvent(
        college_id=college_id,
        student_id=student_id,
        event_type="ai_interaction",
        event_data={
            "query": state["question"],
            "response_length": len(response),
            "scaffolding_level": state.get("current_scaffolding_level", ""),
            "scaffolding_attempts": state.get("scaffolding_attempts", 0),
            "regeneration_count": regen_count,
            "knowledge_level": state.get("student_knowledge_level", ""),
            "preservation_passed": passed,
            "active_pdf": state.get("active_pdf", ""),
        },
        subject=None,  # Extracted later by S8 analytics pipeline
        topic=None,
        occurred_at=datetime.now(timezone.utc),
    )
    db.add(event)

    # Append to conversation messages for checkpointing
    new_messages = [
        HumanMessage(content=state["question"]),
        AIMessage(content=response),
    ]

    return {
        "response": response,
        "messages": new_messages,
        "turn_count": state.get("turn_count", 0) + 1,
    }


# ---------------------------------------------------------------------------
# Conditional edge: preservation routing
# ---------------------------------------------------------------------------

def _route_after_preservation(state: SocraticState) -> str:
    """Route based on preservation gate result.

    - PASSED → deliver_response
    - FAILED + regen < 3 → regenerate (loop back)
    - FAILED + regen >= 3 → deliver_response (use fallback)
    """
    if state.get("preservation_passed", False):
        return "deliver_response"

    regen_count = state.get("regeneration_count", 0)
    if regen_count < MAX_REGENERATION_ATTEMPTS:
        return "regenerate"

    # Max attempts reached — deliver fallback
    return "deliver_response"


# ---------------------------------------------------------------------------
# Graph builder
# ---------------------------------------------------------------------------

def build_socratic_graph(
    *,
    db: AsyncSession,
    gateway: AIGateway,
    prompt_registry: PromptRegistry,
    checkpointer: Any = None,
) -> Any:
    """Build the Socratic Study Buddy LangGraph.

    Returns a compiled graph ready for invocation.

    Args:
        db: Database session (with RLS tenant context set).
        gateway: The singleton AIGateway.
        prompt_registry: The singleton PromptRegistry.
        checkpointer: LangGraph checkpointer for conversation continuity.
            Uses MemorySaver for development. Swap to PostgreSQL checkpointer
            for production.
    """
    # Bind dependencies to node functions via closures
    async def _retrieve(state: SocraticState) -> dict:
        return await retrieve_context(state, db=db)

    async def _assess(state: SocraticState) -> dict:
        return await assess_knowledge(state, db=db)

    async def _detect(state: SocraticState) -> dict:
        return await detect_misconceptions(state, db=db)

    async def _build(state: SocraticState) -> dict:
        return await build_scaffold(
            state, db=db, gateway=gateway, prompt_registry=prompt_registry,
        )

    async def _gate(state: SocraticState) -> dict:
        return await preservation_gate(
            state, db=db, gateway=gateway, prompt_registry=prompt_registry,
        )

    async def _regen(state: SocraticState) -> dict:
        return await regenerate(state)

    async def _deliver(state: SocraticState) -> dict:
        return await deliver_response(state, db=db)

    # Build the graph
    graph = StateGraph(SocraticState)

    # Add nodes
    graph.add_node("retrieve_context", _retrieve)
    graph.add_node("assess_knowledge", _assess)
    graph.add_node("detect_misconceptions", _detect)
    graph.add_node("build_scaffold", _build)
    graph.add_node("preservation_gate", _gate)
    graph.add_node("regenerate", _regen)
    graph.add_node("deliver_response", _deliver)

    # Add edges
    graph.add_edge(START, "retrieve_context")
    graph.add_edge("retrieve_context", "assess_knowledge")
    graph.add_edge("assess_knowledge", "detect_misconceptions")
    graph.add_edge("detect_misconceptions", "build_scaffold")
    graph.add_edge("build_scaffold", "preservation_gate")

    # Conditional: preservation gate routing
    graph.add_conditional_edges(
        "preservation_gate",
        _route_after_preservation,
        {
            "deliver_response": "deliver_response",
            "regenerate": "regenerate",
        },
    )

    # Regenerate loops back to build_scaffold
    graph.add_edge("regenerate", "build_scaffold")

    # deliver_response is terminal
    graph.add_edge("deliver_response", END)

    # Compile with checkpointer
    if checkpointer is None:
        checkpointer = MemorySaver()

    return graph.compile(checkpointer=checkpointer)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

async def run_socratic_study_buddy(
    *,
    db: AsyncSession,
    gateway: AIGateway,
    prompt_registry: PromptRegistry,
    question: str,
    student_id: UUID,
    college_id: UUID,
    active_pdf: str | None = None,
    active_chapter: str | None = None,
    active_page: int | None = None,
    conversation_id: str | None = None,
) -> dict[str, Any]:
    """Run the Socratic Study Buddy agent.

    Args:
        question: The student's question.
        student_id: Authenticated student UUID.
        college_id: Tenant UUID (from JWT).
        active_pdf: Currently open PDF/book name.
        active_chapter: Current chapter in the PDF.
        active_page: Current page number.
        conversation_id: For checkpointing continuity.
            If provided, resumes from the last checkpoint.

    Returns:
        Dict with "response" (approved Socratic text) and metadata.
    """
    # Build conversation thread ID
    thread_id = conversation_id or f"{student_id}_{college_id}"

    # Build initial state
    initial_state: dict[str, Any] = {
        "student_id": str(student_id),
        "college_id": str(college_id),
        "question": question,
        "active_pdf": active_pdf or "",
        "active_chapter": active_chapter or "",
        "active_page": active_page or 0,
        "messages": [],
        "turn_count": 0,
        "student_knowledge_level": "intermediate",
        "known_concepts": [],
        "identified_misconceptions": [],
        "zone_of_proximal_development": "guided_question",
        "retrieved_passages": [],
        "source_citations": [],
        "current_scaffolding_level": "hint",
        "scaffolding_attempts": 0,
        "response": "",
        "preservation_passed": False,
        "regeneration_count": 0,
        "regeneration_instructions": "",
    }

    # Build and invoke graph
    graph = build_socratic_graph(
        db=db,
        gateway=gateway,
        prompt_registry=prompt_registry,
    )

    config = {"configurable": {"thread_id": thread_id}}

    # Run the graph to completion
    final_state = await graph.ainvoke(initial_state, config=config)

    return {
        "response": final_state.get("response", ""),
        "scaffolding_level": final_state.get("current_scaffolding_level", ""),
        "turn_count": final_state.get("turn_count", 0),
        "regeneration_count": final_state.get("regeneration_count", 0),
        "preservation_passed": final_state.get("preservation_passed", False),
        "knowledge_level": final_state.get("student_knowledge_level", ""),
        "conversation_id": thread_id,
    }


async def stream_socratic_study_buddy(
    *,
    db: AsyncSession,
    gateway: AIGateway,
    prompt_registry: PromptRegistry,
    question: str,
    student_id: UUID,
    college_id: UUID,
    active_pdf: str | None = None,
    active_chapter: str | None = None,
    active_page: int | None = None,
    conversation_id: str | None = None,
) -> AsyncIterator[StreamChunk]:
    """Stream the Socratic Study Buddy response via SSE.

    Runs the full graph synchronously (context retrieval, knowledge
    assessment, scaffolding, preservation gate) then streams the
    final approved response text as chunks.

    We don't stream the LLM generation itself because the preservation
    pipeline must evaluate the COMPLETE response before delivery.
    """
    result = await run_socratic_study_buddy(
        db=db,
        gateway=gateway,
        prompt_registry=prompt_registry,
        question=question,
        student_id=student_id,
        college_id=college_id,
        active_pdf=active_pdf,
        active_chapter=active_chapter,
        active_page=active_page,
        conversation_id=conversation_id,
    )

    response_text = result["response"]

    # Yield the response in chunks for SSE streaming.
    # Since the response is already complete (preservation-approved),
    # we simulate streaming by chunking the text.
    chunk_size = 50  # ~50 chars per chunk for smooth frontend rendering
    for i in range(0, len(response_text), chunk_size):
        chunk = response_text[i:i + chunk_size]
        yield StreamChunk(type="text", text=chunk)

    # Final metadata event
    yield StreamChunk(type="end")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _format_passages_for_prompt(passages: list[dict]) -> str:
    """Format retrieved passages into a readable block for the system prompt."""
    if not passages:
        return "No passages retrieved yet."

    lines = []
    for i, p in enumerate(passages[:5], 1):
        title = p.get("title", "Unknown source")
        content = p.get("content", "")[:300]
        source = p.get("source_type", "")
        lines.append(f"[{i}] {title} ({source}):\n{content}")

    return "\n\n".join(lines)


# ---------------------------------------------------------------------------
# Default system prompt (used when PromptRegistry has no entry yet)
# ---------------------------------------------------------------------------

_DEFAULT_SYSTEM_PROMPT = """\
You are Acolyte, a medical education mentor built on the Bridge Layer AI \
philosophy. Your core purpose: make the student THINK harder, never less.

## YOUR IDENTITY
You are not a search engine. You are not an answer machine. You are a \
Socratic mentor who guides medical students to discover answers through \
their own clinical reasoning. You are warm, patient, encouraging — but \
you NEVER give away the answer.

## CRITICAL RULES
1. NEVER state a diagnosis, answer, or conclusion directly
2. NEVER provide a complete list without asking the student to generate \
it first
3. ALWAYS ask a question that guides toward the answer
4. ALWAYS cite specific sources: "Look at Harrison's Chapter 12, Page 347"
5. ALWAYS acknowledge what the student already knows before building on it
6. If the student is frustrated, adjust scaffolding DOWN (simpler questions)
7. If the student is getting it, adjust scaffolding UP (harder questions)

## SCAFFOLDING LEVELS

### Level 1: Hint
"What organ system do you think is primarily affected here?"

### Level 2: Guided Question
"If a patient has [symptom], which investigations would you order first \
and why?"

### Level 3: Decomposition
"Let's break this down. First, list the symptoms. Now, for each symptom, \
what organ systems could be involved?"

### Level 4: Analogy
"Think of it like this: if the heart is a pump, what happens to the \
downstream organs when the pump's output drops?"

## CONVERSATION STYLE
- Warm and encouraging: "Great question! Let's think through this together."
- Never condescending: "That's a common area of confusion" NOT "That's wrong"
- Build confidence: "You're on the right track with..."
- Keep responses focused: One question at a time, not a wall of text

## WHEN THE STUDENT GETS IT RIGHT
Celebrate briefly, then deepen: "Exactly right! Now, can you think about \
what would happen if the patient also had [complicating factor]?"

## WHEN THE STUDENT IS STUCK
Drop scaffolding level. If still stuck after multiple attempts, say:
"This is a challenging concept. Let me point you to exactly where to find \
this — read the relevant section in your materials. After you've read \
that, let's discuss what you found."
"""
