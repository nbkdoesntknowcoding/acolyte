"""Faculty Engine — Pydantic Schemas."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel


class LogbookEntryCreate(BaseModel):
    competency_id: UUID
    date: date
    activity_type: str
    performance_count: int = 1
    clinical_setting: str | None = None
    patient_consent_obtained: bool = False
    notes: str | None = None


class LogbookEntryResponse(BaseModel):
    id: UUID
    student_id: UUID
    competency_id: UUID
    date: date
    activity_type: str
    performance_count: int
    verified_by: UUID | None
    verified_at: datetime | None

    model_config = {"from_attributes": True}


class MCQGenerateRequest(BaseModel):
    competency_code: str
    target_difficulty: int = 3
    target_blooms: str = "Apply"
    count: int = 5


class QuestionBankItemResponse(BaseModel):
    id: UUID
    question_type: str
    subject: str
    stem: str
    blooms_level: str
    difficulty_rating: int | None
    status: str

    model_config = {"from_attributes": True}
