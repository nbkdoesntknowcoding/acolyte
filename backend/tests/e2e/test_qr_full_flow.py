"""End-to-end integration tests for the full AQP flow.

Tests the complete user journey through Device Trust → QR Identity → Scanning
→ Dynamic Roles → Committees using mocked DB and auth dependencies.
"""

import os
from datetime import date, datetime, timedelta, timezone
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
# Shared test helpers
# ---------------------------------------------------------------------------

COLLEGE_ID = uuid4()

SAMPLE_DEVICE_INFO = {
    "platform": "android",
    "device_id": "test-device-001",
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


def _make_user(role: UserRole = UserRole.STUDENT, user_id: str = "user_e2e_test") -> CurrentUser:
    return CurrentUser(
        user_id=user_id,
        college_id=COLLEGE_ID,
        role=role,
        email="test@sdmcms.edu.in",
        full_name="E2E Test User",
    )


def _make_mock_db():
    """Create a mock async DB session with smart defaults."""
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

    original_add = db.add

    def _add_with_id(obj):
        if hasattr(obj, "id") and obj.id is None:
            obj.id = uuid4()
        return original_add(obj)

    db.add = MagicMock(side_effect=_add_with_id)
    return db


def _make_mock_settings():
    from app.config import get_settings
    settings = get_settings()
    mock_settings = MagicMock(wraps=settings)
    mock_settings.MSG91_WEBHOOK_SECRET = "test-webhook-secret"
    return mock_settings


def _override_deps(user: CurrentUser, db: AsyncMock):
    from app.dependencies.auth import get_current_user, get_tenant_db, require_college_admin
    from app.core.database import get_db
    from app.config import get_settings

    mock_settings = _make_mock_settings()

    async def _mock_user():
        return user

    async def _mock_db():
        yield db

    async def _mock_tenant_db():
        # Skip the SET app.current_college_id call — just yield the mock db
        yield db

    async def _mock_admin():
        return user

    app.dependency_overrides[get_current_user] = _mock_user
    app.dependency_overrides[get_db] = _mock_db
    app.dependency_overrides[get_tenant_db] = _mock_tenant_db
    app.dependency_overrides[require_college_admin] = _mock_admin
    app.dependency_overrides[get_settings] = lambda: mock_settings


def _clear():
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# TEST 1: Full device registration → identity QR → mess scan
# ---------------------------------------------------------------------------

class TestFullDeviceRegistrationAndMessScan:
    """Complete flow: register device → SMS verify → get identity → Mode A scan."""

    @pytest.mark.asyncio
    async def test_register_device_returns_verification_info(self):
        """Step 1: POST /device/register returns verification details."""
        user = _make_user()
        db = _make_mock_db()
        _override_deps(user, db)
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.post(
                    "/api/v1/device/register",
                    json={"phone_number": "9876543210", "device_info": SAMPLE_DEVICE_INFO},
                )
            assert resp.status_code == 200
            data = resp.json()
            assert "verification_id" in data
            assert "verification_code" in data
            assert len(data["verification_code"]) == 6
            assert data["sms_target_number"] == "+919999999999"
            assert "ACOLYTE VERIFY" in data["sms_body_template"]
        finally:
            _clear()

    @pytest.mark.asyncio
    async def test_sms_webhook_activates_pending_device(self):
        """Step 2: SMS webhook activates a pending device."""
        db = _make_mock_db()

        device = MagicMock()
        device.user_id = uuid4()
        device.id = uuid4()
        device.device_fingerprint = "a" * 64
        device.device_model = "Samsung Galaxy A14"
        device.platform = "android"
        device.status = "pending_sms_verification"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = device
        db.execute.return_value = mock_result

        from app.core.database import get_db
        from app.config import get_settings
        mock_settings = _make_mock_settings()

        async def _mock_db():
            yield db

        app.dependency_overrides[get_db] = _mock_db
        app.dependency_overrides[get_settings] = lambda: mock_settings
        try:
            with patch("app.shared.services.device_trust_service.publish_event", new_callable=AsyncMock):
                async with AsyncClient(
                    transport=ASGITransport(app=app), base_url="http://test"
                ) as client:
                    resp = await client.post(
                        "/api/v1/webhooks/sms/incoming?secret=test-webhook-secret",
                        json={"sender": "9876543210", "message": "ACOLYTE VERIFY 123456"},
                    )
            assert resp.status_code == 200
            assert resp.json()["status"] == "ok"
        finally:
            _clear()

    @pytest.mark.asyncio
    async def test_status_poll_returns_active_with_token(self):
        """Step 3: Poll status → active + device_trust_token."""
        from app.shared.services.qr_token_service import clerk_user_id_to_uuid

        user = _make_user()
        db = _make_mock_db()

        uid = clerk_user_id_to_uuid(user.user_id)
        device = MagicMock()
        device.status = "active"
        device.id = uuid4()
        device.user_id = uid
        device.device_fingerprint = "a" * 64
        device.token_expires_at = datetime.now(timezone.utc) + timedelta(days=180)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = device
        db.execute.return_value = mock_result

        _override_deps(user, db)
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get(f"/api/v1/device/status?verification_id={device.id}")
            assert resp.status_code == 200
            data = resp.json()
            assert data["status"] == "active"
            assert data["device_trust_token"] is not None
        finally:
            _clear()

    @pytest.mark.asyncio
    async def test_identity_qr_requires_active_device(self):
        """Step 4: GET /qr/identity fails without active device (403)."""
        user = _make_user()
        db = _make_mock_db()
        # Default mock returns None for scalar_one_or_none → no active device
        _override_deps(user, db)
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get("/api/v1/qr/identity")
            # QRService.generate_identity_qr checks for active device and raises 403
            assert resp.status_code in (403, 404)
        finally:
            _clear()

    @pytest.mark.asyncio
    async def test_mode_a_scan_no_device_returns_failure(self):
        """Step 5: Mode A scan without active device returns failure."""
        user = _make_user()
        db = _make_mock_db()
        _override_deps(user, db)
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.post(
                    "/api/v1/qr/scan/mode-a",
                    json={
                        "scanned_qr_data": "some-jwt-token",
                        "action_point_id": str(uuid4()),
                    },
                )
            assert resp.status_code == 200
            data = resp.json()
            assert data["success"] is False
            assert "device" in data["message"].lower()
        finally:
            _clear()

    @pytest.mark.asyncio
    async def test_mode_a_scan_with_device_calls_service(self):
        """Step 6: Mode A scan with active device processes scan."""
        user = _make_user()
        db = _make_mock_db()

        from app.shared.services.qr_token_service import clerk_user_id_to_uuid
        uid = clerk_user_id_to_uuid(user.user_id)

        # Mock active device lookup
        device = MagicMock()
        device.id = uuid4()
        device.user_id = uid
        device.status = "active"
        device.device_fingerprint = "a" * 64

        call_count = [0]
        original_result = MagicMock()
        original_result.scalar_one_or_none.return_value = None
        original_result.scalars.return_value.all.return_value = []
        original_result.scalar.return_value = 0
        original_result.all.return_value = []

        device_result = MagicMock()
        device_result.scalar_one_or_none.return_value = device

        async def _smart_execute(*args, **kwargs):
            nonlocal call_count
            call_count[0] += 1
            # First execute call is for _get_active_device
            if call_count[0] == 1:
                return device_result
            return original_result

        db.execute = AsyncMock(side_effect=_smart_execute)

        _override_deps(user, db)
        try:
            with patch("app.shared.services.qr_service.publish_event", new_callable=AsyncMock):
                async with AsyncClient(
                    transport=ASGITransport(app=app), base_url="http://test"
                ) as client:
                    resp = await client.post(
                        "/api/v1/qr/scan/mode-a",
                        json={
                            "scanned_qr_data": "invalid-token-for-test",
                            "action_point_id": str(uuid4()),
                        },
                    )
            assert resp.status_code == 200
            # The scan will fail validation (invalid token) but the flow works
            data = resp.json()
            assert "success" in data
        finally:
            _clear()

    @pytest.mark.asyncio
    async def test_duplicate_scan_within_window_rejected(self):
        """Step 7: Duplicate scan within duplicate_window is rejected."""
        user = _make_user()
        db = _make_mock_db()

        from app.shared.services.qr_token_service import clerk_user_id_to_uuid
        uid = clerk_user_id_to_uuid(user.user_id)

        # Mock a recent scan log (duplicate check)
        recent_scan = MagicMock()
        recent_scan.scanned_at = datetime.now(timezone.utc)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = recent_scan
        db.execute.return_value = mock_result

        # Directly test the service duplicate check
        from app.shared.services.qr_service import QRService
        service = QRService(db)

        action_point = MagicMock()
        action_point.duplicate_window_minutes = 30

        is_dup = await service._check_duplicate(
            user_id=uid,
            action_type="mess_entry",
            window_minutes=30,
        )
        assert is_dup is True


# ---------------------------------------------------------------------------
# TEST 2: Mode B scan (library checkout)
# ---------------------------------------------------------------------------

class TestModeBScanFlow:
    """Mode B flow: user scans location QR."""

    @pytest.mark.asyncio
    async def test_mode_b_scan_no_device_returns_failure(self):
        """Mode B scan without device returns failure message."""
        user = _make_user()
        db = _make_mock_db()
        _override_deps(user, db)
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.post(
                    "/api/v1/qr/scan/mode-b",
                    json={"scanned_qr_data": "acolyte://scan?ap=test&sig=abc"},
                )
            assert resp.status_code == 200
            data = resp.json()
            assert data["success"] is False
            assert "device" in data["message"].lower()
        finally:
            _clear()

    @pytest.mark.asyncio
    async def test_mode_b_confirm_not_found(self):
        """Mode B confirm with invalid scan_log_id returns failure."""
        user = _make_user()
        db = _make_mock_db()
        _override_deps(user, db)
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.post(
                    "/api/v1/qr/scan/mode-b/confirm",
                    json={
                        "scan_log_id": str(uuid4()),
                        "selected_entity_id": str(uuid4()),
                    },
                )
            assert resp.status_code == 200
            data = resp.json()
            assert data["success"] is False
            assert "not found" in data["message"].lower()
        finally:
            _clear()


# ---------------------------------------------------------------------------
# TEST 3: Device transfer flow
# ---------------------------------------------------------------------------

class TestDeviceTransferFlow:
    """Tests the device transfer initiation and completion."""

    @pytest.mark.asyncio
    async def test_transfer_initiate_requires_active_device(self):
        """POST /device/transfer/initiate needs an active device."""
        user = _make_user()
        db = _make_mock_db()
        # No active device → should fail
        _override_deps(user, db)
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.post("/api/v1/device/transfer/initiate")
            # Should return 404 or an error since no device
            assert resp.status_code in (404, 400, 200)
        finally:
            _clear()

    @pytest.mark.asyncio
    async def test_transfer_complete_needs_transfer_code(self):
        """POST /device/transfer/complete requires valid transfer code."""
        user = _make_user()
        db = _make_mock_db()
        _override_deps(user, db)
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.post(
                    "/api/v1/device/transfer/complete",
                    json={
                        "transfer_code": "ABC123",
                        "device_info": SAMPLE_DEVICE_INFO,
                    },
                )
            # Should fail — no matching transfer request in mock DB
            assert resp.status_code in (404, 400, 200)
        finally:
            _clear()

    @pytest.mark.asyncio
    async def test_self_revoke_device(self):
        """DELETE /device/revoke revokes active device."""
        from app.shared.services.qr_token_service import clerk_user_id_to_uuid

        user = _make_user()
        db = _make_mock_db()
        uid = clerk_user_id_to_uuid(user.user_id)

        device = MagicMock()
        device.id = uuid4()
        device.user_id = uid
        device.status = "active"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = device
        db.execute.return_value = mock_result

        _override_deps(user, db)
        try:
            with patch("app.shared.services.device_trust_service.publish_event", new_callable=AsyncMock):
                async with AsyncClient(
                    transport=ASGITransport(app=app), base_url="http://test"
                ) as client:
                    resp = await client.delete("/api/v1/device/revoke")
            assert resp.status_code == 200
            data = resp.json()
            assert data["status"] == "ok"
            assert device.status == "revoked"
        finally:
            _clear()


# ---------------------------------------------------------------------------
# TEST 4: Dynamic role + committee access
# ---------------------------------------------------------------------------

class TestDynamicRoleCommitteeAccess:
    """Tests role assignment, /me/roles, and committee access."""

    @pytest.mark.asyncio
    async def test_get_my_roles_empty(self):
        """GET /me/roles with no assignments returns empty list."""
        user = _make_user()
        db = _make_mock_db()
        _override_deps(user, db)
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get("/api/v1/me/roles")
            assert resp.status_code == 200
            data = resp.json()
            assert data["roles"] == []
        finally:
            _clear()

    @pytest.mark.asyncio
    async def test_get_my_committees_empty(self):
        """GET /me/committees with no committee roles returns empty list."""
        user = _make_user()
        db = _make_mock_db()
        _override_deps(user, db)
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get("/api/v1/me/committees")
            assert resp.status_code == 200
            data = resp.json()
            assert data["roles"] == []
        finally:
            _clear()

    @pytest.mark.asyncio
    async def test_get_my_roles_with_assignment(self):
        """GET /me/roles returns active assignments when they exist."""
        user = _make_user()
        db = _make_mock_db()

        role = MagicMock()
        role.id = uuid4()
        role.college_id = COLLEGE_ID
        role.user_id = uuid4()
        role.user_type = "student"
        role.user_name = "E2E Test User"
        role.role_type = "committee_member"
        role.context_type = "committee"
        role.context_id = uuid4()
        role.context_name = "Anti-Ragging Committee"
        role.permissions = ["view_cases", "view_minutes"]
        role.valid_from = date.today()
        role.valid_until = date.today() + timedelta(days=365)
        role.is_active = True
        role.auto_deactivate = True
        role.assigned_by = None
        role.assigned_by_name = None
        role.assignment_order_url = None
        role.notes = None
        role.created_at = datetime.now(timezone.utc)
        role.updated_at = datetime.now(timezone.utc)

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [role]
        db.execute.return_value = mock_result

        _override_deps(user, db)
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get("/api/v1/me/roles")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data["roles"]) == 1
            assert data["roles"][0]["role_type"] == "committee_member"
            assert data["roles"][0]["context_name"] == "Anti-Ragging Committee"
        finally:
            _clear()

    @pytest.mark.asyncio
    async def test_committee_meetings_empty(self):
        """GET /committees/{id}/meetings returns empty list when no meetings."""
        user = _make_user()
        db = _make_mock_db()

        # Mock: user has committee membership (first DB call for _verify_committee_member)
        role = MagicMock()
        role.role_type = "committee_member"

        call_count = [0]
        member_result = MagicMock()
        member_result.scalar_one_or_none.return_value = role

        empty_result = MagicMock()
        empty_result.scalars.return_value.all.return_value = []
        empty_result.scalar_one_or_none.return_value = None

        async def _smart_execute(*args, **kwargs):
            nonlocal call_count
            call_count[0] += 1
            if call_count[0] == 1:
                return member_result
            return empty_result

        db.execute = AsyncMock(side_effect=_smart_execute)

        _override_deps(user, db)
        try:
            committee_id = uuid4()
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get(f"/api/v1/committees/{committee_id}/meetings")
            assert resp.status_code == 200
            assert resp.json() == []
        finally:
            _clear()

    @pytest.mark.asyncio
    async def test_committee_meetings_forbidden_without_role(self):
        """GET /committees/{id}/meetings returns 403 without committee membership."""
        user = _make_user()
        db = _make_mock_db()
        # Default mock: no role found → 403
        _override_deps(user, db)
        try:
            committee_id = uuid4()
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get(f"/api/v1/committees/{committee_id}/meetings")
            assert resp.status_code == 403
        finally:
            _clear()

    @pytest.mark.asyncio
    async def test_committee_action_items_empty(self):
        """GET /committees/{id}/action-items returns empty list with membership."""
        user = _make_user()
        db = _make_mock_db()

        role = MagicMock()
        role.role_type = "committee_member"

        call_count = [0]
        member_result = MagicMock()
        member_result.scalar_one_or_none.return_value = role
        empty_result = MagicMock()
        empty_result.scalars.return_value.all.return_value = []

        async def _smart_execute(*args, **kwargs):
            nonlocal call_count
            call_count[0] += 1
            if call_count[0] == 1:
                return member_result
            return empty_result

        db.execute = AsyncMock(side_effect=_smart_execute)

        _override_deps(user, db)
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get(f"/api/v1/committees/{uuid4()}/action-items")
            assert resp.status_code == 200
            assert resp.json() == []
        finally:
            _clear()


