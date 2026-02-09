"""Compliance Engine — Pydantic Schemas."""

from datetime import date
from uuid import UUID

from pydantic import BaseModel


class ComplianceSnapshotResponse(BaseModel):
    id: UUID
    department_id: UUID | None
    snapshot_date: date
    compliance_score: float | None
    risk_level: str | None
    faculty_ratio: float | None
    faculty_status: str | None

    model_config = {"from_attributes": True}


class SAFGenerateRequest(BaseModel):
    form_type: str  # "AI", "AII", "AIII"
    academic_year: str


class MSRAlertResponse(BaseModel):
    id: UUID
    department_id: UUID | None
    alert_type: str
    severity: str
    message: str

    model_config = {"from_attributes": True}
