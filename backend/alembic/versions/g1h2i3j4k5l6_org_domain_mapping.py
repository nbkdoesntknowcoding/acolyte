"""org_domain_mapping

Revision ID: g1h2i3j4k5l6
Revises: f1a2b3c4d5e6
Create Date: 2026-02-13

Adds clerk_org_id and allowed_domains columns to colleges table
for mapping Clerk organizations to internal college UUIDs and
enabling domain-based auto-assignment.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "g1h2i3j4k5l6"
down_revision: Union[str, None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "colleges",
        sa.Column("clerk_org_id", sa.String(length=255), nullable=True,
                  comment="Clerk organization ID (org_xxx)"),
    )
    op.add_column(
        "colleges",
        sa.Column(
            "allowed_domains",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="[]",
            nullable=False,
            comment="Email domains that auto-join this org",
        ),
    )
    op.create_unique_constraint(
        "uq_colleges_clerk_org_id", "colleges", ["clerk_org_id"]
    )
    op.create_index(
        "ix_colleges_clerk_org_id", "colleges", ["clerk_org_id"], unique=True
    )


def downgrade() -> None:
    op.drop_index("ix_colleges_clerk_org_id", table_name="colleges")
    op.drop_constraint("uq_colleges_clerk_org_id", "colleges", type_="unique")
    op.drop_column("colleges", "allowed_domains")
    op.drop_column("colleges", "clerk_org_id")
