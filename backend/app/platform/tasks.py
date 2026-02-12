"""Platform admin Celery tasks.

Background tasks for system health monitoring, usage tracking,
license management, and metric cleanup.

Beat schedule (configure in celery_app.py):
  - collect_health_metrics: every 5 minutes
  - daily_usage_snapshots: daily at midnight IST
  - check_license_renewals: daily at 9 AM IST
  - cleanup_old_metrics: weekly (Sunday 3 AM IST)
"""

import asyncio
import logging
from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from app.core.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Run an async coroutine from a sync Celery task."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


# ---------------------------------------------------------------------------
# Health metrics collection (every 5 minutes)
# ---------------------------------------------------------------------------


@celery_app.task(name="platform.collect_health_metrics", ignore_result=True)
def collect_health_metrics():
    """Collect system health metrics from all components.

    Stores metrics in SystemHealthMetric table and generates
    PlatformAlerts when thresholds are breached.
    """
    _run_async(_collect_health_metrics_async())


async def _collect_health_metrics_async():
    from app.core.database import async_session_factory
    from app.platform.health_collector import SystemHealthCollector

    async with async_session_factory() as session:
        try:
            collector = SystemHealthCollector(session)
            await collector.collect_all()
            alerts = await collector.check_and_generate_alerts()
            await session.commit()
            if alerts > 0:
                logger.info("Health check generated %d alert(s)", alerts)
        except Exception:
            await session.rollback()
            logger.exception("Health metrics collection failed")


# ---------------------------------------------------------------------------
# Daily usage snapshots (midnight)
# ---------------------------------------------------------------------------


@celery_app.task(name="platform.daily_usage_snapshots", ignore_result=True)
def daily_usage_snapshots():
    """Capture LicenseUsageSnapshot for every active license.

    Runs nightly at midnight to record current usage counts
    (students, faculty, AI tokens, etc.) for billing and analytics.
    """
    _run_async(_daily_usage_snapshots_async())


async def _daily_usage_snapshots_async():
    from sqlalchemy import select

    from app.core.database import async_session_factory
    from app.platform.license_utils import LicenseUsageTracker
    from app.platform.models import License

    async with async_session_factory() as session:
        # Set superadmin bypass for cross-tenant queries
        from sqlalchemy import text
        await session.execute(text("SET app.is_superadmin = 'true'"))

        try:
            # Get all active licenses
            result = await session.execute(
                select(License).where(License.status == "active")
            )
            licenses = result.scalars().all()

            tracker = LicenseUsageTracker(session)
            success = 0
            errors = 0

            for lic in licenses:
                try:
                    await tracker.record_daily_snapshot(lic.college_id)
                    success += 1
                except Exception:
                    errors += 1
                    logger.exception(
                        "Failed to capture snapshot for college %s",
                        lic.college_id,
                    )

            await session.commit()
            logger.info(
                "Daily usage snapshots: %d succeeded, %d failed",
                success,
                errors,
            )

        except Exception:
            await session.rollback()
            logger.exception("Daily usage snapshot task failed")


# ---------------------------------------------------------------------------
# License renewal checks (daily)
# ---------------------------------------------------------------------------


@celery_app.task(name="platform.check_license_renewals", ignore_result=True)
def check_license_renewals():
    """Check for licenses expiring within 30 days.

    Generates PlatformAlerts for upcoming expirations at
    30-day, 14-day, and 7-day thresholds.
    """
    _run_async(_check_license_renewals_async())


async def _check_license_renewals_async():
    from sqlalchemy import select

    from app.core.database import async_session_factory
    from app.platform.models import License, PlatformAlert

    async with async_session_factory() as session:
        try:
            now = datetime.now(timezone.utc)
            cutoff_30 = now + timedelta(days=30)

            result = await session.execute(
                select(License).where(
                    License.status == "active",
                    License.expires_at.isnot(None),
                    License.expires_at <= cutoff_30,
                    License.expires_at > now,
                )
            )
            expiring = result.scalars().all()

            alerts_created = 0
            for lic in expiring:
                expires_at = lic.expires_at
                if expires_at.tzinfo is None:
                    expires_at = expires_at.replace(tzinfo=timezone.utc)
                days_left = (expires_at - now).days

                # Only alert at specific thresholds
                if days_left not in (30, 14, 7, 3, 1):
                    continue

                # Check for existing active alert
                from sqlalchemy import func
                existing = await session.execute(
                    select(func.count(PlatformAlert.id)).where(
                        PlatformAlert.license_id == lic.id,
                        PlatformAlert.category == "license",
                        PlatformAlert.status == "active",
                        PlatformAlert.title.like(f"%{days_left} day%"),
                    )
                )
                if (existing.scalar() or 0) > 0:
                    continue

                severity = "info"
                if days_left <= 3:
                    severity = "critical"
                elif days_left <= 7:
                    severity = "error"
                elif days_left <= 14:
                    severity = "warning"

                alert = PlatformAlert(
                    severity=severity,
                    category="license",
                    title=f"License expiring in {days_left} day(s)",
                    details=(
                        f"License for college {lic.college_id} "
                        f"({lic.plan_tier} plan) expires on "
                        f"{lic.expires_at.date().isoformat()}. "
                        "Contact the college to discuss renewal."
                    ),
                    college_id=lic.college_id,
                    license_id=lic.id,
                    source_component="license_monitor",
                    trigger_data={
                        "days_remaining": days_left,
                        "expires_at": lic.expires_at.isoformat(),
                        "plan_tier": lic.plan_tier,
                    },
                    status="active",
                )
                session.add(alert)
                alerts_created += 1

            await session.commit()
            if alerts_created > 0:
                logger.info(
                    "License renewal check: %d alert(s) created for %d expiring license(s)",
                    alerts_created,
                    len(expiring),
                )

        except Exception:
            await session.rollback()
            logger.exception("License renewal check failed")


# ---------------------------------------------------------------------------
# Metric cleanup (weekly)
# ---------------------------------------------------------------------------


@celery_app.task(name="platform.cleanup_old_metrics", ignore_result=True)
def cleanup_old_metrics():
    """Delete SystemHealthMetric records older than 90 days.

    Keeps the metrics table from growing unbounded.
    """
    _run_async(_cleanup_old_metrics_async())


async def _cleanup_old_metrics_async():
    from sqlalchemy import delete

    from app.core.database import async_session_factory
    from app.platform.models import SystemHealthMetric

    async with async_session_factory() as session:
        try:
            cutoff = datetime.now(timezone.utc) - timedelta(days=90)
            result = await session.execute(
                delete(SystemHealthMetric).where(
                    SystemHealthMetric.recorded_at < cutoff
                )
            )
            deleted = result.rowcount
            await session.commit()
            if deleted > 0:
                logger.info(
                    "Cleaned up %d old health metrics (older than 90 days)",
                    deleted,
                )
        except Exception:
            await session.rollback()
            logger.exception("Metric cleanup failed")
