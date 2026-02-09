"""Admin Engine — Pydantic Schemas."""

from datetime import date
from uuid import UUID

from pydantic import BaseModel


class StudentCreate(BaseModel):
    name: str
    email: str | None = None
    phone: str | None = None
    admission_quota: str
    admission_year: int
    neet_score: int | None = None


class StudentResponse(BaseModel):
    id: UUID
    name: str
    email: str | None
    admission_quota: str
    current_phase: str | None
    status: str

    model_config = {"from_attributes": True}


class FacultyCreate(BaseModel):
    name: str
    email: str | None = None
    designation: str
    department_id: UUID
    qualification: str | None = None


class FacultyResponse(BaseModel):
    id: UUID
    name: str
    designation: str | None
    department_id: UUID
    status: str

    model_config = {"from_attributes": True}


class FacultyCount(BaseModel):
    department_id: UUID
    professors: int = 0
    associate_professors: int = 0
    assistant_professors: int = 0
    tutors: int = 0
    senior_residents: int = 0
    total: int = 0
