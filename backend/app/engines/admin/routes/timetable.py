"""Admin Engine — Timetable Routes.

Prefix: /api/v1/admin/timetable
Full CRUD for timetable slots with filtering by academic year, phase,
batch, day of week, department, faculty, and session type.
"""

import math
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user, get_tenant_db, require_role
from app.engines.admin.models import TimetableSlot
from app.engines.admin.schemas import (
    TimetableSlotCreate,
    TimetableSlotListResponse,
    TimetableSlotResponse,
    TimetableSlotUpdate,
)
from app.middleware.clerk_auth import CurrentUser, UserRole
from app.shared.exceptions import NotFoundException

router = APIRouter()


# ---------------------------------------------------------------------------
# LIST — GET /
# ---------------------------------------------------------------------------

@router.get("/", response_model=TimetableSlotListResponse)
async def list_timetable_slots(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    academic_year: str | None = Query(None, description="Filter by academic year (e.g. 2025-26)"),
    phase: str | None = Query(None, description="Filter by phase (Phase I, Phase II, etc.)"),
    batch_id: UUID | None = Query(None, description="Filter by batch"),
    day_of_week: int | None = Query(None, ge=0, le=6, description="Filter by day (0=Monday ... 6=Sunday)"),
    department_id: UUID | None = Query(None, description="Filter by department"),
    faculty_id: UUID | None = Query(None, description="Filter by faculty"),
    session_type: str | None = Query(None, description="Filter by session type (lecture, practical, clinical, etc.)"),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List timetable slots with pagination and filters.

    All filters are optional and combinable. Only active slots are returned
    by default. Results ordered by day_of_week then start_time.
    """
    query = select(TimetableSlot).where(TimetableSlot.is_active.is_(True))

    if academic_year is not None:
        query = query.where(TimetableSlot.academic_year == academic_year)

    if phase is not None:
        query = query.where(TimetableSlot.phase == phase)

    if batch_id is not None:
        query = query.where(TimetableSlot.batch_id == batch_id)

    if day_of_week is not None:
        query = query.where(TimetableSlot.day_of_week == day_of_week)

    if department_id is not None:
        query = query.where(TimetableSlot.department_id == department_id)

    if faculty_id is not None:
        query = query.where(TimetableSlot.faculty_id == faculty_id)

    if session_type is not None:
        query = query.where(TimetableSlot.session_type == session_type)

    # Count total matching rows
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = (
        query
        .order_by(TimetableSlot.day_of_week.asc(), TimetableSlot.start_time.asc())
        .offset(offset)
        .limit(page_size)
    )
    result = await db.execute(query)
    slots = result.scalars().all()

    return TimetableSlotListResponse(
        data=[TimetableSlotResponse.model_validate(s) for s in slots],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


# ---------------------------------------------------------------------------
# GET — GET /{slot_id}
# ---------------------------------------------------------------------------

@router.get("/{slot_id}", response_model=TimetableSlotResponse)
async def get_timetable_slot(
    slot_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get a single timetable slot by ID."""
    result = await db.execute(
        select(TimetableSlot).where(TimetableSlot.id == slot_id)
    )
    slot = result.scalar_one_or_none()

    if slot is None:
        raise NotFoundException("TimetableSlot", str(slot_id))

    return TimetableSlotResponse.model_validate(slot)


# ---------------------------------------------------------------------------
# CREATE — POST /
# ---------------------------------------------------------------------------

@router.post("/", response_model=TimetableSlotResponse, status_code=201)
async def create_timetable_slot(
    data: TimetableSlotCreate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Create a new timetable slot.

    Requires: admin, dean, or management role.
    day_of_week: 0=Monday, 1=Tuesday, ..., 5=Saturday, 6=Sunday.
    """
    slot = TimetableSlot(
        college_id=user.college_id,
        **data.model_dump(exclude_unset=True),
    )
    db.add(slot)
    await db.commit()
    await db.refresh(slot)

    return TimetableSlotResponse.model_validate(slot)


# ---------------------------------------------------------------------------
# UPDATE — PATCH /{slot_id}
# ---------------------------------------------------------------------------

@router.patch("/{slot_id}", response_model=TimetableSlotResponse)
async def update_timetable_slot(
    slot_id: UUID,
    data: TimetableSlotUpdate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Update an existing timetable slot.

    Requires: admin, dean, or management role.
    Only fields present in the request body are updated.
    """
    result = await db.execute(
        select(TimetableSlot).where(TimetableSlot.id == slot_id)
    )
    slot = result.scalar_one_or_none()

    if slot is None:
        raise NotFoundException("TimetableSlot", str(slot_id))

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(slot, field, value)

    await db.commit()
    await db.refresh(slot)

    return TimetableSlotResponse.model_validate(slot)


# ---------------------------------------------------------------------------
# DELETE (soft) — DELETE /{slot_id}
# ---------------------------------------------------------------------------

@router.delete("/{slot_id}", status_code=204)
async def delete_timetable_slot(
    slot_id: UUID,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Soft-delete a timetable slot by setting is_active to False.

    Requires: admin, dean, or management role.
    Timetable slots are soft-deleted to preserve historical schedule data.
    """
    result = await db.execute(
        select(TimetableSlot).where(TimetableSlot.id == slot_id)
    )
    slot = result.scalar_one_or_none()

    if slot is None:
        raise NotFoundException("TimetableSlot", str(slot_id))

    slot.is_active = False
    await db.commit()
