"""Platform Admin — Router-specific Pydantic schemas.

Request/response schemas for the platform admin API router.
Supplements the base schemas in platform/schemas.py.
"""

from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.platform.schemas import LicenseResponse


# ---------------------------------------------------------------------------
# License creation (platform admin flow — creates college + license)
# ---------------------------------------------------------------------------


class PlatformLicenseCreateRequest(BaseModel):
    """Create a new license and optionally a college record.

    If ``college_id`` is provided, attaches to an existing college.
    Otherwise, creates a new college from ``college_name`` / ``college_code``.
    """

    model_config = ConfigDict(extra="forbid")

    # College (provide college_id for existing, or name/code for new)
    college_id: UUID | None = Field(
        default=None,
        description="Existing college UUID. If omitted, a new college is created.",
    )
    college_name: str | None = Field(
        default=None,
        description="Required if college_id is not provided.",
    )
    college_code: str | None = None
    state: str | None = None
    university: str | None = None
    total_intake: int | None = None

    # License
    plan_tier: str = Field(
        description="pilot | starter | professional | enterprise",
    )
    billing_cycle: str = "annual"
    contract_start_date: date | None = None
    contract_end_date: date | None = None
    contract_value_inr: int | None = None
    sales_contact: str | None = None
    notes: str | None = None

    # Custom overrides on top of plan presets
    custom_overrides: dict[str, Any] | None = Field(
        default=None,
        description=(
            "Override preset values: max_students, max_faculty, "
            "enabled_features, enabled_engines, max_storage_gb, "
            "monthly_ai_token_budget"
        ),
    )


class LicenseSuspendRequest(BaseModel):
    """Suspend a license."""

    reason: str = Field(min_length=1, max_length=500)


class LicenseTerminateRequest(BaseModel):
    """Permanently terminate a license."""

    reason: str = Field(min_length=1, max_length=500)


class LicenseRenewRequest(BaseModel):
    """Renew an expiring or expired license."""

    new_end_date: datetime
    new_contract_value_inr: int | None = None


class AlertResolveRequest(BaseModel):
    """Resolve a platform alert."""

    resolution_notes: str | None = None


# ---------------------------------------------------------------------------
# College onboarding
# ---------------------------------------------------------------------------


class DepartmentInput(BaseModel):
    """Department to create during onboarding."""

    name: str
    hod_name: str | None = None
    hod_email: str | None = None


class CollegeOnboardRequest(BaseModel):
    """Complete college onboarding in one call."""

    model_config = ConfigDict(extra="forbid")

    # College info
    college_name: str
    college_code: str
    state: str
    university: str
    total_intake: int = 100

    # License
    plan_tier: str
    billing_cycle: str = "annual"
    contract_start_date: date
    contract_end_date: date
    contract_value_inr: int | None = None

    # Key contacts
    dean_name: str
    dean_email: str
    dean_phone: str | None = None
    admin_name: str
    admin_email: str

    # Departments
    departments: list[DepartmentInput] = []

    # Optional counts for capacity planning
    initial_student_count: int | None = None
    initial_faculty_count: int | None = None


class OnboardingResponse(BaseModel):
    """Result of college onboarding."""

    license_id: UUID
    college_id: UUID
    college_code: str
    plan_tier: str
    onboarding_status: str = "in_progress"
    departments_created: int = 0
    invite_links: dict[str, str | None] = Field(
        default_factory=dict,
        description="Clerk invite links for dean and admin (when Clerk integration is ready)",
    )


class OnboardingStatusEntry(BaseModel):
    """Single college's onboarding status."""

    college_id: UUID
    college_name: str
    plan_tier: str
    status: str
    created_at: datetime
    days_since_created: int
    is_stalled: bool = False


# ---------------------------------------------------------------------------
# System health
# ---------------------------------------------------------------------------


class ComponentHealth(BaseModel):
    """Health status for a single system component."""

    status: str = Field(description="healthy | degraded | unhealthy | critical")
    details: dict[str, Any] = Field(default_factory=dict)


