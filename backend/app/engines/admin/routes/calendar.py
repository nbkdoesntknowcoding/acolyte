"""Admin Engine — Academic Calendar Routes.

Prefix: /api/v1/admin/calendar
Full CRUD for academic calendar events with filtering by event type,
academic year, department, affected phases, and date ranges.
"""

import math
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user, get_tenant_db, require_role
from app.engines.admin.models import AcademicCalendarEvent
from app.engines.admin.schemas import (
    AcademicCalendarEventCreate,
    AcademicCalendarEventListResponse,
    AcademicCalendarEventResponse,
    AcademicCalendarEventUpdate,
)
from app.middleware.clerk_auth import CurrentUser, UserRole
from app.shared.exceptions import NotFoundException

router = APIRouter()


# ---------------------------------------------------------------------------
# LIST — GET /
# ---------------------------------------------------------------------------

@router.get("/", response_model=AcademicCalendarEventListResponse)
async def list_calendar_events(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    event_type: str | None = Query(None, description="Filter by event type (exam, holiday, orientation, etc.)"),
    academic_year: str | None = Query(None, description="Filter by academic year (e.g. 2025-26)"),
    department_id: UUID | None = Query(None, description="Filter by department"),
    affects_phases: str | None = Query(
        None,
        description="Filter by affected phase (matches events whose affects_phases JSON array contains this value)",
    ),
    start_after: date | None = Query(None, description="Events starting on or after this date"),
    start_before: date | None = Query(None, description="Events starting on or before this date"),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List academic calendar events with pagination and filters.

    All filters are optional and combinable. Results ordered by start_date ascending.
    """
    query = select(AcademicCalendarEvent)

    if event_type is not None:
        query = query.where(AcademicCalendarEvent.event_type == event_type)

    if academic_year is not None:
        query = query.where(AcademicCalendarEvent.academic_year == academic_year)

    if department_id is not None:
        query = query.where(AcademicCalendarEvent.department_id == department_id)

    if affects_phases is not None:
        # JSONB contains check — matches if the array contains the given value
        query = query.where(
            AcademicCalendarEvent.affects_phases.contains([affects_phases])
        )

    if start_after is not None:
        query = query.where(AcademicCalendarEvent.start_date >= start_after)

    if start_before is not None:
        query = query.where(AcademicCalendarEvent.start_date <= start_before)

    # Count total matching rows
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = (
        query
        .order_by(AcademicCalendarEvent.start_date.asc())
        .offset(offset)
        .limit(page_size)
    )
    result = await db.execute(query)
    events = result.scalars().all()

    return AcademicCalendarEventListResponse(
        data=[AcademicCalendarEventResponse.model_validate(e) for e in events],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


# ---------------------------------------------------------------------------
# GET — GET /{event_id}
# ---------------------------------------------------------------------------

@router.get("/{event_id}", response_model=AcademicCalendarEventResponse)
async def get_calendar_event(
    event_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get a single academic calendar event by ID."""
    result = await db.execute(
        select(AcademicCalendarEvent).where(AcademicCalendarEvent.id == event_id)
    )
    event = result.scalar_one_or_none()

    if event is None:
        raise NotFoundException("AcademicCalendarEvent", str(event_id))

    return AcademicCalendarEventResponse.model_validate(event)


# ---------------------------------------------------------------------------
# CREATE — POST /
# ---------------------------------------------------------------------------

@router.post("/", response_model=AcademicCalendarEventResponse, status_code=201)
async def create_calendar_event(
    data: AcademicCalendarEventCreate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Create a new academic calendar event.

    Requires: admin, dean, or management role.
    """
    event = AcademicCalendarEvent(
        college_id=user.college_id,
        **data.model_dump(exclude_unset=True),
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)

    return AcademicCalendarEventResponse.model_validate(event)


# ---------------------------------------------------------------------------
# UPDATE — PATCH /{event_id}
# ---------------------------------------------------------------------------

@router.patch("/{event_id}", response_model=AcademicCalendarEventResponse)
async def update_calendar_event(
    event_id: UUID,
    data: AcademicCalendarEventUpdate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Update an existing academic calendar event.

    Requires: admin, dean, or management role.
    Only fields present in the request body are updated.
    """
    result = await db.execute(
        select(AcademicCalendarEvent).where(AcademicCalendarEvent.id == event_id)
    )
    event = result.scalar_one_or_none()

    if event is None:
        raise NotFoundException("AcademicCalendarEvent", str(event_id))

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(event, field, value)

    await db.commit()
    await db.refresh(event)

    return AcademicCalendarEventResponse.model_validate(event)


# ---------------------------------------------------------------------------
# DELETE — DELETE /{event_id}
# ---------------------------------------------------------------------------

@router.delete("/{event_id}", status_code=204)
async def delete_calendar_event(
    event_id: UUID,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Delete an academic calendar event (hard delete).

    Requires: admin, dean, or management role.
    Calendar events are hard-deleted as they have no downstream dependencies.
    """
    result = await db.execute(
        select(AcademicCalendarEvent).where(AcademicCalendarEvent.id == event_id)
    )
    event = result.scalar_one_or_none()

    if event is None:
        raise NotFoundException("AcademicCalendarEvent", str(event_id))

    await db.delete(event)
    await db.commit()
