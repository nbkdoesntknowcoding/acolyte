"""Admin Engine — Grievance & Committee Routes.

Full CRUD for grievances (with auto-generated ticket numbers),
committees, and committee membership management.

Prefix: mounted by the parent router (typically /api/v1/admin/grievances).
"""

import math
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user, get_tenant_db, require_role
from app.engines.admin.models import Committee, CommitteeMember, Grievance
from app.engines.admin.schemas import (
    CommitteeCreate,
    CommitteeListResponse,
    CommitteeMemberCreate,
    CommitteeMemberListResponse,
    CommitteeMemberResponse,
    CommitteeMemberUpdate,
    CommitteeResponse,
    CommitteeUpdate,
    GrievanceCreate,
    GrievanceListResponse,
    GrievanceResponse,
    GrievanceUpdate,
)
from app.engines.admin.utils.validators import generate_ticket_number
from app.middleware.clerk_auth import CurrentUser, UserRole
from app.shared.exceptions import NotFoundException

router = APIRouter()


# ===================================================================
# Grievance CRUD
# ===================================================================


@router.get("/", response_model=GrievanceListResponse)
async def list_grievances(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: str | None = Query(
        None, max_length=200, description="Search by filed_by_name or description"
    ),
    category: str | None = Query(None, description="Filter by category"),
    status: str | None = Query(
        None,
        description="Filter by status (filed, acknowledged, under_review, hearing_scheduled, resolved, escalated, closed)",
    ),
    priority: str | None = Query(
        None, description="Filter by priority (low, medium, high, critical)"
    ),
    is_anonymous: bool | None = Query(
        None, description="Filter by anonymous flag"
    ),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List grievances with pagination, search, and filters.

    Search matches against filed_by_name and description (case-insensitive).
    All filters are optional and can be combined.
    """
    query = select(Grievance)

    # Search filter
    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                Grievance.filed_by_name.ilike(search_term),
                Grievance.description.ilike(search_term),
            )
        )

    # Column filters
    if category is not None:
        query = query.where(Grievance.category == category)

    if status is not None:
        query = query.where(Grievance.status == status)

    if priority is not None:
        query = query.where(Grievance.priority == priority)

    if is_anonymous is not None:
        query = query.where(Grievance.is_anonymous == is_anonymous)

    # Count total matching rows
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(Grievance.created_at.desc()).offset(offset).limit(page_size)

    result = await db.execute(query)
    grievances = result.scalars().all()

    return GrievanceListResponse(
        data=[GrievanceResponse.model_validate(g) for g in grievances],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/{grievance_id}", response_model=GrievanceResponse)
async def get_grievance(
    grievance_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get a single grievance by ID."""
    result = await db.execute(
        select(Grievance).where(Grievance.id == grievance_id)
    )
    grievance = result.scalar_one_or_none()

    if grievance is None:
        raise NotFoundException("Grievance", str(grievance_id))

    return GrievanceResponse.model_validate(grievance)


@router.post("/", response_model=GrievanceResponse, status_code=201)
async def create_grievance(
    data: GrievanceCreate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Create a new grievance.

    Auto-generates a unique ticket number (GRV-YYYYMMDD-XXXXXX).
    Any authenticated user can file a grievance. If is_anonymous is True,
    the filed_by and filed_by_name fields are not recorded.
    """
    grievance = Grievance(
        college_id=user.college_id,
        ticket_number=generate_ticket_number("GRV"),
        filed_by=None if data.is_anonymous else user.user_id,
        filed_by_name=None if data.is_anonymous else user.full_name,
        filed_by_role=user.role.value,
        status="filed",
        **data.model_dump(),
    )
    db.add(grievance)
    await db.commit()
    await db.refresh(grievance)

    return GrievanceResponse.model_validate(grievance)


@router.patch("/{grievance_id}", response_model=GrievanceResponse)
async def update_grievance(
    grievance_id: UUID,
    data: GrievanceUpdate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Update a grievance (status, assignment, resolution).

    Requires: admin, dean, or management role.
    Only provided (non-None) fields are updated.
    """
    result = await db.execute(
        select(Grievance).where(Grievance.id == grievance_id)
    )
    grievance = result.scalar_one_or_none()

    if grievance is None:
        raise NotFoundException("Grievance", str(grievance_id))

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(grievance, field, value)

    await db.commit()
    await db.refresh(grievance)

    return GrievanceResponse.model_validate(grievance)


# ===================================================================
# Committee CRUD
# ===================================================================


@router.get("/committees", response_model=CommitteeListResponse)
async def list_committees(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List all committees with pagination."""
    query = select(Committee)

    # Count total matching rows
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(Committee.name).offset(offset).limit(page_size)

    result = await db.execute(query)
    committees = result.scalars().all()

    return CommitteeListResponse(
        data=[CommitteeResponse.model_validate(c) for c in committees],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/committees/{committee_id}", response_model=CommitteeResponse)
async def get_committee(
    committee_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get a single committee by ID."""
    result = await db.execute(
        select(Committee).where(Committee.id == committee_id)
    )
    committee = result.scalar_one_or_none()

    if committee is None:
        raise NotFoundException("Committee", str(committee_id))

    return CommitteeResponse.model_validate(committee)


@router.post("/committees", response_model=CommitteeResponse, status_code=201)
async def create_committee(
    data: CommitteeCreate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Create a new committee.

    Requires: admin, dean, or management role.
    """
    committee = Committee(
        college_id=user.college_id,
        **data.model_dump(),
    )
    db.add(committee)
    await db.commit()
    await db.refresh(committee)

    return CommitteeResponse.model_validate(committee)


@router.patch("/committees/{committee_id}", response_model=CommitteeResponse)
async def update_committee(
    committee_id: UUID,
    data: CommitteeUpdate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Update a committee.

    Requires: admin, dean, or management role.
    Only provided (non-None) fields are updated.
    """
    result = await db.execute(
        select(Committee).where(Committee.id == committee_id)
    )
    committee = result.scalar_one_or_none()

    if committee is None:
        raise NotFoundException("Committee", str(committee_id))

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(committee, field, value)

    await db.commit()
    await db.refresh(committee)

    return CommitteeResponse.model_validate(committee)


# ===================================================================
# Committee Members
# ===================================================================


@router.get(
    "/committees/{committee_id}/members",
    response_model=CommitteeMemberListResponse,
)
async def list_committee_members(
    committee_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List all active members of a committee with pagination.

    Verifies the committee exists before querying members.
    """
    # Verify committee exists
    committee_result = await db.execute(
        select(Committee).where(Committee.id == committee_id)
    )
    if committee_result.scalar_one_or_none() is None:
        raise NotFoundException("Committee", str(committee_id))

    query = select(CommitteeMember).where(
        CommitteeMember.committee_id == committee_id,
        CommitteeMember.is_active.is_(True),
    )

    # Count total matching rows
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(CommitteeMember.member_name).offset(offset).limit(page_size)

    result = await db.execute(query)
    members = result.scalars().all()

    return CommitteeMemberListResponse(
        data=[CommitteeMemberResponse.model_validate(m) for m in members],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.post(
    "/committees/{committee_id}/members",
    response_model=CommitteeMemberResponse,
    status_code=201,
)
async def add_committee_member(
    committee_id: UUID,
    data: CommitteeMemberCreate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Add a member to a committee.

    Requires: admin, dean, or management role.
    Verifies the committee exists before adding the member.
    The committee_id from the URL path is used (overrides any value in body).
    """
    # Verify committee exists
    committee_result = await db.execute(
        select(Committee).where(Committee.id == committee_id)
    )
    if committee_result.scalar_one_or_none() is None:
        raise NotFoundException("Committee", str(committee_id))

    member_data = data.model_dump()
    # Override committee_id from URL path to ensure consistency
    member_data["committee_id"] = committee_id

    member = CommitteeMember(
        college_id=user.college_id,
        **member_data,
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)

    return CommitteeMemberResponse.model_validate(member)


@router.patch(
    "/committees/members/{member_id}",
    response_model=CommitteeMemberResponse,
)
async def update_committee_member(
    member_id: UUID,
    data: CommitteeMemberUpdate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Update a committee member's details.

    Requires: admin, dean, or management role.
    Only provided (non-None) fields are updated.
    """
    result = await db.execute(
        select(CommitteeMember).where(CommitteeMember.id == member_id)
    )
    member = result.scalar_one_or_none()

    if member is None:
        raise NotFoundException("CommitteeMember", str(member_id))

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(member, field, value)

    await db.commit()
    await db.refresh(member)

    return CommitteeMemberResponse.model_validate(member)


@router.delete("/committees/members/{member_id}", status_code=204)
async def remove_committee_member(
    member_id: UUID,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Soft-delete a committee member by setting is_active=False.

    Requires: admin, dean, or management role.
    Committee membership records are never hard-deleted due to audit
    requirements.
    """
    result = await db.execute(
        select(CommitteeMember).where(CommitteeMember.id == member_id)
    )
    member = result.scalar_one_or_none()

    if member is None:
        raise NotFoundException("CommitteeMember", str(member_id))

    member.is_active = False
    await db.commit()
