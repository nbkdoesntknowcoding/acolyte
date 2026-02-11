"""Celery configuration with Upstash Redis broker.

Used for background tasks: report generation, batch AI operations,
email notifications, data sync.
"""

from celery import Celery

from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "acolyte",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Kolkata",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    # Auto-discover tasks from all engines
    imports=[
        "app.engines.student.tasks",
        "app.engines.faculty.tasks",
        "app.engines.compliance.tasks",
        "app.engines.admin.tasks",
        "app.engines.integration.tasks",
        "app.engines.ai.analytics.tasks",
        "app.engines.ai.tasks",
        "app.platform.tasks",
    ],
)

# ---------------------------------------------------------------------------
# Beat schedule — periodic tasks
# ---------------------------------------------------------------------------

from celery.schedules import crontab  # noqa: E402

celery_app.conf.beat_schedule = {
    "platform-health-metrics": {
        "task": "platform.collect_health_metrics",
        "schedule": 300.0,  # every 5 minutes
    },
    "platform-daily-snapshots": {
        "task": "platform.daily_usage_snapshots",
        "schedule": crontab(hour=0, minute=0),  # midnight IST
    },
    "platform-license-renewals": {
        "task": "platform.check_license_renewals",
        "schedule": crontab(hour=9, minute=0),  # 9 AM IST
    },
    "platform-cleanup-metrics": {
        "task": "platform.cleanup_old_metrics",
        "schedule": crontab(hour=3, minute=0, day_of_week=0),  # Sunday 3 AM
    },
}
