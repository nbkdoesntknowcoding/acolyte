"""User profile routes — /api/v1/me.

Returns current user's dynamic roles and committee memberships.
"""

from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user, get_tenant_db
from app.middleware.clerk_auth import CurrentUser
from app.shared.schemas.roles import RoleAssignmentResponse, UserRolesResponse
from app.shared.services.dynamic_role_service import DynamicRoleService
from app.shared.services.qr_token_service import clerk_user_id_to_uuid

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/me", tags=["Me"])


# ---------------------------------------------------------------------------
# 1. GET /roles — All active dynamic role assignments
# ---------------------------------------------------------------------------

@router.get("/roles", response_model=UserRolesResponse)
async def get_my_roles(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get all active dynamic role assignments for the current user."""
    uid = clerk_user_id_to_uuid(user.user_id)
    service = DynamicRoleService(db)
    roles = await service.get_user_roles(uid, user.college_id)
    return UserRolesResponse(
        user_id=uid,
        roles=[RoleAssignmentResponse.model_validate(r) for r in roles],
    )


# ---------------------------------------------------------------------------
# 2. GET /committees — Committee roles only
# ---------------------------------------------------------------------------

@router.get("/committees", response_model=UserRolesResponse)
async def get_my_committees(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get committee-specific role assignments for the current user."""
    uid = clerk_user_id_to_uuid(user.user_id)
    service = DynamicRoleService(db)
    roles = await service.get_user_committee_roles(uid, user.college_id)
    return UserRolesResponse(
        user_id=uid,
        roles=[RoleAssignmentResponse.model_validate(r) for r in roles],
    )
