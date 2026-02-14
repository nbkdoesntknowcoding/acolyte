"""Dynamic Role Assignment model — tenant-scoped role grants.

Supports time-bound, context-specific role assignments (e.g., exam controller
for a specific exam period, hostel warden for a building, committee chair).

Each role assignment has:
- A target user (user_id + user_type)
- A role type (exam_controller, warden, committee_chair, etc.)
- A context (what entity the role applies to — committee, batch, building, etc.)
- Validity dates (auto-deactivation when valid_until passes)
- Audit fields (who assigned, order URL, notes)
"""

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    Index,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID

from .base import TenantModel


class DynamicRoleAssignment(TenantModel):
    """Time-bound role assignment within a specific context.

    Examples:
    - Exam Controller for MBBS Phase 2 (Jan-Mar 2026)
    - Hostel Warden for Block A (2025-2026 academic year)
    - Committee Chair for Anti-Ragging Committee (permanent until removed)
    - Batch Mentor for Batch 2023 (entire program duration)
    """

    __tablename__ = "dynamic_role_assignments"

    # Target user
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    user_type = Column(String(20), nullable=False, default="faculty")
    user_name = Column(String(255))

    # Role definition
    role_type = Column(String(50), nullable=False, index=True)

    # Context — what entity this role applies to
    context_type = Column(String(30), nullable=False)  # "committee", "batch", "building", "exam", "department"
    context_id = Column(UUID(as_uuid=True), nullable=False)
    context_name = Column(String(255))

    # Validity
    valid_from = Column(Date, nullable=False)
    valid_until = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True, server_default="true")
    auto_deactivate = Column(Boolean, default=True, server_default="true")

    # Audit
    assigned_by = Column(UUID(as_uuid=True))
    assigned_by_name = Column(String(255))
    assignment_order_url = Column(String(500))
    notes = Column(Text)

    # Permissions granted by this role
    permissions = Column(JSONB, server_default="[]", nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "college_id", "user_id", "role_type", "context_id",
            name="uq_dynamic_role_user_context",
        ),
        Index(
            "ix_dynamic_role_college_user_active",
            "college_id", "user_id", "is_active",
        ),
        Index(
            "ix_dynamic_role_college_context",
            "college_id", "context_type", "context_id",
        ),
    )
