"""Platform Admin Router — Nischay's God Mode.

``/platform/*`` endpoints for managing the B2B platform: licenses,
colleges, system health, cross-tenant analytics, and alerts.

Requires platform admin authentication (Acolyte team only).
NOT accessible to college-level admins.
"""

import asyncio
import json
import logging
import math
import uuid as uuid_mod
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import delete, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.platform.dependencies import (
    PlatformAdminUser,
    get_platform_db,
    require_platform_admin,
)
from app.platform.models import (
    License,
    LicenseUsageSnapshot,
    PlatformAlert,
    PlatformAuditLog,
    SystemHealthMetric,
)
from app.platform.plan_presets import PLAN_PRESETS, get_preset
from app.config import get_settings
from app.platform.router_schemas import (
    AICostBreakdownResponse,
    AICostByAgent,
    AICostByCollege,
    AICostByModel,
    AlertResolveRequest,
    AnalyticsOverviewResponse,
    AuditLogEntryResponse,
    ChurnRiskCollege,
    CollegeAnalyticsResponse,
    CollegeOnboardRequest,
    ComponentHealth,
    EngagedCollege,
    FeatureAdoptionItem,
    FeatureAdoptionResponse,
    HealthOverviewResponse,
    LeastEngagedCollege,
    LicenseListItem,
    LicenseRenewRequest,
    LicenseSuspendRequest,
    LicenseTerminateRequest,
    MetricPoint,
    OnboardingResponse,
    OnboardingStatusEntry,
    PaginatedResponse,
    PlatformLicenseCreateRequest,
)
from app.platform.schemas import (
    LicenseResponse,
    LicenseUpdate,
    LicenseUsageSnapshotResponse,
    PlatformAlertResponse,
    UsageSummary,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Platform Admin"])


# ===================================================================
# LICENSE MANAGEMENT
# ===================================================================


@router.post("/licenses", response_model=LicenseResponse, status_code=201)
async def create_license(
    payload: PlatformLicenseCreateRequest,
    admin: PlatformAdminUser = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_platform_db),
):
    """Create a new license for a college.

    If ``college_id`` is provided, attaches to an existing college.
    Otherwise, creates a new College record from ``college_name``.
    Loads defaults from plan presets, then applies ``custom_overrides``.
    """
    # Validate plan tier
    if payload.plan_tier not in PLAN_PRESETS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown plan tier '{payload.plan_tier}'. "
            f"Valid tiers: {list(PLAN_PRESETS.keys())}",
        )

    preset = get_preset(payload.plan_tier)
    overrides = payload.custom_overrides or {}

    # Resolve or create college
    college_id = payload.college_id
    if college_id is not None:
        # Verify college exists
        from app.engines.admin.models import College

        result = await db.execute(
            select(College).where(College.id == college_id)
        )
        college = result.scalar_one_or_none()
        if college is None:
            raise HTTPException(404, f"College {college_id} not found")

        # Check no existing license
        existing = await db.execute(
            select(License).where(License.college_id == college_id)
        )
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(409, "This college already has a license")
    else:
        # Create new college
        if not payload.college_name:
            raise HTTPException(
                400, "college_name is required when college_id is not provided"
            )

        from app.engines.admin.models import College

        college_code = payload.college_code or _generate_college_code(
            payload.college_name
        )

        # Check code uniqueness
        existing_code = await db.execute(
            select(College).where(College.code == college_code)
        )
        if existing_code.scalar_one_or_none() is not None:
            raise HTTPException(
                409,
                f"College with code '{college_code}' already exists",
            )

        college = College(
            name=payload.college_name,
            code=college_code,
            state=payload.state or "—",
            university_affiliation=payload.university,
            total_intake=payload.total_intake or preset["max_students"],
        )
        db.add(college)
        await db.flush()
        college_id = college.id

    # Build license from preset + overrides
    license_obj = License(
        college_id=college_id,
        plan_tier=payload.plan_tier,
        plan_name=preset.get("plan_name", f"{payload.plan_tier.title()} Plan"),
        enabled_engines=overrides.get("enabled_engines", preset["enabled_engines"]),
        enabled_features=overrides.get(
            "enabled_features", preset["enabled_features"]
        ),
        max_students=overrides.get("max_students", preset["max_students"]),
        max_faculty=overrides.get("max_faculty", preset["max_faculty"]),
        max_storage_gb=overrides.get("max_storage_gb", preset["max_storage_gb"]),
        monthly_ai_token_budget=overrides.get(
            "monthly_ai_token_budget", preset["monthly_ai_token_budget"]
        ),
        billing_cycle=payload.billing_cycle,
        price_inr=payload.contract_value_inr,
        sales_contact=payload.sales_contact,
        notes=payload.notes,
        status="active",
        activated_at=datetime.now(timezone.utc),
        created_by=admin.actor_uuid,
    )

    if payload.contract_end_date:
        license_obj.expires_at = datetime.combine(
            payload.contract_end_date, datetime.min.time(), tzinfo=timezone.utc
        )

    db.add(license_obj)
    await db.flush()

    # Audit log
    await _audit_log(
        db,
        actor=admin,
        action="license.create",
        entity_type="license",
        entity_id=license_obj.id,
        changes={"plan_tier": payload.plan_tier, "college_id": str(college_id)},
    )

    await db.flush()
    return LicenseResponse.model_validate(license_obj)


