"""compliance_framework

Revision ID: a1b2c3d4e5f6
Revises: fae6b3adbf61
Create Date: 2026-02-11 18:00:00.000000

Creates 3 tables for the compliance monitoring framework:
1. compliance_standards       — Rule-agnostic standard definitions (NOT tenant-scoped)
2. compliance_alerts          — Per-college compliance alerts (tenant-scoped)
3. compliance_check_snapshots — Point-in-time evaluation snapshots (tenant-scoped)

RLS policies on tenant-scoped tables (compliance_alerts, compliance_check_snapshots).
compliance_standards is platform-wide (like nmc_standards) — no RLS.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'fae6b3adbf61'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Tenant-scoped compliance tables that need RLS policies
COMPLIANCE_TENANT_TABLES = [
    "compliance_alerts",
    "compliance_check_snapshots",
]


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 1. compliance_standards (NOT tenant-scoped — platform-wide rules)
    # ------------------------------------------------------------------
    op.create_table('compliance_standards',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('standard_code', sa.String(length=50), nullable=False),
        sa.Column('category', sa.String(length=50), nullable=False),
        sa.Column('subcategory', sa.String(length=50), nullable=True),
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('data_source', sa.String(length=100), nullable=False),
        sa.Column('data_query_config', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('threshold_type', sa.String(length=30), nullable=False),
        sa.Column('threshold_value', sa.String(length=100), nullable=False),
        sa.Column('comparison_operator', sa.String(length=5), server_default='gte', nullable=False),
        sa.Column('buffer_warning_pct', sa.Float(), server_default=sa.text('10.0'), nullable=False),
        sa.Column('severity_if_breached', sa.String(length=30), nullable=False),
        sa.Column('regulatory_body', sa.String(length=20), nullable=False),
        sa.Column('source_document', sa.String(length=500), nullable=True),
        sa.Column('effective_from', sa.Date(), nullable=True),
        sa.Column('effective_until', sa.Date(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('priority', sa.Integer(), server_default=sa.text('5'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('created_by', sa.UUID(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('standard_code'),
    )
    op.create_index('ix_cs_category_active', 'compliance_standards', ['category', 'is_active'], unique=False)
    op.create_index('ix_cs_regulatory_active', 'compliance_standards', ['regulatory_body', 'is_active'], unique=False)

    # ------------------------------------------------------------------
    # 2. compliance_alerts (tenant-scoped)
    # ------------------------------------------------------------------
    op.create_table('compliance_alerts',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('college_id', sa.UUID(), nullable=False),
        sa.Column('execution_id', sa.UUID(), nullable=True),
        sa.Column('standard_id', sa.UUID(), nullable=True),
        sa.Column('severity', sa.String(length=10), nullable=False),
        sa.Column('category', sa.String(length=50), nullable=False),
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('details', sa.Text(), nullable=False),
        sa.Column('current_value', sa.String(length=100), nullable=True),
        sa.Column('threshold_value', sa.String(length=100), nullable=True),
        sa.Column('gap_description', sa.String(length=500), nullable=True),
        sa.Column('recommended_action', sa.Text(), nullable=True),
        sa.Column('deadline', sa.Date(), nullable=True),
        sa.Column('auto_escalation_date', sa.Date(), nullable=True),
        sa.Column('status', sa.String(length=20), server_default='active', nullable=False),
        sa.Column('acknowledged_by', sa.UUID(), nullable=True),
        sa.Column('acknowledged_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolved_by', sa.UUID(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolution_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['college_id'], ['colleges.id'], ),
        sa.ForeignKeyConstraint(['execution_id'], ['agent_executions.id'], ),
        sa.ForeignKeyConstraint(['standard_id'], ['compliance_standards.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_compliance_alerts_college_id'), 'compliance_alerts', ['college_id'], unique=False)
    op.create_index('ix_ca_college_severity_status', 'compliance_alerts', ['college_id', 'severity', 'status'], unique=False)
    op.create_index('ix_ca_college_standard_status', 'compliance_alerts', ['college_id', 'standard_id', 'status'], unique=False)
    op.create_index('ix_ca_college_created', 'compliance_alerts', ['college_id', 'created_at'], unique=False)

    # ------------------------------------------------------------------
    # 3. compliance_check_snapshots (tenant-scoped)
    # ------------------------------------------------------------------
    op.create_table('compliance_check_snapshots',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('college_id', sa.UUID(), nullable=False),
        sa.Column('snapshot_date', sa.Date(), nullable=False),
        sa.Column('snapshot_type', sa.String(length=20), nullable=False),
        sa.Column('overall_status', sa.String(length=10), nullable=False),
        sa.Column('standards_checked', sa.Integer(), server_default=sa.text('0'), nullable=False),
        sa.Column('standards_compliant', sa.Integer(), server_default=sa.text('0'), nullable=False),
        sa.Column('standards_at_risk', sa.Integer(), server_default=sa.text('0'), nullable=False),
        sa.Column('standards_breached', sa.Integer(), server_default=sa.text('0'), nullable=False),
        sa.Column('department_statuses', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('check_results', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('data_gaps', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('approved_by', sa.UUID(), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['college_id'], ['colleges.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('college_id', 'snapshot_date', 'snapshot_type', name='uq_compliance_check_snapshot'),
    )
    op.create_index(op.f('ix_compliance_check_snapshots_college_id'), 'compliance_check_snapshots', ['college_id'], unique=False)

    # ------------------------------------------------------------------
    # RLS policies for tenant-scoped compliance tables
    # ------------------------------------------------------------------
    for table in COMPLIANCE_TENANT_TABLES:
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
    for table in reversed(COMPLIANCE_TENANT_TABLES):
        op.execute(f"DROP POLICY IF EXISTS superadmin_bypass_policy ON {table}")
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation_policy ON {table}")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")

    # ------------------------------------------------------------------
    # Drop tables in reverse dependency order
    # ------------------------------------------------------------------
    op.drop_index(op.f('ix_compliance_check_snapshots_college_id'), table_name='compliance_check_snapshots')
    op.drop_table('compliance_check_snapshots')

    op.drop_index('ix_ca_college_created', table_name='compliance_alerts')
    op.drop_index('ix_ca_college_standard_status', table_name='compliance_alerts')
    op.drop_index('ix_ca_college_severity_status', table_name='compliance_alerts')
    op.drop_index(op.f('ix_compliance_alerts_college_id'), table_name='compliance_alerts')
    op.drop_table('compliance_alerts')

    op.drop_index('ix_cs_regulatory_active', table_name='compliance_standards')
    op.drop_index('ix_cs_category_active', table_name='compliance_standards')
    op.drop_table('compliance_standards')
