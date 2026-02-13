"""qr_engine_tables

Revision ID: i3j4k5l6m7n8
Revises: h2i3j4k5l6m7
Create Date: 2026-02-13

Creates 2 tenant-scoped tables for the AQP QR Engine:
1. qr_action_points — Configurable QR action locations
2. qr_scan_logs — Immutable, append-only scan audit log

Both tables are tenant-scoped with RLS on college_id.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "i3j4k5l6m7n8"
down_revision: Union[str, None] = "h2i3j4k5l6m7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. qr_action_points ──
    op.create_table(
        "qr_action_points",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "college_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("colleges.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("action_type", sa.String(30), nullable=False, index=True),
        sa.Column("location_code", sa.String(50), nullable=False),
        sa.Column("qr_mode", sa.String(10), nullable=False),
        sa.Column("building", sa.String(100)),
        sa.Column("floor", sa.Integer),
        sa.Column("gps_latitude", sa.Float),
        sa.Column("gps_longitude", sa.Float),
        sa.Column("geo_radius_meters", sa.Integer, server_default="100"),
        sa.Column("qr_rotation_minutes", sa.Integer, server_default="0"),
        sa.Column("qr_secret", sa.String(64)),
        sa.Column("duplicate_window_minutes", sa.Integer, server_default="30"),
        sa.Column("linked_entity_type", sa.String(30)),
        sa.Column("linked_entity_id", postgresql.UUID(as_uuid=True)),
        sa.Column("security_level", sa.String(20), server_default="standard"),
        sa.Column(
            "scanner_device_trust_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("device_trusts.id"),
        ),
        sa.Column("active_hours_start", sa.String(5)),
        sa.Column("active_hours_end", sa.String(5)),
        sa.Column("active_days", postgresql.JSONB, server_default="[0,1,2,3,4,5]"),
        sa.Column("metadata", postgresql.JSONB, server_default="{}"),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        # Constraints
        sa.UniqueConstraint("college_id", "location_code", name="uq_action_point_location"),
    )

    # Composite index for action type queries
    op.create_index(
        "ix_action_point_type",
        "qr_action_points",
        ["college_id", "action_type"],
    )

    # ── 2. qr_scan_logs ──
    op.create_table(
        "qr_scan_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "college_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("colleges.id"),
            nullable=False,
            index=True,
        ),
        # Who
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("user_type", sa.String(10)),
        sa.Column(
            "device_trust_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("device_trusts.id"),
        ),
        # What
        sa.Column("action_type", sa.String(30), nullable=False, index=True),
        sa.Column(
            "action_point_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("qr_action_points.id"),
        ),
        sa.Column("qr_mode", sa.String(10)),
        # Context
        sa.Column("entity_type", sa.String(30)),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True)),
        sa.Column("metadata", postgresql.JSONB, server_default="{}"),
        # Location
        sa.Column("scan_latitude", sa.Float),
        sa.Column("scan_longitude", sa.Float),
        sa.Column("geo_validated", sa.Boolean),
        # Validation
        sa.Column("device_validated", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("biometric_confirmed", sa.Boolean, server_default="false"),
        sa.Column("validation_result", sa.String(20), nullable=False),
        sa.Column("rejection_reason", sa.Text),
        # Timestamp
        sa.Column("scanned_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
    )

    # Composite indexes for efficient querying
    op.create_index(
        "ix_scan_log_user_action_time",
        "qr_scan_logs",
        ["college_id", "user_id", "action_type", "scanned_at"],
    )
    op.create_index(
        "ix_scan_log_action_point_time",
        "qr_scan_logs",
        ["college_id", "action_point_id", "scanned_at"],
    )

    # ── 3. RLS policies (tenant-scoped tables) ──
    op.execute("ALTER TABLE qr_action_points ENABLE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON qr_action_points
            USING (college_id = NULLIF(current_setting('app.current_college_id', true), '')::uuid)
        """
    )

    op.execute("ALTER TABLE qr_scan_logs ENABLE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON qr_scan_logs
            USING (college_id = NULLIF(current_setting('app.current_college_id', true), '')::uuid)
        """
    )


def downgrade() -> None:
    # Drop RLS policies first
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON qr_scan_logs")
    op.execute("ALTER TABLE qr_scan_logs DISABLE ROW LEVEL SECURITY")

    op.execute("DROP POLICY IF EXISTS tenant_isolation ON qr_action_points")
    op.execute("ALTER TABLE qr_action_points DISABLE ROW LEVEL SECURITY")

    # Drop indexes
    op.drop_index("ix_scan_log_action_point_time", table_name="qr_scan_logs")
    op.drop_index("ix_scan_log_user_action_time", table_name="qr_scan_logs")
    op.drop_index("ix_action_point_type", table_name="qr_action_points")

    # Drop tables (scan_logs first due to FK)
    op.drop_table("qr_scan_logs")
    op.drop_table("qr_action_points")
