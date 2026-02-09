"""Permify integration — backward-compatible re-exports.

The full Permify client is now at app.core.permify.client.PermifyClient.
These module-level functions are kept for backward compatibility with
existing engine code that imports from app.core.permissions.

For new code, prefer using the PermifyClient from app.state.permify
via FastAPI dependencies (see app/dependencies/permissions.py).
"""

from app.core.permify.client import PermifyClient

# Singleton for module-level backward-compat functions
_client = PermifyClient()


async def check_permission(
    entity_type: str,
    entity_id: str,
    permission: str,
    subject_type: str,
    subject_id: str,
    tenant_id: str = "t1",
) -> bool:
    """Check if a subject has a permission on an entity."""
    return await _client.check(
        entity_type=entity_type,
        entity_id=entity_id,
        permission=permission,
        subject_id=subject_id,
        subject_type=subject_type,
        tenant_id=tenant_id,
    )


async def write_relationship(
    entity_type: str,
    entity_id: str,
    relation: str,
    subject_type: str,
    subject_id: str,
    tenant_id: str = "t1",
) -> bool:
    """Write a relationship tuple to Permify."""
    return await _client.write_relationship(
        entity_type=entity_type,
        entity_id=entity_id,
        relation=relation,
        subject_id=subject_id,
        subject_type=subject_type,
        tenant_id=tenant_id,
    )


async def delete_relationship(
    entity_type: str,
    entity_id: str,
    relation: str,
    subject_type: str,
    subject_id: str,
    tenant_id: str = "t1",
) -> bool:
    """Delete a relationship tuple from Permify."""
    return await _client.delete_relationship(
        entity_type=entity_type,
        entity_id=entity_id,
        relation=relation,
        subject_id=subject_id,
        subject_type=subject_type,
        tenant_id=tenant_id,
    )


async def write_schema(schema: str, tenant_id: str = "t1") -> bool:
    """Write an authorization schema to Permify."""
    version = await _client.push_schema(tenant_id=tenant_id)
    return version is not None
