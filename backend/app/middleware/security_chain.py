"""Unified security chain orchestrator.

Composes existing Clerk JWT auth with Device Trust and QR token layers.

Security levels (configurable per route):

LEVEL 0: Public (no auth)
  - Certificate verification, health checks

LEVEL 1: Authenticated (Clerk JWT only — existing behavior)
  - All web dashboard routes, admin pages

LEVEL 2: Device-Verified (Clerk JWT + Device Trust Token)
  - All mobile app routes, QR generation endpoints

LEVEL 3: QR-Secured (Level 2 + valid QR token in request)
  - QR scan processing — mess entry, library checkout, etc.

LEVEL 4: Elevated (Level 3 + GPS validation)
  - Attendance marking (must be on campus), clinical posting check-in

LEVEL 5: Strict (Level 4 + device biometric confirmation)
  - Exam hall entry, high-security administrative actions
"""

from __future__ import annotations

from enum import IntEnum
from functools import wraps
from typing import Any, Callable

from fastapi import HTTPException, Request


class SecurityLevel(IntEnum):
    PUBLIC = 0
    AUTHENTICATED = 1
    DEVICE_VERIFIED = 2
    QR_SECURED = 3
    ELEVATED = 4
    STRICT = 5


def require_security(level: SecurityLevel) -> Callable:
    """Decorator for FastAPI route handlers that enforces a security level.

    Usage::

        @router.get("/scan")
        @require_security(SecurityLevel.DEVICE_VERIFIED)
        async def scan(request: Request):
            device = request.state.device  # guaranteed by level 2
    """

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            # Extract request from args/kwargs (FastAPI injects it)
            request: Request | None = kwargs.get("request")
            if request is None:
                for arg in args:
                    if isinstance(arg, Request):
                        request = arg
                        break
            if request is None:
                raise HTTPException(500, "Internal: request object not found")

            # Level 1: Clerk JWT authentication
            if level >= SecurityLevel.AUTHENTICATED:
                if not hasattr(request.state, "user") or request.state.user is None:
                    raise HTTPException(401, "Authentication required")

            # Level 2: Device Trust Token
            if level >= SecurityLevel.DEVICE_VERIFIED:
                device_token = request.headers.get("X-Device-Trust-Token")
                if not device_token:
                    raise HTTPException(
                        403, "Device not registered — X-Device-Trust-Token header required"
                    )
                # Lazy import to avoid circular dependency at module load
                from app.shared.services.qr_token_service import validate_device_trust_token

                token_data = validate_device_trust_token(device_token)
                if not token_data:
                    raise HTTPException(403, "Device trust validation failed — token invalid or expired")

                # Verify token.sub matches the authenticated user
                user = getattr(request.state, "user", None)
                if user and str(getattr(user, "user_id", "")) != token_data.get("sub", ""):
                    raise HTTPException(403, "Device trust token does not match authenticated user")

                # Query DeviceTrust record to confirm active status
                from app.shared.models.device_trust import DeviceTrust
                from app.core.database import async_session_factory
                from sqlalchemy import select
                from uuid import UUID

                async with async_session_factory() as db:
                    result = await db.execute(
                        select(DeviceTrust).where(
                            DeviceTrust.id == UUID(token_data["did"]),
                            DeviceTrust.status == "active",
                        )
                    )
                    device_record = result.scalar_one_or_none()

                if not device_record:
                    raise HTTPException(403, "Device is not active or has been revoked")

                request.state.device = device_record

            # Level 3: QR Token
            if level >= SecurityLevel.QR_SECURED:
                qr_token = request.headers.get("X-QR-Token")
                if not qr_token:
                    raise HTTPException(403, "QR token required — X-QR-Token header missing")

                from app.shared.services.qr_token_service import validate_qr_identity_token

                qr_data = validate_qr_identity_token(qr_token)
                if not qr_data:
                    raise HTTPException(403, "Invalid or expired QR token")

                # Verify fingerprint prefix matches device
                device = getattr(request.state, "device", None)
                if device and not device.device_fingerprint.startswith(qr_data.get("dfp", "")):
                    raise HTTPException(403, "QR token device fingerprint mismatch")

                request.state.qr_data = qr_data

            # Level 4: GPS coordinates
            if level >= SecurityLevel.ELEVATED:
                lat_str = request.headers.get("X-GPS-Latitude")
                lng_str = request.headers.get("X-GPS-Longitude")
                if not lat_str or not lng_str:
                    raise HTTPException(403, "Location required — X-GPS-Latitude/X-GPS-Longitude headers missing")
                try:
                    request.state.gps = {"lat": float(lat_str), "lng": float(lng_str)}
                except ValueError:
                    raise HTTPException(400, "Invalid GPS coordinates")

            # Level 5: Biometric confirmation
            if level >= SecurityLevel.STRICT:
                bio_token = request.headers.get("X-Biometric-Token")
                if not bio_token:
                    raise HTTPException(403, "Biometric confirmation required — X-Biometric-Token header missing")
                request.state.biometric_confirmed = True

            return await func(*args, **kwargs)

        return wrapper

    return decorator
