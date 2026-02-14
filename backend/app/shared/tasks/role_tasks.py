"""Background tasks for Dynamic Role management.

Tasks:
- check_expiring_roles: Daily at 8 AM — notify about soon-expiring roles
- auto_deactivate_expired_roles: Daily at 1 AM — deactivate expired roles
"""

import logging
from datetime import date, timedelta

from celery import shared_task
from sqlalchemy import text

logger = logging.getLogger(__name__)


@shared_task(name="app.shared.tasks.role_tasks.check_expiring_roles")
def check_expiring_roles(warning_days: int = 7) -> dict:
    """Check for roles expiring within the warning window.

    Runs daily at 8:00 AM IST. Logs warnings for upcoming expirations.
    """
    from app.core.database import sync_session_factory

    today = date.today()
    cutoff = today + timedelta(days=warning_days)

    with sync_session_factory() as session:
        result = session.execute(
            text("""
                SELECT id, user_id, user_name, role_type, context_name,
                       valid_until, college_id
                FROM dynamic_role_assignments
                WHERE is_active = true
                  AND valid_until IS NOT NULL
                  AND valid_until >= :today
                  AND valid_until <= :cutoff
            """),
            {"today": today, "cutoff": cutoff},
        )
        expiring = result.all()

    for role in expiring:
        logger.warning(
            "Role expiring: %s (%s) for %s in '%s' on %s",
            role.role_type, role.id, role.user_name or role.user_id,
            role.context_name or "unknown", role.valid_until,
        )

    logger.info("Found %d roles expiring within %d days", len(expiring), warning_days)
    return {"expiring_count": len(expiring), "warning_days": warning_days}


@shared_task(name="app.shared.tasks.role_tasks.auto_deactivate_expired_roles")
def auto_deactivate_expired_roles() -> dict:
    """Deactivate role assignments that have passed their valid_until date.

    Runs daily at 1:00 AM IST. Only affects assignments with auto_deactivate=True.
    """
    from app.core.database import sync_session_factory

    today = date.today()

    with sync_session_factory() as session:
        result = session.execute(
            text("""
                UPDATE dynamic_role_assignments
                SET is_active = false,
                    notes = COALESCE(notes, '') || E'\\nAuto-deactivated on ' || :today::text,
                    updated_at = NOW()
                WHERE auto_deactivate = true
                  AND valid_until < :today
                  AND is_active = true
            """),
            {"today": today},
        )
        count = result.rowcount
        session.commit()

    logger.info("Auto-deactivated %d expired role assignments", count)
    return {"deactivated_count": count}
