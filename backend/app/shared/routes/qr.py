"""QR Engine API routes — user-facing QR generation and scanning.

Endpoints:
- GET  /api/v1/qr/identity         — Get identity QR token
- GET  /api/v1/qr/identity/refresh  — Force refresh QR token
- POST /api/v1/qr/scan/mode-a      — Scanner reads someone's QR
- POST /api/v1/qr/scan/mode-b      — User scans location QR
- POST /api/v1/qr/scan/mode-b/confirm — Confirm multi-step flow
- GET  /api/v1/qr/history           — Current user's scan history
- GET  /api/v1/qr/history/meals     — Filtered mess scan history
- GET  /api/v1/qr/history/library   — Filtered library scan history
- GET  /api/v1/qr/history/attendance — Filtered attendance scan history
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user, get_tenant_db
from app.middleware.clerk_auth import CurrentUser
from app.shared.models.device_trust import DeviceTrust
from app.shared.models.qr import QRScanLog
from app.shared.schemas.qr import (
    IdentityQRResponse,
    ModeAScanRequest,
    ModeBConfirmRequest,
    ModeBScanRequest,
    QRScanLogResponse,
    ScanResult,
)
from app.shared.services.qr_service import QRService
from app.shared.services.qr_token_service import clerk_user_id_to_uuid

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/qr", tags=["QR Engine"])


# ---------------------------------------------------------------------------
# Helper: get the user's active device (required for device-verified endpoints)
# ---------------------------------------------------------------------------

async def _get_active_device(user_id: UUID, db: AsyncSession) -> DeviceTrust | None:
    """Fetch the user's active trusted device."""
    result = await db.execute(
        select(DeviceTrust).where(
            DeviceTrust.user_id == user_id,
            DeviceTrust.status == "active",
        )
    )
    return result.scalar_one_or_none()


# ---------------------------------------------------------------------------
# 1. GET /identity — Get identity QR token
# ---------------------------------------------------------------------------

