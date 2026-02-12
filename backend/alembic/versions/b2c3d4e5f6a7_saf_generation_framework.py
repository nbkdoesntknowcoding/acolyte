"""saf_generation_framework

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-02-11 20:00:00.000000

Creates 2 tables for the SAF auto-generation framework (C2):
1. saf_templates              — Form structure definitions (NOT tenant-scoped)
2. compliance_document_drafts — Generated document drafts (tenant-scoped)

RLS policy on compliance_document_drafts only.
saf_templates is platform-wide (like compliance_standards) — no RLS.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Tenant-scoped tables that need RLS policies
SAF_TENANT_TABLES = [
    "compliance_document_drafts",
]


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 1. saf_templates (NOT tenant-scoped — platform-wide form definitions)
    # ------------------------------------------------------------------
    op.create_table('saf_templates',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('template_code', sa.String(length=50), nullable=False),
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('regulatory_body', sa.String(length=20), nullable=False),
        sa.Column('version', sa.Integer(), server_default=sa.text('1'), nullable=False),
        sa.Column('sections', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_by', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('template_code'),
    )
    op.create_index('ix_saf_tpl_body_active', 'saf_templates', ['regulatory_body', 'is_active'], unique=False)

    # ------------------------------------------------------------------
    # 2. compliance_document_drafts (tenant-scoped)
    # ------------------------------------------------------------------
    op.create_table('compliance_document_drafts',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('college_id', sa.UUID(), nullable=False),
        sa.Column('template_id', sa.UUID(), nullable=False),
        sa.Column('academic_year', sa.String(length=20), nullable=True),
        sa.Column('status', sa.String(length=20), server_default='generating', nullable=False),
        sa.Column('filled_data', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column('data_gaps', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('auto_fill_percentage', sa.Float(), nullable=True),
        sa.Column('narrative_sections', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('review_comments', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('generated_by', sa.UUID(), nullable=False),
        sa.Column('generated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('approved_by', sa.UUID(), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('execution_id', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['college_id'], ['colleges.id'], ),
        sa.ForeignKeyConstraint(['template_id'], ['saf_templates.id'], ),
        sa.ForeignKeyConstraint(['execution_id'], ['agent_executions.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_compliance_document_drafts_college_id'), 'compliance_document_drafts', ['college_id'], unique=False)
    op.create_index('ix_cdd_college_template_status', 'compliance_document_drafts', ['college_id', 'template_id', 'status'], unique=False)

    # ------------------------------------------------------------------
    # RLS policies for tenant-scoped tables
    # ------------------------------------------------------------------
    for table in SAF_TENANT_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(f"""
            CREATE POLICY tenant_isolation_policy ON {table}
                USING (
                    college_id = NULLIF(current_setting('app.current_college_id', true), '')::uuid
                )
        """)
        op.execute(f"""
            CREATE POLICY superadmin_bypass_policy ON {table}
                USING (
                    current_setting('app.is_superadmin', true) = 'true'
                )
        """)


def downgrade() -> None:
    # ------------------------------------------------------------------
    # Drop RLS policies
    # ------------------------------------------------------------------
    for table in reversed(SAF_TENANT_TABLES):
        op.execute(f"DROP POLICY IF EXISTS superadmin_bypass_policy ON {table}")
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation_policy ON {table}")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")

    # ------------------------------------------------------------------
    # Drop tables in reverse dependency order
    # ------------------------------------------------------------------
    op.drop_index('ix_cdd_college_template_status', table_name='compliance_document_drafts')
    op.drop_index(op.f('ix_compliance_document_drafts_college_id'), table_name='compliance_document_drafts')
    op.drop_table('compliance_document_drafts')

    op.drop_index('ix_saf_tpl_body_active', table_name='saf_templates')
    op.drop_table('saf_templates')
