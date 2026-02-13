"""device_trust_tables

Revision ID: h2i3j4k5l6m7
Revises: g1h2i3j4k5l6
Create Date: 2026-02-13

Creates 3 platform-level tables for AQP Device Trust Security Layer:
1. device_trusts — Device registration and trust management
2. device_transfer_requests — Self-service phone change tracking
3. device_reset_logs — Admin-initiated reset audit trail

These tables are NOT tenant-scoped (no college_id, no RLS).
A user's device exists outside any single college context.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic
revision: str = "h2i3j4k5l6m7"
down_revision: Union[str, None] = "g1h2i3j4k5l6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── device_trusts ──
    op.create_table(
        "device_trusts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        # Device Identification
        sa.Column("device_fingerprint", sa.String(64), nullable=False),
        sa.Column("platform", sa.String(10), nullable=False),
        sa.Column("device_id", sa.String(100), nullable=False),
        sa.Column("device_model", sa.String(100)),
        sa.Column("device_manufacturer", sa.String(100)),
        sa.Column("os_version", sa.String(20)),
        sa.Column("app_version", sa.String(20)),
        sa.Column("screen_width", sa.Integer),
        sa.Column("screen_height", sa.Integer),
        sa.Column("ram_mb", sa.Integer),
        sa.Column("sim_operator", sa.String(50)),
        sa.Column("sim_country", sa.String(5)),
        # Phone Verification
        sa.Column("claimed_phone", sa.String(15), nullable=False),
        sa.Column("verified_phone", sa.String(15)),
        sa.Column("phone_verified_at", sa.DateTime(timezone=True)),
        sa.Column("verification_code_hash", sa.String(64)),
        sa.Column("verification_code_expires_at", sa.DateTime(timezone=True)),
        sa.Column("sms_verified", sa.Boolean, default=False),
        sa.Column("sms_gateway_message_id", sa.String(100)),
        # Trust Token
        sa.Column("device_trust_token_hash", sa.String(64)),
        sa.Column("token_issued_at", sa.DateTime(timezone=True)),
        sa.Column("token_expires_at", sa.DateTime(timezone=True)),
        # Status
        sa.Column(
            "status",
            sa.String(30),
            default="pending_sms_verification",
        ),
        # Revocation
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
        sa.Column("revoked_by", postgresql.UUID(as_uuid=True)),
        sa.Column("revoke_reason", sa.String(100)),
        # Activity
        sa.Column("last_active_at", sa.DateTime(timezone=True)),
        sa.Column("total_qr_scans", sa.Integer, default=0),
        sa.Column("last_qr_scan_at", sa.DateTime(timezone=True)),
        # Timestamps
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
        ),
    )

    # Indexes for device_trusts
    op.create_index("ix_device_trusts_user_id", "device_trusts", ["user_id"])
    op.create_index("ix_device_trusts_status", "device_trusts", ["status"])

    # CRITICAL: Unique partial index — ONE active device per user
    op.execute(
        """
        CREATE UNIQUE INDEX ix_device_trust_user_active
        ON device_trusts (user_id)
        WHERE status = 'active'
        """
    )

    # Fast SMS webhook matching
    op.create_index(
        "ix_device_trust_phone_pending",
        "device_trusts",
        ["claimed_phone", "status"],
    )

    # ── device_transfer_requests ──
    op.create_table(
        "device_transfer_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "old_device_trust_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("device_trusts.id"),
            nullable=False,
        ),
        sa.Column("transfer_code_hash", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(20), default="pending"),
        sa.Column(
            "new_device_trust_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("device_trusts.id"),
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
        ),
    )

    # ── device_reset_logs ──
    op.create_table(
        "device_reset_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "device_trust_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("device_trusts.id"),
            nullable=False,
        ),
        sa.Column("reset_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reset_reason", sa.String(100), nullable=False),
        sa.Column("admin_notes", sa.Text),
        sa.Column(
            "reset_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
        ),
    )

    op.create_index("ix_device_reset_logs_user_id", "device_reset_logs", ["user_id"])

    # NO RLS policies — these are platform-level tables


def downgrade() -> None:
    op.drop_table("device_reset_logs")
    op.drop_table("device_transfer_requests")
    op.drop_index("ix_device_trust_user_active", table_name="device_trusts")
    op.drop_index("ix_device_trust_phone_pending", table_name="device_trusts")
    op.drop_index("ix_device_trusts_status", table_name="device_trusts")
    op.drop_index("ix_device_trusts_user_id", table_name="device_trusts")
    op.drop_table("device_trusts")