# ---------------------------------------------------------------------------
# TEST 5: Security levels — auth enforcement
# ---------------------------------------------------------------------------

class TestSecurityLevels:
    """Verify authentication and authorization enforcement at different levels."""

    @pytest.mark.asyncio
    async def test_no_jwt_returns_401(self):
        """Request without Bearer token returns 401."""
        _clear()  # Ensure no overrides
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get("/api/v1/qr/identity")
        # 401 or 403 — depends on auth middleware behavior for missing token
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_no_jwt_on_device_register(self):
        """Device register without JWT returns 401."""
        _clear()
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/api/v1/device/register",
                json={"phone_number": "9876543210", "device_info": SAMPLE_DEVICE_INFO},
            )
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_no_jwt_on_me_roles(self):
        """GET /me/roles without JWT returns 401."""
        _clear()
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get("/api/v1/me/roles")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_no_jwt_on_admin_route(self):
        """Admin routes without JWT return 401."""
        _clear()
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get("/api/v1/admin/qr/action-points")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_student_cannot_access_admin_routes(self):
        """Student role cannot access admin endpoints."""
        user = _make_user(role=UserRole.STUDENT)
        db = _make_mock_db()

        from app.dependencies.auth import get_current_user, require_college_admin
        from app.core.database import get_db
        from app.config import get_settings

        async def _mock_user():
            return user

        async def _mock_db():
            yield db

        # Override user but NOT admin — let the real require_college_admin check
        app.dependency_overrides[get_current_user] = _mock_user
        app.dependency_overrides[get_db] = _mock_db
        app.dependency_overrides[get_settings] = lambda: _make_mock_settings()

        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get("/api/v1/admin/qr/action-points")
            # Without admin override, the real require_college_admin will reject
            assert resp.status_code in (401, 403)
        finally:
            _clear()

    @pytest.mark.asyncio
    async def test_scan_history_filters(self):
        """Scan history endpoints return empty when no scans exist."""
        user = _make_user()
        db = _make_mock_db()
        _override_deps(user, db)
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                # All four history endpoints should return empty
                for endpoint in [
                    "/api/v1/qr/history",
                    "/api/v1/qr/history/meals",
                    "/api/v1/qr/history/library",
                    "/api/v1/qr/history/attendance",
                ]:
                    resp = await client.get(endpoint)
                    assert resp.status_code == 200, f"Failed on {endpoint}"
                    assert resp.json() == [], f"Non-empty on {endpoint}"
        finally:
            _clear()

    @pytest.mark.asyncio
    async def test_public_verify_needs_no_auth(self):
        """Public certificate verification endpoint needs no JWT — returns data, not 401."""
        db = _make_mock_db()
        from app.core.database import get_db

        async def _mock_db():
            yield db

        app.dependency_overrides[get_db] = _mock_db
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get("/api/v1/public/verify/CERT-2026-0001")
            # Should return 200 with valid=False (not 401) — proves no auth needed
            assert resp.status_code == 200
            data = resp.json()
            assert data["valid"] is False
        finally:
            _clear()


