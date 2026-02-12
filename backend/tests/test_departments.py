"""Department CRUD tests — REFERENCE TEST PATTERN.

Tests cover:
- Auth: unauthenticated → 403, wrong role → 403
- Role-based access (admin/dean/management can write; all roles can read)
- Pydantic validation (missing fields, invalid types, range constraints)
- Schema serialization (from_attributes, partial updates, pagination)

When building tests for new engines, copy this structure:
1. Use app.dependency_overrides (NOT unittest.mock.patch) for FastAPI deps
2. Override both get_current_user AND get_tenant_db for all authenticated tests
3. Test role denial first (403), then test that valid roles pass auth
4. Schema and validation tests don't need a real DB
"""

import uuid
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.dependencies.auth import get_current_user, get_tenant_db
from app.main import app
from app.middleware.clerk_auth import CurrentUser, UserRole

# ---------------------------------------------------------------------------
# Test data
# ---------------------------------------------------------------------------

COLLEGE_A_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
COLLEGE_B_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")


def _make_user(
    college_id: uuid.UUID = COLLEGE_A_ID,
    role: UserRole = UserRole.ADMIN,
    user_id: str = "user_test_admin",
    email: str = "admin@test.edu",
) -> CurrentUser:
    """Create a mock CurrentUser for testing."""
    return CurrentUser(
        user_id=user_id,
        college_id=college_id,
        role=role,
        email=email,
        full_name="Test Admin",
        org_slug="test-college",
        permissions=[],
    )


def _setup_auth(user: CurrentUser):
    """Override auth + DB dependencies for unit tests (no real database needed).

    - Bypasses Clerk JWT validation entirely
    - Provides a mock AsyncSession so DB-dependent routes don't crash
    - Role checks still work because they inspect the CurrentUser object
    """
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_tenant_db] = lambda: AsyncMock()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def client():
    """Async HTTP test client. Clears dependency overrides after each test.

    raise_server_exceptions=False ensures mock DB errors return 500 responses
    instead of crashing the test — needed for role-check tests that use mock sessions.
    """
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Auth tests — unauthenticated requests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
class TestDepartmentNoAuth:
    """Verify that unauthenticated requests are rejected."""

    async def test_list_without_token(self, client):
        """GET /departments without Bearer token returns 403."""
        response = await client.get("/api/v1/departments/")
        assert response.status_code == 403

    async def test_create_without_token(self, client):
        """POST /departments without Bearer token returns 403."""
        response = await client.post(
            "/api/v1/departments/",
            json={"name": "Anatomy", "code": "ANAT", "nmc_department_type": "preclinical"},
        )
        assert response.status_code == 403

    async def test_get_without_token(self, client):
        """GET /departments/{id} without Bearer token returns 403."""
        response = await client.get(f"/api/v1/departments/{uuid.uuid4()}")
        assert response.status_code == 403

    async def test_update_without_token(self, client):
        """PATCH /departments/{id} without Bearer token returns 403."""
        response = await client.patch(
            f"/api/v1/departments/{uuid.uuid4()}",
            json={"name": "Updated"},
        )
        assert response.status_code == 403

    async def test_delete_without_token(self, client):
        """DELETE /departments/{id} without Bearer token returns 403."""
        response = await client.delete(f"/api/v1/departments/{uuid.uuid4()}")
        assert response.status_code == 403


