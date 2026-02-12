"""Compliance Engine — API Routes.

Prefix: /api/v1/compliance

Standards CRUD (Jason's interface) + alert management + snapshot access.
AI-powered operations (run-check, dashboard, trends) are on the AI router.

Auth: require_compliance for all endpoints.
"""

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import (
    get_current_user,
    get_tenant_db,
    require_compliance,
)
from app.engines.ai.agents.compliance_schemas import (
    AlertResolveRequest,
    ComplianceAlertResponse,
    ComplianceSnapshotResponse,
    ComplianceStandardCreate,
    ComplianceStandardResponse,
    ComplianceStandardUpdate,
)
from app.engines.compliance.models import (
    ComplianceAlert,
    ComplianceCheckSnapshot,
    ComplianceStandard,
)
from app.middleware.clerk_auth import CurrentUser

logger = logging.getLogger(__name__)

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════
# Standards CRUD — Jason's interface for managing compliance rules
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/standards", response_model=list[ComplianceStandardResponse])
async def list_standards(
    category: str | None = Query(None),
    regulatory_body: str | None = Query(None),
    is_active: bool | None = Query(None),
    user: CurrentUser = Depends(require_compliance),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List all compliance standards, optionally filtered.

    Standards are platform-wide (not tenant-scoped), so this returns
    the same list for every college.
    """
    query = select(ComplianceStandard).order_by(
        ComplianceStandard.priority.asc(),
        ComplianceStandard.category,
    )

    if category:
        query = query.where(ComplianceStandard.category == category)
    if regulatory_body:
        query = query.where(
            ComplianceStandard.regulatory_body == regulatory_body,
        )
    if is_active is not None:
        query = query.where(ComplianceStandard.is_active == is_active)

    result = await db.execute(query)
    standards = result.scalars().all()

    return [
        ComplianceStandardResponse.model_validate(s) for s in standards
    ]


@router.post(
    "/standards",
    response_model=ComplianceStandardResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_standard(
    body: ComplianceStandardCreate,
    user: CurrentUser = Depends(require_compliance),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Create a new compliance standard.

    Standards are platform-wide rules — they apply to all colleges.
    Jason populates these after his NMC/NAAC/NBA audit.
    """
    standard = ComplianceStandard(
        standard_code=body.standard_code,
        category=body.category,
        subcategory=body.subcategory,
        title=body.title,
        description=body.description,
        data_source=body.data_source,
        data_query_config=body.data_query_config,
        threshold_type=body.threshold_type,
        threshold_value=body.threshold_value,
        comparison_operator=body.comparison_operator,
        buffer_warning_pct=body.buffer_warning_pct,
        severity_if_breached=body.severity_if_breached,
        regulatory_body=body.regulatory_body,
        source_document=body.source_document,
        effective_from=body.effective_from,
        effective_until=body.effective_until,
        priority=body.priority,
        created_by=UUID(user.user_id) if user.user_id else None,
    )
    db.add(standard)
    await db.flush()
    await db.refresh(standard)

    return ComplianceStandardResponse.model_validate(standard)


@router.put("/standards/{standard_id}", response_model=ComplianceStandardResponse)
async def update_standard(
    standard_id: str,
    body: ComplianceStandardUpdate,
    user: CurrentUser = Depends(require_compliance),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Update an existing compliance standard."""
    sid = UUID(standard_id)

    result = await db.execute(
        select(ComplianceStandard).where(ComplianceStandard.id == sid),
    )
    standard = result.scalars().first()

    if not standard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Standard {standard_id} not found",
        )

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(standard, field, value)

    standard.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(standard)

    return ComplianceStandardResponse.model_validate(standard)


@router.delete("/standards/{standard_id}")
async def delete_standard(
    standard_id: str,
    user: CurrentUser = Depends(require_compliance),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Soft-delete a compliance standard (set is_active=False).

    Standards are never hard-deleted — historical compliance checks
    reference them.
    """
    sid = UUID(standard_id)

    result = await db.execute(
        select(ComplianceStandard).where(ComplianceStandard.id == sid),
    )
    standard = result.scalars().first()

    if not standard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Standard {standard_id} not found",
        )

    standard.is_active = False
    standard.updated_at = datetime.now(timezone.utc)
    await db.flush()

    return {"status": "deactivated", "standard_id": standard_id}


@router.post("/standards/import")
async def import_standards(
    standards: list[ComplianceStandardCreate],
    user: CurrentUser = Depends(require_compliance),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Bulk import compliance standards from a JSON array.

    Skips duplicates (by standard_code). Returns counts of created/skipped.
    """
    created = 0
    skipped = 0
    errors: list[dict[str, Any]] = []

    for item in standards:
        # Check for duplicate standard_code
        existing = await db.execute(
            select(ComplianceStandard.id).where(
                ComplianceStandard.standard_code == item.standard_code,
            ),
        )
        if existing.scalars().first():
            skipped += 1
            continue

        try:
            standard = ComplianceStandard(
                standard_code=item.standard_code,
                category=item.category,
                subcategory=item.subcategory,
                title=item.title,
                description=item.description,
                data_source=item.data_source,
                data_query_config=item.data_query_config,
                threshold_type=item.threshold_type,
                threshold_value=item.threshold_value,
                comparison_operator=item.comparison_operator,
                buffer_warning_pct=item.buffer_warning_pct,
                severity_if_breached=item.severity_if_breached,
                regulatory_body=item.regulatory_body,
                source_document=item.source_document,
                effective_from=item.effective_from,
                effective_until=item.effective_until,
                priority=item.priority,
                created_by=UUID(user.user_id) if user.user_id else None,
            )
            db.add(standard)
            created += 1
        except Exception as e:
            errors.append({
                "standard_code": item.standard_code,
                "error": str(e),
            })

    if created:
        await db.flush()

    return {
        "created": created,
        "skipped": skipped,
        "errors": errors,
        "total_submitted": len(standards),
    }


# ═══════════════════════════════════════════════════════════════════════════
# Alert management
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/alerts", response_model=list[ComplianceAlertResponse])
async def list_alerts(
    severity: str | None = Query(None, description="green, yellow, orange, red"),
    alert_status: str | None = Query(
        None, alias="status",
        description="active, acknowledged, in_progress, resolved, escalated, dismissed",
    ),
    category: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: CurrentUser = Depends(require_compliance),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List compliance alerts for the current college.

    Filtered by RLS — only returns alerts for the user's college.
    """
    query = (
        select(ComplianceAlert)
        .order_by(desc(ComplianceAlert.created_at))
        .limit(limit)
        .offset(offset)
    )

    if severity:
        query = query.where(ComplianceAlert.severity == severity)
    if alert_status:
        query = query.where(ComplianceAlert.status == alert_status)
    if category:
        query = query.where(ComplianceAlert.category == category)

    result = await db.execute(query)
    alerts = result.scalars().all()

    return [_alert_to_response(a) for a in alerts]


@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: str,
    user: CurrentUser = Depends(require_compliance),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Acknowledge a compliance alert."""
    alert = await _get_alert(db, alert_id)

    if alert.status not in ("active",):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot acknowledge alert in '{alert.status}' status",
        )

    alert.status = "acknowledged"
    alert.acknowledged_by = UUID(user.user_id) if user.user_id else None
    alert.acknowledged_at = datetime.now(timezone.utc)
    alert.updated_at = datetime.now(timezone.utc)
    await db.flush()

    return {"status": "acknowledged", "alert_id": alert_id}


@router.post("/alerts/{alert_id}/resolve")
async def resolve_alert(
    alert_id: str,
    body: AlertResolveRequest,
    user: CurrentUser = Depends(require_compliance),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Resolve a compliance alert with resolution notes."""
    alert = await _get_alert(db, alert_id)

    if alert.status in ("resolved", "dismissed"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Alert already in '{alert.status}' status",
        )

    alert.status = "resolved"
    alert.resolved_by = UUID(user.user_id) if user.user_id else None
    alert.resolved_at = datetime.now(timezone.utc)
    alert.resolution_notes = body.resolution_notes
    alert.updated_at = datetime.now(timezone.utc)
    await db.flush()

    return {"status": "resolved", "alert_id": alert_id}


# ═══════════════════════════════════════════════════════════════════════════
# Snapshots
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/snapshots", response_model=list[ComplianceSnapshotResponse])
async def list_snapshots(
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: CurrentUser = Depends(require_compliance),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List historical compliance check snapshots.

    Returns the most recent snapshots first.
    """
    result = await db.execute(
        select(ComplianceCheckSnapshot)
        .order_by(desc(ComplianceCheckSnapshot.snapshot_date))
        .limit(limit)
        .offset(offset)
    )
    snapshots = result.scalars().all()

    return [_snapshot_to_response(s) for s in snapshots]


@router.get("/snapshots/{snapshot_date}")
async def get_snapshot_by_date(
    snapshot_date: str,
    snapshot_type: str = Query("daily_auto"),
    user: CurrentUser = Depends(require_compliance),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get a compliance snapshot for a specific date."""
    from datetime import date as date_type

    try:
        target_date = date_type.fromisoformat(snapshot_date)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid date format. Use YYYY-MM-DD.",
        )

    result = await db.execute(
        select(ComplianceCheckSnapshot).where(
            ComplianceCheckSnapshot.snapshot_date == target_date,
            ComplianceCheckSnapshot.snapshot_type == snapshot_type,
        )
    )
    snapshot = result.scalars().first()

    if not snapshot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No {snapshot_type} snapshot found for {snapshot_date}",
        )

    return _snapshot_to_response(snapshot)


@router.post("/snapshots/{snapshot_id}/approve")
async def approve_snapshot(
    snapshot_id: str,
    user: CurrentUser = Depends(require_compliance),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Dean approval of a compliance snapshot."""
    sid = UUID(snapshot_id)

    result = await db.execute(
        select(ComplianceCheckSnapshot).where(
            ComplianceCheckSnapshot.id == sid,
        )
    )
    snapshot = result.scalars().first()

    if not snapshot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Snapshot {snapshot_id} not found",
        )

    snapshot.approved_by = UUID(user.user_id) if user.user_id else None
    snapshot.approved_at = datetime.now(timezone.utc)
    snapshot.updated_at = datetime.now(timezone.utc)
    await db.flush()

    return {"status": "approved", "snapshot_id": snapshot_id}


# ═══════════════════════════════════════════════════════════════════════════
# Existing stub endpoints (kept for backward compatibility)
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/dashboard")
async def get_compliance_dashboard(
    user: CurrentUser = Depends(require_compliance),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get compliance dashboard with overall score and alerts.

    Uses the latest snapshot + active alert count for a quick summary.
    For detailed AI-powered dashboard, use /api/v1/ai/compliance/dashboard.
    """
    # Latest snapshot
    snap_result = await db.execute(
        select(ComplianceCheckSnapshot)
        .order_by(desc(ComplianceCheckSnapshot.snapshot_date))
        .limit(1)
    )
    latest = snap_result.scalars().first()

    # Active alert count
    alert_result = await db.execute(
        select(func.count(ComplianceAlert.id)).where(
            ComplianceAlert.status == "active",
        )
    )
    active_alerts = alert_result.scalar() or 0

    if not latest:
        return {
            "compliance_score": None,
            "overall_status": None,
            "active_alerts": active_alerts,
            "risk_level": None,
            "latest_snapshot_date": None,
            "message": "No compliance checks have been run yet.",
        }

    total = latest.standards_checked or 1
    compliance_pct = round((latest.standards_compliant or 0) / total * 100, 1)

    return {
        "compliance_score": compliance_pct,
        "overall_status": latest.overall_status,
        "standards_checked": latest.standards_checked,
        "standards_compliant": latest.standards_compliant,
        "standards_at_risk": latest.standards_at_risk,
        "standards_breached": latest.standards_breached,
        "active_alerts": active_alerts,
        "risk_level": latest.overall_status,
        "latest_snapshot_date": latest.snapshot_date.isoformat(),
    }


@router.get("/msr")
async def get_msr_status(
    user: CurrentUser = Depends(require_compliance),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get faculty MSR status across all departments."""
    return {"data": [], "total": 0}


@router.get("/attendance")
async def get_attendance_compliance(
    user: CurrentUser = Depends(require_compliance),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get AEBAS attendance compliance data."""
    return {"data": [], "total": 0}


@router.get("/saf")
async def list_saf_submissions(
    user: CurrentUser = Depends(require_compliance),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List SAF submissions."""
    return {"data": [], "total": 0}


@router.get("/inspection-readiness")
async def get_inspection_readiness(
    user: CurrentUser = Depends(require_compliance),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get inspection readiness score with predictions."""
    return {"score": None, "predicted_30d": None, "predicted_60d": None}


# ═══════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════

async def _get_alert(db: AsyncSession, alert_id: str) -> ComplianceAlert:
    """Fetch an alert by ID or raise 404."""
    aid = UUID(alert_id)
    result = await db.execute(
        select(ComplianceAlert).where(ComplianceAlert.id == aid),
    )
    alert = result.scalars().first()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert {alert_id} not found",
        )
    return alert


def _alert_to_response(alert: ComplianceAlert) -> ComplianceAlertResponse:
    """Convert a ComplianceAlert model to response schema."""
    return ComplianceAlertResponse(
        id=str(alert.id),
        standard_id=str(alert.standard_id) if alert.standard_id else None,
        severity=alert.severity,
        category=alert.category,
        title=alert.title,
        details=alert.details,
        current_value=alert.current_value,
        threshold_value=alert.threshold_value,
        gap_description=alert.gap_description,
        recommended_action=alert.recommended_action,
        deadline=alert.deadline,
        auto_escalation_date=alert.auto_escalation_date,
        status=alert.status,
        acknowledged_by=str(alert.acknowledged_by) if alert.acknowledged_by else None,
        acknowledged_at=alert.acknowledged_at,
        resolved_by=str(alert.resolved_by) if alert.resolved_by else None,
        resolved_at=alert.resolved_at,
        resolution_notes=alert.resolution_notes,
        created_at=alert.created_at,
    )


def _snapshot_to_response(
    snapshot: ComplianceCheckSnapshot,
) -> ComplianceSnapshotResponse:
    """Convert a ComplianceCheckSnapshot model to response schema."""
    return ComplianceSnapshotResponse(
        id=str(snapshot.id),
        snapshot_date=snapshot.snapshot_date,
        snapshot_type=snapshot.snapshot_type,
        overall_status=snapshot.overall_status,
        standards_checked=snapshot.standards_checked,
        standards_compliant=snapshot.standards_compliant,
        standards_at_risk=snapshot.standards_at_risk,
        standards_breached=snapshot.standards_breached,
        department_statuses=snapshot.department_statuses,
        check_results=snapshot.check_results,
        data_gaps=snapshot.data_gaps,
        approved_by=str(snapshot.approved_by) if snapshot.approved_by else None,
        approved_at=snapshot.approved_at,
        created_at=snapshot.created_at,
    )