@router.get("/licenses")
async def list_licenses(
    admin: PlatformAdminUser = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_platform_db),
    status_filter: str | None = Query(None, alias="status"),
    plan_tier: str | None = Query(None),
    state: str | None = Query(None),
    search: str | None = Query(None, description="Search by college name or code"),
    expiring_within_days: int | None = Query(None),
    sort_by: str | None = Query("created_at", description="created_at | plan_tier | status"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
) -> PaginatedResponse:
    """List all licenses with filtering, search, and pagination.

    Enriched with college name and latest usage snapshot data
    (current_students, current_faculty, ai_tokens_month_to_date).
    """
    from app.engines.admin.models import College

    # Always join College for name enrichment
    query = (
        select(License, College.name.label("college_name"))
        .join(College, License.college_id == College.id, isouter=True)
    )
    count_query = select(func.count(License.id))

    # Filters
    conditions = []
    if status_filter:
        conditions.append(License.status == status_filter)
    if plan_tier:
        conditions.append(License.plan_tier == plan_tier)
    if expiring_within_days:
        now = datetime.now(timezone.utc)
        cutoff = now + timedelta(days=expiring_within_days)
        conditions.append(License.expires_at.isnot(None))
        conditions.append(License.expires_at <= cutoff)
        conditions.append(License.expires_at > now)

    # Search and state need College join in count query
    if search or state:
        count_query = count_query.join(College, License.college_id == College.id)
        if search:
            search_term = f"%{search}%"
            conditions.append(
                or_(
                    College.name.ilike(search_term),
                    College.code.ilike(search_term),
                )
            )
        if state:
            conditions.append(College.state == state)

    for cond in conditions:
        query = query.where(cond)
        count_query = count_query.where(cond)

    # Total count
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Sort
    sort_col = {
        "created_at": License.created_at,
        "plan_tier": License.plan_tier,
        "status": License.status,
        "expires_at": License.expires_at,
    }.get(sort_by, License.created_at)
    query = query.order_by(sort_col.desc())

    # Paginate
    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page)

    result = await db.execute(query)
    rows = result.all()  # [(License, college_name), ...]

    # Batch-fetch latest snapshot per license for usage enrichment
    license_ids = [row[0].id for row in rows]
    snapshots_by_license: dict[UUID, LicenseUsageSnapshot] = {}
    if license_ids:
        latest_sub = (
            select(
                LicenseUsageSnapshot.license_id,
                func.max(LicenseUsageSnapshot.snapshot_date).label("max_date"),
            )
            .where(LicenseUsageSnapshot.license_id.in_(license_ids))
            .group_by(LicenseUsageSnapshot.license_id)
            .subquery()
        )
        snap_result = await db.execute(
            select(LicenseUsageSnapshot).join(
                latest_sub,
                (LicenseUsageSnapshot.license_id == latest_sub.c.license_id)
                & (LicenseUsageSnapshot.snapshot_date == latest_sub.c.max_date),
            )
        )
        snapshots_by_license = {
            s.license_id: s for s in snap_result.scalars().all()
        }

    # Build enriched items
    items = []
    for lic, college_name in rows:
        snap = snapshots_by_license.get(lic.id)
        base = LicenseResponse.model_validate(lic)
        item = LicenseListItem(
            **base.model_dump(),
            college_name=college_name or "Unknown",
            current_students=snap.active_students if snap else 0,
            current_faculty=snap.active_faculty if snap else 0,
            ai_tokens_month_to_date=snap.ai_tokens_month_to_date if snap else 0,
            storage_used_gb_current=snap.storage_used_gb if snap else 0,
        )
        items.append(item)

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=max(1, math.ceil(total / per_page)),
    )


@router.get("/licenses/{license_id}")
async def get_license_detail(
    license_id: UUID,
    admin: PlatformAdminUser = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_platform_db),
) -> dict[str, Any]:
    """Full license details with current usage and history."""
    license_obj = await _get_license_or_404(db, license_id)

    # Current usage
    from app.platform.license_utils import LicenseUsageTracker

    tracker = LicenseUsageTracker(db)
    usage = await tracker.get_usage_summary(license_obj.college_id)

    # Last 30 days of snapshots
    thirty_days_ago = date.today() - timedelta(days=30)
    snapshot_result = await db.execute(
        select(LicenseUsageSnapshot)
        .where(
            LicenseUsageSnapshot.license_id == license_id,
            LicenseUsageSnapshot.snapshot_date >= thirty_days_ago,
        )
        .order_by(LicenseUsageSnapshot.snapshot_date.desc())
    )
    snapshots = snapshot_result.scalars().all()

    # Active alerts for this college
    alert_result = await db.execute(
        select(PlatformAlert)
        .where(
            PlatformAlert.college_id == license_obj.college_id,
            PlatformAlert.status == "active",
        )
        .order_by(PlatformAlert.created_at.desc())
    )
    alerts = alert_result.scalars().all()

    return {
        "license": LicenseResponse.model_validate(license_obj),
        "usage": usage.model_dump(),
        "snapshots": [
            LicenseUsageSnapshotResponse.model_validate(s) for s in snapshots
        ],
        "active_alerts": [
            PlatformAlertResponse.model_validate(a) for a in alerts
        ],
    }


@router.put("/licenses/{license_id}", response_model=LicenseResponse)
async def update_license(
    license_id: UUID,
    payload: LicenseUpdate,
    admin: PlatformAdminUser = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_platform_db),
    request: Request = None,
):
    """Update a license (upgrade/downgrade, change limits, toggle features)."""
    license_obj = await _get_license_or_404(db, license_id)

    # Record previous state for audit
    previous = {
        field: getattr(license_obj, field)
        for field in payload.model_fields_set
        if hasattr(license_obj, field)
    }

    # Apply changes
    update_data = payload.model_dump(exclude_unset=True)
    warnings = []

    for field, value in update_data.items():
        if hasattr(license_obj, field):
            # Check if disabling features
            if field == "enabled_features" and isinstance(value, dict):
                for feat, enabled in value.items():
                    old_val = (license_obj.enabled_features or {}).get(feat)
                    if old_val is True and enabled is False:
                        warnings.append(
                            f"Disabling feature '{feat}' — active users will lose access"
                        )
            setattr(license_obj, field, value)

    license_obj.updated_at = datetime.now(timezone.utc)

    # Invalidate Redis cache
    await _invalidate_cache(request, license_obj.college_id)

    # Audit log
    new_state = {
        field: getattr(license_obj, field)
        for field in payload.model_fields_set
        if hasattr(license_obj, field)
    }
    await _audit_log(
        db,
        actor=admin,
        action="license.update",
        entity_type="license",
        entity_id=license_id,
        changes={"previous": _serialize_dict(previous), "new": _serialize_dict(new_state)},
    )

    await db.flush()

    response = LicenseResponse.model_validate(license_obj)
    if warnings:
        return {"license": response, "warnings": warnings}
    return response


@router.post("/licenses/{license_id}/activate", response_model=LicenseResponse)
async def activate_license(
    license_id: UUID,
    admin: PlatformAdminUser = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_platform_db),
    request: Request = None,
):
    """Activate a draft or trial license."""
    license_obj = await _get_license_or_404(db, license_id)

    if license_obj.status == "active":
        raise HTTPException(400, "License is already active")

    license_obj.status = "active"
    license_obj.activated_at = datetime.now(timezone.utc)
    license_obj.updated_at = datetime.now(timezone.utc)

    await _invalidate_cache(request, license_obj.college_id)
    await _audit_log(
        db,
        actor=admin,
        action="license.activate",
        entity_type="license",
        entity_id=license_id,
        changes={"status": "active"},
    )
    await db.flush()
    return LicenseResponse.model_validate(license_obj)


