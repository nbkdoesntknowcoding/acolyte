"""Cognitive Preservation Pipeline (Bridge Layer) — Section L2.

THE ARCHITECTURAL GUARANTEE OF BRIDGE LAYER AI.

Every student-facing AI response passes through this pipeline BEFORE
delivery. This is NOT a prompt instruction — it is a deterministic gate
that structurally prevents the AI from giving direct answers to students.

Pipeline stages:
1. DirectAnswerDetector — flags responses that give away answers
2. ScaffoldingEvaluator — checks if response promotes thinking
3. DifficultyCalibrator — ensures scaffolding matches student ZPD
4. SourceCitationVerifier — ensures claims reference specific sources

If a response fails ANY stage, it is REJECTED and sent back to the
generating agent with specific instructions for regeneration.
Maximum regeneration attempts: 3. After 3 failures, the response is
routed to a fallback Socratic template.

This pipeline does NOT apply to:
- Faculty-facing responses (faculty gets direct answers)
- Admin/compliance outputs (not educational content)
- Factual data retrieval (attendance, grades, schedules)
- Emergency/safety content (never Socratic — direct and clear)
"""

import hashlib
import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.engines.ai.models import BridgeLayerResult, SafetyCheck

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Scaffolding levels — ordered from most supportive to most independent
# ---------------------------------------------------------------------------

SCAFFOLDING_LEVELS = (
    "hint",              # Subtle nudge toward the right direction
    "guided_question",   # Socratic question targeting specific gap
    "decomposition",     # Break problem into smaller reasoning steps
    "analogy",           # Connect to something the student already knows
)


# ---------------------------------------------------------------------------
# Pydantic schemas for structured output (constrained decoding)
# ---------------------------------------------------------------------------

class DirectAnswerDetection(BaseModel):
    """Stage 1 output: does the response give away the answer?"""

    gives_direct_answer: bool
    evidence: str
    suggested_socratic_approach: str
    engagement_score: float  # 0.0 (direct answer) to 1.0 (pure Socratic)


class ScaffoldingEvaluation(BaseModel):
    """Stage 2 output: does the response promote thinking?"""

    asks_question: bool
    builds_on_known_concepts: bool
    scaffolding_type: str  # hint, guided_question, decomposition, analogy
    scaffolding_appropriate: bool
    reasoning: str


class DifficultyCalibration(BaseModel):
    """Stage 3 output: does difficulty match the student's ZPD?"""

    difficulty_appropriate: bool
    student_level: str
    response_level: str
    adjustment_needed: str  # "easier", "harder", "appropriate"
    reasoning: str


class CitationCheck(BaseModel):
    """Stage 4 output: does the response cite specific sources?"""

    has_source_citations: bool
    points_to_where: bool  # Does it tell the student WHERE to find answers?
    citation_count: int
    missing_citation_for: str  # What claim lacks a citation


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class StageResult:
    """Result from a single pipeline stage."""

    stage_name: str
    passed: bool
    details: dict[str, Any] = field(default_factory=dict)


@dataclass
class PreservationResult:
    """Final result from the cognitive preservation pipeline."""

    passed: bool
    stage_results: list[StageResult] = field(default_factory=list)
    regeneration_instructions: str | None = None
    cognitive_engagement_score: float = 0.0
    scaffolding_level: str = ""
    used_fallback: bool = False
    bridge_layer_result: str = BridgeLayerResult.PASSED.value


# ---------------------------------------------------------------------------
# Stage prompts
# ---------------------------------------------------------------------------

DIRECT_ANSWER_DETECTION_PROMPT = """\
You are evaluating whether an AI response GIVES AWAY the answer to a \
medical question, or whether it GUIDES the student to discover the \
answer through their own thinking.

A response FAILS if it:
- States the diagnosis, answer, or conclusion directly
- Provides a complete list of steps/criteria without asking the student \
to reason
- Explains the full mechanism without asking the student what they think \
first
- Uses phrases like "The answer is...", "This is caused by...", \
"You should know that..."

A response PASSES if it:
- Asks a question that guides toward the answer
- Breaks the problem into smaller pieces for the student to solve
- Refers the student to specific pages/sections to find the answer \
themselves
- Acknowledges what the student knows and builds on it with a follow-up \
question
- Uses Socratic patterns: "What do you think would happen if...?"
- Provides a partial framework and asks the student to complete it

Evaluate strictly. Medical education requires students to THINK, \
not receive pre-packaged answers."""

