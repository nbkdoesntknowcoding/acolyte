"""Pydantic schemas for the Compliance Monitoring Framework.

Used by:
- ComplianceRulesEngine (evaluation results)
- ComplianceMonitorSupervisor (LangGraph state)
- Compliance API endpoints (request/response bodies)
- Celery tasks (serialization)
"""

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Data fetcher results
# ---------------------------------------------------------------------------

class DataFetchResult(BaseModel):
    """Result from a data fetcher function."""

    value: float | str | bool | None = None
    status: str = Field(
        description="ok, not_implemented, error, no_data",
    )
    message: str | None = None
    fetched_at: datetime | None = None
    raw_data: dict[str, Any] | None = Field(
        default=None,
        description="Raw query result for debugging",
    )


# ---------------------------------------------------------------------------
# Standard check results
# ---------------------------------------------------------------------------

class StandardCheckResult(BaseModel):
    """Result of evaluating a single compliance standard."""

    standard_id: str
    standard_code: str
    category: str
    subcategory: str | None = None
    title: str
    status: str = Field(
        description="compliant, at_risk, non_compliant, data_unavailable",
    )
    current_value: str | None = None
    threshold_value: str
    threshold_type: str
    comparison_operator: str
    gap_pct: float | None = Field(
        default=None,
        description="Percentage gap from threshold (negative = below)",
    )
    severity_if_breached: str
    regulatory_body: str
    recommendation: str | None = None
    data_fetch_status: str | None = Field(
        default=None,
        description="Status from the data fetcher",
    )
    data_fetch_message: str | None = None


class ComplianceEvaluation(BaseModel):
    """Result of evaluating all standards for a college."""

    college_id: str
    overall_status: str = Field(
        description="green, yellow, orange, red",
    )
    snapshot_date: date
    snapshot_type: str = "manual"

    # Counts
    standards_checked: int = 0
    standards_compliant: int = 0
    standards_at_risk: int = 0
    standards_breached: int = 0

    # Details
    check_results: list[StandardCheckResult] = Field(default_factory=list)
    data_gaps: list[StandardCheckResult] = Field(
        default_factory=list,
        description="Standards that couldn't be checked due to missing data",
    )
    alerts_generated: int = 0


# ---------------------------------------------------------------------------
# Trend analysis
# ---------------------------------------------------------------------------

class ComplianceTrendPoint(BaseModel):
    """Single data point in a compliance trend."""

    snapshot_date: date
    overall_status: str
    standards_compliant: int
    standards_at_risk: int
    standards_breached: int
    compliance_pct: float = Field(
        description="Percentage of standards that are compliant",
    )


class TrendAnalysis(BaseModel):
    """Trend analysis over a historical period."""

    data_points: list[ComplianceTrendPoint] = Field(default_factory=list)
    trend_direction: str = Field(
        default="stable",
        description="improving, stable, declining",
    )
    days_of_data: int = 0
    predicted_status_30d: str | None = None


# ---------------------------------------------------------------------------
# API request/response schemas
# ---------------------------------------------------------------------------

class ComplianceStandardCreate(BaseModel):
    """Request body for creating a compliance standard."""

    standard_code: str = Field(..., min_length=1, max_length=50)
    category: str = Field(..., min_length=1, max_length=50)
    subcategory: str | None = None
    title: str = Field(..., min_length=1, max_length=500)
    description: str = Field(..., min_length=1)
    data_source: str = Field(..., min_length=1, max_length=100)
    data_query_config: dict[str, Any]
    threshold_type: str = Field(
        ...,
        description="min_percentage, min_count, max_count, min_ratio, boolean, custom",
    )
    threshold_value: str = Field(..., min_length=1, max_length=100)
    comparison_operator: str = Field(default="gte")
    buffer_warning_pct: float = Field(default=10.0, ge=0, le=100)
    severity_if_breached: str = Field(
        ...,
        description="informational, warning, show_cause, seat_reduction, closure_risk",
    )
    regulatory_body: str = Field(
        ...,
        description="nmc, naac, nba, university, internal",
    )
    source_document: str | None = None
    effective_from: date | None = None
    effective_until: date | None = None
    priority: int = Field(default=5, ge=1, le=10)


class ComplianceStandardUpdate(BaseModel):
    """Request body for updating a compliance standard. All fields optional."""

    category: str | None = None
    subcategory: str | None = None
    title: str | None = None
    description: str | None = None
    data_source: str | None = None
    data_query_config: dict[str, Any] | None = None
    threshold_type: str | None = None
    threshold_value: str | None = None
    comparison_operator: str | None = None
    buffer_warning_pct: float | None = None
    severity_if_breached: str | None = None
    regulatory_body: str | None = None
    source_document: str | None = None
    effective_from: date | None = None
    effective_until: date | None = None
    priority: int | None = None
    is_active: bool | None = None


class ComplianceStandardResponse(BaseModel):
    """Response body for a compliance standard."""

    id: str
    standard_code: str
    category: str
    subcategory: str | None
    title: str
    description: str
    data_source: str
    data_query_config: dict[str, Any]
    threshold_type: str
    threshold_value: str
    comparison_operator: str
    buffer_warning_pct: float
    severity_if_breached: str
    regulatory_body: str
    source_document: str | None
    effective_from: date | None
    effective_until: date | None
    is_active: bool
    priority: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ComplianceAlertResponse(BaseModel):
    """Response body for a compliance alert."""

    id: str
    standard_id: str | None
    standard_code: str | None = None
    severity: str
    category: str
    title: str
    details: str
    current_value: str | None
    threshold_value: str | None
    gap_description: str | None
    recommended_action: str | None
    deadline: date | None
    auto_escalation_date: date | None
    status: str
    acknowledged_by: str | None
    acknowledged_at: datetime | None
    resolved_by: str | None
    resolved_at: datetime | None
    resolution_notes: str | None
    created_at: datetime


class AlertResolveRequest(BaseModel):
    """Request body for resolving a compliance alert."""

    resolution_notes: str = Field(..., min_length=1, max_length=5000)


class ComplianceSnapshotResponse(BaseModel):
    """Response body for a compliance check snapshot."""

    id: str
    snapshot_date: date
    snapshot_type: str
    overall_status: str
    standards_checked: int
    standards_compliant: int
    standards_at_risk: int
    standards_breached: int
    department_statuses: dict[str, Any] | None
    check_results: list[dict[str, Any]] | None
    data_gaps: list[dict[str, Any]] | None
    approved_by: str | None
    approved_at: datetime | None
    created_at: datetime


class ComplianceDashboardResponse(BaseModel):
    """Response for the compliance AI dashboard."""

    overall_status: str
    standards_checked: int
    standards_compliant: int
    standards_at_risk: int
    standards_breached: int
    data_gaps_count: int
    active_alerts: list[ComplianceAlertResponse]
    latest_snapshot_date: date | None
    compliance_pct: float


class DataSourceStatus(BaseModel):
    """Status of a registered data source fetcher."""

    source_type: str
    registered: bool
    status: str = Field(
        description="available, not_implemented, error",
    )
    message: str | None = None
    last_tested_at: datetime | None = None
