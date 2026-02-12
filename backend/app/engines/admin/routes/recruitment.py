"""Admin Engine — Recruitment Routes.

Full CRUD for recruitment positions (with search and filters) and
recruitment candidates (with pipeline stage tracking).

Prefix: mounted by the parent router (typically /api/v1/admin/recruitment).
"""

import math
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user, get_tenant_db, require_role
from app.engines.admin.models import Department, RecruitmentCandidate, RecruitmentPosition
from app.engines.admin.schemas import (
    RecruitmentCandidateCreate,
    RecruitmentCandidateListResponse,
    RecruitmentCandidateResponse,
    RecruitmentCandidateUpdate,
    RecruitmentPositionCreate,
    RecruitmentPositionListResponse,
    RecruitmentPositionResponse,
    RecruitmentPositionUpdate,
)
from app.middleware.clerk_auth import CurrentUser, UserRole
from app.shared.exceptions import NotFoundException

router = APIRouter()


# ===================================================================
# Recruitment Positions
# ===================================================================


# ---------------------------------------------------------------------------
# GET /positions — list positions with pagination, search, and filters
# ---------------------------------------------------------------------------

@router.get("/positions", response_model=RecruitmentPositionListResponse)
async def list_positions(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: str | None = Query(None, max_length=200, description="Search by designation or specialization_required"),
    department_id: UUID | None = Query(None, description="Filter by department"),
    designation: str | None = Query(None, description="Filter by designation"),
    status: str | None = Query(None, description="Filter by status (draft, open, screening, interview, offered, filled, cancelled)"),
    priority: str | None = Query(None, description="Filter by priority (low, medium, high, critical)"),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List recruitment positions with pagination, search, and filters.

    Search matches against designation and specialization_required (case-insensitive).
    All filters are optional and can be combined.
    """
    # Base query — RLS already filters by college_id
    query = select(RecruitmentPosition)

    # Search filter
    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                RecruitmentPosition.designation.ilike(search_term),
                RecruitmentPosition.specialization_required.ilike(search_term),
            )
        )

    # Column filters
    if department_id is not None:
        query = query.where(RecruitmentPosition.department_id == department_id)

    if designation is not None:
        query = query.where(RecruitmentPosition.designation == designation)

    if status is not None:
        query = query.where(RecruitmentPosition.status == status)

    if priority is not None:
        query = query.where(RecruitmentPosition.priority == priority)

    # Count total matching rows
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(RecruitmentPosition.created_at.desc()).offset(offset).limit(page_size)

    result = await db.execute(query)
    positions = result.scalars().all()

    return RecruitmentPositionListResponse(
        data=[RecruitmentPositionResponse.model_validate(p) for p in positions],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


# ---------------------------------------------------------------------------
# GET /positions/{position_id} — get single position
# ---------------------------------------------------------------------------

@router.get("/positions/{position_id}", response_model=RecruitmentPositionResponse)
async def get_position(
    position_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get a single recruitment position by ID."""
    result = await db.execute(
        select(RecruitmentPosition).where(RecruitmentPosition.id == position_id)
    )
    position = result.scalar_one_or_none()

    if position is None:
        raise NotFoundException("RecruitmentPosition", str(position_id))

    return RecruitmentPositionResponse.model_validate(position)


# ---------------------------------------------------------------------------
# POST /positions — create position (requires admin)
# ---------------------------------------------------------------------------

@router.post("/positions", response_model=RecruitmentPositionResponse, status_code=201)
async def create_position(
    data: RecruitmentPositionCreate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Create a new recruitment position.

    Requires: admin, dean, or management role.
    Validates that the referenced department exists within the same tenant.
    """
    # Verify department exists (RLS ensures same tenant)
    dept_result = await db.execute(
        select(Department).where(Department.id == data.department_id)
    )
    if dept_result.scalar_one_or_none() is None:
        raise NotFoundException("Department", str(data.department_id))

    position = RecruitmentPosition(
        college_id=user.college_id,
        **data.model_dump(),
    )
    db.add(position)
    await db.commit()
    await db.refresh(position)

    return RecruitmentPositionResponse.model_validate(position)


# ---------------------------------------------------------------------------
# PATCH /positions/{position_id} — update position (requires admin)
# ---------------------------------------------------------------------------

@router.patch("/positions/{position_id}", response_model=RecruitmentPositionResponse)
async def update_position(
    position_id: UUID,
    data: RecruitmentPositionUpdate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Update a recruitment position.

    Requires: admin, dean, or management role.
    Only provided (non-None) fields are updated.
    """
    result = await db.execute(
        select(RecruitmentPosition).where(RecruitmentPosition.id == position_id)
    )
    position = result.scalar_one_or_none()

    if position is None:
        raise NotFoundException("RecruitmentPosition", str(position_id))

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(position, field, value)

    await db.commit()
    await db.refresh(position)

    return RecruitmentPositionResponse.model_validate(position)


# ---------------------------------------------------------------------------
# DELETE /positions/{position_id} — soft delete (set status="cancelled")
# ---------------------------------------------------------------------------

@router.delete("/positions/{position_id}", status_code=204)
async def delete_position(
    position_id: UUID,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Soft-delete a recruitment position by setting status to 'cancelled'.

    Requires: admin, dean, or management role.
    Recruitment positions are never hard-deleted due to audit requirements.
    """
    result = await db.execute(
        select(RecruitmentPosition).where(RecruitmentPosition.id == position_id)
    )
    position = result.scalar_one_or_none()

    if position is None:
        raise NotFoundException("RecruitmentPosition", str(position_id))

    position.status = "cancelled"
    await db.commit()


# ===================================================================
# Recruitment Candidates
# ===================================================================


# ---------------------------------------------------------------------------
# GET /candidates — list candidates with pagination and filters
# ---------------------------------------------------------------------------

@router.get("/candidates", response_model=RecruitmentCandidateListResponse)
async def list_candidates(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: str | None = Query(None, max_length=200, description="Search by name, email, or current_organization"),
    position_id: UUID | None = Query(None, description="Filter by recruitment position"),
    pipeline_stage: str | None = Query(None, description="Filter by pipeline stage (applied, screening, nmc_check, interview, offer, joined, rejected)"),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List recruitment candidates with pagination and filters.

    Search matches against name, email, and current_organization (case-insensitive).
    All filters are optional and can be combined.
    """
    # Base query — RLS already filters by college_id
    query = select(RecruitmentCandidate)

    # Search filter
    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                RecruitmentCandidate.name.ilike(search_term),
                RecruitmentCandidate.email.ilike(search_term),
                RecruitmentCandidate.current_organization.ilike(search_term),
            )
        )

    # Column filters
    if position_id is not None:
        query = query.where(RecruitmentCandidate.position_id == position_id)

    if pipeline_stage is not None:
        query = query.where(RecruitmentCandidate.pipeline_stage == pipeline_stage)

    # Count total matching rows
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(RecruitmentCandidate.created_at.desc()).offset(offset).limit(page_size)

    result = await db.execute(query)
    candidates = result.scalars().all()

    return RecruitmentCandidateListResponse(
        data=[RecruitmentCandidateResponse.model_validate(c) for c in candidates],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


# ---------------------------------------------------------------------------
# GET /candidates/{candidate_id} — get single candidate
# ---------------------------------------------------------------------------

@router.get("/candidates/{candidate_id}", response_model=RecruitmentCandidateResponse)
async def get_candidate(
    candidate_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get a single recruitment candidate by ID."""
    result = await db.execute(
        select(RecruitmentCandidate).where(RecruitmentCandidate.id == candidate_id)
    )
    candidate = result.scalar_one_or_none()

    if candidate is None:
        raise NotFoundException("RecruitmentCandidate", str(candidate_id))

    return RecruitmentCandidateResponse.model_validate(candidate)


# ---------------------------------------------------------------------------
# POST /candidates — create candidate (requires admin)
# ---------------------------------------------------------------------------

@router.post("/candidates", response_model=RecruitmentCandidateResponse, status_code=201)
async def create_candidate(
    data: RecruitmentCandidateCreate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Create a new recruitment candidate.

    Requires: admin, dean, or management role.
    Validates that the referenced position exists within the same tenant.
    """
    # Verify position exists (RLS ensures same tenant)
    pos_result = await db.execute(
        select(RecruitmentPosition).where(RecruitmentPosition.id == data.position_id)
    )
    if pos_result.scalar_one_or_none() is None:
        raise NotFoundException("RecruitmentPosition", str(data.position_id))

    candidate = RecruitmentCandidate(
        college_id=user.college_id,
        **data.model_dump(),
    )
    db.add(candidate)
    await db.commit()
    await db.refresh(candidate)

    return RecruitmentCandidateResponse.model_validate(candidate)


# ---------------------------------------------------------------------------
# PATCH /candidates/{candidate_id} — update candidate (requires admin)
# ---------------------------------------------------------------------------

@router.patch("/candidates/{candidate_id}", response_model=RecruitmentCandidateResponse)
async def update_candidate(
    candidate_id: UUID,
    data: RecruitmentCandidateUpdate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Update a recruitment candidate.

    Requires: admin, dean, or management role.
    Only provided (non-None) fields are updated. Use this to advance
    candidates through pipeline stages (applied → screening → nmc_check →
    interview → offer → joined) or to reject them.
    """
    result = await db.execute(
        select(RecruitmentCandidate).where(RecruitmentCandidate.id == candidate_id)
    )
    candidate = result.scalar_one_or_none()

    if candidate is None:
        raise NotFoundException("RecruitmentCandidate", str(candidate_id))

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(candidate, field, value)

    await db.commit()
    await db.refresh(candidate)

    return RecruitmentCandidateResponse.model_validate(candidate)
