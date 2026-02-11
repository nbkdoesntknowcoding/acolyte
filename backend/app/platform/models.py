"""Platform Admin — SQLAlchemy Models.

Platform-level tables that are NOT tenant-scoped (no college_id, no RLS).
Managed exclusively by Acolyte platform admins (Nischay's team).

Models:
  - License — B2B college license (plan tier, feature flags, usage limits, billing)
  - LicenseUsageSnapshot — Daily usage metrics per license
  - PlatformAuditLog — Platform-level audit trail (not per-college)
  - SystemHealthMetric — System health & performance metrics
  - PlatformAlert — Platform-level operational alerts
"""

import uuid

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.shared.models import Base


# ---------------------------------------------------------------------------
# 1. License — core B2B commercial entity
# ---------------------------------------------------------------------------


class License(Base):
    """B2B college license. One license per college.

    NOT tenant-scoped — this is a platform admin table.
    The License controls what features a college can access,
    how many users/AI tokens they get, and billing status.

    Plan tiers: pilot → starter → professional → enterprise
    """
    __tablename__ = "licenses"
    __table_args__ = (
        Index("ix_lic_college_id", "college_id", unique=True),
        Index("ix_lic_status", "status"),
        Index("ix_lic_plan_status", "plan_tier", "status"),
        Index("ix_lic_expires", "expires_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Link to college (1:1)
    college_id = Column(
        UUID(as_uuid=True),
        ForeignKey("colleges.id"),
        nullable=False,
        unique=True,
        comment="One license per college",
    )

    # Plan info
    plan_tier = Column(
        String(30), nullable=False,
        comment="pilot, starter, professional, enterprise",
    )
    plan_name = Column(
        String(100), nullable=False,
        comment="Display name e.g. 'Professional Plan'",
    )

    # Feature access
    enabled_engines = Column(
        JSONB, nullable=False,
        server_default=text("'[]'::jsonb"),
        comment='["student","faculty","compliance","admin","integration","ai"]',
    )
    enabled_features = Column(
        JSONB, nullable=False,
        server_default=text("'{}'::jsonb"),
        comment='{"socratic_tutor": true, "saf_generator": true, "mcq_generator": false}',
    )

    # Usage limits
    max_students = Column(
        Integer, nullable=False,
        comment="Maximum student accounts",
    )
    max_faculty = Column(
        Integer, nullable=False,
        comment="Maximum faculty accounts",
    )
    max_storage_gb = Column(
        Float, nullable=False,
        comment="Maximum R2 storage in GB",
    )
    monthly_ai_token_budget = Column(
        Integer, nullable=False,
        comment="Monthly AI token budget (in thousands)",
    )

    # Billing
    billing_cycle = Column(
        String(20), nullable=False, server_default="annual",
        comment="monthly, quarterly, annual",
    )
    price_inr = Column(
        Integer, nullable=True,
        comment="Annual price in INR (paise)",
    )
    billing_email = Column(String(255), nullable=True)
    razorpay_subscription_id = Column(
        String(100), nullable=True,
        comment="Razorpay subscription ID for auto-billing",
    )

    # Status
    status = Column(
        String(20), nullable=False, server_default="active",
        comment="active, suspended, expired, cancelled, trial",
    )
    activated_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    suspended_at = Column(DateTime(timezone=True), nullable=True)
    suspension_reason = Column(String(500), nullable=True)

    # Sales info
    sales_contact = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)

    # Audit
    created_at = Column(
        DateTime(timezone=True),
        server_default=text("NOW()"),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=text("NOW()"),
        nullable=False,
    )
    created_by = Column(
        UUID(as_uuid=True), nullable=True,
        comment="Platform admin who created this license",
    )


# ---------------------------------------------------------------------------
# 2. LicenseUsageSnapshot — daily usage tracking per license
# ---------------------------------------------------------------------------


class LicenseUsageSnapshot(Base):
    """Daily usage snapshot per license.

    NOT tenant-scoped — platform admin analytics.
    Captured by a daily Celery task for billing & monitoring.
    """
    __tablename__ = "license_usage_snapshots"
    __table_args__ = (
        UniqueConstraint(
            "license_id", "snapshot_date",
            name="uq_license_usage_snapshot",
        ),
        Index("ix_lus_license_date", "license_id", "snapshot_date"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    license_id = Column(
        UUID(as_uuid=True),
        ForeignKey("licenses.id"),
        nullable=False,
    )
    snapshot_date = Column(Date, nullable=False)

    # User counts
    active_students = Column(Integer, nullable=False, server_default=text("0"))
    active_faculty = Column(Integer, nullable=False, server_default=text("0"))
    total_users = Column(Integer, nullable=False, server_default=text("0"))

    # AI usage
    ai_tokens_used = Column(
        Integer, nullable=False, server_default=text("0"),
        comment="AI tokens used today (in thousands)",
    )
    ai_tokens_month_to_date = Column(
        Integer, nullable=False, server_default=text("0"),
        comment="Cumulative AI tokens this billing month",
    )
    ai_requests_count = Column(
        Integer, nullable=False, server_default=text("0"),
        comment="Number of AI API calls today",
    )

    # Storage
    storage_used_gb = Column(
        Float, nullable=False, server_default=text("0"),
        comment="Current R2 storage usage in GB",
    )

    # API usage
    api_requests_count = Column(
        Integer, nullable=False, server_default=text("0"),
        comment="Total API requests today",
    )

    # Feature usage breakdown
    feature_usage = Column(
        JSONB, nullable=True,
        comment='{"socratic_tutor": 142, "mcq_generator": 38, "flashcards": 210}',
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=text("NOW()"),
        nullable=False,
    )


# ---------------------------------------------------------------------------
# 3. PlatformAuditLog — platform-level audit trail
# ---------------------------------------------------------------------------


class PlatformAuditLog(Base):
    """Platform-level audit log. NOT tenant-scoped.

    Tracks platform admin actions: license changes, suspensions,
    system config changes, manual overrides, etc.

    Separate from the tenant-scoped AuditLog in shared/models.py.
    """
    __tablename__ = "platform_audit_log"
    __table_args__ = (
        Index("ix_pal_actor_created", "actor_id", "created_at"),
        Index("ix_pal_action_created", "action", "created_at"),
        Index("ix_pal_entity", "entity_type", "entity_id"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Who did it
    actor_id = Column(
        UUID(as_uuid=True), nullable=False,
        comment="Platform admin user_id (Clerk)",
    )
    actor_email = Column(String(255), nullable=True)

    # What happened
    action = Column(
        String(50), nullable=False,
        comment="license.create, license.suspend, config.update, alert.resolve, etc.",
    )
    entity_type = Column(
        String(50), nullable=False,
        comment="license, college, system_config, alert, etc.",
    )
    entity_id = Column(
        UUID(as_uuid=True), nullable=True,
        comment="ID of the affected entity",
    )

    # Details
    changes = Column(
        JSONB, nullable=True,
        comment='{"field": {"old": "value", "new": "value"}}',
    )
    metadata_ = Column(
        "metadata", JSONB, nullable=True,
        comment="Additional context (IP address, user agent, etc.)",
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=text("NOW()"),
        nullable=False,
    )


# ---------------------------------------------------------------------------
# 4. SystemHealthMetric — system health & performance
# ---------------------------------------------------------------------------


class SystemHealthMetric(Base):
    """System health and performance metrics.

    NOT tenant-scoped — tracks platform-wide health.
    Populated by health check tasks (every 5 minutes).
    """
    __tablename__ = "system_health_metrics"
    __table_args__ = (
        Index("ix_shm_component_recorded", "component", "recorded_at"),
        Index("ix_shm_status", "status"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # What component
    component = Column(
        String(50), nullable=False,
        comment="api, database, redis, ai_gateway, permify, r2, celery",
    )
    metric_name = Column(
        String(100), nullable=False,
        comment="response_time_ms, error_rate, queue_depth, connection_count, etc.",
    )

    # Values
    value = Column(Float, nullable=False)
    unit = Column(
        String(20), nullable=True,
        comment="ms, percent, count, gb, etc.",
    )
    status = Column(
        String(20), nullable=False, server_default="healthy",
        comment="healthy, degraded, unhealthy, critical",
    )

    # Context
    details = Column(
        JSONB, nullable=True,
        comment="Additional metric details or breakdown",
    )

    recorded_at = Column(
        DateTime(timezone=True),
        server_default=text("NOW()"),
        nullable=False,
    )


# ---------------------------------------------------------------------------
# 5. PlatformAlert — operational alerts
# ---------------------------------------------------------------------------


class PlatformAlert(Base):
    """Platform-level operational alerts.

    NOT tenant-scoped — for Acolyte ops team.
    Triggered by: license expiry, usage limits, system health,
    billing failures, security events, etc.
    """
    __tablename__ = "platform_alerts"
    __table_args__ = (
        Index("ix_pa_severity_status", "severity", "status"),
        Index("ix_pa_category_status", "category", "status"),
        Index("ix_pa_created", "created_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Classification
    severity = Column(
        String(10), nullable=False,
        comment="info, warning, error, critical",
    )
    category = Column(
        String(50), nullable=False,
        comment="license, billing, usage, health, security",
    )
    title = Column(String(500), nullable=False)
    details = Column(Text, nullable=False)

    # Context
    college_id = Column(
        UUID(as_uuid=True), nullable=True,
        comment="Related college (null for system-wide alerts)",
    )
    license_id = Column(
        UUID(as_uuid=True),
        ForeignKey("licenses.id"),
        nullable=True,
    )
    source_component = Column(
        String(50), nullable=True,
        comment="Which component triggered this alert",
    )
    trigger_data = Column(
        JSONB, nullable=True,
        comment="Data that triggered the alert",
    )

    # Status lifecycle
    status = Column(
        String(20), nullable=False, server_default="active",
        comment="active, acknowledged, resolved, dismissed",
    )
    acknowledged_by = Column(UUID(as_uuid=True), nullable=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by = Column(UUID(as_uuid=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolution_notes = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=text("NOW()"),
        nullable=False,
    )
