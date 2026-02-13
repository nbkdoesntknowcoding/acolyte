"""Background tasks for QR Engine.

Tasks:
- rotate_action_point_qrs: Every minute — rotate QR secrets for rotating action points
- generate_qr_daily_report: Daily — aggregate scan statistics
"""

import logging
import secrets
from datetime import datetime, timedelta, timezone

from celery import shared_task
from sqlalchemy import text

logger = logging.getLogger(__name__)


@shared_task(name="app.shared.tasks.qr_tasks.rotate_action_point_qrs")
def rotate_action_point_qrs() -> dict:
    """Rotate QR secrets for action points with rotation enabled.

    Runs every 60 seconds.
    For each active action point with qr_rotation_minutes > 0,
    regenerates the qr_secret if enough time has elapsed.
    """
    from app.core.database import sync_session_factory

    with sync_session_factory() as session:
        # Find action points that need rotation
        result = session.execute(
            text("""
                UPDATE qr_action_points
                SET qr_secret = :new_prefix || id::text,
                    updated_at = NOW()
                WHERE qr_rotation_minutes > 0
                  AND is_active = true
                  AND (updated_at + (qr_rotation_minutes || ' minutes')::interval) < NOW()
            """),
            {"new_prefix": secrets.token_hex(16)},
        )
        count = result.rowcount
        session.commit()

    if count > 0:
        logger.info("Rotated QR secrets for %d action points", count)
    return {"rotated_count": count}


@shared_task(name="app.shared.tasks.qr_tasks.generate_qr_daily_report")
def generate_qr_daily_report() -> dict:
    """Generate daily QR scan statistics.

    Runs daily at 12:05 AM. Aggregates previous day's scan data.
    """
    from app.core.database import sync_session_factory

    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).date()

    with sync_session_factory() as session:
        result = session.execute(
            text("""
                SELECT
                    college_id,
                    action_type,
                    validation_result,
                    COUNT(*) as scan_count
                FROM qr_scan_logs
                WHERE DATE(scanned_at) = :report_date
                GROUP BY college_id, action_type, validation_result
                ORDER BY college_id, action_type
            """),
            {"report_date": yesterday},
        )
        rows = result.all()

    report = {}
    for row in rows:
        key = f"{row.college_id}:{row.action_type}"
        if key not in report:
            report[key] = {"success": 0, "failed": 0}
        if row.validation_result == "success":
            report[key]["success"] = row.scan_count
        else:
            report[key]["failed"] = report[key].get("failed", 0) + row.scan_count

    logger.info(
        "Generated QR daily report for %s: %d aggregations",
        yesterday, len(report),
    )
    return {"date": str(yesterday), "aggregation_count": len(report)}
