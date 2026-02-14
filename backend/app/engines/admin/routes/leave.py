"""Admin Engine — Leave Management Routes.

Prefix: /api/v1/admin/leave
Handles leave requests, approvals/rejections, leave balances, and leave policies.

Leave types: casual_leave, earned_leave, medical_leave, study_leave,
maternity_leave, sabbatical, duty_leave, examination_duty.
"""

import math
from datetime import date, datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user, get_tenant_db, require_role
from app.engines.admin import models
from app.engines.admin import schemas
from app.middleware.clerk_auth import CurrentUser, UserRole
from app.shared.exceptions import NotFoundException

router = APIRouter()


# ---------------------------------------------------------------------------
# Leave Requests
# ---------------------------------------------------------------------------

@router.get(
    "/",
    response_model=schemas.LeaveRequestListResponse,
)
async def list_leave_requests(
    employee_id: UUID | None = Query(None),
    leave_type: str | None = Query(None),
    status: str | None = Query(
        None,
        pattern="^(pending|partially_approved|approved|rejected|cancelled)$",
    ),
    from_date: date | None = Query(None),
    to_date: date | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List leave requests with optional filters and pagination.

    Requires: any authenticated user.
    """
    query = select(models.LeaveRequest)
    count_query = select(func.count(models.LeaveRequest.id))

    # Apply filters
    if employee_id is not None:
        query = query.where(models.LeaveRequest.employee_id == employee_id)
        count_query = count_query.where(models.LeaveRequest.employee_id == employee_id)
    if leave_type is not None:
        query = query.where(models.LeaveRequest.leave_type == leave_type)
        count_query = count_query.where(models.LeaveRequest.leave_type == leave_type)
    if status is not None:
        query = query.where(models.LeaveRequest.status == status)
        count_query = count_query.where(models.LeaveRequest.status == status)
    if from_date is not None:
        query = query.where(models.LeaveRequest.from_date >= from_date)
        count_query = count_query.where(models.LeaveRequest.from_date >= from_date)
    if to_date is not None:
        query = query.where(models.LeaveRequest.to_date <= to_date)
        count_query = count_query.where(models.LeaveRequest.to_date <= to_date)

    # Total count
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    total_pages = math.ceil(total / page_size) if total > 0 else 0

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(
        models.LeaveRequest.created_at.desc(),
    ).offset(offset).limit(page_size)

    result = await db.execute(query)
    records = result.scalars().all()

    return schemas.LeaveRequestListResponse(
        data=[schemas.LeaveRequestResponse.model_validate(r) for r in records],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get(
    "/{leave_id}",
    response_model=schemas.LeaveRequestResponse,
)
async def get_leave_request(
    leave_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get a single leave request by ID.

    Requires: any authenticated user.
    """
    result = await db.execute(
        select(models.LeaveRequest).where(models.LeaveRequest.id == leave_id)
    )
    leave_request = result.scalar_one_or_none()
    if leave_request is None:
        raise NotFoundException("LeaveRequest", str(leave_id))

    return schemas.LeaveRequestResponse.model_validate(leave_request)


@router.post(
    "/",
    response_model=schemas.LeaveRequestResponse,
    status_code=201,
)
async def create_leave_request(
    data: schemas.LeaveRequestCreate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Create a new leave request.

    Requires: any authenticated user.
    """
    leave_request = models.LeaveRequest(
        college_id=user.college_id,
        employee_id=data.employee_id,
        employee_type=data.employee_type,
        leave_type=data.leave_type,
        from_date=data.from_date,
        to_date=data.to_date,
        days=data.days,
        reason=data.reason,
        supporting_document_url=data.supporting_document_url,
        status="pending",
    )
    db.add(leave_request)
    await db.commit()
    await db.refresh(leave_request)

    return schemas.LeaveRequestResponse.model_validate(leave_request)


@router.post(
    "/{leave_id}/approve",
    response_model=schemas.LeaveRequestResponse,
)
async def approve_leave_request(
    leave_id: UUID,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Approve a pending leave request.

    Sets status='approved'. Also deducts from the employee's leave balance
    if a matching LeaveBalance record exists for the current academic year.

    Requires: admin, dean, or management role.
    """
    result = await db.execute(
        select(models.LeaveRequest).where(models.LeaveRequest.id == leave_id)
    )
    leave_request = result.scalar_one_or_none()
    if leave_request is None:
        raise NotFoundException("LeaveRequest", str(leave_id))

    leave_request.status = "approved"

    # Deduct from leave balance if a matching record exists
    balance_result = await db.execute(
        select(models.LeaveBalance).where(
            models.LeaveBalance.employee_id == leave_request.employee_id,
            models.LeaveBalance.leave_type == leave_request.leave_type,
        ).order_by(models.LeaveBalance.academic_year.desc()).limit(1)
    )
    balance = balance_result.scalar_one_or_none()
    if balance is not None:
        balance.taken = (balance.taken or 0) + leave_request.days
        balance.pending = max(0, (balance.pending or 0) - leave_request.days)
        balance.balance = (balance.entitled or 0) - (balance.taken or 0)

    await db.commit()
    await db.refresh(leave_request)

    return schemas.LeaveRequestResponse.model_validate(leave_request)


@router.post(
    "/{leave_id}/reject",
    response_model=schemas.LeaveRequestResponse,
)
async def reject_leave_request(
    leave_id: UUID,
    data: schemas.LeaveRequestUpdate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Reject a pending leave request with a reason.

    Sets status='rejected' and records the rejection reason.
    Also clears any pending balance that was held for this request.

    Requires: admin, dean, or management role.
    """
    result = await db.execute(
        select(models.LeaveRequest).where(models.LeaveRequest.id == leave_id)
    )
    leave_request = result.scalar_one_or_none()
    if leave_request is None:
        raise NotFoundException("LeaveRequest", str(leave_id))

    leave_request.status = "rejected"
    leave_request.rejection_reason = data.rejection_reason

    # Clear any pending balance that was held for this request
    balance_result = await db.execute(
        select(models.LeaveBalance).where(
            models.LeaveBalance.employee_id == leave_request.employee_id,
            models.LeaveBalance.leave_type == leave_request.leave_type,
        ).order_by(models.LeaveBalance.academic_year.desc()).limit(1)
    )
    balance = balance_result.scalar_one_or_none()
    if balance is not None:
        balance.pending = max(0, (balance.pending or 0) - leave_request.days)

    await db.commit()
    await db.refresh(leave_request)

    return schemas.LeaveRequestResponse.model_validate(leave_request)


# ---------------------------------------------------------------------------
# Leave Balances
# ---------------------------------------------------------------------------

@router.get(
    "/balance/{employee_id}",
    response_model=schemas.LeaveBalanceListResponse,
)
async def get_leave_balances(
    employee_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get all leave balances for a specific employee.

    Returns balances across all leave types and academic years.

    Requires: any authenticated user.
    """
    query = select(models.LeaveBalance).where(
        models.LeaveBalance.employee_id == employee_id,
    )
    count_query = select(func.count(models.LeaveBalance.id)).where(
        models.LeaveBalance.employee_id == employee_id,
    )

    # Total count
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    total_pages = math.ceil(total / page_size) if total > 0 else 0

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(
        models.LeaveBalance.academic_year.desc(),
        models.LeaveBalance.leave_type.asc(),
    ).offset(offset).limit(page_size)

    result = await db.execute(query)
    balances = result.scalars().all()

    return schemas.LeaveBalanceListResponse(
        data=[schemas.LeaveBalanceResponse.model_validate(b) for b in balances],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


# ---------------------------------------------------------------------------
# Leave Policies
# ---------------------------------------------------------------------------

@router.get(
    "/policies",
    response_model=schemas.LeavePolicyListResponse,
)
async def list_leave_policies(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List all leave policies with pagination.

    Requires: any authenticated user.
    """
    query = select(models.LeavePolicy)
    count_query = select(func.count(models.LeavePolicy.id))

    # Total count
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    total_pages = math.ceil(total / page_size) if total > 0 else 0

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(
        models.LeavePolicy.staff_category.asc(),
        models.LeavePolicy.leave_type.asc(),
    ).offset(offset).limit(page_size)

    result = await db.execute(query)
    policies = result.scalars().all()

    return schemas.LeavePolicyListResponse(
        data=[schemas.LeavePolicyResponse.model_validate(p) for p in policies],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post(
    "/policies",
    response_model=schemas.LeavePolicyResponse,
    status_code=201,
)
async def create_leave_policy(
    data: schemas.LeavePolicyCreate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Create a new leave policy.

    Requires: admin role.
    """
    policy = models.LeavePolicy(
        college_id=user.college_id,
        staff_category=data.staff_category,
        leave_type=data.leave_type,
        annual_entitlement=data.annual_entitlement,
        max_accumulation=data.max_accumulation,
        can_carry_forward=data.can_carry_forward,
        requires_document=data.requires_document,
        min_service_for_eligibility=data.min_service_for_eligibility,
    )
    db.add(policy)
    await db.commit()
    await db.refresh(policy)

    return schemas.LeavePolicyResponse.model_validate(policy)


@router.patch(
    "/policies/{policy_id}",
    response_model=schemas.LeavePolicyResponse,
)
async def update_leave_policy(
    policy_id: UUID,
    data: schemas.LeavePolicyCreate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Update an existing leave policy.

    All fields from LeavePolicyCreate are accepted; only non-None values
    are applied as updates.

    Requires: admin, dean, or management role.
    """
    result = await db.execute(
        select(models.LeavePolicy).where(models.LeavePolicy.id == policy_id)
    )
    policy = result.scalar_one_or_none()
    if policy is None:
        raise NotFoundException("LeavePolicy", str(policy_id))

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(policy, field, value)

    await db.commit()
    await db.refresh(policy)

    return schemas.LeavePolicyResponse.model_validate(policy)
