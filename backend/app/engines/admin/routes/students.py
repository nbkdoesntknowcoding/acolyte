"""Student CRUD routes for the Admin Engine.

Prefix: /students (mounted under /api/v1/admin)
Full CRUD with search, filters, pagination, promotion, fee summary,
seat matrix, and NMC upload marking.
"""

import math
from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user, get_tenant_db, require_role
from app.engines.admin.models import College, Student
from app.engines.admin.schemas import (
    SeatMatrixItem,
    StudentCreate,
    StudentListResponse,
    StudentResponse,
    StudentUpdate,
)
from app.engines.admin.services.fee_calculator import FeeCalculatorService
from app.middleware.clerk_auth import CurrentUser, UserRole

router = APIRouter()

# ---------------------------------------------------------------------------
# Phase ordering for promotion logic
# ---------------------------------------------------------------------------

_PHASE_ORDER = ["Phase I", "Phase II", "Phase III Part 1", "Phase III Part 2", "CRMI"]
_PHASE_SEMESTERS: dict[str, int] = {
    "Phase I": 2,
    "Phase II": 3,
    "Phase III Part 1": 2,
    "Phase III Part 2": 2,
    "CRMI": 2,
}


# ---------------------------------------------------------------------------
# Request/response schemas for specialized endpoints
# ---------------------------------------------------------------------------

class PromoteRequest(BaseModel):
    """Body for the promote endpoint."""
    target_phase: str | None = Field(
        default=None,
        description="Target phase to promote to. If omitted, promotes to next phase/semester automatically.",
    )
    target_semester: int | None = Field(
        default=None,
        description="Target semester within the phase. If omitted, auto-increments.",
    )


class NMCUploadRequest(BaseModel):
    """Body for marking students as uploaded to NMC portal."""
    student_ids: list[UUID] = Field(
        ..., min_length=1, max_length=500, description="List of student IDs to mark."
    )


class NMCUploadResponse(BaseModel):
    """Response for the NMC upload endpoint."""
    updated_count: int
    student_ids: list[UUID]


# ---------------------------------------------------------------------------
# Service dependency
# ---------------------------------------------------------------------------

def _get_fee_service(db: AsyncSession = Depends(get_tenant_db)) -> FeeCalculatorService:
    return FeeCalculatorService(db)


# ---------------------------------------------------------------------------
# LIST — GET /
# ---------------------------------------------------------------------------

@router.get("/", response_model=StudentListResponse)
async def list_students(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: str | None = Query(None, max_length=200, description="Search by name or enrollment number"),
    status_filter: str | None = Query(None, alias="status", description="Filter by status"),
    batch_id: UUID | None = Query(None, description="Filter by batch"),
    current_phase: str | None = Query(None, description="Filter by current phase"),
    admission_quota: str | None = Query(None, description="Filter by admission quota"),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List students with pagination, search, and filters.

    Search matches against student name and enrollment number (case-insensitive).
    All filters are optional and combinable.
    """
    # Base query — RLS already filters by college_id
    query = select(Student)

    # Search
    if search:
        pattern = f"%{search}%"
        query = query.where(
            or_(
                Student.name.ilike(pattern),
                Student.enrollment_number.ilike(pattern),
            )
        )

    # Filters
    if status_filter:
        query = query.where(Student.status == status_filter)
    if batch_id:
        query = query.where(Student.batch_id == batch_id)
    if current_phase:
        query = query.where(Student.current_phase == current_phase)
    if admission_quota:
        query = query.where(Student.admission_quota == admission_quota)

    # Count total matching rows
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(Student.name.asc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    students = result.scalars().all()

    return StudentListResponse(
        data=[StudentResponse.model_validate(s) for s in students],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 0,
    )


# ---------------------------------------------------------------------------
# GET — GET /{student_id}
# ---------------------------------------------------------------------------

@router.get("/{student_id}", response_model=StudentResponse)
async def get_student(
    student_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get a single student by ID."""
    result = await db.execute(
        select(Student).where(Student.id == student_id)
    )
    student = result.scalar_one_or_none()
    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student {student_id} not found",
        )
    return StudentResponse.model_validate(student)


# ---------------------------------------------------------------------------
# CREATE — POST /
# ---------------------------------------------------------------------------

@router.post("/", response_model=StudentResponse, status_code=201)
async def create_student(
    data: StudentCreate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Create a new student record.

    Requires: admin, dean, or management role.
    """
    student = Student(
        college_id=user.college_id,
        **data.model_dump(exclude_unset=True),
    )
    db.add(student)
    await db.commit()
    await db.refresh(student)
    return StudentResponse.model_validate(student)


# ---------------------------------------------------------------------------
# UPDATE — PATCH /{student_id}
# ---------------------------------------------------------------------------

@router.patch("/{student_id}", response_model=StudentResponse)
async def update_student(
    student_id: UUID,
    data: StudentUpdate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Update an existing student record.

    Requires: admin, dean, or management role.
    Only fields present in the request body are updated.
    """
    result = await db.execute(
        select(Student).where(Student.id == student_id)
    )
    student = result.scalar_one_or_none()
    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student {student_id} not found",
        )

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(student, field, value)

    await db.commit()
    await db.refresh(student)
    return StudentResponse.model_validate(student)


# ---------------------------------------------------------------------------
# DELETE (soft) — DELETE /{student_id}
# ---------------------------------------------------------------------------

