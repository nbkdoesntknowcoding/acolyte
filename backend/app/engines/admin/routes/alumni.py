"""Admin Engine — Alumni Routes.

Full CRUD for alumni records with search, filters, and pagination.

Prefix: mounted by the parent router (typically /api/v1/admin/alumni).
"""

import math
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user, get_tenant_db, require_role
from app.engines.admin.models import Alumni
from app.engines.admin.schemas import (
    AlumniCreate,
    AlumniListResponse,
    AlumniResponse,
    AlumniUpdate,
)
from app.middleware.clerk_auth import CurrentUser, UserRole
from app.shared.exceptions import NotFoundException

router = APIRouter()


# ---------------------------------------------------------------------------
# GET / — list alumni with pagination, search, and filters
# ---------------------------------------------------------------------------

@router.get("/", response_model=AlumniListResponse)
async def list_alumni(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: str | None = Query(None, max_length=200, description="Search by name, email, or current_organization"),
    graduation_year: int | None = Query(None, ge=1900, le=2100, description="Filter by graduation year"),
    employment_type: str | None = Query(None, description="Filter by employment type (government_service, private_practice, hospital_employed, academic, research, abroad, other)"),
    pg_specialization: str | None = Query(None, description="Filter by PG specialization"),
    is_active_member: bool | None = Query(None, description="Filter by active alumni membership status"),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List alumni with pagination, search, and filters.

    Search matches against name, email, and current_organization (case-insensitive).
    All filters are optional and can be combined.
    """
    # Base query — RLS already filters by college_id
    query = select(Alumni)

    # Search filter
    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                Alumni.name.ilike(search_term),
                Alumni.email.ilike(search_term),
                Alumni.current_organization.ilike(search_term),
            )
        )

    # Column filters
    if graduation_year is not None:
        query = query.where(Alumni.graduation_year == graduation_year)

    if employment_type is not None:
        query = query.where(Alumni.employment_type == employment_type)

    if pg_specialization is not None:
        query = query.where(Alumni.pg_specialization == pg_specialization)

    if is_active_member is not None:
        query = query.where(Alumni.is_active_member == is_active_member)

    # Count total matching rows
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(Alumni.name.asc()).offset(offset).limit(page_size)

    result = await db.execute(query)
    alumni_list = result.scalars().all()

    return AlumniListResponse(
        data=[AlumniResponse.model_validate(a) for a in alumni_list],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


# ---------------------------------------------------------------------------
# GET /{alumni_id} — get single alumni record
# ---------------------------------------------------------------------------

@router.get("/{alumni_id}", response_model=AlumniResponse)
async def get_alumni(
    alumni_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get a single alumni record by ID."""
    result = await db.execute(
        select(Alumni).where(Alumni.id == alumni_id)
    )
    alumni = result.scalar_one_or_none()

    if alumni is None:
        raise NotFoundException("Alumni", str(alumni_id))

    return AlumniResponse.model_validate(alumni)


# ---------------------------------------------------------------------------
# POST / — create alumni record (requires admin)
# ---------------------------------------------------------------------------

@router.post("/", response_model=AlumniResponse, status_code=201)
async def create_alumni(
    data: AlumniCreate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Create a new alumni record.

    Requires: admin, dean, or management role.
    """
    alumni = Alumni(
        college_id=user.college_id,
        **data.model_dump(),
    )
    db.add(alumni)
    await db.commit()
    await db.refresh(alumni)

    return AlumniResponse.model_validate(alumni)


# ---------------------------------------------------------------------------
# PATCH /{alumni_id} — update alumni record (requires admin)
# ---------------------------------------------------------------------------

@router.patch("/{alumni_id}", response_model=AlumniResponse)
async def update_alumni(
    alumni_id: UUID,
    data: AlumniUpdate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Update an alumni record.

    Requires: admin, dean, or management role.
    Only provided (non-None) fields are updated.
    """
    result = await db.execute(
        select(Alumni).where(Alumni.id == alumni_id)
    )
    alumni = result.scalar_one_or_none()

    if alumni is None:
        raise NotFoundException("Alumni", str(alumni_id))

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(alumni, field, value)

    await db.commit()
    await db.refresh(alumni)

    return AlumniResponse.model_validate(alumni)


# ---------------------------------------------------------------------------
# DELETE /{alumni_id} — soft delete (set is_active_member=False)
# ---------------------------------------------------------------------------

@router.delete("/{alumni_id}", status_code=204)
async def delete_alumni(
    alumni_id: UUID,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Soft-delete an alumni record by setting is_active_member to False.

    Requires: admin, dean, or management role.
    Alumni records are never hard-deleted due to institutional record requirements.
    """
    result = await db.execute(
        select(Alumni).where(Alumni.id == alumni_id)
    )
    alumni = result.scalar_one_or_none()

    if alumni is None:
        raise NotFoundException("Alumni", str(alumni_id))

    alumni.is_active_member = False
    await db.commit()
