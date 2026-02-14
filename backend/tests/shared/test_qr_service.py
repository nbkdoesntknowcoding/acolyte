"""Tests for QR Engine core service."""

import os
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

os.environ.setdefault("DEVICE_TRUST_SECRET", "test-device-trust-secret-key-32chars!")
os.environ.setdefault("QR_TOKEN_SECRET", "test-qr-token-secret-key-32chars-ok!")
os.environ.setdefault("QR_ACTION_POINT_SECRET", "test-action-point-hmac-secret-key!")

from app.shared.services.qr_service import QRService
from app.shared.services.qr_token_service import (
    create_action_point_signature,
    create_qr_identity_token,
)


def _make_mock_db():
    """Create a mock async DB session."""
    db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_result.scalars.return_value.all.return_value = []
    db.execute.return_value = mock_result
    db.flush = AsyncMock()

    def _add_with_id(obj):
        if hasattr(obj, "id") and obj.id is None:
            obj.id = uuid4()

    db.add = MagicMock(side_effect=_add_with_id)
    return db


def _make_mock_device(user_id=None, fingerprint=None):
    """Create a mock DeviceTrust."""
    device = MagicMock()
    device.id = uuid4()
    device.user_id = user_id or uuid4()
    device.device_fingerprint = fingerprint or "a" * 64
    device.status = "active"
    device.platform = "android"
    device.device_model = "Test Device"
    return device


def _make_mock_action_point(college_id=None, action_type="mess_entry", qr_mode="mode_a"):
    """Create a mock QRActionPoint."""
    ap = MagicMock()
    ap.id = uuid4()
    ap.college_id = college_id or uuid4()
    ap.name = "Test Action Point"
    ap.action_type = action_type
    ap.location_code = "test_loc_1"
    ap.qr_mode = qr_mode
    ap.security_level = "standard"
    ap.gps_latitude = 12.9716
    ap.gps_longitude = 77.5946
    ap.geo_radius_meters = 100
    ap.duplicate_window_minutes = 30
    ap.is_active = True
    ap.qr_secret = "test-secret"
    ap.qr_rotation_minutes = 0
    return ap


class TestGenerateIdentityQR:
    @pytest.mark.asyncio
    async def test_generate_identity_qr_active_device(self):
        """Active device generates a valid identity QR token."""
        db = _make_mock_db()
        user_id = uuid4()
        college_id = uuid4()
        device = _make_mock_device(user_id)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = device
        db.execute.return_value = mock_result

        service = QRService(db)
        result = await service.generate_identity_qr(user_id, college_id)

        assert "token" in result
        assert result["expires_in"] > 0
        assert result["refresh_in"] > 0

    @pytest.mark.asyncio
    async def test_generate_identity_qr_no_device_raises(self):
        """No active device raises 403."""
        db = _make_mock_db()
        service = QRService(db)

        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            await service.generate_identity_qr(uuid4(), uuid4())
        assert exc_info.value.status_code == 403


class TestModeAScan:
    @pytest.mark.asyncio
    async def test_mode_a_scan_valid(self):
        """Valid Mode A scan succeeds."""
        db = _make_mock_db()
        user_id = uuid4()
        college_id = uuid4()
        fingerprint = "a" * 64
        device = _make_mock_device(user_id, fingerprint)
        action_point = _make_mock_action_point(college_id)

        # Create identity token for target user
        token = create_qr_identity_token(str(user_id), fingerprint, str(college_id), "stu")

        # Mock: first call returns target device, second returns action point
        result_device = MagicMock()
        result_device.scalar_one_or_none.return_value = device

        result_ap = MagicMock()
        result_ap.scalar_one_or_none.return_value = action_point

        result_dup = MagicMock()
        result_dup.scalar_one_or_none.return_value = None  # No duplicate

        db.execute.side_effect = [result_device, result_ap, result_dup]

        scanner_device = _make_mock_device()
        service = QRService(db)

        with patch("app.shared.services.qr_service.publish_event", new_callable=AsyncMock):
            result = await service.process_mode_a_scan(
                scanner_user_id=uuid4(),
                scanner_device=scanner_device,
                scanned_qr_data=token,
                action_point_id=action_point.id,
            )

        assert result.success is True
        assert result.action_type == "mess_entry"

    @pytest.mark.asyncio
    async def test_mode_a_scan_expired_token(self):
        """Expired QR token returns failure."""
        db = _make_mock_db()
        service = QRService(db)
        scanner_device = _make_mock_device()

        with patch("app.shared.services.qr_service.publish_event", new_callable=AsyncMock):
            result = await service.process_mode_a_scan(
                scanner_user_id=uuid4(),
                scanner_device=scanner_device,
                scanned_qr_data="invalid.jwt.token",
                action_point_id=uuid4(),
            )

        assert result.success is False
        assert "expired" in result.message.lower() or "invalid" in result.message.lower()

    @pytest.mark.asyncio
    async def test_mode_a_scan_device_mismatch(self):
        """Fingerprint mismatch returns failure."""
        db = _make_mock_db()
        user_id = uuid4()
        college_id = uuid4()

        # Token uses fingerprint "aaa..."
        token = create_qr_identity_token(str(user_id), "a" * 64, str(college_id), "stu")

        # But device has fingerprint "bbb..."
        device = _make_mock_device(user_id, "b" * 64)

        result_device = MagicMock()
        result_device.scalar_one_or_none.return_value = device
        db.execute.return_value = result_device

        service = QRService(db)
        scanner_device = _make_mock_device()

        result = await service.process_mode_a_scan(
            scanner_user_id=uuid4(),
            scanner_device=scanner_device,
            scanned_qr_data=token,
            action_point_id=uuid4(),
        )

        assert result.success is False
        assert "mismatch" in result.message.lower()

    @pytest.mark.asyncio
    async def test_mode_a_scan_duplicate_blocked(self):
        """Duplicate scan within window returns failure."""
        db = _make_mock_db()
        user_id = uuid4()
        college_id = uuid4()
        fingerprint = "a" * 64
        device = _make_mock_device(user_id, fingerprint)
        action_point = _make_mock_action_point(college_id)
        action_point.duplicate_window_minutes = 30

        token = create_qr_identity_token(str(user_id), fingerprint, str(college_id), "stu")

        result_device = MagicMock()
        result_device.scalar_one_or_none.return_value = device

        result_ap = MagicMock()
        result_ap.scalar_one_or_none.return_value = action_point

        # Duplicate found
        result_dup = MagicMock()
        result_dup.scalar_one_or_none.return_value = uuid4()  # Not None = duplicate exists

        db.execute.side_effect = [result_device, result_ap, result_dup]

        service = QRService(db)
        scanner_device = _make_mock_device()

        result = await service.process_mode_a_scan(
            scanner_user_id=uuid4(),
            scanner_device=scanner_device,
            scanned_qr_data=token,
            action_point_id=action_point.id,
        )

        assert result.success is False
        assert "duplicate" in result.message.lower()


