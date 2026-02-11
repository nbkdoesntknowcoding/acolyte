"""Pydantic schemas for the SAF Auto-Generation Framework (C2).

Used by:
- SAFGenerator (template-driven document generation)
- SAF API endpoints (request/response bodies)
- Celery tasks (serialization)
"""

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Template structure schemas
# ---------------------------------------------------------------------------

class SAFFieldDefinition(BaseModel):
    """Single field within a template section."""

    field_code: str = Field(
        ..., description="Unique code within the template, e.g. A1.1",
    )
    label: str
    field_type: str = Field(
        ..., description="text, number, table, narrative, date",
    )
    data_source: str | None = Field(
        default=None,
        description="Data source identifier, e.g. college_profile.name",
    )
    data_query_config: dict[str, Any] | None = None
    is_required: bool = True
    requires_narrative: bool = False
    narrative_prompt: str | None = Field(
        default=None,
        description="Prompt template for AI narrative generation",
    )
    validation_rules: dict[str, Any] | None = None
    help_text: str | None = None


class SAFSectionDefinition(BaseModel):
    """Section within a template containing multiple fields."""

    section_code: str
    title: str
    order: int
    fields: list[SAFFieldDefinition]


# ---------------------------------------------------------------------------
# Filled field/section results
# ---------------------------------------------------------------------------

class FilledField(BaseModel):
    """Result of filling a single field."""

    field_code: str
    label: str
    field_type: str
    value: Any = None
    source: str = Field(
        description="auto_filled, narrative_generated, manual_entry_required, error",
    )
    data_source_used: str | None = None
    error_message: str | None = None


class FilledSection(BaseModel):
    """Result of filling a template section."""

    section_code: str
    title: str
    order: int
    fields: list[FilledField]
    auto_filled_count: int = 0
    manual_required_count: int = 0
    narrative_count: int = 0


class ComplianceDocumentResult(BaseModel):
    """Full result of generating a compliance document."""

    draft_id: str
    template_code: str
    template_title: str
    academic_year: str | None
    status: str
    sections: list[FilledSection]
    auto_fill_percentage: float
    total_fields: int
    auto_filled_fields: int
    manual_required_fields: int
    narrative_fields: int
    data_gaps: list[dict[str, Any]]
    execution_id: str | None = None


# ---------------------------------------------------------------------------
# API request/response schemas
# ---------------------------------------------------------------------------

class SAFTemplateCreate(BaseModel):
    """Request body for creating a SAF template."""

    template_code: str = Field(..., min_length=1, max_length=50)
    title: str = Field(..., min_length=1, max_length=500)
    description: str | None = None
    regulatory_body: str = Field(
        ..., description="nmc, naac, nba, university, internal",
    )
    version: int = Field(default=1, ge=1)
    sections: list[SAFSectionDefinition]


class SAFTemplateUpdate(BaseModel):
    """Request body for updating a SAF template. All fields optional."""

    title: str | None = None
    description: str | None = None
    regulatory_body: str | None = None
    version: int | None = None
    sections: list[SAFSectionDefinition] | None = None
    is_active: bool | None = None


class SAFTemplateResponse(BaseModel):
    """Response body for a SAF template."""

    id: str
    template_code: str
    title: str
    description: str | None
    regulatory_body: str
    version: int
    sections: list[dict[str, Any]]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SAFTemplatePreview(BaseModel):
    """Preview of template structure — sections and fields without data."""

    template_code: str
    title: str
    regulatory_body: str
    version: int
    total_sections: int
    total_fields: int
    required_fields: int
    narrative_fields: int
    data_source_fields: int
    manual_only_fields: int
    sections: list[dict[str, Any]]


class GenerateDocumentRequest(BaseModel):
    """Request body for generating a document from a template."""

    template_id: str = Field(..., description="UUID of the template")
    academic_year: str | None = Field(
        default=None, description="e.g. 2025-2026",
    )
    parameters: dict[str, Any] = Field(
        default_factory=dict,
        description="Extra parameters for data fetching",
    )


class DocumentDraftResponse(BaseModel):
    """Response body for a compliance document draft."""

    id: str
    template_id: str
    template_code: str | None = None
    academic_year: str | None
    status: str
    filled_data: dict[str, Any]
    data_gaps: list[dict[str, Any]] | None
    auto_fill_percentage: float | None
    narrative_sections: dict[str, Any] | None
    review_comments: list[dict[str, Any]] | None
    generated_by: str
    generated_at: datetime | None
    approved_by: str | None
    approved_at: datetime | None
    submitted_at: datetime | None
    created_at: datetime


class DocumentUpdateRequest(BaseModel):
    """Request body for updating a draft (manual field entries)."""

    field_updates: dict[str, Any] = Field(
        ..., description="Dict of field_code → value for manual entries",
    )
    review_comment: str | None = None


class DocumentGapsResponse(BaseModel):
    """Response listing unfilled fields in a document."""

    draft_id: str
    total_fields: int
    filled_fields: int
    unfilled_fields: int
    gaps: list[dict[str, Any]]
