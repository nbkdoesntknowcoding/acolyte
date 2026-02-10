"""Celery configuration with Upstash Redis broker.

Used for background tasks: report generation, batch AI operations,
email notifications, data sync.
"""

import ssl

from celery import Celery

from app.config import get_settings

settings = get_settings()

# Upstash requires TLS (rediss://) — Celery needs explicit ssl_cert_reqs
_redis_url = settings.REDIS_URL or ""
_broker_use_ssl = None
if _redis_url.startswith("rediss://"):
    _broker_use_ssl = {"ssl_cert_reqs": ssl.CERT_NONE}

celery_app = Celery(
    "acolyte",
    broker=_redis_url,
    backend=_redis_url,
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
    broker_use_ssl=_broker_use_ssl,
    redis_backend_use_ssl=_broker_use_ssl,
    # Auto-discover tasks from all engines
    imports=[
        "app.engines.student.tasks",
        "app.engines.faculty.tasks",
        "app.engines.compliance.tasks",
        "app.engines.admin.tasks",
        "app.engines.integration.tasks",
    ],
)
