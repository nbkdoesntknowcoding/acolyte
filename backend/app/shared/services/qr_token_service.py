"""Cryptographic services for Device Trust and QR tokens.

Provides:
- Device fingerprint computation (SHA-256)
- Device trust token creation/validation (HS256 JWT, 180-day)
- QR identity token creation/validation (HS256 JWT, 5-min)
- Action point HMAC signatures for Mode B QR codes
- Verification/transfer code generation and hashing
"""

from __future__ import annotations

import hashlib
import hmac as hmac_mod
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt

from app.config import get_settings


def compute_device_fingerprint(device_info: dict) -> str:
    """Generate a deterministic fingerprint from device attributes.

    We hash attributes that are:
    1. Stable across app reinstalls (device_id persists)
    2. Unique per physical device
    3. Not easily spoofable

    Deliberately EXCLUDED (these change):
    - app_version, os_version, sim_operator
    """
    components = [
        device_info.get("device_id", ""),
        device_info.get("platform", ""),
        device_info.get("device_model", ""),
        str(device_info.get("screen_width", 0)),
        str(device_info.get("screen_height", 0)),
    ]
    raw = "|".join(components)
    return hashlib.sha256(raw.encode()).hexdigest()


def create_device_trust_token(
    user_id: str,
    device_trust_id: str,
    device_fingerprint: str,
) -> str:
    """Create a long-lived device trust token (HS256 JWT).

    Stored on device in Keychain/Keystore via expo-secure-store.
    180-day expiry by default.
    """
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "did": str(device_trust_id),
        "dfp": device_fingerprint[:16],
        "typ": "device_trust",
        "iat": now,
        "exp": now + timedelta(days=settings.DEVICE_TOKEN_EXPIRY_DAYS),
    }
    return jwt.encode(payload, settings.DEVICE_TRUST_SECRET, algorithm="HS256")


def validate_device_trust_token(token: str) -> Optional[dict]:
    """Decode and validate a device trust token.

    Returns decoded payload or None on any error.
    """
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.DEVICE_TRUST_SECRET,
            algorithms=["HS256"],
            options={"require": ["sub", "did", "dfp", "typ", "exp"]},
        )
        if payload.get("typ") != "device_trust":
            return None
        return payload
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


def create_qr_identity_token(
    user_id: str,
    device_fingerprint: str,
    college_id: str,
    user_type: str,
) -> str:
    """Create a short-lived QR identity token (5-min expiry).

    This is what gets encoded into the QR code the user shows.
    Auto-refreshes every 60 seconds on the mobile app.
    """
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "typ": "identity_qr",
        "dfp": device_fingerprint[:16],
        "col": str(college_id)[:8],
        "utp": user_type[:3],
        "iat": now,
        "exp": now + timedelta(seconds=settings.QR_IDENTITY_TOKEN_EXPIRY_SECONDS),
    }
    return jwt.encode(payload, settings.QR_TOKEN_SECRET, algorithm="HS256")


def validate_qr_identity_token(token: str) -> Optional[dict]:
    """Validate and decode a QR identity token.

    Returns decoded payload or None on any error.
    """
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.QR_TOKEN_SECRET,
            algorithms=["HS256"],
            options={"require": ["sub", "typ", "dfp", "col", "exp"]},
        )
        if payload.get("typ") != "identity_qr":
            return None
        return payload
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


def create_admin_identity_token(
    user_id: str,
    college_id: str,
) -> str:
    """Create a short-lived admin identity QR token (5-min expiry).

    Same JWT format as create_qr_identity_token() but does NOT require
    a DeviceTrust / device fingerprint.  Used by admin users who need
    an identity QR without going through the device-trust flow.

    dfp is hardcoded to "admin" and typ is "admin_identity_qr".
    """
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "typ": "admin_identity_qr",
        "dfp": "admin",
        "col": str(college_id)[:8],
        "iat": now,
        "exp": now + timedelta(seconds=300),
    }
    return jwt.encode(payload, settings.QR_TOKEN_SECRET, algorithm="HS256")


def create_action_point_signature(
    action_point_id: str,
    action_type: str,
    location_code: str,
    college_id: str,
    rotation_key: str,
) -> str:
    """Sign a Mode B (location) QR code with HMAC-SHA256.

    Returns first 32 chars of hex digest for shorter QR codes.
    """
    settings = get_settings()
    message = f"{action_point_id}:{action_type}:{location_code}:{college_id}:{rotation_key}"
    return hmac_mod.new(
        settings.QR_ACTION_POINT_SECRET.encode(),
        message.encode(),
        hashlib.sha256,
    ).hexdigest()[:32]


def hash_verification_code(code: str) -> str:
    """SHA-256 hash of a verification code (never store plaintext)."""
    return hashlib.sha256(code.encode()).hexdigest()


def generate_verification_code(length: int = 6) -> str:
    """Generate a cryptographically secure random numeric code."""
    return str(secrets.randbelow(10**length)).zfill(length)


def generate_transfer_code(length: int = 8) -> str:
    """Generate a cryptographically secure 8-digit transfer code."""
    return str(secrets.randbelow(10**length)).zfill(length)


# ---------------------------------------------------------------------------
# Clerk user_id → UUID bridge
# ---------------------------------------------------------------------------

import uuid as _uuid

# Fixed namespace for Clerk user_id → deterministic UUID5 mapping
_CLERK_USER_NS = _uuid.UUID("a1b2c3d4-e5f6-7890-abcd-ef1234567890")


def clerk_user_id_to_uuid(clerk_user_id: str) -> _uuid.UUID:
    """Convert a Clerk user_id string (e.g. 'user_2nFZ...') to a deterministic UUID.

    Uses UUID5 (SHA-1 based, RFC 4122) so the same Clerk ID always maps to
    the same UUID.  This bridges Clerk's string IDs to the UUID user_id
    columns in platform-level tables (DeviceTrust, QRScanLog, etc.).
    """
    return _uuid.uuid5(_CLERK_USER_NS, clerk_user_id)
