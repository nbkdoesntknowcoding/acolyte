"""System health metric collector.

Collects metrics from API, database, Redis, Celery, and AI Gateway,
stores them in the SystemHealthMetric table, and generates PlatformAlerts
when thresholds are breached.

Called by Celery beat tasks at regular intervals (every 5 minutes).
"""

import logging
from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.platform.models import (
    License,
    PlatformAlert,
    SystemHealthMetric,
)

logger = logging.getLogger(__name__)


class SystemHealthCollector:
    """Collects system health metrics and stores in SystemHealthMetric table.

    Usage::

        collector = SystemHealthCollector(db_session)
        await collector.collect_all()
        await collector.check_and_generate_alerts()
    """

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def collect_all(self) -> None:
        """Run all metric collectors."""
        collectors = [
            self.collect_database_metrics,
            self.collect_redis_metrics,
            self.collect_celery_metrics,
            self.collect_ai_gateway_metrics,
        ]
        for collector in collectors:
            try:
                await collector()
            except Exception:
                logger.exception(
                    "Health collector failed: %s", collector.__name__
                )

    # ------------------------------------------------------------------
    # Individual collectors
    # ------------------------------------------------------------------

    async def collect_database_metrics(self) -> None:
        """Query pg_stat_activity for connection and performance metrics."""
        try:
            # Active connections
            result = await self._db.execute(
                text(
                    "SELECT state, count(*) FROM pg_stat_activity "
                    "WHERE datname = current_database() "
                    "GROUP BY state"
                )
            )
            rows = result.fetchall()

            active = 0
            idle = 0
            for state, count in rows:
                if state == "active":
                    active = count
                elif state and "idle" in state:
                    idle += count

            total = active + idle
            await self._record("database", "active_connections", float(active), "count")
            await self._record("database", "idle_connections", float(idle), "count")
            await self._record("database", "total_connections", float(total), "count")

            # Determine DB health status
            status = "healthy"
            if total > 80:
                status = "critical"
            elif total > 50:
                status = "degraded"
            await self._record(
                "database", "connection_health", float(total), "count",
                status=status,
                details={"active": active, "idle": idle},
            )

        except Exception:
            logger.exception("Failed to collect database metrics")
            await self._record(
                "database", "connection_health", 0, "count",
                status="unhealthy",
                details={"error": "Failed to query pg_stat_activity"},
            )

    async def collect_redis_metrics(self) -> None:
        """Collect Redis INFO metrics (memory, clients, keyspace).

        Requires ``app.state.redis`` to be set on the FastAPI app.
        Since this runs from a Celery task, Redis client is created
        from settings.
        """
        try:
            from redis.asyncio import Redis

            from app.config import get_settings

            settings = get_settings()
            redis_client = Redis.from_url(settings.REDIS_URL)

            try:
                info = await redis_client.info("memory")
                memory_mb = info.get("used_memory", 0) / (1024 * 1024)
                await self._record(
                    "redis", "memory_usage_mb", round(memory_mb, 2), "mb",
                )

                clients_info = await redis_client.info("clients")
                connected = clients_info.get("connected_clients", 0)
                await self._record(
                    "redis", "connected_clients", float(connected), "count",
                )

                # Ping for latency
                start = datetime.now(timezone.utc)
                await redis_client.ping()
                latency_ms = (
                    datetime.now(timezone.utc) - start
                ).total_seconds() * 1000
                await self._record(
                    "redis", "ping_latency_ms", round(latency_ms, 2), "ms",
                )

                status = "healthy"
                if latency_ms > 100:
                    status = "degraded"
                elif latency_ms > 500:
                    status = "critical"
                await self._record(
                    "redis", "overall_health", latency_ms, "ms",
                    status=status,
                    details={
                        "memory_mb": round(memory_mb, 2),
                        "clients": connected,
                    },
                )
            finally:
                await redis_client.aclose()

        except Exception:
            logger.exception("Failed to collect Redis metrics")
            await self._record(
                "redis", "overall_health", 0, "ms",
                status="unhealthy",
                details={"error": "Redis unreachable"},
            )

    async def collect_celery_metrics(self) -> None:
        """Inspect Celery workers for status, queue depth, and failures.

        Uses Celery inspect API (synchronous) — runs in a thread.
        """
        try:
            import asyncio

            from app.core.celery_app import celery_app

            loop = asyncio.get_event_loop()

            # Celery inspect is synchronous — run in executor
            def _inspect():
                inspector = celery_app.control.inspect(timeout=5.0)
                active = inspector.active() or {}
                reserved = inspector.reserved() or {}
                stats = inspector.stats() or {}
                return active, reserved, stats

            active, reserved, stats = await loop.run_in_executor(None, _inspect)

            worker_count = len(stats)
            active_task_count = sum(len(v) for v in active.values())
            queue_depth = sum(len(v) for v in reserved.values())

            await self._record(
                "celery", "active_workers", float(worker_count), "count",
            )
            await self._record(
                "celery", "active_tasks", float(active_task_count), "count",
            )
            await self._record(
                "celery", "queue_depth", float(queue_depth), "count",
            )

            status = "healthy"
            if worker_count == 0:
                status = "critical"
            elif queue_depth > 100:
                status = "degraded"
            await self._record(
                "celery", "overall_health", float(worker_count), "count",
                status=status,
                details={
                    "workers": worker_count,
                    "active_tasks": active_task_count,
                    "queue_depth": queue_depth,
                },
            )

        except Exception:
            logger.exception("Failed to collect Celery metrics")
            await self._record(
                "celery", "overall_health", 0, "count",
                status="unhealthy",
                details={"error": "Celery inspect failed"},
            )

    async def collect_ai_gateway_metrics(self) -> None:
        """Query AgentExecution table for AI usage and cost metrics."""
        try:
            from app.engines.ai.models import AgentExecution

            now = datetime.now(timezone.utc)
            one_hour_ago = now - timedelta(hours=1)
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

            # Calls in last hour
            hour_result = await self._db.execute(
                select(func.count(AgentExecution.id)).where(
                    AgentExecution.started_at >= one_hour_ago,
                )
            )
            calls_last_hour = hour_result.scalar() or 0

            # Cost today
            cost_result = await self._db.execute(
                select(func.coalesce(func.sum(AgentExecution.total_cost_usd), 0)).where(
                    AgentExecution.started_at >= today_start,
                )
            )
            cost_today = float(cost_result.scalar() or 0)

            # Error rate (last hour)
            error_result = await self._db.execute(
                select(func.count(AgentExecution.id)).where(
                    AgentExecution.started_at >= one_hour_ago,
                    AgentExecution.status == "failed",
                )
            )
            errors_last_hour = error_result.scalar() or 0
            error_rate = (
                (errors_last_hour / calls_last_hour * 100)
                if calls_last_hour > 0
                else 0
            )

            # Cache hit rate (last hour)
            cache_result = await self._db.execute(
                select(
                    func.coalesce(func.sum(AgentExecution.cache_read_tokens), 0),
                    func.coalesce(func.sum(AgentExecution.input_tokens), 0),
                ).where(
                    AgentExecution.started_at >= one_hour_ago,
                )
            )
            cache_row = cache_result.one()
            cached_tokens = int(cache_row[0])
            total_input_tokens = int(cache_row[1])
            cache_hit_rate = (
                (cached_tokens / total_input_tokens * 100)
                if total_input_tokens > 0
                else 0
            )

            # Average latency (last hour)
            latency_result = await self._db.execute(
                select(func.avg(AgentExecution.latency_ms)).where(
                    AgentExecution.started_at >= one_hour_ago,
                    AgentExecution.latency_ms.isnot(None),
                )
            )
            avg_latency = float(latency_result.scalar() or 0)

            await self._record(
                "ai_gateway", "calls_last_hour", float(calls_last_hour), "count",
            )
            await self._record(
                "ai_gateway", "cost_today_usd", round(cost_today, 4), "usd",
            )
            await self._record(
                "ai_gateway", "error_rate_pct", round(error_rate, 2), "percent",
            )
            await self._record(
                "ai_gateway", "cache_hit_rate_pct", round(cache_hit_rate, 2), "percent",
            )
            await self._record(
                "ai_gateway", "avg_latency_ms", round(avg_latency, 1), "ms",
            )

            status = "healthy"
            if error_rate > 10:
                status = "critical"
            elif error_rate > 3:
                status = "degraded"
            await self._record(
                "ai_gateway", "overall_health", error_rate, "percent",
                status=status,
                details={
                    "calls_last_hour": calls_last_hour,
                    "cost_today_usd": round(cost_today, 4),
                    "error_rate_pct": round(error_rate, 2),
                    "cache_hit_rate_pct": round(cache_hit_rate, 2),
                    "avg_latency_ms": round(avg_latency, 1),
                },
            )

        except Exception:
            logger.exception("Failed to collect AI gateway metrics")
            await self._record(
                "ai_gateway", "overall_health", 0, "percent",
                status="unhealthy",
                details={"error": "AgentExecution query failed"},
            )

    # ------------------------------------------------------------------
    # Alert generation
    # ------------------------------------------------------------------

    async def check_and_generate_alerts(self) -> int:
        """Check metric thresholds and generate PlatformAlerts.

        Returns the number of alerts generated.
        """
        alerts_generated = 0

        # --- AI Gateway error rate ---
        ai_health = await self._get_latest_metric("ai_gateway", "overall_health")
        if ai_health and ai_health.status == "critical":
            alerts_generated += await self._create_alert_if_new(
                severity="critical",
                category="health",
                title="AI Gateway error rate critical",
                details=(
                    f"AI Gateway error rate is "
                    f"{ai_health.details.get('error_rate_pct', 0):.1f}%. "
                    "AI features may be degraded."
                ),
                source_component="ai_gateway",
                trigger_data=ai_health.details,
            )
        elif ai_health and ai_health.status == "degraded":
            alerts_generated += await self._create_alert_if_new(
                severity="warning",
                category="health",
                title="AI Gateway error rate elevated",
                details=(
                    f"AI Gateway error rate is "
                    f"{ai_health.details.get('error_rate_pct', 0):.1f}%."
                ),
                source_component="ai_gateway",
                trigger_data=ai_health.details,
            )

        # --- Database connections ---
        db_health = await self._get_latest_metric("database", "connection_health")
        if db_health and db_health.status in ("critical", "degraded"):
            alerts_generated += await self._create_alert_if_new(
                severity="warning" if db_health.status == "degraded" else "critical",
                category="health",
                title=f"Database connections {db_health.status}",
                details=(
                    f"Total database connections: {int(db_health.value)}. "
                    "Consider checking for connection leaks."
                ),
                source_component="database",
                trigger_data=db_health.details,
            )

        # --- Celery workers ---
        celery_health = await self._get_latest_metric("celery", "overall_health")
        if celery_health and celery_health.status == "critical":
            alerts_generated += await self._create_alert_if_new(
                severity="critical",
                category="health",
                title="No Celery workers available",
                details="All Celery workers are down. Background tasks are not being processed.",
                source_component="celery",
                trigger_data=celery_health.details,
            )

        # --- Redis ---
        redis_health = await self._get_latest_metric("redis", "overall_health")
        if redis_health and redis_health.status in ("unhealthy", "critical"):
            alerts_generated += await self._create_alert_if_new(
                severity="critical",
                category="health",
                title="Redis unreachable or degraded",
                details="Redis is unreachable. Caching, Celery broker, and pub/sub are affected.",
                source_component="redis",
                trigger_data=redis_health.details,
            )

        # --- License expiration (14-day warning) ---
        alerts_generated += await self._check_license_expiry_alerts()

        # --- AI budget usage (>90%) ---
        alerts_generated += await self._check_ai_budget_alerts()

        return alerts_generated

    async def _check_license_expiry_alerts(self) -> int:
        """Generate alerts for licenses expiring within 14 days."""
        now = datetime.now(timezone.utc)
        cutoff = now + timedelta(days=14)

        result = await self._db.execute(
            select(License).where(
                License.status == "active",
                License.expires_at.isnot(None),
                License.expires_at <= cutoff,
                License.expires_at > now,
            )
        )
        expiring = result.scalars().all()

        count = 0
        for lic in expiring:
            days_left = (lic.expires_at.replace(tzinfo=timezone.utc) - now).days
            count += await self._create_alert_if_new(
                severity="warning" if days_left > 7 else "error",
                category="license",
                title=f"License expiring in {days_left} days",
                details=(
                    f"License for college {lic.college_id} "
                    f"({lic.plan_tier} plan) expires on "
                    f"{lic.expires_at.date().isoformat()}."
                ),
                college_id=lic.college_id,
                license_id=lic.id,
                source_component="license_monitor",
            )
        return count

    async def _check_ai_budget_alerts(self) -> int:
        """Generate alerts for colleges using >90% of AI budget."""
        from app.engines.ai.models import AIBudget

        today = date.today()
        result = await self._db.execute(
            select(AIBudget).where(
                AIBudget.period_start <= today,
                AIBudget.period_end >= today,
            )
        )
        budgets = result.scalars().all()

        count = 0
        for budget in budgets:
            if budget.total_budget_usd and budget.total_budget_usd > 0:
                pct = float(budget.used_amount_usd) / float(budget.total_budget_usd) * 100
                if pct >= 90:
                    count += await self._create_alert_if_new(
                        severity="warning",
                        category="usage",
                        title=f"AI budget at {pct:.0f}% for college",
                        details=(
                            f"College {budget.college_id} has used "
                            f"${float(budget.used_amount_usd):.2f} of "
                            f"${float(budget.total_budget_usd):.2f} AI budget "
                            f"({pct:.1f}%)."
                        ),
                        college_id=budget.college_id,
                        source_component="ai_budget_monitor",
                        trigger_data={
                            "used_usd": float(budget.used_amount_usd),
                            "budget_usd": float(budget.total_budget_usd),
                            "pct": round(pct, 1),
                        },
                    )
        return count

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _record(
        self,
        component: str,
        metric_name: str,
        value: float,
        unit: str | None = None,
        *,
        status: str = "healthy",
        details: dict | None = None,
    ) -> None:
        """Store a single health metric."""
        metric = SystemHealthMetric(
            component=component,
            metric_name=metric_name,
            value=value,
            unit=unit,
            status=status,
            details=details,
        )
        self._db.add(metric)

    async def _get_latest_metric(
        self, component: str, metric_name: str
    ) -> SystemHealthMetric | None:
        """Get the most recently recorded metric for a component."""
        result = await self._db.execute(
            select(SystemHealthMetric)
            .where(
                SystemHealthMetric.component == component,
                SystemHealthMetric.metric_name == metric_name,
            )
            .order_by(SystemHealthMetric.recorded_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def _create_alert_if_new(
        self,
        *,
        severity: str,
        category: str,
        title: str,
        details: str,
        source_component: str | None = None,
        trigger_data: dict | None = None,
        college_id: UUID | None = None,
        license_id: UUID | None = None,
    ) -> int:
        """Create a PlatformAlert if no active alert with same title exists.

        Returns 1 if created, 0 if duplicate.
        """
        # Check for existing active alert with same title
        existing = await self._db.execute(
            select(func.count(PlatformAlert.id)).where(
                PlatformAlert.title == title,
                PlatformAlert.status == "active",
            )
        )
        if (existing.scalar() or 0) > 0:
            return 0

        alert = PlatformAlert(
            severity=severity,
            category=category,
            title=title,
            details=details,
            source_component=source_component,
            trigger_data=trigger_data,
            college_id=college_id,
            license_id=license_id,
            status="active",
        )
        self._db.add(alert)
        logger.info("Platform alert created: [%s] %s", severity, title)
        return 1