class TestModeBScan:
    @pytest.mark.asyncio
    async def test_mode_b_scan_valid_signature(self):
        """Valid Mode B scan with correct HMAC signature succeeds."""
        db = _make_mock_db()
        user_id = uuid4()
        college_id = uuid4()
        device = _make_mock_device(user_id)
        action_point = _make_mock_action_point(college_id, qr_mode="mode_b")

        # Generate valid QR URL with correct signature
        sig = create_action_point_signature(
            str(action_point.id), action_point.action_type,
            action_point.location_code, str(college_id), "",
        )
        qr_data = f"acolyte://v1/mess_entry?ap={action_point.id}&lc={action_point.location_code}&c={college_id}&sig={sig}"

        # Mock DB: action point query, duplicate check
        result_ap = MagicMock()
        result_ap.scalar_one_or_none.return_value = action_point

        result_dup = MagicMock()
        result_dup.scalar_one_or_none.return_value = None

        db.execute.side_effect = [result_ap, result_dup]

        service = QRService(db)

        with patch("app.shared.services.qr_service.publish_event", new_callable=AsyncMock):
            result = await service.process_mode_b_scan(
                user_id=user_id,
                user_device=device,
                scanned_qr_data=qr_data,
                college_id=college_id,
            )

        assert result.success is True

    @pytest.mark.asyncio
    async def test_mode_b_scan_tampered_rejected(self):
        """Tampered HMAC signature is rejected."""
        db = _make_mock_db()
        user_id = uuid4()
        college_id = uuid4()
        device = _make_mock_device(user_id)
        action_point = _make_mock_action_point(college_id, qr_mode="mode_b")

        qr_data = f"acolyte://v1/mess_entry?ap={action_point.id}&lc={action_point.location_code}&c={college_id}&sig=tampered_signature"

        result_ap = MagicMock()
        result_ap.scalar_one_or_none.return_value = action_point
        db.execute.return_value = result_ap

        service = QRService(db)

        result = await service.process_mode_b_scan(
            user_id=user_id,
            user_device=device,
            scanned_qr_data=qr_data,
            college_id=college_id,
        )

        assert result.success is False
        assert "signature" in result.message.lower() or "tampered" in result.message.lower()


class TestGeoValidation:
    def test_geo_validation_within_radius(self):
        """Point within radius passes validation."""
        # Two points ~50m apart in Bangalore
        user_gps = {"lat": 12.9716, "lng": 77.5946}
        assert QRService._validate_geo(user_gps, 12.9716, 77.5950, 100) is True

    def test_geo_validation_outside_radius(self):
        """Point outside radius fails validation."""
        # Two points ~1km apart
        user_gps = {"lat": 12.9716, "lng": 77.5946}
        assert QRService._validate_geo(user_gps, 12.9800, 77.5946, 100) is False

    def test_geo_validation_no_target(self):
        """No target coordinates passes (skip validation)."""
        user_gps = {"lat": 12.9716, "lng": 77.5946}
        assert QRService._validate_geo(user_gps, None, None, 100) is True


class TestParseActionQR:
    def test_parse_action_qr_valid(self):
        """Valid acolyte:// URL is parsed correctly."""
        ap_id = str(uuid4())
        qr = f"acolyte://v1/mess_entry?ap={ap_id}&lc=mess_main_1&c=college123&sig=abc123"
        result = QRService._parse_action_qr(qr)

        assert result is not None
        assert result["action_type"] == "mess_entry"
        assert result["action_point_id"] == ap_id
        assert result["location_code"] == "mess_main_1"
        assert result["signature"] == "abc123"

    def test_parse_action_qr_invalid(self):
        """Invalid URL returns None."""
        assert QRService._parse_action_qr("https://example.com") is None
        assert QRService._parse_action_qr("not-a-url") is None
        assert QRService._parse_action_qr("acolyte://invalid") is None