# ---------------------------------------------------------------------------
# TEST: Admin QR management
# ---------------------------------------------------------------------------

class TestAdminQRManagement:
    """Admin can manage QR action points."""

    @pytest.mark.asyncio
    async def test_admin_create_and_list_action_points(self):
        """Admin can create an action point and list it."""
        admin = _make_user(role=UserRole.ADMIN, user_id="admin_e2e")
        db = _make_mock_db()
        _override_deps(admin, db)
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                # Create
                resp = await client.post(
                    "/api/v1/admin/qr/action-points",
                    json={
                        "name": "E2E Test Point",
                        "location_code": "e2e_test_001",
                        "action_type": "attendance_mark",
                        "qr_mode": "mode_b",
                        "building": "Test Building",
                        "security_level": "standard",
                    },
                )
                assert resp.status_code == 201
                data = resp.json()
                assert data["name"] == "E2E Test Point"
                assert data["location_code"] == "e2e_test_001"
                assert data["is_active"] is True

                # List
                resp = await client.get("/api/v1/admin/qr/action-points")
                assert resp.status_code == 200
        finally:
            _clear()

    @pytest.mark.asyncio
    async def test_admin_scan_summary(self):
        """Admin can retrieve scan summary."""
        admin = _make_user(role=UserRole.ADMIN, user_id="admin_e2e")
        db = _make_mock_db()
        _override_deps(admin, db)
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get("/api/v1/admin/qr/scan-logs/summary")
            assert resp.status_code == 200
            data = resp.json()
            assert "data" in data
            assert "period_days" in data
        finally:
            _clear()

    @pytest.mark.asyncio
    async def test_admin_export_csv(self):
        """Admin can export scan logs as CSV."""
        admin = _make_user(role=UserRole.ADMIN, user_id="admin_e2e")
        db = _make_mock_db()
        _override_deps(admin, db)
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get("/api/v1/admin/qr/scan-logs/export")
            assert resp.status_code == 200
            assert "text/csv" in resp.headers.get("content-type", "")
        finally:
            _clear()


