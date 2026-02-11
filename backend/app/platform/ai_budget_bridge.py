"""Bridge between the AI Gateway's AIBudget table and the license system.

When a new monthly period starts:
1. Check the license for monthly_ai_token_budget
2. Create/update the AIBudget record with that amount

When the AI Gateway checks budget:
1. The budget amount comes from the license, not hardcoded

This ensures that upgrading a license's AI budget takes effect
immediately (after cache invalidation).

Usage::

    bridge = AIBudgetLicenseBridge(db_session)
    await bridge.sync_budget_from_license(college_id)
"""

import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class AIBudgetLicenseBridge:
    """Bridges the AI Gateway's AIBudget table with the license system.

    The AI Gateway's ``_check_budget`` method reads ``AIBudget.total_budget_usd``
    to determine the monthly limit. This bridge ensures that value is
    synchronized from the license's ``monthly_ai_token_budget``.
    """

    # Approximate USD cost per 1000 tokens (blended input+output average).
    # Used to convert license's token budget to USD budget.
    # Conservative estimate — actual cost depends on model mix.
    _USD_PER_1K_TOKENS = Decimal("0.005")

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def sync_budget_from_license(self, college_id: UUID) -> bool:
        """Pull budget limit from license and create/update AIBudget row.

        Called:
        - On license creation/update
        - By the monthly budget reset Celery task
        - On first AI request if no budget row exists

        Returns True if budget was created/updated, False if no license found.
        """
        from app.engines.ai.models import AIBudget, BudgetStatus, BudgetType
        from app.platform.models import License

        # Load license
        result = await self._db.execute(
            select(License).where(License.college_id == college_id)
        )
        license_row = result.scalar_one_or_none()

        if license_row is None:
            logger.warning(
                "No license found for college %s — cannot sync AI budget",
                college_id,
            )
            return False

        # Calculate USD budget from token budget
        token_budget_k = license_row.monthly_ai_token_budget or 0
        usd_budget = Decimal(token_budget_k) * self._USD_PER_1K_TOKENS

        # Get current billing period
        today = date.today()
        period_start = today.replace(day=1)
        if today.month == 12:
            period_end = today.replace(year=today.year + 1, month=1, day=1)
        else:
            period_end = today.replace(month=today.month + 1, day=1)

        # Check for existing budget row
        existing = await self._db.execute(
            select(AIBudget).where(
                AIBudget.college_id == college_id,
                AIBudget.period_start == period_start,
            )
        )
        budget = existing.scalar_one_or_none()

        if budget is not None:
            # Update existing budget with new limit from license
            budget.total_budget_usd = usd_budget
            # If budget was exceeded but new limit is higher, reset status
            if (
                budget.budget_status == BudgetStatus.EXCEEDED.value
                and budget.used_amount_usd < usd_budget
            ):
                budget.budget_status = BudgetStatus.NORMAL.value
                budget.throttled_at = None
                logger.info(
                    "Budget un-throttled for college %s (new limit: $%s)",
                    college_id, usd_budget,
                )
        else:
            # Create new budget row for this period
            budget = AIBudget(
                college_id=college_id,
                period_start=period_start,
                period_end=period_end,
                budget_type=BudgetType.MONTHLY.value,
                total_budget_usd=usd_budget,
                used_amount_usd=Decimal("0"),
                token_count_input=0,
                token_count_output=0,
                token_count_cached=0,
                budget_status=BudgetStatus.NORMAL.value,
                warning_threshold_pct=80,
            )
            self._db.add(budget)
            logger.info(
                "Created AI budget for college %s: $%s (period %s to %s)",
                college_id, usd_budget, period_start, period_end,
            )

        await self._db.flush()
        return True

    async def get_budget_for_college(self, college_id: UUID) -> Decimal:
        """Return the AI budget USD amount from the active license.

        Returns Decimal("0") if no license found.
        """
        from app.platform.models import License

        result = await self._db.execute(
            select(License).where(License.college_id == college_id)
        )
        license_row = result.scalar_one_or_none()

        if license_row is None:
            return Decimal("0")

        token_budget_k = license_row.monthly_ai_token_budget or 0
        return Decimal(token_budget_k) * self._USD_PER_1K_TOKENS

    async def ensure_budget_exists(self, college_id: UUID) -> None:
        """Ensure an AIBudget row exists for the current period.

        Called lazily on the first AI request of a billing period.
        If no budget row exists, syncs from license.
        """
        from app.engines.ai.models import AIBudget

        today = date.today()
        result = await self._db.execute(
            select(AIBudget).where(
                AIBudget.college_id == college_id,
                AIBudget.period_start <= today,
                AIBudget.period_end >= today,
            )
        )
        budget = result.scalar_one_or_none()

        if budget is None:
            await self.sync_budget_from_license(college_id)
