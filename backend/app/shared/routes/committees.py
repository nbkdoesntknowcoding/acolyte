"""Committee routes — meeting management and action items.

Endpoints require committee membership (verified via DynamicRoleAssignment).
Chair/secretary roles required for write operations.
"""

from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user, get_tenant_db
from app.middleware.clerk_auth import CurrentUser
from app.shared.schemas.roles import (
    ActionItemResponse,
    ActionItemUpdate,
    MeetingCreate,
    MeetingResponse,
    MinutesUpload,
)
from app.shared.services.dynamic_role_service import DynamicRoleService
from app.shared.services.qr_token_service import clerk_user_id_to_uuid

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/committees", tags=["Committees"])


# ---------------------------------------------------------------------------
# 1. GET /{id}/meetings — Meeting list
# ---------------------------------------------------------------------------

@router.get("/{committee_id}/meetings", response_model=list[MeetingResponse])
async def list_meetings(
    committee_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List all meetings for this committee."""
    uid = clerk_user_id_to_uuid(user.user_id)
    service = DynamicRoleService(db)
    meetings = await service.get_committee_meetings(committee_id, uid, user.college_id)
    return [MeetingResponse.model_validate(m) for m in meetings]


# ---------------------------------------------------------------------------
# 2. POST /{id}/meetings — Schedule meeting (chair/secretary only)
# ---------------------------------------------------------------------------

@router.post("/{committee_id}/meetings", response_model=MeetingResponse, status_code=201)
async def create_meeting(
    committee_id: UUID,
    body: MeetingCreate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Schedule a new committee meeting (chair/secretary only)."""
    uid = clerk_user_id_to_uuid(user.user_id)
    service = DynamicRoleService(db)
    meeting = await service.create_committee_meeting(
        committee_id=committee_id,
        user_id=uid,
        college_id=user.college_id,
        title=body.title,
        meeting_date=body.meeting_date,
        description=body.description,
        location=body.location,
        agenda=body.agenda,
    )
    return MeetingResponse.model_validate(meeting)


# ---------------------------------------------------------------------------
# 3. POST /{id}/meetings/{mid}/minutes — Upload minutes
# ---------------------------------------------------------------------------

@router.post("/{committee_id}/meetings/{meeting_id}/minutes", response_model=MeetingResponse)
async def file_minutes(
    committee_id: UUID,
    meeting_id: UUID,
    body: MinutesUpload,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """File minutes for a meeting (chair/secretary only)."""
    uid = clerk_user_id_to_uuid(user.user_id)
    service = DynamicRoleService(db)
    meeting = await service.file_meeting_minutes(
        meeting_id=meeting_id,
        user_id=uid,
        college_id=user.college_id,
        minutes_text=body.minutes_text,
        minutes_file_url=body.minutes_file_url,
        attendees=body.attendees,
        quorum_met=body.quorum_met,
    )
    return MeetingResponse.model_validate(meeting)


# ---------------------------------------------------------------------------
# 4. GET /{id}/action-items — Action items
# ---------------------------------------------------------------------------

@router.get("/{committee_id}/action-items", response_model=list[ActionItemResponse])
async def list_action_items(
    committee_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List action items for this committee."""
    uid = clerk_user_id_to_uuid(user.user_id)
    service = DynamicRoleService(db)
    items = await service.get_committee_action_items(committee_id, uid, user.college_id)
    return [ActionItemResponse.model_validate(item) for item in items]


# ---------------------------------------------------------------------------
# 5. PUT /{id}/action-items/{aid} — Update action item
# ---------------------------------------------------------------------------

@router.put("/{committee_id}/action-items/{item_id}", response_model=ActionItemResponse)
async def update_action_item(
    committee_id: UUID,
    item_id: UUID,
    body: ActionItemUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Update an action item's status or notes."""
    uid = clerk_user_id_to_uuid(user.user_id)
    service = DynamicRoleService(db)
    item = await service.update_action_item(
        item_id=item_id,
        user_id=uid,
        college_id=user.college_id,
        status=body.status,
        notes=body.notes,
        completed_at=body.completed_at,
    )
    return ActionItemResponse.model_validate(item)
