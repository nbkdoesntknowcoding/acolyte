"""Dynamic roles and committee tables.

Revision ID: j4k5l6m7n8o9
Revises: i3j4k5l6m7n8
Create Date: 2026-02-13

Creates:
- dynamic_role_assignments: Time-bound context-specific role grants
- committee_meetings: Committee meeting records with agenda/minutes
- committee_action_items: Action items from committee meetings

All tables are tenant-scoped with RLS on college_id.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

# revision identifiers, used by Alembic.
revision = "j4k5l6m7n8o9"
down_revision = "i3j4k5l6m7n8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- dynamic_role_assignments ---
    op.create_table(
        "dynamic_role_assignments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("college_id", UUID(as_uuid=True), sa.ForeignKey("colleges.id"), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        # Target user
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("user_type", sa.String(20), nullable=False, server_default="faculty"),
        sa.Column("user_name", sa.String(255)),
        # Role
        sa.Column("role_type", sa.String(50), nullable=False),
        # Context
        sa.Column("context_type", sa.String(30), nullable=False),
        sa.Column("context_id", UUID(as_uuid=True), nullable=False),
        sa.Column("context_name", sa.String(255)),
        # Validity
        sa.Column("valid_from", sa.Date, nullable=False),
        sa.Column("valid_until", sa.Date),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("auto_deactivate", sa.Boolean, server_default="true"),
        # Audit
        sa.Column("assigned_by", UUID(as_uuid=True)),
        sa.Column("assigned_by_name", sa.String(255)),
        sa.Column("assignment_order_url", sa.String(500)),
        sa.Column("notes", sa.Text),
        # Permissions
        sa.Column("permissions", JSONB, server_default="[]", nullable=False),
        # Constraints
        sa.UniqueConstraint("college_id", "user_id", "role_type", "context_id", name="uq_dynamic_role_user_context"),
    )
    op.create_index("ix_dynamic_role_user_id", "dynamic_role_assignments", ["user_id"])
    op.create_index("ix_dynamic_role_role_type", "dynamic_role_assignments", ["role_type"])
    op.create_index("ix_dynamic_role_college_user_active", "dynamic_role_assignments", ["college_id", "user_id", "is_active"])
    op.create_index("ix_dynamic_role_college_context", "dynamic_role_assignments", ["college_id", "context_type", "context_id"])

    # --- committee_meetings ---
    op.create_table(
        "committee_meetings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("college_id", UUID(as_uuid=True), sa.ForeignKey("colleges.id"), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("committee_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("meeting_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("location", sa.String(255)),
        sa.Column("agenda", JSONB, server_default="[]", nullable=False),
        sa.Column("minutes_text", sa.Text),
        sa.Column("minutes_file_url", sa.String(500)),
        sa.Column("minutes_filed_by", UUID(as_uuid=True)),
        sa.Column("minutes_filed_at", sa.DateTime(timezone=True)),
        sa.Column("attendees", JSONB, server_default="[]", nullable=False),
        sa.Column("quorum_met", sa.Boolean),
        sa.Column("status", sa.String(20), server_default="scheduled", nullable=False),
    )
    op.create_index("ix_committee_meeting_college_committee", "committee_meetings", ["college_id", "committee_id"])

    # --- committee_action_items ---
    op.create_table(
        "committee_action_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("college_id", UUID(as_uuid=True), sa.ForeignKey("colleges.id"), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("committee_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("meeting_id", UUID(as_uuid=True), sa.ForeignKey("committee_meetings.id"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("assigned_to", UUID(as_uuid=True)),
        sa.Column("assigned_to_name", sa.String(255)),
        sa.Column("due_date", sa.DateTime(timezone=True)),
        sa.Column("status", sa.String(20), server_default="pending", nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("notes", sa.Text),
    )
    op.create_index("ix_action_item_college_committee", "committee_action_items", ["college_id", "committee_id"])

    # --- RLS policies ---
    for table_name in ["dynamic_role_assignments", "committee_meetings", "committee_action_items"]:
        op.execute(f"ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY")
        op.execute(f"""
            CREATE POLICY tenant_isolation_{table_name} ON {table_name}
            USING (college_id = NULLIF(current_setting('app.current_college_id', true), '')::uuid)
        """)
        op.execute(f"""
            CREATE POLICY tenant_insert_{table_name} ON {table_name}
            FOR INSERT
            WITH CHECK (college_id = NULLIF(current_setting('app.current_college_id', true), '')::uuid)
        """)


def downgrade() -> None:
    for table_name in ["committee_action_items", "committee_meetings", "dynamic_role_assignments"]:
        op.execute(f"DROP POLICY IF EXISTS tenant_insert_{table_name} ON {table_name}")
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation_{table_name} ON {table_name}")
        op.execute(f"ALTER TABLE {table_name} DISABLE ROW LEVEL SECURITY")

    op.drop_table("committee_action_items")
    op.drop_table("committee_meetings")
    op.drop_table("dynamic_role_assignments")
