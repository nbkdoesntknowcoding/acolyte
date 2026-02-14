"""Admin device management routes — admin-initiated device operations.

Endpoints under /api/v1/admin/devices:
- GET  /            — List all registered devices (paginated)
- GET  /{user_id}   — Get device info for a specific user
- POST /{user_id}/reset — Admin-initiated device reset
- GET  /flagged     — Users with suspicious reset counts
- GET  /stats       — Device registration statistics
"""

from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies.auth import get_current_user, require_college_admin
from app.engines.integration.sms import get_sms_gateway
from app.middleware.clerk_auth import CurrentUser
from app.shared.models.device_trust import DeviceResetLog, DeviceTrust
from app.shared.schemas.device import (
    DeviceResetRequest,
    DeviceTrustResponse,
    FlaggedUserResponse,
)
from app.shared.services.device_trust_service import DeviceTrustService
from app.shared.services.qr_token_service import clerk_user_id_to_uuid

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Admin - Devices"])


def _get_service(db: AsyncSession) -> DeviceTrustService:
    return DeviceTrustService(db, get_sms_gateway())


# ---------------------------------------------------------------------------
# 1. GET / — List all registered devices
# ---------------------------------------------------------------------------

@router.get("/")
async def list_devices(
    status: str | None = Query(None, description="Filter by status: active, revoked, pending_sms_verification"),
    platform: str | None = Query(None, description="Filter by platform: android, ios"),
    search: str | None = Query(None, description="Search by phone or device model"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: CurrentUser = Depends(require_college_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all registered devices with pagination and filters."""
    query = select(DeviceTrust)

    if status:
        query = query.where(DeviceTrust.status == status)
    if platform:
        query = query.where(DeviceTrust.platform == platform)
    if search:
        search_term = f"%{search}%"
        query = query.where(
            DeviceTrust.verified_phone.ilike(search_term)
            | DeviceTrust.claimed_phone.ilike(search_term)
            | DeviceTrust.device_model.ilike(search_term)
        )

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(DeviceTrust.created_at.desc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    devices = result.scalars().all()

    return {
        "data": [DeviceTrustResponse.model_validate(d) for d in devices],
        "meta": {
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size if total else 0,
        },
    }


# ---------------------------------------------------------------------------
# 2. GET /flagged — Users with suspicious reset counts (BEFORE /{user_id})
# ---------------------------------------------------------------------------

@router.get("/flagged")
async def get_flagged_users(
    threshold: int = Query(3, ge=1, description="Minimum reset count to flag"),
    period_days: int = Query(30, ge=1, description="Look-back period in days"),
    user: CurrentUser = Depends(require_college_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get users flagged for suspicious numbers of device resets."""
    service = _get_service(db)
    flagged = await service.get_flagged_users(threshold=threshold, period_days=period_days)
    return {
        "data": [FlaggedUserResponse(**f) for f in flagged],
        "meta": {"threshold": threshold, "period_days": period_days},
    }


# ---------------------------------------------------------------------------
# 3. GET /stats — Device registration statistics
# ---------------------------------------------------------------------------

@router.get("/stats")
async def get_device_stats(
    user: CurrentUser = Depends(require_college_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get aggregate device registration statistics."""
    from datetime import datetime, timedelta, timezone

    # Total counts by status
    status_result = await db.execute(
        select(
            DeviceTrust.status,
            func.count(DeviceTrust.id).label("count"),
        ).group_by(DeviceTrust.status)
    )
    status_counts = {row.status: row.count for row in status_result.all()}

    # Platform breakdown
    platform_result = await db.execute(
        select(
            DeviceTrust.platform,
            func.count(DeviceTrust.id).label("count"),
        )
        .where(DeviceTrust.status == "active")
        .group_by(DeviceTrust.platform)
    )
    by_platform = {row.platform: row.count for row in platform_result.all()}

    # Registrations this week
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    week_result = await db.execute(
        select(func.count(DeviceTrust.id)).where(DeviceTrust.created_at >= week_ago)
    )
    registrations_this_week = week_result.scalar() or 0

    total = sum(status_counts.values())

    return {
        "total_registered": total,
        "active_count": status_counts.get("active", 0),
        "revoked_count": status_counts.get("revoked", 0),
        "pending_count": status_counts.get("pending_sms_verification", 0),
        "by_platform": by_platform,
        "registrations_this_week": registrations_this_week,
    }


# ---------------------------------------------------------------------------
# 4. GET /{user_id} — Get device info for a specific user
# ---------------------------------------------------------------------------

@router.get("/{user_id}")
async def get_user_device(
    user_id: UUID,
    user: CurrentUser = Depends(require_college_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get the active device for a specific user (by internal UUID)."""
    result = await db.execute(
        select(DeviceTrust).where(
            DeviceTrust.user_id == user_id,
            DeviceTrust.status == "active",
        )
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(404, "No active device found for this user")

    return DeviceTrustResponse.model_validate(device)


# ---------------------------------------------------------------------------
# 5. POST /{user_id}/reset — Admin-initiated device reset
# ---------------------------------------------------------------------------

@router.post("/{user_id}/reset")
async def reset_user_device(
    user_id: UUID,
    body: DeviceResetRequest,
    user: CurrentUser = Depends(require_college_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin-initiated device reset for a user.

    Revokes the user's active device and creates an audit log entry.
    """
    admin_uuid = clerk_user_id_to_uuid(user.user_id)
    service = _get_service(db)
    await service.revoke_device(user_id, body.reason, admin_id=admin_uuid)

    # Update admin_notes if provided
    if body.admin_notes:
        result = await db.execute(
            select(DeviceResetLog)
            .where(DeviceResetLog.user_id == user_id)
            .order_by(DeviceResetLog.reset_at.desc())
            .limit(1)
        )
        log = result.scalar_one_or_none()
        if log:
            log.admin_notes = body.admin_notes
            await db.flush()

    return {"status": "ok", "message": f"Device reset for user {user_id}"}
