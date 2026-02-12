"""Question Intelligence Layer — Section L4 of architecture document.

THE MOAT. Cross-engine learning system that creates per-college
learned models for question style.

Data flow:
    Faculty Engine (F1) → writes to → QuestionIntelligencePattern table
    Student Engine (S2, S3, S4) → reads from → QuestionIntelligencePattern table

Each college's faculty develops its own question culture.
The student experience adapts to THEIR college's style, not generic questions.

Usage:
    from app.engines.ai.question_intelligence import (
        QuestionIntelligenceLayer,
        CollegeQuestionProfile,
    )

    layer = QuestionIntelligenceLayer()

    # Faculty side (F1): capture a pattern on approve/modify
    await layer.capture_faculty_pattern(db, question_data, college_id, faculty_id)

    # Student side (S2): get college profile for practice generation
    profile = await layer.get_college_question_profile(db, college_id, subject="Pharmacology")
"""

import logging
from collections import Counter
from datetime import datetime, timezone
from statistics import mean, mode
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.engines.ai.models import QuestionIntelligencePattern

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MIN_PATTERNS_FOR_CUSTOM_PROFILE = 20
"""Minimum faculty-approved patterns needed before using a college-specific
profile. Below this threshold, platform defaults are returned."""

MAX_PATTERNS_TO_AGGREGATE = 500
"""Maximum recent patterns to aggregate per query. Keeps computation bounded
and favors recent faculty preferences over old ones."""


# ---------------------------------------------------------------------------
# CollegeQuestionProfile — the output of L4 aggregation
# ---------------------------------------------------------------------------

class CollegeQuestionProfile(BaseModel):
    """Aggregated question-writing style for a college.

    Built from QuestionIntelligencePattern rows. Used by S2 (Practice
    Question Generator) to make student practice questions mirror their
    college's actual exam style.
    """

    model_config = ConfigDict(extra="forbid")

    college_id: UUID | None = Field(
        default=None,
        description="The college this profile is for (None for platform default)",
    )
    sample_size: int = Field(
        default=0,
        description="Number of faculty-approved patterns this profile is based on",
    )
    difficulty_distribution: dict[str, float] = Field(
        default_factory=dict,
        description='Distribution: {"1": 0.10, "2": 0.20, "3": 0.40, ...}',
    )
    blooms_distribution: dict[str, float] = Field(
        default_factory=dict,
        description='Distribution: {"remember": 0.10, "understand": 0.20, ...}',
    )
    avg_stem_length: int = Field(
        default=200,
        description="Average character count of question stems",
    )
    preferred_vignette_style: str = Field(
        default="detailed_clinical",
        description="Most common vignette style",
    )
    distractor_strategies: dict[str, int] = Field(
        default_factory=dict,
        description="Counter of distractor strategy types used",
    )
    topic_emphasis: dict[str, float] = Field(
        default_factory=dict,
        description="Topic weights — which subjects get more questions",
    )
    is_default: bool = Field(
        default=True,
        description="True if using platform defaults (insufficient college data)",
    )


# Platform default profile based on NBME/NMC standards.
# Used for new colleges that haven't accumulated enough faculty patterns.
PLATFORM_DEFAULT_PROFILE = CollegeQuestionProfile(
    college_id=None,
    sample_size=0,
    difficulty_distribution={
        "1": 0.10,
        "2": 0.20,
        "3": 0.40,
        "4": 0.20,
        "5": 0.10,
    },
    blooms_distribution={
        "remember": 0.10,
        "understand": 0.20,
        "apply": 0.40,
        "analyze": 0.20,
        "evaluate": 0.10,
    },
    avg_stem_length=200,
    preferred_vignette_style="detailed_clinical",
    distractor_strategies={"differential_based": 60, "common_misconception": 40},
    topic_emphasis={},
    is_default=True,
)


# ---------------------------------------------------------------------------
# QuestionIntelligenceLayer — the core L4 class
# ---------------------------------------------------------------------------

