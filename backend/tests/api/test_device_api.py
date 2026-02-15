"""Integration tests for Device Trust API routes.

Uses mocked auth dependencies and in-memory DB mocks to test
the route layer end-to-end without a real database.
"""

import os
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

os.environ.setdefault("DEVICE_TRUST_SECRET", "test-device-trust-secret-key-32chars!")
os.environ.setdefault("QR_TOKEN_SECRET", "test-qr-token-secret-key-32chars-ok!")
os.environ.setdefault("QR_ACTION_POINT_SECRET", "test-action-point-hmac-secret-key!")
os.environ.setdefault("MSG91_WEBHOOK_SECRET", "test-webhook-secret")
os.environ.setdefault("SMS_GATEWAY_PROVIDER", "mock")

from httpx import ASGITransport, AsyncClient

from app.main import app
from app.middleware.clerk_auth import CurrentUser, UserRole


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

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


def _make_mock_user(role: UserRole = UserRole.STUDENT) -> CurrentUser:
    """Create a mock CurrentUser."""
    return CurrentUser(
        user_id="user_test123",
        college_id=uuid4(),
        role=role,
        email="test@example.com",
        full_name="Test User",
    )


def _make_admin_user() -> CurrentUser:
    return _make_mock_user(UserRole.ADMIN)


def _make_mock_db():
    """Create a mock async DB session."""
    db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_result.scalars.return_value.all.return_value = []
    mock_result.scalar.return_value = 0
    mock_result.all.return_value = []
    db.execute.return_value = mock_result
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.rollback = AsyncMock()
    db.close = AsyncMock()

    # Simulate ORM behavior: when db.add() is called with an object
    # that has id=None, assign a UUID (as PostgreSQL would).
    original_add = db.add

    def _add_with_id(obj):
        if hasattr(obj, "id") and obj.id is None:
            obj.id = uuid4()
        return original_add(obj)

    db.add = MagicMock(side_effect=_add_with_id)
    return db


@pytest.fixture
def mock_db():
    return _make_mock_db()


@pytest.fixture
def mock_user():
    return _make_mock_user()


@pytest.fixture
def admin_user():
    return _make_admin_user()


# ---------------------------------------------------------------------------
# Test helpers
# ---------------------------------------------------------------------------

def _make_mock_settings():
    """Create mock settings with test webhook secret."""
    from app.config import get_settings
    settings = get_settings()
    mock_settings = MagicMock(wraps=settings)
    mock_settings.MSG91_WEBHOOK_SECRET = "test-webhook-secret"
    mock_settings.DEVICE_TRUST_DEV_MODE = False  # Don't auto-verify in tests
    return mock_settings


def _override_deps(user: CurrentUser, db: AsyncMock):
    """Override FastAPI dependencies for testing."""
    from app.dependencies.auth import get_current_user, require_college_admin
    from app.core.database import get_db
    from app.config import get_settings, Settings

    mock_settings = _make_mock_settings()

    async def _mock_get_current_user():
        return user

    async def _mock_get_db():
        yield db

    async def _mock_require_admin():
        return user

    def _mock_get_settings():
        return mock_settings

    app.dependency_overrides[get_current_user] = _mock_get_current_user
    app.dependency_overrides[get_db] = _mock_get_db
    app.dependency_overrides[require_college_admin] = _mock_require_admin
    app.dependency_overrides[get_settings] = _mock_get_settings


def _clear_overrides():
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Tests: Device Registration
# ---------------------------------------------------------------------------

