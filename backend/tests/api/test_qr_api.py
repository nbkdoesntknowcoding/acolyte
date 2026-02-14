"""Integration tests for QR Engine API routes.

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

from httpx import ASGITransport, AsyncClient

from app.main import app
from app.middleware.clerk_auth import CurrentUser, UserRole


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

TEST_COLLEGE_ID = uuid4()


def _make_mock_user(role: UserRole = UserRole.STUDENT) -> CurrentUser:
    return CurrentUser(
        user_id="user_qr_test",
        college_id=TEST_COLLEGE_ID,
        role=role,
        email="qr@test.com",
        full_name="QR Test User",
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
    mock_result.one.return_value = MagicMock(total_scans=0, successful_scans=0)
    db.execute.return_value = mock_result
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.rollback = AsyncMock()
    db.close = AsyncMock()

    def _add_with_id(obj):
        if hasattr(obj, "id") and obj.id is None:
            obj.id = uuid4()

    db.add = MagicMock(side_effect=_add_with_id)
    return db


def _setup_overrides(user=None, db=None):
    """Override FastAPI dependencies for testing."""
    from app.dependencies.auth import (
        get_current_user,
        get_tenant_db,
        require_college_admin,
    )
    from app.core.database import get_db

    _user = user or _make_mock_user()
    _db = db or _make_mock_db()

    app.dependency_overrides[get_current_user] = lambda: _user
    app.dependency_overrides[require_college_admin] = lambda: _user
    app.dependency_overrides[get_tenant_db] = lambda: _db
    app.dependency_overrides[get_db] = lambda: _db
    return _user, _db


def _cleanup_overrides():
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# User-facing QR Routes: /api/v1/qr/*
# ---------------------------------------------------------------------------

class TestIdentityQR:
    @pytest.mark.asyncio
    async def test_get_identity_qr_with_active_device(self):
        """GET /identity returns QR token when user has active device."""
        user, db = _setup_overrides()

        # Mock: device trust found
        mock_device = MagicMock()
        mock_device.device_fingerprint = "a" * 64
        result_device = MagicMock()
        result_device.scalar_one_or_none.return_value = mock_device
        db.execute.return_value = result_device

        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get(
                    "/api/v1/qr/identity",
                    headers={"Authorization": "Bearer test-token"},
                )

            assert resp.status_code == 200
            data = resp.json()
            assert "token" in data
            assert data["expires_in"] > 0
            assert data["refresh_in"] > 0
        finally:
            _cleanup_overrides()

    @pytest.mark.asyncio
    async def test_get_identity_qr_no_device_403(self):
        """GET /identity returns 403 when user has no active device."""
        user, db = _setup_overrides()

        # Mock: no device found
        result_none = MagicMock()
        result_none.scalar_one_or_none.return_value = None
        db.execute.return_value = result_none

        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get(
                    "/api/v1/qr/identity",
                    headers={"Authorization": "Bearer test-token"},
                )

            assert resp.status_code == 403
        finally:
            _cleanup_overrides()


class TestModeAScan:
    @pytest.mark.asyncio
    async def test_mode_a_scan_no_device_returns_failure(self):
        """POST /scan/mode-a returns failure when scanner has no device."""
        user, db = _setup_overrides()

        # Mock: no device found for scanner
        result_none = MagicMock()
        result_none.scalar_one_or_none.return_value = None
        db.execute.return_value = result_none

        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.post(
                    "/api/v1/qr/scan/mode-a",
                    json={
                        "scanned_qr_data": "some.jwt.token",
                        "action_point_id": str(uuid4()),
                    },
                    headers={"Authorization": "Bearer test-token"},
                )

            assert resp.status_code == 200
            data = resp.json()
            assert data["success"] is False
            assert "device" in data["message"].lower()
        finally:
            _cleanup_overrides()


class TestModeBScan:
    @pytest.mark.asyncio
    async def test_mode_b_scan_no_device_returns_failure(self):
        """POST /scan/mode-b returns failure when user has no device."""
        user, db = _setup_overrides()

        result_none = MagicMock()
        result_none.scalar_one_or_none.return_value = None
        db.execute.return_value = result_none

        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.post(
                    "/api/v1/qr/scan/mode-b",
                    json={"scanned_qr_data": "acolyte://v1/test?ap=123&sig=abc"},
                    headers={"Authorization": "Bearer test-token"},
                )

            assert resp.status_code == 200
            data = resp.json()
            assert data["success"] is False
        finally:
            _cleanup_overrides()


class TestScanHistory:
    @pytest.mark.asyncio
    async def test_get_history_empty(self):
        """GET /history returns empty list when no scans."""
        user, db = _setup_overrides()

        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get(
                    "/api/v1/qr/history",
                    headers={"Authorization": "Bearer test-token"},
                )

            assert resp.status_code == 200
            assert resp.json() == []
        finally:
            _cleanup_overrides()

    @pytest.mark.asyncio
    async def test_get_meal_history_empty(self):
        """GET /history/meals returns empty list."""
        user, db = _setup_overrides()

        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get(
                    "/api/v1/qr/history/meals",
                    headers={"Authorization": "Bearer test-token"},
                )

            assert resp.status_code == 200
            assert resp.json() == []
        finally:
            _cleanup_overrides()

    @pytest.mark.asyncio
    async def test_get_library_history_empty(self):
        """GET /history/library returns empty list."""
        user, db = _setup_overrides()

        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get(
                    "/api/v1/qr/history/library",
                    headers={"Authorization": "Bearer test-token"},
                )

            assert resp.status_code == 200
            assert resp.json() == []
        finally:
            _cleanup_overrides()

    @pytest.mark.asyncio
    async def test_get_attendance_history_empty(self):
        """GET /history/attendance returns empty list."""
        user, db = _setup_overrides()

        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get(
                    "/api/v1/qr/history/attendance",
                    headers={"Authorization": "Bearer test-token"},
                )

            assert resp.status_code == 200
            assert resp.json() == []
        finally:
            _cleanup_overrides()


# ---------------------------------------------------------------------------
# Admin QR Routes: /api/v1/admin/qr/*
# ---------------------------------------------------------------------------

class TestAdminActionPoints:
    @pytest.mark.asyncio
    async def test_list_action_points_empty(self):
        """GET /admin/qr/action-points returns empty list."""
        admin, db = _setup_overrides(user=_make_admin_user())

        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get(
                    "/api/v1/admin/qr/action-points",
                    headers={"Authorization": "Bearer test-token"},
                )

            assert resp.status_code == 200
            assert resp.json() == []
        finally:
            _cleanup_overrides()

    @pytest.mark.asyncio
    async def test_create_action_point(self):
        """POST /admin/qr/action-points creates and returns action point."""
        admin, db = _setup_overrides(user=_make_admin_user())

        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.post(
                    "/api/v1/admin/qr/action-points",
                    json={
                        "name": "Main Mess Entrance",
                        "action_type": "mess_entry",
                        "location_code": "mess_main_1",
                        "qr_mode": "mode_b",
                    },
                    headers={"Authorization": "Bearer test-token"},
                )

            assert resp.status_code == 201
            data = resp.json()
            assert data["name"] == "Main Mess Entrance"
            assert data["action_type"] == "mess_entry"
            assert data["location_code"] == "mess_main_1"
            assert data["is_active"] is True
        finally:
            _cleanup_overrides()

    @pytest.mark.asyncio
    async def test_deactivate_action_point_not_found(self):
        """DELETE /admin/qr/action-points/{id} returns 404 for missing AP."""
        admin, db = _setup_overrides(user=_make_admin_user())

        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.delete(
                    f"/api/v1/admin/qr/action-points/{uuid4()}",
                    headers={"Authorization": "Bearer test-token"},
                )

            assert resp.status_code == 404
        finally:
            _cleanup_overrides()

    @pytest.mark.asyncio
    async def test_generate_qr_not_found(self):
        """GET /admin/qr/action-points/{id}/generate returns 404 for missing AP."""
        admin, db = _setup_overrides(user=_make_admin_user())

        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get(
                    f"/api/v1/admin/qr/action-points/{uuid4()}/generate",
                    headers={"Authorization": "Bearer test-token"},
                )

            assert resp.status_code == 404
        finally:
            _cleanup_overrides()


class TestAdminScanLogs:
    @pytest.mark.asyncio
    async def test_list_scan_logs_empty(self):
        """GET /admin/qr/scan-logs returns empty list."""
        admin, db = _setup_overrides(user=_make_admin_user())

        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get(
                    "/api/v1/admin/qr/scan-logs",
                    headers={"Authorization": "Bearer test-token"},
                )

            assert resp.status_code == 200
            assert resp.json() == []
        finally:
            _cleanup_overrides()

    @pytest.mark.asyncio
    async def test_scan_summary(self):
        """GET /admin/qr/scan-logs/summary returns summary data."""
        admin, db = _setup_overrides(user=_make_admin_user())

        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get(
                    "/api/v1/admin/qr/scan-logs/summary",
                    headers={"Authorization": "Bearer test-token"},
                )

            assert resp.status_code == 200
            data = resp.json()
            assert "period_days" in data
            assert "data" in data
        finally:
            _cleanup_overrides()

    @pytest.mark.asyncio
    async def test_scan_anomalies(self):
        """GET /admin/qr/scan-logs/anomalies returns anomaly data."""
        admin, db = _setup_overrides(user=_make_admin_user())

        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get(
                    "/api/v1/admin/qr/scan-logs/anomalies",
                    headers={"Authorization": "Bearer test-token"},
                )

            assert resp.status_code == 200
            data = resp.json()
            assert "anomalies" in data
        finally:
            _cleanup_overrides()

    @pytest.mark.asyncio
    async def test_export_csv(self):
        """GET /admin/qr/scan-logs/export returns CSV content."""
        admin, db = _setup_overrides(user=_make_admin_user())

        # Mock: empty scan logs list
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        db.execute.return_value = mock_result

        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get(
                    "/api/v1/admin/qr/scan-logs/export",
                    headers={"Authorization": "Bearer test-token"},
                )

            assert resp.status_code == 200
            assert "text/csv" in resp.headers["content-type"]
            # CSV header should be present
            assert "id,user_id" in resp.text
        finally:
            _cleanup_overrides()


# ---------------------------------------------------------------------------
# Public Routes: /api/v1/public/*
# ---------------------------------------------------------------------------

class TestPublicVerify:
    @pytest.mark.asyncio
    async def test_verify_certificate_not_found(self):
        """GET /public/verify/{number} returns invalid for missing cert."""
        # No auth overrides needed — public endpoint
        # But we need DB override
        db = _make_mock_db()

        from app.core.database import get_db
        app.dependency_overrides[get_db] = lambda: db

        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get("/api/v1/public/verify/CERT-2026-001")

            assert resp.status_code == 200
            data = resp.json()
            assert data["valid"] is False
        finally:
            _cleanup_overrides()
