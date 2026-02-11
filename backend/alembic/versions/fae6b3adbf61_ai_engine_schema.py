"""ai_engine_schema

Revision ID: fae6b3adbf61
Revises: 3696b80274cf
Create Date: 2026-02-11 10:00:48.709246

Creates 11 tables for the Central AI Engine:
1.  prompt_templates              — Versioned prompt storage (L6)
2.  agent_executions              — AI operation audit trail (L5)
3.  agent_feedback                — Human corrections
4.  ai_budgets                    — Per-college monthly budgets (L5)
5.  medical_content               — RAG knowledge base + embeddings (L1)
6.  medical_entities              — Knowledge graph nodes (L1 Layer 3)
7.  medical_entity_relationships  — Knowledge graph edges (L1 Layer 3)
8.  question_intelligence_patterns — Faculty question patterns (L4)
9.  safety_checks                 — Medical content validation audit (L3)
10. metacognitive_events          — Raw student interaction events (S8)
11. student_metacognitive_profiles — Computed per-student metrics

Manual additions beyond autogenerate:
- pgvector Vector column type import
- search_vector tsvector generated column on medical_content
- IVFFlat index on medical_content.embedding
- GIN index on medical_content.search_vector
- GIN index on medical_content.metadata
- RLS policies on all tenant-scoped tables
"""
from typing import Sequence, Union

from alembic import op
import pgvector.sqlalchemy
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'fae6b3adbf61'
down_revision: Union[str, None] = '3696b80274cf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Tenant-scoped AI tables that need RLS policies
AI_TENANT_TABLES = [
    "agent_executions",
    "agent_feedback",
    "ai_budgets",
    "metacognitive_events",
    "question_intelligence_patterns",
    "safety_checks",
    "student_metacognitive_profiles",
]


