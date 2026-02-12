"""Pydantic schemas for the Recommendation Engine (S6).

Used by:
- RecommendationEngine (LangGraph supervisor graph)
- Recommendation API endpoints
- Celery proactive trigger tasks
"""

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Constrained decoding output schemas (used by complete_structured)
# ---------------------------------------------------------------------------

class GeneratedRecommendation(BaseModel):
    """Single recommendation produced by AI — constrained decoding schema."""

    model_config = ConfigDict(extra="forbid")

    type: str = Field(
        description=(
            "study_topic, review_flashcards, take_practice_test, "
            "revisit_weak_area, take_break, celebrate_progress"
        ),
    )
    priority: int = Field(ge=1, le=5, description="1=highest, 5=lowest")
    title: str = Field(description="Short headline (< 80 chars)")
    description: str = Field(
        description="Personalized explanation (archetype-aware)",
    )
    action: str = Field(
        description="Specific action: 'Review Beta Blockers in Pharmacology'",
    )
    estimated_time_minutes: int = Field(ge=5, le=120)
    reason: str = Field(description="Data-driven reason (why this matters)")
    deep_link: str | None = Field(
        default=None,
        description="Deep link to feature (e.g., /study/flashcards?subject=Pharmacology)",
    )


class GeneratedRecommendationBatch(BaseModel):
    """Batch of recommendations from constrained decoding."""

    model_config = ConfigDict(extra="forbid")

    recommendations: list[GeneratedRecommendation] = Field(
        min_length=1, max_length=10,
    )


class GeneratedStudyBlock(BaseModel):
    """Single study block in a daily plan."""

    model_config = ConfigDict(extra="forbid")

    time_slot: str = Field(description="morning, afternoon, or evening")
    subject: str
    topic: str
    activity: str = Field(
        description="flashcard_review, practice_test, topic_study, revision",
    )
    duration_minutes: int = Field(ge=15, le=120)
    priority: str = Field(description="high, medium, or low")


class GeneratedDayPlan(BaseModel):
    """Single day plan from constrained decoding."""

    model_config = ConfigDict(extra="forbid")

    day_name: str = Field(description="Monday, Tuesday, etc.")
    study_blocks: list[GeneratedStudyBlock]
    break_reminder: str = Field(
        description="Personalized break/wellness reminder",
    )


class GeneratedWeeklyPlan(BaseModel):
    """Weekly study plan from constrained decoding."""

    model_config = ConfigDict(extra="forbid")

    days: list[GeneratedDayPlan] = Field(min_length=7, max_length=7)
    focus_subjects: list[str] = Field(
        description="Top 3-5 priority subjects for this week",
    )
    weekly_goal: str = Field(description="One-sentence motivational goal")


# ---------------------------------------------------------------------------
# LangGraph state
# ---------------------------------------------------------------------------

class KnowledgeGap(BaseModel):
    """A single knowledge gap identified from metacognitive data."""

    subject: str
    topic: str
    mastery_score: float
    gap_type: str = Field(
        description="critical_gap, declining, high_yield_gap, calibration_issue",
    )
    priority: int = Field(ge=1, le=5)
    detail: str


class ImprovementTrend(BaseModel):
    """A topic showing improvement or decline."""

    subject: str
    topic: str
    direction: str = Field(description="improving, declining, stable")
    velocity: float
    mastery_current: float


class WorkloadAssessment(BaseModel):
    """Assessment of student's current study workload."""

    daily_study_minutes_avg: float
    study_sessions_7d: int
    work_break_ratio: float | None
    burnout_risk: bool
    disengagement_risk: bool
    days_since_last_activity: int
    archetype_fit: str = Field(
        description="optimal, too_intense, too_light, needs_breadth, needs_depth",
    )
    archetype_advice: str


# ---------------------------------------------------------------------------
# API response schemas
# ---------------------------------------------------------------------------

class RecommendationResponse(BaseModel):
    """Single recommendation as returned by the API."""

    id: str
    type: str
    priority: int
    title: str
    description: str
    action: str
    estimated_time_minutes: int
    reason: str
    deep_link: str | None
    trigger: str
    status: str
    created_at: datetime | None


class RecommendationListResponse(BaseModel):
    """List of current recommendations."""

    recommendations: list[RecommendationResponse]
    total: int
    active: int


class StudyPlanDayResponse(BaseModel):
    """Single day in the weekly study plan."""

    day_name: str
    date: str | None
    study_blocks: list[dict[str, Any]]
    break_reminder: str
    total_study_minutes: int


class StudyPlanResponse(BaseModel):
    """Current weekly study plan."""

    id: str
    week_start: date
    week_end: date
    days: list[StudyPlanDayResponse]
    focus_subjects: list[str]
    weekly_goal: str
    status: str
    created_at: datetime | None


class DismissRequest(BaseModel):
    """Request body for dismissing a recommendation."""

    reason: str | None = Field(
        default=None,
        max_length=500,
        description="Optional reason for dismissal (captured as feedback)",
    )


class CompleteRequest(BaseModel):
    """Request body for marking a recommendation as completed."""

    feedback: str | None = Field(
        default=None,
        max_length=500,
        description="Optional feedback after completing",
    )
