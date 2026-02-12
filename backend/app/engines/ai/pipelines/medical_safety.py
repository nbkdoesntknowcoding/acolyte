"""Medical Safety Pipeline — Section L3 of architecture document.

Multi-layer validation for ALL AI-generated medical content. Every question,
explanation, flashcard, and recommendation passes through this pipeline
before being served to users.

Pipeline checks (in order):
1. Source Grounding Verification — are claims supported by RAG sources?
2. Clinical Accuracy Validation — cross-reference against knowledge base
3. Bias Detection — demographic, cultural, gender stereotypes
4. Item-Writing Flaw Detection — 19 NBME flaw patterns (questions only)
5. Bloom's Level Verification — cognitive level alignment (questions only)

Thresholds (configurable per college):
- Auto-approve: confidence > 0.95 (low-stakes / formative only)
- Human review: confidence 0.70 - 0.95
- Reject: confidence < 0.70
- OVERRIDE: All summative assessment content ALWAYS requires human review

This pipeline does NOT apply to:
- Administrative outputs (fee calculations, scheduling)
- Raw data retrieval (attendance, grades)
- Non-medical content
"""

import hashlib
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.engines.ai.models import SafetyCheck
from app.engines.ai.pipelines.nbme_standards import (
    ItemWritingFlaw,
    build_item_writing_flaw_prompt,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Content types that trigger question-specific checks (4 and 5)
# ---------------------------------------------------------------------------

QUESTION_CONTENT_TYPES = frozenset({"mcq", "saq", "laq", "emq", "osce", "viva"})


# ---------------------------------------------------------------------------
# Pydantic schemas for structured output (constrained decoding)
# ---------------------------------------------------------------------------

class SourceGroundingCheck(BaseModel):
    """Check 1: are medical claims grounded in retrieved sources?"""

    all_claims_grounded: bool
    grounded_claim_count: int
    total_claim_count: int
    ungrounded_claims: list[str]  # Specific claims lacking source support
    confidence: float  # 0.0 (no grounding) to 1.0 (fully grounded)


class ClinicalAccuracyCheck(BaseModel):
    """Check 2: is the medical content clinically accurate?"""

    clinically_accurate: bool
    inaccuracies: list[str]  # Specific inaccuracies found
    outdated_information: list[str]  # Claims based on outdated guidelines
    confidence: float  # 0.0 (many errors) to 1.0 (fully accurate)


class BiasInstance(BaseModel):
    """A single detected bias in the content."""

    bias_type: str  # demographic, gender, cultural, socioeconomic
    description: str
    problematic_text: str
    suggested_fix: str


class BiasDetectionCheck(BaseModel):
    """Check 3: are there demographic, cultural, or gender biases?"""

    bias_free: bool
    biases_found: list[BiasInstance]
    confidence: float  # 0.0 (heavily biased) to 1.0 (bias-free)


class DetectedFlaw(BaseModel):
    """A single NBME item-writing flaw detected in a question."""

    flaw_code: str  # Maps to ItemWritingFlaw enum value
    evidence: str  # Exact text exhibiting the flaw
    explanation: str  # Why it's problematic
    suggested_fix: str


class ItemWritingFlawCheck(BaseModel):
    """Check 4: does the question follow NBME item-writing standards?"""

    meets_standards: bool
    flaws_detected: list[DetectedFlaw]
    total_flaw_count: int
    confidence: float  # 0.0 (many flaws) to 1.0 (no flaws)


class BloomsVerificationCheck(BaseModel):
    """Check 5: does the question test the declared cognitive level?"""

    blooms_aligned: bool
    declared_level: str  # What level was claimed
    actual_level: str  # What level the question actually tests
    reasoning: str  # Why the levels match or mismatch
    confidence: float  # 0.0 (severe mismatch) to 1.0 (perfect match)


# ---------------------------------------------------------------------------
# Safety result
# ---------------------------------------------------------------------------

@dataclass
class SafetyCheckResult:
    """Result from a single safety check."""

    check_name: str
    passed: bool
    confidence: float
    details: dict[str, Any] = field(default_factory=dict)


@dataclass
class SafetyResult:
    """Final result from the medical safety pipeline."""

    passed: bool  # recommendation != "reject"
    overall_confidence: float
    recommendation: str  # "auto_approve", "needs_faculty_review", "reject"
    checks: list[SafetyCheckResult] = field(default_factory=list)
    rejection_reasons: list[str] = field(default_factory=list)
    is_summative_override: bool = False


# ---------------------------------------------------------------------------
# Stage prompts
# ---------------------------------------------------------------------------

SOURCE_GROUNDING_PROMPT = """\
You are a medical content verification expert. Your task is to check \
whether EVERY medical claim in the AI-generated content is supported by \
the provided source materials.

A claim is "grounded" if:
- It is directly stated in or can be logically inferred from the sources
- It cites a specific source (textbook, guideline, page number)
- It describes a well-established medical fact present in the sources

A claim is "ungrounded" if:
- It makes an assertion not supported by any provided source
- It extrapolates beyond what the sources state
- It presents opinion as fact without source backing
- It cites a source that doesn't actually support the claim

Be strict: medical education content must be evidence-based. \
Identify every ungrounded claim specifically."""

CLINICAL_ACCURACY_PROMPT = """\
You are a medical accuracy reviewer. Cross-reference the content against \
current medical knowledge and identify any clinical inaccuracies.

Check for:
- Incorrect disease-symptom associations
- Wrong drug dosages, interactions, or contraindications
- Outdated treatment guidelines (use current standard of care)
- Incorrect anatomical or physiological descriptions
- Wrong laboratory value interpretations
- Incorrect pathophysiology mechanisms
- Misattributed clinical signs or syndromes

Only flag genuine inaccuracies — do not flag simplifications that are \
appropriate for the educational level. Report each inaccuracy with \
the specific incorrect claim and what the correct information should be."""

BIAS_DETECTION_PROMPT = """\
You are an expert in detecting bias in medical education content. \
Check the content for demographic, cultural, gender, and socioeconomic \
biases.

Types of bias to detect:
1. **Demographic bias**: Associating diseases exclusively with specific \
racial/ethnic groups when the disease affects all populations
2. **Gender bias**: Using gender stereotypes in clinical scenarios \
(e.g., only male patients for cardiac cases, only female for depression)
3. **Cultural bias**: Assuming Western/urban healthcare norms, ignoring \
diverse health-seeking behaviors or traditional medicine contexts
4. **Socioeconomic bias**: Assuming access to expensive diagnostics or \
treatments without considering resource-limited settings
5. **Age bias**: Stereotyping elderly patients as non-compliant or \
cognitively impaired without clinical indication

This is especially important for:
- OSCE stations and clinical vignettes
- Patient descriptions in question stems
- Assumptions about patient compliance or lifestyle

If no biases are found, report bias_free=true with an empty list."""

BLOOMS_VERIFICATION_PROMPT = """\
You are a medical education assessment specialist trained in Bloom's \
Taxonomy (Revised). Verify whether the question actually tests the \
declared cognitive level.

Bloom's Taxonomy Levels:
1. **Remember**: Recall facts, definitions, lists (e.g., "Name the...")
2. **Understand**: Explain concepts, summarize, classify (e.g., "Explain why...")
3. **Apply**: Use knowledge in new situations (e.g., "Given this patient, \
what drug would you prescribe?")
4. **Analyze**: Break down, compare, differentiate (e.g., "Compare the \
pathophysiology of...")
5. **Evaluate**: Judge, critique, justify (e.g., "Which management plan \
is MOST appropriate and why?")
6. **Create**: Design, construct, propose (e.g., "Design a treatment protocol...")

Common misalignments:
- Claimed "Apply" but actually tests "Remember" (just recalls a fact)
- Claimed "Analyze" but actually tests "Understand" (just explains, doesn't \
compare)
- Claimed "Evaluate" but actually tests "Apply" (no judgment required)

Evaluate the actual cognitive demand of the question, not just its wording."""


# ---------------------------------------------------------------------------
# MedicalSafetyPipeline
# ---------------------------------------------------------------------------

class MedicalSafetyPipeline:
    """Medical Content Validation — Section L3 of architecture document.

    Every piece of AI-generated medical content passes through this pipeline.
    The overall confidence score determines routing:

    - Auto-approve (>0.95): Content can be served directly (formative only)
    - Needs faculty review (0.70-0.95): Queued for human review
    - Reject (<0.70): Content rejected, must regenerate
    - OVERRIDE: All summative assessment content ALWAYS needs faculty review

    Usage:
        pipeline = MedicalSafetyPipeline(gateway)

        result = await pipeline.validate(
            db=db,
            content="The AI-generated MCQ text...",
            content_type="mcq",
            college_id=college_id,
            source_context="<source>...</source>",
        )

        if result.recommendation == "auto_approve":
            serve_to_user(content)
        elif result.recommendation == "needs_faculty_review":
            queue_for_review(content, result)
        else:  # reject
            regenerate(content, result.rejection_reasons)
    """

    # Threshold defaults (can be overridden per college in future)
    AUTO_APPROVE_THRESHOLD = 0.95
    REVIEW_THRESHOLD = 0.70

    # Check weights for overall confidence calculation
    CHECK_WEIGHTS: dict[str, float] = {
        "source_grounding": 0.30,
        "clinical_accuracy": 0.35,
        "bias_detection": 0.15,
        "item_writing_flaws": 0.10,
        "blooms_verification": 0.10,
    }

    def __init__(self, ai_gateway: Any) -> None:
        self.gateway = ai_gateway

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def validate(
        self,
        db: AsyncSession,
        *,
        content: str,
        content_type: str,
        college_id: UUID,
        source_context: str = "",
        declared_blooms_level: str | None = None,
        is_summative: bool = False,
    ) -> SafetyResult:
        """Run all applicable safety checks on medical content.

        Args:
            content: The AI-generated medical content to validate.
            content_type: One of "mcq", "saq", "laq", "emq", "osce",
                "viva", "explanation", "flashcard", "recommendation".
            college_id: For budget tracking on Haiku calls.
            source_context: RAG-retrieved source passages (XML-tagged).
            declared_blooms_level: The claimed Bloom's level (questions only).
            is_summative: Whether this is summative assessment content.
                If True, recommendation is ALWAYS "needs_faculty_review".

        Returns:
            SafetyResult with overall confidence, per-check results,
            and routing recommendation.
        """
        checks: list[SafetyCheckResult] = []
        rejection_reasons: list[str] = []
        is_question = content_type in QUESTION_CONTENT_TYPES

        # --- Check 1: Source Grounding Verification ---
        grounding = await self._check_source_grounding(
            db, content, source_context, college_id,
        )
        checks.append(SafetyCheckResult(
            check_name="source_grounding",
            passed=grounding.all_claims_grounded,
            confidence=grounding.confidence,
            details={
                "grounded": grounding.grounded_claim_count,
                "total": grounding.total_claim_count,
                "ungrounded_claims": grounding.ungrounded_claims,
            },
        ))
        if not grounding.all_claims_grounded:
            rejection_reasons.append(
                f"Ungrounded claims: {', '.join(grounding.ungrounded_claims[:3])}"
            )

        # --- Check 2: Clinical Accuracy Validation ---
        accuracy = await self._check_clinical_accuracy(
            db, content, content_type, college_id,
        )
        checks.append(SafetyCheckResult(
            check_name="clinical_accuracy",
            passed=accuracy.clinically_accurate,
            confidence=accuracy.confidence,
            details={
                "inaccuracies": accuracy.inaccuracies,
                "outdated": accuracy.outdated_information,
            },
        ))
        if not accuracy.clinically_accurate:
            issues = accuracy.inaccuracies + accuracy.outdated_information
            rejection_reasons.append(
                f"Clinical issues: {', '.join(issues[:3])}"
            )

        # --- Check 3: Bias Detection ---
        bias = await self._check_bias(db, content, content_type, college_id)
        checks.append(SafetyCheckResult(
            check_name="bias_detection",
            passed=bias.bias_free,
            confidence=bias.confidence,
            details={
                "biases_found": [
                    {"type": b.bias_type, "description": b.description}
                    for b in bias.biases_found
                ],
            },
        ))
        if not bias.bias_free:
            for b in bias.biases_found[:2]:
                rejection_reasons.append(
                    f"Bias ({b.bias_type}): {b.description}"
                )

        # --- Check 4: Item-Writing Flaw Detection (questions only) ---
        if is_question:
            flaws = await self._check_item_writing_flaws(
                db, content, college_id,
            )
            checks.append(SafetyCheckResult(
                check_name="item_writing_flaws",
                passed=flaws.meets_standards,
                confidence=flaws.confidence,
                details={
                    "flaw_count": flaws.total_flaw_count,
                    "flaws": [
                        {"code": f.flaw_code, "evidence": f.evidence}
                        for f in flaws.flaws_detected
                    ],
                },
            ))
            if not flaws.meets_standards:
                codes = [f.flaw_code for f in flaws.flaws_detected[:3]]
                rejection_reasons.append(
                    f"Item-writing flaws: {', '.join(codes)}"
                )

        # --- Check 5: Bloom's Level Verification (questions only) ---
        if is_question and declared_blooms_level:
            blooms = await self._check_blooms_alignment(
                db, content, declared_blooms_level, college_id,
            )
            checks.append(SafetyCheckResult(
                check_name="blooms_verification",
                passed=blooms.blooms_aligned,
                confidence=blooms.confidence,
                details={
                    "declared": blooms.declared_level,
                    "actual": blooms.actual_level,
                    "reasoning": blooms.reasoning,
                },
            ))
            if not blooms.blooms_aligned:
                rejection_reasons.append(
                    f"Bloom's mismatch: declared {blooms.declared_level}, "
                    f"actual {blooms.actual_level}"
                )

        # --- Calculate overall confidence ---
        overall = self._calculate_overall_confidence(checks, is_question)

        # --- Apply threshold routing ---
        if is_summative:
            recommendation = "needs_faculty_review"
        elif overall > self.AUTO_APPROVE_THRESHOLD:
            recommendation = "auto_approve"
        elif overall >= self.REVIEW_THRESHOLD:
            recommendation = "needs_faculty_review"
        else:
            recommendation = "reject"

        return SafetyResult(
            passed=(recommendation != "reject"),
            overall_confidence=overall,
            recommendation=recommendation,
            checks=checks,
            rejection_reasons=rejection_reasons,
            is_summative_override=is_summative,
        )

    # ------------------------------------------------------------------
    # Audit logging
    # ------------------------------------------------------------------

    async def log_checks(
        self,
        db: AsyncSession,
        execution_id: UUID,
        college_id: UUID,
        result: SafetyResult,
        content: str,
    ) -> None:
        """Write SafetyCheck records for each check in the pipeline."""
        content_hash = hashlib.sha256(content.encode()).hexdigest()

        for i, check in enumerate(result.checks):
            db.add(SafetyCheck(
                college_id=college_id,
                execution_id=execution_id,
                check_type=f"medical_safety_{check.check_name}",
                input_content_hash=content_hash,
                result="passed" if check.passed else "failed",
                confidence_score=check.confidence,
                details=check.details,
                checker_model="claude-haiku-4-5-20251001",
                pipeline_stage=i + 1,
                checked_at=datetime.now(timezone.utc),
            ))

    # ------------------------------------------------------------------
    # Overall confidence calculation
    # ------------------------------------------------------------------

    def _calculate_overall_confidence(
        self,
        checks: list[SafetyCheckResult],
        is_question: bool,
    ) -> float:
        """Weighted average of individual check confidences.

        Weights are normalized to sum to 1.0 based on which checks
        actually ran (question-specific checks may be skipped).
        """
        if not checks:
            return 0.0

        total_weight = 0.0
        weighted_sum = 0.0

        for check in checks:
            weight = self.CHECK_WEIGHTS.get(check.check_name, 0.10)
            weighted_sum += check.confidence * weight
            total_weight += weight

        if total_weight == 0.0:
            return 0.0

        return weighted_sum / total_weight

    # ------------------------------------------------------------------
    # Pipeline checks (private)
    # ------------------------------------------------------------------

    async def _check_source_grounding(
        self,
        db: AsyncSession,
        content: str,
        source_context: str,
        college_id: UUID,
    ) -> SourceGroundingCheck:
        """Check 1: verify all medical claims are supported by sources."""
        source_info = source_context if source_context else (
            "No source context was provided. Flag all non-trivial medical "
            "claims as ungrounded since there are no sources to verify against."
        )

        user_message = (
            f"AI-generated content:\n{content}\n\n"
            f"Source materials:\n{source_info}"
        )

        return await self.gateway.complete_structured(
            db,
            system_prompt=SOURCE_GROUNDING_PROMPT,
            user_message=user_message,
            output_schema=SourceGroundingCheck,
            model="claude-haiku-4-5-20251001",
            college_id=college_id,
            agent_id="medical_safety",
            task_type="safety_check",
            cache_system_prompt=True,
            max_tokens=1024,
            temperature=0.0,
        )

    async def _check_clinical_accuracy(
        self,
        db: AsyncSession,
        content: str,
        content_type: str,
        college_id: UUID,
    ) -> ClinicalAccuracyCheck:
        """Check 2: verify clinical accuracy of medical content."""
        user_message = (
            f"Content type: {content_type}\n\n"
            f"AI-generated medical content:\n{content}"
        )

        return await self.gateway.complete_structured(
            db,
            system_prompt=CLINICAL_ACCURACY_PROMPT,
            user_message=user_message,
            output_schema=ClinicalAccuracyCheck,
            model="claude-haiku-4-5-20251001",
            college_id=college_id,
            agent_id="medical_safety",
            task_type="safety_check",
            cache_system_prompt=True,
            max_tokens=1024,
            temperature=0.0,
        )

    async def _check_bias(
        self,
        db: AsyncSession,
        content: str,
        content_type: str,
        college_id: UUID,
    ) -> BiasDetectionCheck:
        """Check 3: detect demographic, cultural, and gender biases."""
        user_message = (
            f"Content type: {content_type}\n\n"
            f"AI-generated content:\n{content}"
        )

        return await self.gateway.complete_structured(
            db,
            system_prompt=BIAS_DETECTION_PROMPT,
            user_message=user_message,
            output_schema=BiasDetectionCheck,
            model="claude-haiku-4-5-20251001",
            college_id=college_id,
            agent_id="medical_safety",
            task_type="safety_check",
            cache_system_prompt=True,
            max_tokens=1024,
            temperature=0.0,
        )

    async def _check_item_writing_flaws(
        self,
        db: AsyncSession,
        content: str,
        college_id: UUID,
    ) -> ItemWritingFlawCheck:
        """Check 4: detect NBME item-writing flaws in questions."""
        system_prompt = build_item_writing_flaw_prompt()

        return await self.gateway.complete_structured(
            db,
            system_prompt=system_prompt,
            user_message=f"Question to analyze:\n{content}",
            output_schema=ItemWritingFlawCheck,
            model="claude-haiku-4-5-20251001",
            college_id=college_id,
            agent_id="medical_safety",
            task_type="safety_check",
            cache_system_prompt=True,
            max_tokens=1024,
            temperature=0.0,
        )

    async def _check_blooms_alignment(
        self,
        db: AsyncSession,
        content: str,
        declared_level: str,
        college_id: UUID,
    ) -> BloomsVerificationCheck:
        """Check 5: verify question tests the declared Bloom's level."""
        user_message = (
            f"Declared Bloom's level: {declared_level}\n\n"
            f"Question to analyze:\n{content}"
        )

        return await self.gateway.complete_structured(
            db,
            system_prompt=BLOOMS_VERIFICATION_PROMPT,
            user_message=user_message,
            output_schema=BloomsVerificationCheck,
            model="claude-haiku-4-5-20251001",
            college_id=college_id,
            agent_id="medical_safety",
            task_type="safety_check",
            cache_system_prompt=True,
            max_tokens=512,
            temperature=0.0,
        )