def upgrade() -> None:
    # ------------------------------------------------------------------
    # Ensure pgvector extension exists (idempotent)
    # ------------------------------------------------------------------
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # ------------------------------------------------------------------
    # 1. medical_entities (no FK deps — create first)
    # ------------------------------------------------------------------
    op.create_table('medical_entities',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('entity_type', sa.String(length=30), nullable=False),
    sa.Column('name', sa.String(length=500), nullable=False),
    sa.Column('aliases', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('properties', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('embedding', pgvector.sqlalchemy.Vector(dim=1536), nullable=True),
    sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('entity_type', 'name', name='uq_entity_type_name')
    )
    op.create_index('ix_entity_type_active', 'medical_entities', ['entity_type', 'is_active'], unique=False)

    # ------------------------------------------------------------------
    # 2. ai_budgets (FK → colleges only)
    # ------------------------------------------------------------------
    op.create_table('ai_budgets',
    sa.Column('period_start', sa.Date(), nullable=False),
    sa.Column('period_end', sa.Date(), nullable=False),
    sa.Column('budget_type', sa.String(length=20), nullable=False),
    sa.Column('total_budget_usd', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('used_amount_usd', sa.Numeric(precision=10, scale=6), nullable=False),
    sa.Column('token_count_input', sa.BigInteger(), nullable=False),
    sa.Column('token_count_output', sa.BigInteger(), nullable=False),
    sa.Column('token_count_cached', sa.BigInteger(), nullable=False),
    sa.Column('engine_breakdown', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('budget_status', sa.String(length=20), nullable=False),
    sa.Column('warning_threshold_pct', sa.Integer(), nullable=False),
    sa.Column('throttled_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('college_id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
    sa.ForeignKeyConstraint(['college_id'], ['colleges.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('college_id', 'period_start', 'budget_type', name='uq_ai_budget_college_period')
    )
    op.create_index(op.f('ix_ai_budgets_college_id'), 'ai_budgets', ['college_id'], unique=False)

    # ------------------------------------------------------------------
    # 3. medical_content (FK → colleges, nullable)
    # ------------------------------------------------------------------
    op.create_table('medical_content',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('college_id', sa.UUID(), nullable=True),
    sa.Column('source_type', sa.String(length=30), nullable=False),
    sa.Column('title', sa.String(length=500), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('content_hash', sa.String(length=64), nullable=False),
    sa.Column('embedding', pgvector.sqlalchemy.Vector(dim=1536), nullable=True),
    sa.Column('chunk_index', sa.Integer(), nullable=False),
    sa.Column('total_chunks', sa.Integer(), nullable=False),
    sa.Column('parent_document_id', sa.UUID(), nullable=True),
    sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('source_reference', sa.String(length=500), nullable=False),
    sa.Column('medical_entity_type', sa.String(length=30), nullable=True),
    sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
    sa.Column('last_verified_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
    sa.ForeignKeyConstraint(['college_id'], ['colleges.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('content_hash')
    )
    op.create_index('ix_medical_content_college_entity_active', 'medical_content', ['college_id', 'medical_entity_type', 'is_active'], unique=False)
    op.create_index('ix_medical_content_parent_doc', 'medical_content', ['parent_document_id'], unique=False)

    # --- Manual: search_vector generated tsvector column ---
    op.execute("""
        ALTER TABLE medical_content
        ADD COLUMN search_vector tsvector
        GENERATED ALWAYS AS (to_tsvector('english', content)) STORED
    """)

    # --- Manual: HNSW index on embedding for vector similarity search ---
    # text-embedding-3-large with dimensions=1536 (Neon pgvector has 2000-dim
    # limit for indexes). HNSW provides good recall with no training data needed.
    # m=16 and ef_construction=64 are pgvector defaults.
    op.execute("""
        CREATE INDEX ix_medical_content_embedding
        ON medical_content
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    """)

    # --- Manual: GIN index on search_vector for BM25 full-text search ---
    op.execute("""
        CREATE INDEX ix_medical_content_search
        ON medical_content
        USING GIN (search_vector)
    """)

    # --- Manual: GIN index on metadata JSONB for filtered queries ---
    op.execute("""
        CREATE INDEX ix_medical_content_metadata
        ON medical_content
        USING GIN (metadata)
    """)

    # ------------------------------------------------------------------
    # 4. medical_entity_relationships (FK → medical_entities)
    # ------------------------------------------------------------------
    op.create_table('medical_entity_relationships',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('source_entity_id', sa.UUID(), nullable=False),
    sa.Column('target_entity_id', sa.UUID(), nullable=False),
    sa.Column('relationship_type', sa.String(length=30), nullable=False),
    sa.Column('properties', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('confidence', sa.Float(), nullable=False),
    sa.Column('source_reference', sa.String(length=500), nullable=True),
    sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
    sa.ForeignKeyConstraint(['source_entity_id'], ['medical_entities.id'], ),
    sa.ForeignKeyConstraint(['target_entity_id'], ['medical_entities.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('source_entity_id', 'target_entity_id', 'relationship_type', name='uq_entity_relationship')
    )
    op.create_index('ix_rel_source_type', 'medical_entity_relationships', ['source_entity_id', 'relationship_type'], unique=False)
    op.create_index('ix_rel_target_type', 'medical_entity_relationships', ['target_entity_id', 'relationship_type'], unique=False)

    # ------------------------------------------------------------------
    # 5. metacognitive_events (FK → colleges)
    # ------------------------------------------------------------------
    op.create_table('metacognitive_events',
    sa.Column('student_id', sa.UUID(), nullable=False),
    sa.Column('event_type', sa.String(length=30), nullable=False),
    sa.Column('event_data', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('subject', sa.String(length=100), nullable=True),
    sa.Column('topic', sa.String(length=200), nullable=True),
    sa.Column('competency_code', sa.String(length=20), nullable=True),
    sa.Column('occurred_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('college_id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
    sa.ForeignKeyConstraint(['college_id'], ['colleges.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_metacog_event_student_subject_time', 'metacognitive_events', ['college_id', 'student_id', 'subject', 'occurred_at'], unique=False)
    op.create_index('ix_metacog_event_student_type_time', 'metacognitive_events', ['college_id', 'student_id', 'event_type', 'occurred_at'], unique=False)
    op.create_index(op.f('ix_metacognitive_events_college_id'), 'metacognitive_events', ['college_id'], unique=False)

    # ------------------------------------------------------------------
    # 6. prompt_templates (FK → colleges, nullable)
    # ------------------------------------------------------------------
    op.create_table('prompt_templates',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('agent_id', sa.String(length=100), nullable=False),
    sa.Column('version', sa.Integer(), nullable=False),
    sa.Column('prompt_text', sa.Text(), nullable=False),
    sa.Column('variables', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('college_id', sa.UUID(), nullable=True),
    sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
    sa.Column('performance_metrics', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
    sa.ForeignKeyConstraint(['college_id'], ['colleges.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('agent_id', 'version', 'college_id', name='uq_prompt_agent_version_college')
    )
    op.create_index('ix_prompt_agent_college_active', 'prompt_templates', ['agent_id', 'college_id', 'is_active'], unique=False)

    # ------------------------------------------------------------------
    # 7. question_intelligence_patterns (FK → colleges)
    # ------------------------------------------------------------------
    op.create_table('question_intelligence_patterns',
    sa.Column('faculty_id', sa.UUID(), nullable=False),
    sa.Column('department', sa.String(length=100), nullable=False),
    sa.Column('question_type', sa.String(length=10), nullable=False),
    sa.Column('difficulty_rating', sa.Integer(), nullable=True),
    sa.Column('blooms_level', sa.String(length=20), nullable=True),
    sa.Column('stem_length', sa.Integer(), nullable=True),
    sa.Column('vignette_style', sa.String(length=30), nullable=True),
    sa.Column('distractor_strategy', sa.String(length=30), nullable=True),
    sa.Column('competency_code', sa.String(length=20), nullable=True),
    sa.Column('question_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('captured_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('college_id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
    sa.ForeignKeyConstraint(['college_id'], ['colleges.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_qip_college_dept_captured', 'question_intelligence_patterns', ['college_id', 'department', 'captured_at'], unique=False)
    op.create_index(op.f('ix_question_intelligence_patterns_college_id'), 'question_intelligence_patterns', ['college_id'], unique=False)

    # ------------------------------------------------------------------
    # 8. student_metacognitive_profiles (FK → colleges)
    # ------------------------------------------------------------------
    op.create_table('student_metacognitive_profiles',
    sa.Column('student_id', sa.UUID(), nullable=False),
    sa.Column('subject', sa.String(length=100), nullable=False),
    sa.Column('topic', sa.String(length=200), nullable=False),
    sa.Column('mastery_score', sa.Float(), nullable=False),
    sa.Column('confidence_calibration', sa.Float(), nullable=True),
    sa.Column('accuracy_rate', sa.Float(), nullable=False),
    sa.Column('avg_time_per_question_ms', sa.Integer(), nullable=True),
    sa.Column('total_questions_attempted', sa.Integer(), nullable=False),
    sa.Column('total_correct', sa.Integer(), nullable=False),
    sa.Column('answer_change_rate', sa.Float(), nullable=True),
    sa.Column('learning_velocity', sa.Float(), nullable=True),
    sa.Column('last_active_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('forgetting_curve_params', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('risk_level', sa.String(length=10), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('college_id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
    sa.ForeignKeyConstraint(['college_id'], ['colleges.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('college_id', 'student_id', 'subject', 'topic', name='uq_metacog_profile_student_topic')
    )
    op.create_index('ix_metacog_profile_student_risk', 'student_metacognitive_profiles', ['college_id', 'student_id', 'risk_level'], unique=False)
    op.create_index(op.f('ix_student_metacognitive_profiles_college_id'), 'student_metacognitive_profiles', ['college_id'], unique=False)

    # ------------------------------------------------------------------
    # 9. agent_executions (FK → colleges, prompt_templates, self-referential)
    # ------------------------------------------------------------------
    op.create_table('agent_executions',
    sa.Column('user_id', sa.UUID(), nullable=True),
    sa.Column('agent_id', sa.String(length=100), nullable=False),
    sa.Column('task_type', sa.String(length=50), nullable=False),
    sa.Column('execution_type', sa.String(length=20), nullable=True),
    sa.Column('status', sa.String(length=30), nullable=False),
    sa.Column('prompt_template_id', sa.UUID(), nullable=True),
    sa.Column('prompt_version', sa.Integer(), nullable=True),
    sa.Column('model_requested', sa.String(length=100), nullable=False),
    sa.Column('model_used', sa.String(length=100), nullable=False),
    sa.Column('input_tokens', sa.Integer(), nullable=False),
    sa.Column('output_tokens', sa.Integer(), nullable=False),
    sa.Column('cache_read_tokens', sa.Integer(), nullable=False),
    sa.Column('cache_creation_tokens', sa.Integer(), nullable=False),
    sa.Column('total_cost_usd', sa.Numeric(precision=10, scale=6), nullable=True),
    sa.Column('latency_ms', sa.Integer(), nullable=True),
    sa.Column('request_summary', sa.Text(), nullable=True),
    sa.Column('response_summary', sa.Text(), nullable=True),
    sa.Column('tool_calls', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('error_message', sa.Text(), nullable=True),
    sa.Column('error_node', sa.String(length=100), nullable=True),
    sa.Column('retry_count', sa.Integer(), nullable=False),
    sa.Column('safety_result', sa.String(length=20), nullable=True),
    sa.Column('bridge_layer_result', sa.String(length=20), nullable=True),
    sa.Column('requires_human_review', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('human_review_status', sa.String(length=20), nullable=True),
    sa.Column('reviewed_by', sa.UUID(), nullable=True),
    sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('parent_execution_id', sa.UUID(), nullable=True),
    sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('college_id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
    sa.ForeignKeyConstraint(['college_id'], ['colleges.id'], ),
    sa.ForeignKeyConstraint(['parent_execution_id'], ['agent_executions.id'], ),
    sa.ForeignKeyConstraint(['prompt_template_id'], ['prompt_templates.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_agent_exec_agent_started', 'agent_executions', ['agent_id', 'started_at'], unique=False)
    op.create_index('ix_agent_exec_college_started', 'agent_executions', ['college_id', 'started_at'], unique=False)
    op.create_index('ix_agent_exec_college_task_status', 'agent_executions', ['college_id', 'task_type', 'status'], unique=False)
    op.create_index('ix_agent_exec_parent', 'agent_executions', ['parent_execution_id'], unique=False)
    op.create_index(op.f('ix_agent_executions_college_id'), 'agent_executions', ['college_id'], unique=False)

    # ------------------------------------------------------------------
    # 10. agent_feedback (FK → agent_executions, colleges)
    # ------------------------------------------------------------------
    op.create_table('agent_feedback',
    sa.Column('execution_id', sa.UUID(), nullable=False),
    sa.Column('feedback_type', sa.String(length=30), nullable=False),
    sa.Column('original_output', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('corrected_output', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('feedback_notes', sa.Text(), nullable=True),
    sa.Column('given_by', sa.UUID(), nullable=False),
    sa.Column('given_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('used_for_improvement', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('college_id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
    sa.ForeignKeyConstraint(['college_id'], ['colleges.id'], ),
    sa.ForeignKeyConstraint(['execution_id'], ['agent_executions.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_agent_feedback_college_id'), 'agent_feedback', ['college_id'], unique=False)
    op.create_index('ix_agent_feedback_college_type', 'agent_feedback', ['college_id', 'feedback_type'], unique=False)
    op.create_index('ix_agent_feedback_execution', 'agent_feedback', ['execution_id'], unique=False)

    # ------------------------------------------------------------------
    # 11. safety_checks (FK → agent_executions, colleges)
    # ------------------------------------------------------------------
    op.create_table('safety_checks',
    sa.Column('execution_id', sa.UUID(), nullable=False),
    sa.Column('check_type', sa.String(length=30), nullable=False),
    sa.Column('input_content_hash', sa.String(length=64), nullable=False),
    sa.Column('result', sa.String(length=20), nullable=False),
    sa.Column('confidence_score', sa.Float(), nullable=True),
    sa.Column('details', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('checker_model', sa.String(length=100), nullable=True),
    sa.Column('pipeline_stage', sa.Integer(), nullable=True),
    sa.Column('checked_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('college_id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
    sa.ForeignKeyConstraint(['college_id'], ['colleges.id'], ),
    sa.ForeignKeyConstraint(['execution_id'], ['agent_executions.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_safety_check_college_type_result', 'safety_checks', ['college_id', 'check_type', 'result'], unique=False)
    op.create_index('ix_safety_check_execution', 'safety_checks', ['execution_id'], unique=False)
    op.create_index(op.f('ix_safety_checks_college_id'), 'safety_checks', ['college_id'], unique=False)

    # ------------------------------------------------------------------
    # Department table drift (autogenerate detected model vs DB mismatch)
    # ------------------------------------------------------------------
    op.add_column('departments', sa.Column('nmc_department_type', sa.String(length=20), nullable=False))
    op.add_column('departments', sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('departments', sa.Column('established_year', sa.Integer(), nullable=True))
    op.alter_column('departments', 'code',
               existing_type=sa.VARCHAR(length=20),
               nullable=False)
    op.create_unique_constraint('uq_department_college_code', 'departments', ['college_id', 'code'])
    op.create_foreign_key(None, 'departments', 'faculty', ['hod_id'], ['id'], use_alter=True)
    op.drop_column('departments', 'department_type')

    # ------------------------------------------------------------------
    # RLS policies for tenant-scoped AI tables
    # ------------------------------------------------------------------
    for table in AI_TENANT_TABLES:
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
    for table in reversed(AI_TENANT_TABLES):
        op.execute(f"DROP POLICY IF EXISTS superadmin_bypass_policy ON {table}")
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation_policy ON {table}")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")

    # ------------------------------------------------------------------
    # Revert department drift
    # ------------------------------------------------------------------
    op.add_column('departments', sa.Column('department_type', sa.VARCHAR(length=20), autoincrement=False, nullable=True))
    op.drop_constraint(None, 'departments', type_='foreignkey')
    op.drop_constraint('uq_department_college_code', 'departments', type_='unique')
    op.alter_column('departments', 'code',
               existing_type=sa.VARCHAR(length=20),
               nullable=True)
    op.drop_column('departments', 'established_year')
    op.drop_column('departments', 'is_active')
    op.drop_column('departments', 'nmc_department_type')

    # ------------------------------------------------------------------
    # Drop tables in reverse dependency order
    # ------------------------------------------------------------------
    op.drop_index(op.f('ix_safety_checks_college_id'), table_name='safety_checks')
    op.drop_index('ix_safety_check_execution', table_name='safety_checks')
    op.drop_index('ix_safety_check_college_type_result', table_name='safety_checks')
    op.drop_table('safety_checks')

    op.drop_index('ix_agent_feedback_execution', table_name='agent_feedback')
    op.drop_index('ix_agent_feedback_college_type', table_name='agent_feedback')
    op.drop_index(op.f('ix_agent_feedback_college_id'), table_name='agent_feedback')
    op.drop_table('agent_feedback')

    op.drop_index(op.f('ix_agent_executions_college_id'), table_name='agent_executions')
    op.drop_index('ix_agent_exec_parent', table_name='agent_executions')
    op.drop_index('ix_agent_exec_college_task_status', table_name='agent_executions')
    op.drop_index('ix_agent_exec_college_started', table_name='agent_executions')
    op.drop_index('ix_agent_exec_agent_started', table_name='agent_executions')
    op.drop_table('agent_executions')

    op.drop_index(op.f('ix_student_metacognitive_profiles_college_id'), table_name='student_metacognitive_profiles')
    op.drop_index('ix_metacog_profile_student_risk', table_name='student_metacognitive_profiles')
    op.drop_table('student_metacognitive_profiles')

    op.drop_index(op.f('ix_question_intelligence_patterns_college_id'), table_name='question_intelligence_patterns')
    op.drop_index('ix_qip_college_dept_captured', table_name='question_intelligence_patterns')
    op.drop_table('question_intelligence_patterns')

    op.drop_index('ix_prompt_agent_college_active', table_name='prompt_templates')
    op.drop_table('prompt_templates')

    op.drop_index(op.f('ix_metacognitive_events_college_id'), table_name='metacognitive_events')
    op.drop_index('ix_metacog_event_student_type_time', table_name='metacognitive_events')
    op.drop_index('ix_metacog_event_student_subject_time', table_name='metacognitive_events')
    op.drop_table('metacognitive_events')

    op.drop_index('ix_rel_target_type', table_name='medical_entity_relationships')
    op.drop_index('ix_rel_source_type', table_name='medical_entity_relationships')
    op.drop_table('medical_entity_relationships')

    # Manual indexes must be dropped before table
    op.execute("DROP INDEX IF EXISTS ix_medical_content_metadata")
    op.execute("DROP INDEX IF EXISTS ix_medical_content_search")
    op.execute("DROP INDEX IF EXISTS ix_medical_content_embedding")
    op.drop_index('ix_medical_content_parent_doc', table_name='medical_content')
    op.drop_index('ix_medical_content_college_entity_active', table_name='medical_content')
    op.drop_table('medical_content')

    op.drop_index(op.f('ix_ai_budgets_college_id'), table_name='ai_budgets')
    op.drop_table('ai_budgets')

    op.drop_index('ix_entity_type_active', table_name='medical_entities')
    op.drop_table('medical_entities')
