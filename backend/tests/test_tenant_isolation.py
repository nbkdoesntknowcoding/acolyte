"""CRITICAL: Cross-tenant data isolation tests.

These tests verify that RLS policies prevent data leaks between colleges.
This test suite runs on EVERY PR — NEVER SKIP.

Tests connect as the acolyte_app role (NOBYPASSRLS) to verify real RLS
enforcement, and use neondb_owner for setup/teardown only.
"""

import uuid

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import get_settings

COLLEGE_A_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
COLLEGE_B_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")


def _app_url() -> str:
    """Build the acolyte_app connection URL from the owner URL."""
    settings = get_settings()
    url = settings.DATABASE_URL
    # Replace neondb_owner credentials with acolyte_app
    url = url.replace("neondb_owner", "acolyte_app")
    url = url.replace("npg_m8PjQWhAkR6y", "acolyte_app_dev")
    # For local Docker: replace postgres:postgres with acolyte_app:acolyte_app_dev
    url = url.replace("postgres:postgres", "acolyte_app:acolyte_app_dev")
    return url


@pytest_asyncio.fixture(scope="module")
async def owner_engine():
    """Engine connected as DB owner (BYPASSRLS) -- for setup/teardown only."""
    settings = get_settings()
    engine = create_async_engine(
        settings.DATABASE_URL,
        poolclass=NullPool,
        connect_args={"statement_cache_size": 0},
    )
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(scope="module")
async def app_engine():
    """Engine connected as acolyte_app (NOBYPASSRLS) -- for actual tests."""
    engine = create_async_engine(
        _app_url(),
        poolclass=NullPool,
        connect_args={"statement_cache_size": 0},
    )
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(scope="module")
async def owner_session(owner_engine):
    return async_sessionmaker(owner_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture(scope="module")
async def app_session(app_engine):
    return async_sessionmaker(app_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture(autouse=True, scope="module")
async def setup_test_colleges(owner_engine):
    """Create two test colleges and departments for FK dependencies."""
    dept_a_id = uuid.uuid4()
    dept_b_id = uuid.uuid4()

    async with owner_engine.begin() as conn:
        # Owner bypasses RLS automatically
        await conn.execute(text("""
            INSERT INTO colleges (id, name, code, state, total_intake)
            VALUES (:id, :name, :code, :state, :intake)
            ON CONFLICT (id) DO NOTHING
        """), [
            {"id": str(COLLEGE_A_ID), "name": "Test College A", "code": "TCA", "state": "Karnataka", "intake": 150},
            {"id": str(COLLEGE_B_ID), "name": "Test College B", "code": "TCB", "state": "Maharashtra", "intake": 100},
        ])

        await conn.execute(text("""
            INSERT INTO departments (id, college_id, name, code)
            VALUES (:id, :cid, :name, :code)
            ON CONFLICT (id) DO NOTHING
        """), [
            {"id": str(dept_a_id), "cid": str(COLLEGE_A_ID), "name": "Anatomy A", "code": "ANAT-A"},
            {"id": str(dept_b_id), "cid": str(COLLEGE_B_ID), "name": "Anatomy B", "code": "ANAT-B"},
        ])

    yield {"dept_a_id": dept_a_id, "dept_b_id": dept_b_id}

    # Cleanup
    async with owner_engine.begin() as conn:
        for table in [
            "test_attempts", "flashcard_reviews", "study_sessions", "practice_tests",
            "chat_sessions", "pdf_annotations", "flashcards",
            "fee_payments", "clinical_rotations", "logbook_entries",
            "lesson_plans", "assessments", "question_bank_items",
            "attendance_records", "compliance_snapshots", "msr_alerts",
            "saf_submissions", "hmis_data_points", "payment_transactions",
            "audit_log", "students", "faculty", "fee_structures", "batches",
            "departments",
        ]:
            await conn.execute(text(
                f"DELETE FROM {table} WHERE college_id IN (:a, :b)"
            ), {"a": str(COLLEGE_A_ID), "b": str(COLLEGE_B_ID)})
        await conn.execute(text(
            "DELETE FROM colleges WHERE id IN (:a, :b)"
        ), {"a": str(COLLEGE_A_ID), "b": str(COLLEGE_B_ID)})


@pytest.mark.asyncio
class TestTenantIsolation:
    """Verify that tenant A cannot see tenant B's data and vice versa."""

    async def test_student_data_isolation(self, owner_session, app_session, setup_test_colleges):
        """Students from college A should not be visible to college B queries."""
        student_a_id = uuid.uuid4()
        student_b_id = uuid.uuid4()

        # Insert as owner (bypasses RLS)
        async with owner_session() as session:
            await session.execute(text("""
                INSERT INTO students (id, college_id, name, status)
                VALUES (:id, :cid, :name, 'active')
            """), {"id": str(student_a_id), "cid": str(COLLEGE_A_ID), "name": "Student A"})
            await session.execute(text("""
                INSERT INTO students (id, college_id, name, status)
                VALUES (:id, :cid, :name, 'active')
            """), {"id": str(student_b_id), "cid": str(COLLEGE_B_ID), "name": "Student B"})
            await session.commit()

        # Query as College A via app role (RLS enforced)
        async with app_session() as session:
            await session.execute(text(f"SET app.current_college_id = '{COLLEGE_A_ID}'"))
            result = await session.execute(text("SELECT id, name FROM students"))
            rows = result.fetchall()
            ids = [r[0] for r in rows]
            assert student_a_id in ids, "College A should see its own student"
            assert student_b_id not in ids, "College A must NOT see College B's student"

        # Query as College B via app role
        async with app_session() as session:
            await session.execute(text(f"SET app.current_college_id = '{COLLEGE_B_ID}'"))
            result = await session.execute(text("SELECT id, name FROM students"))
            rows = result.fetchall()
            ids = [r[0] for r in rows]
            assert student_b_id in ids, "College B should see its own student"
            assert student_a_id not in ids, "College B must NOT see College A's student"

        # Cleanup
        async with owner_session() as session:
            await session.execute(text("DELETE FROM students WHERE id IN (:a, :b)"),
                                  {"a": str(student_a_id), "b": str(student_b_id)})
            await session.commit()

    async def test_faculty_data_isolation(self, owner_session, app_session, setup_test_colleges):
        """Faculty from college A should not be visible to college B."""
        faculty_a_id = uuid.uuid4()
        faculty_b_id = uuid.uuid4()
        dept_a_id = setup_test_colleges["dept_a_id"]
        dept_b_id = setup_test_colleges["dept_b_id"]

        async with owner_session() as session:
            await session.execute(text("""
                INSERT INTO faculty (id, college_id, name, department_id)
                VALUES (:id, :cid, :name, :did)
            """), {"id": str(faculty_a_id), "cid": str(COLLEGE_A_ID), "name": "Dr. A", "did": str(dept_a_id)})
            await session.execute(text("""
                INSERT INTO faculty (id, college_id, name, department_id)
                VALUES (:id, :cid, :name, :did)
            """), {"id": str(faculty_b_id), "cid": str(COLLEGE_B_ID), "name": "Dr. B", "did": str(dept_b_id)})
            await session.commit()

        # College A context
        async with app_session() as session:
            await session.execute(text(f"SET app.current_college_id = '{COLLEGE_A_ID}'"))
            result = await session.execute(text("SELECT id FROM faculty"))
            ids = [r[0] for r in result.fetchall()]
            assert faculty_a_id in ids
            assert faculty_b_id not in ids, "CRITICAL: Cross-tenant faculty leak!"

        # College B context
        async with app_session() as session:
            await session.execute(text(f"SET app.current_college_id = '{COLLEGE_B_ID}'"))
            result = await session.execute(text("SELECT id FROM faculty"))
            ids = [r[0] for r in result.fetchall()]
            assert faculty_b_id in ids
            assert faculty_a_id not in ids, "CRITICAL: Cross-tenant faculty leak!"

        # Cleanup
        async with owner_session() as session:
            await session.execute(text("DELETE FROM faculty WHERE id IN (:a, :b)"),
                                  {"a": str(faculty_a_id), "b": str(faculty_b_id)})
            await session.commit()

    async def test_compliance_data_isolation(self, owner_session, app_session, setup_test_colleges):
        """Compliance snapshots should be isolated per college."""
        snap_a_id = uuid.uuid4()
        snap_b_id = uuid.uuid4()

        async with owner_session() as session:
            await session.execute(text("""
                INSERT INTO compliance_snapshots (id, college_id, snapshot_date, compliance_score)
                VALUES (:id, :cid, '2026-01-01', 85.5)
            """), {"id": str(snap_a_id), "cid": str(COLLEGE_A_ID)})
            await session.execute(text("""
                INSERT INTO compliance_snapshots (id, college_id, snapshot_date, compliance_score)
                VALUES (:id, :cid, '2026-01-02', 72.0)
            """), {"id": str(snap_b_id), "cid": str(COLLEGE_B_ID)})
            await session.commit()

        async with app_session() as session:
            await session.execute(text(f"SET app.current_college_id = '{COLLEGE_A_ID}'"))
            result = await session.execute(text("SELECT id, compliance_score FROM compliance_snapshots"))
            rows = result.fetchall()
            ids = [r[0] for r in rows]
            assert snap_a_id in ids
            assert snap_b_id not in ids, "CRITICAL: Cross-tenant compliance data leak!"

        # Cleanup
        async with owner_session() as session:
            await session.execute(text("DELETE FROM compliance_snapshots WHERE id IN (:a, :b)"),
                                  {"a": str(snap_a_id), "b": str(snap_b_id)})
            await session.commit()

    async def test_fee_data_isolation(self, owner_session, app_session, setup_test_colleges):
        """Fee structures should be isolated."""
        fee_a_id = uuid.uuid4()
        fee_b_id = uuid.uuid4()

        async with owner_session() as session:
            await session.execute(text("""
                INSERT INTO fee_structures (id, college_id, academic_year, quota, tuition_fee)
                VALUES (:id, :cid, '2025-26', 'government', 50000)
            """), {"id": str(fee_a_id), "cid": str(COLLEGE_A_ID)})
            await session.execute(text("""
                INSERT INTO fee_structures (id, college_id, academic_year, quota, tuition_fee)
                VALUES (:id, :cid, '2025-26', 'management', 500000)
            """), {"id": str(fee_b_id), "cid": str(COLLEGE_B_ID)})
            await session.commit()

        async with app_session() as session:
            await session.execute(text(f"SET app.current_college_id = '{COLLEGE_B_ID}'"))
            result = await session.execute(text("SELECT id, tuition_fee FROM fee_structures"))
            rows = result.fetchall()
            ids = [r[0] for r in rows]
            assert fee_b_id in ids
            assert fee_a_id not in ids, "CRITICAL: Cross-tenant fee data leak!"

        # Cleanup
        async with owner_session() as session:
            await session.execute(text("DELETE FROM fee_structures WHERE id IN (:a, :b)"),
                                  {"a": str(fee_a_id), "b": str(fee_b_id)})
            await session.commit()

    async def test_attendance_data_isolation(self, owner_session, app_session, setup_test_colleges):
        """Attendance records should be isolated."""
        att_a_id = uuid.uuid4()
        att_b_id = uuid.uuid4()

        async with owner_session() as session:
            await session.execute(text("""
                INSERT INTO attendance_records (id, college_id, person_id, person_type, date)
                VALUES (:id, :cid, :pid, 'faculty', '2026-01-15')
            """), {"id": str(att_a_id), "cid": str(COLLEGE_A_ID), "pid": str(uuid.uuid4())})
            await session.execute(text("""
                INSERT INTO attendance_records (id, college_id, person_id, person_type, date)
                VALUES (:id, :cid, :pid, 'faculty', '2026-01-15')
            """), {"id": str(att_b_id), "cid": str(COLLEGE_B_ID), "pid": str(uuid.uuid4())})
            await session.commit()

        async with app_session() as session:
            await session.execute(text(f"SET app.current_college_id = '{COLLEGE_A_ID}'"))
            result = await session.execute(text("SELECT id FROM attendance_records"))
            ids = [r[0] for r in result.fetchall()]
            assert att_a_id in ids
            assert att_b_id not in ids, "CRITICAL: Cross-tenant attendance data leak!"

        # Cleanup
        async with owner_session() as session:
            await session.execute(text("DELETE FROM attendance_records WHERE id IN (:a, :b)"),
                                  {"a": str(att_a_id), "b": str(att_b_id)})
            await session.commit()

    async def test_superadmin_sees_all_tenants(self, owner_session, app_session, setup_test_colleges):
        """Superadmin bypass via app role should see data from ALL colleges."""
        student_a_id = uuid.uuid4()
        student_b_id = uuid.uuid4()

        async with owner_session() as session:
            await session.execute(text("""
                INSERT INTO students (id, college_id, name, status)
                VALUES (:id, :cid, :name, 'active')
            """), {"id": str(student_a_id), "cid": str(COLLEGE_A_ID), "name": "Super Student A"})
            await session.execute(text("""
                INSERT INTO students (id, college_id, name, status)
                VALUES (:id, :cid, :name, 'active')
            """), {"id": str(student_b_id), "cid": str(COLLEGE_B_ID), "name": "Super Student B"})
            await session.commit()

        # Superadmin bypass via app role
        async with app_session() as session:
            await session.execute(text("SET app.is_superadmin = 'true'"))
            result = await session.execute(text("SELECT id FROM students"))
            ids = [r[0] for r in result.fetchall()]
            assert student_a_id in ids, "Superadmin should see College A students"
            assert student_b_id in ids, "Superadmin should see College B students"

        # Cleanup
        async with owner_session() as session:
            await session.execute(text("DELETE FROM students WHERE id IN (:a, :b)"),
                                  {"a": str(student_a_id), "b": str(student_b_id)})
            await session.commit()

    async def test_no_context_blocks_access(self, owner_session, app_session, setup_test_colleges):
        """Without setting any tenant context, queries should return no rows."""
        student_id = uuid.uuid4()

        async with owner_session() as session:
            await session.execute(text("""
                INSERT INTO students (id, college_id, name, status)
                VALUES (:id, :cid, :name, 'active')
            """), {"id": str(student_id), "cid": str(COLLEGE_A_ID), "name": "Orphan Student"})
            await session.commit()

        # Query without any context set -- should return 0 rows
        async with app_session() as session:
            await session.execute(text("RESET app.current_college_id"))
            await session.execute(text("RESET app.is_superadmin"))
            result = await session.execute(text("SELECT id FROM students"))
            rows = result.fetchall()
            assert len(rows) == 0, f"Without tenant context, no rows should be visible (got {len(rows)})"

        # Cleanup
        async with owner_session() as session:
            await session.execute(text("DELETE FROM students WHERE id = :id"), {"id": str(student_id)})
            await session.commit()
