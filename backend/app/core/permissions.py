"""Permify integration for Zanzibar-style authorization.

Uses Permify's REST API for permission checks and relationship writes.
See CLAUDE.md for the full Permify schema definition.
"""

from uuid import UUID

import httpx

from app.config import get_settings

settings = get_settings()

PERMIFY_BASE_URL = f"http://{settings.PERMIFY_HOST}:{settings.PERMIFY_PORT}"


async def check_permission(
    entity_type: str,
    entity_id: str,
    permission: str,
    subject_type: str,
    subject_id: str,
) -> bool:
    """Check if a subject has a permission on an entity.

    Example:
        allowed = await check_permission(
            entity_type="department",
            entity_id=str(dept_id),
            permission="sign_logbook",
            subject_type="user",
            subject_id=str(user_id),
        )
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{PERMIFY_BASE_URL}/v1/tenants/t1/permissions/check",
                json={
                    "metadata": {"depth": 5},
                    "entity": {"type": entity_type, "id": entity_id},
                    "permission": permission,
                    "subject": {"type": subject_type, "id": subject_id},
                },
            )
            result = response.json()
            return result.get("can") == "CHECK_RESULT_ALLOWED"
    except Exception:
        # Fail closed — deny if Permify is unreachable
        return False


async def write_relationship(
    entity_type: str,
    entity_id: str,
    relation: str,
    subject_type: str,
    subject_id: str,
) -> bool:
    """Write a relationship tuple to Permify.

    Example:
        await write_relationship(
            entity_type="department",
            entity_id=str(dept_id),
            relation="hod",
            subject_type="user",
            subject_id=str(user_id),
        )
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{PERMIFY_BASE_URL}/v1/tenants/t1/relationships/write",
                json={
                    "metadata": {},
                    "tuples": [
                        {
                            "entity": {"type": entity_type, "id": entity_id},
                            "relation": relation,
                            "subject": {"type": subject_type, "id": subject_id},
                        }
                    ],
                },
            )
            return response.status_code == 200
    except Exception:
        return False