class HealthOverviewResponse(BaseModel):
    """System-wide health dashboard data."""

    system_status: str
    components: dict[str, ComponentHealth]
    active_alerts: int
    total_active_licenses: int
    total_active_users_today: int


class MetricPoint(BaseModel):
    """Single time-series data point."""

    timestamp: datetime
    value: float


class AICostByCollege(BaseModel):
    college_id: UUID
    college_name: str
    cost_usd: float
    budget_usd: float
    pct_used: float


class AICostByModel(BaseModel):
    model: str
    cost_usd: float
    token_count: int


class AICostByAgent(BaseModel):
    agent_id: str
    cost_usd: float
    call_count: int


class AICostBreakdownResponse(BaseModel):
    """AI cost breakdown across all colleges."""

    total_cost_today_usd: float
    total_cost_this_month_usd: float
    by_college: list[AICostByCollege]
    by_model: list[AICostByModel]
    by_agent: list[AICostByAgent]
    cache_savings_usd: float
    projected_monthly_cost_usd: float


# ---------------------------------------------------------------------------
# Cross-tenant analytics
# ---------------------------------------------------------------------------


class ChurnRiskCollege(BaseModel):
    college_id: UUID
    name: str
    reason: str


class EngagedCollege(BaseModel):
    college_id: UUID
    name: str
    dau: int
    feature_usage: dict[str, int] = Field(default_factory=dict)


class LeastEngagedCollege(BaseModel):
    college_id: UUID
    name: str
    last_active: datetime | None


class AnalyticsOverviewResponse(BaseModel):
    """Platform-wide business metrics."""

    total_licenses: int
    active_licenses: int
    total_students: int
    total_faculty: int
    total_ai_calls_today: int
    mrr_inr: float
    licenses_expiring_30_days: int
    churn_risk_colleges: list[ChurnRiskCollege]
    top_engaged_colleges: list[EngagedCollege]
    least_engaged_colleges: list[LeastEngagedCollege]


class FeatureAdoptionItem(BaseModel):
    """Adoption data for a single feature."""

    feature: str
    enabled_count: int
    active_users: int
    calls_per_day: float


class FeatureAdoptionResponse(BaseModel):
    """Feature adoption across all colleges."""

    features: list[FeatureAdoptionItem]


class CollegeAnalyticsResponse(BaseModel):
    """Deep dive into a single college's usage."""

    college_id: UUID
    college_name: str
    license: dict[str, Any] | None
    usage: dict[str, Any]
    ai_costs: dict[str, Any]
    feature_adoption: dict[str, Any]


# ---------------------------------------------------------------------------
# Paginated response wrapper
# ---------------------------------------------------------------------------


class PaginatedResponse(BaseModel):
    """Generic paginated response."""

    items: list[Any]
    total: int
    page: int
    per_page: int
    pages: int


# ---------------------------------------------------------------------------
# Data source status (for health/ai-costs)
# ---------------------------------------------------------------------------


class DataSourceStatus(BaseModel):
    """Status of a registered data source."""

    source_type: str
    status: str
    last_checked: datetime | None = None
    message: str | None = None


# ---------------------------------------------------------------------------
# License list item (enriched with college name + usage snapshot)
# ---------------------------------------------------------------------------


class LicenseListItem(LicenseResponse):
    """License enriched with college name and latest usage snapshot data.

    Used by the ``GET /licenses`` list endpoint to include context
    that would otherwise require separate API calls.
    """

    college_name: str | None = None
    current_students: int = 0
    current_faculty: int = 0
    ai_tokens_month_to_date: int = 0
    storage_used_gb_current: float = 0


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------


class AuditLogEntryResponse(BaseModel):
    """Platform audit log entry as returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    actor_id: UUID
    actor_email: str | None
    action: str
    entity_type: str
    entity_id: UUID | None
    changes: dict[str, Any] | None
    created_at: datetime
