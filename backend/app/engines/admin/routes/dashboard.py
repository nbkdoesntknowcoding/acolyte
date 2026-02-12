"""Admin Dashboard routes.

Prefix: /dashboard (mounted under /api/v1/admin)
Aggregated statistics, trends, and activity feeds for the admin dashboard.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user, get_tenant_db, require_role
from app.engines.admin.services.dashboard_aggregator import DashboardAggregatorService
from app.middleware.clerk_auth import CurrentUser, UserRole

router = APIRouter()


def _get_service(db: AsyncSession = Depends(get_tenant_db)) -> DashboardAggregatorService:
    return DashboardAggregatorService(db)


@router.get("/stats")
async def get_dashboard_stats(
    user: CurrentUser = Depends(get_current_user),
    service: DashboardAggregatorService = Depends(_get_service),
):
    """Overview stats: student count, faculty count, fee collection, pending approvals."""
    return await service.get_dashboard_stats()


@router.get("/fee-trend")
async def get_fee_collection_trend(
    academic_year: str | None = Query(None),
    user: CurrentUser = Depends(get_current_user),
    service: DashboardAggregatorService = Depends(_get_service),
):
    """Monthly fee collection chart data."""
    return await service.get_fee_collection_trend(academic_year)


@router.get("/pending-approvals")
async def get_pending_approvals(
    limit: int = Query(20, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
    service: DashboardAggregatorService = Depends(_get_service),
):
    """Pending approvals for current user."""
    return await service.get_pending_approvals(user_id=user.user_id, limit=limit)


@router.get("/recent-activity")
async def get_recent_activity(
    limit: int = Query(20, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
    service: DashboardAggregatorService = Depends(_get_service),
):
    """Recent activity feed."""
    return await service.get_recent_activity(limit=limit)


@router.get("/student-distribution")
async def get_student_distribution(
    user: CurrentUser = Depends(get_current_user),
    service: DashboardAggregatorService = Depends(_get_service),
):
    """Student distribution by phase, quota, gender."""
    return await service.get_student_distribution()


@router.get("/faculty-distribution")
async def get_faculty_distribution(
    user: CurrentUser = Depends(get_current_user),
    service: DashboardAggregatorService = Depends(_get_service),
):
    """Faculty distribution by department and designation."""
    return await service.get_faculty_distribution()