@router.post("/licenses/{license_id}/suspend", response_model=LicenseResponse)
async def suspend_license(
    license_id: UUID,
    payload: LicenseSuspendRequest,
    admin: PlatformAdminUser = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_platform_db),
    request: Request = None,
):
    """Suspend a license (non-payment, violation, etc.).

    Does NOT delete data. College users see "Account suspended".
    """
    license_obj = await _get_license_or_404(db, license_id)

    if license_obj.status == "suspended":
        raise HTTPException(400, "License is already suspended")
    if license_obj.status == "terminated":
        raise HTTPException(400, "Cannot suspend a terminated license")

    license_obj.status = "suspended"
    license_obj.suspended_at = datetime.now(timezone.utc)
    license_obj.suspension_reason = payload.reason
    license_obj.updated_at = datetime.now(timezone.utc)

    await _invalidate_cache(request, license_obj.college_id)
    await _audit_log(
        db,
        actor=admin,
        action="license.suspend",
        entity_type="license",
        entity_id=license_id,
        changes={"status": "suspended", "reason": payload.reason},
    )
    await db.flush()
    return LicenseResponse.model_validate(license_obj)


@router.post("/licenses/{license_id}/reinstate", response_model=LicenseResponse)
async def reinstate_license(
    license_id: UUID,
    admin: PlatformAdminUser = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_platform_db),
    request: Request = None,
):
    """Reinstate a suspended license."""
    license_obj = await _get_license_or_404(db, license_id)

    if license_obj.status != "suspended":
        raise HTTPException(400, "Can only reinstate a suspended license")

    license_obj.status = "active"
    license_obj.suspended_at = None
    license_obj.suspension_reason = None
    license_obj.updated_at = datetime.now(timezone.utc)

    await _invalidate_cache(request, license_obj.college_id)
    await _audit_log(
        db,
        actor=admin,
        action="license.reinstate",
        entity_type="license",
        entity_id=license_id,
        changes={"status": "active", "reinstated": True},
    )
    await db.flush()
    return LicenseResponse.model_validate(license_obj)


@router.post("/licenses/{license_id}/terminate", response_model=LicenseResponse)
async def terminate_license(
    license_id: UUID,
    payload: LicenseTerminateRequest,
    admin: PlatformAdminUser = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_platform_db),
    request: Request = None,
):
    """Permanently terminate a license.

    Sets status to terminated. Data export should be scheduled separately
    (30-day window for college to retrieve their data).
    """
    license_obj = await _get_license_or_404(db, license_id)

    if license_obj.status == "terminated":
        raise HTTPException(400, "License is already terminated")

    license_obj.status = "terminated"
    license_obj.suspension_reason = payload.reason
    license_obj.updated_at = datetime.now(timezone.utc)

    await _invalidate_cache(request, license_obj.college_id)
    await _audit_log(
        db,
        actor=admin,
        action="license.terminate",
        entity_type="license",
        entity_id=license_id,
        changes={"status": "terminated", "reason": payload.reason},
    )
    await db.flush()

    # TODO: Schedule data export task for the college (30-day window)

    return LicenseResponse.model_validate(license_obj)


@router.post("/licenses/{license_id}/renew", response_model=LicenseResponse)
async def renew_license(
    license_id: UUID,
    payload: LicenseRenewRequest,
    admin: PlatformAdminUser = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_platform_db),
    request: Request = None,
):
    """Renew an expiring or expired license."""
    license_obj = await _get_license_or_404(db, license_id)

    previous_expires = license_obj.expires_at

    license_obj.expires_at = payload.new_end_date
    if payload.new_contract_value_inr is not None:
        license_obj.price_inr = payload.new_contract_value_inr
    if license_obj.status == "expired":
        license_obj.status = "active"
    license_obj.updated_at = datetime.now(timezone.utc)

    await _invalidate_cache(request, license_obj.college_id)
    await _audit_log(
        db,
        actor=admin,
        action="license.renew",
        entity_type="license",
        entity_id=license_id,
        changes={
            "previous_expires": previous_expires.isoformat() if previous_expires else None,
            "new_expires": payload.new_end_date.isoformat(),
        },
    )
    await db.flush()
    return LicenseResponse.model_validate(license_obj)


# ===================================================================
# COLLEGE ONBOARDING
# ===================================================================


@router.post("/onboard-college", response_model=OnboardingResponse, status_code=201)
async def onboard_college(
    payload: CollegeOnboardRequest,
    admin: PlatformAdminUser = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_platform_db),
    request: Request = None,
):
    """Complete college onboarding in one call.

    Creates: College, License, AIBudget, Departments.
    TODO: Clerk organization, dean/admin invites, Permify relationships.
    """
    from app.engines.admin.models import College, Department

    # Validate plan tier
    if payload.plan_tier not in PLAN_PRESETS:
        raise HTTPException(
            400,
            f"Unknown plan tier '{payload.plan_tier}'. "
            f"Valid: {list(PLAN_PRESETS.keys())}",
        )

    # Check code uniqueness
    existing = await db.execute(
        select(College).where(College.code == payload.college_code)
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            409,
            f"College with code '{payload.college_code}' already exists",
        )

    preset = get_preset(payload.plan_tier)

    # 1. Create College
    college = College(
        name=payload.college_name,
        code=payload.college_code,
        state=payload.state,
        university_affiliation=payload.university,
        total_intake=payload.total_intake,
    )
    db.add(college)
    await db.flush()

    # 2. Create License
    license_obj = License(
        college_id=college.id,
        plan_tier=payload.plan_tier,
        plan_name=preset["plan_name"],
        enabled_engines=preset["enabled_engines"],
        enabled_features=preset["enabled_features"],
        max_students=preset["max_students"],
        max_faculty=preset["max_faculty"],
        max_storage_gb=preset["max_storage_gb"],
        monthly_ai_token_budget=preset["monthly_ai_token_budget"],
        billing_cycle=payload.billing_cycle,
        price_inr=payload.contract_value_inr,
        status="active",
        activated_at=datetime.now(timezone.utc),
        expires_at=datetime.combine(
            payload.contract_end_date,
            datetime.min.time(),
            tzinfo=timezone.utc,
        ),
        notes=(
            f"Onboarded by {admin.full_name or admin.user_id}. "
            f"Dean: {payload.dean_name} ({payload.dean_email}). "
            f"Admin: {payload.admin_name} ({payload.admin_email})."
        ),
        created_by=admin.actor_uuid,
    )
    db.add(license_obj)
    await db.flush()

    # 3. TODO: Create Clerk organization and invite dean + admin
    # clerk_org_id = await create_clerk_organization(college)
    # dean_invite = await invite_to_clerk_org(payload.dean_email, "org:dean")
    # admin_invite = await invite_to_clerk_org(payload.admin_email, "org:admin")
    invite_links: dict[str, str | None] = {
        "dean": None,  # Clerk invite link (when integrated)
        "admin": None,
    }

    # 4. TODO: Create Permify relationships
    # permify = request.app.state.permify
    # await permify.create_relationship("college", college.id, "dean", ...)

    # 5. Create AIBudget
    from app.platform.ai_budget_bridge import AIBudgetLicenseBridge

    bridge = AIBudgetLicenseBridge(db)
    await bridge.sync_budget_from_license(college.id)

    # 6. Create departments
    dept_count = 0
    for dept_input in payload.departments:
        dept = Department(
            college_id=college.id,
            name=dept_input.name,
        )
        db.add(dept)
        dept_count += 1

    await db.flush()

    # 7. Audit log
    await _audit_log(
        db,
        actor=admin,
        action="college.onboard",
        entity_type="college",
        entity_id=college.id,
        changes={
            "college_name": payload.college_name,
            "plan_tier": payload.plan_tier,
            "departments": [d.name for d in payload.departments],
            "dean_email": payload.dean_email,
            "admin_email": payload.admin_email,
        },
    )

    await db.flush()

    return OnboardingResponse(
        license_id=license_obj.id,
        college_id=college.id,
        college_code=payload.college_code,
        plan_tier=payload.plan_tier,
        onboarding_status="in_progress",
        departments_created=dept_count,
        invite_links=invite_links,
    )


