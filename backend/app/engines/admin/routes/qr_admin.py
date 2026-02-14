"""Admin QR Management routes — action point CRUD and scan analytics.

Endpoints:
- GET    /action-points           — List action points
- POST   /action-points           — Create action point
- PUT    /action-points/{id}      — Update action point
- DELETE /action-points/{id}      — Soft-deactivate
- GET    /action-points/{id}/generate — Generate printable QR image
- GET    /action-points/{id}/stats    — Scan stats for action point
- GET    /scan-logs               — All scan logs (filtered)
- GET    /scan-logs/summary       — Daily scan counts
- GET    /scan-logs/anomalies     — Failed scans grouped by reason
- GET    /scan-logs/export        — Export as CSV
"""

from __future__ import annotations

import csv
import io
import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import case, cast, func, select, String
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user, get_tenant_db, require_college_admin
from app.middleware.clerk_auth import CurrentUser
from app.shared.models.qr import QRActionPoint, QRScanLog
from app.shared.schemas.qr import (
    QRActionPointCreate,
    QRActionPointResponse,
    QRActionPointUpdate,
    QRScanLogResponse,
)
from app.shared.services.qr_token_service import create_action_point_signature

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Admin - QR Management"])


# ---------------------------------------------------------------------------
# 1. GET /action-points — List action points
# ---------------------------------------------------------------------------

