"""Platform Admin — Public Interface.

Platform-level models and utilities for B2B licensing,
usage tracking, audit logging, system health, and alerts.

These tables are NOT tenant-scoped (no RLS).
Managed exclusively by Acolyte platform admins.
"""

from app.platform.ai_budget_bridge import AIBudgetLicenseBridge
from app.platform.license_middleware import (
    LicenseEnforcementMiddleware,
    invalidate_license_cache,
)
from app.platform.license_utils import LicenseUsageTracker
from app.platform.models import (
    License,
    LicenseUsageSnapshot,
    PlatformAlert,
    PlatformAuditLog,
    SystemHealthMetric,
)
from app.platform.plan_presets import PLAN_PRESETS, get_plan_tiers, get_preset

__all__ = [
    # Models
    "License",
    "LicenseUsageSnapshot",
    "PlatformAuditLog",
    "SystemHealthMetric",
    "PlatformAlert",
    # Middleware
    "LicenseEnforcementMiddleware",
    "invalidate_license_cache",
    # Utilities
    "LicenseUsageTracker",
    "AIBudgetLicenseBridge",
    # Plan presets
    "PLAN_PRESETS",
    "get_preset",
    "get_plan_tiers",
]
