"""fix_rls_policy_missing_ok

Revision ID: 3696b80274cf
Revises: b92e2714a829
Create Date: 2026-02-09 20:49:44.698976

Replace RLS policies so that:
1. current_setting uses missing_ok=true -> returns NULL instead of erroring
2. NULL college_id comparison -> no rows returned (secure default)
3. Also creates the acolyte_app role and grants it permissions.
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '3696b80274cf'
down_revision: Union[str, None] = 'b92e2714a829'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TENANT_TABLES = [
    "departments", "students", "faculty", "batches", "fee_structures", "fee_payments",
    "study_sessions", "flashcards", "flashcard_reviews", "practice_tests", "test_attempts",
    "chat_sessions", "pdf_annotations",
    "logbook_entries", "question_bank_items", "clinical_rotations", "lesson_plans", "assessments",
    "compliance_snapshots", "saf_submissions", "msr_alerts",
    "attendance_records", "hmis_data_points", "payment_transactions",
    "audit_log",
]


def upgrade() -> None:
    # --- Create application role (NOBYPASSRLS) ---
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'acolyte_app') THEN
                CREATE ROLE acolyte_app WITH LOGIN PASSWORD 'acolyte_app_dev' NOBYPASSRLS;
            END IF;
        END
        $$
    """)
    op.execute("GRANT USAGE ON SCHEMA public TO acolyte_app")
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO acolyte_app")
    op.execute("GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO acolyte_app")
    op.execute("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO acolyte_app")
    op.execute("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO acolyte_app")

    # --- Replace RLS policies with missing_ok variants ---
    for table in TENANT_TABLES:
        # Drop old policies
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation_policy ON {table}")
        op.execute(f"DROP POLICY IF EXISTS superadmin_bypass_policy ON {table}")

        # Tenant isolation: NULLIF converts empty string to NULL before uuid cast
        # NULL/empty -> NULLIF -> NULL -> NULL::uuid -> comparison fails -> no rows (secure default)
        op.execute(f"""
            CREATE POLICY tenant_isolation_policy ON {table}
                USING (
                    college_id = NULLIF(current_setting('app.current_college_id', true), '')::uuid
                )
        """)

        # Superadmin bypass: already uses missing_ok=true
        op.execute(f"""
            CREATE POLICY superadmin_bypass_policy ON {table}
                USING (
                    current_setting('app.is_superadmin', true) = 'true'
                )
        """)


def downgrade() -> None:
    # Revert to original policies without missing_ok
    for table in TENANT_TABLES:
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation_policy ON {table}")
        op.execute(f"DROP POLICY IF EXISTS superadmin_bypass_policy ON {table}")

        op.execute(f"""
            CREATE POLICY tenant_isolation_policy ON {table}
                USING (
                    college_id = current_setting('app.current_college_id')::uuid
                )
        """)
        op.execute(f"""
            CREATE POLICY superadmin_bypass_policy ON {table}
                USING (
                    current_setting('app.is_superadmin', true) = 'true'
                )
        """)

    # Revoke and drop app role
    op.execute("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM acolyte_app")
    op.execute("REVOKE USAGE ON SCHEMA public FROM acolyte_app")
    op.execute("DROP ROLE IF EXISTS acolyte_app")
