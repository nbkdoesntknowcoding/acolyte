"""License usage tracking and limit enforcement.

Called by relevant endpoints to check limits before allowing actions
(enrolling students, adding faculty, AI calls, file uploads).

Also provides the nightly snapshot task for LicenseUsageSnapshot.
"""

import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID

from redis.asyncio import Redis
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.platform.schemas import CachedLicense, UsageLimitResult, UsageSummary

logger = logging.getLogger(__name__)


class LicenseUsageTracker:
    """Tracks and enforces usage limits against a license.

    Usage::

        tracker = LicenseUsageTracker(db_session)
        result = await tracker.check_student_limit(college_id)
        if not result.allowed:
            raise ForbiddenException(result.message)
    """

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def check_student_limit(self, college_id: UUID) -> UsageLimitResult:
        """Check current student count vs license.max_students.

        Called when enrolling a new student.
        """
        license_data = await self._load_license(college_id)
        if license_data is None:
            return UsageLimitResult(
                allowed=True, current=0, limit=0, pct=0,
                message="No license found — no limits enforced",
            )

        from app.engines.admin.models import Student

        result = await self._db.execute(
            select(func.count(Student.id)).where(
                Student.college_id == college_id
            )
        )
        current = result.scalar() or 0
        limit = license_data.max_students
        pct = (current / limit * 100) if limit > 0 else 0

        return UsageLimitResult(
            allowed=current < limit,
            current=current,
            limit=limit,
            pct=round(pct, 1),
            message=(
                f"Student limit reached ({current}/{limit}). "
                "Contact sales@myacolyte.com to upgrade."
                if current >= limit
                else None
            ),
        )

    async def check_faculty_limit(self, college_id: UUID) -> UsageLimitResult:
        """Check current faculty count vs license.max_faculty.

        Called when adding new faculty.
        """
        license_data = await self._load_license(college_id)
        if license_data is None:
            return UsageLimitResult(
                allowed=True, current=0, limit=0, pct=0,
                message="No license found — no limits enforced",
            )

        from app.engines.admin.models import Faculty

        result = await self._db.execute(
            select(func.count(Faculty.id)).where(
                Faculty.college_id == college_id
            )
        )
        current = result.scalar() or 0
        limit = license_data.max_faculty
        pct = (current / limit * 100) if limit > 0 else 0

        return UsageLimitResult(
            allowed=current < limit,
            current=current,
            limit=limit,
            pct=round(pct, 1),
            message=(
                f"Faculty limit reached ({current}/{limit}). "
                "Contact sales@myacolyte.com to upgrade."
                if current >= limit
                else None
            ),
        )

    async def check_ai_budget(self, college_id: UUID) -> UsageLimitResult:
        """Check AI token usage vs license budget.

        Cross-references AIBudget with license.monthly_ai_token_budget.
        Called by AI Gateway before processing requests.
        """
        license_data = await self._load_license(college_id)
        if license_data is None:
            return UsageLimitResult(
                allowed=True, current=0, limit=0, pct=0,
                message="No license found — no limits enforced",
            )

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
            return UsageLimitResult(
                allowed=True, current=0,
                limit=license_data.monthly_ai_token_budget,
                pct=0,
            )

        used = float(budget.used_amount_usd) if budget.used_amount_usd else 0
        limit = float(budget.total_budget_usd) if budget.total_budget_usd else 0
        pct = (used / limit * 100) if limit > 0 else 0

        return UsageLimitResult(
            allowed=used < limit,
            current=round(used, 2),
            limit=round(limit, 2),
            pct=round(pct, 1),
            message=(
                f"AI budget exceeded (${used:.2f}/${limit:.2f}). "
                "Non-critical AI features are disabled."
                if used >= limit
                else None
            ),
        )

    async def check_storage_limit(self, college_id: UUID) -> UsageLimitResult:
        """Check storage usage vs license.max_storage_gb.

        Called when uploading files (PDFs, content).
        Placeholder — actual R2 usage tracking requires Cloudflare API.
        """
        license_data = await self._load_license(college_id)
        if license_data is None:
            return UsageLimitResult(
                allowed=True, current=0, limit=0, pct=0,
                message="No license found — no limits enforced",
            )

        # TODO: Integrate with Cloudflare R2 usage API
        # For now, return a placeholder that always allows
        return UsageLimitResult(
            allowed=True,
            current=0,
            limit=license_data.max_storage_gb,
            pct=0,
            message=None,
        )

    async def get_usage_summary(self, college_id: UUID) -> UsageSummary:
        """Complete usage vs limits for dashboard display."""
        students = await self.check_student_limit(college_id)
        faculty = await self.check_faculty_limit(college_id)
        ai_budget = await self.check_ai_budget(college_id)
        storage = await self.check_storage_limit(college_id)

        license_data = await self._load_license(college_id)
        features: dict = {"enabled": [], "disabled": []}
        if license_data:
            for feat, enabled in license_data.enabled_features.items():
                if enabled:
                    features["enabled"].append(feat)
                else:
                    features["disabled"].append(feat)

        return UsageSummary(
            students=students,
            faculty=faculty,
            ai_budget=ai_budget,
            storage=storage,
            features=features,
        )

    async def record_daily_snapshot(self, college_id: UUID) -> None:
        """Capture current usage into LicenseUsageSnapshot.

        Called by nightly Celery task ``license.daily_usage_snapshot``.
        """
        from app.engines.admin.models import Faculty, Student
        from app.engines.ai.models import AIBudget
        from app.platform.models import License, LicenseUsageSnapshot

        # Get license
        result = await self._db.execute(
            select(License).where(License.college_id == college_id)
        )
        license_row = result.scalar_one_or_none()
        if license_row is None:
            return

        today = date.today()

        # Count students
        student_result = await self._db.execute(
            select(func.count(Student.id)).where(
                Student.college_id == college_id
            )
        )
        student_count = student_result.scalar() or 0

        # Count faculty
        faculty_result = await self._db.execute(
            select(func.count(Faculty.id)).where(
                Faculty.college_id == college_id
            )
        )
        faculty_count = faculty_result.scalar() or 0

        # AI budget usage
        budget_result = await self._db.execute(
            select(AIBudget).where(
                AIBudget.college_id == college_id,
                AIBudget.period_start <= today,
                AIBudget.period_end >= today,
            )
        )
        budget = budget_result.scalar_one_or_none()

        ai_tokens_mtd = 0
        if budget:
            ai_tokens_mtd = (
                (budget.token_count_input or 0)
                + (budget.token_count_output or 0)
                + (budget.token_count_cached or 0)
            )

        snapshot = LicenseUsageSnapshot(
            license_id=license_row.id,
            snapshot_date=today,
            active_students=student_count,
            active_faculty=faculty_count,
            total_users=student_count + faculty_count,
            ai_tokens_used=0,  # Today's tokens (would need delta calc)
            ai_tokens_month_to_date=ai_tokens_mtd,
            ai_requests_count=0,  # Would need AgentExecution count
            storage_used_gb=0,  # Would need R2 API
            api_requests_count=0,  # Would need request counter
        )
        self._db.add(snapshot)
        await self._db.flush()

    async def _load_license(self, college_id: UUID) -> CachedLicense | None:
        """Load license from DB for limit checking."""
        from app.platform.models import License

        result = await self._db.execute(
            select(License).where(License.college_id == college_id)
        )
        row = result.scalar_one_or_none()
        if row is None:
            return None

        return CachedLicense(
            id=row.id,
            college_id=row.college_id,
            plan_tier=row.plan_tier,
            status=row.status,
            enabled_engines=row.enabled_engines or {},
            enabled_features=row.enabled_features or {},
            max_students=row.max_students,
            max_faculty=row.max_faculty,
            max_storage_gb=row.max_storage_gb,
            monthly_ai_token_budget=row.monthly_ai_token_budget,
            expires_at=row.expires_at,
        )
