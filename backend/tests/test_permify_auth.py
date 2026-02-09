"""Tests for Permify authorization against the Fly.io instance.

Tests the full authorization schema: hierarchy traversal, permission checks,
cross-tenant isolation, competency logbook signing, and compliance access.

Requires Permify to be reachable:
- Fly.io: automatic (PERMIFY_ENDPOINT in env)
- Local: run `flyctl proxy 3476:3476 -a acolyte-permify` first

All tests are marked with @pytest.mark.permify and skipped if Permify
is unreachable.

Usage:
    cd backend
    pytest tests/test_permify_auth.py -v
    pytest tests/test_permify_auth.py -v -m permify  # explicit marker
"""

from __future__ import annotations

import asyncio
import logging
import uuid

import pytest
import pytest_asyncio

from app.config import get_settings
from app.core.permify.client import PermifyClient

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Reachability check — skip entire module if Permify is down
# ---------------------------------------------------------------------------

def permify_reachable() -> bool:
    """Synchronous check if Permify is reachable (called at import time)."""
    loop = asyncio.new_event_loop()
    try:
        settings = get_settings()
        client = PermifyClient(settings)
        result = loop.run_until_complete(client.health_check())
        loop.run_until_complete(client.close())
        return result
    except Exception:
        return False
    finally:
        loop.close()


pytestmark = [
    pytest.mark.permify,
    pytest.mark.skipif(
        not permify_reachable(),
        reason="Permify on Fly.io not reachable — run `flyctl proxy 3476:3476 -a acolyte-permify` for local dev",
    ),
]

# ---------------------------------------------------------------------------
# Test IDs — unique per test run to avoid collisions
# ---------------------------------------------------------------------------

_RUN_ID = uuid.uuid4().hex[:8]
TENANT_ID = f"test-{_RUN_ID}"

# Hierarchy
TRUST_ID = f"trust-{_RUN_ID}"
COLLEGE1_ID = f"college1-{_RUN_ID}"
COLLEGE2_ID = f"college2-{_RUN_ID}"  # for cross-tenant isolation
DEPT1_ID = f"dept1-{_RUN_ID}"
DEPT2_ID = f"dept2-{_RUN_ID}"  # in college2

COURSE1_ID = f"course1-{_RUN_ID}"

# Users
DEAN_ID = f"dean-{_RUN_ID}"
ADMIN_ID = f"admin-{_RUN_ID}"
COMPLIANCE_ID = f"compliance-{_RUN_ID}"
HOD_ID = f"hod-{_RUN_ID}"
FACULTY1_ID = f"faculty1-{_RUN_ID}"  # instructor for course1
FACULTY2_ID = f"faculty2-{_RUN_ID}"  # faculty in college2's dept
STUDENT1_ID = f"student1-{_RUN_ID}"
STUDENT2_ID = f"student2-{_RUN_ID}"  # student in college2

# Logbook and compliance
LOGBOOK1_ID = f"logbook1-{_RUN_ID}"  # owned by student1, under course1
REPORT1_ID = f"report1-{_RUN_ID}"  # compliance report under college1


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture(scope="module")
async def client():
    """Create a PermifyClient for the test module."""
    settings = get_settings()
    c = PermifyClient(settings)
    yield c
    await c.close()


@pytest_asyncio.fixture(scope="module", autouse=True)
async def seed_and_cleanup(client: PermifyClient):
    """Seed all test relationships before tests, clean up after."""
    # Push schema first (ensures entity types are registered)
    version = await client.push_schema(tenant_id=TENANT_ID)
    assert version is not None, "Failed to push schema to Permify"

    tuples = _build_test_tuples()
    success = await client.batch_write_relationships(tuples, tenant_id=TENANT_ID)
    assert success, f"Failed to seed {len(tuples)} test relationships"

    logger.info("Seeded %d test relationships (tenant=%s, run=%s)", len(tuples), TENANT_ID, _RUN_ID)

    yield

    # Cleanup — delete all test relationships
    for t in tuples:
        await client.delete_relationship(
            entity_type=t["entity_type"],
            entity_id=t["entity_id"],
            relation=t["relation"],
            subject_id=t["subject_id"],
            subject_type=t.get("subject_type", "user"),
            tenant_id=TENANT_ID,
        )
    logger.info("Cleaned up %d test relationships", len(tuples))