@router.get("/onboarding-status")
async def onboarding_status(
    admin: PlatformAdminUser = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_platform_db),
) -> list[OnboardingStatusEntry]:
    """List all colleges by onboarding status.

    Highlights stalled onboardings (in_progress > 7 days).
    """
    from app.engines.admin.models import College

    result = await db.execute(
        select(License, College.name)
        .join(College, License.college_id == College.id)
        .order_by(License.created_at.desc())
    )
    rows = result.all()

    now = datetime.now(timezone.utc)
    entries = []
    for lic, college_name in rows:
        created_at = lic.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        days = (now - created_at).days
        entries.append(
            OnboardingStatusEntry(
                college_id=lic.college_id,
                college_name=college_name,
                plan_tier=lic.plan_tier,
                status=lic.status,
                created_at=lic.created_at,
                days_since_created=days,
                is_stalled=lic.status in ("trial",) and days > 7,
            )
        )

    return entries


# ===================================================================
# SYSTEM HEALTH
# ===================================================================


@router.get("/health/overview", response_model=HealthOverviewResponse)
async def health_overview(
    request: Request,
    admin: PlatformAdminUser = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_platform_db),
):
    """System-wide health dashboard data with live component checks.

    Performs real-time health probes for Database, Redis, Celery, and
    Permify. Components that aren't running return ``status="unavailable"``
    instead of crashing. AI Gateway status comes from stored metrics.
    """
    import asyncio

    components: dict[str, ComponentHealth] = {}

    # 1. Database — live check via SELECT 1 + connection count
    try:
        await db.execute(text("SELECT 1"))
        conn_result = await db.execute(
            text(
                "SELECT count(*) FROM pg_stat_activity "
                "WHERE datname = current_database()"
            )
        )
        conn_count = conn_result.scalar() or 0
        db_status = "healthy"
        if conn_count > 80:
            db_status = "critical"
        elif conn_count > 50:
            db_status = "degraded"
        components["database"] = ComponentHealth(
            status=db_status,
            details={"connections": conn_count, "message": "Connected"},
        )
    except Exception as exc:
        components["database"] = ComponentHealth(
            status="unhealthy",
            details={"error": str(exc)[:200]},
        )

    # 2. Redis — live PING + memory info
    try:
        from redis.asyncio import Redis as AIORedis

        settings = get_settings()
        redis_client = AIORedis.from_url(
            settings.REDIS_URL, socket_timeout=3, socket_connect_timeout=3
        )
        try:
            await redis_client.ping()
            info = await redis_client.info("memory")
            memory_mb = round(info.get("used_memory", 0) / (1024 * 1024), 2)
            components["redis"] = ComponentHealth(
                status="healthy",
                details={"memory_mb": memory_mb, "message": "PONG received"},
            )
        finally:
            await redis_client.aclose()
    except Exception:
        components["redis"] = ComponentHealth(
            status="unavailable",
            details={"message": "Redis not reachable"},
        )

    # 3. Celery — inspect workers via run_in_executor
    try:
        from app.core.celery_app import celery_app as _celery

        def _inspect_celery():
            inspector = _celery.control.inspect(timeout=3.0)
            return inspector.ping() or {}

        loop = asyncio.get_running_loop()
        ping_result = await loop.run_in_executor(None, _inspect_celery)
        worker_count = len(ping_result)
        if worker_count > 0:
            components["celery"] = ComponentHealth(
                status="healthy",
                details={"workers": worker_count},
            )
        else:
            components["celery"] = ComponentHealth(
                status="unavailable",
                details={"message": "No Celery workers responding"},
            )
    except Exception:
        components["celery"] = ComponentHealth(
            status="unavailable",
            details={"message": "Celery not running"},
        )

    # 4. AI Gateway — from latest stored metric (async-safe)
    ai_result = await db.execute(
        select(SystemHealthMetric)
        .where(
            SystemHealthMetric.component == "ai_gateway",
            SystemHealthMetric.metric_name == "overall_health",
        )
        .order_by(SystemHealthMetric.recorded_at.desc())
        .limit(1)
    )
    ai_metric = ai_result.scalar_one_or_none()
    if ai_metric:
        components["ai_gateway"] = ComponentHealth(
            status=ai_metric.status,
            details=ai_metric.details or {},
        )
    else:
        components["ai_gateway"] = ComponentHealth(
            status="unknown",
            details={"message": "No AI metrics collected yet"},
        )

    # 5. Permify — live health check
    permify = getattr(request.app.state, "permify", None)
    if permify:
        try:
            healthy = await permify.health_check()
            components["permify"] = ComponentHealth(
                status="healthy" if healthy else "unhealthy",
                details={"message": "Connected" if healthy else "Health check failed"},
            )
        except Exception:
            components["permify"] = ComponentHealth(
                status="unavailable",
                details={"message": "Permify health check failed"},
            )
    else:
        components["permify"] = ComponentHealth(
            status="unavailable",
            details={"message": "Permify client not initialized"},
        )

    # 6. API — always healthy (we're responding)
    components["api"] = ComponentHealth(
        status="healthy",
        details={"message": "Responding to requests"},
    )

    # Determine overall system status
    statuses = [c.status for c in components.values()]
    if "critical" in statuses or "unhealthy" in statuses:
        system_status = "critical"
    elif "degraded" in statuses or "unavailable" in statuses:
        system_status = "degraded"
    else:
        system_status = "healthy"

    # Active alerts count
    alert_count = await db.execute(
        select(func.count(PlatformAlert.id)).where(
            PlatformAlert.status == "active"
        )
    )
    active_alerts = alert_count.scalar() or 0

    # Active licenses
    lic_count = await db.execute(
        select(func.count(License.id)).where(License.status == "active")
    )
    total_active_licenses = lic_count.scalar() or 0

    # Active users today (from AgentExecution if available)
    total_active_users_today = 0
    try:
        from app.engines.ai.models import AgentExecution

        today_start = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        user_count = await db.execute(
            select(func.count(func.distinct(AgentExecution.user_id))).where(
                AgentExecution.started_at >= today_start,
            )
        )
        total_active_users_today = user_count.scalar() or 0
    except Exception:
        pass

    return HealthOverviewResponse(
        system_status=system_status,
        components=components,
        active_alerts=active_alerts,
        total_active_licenses=total_active_licenses,
        total_active_users_today=total_active_users_today,
    )


