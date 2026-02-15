"""Error handler tests — verify the standard error envelope.

Tests cover:
- AcolyteException subclasses produce correct {"error": {...}} envelope
- Pydantic RequestValidationError is wrapped with field-level details
- Raw HTTPExceptions (from FastAPI internals) are wrapped consistently
- Unhandled exceptions return 500 with no stack trace leaked
- RateLimitException includes Retry-After header
- Backward-compat aliases (DuplicateError, ResourceNotFoundError) still work
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


def _make_user(
    role: UserRole = UserRole.ADMIN,
) -> CurrentUser:
    return CurrentUser(
        user_id="user_test_error",
        college_id=COLLEGE_A_ID,
        role=role,
        email="test@test.edu",
        full_name="Test User",
        org_slug="test-college",
        permissions=[],
    )


def _setup_auth(user: CurrentUser):
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_tenant_db] = lambda: AsyncMock()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Helper to validate the error envelope shape
# ---------------------------------------------------------------------------

def assert_error_envelope(data: dict, code: str, status_code: int = None):
    """Assert the response matches the standard error envelope."""
    assert "error" in data, f"Response missing 'error' key: {data}"
    error = data["error"]
    assert "code" in error, f"Error missing 'code': {error}"
    assert "message" in error, f"Error missing 'message': {error}"
    assert "timestamp" in error, f"Error missing 'timestamp': {error}"
    assert error["code"] == code, f"Expected code '{code}', got '{error['code']}'"


# ---------------------------------------------------------------------------
# AcolyteException handler tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
class TestAcolyteExceptionHandler:
    """Verify that AcolyteException subclasses produce the standard envelope."""

    async def test_not_found_exception(self, client):
        """NotFoundException should return 404 with NOT_FOUND code."""
        from app.shared.exceptions import NotFoundException

        # Create a test route that raises NotFoundException
        @app.get("/test/not-found")
        async def _raise_not_found():
            raise NotFoundException("Department", "some-uuid")

        response = await client.get("/test/not-found")
        assert response.status_code == 404
        data = response.json()
        assert_error_envelope(data, "NOT_FOUND")
        assert "Department" in data["error"]["message"]
        assert data["error"]["details"]["entity_type"] == "Department"

    async def test_duplicate_exception(self, client):
        """DuplicateException should return 409 with DUPLICATE_ENTITY code."""
        from app.shared.exceptions import DuplicateException

        @app.get("/test/duplicate")
        async def _raise_duplicate():
            raise DuplicateException("Department", "code", "ANAT")

        response = await client.get("/test/duplicate")
        assert response.status_code == 409
        data = response.json()
        assert_error_envelope(data, "DUPLICATE_ENTITY")
        assert "ANAT" in data["error"]["message"]
        assert data["error"]["details"]["field"] == "code"

    async def test_validation_exception(self, client):
        """ValidationException (business logic) should return 422."""
        from app.shared.exceptions import ValidationException

        @app.get("/test/validation")
        async def _raise_validation():
            raise ValidationException(
                "Cannot schedule rotation on a holiday",
                errors=[{"field": "date", "issue": "falls on holiday"}],
            )

        response = await client.get("/test/validation")
        assert response.status_code == 422
        data = response.json()
        assert_error_envelope(data, "VALIDATION_ERROR")
        assert data["error"]["details"][0]["field"] == "date"

    async def test_forbidden_exception(self, client):
        """ForbiddenException should return 403 with FORBIDDEN code."""
        from app.shared.exceptions import ForbiddenException

        @app.get("/test/forbidden")
        async def _raise_forbidden():
            raise ForbiddenException("Only HOD can approve assessments")

        response = await client.get("/test/forbidden")
        assert response.status_code == 403
        data = response.json()
        assert_error_envelope(data, "FORBIDDEN")
        assert "HOD" in data["error"]["message"]

    async def test_unauthorized_exception(self, client):
        """UnauthorizedException should return 401 with WWW-Authenticate header."""
        from app.shared.exceptions import UnauthorizedException

        @app.get("/test/unauthorized")
        async def _raise_unauthorized():
            raise UnauthorizedException("Token expired")

        response = await client.get("/test/unauthorized")
        assert response.status_code == 401
        data = response.json()
        assert_error_envelope(data, "UNAUTHORIZED")
        assert response.headers.get("www-authenticate") == "Bearer"

    async def test_tenant_mismatch_exception(self, client):
        """TenantMismatchException should return 403 with TENANT_MISMATCH code."""
        from app.shared.exceptions import TenantMismatchException

        @app.get("/test/tenant-mismatch")
        async def _raise_tenant_mismatch():
            raise TenantMismatchException()

        response = await client.get("/test/tenant-mismatch")
        assert response.status_code == 403
        data = response.json()
        assert_error_envelope(data, "TENANT_MISMATCH")

    async def test_rate_limit_exception(self, client):
        """RateLimitException should return 429 with Retry-After header."""
        from app.shared.exceptions import RateLimitException

        @app.get("/test/rate-limit")
        async def _raise_rate_limit():
            raise RateLimitException(retry_after=120)

        response = await client.get("/test/rate-limit")
        assert response.status_code == 429
        data = response.json()
        assert_error_envelope(data, "RATE_LIMITED")
        assert response.headers.get("retry-after") == "120"
        assert data["error"]["details"]["retry_after"] == 120

    async def test_external_service_exception(self, client):
        """ExternalServiceException should return 502."""
        from app.shared.exceptions import ExternalServiceException

        @app.get("/test/external-error")
        async def _raise_external():
            raise ExternalServiceException("Permify", "connection refused")

        response = await client.get("/test/external-error")
        assert response.status_code == 502
        data = response.json()
        assert_error_envelope(data, "EXTERNAL_SERVICE_ERROR")
        assert data["error"]["details"]["service"] == "Permify"


# ---------------------------------------------------------------------------
# Pydantic validation error handler tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
class TestValidationErrorHandler:
    """Verify that Pydantic RequestValidationError is wrapped correctly."""

    async def test_missing_required_fields(self, client):
        """POST with missing required fields should return 422 with field details."""
        _setup_auth(_make_user())
        response = await client.post(
            "/api/v1/admin/departments/",
            json={"name": "Anatomy"},  # missing code, nmc_department_type
        )
        assert response.status_code == 422
        data = response.json()
        assert_error_envelope(data, "VALIDATION_ERROR")
        assert data["error"]["message"] == "Request validation failed"
        # Should have field-level details
        details = data["error"]["details"]
        assert isinstance(details, list)
        assert len(details) >= 1
        fields = [d["field"] for d in details]
        assert any("code" in f for f in fields)

    async def test_invalid_field_type(self, client):
        """POST with wrong type should return 422 with field details."""
        _setup_auth(_make_user())
        response = await client.post(
            "/api/v1/admin/departments/",
            json={
                "name": "Anatomy",
                "code": "ANAT",
                "nmc_department_type": "preclinical",
                "established_year": "not-a-number",
            },
        )
        assert response.status_code == 422
        data = response.json()
        assert_error_envelope(data, "VALIDATION_ERROR")


# ---------------------------------------------------------------------------
# HTTPException handler tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
class TestHTTPExceptionHandler:
    """Verify that raw HTTPExceptions are wrapped in the standard envelope."""

    async def test_no_bearer_token(self, client):
        """Request without Bearer token should return 403 with error envelope."""
        # Don't set up auth — HTTPBearer(auto_error=True) raises HTTPException(403)
        response = await client.get("/api/v1/admin/departments/")
        assert response.status_code == 403
        data = response.json()
        assert_error_envelope(data, "FORBIDDEN")

    async def test_role_denied_wrapped(self, client):
        """Role denial (HTTPException from require_role) should be wrapped."""
        _setup_auth(_make_user(role=UserRole.STUDENT))
        response = await client.post(
            "/api/v1/admin/departments/",
            json={"name": "Anatomy", "code": "ANAT", "nmc_department_type": "preclinical"},
        )
        assert response.status_code == 403
        data = response.json()
        assert_error_envelope(data, "FORBIDDEN")
        assert "student" in data["error"]["message"].lower()


# ---------------------------------------------------------------------------
# Unhandled exception handler tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
class TestUnhandledExceptionHandler:
    """Verify that unhandled exceptions return 500 without leaking details."""

    async def test_runtime_error_returns_500(self, client):
        """Unhandled RuntimeError should return 500 with generic message."""
        @app.get("/test/crash")
        async def _raise_runtime():
            raise RuntimeError("database connection pool exhausted")

        response = await client.get("/test/crash")
        assert response.status_code == 500
        data = response.json()
        assert_error_envelope(data, "INTERNAL_ERROR")
        assert data["error"]["message"] == "An unexpected error occurred"
        # CRITICAL: stack trace must NOT be leaked
        assert "database connection pool" not in str(data)


# ---------------------------------------------------------------------------
# Backward compatibility tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
class TestBackwardCompatibility:
    """Verify that old exception aliases still produce the correct envelope."""

    async def test_duplicate_error_alias(self, client):
        """DuplicateError (old name) should work identically to DuplicateException."""
        from app.shared.exceptions import DuplicateError

        @app.get("/test/compat-duplicate")
        async def _raise_old_duplicate():
            raise DuplicateError("Faculty", "email", "dr@test.edu")

        response = await client.get("/test/compat-duplicate")
        assert response.status_code == 409
        data = response.json()
        assert_error_envelope(data, "DUPLICATE_ENTITY")

    async def test_resource_not_found_alias(self, client):
        """ResourceNotFoundError (old name) should work identically to NotFoundException."""
        from app.shared.exceptions import ResourceNotFoundError

        @app.get("/test/compat-not-found")
        async def _raise_old_not_found():
            raise ResourceNotFoundError("Student", "abc-123")

        response = await client.get("/test/compat-not-found")
        assert response.status_code == 404
        data = response.json()
        assert_error_envelope(data, "NOT_FOUND")


# ---------------------------------------------------------------------------
# Health check still works (no interference from error handlers)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
class TestHealthCheckUnaffected:
    """Health check is a public endpoint that should NOT be affected by error handlers."""

    async def test_health_check_still_returns_200(self, client):
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "error" not in data
