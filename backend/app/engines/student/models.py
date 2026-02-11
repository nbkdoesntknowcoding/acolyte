"""Student Engine — SQLAlchemy Models.

All models inherit from TenantModel (college_id + RLS).
"""

from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.shared.models import Base, TenantModel


class StudySession(TenantModel):
    """Tracks student study sessions for analytics."""
    __tablename__ = "study_sessions"

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    subject = Column(String(100))
    topic = Column(String(255))
    duration_minutes = Column(Integer)
    session_type = Column(String(20))  # "pdf", "flashcard", "practice", "ai_chat"
    started_at = Column(DateTime(timezone=True))
    ended_at = Column(DateTime(timezone=True))


class Flashcard(TenantModel):
    """Spaced repetition flashcards — enhanced for S5 Flashcard Generator."""
    __tablename__ = "flashcards"
    __table_args__ = (
        Index("ix_flashcards_student_subject_topic", "college_id", "student_id", "subject", "topic"),
        Index("ix_flashcards_student_active", "college_id", "student_id", "is_active"),
    )

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    subject = Column(String(100), nullable=False)
    topic = Column(String(255))
    front = Column(Text, nullable=False)
    back = Column(Text, nullable=False)
    card_type = Column(String(30), default="basic")  # basic, cloze, image_occlusion
    source = Column(String(20), default="manual")  # "manual", "ai_generated"
    competency_code = Column(String(20))
    organ_system = Column(String(100))
    difficulty = Column(Integer, default=3)  # 1-5
    tags = Column(JSONB, default=[])
    source_citation = Column(String(500))
    source_pdf_id = Column(String(500))
    clinical_pearl = Column(Text)
    is_ai_generated = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)


class FlashcardReview(TenantModel):
    """Individual review events for spaced repetition scheduling."""
    __tablename__ = "flashcard_reviews"
    __table_args__ = (
        Index("ix_flashcard_reviews_student_next_review", "college_id", "student_id", "next_review_date"),
    )

    flashcard_id = Column(UUID(as_uuid=True), ForeignKey("flashcards.id"), nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    quality = Column(Integer)  # 0-5 (SM-2 algorithm)
    response_time_ms = Column(Integer)
    interval_days = Column(Float)
    ease_factor = Column(Float, default=2.5)
    repetition_count = Column(Integer, default=0)
    next_review_date = Column(Date)
    reviewed_at = Column(DateTime(timezone=True))


class PracticeTest(TenantModel):
    """AI-generated practice tests."""
    __tablename__ = "practice_tests"

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    subject = Column(String(100), nullable=False)
    topics = Column(JSONB, default=[])
    difficulty = Column(Integer)  # 1-5
    question_count = Column(Integer)
    source = Column(String(20), default="ai_generated")


class TestAttempt(TenantModel):
    """Student attempt at a practice test."""
    __tablename__ = "test_attempts"

    practice_test_id = Column(UUID(as_uuid=True), ForeignKey("practice_tests.id"), nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    score = Column(Float)
    total_marks = Column(Integer)
    time_taken_minutes = Column(Integer)
    answers = Column(JSONB)  # [{question_id, selected, correct, time_spent}]
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))


class ChatSession(TenantModel):
    """Socratic AI conversation history."""
    __tablename__ = "chat_sessions"

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    subject = Column(String(100))
    topic = Column(String(255))
    messages = Column(JSONB, default=[])  # [{role, content, timestamp}]
    token_usage = Column(Integer, default=0)


class PDFAnnotation(TenantModel):
    """Offline-capable PDF annotation layer."""
    __tablename__ = "pdf_annotations"

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    document_key = Column(String(500), nullable=False)  # R2 object key
    page_number = Column(Integer, nullable=False)
    annotation_type = Column(String(20))  # "highlight", "note", "bookmark"
    content = Column(Text)
    position = Column(JSONB)  # {x, y, width, height} or range data
    color = Column(String(7))  # hex color
    created_offline = Column(Boolean, default=False)
    synced_at = Column(DateTime(timezone=True))
