"""Device Trust API routes — user-facing device registration and management.

Endpoints:
- POST /api/v1/device/register      — Initiate device registration
- POST /api/v1/device/resend-sms    — Resend verification SMS
- GET  /api/v1/device/status        — Poll registration status
- POST /api/v1/device/transfer/initiate  — Start device transfer (from old device)
- POST /api/v1/device/transfer/complete  — Complete transfer (from new device)
- DELETE /api/v1/device/revoke       — Self-revoke current device
"""

from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.engines.integration.sms import get_sms_gateway
from app.middleware.clerk_auth import CurrentUser
from app.shared.schemas.device import (
    DeviceStatusResponse,
    RegisterDeviceRequest,
    RegisterDeviceResponse,
    TransferCompleteRequest,
    TransferInitiateResponse,
)
from app.shared.services.device_trust_service import DeviceTrustService
from app.shared.services.qr_token_service import clerk_user_id_to_uuid

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/device", tags=["Device Trust"])


def _get_service(db: AsyncSession) -> DeviceTrustService:
    """Create a DeviceTrustService with the current DB session."""
    return DeviceTrustService(db, get_sms_gateway())


# ---------------------------------------------------------------------------
# 1. POST /register — Initiate device registration
# ---------------------------------------------------------------------------

@router.post("/register", response_model=RegisterDeviceResponse)
async def register_device(
    body: RegisterDeviceRequest,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Initiate device registration with SMS verification.

    Returns verification details — the mobile app prompts the user
    to send the given SMS body from their phone.
    """
    service = _get_service(db)
    uid = clerk_user_id_to_uuid(user.user_id)
    result = await service.register_device(
        user_id=uid,
        phone_number=body.phone_number,
        device_info=body.device_info.model_dump(),
    )
    return RegisterDeviceResponse(**result)


# ---------------------------------------------------------------------------
# 2. POST /resend-sms — Resend verification SMS
# ---------------------------------------------------------------------------

from pydantic import BaseModel  # noqa: E402


class ResendSMSBody(BaseModel):
    verification_id: UUID


@router.post("/resend-sms", response_model=RegisterDeviceResponse)
async def resend_sms(
    body: ResendSMSBody,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Resend verification code for a pending device registration.

    Generates a new code and updates the DeviceTrust record.
    """
    from app.shared.models.device_trust import DeviceTrust
    from app.shared.services.qr_token_service import (
        generate_verification_code,
        hash_verification_code,
    )
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import select

    uid = clerk_user_id_to_uuid(user.user_id)

    result = await db.execute(
        select(DeviceTrust).where(
            DeviceTrust.id == body.verification_id,
            DeviceTrust.user_id == uid,
            DeviceTrust.status == "pending_sms_verification",
        )
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(404, "Pending verification not found")

    # Regenerate code
    code = generate_verification_code(6)
    device.verification_code_hash = hash_verification_code(code)
    device.verification_code_expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    await db.flush()

    sms_gateway = get_sms_gateway()
    return RegisterDeviceResponse(
        verification_id=device.id,
        sms_target_number=sms_gateway.get_virtual_number(),
        sms_body_template=f"ACOLYTE VERIFY {code}",
        verification_code=code,
        expires_in_seconds=600,
    )


# ---------------------------------------------------------------------------
# 3. GET /status — Poll for registration status
# ---------------------------------------------------------------------------

@router.get("/status", response_model=DeviceStatusResponse)
async def check_status(
    verification_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Poll for device registration status.

    Returns 'pending' while waiting for SMS, 'active' with token when verified.
    """
    service = _get_service(db)
    uid = clerk_user_id_to_uuid(user.user_id)
    result = await service.check_registration_status(uid, verification_id)
    return DeviceStatusResponse(**result)


# ---------------------------------------------------------------------------
# 4. POST /transfer/initiate — Start device transfer (old device)
# ---------------------------------------------------------------------------

@router.post("/transfer/initiate", response_model=TransferInitiateResponse)
async def initiate_transfer(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start a device transfer from the currently trusted device.

    Returns a time-limited transfer code to enter on the new device.
    Must be called from the old (currently verified) device.
    """
    service = _get_service(db)
    uid = clerk_user_id_to_uuid(user.user_id)
    result = await service.initiate_transfer(uid)
    return TransferInitiateResponse(**result)


# ---------------------------------------------------------------------------
# 5. POST /transfer/complete — Complete transfer (new device)
# ---------------------------------------------------------------------------

@router.post("/transfer/complete", response_model=RegisterDeviceResponse)
async def complete_transfer(
    body: TransferCompleteRequest,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Complete device transfer on the new device.

    Validates the transfer code, revokes the old device, and starts
    a new device registration flow on the new device.
    """
    service = _get_service(db)
    uid = clerk_user_id_to_uuid(user.user_id)
    result = await service.complete_transfer(
        user_id=uid,
        transfer_code=body.transfer_code,
        new_device_info=body.device_info.model_dump(),
    )
    return RegisterDeviceResponse(**result)


# ---------------------------------------------------------------------------
# 6. DELETE /revoke — Self-revoke current device
# ---------------------------------------------------------------------------

@router.delete("/revoke", status_code=200)
async def revoke_device(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Self-revoke the current trusted device.

    After revocation, the user must re-register a device to use
    device-trust-secured features.
    """
    service = _get_service(db)
    uid = clerk_user_id_to_uuid(user.user_id)
    await service.revoke_device(uid, "self_revoked")
    return {"status": "ok", "message": "Device revoked successfully"}
