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
    ],
)
