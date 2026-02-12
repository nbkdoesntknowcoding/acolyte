"""Admin Engine — Workflow & Approval Routes.

Full CRUD for workflow definitions, workflow instance listing,
pending-approval view, approve/reject actions, and aggregate stats.

Prefix: mounted by the parent router (typically /api/v1/admin/workflows).
"""

import math
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user, get_tenant_db, require_role
from app.engines.admin.models import WorkflowDefinition, WorkflowInstance
from app.engines.admin.schemas import (
    WorkflowDefinitionCreate,
    WorkflowDefinitionListResponse,
    WorkflowDefinitionResponse,
    WorkflowDefinitionUpdate,
    WorkflowInstanceListResponse,
    WorkflowInstanceResponse,
)
from app.middleware.clerk_auth import CurrentUser, UserRole
from app.shared.exceptions import NotFoundException

router = APIRouter()


# ---------------------------------------------------------------------------
# Inline request schemas for approve / reject actions
# ---------------------------------------------------------------------------


class ApproveRequest(BaseModel):
    comment: str | None = None


class RejectRequest(BaseModel):
    reason: str


# ===================================================================
# Workflow Definition CRUD
# ===================================================================


@router.get("/definitions", response_model=WorkflowDefinitionListResponse)
async def list_workflow_definitions(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List all workflow definitions with pagination.

    Returns only active definitions by default (all are returned here;
    filter by is_active on the frontend if needed).
    """
    query = select(WorkflowDefinition)

    # Count total matching rows
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = (
        query.order_by(WorkflowDefinition.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )

    result = await db.execute(query)
    definitions = result.scalars().all()

    return WorkflowDefinitionListResponse(
        data=[WorkflowDefinitionResponse.model_validate(d) for d in definitions],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/definitions/{definition_id}", response_model=WorkflowDefinitionResponse)
async def get_workflow_definition(
    definition_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get a single workflow definition by ID."""
    result = await db.execute(
        select(WorkflowDefinition).where(WorkflowDefinition.id == definition_id)
    )
    definition = result.scalar_one_or_none()

    if definition is None:
        raise NotFoundException("WorkflowDefinition", str(definition_id))

    return WorkflowDefinitionResponse.model_validate(definition)


@router.post("/definitions", response_model=WorkflowDefinitionResponse, status_code=201)
async def create_workflow_definition(
    data: WorkflowDefinitionCreate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Create a new workflow definition.

    Requires: admin, dean, or management role.
    The approval_chain should be a list of approval-step objects, each
    specifying the approver role/user and any conditions.
    """
    definition = WorkflowDefinition(
        college_id=user.college_id,
        **data.model_dump(),
    )
    db.add(definition)
    await db.commit()
    await db.refresh(definition)

    return WorkflowDefinitionResponse.model_validate(definition)


@router.patch("/definitions/{definition_id}", response_model=WorkflowDefinitionResponse)
async def update_workflow_definition(
    definition_id: UUID,
    data: WorkflowDefinitionUpdate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Update a workflow definition.

    Requires: admin, dean, or management role.
    Only provided (non-None) fields are updated.
    """
    result = await db.execute(
        select(WorkflowDefinition).where(WorkflowDefinition.id == definition_id)
    )
    definition = result.scalar_one_or_none()

    if definition is None:
        raise NotFoundException("WorkflowDefinition", str(definition_id))

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(definition, field, value)

    await db.commit()
    await db.refresh(definition)

    return WorkflowDefinitionResponse.model_validate(definition)


@router.delete("/definitions/{definition_id}", status_code=204)
async def delete_workflow_definition(
    definition_id: UUID,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Soft-delete a workflow definition by setting is_active=False.

    Requires: admin, dean, or management role.
    Existing instances referencing this definition are not affected.
    """
    result = await db.execute(
        select(WorkflowDefinition).where(WorkflowDefinition.id == definition_id)
    )
    definition = result.scalar_one_or_none()

    if definition is None:
        raise NotFoundException("WorkflowDefinition", str(definition_id))

    definition.is_active = False
    await db.commit()


# ===================================================================
# Workflow Instance Endpoints
# ===================================================================


@router.get("/", response_model=WorkflowInstanceListResponse)
async def list_workflow_instances(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    workflow_type: str | None = Query(None, description="Filter by workflow type"),
    status: str | None = Query(
        None,
        description="Filter by status (pending, in_progress, approved, rejected, cancelled)",
    ),
    current_approver_id: UUID | None = Query(
        None, description="Filter by current approver"
    ),
    requested_by: UUID | None = Query(None, description="Filter by requester"),
    priority: str | None = Query(
        None, description="Filter by priority (low, normal, high, urgent)"
    ),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List workflow instances with pagination and filters.

    All filters are optional and can be combined.
    """
    query = select(WorkflowInstance)

    if workflow_type is not None:
        query = query.where(WorkflowInstance.workflow_type == workflow_type)

    if status is not None:
        query = query.where(WorkflowInstance.status == status)

    if current_approver_id is not None:
        query = query.where(WorkflowInstance.current_approver_id == current_approver_id)

    if requested_by is not None:
        query = query.where(WorkflowInstance.requested_by == requested_by)

    if priority is not None:
        query = query.where(WorkflowInstance.priority == priority)

    # Count total matching rows
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = (
        query.order_by(WorkflowInstance.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )

    result = await db.execute(query)
    instances = result.scalars().all()

    return WorkflowInstanceListResponse(
        data=[WorkflowInstanceResponse.model_validate(i) for i in instances],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/pending", response_model=WorkflowInstanceListResponse)
async def list_pending_approvals(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List all pending approvals for the current user.

    Returns workflow instances where current_approver_id matches the
    authenticated user and status is 'pending' or 'in_progress'.
    """
    query = select(WorkflowInstance).where(
        WorkflowInstance.current_approver_id == user.user_id,
        WorkflowInstance.status.in_(["pending", "in_progress"]),
    )

    # Count total matching rows
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = (
        query.order_by(WorkflowInstance.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )

    result = await db.execute(query)
    instances = result.scalars().all()

    return WorkflowInstanceListResponse(
        data=[WorkflowInstanceResponse.model_validate(i) for i in instances],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/stats")
async def get_workflow_stats(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get aggregate workflow statistics.

    Returns counts of workflow instances grouped by status:
    pending, in_progress, approved, rejected, cancelled.
    """
    query = select(
        func.count().filter(
            WorkflowInstance.status == "pending"
        ).label("pending"),
        func.count().filter(
            WorkflowInstance.status == "in_progress"
        ).label("in_progress"),
        func.count().filter(
            WorkflowInstance.status == "approved"
        ).label("approved"),
        func.count().filter(
            WorkflowInstance.status == "rejected"
        ).label("rejected"),
        func.count().filter(
            WorkflowInstance.status == "cancelled"
        ).label("cancelled"),
    ).select_from(WorkflowInstance)

    result = await db.execute(query)
    row = result.one()

    return {
        "pending": row.pending,
        "in_progress": row.in_progress,
        "approved": row.approved,
        "rejected": row.rejected,
        "cancelled": row.cancelled,
    }


@router.get("/{instance_id}", response_model=WorkflowInstanceResponse)
async def get_workflow_instance(
    instance_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get a single workflow instance by ID."""
    result = await db.execute(
        select(WorkflowInstance).where(WorkflowInstance.id == instance_id)
    )
    instance = result.scalar_one_or_none()

    if instance is None:
        raise NotFoundException("WorkflowInstance", str(instance_id))

    return WorkflowInstanceResponse.model_validate(instance)


@router.post("/{instance_id}/approve", response_model=WorkflowInstanceResponse)
async def approve_workflow_step(
    instance_id: UUID,
    data: ApproveRequest,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Approve the current step of a workflow instance.

    Advances current_step by one, appends the approval to the
    approval_history JSONB array, and sets the next approver.
    If this was the last step in the approval chain, the instance
    status is set to 'approved' and completed_at is recorded.
    """
    result = await db.execute(
        select(WorkflowInstance).where(WorkflowInstance.id == instance_id)
    )
    instance = result.scalar_one_or_none()

    if instance is None:
        raise NotFoundException("WorkflowInstance", str(instance_id))

    # Build the approval history entry
    history_entry = {
        "step": instance.current_step,
        "action": "approved",
        "user_id": user.user_id,
        "user_name": user.full_name,
        "comment": data.comment,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    # Append to existing approval_history (or initialise)
    approval_history = list(instance.approval_history or [])
    approval_history.append(history_entry)
    instance.approval_history = approval_history

    # Determine total steps from the linked definition's approval_chain
    total_steps = 1
    if instance.definition_id:
        def_result = await db.execute(
            select(WorkflowDefinition).where(
                WorkflowDefinition.id == instance.definition_id
            )
        )
        definition = def_result.scalar_one_or_none()
        if definition and definition.approval_chain:
            total_steps = len(definition.approval_chain)

    # Advance or complete
    if instance.current_step >= total_steps:
        # Last step — mark as approved
        instance.status = "approved"
        instance.current_approver_id = None
        instance.completed_at = datetime.now(timezone.utc)
    else:
        # Advance to next step
        instance.current_step += 1
        instance.status = "in_progress"

        # Set next approver from the definition's approval chain
        if instance.definition_id and definition and definition.approval_chain:
            next_step_index = instance.current_step - 1  # 0-based
            if next_step_index < len(definition.approval_chain):
                next_step = definition.approval_chain[next_step_index]
                instance.current_approver_id = next_step.get("approver_id")

    await db.commit()
    await db.refresh(instance)

    return WorkflowInstanceResponse.model_validate(instance)


@router.post("/{instance_id}/reject", response_model=WorkflowInstanceResponse)
async def reject_workflow_instance(
    instance_id: UUID,
    data: RejectRequest,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Reject a workflow instance with a reason.

    Sets the instance status to 'rejected' and records the rejection
    in the approval_history JSONB array with the provided reason.
    """
    result = await db.execute(
        select(WorkflowInstance).where(WorkflowInstance.id == instance_id)
    )
    instance = result.scalar_one_or_none()

    if instance is None:
        raise NotFoundException("WorkflowInstance", str(instance_id))

    # Build the rejection history entry
    history_entry = {
        "step": instance.current_step,
        "action": "rejected",
        "user_id": user.user_id,
        "user_name": user.full_name,
        "reason": data.reason,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    # Append to existing approval_history (or initialise)
    approval_history = list(instance.approval_history or [])
    approval_history.append(history_entry)
    instance.approval_history = approval_history

    instance.status = "rejected"
    instance.completed_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(instance)

    return WorkflowInstanceResponse.model_validate(instance)
