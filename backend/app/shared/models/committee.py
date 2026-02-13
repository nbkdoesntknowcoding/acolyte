"""Committee models — meetings, action items, and tracking.

NMC requires medical colleges to have multiple statutory and internal
committees (Anti-Ragging, Internal Complaints, Curriculum, etc.).

These models track committee meetings and their action items,
linked to DynamicRoleAssignment for membership.
"""

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID

from .base import TenantModel


class CommitteeMeeting(TenantModel):
    """Record of a committee meeting.

    Tracks agenda, minutes, attendees, and quorum status.
    Minutes can be stored as text or as a file URL (or both).
    """

    __tablename__ = "committee_meetings"

    committee_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)

    # Scheduling
    meeting_date = Column(DateTime(timezone=True), nullable=False)
    location = Column(String(255))

    # Agenda and minutes
    agenda = Column(JSONB, server_default="[]", nullable=False)
    minutes_text = Column(Text)
    minutes_file_url = Column(String(500))
    minutes_filed_by = Column(UUID(as_uuid=True))
    minutes_filed_at = Column(DateTime(timezone=True))

    # Attendance
    attendees = Column(JSONB, server_default="[]", nullable=False)
    quorum_met = Column(Boolean)

    # Status: scheduled, in_progress, completed, cancelled
    status = Column(String(20), server_default="scheduled", nullable=False)

    __table_args__ = (
        Index(
            "ix_committee_meeting_college_committee",
            "college_id", "committee_id",
        ),
    )


class CommitteeActionItem(TenantModel):
    """Action item arising from a committee meeting.

    Tracks assignment, due dates, and completion status.
    """

    __tablename__ = "committee_action_items"

    committee_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    meeting_id = Column(
        UUID(as_uuid=True),
        ForeignKey("committee_meetings.id"),
        nullable=False,
    )

    # Action item details
    title = Column(String(255), nullable=False)
    description = Column(Text)

    # Assignment
    assigned_to = Column(UUID(as_uuid=True))
    assigned_to_name = Column(String(255))

    # Tracking
    due_date = Column(DateTime(timezone=True))
    status = Column(String(20), server_default="pending", nullable=False)  # pending, in_progress, completed, overdue
    completed_at = Column(DateTime(timezone=True))
    notes = Column(Text)

    __table_args__ = (
        Index(
            "ix_action_item_college_committee",
            "college_id", "committee_id",
        ),
    )
