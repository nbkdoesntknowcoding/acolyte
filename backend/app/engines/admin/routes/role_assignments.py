"""Admin role assignment management routes.

CRUD for dynamic role assignments — admin can assign/revoke roles
for any user in their college.
"""

from __future__ import annotations

import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user, get_tenant_db, require_college_admin
from app.middleware.clerk_auth import CurrentUser
from app.shared.models.dynamic_roles import DynamicRoleAssignment
from app.shared.schemas.roles import (
    RoleAssignmentCreate,
    RoleAssignmentResponse,
    RoleAssignmentUpdate,
)
from app.shared.services.dynamic_role_service import DynamicRoleService
from app.shared.services.qr_token_service import clerk_user_id_to_uuid

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Admin - Role Assignments"])


# ---------------------------------------------------------------------------
# 1. GET / — List all role assignments
# ---------------------------------------------------------------------------

@router.get("/", response_model=list[RoleAssignmentResponse])
async def list_role_assignments(
    role_type: Optional[str] = Query(None),
    context_type: Optional[str] = Query(None),
    user_id: Optional[UUID] = Query(None),
    is_active: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    user: CurrentUser = Depends(require_college_admin),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List all dynamic role assignments with optional filters."""
    query = select(DynamicRoleAssignment).order_by(
        DynamicRoleAssignment.context_type, DynamicRoleAssignment.user_name
    )

    if role_type:
        query = query.where(DynamicRoleAssignment.role_type == role_type)
    if context_type:
        query = query.where(DynamicRoleAssignment.context_type == context_type)
    if user_id:
        query = query.where(DynamicRoleAssignment.user_id == user_id)
    if is_active is not None:
        query = query.where(DynamicRoleAssignment.is_active == is_active)

    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return [RoleAssignmentResponse.model_validate(r) for r in result.scalars().all()]


# ---------------------------------------------------------------------------
# 2. POST / — Create role assignment
# ---------------------------------------------------------------------------

@router.post("/", response_model=RoleAssignmentResponse, status_code=201)
async def create_role_assignment(
    body: RoleAssignmentCreate,
    user: CurrentUser = Depends(require_college_admin),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Create a new dynamic role assignment."""
    admin_uid = clerk_user_id_to_uuid(user.user_id)
    service = DynamicRoleService(db)
    assignment = await service.assign_role(
        college_id=user.college_id,
        user_id=body.user_id,
        user_type=body.user_type,
        user_name=body.user_name,
        role_type=body.role_type,
        context_type=body.context_type,
        context_id=body.context_id,
        context_name=body.context_name,
        valid_from=body.valid_from,
        valid_until=body.valid_until,
        auto_deactivate=body.auto_deactivate,
        assigned_by=admin_uid,
        assigned_by_name=user.full_name,
        assignment_order_url=body.assignment_order_url,
        notes=body.notes,
        permissions=body.permissions,
    )
    return RoleAssignmentResponse.model_validate(assignment)


# ---------------------------------------------------------------------------
# 3. PUT /{id} — Update role assignment
# ---------------------------------------------------------------------------

@router.put("/{assignment_id}", response_model=RoleAssignmentResponse)
async def update_role_assignment(
    assignment_id: UUID,
    body: RoleAssignmentUpdate,
    user: CurrentUser = Depends(require_college_admin),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Update a dynamic role assignment."""
    result = await db.execute(
        select(DynamicRoleAssignment).where(
            DynamicRoleAssignment.id == assignment_id,
        )
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        from fastapi import HTTPException
        raise HTTPException(404, "Role assignment not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(assignment, key, value)

    await db.flush()
    return RoleAssignmentResponse.model_validate(assignment)


# ---------------------------------------------------------------------------
# 4. DELETE /{id} — Revoke role assignment
# ---------------------------------------------------------------------------

@router.delete("/{assignment_id}", status_code=200)
async def revoke_role_assignment(
    assignment_id: UUID,
    reason: str = Query("admin_revoked"),
    user: CurrentUser = Depends(require_college_admin),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Revoke a dynamic role assignment."""
    admin_uid = clerk_user_id_to_uuid(user.user_id)
    service = DynamicRoleService(db)
    await service.revoke_role(assignment_id, admin_uid, reason)
    return {"status": "ok", "message": "Role assignment revoked"}


# ---------------------------------------------------------------------------
# 5. GET /expiring — Assignments expiring within 30 days
# ---------------------------------------------------------------------------

@router.get("/expiring", response_model=list[RoleAssignmentResponse])
async def get_expiring_assignments(
    days: int = Query(30, ge=1, le=365),
    user: CurrentUser = Depends(require_college_admin),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get role assignments expiring within the specified number of days."""
    service = DynamicRoleService(db)
    expiring = await service.get_expiring_roles(user.college_id, days)
    return [RoleAssignmentResponse.model_validate(r) for r in expiring]