@router.get("/health/metrics")
async def health_metrics(
    admin: PlatformAdminUser = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_platform_db),
    component: str = Query(..., description="database | redis | celery | ai_gateway"),
    metric_name: str | None = Query(None),
    from_date: datetime | None = Query(None),
    to_date: datetime | None = Query(None),
    limit: int = Query(100, ge=1, le=1000),
) -> list[MetricPoint]:
    """Time-series metrics for charting."""
    query = select(
        SystemHealthMetric.recorded_at,
        SystemHealthMetric.value,
    ).where(
        SystemHealthMetric.component == component,
    )

    if metric_name:
        query = query.where(SystemHealthMetric.metric_name == metric_name)
    if from_date:
        query = query.where(SystemHealthMetric.recorded_at >= from_date)
    if to_date:
        query = query.where(SystemHealthMetric.recorded_at <= to_date)

    query = query.order_by(SystemHealthMetric.recorded_at.desc()).limit(limit)
    result = await db.execute(query)
    rows = result.all()

    return [MetricPoint(timestamp=ts, value=val) for ts, val in rows]


@router.get("/health/ai-costs", response_model=AICostBreakdownResponse)
async def ai_costs(
    admin: PlatformAdminUser = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_platform_db),
):
    """AI cost breakdown across all colleges."""
    from app.engines.admin.models import College
    from app.engines.ai.models import AgentExecution, AIBudget

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Total cost today
    today_result = await db.execute(
        select(func.coalesce(func.sum(AgentExecution.total_cost_usd), 0)).where(
            AgentExecution.started_at >= today_start,
        )
    )
    total_cost_today = float(today_result.scalar() or 0)

    # Total cost this month
    month_result = await db.execute(
        select(func.coalesce(func.sum(AgentExecution.total_cost_usd), 0)).where(
            AgentExecution.started_at >= month_start,
        )
    )
    total_cost_month = float(month_result.scalar() or 0)

    # By college
    college_result = await db.execute(
        select(
            AgentExecution.college_id,
            func.sum(AgentExecution.total_cost_usd),
        )
        .where(AgentExecution.started_at >= month_start)
        .group_by(AgentExecution.college_id)
    )
    by_college_raw = college_result.all()

    by_college = []
    for college_id, cost in by_college_raw:
        if college_id is None:
            continue
        # Get college name
        name_result = await db.execute(
            select(College.name).where(College.id == college_id)
        )
        name = name_result.scalar() or "Unknown"

        # Get budget
        budget_result = await db.execute(
            select(AIBudget.total_budget_usd).where(
                AIBudget.college_id == college_id,
                AIBudget.period_start <= date.today(),
                AIBudget.period_end >= date.today(),
            )
        )
        budget = float(budget_result.scalar() or 0)
        cost_float = float(cost or 0)

        by_college.append(
            AICostByCollege(
                college_id=college_id,
                college_name=name,
                cost_usd=round(cost_float, 4),
                budget_usd=round(budget, 2),
                pct_used=round(cost_float / budget * 100, 1) if budget > 0 else 0,
            )
        )

    # By model
    model_result = await db.execute(
        select(
            AgentExecution.model_used,
            func.sum(AgentExecution.total_cost_usd),
            func.sum(AgentExecution.input_tokens + AgentExecution.output_tokens),
        )
        .where(AgentExecution.started_at >= month_start)
        .group_by(AgentExecution.model_used)
    )
    by_model = [
        AICostByModel(
            model=model or "unknown",
            cost_usd=round(float(cost or 0), 4),
            token_count=int(tokens or 0),
        )
        for model, cost, tokens in model_result.all()
    ]

    # By agent
    agent_result = await db.execute(
        select(
            AgentExecution.agent_id,
            func.sum(AgentExecution.total_cost_usd),
            func.count(AgentExecution.id),
        )
        .where(AgentExecution.started_at >= month_start)
        .group_by(AgentExecution.agent_id)
    )
    by_agent = [
        AICostByAgent(
            agent_id=agent_id or "unknown",
            cost_usd=round(float(cost or 0), 4),
            call_count=int(count or 0),
        )
        for agent_id, cost, count in agent_result.all()
    ]

    # Cache savings
    cache_result = await db.execute(
        select(func.coalesce(func.sum(AgentExecution.cache_read_tokens), 0)).where(
            AgentExecution.started_at >= month_start,
        )
    )
    cached_tokens = int(cache_result.scalar() or 0)
    # Approximate savings: cached tokens would have cost ~$3/M input tokens
    cache_savings = cached_tokens * 3.0 / 1_000_000

    # Projected monthly cost (linear extrapolation)
    days_elapsed = max(1, (now - month_start).days or 1)
    days_in_month = 30
    projected = total_cost_month / days_elapsed * days_in_month

    return AICostBreakdownResponse(
        total_cost_today_usd=round(total_cost_today, 4),
        total_cost_this_month_usd=round(total_cost_month, 4),
        by_college=sorted(by_college, key=lambda x: x.cost_usd, reverse=True),
        by_model=sorted(by_model, key=lambda x: x.cost_usd, reverse=True),
        by_agent=sorted(by_agent, key=lambda x: x.cost_usd, reverse=True),
        cache_savings_usd=round(cache_savings, 4),
        projected_monthly_cost_usd=round(projected, 2),
    )


