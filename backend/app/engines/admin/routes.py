"""Admin Engine — API Routes.

Prefix: /api/v1/admin (dashboard, students, faculty, fees)
Department routes: /api/v1/departments (reference CRUD pattern)
"""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import (
    get_current_user,
    get_tenant_db,
    require_role,
)
from app.engines.admin.schemas import (
    DepartmentCreate,
    DepartmentListResponse,
    DepartmentResponse,
    DepartmentUpdate,
)
from app.engines.admin.service import DepartmentService
from app.middleware.clerk_auth import CurrentUser, UserRole


# ---------------------------------------------------------------------------
# Admin dashboard router (existing)
# ---------------------------------------------------------------------------

router = APIRouter()


@router.get("/dashboard")
async def get_admin_dashboard(
    user: CurrentUser = Depends(get_current_user),
):
    """Get admin dashboard summary."""
    return {
        "total_students": 0,
        "total_faculty": 0,
        "fee_collection_this_semester": 0,
        "pending_admissions": 0,
    }


@router.get("/students")
async def list_students(
    user: CurrentUser = Depends(get_current_user),
):
    """List students with pagination."""
    return {"data": [], "total": 0}


@router.get("/faculty")
async def list_faculty(
    user: CurrentUser = Depends(get_current_user),
):
    """List faculty with pagination."""
    return {"data": [], "total": 0}


@router.get("/fees")
async def list_fee_structures(
    user: CurrentUser = Depends(get_current_user),
):
    """List fee structures."""
    return {"data": [], "total": 0}


# ---------------------------------------------------------------------------
# Department CRUD router — REFERENCE PATTERN
# ---------------------------------------------------------------------------

department_router = APIRouter()


def _get_department_service(
    db: AsyncSession = Depends(get_tenant_db),
) -> DepartmentService:
    """Dependency that creates a DepartmentService with the tenant-scoped DB session."""
    return DepartmentService(db)


@department_router.post(
    "/",
    response_model=DepartmentResponse,
    status_code=201,
)
async def create_department(
    data: DepartmentCreate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    service: DepartmentService = Depends(_get_department_service),
):
    """Create a new department.

    Requires: admin, dean, or management role.
    """
    return await service.create(college_id=user.college_id, data=data)


@department_router.get(
    "/",
    response_model=DepartmentListResponse,
)
async def list_departments(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None, max_length=100),
    nmc_type: str | None = Query(None, pattern="^(preclinical|paraclinical|clinical)$"),
    active_only: bool = Query(True),
    user: CurrentUser = Depends(get_current_user),
    service: DepartmentService = Depends(_get_department_service),
):
    """List departments with pagination, search, and filtering.

    Requires: any authenticated user.
    """
    return await service.list(
        page=page,
        page_size=page_size,
        search=search,
        nmc_type=nmc_type,
        active_only=active_only,
    )


@department_router.get(
    "/{department_id}",
    response_model=DepartmentResponse,
)
async def get_department(
    department_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    service: DepartmentService = Depends(_get_department_service),
):
    """Get a single department by ID.

    Requires: any authenticated user.
    """
    return await service.get_by_id(department_id)


@department_router.patch(
    "/{department_id}",
    response_model=DepartmentResponse,
)
async def update_department(
    department_id: UUID,
    data: DepartmentUpdate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN)
    ),
    service: DepartmentService = Depends(_get_department_service),
):
    """Update a department.

    Requires: admin or dean role.
    """
    return await service.update(department_id, data)


@department_router.delete(
    "/{department_id}",
    status_code=204,
)
async def delete_department(
    department_id: UUID,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN)
    ),
    service: DepartmentService = Depends(_get_department_service),
):
    """Soft-delete a department (sets is_active=False).

    Requires: admin or dean role.
    """
    await service.delete(department_id)