class TestRegisterDevice:
    @pytest.mark.asyncio
    async def test_register_device_returns_verification_code(self, mock_user, mock_db):
        """POST /api/v1/device/register returns verification details."""
        _override_deps(mock_user, mock_db)
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app),
                base_url="http://test",
            ) as client:
                resp = await client.post(
                    "/api/v1/device/register",
                    json={
                        "phone_number": "9876543210",
                        "device_info": SAMPLE_DEVICE_INFO,
                    },
                )
            assert resp.status_code == 200
            data = resp.json()
            assert "verification_id" in data
            assert data["sms_target_number"] == "+919999999999"
            assert "ACOLYTE VERIFY" in data["sms_body_template"]
            assert len(data["verification_code"]) == 6
            assert data["expires_in_seconds"] == 600
        finally:
            _clear_overrides()

    @pytest.mark.asyncio
    async def test_register_device_duplicate_active_rejected(self, mock_user, mock_db):
        """POST /api/v1/device/register returns 409 if user already has active device."""
        # Simulate existing active device
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = MagicMock()  # existing device
        mock_db.execute.return_value = mock_result

        _override_deps(mock_user, mock_db)
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app),
                base_url="http://test",
            ) as client:
                resp = await client.post(
                    "/api/v1/device/register",
                    json={
                        "phone_number": "9876543210",
                        "device_info": SAMPLE_DEVICE_INFO,
                    },
                )
            assert resp.status_code == 409
        finally:
            _clear_overrides()


# ---------------------------------------------------------------------------
# Tests: Status Polling
# ---------------------------------------------------------------------------

class TestStatusPoll:
    @pytest.mark.asyncio
    async def test_status_poll_pending_before_sms(self, mock_user, mock_db):
        """GET /api/v1/device/status returns 'pending' before SMS verification."""
        device = MagicMock()
        device.status = "pending_sms_verification"
        device.id = uuid4()
        device.user_id = uuid4()  # Will be overridden by clerk_user_id_to_uuid

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = device
        mock_db.execute.return_value = mock_result

        _override_deps(mock_user, mock_db)
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app),
                base_url="http://test",
            ) as client:
                resp = await client.get(
                    f"/api/v1/device/status?verification_id={device.id}",
                )
            assert resp.status_code == 200
            data = resp.json()
            assert data["status"] == "pending"
            assert data["device_trust_token"] is None
        finally:
            _clear_overrides()

    @pytest.mark.asyncio
    async def test_status_poll_active_after_sms_returns_token(self, mock_user, mock_db):
        """GET /api/v1/device/status returns token when device is active."""
        from app.shared.services.qr_token_service import clerk_user_id_to_uuid

        uid = clerk_user_id_to_uuid(mock_user.user_id)
        device = MagicMock()
        device.status = "active"
        device.id = uuid4()
        device.user_id = uid
        device.device_fingerprint = "a" * 64
        device.token_expires_at = datetime.now(timezone.utc) + timedelta(days=180)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = device
        mock_db.execute.return_value = mock_result

        _override_deps(mock_user, mock_db)
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app),
                base_url="http://test",
            ) as client:
                resp = await client.get(
                    f"/api/v1/device/status?verification_id={device.id}",
                )
            assert resp.status_code == 200
            data = resp.json()
            assert data["status"] == "active"
            assert data["device_trust_token"] is not None
        finally:
            _clear_overrides()


# ---------------------------------------------------------------------------
# Tests: SMS Webhook
# ---------------------------------------------------------------------------

class TestSMSWebhook:
    @pytest.mark.asyncio
    async def test_sms_webhook_activates_device(self, mock_db):
        """POST /api/v1/webhooks/sms/incoming activates matching device."""
        device = MagicMock()
        device.user_id = uuid4()
        device.id = uuid4()
        device.device_fingerprint = "a" * 64
        device.device_model = "Test"
        device.platform = "android"
        device.status = "pending_sms_verification"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = device
        mock_db.execute.return_value = mock_result

        from app.core.database import get_db
        from app.config import get_settings

        mock_settings = _make_mock_settings()

        async def _mock_get_db():
            yield mock_db

        app.dependency_overrides[get_db] = _mock_get_db
        app.dependency_overrides[get_settings] = lambda: mock_settings
        try:
            with patch(
                "app.shared.services.device_trust_service.publish_event",
                new_callable=AsyncMock,
            ):
                async with AsyncClient(
                    transport=ASGITransport(app=app),
                    base_url="http://test",
                ) as client:
                    resp = await client.post(
                        "/api/v1/webhooks/sms/incoming?secret=test-webhook-secret",
                        json={
                            "sender": "9876543210",
                            "message": "ACOLYTE VERIFY 123456",
                        },
                    )
            assert resp.status_code == 200
            data = resp.json()
            assert data["status"] == "ok"
        finally:
            _clear_overrides()

    @pytest.mark.asyncio
    async def test_sms_webhook_rejects_bad_secret(self, mock_db):
        """POST /api/v1/webhooks/sms/incoming returns 403 for wrong secret."""
        from app.core.database import get_db
        from app.config import get_settings

        mock_settings = _make_mock_settings()

        async def _mock_get_db():
            yield mock_db

        app.dependency_overrides[get_db] = _mock_get_db
        app.dependency_overrides[get_settings] = lambda: mock_settings
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app),
                base_url="http://test",
            ) as client:
                resp = await client.post(
                    "/api/v1/webhooks/sms/incoming?secret=wrong-secret",
                    json={"sender": "9876543210", "message": "ACOLYTE VERIFY 123456"},
                )
            assert resp.status_code == 403
        finally:
            _clear_overrides()


