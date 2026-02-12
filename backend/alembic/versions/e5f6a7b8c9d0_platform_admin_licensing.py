"""platform_admin_licensing

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-02-11 21:00:00.000000

Creates 5 platform-level tables for B2B licensing and operations:
1. licenses                  — B2B college license (plan, features, billing)
2. license_usage_snapshots   — Daily usage metrics per license
3. platform_audit_log        — Platform admin audit trail
4. system_health_metrics     — System health & performance metrics
5. platform_alerts           — Platform operational alerts

All tables are NOT tenant-scoped (no college_id RLS).
Managed exclusively by Acolyte platform admins.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 1. licenses — B2B college license (NOT tenant-scoped)
    # ------------------------------------------------------------------
    op.create_table('licenses',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('college_id', sa.UUID(), nullable=False),
        sa.Column('plan_tier', sa.String(length=30), nullable=False),
        sa.Column('plan_name', sa.String(length=100), nullable=False),
        sa.Column('enabled_engines', postgresql.JSONB(astext_type=sa.Text()),
                   server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column('enabled_features', postgresql.JSONB(astext_type=sa.Text()),
                   server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column('max_students', sa.Integer(), nullable=False),
        sa.Column('max_faculty', sa.Integer(), nullable=False),
        sa.Column('max_storage_gb', sa.Float(), nullable=False),
        sa.Column('monthly_ai_token_budget', sa.Integer(), nullable=False),
        sa.Column('billing_cycle', sa.String(length=20), server_default='annual', nullable=False),
        sa.Column('price_inr', sa.Integer(), nullable=True),
        sa.Column('billing_email', sa.String(length=255), nullable=True),
        sa.Column('razorpay_subscription_id', sa.String(length=100), nullable=True),
        sa.Column('status', sa.String(length=20), server_default='active', nullable=False),
        sa.Column('activated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('suspended_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('suspension_reason', sa.String(length=500), nullable=True),
        sa.Column('sales_contact', sa.String(length=255), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True),
                   server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True),
                   server_default=sa.text('NOW()'), nullable=False),
        sa.Column('created_by', sa.UUID(), nullable=True),
        sa.ForeignKeyConstraint(['college_id'], ['colleges.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('college_id'),
    )
    op.create_index('ix_lic_college_id', 'licenses', ['college_id'], unique=True)
    op.create_index('ix_lic_status', 'licenses', ['status'])
    op.create_index('ix_lic_plan_status', 'licenses', ['plan_tier', 'status'])
    op.create_index('ix_lic_expires', 'licenses', ['expires_at'])

    # ------------------------------------------------------------------
    # 2. license_usage_snapshots — daily usage per license (NOT tenant-scoped)
    # ------------------------------------------------------------------
    op.create_table('license_usage_snapshots',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('license_id', sa.UUID(), nullable=False),
        sa.Column('snapshot_date', sa.Date(), nullable=False),
        sa.Column('active_students', sa.Integer(), server_default=sa.text('0'), nullable=False),
        sa.Column('active_faculty', sa.Integer(), server_default=sa.text('0'), nullable=False),
        sa.Column('total_users', sa.Integer(), server_default=sa.text('0'), nullable=False),
        sa.Column('ai_tokens_used', sa.Integer(), server_default=sa.text('0'), nullable=False),
        sa.Column('ai_tokens_month_to_date', sa.Integer(),
                   server_default=sa.text('0'), nullable=False),
        sa.Column('ai_requests_count', sa.Integer(), server_default=sa.text('0'), nullable=False),
        sa.Column('storage_used_gb', sa.Float(), server_default=sa.text('0'), nullable=False),
        sa.Column('api_requests_count', sa.Integer(), server_default=sa.text('0'), nullable=False),
        sa.Column('feature_usage', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True),
                   server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['license_id'], ['licenses.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('license_id', 'snapshot_date',
                            name='uq_license_usage_snapshot'),
    )
    op.create_index('ix_lus_license_date', 'license_usage_snapshots',
                     ['license_id', 'snapshot_date'])

    # ------------------------------------------------------------------
    # 3. platform_audit_log — platform admin actions (NOT tenant-scoped)
    # ------------------------------------------------------------------
    op.create_table('platform_audit_log',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('actor_id', sa.UUID(), nullable=False),
        sa.Column('actor_email', sa.String(length=255), nullable=True),
        sa.Column('action', sa.String(length=50), nullable=False),
        sa.Column('entity_type', sa.String(length=50), nullable=False),
        sa.Column('entity_id', sa.UUID(), nullable=True),
        sa.Column('changes', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True),
                   server_default=sa.text('NOW()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_pal_actor_created', 'platform_audit_log',
                     ['actor_id', 'created_at'])
    op.create_index('ix_pal_action_created', 'platform_audit_log',
                     ['action', 'created_at'])
    op.create_index('ix_pal_entity', 'platform_audit_log',
                     ['entity_type', 'entity_id'])

    # ------------------------------------------------------------------
    # 4. system_health_metrics — system health tracking (NOT tenant-scoped)
    # ------------------------------------------------------------------
    op.create_table('system_health_metrics',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('component', sa.String(length=50), nullable=False),
        sa.Column('metric_name', sa.String(length=100), nullable=False),
        sa.Column('value', sa.Float(), nullable=False),
        sa.Column('unit', sa.String(length=20), nullable=True),
        sa.Column('status', sa.String(length=20), server_default='healthy', nullable=False),
        sa.Column('details', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('recorded_at', sa.DateTime(timezone=True),
                   server_default=sa.text('NOW()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_shm_component_recorded', 'system_health_metrics',
                     ['component', 'recorded_at'])
    op.create_index('ix_shm_status', 'system_health_metrics', ['status'])

    # ------------------------------------------------------------------
    # 5. platform_alerts — operational alerts (NOT tenant-scoped)
    # ------------------------------------------------------------------
    op.create_table('platform_alerts',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('severity', sa.String(length=10), nullable=False),
        sa.Column('category', sa.String(length=50), nullable=False),
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('details', sa.Text(), nullable=False),
        sa.Column('college_id', sa.UUID(), nullable=True),
        sa.Column('license_id', sa.UUID(), nullable=True),
        sa.Column('source_component', sa.String(length=50), nullable=True),
        sa.Column('trigger_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('status', sa.String(length=20), server_default='active', nullable=False),
        sa.Column('acknowledged_by', sa.UUID(), nullable=True),
        sa.Column('acknowledged_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolved_by', sa.UUID(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolution_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True),
                   server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['license_id'], ['licenses.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_pa_severity_status', 'platform_alerts',
                     ['severity', 'status'])
    op.create_index('ix_pa_category_status', 'platform_alerts',
                     ['category', 'status'])
    op.create_index('ix_pa_created', 'platform_alerts', ['created_at'])


def downgrade() -> None:
    # Drop in reverse order
    op.drop_index('ix_pa_created', table_name='platform_alerts')
    op.drop_index('ix_pa_category_status', table_name='platform_alerts')
    op.drop_index('ix_pa_severity_status', table_name='platform_alerts')
    op.drop_table('platform_alerts')

    op.drop_index('ix_shm_status', table_name='system_health_metrics')
    op.drop_index('ix_shm_component_recorded', table_name='system_health_metrics')
    op.drop_table('system_health_metrics')

    op.drop_index('ix_pal_entity', table_name='platform_audit_log')
    op.drop_index('ix_pal_action_created', table_name='platform_audit_log')
    op.drop_index('ix_pal_actor_created', table_name='platform_audit_log')
    op.drop_table('platform_audit_log')

    op.drop_index('ix_lus_license_date', table_name='license_usage_snapshots')
    op.drop_table('license_usage_snapshots')

    op.drop_index('ix_lic_expires', table_name='licenses')
    op.drop_index('ix_lic_plan_status', table_name='licenses')
    op.drop_index('ix_lic_status', table_name='licenses')
    op.drop_index('ix_lic_college_id', table_name='licenses')
    op.drop_table('licenses')
