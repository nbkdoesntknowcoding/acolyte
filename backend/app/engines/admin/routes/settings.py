"""Admin Engine — Settings, College Profile & Audit Log Routes.

College profile (not tenant-scoped — queried directly by college ID),
and audit log with filters and pagination.

Prefix: mounted by the parent router (typically /api/v1/admin/settings).
"""

import math
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies.auth import get_current_user, get_tenant_db, require_role
from app.engines.admin.models import College
from app.engines.admin.schemas import (
    AuditLogListResponse,
    AuditLogResponse,
    CollegeProfileResponse,
    CollegeProfileUpdate,
)
from app.middleware.clerk_auth import CurrentUser, UserRole
from app.shared.exceptions import NotFoundException
from app.shared.models import AuditLog

router = APIRouter()


# ===================================================================
# College Profile
# ===================================================================


@router.get("/college-profile", response_model=CollegeProfileResponse)
async def get_college_profile(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the college profile for the current tenant.

    College is NOT tenant-scoped (no RLS), so we use get_db instead of
    get_tenant_db and filter directly by the user's college_id.
    """
    result = await db.execute(
        select(College).where(College.id == user.college_id)
    )
    college = result.scalar_one_or_none()

    if college is None:
        raise NotFoundException("College", str(user.college_id))

    return CollegeProfileResponse.model_validate(college)


@router.put("/college-profile", response_model=CollegeProfileResponse)
async def update_college_profile(
    data: CollegeProfileUpdate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_db),
):
    """Update the college profile for the current tenant.

    Requires: admin, dean, or management role.
    College is NOT tenant-scoped, so we use get_db and filter by
    the user's college_id directly. Only provided (non-None) fields
    are updated.
    """
    result = await db.execute(
        select(College).where(College.id == user.college_id)
    )
    college = result.scalar_one_or_none()

    if college is None:
        raise NotFoundException("College", str(user.college_id))

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(college, field, value)

    await db.commit()
    await db.refresh(college)

    return CollegeProfileResponse.model_validate(college)


# ===================================================================
# Audit Log
# ===================================================================


@router.get("/audit-log", response_model=AuditLogListResponse)
async def list_audit_log(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    user_id: str | None = Query(None, description="Filter by user ID"),
    action: str | None = Query(
        None, description="Filter by action (create, update, delete, read)"
    ),
    entity_type: str | None = Query(
        None, description="Filter by entity type (student, faculty, assessment, etc.)"
    ),
    entity_id: UUID | None = Query(None, description="Filter by entity ID"),
    start_date: date | None = Query(
        None, description="Filter entries from this date (inclusive)"
    ),
    end_date: date | None = Query(
        None, description="Filter entries up to this date (inclusive)"
    ),
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Query the audit log with pagination and filters.

    Requires: admin, dean, or management role.
    AuditLog IS tenant-scoped (has college_id + RLS), so we use
    get_tenant_db. All filters are optional and can be combined.
    """
    from sqlalchemy import func

    query = select(AuditLog)

    # Column filters
    if user_id is not None:
        query = query.where(AuditLog.user_id == user_id)

    if action is not None:
        query = query.where(AuditLog.action == action)

    if entity_type is not None:
        query = query.where(AuditLog.entity_type == entity_type)

    if entity_id is not None:
        query = query.where(AuditLog.entity_id == entity_id)

    # Date range filters (compare against created_at)
    if start_date is not None:
        query = query.where(func.date(AuditLog.created_at) >= start_date)

    if end_date is not None:
        query = query.where(func.date(AuditLog.created_at) <= end_date)

    # Count total matching rows
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Paginate (most recent first)
    offset = (page - 1) * page_size
    query = (
        query.order_by(AuditLog.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )

    result = await db.execute(query)
    entries = result.scalars().all()

    return AuditLogListResponse(
        data=[AuditLogResponse.model_validate(e) for e in entries],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )
