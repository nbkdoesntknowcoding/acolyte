"""Pydantic schemas for the Flashcard Generator Agent (S5).

Used by:
- FlashcardGenerator (AI-powered flashcard creation)
- Flashcard API endpoints (request/response bodies)
- SM-2 spaced repetition integration
"""

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Constrained decoding output schema (used by complete_structured)
# ---------------------------------------------------------------------------

class GeneratedFlashcard(BaseModel):
    """Single flashcard produced by AI — constrained decoding schema."""

    model_config = ConfigDict(extra="forbid")

    front: str = Field(description="Question or cloze text (with {{blank}} for cloze)")
    back: str = Field(description="Answer or completed text")
    card_type: str = Field(
        description="basic, cloze, or image_occlusion",
    )
    subject: str
    topic: str
    organ_system: str | None = None
    difficulty: int = Field(ge=1, le=5, description="1-5 difficulty scale")
    source_citation: str = Field(description="Page/chapter reference from source")
    tags: list[str] = Field(default_factory=list)
    clinical_pearl: str | None = Field(
        default=None,
        description="One-line clinical connection (null if not applicable)",
    )
    competency_code: str | None = None


class GeneratedFlashcardBatch(BaseModel):
    """Batch of flashcards from constrained decoding."""

    model_config = ConfigDict(extra="forbid")

    flashcards: list[GeneratedFlashcard]


# ---------------------------------------------------------------------------
# Flashcard response (returned to client)
# ---------------------------------------------------------------------------

class FlashcardResponse(BaseModel):
    """Single flashcard as returned by the API."""

    id: str
    front: str
    back: str
    card_type: str
    subject: str
    topic: str
    organ_system: str | None
    difficulty: int
    tags: list[str]
    source_citation: str | None
    source_pdf_id: str | None
    clinical_pearl: str | None
    competency_code: str | None
    is_ai_generated: bool
    is_active: bool
    created_at: datetime | None


class FlashcardBatch(BaseModel):
    """Batch of flashcards with generation metadata."""

    flashcards: list[FlashcardResponse]
    total_generated: int
    source_type: str = Field(description="pdf, topic, or manual")
    generation_metadata: dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# SM-2 Spaced Repetition
# ---------------------------------------------------------------------------

class SpacedRepetitionUpdate(BaseModel):
    """Result of processing a flashcard review."""

    card_id: str
    ease_factor: float = Field(description="Updated ease factor (>= 1.3)")
    interval_days: float = Field(description="Days until next review")
    repetition_count: int
    next_review_date: date
    quality: int = Field(ge=0, le=5, description="SM-2 quality (0-5)")


# ---------------------------------------------------------------------------
# Review session
# ---------------------------------------------------------------------------

class ReviewCard(BaseModel):
    """A flashcard due for review, with scheduling metadata."""

    id: str
    front: str
    back: str
    card_type: str
    subject: str
    topic: str
    difficulty: int
    clinical_pearl: str | None
    ease_factor: float
    interval_days: float
    repetition_count: int
    days_overdue: int = Field(
        description="How many days past due (0 = due today, negative = new)",
    )


class ReviewSession(BaseModel):
    """Cards due for review in the current session."""

    cards: list[ReviewCard]
    total_due: int = Field(description="Total cards due (may exceed max_cards)")
    new_cards: int = Field(description="Cards never reviewed")
    overdue_cards: int = Field(description="Cards past their due date")
    subject_filter: str | None = None


# ---------------------------------------------------------------------------
# Flashcard stats
# ---------------------------------------------------------------------------

class FlashcardStats(BaseModel):
    """Student's flashcard statistics."""

    total_cards: int
    active_cards: int
    due_today: int
    overdue: int
    mastered: int = Field(
        description="Cards with ease_factor >= 2.5 and interval >= 21 days",
    )
    learning: int = Field(
        description="Cards with interval < 21 days",
    )
    new_cards: int = Field(description="Cards never reviewed")
    by_subject: list[dict[str, Any]] = Field(
        description="[{subject, total, due_today, mastered}]",
    )
    avg_ease_factor: float
    total_reviews: int
    streak_days: int = Field(
        description="Consecutive days with at least one review",
    )


# ---------------------------------------------------------------------------
# API request schemas
# ---------------------------------------------------------------------------

class GenerateFromPDFRequest(BaseModel):
    """Request body for generating flashcards from PDF."""

    pdf_id: str = Field(..., description="R2 object key or document ID")
    page_range: list[int] | None = Field(
        default=None,
        min_length=2,
        max_length=2,
        description="[start_page, end_page] or null for entire document",
    )
    subject: str | None = None
    topic: str | None = None
    count: int = Field(default=20, ge=1, le=50)
    card_types: list[str] = Field(
        default=["basic", "cloze"],
        description="basic, cloze, image_occlusion",
    )


class GenerateFromTopicRequest(BaseModel):
    """Request body for generating flashcards from a topic."""

    subject: str = Field(..., min_length=1, max_length=200)
    topic: str = Field(..., min_length=1, max_length=500)
    count: int = Field(default=20, ge=1, le=50)
    focus: str = Field(
        default="comprehensive",
        description="comprehensive, high_yield, or weak_areas",
    )


class ReviewRequest(BaseModel):
    """Request body for processing a flashcard review."""

    response_quality: int = Field(
        ..., ge=0, le=5,
        description=(
            "SM-2 quality scale: "
            "0=complete blackout, 1=wrong but recognized, "
            "2=wrong but easy to recall, 3=correct with difficulty, "
            "4=correct with some hesitation, 5=perfect recall"
        ),
    )
    response_time_ms: int = Field(ge=0, description="Time to respond in ms")