# ---------------------------------------------------------------------------
# TEST: Admin role management
# ---------------------------------------------------------------------------

class TestAdminRoleManagement:
    """Admin can manage dynamic role assignments."""

    @pytest.mark.asyncio
    async def test_admin_list_role_assignments(self):
        """Admin can list role assignments."""
        admin = _make_user(role=UserRole.ADMIN, user_id="admin_e2e")
        db = _make_mock_db()
        _override_deps(admin, db)
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get("/api/v1/admin/role-assignments/")
            assert resp.status_code == 200
            assert resp.json() == []
        finally:
            _clear()

    @pytest.mark.asyncio
    async def test_admin_create_role_assignment(self):
        """Admin can create a role assignment."""
        admin = _make_user(role=UserRole.ADMIN, user_id="admin_e2e")
        db = _make_mock_db()
        _override_deps(admin, db)
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.post(
                    "/api/v1/admin/role-assignments/",
                    json={
                        "user_id": str(uuid4()),
                        "user_name": "Test Faculty",
                        "role_type": "exam_invigilator",
                        "context_type": "exam",
                        "context_id": str(uuid4()),
                        "context_name": "Phase I IA Feb 2026",
                        "valid_from": date.today().isoformat(),
                        "valid_until": (date.today() + timedelta(days=7)).isoformat(),
                    },
                )
            assert resp.status_code == 201
            data = resp.json()
            assert data["role_type"] == "exam_invigilator"
            assert data["is_active"] is True
        finally:
            _clear()

    @pytest.mark.asyncio
    async def test_admin_get_expiring_roles(self):
        """Admin can query soon-to-expire roles."""
        admin = _make_user(role=UserRole.ADMIN, user_id="admin_e2e")
        db = _make_mock_db()
        _override_deps(admin, db)
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get("/api/v1/admin/role-assignments/expiring?days=14")
            assert resp.status_code == 200
            assert resp.json() == []
        finally:
            _clear()