@router.get("/action-points", response_model=list[QRActionPointResponse])
async def list_action_points(
    action_type: Optional[str] = Query(None),
    building: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    user: CurrentUser = Depends(require_college_admin),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List all QR action points for this college with optional filters."""
    query = select(QRActionPoint).order_by(QRActionPoint.name)

    if action_type:
        query = query.where(QRActionPoint.action_type == action_type)
    if building:
        query = query.where(QRActionPoint.building == building)
    if is_active is not None:
        query = query.where(QRActionPoint.is_active == is_active)

    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return [QRActionPointResponse.model_validate(ap) for ap in result.scalars().all()]


# ---------------------------------------------------------------------------
# 2. POST /action-points — Create action point
# ---------------------------------------------------------------------------

@router.post("/action-points", response_model=QRActionPointResponse, status_code=201)
async def create_action_point(
    body: QRActionPointCreate,
    user: CurrentUser = Depends(require_college_admin),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Create a new QR action point.

    Auto-generates a secure qr_secret for HMAC signing.
    """
    now = datetime.now(timezone.utc)
    ap = QRActionPoint(
        id=uuid.uuid4(),
        college_id=user.college_id,
        name=body.name,
        description=body.description,
        action_type=body.action_type,
        location_code=body.location_code,
        qr_mode=body.qr_mode,
        building=body.building,
        floor=body.floor,
        gps_latitude=body.gps_latitude,
        gps_longitude=body.gps_longitude,
        geo_radius_meters=body.geo_radius_meters,
        qr_rotation_minutes=body.qr_rotation_minutes,
        duplicate_window_minutes=body.duplicate_window_minutes,
        linked_entity_type=body.linked_entity_type,
        linked_entity_id=body.linked_entity_id,
        security_level=body.security_level,
        active_hours_start=body.active_hours_start,
        active_hours_end=body.active_hours_end,
        active_days=body.active_days,
        extra_data=body.metadata or {},
        qr_secret=secrets.token_hex(32),
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    db.add(ap)
    await db.flush()
    return QRActionPointResponse.model_validate(ap)


# ---------------------------------------------------------------------------
# 3. PUT /action-points/{id} — Update action point
# ---------------------------------------------------------------------------

@router.put("/action-points/{action_point_id}", response_model=QRActionPointResponse)
async def update_action_point(
    action_point_id: UUID,
    body: QRActionPointUpdate,
    user: CurrentUser = Depends(require_college_admin),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Update an existing QR action point."""
    result = await db.execute(
        select(QRActionPoint).where(QRActionPoint.id == action_point_id)
    )
    ap = result.scalar_one_or_none()
    if not ap:
        raise HTTPException(404, "Action point not found")

    update_data = body.model_dump(exclude_unset=True)
    # Map schema 'metadata' field to model 'extra_data' attribute
    if "metadata" in update_data:
        update_data["extra_data"] = update_data.pop("metadata")

    for key, value in update_data.items():
        setattr(ap, key, value)

    await db.flush()
    return QRActionPointResponse.model_validate(ap)


# ---------------------------------------------------------------------------
# 4. DELETE /action-points/{id} — Soft-deactivate
# ---------------------------------------------------------------------------

@router.delete("/action-points/{action_point_id}", status_code=200)
async def deactivate_action_point(
    action_point_id: UUID,
    user: CurrentUser = Depends(require_college_admin),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Soft-deactivate a QR action point (sets is_active=False)."""
    result = await db.execute(
        select(QRActionPoint).where(QRActionPoint.id == action_point_id)
    )
    ap = result.scalar_one_or_none()
    if not ap:
        raise HTTPException(404, "Action point not found")

    ap.is_active = False
    await db.flush()
    return {"status": "ok", "message": f"Action point '{ap.name}' deactivated"}


# ---------------------------------------------------------------------------
# 5. GET /action-points/{id}/generate — Generate printable QR
# ---------------------------------------------------------------------------

@router.get("/action-points/{action_point_id}/generate")
async def generate_action_point_qr(
    action_point_id: UUID,
    user: CurrentUser = Depends(require_college_admin),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Generate a printable QR code image for a Mode B action point.

    Returns the QR data string and a base64-encoded PNG image.
    """
    result = await db.execute(
        select(QRActionPoint).where(QRActionPoint.id == action_point_id)
    )
    ap = result.scalar_one_or_none()
    if not ap:
        raise HTTPException(404, "Action point not found")

    if ap.qr_mode != "mode_b":
        raise HTTPException(400, "QR generation is only for Mode B action points")

    # Generate HMAC signature
    sig = create_action_point_signature(
        str(ap.id), ap.action_type, ap.location_code, str(ap.college_id), "",
    )

    # Build acolyte:// URL
    qr_data = (
        f"acolyte://v1/{ap.action_type}"
        f"?ap={ap.id}&lc={ap.location_code}&c={ap.college_id}&sig={sig}"
    )

    # Generate QR image
    import base64

    import qrcode
    from qrcode.image.pil import PilImage

    qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=4)
    qr.add_data(qr_data)
    qr.make(fit=True)
    img: PilImage = qr.make_image(fill_color="black", back_color="white")

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    qr_image_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

    return {
        "qr_data": qr_data,
        "qr_image_base64": qr_image_base64,
        "action_point_name": ap.name,
        "action_type": ap.action_type,
        "location_code": ap.location_code,
    }


# ---------------------------------------------------------------------------
# 6. GET /action-points/{id}/stats — Scan stats
# ---------------------------------------------------------------------------

@router.get("/action-points/{action_point_id}/stats")
async def get_action_point_stats(
    action_point_id: UUID,
    days: int = Query(30, ge=1, le=365),
    user: CurrentUser = Depends(require_college_admin),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get scan statistics for a specific action point."""
    result = await db.execute(
        select(QRActionPoint).where(QRActionPoint.id == action_point_id)
    )
    ap = result.scalar_one_or_none()
    if not ap:
        raise HTTPException(404, "Action point not found")

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    # Total scans and success rate
    stats_result = await db.execute(
        select(
            func.count(QRScanLog.id).label("total_scans"),
            func.count(
                case(
                    (QRScanLog.validation_result == "success", QRScanLog.id),
                )
            ).label("successful_scans"),
        ).where(
            QRScanLog.action_point_id == action_point_id,
            QRScanLog.scanned_at >= cutoff,
        )
    )
    row = stats_result.one()
    total = row.total_scans
    successful = row.successful_scans

    # Daily breakdown
    daily_result = await db.execute(
        select(
            func.date(QRScanLog.scanned_at).label("date"),
            func.count(QRScanLog.id).label("count"),
        )
        .where(
            QRScanLog.action_point_id == action_point_id,
            QRScanLog.scanned_at >= cutoff,
        )
        .group_by(func.date(QRScanLog.scanned_at))
        .order_by(func.date(QRScanLog.scanned_at))
    )

    return {
        "action_point_id": str(action_point_id),
        "action_point_name": ap.name,
        "period_days": days,
        "total_scans": total,
        "successful_scans": successful,
        "success_rate": round(successful / total * 100, 1) if total > 0 else 0,
        "daily_breakdown": [
            {"date": str(r.date), "count": r.count} for r in daily_result.all()
        ],
    }


# ---------------------------------------------------------------------------
# 7. GET /scan-logs — All scan logs with filters
# ---------------------------------------------------------------------------

@router.get("/scan-logs", response_model=list[QRScanLogResponse])
async def list_scan_logs(
    user_id: Optional[UUID] = Query(None),
    action_type: Optional[str] = Query(None),
    validation_result: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    user: CurrentUser = Depends(require_college_admin),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List all scan logs with optional filters. Admin only."""
    query = select(QRScanLog).order_by(QRScanLog.scanned_at.desc())

    if user_id:
        query = query.where(QRScanLog.user_id == user_id)
    if action_type:
        query = query.where(QRScanLog.action_type == action_type)
    if validation_result:
        query = query.where(QRScanLog.validation_result == validation_result)
    if date_from:
        query = query.where(QRScanLog.scanned_at >= date_from)
    if date_to:
        query = query.where(QRScanLog.scanned_at <= date_to)

    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return [QRScanLogResponse.model_validate(log) for log in result.scalars().all()]


# ---------------------------------------------------------------------------
# 8. GET /scan-logs/summary — Daily scan counts by action type
# ---------------------------------------------------------------------------

@router.get("/scan-logs/summary")
async def get_scan_summary(
    days: int = Query(30, ge=1, le=365),
    user: CurrentUser = Depends(require_college_admin),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get daily scan counts by action type for the last N days."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    result = await db.execute(
        select(
            func.date(QRScanLog.scanned_at).label("date"),
            QRScanLog.action_type,
            func.count(QRScanLog.id).label("count"),
        )
        .where(
            QRScanLog.scanned_at >= cutoff,
            QRScanLog.validation_result == "success",
        )
        .group_by(func.date(QRScanLog.scanned_at), QRScanLog.action_type)
        .order_by(func.date(QRScanLog.scanned_at))
    )

    return {
        "period_days": days,
        "data": [
            {"date": str(r.date), "action_type": r.action_type, "count": r.count}
            for r in result.all()
        ],
    }


# ---------------------------------------------------------------------------
# 9. GET /scan-logs/anomalies — Failed scans grouped by reason
# ---------------------------------------------------------------------------

@router.get("/scan-logs/anomalies")
async def get_scan_anomalies(
    days: int = Query(30, ge=1, le=365),
    user: CurrentUser = Depends(require_college_admin),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get failed scans grouped by failure reason."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    result = await db.execute(
        select(
            QRScanLog.validation_result,
            QRScanLog.rejection_reason,
            func.count(QRScanLog.id).label("count"),
        )
        .where(
            QRScanLog.scanned_at >= cutoff,
            QRScanLog.validation_result != "success",
        )
        .group_by(QRScanLog.validation_result, QRScanLog.rejection_reason)
        .order_by(func.count(QRScanLog.id).desc())
    )

    return {
        "period_days": days,
        "anomalies": [
            {
                "validation_result": r.validation_result,
                "rejection_reason": r.rejection_reason,
                "count": r.count,
            }
            for r in result.all()
        ],
    }


# ---------------------------------------------------------------------------
# 10. GET /scan-logs/export — Export as CSV
# ---------------------------------------------------------------------------

@router.get("/scan-logs/export")
async def export_scan_logs(
    action_type: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    user: CurrentUser = Depends(require_college_admin),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Export scan logs as CSV. Admin only."""
    query = select(QRScanLog).order_by(QRScanLog.scanned_at.desc())

    if action_type:
        query = query.where(QRScanLog.action_type == action_type)
    if date_from:
        query = query.where(QRScanLog.scanned_at >= date_from)
    if date_to:
        query = query.where(QRScanLog.scanned_at <= date_to)

    # Limit export to 10k rows
    query = query.limit(10000)
    result = await db.execute(query)
    logs = result.scalars().all()

    # Build CSV
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id", "user_id", "user_type", "action_type", "action_point_id",
        "qr_mode", "validation_result", "rejection_reason",
        "scan_latitude", "scan_longitude", "geo_validated",
        "device_validated", "scanned_at",
    ])
    for log in logs:
        writer.writerow([
            str(log.id), str(log.user_id), log.user_type, log.action_type,
            str(log.action_point_id) if log.action_point_id else "",
            log.qr_mode, log.validation_result, log.rejection_reason or "",
            log.scan_latitude, log.scan_longitude, log.geo_validated,
            log.device_validated, log.scanned_at.isoformat() if log.scanned_at else "",
        ])

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=scan_logs.csv"},
    )
