"""Platform Admin API — end-to-end tests.

Tests each platform endpoint against the seeded database.
Auth is bypassed via a FastAPI dependency override on
``require_platform_admin`` and ``get_platform_db``.

Run:
    cd backend && pytest tests/test_platform_api.py -v
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.database import async_session_factory
from app.main import app
from app.platform.dependencies import (
    PlatformAdminUser,
    get_platform_db,
    require_platform_admin,
)

# ---------------------------------------------------------------------------
# Deterministic IDs matching seed_platform_data.py
# ---------------------------------------------------------------------------

LICENSE_1_ID = "b0000001-0001-4000-8000-000000000001"
LICENSE_2_ID = "b0000001-0002-4000-8000-000000000002"
LICENSE_3_ID = "b0000001-0003-4000-8000-000000000003"
COLLEGE_1_ID = "a0000001-0001-4000-8000-000000000001"


# ---------------------------------------------------------------------------
# Fixtures — mock platform admin auth for tests
# ---------------------------------------------------------------------------

_mock_admin = PlatformAdminUser(
    user_id="user_test_admin",
    email="test@acolyte.ai",
    full_name="Test Admin",
)


async def _mock_require_platform_admin() -> PlatformAdminUser:
    return _mock_admin


async def _mock_get_platform_db():
    """Provide a DB session with superadmin bypass (no RLS filtering)."""
    async with async_session_factory() as session:
        await session.execute(text("SET app.is_superadmin = 'true'"))
        yield session
        await session.commit()


@pytest_asyncio.fixture
async def client():
    """Async test client with auth dependency overrides."""
    app.dependency_overrides[require_platform_admin] = _mock_require_platform_admin
    app.dependency_overrides[get_platform_db] = _mock_get_platform_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


# ===================================================================
# GROUP 1: License Management
# ===================================================================


class TestLicenseEndpoints:
    @pytest.mark.asyncio
    async def test_list_licenses(self, client: AsyncClient):
        """GET /platform/licenses returns seeded licenses with enrichment."""
        resp = await client.get("/api/v1/platform/licenses")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 3
        assert len(data["items"]) >= 3

        # Check enrichment fields present
        first = data["items"][0]
        assert "college_name" in first
        assert "current_students" in first
        assert "current_faculty" in first
        assert first["college_name"] is not None

    @pytest.mark.asyncio
    async def test_list_licenses_filter_status(self, client: AsyncClient):
        """Filtering by status returns correct subset."""
        resp = await client.get("/api/v1/platform/licenses?status=active")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 2
        for item in data["items"]:
            assert item["status"] == "active"

    @pytest.mark.asyncio
    async def test_list_licenses_search(self, client: AsyncClient):
        """Search by college name works."""
        resp = await client.get(
            "/api/v1/platform/licenses?search=Bangalore"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1
        assert "Bangalore" in data["items"][0]["college_name"]

    @pytest.mark.asyncio
    async def test_get_license_detail(self, client: AsyncClient):
        """GET /platform/licenses/{id} returns detail with usage + snapshots."""
        resp = await client.get(f"/api/v1/platform/licenses/{LICENSE_1_ID}")
        assert resp.status_code == 200
        data = resp.json()
        assert "license" in data
        assert "usage" in data
        assert "snapshots" in data
        assert "active_alerts" in data
        assert data["license"]["id"] == LICENSE_1_ID

    @pytest.mark.asyncio
    async def test_get_license_not_found(self, client: AsyncClient):
        """Non-existent license ID returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000099"
        resp = await client.get(f"/api/v1/platform/licenses/{fake_id}")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_create_license(self, client: AsyncClient):
        """POST /platform/licenses creates a new license."""
        resp = await client.post(
            "/api/v1/platform/licenses",
            json={
                "college_id": COLLEGE_1_ID,
                "plan_tier": "starter",
                "billing_cycle": "annual",
            },
        )
        # Might be 409 (already has license) from seed data — that's OK
        assert resp.status_code in (201, 409)
        if resp.status_code == 201:
            data = resp.json()
            assert data["plan_tier"] == "starter"
            assert data["status"] == "active"

    @pytest.mark.asyncio
    async def test_update_license(self, client: AsyncClient):
        """PUT /platform/licenses/{id} updates license fields."""
        resp = await client.put(
            f"/api/v1/platform/licenses/{LICENSE_1_ID}",
            json={"notes": "Updated via test"},
        )
        assert resp.status_code == 200
        data = resp.json()
        # Response may be dict with warnings or direct LicenseResponse
        if "license" in data:
            assert data["license"]["notes"] == "Updated via test"
        else:
            assert data["notes"] == "Updated via test"

    @pytest.mark.asyncio
    async def test_suspend_and_reinstate(self, client: AsyncClient):
        """Suspend then reinstate a license."""
        # Suspend
        resp = await client.post(
            f"/api/v1/platform/licenses/{LICENSE_2_ID}/suspend",
            json={"reason": "Test suspension"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "suspended"

        # Reinstate
        resp = await client.post(
            f"/api/v1/platform/licenses/{LICENSE_2_ID}/reinstate"
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "active"


# ===================================================================
# GROUP 2: System Health
# ===================================================================


class TestHealthEndpoints:
    @pytest.mark.asyncio
    async def test_health_overview(self, client: AsyncClient):
        """GET /platform/health/overview returns live component checks."""
        resp = await client.get("/api/v1/platform/health/overview")
        assert resp.status_code == 200
        data = resp.json()
        assert "system_status" in data
        assert "components" in data
        assert "active_alerts" in data
        assert "total_active_licenses" in data

        # API should always be healthy
        assert data["components"]["api"]["status"] == "healthy"
        # Database should be healthy (we're connected)
        assert data["components"]["database"]["status"] == "healthy"
        # All components should have a status field
        for name, comp in data["components"].items():
            assert "status" in comp, f"Component {name} missing status"

    @pytest.mark.asyncio
    async def test_health_metrics(self, client: AsyncClient):
        """GET /platform/health/metrics returns time-series data."""
        resp = await client.get(
            "/api/v1/platform/health/metrics?component=database"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        # Should have seeded data
        if data:
            point = data[0]
            assert "timestamp" in point
            assert "value" in point

    @pytest.mark.asyncio
    async def test_ai_costs(self, client: AsyncClient):
        """GET /platform/health/ai-costs returns zeros gracefully."""
        resp = await client.get("/api/v1/platform/health/ai-costs")
        assert resp.status_code == 200
        data = resp.json()
        assert "total_cost_today_usd" in data
        assert "total_cost_this_month_usd" in data
        assert "by_college" in data
        assert "by_model" in data
        assert "by_agent" in data
        assert "cache_savings_usd" in data
        assert "projected_monthly_cost_usd" in data


# ===================================================================
# GROUP 3: Cross-Tenant Analytics
# ===================================================================


class TestAnalyticsEndpoints:
    @pytest.mark.asyncio
    async def test_analytics_overview(self, client: AsyncClient):
        """GET /platform/analytics/overview returns real metrics."""
        resp = await client.get("/api/v1/platform/analytics/overview")
        assert resp.status_code == 200
        data = resp.json()

        assert data["total_licenses"] >= 3
        assert data["active_licenses"] >= 2
        assert "mrr_inr" in data
        assert "top_engaged_colleges" in data
        assert "least_engaged_colleges" in data

        # Engagement data should be populated from snapshots
        if data["top_engaged_colleges"]:
            top = data["top_engaged_colleges"][0]
            assert "name" in top
            assert "dau" in top
            assert top["dau"] > 0

    @pytest.mark.asyncio
    async def test_feature_adoption(self, client: AsyncClient):
        """GET /platform/analytics/feature-adoption returns feature data."""
        resp = await client.get("/api/v1/platform/analytics/feature-adoption")
        assert resp.status_code == 200
        data = resp.json()
        assert "features" in data
        assert len(data["features"]) > 0

        # Check enrichment
        first = data["features"][0]
        assert first["enabled_count"] > 0
        assert "active_users" in first
        assert "calls_per_day" in first

    @pytest.mark.asyncio
    async def test_college_analytics(self, client: AsyncClient):
        """GET /platform/analytics/college/{id} returns college detail."""
        resp = await client.get(
            f"/api/v1/platform/analytics/college/{COLLEGE_1_ID}"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["college_id"] == COLLEGE_1_ID
        assert "college_name" in data
        assert "license" in data
        assert "usage" in data
        assert "ai_costs" in data


# ===================================================================
# GROUP 4: Alerts
# ===================================================================


class TestAlertEndpoints:
    @pytest.mark.asyncio
    async def test_list_alerts(self, client: AsyncClient):
        """GET /platform/alerts returns seeded alerts."""
        resp = await client.get("/api/v1/platform/alerts?status=active")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1
        assert len(data["items"]) >= 1

        first = data["items"][0]
        assert "severity" in first
        assert "title" in first
        assert "status" in first

    @pytest.mark.asyncio
    async def test_acknowledge_alert(self, client: AsyncClient):
        """POST /platform/alerts/{id}/acknowledge changes status."""
        # Get an active alert
        resp = await client.get("/api/v1/platform/alerts?status=active")
        alerts = resp.json()["items"]
        if not alerts:
            pytest.skip("No active alerts to acknowledge")

        alert_id = alerts[0]["id"]
        resp = await client.post(
            f"/api/v1/platform/alerts/{alert_id}/acknowledge"
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "acknowledged"

    @pytest.mark.asyncio
    async def test_resolve_alert(self, client: AsyncClient):
        """POST /platform/alerts/{id}/resolve changes status."""
        # Get an active or acknowledged alert
        resp = await client.get("/api/v1/platform/alerts")
        all_alerts = resp.json()["items"]
        target = next(
            (a for a in all_alerts if a["status"] in ("active", "acknowledged")),
            None,
        )
        if target is None:
            pytest.skip("No resolvable alerts")

        resp = await client.post(
            f"/api/v1/platform/alerts/{target['id']}/resolve",
            json={"resolution_notes": "Resolved in test"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "resolved"


# ===================================================================
# GROUP 5: Audit Log
# ===================================================================


class TestAuditLogEndpoints:
    @pytest.mark.asyncio
    async def test_list_audit_log(self, client: AsyncClient):
        """GET /platform/audit-log returns seeded entries."""
        resp = await client.get("/api/v1/platform/audit-log")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1
        assert len(data["items"]) >= 1

        first = data["items"][0]
        assert "action" in first
        assert "entity_type" in first
        assert "actor_id" in first
        assert "created_at" in first

    @pytest.mark.asyncio
    async def test_audit_log_filter_action(self, client: AsyncClient):
        """Filter audit log by action works."""
        resp = await client.get(
            "/api/v1/platform/audit-log?action=license.create"
        )
        assert resp.status_code == 200
        data = resp.json()
        for item in data["items"]:
            assert item["action"] == "license.create"

    @pytest.mark.asyncio
    async def test_audit_log_filter_entity_type(self, client: AsyncClient):
        """Filter audit log by entity_type works."""
        resp = await client.get(
            "/api/v1/platform/audit-log?entity_type=license"
        )
        assert resp.status_code == 200
        data = resp.json()
        for item in data["items"]:
            assert item["entity_type"] == "license"


# ===================================================================
# GROUP 6: Onboarding
# ===================================================================


class TestOnboardingEndpoints:
    @pytest.mark.asyncio
    async def test_onboarding_status(self, client: AsyncClient):
        """GET /platform/onboarding-status returns colleges."""
        resp = await client.get("/api/v1/platform/onboarding-status")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 3

        first = data[0]
        assert "college_name" in first
        assert "plan_tier" in first
        assert "days_since_created" in first
