"""Admin Engine — Pydantic Schemas."""

from datetime import date, datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.shared.schemas import PaginatedResponse


# ---------------------------------------------------------------------------
# Department schemas — REFERENCE CRUD PATTERN
# ---------------------------------------------------------------------------

class NMCDepartmentType(str, Enum):
    """NMC-defined department classification (mirrors model enum)."""
    PRECLINICAL = "preclinical"
    PARACLINICAL = "paraclinical"
    CLINICAL = "clinical"


class DepartmentCreate(BaseModel):
    """Schema for creating a new department."""
    name: str = Field(..., min_length=1, max_length=100, examples=["Anatomy"])
    code: str = Field(..., min_length=1, max_length=20, examples=["ANAT"])
    nmc_department_type: NMCDepartmentType
    hod_id: UUID | None = None
    established_year: int | None = Field(default=None, ge=1900, le=2100)


class DepartmentUpdate(BaseModel):
    """Schema for updating a department. All fields optional."""
    name: str | None = Field(default=None, min_length=1, max_length=100)
    code: str | None = Field(default=None, min_length=1, max_length=20)
    nmc_department_type: NMCDepartmentType | None = None
    hod_id: UUID | None = None
    is_active: bool | None = None
    established_year: int | None = Field(default=None, ge=1900, le=2100)


class DepartmentResponse(BaseModel):
    """Full department representation returned by the API."""
    id: UUID
    college_id: UUID
    name: str
    code: str
    nmc_department_type: str
    hod_id: UUID | None
    is_active: bool
    established_year: int | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DepartmentListResponse(PaginatedResponse):
    """Paginated list of departments."""
    data: list[DepartmentResponse]


# ---------------------------------------------------------------------------
# Student schemas (existing)
# ---------------------------------------------------------------------------

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

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Faculty schemas (existing)
# ---------------------------------------------------------------------------

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

    model_config = ConfigDict(from_attributes=True)


class FacultyCount(BaseModel):
    department_id: UUID
    professors: int = 0
    associate_professors: int = 0
    assistant_professors: int = 0
    tutors: int = 0
    senior_residents: int = 0
    total: int = 0
