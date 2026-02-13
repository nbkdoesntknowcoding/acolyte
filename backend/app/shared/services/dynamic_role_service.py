"""Dynamic Role Assignment service — manages time-bound role grants.

Handles role CRUD, committee operations, and permission derivation.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.events import publish_event
from app.shared.models.committee import CommitteeActionItem, CommitteeMeeting
from app.shared.models.dynamic_roles import DynamicRoleAssignment

logger = logging.getLogger(__name__)

# Default permissions per role_type
_ROLE_PERMISSIONS: dict[str, list[str]] = {
    "committee_chair": [
        "committee.view", "committee.manage", "committee.schedule_meeting",
        "committee.file_minutes", "committee.manage_action_items",
    ],
    "committee_secretary": [
        "committee.view", "committee.schedule_meeting",
        "committee.file_minutes", "committee.manage_action_items",
    ],
    "committee_member": ["committee.view", "committee.view_minutes"],
    "exam_controller": [
        "exam.view", "exam.manage", "exam.approve_results",
        "exam.schedule", "exam.manage_seating",
    ],
    "hostel_warden": [
        "hostel.view", "hostel.manage_rooms", "hostel.view_complaints",
        "hostel.manage_discipline",
    ],
    "batch_mentor": ["batch.view_students", "batch.view_analytics"],
    "rotation_coordinator": ["rotation.view", "rotation.manage"],
}


class DynamicRoleService:
    """Manages dynamic role assignments and committee operations."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Role Assignment Methods ──

    async def get_user_roles(
        self, user_id: UUID, college_id: UUID
    ) -> list[DynamicRoleAssignment]:
        """Get all active role assignments for a user."""
        today = date.today()
        result = await self.db.execute(
            select(DynamicRoleAssignment)
            .where(
                DynamicRoleAssignment.college_id == college_id,
                DynamicRoleAssignment.user_id == user_id,
                DynamicRoleAssignment.is_active == True,  # noqa: E712
                (
                    (DynamicRoleAssignment.valid_until == None)  # noqa: E711
                    | (DynamicRoleAssignment.valid_until >= today)
                ),
            )
            .order_by(
                DynamicRoleAssignment.context_type,
                DynamicRoleAssignment.context_name,
            )
        )
        return list(result.scalars().all())

    async def get_user_committee_roles(
        self, user_id: UUID, college_id: UUID
    ) -> list[DynamicRoleAssignment]:
        """Get committee-specific roles for a user."""
        today = date.today()
        result = await self.db.execute(
            select(DynamicRoleAssignment)
            .where(
                DynamicRoleAssignment.college_id == college_id,
                DynamicRoleAssignment.user_id == user_id,
                DynamicRoleAssignment.context_type == "committee",
                DynamicRoleAssignment.is_active == True,  # noqa: E712
                (
                    (DynamicRoleAssignment.valid_until == None)  # noqa: E711
                    | (DynamicRoleAssignment.valid_until >= today)
                ),
            )
            .order_by(DynamicRoleAssignment.context_name)
        )
        return list(result.scalars().all())

    async def assign_role(
        self,
        college_id: UUID,
        user_id: UUID,
        user_type: str,
        user_name: str | None,
        role_type: str,
        context_type: str,
        context_id: UUID,
        context_name: str | None,
        valid_from: date,
        valid_until: date | None,
        auto_deactivate: bool,
        assigned_by: UUID,
        assigned_by_name: str | None = None,
        assignment_order_url: str | None = None,
        notes: str | None = None,
        permissions: list[str] | None = None,
    ) -> DynamicRoleAssignment:
        """Create a new role assignment.

        Prevents duplicate active assignments for the same user+role+context.
        """
        # Check for duplicate
        result = await self.db.execute(
            select(DynamicRoleAssignment).where(
                DynamicRoleAssignment.college_id == college_id,
                DynamicRoleAssignment.user_id == user_id,
                DynamicRoleAssignment.role_type == role_type,
                DynamicRoleAssignment.context_id == context_id,
                DynamicRoleAssignment.is_active == True,  # noqa: E712
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            raise HTTPException(
                409,
                f"User already has an active '{role_type}' assignment for this context",
            )

        # Derive permissions if not provided
        if permissions is None:
            permissions = _ROLE_PERMISSIONS.get(role_type, [])

        assignment = DynamicRoleAssignment(
            college_id=college_id,
            user_id=user_id,
            user_type=user_type,
            user_name=user_name,
            role_type=role_type,
            context_type=context_type,
            context_id=context_id,
            context_name=context_name,
            valid_from=valid_from,
            valid_until=valid_until,
            auto_deactivate=auto_deactivate,
            assigned_by=assigned_by,
            assigned_by_name=assigned_by_name,
            assignment_order_url=assignment_order_url,
            notes=notes,
            permissions=permissions,
            is_active=True,
        )
        self.db.add(assignment)
        await self.db.flush()

        try:
            await publish_event("role.assigned", {
                "user_id": str(user_id),
                "role_type": role_type,
                "context_type": context_type,
                "context_id": str(context_id),
            })
        except Exception:
            logger.warning("Failed to publish role.assigned event")

        return assignment

    async def revoke_role(
        self, assignment_id: UUID, revoked_by: UUID, reason: str = ""
    ) -> None:
        """Revoke a role assignment."""
        result = await self.db.execute(
            select(DynamicRoleAssignment).where(
                DynamicRoleAssignment.id == assignment_id,
            )
        )
        assignment = result.scalar_one_or_none()
        if not assignment:
            raise HTTPException(404, "Role assignment not found")

        assignment.is_active = False
        assignment.notes = (assignment.notes or "") + f"\nRevoked: {reason}"
        await self.db.flush()

        try:
            await publish_event("role.revoked", {
                "user_id": str(assignment.user_id),
                "role_type": assignment.role_type,
                "context_id": str(assignment.context_id),
                "revoked_by": str(revoked_by),
                "reason": reason,
            })
        except Exception:
            logger.warning("Failed to publish role.revoked event")

    async def get_expiring_roles(
        self, college_id: UUID, days: int = 30
    ) -> list[DynamicRoleAssignment]:
        """Get roles expiring within the given number of days."""
        today = date.today()
        cutoff = today + timedelta(days=days)
        result = await self.db.execute(
            select(DynamicRoleAssignment)
            .where(
                DynamicRoleAssignment.college_id == college_id,
                DynamicRoleAssignment.is_active == True,  # noqa: E712
                DynamicRoleAssignment.valid_until != None,  # noqa: E711
                DynamicRoleAssignment.valid_until >= today,
                DynamicRoleAssignment.valid_until <= cutoff,
            )
            .order_by(DynamicRoleAssignment.valid_until)
        )
        return list(result.scalars().all())

    # ── Committee Methods ──

    async def _verify_committee_member(
        self, committee_id: UUID, user_id: UUID, college_id: UUID
    ) -> DynamicRoleAssignment:
        """Verify user is an active committee member."""
        today = date.today()
        result = await self.db.execute(
            select(DynamicRoleAssignment)
            .where(
                DynamicRoleAssignment.college_id == college_id,
                DynamicRoleAssignment.user_id == user_id,
                DynamicRoleAssignment.context_type == "committee",
                DynamicRoleAssignment.context_id == committee_id,
                DynamicRoleAssignment.is_active == True,  # noqa: E712
                (
                    (DynamicRoleAssignment.valid_until == None)  # noqa: E711
                    | (DynamicRoleAssignment.valid_until >= today)
                ),
            )
        )
        role = result.scalar_one_or_none()
        if not role:
            raise HTTPException(403, "Not a member of this committee")
        return role

    async def _require_chair_or_secretary(
        self, committee_id: UUID, user_id: UUID, college_id: UUID
    ) -> DynamicRoleAssignment:
        """Verify user has chair or secretary role for this committee."""
        role = await self._verify_committee_member(committee_id, user_id, college_id)
        if role.role_type not in ("committee_chair", "committee_secretary"):
            raise HTTPException(403, "Requires chair or secretary role")
        return role

    async def get_committee_meetings(
        self, committee_id: UUID, user_id: UUID, college_id: UUID
    ) -> list[CommitteeMeeting]:
        """Get meetings for a committee (member access required)."""
        await self._verify_committee_member(committee_id, user_id, college_id)

        result = await self.db.execute(
            select(CommitteeMeeting)
            .where(CommitteeMeeting.committee_id == committee_id)
            .order_by(CommitteeMeeting.meeting_date.desc())
        )
        return list(result.scalars().all())

    async def create_committee_meeting(
        self,
        committee_id: UUID,
        user_id: UUID,
        college_id: UUID,
        title: str,
        meeting_date: datetime,
        description: str | None = None,
        location: str | None = None,
        agenda: list | None = None,
    ) -> CommitteeMeeting:
        """Schedule a committee meeting (chair/secretary only)."""
        await self._require_chair_or_secretary(committee_id, user_id, college_id)

        meeting = CommitteeMeeting(
            college_id=college_id,
            committee_id=committee_id,
            title=title,
            description=description,
            meeting_date=meeting_date,
            location=location,
            agenda=agenda or [],
            status="scheduled",
        )
        self.db.add(meeting)
        await self.db.flush()
        return meeting

    async def file_meeting_minutes(
        self,
        meeting_id: UUID,
        user_id: UUID,
        college_id: UUID,
        minutes_text: str | None = None,
        minutes_file_url: str | None = None,
        attendees: list | None = None,
        quorum_met: bool = False,
    ) -> CommitteeMeeting:
        """File minutes for a meeting (chair/secretary only)."""
        result = await self.db.execute(
            select(CommitteeMeeting).where(CommitteeMeeting.id == meeting_id)
        )
        meeting = result.scalar_one_or_none()
        if not meeting:
            raise HTTPException(404, "Meeting not found")

        await self._require_chair_or_secretary(meeting.committee_id, user_id, college_id)

        meeting.minutes_text = minutes_text
        meeting.minutes_file_url = minutes_file_url
        meeting.minutes_filed_by = user_id
        meeting.minutes_filed_at = datetime.now(timezone.utc)
        meeting.attendees = attendees or []
        meeting.quorum_met = quorum_met
        meeting.status = "completed"
        await self.db.flush()
        return meeting

    async def get_committee_action_items(
        self, committee_id: UUID, user_id: UUID, college_id: UUID
    ) -> list[CommitteeActionItem]:
        """Get action items for a committee."""
        await self._verify_committee_member(committee_id, user_id, college_id)

        result = await self.db.execute(
            select(CommitteeActionItem)
            .where(CommitteeActionItem.committee_id == committee_id)
            .order_by(CommitteeActionItem.due_date.asc())
        )
        return list(result.scalars().all())

    async def update_action_item(
        self,
        item_id: UUID,
        user_id: UUID,
        college_id: UUID,
        status: str | None = None,
        notes: str | None = None,
        completed_at: datetime | None = None,
    ) -> CommitteeActionItem:
        """Update an action item."""
        result = await self.db.execute(
            select(CommitteeActionItem).where(CommitteeActionItem.id == item_id)
        )
        item = result.scalar_one_or_none()
        if not item:
            raise HTTPException(404, "Action item not found")

        # Verify membership
        await self._verify_committee_member(item.committee_id, user_id, college_id)

        if status:
            item.status = status
        if notes is not None:
            item.notes = notes
        if completed_at:
            item.completed_at = completed_at
        elif status == "completed":
            item.completed_at = datetime.now(timezone.utc)

        await self.db.flush()
        return item
