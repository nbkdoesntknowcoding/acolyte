"""QR Engine core service — scan processing pipeline and action handler registry.

Handles:
- Identity QR generation (rotating JWT for Mode A)
- Mode A scan processing (scanner reads person's QR)
- Mode B scan processing (person scans location QR)
- Action handler registry (engines register handlers at startup)
- GPS validation (Haversine formula)
- Duplicate scan prevention
"""

from __future__ import annotations

import logging
import math
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Optional
from urllib.parse import parse_qs, urlparse
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.events import publish_event
from app.shared.models.device_trust import DeviceTrust
from app.shared.models.qr import QRActionPoint, QRScanLog
from app.shared.schemas.qr import ScanResult
from app.shared.services.qr_token_service import (
    create_action_point_signature,
    create_qr_identity_token,
    validate_qr_identity_token,
)

logger = logging.getLogger(__name__)

# Type alias for action handlers
ActionHandler = Callable[..., Any]


class QRService:
    """Core QR processing service with pluggable action handlers."""

    # Class-level handler registry (shared across instances)
    _action_handlers: dict[str, ActionHandler] = {}

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self._settings = get_settings()

    # ── Handler Registry ──

    @classmethod
    def register_handler(cls, action_type: str, handler: ActionHandler) -> None:
        """Register an action handler for a specific action type.

        Called by engines at app startup to wire their business logic.
        """
        cls._action_handlers[action_type] = handler
        logger.info("QR handler registered: %s", action_type)

    # ── Identity QR Generation (Mode A) ──

    async def generate_identity_qr(
        self,
        user_id: UUID,
        college_id: UUID,
        user_type: str = "stu",
    ) -> dict:
        """Generate a rotating identity QR token for the user.

        The mobile app displays this as a QR code, refreshing periodically.
        """
        result = await self.db.execute(
            select(DeviceTrust).where(
                DeviceTrust.user_id == user_id,
                DeviceTrust.status == "active",
            )
        )
        device = result.scalar_one_or_none()
        if not device:
            raise HTTPException(403, "No registered device — register your device first")

        token = create_qr_identity_token(
            user_id=str(user_id),
            device_fingerprint=device.device_fingerprint,
            college_id=str(college_id),
            user_type=user_type,
        )

        return {
            "token": token,
            "expires_in": self._settings.QR_IDENTITY_TOKEN_EXPIRY_SECONDS,
            "refresh_in": self._settings.QR_IDENTITY_REFRESH_SECONDS,
        }

    # ── Mode A: Scanner reads person's QR ──

    async def process_mode_a_scan(
        self,
        scanner_user_id: UUID,
        scanner_device: DeviceTrust,
        scanned_qr_data: str,
        action_point_id: UUID,
        gps: Optional[dict] = None,
    ) -> ScanResult:
        """Process a Mode A scan — scanner device reads a person's identity QR.

        Full pipeline:
        1. Decode QR JWT
        2. Extract target_user_id
        3. Verify device trust is active
        4. Verify fingerprint prefix
        5. Get action point config
        6. GPS validation
        7. Duplicate check
        8. Execute action handler
        9. Log scan
        10. Publish event
        """
        # 1. Decode QR JWT
        token_data = validate_qr_identity_token(scanned_qr_data)
        if not token_data:
            return await self._log_failed_scan(
                scanner_user_id, "mode_a", "expired_token", "QR token expired or invalid"
            )

        # 2. Extract target user
        target_user_id = UUID(token_data["sub"])
        target_fingerprint = token_data.get("dfp", "")
        target_college_id = token_data.get("cid")
        target_user_type = token_data.get("utp", "stu")

        # 3. Verify device trust for target
        result = await self.db.execute(
            select(DeviceTrust).where(
                DeviceTrust.user_id == target_user_id,
                DeviceTrust.status == "active",
            )
        )
        target_device = result.scalar_one_or_none()
        if not target_device:
            return await self._log_failed_scan(
                target_user_id, "mode_a", "revoked_device", "Target user has no active device"
            )

        # 4. Verify fingerprint prefix
        if not target_device.device_fingerprint.startswith(target_fingerprint[:8]):
            return await self._log_failed_scan(
                target_user_id, "mode_a", "device_mismatch", "Device fingerprint mismatch"
            )

        # 5. Get action point
        ap_result = await self.db.execute(
            select(QRActionPoint).where(
                QRActionPoint.id == action_point_id,
                QRActionPoint.is_active == True,  # noqa: E712
            )
        )
        action_point = ap_result.scalar_one_or_none()
        if not action_point:
            return await self._log_failed_scan(
                target_user_id, "mode_a", "invalid_qr", "Action point not found or inactive"
            )

        # 6. GPS validation
        if action_point.security_level in ("elevated", "strict") and gps:
            if not self._validate_geo(
                gps, action_point.gps_latitude, action_point.gps_longitude,
                action_point.geo_radius_meters or 100,
            ):
                return await self._log_failed_scan(
                    target_user_id, "mode_a", "geo_violation",
                    "Device outside allowed GPS radius",
                    action_point_id=action_point_id,
                    gps=gps,
                )

        # 7. Duplicate check
        if await self._check_duplicate(
            target_user_id, action_point.action_type,
            action_point.duplicate_window_minutes or 0,
        ):
            return await self._log_failed_scan(
                target_user_id, "mode_a", "duplicate_scan",
                f"Duplicate scan within {action_point.duplicate_window_minutes} minutes",
                action_point_id=action_point_id,
            )

        # 8. Execute action handler
        handler = self._action_handlers.get(action_point.action_type)
        handler_result = {}
        if handler:
            try:
                handler_result = await handler(
                    user_id=target_user_id,
                    action_point=action_point,
                    device_trust=target_device,
                    gps=gps,
                    db=self.db,
                )
            except Exception as e:
                logger.error("Action handler error: %s", e, exc_info=True)
                handler_result = {"error": str(e)}

        # 9. Create scan log
        scan_log = QRScanLog(
            college_id=action_point.college_id,
            user_id=target_user_id,
            user_type=target_user_type,
            device_trust_id=target_device.id,
            action_type=action_point.action_type,
            action_point_id=action_point.id,
            qr_mode="mode_a",
            scan_latitude=gps.get("lat") if gps else None,
            scan_longitude=gps.get("lng") if gps else None,
            geo_validated=True if gps and action_point.security_level in ("elevated", "strict") else None,
            device_validated=True,
            validation_result="success",
            extra_data=handler_result,
        )
        self.db.add(scan_log)
        await self.db.flush()

        # 10. Publish event
        try:
            await publish_event("qr.scan.success", {
                "user_id": str(target_user_id),
                "action_type": action_point.action_type,
                "action_point_id": str(action_point.id),
                "qr_mode": "mode_a",
            })
        except Exception:
            logger.warning("Failed to publish qr.scan.success event", exc_info=True)

        return ScanResult(
            success=True,
            action_type=action_point.action_type,
            message=handler_result.get("message", "Scan successful"),
            data=handler_result,
            scan_log_id=scan_log.id,
        )

    # ── Mode B: Person scans location QR ──

    async def process_mode_b_scan(
        self,
        user_id: UUID,
        user_device: DeviceTrust,
        scanned_qr_data: str,
        college_id: UUID,
        gps: Optional[dict] = None,
    ) -> ScanResult:
        """Process a Mode B scan — user scans a location/action QR code.

        Parses the acolyte:// URL, validates HMAC signature, then runs
        the same pipeline as Mode A (steps 5-11).
        """
        # Parse the QR URL
        parsed = self._parse_action_qr(scanned_qr_data)
        if not parsed:
            return await self._log_failed_scan(
                user_id, "mode_b", "invalid_qr", "Invalid QR code format"
            )

        action_type = parsed["action_type"]
        ap_id = parsed.get("action_point_id")
        location_code = parsed.get("location_code")
        signature = parsed.get("signature", "")
        rotation_key = parsed.get("rotation_key")

        # Get action point
        query = select(QRActionPoint).where(QRActionPoint.is_active == True)  # noqa: E712
        if ap_id:
            query = query.where(QRActionPoint.id == UUID(ap_id))
        elif location_code:
            query = query.where(
                QRActionPoint.college_id == college_id,
                QRActionPoint.location_code == location_code,
            )
        else:
            return await self._log_failed_scan(
                user_id, "mode_b", "invalid_qr", "No action point identifier in QR"
            )

        ap_result = await self.db.execute(query)
        action_point = ap_result.scalar_one_or_none()
        if not action_point:
            return await self._log_failed_scan(
                user_id, "mode_b", "invalid_qr", "Action point not found"
            )

        # Validate HMAC signature
        expected_sig = create_action_point_signature(
            str(action_point.id),
            action_point.action_type,
            action_point.location_code,
            str(action_point.college_id),
            rotation_key or "",
        )
        if signature != expected_sig:
            return await self._log_failed_scan(
                user_id, "mode_b", "invalid_qr",
                "QR signature mismatch — possible tampered or expired QR",
                action_point_id=action_point.id,
            )

        # GPS validation
        if action_point.security_level in ("elevated", "strict") and gps:
            if not self._validate_geo(
                gps, action_point.gps_latitude, action_point.gps_longitude,
                action_point.geo_radius_meters or 100,
            ):
                return await self._log_failed_scan(
                    user_id, "mode_b", "geo_violation",
                    "Device outside allowed GPS radius",
                    action_point_id=action_point.id,
                    gps=gps,
                )

        # Duplicate check
        if await self._check_duplicate(
            user_id, action_point.action_type,
            action_point.duplicate_window_minutes or 0,
        ):
            return await self._log_failed_scan(
                user_id, "mode_b", "duplicate_scan",
                f"Duplicate scan within {action_point.duplicate_window_minutes} minutes",
                action_point_id=action_point.id,
            )

        # Execute action handler
        handler = self._action_handlers.get(action_point.action_type)
        handler_result = {}
        if handler:
            try:
                handler_result = await handler(
                    user_id=user_id,
                    action_point=action_point,
                    device_trust=user_device,
                    gps=gps,
                    db=self.db,
                )
            except Exception as e:
                logger.error("Action handler error: %s", e, exc_info=True)
                handler_result = {"error": str(e)}

        # Create scan log
        scan_log = QRScanLog(
            college_id=action_point.college_id,
            user_id=user_id,
            device_trust_id=user_device.id,
            action_type=action_point.action_type,
            action_point_id=action_point.id,
            qr_mode="mode_b",
            scan_latitude=gps.get("lat") if gps else None,
            scan_longitude=gps.get("lng") if gps else None,
            geo_validated=True if gps and action_point.security_level in ("elevated", "strict") else None,
            device_validated=True,
            validation_result="success",
            extra_data=handler_result,
        )
        self.db.add(scan_log)
        await self.db.flush()

        try:
            await publish_event("qr.scan.success", {
                "user_id": str(user_id),
                "action_type": action_point.action_type,
                "action_point_id": str(action_point.id),
                "qr_mode": "mode_b",
            })
        except Exception:
            logger.warning("Failed to publish qr.scan.success event", exc_info=True)

        return ScanResult(
            success=True,
            action_type=action_point.action_type,
            message=handler_result.get("message", "Scan successful"),
            data=handler_result,
            scan_log_id=scan_log.id,
        )

    # ── Internal helpers ──

    @staticmethod
    def _validate_geo(
        user_gps: dict,
        target_lat: Optional[float],
        target_lng: Optional[float],
        radius_meters: int,
    ) -> bool:
        """Check if user GPS is within radius of target using Haversine formula."""
        if target_lat is None or target_lng is None:
            return True  # No target coordinates — skip validation

        lat1 = math.radians(user_gps["lat"])
        lat2 = math.radians(target_lat)
        dlat = math.radians(target_lat - user_gps["lat"])
        dlng = math.radians(target_lng - user_gps["lng"])

        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        distance = 6371000 * c  # Earth radius in meters

        return distance <= radius_meters

    @staticmethod
    def _parse_action_qr(qr_data: str) -> Optional[dict]:
        """Parse an acolyte:// Mode B QR URL.

        Format: acolyte://v1/{action}?ap={id}&lc={code}&c={college}&sig={sig}&r={rotation}&e={entity_id}

        Note: urlparse treats 'v1' as netloc (host) and '/{action}' as path.
        """
        try:
            parsed = urlparse(qr_data)
            if parsed.scheme != "acolyte":
                return None

            # urlparse: netloc = "v1", path = "/{action_type}"
            if parsed.netloc != "v1":
                return None

            action_type = parsed.path.strip("/")
            if not action_type:
                return None
            params = parse_qs(parsed.query)

            return {
                "action_type": action_type,
                "action_point_id": params.get("ap", [None])[0],
                "location_code": params.get("lc", [None])[0],
                "college_id": params.get("c", [None])[0],
                "entity_id": params.get("e", [None])[0],
                "signature": params.get("sig", [""])[0],
                "rotation_key": params.get("r", [None])[0],
            }
        except Exception:
            return None

    async def _check_duplicate(
        self, user_id: UUID, action_type: str, window_minutes: int
    ) -> bool:
        """Check if there's a recent successful scan for this user+action."""
        if window_minutes == 0:
            return False

        cutoff = datetime.now(timezone.utc) - timedelta(minutes=window_minutes)
        result = await self.db.execute(
            select(QRScanLog.id).where(
                QRScanLog.user_id == user_id,
                QRScanLog.action_type == action_type,
                QRScanLog.validation_result == "success",
                QRScanLog.scanned_at >= cutoff,
            ).limit(1)
        )
        return result.scalar_one_or_none() is not None

    async def _log_failed_scan(
        self,
        user_id: UUID,
        qr_mode: str,
        result: str,
        reason: str,
        action_point_id: Optional[UUID] = None,
        gps: Optional[dict] = None,
    ) -> ScanResult:
        """Create a failed scan log entry and return failure result."""
        scan_log = QRScanLog(
            college_id=UUID("00000000-0000-0000-0000-000000000000"),  # Sentinel for failed scans
            user_id=user_id,
            action_type="unknown",
            qr_mode=qr_mode,
            action_point_id=action_point_id,
            scan_latitude=gps.get("lat") if gps else None,
            scan_longitude=gps.get("lng") if gps else None,
            device_validated=False,
            validation_result=result,
            rejection_reason=reason,
        )
        self.db.add(scan_log)
        await self.db.flush()

        return ScanResult(
            success=False,
            message=reason,
            scan_log_id=scan_log.id,
        )