def _build_test_tuples() -> list[dict]:
    """Build all relationship tuples needed for the test suite."""
    return [
        # === Structural hierarchy ===
        # College 1 under trust
        {"entity_type": "college", "entity_id": COLLEGE1_ID, "relation": "parent", "subject_type": "trust", "subject_id": TRUST_ID},
        # College 2 under same trust (for cross-tenant tests)
        {"entity_type": "college", "entity_id": COLLEGE2_ID, "relation": "parent", "subject_type": "trust", "subject_id": TRUST_ID},
        # Dept 1 under college 1
        {"entity_type": "department", "entity_id": DEPT1_ID, "relation": "parent", "subject_type": "college", "subject_id": COLLEGE1_ID},
        # Dept 2 under college 2
        {"entity_type": "department", "entity_id": DEPT2_ID, "relation": "parent", "subject_type": "college", "subject_id": COLLEGE2_ID},
        # Course 1 under dept 1
        {"entity_type": "course", "entity_id": COURSE1_ID, "relation": "parent", "subject_type": "department", "subject_id": DEPT1_ID},

        # === College 1 roles ===
        {"entity_type": "college", "entity_id": COLLEGE1_ID, "relation": "dean", "subject_type": "user", "subject_id": DEAN_ID},
        {"entity_type": "college", "entity_id": COLLEGE1_ID, "relation": "admin", "subject_type": "user", "subject_id": ADMIN_ID},
        {"entity_type": "college", "entity_id": COLLEGE1_ID, "relation": "compliance_officer", "subject_type": "user", "subject_id": COMPLIANCE_ID},
        {"entity_type": "college", "entity_id": COLLEGE1_ID, "relation": "student", "subject_type": "user", "subject_id": STUDENT1_ID},

        # === College 2 roles (for cross-tenant isolation) ===
        {"entity_type": "college", "entity_id": COLLEGE2_ID, "relation": "student", "subject_type": "user", "subject_id": STUDENT2_ID},

        # === Department 1 roles ===
        {"entity_type": "department", "entity_id": DEPT1_ID, "relation": "hod", "subject_type": "user", "subject_id": HOD_ID},
        {"entity_type": "department", "entity_id": DEPT1_ID, "relation": "faculty", "subject_type": "user", "subject_id": FACULTY1_ID},

        # === Department 2 roles (college 2) ===
        {"entity_type": "department", "entity_id": DEPT2_ID, "relation": "faculty", "subject_type": "user", "subject_id": FACULTY2_ID},

        # === Course 1 assignments ===
        {"entity_type": "course", "entity_id": COURSE1_ID, "relation": "instructor", "subject_type": "user", "subject_id": FACULTY1_ID},
        {"entity_type": "course", "entity_id": COURSE1_ID, "relation": "student", "subject_type": "user", "subject_id": STUDENT1_ID},

        # === Competency logbook (owned by student1, under course1) ===
        {"entity_type": "competency_logbook", "entity_id": LOGBOOK1_ID, "relation": "owner", "subject_type": "user", "subject_id": STUDENT1_ID},
        {"entity_type": "competency_logbook", "entity_id": LOGBOOK1_ID, "relation": "parent_course", "subject_type": "course", "subject_id": COURSE1_ID},

        # === Compliance report (under college1) ===
        {"entity_type": "compliance_report", "entity_id": REPORT1_ID, "relation": "parent", "subject_type": "college", "subject_id": COLLEGE1_ID},
        {"entity_type": "compliance_report", "entity_id": REPORT1_ID, "relation": "created_by", "subject_type": "user", "subject_id": COMPLIANCE_ID},
    ]


# ===========================================================================
# Test 1: Schema is loaded
# ===========================================================================

