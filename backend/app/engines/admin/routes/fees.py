"""Admin Engine — Fee Routes.

Full CRUD for FeeStructure and FeePayment with fee calculation,
installment schedules, regulatory checks, defaulter lists, and
collection summaries.

Prefix: mounted by the parent router (typically /api/v1/admin/fees).
"""

import math
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user, get_tenant_db, require_role
from app.engines.admin.models import FeePayment, FeeStructure, Student
from app.engines.admin.schemas import (
    FeePaymentCreate,
    FeePaymentListResponse,
    FeePaymentResponse,
    FeeStructureCreate,
    FeeStructureListResponse,
    FeeStructureResponse,
    FeeStructureUpdate,
)
from app.engines.admin.services.fee_calculator import FeeCalculatorService
from app.middleware.clerk_auth import CurrentUser, UserRole
from app.shared.exceptions import NotFoundException

router = APIRouter()


# ---------------------------------------------------------------------------
# Helper: get FeeCalculatorService instance
# ---------------------------------------------------------------------------

def _get_fee_service(
    db: AsyncSession = Depends(get_tenant_db),
) -> FeeCalculatorService:
    return FeeCalculatorService(db)


# ===================================================================
# Fee Structure CRUD
# ===================================================================


# ---------------------------------------------------------------------------
# GET /structures — list fee structures with filters
# ---------------------------------------------------------------------------