# ===================================================================
# CROSS-TENANT ANALYTICS
# ===================================================================


@router.get("/analytics/overview", response_model=AnalyticsOverviewResponse)
async def analytics_overview(
    admin: PlatformAdminUser = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_platform_db),
):
    """Platform-wide business metrics."""
    from app.engines.admin.models import College, Faculty, Student
    from app.engines.ai.models import AgentExecution

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # License counts
    total_lic = await db.execute(select(func.count(License.id)))
    active_lic = await db.execute(
        select(func.count(License.id)).where(License.status == "active")
    )

    # Student/faculty counts
    student_count = await db.execute(select(func.count(Student.id)))
    faculty_count = await db.execute(select(func.count(Faculty.id)))

    # AI calls today
    ai_calls = await db.execute(
        select(func.count(AgentExecution.id)).where(
            AgentExecution.started_at >= today_start,
        )
    )

    # MRR (sum of monthly-equivalent prices for active licenses)
    mrr_result = await db.execute(
        select(func.coalesce(func.sum(License.price_inr), 0)).where(
            License.status == "active"
        )
    )
    total_annual_inr = float(mrr_result.scalar() or 0)
    mrr_inr = total_annual_inr / 12  # Assuming annual prices

    # Licenses expiring in 30 days
    cutoff_30 = now + timedelta(days=30)
    expiring = await db.execute(
        select(func.count(License.id)).where(
            License.status == "active",
            License.expires_at.isnot(None),
            License.expires_at <= cutoff_30,
            License.expires_at > now,
        )
    )

    # Top engaged / least engaged from latest usage snapshots
    top_engaged: list[EngagedCollege] = []
    least_engaged: list[LeastEngagedCollege] = []
    try:
        latest_sub = (
            select(
                LicenseUsageSnapshot.license_id,
                func.max(LicenseUsageSnapshot.snapshot_date).label("max_date"),
            )
            .group_by(LicenseUsageSnapshot.license_id)
            .subquery()
        )

        snap_rows = (
            await db.execute(
                select(
                    LicenseUsageSnapshot.total_users,
                    LicenseUsageSnapshot.feature_usage,
                    LicenseUsageSnapshot.created_at,
                    License.college_id,
                    College.name,
                )
                .join(
                    latest_sub,
                    (LicenseUsageSnapshot.license_id == latest_sub.c.license_id)
                    & (LicenseUsageSnapshot.snapshot_date == latest_sub.c.max_date),
                )
                .join(License, LicenseUsageSnapshot.license_id == License.id)
                .join(College, License.college_id == College.id)
                .where(License.status == "active")
                .order_by(LicenseUsageSnapshot.total_users.desc())
            )
        ).all()

        top_engaged = [
            EngagedCollege(
                college_id=cid,
                name=cname,
                dau=total_users,
                feature_usage=fusage or {},
            )
            for total_users, fusage, _, cid, cname in snap_rows[:5]
        ]

        # Least engaged — bottom 5 sorted ascending
        least_engaged = [
            LeastEngagedCollege(
                college_id=cid,
                name=cname,
                last_active=cat,
            )
            for total_users, _, cat, cid, cname in reversed(snap_rows[-5:])
        ]
    except Exception:
        logger.debug("Could not compute engagement data", exc_info=True)

    return AnalyticsOverviewResponse(
        total_licenses=total_lic.scalar() or 0,
        active_licenses=active_lic.scalar() or 0,
        total_students=student_count.scalar() or 0,
        total_faculty=faculty_count.scalar() or 0,
        total_ai_calls_today=ai_calls.scalar() or 0,
        mrr_inr=round(mrr_inr, 2),
        licenses_expiring_30_days=expiring.scalar() or 0,
        churn_risk_colleges=[],  # TODO: implement churn prediction model
        top_engaged_colleges=top_engaged,
        least_engaged_colleges=least_engaged,
    )


@router.get("/analytics/feature-adoption", response_model=FeatureAdoptionResponse)
async def feature_adoption(
    admin: PlatformAdminUser = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_platform_db),
):
    """Which features are being used across all colleges.

    Enriched with active_users (sum of total_users from latest snapshots
    where the feature is enabled) and calls_per_day (from snapshot
    feature_usage JSONB data).
    """
    # Get all active licenses
    result = await db.execute(
        select(License).where(License.status == "active")
    )
    licenses = result.scalars().all()

    # Get latest snapshot per license for usage data
    license_ids = [lic.id for lic in licenses]
    latest_snaps: dict[UUID, LicenseUsageSnapshot] = {}
    if license_ids:
        latest_sub = (
            select(
                LicenseUsageSnapshot.license_id,
                func.max(LicenseUsageSnapshot.snapshot_date).label("max_date"),
            )
            .where(LicenseUsageSnapshot.license_id.in_(license_ids))
            .group_by(LicenseUsageSnapshot.license_id)
            .subquery()
        )
        snap_result = await db.execute(
            select(LicenseUsageSnapshot).join(
                latest_sub,
                (LicenseUsageSnapshot.license_id == latest_sub.c.license_id)
                & (LicenseUsageSnapshot.snapshot_date == latest_sub.c.max_date),
            )
        )
        latest_snaps = {
            s.license_id: s for s in snap_result.scalars().all()
        }

    # Aggregate feature enablement + usage
    feature_data: dict[str, dict] = {}
    for lic in licenses:
        features = lic.enabled_features or {}
        snap = latest_snaps.get(lic.id)
        for feat, enabled in features.items():
            if feat not in feature_data:
                feature_data[feat] = {
                    "enabled_count": 0,
                    "active_users": 0,
                    "calls_total": 0,
                }
            if enabled:
                feature_data[feat]["enabled_count"] += 1
                if snap:
                    feature_data[feat]["active_users"] += snap.total_users
                    usage = snap.feature_usage or {}
                    if feat in usage:
                        feature_data[feat]["calls_total"] += usage[feat]

    # Build response
    active_license_count = max(1, len(licenses))
    features_list = [
        FeatureAdoptionItem(
            feature=feat,
            enabled_count=data["enabled_count"],
            active_users=data["active_users"],
            calls_per_day=round(data["calls_total"] / active_license_count, 1),
        )
        for feat, data in sorted(
            feature_data.items(), key=lambda x: x[1]["enabled_count"], reverse=True
        )
    ]

    return FeatureAdoptionResponse(features=features_list)