SCAFFOLDING_EVALUATION_PROMPT = """\
You are evaluating whether an AI response uses appropriate scaffolding \
to promote the student's own thinking.

The student's known concepts: {known_concepts}
The student's identified misconceptions: {misconceptions}

Check whether the response:
1. Asks at least one question that the student must reason through
2. Builds on concepts the student already knows (listed above)
3. Uses appropriate scaffolding: hint, guided_question, decomposition, \
or analogy
4. Does NOT overwhelm with too many new concepts at once (max 2-3 new \
ideas per response)

Scaffolding types:
- hint: A subtle nudge in the right direction
- guided_question: A Socratic question targeting a specific knowledge gap
- decomposition: Breaking the problem into smaller reasoning steps
- analogy: Connecting to something the student already understands"""

DIFFICULTY_CALIBRATION_PROMPT = """\
You are calibrating whether an AI response matches the student's Zone \
of Proximal Development (ZPD).

Student profile:
- Knowledge level: {knowledge_level}
- Mastery score in this topic: {mastery_score}
- Topics they've mastered: {known_concepts}
- Topics they're struggling with: {misconceptions}

The response should be:
- Slightly ABOVE what the student can do alone (ZPD principle)
- NOT so easy that it's boring (already mastered)
- NOT so hard that it's frustrating (too many unknown prerequisites)

Evaluate whether the response's difficulty is appropriate for this \
specific student."""

CITATION_CHECK_PROMPT = """\
You are verifying that an AI response directs the student to specific \
sources where they can find the answer themselves.

Good citations look like:
- "Check Harrison's Chapter 12, page 347"
- "Look at the diagram in your Anatomy textbook, section on brachial plexus"
- "Review the table on page 215 of Pharmacology by Katzung"
- "According to the current NMC guidelines..."

The response should tell the student WHERE to look, not just WHAT \
the answer is. Students learn better when they find information \
themselves.

Active context: {active_source}"""

FALLBACK_SOCRATIC_TEMPLATE = """\
That's a great question! Let me help you think through this step by step.

Before I guide you further, I want to understand your current thinking:

1. What do you already know about {topic}?
2. What part of this concept is unclear or confusing?

Once you share your thoughts, I can point you to the exact sections in \
your materials that will help you work through the answer.

Take a moment to think about it — there's no rush. The best learning \
happens when you reason through it yourself."""


# ---------------------------------------------------------------------------
# CognitivePreservationPipeline
# ---------------------------------------------------------------------------