class TestSchemaLoaded:
    """Verify schema push works and entity types are registered."""

    @pytest.mark.asyncio
    async def test_push_schema_succeeds(self, client: PermifyClient):
        version = await client.push_schema(tenant_id=TENANT_ID)
        assert version is not None
        assert version != ""

    @pytest.mark.asyncio
    @pytest.mark.parametrize("entity_type", [
        "trust",
        "college",
        "department",
        "course",
        "student_record",
        "competency_logbook",
        "compliance_report",
        "assessment",
    ])
    async def test_entity_types_exist(self, client: PermifyClient, entity_type: str):
        """Verify each entity type exists by writing and deleting a dummy tuple.

        If the entity type doesn't exist, the write will fail.
        """
        dummy_id = f"dummy-{_RUN_ID}"
        # Use a relation that exists on all entity types (via hierarchy or owner)
        relation_map = {
            "trust": "admin",
            "college": "admin",
            "department": "faculty",
            "course": "student",
            "student_record": "owner",
            "competency_logbook": "owner",
            "compliance_report": "created_by",
            "assessment": "created_by",
        }
        relation = relation_map[entity_type]

        success = await client.write_relationship(
            entity_type=entity_type,
            entity_id=dummy_id,
            relation=relation,
            subject_id=f"dummy-user-{_RUN_ID}",
            tenant_id=TENANT_ID,
        )
        assert success, f"Entity type '{entity_type}' not found in schema"

        # Clean up
        await client.delete_relationship(
            entity_type=entity_type,
            entity_id=dummy_id,
            relation=relation,
            subject_id=f"dummy-user-{_RUN_ID}",
            tenant_id=TENANT_ID,
        )


# ===========================================================================
# Test 2: Relationship writes and permission checks
# ===========================================================================

class TestPermissionChecks:
    """Test core permission checks across the hierarchy."""

    @pytest.mark.asyncio
    async def test_dean_can_manage_college(self, client: PermifyClient):
        result = await client.check(
            entity_type="college", entity_id=COLLEGE1_ID,
            permission="can_manage", subject_id=DEAN_ID,
            tenant_id=TENANT_ID,
        )
        assert result is True

    @pytest.mark.asyncio
    async def test_admin_can_manage_college(self, client: PermifyClient):
        result = await client.check(
            entity_type="college", entity_id=COLLEGE1_ID,
            permission="can_manage", subject_id=ADMIN_ID,
            tenant_id=TENANT_ID,
        )
        assert result is True

    @pytest.mark.asyncio
    async def test_faculty_can_teach_course_as_instructor(self, client: PermifyClient):
        result = await client.check(
            entity_type="course", entity_id=COURSE1_ID,
            permission="can_teach", subject_id=FACULTY1_ID,
            tenant_id=TENANT_ID,
        )
        assert result is True

    @pytest.mark.asyncio
    async def test_dean_can_teach_course_via_hierarchy(self, client: PermifyClient):
        """Dean → college.can_manage → department.can_manage → course.can_teach."""
        result = await client.check(
            entity_type="course", entity_id=COURSE1_ID,
            permission="can_teach", subject_id=DEAN_ID,
            tenant_id=TENANT_ID,
        )
        assert result is True

    @pytest.mark.asyncio
    async def test_hod_can_teach_course_via_department(self, client: PermifyClient):
        """HOD → department.can_manage → course.can_teach."""
        result = await client.check(
            entity_type="course", entity_id=COURSE1_ID,
            permission="can_teach", subject_id=HOD_ID,
            tenant_id=TENANT_ID,
        )
        assert result is True

    @pytest.mark.asyncio
    async def test_student_can_view_course(self, client: PermifyClient):
        result = await client.check(
            entity_type="course", entity_id=COURSE1_ID,
            permission="can_view", subject_id=STUDENT1_ID,
            tenant_id=TENANT_ID,
        )
        assert result is True

    @pytest.mark.asyncio
    async def test_student_cannot_grade_course(self, client: PermifyClient):
        result = await client.check(
            entity_type="course", entity_id=COURSE1_ID,
            permission="can_grade", subject_id=STUDENT1_ID,
            tenant_id=TENANT_ID,
        )
        assert result is False

    @pytest.mark.asyncio
    async def test_student_cannot_teach_course(self, client: PermifyClient):
        result = await client.check(
            entity_type="course", entity_id=COURSE1_ID,
            permission="can_teach", subject_id=STUDENT1_ID,
            tenant_id=TENANT_ID,
        )
        assert result is False

    @pytest.mark.asyncio
    async def test_cross_tenant_faculty_cannot_view_course(self, client: PermifyClient):
        """Faculty in college2's department cannot access college1's course."""
        result = await client.check(
            entity_type="course", entity_id=COURSE1_ID,
            permission="can_view", subject_id=FACULTY2_ID,
            tenant_id=TENANT_ID,
        )
        assert result is False

    @pytest.mark.asyncio
    async def test_cross_tenant_student_cannot_view_course(self, client: PermifyClient):
        """Student enrolled in college2 cannot view college1's course."""
        result = await client.check(
            entity_type="course", entity_id=COURSE1_ID,
            permission="can_view", subject_id=STUDENT2_ID,
            tenant_id=TENANT_ID,
        )
        assert result is False

    @pytest.mark.asyncio
    async def test_instructor_can_grade_course(self, client: PermifyClient):
        result = await client.check(
            entity_type="course", entity_id=COURSE1_ID,
            permission="can_grade", subject_id=FACULTY1_ID,
            tenant_id=TENANT_ID,
        )
        assert result is True

    @pytest.mark.asyncio
    async def test_hod_can_grade_course(self, client: PermifyClient):
        """HOD → course.parent.hod → can_grade."""
        result = await client.check(
            entity_type="course", entity_id=COURSE1_ID,
            permission="can_grade", subject_id=HOD_ID,
            tenant_id=TENANT_ID,
        )
        assert result is True