@router.get("/analytics/college/{college_id}", response_model=CollegeAnalyticsResponse)
async def college_analytics(
    college_id: UUID,
    admin: PlatformAdminUser = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_platform_db),
):
    """Deep dive into one college's usage."""
    from app.engines.admin.models import College, Faculty, Student
    from app.engines.ai.models import AgentExecution, AIBudget

    # Verify college exists
    college_result = await db.execute(
        select(College).where(College.id == college_id)
    )
    college = college_result.scalar_one_or_none()
    if college is None:
        raise HTTPException(404, f"College {college_id} not found")

    # License
    lic_result = await db.execute(
        select(License).where(License.college_id == college_id)
    )
    license_obj = lic_result.scalar_one_or_none()

    # Usage counts
    student_count = await db.execute(
        select(func.count(Student.id)).where(Student.college_id == college_id)
    )
    faculty_count = await db.execute(
        select(func.count(Faculty.id)).where(Faculty.college_id == college_id)
    )

    # AI costs this month
    month_start = datetime.now(timezone.utc).replace(
        day=1, hour=0, minute=0, second=0, microsecond=0
    )
    ai_cost = await db.execute(
        select(func.coalesce(func.sum(AgentExecution.total_cost_usd), 0)).where(
            AgentExecution.college_id == college_id,
            AgentExecution.started_at >= month_start,
        )
    )
    ai_calls = await db.execute(
        select(func.count(AgentExecution.id)).where(
            AgentExecution.college_id == college_id,
            AgentExecution.started_at >= month_start,
        )
    )

    # AI budget
    budget_result = await db.execute(
        select(AIBudget).where(
            AIBudget.college_id == college_id,
            AIBudget.period_start <= date.today(),
            AIBudget.period_end >= date.today(),
        )
    )
    budget = budget_result.scalar_one_or_none()

    return CollegeAnalyticsResponse(
        college_id=college_id,
        college_name=college.name,
        license=(
            LicenseResponse.model_validate(license_obj).model_dump()
            if license_obj
            else None
        ),
        usage={
            "students": student_count.scalar() or 0,
            "faculty": faculty_count.scalar() or 0,
            "max_students": license_obj.max_students if license_obj else 0,
            "max_faculty": license_obj.max_faculty if license_obj else 0,
        },
        ai_costs={
            "cost_this_month_usd": round(float(ai_cost.scalar() or 0), 4),
            "calls_this_month": ai_calls.scalar() or 0,
            "budget_usd": float(budget.total_budget_usd) if budget else 0,
            "used_usd": float(budget.used_amount_usd) if budget else 0,
        },
        feature_adoption={
            "enabled_features": (
                [k for k, v in (license_obj.enabled_features or {}).items() if v]
                if license_obj
                else []
            ),
            "enabled_engines": (
                [k for k, v in (license_obj.enabled_engines or {}).items() if v]
                if license_obj
                else []
            ),
        },
    )


# ===================================================================
# PLATFORM ALERTS
# ===================================================================


@router.get("/alerts")
async def list_alerts(
    admin: PlatformAdminUser = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_platform_db),
    severity: str | None = Query(None),
    category: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
) -> PaginatedResponse:
    """List platform alerts with filtering."""
    query = select(PlatformAlert)
    count_query = select(func.count(PlatformAlert.id))

    conditions = []
    if severity:
        conditions.append(PlatformAlert.severity == severity)
    if category:
        conditions.append(PlatformAlert.category == category)
    if status_filter:
        conditions.append(PlatformAlert.status == status_filter)

    for cond in conditions:
        query = query.where(cond)
        count_query = count_query.where(cond)

    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(PlatformAlert.created_at.desc())
    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page)

    result = await db.execute(query)
    alerts = result.scalars().all()

    return PaginatedResponse(
        items=[PlatformAlertResponse.model_validate(a) for a in alerts],
        total=total,
        page=page,
        per_page=per_page,
        pages=max(1, math.ceil(total / per_page)),
    )


@router.post("/alerts/{alert_id}/acknowledge", response_model=PlatformAlertResponse)
async def acknowledge_alert(
    alert_id: UUID,
    admin: PlatformAdminUser = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_platform_db),
):
    """Acknowledge a platform alert."""
    result = await db.execute(
        select(PlatformAlert).where(PlatformAlert.id == alert_id)
    )
    alert = result.scalar_one_or_none()
    if alert is None:
        raise HTTPException(404, f"Alert {alert_id} not found")

    alert.status = "acknowledged"
    alert.acknowledged_by = admin.actor_uuid
    alert.acknowledged_at = datetime.now(timezone.utc)

    await _audit_log(
        db,
        actor=admin,
        action="alert.acknowledge",
        entity_type="alert",
        entity_id=alert_id,
    )
    await db.flush()
    return PlatformAlertResponse.model_validate(alert)


@router.post("/alerts/{alert_id}/resolve", response_model=PlatformAlertResponse)
async def resolve_alert(
    alert_id: UUID,
    payload: AlertResolveRequest,
    admin: PlatformAdminUser = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_platform_db),
):
    """Resolve a platform alert."""
    result = await db.execute(
        select(PlatformAlert).where(PlatformAlert.id == alert_id)
    )
    alert = result.scalar_one_or_none()
    if alert is None:
        raise HTTPException(404, f"Alert {alert_id} not found")

    alert.status = "resolved"
    alert.resolved_by = admin.actor_uuid
    alert.resolved_at = datetime.now(timezone.utc)
    alert.resolution_notes = payload.resolution_notes

    await _audit_log(
        db,
        actor=admin,
        action="alert.resolve",
        entity_type="alert",
        entity_id=alert_id,
        changes={"resolution_notes": payload.resolution_notes},
    )
    await db.flush()
    return PlatformAlertResponse.model_validate(alert)


# ===================================================================
# AUDIT LOG
# ===================================================================


@router.get("/audit-log")
async def list_audit_log(
    admin: PlatformAdminUser = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_platform_db),
    action: str | None = Query(None, description="Filter by action (e.g. license.create)"),
    entity_type: str | None = Query(None, description="Filter by entity type (e.g. license)"),
    actor_email: str | None = Query(None, description="Filter by actor email"),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
) -> PaginatedResponse:
    """List platform audit log entries with filtering and pagination.

    Returns platform admin actions: license changes, suspensions,
    onboarding, alert resolution, etc.
    """
    query = select(PlatformAuditLog)
    count_query = select(func.count(PlatformAuditLog.id))

    conditions = []
    if action:
        conditions.append(PlatformAuditLog.action == action)
    if entity_type:
        conditions.append(PlatformAuditLog.entity_type == entity_type)
    if actor_email:
        conditions.append(PlatformAuditLog.actor_email == actor_email)

    for cond in conditions:
        query = query.where(cond)
        count_query = count_query.where(cond)

    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(PlatformAuditLog.created_at.desc())
    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page)

    result = await db.execute(query)
    entries = result.scalars().all()

    return PaginatedResponse(
        items=[AuditLogEntryResponse.model_validate(e) for e in entries],
        total=total,
        page=page,
        per_page=per_page,
        pages=max(1, math.ceil(total / per_page)),
    )


