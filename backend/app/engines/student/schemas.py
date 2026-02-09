"""Student Engine — Pydantic Schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class StudySessionCreate(BaseModel):
    subject: str
    topic: str | None = None
    session_type: str
    duration_minutes: int | None = None


class StudySessionResponse(BaseModel):
    id: UUID
    student_id: UUID
    subject: str
    topic: str | None
    session_type: str
    duration_minutes: int | None
    started_at: datetime | None
    ended_at: datetime | None

    model_config = {"from_attributes": True}


class FlashcardCreate(BaseModel):
    subject: str
    topic: str | None = None
    front: str
    back: str
    competency_code: str | None = None
    tags: list[str] = []


class FlashcardResponse(BaseModel):
    id: UUID
    subject: str
    front: str
    back: str
    source: str
    competency_code: str | None

    model_config = {"from_attributes": True}