# ===========================================================================
# Test 3: Competency logbook permissions
# ===========================================================================

class TestCompetencyLogbook:
    """Test CBME competency logbook signing hierarchy."""

    @pytest.mark.asyncio
    async def test_student_can_submit_own_logbook(self, client: PermifyClient):
        result = await client.check(
            entity_type="competency_logbook", entity_id=LOGBOOK1_ID,
            permission="can_submit", subject_id=STUDENT1_ID,
            tenant_id=TENANT_ID,
        )
        assert result is True

    @pytest.mark.asyncio
    async def test_student_can_view_own_logbook(self, client: PermifyClient):
        result = await client.check(
            entity_type="competency_logbook", entity_id=LOGBOOK1_ID,
            permission="can_view", subject_id=STUDENT1_ID,
            tenant_id=TENANT_ID,
        )
        assert result is True

    @pytest.mark.asyncio
    async def test_instructor_can_sign_logbook(self, client: PermifyClient):
        """Course instructor can sign competency logbook entries."""
        result = await client.check(
            entity_type="competency_logbook", entity_id=LOGBOOK1_ID,
            permission="can_sign", subject_id=FACULTY1_ID,
            tenant_id=TENANT_ID,
        )
        assert result is True

    @pytest.mark.asyncio
    async def test_hod_can_sign_logbook(self, client: PermifyClient):
        """HOD can sign logbook via department hierarchy."""
        result = await client.check(
            entity_type="competency_logbook", entity_id=LOGBOOK1_ID,
            permission="can_sign", subject_id=HOD_ID,
            tenant_id=TENANT_ID,
        )
        assert result is True

    @pytest.mark.asyncio
    async def test_random_faculty_cannot_sign_logbook(self, client: PermifyClient):
        """Faculty from college2 cannot sign college1 student's logbook."""
        result = await client.check(
            entity_type="competency_logbook", entity_id=LOGBOOK1_ID,
            permission="can_sign", subject_id=FACULTY2_ID,
            tenant_id=TENANT_ID,
        )
        assert result is False

    @pytest.mark.asyncio
    async def test_other_student_cannot_submit_logbook(self, client: PermifyClient):
        """Student from college2 cannot submit another student's logbook."""
        result = await client.check(
            entity_type="competency_logbook", entity_id=LOGBOOK1_ID,
            permission="can_submit", subject_id=STUDENT2_ID,
            tenant_id=TENANT_ID,
        )
        assert result is False

    @pytest.mark.asyncio
    async def test_instructor_can_view_logbook(self, client: PermifyClient):
        """Course instructor can view student logbooks."""
        result = await client.check(
            entity_type="competency_logbook", entity_id=LOGBOOK1_ID,
            permission="can_view", subject_id=FACULTY1_ID,
            tenant_id=TENANT_ID,
        )
        assert result is True


