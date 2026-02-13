"""Background tasks for Device Trust management.

Tasks:
- check_expired_device_tokens: Daily — expire old tokens
- flag_suspicious_device_resets: Daily — flag users with too many resets
- cleanup_expired_transfer_requests: Hourly — expire stale transfer requests
"""

import logging

from celery import shared_task
from sqlalchemy import text, update

logger = logging.getLogger(__name__)


@shared_task(name="app.shared.tasks.device_tasks.check_expired_device_tokens")
def check_expired_device_tokens() -> dict:
    """Expire device tokens past their expiry date.

    Runs daily at 2:00 AM IST.
    """
    from app.core.database import sync_session_factory

    with sync_session_factory() as session:
        result = session.execute(
            text("""
                UPDATE device_trusts
                SET status = 'expired', updated_at = NOW()
                WHERE token_expires_at < NOW()
                  AND status = 'active'
            """)
        )
        count = result.rowcount
        session.commit()

    logger.info("Expired %d device tokens", count)
    return {"expired_count": count}


@shared_task(name="app.shared.tasks.device_tasks.flag_suspicious_device_resets")
def flag_suspicious_device_resets(threshold: int = 3, period_days: int = 30) -> dict:
    """Flag users with suspicious number of device resets.

    Runs daily at 3:00 AM IST.
    """
    from app.core.database import sync_session_factory

    with sync_session_factory() as session:
        result = session.execute(
            text("""
                SELECT user_id, COUNT(*) as reset_count
                FROM device_reset_logs
                WHERE reset_at > NOW() - INTERVAL ':period days'
                GROUP BY user_id
                HAVING COUNT(*) >= :threshold
            """),
            {"threshold": threshold, "period": period_days},
        )
        flagged = [
            {"user_id": str(row.user_id), "reset_count": row.reset_count}
            for row in result.all()
        ]

    if flagged:
        logger.warning("Flagged %d users with suspicious resets", len(flagged))

    return {"flagged_count": len(flagged), "users": flagged}


@shared_task(name="app.shared.tasks.device_tasks.cleanup_expired_transfer_requests")
def cleanup_expired_transfer_requests() -> dict:
    """Expire stale device transfer requests.

    Runs hourly.
    """
    from app.core.database import sync_session_factory

    with sync_session_factory() as session:
        result = session.execute(
            text("""
                UPDATE device_transfer_requests
                SET status = 'expired', updated_at = NOW()
                WHERE expires_at < NOW()
                  AND status = 'pending'
            """)
        )
        count = result.rowcount
        session.commit()

    logger.info("Expired %d transfer requests", count)
    return {"expired_count": count}
