"""Device Trust service — business logic for registration, verification, transfer, revocation."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.events import publish_event
from app.engines.integration.sms import SMSGateway
from app.shared.models.device_trust import (
    DeviceResetLog,
    DeviceTransferRequest,
    DeviceTrust,
)
from app.shared.services.qr_token_service import (
    compute_device_fingerprint,
    create_device_trust_token,
    generate_transfer_code,
    generate_verification_code,
    hash_verification_code,
    validate_device_trust_token,
)

logger = logging.getLogger(__name__)


class DeviceTrustService:
    """Manages device registration, SMS verification, transfer, and revocation."""

    def __init__(
        self,
        db: AsyncSession,
        sms_gateway: SMSGateway,
    ) -> None:
        self.db = db
        self.sms_gateway = sms_gateway

    # ── METHOD 1: Register Device ──

    async def register_device(
        self, user_id: UUID, phone_number: str, device_info: dict
    ) -> dict:
        """Initiate device registration with SMS verification.

        Returns verification details for the mobile app to trigger SMS.
        """
        # Check no active DeviceTrust exists for user
        result = await self.db.execute(
            select(DeviceTrust).where(
                DeviceTrust.user_id == user_id,
                DeviceTrust.status == "active",
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            raise HTTPException(
                409,
                "Account already registered to another device. "
                "Transfer or admin-reset required.",
            )

        # Compute fingerprint
        fingerprint = compute_device_fingerprint(device_info)

        # Generate verification code
        code = generate_verification_code(6)
        code_hash = hash_verification_code(code)

        # Create DeviceTrust record
        device = DeviceTrust(
            user_id=user_id,
            device_fingerprint=fingerprint,
            platform=device_info.get("platform", ""),
            device_id=device_info.get("device_id", ""),
            device_model=device_info.get("device_model", ""),
            device_manufacturer=device_info.get("device_manufacturer", ""),
            os_version=device_info.get("os_version", ""),
            app_version=device_info.get("app_version", ""),
            screen_width=device_info.get("screen_width", 0),
            screen_height=device_info.get("screen_height", 0),
            ram_mb=device_info.get("ram_mb", 0),
            sim_operator=device_info.get("sim_operator", ""),
            sim_country=device_info.get("sim_country", ""),
            claimed_phone=phone_number,
            verification_code_hash=code_hash,
            verification_code_expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
            status="pending_sms_verification",
        )
        self.db.add(device)
        await self.db.flush()

        virtual_number = self.sms_gateway.get_virtual_number()

        return {
            "verification_id": device.id,
            "sms_target_number": virtual_number,
            "sms_body_template": f"ACOLYTE VERIFY {code}",
            "verification_code": code,
            "expires_in_seconds": 600,
        }

    # ── METHOD 2: Process Incoming SMS ──

    async def process_incoming_sms(self, sender: str, message: str, gateway_message_id: str = "") -> bool:
        """Process an incoming SMS from the gateway webhook.

        Returns True if verification succeeded.
        """
        # Parse message — extract code from "ACOLYTE VERIFY {code}" format
        parts = message.strip().upper().split()
        if len(parts) < 3 or parts[0] != "ACOLYTE" or parts[1] != "VERIFY":
            logger.info("SMS parse failed: unexpected format '%s'", message[:50])
            return False

        code = parts[2]
        code_hash = hash_verification_code(code)

        # Find matching DeviceTrust
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)
        result = await self.db.execute(
            select(DeviceTrust).where(
                DeviceTrust.claimed_phone == sender,
                DeviceTrust.verification_code_hash == code_hash,
                DeviceTrust.status == "pending_sms_verification",
                DeviceTrust.created_at >= cutoff,
            )
        )
        device = result.scalar_one_or_none()

        if not device:
            logger.info(
                "SMS verification failed: no matching record for %s", sender[:6] + "****"
            )
            return False

        # Activate the device
        device.status = "active"
        device.verified_phone = sender
        device.phone_verified_at = datetime.now(timezone.utc)
        device.sms_verified = True
        device.sms_gateway_message_id = gateway_message_id

        # Generate and store device trust token
        token = create_device_trust_token(
            str(device.user_id), str(device.id), device.device_fingerprint
        )
        device.device_trust_token_hash = hash_verification_code(token)
        device.token_issued_at = datetime.now(timezone.utc)
        device.token_expires_at = datetime.now(timezone.utc) + timedelta(days=180)

        await self.db.flush()

        # Publish event
        try:
            await publish_event("device.registered", {
                "user_id": str(device.user_id),
                "device_model": device.device_model,
                "platform": device.platform,
            })
        except Exception:
            logger.warning("Failed to publish device.registered event", exc_info=True)

        logger.info("Device activated for user %s", device.user_id)
        return True

    # ── METHOD 3: Check Registration Status ──

    async def check_registration_status(self, user_id: UUID, verification_id: UUID) -> dict:
        """Check the status of a pending device registration."""
        result = await self.db.execute(
            select(DeviceTrust).where(
                DeviceTrust.id == verification_id,
                DeviceTrust.user_id == user_id,
            )
        )
        device = result.scalar_one_or_none()
        if not device:
            raise HTTPException(404, "Verification request not found")

        if device.status == "active":
            # Regenerate token for the response
            token = create_device_trust_token(
                str(device.user_id), str(device.id), device.device_fingerprint
            )
            return {
                "status": "active",
                "device_trust_token": token,
                "token_expires_at": device.token_expires_at,
            }
        elif device.status == "pending_sms_verification":
            return {"status": "pending", "message": "Waiting for SMS verification"}
        elif device.status == "verification_failed":
            return {"status": "failed", "message": "Verification failed"}
        else:
            return {"status": device.status, "message": f"Device status: {device.status}"}

    # ── METHOD 4: Validate Device ──

    async def validate_device(self, user_id: UUID, device_token: str) -> Optional[DeviceTrust]:
        """Validate a device trust token and return the active device record."""
        token_data = validate_device_trust_token(device_token)
        if not token_data:
            return None

        if token_data.get("sub") != str(user_id):
            return None

        result = await self.db.execute(
            select(DeviceTrust).where(
                DeviceTrust.id == UUID(token_data["did"]),
                DeviceTrust.status == "active",
            )
        )
        device = result.scalar_one_or_none()
        if device:
            device.last_active_at = datetime.now(timezone.utc)
            await self.db.flush()

        return device

    # ── METHOD 5: Initiate Transfer ──

    async def initiate_transfer(self, user_id: UUID) -> dict:
        """Start device transfer from old phone."""
        result = await self.db.execute(
            select(DeviceTrust).where(
                DeviceTrust.user_id == user_id,
                DeviceTrust.status == "active",
            )
        )
        device = result.scalar_one_or_none()
        if not device:
            raise HTTPException(404, "No active device to transfer from")

        code = generate_transfer_code(8)
        transfer = DeviceTransferRequest(
            user_id=user_id,
            old_device_trust_id=device.id,
            transfer_code_hash=hash_verification_code(code),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=15),
            status="pending",
        )
        self.db.add(transfer)
        await self.db.flush()

        return {"transfer_code": code, "expires_in": 900}

    # ── METHOD 6: Complete Transfer ──

    async def complete_transfer(
        self, user_id: UUID, transfer_code: str, new_device_info: dict
    ) -> dict:
        """Complete device transfer on new phone."""
        code_hash = hash_verification_code(transfer_code)
        now = datetime.now(timezone.utc)

        result = await self.db.execute(
            select(DeviceTransferRequest).where(
                DeviceTransferRequest.user_id == user_id,
                DeviceTransferRequest.transfer_code_hash == code_hash,
                DeviceTransferRequest.status == "pending",
                DeviceTransferRequest.expires_at > now,
            )
        )
        transfer = result.scalar_one_or_none()
        if not transfer:
            raise HTTPException(400, "Invalid or expired transfer code")

        # Revoke old device
        old_result = await self.db.execute(
            select(DeviceTrust).where(DeviceTrust.id == transfer.old_device_trust_id)
        )
        old_device = old_result.scalar_one_or_none()
        if old_device:
            old_device.status = "transferred"
            old_device.revoked_at = now

        # Mark transfer completed
        transfer.status = "completed"
        transfer.completed_at = now

        await self.db.flush()

        # Start new device registration
        phone = old_device.claimed_phone if old_device else ""
        reg_result = await self.register_device(user_id, phone, new_device_info)

        # Link transfer to new device
        transfer.new_device_trust_id = reg_result["verification_id"]
        await self.db.flush()

        try:
            await publish_event("device.transferred", {
                "user_id": str(user_id),
                "old_device_id": str(transfer.old_device_trust_id),
            })
        except Exception:
            logger.warning("Failed to publish device.transferred event", exc_info=True)

        return reg_result

    # ── METHOD 7: Revoke Device ──

    async def revoke_device(
        self, user_id: UUID, reason: str, admin_id: UUID | None = None
    ) -> None:
        """Revoke a user's active device."""
        result = await self.db.execute(
            select(DeviceTrust).where(
                DeviceTrust.user_id == user_id,
                DeviceTrust.status == "active",
            )
        )
        device = result.scalar_one_or_none()
        if not device:
            raise HTTPException(404, "No active device found for this user")

        device.status = "revoked"
        device.revoked_at = datetime.now(timezone.utc)
        device.revoked_by = admin_id
        device.revoke_reason = reason

        # Create audit log entry if admin-initiated
        if admin_id:
            reset_log = DeviceResetLog(
                user_id=user_id,
                device_trust_id=device.id,
                reset_by=admin_id,
                reset_reason=reason,
            )
            self.db.add(reset_log)

        await self.db.flush()

        try:
            await publish_event("device.revoked", {
                "user_id": str(user_id),
                "reason": reason,
                "revoked_by": str(admin_id) if admin_id else None,
            })
        except Exception:
            logger.warning("Failed to publish device.revoked event", exc_info=True)

    # ── METHOD 8: Get Flagged Users ──

    async def get_flagged_users(
        self, threshold: int = 3, period_days: int = 30
    ) -> list[dict]:
        """Get users with suspicious number of device resets."""
        cutoff = datetime.now(timezone.utc) - timedelta(days=period_days)
        result = await self.db.execute(
            select(
                DeviceResetLog.user_id,
                func.count(DeviceResetLog.id).label("reset_count"),
                func.max(DeviceResetLog.reset_at).label("last_reset_at"),
            )
            .where(DeviceResetLog.reset_at >= cutoff)
            .group_by(DeviceResetLog.user_id)
            .having(func.count(DeviceResetLog.id) >= threshold)
        )
        rows = result.all()
        return [
            {
                "user_id": row.user_id,
                "reset_count": row.reset_count,
                "last_reset_at": row.last_reset_at,
            }
            for row in rows
        ]
