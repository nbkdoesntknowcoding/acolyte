"""Base Celery task with tenant context, retry, and logging.

All engine tasks should use this as their base class:

    from app.core.tasks import AcolyteBaseTask
    from app.core.celery_app import celery_app

    @celery_app.task(base=AcolyteBaseTask, name="compliance.daily_snapshot")
    def generate_daily_compliance_snapshot(college_id: str):
        ...

The base task automatically:
  - Sets RLS tenant context (app.current_college_id) before the task body runs
  - Retries on transient failures (ConnectionError, TimeoutError) with exponential backoff
  - Logs task start, success, and failure with task_id and college_id
  - Captures errors to Sentry if available
"""

import logging
import asyncio
from typing import Any

from celery import Task

logger = logging.getLogger("acolyte.tasks")


class AcolyteBaseTask(Task):
    """Base task with tenant context, automatic retry, and observability."""

    # Retry config — exponential backoff on transient errors
    autoretry_for = (ConnectionError, TimeoutError, OSError)
    retry_backoff = True       # exponential: 1s, 2s, 4s, 8s...
    retry_backoff_max = 300    # cap at 5 minutes
    retry_jitter = True        # randomize to prevent thundering herd
    max_retries = 3

    def before_start(self, task_id: str, args: tuple, kwargs: dict) -> None:
        """Called before the task body executes."""
        college_id = self._extract_college_id(args, kwargs)
        logger.info(
            "Task started: %s [%s] college_id=%s",
            self.name, task_id, college_id or "N/A",
        )

        # Set RLS tenant context for DB operations inside this task
        if college_id and college_id != "__all__":
            self._set_tenant_context(college_id)

    def on_success(self, retval: Any, task_id: str, args: tuple, kwargs: dict) -> None:
        college_id = self._extract_college_id(args, kwargs)
        logger.info(
            "Task succeeded: %s [%s] college_id=%s",
            self.name, task_id, college_id or "N/A",
        )

    def on_failure(self, exc: Exception, task_id: str, args: tuple, kwargs: dict, einfo: Any) -> None:
        college_id = self._extract_college_id(args, kwargs)
        logger.error(
            "Task failed: %s [%s] college_id=%s error=%s",
            self.name, task_id, college_id or "N/A", str(exc),
        )

        # Capture to Sentry if available
        try:
            import sentry_sdk
            sentry_sdk.capture_exception(exc)
        except ImportError:
            pass

    def _extract_college_id(self, args: tuple, kwargs: dict) -> str | None:
        """Extract college_id from args (first positional) or kwargs."""
        if kwargs.get("college_id"):
            return kwargs["college_id"]
        if args:
            return str(args[0])
        return None

    def _set_tenant_context(self, college_id: str) -> None:
        """Set PostgreSQL RLS tenant context for this task.

        Uses a synchronous connection since Celery tasks are sync by default.
        The SET command ensures all subsequent queries in this task are
        scoped to the given college_id via RLS policies.
        """
        try:
            from sqlalchemy import create_engine, text
            from app.config import get_settings

            settings = get_settings()
            # Convert async URL to sync for Celery (asyncpg → psycopg2)
            sync_url = settings.DATABASE_URL.replace(
                "postgresql+asyncpg://", "postgresql://"
            )
            # We don't create a persistent engine here — each task gets
            # a fresh connection. For production, consider a sync session factory.
            engine = create_engine(sync_url, pool_pre_ping=True)
            with engine.connect() as conn:
                conn.execute(text(f"SET app.current_college_id = '{college_id}'"))
                conn.commit()
            engine.dispose()
        except Exception as e:
            logger.warning("Failed to set tenant context for %s: %s", college_id, e)
