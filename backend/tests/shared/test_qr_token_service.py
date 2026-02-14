"""Tests for QR token service — cryptographic operations."""

import os
import time
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import jwt
import pytest

# Set test secrets BEFORE importing the service
os.environ.setdefault("DEVICE_TRUST_SECRET", "test-device-trust-secret-key-32chars!")
os.environ.setdefault("QR_TOKEN_SECRET", "test-qr-token-secret-key-32chars-ok!")
os.environ.setdefault("QR_ACTION_POINT_SECRET", "test-action-point-hmac-secret-key!")

from app.shared.services.qr_token_service import (
    compute_device_fingerprint,
    create_action_point_signature,
    create_device_trust_token,
    create_qr_identity_token,
    generate_transfer_code,
    generate_verification_code,
    hash_verification_code,
    validate_device_trust_token,
    validate_qr_identity_token,
)


# ---------------------------------------------------------------------------
# Device Fingerprint
# ---------------------------------------------------------------------------


class TestComputeDeviceFingerprint:
    def test_deterministic(self):
        """Same input produces same fingerprint."""
        info = {
            "device_id": "abc123",
            "platform": "android",
            "device_model": "Samsung Galaxy A14",
            "screen_width": 1080,
            "screen_height": 2340,
        }
        fp1 = compute_device_fingerprint(info)
        fp2 = compute_device_fingerprint(info)
        assert fp1 == fp2
        assert len(fp1) == 64  # SHA-256 hex

    def test_different_devices(self):
        """Different device info produces different fingerprint."""
        info_a = {
            "device_id": "device_a",
            "platform": "android",
            "device_model": "Samsung Galaxy A14",
            "screen_width": 1080,
            "screen_height": 2340,
        }
        info_b = {
            "device_id": "device_b",
            "platform": "ios",
            "device_model": "iPhone 15",
            "screen_width": 1179,
            "screen_height": 2556,
        }
        assert compute_device_fingerprint(info_a) != compute_device_fingerprint(info_b)

    def test_excludes_volatile_fields(self):
        """app_version and os_version changes should NOT affect fingerprint."""
        base = {
            "device_id": "abc123",
            "platform": "android",
            "device_model": "Samsung",
            "screen_width": 1080,
            "screen_height": 2340,
        }
        with_v1 = {**base, "app_version": "1.0.0", "os_version": "13"}
        with_v2 = {**base, "app_version": "2.0.0", "os_version": "14"}
        assert compute_device_fingerprint(with_v1) == compute_device_fingerprint(with_v2)


# ---------------------------------------------------------------------------
# Device Trust Token
# ---------------------------------------------------------------------------


class TestDeviceTrustToken:
    def test_roundtrip(self):
        """Create → validate → decoded matches."""
        token = create_device_trust_token(
            user_id="user-123",
            device_trust_id="dt-456",
            device_fingerprint="abcdef0123456789" * 4,
        )
        decoded = validate_device_trust_token(token)
        assert decoded is not None
        assert decoded["sub"] == "user-123"
        assert decoded["did"] == "dt-456"
        assert decoded["dfp"] == "abcdef0123456789"  # first 16 chars
        assert decoded["typ"] == "device_trust"

    def test_expired_token(self):
        """Expired token returns None."""
        from app.config import get_settings

        settings = get_settings()
        now = datetime.now(timezone.utc)
        payload = {
            "sub": "user-123",
            "did": "dt-456",
            "dfp": "fingerprint12345",
            "typ": "device_trust",
            "iat": now - timedelta(days=200),
            "exp": now - timedelta(days=1),  # expired
        }
        token = jwt.encode(payload, settings.DEVICE_TRUST_SECRET, algorithm="HS256")
        assert validate_device_trust_token(token) is None

    def test_wrong_type_rejected(self):
        """Token with wrong typ field is rejected."""
        from app.config import get_settings

        settings = get_settings()
        now = datetime.now(timezone.utc)
        payload = {
            "sub": "user-123",
            "did": "dt-456",
            "dfp": "fingerprint12345",
            "typ": "wrong_type",
            "iat": now,
            "exp": now + timedelta(days=180),
        }
        token = jwt.encode(payload, settings.DEVICE_TRUST_SECRET, algorithm="HS256")
        assert validate_device_trust_token(token) is None

    def test_wrong_secret_rejected(self):
        """Token signed with wrong secret is rejected."""
        now = datetime.now(timezone.utc)
        payload = {
            "sub": "user-123",
            "did": "dt-456",
            "dfp": "fingerprint12345",
            "typ": "device_trust",
            "iat": now,
            "exp": now + timedelta(days=180),
        }
        token = jwt.encode(payload, "wrong-secret-key", algorithm="HS256")
        assert validate_device_trust_token(token) is None


