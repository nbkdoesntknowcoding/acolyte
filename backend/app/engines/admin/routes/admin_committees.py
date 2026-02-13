"""Admin committee membership management routes.

Endpoints under /api/v1/admin/committees:
- POST /{committee_id}/add-member    — Add a user to a committee
- POST /{committee_id}/remove-member — Remove a user from a committee
"""

from __future__ import annotations

import logging
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_tenant_db, require_college_admin
from app.middleware.clerk_auth import CurrentUser
from app.shared.schemas.roles import RoleAssignmentResponse
from app.shared.services.dynamic_role_service import DynamicRoleService
from app.shared.services.qr_token_service import clerk_user_id_to_uuid

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Admin - Committees"])


class AddCommitteeMemberRequest(BaseModel):
    user_id: UUID
    user_type: str = Field("faculty", max_length=20)
    user_name: str | None = Field(None, max_length=255)
    role_type: str = Field("committee_member", pattern="^committee_(chair|secretary|member|external)$")
    valid_from: date | None = None
    valid_until: date | None = None
    notes: str | None = None


class RemoveCommitteeMemberRequest(BaseModel):
    user_id: UUID
    reason: str = "admin_removed"


@router.post("/{committee_id}/add-member", response_model=RoleAssignmentResponse, status_code=201)
async def add_committee_member(
    committee_id: UUID,
    body: AddCommitteeMemberRequest,
    user: CurrentUser = Depends(require_college_admin),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Add a user to a committee as a dynamic role assignment."""
    admin_uid = clerk_user_id_to_uuid(user.user_id)
    service = DynamicRoleService(db)
    assignment = await service.assign_role(
        college_id=user.college_id,
        user_id=body.user_id,
        user_type=body.user_type,
        user_name=body.user_name,
        role_type=body.role_type,
        context_type="committee",
        context_id=committee_id,
        context_name=None,
        valid_from=body.valid_from or date.today(),
        valid_until=body.valid_until,
        auto_deactivate=body.valid_until is not None,
        assigned_by=admin_uid,
        assigned_by_name=user.full_name,
        notes=body.notes,
    )
    return RoleAssignmentResponse.model_validate(assignment)


@router.post("/{committee_id}/remove-member", status_code=200)
async def remove_committee_member(
    committee_id: UUID,
    body: RemoveCommitteeMemberRequest,
    user: CurrentUser = Depends(require_college_admin),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Remove a user from a committee by revoking their role assignment."""
    from sqlalchemy import select
    from app.shared.models.dynamic_roles import DynamicRoleAssignment

    result = await db.execute(
        select(DynamicRoleAssignment).where(
            DynamicRoleAssignment.user_id == body.user_id,
            DynamicRoleAssignment.context_type == "committee",
            DynamicRoleAssignment.context_id == committee_id,
            DynamicRoleAssignment.is_active == True,  # noqa: E712
        )
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(404, "User is not an active member of this committee")

    admin_uid = clerk_user_id_to_uuid(user.user_id)
    service = DynamicRoleService(db)
    await service.revoke_role(assignment.id, admin_uid, body.reason)
    return {"status": "ok", "message": "Committee member removed"}
