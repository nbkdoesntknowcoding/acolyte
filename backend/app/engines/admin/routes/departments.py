"""Admin Engine — Department CRUD routes.

Prefix: /api/v1/admin/departments
"""

import math
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user, get_tenant_db, require_role
from app.engines.admin.models import Department
from app.engines.admin.schemas import (
    DepartmentCreate,
    DepartmentListResponse,
    DepartmentResponse,
    DepartmentUpdate,
    NMCDepartmentType,
)
from app.middleware.clerk_auth import CurrentUser, UserRole
from app.shared.exceptions import DuplicateException, NotFoundException

router = APIRouter()


@router.get("/", response_model=DepartmentListResponse)
async def list_departments(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: str | None = Query(None, max_length=100),
    nmc_type: NMCDepartmentType | None = Query(None),
    active_only: bool = Query(True),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List departments with pagination, search, and filtering."""
    query = select(Department)

    if active_only:
        query = query.where(Department.is_active.is_(True))

    if nmc_type:
        query = query.where(Department.nmc_department_type == nmc_type.value)

    if search:
        pattern = f"%{search}%"
        query = query.where(
            or_(Department.name.ilike(pattern), Department.code.ilike(pattern))
        )

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar_one()

    offset = (page - 1) * page_size
    query = query.order_by(Department.display_order, Department.name).offset(offset).limit(page_size)
    result = await db.execute(query)
    departments = result.scalars().all()

    return DepartmentListResponse(
        data=[DepartmentResponse.model_validate(d) for d in departments],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/{department_id}", response_model=DepartmentResponse)
async def get_department(
    department_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get a single department by ID."""
    result = await db.execute(select(Department).where(Department.id == department_id))
    department = result.scalar_one_or_none()
    if department is None:
        raise NotFoundException("Department", str(department_id))
    return DepartmentResponse.model_validate(department)


@router.post("/", response_model=DepartmentResponse, status_code=201)
async def create_department(
    data: DepartmentCreate,
    user: CurrentUser = Depends(require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Create a new department."""
    from sqlalchemy.exc import IntegrityError

    department = Department(
        college_id=user.college_id,
        name=data.name,
        code=data.code.upper(),
        nmc_department_type=data.nmc_department_type.value if data.nmc_department_type else None,
        department_type=data.department_type,
        hod_id=data.hod_id,
        beds=data.beds,
        opd_rooms=data.opd_rooms,
        labs=data.labs,
        lecture_halls=data.lecture_halls,
        nmc_department_code=data.nmc_department_code,
        display_order=data.display_order,
        established_year=data.established_year,
    )
    db.add(department)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise DuplicateException("Department", "code", data.code.upper())

    await db.refresh(department)
    return DepartmentResponse.model_validate(department)


@router.patch("/{department_id}", response_model=DepartmentResponse)
async def update_department(
    department_id: UUID,
    data: DepartmentUpdate,
    user: CurrentUser = Depends(require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Update a department."""
    from sqlalchemy.exc import IntegrityError

    result = await db.execute(select(Department).where(Department.id == department_id))
    department = result.scalar_one_or_none()
    if department is None:
        raise NotFoundException("Department", str(department_id))

    update_data = data.model_dump(exclude_unset=True)
    if "code" in update_data and update_data["code"] is not None:
        update_data["code"] = update_data["code"].upper()
    if "nmc_department_type" in update_data and update_data["nmc_department_type"] is not None:
        update_data["nmc_department_type"] = update_data["nmc_department_type"].value

    for field, value in update_data.items():
        setattr(department, field, value)

    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise DuplicateException("Department", "code", update_data.get("code", ""))

    await db.refresh(department)
    return DepartmentResponse.model_validate(department)


@router.delete("/{department_id}", status_code=204)
async def delete_department(
    department_id: UUID,
    user: CurrentUser = Depends(require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Soft-delete a department (sets is_active=False)."""
    result = await db.execute(select(Department).where(Department.id == department_id))
    department = result.scalar_one_or_none()
    if department is None:
        raise NotFoundException("Department", str(department_id))

    department.is_active = False
    await db.flush()
