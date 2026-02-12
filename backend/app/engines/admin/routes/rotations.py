"""Admin Engine — Clinical Rotation Routes.

Prefix: /api/v1/admin/rotations
CRUD for clinical rotations plus a Gantt-chart matrix endpoint
that groups rotations by student for a given batch/phase.
"""

import math
from collections import defaultdict
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user, get_tenant_db, require_role
from app.engines.faculty import ClinicalRotation
from app.engines.admin.schemas import (
    ClinicalRotationCreate,
    ClinicalRotationListResponse,
    ClinicalRotationResponse,
    ClinicalRotationUpdate,
)
from app.middleware.clerk_auth import CurrentUser, UserRole
from app.shared.exceptions import NotFoundException

router = APIRouter()


# ---------------------------------------------------------------------------
# LIST — GET /
# ---------------------------------------------------------------------------

@router.get("/", response_model=ClinicalRotationListResponse)
async def list_rotations(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    student_id: UUID | None = Query(None, description="Filter by student"),
    department_id: UUID | None = Query(None, description="Filter by department"),
    batch_id: UUID | None = Query(None, description="Filter by batch"),
    phase: str | None = Query(None, description="Filter by phase (Phase II, Phase III Part 1, etc.)"),
    status: str | None = Query(None, description="Filter by status (scheduled, active, completed, assessed)"),
    is_crmi: bool | None = Query(None, description="Filter CRMI rotations only"),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List clinical rotations with pagination and filters.

    All filters are optional and combinable. Results ordered by start_date ascending.
    """
    query = select(ClinicalRotation)

    if student_id is not None:
        query = query.where(ClinicalRotation.student_id == student_id)

    if department_id is not None:
        query = query.where(ClinicalRotation.department_id == department_id)

    if batch_id is not None:
        query = query.where(ClinicalRotation.batch_id == batch_id)

    if phase is not None:
        query = query.where(ClinicalRotation.phase == phase)

    if status is not None:
        query = query.where(ClinicalRotation.status == status)

    if is_crmi is not None:
        query = query.where(ClinicalRotation.is_crmi.is_(is_crmi))

    # Count total matching rows
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = (
        query
        .order_by(ClinicalRotation.start_date.asc())
        .offset(offset)
        .limit(page_size)
    )
    result = await db.execute(query)
    rotations = result.scalars().all()

    return ClinicalRotationListResponse(
        data=[ClinicalRotationResponse.model_validate(r) for r in rotations],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


# ---------------------------------------------------------------------------
# MATRIX — GET /matrix (Gantt chart data)
# ---------------------------------------------------------------------------

@router.get("/matrix")
async def get_rotation_matrix(
    batch_id: UUID | None = Query(None, description="Filter by batch"),
    phase: str | None = Query(None, description="Filter by phase"),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get rotation matrix data for Gantt chart visualization.

    Returns all rotations grouped by student_id. Each student maps to
    a list of their rotation assignments with department, dates, and status.
    Useful for building a visual rotation matrix / Gantt chart on the frontend.

    Response shape:
    {
        "student_rotations": {
            "<student_id>": [ClinicalRotationResponse, ...],
            ...
        },
        "total_students": int
    }
    """
    query = select(ClinicalRotation)

    if batch_id is not None:
        query = query.where(ClinicalRotation.batch_id == batch_id)

    if phase is not None:
        query = query.where(ClinicalRotation.phase == phase)

    query = query.order_by(
        ClinicalRotation.student_id.asc(),
        ClinicalRotation.start_date.asc(),
    )

    result = await db.execute(query)
    rotations = result.scalars().all()

    # Group by student_id
    student_rotations: dict[str, list[dict]] = defaultdict(list)
    for rotation in rotations:
        key = str(rotation.student_id)
        student_rotations[key].append(
            ClinicalRotationResponse.model_validate(rotation).model_dump(mode="json")
        )

    return {
        "student_rotations": dict(student_rotations),
        "total_students": len(student_rotations),
    }


# ---------------------------------------------------------------------------
# GET — GET /{rotation_id}
# ---------------------------------------------------------------------------

@router.get("/{rotation_id}", response_model=ClinicalRotationResponse)
async def get_rotation(
    rotation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get a single clinical rotation by ID."""
    result = await db.execute(
        select(ClinicalRotation).where(ClinicalRotation.id == rotation_id)
    )
    rotation = result.scalar_one_or_none()

    if rotation is None:
        raise NotFoundException("ClinicalRotation", str(rotation_id))

    return ClinicalRotationResponse.model_validate(rotation)


# ---------------------------------------------------------------------------
# CREATE — POST /
# ---------------------------------------------------------------------------

@router.post("/", response_model=ClinicalRotationResponse, status_code=201)
async def create_rotation(
    data: ClinicalRotationCreate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Create a new clinical rotation assignment.

    Requires: admin, dean, or management role.
    Links a student to a department for a date range with optional
    supervisor assignment and hour requirements.
    """
    rotation = ClinicalRotation(
        college_id=user.college_id,
        **data.model_dump(exclude_unset=True),
    )
    db.add(rotation)
    await db.commit()
    await db.refresh(rotation)

    return ClinicalRotationResponse.model_validate(rotation)


# ---------------------------------------------------------------------------
# UPDATE — PATCH /{rotation_id}
# ---------------------------------------------------------------------------

@router.patch("/{rotation_id}", response_model=ClinicalRotationResponse)
async def update_rotation(
    rotation_id: UUID,
    data: ClinicalRotationUpdate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Update an existing clinical rotation.

    Requires: admin, dean, or management role.
    Typically used to update completed_hours, posting_assessment_score,
    attendance_percentage, or status transitions.
    """
    result = await db.execute(
        select(ClinicalRotation).where(ClinicalRotation.id == rotation_id)
    )
    rotation = result.scalar_one_or_none()

    if rotation is None:
        raise NotFoundException("ClinicalRotation", str(rotation_id))

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(rotation, field, value)

    await db.commit()
    await db.refresh(rotation)

    return ClinicalRotationResponse.model_validate(rotation)
