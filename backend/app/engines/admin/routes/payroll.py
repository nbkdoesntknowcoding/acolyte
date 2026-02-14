"""Admin Engine — Payroll Routes.

Prefix: /api/v1/admin/payroll
Handles payroll calculation, approval, bank file generation, salary structures,
and statutory (EPF/ESI/TDS/PT) summary reporting.

All monetary values in paisa (1 rupee = 100 paisa).
"""

import math
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user, get_tenant_db, require_role
from app.engines.admin import models
from app.engines.admin import schemas
from app.engines.admin.services.payroll_processor import PayrollProcessorService
from app.middleware.clerk_auth import CurrentUser, UserRole

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_payroll_service(
    db: AsyncSession = Depends(get_tenant_db),
) -> PayrollProcessorService:
    """Dependency that creates a PayrollProcessorService with the tenant-scoped DB session."""
    return PayrollProcessorService(db)


# ---------------------------------------------------------------------------
# Payroll Records
# ---------------------------------------------------------------------------

@router.get(
    "/",
    response_model=schemas.PayrollRecordListResponse,
)
async def list_payroll_records(
    faculty_id: UUID | None = Query(None),
    month: int | None = Query(None, ge=1, le=12),
    year: int | None = Query(None, ge=2000, le=2100),
    status: str | None = Query(None, pattern="^(draft|calculated|approved|disbursed)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List payroll records with optional filters and pagination.

    Requires: any authenticated user.
    """
    query = select(models.PayrollRecord)
    count_query = select(func.count(models.PayrollRecord.id))

    # Apply filters
    if faculty_id is not None:
        query = query.where(models.PayrollRecord.faculty_id == faculty_id)
        count_query = count_query.where(models.PayrollRecord.faculty_id == faculty_id)
    if month is not None:
        query = query.where(models.PayrollRecord.month == month)
        count_query = count_query.where(models.PayrollRecord.month == month)
    if year is not None:
        query = query.where(models.PayrollRecord.year == year)
        count_query = count_query.where(models.PayrollRecord.year == year)
    if status is not None:
        query = query.where(models.PayrollRecord.status == status)
        count_query = count_query.where(models.PayrollRecord.status == status)

    # Total count
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    total_pages = math.ceil(total / page_size) if total > 0 else 0

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(
        models.PayrollRecord.year.desc(),
        models.PayrollRecord.month.desc(),
        models.PayrollRecord.created_at.desc(),
    ).offset(offset).limit(page_size)

    result = await db.execute(query)
    records = result.scalars().all()

    return schemas.PayrollRecordListResponse(
        data=[schemas.PayrollRecordResponse.model_validate(r) for r in records],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post(
    "/calculate",
    status_code=200,
)
async def calculate_payroll(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000, le=2100),
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
    service: PayrollProcessorService = Depends(_get_payroll_service),
):
    """Calculate payroll for all active faculty for a given month/year.

    Computes salary breakdowns (basic, DA, HRA, NPA, transport) and
    statutory deductions (EPF, ESI, TDS, PT) for each faculty member.
    Saves PayrollRecord entries with status='calculated'.

    Requires: admin, dean, or management role.
    """
    batch_result = await service.calculate_batch_payroll(month, year)

    # Save computed records to DB
    records = batch_result.get("records", [])
    if records:
        created_ids = await service.save_payroll_records(records, user.college_id)
        await db.commit()
        batch_result["saved_record_ids"] = [str(rid) for rid in created_ids]

    return batch_result


@router.post(
    "/approve",
    status_code=200,
)
async def approve_payroll(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000, le=2100),
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Approve all calculated payroll records for a given month/year.

    Sets status='approved' and records the approver and timestamp.

    Requires: admin role.
    """
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(models.PayrollRecord).where(
            models.PayrollRecord.month == month,
            models.PayrollRecord.year == year,
            models.PayrollRecord.status == "calculated",
        )
    )
    records = result.scalars().all()

    approved_count = 0
    for record in records:
        record.status = "approved"
        record.approved_by = UUID(user.user_id) if len(user.user_id) == 36 else None
        record.approved_at = now
        approved_count += 1

    await db.commit()

    return {
        "month": month,
        "year": year,
        "approved_count": approved_count,
        "approved_at": now.isoformat(),
    }


@router.post(
    "/generate-bank-file",
    status_code=200,
)
async def generate_bank_file(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000, le=2100),
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    service: PayrollProcessorService = Depends(_get_payroll_service),
):
    """Generate NEFT/RTGS bank transfer data for bulk salary disbursement.

    Returns structured transfer data with beneficiary details and amounts.

    Requires: admin, dean, or management role.
    """
    return await service.generate_bank_file(month, year)


@router.get(
    "/statutory-summary",
    status_code=200,
)
async def get_statutory_summary(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000, le=2100),
    user: CurrentUser = Depends(get_current_user),
    service: PayrollProcessorService = Depends(_get_payroll_service),
):
    """Get EPF/ESI/TDS/PT statutory deduction totals for a given month/year.

    Used for statutory compliance reporting and challan preparation.

    Requires: any authenticated user.
    """
    return await service.get_statutory_summary(month, year)


# ---------------------------------------------------------------------------
# Salary Structures
# ---------------------------------------------------------------------------

@router.get(
    "/salary-structures",
    response_model=schemas.SalaryStructureListResponse,
)
async def list_salary_structures(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List salary structures with pagination.

    Requires: any authenticated user.
    """
    query = select(models.SalaryStructure)
    count_query = select(func.count(models.SalaryStructure.id))

    # Total count
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    total_pages = math.ceil(total / page_size) if total > 0 else 0

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(
        models.SalaryStructure.designation.asc(),
    ).offset(offset).limit(page_size)

    result = await db.execute(query)
    structures = result.scalars().all()

    return schemas.SalaryStructureListResponse(
        data=[schemas.SalaryStructureResponse.model_validate(s) for s in structures],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post(
    "/salary-structures",
    response_model=schemas.SalaryStructureResponse,
    status_code=201,
)
async def create_salary_structure(
    data: schemas.SalaryStructureCreate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Create a new salary structure.

    Requires: admin role.
    """
    structure = models.SalaryStructure(
        college_id=user.college_id,
        designation=data.designation,
        pay_scale_type=data.pay_scale_type,
        pay_level=data.pay_level,
        pay_band_min=data.pay_band_min,
        pay_band_max=data.pay_band_max,
        basic_pay=data.basic_pay,
        da_percentage=data.da_percentage,
        hra_percentage=data.hra_percentage,
        npa_percentage=data.npa_percentage,
        transport_allowance=data.transport_allowance,
    )
    db.add(structure)
    await db.commit()
    await db.refresh(structure)

    return schemas.SalaryStructureResponse.model_validate(structure)


@router.patch(
    "/salary-structures/{structure_id}",
    response_model=schemas.SalaryStructureResponse,
)
async def update_salary_structure(
    structure_id: UUID,
    data: schemas.SalaryStructureUpdate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Update an existing salary structure.

    Only provided fields are updated (partial update via PATCH).

    Requires: admin, dean, or management role.
    """
    from app.shared.exceptions import NotFoundException

    result = await db.execute(
        select(models.SalaryStructure).where(
            models.SalaryStructure.id == structure_id,
        )
    )
    structure = result.scalar_one_or_none()
    if structure is None:
        raise NotFoundException("SalaryStructure", str(structure_id))

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(structure, field, value)

    await db.commit()
    await db.refresh(structure)

    return schemas.SalaryStructureResponse.model_validate(structure)