@router.delete("/{student_id}", status_code=204)
async def delete_student(
    student_id: UUID,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Soft-delete a student by setting status to 'dropped'.

    Requires: admin, dean, or management role.
    """
    result = await db.execute(
        select(Student).where(Student.id == student_id)
    )
    student = result.scalar_one_or_none()
    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student {student_id} not found",
        )

    student.status = "dropped"
    await db.commit()


# ---------------------------------------------------------------------------
# PROMOTE — POST /{student_id}/promote
# ---------------------------------------------------------------------------

@router.post("/{student_id}/promote", response_model=StudentResponse)
async def promote_student(
    student_id: UUID,
    body: PromoteRequest | None = None,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Promote a student to the next phase or semester.

    If target_phase / target_semester are provided they are used directly.
    Otherwise the next phase/semester is computed automatically:
    - Increment semester within current phase
    - If max semester reached, advance to next phase (semester 1)
    - If already in final phase, raise 400

    Requires: admin, dean, or management role.
    """
    result = await db.execute(
        select(Student).where(Student.id == student_id)
    )
    student = result.scalar_one_or_none()
    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student {student_id} not found",
        )

    if student.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot promote student with status '{student.status}'. Must be 'active'.",
        )

    if body is None:
        body = PromoteRequest()

    if body.target_phase is not None:
        # Explicit promotion target
        student.current_phase = body.target_phase
        student.current_semester = body.target_semester or 1
    else:
        # Auto-compute next phase/semester
        current_phase = student.current_phase or _PHASE_ORDER[0]
        current_semester = student.current_semester or 1

        if current_phase not in _PHASE_ORDER:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown phase '{current_phase}'. Cannot auto-promote.",
            )

        max_sem = _PHASE_SEMESTERS.get(current_phase, 2)

        if current_semester < max_sem:
            # Next semester in same phase
            student.current_semester = current_semester + 1
        else:
            # Advance to next phase
            phase_idx = _PHASE_ORDER.index(current_phase)
            if phase_idx >= len(_PHASE_ORDER) - 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Student is already in final phase '{current_phase}'. "
                           "Consider graduating instead.",
                )
            student.current_phase = _PHASE_ORDER[phase_idx + 1]
            student.current_semester = 1

    await db.commit()
    await db.refresh(student)
    return StudentResponse.model_validate(student)


# ---------------------------------------------------------------------------
# FEE SUMMARY — GET /{student_id}/fee-summary
# ---------------------------------------------------------------------------

@router.get("/{student_id}/fee-summary")
async def get_student_fee_summary(
    student_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    fee_service: FeeCalculatorService = Depends(_get_fee_service),
):
    """Fee status for a single student — total, paid, outstanding.

    Uses FeeCalculatorService.calculate_outstanding which aggregates
    across all academic years and fee structures matching the student's quota.
    """
    return await fee_service.calculate_outstanding(student_id)


# ---------------------------------------------------------------------------
# SEAT MATRIX — GET /seat-matrix
# ---------------------------------------------------------------------------

@router.get("/seat-matrix", response_model=list[SeatMatrixItem])
async def get_seat_matrix(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Quota-wise seat fill status.

    Returns the number of total seats, filled seats, and vacancies per
    admission quota based on the college's sanctioned/total intake and
    current active/enrolled students.
    """
    # Get college info for sanctioned intake
    college_result = await db.execute(
        select(College).where(College.id == user.college_id)
    )
    college = college_result.scalar_one_or_none()
    total_intake = college.total_intake if college else 0

    # NMC standard quota splits (percentage of total intake)
    # Colleges can override via config, but these are the regulatory defaults
    quota_percentages: dict[str, float] = {
        "AIQ": 0.15,
        "State": 0.50,
        "Management": 0.25,
        "NRI": 0.10,
    }

    # Override from college config if available
    if college and college.config and "quota_percentages" in college.config:
        quota_percentages = college.config["quota_percentages"]

    # Count filled seats per quota (active + enrolled students)
    filled_result = await db.execute(
        select(
            Student.admission_quota,
            func.count(Student.id),
        ).where(
            Student.status.in_(["active", "enrolled"]),
        ).group_by(Student.admission_quota)
    )
    filled_by_quota: dict[str, int] = {
        (row[0] or "Unknown"): row[1] for row in filled_result.all()
    }

    seat_matrix: list[SeatMatrixItem] = []
    for quota, pct in quota_percentages.items():
        total_seats = math.ceil(total_intake * pct)
        filled = filled_by_quota.get(quota, 0)
        vacant = max(0, total_seats - filled)
        fill_pct = round((filled / total_seats * 100), 1) if total_seats > 0 else 0.0

        seat_matrix.append(
            SeatMatrixItem(
                quota=quota,
                total_seats=total_seats,
                filled_seats=filled,
                vacant_seats=vacant,
                fill_percentage=fill_pct,
            )
        )

    return seat_matrix


# ---------------------------------------------------------------------------
# NMC UPLOAD — POST /nmc-upload
# ---------------------------------------------------------------------------

@router.post("/nmc-upload", response_model=NMCUploadResponse)
async def mark_nmc_uploaded(
    body: NMCUploadRequest,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Mark students as uploaded to the NMC portal.

    Sets nmc_uploaded=True and nmc_upload_date=now() for all provided student IDs.
    Only updates students that belong to the current tenant (RLS-enforced).

    Requires: admin, dean, or management role.
    """
    now = datetime.now(timezone.utc)

    result = await db.execute(
        update(Student)
        .where(Student.id.in_(body.student_ids))
        .values(nmc_uploaded=True, nmc_upload_date=now)
        .returning(Student.id)
    )
    updated_ids = [row[0] for row in result.all()]
    await db.commit()

    if not updated_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No matching students found for the given IDs",
        )

    return NMCUploadResponse(
        updated_count=len(updated_ids),
        student_ids=updated_ids,
    )
