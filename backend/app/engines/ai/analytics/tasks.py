"""Celery tasks for metacognitive analytics batch processing.

These tasks run on schedule (nightly/weekly) to catch up on any
events that may have been missed by real-time profile updates,
and to run periodic risk assessments.

Registered in celery_app.py via imports config.
"""

import asyncio
import logging
from uuid import UUID

from app.core.celery_app import celery_app

logger = logging.getLogger(__name__)


async def _run_profile_recomputation(college_id_str: str) -> int:
    """Async helper for daily profile recomputation."""
    from app.core.database import async_session_factory

    from app.engines.ai.analytics.metacognitive import get_analytics_engine

    engine = get_analytics_engine()
    college_id = UUID(college_id_str)

    async with async_session_factory() as db:
        count = await engine.recompute_all_profiles(db, college_id)
        await db.commit()

    return count


async def _run_risk_assessment(college_id_str: str) -> int:
    """Async helper for weekly risk assessment."""
    from app.core.database import async_session_factory

    from app.engines.ai.analytics.metacognitive import get_analytics_engine

    engine = get_analytics_engine()
    college_id = UUID(college_id_str)

    async with async_session_factory() as db:
        at_risk = await engine.assess_risk_and_alert(db, college_id)
        await db.commit()

    return len(at_risk)


@celery_app.task(name="ai.daily_profile_recomputation")
def daily_profile_recomputation(college_id: str) -> dict:
    """Nightly job: recompute ALL student profiles for a college.

    Catches any events that were missed by real-time updates.
    Should run once per night per active college.

    Args:
        college_id: UUID string of the college tenant.

    Returns:
        dict with profiles_updated count.
    """
    logger.info("Starting daily profile recomputation for college %s", college_id)

    loop = asyncio.new_event_loop()
    try:
        count = loop.run_until_complete(_run_profile_recomputation(college_id))
    finally:
        loop.close()

    logger.info(
        "Completed daily profile recomputation for college %s: %d profiles updated",
        college_id,
        count,
    )
    return {"college_id": college_id, "profiles_updated": count}


@celery_app.task(name="ai.weekly_risk_assessment")
def weekly_risk_assessment(college_id: str) -> dict:
    """Weekly: identify newly at-risk students and generate alerts.

    Should run weekly per active college. Identifies students with
    high risk levels for faculty notification.

    Args:
        college_id: UUID string of the college tenant.

    Returns:
        dict with at_risk_count.
    """
    logger.info("Starting weekly risk assessment for college %s", college_id)

    loop = asyncio.new_event_loop()
    try:
        count = loop.run_until_complete(_run_risk_assessment(college_id))
    finally:
        loop.close()

    logger.info(
        "Completed weekly risk assessment for college %s: %d at-risk students",
        college_id,
        count,
    )
    return {"college_id": college_id, "at_risk_count": count}


async def _run_archetype_recomputation(college_id_str: str) -> int:
    """Async helper for monthly behavioral archetype recomputation."""
    from app.core.database import async_session_factory

    from app.engines.ai.analytics.metacognitive import get_analytics_engine

    engine = get_analytics_engine()
    college_id = UUID(college_id_str)

    async with async_session_factory() as db:
        count = await engine.recompute_all_archetypes(db, college_id)
        await db.commit()

    return count


@celery_app.task(name="ai.monthly_archetype_recomputation")
def monthly_archetype_recomputation(college_id: str) -> dict:
    """Monthly: recompute behavioral archetypes with latest 30 days data.

    For each student with 30+ days of event data, recomputes the
    Layer 2 behavioral archetype using the Confirmation Matrix
    from the Archetype Framework.

    Args:
        college_id: UUID string of the college tenant.

    Returns:
        dict with archetypes_recomputed count.
    """
    logger.info("Starting monthly archetype recomputation for college %s", college_id)

    loop = asyncio.new_event_loop()
    try:
        count = loop.run_until_complete(_run_archetype_recomputation(college_id))
    finally:
        loop.close()

    logger.info(
        "Completed monthly archetype recomputation for college %s: %d archetypes updated",
        college_id,
        count,
    )
    return {"college_id": college_id, "archetypes_recomputed": count}
