"""Admin Engine — End-to-end tests.

Tests cover all 25 admin sub-routers under /api/v1/admin/:
- Auth: unauthenticated → 403
- Role-based access: forbidden roles → 403, allowed roles pass
- Validation: missing/invalid fields → 422
- Schema serialization: Pydantic models work correctly

Run:
    cd backend && pytest tests/test_admin_engine_e2e.py -v
"""

import uuid
from datetime import date, datetime, timezone
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
FAKE_UUID = str(uuid.uuid4())
FAKE_DEPT_ID = str(uuid.uuid4())
FAKE_STUDENT_ID = str(uuid.uuid4())
FAKE_FACULTY_ID = str(uuid.uuid4())

BASE = "/api/v1/admin"


def _make_user(
    college_id: uuid.UUID = COLLEGE_A_ID,
    role: UserRole = UserRole.ADMIN,
    user_id: str = "user_test_admin",
    email: str = "admin@test.edu",
) -> CurrentUser:
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


# ===========================================================================
# 1. DASHBOARD
# ===========================================================================

@pytest.mark.asyncio
class TestDashboardNoAuth:
    async def test_stats_no_auth(self, client):
        r = await client.get(f"{BASE}/dashboard/stats")
        assert r.status_code == 403

    async def test_fee_trend_no_auth(self, client):
        r = await client.get(f"{BASE}/dashboard/fee-trend")
        assert r.status_code == 403


