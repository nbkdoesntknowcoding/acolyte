"""Central AI Engine — Celery Background Tasks.

Tasks:
- ai.daily_recommendations: Morning recommendations for active students.
- ai.weekly_study_plan: Sunday evening study plans.
- ai.engagement_nudge: Nudge disengaged students (3+ days inactive).

Registered in celery_app.py via imports config.
"""

import asyncio
import logging
from uuid import UUID

from app.core.celery_app import celery_app

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Async helpers
# ---------------------------------------------------------------------------

async def _run_student_recommendations(
    college_id_str: str,
    trigger: str = "login",
) -> dict:
    """Generate recommendations for all active students in a college."""
    from datetime import datetime, timedelta, timezone

    from sqlalchemy import select, func

    from app.core.database import async_session_factory
    from app.engines.ai.agents.recommendation_engine import run_recommendations
    from app.engines.ai.gateway_deps import get_ai_gateway
    from app.engines.ai.models import MetacognitiveEvent
    from app.engines.ai.prompt_registry import get_prompt_registry

    gateway = get_ai_gateway()
    registry = get_prompt_registry()
    college_id = UUID(college_id_str)

    async with async_session_factory() as db:
        from sqlalchemy import text
        await db.execute(
            text("SET app.current_college_id = :cid"),
            {"cid": college_id_str},
        )

        # Find active students (had events in last 30 days)
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
        result = await db.execute(
            select(MetacognitiveEvent.student_id)
            .where(
                MetacognitiveEvent.college_id == college_id,
                MetacognitiveEvent.occurred_at >= thirty_days_ago,
            )
            .distinct()
        )
        student_ids = [row[0] for row in result.all()]

    generated = 0
    errors = 0

    for sid in student_ids:
        try:
            async with async_session_factory() as db:
                from sqlalchemy import text
                await db.execute(
                    text("SET app.current_college_id = :cid"),
                    {"cid": college_id_str},
                )

                await run_recommendations(
                    db, gateway, registry,
                    student_id=sid,
                    college_id=college_id,
                    trigger=trigger,
                )
                await db.commit()
            generated += 1
        except Exception:
            logger.warning(
                "Failed to generate recommendations for student %s", sid,
                exc_info=True,
            )
            errors += 1

    return {
        "college_id": college_id_str,
        "students_processed": len(student_ids),
        "generated": generated,
        "errors": errors,
    }


async def _run_engagement_nudge(college_id_str: str) -> dict:
    """Check for disengaged students and generate nudge recommendations."""
    from datetime import datetime, timedelta, timezone

    from sqlalchemy import select, func

    from app.core.database import async_session_factory
    from app.engines.ai.agents.recommendation_engine import run_recommendations
    from app.engines.ai.gateway_deps import get_ai_gateway
    from app.engines.ai.models import MetacognitiveEvent
    from app.engines.ai.prompt_registry import get_prompt_registry

    gateway = get_ai_gateway()
    registry = get_prompt_registry()
    college_id = UUID(college_id_str)

    async with async_session_factory() as db:
        from sqlalchemy import text
        await db.execute(
            text("SET app.current_college_id = :cid"),
            {"cid": college_id_str},
        )

        # Students active 4-30 days ago but NOT in last 3 days
        three_days_ago = datetime.now(timezone.utc) - timedelta(days=3)
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)

        # Students with any activity in last 30 days
        active_result = await db.execute(
            select(MetacognitiveEvent.student_id)
            .where(
                MetacognitiveEvent.college_id == college_id,
                MetacognitiveEvent.occurred_at >= thirty_days_ago,
            )
            .distinct()
        )
        all_active = {row[0] for row in active_result.all()}

        # Students with activity in last 3 days
        recent_result = await db.execute(
            select(MetacognitiveEvent.student_id)
            .where(
                MetacognitiveEvent.college_id == college_id,
                MetacognitiveEvent.occurred_at >= three_days_ago,
            )
            .distinct()
        )
        recently_active = {row[0] for row in recent_result.all()}

    disengaged = all_active - recently_active
    nudged = 0
    errors = 0

    for sid in disengaged:
        try:
            async with async_session_factory() as db:
                from sqlalchemy import text
                await db.execute(
                    text("SET app.current_college_id = :cid"),
                    {"cid": college_id_str},
                )

                await run_recommendations(
                    db, gateway, registry,
                    student_id=sid,
                    college_id=college_id,
                    trigger="session_end",
                )
                await db.commit()
            nudged += 1
        except Exception:
            logger.warning(
                "Failed to nudge student %s", sid,
                exc_info=True,
            )
            errors += 1

    return {
        "college_id": college_id_str,
        "disengaged_students": len(disengaged),
        "nudged": nudged,
        "errors": errors,
    }


# ---------------------------------------------------------------------------
# Celery tasks
# ---------------------------------------------------------------------------

@celery_app.task(name="ai.daily_recommendations")
def daily_recommendations(college_id: str) -> dict:
    """Morning: generate fresh recommendations for active students.

    Runs the S6 Recommendation Engine for each student who has been
    active in the last 30 days.

    Args:
        college_id: UUID string of the college tenant.
    """
    logger.info("Starting daily recommendations for college %s", college_id)

    loop = asyncio.new_event_loop()
    try:
        result = loop.run_until_complete(
            _run_student_recommendations(college_id, trigger="login"),
        )
    finally:
        loop.close()

    logger.info(
        "Completed daily recommendations: college=%s, "
        "students=%d, generated=%d, errors=%d",
        college_id,
        result["students_processed"],
        result["generated"],
        result["errors"],
    )
    return result


@celery_app.task(name="ai.weekly_study_plan")
def weekly_study_plan(college_id: str) -> dict:
    """Sunday evening: generate weekly study plans for active students.

    Runs the S6 Recommendation Engine with trigger="weekly" which
    activates the build_study_plan node in addition to recommendations.

    Args:
        college_id: UUID string of the college tenant.
    """
    logger.info("Starting weekly study plans for college %s", college_id)

    loop = asyncio.new_event_loop()
    try:
        result = loop.run_until_complete(
            _run_student_recommendations(college_id, trigger="weekly"),
        )
    finally:
        loop.close()

    logger.info(
        "Completed weekly study plans: college=%s, "
        "students=%d, generated=%d, errors=%d",
        college_id,
        result["students_processed"],
        result["generated"],
        result["errors"],
    )
    return result


@celery_app.task(name="ai.engagement_nudge")
def engagement_nudge(college_id: str) -> dict:
    """Check for disengaged students (no activity 3+ days), generate nudge.

    Students who were active in the last 30 days but have been
    inactive for 3+ days receive a gentle nudge via recommendations.

    Args:
        college_id: UUID string of the college tenant.
    """
    logger.info("Starting engagement nudge for college %s", college_id)

    loop = asyncio.new_event_loop()
    try:
        result = loop.run_until_complete(
            _run_engagement_nudge(college_id),
        )
    finally:
        loop.close()

    logger.info(
        "Completed engagement nudge: college=%s, "
        "disengaged=%d, nudged=%d, errors=%d",
        college_id,
        result["disengaged_students"],
        result["nudged"],
        result["errors"],
    )
    return result