# ===========================================================================
# Test 4: Compliance report permissions
# ===========================================================================

class TestComplianceReport:
    """Test NMC/NAAC compliance report access controls."""

    @pytest.mark.asyncio
    async def test_compliance_officer_can_view(self, client: PermifyClient):
        result = await client.check(
            entity_type="compliance_report", entity_id=REPORT1_ID,
            permission="can_view", subject_id=COMPLIANCE_ID,
            tenant_id=TENANT_ID,
        )
        assert result is True

    @pytest.mark.asyncio
    async def test_compliance_officer_can_edit(self, client: PermifyClient):
        result = await client.check(
            entity_type="compliance_report", entity_id=REPORT1_ID,
            permission="can_edit", subject_id=COMPLIANCE_ID,
            tenant_id=TENANT_ID,
        )
        assert result is True

    @pytest.mark.asyncio
    async def test_dean_can_view_compliance(self, client: PermifyClient):
        """Dean → college.can_manage → can_view_compliance → report.can_view."""
        result = await client.check(
            entity_type="compliance_report", entity_id=REPORT1_ID,
            permission="can_view", subject_id=DEAN_ID,
            tenant_id=TENANT_ID,
        )
        assert result is True

    @pytest.mark.asyncio
    async def test_dean_can_submit_compliance(self, client: PermifyClient):
        result = await client.check(
            entity_type="compliance_report", entity_id=REPORT1_ID,
            permission="can_submit", subject_id=DEAN_ID,
            tenant_id=TENANT_ID,
        )
        assert result is True

    @pytest.mark.asyncio
    async def test_admin_can_view_compliance(self, client: PermifyClient):
        """Admin → college.can_manage → can_view_compliance."""
        result = await client.check(
            entity_type="compliance_report", entity_id=REPORT1_ID,
            permission="can_view", subject_id=ADMIN_ID,
            tenant_id=TENANT_ID,
        )
        assert result is True

    @pytest.mark.asyncio
    async def test_faculty_cannot_view_compliance(self, client: PermifyClient):
        """Regular faculty should NOT see compliance reports."""
        result = await client.check(
            entity_type="compliance_report", entity_id=REPORT1_ID,
            permission="can_view", subject_id=FACULTY1_ID,
            tenant_id=TENANT_ID,
        )
        assert result is False

    @pytest.mark.asyncio
    async def test_student_cannot_view_compliance(self, client: PermifyClient):
        """Students should NEVER see compliance reports."""
        result = await client.check(
            entity_type="compliance_report", entity_id=REPORT1_ID,
            permission="can_view", subject_id=STUDENT1_ID,
            tenant_id=TENANT_ID,
        )
        assert result is False

    @pytest.mark.asyncio
    async def test_student_cannot_edit_compliance(self, client: PermifyClient):
        result = await client.check(
            entity_type="compliance_report", entity_id=REPORT1_ID,
            permission="can_edit", subject_id=STUDENT1_ID,
            tenant_id=TENANT_ID,
        )
        assert result is False

    @pytest.mark.asyncio
    async def test_cross_college_compliance_isolation(self, client: PermifyClient):
        """Faculty from college2 cannot view college1's compliance report."""
        result = await client.check(
            entity_type="compliance_report", entity_id=REPORT1_ID,
            permission="can_view", subject_id=FACULTY2_ID,
            tenant_id=TENANT_ID,
        )
        assert result is False