@router.get("/identity", response_model=IdentityQRResponse)
async def get_identity_qr(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Generate a rotating identity QR token for the current user.

    The mobile app displays this as a QR code. Scanners read it in Mode A.
    Requires an active trusted device.
    """
    uid = clerk_user_id_to_uuid(user.user_id)
    service = QRService(db)
    result = await service.generate_identity_qr(
        user_id=uid,
        college_id=user.college_id,
    )
    return IdentityQRResponse(**result)


# ---------------------------------------------------------------------------
# 2. GET /identity/refresh — Force refresh QR token
# ---------------------------------------------------------------------------

@router.get("/identity/refresh", response_model=IdentityQRResponse)
async def refresh_identity_qr(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Force-refresh the identity QR token.

    Same as /identity but intended for explicit refresh (e.g., after device transfer).
    """
    uid = clerk_user_id_to_uuid(user.user_id)
    service = QRService(db)
    result = await service.generate_identity_qr(
        user_id=uid,
        college_id=user.college_id,
    )
    return IdentityQRResponse(**result)


# ---------------------------------------------------------------------------
# 3. POST /scan/mode-a — Scanner reads someone's QR
# ---------------------------------------------------------------------------

@router.post("/scan/mode-a", response_model=ScanResult)
async def scan_mode_a(
    body: ModeAScanRequest,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Process a Mode A scan — scanner device reads a person's identity QR.

    The scanner (e.g., mess staff, gate guard) uses their device to scan
    the QR displayed on the target user's phone.
    """
    uid = clerk_user_id_to_uuid(user.user_id)
    scanner_device = await _get_active_device(uid, db)
    if not scanner_device:
        return ScanResult(
            success=False,
            message="No active trusted device — register your device first",
        )

    service = QRService(db)
    return await service.process_mode_a_scan(
        scanner_user_id=uid,
        scanner_device=scanner_device,
        scanned_qr_data=body.scanned_qr_data,
        action_point_id=body.action_point_id,
        gps=body.gps.model_dump() if body.gps else None,
    )


# ---------------------------------------------------------------------------
# 4. POST /scan/mode-b — User scans location QR
# ---------------------------------------------------------------------------

@router.post("/scan/mode-b", response_model=ScanResult)
async def scan_mode_b(
    body: ModeBScanRequest,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Process a Mode B scan — user scans a location/action QR code.

    The user scans a printed QR code at a location (e.g., mess entrance,
    library desk, hostel gate). The QR contains an acolyte:// URL.
    """
    uid = clerk_user_id_to_uuid(user.user_id)
    user_device = await _get_active_device(uid, db)
    if not user_device:
        return ScanResult(
            success=False,
            message="No active trusted device — register your device first",
        )

    service = QRService(db)
    return await service.process_mode_b_scan(
        user_id=uid,
        user_device=user_device,
        scanned_qr_data=body.scanned_qr_data,
        college_id=user.college_id,
        gps=body.gps.model_dump() if body.gps else None,
    )


# ---------------------------------------------------------------------------
# 5. POST /scan/mode-b/confirm — Confirm multi-step flow
# ---------------------------------------------------------------------------

@router.post("/scan/mode-b/confirm", response_model=ScanResult)
async def confirm_mode_b(
    body: ModeBConfirmRequest,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Confirm a multi-step Mode B scan (e.g., select which book to return).

    After the initial Mode B scan, some actions require a second step
    where the user selects a specific entity (book, equipment, etc.).
    """
    uid = clerk_user_id_to_uuid(user.user_id)

    # Get the original scan log
    result = await db.execute(
        select(QRScanLog).where(
            QRScanLog.id == body.scan_log_id,
            QRScanLog.user_id == uid,
            QRScanLog.validation_result == "success",
        )
    )
    scan_log = result.scalar_one_or_none()
    if not scan_log:
        return ScanResult(success=False, message="Scan log not found or not yours")

    # Update the scan log with the selected entity
    scan_log.entity_id = body.selected_entity_id
    scan_log.entity_type = scan_log.action_type  # Infer from action type
    await db.flush()

    return ScanResult(
        success=True,
        action_type=scan_log.action_type,
        message=f"Confirmed {scan_log.action_type} with entity",
        scan_log_id=scan_log.id,
    )


# ---------------------------------------------------------------------------
# 6. GET /history — Current user's scan history
# ---------------------------------------------------------------------------

@router.get("/history", response_model=list[QRScanLogResponse])
async def get_scan_history(
    action_type: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get the current user's QR scan history with optional filters."""
    uid = clerk_user_id_to_uuid(user.user_id)

    query = select(QRScanLog).where(
        QRScanLog.user_id == uid,
        QRScanLog.validation_result == "success",
    ).order_by(QRScanLog.scanned_at.desc())

    if action_type:
        query = query.where(QRScanLog.action_type == action_type)
    if date_from:
        query = query.where(QRScanLog.scanned_at >= date_from)
    if date_to:
        query = query.where(QRScanLog.scanned_at <= date_to)

    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    logs = result.scalars().all()
    return [QRScanLogResponse.model_validate(log) for log in logs]


# ---------------------------------------------------------------------------
# 7-9. GET /history/{type} — Filtered scan history shortcuts
# ---------------------------------------------------------------------------

@router.get("/history/meals", response_model=list[QRScanLogResponse])
async def get_meal_history(
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get the current user's mess entry history."""
    uid = clerk_user_id_to_uuid(user.user_id)
    query = (
        select(QRScanLog)
        .where(
            QRScanLog.user_id == uid,
            QRScanLog.action_type == "mess_entry",
            QRScanLog.validation_result == "success",
        )
        .order_by(QRScanLog.scanned_at.desc())
    )
    if date_from:
        query = query.where(QRScanLog.scanned_at >= date_from)
    if date_to:
        query = query.where(QRScanLog.scanned_at <= date_to)
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return [QRScanLogResponse.model_validate(log) for log in result.scalars().all()]


@router.get("/history/library", response_model=list[QRScanLogResponse])
async def get_library_history(
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get the current user's library checkout/return history."""
    uid = clerk_user_id_to_uuid(user.user_id)
    query = (
        select(QRScanLog)
        .where(
            QRScanLog.user_id == uid,
            QRScanLog.action_type.in_(["library_checkout", "library_return"]),
            QRScanLog.validation_result == "success",
        )
        .order_by(QRScanLog.scanned_at.desc())
    )
    if date_from:
        query = query.where(QRScanLog.scanned_at >= date_from)
    if date_to:
        query = query.where(QRScanLog.scanned_at <= date_to)
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return [QRScanLogResponse.model_validate(log) for log in result.scalars().all()]


@router.get("/history/attendance", response_model=list[QRScanLogResponse])
async def get_attendance_history(
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get the current user's attendance marking history."""
    uid = clerk_user_id_to_uuid(user.user_id)
    query = (
        select(QRScanLog)
        .where(
            QRScanLog.user_id == uid,
            QRScanLog.action_type == "attendance_mark",
            QRScanLog.validation_result == "success",
        )
        .order_by(QRScanLog.scanned_at.desc())
    )
    if date_from:
        query = query.where(QRScanLog.scanned_at >= date_from)
    if date_to:
        query = query.where(QRScanLog.scanned_at <= date_to)
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return [QRScanLogResponse.model_validate(log) for log in result.scalars().all()]
