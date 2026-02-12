"""Admin Engine — Faculty Routes.

Full CRUD for faculty management with search, filters, MSR compliance
gap analysis, retirement forecasting, and bulk import stub.

Prefix: mounted by the parent router (typically /api/v1/admin/faculty).
"""

import math
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user, get_tenant_db, require_role
from app.engines.admin.models import Department, Faculty
from app.engines.admin.schemas import (
    FacultyCreate,
    FacultyListResponse,
    FacultyResponse,
    FacultyUpdate,
)
from app.engines.admin.services.msr_checker import MSRCheckerService
from app.middleware.clerk_auth import CurrentUser, UserRole
from app.shared.exceptions import NotFoundException

router = APIRouter()


# ---------------------------------------------------------------------------
# Helper: get MSRCheckerService instance
# ---------------------------------------------------------------------------

def _get_msr_service(
    db: AsyncSession = Depends(get_tenant_db),
) -> MSRCheckerService:
    return MSRCheckerService(db)


# ---------------------------------------------------------------------------
# GET /msr-compliance — department-wise MSR gap analysis
# (placed BEFORE /{faculty_id} to avoid path conflict)
# ---------------------------------------------------------------------------

@router.get("/msr-compliance")
async def get_msr_compliance(
    user: CurrentUser = Depends(get_current_user),
    service: MSRCheckerService = Depends(_get_msr_service),
):
    """Department-wise MSR gap analysis.

    Returns overall compliance score and per-department breakdown
    comparing actual faculty strength against NMC MSR 2023 norms.
    """
    return await service.get_overall_compliance_score()


# ---------------------------------------------------------------------------
# GET /retirement-forecast — faculty retiring in next N years
# ---------------------------------------------------------------------------

@router.get("/retirement-forecast")
async def get_retirement_forecast(
    years: int = Query(3, ge=1, le=10, description="Number of years to forecast"),
    user: CurrentUser = Depends(get_current_user),
    service: MSRCheckerService = Depends(_get_msr_service),
):
    """Forecast faculty retirements and their MSR impact.

    Returns timeline of upcoming retirements with per-department
    gap projections for the specified number of years ahead.
    """
    return await service.forecast_retirement_impact(years_ahead=years)


# ---------------------------------------------------------------------------
# POST /bulk-import — placeholder stub
# ---------------------------------------------------------------------------

@router.post("/bulk-import")
async def bulk_import_faculty(
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
):
    """Bulk import faculty records from CSV/Excel.

    Placeholder — implementation pending.
    """
    return {"message": "Bulk import endpoint - implementation pending"}


# ---------------------------------------------------------------------------
# GET / — list faculty with pagination, search, and filters
# ---------------------------------------------------------------------------

@router.get("/", response_model=FacultyListResponse)
async def list_faculty(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: str | None = Query(None, max_length=200, description="Search by name, email, or employee_id"),
    department_id: UUID | None = Query(None, description="Filter by department"),
    designation: str | None = Query(None, description="Filter by designation"),
    status: str | None = Query(None, description="Filter by status"),
    employment_type: str | None = Query(None, description="Filter by employment type"),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List faculty with pagination, search, and filters.

    Search matches against name, email, and employee_id (case-insensitive).
    All filters are optional and can be combined.
    """
    # Base query
    query = select(Faculty)

    # Search filter
    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                Faculty.name.ilike(search_term),
                Faculty.email.ilike(search_term),
                Faculty.employee_id.ilike(search_term),
            )
        )

    # Column filters
    if department_id is not None:
        query = query.where(Faculty.department_id == department_id)

    if designation is not None:
        query = query.where(Faculty.designation == designation)

    if status is not None:
        query = query.where(Faculty.status == status)

    if employment_type is not None:
        query = query.where(Faculty.employment_type == employment_type)

    # Count total matching rows
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(Faculty.name).offset(offset).limit(page_size)

    result = await db.execute(query)
    faculty_list = result.scalars().all()

    return FacultyListResponse(
        data=[FacultyResponse.model_validate(f) for f in faculty_list],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


# ---------------------------------------------------------------------------
# GET /{faculty_id} — get single faculty record
# ---------------------------------------------------------------------------

@router.get("/{faculty_id}", response_model=FacultyResponse)
async def get_faculty(
    faculty_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get a single faculty record by ID."""
    result = await db.execute(
        select(Faculty).where(Faculty.id == faculty_id)
    )
    faculty = result.scalar_one_or_none()

    if faculty is None:
        raise NotFoundException("Faculty", str(faculty_id))

    return FacultyResponse.model_validate(faculty)


# ---------------------------------------------------------------------------
# POST / — create faculty (requires admin)
# ---------------------------------------------------------------------------

@router.post("/", response_model=FacultyResponse, status_code=201)
async def create_faculty(
    data: FacultyCreate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Create a new faculty record.

    Requires: admin, dean, or management role.
    Validates that the referenced department exists within the same tenant.
    """
    # Verify department exists (RLS ensures same tenant)
    dept_result = await db.execute(
        select(Department).where(Department.id == data.department_id)
    )
    if dept_result.scalar_one_or_none() is None:
        raise NotFoundException("Department", str(data.department_id))

    faculty = Faculty(
        college_id=user.college_id,
        **data.model_dump(),
    )
    db.add(faculty)
    await db.commit()
    await db.refresh(faculty)

    return FacultyResponse.model_validate(faculty)


# ---------------------------------------------------------------------------
# PATCH /{faculty_id} — update faculty (requires admin)
# ---------------------------------------------------------------------------

@router.patch("/{faculty_id}", response_model=FacultyResponse)
async def update_faculty(
    faculty_id: UUID,
    data: FacultyUpdate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Update a faculty record.

    Requires: admin, dean, or management role.
    Only provided (non-None) fields are updated.
    If department_id is changed, validates that the new department exists.
    """
    result = await db.execute(
        select(Faculty).where(Faculty.id == faculty_id)
    )
    faculty = result.scalar_one_or_none()

    if faculty is None:
        raise NotFoundException("Faculty", str(faculty_id))

    update_data = data.model_dump(exclude_unset=True)

    # If department is being changed, verify it exists
    if "department_id" in update_data and update_data["department_id"] is not None:
        dept_result = await db.execute(
            select(Department).where(Department.id == update_data["department_id"])
        )
        if dept_result.scalar_one_or_none() is None:
            raise NotFoundException("Department", str(update_data["department_id"]))

    for field, value in update_data.items():
        setattr(faculty, field, value)

    await db.commit()
    await db.refresh(faculty)

    return FacultyResponse.model_validate(faculty)


# ---------------------------------------------------------------------------
# DELETE /{faculty_id} — soft delete (set status="terminated")
# ---------------------------------------------------------------------------

@router.delete("/{faculty_id}", status_code=204)
async def delete_faculty(
    faculty_id: UUID,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Soft-delete a faculty record by setting status to 'terminated'.

    Requires: admin, dean, or management role.
    Faculty records are never hard-deleted due to audit requirements.
    """
    result = await db.execute(
        select(Faculty).where(Faculty.id == faculty_id)
    )
    faculty = result.scalar_one_or_none()

    if faculty is None:
        raise NotFoundException("Faculty", str(faculty_id))

    faculty.status = "terminated"
    await db.commit()
