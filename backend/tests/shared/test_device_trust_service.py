"""Tests for Device Trust service layer.

Uses mocked database sessions and SMS gateway.
"""

import os
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

os.environ.setdefault("DEVICE_TRUST_SECRET", "test-device-trust-secret-key-32chars!")
os.environ.setdefault("QR_TOKEN_SECRET", "test-qr-token-secret-key-32chars-ok!")
os.environ.setdefault("QR_ACTION_POINT_SECRET", "test-action-point-hmac-secret-key!")

from app.engines.integration.sms.mock import MockSMSGateway
from app.shared.services.device_trust_service import DeviceTrustService
from app.shared.services.qr_token_service import (
    hash_verification_code,
    validate_device_trust_token,
)


SAMPLE_DEVICE_INFO = {
    "platform": "android",
    "device_id": "abc123",
    "device_model": "Samsung Galaxy A14",
    "device_manufacturer": "Samsung",
    "os_version": "14",
    "app_version": "1.0.0",
    "screen_width": 1080,
    "screen_height": 2340,
    "ram_mb": 4096,
    "sim_operator": "Jio",
    "sim_country": "IN",
}


def _make_mock_db():
    """Create a mock async DB session."""
    db = AsyncMock()
    # Default: execute returns no results
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_result.scalars.return_value.all.return_value = []
    mock_result.all.return_value = []
    db.execute.return_value = mock_result
    db.flush = AsyncMock()
    return db


class TestRegisterDevice:
    @pytest.mark.asyncio
    async def test_creates_pending_record(self):
        """register_device creates a pending record and returns verification info."""
        db = _make_mock_db()
        sms = MockSMSGateway()
        service = DeviceTrustService(db, sms)

        user_id = uuid4()
        result = await service.register_device(user_id, "+919876543210", SAMPLE_DEVICE_INFO)

        assert "verification_id" in result
        assert result["sms_target_number"] == "+919999999999"
        assert "ACOLYTE VERIFY" in result["sms_body_template"]
        assert len(result["verification_code"]) == 6
        assert result["expires_in_seconds"] == 600
        # Verify db.add was called
        db.add.assert_called_once()

    @pytest.mark.asyncio
    async def test_rejects_duplicate_active_device(self):
        """register_device raises 409 if user already has an active device."""
        db = _make_mock_db()
        # Simulate existing active device
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = MagicMock()  # existing device
        db.execute.return_value = mock_result

        sms = MockSMSGateway()
        service = DeviceTrustService(db, sms)

        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            await service.register_device(uuid4(), "+919876543210", SAMPLE_DEVICE_INFO)
        assert exc_info.value.status_code == 409


class TestProcessIncomingSMS:
    @pytest.mark.asyncio
    async def test_valid_sms_activates_device(self):
        """Valid SMS with correct code activates the device."""
        db = _make_mock_db()
        sms = MockSMSGateway()
        service = DeviceTrustService(db, sms)

        # Create a mock device record that the query will return
        device = MagicMock()
        device.user_id = uuid4()
        device.id = uuid4()
        device.device_fingerprint = "a" * 64
        device.device_model = "Test"
        device.platform = "android"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = device
        db.execute.return_value = mock_result

        with patch("app.shared.services.device_trust_service.publish_event", new_callable=AsyncMock):
            result = await service.process_incoming_sms(
                sender="+919876543210",
                message="ACOLYTE VERIFY 123456",
                gateway_message_id="msg_123",
            )

        assert result is True
        assert device.status == "active"
        assert device.sms_verified is True

    @pytest.mark.asyncio
    async def test_wrong_format_returns_false(self):
        """SMS with wrong format returns False."""
        db = _make_mock_db()
        sms = MockSMSGateway()
        service = DeviceTrustService(db, sms)

        result = await service.process_incoming_sms(
            sender="+919876543210",
            message="Hello world",
        )
        assert result is False

    @pytest.mark.asyncio
    async def test_no_matching_record_returns_false(self):
        """SMS with code that doesn't match any pending record returns False."""
        db = _make_mock_db()
        sms = MockSMSGateway()
        service = DeviceTrustService(db, sms)

        result = await service.process_incoming_sms(
            sender="+919876543210",
            message="ACOLYTE VERIFY 999999",
        )
        assert result is False


