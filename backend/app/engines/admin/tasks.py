"""Admin Engine — Celery Background Tasks."""

from app.core.celery_app import celery_app


@celery_app.task(name="admin.generate_fee_report")
def generate_fee_report(college_id: str, academic_year: str):
    """Generate comprehensive fee collection report."""
    pass


@celery_app.task(name="admin.sync_clerk_users")
def sync_clerk_users(college_id: str):
    """Sync user records from Clerk webhooks."""
    pass
