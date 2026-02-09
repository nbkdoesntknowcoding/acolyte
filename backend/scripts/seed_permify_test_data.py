"""Seed Permify with test data for development.

Creates a realistic college hierarchy:
- 1 trust
- 1 college (under the trust)
- 3 departments: Anatomy, Physiology, Biochemistry
- 1 dean, 1 admin, 1 compliance_officer (college-level)
- 3 HODs (one per department)
- 6 faculty (2 per department)
- 10 students (college-level)
- 3 courses (one per department, with instructor + student assignments)

Idempotent — safe to run multiple times (Permify upserts tuples).

Usage:
    cd backend
    python -m scripts.seed_permify_test_data [--tenant t1]
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys

from app.config import get_settings
from app.core.permify.client import PermifyClient

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Test data IDs (deterministic UUIDs for idempotency)
# ---------------------------------------------------------------------------

TRUST_ID = "trust-test-001"
COLLEGE_ID = "college-test-001"

DEPARTMENTS = {
    "dept-anatomy-001": "Anatomy",
    "dept-physio-001": "Physiology",
    "dept-biochem-001": "Biochemistry",
}

# College-level users
DEAN_ID = "user-dean-001"
ADMIN_ID = "user-admin-001"
COMPLIANCE_ID = "user-compliance-001"

# HODs — one per department
HODS = {
    "dept-anatomy-001": "user-hod-anatomy-001",
    "dept-physio-001": "user-hod-physio-001",
    "dept-biochem-001": "user-hod-biochem-001",
}

# Faculty — two per department
FACULTY = {
    "dept-anatomy-001": ["user-fac-anatomy-001", "user-fac-anatomy-002"],
    "dept-physio-001": ["user-fac-physio-001", "user-fac-physio-002"],
    "dept-biochem-001": ["user-fac-biochem-001", "user-fac-biochem-002"],
}

# Students — 10 at college level
STUDENTS = [f"user-student-{i:03d}" for i in range(1, 11)]

# Courses — one per department
COURSES = {
    "course-anatomy-101": {
        "dept": "dept-anatomy-001",
        "instructor": "user-fac-anatomy-001",
        "students": STUDENTS[:4],  # first 4 students
    },
    "course-physio-101": {
        "dept": "dept-physio-001",
        "instructor": "user-fac-physio-001",
        "students": STUDENTS[3:7],  # students 4-7
    },
    "course-biochem-101": {
        "dept": "dept-biochem-001",
        "instructor": "user-fac-biochem-001",
        "students": STUDENTS[6:],  # last 4 students
    },
}


def build_tuples() -> list[dict]:
    """Build the full list of relationship tuples to seed."""
    tuples: list[dict] = []

    # ------------------------------------------------------------------
    # 1. Structural hierarchy
    # ------------------------------------------------------------------

    # college → trust
    tuples.append({
        "entity_type": "college",
        "entity_id": COLLEGE_ID,
        "relation": "parent",
        "subject_type": "trust",
        "subject_id": TRUST_ID,
    })

    # departments → college
    for dept_id in DEPARTMENTS:
        tuples.append({
            "entity_type": "department",
            "entity_id": dept_id,
            "relation": "parent",
            "subject_type": "college",
            "subject_id": COLLEGE_ID,
        })

    # courses → department
    for course_id, info in COURSES.items():
        tuples.append({
            "entity_type": "course",
            "entity_id": course_id,
            "relation": "department",
            "subject_type": "department",
            "subject_id": info["dept"],
        })

    # ------------------------------------------------------------------
    # 2. College-level roles
    # ------------------------------------------------------------------

    tuples.append({
        "entity_type": "college",
        "entity_id": COLLEGE_ID,
        "relation": "dean",
        "subject_type": "user",
        "subject_id": DEAN_ID,
    })

    tuples.append({
        "entity_type": "college",
        "entity_id": COLLEGE_ID,
        "relation": "admin",
        "subject_type": "user",
        "subject_id": ADMIN_ID,
    })

    tuples.append({
        "entity_type": "college",
        "entity_id": COLLEGE_ID,
        "relation": "compliance_officer",
        "subject_type": "user",
        "subject_id": COMPLIANCE_ID,
    })

    # Students at college level
    for student_id in STUDENTS:
        tuples.append({
            "entity_type": "college",
            "entity_id": COLLEGE_ID,
            "relation": "student",
            "subject_type": "user",
            "subject_id": student_id,
        })

    # ------------------------------------------------------------------
    # 3. Department-level roles
    # ------------------------------------------------------------------

    for dept_id, hod_id in HODS.items():
        # HOD on department
        tuples.append({
            "entity_type": "department",
            "entity_id": dept_id,
            "relation": "hod",
            "subject_type": "user",
            "subject_id": hod_id,
        })
        # HODs are also faculty on the college
        tuples.append({
            "entity_type": "college",
            "entity_id": COLLEGE_ID,
            "relation": "faculty",
            "subject_type": "user",
            "subject_id": hod_id,
        })

    for dept_id, fac_ids in FACULTY.items():
        for fac_id in fac_ids:
            # Faculty on department
            tuples.append({
                "entity_type": "department",
                "entity_id": dept_id,
                "relation": "faculty",
                "subject_type": "user",
                "subject_id": fac_id,
            })
            # Faculty on college
            tuples.append({
                "entity_type": "college",
                "entity_id": COLLEGE_ID,
                "relation": "faculty",
                "subject_type": "user",
                "subject_id": fac_id,
            })

    # ------------------------------------------------------------------
    # 4. Course-level assignments
    # ------------------------------------------------------------------

    for course_id, info in COURSES.items():
        # Instructor
        tuples.append({
            "entity_type": "course",
            "entity_id": course_id,
            "relation": "instructor",
            "subject_type": "user",
            "subject_id": info["instructor"],
        })
        # Students
        for student_id in info["students"]:
            tuples.append({
                "entity_type": "course",
                "entity_id": course_id,
                "relation": "student",
                "subject_type": "user",
                "subject_id": student_id,
            })

    return tuples


async def main(tenant_id: str) -> None:
    settings = get_settings()
    client = PermifyClient(settings)

    # Health check
    healthy = await client.health_check()
    if not healthy:
        logger.error(
            "Permify is unreachable at %s — cannot seed data",
            client._base_url,
        )
        await client.close()
        sys.exit(1)

    logger.info("Connected to Permify at %s", client._base_url)

    # Build and write tuples
    tuples = build_tuples()

    logger.info("Writing %d relationship tuples to tenant '%s'...", len(tuples), tenant_id)
    success = await client.batch_write_relationships(tuples, tenant_id=tenant_id)

    if not success:
        logger.error("Failed to write relationships — check Permify logs")
        await client.close()
        sys.exit(1)

    # Print summary
    print("\n" + "=" * 60)
    print("  Permify Test Data Seeded Successfully")
    print("=" * 60)
    print(f"\n  Tenant:     {tenant_id}")
    print(f"  Trust:      {TRUST_ID}")
    print(f"  College:    {COLLEGE_ID}")
    print(f"  Tuples:     {len(tuples)}")
    print(f"\n  Hierarchy:")
    print(f"    Trust ({TRUST_ID})")
    print(f"    └── College ({COLLEGE_ID})")
    for dept_id, dept_name in DEPARTMENTS.items():
        print(f"        ├── {dept_name} ({dept_id})")
    print(f"\n  Users:")
    print(f"    Dean:               {DEAN_ID}")
    print(f"    Admin:              {ADMIN_ID}")
    print(f"    Compliance Officer: {COMPLIANCE_ID}")
    for dept_id, hod_id in HODS.items():
        print(f"    HOD ({DEPARTMENTS[dept_id]}):  {hod_id}")
    for dept_id, fac_ids in FACULTY.items():
        for fac_id in fac_ids:
            print(f"    Faculty ({DEPARTMENTS[dept_id]}): {fac_id}")
    for s_id in STUDENTS:
        print(f"    Student:            {s_id}")
    print(f"\n  Courses:")
    for course_id, info in COURSES.items():
        print(f"    {course_id} → dept={info['dept']}, instructor={info['instructor']}, students={len(info['students'])}")
    print()

    await client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed Permify with test data")
    parser.add_argument("--tenant", default="t1", help="Permify tenant ID (default: t1)")
    args = parser.parse_args()

    asyncio.run(main(args.tenant))
