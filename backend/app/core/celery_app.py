"""Celery configuration with Upstash Redis broker.

Used for background tasks: report generation, batch AI operations,
email notifications, data sync.

Queue-per-engine architecture ensures isolation — a slow compliance
report won't block student analytics or AI cost rollups.
"""

import ssl

from celery import Celery
from celery.schedules import crontab
from kombu import Exchange, Queue

from app.config import get_settings

settings = get_settings()

# ---------------------------------------------------------------------------
# TLS setup — Upstash requires rediss:// with explicit ssl_cert_reqs
# ---------------------------------------------------------------------------
_redis_url = settings.REDIS_URL or ""
_broker_use_ssl = None
if _redis_url.startswith("rediss://"):
    _broker_use_ssl = {"ssl_cert_reqs": ssl.CERT_NONE}

# ---------------------------------------------------------------------------
# Celery app
# ---------------------------------------------------------------------------
celery_app = Celery(
    "acolyte",
    broker=_redis_url,
    backend=_redis_url,
)

# ---------------------------------------------------------------------------
# Queue definitions — one per engine + default
# ---------------------------------------------------------------------------
default_exchange = Exchange("default", type="direct")

TASK_QUEUES = (
    Queue("default", default_exchange, routing_key="default"),
    Queue("student_queue", default_exchange, routing_key="student"),
    Queue("faculty_queue", default_exchange, routing_key="faculty"),
    Queue("compliance_queue", default_exchange, routing_key="compliance"),
    Queue("admin_queue", default_exchange, routing_key="admin"),
    Queue("integration_queue", default_exchange, routing_key="integration"),
    Queue("ai_queue", default_exchange, routing_key="ai"),
)

TASK_ROUTES = {
    "student.*": {"queue": "student_queue", "routing_key": "student"},
    "faculty.*": {"queue": "faculty_queue", "routing_key": "faculty"},
    "compliance.*": {"queue": "compliance_queue", "routing_key": "compliance"},
    "admin.*": {"queue": "admin_queue", "routing_key": "admin"},
    "integration.*": {"queue": "integration_queue", "routing_key": "integration"},
    "ai.*": {"queue": "ai_queue", "routing_key": "ai"},
}

# ---------------------------------------------------------------------------
# Beat schedule — periodic tasks
# ---------------------------------------------------------------------------
CELERY_BEAT_SCHEDULE = {
    "compliance-daily-snapshot": {
        "task": "compliance.daily_snapshot",
        "schedule": crontab(hour=2, minute=0),  # 2:00 AM IST daily
        "options": {"queue": "compliance_queue"},
        "kwargs": {"college_id": "__all__"},  # task iterates all colleges
    },
    "attendance-sync": {
        "task": "integration.sync_aebas_attendance",
        "schedule": crontab(minute="*/30"),  # every 30 minutes
        "options": {"queue": "integration_queue"},
        "kwargs": {"college_id": "__all__"},
    },
    "ai-cost-rollup": {
        "task": "ai.rollup_ai_costs",
        "schedule": crontab(minute=0),  # every hour at :00
        "options": {"queue": "ai_queue"},
        "kwargs": {"college_id": "__all__"},
    },
    "stale-session-cleanup": {
        "task": "student.cleanup_stale_sessions",
        "schedule": crontab(hour=3, minute=0),  # 3:00 AM IST daily
        "options": {"queue": "student_queue"},
    },
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
    # --- AQP: Device Trust tasks ---
    "check-expired-device-tokens": {
        "task": "app.shared.tasks.device_tasks.check_expired_device_tokens",
        "schedule": crontab(hour=2, minute=0),  # 2:00 AM IST daily
    },
    "flag-suspicious-resets": {
        "task": "app.shared.tasks.device_tasks.flag_suspicious_device_resets",
        "schedule": crontab(hour=3, minute=30),  # 3:30 AM IST daily
    },
    "cleanup-transfer-requests": {
        "task": "app.shared.tasks.device_tasks.cleanup_expired_transfer_requests",
        "schedule": crontab(minute=0),  # Every hour
    },
    # --- AQP: QR Engine tasks ---
    "rotate-qr-codes": {
        "task": "app.shared.tasks.qr_tasks.rotate_action_point_qrs",
        "schedule": 60.0,  # Every 60 seconds
    },
    "qr-daily-report": {
        "task": "app.shared.tasks.qr_tasks.generate_qr_daily_report",
        "schedule": crontab(hour=0, minute=5),  # 12:05 AM
    },
    # --- AQP: Dynamic Role tasks ---
    "check-expiring-roles": {
        "task": "app.shared.tasks.role_tasks.check_expiring_roles",
        "schedule": crontab(hour=8, minute=0),  # 8:00 AM IST daily
    },
    "auto-deactivate-expired-roles": {
        "task": "app.shared.tasks.role_tasks.auto_deactivate_expired_roles",
        "schedule": crontab(hour=1, minute=0),  # 1:00 AM IST daily
    },
}

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
celery_app.conf.update(
    # Serialization
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",

    # Timezone
    timezone="Asia/Kolkata",
    enable_utc=True,

    # Reliability
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,

    # Time limits (seconds)
    task_soft_time_limit=300,   # 5 min soft — raises SoftTimeLimitExceeded
    task_time_limit=600,        # 10 min hard — kills the task

    # TLS for Upstash Redis
    broker_use_ssl=_broker_use_ssl,
    redis_backend_use_ssl=_broker_use_ssl,

    # Queues and routing
    task_queues=TASK_QUEUES,
    task_routes=TASK_ROUTES,
    task_default_queue="default",
    task_default_routing_key="default",

    # Beat schedule
    beat_schedule=CELERY_BEAT_SCHEDULE,

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
        "app.shared.tasks.device_tasks",
        "app.shared.tasks.qr_tasks",
        "app.shared.tasks.role_tasks",
    ],
)

# ---------------------------------------------------------------------------
# Dev commands:
#   Start worker (all queues):
#     celery -A app.core.celery_app worker --loglevel=info -Q default,student_queue,faculty_queue,compliance_queue,admin_queue,integration_queue,ai_queue
#
#   Start beat:
#     celery -A app.core.celery_app beat --loglevel=info
#
#   Test task:
#     python -c "from app.engines.compliance.tasks import generate_daily_compliance_snapshot; generate_daily_compliance_snapshot.delay('test-college-id')"
# ---------------------------------------------------------------------------