class TestCheckRegistrationStatus:
    @pytest.mark.asyncio
    async def test_active_returns_token(self):
        """Active device returns token in status check."""
        db = _make_mock_db()
        sms = MockSMSGateway()
        service = DeviceTrustService(db, sms)

        user_id = uuid4()
        device = MagicMock()
        device.status = "active"
        device.user_id = user_id
        device.id = uuid4()
        device.device_fingerprint = "b" * 64
        device.token_expires_at = datetime.now(timezone.utc) + timedelta(days=180)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = device
        db.execute.return_value = mock_result

        result = await service.check_registration_status(user_id, device.id)
        assert result["status"] == "active"
        assert "device_trust_token" in result
        # Verify the token is valid
        decoded = validate_device_trust_token(result["device_trust_token"])
        assert decoded is not None

    @pytest.mark.asyncio
    async def test_pending_returns_waiting(self):
        """Pending device returns waiting message."""
        db = _make_mock_db()
        sms = MockSMSGateway()
        service = DeviceTrustService(db, sms)

        device = MagicMock()
        device.status = "pending_sms_verification"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = device
        db.execute.return_value = mock_result

        # Disable dev mode auto-verification so the device stays pending
        with patch("app.shared.services.device_trust_service.get_settings") as mock_gs:
            mock_settings = MagicMock()
            mock_settings.DEVICE_TRUST_DEV_MODE = False
            mock_gs.return_value = mock_settings
            result = await service.check_registration_status(uuid4(), uuid4())
        assert result["status"] == "pending"

    @pytest.mark.asyncio
    async def test_not_found_raises_404(self):
        """Non-existent verification raises 404."""
        db = _make_mock_db()
        sms = MockSMSGateway()
        service = DeviceTrustService(db, sms)

        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            await service.check_registration_status(uuid4(), uuid4())
        assert exc_info.value.status_code == 404


class TestInitiateTransfer:
    @pytest.mark.asyncio
    async def test_returns_transfer_code(self):
        """initiate_transfer returns an 8-digit code."""
        db = _make_mock_db()
        sms = MockSMSGateway()
        service = DeviceTrustService(db, sms)

        device = MagicMock()
        device.id = uuid4()

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = device
        db.execute.return_value = mock_result

        result = await service.initiate_transfer(uuid4())
        assert len(result["transfer_code"]) == 8
        assert result["expires_in"] == 900
        db.add.assert_called_once()

    @pytest.mark.asyncio
    async def test_no_active_device_raises_404(self):
        """initiate_transfer without active device raises 404."""
        db = _make_mock_db()
        sms = MockSMSGateway()
        service = DeviceTrustService(db, sms)

        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            await service.initiate_transfer(uuid4())
        assert exc_info.value.status_code == 404


class TestRevokeDevice:
    @pytest.mark.asyncio
    async def test_self_revoke(self):
        """revoke_device sets status to revoked."""
        db = _make_mock_db()
        sms = MockSMSGateway()
        service = DeviceTrustService(db, sms)

        device = MagicMock()
        device.id = uuid4()
        device.user_id = uuid4()

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = device
        db.execute.return_value = mock_result

        with patch("app.shared.services.device_trust_service.publish_event", new_callable=AsyncMock):
            await service.revoke_device(device.user_id, "self_revoked")

        assert device.status == "revoked"

    @pytest.mark.asyncio
    async def test_admin_revoke_creates_log(self):
        """Admin-initiated revoke creates a DeviceResetLog entry."""
        db = _make_mock_db()
        sms = MockSMSGateway()
        service = DeviceTrustService(db, sms)

        device = MagicMock()
        device.id = uuid4()
        device.user_id = uuid4()

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = device
        db.execute.return_value = mock_result

        admin_id = uuid4()
        with patch("app.shared.services.device_trust_service.publish_event", new_callable=AsyncMock):
            await service.revoke_device(device.user_id, "phone_lost", admin_id=admin_id)

        assert device.status == "revoked"
        assert device.revoked_by == admin_id
        # db.add called for DeviceResetLog
        assert db.add.called

    @pytest.mark.asyncio
    async def test_no_device_raises_404(self):
        """Revoking when no active device raises 404."""
        db = _make_mock_db()
        sms = MockSMSGateway()
        service = DeviceTrustService(db, sms)

        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            await service.revoke_device(uuid4(), "test")
        assert exc_info.value.status_code == 404


class TestGetFlaggedUsers:
    @pytest.mark.asyncio
    async def test_returns_flagged_users(self):
        """get_flagged_users returns users above threshold."""
        db = _make_mock_db()
        sms = MockSMSGateway()
        service = DeviceTrustService(db, sms)

        # Mock query result
        user_id = uuid4()
        row = MagicMock()
        row.user_id = user_id
        row.reset_count = 5
        row.last_reset_at = datetime.now(timezone.utc)

        mock_result = MagicMock()
        mock_result.all.return_value = [row]
        db.execute.return_value = mock_result

        result = await service.get_flagged_users(threshold=3, period_days=30)
        assert len(result) == 1
        assert result[0]["user_id"] == user_id
        assert result[0]["reset_count"] == 5