# ---------------------------------------------------------------------------
# Auth tests — role-based access control
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
class TestDepartmentRoleAccess:
    """Verify role-based access control on department endpoints."""

    # --- Write operations: only admin, dean, management ---

    async def test_student_cannot_create(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.post(
            "/api/v1/departments/",
            json={"name": "Anatomy", "code": "ANAT", "nmc_department_type": "preclinical"},
        )
        assert r.status_code == 403

    async def test_faculty_cannot_create(self, client):
        _setup_auth(_make_user(role=UserRole.FACULTY))
        r = await client.post(
            "/api/v1/departments/",
            json={"name": "Anatomy", "code": "ANAT", "nmc_department_type": "preclinical"},
        )
        assert r.status_code == 403

    async def test_hod_cannot_create(self, client):
        _setup_auth(_make_user(role=UserRole.HOD))
        r = await client.post(
            "/api/v1/departments/",
            json={"name": "Anatomy", "code": "ANAT", "nmc_department_type": "preclinical"},
        )
        assert r.status_code == 403

    async def test_compliance_officer_cannot_create(self, client):
        _setup_auth(_make_user(role=UserRole.COMPLIANCE_OFFICER))
        r = await client.post(
            "/api/v1/departments/",
            json={"name": "Anatomy", "code": "ANAT", "nmc_department_type": "preclinical"},
        )
        assert r.status_code == 403

    async def test_admin_can_create(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(
            "/api/v1/departments/",
            json={"name": "Anatomy", "code": "ANAT", "nmc_department_type": "preclinical"},
        )
        assert r.status_code != 403, "Admin should pass role check"

    async def test_dean_can_create(self, client):
        _setup_auth(_make_user(role=UserRole.DEAN))
        r = await client.post(
            "/api/v1/departments/",
            json={"name": "Anatomy", "code": "ANAT", "nmc_department_type": "preclinical"},
        )
        assert r.status_code != 403, "Dean should pass role check"

    async def test_management_can_create(self, client):
        _setup_auth(_make_user(role=UserRole.MANAGEMENT))
        r = await client.post(
            "/api/v1/departments/",
            json={"name": "Anatomy", "code": "ANAT", "nmc_department_type": "preclinical"},
        )
        assert r.status_code != 403, "Management should pass role check"

    # --- Update: only admin, dean ---

    async def test_student_cannot_update(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.patch(
            f"/api/v1/departments/{uuid.uuid4()}", json={"name": "X"},
        )
        assert r.status_code == 403

    async def test_faculty_cannot_update(self, client):
        _setup_auth(_make_user(role=UserRole.FACULTY))
        r = await client.patch(
            f"/api/v1/departments/{uuid.uuid4()}", json={"name": "X"},
        )
        assert r.status_code == 403

    async def test_admin_can_update(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.patch(
            f"/api/v1/departments/{uuid.uuid4()}", json={"name": "X"},
        )
        assert r.status_code != 403, "Admin should pass role check"

    async def test_dean_can_update(self, client):
        _setup_auth(_make_user(role=UserRole.DEAN))
        r = await client.patch(
            f"/api/v1/departments/{uuid.uuid4()}", json={"name": "X"},
        )
        assert r.status_code != 403, "Dean should pass role check"

    # --- Delete: only admin, dean ---

    async def test_student_cannot_delete(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.delete(f"/api/v1/departments/{uuid.uuid4()}")
        assert r.status_code == 403

    async def test_admin_can_delete(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.delete(f"/api/v1/departments/{uuid.uuid4()}")
        assert r.status_code != 403, "Admin should pass role check"

    # --- Read: all authenticated roles ---

    async def test_student_can_list(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.get("/api/v1/departments/")
        assert r.status_code != 403, "Students should have read access"

    async def test_student_can_get_by_id(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.get(f"/api/v1/departments/{uuid.uuid4()}")
        assert r.status_code != 403, "Students should have read access"

    async def test_faculty_can_list(self, client):
        _setup_auth(_make_user(role=UserRole.FACULTY))
        r = await client.get("/api/v1/departments/")
        assert r.status_code != 403, "Faculty should have read access"

    async def test_compliance_can_list(self, client):
        _setup_auth(_make_user(role=UserRole.COMPLIANCE_OFFICER))
        r = await client.get("/api/v1/departments/")
        assert r.status_code != 403, "Compliance officer should have read access"


# ---------------------------------------------------------------------------
# Validation tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
class TestDepartmentValidation:
    """Verify Pydantic schema validation on department endpoints."""

    async def test_create_missing_required_fields(self, client):
        """POST with missing code and nmc_department_type returns 422."""
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(
            "/api/v1/departments/", json={"name": "Anatomy"},
        )
        assert r.status_code == 422

    async def test_create_invalid_nmc_type(self, client):
        """POST with invalid nmc_department_type returns 422."""
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(
            "/api/v1/departments/",
            json={"name": "Anatomy", "code": "ANAT", "nmc_department_type": "invalid_type"},
        )
        assert r.status_code == 422

    async def test_create_empty_name(self, client):
        """POST with empty name returns 422."""
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(
            "/api/v1/departments/",
            json={"name": "", "code": "ANAT", "nmc_department_type": "preclinical"},
        )
        assert r.status_code == 422

    async def test_list_page_zero(self, client):
        """GET with page=0 returns 422."""
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.get("/api/v1/departments/?page=0")
        assert r.status_code == 422

    async def test_list_page_size_over_limit(self, client):
        """GET with page_size=200 (over limit of 100) returns 422."""
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.get("/api/v1/departments/?page_size=200")
        assert r.status_code == 422

    async def test_list_invalid_nmc_type_filter(self, client):
        """GET with invalid nmc_type filter returns 422."""
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.get("/api/v1/departments/?nmc_type=invalid")
        assert r.status_code == 422

    async def test_create_all_valid_nmc_types(self, client):
        """All three NMC types should be accepted (not 422)."""
        _setup_auth(_make_user(role=UserRole.ADMIN))
        for nmc_type in ["preclinical", "paraclinical", "clinical"]:
            r = await client.post(
                "/api/v1/departments/",
                json={"name": f"Dept {nmc_type}", "code": nmc_type[:4].upper(), "nmc_department_type": nmc_type},
            )
            assert r.status_code != 422, f"NMC type '{nmc_type}' should be valid"


# ---------------------------------------------------------------------------
# Service unit tests (no HTTP, no DB)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
class TestDepartmentService:
    """Unit tests for DepartmentService business logic."""

    async def test_create_schema_preserves_code_case(self):
        """Schema doesn't uppercase — that's the service's job."""
        from app.engines.admin.schemas import DepartmentCreate, NMCDepartmentType

        data = DepartmentCreate(
            name="Anatomy", code="anat", nmc_department_type=NMCDepartmentType.PRECLINICAL,
        )
        assert data.code == "anat"

    async def test_update_partial_fields(self):
        """exclude_unset should only include provided fields."""
        from app.engines.admin.schemas import DepartmentUpdate

        data = DepartmentUpdate(name="Updated Anatomy")
        dumped = data.model_dump(exclude_unset=True)
        assert dumped == {"name": "Updated Anatomy"}
        assert "code" not in dumped
        assert "nmc_department_type" not in dumped

    async def test_update_empty_is_noop(self):
        """Empty update should have no fields."""
        from app.engines.admin.schemas import DepartmentUpdate

        data = DepartmentUpdate()
        assert data.model_dump(exclude_unset=True) == {}


# ---------------------------------------------------------------------------
# Schema serialization tests (no HTTP, no DB)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
class TestDepartmentSchemas:
    """Test Pydantic schema serialization and validation."""

    async def test_response_from_orm_object(self):
        """DepartmentResponse should work with from_attributes (ORM mode)."""
        from datetime import datetime, timezone

        from app.engines.admin.schemas import DepartmentResponse

        class FakeDepartment:
            id = uuid.uuid4()
            college_id = COLLEGE_A_ID
            name = "Anatomy"
            code = "ANAT"
            nmc_department_type = "preclinical"
            hod_id = None
            is_active = True
            established_year = 1960
            created_at = datetime.now(timezone.utc)
            updated_at = datetime.now(timezone.utc)

        resp = DepartmentResponse.model_validate(FakeDepartment())
        assert resp.name == "Anatomy"
        assert resp.code == "ANAT"
        assert resp.is_active is True
        assert resp.college_id == COLLEGE_A_ID

    async def test_list_response_pagination_fields(self):
        """DepartmentListResponse should have all pagination fields."""
        from app.engines.admin.schemas import DepartmentListResponse

        resp = DepartmentListResponse(
            data=[], total=0, page=1, page_size=20, total_pages=1,
        )
        assert resp.total == 0
        assert resp.page == 1
        assert resp.total_pages == 1
        assert resp.data == []

    async def test_established_year_range_validation(self):
        """established_year should be between 1900 and 2100."""
        from pydantic import ValidationError as PydanticValidationError

        from app.engines.admin.schemas import DepartmentCreate, NMCDepartmentType

        # Valid
        data = DepartmentCreate(
            name="Anatomy", code="ANAT",
            nmc_department_type=NMCDepartmentType.PRECLINICAL,
            established_year=1960,
        )
        assert data.established_year == 1960

        # Too low
        with pytest.raises(PydanticValidationError):
            DepartmentCreate(
                name="Anatomy", code="ANAT",
                nmc_department_type=NMCDepartmentType.PRECLINICAL,
                established_year=1800,
            )

        # Too high
        with pytest.raises(PydanticValidationError):
            DepartmentCreate(
                name="Anatomy", code="ANAT",
                nmc_department_type=NMCDepartmentType.PRECLINICAL,
                established_year=2200,
            )

    async def test_create_with_optional_fields(self):
        """Optional fields should default to None."""
        from app.engines.admin.schemas import DepartmentCreate, NMCDepartmentType

        data = DepartmentCreate(
            name="Anatomy", code="ANAT",
            nmc_department_type=NMCDepartmentType.PRECLINICAL,
        )
        assert data.hod_id is None
        assert data.established_year is None

    async def test_update_with_all_fields(self):
        """DepartmentUpdate should accept all fields."""
        from app.engines.admin.schemas import DepartmentUpdate, NMCDepartmentType

        data = DepartmentUpdate(
            name="Updated", code="UPD", nmc_department_type=NMCDepartmentType.CLINICAL,
            hod_id=uuid.uuid4(), is_active=False, established_year=2000,
        )
        dumped = data.model_dump(exclude_unset=True)
        assert len(dumped) == 6
