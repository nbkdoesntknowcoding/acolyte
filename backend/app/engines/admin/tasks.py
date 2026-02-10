"""Admin Engine — Celery Background Tasks."""

import logging

from app.core.celery_app import celery_app
from app.core.tasks import AcolyteBaseTask

logger = logging.getLogger(__name__)


@celery_app.task(base=AcolyteBaseTask, name="admin.generate_fee_report")
def generate_fee_report(college_id: str, academic_year: str):
    """Generate comprehensive fee collection report.

    Aggregates fee_payments by quota type (government/management/NRI),
    calculates collection rates, outstanding amounts, and generates
    a summary PDF stored in R2.
    """
    logger.info(
        "Generating fee report for college_id=%s year=%s",
        college_id, academic_year,
    )
    # TODO: Implement — query fee_payments, aggregate by quota,
    # generate PDF, upload to R2


@celery_app.task(base=AcolyteBaseTask, name="admin.sync_clerk_users")
def sync_clerk_users(college_id: str):
    """Sync user records from Clerk webhooks.

    Ensures local user/faculty/student records are in sync with
    Clerk organization membership data.
    """
    logger.info("Syncing Clerk users for college_id=%s", college_id)
    # TODO: Implement — fetch Clerk org members, upsert into
    # local users table, update Permify relationships