@router.get("/structures", response_model=FeeStructureListResponse)
async def list_fee_structures(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    academic_year: str | None = Query(None, description="Filter by academic year"),
    quota: str | None = Query(None, description="Filter by quota (AIQ, State, Management, NRI)"),
    is_active: bool | None = Query(None, description="Filter by active status"),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List fee structures with pagination and filters.

    Filters can be combined. Defaults to returning all structures.
    """
    query = select(FeeStructure)

    if academic_year is not None:
        query = query.where(FeeStructure.academic_year == academic_year)

    if quota is not None:
        query = query.where(FeeStructure.quota == quota)

    if is_active is not None:
        query = query.where(FeeStructure.is_active.is_(is_active))

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = (
        query
        .order_by(FeeStructure.academic_year.desc(), FeeStructure.quota)
        .offset(offset)
        .limit(page_size)
    )

    result = await db.execute(query)
    structures = result.scalars().all()

    return FeeStructureListResponse(
        data=[FeeStructureResponse.model_validate(s) for s in structures],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


# ---------------------------------------------------------------------------
# GET /structures/{structure_id} — get single fee structure
# ---------------------------------------------------------------------------

@router.get("/structures/{structure_id}", response_model=FeeStructureResponse)
async def get_fee_structure(
    structure_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get a single fee structure by ID."""
    result = await db.execute(
        select(FeeStructure).where(FeeStructure.id == structure_id)
    )
    structure = result.scalar_one_or_none()

    if structure is None:
        raise NotFoundException("FeeStructure", str(structure_id))

    return FeeStructureResponse.model_validate(structure)


# ---------------------------------------------------------------------------
# POST /structures — create fee structure (requires admin)
# ---------------------------------------------------------------------------

@router.post("/structures", response_model=FeeStructureResponse, status_code=201)
async def create_fee_structure(
    data: FeeStructureCreate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Create a new fee structure.

    Requires: admin, dean, or management role.
    All monetary values are in paisa (1 rupee = 100 paisa).
    """
    structure = FeeStructure(
        college_id=user.college_id,
        **data.model_dump(),
    )
    db.add(structure)
    await db.commit()
    await db.refresh(structure)

    return FeeStructureResponse.model_validate(structure)


# ---------------------------------------------------------------------------
# PATCH /structures/{structure_id} — update fee structure
# ---------------------------------------------------------------------------

@router.patch("/structures/{structure_id}", response_model=FeeStructureResponse)
async def update_fee_structure(
    structure_id: UUID,
    data: FeeStructureUpdate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Update a fee structure.

    Requires: admin, dean, or management role.
    Only provided (non-None) fields are updated.
    """
    result = await db.execute(
        select(FeeStructure).where(FeeStructure.id == structure_id)
    )
    structure = result.scalar_one_or_none()

    if structure is None:
        raise NotFoundException("FeeStructure", str(structure_id))

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(structure, field, value)

    await db.commit()
    await db.refresh(structure)

    return FeeStructureResponse.model_validate(structure)


# ---------------------------------------------------------------------------
# DELETE /structures/{structure_id} — soft delete (is_active=False)
# ---------------------------------------------------------------------------

@router.delete("/structures/{structure_id}", status_code=204)
async def delete_fee_structure(
    structure_id: UUID,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Soft-delete a fee structure by setting is_active to False.

    Requires: admin, dean, or management role.
    Fee structures are never hard-deleted due to audit and payment linkage.
    """
    result = await db.execute(
        select(FeeStructure).where(FeeStructure.id == structure_id)
    )
    structure = result.scalar_one_or_none()

    if structure is None:
        raise NotFoundException("FeeStructure", str(structure_id))

    structure.is_active = False
    await db.commit()


# ===================================================================
# Fee Structure — Computed endpoints (via FeeCalculatorService)
# ===================================================================


# ---------------------------------------------------------------------------
# GET /structures/{structure_id}/total — calculate total fee for a student
# ---------------------------------------------------------------------------

@router.get("/structures/{structure_id}/total")
async def get_fee_total(
    structure_id: UUID,
    student_id: UUID = Query(..., description="Student ID to calculate fee for"),
    academic_year: str = Query(..., description="Academic year (e.g. 2025-26)"),
    user: CurrentUser = Depends(get_current_user),
    service: FeeCalculatorService = Depends(_get_fee_service),
):
    """Calculate total fee for a student based on their quota and academic year.

    Uses the student's quota, hostel status, and gender to determine
    applicable fee components. Returns a component-wise breakdown.
    """
    return await service.calculate_total_fee(
        student_id=student_id,
        academic_year=academic_year,
    )


# ---------------------------------------------------------------------------
# GET /structures/{structure_id}/installments — installment schedule
# ---------------------------------------------------------------------------

@router.get("/structures/{structure_id}/installments")
async def get_installment_schedule(
    structure_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    service: FeeCalculatorService = Depends(_get_fee_service),
):
    """Get the installment schedule for a fee structure.

    Returns installment numbers, due dates, percentages, and amounts
    based on the fee structure's installment configuration.
    """
    return await service.generate_installment_schedule(
        fee_structure_id=structure_id,
    )


# ---------------------------------------------------------------------------
# GET /structures/{structure_id}/regulatory-check — check against FRC cap
# ---------------------------------------------------------------------------

@router.get("/structures/{structure_id}/regulatory-check")
async def check_regulatory_compliance(
    structure_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    service: FeeCalculatorService = Depends(_get_fee_service),
):
    """Check if fee structure is within the state Fee Regulatory Committee cap.

    Returns compliance status, total fee, regulatory cap, and any
    excess amount if the structure exceeds the approved limit.
    """
    return await service.check_fee_regulatory_compliance(
        fee_structure_id=structure_id,
    )


# ===================================================================
# Fee Payment CRUD
# ===================================================================


# ---------------------------------------------------------------------------
# GET /payments — list payments with filters
# ---------------------------------------------------------------------------

@router.get("/payments", response_model=FeePaymentListResponse)
async def list_fee_payments(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    student_id: UUID | None = Query(None, description="Filter by student"),
    academic_year: str | None = Query(None, description="Filter by academic year"),
    status: str | None = Query(None, description="Filter by payment status"),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List fee payments with pagination and filters.

    Filters can be combined. Returns payments ordered by most recent first.
    """
    query = select(FeePayment)

    if student_id is not None:
        query = query.where(FeePayment.student_id == student_id)

    if academic_year is not None:
        query = query.where(FeePayment.academic_year == academic_year)

    if status is not None:
        query = query.where(FeePayment.status == status)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = (
        query
        .order_by(FeePayment.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )

    result = await db.execute(query)
    payments = result.scalars().all()

    return FeePaymentListResponse(
        data=[FeePaymentResponse.model_validate(p) for p in payments],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


# ---------------------------------------------------------------------------
# POST /record-payment — record an offline payment (requires admin)
# ---------------------------------------------------------------------------

@router.post("/record-payment", response_model=FeePaymentResponse, status_code=201)
async def record_payment(
    data: FeePaymentCreate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Record an offline fee payment (cash, DD, NEFT, etc.).

    Requires: admin, dean, or management role.
    For Razorpay online payments, use the Integration Engine webhook.
    Validates that the referenced student exists within the same tenant.
    If a fee_structure_id is provided, validates that it exists as well.
    """
    # Verify student exists (RLS ensures same tenant)
    student_result = await db.execute(
        select(Student).where(Student.id == data.student_id)
    )
    if student_result.scalar_one_or_none() is None:
        raise NotFoundException("Student", str(data.student_id))

    # Verify fee structure exists if provided
    if data.fee_structure_id is not None:
        fs_result = await db.execute(
            select(FeeStructure).where(FeeStructure.id == data.fee_structure_id)
        )
        if fs_result.scalar_one_or_none() is None:
            raise NotFoundException("FeeStructure", str(data.fee_structure_id))

    payment = FeePayment(
        college_id=user.college_id,
        recorded_by=user.college_id,  # Use user context for audit
        status="captured",  # Offline payments are immediately captured
        **data.model_dump(),
    )
    db.add(payment)
    await db.commit()
    await db.refresh(payment)

    return FeePaymentResponse.model_validate(payment)


# ===================================================================
# Fee Analytics — Computed endpoints (via FeeCalculatorService)
# ===================================================================


# ---------------------------------------------------------------------------
# GET /defaulters — list students with overdue fees
# ---------------------------------------------------------------------------

@router.get("/defaulters")
async def get_defaulters(
    academic_year: str = Query(..., description="Academic year to check (e.g. 2025-26)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
    service: FeeCalculatorService = Depends(_get_fee_service),
):
    """List students with overdue fee installments.

    Compares installment due dates (plus grace period) against payment
    records to identify defaulters. Includes late fee calculations.
    """
    return await service.get_defaulters(
        academic_year=academic_year,
        page=page,
        page_size=page_size,
    )


# ---------------------------------------------------------------------------
# GET /collection-summary — collection by quota
# ---------------------------------------------------------------------------

@router.get("/collection-summary")
async def get_collection_summary(
    academic_year: str = Query(..., description="Academic year (e.g. 2025-26)"),
    user: CurrentUser = Depends(get_current_user),
    service: FeeCalculatorService = Depends(_get_fee_service),
):
    """Fee collection summary grouped by quota.

    Returns expected vs collected amounts per quota (AIQ, State,
    Management, NRI) along with collection percentages and grand totals.
    """
    return await service.get_collection_summary(academic_year=academic_year)
