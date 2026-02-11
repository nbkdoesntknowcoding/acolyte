"""Platform Admin — Pydantic Schemas.

Request/response schemas for license management, usage tracking,
and platform operations. Used by platform admin routes.
"""

from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# License schemas
# ---------------------------------------------------------------------------


class LicenseCreate(BaseModel):
    """Create a new license for a college."""

    model_config = ConfigDict(extra="forbid")

    college_id: UUID
    plan_tier: str = Field(
        description="pilot, starter, professional, enterprise",
    )
    plan_name: str | None = Field(
        default=None,
        description="Display name. Auto-generated from tier if omitted.",
    )

    # Feature access (overrides from plan presets if provided)
    enabled_engines: dict[str, bool] | None = None
    enabled_features: dict[str, bool] | None = None

    # Usage limits (overrides from plan presets if provided)
    max_students: int | None = None
    max_faculty: int | None = None
    max_storage_gb: float | None = None
    monthly_ai_token_budget: int | None = None

    # Billing
    billing_cycle: str = "annual"
    price_inr: int | None = None
    billing_email: str | None = None
    razorpay_subscription_id: str | None = None

    # Dates
    activated_at: datetime | None = None
    expires_at: datetime | None = None

    # Sales
    sales_contact: str | None = None
    notes: str | None = None


class LicenseUpdate(BaseModel):
    """Update an existing license. All fields optional."""

    model_config = ConfigDict(extra="forbid")

    plan_tier: str | None = None
    plan_name: str | None = None
    enabled_engines: dict[str, bool] | None = None
    enabled_features: dict[str, bool] | None = None
    max_students: int | None = None
    max_faculty: int | None = None
    max_storage_gb: float | None = None
    monthly_ai_token_budget: int | None = None
    billing_cycle: str | None = None
    price_inr: int | None = None
    billing_email: str | None = None
    razorpay_subscription_id: str | None = None
    status: str | None = None
    activated_at: datetime | None = None
    expires_at: datetime | None = None
    suspended_at: datetime | None = None
    suspension_reason: str | None = None
    sales_contact: str | None = None
    notes: str | None = None


class LicenseResponse(BaseModel):
    """License as returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    college_id: UUID
    plan_tier: str
    plan_name: str
    enabled_engines: dict[str, bool]
    enabled_features: dict[str, bool]
    max_students: int
    max_faculty: int
    max_storage_gb: float
    monthly_ai_token_budget: int
    billing_cycle: str
    price_inr: int | None
    billing_email: str | None
    razorpay_subscription_id: str | None
    status: str
    activated_at: datetime | None
    expires_at: datetime | None
    suspended_at: datetime | None
    suspension_reason: str | None
    sales_contact: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
    created_by: UUID | None


# ---------------------------------------------------------------------------
# License cache model (for Redis serialization)
# ---------------------------------------------------------------------------


class CachedLicense(BaseModel):
    """Lightweight license data cached in Redis for middleware checks."""

    model_config = ConfigDict(extra="forbid")

    id: UUID
    college_id: UUID
    plan_tier: str
    status: str
    enabled_engines: dict[str, bool]
    enabled_features: dict[str, bool]
    max_students: int
    max_faculty: int
    max_storage_gb: float
    monthly_ai_token_budget: int
    expires_at: datetime | None


# ---------------------------------------------------------------------------
# Usage limit schemas
# ---------------------------------------------------------------------------


class UsageLimitResult(BaseModel):
    """Result of a usage limit check."""

    allowed: bool
    current: int | float
    limit: int | float
    pct: float = Field(description="Current usage as percentage of limit (0-100)")
    message: str | None = None


class UsageSummary(BaseModel):
    """Complete usage vs limits summary for dashboard display."""

    students: UsageLimitResult
    faculty: UsageLimitResult
    ai_budget: UsageLimitResult
    storage: UsageLimitResult
    features: dict[str, Any] = Field(
        description='{"enabled": [...], "disabled": [...]}',
    )


# ---------------------------------------------------------------------------
# Platform alert schema
# ---------------------------------------------------------------------------


class PlatformAlertResponse(BaseModel):
    """Platform alert as returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    severity: str
    category: str
    title: str
    details: str
    college_id: UUID | None
    license_id: UUID | None
    source_component: str | None
    trigger_data: dict[str, Any] | None
    status: str
    acknowledged_by: UUID | None
    acknowledged_at: datetime | None
    resolved_by: UUID | None
    resolved_at: datetime | None
    resolution_notes: str | None
    created_at: datetime


# ---------------------------------------------------------------------------
# License usage snapshot schema
# ---------------------------------------------------------------------------


class LicenseUsageSnapshotResponse(BaseModel):
    """Daily usage snapshot as returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    license_id: UUID
    snapshot_date: date
    active_students: int
    active_faculty: int
    total_users: int
    ai_tokens_used: int
    ai_tokens_month_to_date: int
    ai_requests_count: int
    storage_used_gb: float
    api_requests_count: int
    feature_usage: dict[str, Any] | None
    created_at: datetime