# ---------------------------------------------------------------------------
# QR Identity Token
# ---------------------------------------------------------------------------


class TestQRIdentityToken:
    def test_roundtrip(self):
        """Create → validate → decoded matches."""
        token = create_qr_identity_token(
            user_id="user-789",
            device_fingerprint="abcdef0123456789" * 4,
            college_id="college-abc-123-456",
            user_type="student",
        )
        decoded = validate_qr_identity_token(token)
        assert decoded is not None
        assert decoded["sub"] == "user-789"
        assert decoded["typ"] == "identity_qr"
        assert decoded["dfp"] == "abcdef0123456789"
        assert decoded["col"] == "college-"  # first 8 chars
        assert decoded["utp"] == "stu"  # first 3 chars

    def test_wrong_secret_rejected(self):
        """Token signed with wrong secret is rejected."""
        now = datetime.now(timezone.utc)
        payload = {
            "sub": "user-789",
            "typ": "identity_qr",
            "dfp": "fingerprint12345",
            "col": "college1",
            "utp": "stu",
            "iat": now,
            "exp": now + timedelta(seconds=300),
        }
        token = jwt.encode(payload, "wrong-secret", algorithm="HS256")
        assert validate_qr_identity_token(token) is None

    def test_expired_token_rejected(self):
        """Expired QR identity token is rejected."""
        from app.config import get_settings

        settings = get_settings()
        now = datetime.now(timezone.utc)
        payload = {
            "sub": "user-789",
            "typ": "identity_qr",
            "dfp": "fingerprint12345",
            "col": "college1",
            "utp": "stu",
            "iat": now - timedelta(seconds=600),
            "exp": now - timedelta(seconds=1),
        }
        token = jwt.encode(payload, settings.QR_TOKEN_SECRET, algorithm="HS256")
        assert validate_qr_identity_token(token) is None


# ---------------------------------------------------------------------------
# Action Point Signature
# ---------------------------------------------------------------------------


class TestActionPointSignature:
    def test_deterministic(self):
        """Same inputs produce same signature."""
        sig1 = create_action_point_signature(
            "ap-001", "mess_entry", "mess_main_1", "college-abc", "20260213100000"
        )
        sig2 = create_action_point_signature(
            "ap-001", "mess_entry", "mess_main_1", "college-abc", "20260213100000"
        )
        assert sig1 == sig2
        assert len(sig1) == 32  # truncated HMAC

    def test_different_inputs_differ(self):
        """Different inputs produce different signatures."""
        sig1 = create_action_point_signature(
            "ap-001", "mess_entry", "mess_main_1", "college-abc", "key1"
        )
        sig2 = create_action_point_signature(
            "ap-002", "library_checkout", "lib_desk_1", "college-xyz", "key2"
        )
        assert sig1 != sig2

    def test_rotation_key_changes_signature(self):
        """Different rotation keys produce different signatures."""
        sig1 = create_action_point_signature(
            "ap-001", "attendance_mark", "anat_lh_1", "college-abc", "rotation_1"
        )
        sig2 = create_action_point_signature(
            "ap-001", "attendance_mark", "anat_lh_1", "college-abc", "rotation_2"
        )
        assert sig1 != sig2


# ---------------------------------------------------------------------------
# Verification Codes
# ---------------------------------------------------------------------------


class TestVerificationCodes:
    def test_verification_code_length(self):
        """Generated code has correct length."""
        code = generate_verification_code(6)
        assert len(code) == 6
        assert code.isdigit()

    def test_transfer_code_length(self):
        """Transfer code is 8 digits."""
        code = generate_transfer_code(8)
        assert len(code) == 8
        assert code.isdigit()

    def test_verification_code_randomness(self):
        """100 codes should all be different (statistically)."""
        codes = {generate_verification_code() for _ in range(100)}
        # With 6 digits (1M possibilities), 100 unique codes is virtually certain
        assert len(codes) == 100

    def test_hash_is_deterministic(self):
        """Same code hashes the same way."""
        code = "847293"
        h1 = hash_verification_code(code)
        h2 = hash_verification_code(code)
        assert h1 == h2
        assert len(h1) == 64  # SHA-256 hex

    def test_hash_is_different_for_different_codes(self):
        """Different codes hash differently."""
        h1 = hash_verification_code("123456")
        h2 = hash_verification_code("654321")
        assert h1 != h2