@pytest.mark.asyncio
class TestDashboardAuth:
    async def test_stats_any_role(self, client):
        for role in [UserRole.ADMIN, UserRole.FACULTY, UserRole.STUDENT]:
            _setup_auth(_make_user(role=role))
            r = await client.get(f"{BASE}/dashboard/stats")
            assert r.status_code != 403, f"{role} should access dashboard stats"

    async def test_pending_approvals(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.get(f"{BASE}/dashboard/pending-approvals")
        assert r.status_code != 403

    async def test_recent_activity(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.get(f"{BASE}/dashboard/recent-activity")
        assert r.status_code != 403

    async def test_student_distribution(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.get(f"{BASE}/dashboard/student-distribution")
        assert r.status_code != 403

    async def test_faculty_distribution(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.get(f"{BASE}/dashboard/faculty-distribution")
        assert r.status_code != 403


# ===========================================================================
# 2. STUDENTS
# ===========================================================================

@pytest.mark.asyncio
class TestStudentsNoAuth:
    async def test_list_no_auth(self, client):
        r = await client.get(f"{BASE}/students/")
        assert r.status_code == 403

    async def test_create_no_auth(self, client):
        r = await client.post(f"{BASE}/students/", json={"name": "Test"})
        assert r.status_code == 403

    async def test_get_no_auth(self, client):
        r = await client.get(f"{BASE}/students/{FAKE_UUID}")
        assert r.status_code == 403


@pytest.mark.asyncio
class TestStudentsRoleAccess:
    async def test_student_cannot_create(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.post(f"{BASE}/students/", json={"name": "Test"})
        assert r.status_code == 403

    async def test_faculty_cannot_create(self, client):
        _setup_auth(_make_user(role=UserRole.FACULTY))
        r = await client.post(f"{BASE}/students/", json={"name": "Test"})
        assert r.status_code == 403

    async def test_compliance_cannot_create(self, client):
        _setup_auth(_make_user(role=UserRole.COMPLIANCE_OFFICER))
        r = await client.post(f"{BASE}/students/", json={"name": "Test"})
        assert r.status_code == 403

    async def test_admin_can_create(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/students/", json={"name": "Test Student"})
        assert r.status_code != 403, "Admin should pass role check"

    async def test_dean_can_create(self, client):
        _setup_auth(_make_user(role=UserRole.DEAN))
        r = await client.post(f"{BASE}/students/", json={"name": "Test Student"})
        assert r.status_code != 403, "Dean should pass role check"

    async def test_any_role_can_list(self, client):
        for role in [UserRole.STUDENT, UserRole.FACULTY, UserRole.HOD]:
            _setup_auth(_make_user(role=role))
            r = await client.get(f"{BASE}/students/")
            assert r.status_code != 403, f"{role} should have read access"

    async def test_student_cannot_delete(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.delete(f"{BASE}/students/{FAKE_UUID}")
        assert r.status_code == 403

    async def test_student_cannot_promote(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.post(f"{BASE}/students/{FAKE_UUID}/promote", json={})
        assert r.status_code == 403

    async def test_admin_can_promote(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/students/{FAKE_UUID}/promote", json={})
        assert r.status_code != 403

    async def test_seat_matrix_any_role(self, client):
        _setup_auth(_make_user(role=UserRole.FACULTY))
        r = await client.get(f"{BASE}/students/seat-matrix")
        assert r.status_code != 403

    async def test_student_cannot_nmc_upload(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.post(f"{BASE}/students/nmc-upload", json={"student_ids": [FAKE_UUID]})
        assert r.status_code == 403


@pytest.mark.asyncio
class TestStudentsValidation:
    async def test_create_missing_name(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/students/", json={})
        assert r.status_code == 422

    async def test_nmc_upload_empty_list(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/students/nmc-upload", json={"student_ids": []})
        assert r.status_code == 422


# ===========================================================================
# 3. FACULTY
# ===========================================================================

@pytest.mark.asyncio
class TestFacultyNoAuth:
    async def test_list_no_auth(self, client):
        r = await client.get(f"{BASE}/faculty/")
        assert r.status_code == 403

    async def test_create_no_auth(self, client):
        r = await client.post(f"{BASE}/faculty/", json={"name": "Dr. Test", "department_id": FAKE_DEPT_ID})
        assert r.status_code == 403


@pytest.mark.asyncio
class TestFacultyRoleAccess:
    async def test_student_cannot_create(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.post(f"{BASE}/faculty/", json={"name": "Dr. Test", "department_id": FAKE_DEPT_ID})
        assert r.status_code == 403

    async def test_admin_can_create(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/faculty/", json={"name": "Dr. Test", "department_id": FAKE_DEPT_ID})
        assert r.status_code != 403

    async def test_any_role_can_list(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.get(f"{BASE}/faculty/")
        assert r.status_code != 403

    async def test_msr_compliance_any_role(self, client):
        _setup_auth(_make_user(role=UserRole.COMPLIANCE_OFFICER))
        r = await client.get(f"{BASE}/faculty/msr-compliance")
        assert r.status_code != 403

    async def test_retirement_forecast_any_role(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.get(f"{BASE}/faculty/retirement-forecast")
        assert r.status_code != 403


@pytest.mark.asyncio
class TestFacultyValidation:
    async def test_create_missing_department(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/faculty/", json={"name": "Dr. Test"})
        assert r.status_code == 422

    async def test_create_missing_name(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/faculty/", json={"department_id": FAKE_DEPT_ID})
        assert r.status_code == 422


# ===========================================================================
# 4. FEES
# ===========================================================================

@pytest.mark.asyncio
class TestFeesNoAuth:
    async def test_list_structures_no_auth(self, client):
        r = await client.get(f"{BASE}/fees/structures")
        assert r.status_code == 403

    async def test_create_structure_no_auth(self, client):
        r = await client.post(f"{BASE}/fees/structures", json={
            "academic_year": "2025-26", "quota": "government", "tuition_fee": 50000000
        })
        assert r.status_code == 403


@pytest.mark.asyncio
class TestFeesRoleAccess:
    async def test_student_cannot_create_structure(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.post(f"{BASE}/fees/structures", json={
            "academic_year": "2025-26", "quota": "government", "tuition_fee": 50000000
        })
        assert r.status_code == 403

    async def test_admin_can_create_structure(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/fees/structures", json={
            "academic_year": "2025-26", "quota": "government", "tuition_fee": 50000000
        })
        assert r.status_code != 403

    async def test_any_role_can_list(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.get(f"{BASE}/fees/structures")
        assert r.status_code != 403

    async def test_student_cannot_record_payment(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.post(f"{BASE}/fees/record-payment", json={
            "student_id": FAKE_STUDENT_ID, "amount": 100000
        })
        assert r.status_code == 403

    async def test_admin_can_record_payment(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/fees/record-payment", json={
            "student_id": FAKE_STUDENT_ID, "amount": 100000
        })
        assert r.status_code != 403

    async def test_defaulters_any_role(self, client):
        _setup_auth(_make_user(role=UserRole.FACULTY))
        r = await client.get(f"{BASE}/fees/defaulters?academic_year=2025-26")
        assert r.status_code != 403

    async def test_collection_summary_any_role(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.get(f"{BASE}/fees/collection-summary?academic_year=2025-26")
        assert r.status_code != 403


@pytest.mark.asyncio
class TestFeesValidation:
    async def test_create_structure_missing_fields(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/fees/structures", json={"academic_year": "2025-26"})
        assert r.status_code == 422

    async def test_create_structure_negative_fee(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/fees/structures", json={
            "academic_year": "2025-26", "quota": "government", "tuition_fee": -100
        })
        assert r.status_code == 422

    async def test_record_payment_zero_amount(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/fees/record-payment", json={
            "student_id": FAKE_STUDENT_ID, "amount": 0
        })
        assert r.status_code == 422


# ===========================================================================
# 5. SCHOLARSHIPS
# ===========================================================================

@pytest.mark.asyncio
class TestScholarshipsNoAuth:
    async def test_list_schemes_no_auth(self, client):
        r = await client.get(f"{BASE}/scholarships/schemes")
        assert r.status_code == 403


@pytest.mark.asyncio
class TestScholarshipsRoleAccess:
    async def test_only_admin_can_create_scheme(self, client):
        _setup_auth(_make_user(role=UserRole.DEAN))
        r = await client.post(f"{BASE}/scholarships/schemes", json={"name": "Test Scholarship"})
        # Schemes require ADMIN only
        assert r.status_code == 403

    async def test_admin_can_create_scheme(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/scholarships/schemes", json={"name": "Test Scholarship"})
        assert r.status_code != 403

    async def test_student_cannot_auto_match(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.post(f"{BASE}/scholarships/auto-match")
        assert r.status_code == 403

    async def test_admin_can_auto_match(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/scholarships/auto-match")
        assert r.status_code != 403

    async def test_any_role_can_list_schemes(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.get(f"{BASE}/scholarships/schemes")
        assert r.status_code != 403


# ===========================================================================
# 6. PAYROLL
# ===========================================================================

@pytest.mark.asyncio
class TestPayrollNoAuth:
    async def test_list_no_auth(self, client):
        r = await client.get(f"{BASE}/payroll/")
        assert r.status_code == 403


@pytest.mark.asyncio
class TestPayrollRoleAccess:
    async def test_student_cannot_calculate(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.post(f"{BASE}/payroll/calculate?month=1&year=2026")
        assert r.status_code == 403

    async def test_admin_can_calculate(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/payroll/calculate?month=1&year=2026")
        assert r.status_code != 403

    async def test_only_admin_can_approve(self, client):
        _setup_auth(_make_user(role=UserRole.DEAN))
        r = await client.post(f"{BASE}/payroll/approve?month=1&year=2026")
        assert r.status_code == 403

    async def test_admin_can_approve(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/payroll/approve?month=1&year=2026")
        assert r.status_code != 403

    async def test_any_role_can_list(self, client):
        _setup_auth(_make_user(role=UserRole.FACULTY))
        r = await client.get(f"{BASE}/payroll/")
        assert r.status_code != 403

    async def test_salary_structures_any_role(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.get(f"{BASE}/payroll/salary-structures")
        assert r.status_code != 403

    async def test_only_admin_can_create_salary_structure(self, client):
        _setup_auth(_make_user(role=UserRole.DEAN))
        r = await client.post(f"{BASE}/payroll/salary-structures", json={
            "designation": "Professor", "pay_scale_type": "7cpc"
        })
        assert r.status_code == 403

    async def test_admin_can_create_salary_structure(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/payroll/salary-structures", json={
            "designation": "Professor", "pay_scale_type": "7cpc"
        })
        assert r.status_code != 403


@pytest.mark.asyncio
class TestPayrollValidation:
    async def test_calculate_invalid_month(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/payroll/calculate?month=13&year=2026")
        assert r.status_code == 422

    async def test_calculate_invalid_year(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/payroll/calculate?month=1&year=1999")
        assert r.status_code == 422


# ===========================================================================
# 7. LEAVE
# ===========================================================================

@pytest.mark.asyncio
class TestLeaveNoAuth:
    async def test_list_no_auth(self, client):
        r = await client.get(f"{BASE}/leave/")
        assert r.status_code == 403


@pytest.mark.asyncio
class TestLeaveRoleAccess:
    async def test_any_role_can_request_leave(self, client):
        _setup_auth(_make_user(role=UserRole.FACULTY))
        r = await client.post(f"{BASE}/leave/", json={
            "employee_id": FAKE_FACULTY_ID,
            "leave_type": "casual",
            "from_date": "2026-03-01",
            "to_date": "2026-03-02",
            "days": 2,
        })
        assert r.status_code != 403

    async def test_student_cannot_approve(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.post(f"{BASE}/leave/{FAKE_UUID}/approve")
        assert r.status_code == 403

    async def test_admin_can_approve(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/leave/{FAKE_UUID}/approve")
        assert r.status_code != 403

    async def test_student_cannot_reject(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.post(f"{BASE}/leave/{FAKE_UUID}/reject", json={})
        assert r.status_code == 403

    async def test_only_admin_can_create_policy(self, client):
        _setup_auth(_make_user(role=UserRole.DEAN))
        r = await client.post(f"{BASE}/leave/policies", json={
            "staff_category": "teaching", "leave_type": "casual"
        })
        assert r.status_code == 403

    async def test_admin_can_create_policy(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/leave/policies", json={
            "staff_category": "teaching", "leave_type": "casual"
        })
        assert r.status_code != 403


@pytest.mark.asyncio
class TestLeaveValidation:
    async def test_create_missing_required(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/leave/", json={"leave_type": "casual"})
        assert r.status_code == 422

    async def test_create_zero_days(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/leave/", json={
            "employee_id": FAKE_FACULTY_ID,
            "leave_type": "casual",
            "from_date": "2026-03-01",
            "to_date": "2026-03-01",
            "days": 0,
        })
        assert r.status_code == 422


# ===========================================================================
# 8. CERTIFICATES
# ===========================================================================

@pytest.mark.asyncio
class TestCertificatesNoAuth:
    async def test_list_no_auth(self, client):
        r = await client.get(f"{BASE}/certificates/")
        assert r.status_code == 403

    async def test_verify_is_public(self, client):
        """Certificate verification should be accessible without auth."""
        r = await client.get(f"{BASE}/certificates/verify/CERT-2026-0001")
        assert r.status_code != 403


@pytest.mark.asyncio
class TestCertificatesRoleAccess:
    async def test_student_cannot_create(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.post(f"{BASE}/certificates/", json={
            "student_id": FAKE_STUDENT_ID, "certificate_type": "bonafide"
        })
        assert r.status_code == 403

    async def test_admin_can_create(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/certificates/", json={
            "student_id": FAKE_STUDENT_ID, "certificate_type": "bonafide"
        })
        assert r.status_code != 403

    async def test_student_cannot_generate(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.post(f"{BASE}/certificates/generate", json={
            "student_id": FAKE_STUDENT_ID, "certificate_type": "bonafide"
        })
        assert r.status_code == 403

    async def test_student_cannot_revoke(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.post(f"{BASE}/certificates/{FAKE_UUID}/revoke?reason=test+reason")
        assert r.status_code == 403


@pytest.mark.asyncio
class TestCertificatesValidation:
    async def test_create_missing_student_id(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/certificates/", json={"certificate_type": "bonafide"})
        assert r.status_code == 422

    async def test_create_missing_type(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/certificates/", json={"student_id": FAKE_STUDENT_ID})
        assert r.status_code == 422


# ===========================================================================
# 9. HOSTEL
# ===========================================================================

@pytest.mark.asyncio
class TestHostelNoAuth:
    async def test_list_blocks_no_auth(self, client):
        r = await client.get(f"{BASE}/hostel/blocks")
        assert r.status_code == 403


@pytest.mark.asyncio
class TestHostelRoleAccess:
    async def test_student_cannot_create_block(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.post(f"{BASE}/hostel/blocks", json={"name": "Block A"})
        assert r.status_code == 403

    async def test_admin_can_create_block(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/hostel/blocks", json={"name": "Block A"})
        assert r.status_code != 403

    async def test_student_cannot_create_room(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.post(f"{BASE}/hostel/rooms", json={
            "block_id": FAKE_UUID, "room_number": "101", "capacity": 2
        })
        assert r.status_code == 403

    async def test_admin_can_create_room(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/hostel/rooms", json={
            "block_id": FAKE_UUID, "room_number": "101", "capacity": 2
        })
        assert r.status_code != 403

    async def test_student_cannot_allocate(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.post(f"{BASE}/hostel/allocate", json={
            "student_id": FAKE_STUDENT_ID, "room_id": FAKE_UUID, "block_id": FAKE_UUID
        })
        assert r.status_code == 403

    async def test_occupancy_any_role(self, client):
        _setup_auth(_make_user(role=UserRole.FACULTY))
        r = await client.get(f"{BASE}/hostel/occupancy")
        assert r.status_code != 403


@pytest.mark.asyncio
class TestHostelValidation:
    async def test_create_room_missing_block(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/hostel/rooms", json={"room_number": "101"})
        assert r.status_code == 422

    async def test_create_block_missing_name(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/hostel/blocks", json={})
        assert r.status_code == 422


# ===========================================================================
# 10. TRANSPORT
# ===========================================================================

@pytest.mark.asyncio
class TestTransportNoAuth:
    async def test_list_vehicles_no_auth(self, client):
        r = await client.get(f"{BASE}/transport/vehicles")
        assert r.status_code == 403


@pytest.mark.asyncio
class TestTransportRoleAccess:
    async def test_student_cannot_create_vehicle(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.post(f"{BASE}/transport/vehicles", json={"vehicle_number": "KA-01-1234"})
        assert r.status_code == 403

    async def test_admin_can_create_vehicle(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/transport/vehicles", json={"vehicle_number": "KA-01-1234"})
        assert r.status_code != 403

    async def test_student_cannot_create_route(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.post(f"{BASE}/transport/routes", json={"name": "Route 1"})
        assert r.status_code == 403

    async def test_any_role_can_book(self, client):
        _setup_auth(_make_user(role=UserRole.FACULTY))
        r = await client.post(f"{BASE}/transport/bookings", json={"booking_date": "2026-03-01"})
        assert r.status_code != 403


@pytest.mark.asyncio
class TestTransportValidation:
    async def test_create_vehicle_missing_number(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/transport/vehicles", json={})
        assert r.status_code == 422


# ===========================================================================
# 11. LIBRARY
# ===========================================================================

@pytest.mark.asyncio
class TestLibraryNoAuth:
    async def test_list_books_no_auth(self, client):
        r = await client.get(f"{BASE}/library/books")
        assert r.status_code == 403


@pytest.mark.asyncio
class TestLibraryRoleAccess:
    async def test_student_cannot_create_book(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.post(f"{BASE}/library/books", json={"title": "Gray's Anatomy", "total_copies": 5})
        assert r.status_code == 403

    async def test_admin_can_create_book(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/library/books", json={"title": "Gray's Anatomy", "total_copies": 5})
        assert r.status_code != 403

    async def test_faculty_can_issue_book(self, client):
        _setup_auth(_make_user(role=UserRole.FACULTY))
        r = await client.post(f"{BASE}/library/issue-book", json={
            "book_id": FAKE_UUID, "borrower_id": FAKE_UUID, "due_date": "2026-04-01"
        })
        assert r.status_code != 403

    async def test_student_cannot_issue_book(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.post(f"{BASE}/library/issue-book", json={
            "book_id": FAKE_UUID, "borrower_id": FAKE_UUID, "due_date": "2026-04-01"
        })
        assert r.status_code == 403

    async def test_overdue_any_role(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.get(f"{BASE}/library/overdue")
        assert r.status_code != 403


@pytest.mark.asyncio
class TestLibraryValidation:
    async def test_create_book_missing_title(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/library/books", json={"total_copies": 5})
        assert r.status_code == 422

    async def test_issue_book_missing_fields(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/library/issue-book", json={"book_id": FAKE_UUID})
        assert r.status_code == 422


# ===========================================================================
# 12. INFRASTRUCTURE
# ===========================================================================

@pytest.mark.asyncio
class TestInfrastructureNoAuth:
    async def test_list_no_auth(self, client):
        r = await client.get(f"{BASE}/infrastructure/")
        assert r.status_code == 403


@pytest.mark.asyncio
class TestInfrastructureRoleAccess:
    async def test_student_cannot_create(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.post(f"{BASE}/infrastructure/", json={"name": "Anatomy Hall"})
        assert r.status_code == 403

    async def test_admin_can_create(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/infrastructure/", json={"name": "Anatomy Hall"})
        assert r.status_code != 403

    async def test_student_cannot_create_equipment(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.post(f"{BASE}/infrastructure/equipment", json={
            "name": "Microscope", "department_id": FAKE_DEPT_ID
        })
        assert r.status_code == 403

    async def test_admin_can_create_equipment(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/infrastructure/equipment", json={
            "name": "Microscope", "department_id": FAKE_DEPT_ID
        })
        assert r.status_code != 403

    async def test_any_role_can_create_ticket(self, client):
        _setup_auth(_make_user(role=UserRole.FACULTY))
        r = await client.post(f"{BASE}/infrastructure/tickets", json={
            "entity_type": "equipment", "description": "Broken microscope"
        })
        assert r.status_code != 403


@pytest.mark.asyncio
class TestInfrastructureValidation:
    async def test_create_equipment_missing_dept(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/infrastructure/equipment", json={"name": "Microscope"})
        assert r.status_code == 422

    async def test_create_ticket_missing_desc(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/infrastructure/tickets", json={"entity_type": "room"})
        assert r.status_code == 422


# ===========================================================================
# 13. NOTICES
# ===========================================================================

@pytest.mark.asyncio
class TestNoticesNoAuth:
    async def test_list_no_auth(self, client):
        r = await client.get(f"{BASE}/notices/")
        assert r.status_code == 403


@pytest.mark.asyncio
class TestNoticesRoleAccess:
    async def test_student_cannot_create(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.post(f"{BASE}/notices/", json={"title": "Test", "content": "Test notice"})
        assert r.status_code == 403

    async def test_admin_can_create(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/notices/", json={"title": "Test", "content": "Test notice"})
        assert r.status_code != 403

    async def test_student_cannot_publish(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.post(f"{BASE}/notices/{FAKE_UUID}/publish")
        assert r.status_code == 403


@pytest.mark.asyncio
class TestNoticesValidation:
    async def test_create_missing_content(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/notices/", json={"title": "Test"})
        assert r.status_code == 422

    async def test_create_missing_title(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/notices/", json={"content": "Test"})
        assert r.status_code == 422


# ===========================================================================
# 14. GRIEVANCES
# ===========================================================================

@pytest.mark.asyncio
class TestGrievancesNoAuth:
    async def test_list_no_auth(self, client):
        r = await client.get(f"{BASE}/grievances/")
        assert r.status_code == 403


@pytest.mark.asyncio
class TestGrievancesRoleAccess:
    async def test_any_role_can_submit(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.post(f"{BASE}/grievances/", json={
            "category": "academic", "description": "Test grievance"
        })
        assert r.status_code != 403

    async def test_student_cannot_update_grievance(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.patch(f"{BASE}/grievances/{FAKE_UUID}", json={"status": "resolved"})
        assert r.status_code == 403

    async def test_admin_can_update_grievance(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.patch(f"{BASE}/grievances/{FAKE_UUID}", json={"status": "resolved"})
        assert r.status_code != 403

    async def test_student_cannot_create_committee(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.post(f"{BASE}/grievances/committees", json={"name": "Grievance Cell"})
        assert r.status_code == 403

    async def test_admin_can_create_committee(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/grievances/committees", json={"name": "Grievance Cell"})
        assert r.status_code != 403


@pytest.mark.asyncio
class TestGrievancesValidation:
    async def test_create_missing_category(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/grievances/", json={"description": "Missing cat"})
        assert r.status_code == 422

    async def test_create_missing_description(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/grievances/", json={"category": "academic"})
        assert r.status_code == 422


# ===========================================================================
# 15. WORKFLOWS
# ===========================================================================

@pytest.mark.asyncio
class TestWorkflowsNoAuth:
    async def test_list_definitions_no_auth(self, client):
        r = await client.get(f"{BASE}/workflows/definitions")
        assert r.status_code == 403


@pytest.mark.asyncio
class TestWorkflowsRoleAccess:
    async def test_student_cannot_create_definition(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.post(f"{BASE}/workflows/definitions", json={
            "name": "Leave Approval",
            "workflow_type": "leave_approval",
            "approval_chain": [{"role": "hod"}, {"role": "dean"}],
        })
        assert r.status_code == 403

    async def test_admin_can_create_definition(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/workflows/definitions", json={
            "name": "Leave Approval",
            "workflow_type": "leave_approval",
            "approval_chain": [{"role": "hod"}, {"role": "dean"}],
        })
        assert r.status_code != 403

    async def test_any_role_can_list_instances(self, client):
        _setup_auth(_make_user(role=UserRole.FACULTY))
        r = await client.get(f"{BASE}/workflows/")
        assert r.status_code != 403

    async def test_pending_any_role(self, client):
        _setup_auth(_make_user(role=UserRole.HOD))
        r = await client.get(f"{BASE}/workflows/pending")
        assert r.status_code != 403

    async def test_stats_any_role(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.get(f"{BASE}/workflows/stats")
        assert r.status_code != 403


@pytest.mark.asyncio
class TestWorkflowsValidation:
    async def test_create_definition_missing_chain(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/workflows/definitions", json={
            "name": "Test", "workflow_type": "test"
        })
        assert r.status_code == 422

    async def test_reject_missing_reason(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/workflows/{FAKE_UUID}/reject", json={})
        assert r.status_code == 422


# ===========================================================================
# 16. ALUMNI
# ===========================================================================

@pytest.mark.asyncio
class TestAlumniNoAuth:
    async def test_list_no_auth(self, client):
        r = await client.get(f"{BASE}/alumni/")
        assert r.status_code == 403


@pytest.mark.asyncio
class TestAlumniRoleAccess:
    async def test_student_cannot_create(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.post(f"{BASE}/alumni/", json={"name": "Dr. Alumni"})
        assert r.status_code == 403

    async def test_admin_can_create(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/alumni/", json={"name": "Dr. Alumni"})
        assert r.status_code != 403

    async def test_any_role_can_list(self, client):
        _setup_auth(_make_user(role=UserRole.FACULTY))
        r = await client.get(f"{BASE}/alumni/")
        assert r.status_code != 403


# ===========================================================================
# 17. RECRUITMENT
# ===========================================================================

@pytest.mark.asyncio
class TestRecruitmentNoAuth:
    async def test_list_positions_no_auth(self, client):
        r = await client.get(f"{BASE}/recruitment/positions")
        assert r.status_code == 403


@pytest.mark.asyncio
class TestRecruitmentRoleAccess:
    async def test_student_cannot_create_position(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.post(f"{BASE}/recruitment/positions", json={
            "department_id": FAKE_DEPT_ID, "designation": "Professor"
        })
        assert r.status_code == 403

    async def test_admin_can_create_position(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/recruitment/positions", json={
            "department_id": FAKE_DEPT_ID, "designation": "Professor"
        })
        assert r.status_code != 403

    async def test_student_cannot_create_candidate(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.post(f"{BASE}/recruitment/candidates", json={
            "position_id": FAKE_UUID, "name": "Dr. Candidate"
        })
        assert r.status_code == 403

    async def test_admin_can_create_candidate(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/recruitment/candidates", json={
            "position_id": FAKE_UUID, "name": "Dr. Candidate"
        })
        assert r.status_code != 403


@pytest.mark.asyncio
class TestRecruitmentValidation:
    async def test_create_position_missing_dept(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/recruitment/positions", json={"designation": "Professor"})
        assert r.status_code == 422

    async def test_create_candidate_missing_name(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/recruitment/candidates", json={"position_id": FAKE_UUID})
        assert r.status_code == 422


# ===========================================================================
# 18. DOCUMENTS
# ===========================================================================

@pytest.mark.asyncio
class TestDocumentsNoAuth:
    async def test_list_no_auth(self, client):
        r = await client.get(f"{BASE}/documents/")
        assert r.status_code == 403


@pytest.mark.asyncio
class TestDocumentsRoleAccess:
    async def test_student_cannot_create(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.post(f"{BASE}/documents/", json={
            "title": "Syllabus", "file_url": "https://r2.example.com/file.pdf"
        })
        assert r.status_code == 403

    async def test_admin_can_create(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/documents/", json={
            "title": "Syllabus", "file_url": "https://r2.example.com/file.pdf"
        })
        assert r.status_code != 403

    async def test_any_role_can_list(self, client):
        _setup_auth(_make_user(role=UserRole.FACULTY))
        r = await client.get(f"{BASE}/documents/")
        assert r.status_code != 403

    async def test_tags_any_role(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.get(f"{BASE}/documents/tags")
        assert r.status_code != 403


@pytest.mark.asyncio
class TestDocumentsValidation:
    async def test_create_missing_title(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/documents/", json={"file_url": "https://example.com/f.pdf"})
        assert r.status_code == 422

    async def test_create_missing_url(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/documents/", json={"title": "Test"})
        assert r.status_code == 422


# ===========================================================================
# 19. ADMISSIONS
# ===========================================================================

@pytest.mark.asyncio
class TestAdmissionsNoAuth:
    async def test_pipeline_no_auth(self, client):
        r = await client.get(f"{BASE}/admissions/pipeline")
        assert r.status_code == 403


@pytest.mark.asyncio
class TestAdmissionsRoleAccess:
    async def test_any_role_can_view_pipeline(self, client):
        _setup_auth(_make_user(role=UserRole.FACULTY))
        r = await client.get(f"{BASE}/admissions/pipeline")
        assert r.status_code != 403

    async def test_counseling_rounds(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.get(f"{BASE}/admissions/counseling-rounds")
        assert r.status_code != 403

    async def test_quota_analysis(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.get(f"{BASE}/admissions/quota-analysis")
        assert r.status_code != 403


# ===========================================================================
# 20. CALENDAR
# ===========================================================================

@pytest.mark.asyncio
class TestCalendarNoAuth:
    async def test_list_no_auth(self, client):
        r = await client.get(f"{BASE}/calendar/")
        assert r.status_code == 403


@pytest.mark.asyncio
class TestCalendarRoleAccess:
    async def test_student_cannot_create(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.post(f"{BASE}/calendar/", json={
            "title": "Exam Week", "start_date": "2026-04-01"
        })
        assert r.status_code == 403

    async def test_admin_can_create(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/calendar/", json={
            "title": "Exam Week", "start_date": "2026-04-01"
        })
        assert r.status_code != 403


@pytest.mark.asyncio
class TestCalendarValidation:
    async def test_create_missing_title(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/calendar/", json={"start_date": "2026-04-01"})
        assert r.status_code == 422

    async def test_create_missing_start_date(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/calendar/", json={"title": "Exam Week"})
        assert r.status_code == 422


# ===========================================================================
# 21. TIMETABLE
# ===========================================================================

@pytest.mark.asyncio
class TestTimetableNoAuth:
    async def test_list_no_auth(self, client):
        r = await client.get(f"{BASE}/timetable/")
        assert r.status_code == 403


@pytest.mark.asyncio
class TestTimetableRoleAccess:
    async def test_student_cannot_create(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.post(f"{BASE}/timetable/", json={
            "academic_year": "2025-26", "phase": "phase1",
            "day_of_week": 1, "start_time": "09:00", "end_time": "10:00"
        })
        assert r.status_code == 403

    async def test_admin_can_create(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/timetable/", json={
            "academic_year": "2025-26", "phase": "phase1",
            "day_of_week": 1, "start_time": "09:00", "end_time": "10:00"
        })
        assert r.status_code != 403


@pytest.mark.asyncio
class TestTimetableValidation:
    async def test_create_missing_required(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/timetable/", json={"academic_year": "2025-26"})
        assert r.status_code == 422

    async def test_create_invalid_day(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/timetable/", json={
            "academic_year": "2025-26", "phase": "phase1",
            "day_of_week": 8, "start_time": "09:00", "end_time": "10:00"
        })
        assert r.status_code == 422


# ===========================================================================
# 22. ROTATIONS
# ===========================================================================

@pytest.mark.asyncio
class TestRotationsNoAuth:
    async def test_list_no_auth(self, client):
        r = await client.get(f"{BASE}/rotations/")
        assert r.status_code == 403


@pytest.mark.asyncio
class TestRotationsRoleAccess:
    async def test_student_cannot_create(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.post(f"{BASE}/rotations/", json={
            "student_id": FAKE_STUDENT_ID, "department_id": FAKE_DEPT_ID,
            "start_date": "2026-03-01", "end_date": "2026-05-01"
        })
        assert r.status_code == 403

    async def test_admin_can_create(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.post(f"{BASE}/rotations/", json={
            "student_id": FAKE_STUDENT_ID, "department_id": FAKE_DEPT_ID,
            "start_date": "2026-03-01", "end_date": "2026-05-01"
        })
        assert r.status_code != 403

    async def test_matrix_any_role(self, client):
        _setup_auth(_make_user(role=UserRole.FACULTY))
        r = await client.get(f"{BASE}/rotations/matrix")
        assert r.status_code != 403


# ===========================================================================
# 23. SETTINGS
# ===========================================================================

@pytest.mark.asyncio
class TestSettingsNoAuth:
    async def test_college_profile_no_auth(self, client):
        r = await client.get(f"{BASE}/settings/college-profile")
        assert r.status_code == 403


@pytest.mark.asyncio
class TestSettingsRoleAccess:
    async def test_any_role_can_view_profile(self, client):
        _setup_auth(_make_user(role=UserRole.FACULTY))
        r = await client.get(f"{BASE}/settings/college-profile")
        assert r.status_code != 403

    async def test_student_cannot_update_profile(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.put(f"{BASE}/settings/college-profile", json={"name": "Updated"})
        assert r.status_code == 403

    async def test_admin_can_update_profile(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.put(f"{BASE}/settings/college-profile", json={"name": "Updated"})
        assert r.status_code != 403

    async def test_student_cannot_view_audit_log(self, client):
        _setup_auth(_make_user(role=UserRole.STUDENT))
        r = await client.get(f"{BASE}/settings/audit-log")
        assert r.status_code == 403

    async def test_admin_can_view_audit_log(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.get(f"{BASE}/settings/audit-log")
        assert r.status_code != 403


# ===========================================================================
# 24. EXECUTIVE
# ===========================================================================

@pytest.mark.asyncio
class TestExecutiveNoAuth:
    async def test_financial_no_auth(self, client):
        r = await client.get(f"{BASE}/executive/financial-overview")
        assert r.status_code == 403


@pytest.mark.asyncio
class TestExecutiveRoleAccess:
    async def test_any_role_financial(self, client):
        _setup_auth(_make_user(role=UserRole.DEAN))
        r = await client.get(f"{BASE}/executive/financial-overview")
        assert r.status_code != 403

    async def test_compliance_heatmap(self, client):
        _setup_auth(_make_user(role=UserRole.ADMIN))
        r = await client.get(f"{BASE}/executive/compliance-heatmap")
        assert r.status_code != 403

    async def test_action_items(self, client):
        _setup_auth(_make_user(role=UserRole.MANAGEMENT))
        r = await client.get(f"{BASE}/executive/action-items")
        assert r.status_code != 403


# ===========================================================================
# 25. CROSS-MODULE: Schema Serialization
# ===========================================================================

@pytest.mark.asyncio
class TestSchemaSerializations:
    async def test_student_create_schema(self):
        from app.engines.admin.schemas import StudentCreate
        data = StudentCreate(name="Test Student")
        assert data.name == "Test Student"
        assert data.email is None

    async def test_student_create_with_all_fields(self):
        from app.engines.admin.schemas import StudentCreate
        data = StudentCreate(
            name="Test Student",
            email="test@test.edu",
            phone="9876543210",
            gender="male",
            category="general",
        )
        assert data.email == "test@test.edu"
        assert data.gender == "male"

    async def test_faculty_create_schema(self):
        from app.engines.admin.schemas import FacultyCreate
        data = FacultyCreate(name="Dr. Test", department_id=uuid.uuid4())
        assert data.name == "Dr. Test"
        assert data.department_id is not None

    async def test_fee_structure_create_schema(self):
        from app.engines.admin.schemas import FeeStructureCreate
        data = FeeStructureCreate(
            academic_year="2025-26", quota="government", tuition_fee=50000000
        )
        assert data.tuition_fee == 50000000  # In paisa

    async def test_fee_structure_negative_fee_rejected(self):
        from pydantic import ValidationError as PydanticValidationError
        from app.engines.admin.schemas import FeeStructureCreate
        with pytest.raises(PydanticValidationError):
            FeeStructureCreate(
                academic_year="2025-26", quota="government", tuition_fee=-100
            )

    async def test_notice_create_schema(self):
        from app.engines.admin.schemas import NoticeCreate
        data = NoticeCreate(title="Test Notice", content="Important announcement")
        assert data.title == "Test Notice"
        assert data.priority == "normal"

    async def test_leave_request_create_schema(self):
        from app.engines.admin.schemas import LeaveRequestCreate
        data = LeaveRequestCreate(
            employee_id=uuid.uuid4(),
            leave_type="casual",
            from_date=date(2026, 3, 1),
            to_date=date(2026, 3, 2),
            days=2,
        )
        assert data.days == 2

    async def test_leave_request_zero_days_rejected(self):
        from pydantic import ValidationError as PydanticValidationError
        from app.engines.admin.schemas import LeaveRequestCreate
        with pytest.raises(PydanticValidationError):
            LeaveRequestCreate(
                employee_id=uuid.uuid4(),
                leave_type="casual",
                from_date=date(2026, 3, 1),
                to_date=date(2026, 3, 1),
                days=0,
            )

    async def test_hostel_block_create_schema(self):
        from app.engines.admin.schemas import HostelBlockCreate
        data = HostelBlockCreate(name="Block A")
        assert data.name == "Block A"

    async def test_certificate_create_schema(self):
        from app.engines.admin.schemas import CertificateCreate
        data = CertificateCreate(
            student_id=uuid.uuid4(), certificate_type="bonafide"
        )
        assert data.certificate_type == "bonafide"

    async def test_workflow_definition_create_schema(self):
        from app.engines.admin.schemas import WorkflowDefinitionCreate
        data = WorkflowDefinitionCreate(
            name="Test Workflow",
            workflow_type="leave_approval",
            approval_chain=[{"role": "hod"}, {"role": "dean"}],
        )
        assert len(data.approval_chain) == 2

    async def test_grievance_create_schema(self):
        from app.engines.admin.schemas import GrievanceCreate
        data = GrievanceCreate(category="academic", description="Test grievance")
        assert data.is_anonymous is False

    async def test_document_create_schema(self):
        from app.engines.admin.schemas import DocumentCreate
        data = DocumentCreate(
            title="Syllabus 2025-26",
            file_url="https://r2.example.com/syllabus.pdf",
        )
        assert data.title == "Syllabus 2025-26"

    async def test_timetable_slot_create_schema(self):
        from app.engines.admin.schemas import TimetableSlotCreate
        data = TimetableSlotCreate(
            academic_year="2025-26",
            phase="phase1",
            day_of_week=1,
            start_time="09:00",
            end_time="10:00",
        )
        assert data.day_of_week == 1

    async def test_timetable_slot_invalid_day_rejected(self):
        from pydantic import ValidationError as PydanticValidationError
        from app.engines.admin.schemas import TimetableSlotCreate
        with pytest.raises(PydanticValidationError):
            TimetableSlotCreate(
                academic_year="2025-26", phase="phase1",
                day_of_week=8, start_time="09:00", end_time="10:00",
            )

    async def test_update_schema_partial(self):
        from app.engines.admin.schemas import StudentUpdate
        data = StudentUpdate(name="Updated Name")
        dumped = data.model_dump(exclude_unset=True)
        assert dumped == {"name": "Updated Name"}
        assert "email" not in dumped

    async def test_update_schema_empty_noop(self):
        from app.engines.admin.schemas import StudentUpdate
        data = StudentUpdate()
        assert data.model_dump(exclude_unset=True) == {}


# ===========================================================================
# 26. CROSS-TENANT ISOLATION (Role + College separation)
# ===========================================================================

@pytest.mark.asyncio
class TestCrossTenantIsolation:
    """Verify that role checks work for both College A and College B users."""

    async def test_college_a_admin_passes_auth(self, client):
        _setup_auth(_make_user(college_id=COLLEGE_A_ID, role=UserRole.ADMIN))
        r = await client.get(f"{BASE}/students/")
        assert r.status_code != 403

    async def test_college_b_admin_passes_auth(self, client):
        _setup_auth(_make_user(college_id=COLLEGE_B_ID, role=UserRole.ADMIN))
        r = await client.get(f"{BASE}/students/")
        assert r.status_code != 403

    async def test_college_a_student_blocked_from_write(self, client):
        _setup_auth(_make_user(college_id=COLLEGE_A_ID, role=UserRole.STUDENT))
        r = await client.post(f"{BASE}/students/", json={"name": "Test"})
        assert r.status_code == 403

    async def test_college_b_student_blocked_from_write(self, client):
        _setup_auth(_make_user(college_id=COLLEGE_B_ID, role=UserRole.STUDENT))
        r = await client.post(f"{BASE}/students/", json={"name": "Test"})
        assert r.status_code == 403
