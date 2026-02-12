"""Pydantic schemas for the Metacognitive Analytics Engine (S8).

All input/output types for event capture, profile queries, archetype
assessment, AI agent context, and faculty analytics.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# OCEAN questionnaire constants (from Archetype Framework document)
# ---------------------------------------------------------------------------

# Question indices mapped to OCEAN traits (0-indexed)
# Q1-5: Conscientiousness, Q6-10: Neuroticism, Q11-15: Openness,
# Q16-20: Extraversion, Q21-25: Agreeableness
OCEAN_TRAIT_QUESTIONS: dict[str, list[int]] = {
    "conscientiousness": [1, 2, 3, 4, 5],
    "neuroticism": [6, 7, 8, 9, 10],
    "openness": [11, 12, 13, 14, 15],
    "extraversion": [16, 17, 18, 19, 20],
    "agreeableness": [21, 22, 23, 24, 25],
}

# Thresholds for High / Low trait classification
OCEAN_HIGH_THRESHOLD = 3.5
OCEAN_LOW_THRESHOLD = 2.5

# Five archetypes
ARCHETYPE_NAMES = [
    "Methodical Planner",
    "Anxious Achiever",
    "Deep Diver",
    "Pragmatic Strategist",
    "Collaborative Learner",
]

# 25-question OCEAN questionnaire (from the Archetype Framework PDF, Section 3.1)
OCEAN_QUESTIONNAIRE: list[dict[str, str | int]] = [
    # Conscientiousness (Q1-5)
    {"id": 1, "trait": "conscientiousness", "text": "When preparing for a major exam like the NEET-PG, I create a detailed, day-by-day study schedule and stick to it rigidly."},
    {"id": 2, "trait": "conscientiousness", "text": "I feel a strong sense of accomplishment when I have methodically organized all my notes and study materials for a subject."},
    {"id": 3, "trait": "conscientiousness", "text": "I always make sure to complete all the assigned readings and required tasks for a topic before I consider it \"done.\""},
    {"id": 4, "trait": "conscientiousness", "text": "I am very disciplined about my study routine, even when I don't feel motivated."},
    {"id": 5, "trait": "conscientiousness", "text": "If I fall behind on my study plan, I feel a strong need to work extra hours to catch up immediately."},
    # Neuroticism (Q6-10)
    {"id": 6, "trait": "neuroticism", "text": "Thinking about the high expectations my family has for my medical career makes me feel a great deal of pressure and anxiety."},
    {"id": 7, "trait": "neuroticism", "text": "When I encounter a difficult topic, I often feel overwhelmed and start to doubt my ability to succeed in medicine."},
    {"id": 8, "trait": "neuroticism", "text": "I worry a lot about my performance on upcoming exams, even when I have prepared well."},
    {"id": 9, "trait": "neuroticism", "text": "During a difficult test, I often find my mind going blank or racing with anxious thoughts."},
    {"id": 10, "trait": "neuroticism", "text": "I tend to second-guess my answers on exams, often changing a correct answer to an incorrect one because I lose confidence."},
    # Openness (Q11-15)
    {"id": 11, "trait": "openness", "text": "I often find myself reading extra journal articles or textbook chapters about a medical topic simply because I find it fascinating, even if I know it's not high-yield for the exam."},
    {"id": 12, "trait": "openness", "text": "I learn best when I understand the deep, underlying physiological or pathological principles, rather than just memorizing symptoms and treatments."},
    {"id": 13, "trait": "openness", "text": "I find rote memorization of facts, like anatomical tables or drug dosages, to be tedious and unfulfilling."},
    {"id": 14, "trait": "openness", "text": "I enjoy making connections between different medical subjects, like seeing how a concept from biochemistry applies to a clinical case in medicine."},
    {"id": 15, "trait": "openness", "text": "I am more motivated by the challenge of understanding a complex idea than by getting a perfect score on an easy test."},
    # Extraversion (Q16-20)
    {"id": 16, "trait": "extraversion", "text": "After a long day of lectures, I feel more energized and ready to study if I can first discuss the difficult concepts with my classmates."},
    {"id": 17, "trait": "extraversion", "text": "I find studying completely alone for long periods to be draining and demotivating."},
    {"id": 18, "trait": "extraversion", "text": "I learn a concept best when I have the opportunity to teach it or explain it out loud to someone else."},
    {"id": 19, "trait": "extraversion", "text": "I am quick to organize or join a study group when preparing for a major exam."},
    {"id": 20, "trait": "extraversion", "text": "I actively seek out feedback and discussion with my peers and professors to clarify my understanding."},
    # Agreeableness (Q21-25)
    {"id": 21, "trait": "agreeableness", "text": "I will often pause my own revision to help a classmate who is struggling with a concept, even if it means falling behind on my own schedule."},
    {"id": 22, "trait": "agreeableness", "text": "I find it easy to ask for help from classmates or seniors when I don't understand something."},
    {"id": 23, "trait": "agreeableness", "text": "I prefer cooperative learning environments where students help each other, rather than highly competitive ones."},
    {"id": 24, "trait": "agreeableness", "text": "When working in a group for a case discussion, I focus on ensuring everyone understands and that we reach a consensus."},
    {"id": 25, "trait": "agreeableness", "text": "I feel a strong sense of empathy for patients during clinical rotations, and this motivates my learning."},
]


# ---------------------------------------------------------------------------
# Event capture
# ---------------------------------------------------------------------------

class MetacognitiveEventInput(BaseModel):
    """Input for capturing a metacognitive event."""

    model_config = ConfigDict(extra="forbid")

    student_id: UUID
    college_id: UUID
    event_type: str = Field(
        description=(
            "One of: question_answered, page_viewed, flashcard_reviewed, "
            "study_session_started, study_session_ended, ai_interaction, "
            "confidence_rated, navigation_event"
        ),
    )
    event_data: dict = Field(
        description="Event-type-specific payload",
    )
    subject: str | None = Field(default=None)
    topic: str | None = Field(default=None)
    competency_code: str | None = Field(default=None)
    occurred_at: datetime | None = Field(
        default=None,
        description="Timestamp of the event. Defaults to now.",
    )


# ---------------------------------------------------------------------------
# OCEAN scores and archetype schemas
# ---------------------------------------------------------------------------

class OCEANScores(BaseModel):
    """Big Five personality trait scores (1.0 - 5.0 each)."""

    model_config = ConfigDict(extra="forbid")

    openness: float = Field(ge=1.0, le=5.0)
    conscientiousness: float = Field(ge=1.0, le=5.0)
    extraversion: float = Field(ge=1.0, le=5.0)
    agreeableness: float = Field(ge=1.0, le=5.0)
    neuroticism: float = Field(ge=1.0, le=5.0)


class QuestionnaireResponse(BaseModel):
    """A single questionnaire answer."""

    model_config = ConfigDict(extra="forbid")

    question_id: int = Field(ge=1, le=25)
    rating: int = Field(ge=1, le=5, description="1=Strongly Disagree to 5=Strongly Agree")


class ArchetypeAssessment(BaseModel):
    """Layer 1 — self-reported archetype from OCEAN questionnaire."""

    model_config = ConfigDict(extra="forbid")

    ocean_scores: OCEANScores
    primary_archetype: str
    archetype_confidence: float = Field(
        ge=0.0, le=1.0,
        description="How clearly the OCEAN scores match the archetype pattern",
    )
    secondary_archetype: str | None = None
    assessed_at: datetime


class BehavioralArchetype(BaseModel):
    """Layer 2 — data-driven behavioral archetype from 30+ days of usage."""

    model_config = ConfigDict(extra="forbid")

    computed_archetype: str
    confidence: float = Field(
        ge=0.0, le=1.0,
        description="How clearly the behavioral data matches the archetype",
    )
    archetype_signals: dict[str, float] = Field(
        description="Per-archetype signal scores (0-1)",
    )
    discrepancy_from_self_report: bool
    blind_spots: list[str] = Field(
        description="Specific insights about self-report vs behavior gaps",
    )
    data_days: int = Field(description="Number of days of data used")


class MetacognitiveReveal(BaseModel):
    """The metacognitive 'aha moment' — Layer 1 vs Layer 2 comparison."""

    model_config = ConfigDict(extra="forbid")

    self_reported_archetype: str
    behavioral_archetype: str
    match: bool
    insight: str = Field(
        description="LLM-generated natural language insight (Haiku)",
    )
    blind_spots: list[str]
    recommendations: list[str]


# ---------------------------------------------------------------------------
# Spaced repetition
# ---------------------------------------------------------------------------

class SpacedRepetitionUpdate(BaseModel):
    """Result of SM-2 algorithm update for a flashcard."""

    model_config = ConfigDict(extra="forbid")

    next_review_at: datetime
    interval_hours: float
    ease_factor: float
    repetition_count: int
    response_quality: int = Field(ge=0, le=5)


# ---------------------------------------------------------------------------
# Profile and summary schemas
# ---------------------------------------------------------------------------

class SubjectMastery(BaseModel):
    """Mastery data for a single subject+topic."""

    model_config = ConfigDict(extra="forbid")

    subject: str
    topic: str
    mastery_score: float
    accuracy_rate: float
    total_questions_attempted: int
    total_correct: int
    confidence_calibration: float | None
    answer_change_rate: float | None
    beneficial_change_rate: float | None
    detrimental_change_rate: float | None
    learning_velocity: float | None
    risk_level: str
    last_active_at: datetime | None
    avg_time_per_question_ms: int | None
    work_break_ratio: float | None
    consistency_score: float | None
    revisit_ratio: float | None


class ArchetypeInfo(BaseModel):
    """Archetype summary for inclusion in student analytics."""

    model_config = ConfigDict(extra="forbid")

    self_reported_archetype: str | None = None
    behavioral_archetype: str | None = None
    ocean_scores: OCEANScores | None = None
    archetype_match: bool | None = None
    reveal_available: bool = False


class StudentSummary(BaseModel):
    """Complete analytics summary for a student."""

    model_config = ConfigDict(extra="forbid")

    student_id: UUID
    college_id: UUID
    overall_mastery: float = Field(description="Average mastery across all topics")
    overall_risk_level: str
    total_topics_studied: int
    topics_at_risk: int
    total_questions_attempted: int
    total_correct: int
    overall_accuracy: float
    study_streak_days: int = Field(
        description="Consecutive days with at least one event",
    )
    last_active_at: datetime | None
    mastery_by_subject: list[SubjectMastery]
    archetype_info: ArchetypeInfo | None = None
    avg_work_break_ratio: float | None = None
    avg_consistency_score: float | None = None


# ---------------------------------------------------------------------------
# AI agent integration
# ---------------------------------------------------------------------------

class StudentAIContext(BaseModel):
    """Structured context for AI agents (S1 Study Buddy, S6 Recommendations).

    This is what the Socratic Study Buddy uses to calibrate scaffolding
    level and question difficulty.
    """

    model_config = ConfigDict(extra="forbid")

    student_id: UUID
    college_id: UUID
    overall_mastery: float
    subject_masteries: dict[str, float] = Field(
        description="subject → average mastery_score",
    )
    weak_topics: list[str] = Field(
        description="Topics with mastery < 0.4",
    )
    strong_topics: list[str] = Field(
        description="Topics with mastery > 0.8",
    )
    confidence_tendency: str = Field(
        description="under_confident | well_calibrated | over_confident",
    )
    learning_style: str = Field(
        description="Archetype name or 'unknown'",
    )
    recent_activity: dict = Field(
        description="last_session_at, topics_studied, questions_done_7d",
    )
    risk_level: str
    recommended_difficulty: int = Field(
        ge=1, le=5,
        description="Recommended difficulty level based on current performance",
    )
    answer_change_tendency: str = Field(
        description="beneficial | detrimental | neutral",
    )


# ---------------------------------------------------------------------------
# Faculty-facing analytics
# ---------------------------------------------------------------------------

class AtRiskStudent(BaseModel):
    """A student identified as at-risk."""

    model_config = ConfigDict(extra="forbid")

    student_id: UUID
    risk_level: str
    risk_reasons: list[str] = Field(
        default_factory=list,
        description="Human-readable reasons for risk classification",
    )
    risk_topics: list[dict] = Field(
        description="Topics where mastery is below threshold",
    )
    overall_mastery: float
    learning_velocity: float | None
    last_active_at: datetime | None
    days_inactive: int
    recommended_intervention: str = Field(
        default="",
        description="Suggested action for faculty",
    )


class TopicMastery(BaseModel):
    """Aggregate mastery for a topic across students."""

    model_config = ConfigDict(extra="forbid")

    topic: str
    avg_mastery: float
    student_count: int
    at_risk_count: int


class WeeklyEngagement(BaseModel):
    """Weekly engagement data point."""

    model_config = ConfigDict(extra="forbid")

    week_start: str  # ISO date string
    active_students: int
    total_events: int


class DepartmentAnalytics(BaseModel):
    """Aggregate analytics for a department — used by HOD and faculty."""

    model_config = ConfigDict(extra="forbid")

    college_id: UUID
    department: str | None
    total_students: int
    active_students_30d: int
    avg_mastery_by_topic: list[TopicMastery]
    risk_distribution: dict[str, int] = Field(
        description='{"low": 45, "medium": 30, "high": 15}',
    )
    common_weak_areas: list[str]
    engagement_trend: list[WeeklyEngagement]
