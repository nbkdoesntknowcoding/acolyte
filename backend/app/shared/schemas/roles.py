"""Pydantic schemas for Dynamic Roles and Committees."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Role Assignment schemas
# ---------------------------------------------------------------------------

class RoleAssignmentCreate(BaseModel):
    """Create a new dynamic role assignment."""

    user_id: UUID
    user_type: str = Field("faculty", max_length=20)
    user_name: Optional[str] = Field(None, max_length=255)
    role_type: str = Field(..., max_length=50)
    context_type: str = Field(..., max_length=30)
    context_id: UUID
    context_name: Optional[str] = Field(None, max_length=255)
    valid_from: date
    valid_until: Optional[date] = None
    auto_deactivate: bool = True
    assignment_order_url: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = None
    permissions: Optional[list[str]] = None


class RoleAssignmentUpdate(BaseModel):
    """Update a dynamic role assignment."""

    valid_until: Optional[date] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None
    assignment_order_url: Optional[str] = Field(None, max_length=500)
    permissions: Optional[list[str]] = None


class RoleAssignmentResponse(BaseModel):
    """Role assignment response for API."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    college_id: UUID
    user_id: UUID
    user_type: str
    user_name: Optional[str] = None
    role_type: str
    context_type: str
    context_id: UUID
    context_name: Optional[str] = None
    valid_from: date
    valid_until: Optional[date] = None
    is_active: bool = True
    auto_deactivate: bool = True
    assigned_by: Optional[UUID] = None
    assigned_by_name: Optional[str] = None
    assignment_order_url: Optional[str] = None
    notes: Optional[str] = None
    permissions: list[str] = []
    created_at: Optional[datetime] = None


class UserRolesResponse(BaseModel):
    """All active roles for a user."""

    user_id: UUID
    roles: list[RoleAssignmentResponse] = []


# ---------------------------------------------------------------------------
# Committee Meeting schemas
# ---------------------------------------------------------------------------

class MeetingCreate(BaseModel):
    """Create a committee meeting."""

    title: str = Field(..., max_length=255)
    description: Optional[str] = None
    meeting_date: datetime
    location: Optional[str] = Field(None, max_length=255)
    agenda: list[str] = []


class MeetingResponse(BaseModel):
    """Committee meeting response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    committee_id: UUID
    title: str
    description: Optional[str] = None
    meeting_date: datetime
    location: Optional[str] = None
    agenda: list[Any] = []
    minutes_text: Optional[str] = None
    minutes_file_url: Optional[str] = None
    attendees: list[Any] = []
    quorum_met: Optional[bool] = None
    status: str = "scheduled"
    created_at: Optional[datetime] = None


class MinutesUpload(BaseModel):
    """Upload minutes for a meeting."""

    minutes_text: Optional[str] = None
    minutes_file_url: Optional[str] = None
    attendees: list[dict[str, Any]] = []
    quorum_met: bool = False


# ---------------------------------------------------------------------------
# Action Item schemas
# ---------------------------------------------------------------------------

class ActionItemCreate(BaseModel):
    """Create a committee action item."""

    title: str = Field(..., max_length=255)
    description: Optional[str] = None
    assigned_to: Optional[UUID] = None
    assigned_to_name: Optional[str] = Field(None, max_length=255)
    due_date: Optional[datetime] = None


class ActionItemUpdate(BaseModel):
    """Update a committee action item."""

    status: Optional[str] = Field(None, pattern="^(pending|in_progress|completed|overdue)$")
    notes: Optional[str] = None
    completed_at: Optional[datetime] = None


class ActionItemResponse(BaseModel):
    """Action item response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    committee_id: UUID
    meeting_id: UUID
    title: str
    description: Optional[str] = None
    assigned_to: Optional[UUID] = None
    assigned_to_name: Optional[str] = None
    due_date: Optional[datetime] = None
    status: str = "pending"
    completed_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