class CognitivePreservationPipeline:
    """Bridge Layer Enforcement — Section L2 of architecture document.

    THE ARCHITECTURAL GUARANTEE: every student-facing AI response passes
    through this pipeline BEFORE delivery. If a response gives direct
    answers, it gets REJECTED and the generating agent must regenerate
    with more scaffolding.

    Usage:
        pipeline = CognitivePreservationPipeline(gateway, prompt_registry)

        # Option 1: evaluate only
        result = await pipeline.evaluate(db, question, response, profile, ctx, college_id)

        # Option 2: evaluate + auto-regenerate on failure
        final, result = await pipeline.evaluate_and_regenerate(
            db, question, initial_response, profile, ctx, college_id, generate_fn
        )
    """

    MAX_REGENERATION_ATTEMPTS = 3

    def __init__(self, ai_gateway: Any, prompt_registry: Any) -> None:
        self.gateway = ai_gateway
        self.prompts = prompt_registry

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def evaluate(
        self,
        db: AsyncSession,
        student_question: str,
        ai_response: str,
        student_profile: dict[str, Any],
        context: dict[str, Any],
        college_id: UUID,
    ) -> PreservationResult:
        """Run ALL pipeline stages on a student-facing AI response.

        Args:
            student_question: The student's original question.
            ai_response: The AI-generated response to evaluate.
            student_profile: Dict with keys: knowledge_level, mastery_score,
                known_concepts, misconceptions.
            context: Dict with keys: active_pdf, active_chapter, active_page,
                active_source (for citation verification).
            college_id: For budget tracking on Haiku calls.

        Returns:
            PreservationResult with pass/fail, stage details, and
            regeneration instructions if failed.
        """
        stage_results: list[StageResult] = []
        regeneration_parts: list[str] = []

        # --- Stage 1: Direct Answer Detection ---
        detection = await self._stage_direct_answer(
            db, student_question, ai_response,
            student_profile.get("knowledge_level", "intermediate"),
            college_id,
        )
        stage_results.append(StageResult(
            stage_name="direct_answer_detection",
            passed=not detection.gives_direct_answer,
            details={
                "gives_direct_answer": detection.gives_direct_answer,
                "evidence": detection.evidence,
                "engagement_score": detection.engagement_score,
            },
        ))
        if detection.gives_direct_answer:
            regeneration_parts.append(
                f"Your response directly answered the student's question. "
                f"Evidence: \"{detection.evidence}\". "
                f"Instead, {detection.suggested_socratic_approach}."
            )

        # --- Stage 2: Scaffolding Evaluation ---
        scaffolding = await self._stage_scaffolding(
            db, student_question, ai_response, student_profile, college_id,
        )
        stage_results.append(StageResult(
            stage_name="scaffolding_evaluation",
            passed=scaffolding.asks_question and scaffolding.scaffolding_appropriate,
            details={
                "asks_question": scaffolding.asks_question,
                "builds_on_known": scaffolding.builds_on_known_concepts,
                "scaffolding_type": scaffolding.scaffolding_type,
                "appropriate": scaffolding.scaffolding_appropriate,
            },
        ))
        if not scaffolding.asks_question:
            regeneration_parts.append(
                "Your response does not ask the student a question. "
                "Add a Socratic question that guides them toward the answer."
            )
        if not scaffolding.scaffolding_appropriate:
            regeneration_parts.append(
                f"Scaffolding issue: {scaffolding.reasoning}. "
                f"Use '{scaffolding.scaffolding_type}' scaffolding type."
            )

        # --- Stage 3: Difficulty Calibration (ZPD) ---
        calibration = await self._stage_difficulty(
            db, student_question, ai_response, student_profile, college_id,
        )
        stage_results.append(StageResult(
            stage_name="difficulty_calibration",
            passed=calibration.difficulty_appropriate,
            details={
                "student_level": calibration.student_level,
                "response_level": calibration.response_level,
                "adjustment": calibration.adjustment_needed,
            },
        ))
        if not calibration.difficulty_appropriate:
            regeneration_parts.append(
                f"Difficulty mismatch: student is at '{calibration.student_level}' "
                f"level but response is at '{calibration.response_level}'. "
                f"Adjust to be {calibration.adjustment_needed}."
            )

        # --- Stage 4: Source Citation Verification ---
        active_source = context.get(
            "active_source",
            context.get("active_pdf", "their study materials"),
        )
        citation = await self._stage_citation(
            db, ai_response, active_source, college_id,
        )
        stage_results.append(StageResult(
            stage_name="source_citation_verification",
            passed=citation.has_source_citations and citation.points_to_where,
            details={
                "has_citations": citation.has_source_citations,
                "points_to_where": citation.points_to_where,
                "citation_count": citation.citation_count,
            },
        ))
        if not citation.has_source_citations or not citation.points_to_where:
            chapter = context.get("active_chapter", "")
            page = context.get("active_page", "")
            ref = f" (Chapter {chapter}, Page {page})" if chapter else ""
            regeneration_parts.append(
                f"Missing source citations. Point the student to specific "
                f"pages/sections in {active_source}{ref} where they can "
                f"find the answer themselves."
                + (
                    f" Specifically, add a citation for: "
                    f"{citation.missing_citation_for}"
                    if citation.missing_citation_for
                    else ""
                )
            )

        # --- Aggregate result ---
        all_passed = all(sr.passed for sr in stage_results)
        engagement_score = detection.engagement_score

        if all_passed:
            return PreservationResult(
                passed=True,
                stage_results=stage_results,
                cognitive_engagement_score=engagement_score,
                scaffolding_level=scaffolding.scaffolding_type,
                bridge_layer_result=BridgeLayerResult.PASSED.value,
            )

        return PreservationResult(
            passed=False,
            stage_results=stage_results,
            regeneration_instructions=" | ".join(regeneration_parts),
            cognitive_engagement_score=engagement_score,
            scaffolding_level=scaffolding.scaffolding_type,
        )

    async def evaluate_and_regenerate(
        self,
        db: AsyncSession,
        student_question: str,
        initial_response: str,
        student_profile: dict[str, Any],
        context: dict[str, Any],
        college_id: UUID,
        generate_fn: Callable[..., Awaitable[str]],
    ) -> tuple[str, PreservationResult]:
        """Evaluate response; regenerate up to 3 times on failure.

        Each regeneration includes the failure reason in the prompt so the
        model can correct itself. After 3 failures, falls back to a safe
        Socratic template.

        Args:
            generate_fn: async callable(additional_instructions: str) -> str
                Called when regeneration is needed. The function receives
                specific instructions on what to fix.

        Returns:
            (final_response, PreservationResult)
        """
        response = initial_response

        for attempt in range(self.MAX_REGENERATION_ATTEMPTS):
            result = await self.evaluate(
                db, student_question, response,
                student_profile, context, college_id,
            )

            if result.passed:
                # Track which attempt succeeded.
                if attempt > 0:
                    result.bridge_layer_result = (
                        f"regenerated_{attempt}"
                    )
                return response, result

            logger.info(
                "Bridge layer failed (attempt %d/%d): %s",
                attempt + 1,
                self.MAX_REGENERATION_ATTEMPTS,
                result.regeneration_instructions,
            )

            # Regenerate with failure feedback.
            response = await generate_fn(
                additional_instructions=result.regeneration_instructions or "",
            )

        # All 3 attempts failed — use fallback Socratic template.
        logger.warning(
            "Bridge layer: all %d attempts failed, using fallback template",
            self.MAX_REGENERATION_ATTEMPTS,
        )
        fallback = self._get_fallback_response(student_question, context)

        return fallback, PreservationResult(
            passed=True,
            stage_results=[],
            cognitive_engagement_score=0.5,
            scaffolding_level="guided_question",
            used_fallback=True,
            bridge_layer_result=BridgeLayerResult.FALLBACK.value,
        )

    # ------------------------------------------------------------------
    # Audit logging
    # ------------------------------------------------------------------

    async def log_check(
        self,
        db: AsyncSession,
        execution_id: UUID,
        college_id: UUID,
        result: PreservationResult,
        ai_response: str,
    ) -> None:
        """Write SafetyCheck record for this bridge layer evaluation."""
        content_hash = hashlib.sha256(
            ai_response.encode()
        ).hexdigest()

        for i, stage in enumerate(result.stage_results):
            db.add(SafetyCheck(
                college_id=college_id,
                execution_id=execution_id,
                check_type=f"bridge_layer_{stage.stage_name}",
                input_content_hash=content_hash,
                result="passed" if stage.passed else "failed",
                confidence_score=result.cognitive_engagement_score,
                details=stage.details,
                checker_model="claude-haiku-4-5-20251001",
                pipeline_stage=i + 1,
                checked_at=datetime.now(timezone.utc),
            ))

    # ------------------------------------------------------------------
    # Pipeline stages (private)
    # ------------------------------------------------------------------

    async def _stage_direct_answer(
        self,
        db: AsyncSession,
        student_question: str,
        ai_response: str,
        knowledge_level: str,
        college_id: UUID,
    ) -> DirectAnswerDetection:
        """Stage 1: detect if the response gives away the answer."""
        user_message = (
            f"Student's question: {student_question}\n\n"
            f"AI's proposed response: {ai_response}\n\n"
            f"Student's current knowledge level: {knowledge_level}"
        )

        return await self.gateway.complete_structured(
            db,
            system_prompt=DIRECT_ANSWER_DETECTION_PROMPT,
            user_message=user_message,
            output_schema=DirectAnswerDetection,
            model="claude-haiku-4-5-20251001",
            college_id=college_id,
            agent_id="bridge_layer",
            task_type="bridge_layer_check",
            cache_system_prompt=True,
            max_tokens=512,
            temperature=0.0,
        )

    async def _stage_scaffolding(
        self,
        db: AsyncSession,
        student_question: str,
        ai_response: str,
        student_profile: dict[str, Any],
        college_id: UUID,
    ) -> ScaffoldingEvaluation:
        """Stage 2: evaluate if scaffolding promotes thinking."""
        known = ", ".join(student_profile.get("known_concepts", []))
        misconceptions = ", ".join(
            student_profile.get("misconceptions", [])
        )

        prompt = SCAFFOLDING_EVALUATION_PROMPT.format(
            known_concepts=known or "none identified",
            misconceptions=misconceptions or "none identified",
        )
        user_message = (
            f"Student's question: {student_question}\n\n"
            f"AI's proposed response: {ai_response}"
        )

        return await self.gateway.complete_structured(
            db,
            system_prompt=prompt,
            user_message=user_message,
            output_schema=ScaffoldingEvaluation,
            model="claude-haiku-4-5-20251001",
            college_id=college_id,
            agent_id="bridge_layer",
            task_type="bridge_layer_check",
            cache_system_prompt=True,
            max_tokens=512,
            temperature=0.0,
        )

    async def _stage_difficulty(
        self,
        db: AsyncSession,
        student_question: str,
        ai_response: str,
        student_profile: dict[str, Any],
        college_id: UUID,
    ) -> DifficultyCalibration:
        """Stage 3: calibrate difficulty against student ZPD."""
        known = ", ".join(student_profile.get("known_concepts", []))
        misconceptions = ", ".join(
            student_profile.get("misconceptions", [])
        )

        prompt = DIFFICULTY_CALIBRATION_PROMPT.format(
            knowledge_level=student_profile.get(
                "knowledge_level", "intermediate"
            ),
            mastery_score=student_profile.get("mastery_score", "unknown"),
            known_concepts=known or "none identified",
            misconceptions=misconceptions or "none identified",
        )
        user_message = (
            f"Student's question: {student_question}\n\n"
            f"AI's proposed response: {ai_response}"
        )

        return await self.gateway.complete_structured(
            db,
            system_prompt=prompt,
            user_message=user_message,
            output_schema=DifficultyCalibration,
            model="claude-haiku-4-5-20251001",
            college_id=college_id,
            agent_id="bridge_layer",
            task_type="bridge_layer_check",
            cache_system_prompt=True,
            max_tokens=512,
            temperature=0.0,
        )

    async def _stage_citation(
        self,
        db: AsyncSession,
        ai_response: str,
        active_source: str,
        college_id: UUID,
    ) -> CitationCheck:
        """Stage 4: verify source citations are present."""
        prompt = CITATION_CHECK_PROMPT.format(
            active_source=active_source,
        )

        return await self.gateway.complete_structured(
            db,
            system_prompt=prompt,
            user_message=f"AI's proposed response:\n\n{ai_response}",
            output_schema=CitationCheck,
            model="claude-haiku-4-5-20251001",
            college_id=college_id,
            agent_id="bridge_layer",
            task_type="bridge_layer_check",
            cache_system_prompt=True,
            max_tokens=256,
            temperature=0.0,
        )

    # ------------------------------------------------------------------
    # Fallback
    # ------------------------------------------------------------------

    @staticmethod
    def _get_fallback_response(
        student_question: str,
        context: dict[str, Any],
    ) -> str:
        """Safe Socratic fallback when all regeneration attempts fail.

        Uses a deterministic template — no LLM call, no risk of
        giving a direct answer.
        """
        topic = context.get(
            "active_chapter",
            context.get("active_pdf", "this topic"),
        )
        return FALLBACK_SOCRATIC_TEMPLATE.format(topic=topic)
