"""Compliance Engine — Celery Background Tasks.

Tasks:
- compliance.daily_snapshot: Daily 6 AM full compliance check per college.
- compliance.on_data_updated: Event-driven re-evaluation when data changes.
- compliance.prophet_forecast: Prophet forecasting on 90-day rolling data (Phase 2 stub).

Registered in celery_app.py via imports config.
"""

import asyncio
import logging
from uuid import UUID

from app.core.celery_app import celery_app

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Async helpers (Celery tasks are sync — we bridge to async via event loop)
# ---------------------------------------------------------------------------

async def _run_compliance_check(
    college_id_str: str,
    *,
    category: str | None = None,
    snapshot_type: str = "daily_auto",
) -> dict:
    """Async helper that runs the full compliance check."""
    from app.core.database import async_session_factory
    from app.engines.ai.agents.compliance_monitor import run_compliance_check
    from app.engines.ai.gateway_deps import get_ai_gateway

    gateway = get_ai_gateway()
    college_id = UUID(college_id_str)

    async with async_session_factory() as db:
        from sqlalchemy import text
        await db.execute(
            text("SET app.current_college_id = :cid"),
            {"cid": college_id_str},
        )

        evaluation = await run_compliance_check(
            db,
            gateway,
            college_id=college_id,
            category=category,
            snapshot_type=snapshot_type,
        )
        await db.commit()

    return {
        "overall_status": evaluation.overall_status,
        "standards_checked": evaluation.standards_checked,
        "standards_compliant": evaluation.standards_compliant,
        "standards_at_risk": evaluation.standards_at_risk,
        "standards_breached": evaluation.standards_breached,
        "alerts_generated": evaluation.alerts_generated,
    }


async def _run_targeted_evaluation(
    college_id_str: str,
    source_type: str,
) -> dict:
    """Async helper that re-evaluates standards using a specific data source."""
    from app.core.database import async_session_factory
    from app.engines.ai.agents.compliance_monitor import ComplianceRulesEngine

    college_id = UUID(college_id_str)
    engine = ComplianceRulesEngine()

    async with async_session_factory() as db:
        from sqlalchemy import text
        await db.execute(
            text("SET app.current_college_id = :cid"),
            {"cid": college_id_str},
        )

        # Load only standards that use this data source
        from sqlalchemy import select
        from app.engines.compliance.models import ComplianceStandard

        result = await db.execute(
            select(ComplianceStandard).where(
                ComplianceStandard.is_active.is_(True),
                ComplianceStandard.data_source == source_type,
            )
        )
        standards = list(result.scalars().all())

        if not standards:
            return {
                "source_type": source_type,
                "standards_affected": 0,
                "message": f"No active standards use data source '{source_type}'",
            }

        results = []
        for standard in standards:
            check = await engine.evaluate_standard(db, standard, college_id)
            results.append(check.status)

        await db.commit()

    return {
        "source_type": source_type,
        "standards_affected": len(standards),
        "results": {
            "compliant": results.count("compliant"),
            "at_risk": results.count("at_risk"),
            "non_compliant": results.count("non_compliant"),
            "data_unavailable": results.count("data_unavailable"),
        },
    }


# ---------------------------------------------------------------------------
# Celery tasks
# ---------------------------------------------------------------------------

@celery_app.task(name="compliance.daily_snapshot")
def generate_daily_compliance_snapshot(college_id: str) -> dict:
    """Daily 6 AM — run full compliance check for a college.

    Orchestrates the full LangGraph compliance pipeline:
    1. Evaluate all active standards (deterministic)
    2. Create alerts for non-compliant items
    3. Analyze trends from historical snapshots
    4. Generate executive summary (Sonnet)
    5. Save ComplianceCheckSnapshot

    Args:
        college_id: UUID string of the college tenant.

    Returns:
        dict with evaluation summary.
    """
    logger.info(
        "Starting daily compliance snapshot for college %s", college_id,
    )

    loop = asyncio.new_event_loop()
    try:
        result = loop.run_until_complete(
            _run_compliance_check(college_id, snapshot_type="daily_auto"),
        )
    finally:
        loop.close()

    logger.info(
        "Completed daily compliance snapshot for college %s: "
        "status=%s, checked=%d, breached=%d",
        college_id,
        result["overall_status"],
        result["standards_checked"],
        result["standards_breached"],
    )
    return {"college_id": college_id, **result}


@celery_app.task(name="compliance.on_data_updated")
def on_data_updated(
    college_id: str,
    source_type: str,
    event_data: dict | None = None,
) -> dict:
    """Event-driven: re-evaluate standards when compliance-relevant data changes.

    Triggered by other engines (Integration, Admin, Faculty) when data
    that compliance standards depend on is updated. Only re-evaluates
    standards that use the specified data source.

    Args:
        college_id: UUID string of the college tenant.
        source_type: The data_source type that changed (e.g. "attendance_records").
        event_data: Optional metadata about the data change.

    Returns:
        dict with re-evaluation results.
    """
    logger.info(
        "Compliance re-evaluation triggered: college=%s, source=%s",
        college_id, source_type,
    )

    loop = asyncio.new_event_loop()
    try:
        result = loop.run_until_complete(
            _run_targeted_evaluation(college_id, source_type),
        )
    finally:
        loop.close()

    logger.info(
        "Completed targeted re-evaluation: college=%s, source=%s, "
        "standards_affected=%d",
        college_id, source_type,
        result["standards_affected"],
    )
    return {"college_id": college_id, **result}


@celery_app.task(name="compliance.prophet_forecast")
def run_prophet_forecast(college_id: str) -> dict:
    """Run Prophet forecasting on 90-day rolling compliance data.

    Phase 2 stub — will be implemented when Prophet integration is added.
    Currently the predict_trends node in the LangGraph graph uses simple
    linear trend analysis.
    """
    logger.info("Prophet forecast not yet implemented for college %s", college_id)
    return {
        "college_id": college_id,
        "status": "not_implemented",
        "message": "Prophet forecasting is Phase 2. "
                   "Using linear trend analysis in the meantime.",
    }
