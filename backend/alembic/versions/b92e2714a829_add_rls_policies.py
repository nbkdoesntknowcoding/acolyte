"""add_rls_policies

Revision ID: b92e2714a829
Revises: e9e6bad15ab6
Create Date: 2026-02-09 20:46:00.578946

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'b92e2714a829'
down_revision: Union[str, None] = 'e9e6bad15ab6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# All tables inheriting TenantModel (have college_id column)
TENANT_TABLES = [
    # admin engine
    "departments",
    "students",
    "faculty",
    "batches",
    "fee_structures",
    "fee_payments",
    # student engine
    "study_sessions",
    "flashcards",
    "flashcard_reviews",
    "practice_tests",
    "test_attempts",
    "chat_sessions",
    "pdf_annotations",
    # faculty engine
    "logbook_entries",
    "question_bank_items",
    "clinical_rotations",
    "lesson_plans",
    "assessments",
    # compliance engine
    "compliance_snapshots",
    "saf_submissions",
    "msr_alerts",
    # integration engine
    "attendance_records",
    "hmis_data_points",
    "payment_transactions",
    # shared
    "audit_log",
]


def upgrade() -> None:
    for table in TENANT_TABLES:
        # Enable RLS on the table
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")

        # Force RLS even for table owners (critical for security)
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")

        # Tenant isolation policy: rows visible only when college_id matches session var
        op.execute(f"""
            CREATE POLICY tenant_isolation_policy ON {table}
                USING (
                    college_id = current_setting('app.current_college_id')::uuid
                )
        """)

        # Superadmin bypass policy: when app.is_superadmin is set to 'true'
        op.execute(f"""
            CREATE POLICY superadmin_bypass_policy ON {table}
                USING (
                    current_setting('app.is_superadmin', true) = 'true'
                )
        """)


def downgrade() -> None:
    for table in TENANT_TABLES:
        op.execute(f"DROP POLICY IF EXISTS superadmin_bypass_policy ON {table}")
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation_policy ON {table}")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