# ---------------------------------------------------------------------------
# Tests: Admin Device Management
# ---------------------------------------------------------------------------

class TestAdminDeviceReset:
    @pytest.mark.asyncio
    async def test_admin_reset_revokes_device(self, admin_user, mock_db):
        """POST /api/v1/admin/devices/{user_id}/reset revokes the device."""
        target_user_id = uuid4()
        device = MagicMock()
        device.id = uuid4()
        device.user_id = target_user_id
        device.status = "active"

        # First call: find active device for revoke
        # Second call: find reset log for admin_notes update
        mock_result_device = MagicMock()
        mock_result_device.scalar_one_or_none.return_value = device
        mock_result_log = MagicMock()
        mock_result_log.scalar_one_or_none.return_value = MagicMock()
        mock_db.execute.side_effect = [mock_result_device, mock_result_log]

        _override_deps(admin_user, mock_db)
        try:
            with patch(
                "app.shared.services.device_trust_service.publish_event",
                new_callable=AsyncMock,
            ):
                async with AsyncClient(
                    transport=ASGITransport(app=app),
                    base_url="http://test",
                ) as client:
                    resp = await client.post(
                        f"/api/v1/admin/devices/{target_user_id}/reset",
                        json={"reason": "phone_lost", "admin_notes": "Student reported lost phone"},
                    )
            assert resp.status_code == 200
            data = resp.json()
            assert data["status"] == "ok"
            assert device.status == "revoked"
        finally:
            _clear_overrides()

    @pytest.mark.asyncio
    async def test_admin_reset_creates_audit_log(self, admin_user, mock_db):
        """Admin reset creates a DeviceResetLog entry (db.add called)."""
        target_user_id = uuid4()
        device = MagicMock()
        device.id = uuid4()
        device.user_id = target_user_id
        device.status = "active"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = device
        mock_db.execute.return_value = mock_result

        _override_deps(admin_user, mock_db)
        try:
            with patch(
                "app.shared.services.device_trust_service.publish_event",
                new_callable=AsyncMock,
            ):
                async with AsyncClient(
                    transport=ASGITransport(app=app),
                    base_url="http://test",
                ) as client:
                    resp = await client.post(
                        f"/api/v1/admin/devices/{target_user_id}/reset",
                        json={"reason": "phone_lost"},
                    )
            assert resp.status_code == 200
            # db.add called for DeviceResetLog
            assert mock_db.add.called
        finally:
            _clear_overrides()


class TestFlaggedUsers:
    @pytest.mark.asyncio
    async def test_flagged_users_threshold(self, admin_user, mock_db):
        """GET /api/v1/admin/devices/flagged returns flagged users."""
        user_id = uuid4()
        row = MagicMock()
        row.user_id = user_id
        row.reset_count = 5
        row.last_reset_at = datetime.now(timezone.utc)

        mock_result = MagicMock()
        mock_result.all.return_value = [row]
        mock_db.execute.return_value = mock_result

        _override_deps(admin_user, mock_db)
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app),
                base_url="http://test",
            ) as client:
                resp = await client.get(
                    "/api/v1/admin/devices/flagged?threshold=3&period_days=30",
                )
            assert resp.status_code == 200
            data = resp.json()
            assert len(data["data"]) == 1
            assert data["data"][0]["user_id"] == str(user_id)
            assert data["data"][0]["reset_count"] == 5
        finally:
            _clear_overrides()
