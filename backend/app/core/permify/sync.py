"""Clerk → Permify synchronization layer.

Maps Clerk organization membership events to Permify relationship tuples.
Called from backend webhook routes when Clerk fires membership events.

Clerk org_role → Permify relationship mapping:
  org:student            → college#student
  org:faculty            → college#faculty + department#faculty (if dept known)
  org:hod                → department#hod + college#faculty
  org:dean               → college#dean
  org:admin              → college#admin
  org:compliance_officer → college#compliance_officer
  org:management         → trust#admin (elevated)
  org:member             → college#student (default)
"""

from __future__ import annotations

import logging
from typing import Any

from app.core.permify.client import PermifyClient

logger = logging.getLogger(__name__)

# Clerk org_role → list of Permify tuples to write.
# Each entry is (entity_type_template, relation).
# Templates: "college" uses org_id, "department" uses department_id.
_ROLE_TUPLE_MAP: dict[str, list[tuple[str, str]]] = {
    "org:student": [("college", "student")],
    "org:faculty": [("college", "faculty")],
    "org:hod": [("college", "faculty")],
    "org:dean": [("college", "dean")],
    "org:admin": [("college", "admin")],
    "org:compliance_officer": [("college", "compliance_officer")],
    "org:management": [("college", "admin")],
    "org:member": [("college", "student")],
    "admin": [("college", "admin")],
}

# Roles that also get department-level tuples when department_id is provided
_DEPARTMENT_ROLES: dict[str, str] = {
    "org:faculty": "faculty",
    "org:hod": "hod",
}


async def sync_clerk_membership_to_permify(
    client: PermifyClient,
    org_id: str,
    user_id: str,
    org_role: str,
    department_id: str | None = None,
    tenant_id: str = "t1",
) -> bool:
    """Sync a Clerk membership to Permify relationships.

    Called when organizationMembership.created fires.

    Args:
        client: PermifyClient instance (from app.state.permify)
        org_id: Clerk org ID (maps to college_id)
        user_id: Clerk user ID
        org_role: Clerk org role string (e.g. "org:faculty")
        department_id: Optional department UUID for faculty/hod roles
        tenant_id: Permify tenant (default "t1")
    """
    tuples: list[dict[str, Any]] = []

    # College-level tuples
    college_tuples = _ROLE_TUPLE_MAP.get(org_role, _ROLE_TUPLE_MAP["org:member"])
    for entity_type, relation in college_tuples:
        tuples.append({
            "entity_type": entity_type,
            "entity_id": org_id,
            "relation": relation,
            "subject_type": "user",
            "subject_id": user_id,
        })

    # Department-level tuples (for faculty and hod)
    dept_relation = _DEPARTMENT_ROLES.get(org_role)
    if dept_relation and department_id:
        tuples.append({
            "entity_type": "department",
            "entity_id": department_id,
            "relation": dept_relation,
            "subject_type": "user",
            "subject_id": user_id,
        })

    if not tuples:
        logger.warning("No Permify tuples mapped for role: %s", org_role)
        return True

    success = await client.batch_write_relationships(tuples, tenant_id=tenant_id)
    if success:
        logger.info(
            "Synced Clerk membership → Permify: user=%s org=%s role=%s (%d tuples)",
            user_id, org_id, org_role, len(tuples),
        )
    else:
        logger.error(
            "Failed to sync Clerk membership: user=%s org=%s role=%s",
            user_id, org_id, org_role,
        )
    return success


async def remove_clerk_membership_from_permify(
    client: PermifyClient,
    org_id: str,
    user_id: str,
    org_role: str,
    department_id: str | None = None,
    tenant_id: str = "t1",
) -> bool:
    """Remove Permify relationships when a Clerk membership is deleted/changed.

    Called when organizationMembership.deleted fires, or before
    re-syncing on organizationMembership.updated.
    """
    results: list[bool] = []

    # Delete college-level tuples
    college_tuples = _ROLE_TUPLE_MAP.get(org_role, _ROLE_TUPLE_MAP["org:member"])
    for entity_type, relation in college_tuples:
        ok = await client.delete_relationship(
            entity_type=entity_type,
            entity_id=org_id,
            relation=relation,
            subject_id=user_id,
            tenant_id=tenant_id,
        )
        results.append(ok)

    # Delete department-level tuples
    dept_relation = _DEPARTMENT_ROLES.get(org_role)
    if dept_relation and department_id:
        ok = await client.delete_relationship(
            entity_type="department",
            entity_id=department_id,
            relation=dept_relation,
            subject_id=user_id,
            tenant_id=tenant_id,
        )
        results.append(ok)

    success = all(results) if results else True
    if success:
        logger.info(
            "Removed Permify membership: user=%s org=%s role=%s",
            user_id, org_id, org_role,
        )
    return success


async def sync_course_enrollment(
    client: PermifyClient,
    course_id: str,
    student_user_id: str,
    tenant_id: str = "t1",
) -> bool:
    """Write a course enrollment relationship."""
    return await client.write_relationship(
        entity_type="course",
        entity_id=course_id,
        relation="student",
        subject_id=student_user_id,
        tenant_id=tenant_id,
    )


async def remove_course_enrollment(
    client: PermifyClient,
    course_id: str,
    student_user_id: str,
    tenant_id: str = "t1",
) -> bool:
    """Remove a course enrollment relationship."""
    return await client.delete_relationship(
        entity_type="course",
        entity_id=course_id,
        relation="student",
        subject_id=student_user_id,
        tenant_id=tenant_id,
    )


async def sync_course_instructor(
    client: PermifyClient,
    course_id: str,
    faculty_user_id: str,
    tenant_id: str = "t1",
) -> bool:
    """Write a course instructor relationship."""
    return await client.write_relationship(
        entity_type="course",
        entity_id=course_id,
        relation="instructor",
        subject_id=faculty_user_id,
        tenant_id=tenant_id,
    )


async def remove_course_instructor(
    client: PermifyClient,
    course_id: str,
    faculty_user_id: str,
    tenant_id: str = "t1",
) -> bool:
    """Remove a course instructor relationship."""
    return await client.delete_relationship(
        entity_type="course",
        entity_id=course_id,
        relation="instructor",
        subject_id=faculty_user_id,
        tenant_id=tenant_id,
    )


async def seed_college_hierarchy(
    client: PermifyClient,
    college_id: str,
    trust_id: str,
    departments: list[dict[str, str]],
    tenant_id: str = "t1",
) -> bool:
    """Seed the structural hierarchy for a new college.

    Called during college onboarding. Writes:
    - college#{college_id}#parent@trust#{trust_id}
    - department#{dept_id}#parent@college#{college_id} for each department

    Args:
        departments: List of {"id": "uuid", "name": "Anatomy"} dicts.
    """
    tuples: list[dict[str, Any]] = [
        {
            "entity_type": "college",
            "entity_id": college_id,
            "relation": "parent",
            "subject_type": "trust",
            "subject_id": trust_id,
        },
    ]

    for dept in departments:
        tuples.append({
            "entity_type": "department",
            "entity_id": dept["id"],
            "relation": "parent",
            "subject_type": "college",
            "subject_id": college_id,
        })

    success = await client.batch_write_relationships(tuples, tenant_id=tenant_id)
    if success:
        logger.info(
            "Seeded college hierarchy: college=%s trust=%s departments=%d",
            college_id, trust_id, len(departments),
        )
    return success
