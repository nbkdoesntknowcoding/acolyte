"""Pydantic schemas for the NEET-PG Exam Prep Agent (S3).

Used by:
- NEETPGPrepAgent (mock test generation + post-test analytics)
- NEET-PG API endpoints (request/response bodies)
- Historical cutoff reference data
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Blueprint & distribution constants
# ---------------------------------------------------------------------------

# NEET-PG subject-wise distribution for a full 200-question paper.
# Based on NBE pattern analysis from past 10 years.
NEET_PG_BLUEPRINT: dict[str, int] = {
    "Medicine": 30,
    "Surgery": 25,
    "Obstetrics & Gynaecology": 20,
    "Paediatrics": 15,
    "Pharmacology": 15,
    "Pathology": 15,
    "Microbiology": 12,
    "Anatomy": 10,
    "Physiology": 10,
    "Biochemistry": 8,
    "Forensic Medicine": 8,
    "Community Medicine": 10,
    "Ophthalmology": 8,
    "ENT": 7,
    "Dermatology": 4,
    "Psychiatry": 3,
}

# NEET-PG difficulty distribution (different from college exams).
NEET_PG_DIFFICULTY_DISTRIBUTION: dict[str, float] = {
    "difficult": 0.60,   # 120 questions
    "moderate": 0.25,    # 50 questions
    "easy": 0.15,        # 30 questions
}

# Difficulty mapping: difficulty label → numeric range (1-5 scale)
DIFFICULTY_TO_RANGE: dict[str, tuple[int, int]] = {
    "easy": (1, 2),
    "moderate": (3, 3),
    "difficult": (4, 5),
}

# NEET-PG marking scheme
MARKS_PER_CORRECT = 4
MARKS_PER_WRONG = -1
MARKS_PER_UNANSWERED = 0

# Test types
FULL_TEST_QUESTIONS = 200
MINI_TEST_QUESTIONS = 50
SUBJECT_TEST_QUESTIONS = 30

FULL_TEST_DURATION_MINUTES = 210    # 3.5 hours
MINI_TEST_DURATION_MINUTES = 53     # proportional
SUBJECT_TEST_DURATION_MINUTES = 32  # proportional


# ---------------------------------------------------------------------------
# Mock test question (extends GeneratedMCQ from S2)
# ---------------------------------------------------------------------------

class NEETPGQuestion(BaseModel):
    """Single NEET-PG style MCQ with exam-specific metadata."""

    model_config = ConfigDict(extra="forbid")

    question_index: int = Field(description="0-based index in the test")
    stem: str = Field(description="Clinical vignette or question setup")
    lead_in: str = Field(description="The actual question")
    options: list[dict[str, Any]] = Field(
        description="4 options [{text, is_correct, explanation}]",
    )
    correct_answer_index: int = Field(ge=0, le=3)
    subject: str
    topic: str
    competency_code: str = ""
    blooms_level: str = "apply"
    difficulty_tier: str = Field(
        description="easy, moderate, or difficult (NEET-PG calibrated)",
    )
    difficulty_rating: int = Field(ge=1, le=5)
    source_citations: list[str] = Field(default_factory=list)
    clinical_pearl: str = ""
    image_url: str | None = None


class NEETPGMockTest(BaseModel):
    """Complete NEET-PG mock test ready for student consumption."""

    test_id: str = Field(description="UUID of the PracticeTest record")
    test_type: str = Field(description="full, mini, or subject")
    subject_focus: str | None = Field(
        default=None,
        description="Non-null for subject-specific tests",
    )
    questions: list[NEETPGQuestion]
    question_count: int
    duration_minutes: int
    blueprint_used: dict[str, int] = Field(
        description="Subject distribution actually used",
    )
    difficulty_distribution: dict[str, int] = Field(
        description="Count per difficulty tier",
    )
    total_marks: int = Field(description="Maximum achievable score")
    negative_marks_per_wrong: int = MARKS_PER_WRONG
    marks_per_correct: int = MARKS_PER_CORRECT
    weak_area_weighted: bool = False
    generation_metadata: dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Answer submission
# ---------------------------------------------------------------------------

class AnswerSubmission(BaseModel):
    """Single answer in a test submission."""

    question_index: int = Field(ge=0)
    selected_option: int | None = Field(
        default=None, ge=0, le=3,
        description="None = unanswered",
    )
    time_taken_ms: int = Field(ge=0, description="Time spent on this question")
    flagged: bool = Field(
        default=False,
        description="Whether student flagged this for review",
    )


# ---------------------------------------------------------------------------
# Post-test analytics
# ---------------------------------------------------------------------------

class SubjectBreakdown(BaseModel):
    """Score breakdown for a single subject."""

    subject: str
    total_questions: int
    attempted: int
    correct: int
    wrong: int
    unanswered: int
    score: int = Field(description="Score for this subject (with negative marking)")
    max_score: int
    accuracy_pct: float = Field(description="correct / attempted * 100")


class TopicBreakdown(BaseModel):
    """Score breakdown for a topic within a subject."""

    subject: str
    topic: str
    total_questions: int
    correct: int
    wrong: int
    accuracy_pct: float


class DifficultyBreakdown(BaseModel):
    """Accuracy per difficulty tier."""

    tier: str  # easy, moderate, difficult
    total_questions: int
    correct: int
    accuracy_pct: float


class TimeAnalysis(BaseModel):
    """Time-related analytics."""

    total_time_ms: int
    avg_time_per_question_ms: float
    fastest_question_ms: int
    slowest_question_ms: int
    time_vs_accuracy_correlation: float = Field(
        description="Pearson r between time spent and correctness (-1 to 1)",
    )
    overtime_questions: int = Field(
        description="Questions taking >2x average time",
    )


class PredictedRank(BaseModel):
    """Predicted rank range based on historical cutoff data."""

    score: int
    max_score: int
    score_percentile: float = Field(
        description="Estimated percentile based on historical distribution",
    )
    predicted_rank_low: int
    predicted_rank_high: int
    category_prediction: str = Field(
        description="Above cutoff / Near cutoff / Below cutoff",
    )
    reference_year: int = Field(
        description="Which year's cutoff data was used",
    )
    general_cutoff: int
    obc_cutoff: int
    sc_cutoff: int
    st_cutoff: int


class ImprovementArea(BaseModel):
    """A specific area for improvement."""

    subject: str
    topic: str
    current_accuracy: float
    historical_frequency: float = Field(
        description="How often this topic appears in NEET-PG (0-1)",
    )
    priority: str  # high, medium, low
    recommendation: str


class NEETPGAnalysis(BaseModel):
    """Comprehensive post-test analytics for a NEET-PG mock test."""

    test_id: str
    student_id: str

    # Scores
    raw_score: int = Field(
        description="correct*4 - wrong*1 (NEET-PG marking scheme)",
    )
    max_score: int
    total_questions: int
    attempted: int
    correct: int
    wrong: int
    unanswered: int
    accuracy_pct: float = Field(
        description="correct / attempted * 100",
    )

    # Breakdowns
    subject_breakdown: list[SubjectBreakdown]
    topic_breakdown: list[TopicBreakdown]
    difficulty_breakdown: list[DifficultyBreakdown]
    time_analysis: TimeAnalysis

    # Predictions
    predicted_rank: PredictedRank

    # AI-generated insights (via Sonnet)
    improvement_plan: str = Field(
        description="AI-generated subject-wise improvement narrative",
    )
    high_yield_focus: list[ImprovementArea] = Field(
        description="Topics with high exam frequency but low student accuracy",
    )
    comparison_with_previous: str | None = Field(
        default=None,
        description="Comparison narrative if student has previous attempts",
    )

    # Metadata
    analyzed_at: datetime | None = None
    execution_id: str | None = None


# ---------------------------------------------------------------------------
# High-yield topics
# ---------------------------------------------------------------------------

class HighYieldTopic(BaseModel):
    """A prioritized study topic based on exam frequency + student mastery."""

    subject: str
    topic: str
    historical_frequency: float = Field(
        description="How often this topic appears in NEET-PG (0-1)",
    )
    student_mastery: float = Field(
        description="Student's current mastery level (0-1)",
    )
    priority_score: float = Field(
        description="frequency * (1 - mastery) * time_weight",
    )
    estimated_questions_in_exam: int = Field(
        description="Expected number of questions on this topic",
    )
    recommended_hours: int = Field(
        description="Suggested study hours for this topic",
    )


# ---------------------------------------------------------------------------
# Mock test history
# ---------------------------------------------------------------------------

class MockTestHistoryEntry(BaseModel):
    """Summary of a past mock test attempt."""

    test_id: str
    test_type: str
    subject_focus: str | None
    score: int
    max_score: int
    accuracy_pct: float
    percentile: float
    question_count: int
    attempted_at: datetime | None


class MockTestHistory(BaseModel):
    """Student's NEET-PG mock test history with trend."""

    tests: list[MockTestHistoryEntry]
    total_tests: int
    avg_score: float
    avg_accuracy: float
    best_score: int
    score_trend: str = Field(
        description="improving, declining, stable, insufficient_data",
    )


# ---------------------------------------------------------------------------
# API request/response schemas
# ---------------------------------------------------------------------------

class GenerateMockTestRequest(BaseModel):
    """Request body for generating a NEET-PG mock test."""

    test_type: str = Field(
        default="full",
        description="full (200Q), mini (50Q), or subject (30Q)",
    )
    subject_focus: str | None = Field(
        default=None,
        description="Required for subject-type tests",
    )
    weak_area_focus: bool = Field(
        default=False,
        description="Weight towards student's weak topics from metacognitive profile",
    )


class SubmitMockTestRequest(BaseModel):
    """Request body for submitting a mock test."""

    test_id: str = Field(description="UUID of the mock test")
    answers: list[AnswerSubmission]


class HighYieldTopicsRequest(BaseModel):
    """Query params for high-yield topics."""

    days_until_exam: int = Field(default=90, ge=1, le=365)