class QuestionIntelligenceLayer:
    """Cross-engine learning system — THE MOAT.

    Faculty generates questions through F1 (Exam Question Generator)
    → System captures patterns per college:
      - Difficulty distribution preferences
      - Clinical scenario styles (detailed vignette vs. brief stem)
      - Distractor patterns (differential-based vs. related-but-wrong)
      - Bloom's level distribution (how much recall vs. application)
      - Topic emphasis (which topics get more questions)
      - Question length preferences
      - Key phrase patterns

    → These patterns are made available to Student Engine:
      S2 (Practice Question Generator) uses them to generate
      practice questions that MIRROR the faculty's exam style

    → Per-college learned model:
      Each college's faculty develops its own question culture.
      The student experience adapts to THEIR college, not generic questions.
    """

    # ------------------------------------------------------------------
    # Write path: F1 → L4
    # ------------------------------------------------------------------

    async def capture_faculty_pattern(
        self,
        db: AsyncSession,
        question: dict,
        college_id: UUID,
        faculty_id: UUID,
        *,
        execution_id: UUID | None = None,
        question_index: int = 0,
        review_action: str = "approved",
    ) -> QuestionIntelligencePattern:
        """Capture a faculty question pattern.

        Called every time a faculty member approves or modifies a generated
        question from F1. Extracts and stores the pattern in the
        QuestionIntelligencePattern table.

        Args:
            db: Database session (tenant-scoped).
            question: The approved/modified question data dict.
            college_id: Tenant UUID.
            faculty_id: The faculty member who approved/modified.
            execution_id: Optional AgentExecution UUID for traceability.
            question_index: Which question in the batch.
            review_action: "approved" or "modified".

        Returns:
            The created QuestionIntelligencePattern record.
        """
        question_type = question.get(
            "_question_type", question.get("question_type", "mcq"),
        )
        stem = question.get("stem", question.get("question_text", ""))
        difficulty = question.get("difficulty_rating", 3)
        blooms = question.get("blooms_level", "apply")
        competency = question.get("competency_code", "")
        subject = question.get("subject", question.get("department", ""))

        vignette_style = self.classify_vignette_style(stem)

        distractor_strategy = "not_applicable"
        if question_type == "mcq":
            distractor_strategy = self.analyze_distractor_strategy(question)

        pattern = QuestionIntelligencePattern(
            college_id=college_id,
            faculty_id=faculty_id,
            department=subject,
            question_type=question_type,
            difficulty_rating=difficulty,
            blooms_level=blooms,
            stem_length=len(stem),
            vignette_style=vignette_style,
            distractor_strategy=distractor_strategy,
            competency_code=competency,
            question_metadata={
                "execution_id": str(execution_id) if execution_id else None,
                "question_index": question_index,
                "review_action": review_action,
            },
            captured_at=datetime.now(timezone.utc),
        )
        db.add(pattern)

        logger.info(
            "L4 pattern captured: college=%s faculty=%s type=%s style=%s strategy=%s",
            college_id,
            faculty_id,
            question_type,
            vignette_style,
            distractor_strategy,
        )

        return pattern

    # ------------------------------------------------------------------
    # Read path: L4 → S2
    # ------------------------------------------------------------------

    async def get_college_question_profile(
        self,
        db: AsyncSession,
        college_id: UUID,
        subject: str | None = None,
        department: str | None = None,
    ) -> CollegeQuestionProfile:
        """Return the aggregated question style for a college.

        Used by S2 (Practice Question Generator) to mirror exam style.

        Aggregates the most recent faculty-approved question patterns and
        computes distributions for difficulty, Bloom's, vignette style,
        distractor strategies, and topic emphasis.

        If fewer than MIN_PATTERNS_FOR_CUSTOM_PROFILE (20) patterns exist
        for this college, returns the platform default profile based on
        NBME/NMC standards.

        Args:
            db: Database session (tenant-scoped).
            college_id: Tenant UUID.
            subject: Optional filter by subject/department.
            department: Alias for subject (either works).
        """
        filter_subject = subject or department

        query = (
            select(QuestionIntelligencePattern)
            .where(QuestionIntelligencePattern.college_id == college_id)
            .order_by(QuestionIntelligencePattern.captured_at.desc())
            .limit(MAX_PATTERNS_TO_AGGREGATE)
        )

        if filter_subject:
            query = query.where(
                QuestionIntelligencePattern.department == filter_subject,
            )

        result = await db.execute(query)
        patterns = result.scalars().all()

        if len(patterns) < MIN_PATTERNS_FOR_CUSTOM_PROFILE:
            logger.info(
                "College %s has %d patterns (< %d minimum) — using platform defaults",
                college_id,
                len(patterns),
                MIN_PATTERNS_FOR_CUSTOM_PROFILE,
            )
            return PLATFORM_DEFAULT_PROFILE.model_copy(
                update={"college_id": college_id, "sample_size": len(patterns)},
            )

        return self._aggregate_patterns(patterns, college_id)

    # ------------------------------------------------------------------
    # Classification helpers
    # ------------------------------------------------------------------

    @staticmethod
    def classify_vignette_style(stem: str) -> str:
        """Classify question stem style based on characteristics.

        Returns:
            - "detailed_clinical": >300 chars, patient demographics + presenting complaint
            - "clinical_scenario": >150 chars, some clinical context
            - "data_interpretation": contains lab values, ECG, imaging descriptions
            - "image_based": references an image or figure
            - "moderate_stem": 100-150 chars, moderate detail
            - "brief_stem": <100 chars, direct factual question
        """
        if not stem:
            return "brief_stem"

        stem_lower = stem.lower()
        stem_len = len(stem)

        # Check for image-based first (explicit image/figure references)
        image_markers = ["image shows", "figure shows", "photograph shows",
                         "refer to the image", "refer to the figure",
                         "shown in the image", "shown in the figure",
                         "the following image", "the following figure"]
        if any(marker in stem_lower for marker in image_markers):
            return "image_based"

        # Check for data interpretation (lab values, ECG/imaging findings in text)
        data_markers = ["lab values", "laboratory", "blood report", "serum",
                        "hemoglobin", "wbc count", "electrolytes", "abg shows",
                        "ecg shows", "ecg reveals", "x-ray shows", "ct scan shows",
                        "mri shows", "interpretation"]
        if any(marker in stem_lower for marker in data_markers) and stem_len > 100:
            return "data_interpretation"

        # Clinical vignette classification
        has_age_sex = any(
            marker in stem_lower
            for marker in [
                "year-old", "year old", "yo ", "male", "female",
                "man", "woman", "boy", "girl", "child", "infant",
            ]
        )
        has_presents = any(
            marker in stem_lower
            for marker in [
                "presents with", "complains of", "comes to", "brought to",
                "presented to", "reports", "history of",
            ]
        )

        if stem_len > 300 and has_age_sex and has_presents:
            return "detailed_clinical"
        elif stem_len > 150 and (has_age_sex or has_presents):
            return "clinical_scenario"
        elif stem_len > 100:
            return "moderate_stem"
        else:
            return "brief_stem"

    @staticmethod
    def analyze_distractor_strategy(question: dict) -> str:
        """Classify how distractors were constructed in an MCQ.

        Analyzes the distractor_reasoning field to determine the strategy:
        - "differential_based": distractors are differential diagnoses
        - "common_misconception": based on known student errors
        - "related_concept": same topic, different concept
        - "partial_truth": partially correct but incomplete
        - "unknown": no reasoning available to classify
        """
        distractor_reasoning = question.get("distractor_reasoning", [])

        if not distractor_reasoning:
            return "unknown"

        reasoning_text = " ".join(distractor_reasoning).lower()

        if any(term in reasoning_text for term in [
            "differential", "differentials", "diagnosis", "diagnoses",
        ]):
            return "differential_based"
        elif any(term in reasoning_text for term in [
            "misconception", "commonly confused", "common mistake",
            "students often", "frequently confused",
        ]):
            return "common_misconception"
        elif any(term in reasoning_text for term in [
            "partial", "incomplete", "partially correct",
        ]):
            return "partial_truth"
        elif any(term in reasoning_text for term in [
            "similar", "related", "same class", "same category",
        ]):
            return "related_concept"
        else:
            return "mixed_strategy"

    # ------------------------------------------------------------------
    # Internal aggregation
    # ------------------------------------------------------------------

    def _aggregate_patterns(
        self,
        patterns: list[QuestionIntelligencePattern],
        college_id: UUID,
    ) -> CollegeQuestionProfile:
        """Aggregate faculty question patterns into a CollegeQuestionProfile."""
        difficulties = [p.difficulty_rating for p in patterns if p.difficulty_rating]
        blooms_levels = [p.blooms_level for p in patterns if p.blooms_level]
        stem_lengths = [p.stem_length for p in patterns if p.stem_length]
        vignette_styles = [p.vignette_style for p in patterns if p.vignette_style]
        distractor_strats = [
            p.distractor_strategy for p in patterns if p.distractor_strategy
        ]
        departments = [p.department for p in patterns if p.department]

        # Difficulty distribution (string keys for JSON serialization)
        diff_dist: dict[str, float] = {}
        if difficulties:
            counter = Counter(difficulties)
            total = sum(counter.values())
            diff_dist = {str(k): v / total for k, v in counter.items()}

        # Bloom's distribution
        blooms_dist: dict[str, float] = {}
        if blooms_levels:
            counter = Counter(blooms_levels)
            total = sum(counter.values())
            blooms_dist = {k: v / total for k, v in counter.items()}

        # Topic emphasis
        topic_weights: dict[str, float] = {}
        if departments:
            counter = Counter(departments)
            total = sum(counter.values())
            topic_weights = {k: v / total for k, v in counter.items()}

        return CollegeQuestionProfile(
            college_id=college_id,
            sample_size=len(patterns),
            difficulty_distribution=(
                diff_dist
                or PLATFORM_DEFAULT_PROFILE.difficulty_distribution
            ),
            blooms_distribution=(
                blooms_dist
                or PLATFORM_DEFAULT_PROFILE.blooms_distribution
            ),
            avg_stem_length=(
                int(mean(stem_lengths)) if stem_lengths else 200
            ),
            preferred_vignette_style=(
                mode(vignette_styles) if vignette_styles else "detailed_clinical"
            ),
            distractor_strategies=dict(Counter(distractor_strats)),
            topic_emphasis=topic_weights,
            is_default=False,
        )


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

_instance: QuestionIntelligenceLayer | None = None


def get_question_intelligence_layer() -> QuestionIntelligenceLayer:
    """Get the singleton QuestionIntelligenceLayer instance."""
    global _instance
    if _instance is None:
        _instance = QuestionIntelligenceLayer()
    return _instance