# ===================================================================
# SYSTEM TESTS
# ===================================================================


@router.get("/tests/suites")
async def list_test_suites(
    admin: PlatformAdminUser = Depends(require_platform_admin),
) -> list[dict[str, Any]]:
    """List available test suites (test files in the backend/tests directory)."""
    backend_dir = Path(__file__).resolve().parent.parent.parent
    tests_dir = backend_dir / "tests"

    suites = []
    if tests_dir.exists():
        for f in sorted(tests_dir.glob("test_*.py")):
            suites.append({
                "file": f.name,
                "path": str(f.relative_to(backend_dir)),
                "label": f.stem.replace("test_", "").replace("_", " ").title(),
            })
    return suites


@router.post("/tests/run")
async def run_tests(
    admin: PlatformAdminUser = Depends(require_platform_admin),
    suite: str | None = Query(None, description="Specific test file to run (e.g. test_admin_engine_e2e.py)"),
    keyword: str | None = Query(None, description="pytest -k filter expression"),
) -> dict[str, Any]:
    """Run backend tests and return structured results.

    Runs pytest with JSON output and returns parsed results.
    Only accessible by platform admins (Acolyte team).
    """
    backend_dir = Path(__file__).resolve().parent.parent.parent

    cmd = [
        "python3", "-m", "pytest",
        "--tb=short",
        "-q",
        "--no-header",
    ]

    if suite:
        # Validate suite name to prevent path traversal
        if ".." in suite or "/" in suite:
            raise HTTPException(400, "Invalid suite name")
        suite_path = backend_dir / "tests" / suite
        if not suite_path.exists():
            raise HTTPException(404, f"Test suite '{suite}' not found")
        cmd.append(f"tests/{suite}")
    else:
        cmd.append("tests/")

    if keyword:
        cmd.extend(["-k", keyword])

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=str(backend_dir),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(), timeout=120
        )
    except asyncio.TimeoutError:
        return {
            "status": "timeout",
            "exit_code": -1,
            "summary": "Tests timed out after 120 seconds",
            "output": "",
            "passed": 0,
            "failed": 0,
            "errors": 0,
            "total": 0,
            "duration_seconds": 120,
        }

    output = stdout.decode("utf-8", errors="replace")
    err_output = stderr.decode("utf-8", errors="replace")

    # Parse pytest output for counts
    passed = failed = errors = total = 0
    duration = 0.0
    summary_line = ""

    for line in (output + err_output).splitlines():
        line_stripped = line.strip()
        # Match "198 passed in 3.89s" or "5 failed, 193 passed in 4.12s"
        if "passed" in line_stripped and ("in " in line_stripped):
            summary_line = line_stripped
            import re
            m_passed = re.search(r"(\d+) passed", line_stripped)
            m_failed = re.search(r"(\d+) failed", line_stripped)
            m_errors = re.search(r"(\d+) error", line_stripped)
            m_duration = re.search(r"in ([\d.]+)s", line_stripped)
            if m_passed:
                passed = int(m_passed.group(1))
            if m_failed:
                failed = int(m_failed.group(1))
            if m_errors:
                errors = int(m_errors.group(1))
            if m_duration:
                duration = float(m_duration.group(1))
            total = passed + failed + errors

    status = "passed" if proc.returncode == 0 else "failed"

    return {
        "status": status,
        "exit_code": proc.returncode,
        "summary": summary_line or output.splitlines()[-1] if output.strip() else "No output",
        "output": output[-5000:] if len(output) > 5000 else output,
        "stderr": err_output[-2000:] if err_output else "",
        "passed": passed,
        "failed": failed,
        "errors": errors,
        "total": total,
        "duration_seconds": duration,
        "suite": suite,
        "keyword": keyword,
        "ran_at": datetime.now(timezone.utc).isoformat(),
    }


# ===================================================================
# HELPERS
# ===================================================================


async def _get_license_or_404(
    db: AsyncSession, license_id: UUID
) -> License:
    """Load a license by ID or raise 404."""
    result = await db.execute(
        select(License).where(License.id == license_id)
    )
    license_obj = result.scalar_one_or_none()
    if license_obj is None:
        raise HTTPException(404, f"License {license_id} not found")
    return license_obj


async def _audit_log(
    db: AsyncSession,
    *,
    actor: PlatformAdminUser,
    action: str,
    entity_type: str,
    entity_id: UUID | None = None,
    changes: dict | None = None,
) -> None:
    """Create a PlatformAuditLog entry."""
    log = PlatformAuditLog(
        actor_id=actor.actor_uuid,
        actor_email=actor.email,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        changes=_serialize_dict(changes) if changes else None,
    )
    db.add(log)


async def _invalidate_cache(
    request: Request | None, college_id: UUID
) -> None:
    """Invalidate the Redis license cache for a college."""
    if request is None:
        return
    redis_client = getattr(request.app.state, "redis", None)
    if redis_client is None:
        return
    try:
        from app.platform.license_middleware import invalidate_license_cache

        await invalidate_license_cache(redis_client, college_id)
    except Exception:
        logger.warning(
            "Failed to invalidate license cache for %s", college_id
        )


def _generate_college_code(name: str) -> str:
    """Generate a college code from the name.

    Takes first letters of each word, uppercased, plus a short
    random suffix for uniqueness.
    """
    words = name.split()
    prefix = "".join(w[0].upper() for w in words if w)[:6]
    suffix = uuid_mod.uuid4().hex[:4].upper()
    return f"{prefix}-{suffix}"


def _serialize_dict(d: dict | None) -> dict | None:
    """Convert non-JSON-serializable values in a dict to strings."""
    if d is None:
        return None
    result = {}
    for k, v in d.items():
        if isinstance(v, (datetime, date)):
            result[k] = v.isoformat()
        elif isinstance(v, UUID):
            result[k] = str(v)
        elif isinstance(v, dict):
            result[k] = _serialize_dict(v)
        elif isinstance(v, list):
            result[k] = [
                str(item) if isinstance(item, (UUID, datetime)) else item
                for item in v
            ]
        else:
            result[k] = v
    return result
