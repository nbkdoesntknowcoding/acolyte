"""Admin Engine — Infrastructure, Equipment & Maintenance Routes.

Full CRUD for infrastructure inventory, department equipment, and
maintenance tickets with search, filters, and pagination.

Prefix: mounted by the parent router (typically /api/v1/admin/infrastructure).
"""

import math
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user, get_tenant_db, require_role
from app.engines.admin.models import Equipment, Infrastructure, MaintenanceTicket
from app.engines.admin.schemas import (
    EquipmentCreate,
    EquipmentListResponse,
    EquipmentResponse,
    EquipmentUpdate,
    InfrastructureCreate,
    InfrastructureListResponse,
    InfrastructureResponse,
    InfrastructureUpdate,
    MaintenanceTicketCreate,
    MaintenanceTicketListResponse,
    MaintenanceTicketResponse,
    MaintenanceTicketUpdate,
)
from app.engines.admin.utils.validators import generate_ticket_number
from app.middleware.clerk_auth import CurrentUser, UserRole
from app.shared.exceptions import NotFoundException

router = APIRouter()


# ===================================================================
# Infrastructure CRUD
# ===================================================================


@router.get("/", response_model=InfrastructureListResponse)
async def list_infrastructure(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: str | None = Query(
        None, max_length=200, description="Search by name, building, or room_number"
    ),
    category: str | None = Query(None, description="Filter by category"),
    department_id: UUID | None = Query(None, description="Filter by department"),
    condition: str | None = Query(None, description="Filter by condition"),
    building: str | None = Query(None, description="Filter by building"),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List infrastructure items with pagination, search, and filters.

    Search matches against name, building, and room_number (case-insensitive).
    All filters are optional and can be combined.
    Only active items are returned by default.
    """
    query = select(Infrastructure).where(Infrastructure.is_active.is_(True))

    # Search filter
    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                Infrastructure.name.ilike(search_term),
                Infrastructure.building.ilike(search_term),
                Infrastructure.room_number.ilike(search_term),
            )
        )

    # Column filters
    if category is not None:
        query = query.where(Infrastructure.category == category)

    if department_id is not None:
        query = query.where(Infrastructure.department_id == department_id)

    if condition is not None:
        query = query.where(Infrastructure.condition == condition)

    if building is not None:
        query = query.where(Infrastructure.building == building)

    # Count total matching rows
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(Infrastructure.name).offset(offset).limit(page_size)

    result = await db.execute(query)
    items = result.scalars().all()

    return InfrastructureListResponse(
        data=[InfrastructureResponse.model_validate(i) for i in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/{infrastructure_id}", response_model=InfrastructureResponse)
async def get_infrastructure(
    infrastructure_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get a single infrastructure item by ID."""
    result = await db.execute(
        select(Infrastructure).where(Infrastructure.id == infrastructure_id)
    )
    item = result.scalar_one_or_none()

    if item is None:
        raise NotFoundException("Infrastructure", str(infrastructure_id))

    return InfrastructureResponse.model_validate(item)


@router.post("/", response_model=InfrastructureResponse, status_code=201)
async def create_infrastructure(
    data: InfrastructureCreate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Create a new infrastructure item.

    Requires: admin, dean, or management role.
    """
    item = Infrastructure(
        college_id=user.college_id,
        **data.model_dump(),
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)

    return InfrastructureResponse.model_validate(item)


@router.patch("/{infrastructure_id}", response_model=InfrastructureResponse)
async def update_infrastructure(
    infrastructure_id: UUID,
    data: InfrastructureUpdate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Update an infrastructure item.

    Requires: admin, dean, or management role.
    Only provided (non-None) fields are updated.
    """
    result = await db.execute(
        select(Infrastructure).where(Infrastructure.id == infrastructure_id)
    )
    item = result.scalar_one_or_none()

    if item is None:
        raise NotFoundException("Infrastructure", str(infrastructure_id))

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    await db.commit()
    await db.refresh(item)

    return InfrastructureResponse.model_validate(item)


@router.delete("/{infrastructure_id}", status_code=204)
async def delete_infrastructure(
    infrastructure_id: UUID,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Soft-delete an infrastructure item by setting is_active=False.

    Requires: admin, dean, or management role.
    Infrastructure records are never hard-deleted due to audit requirements.
    """
    result = await db.execute(
        select(Infrastructure).where(Infrastructure.id == infrastructure_id)
    )
    item = result.scalar_one_or_none()

    if item is None:
        raise NotFoundException("Infrastructure", str(infrastructure_id))

    item.is_active = False
    await db.commit()


# ===================================================================
# Equipment CRUD
# ===================================================================


@router.get("/equipment", response_model=EquipmentListResponse)
async def list_equipment(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    department_id: UUID | None = Query(None, description="Filter by department"),
    condition: str | None = Query(
        None, description="Filter by condition (working, needs_repair, condemned, etc.)"
    ),
    amc_status: str | None = Query(
        None, description="Filter by AMC status (not_covered, active, expired, etc.)"
    ),
    is_nmc_required: bool | None = Query(
        None, description="Filter by NMC requirement flag"
    ),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List equipment with pagination and filters.

    All filters are optional and can be combined.
    """
    query = select(Equipment)

    # Column filters
    if department_id is not None:
        query = query.where(Equipment.department_id == department_id)

    if condition is not None:
        query = query.where(Equipment.condition == condition)

    if amc_status is not None:
        query = query.where(Equipment.amc_status == amc_status)

    if is_nmc_required is not None:
        query = query.where(Equipment.is_nmc_required == is_nmc_required)

    # Count total matching rows
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(Equipment.name).offset(offset).limit(page_size)

    result = await db.execute(query)
    items = result.scalars().all()

    return EquipmentListResponse(
        data=[EquipmentResponse.model_validate(e) for e in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/equipment/{equipment_id}", response_model=EquipmentResponse)
async def get_equipment(
    equipment_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get a single equipment item by ID."""
    result = await db.execute(
        select(Equipment).where(Equipment.id == equipment_id)
    )
    item = result.scalar_one_or_none()

    if item is None:
        raise NotFoundException("Equipment", str(equipment_id))

    return EquipmentResponse.model_validate(item)


@router.post("/equipment", response_model=EquipmentResponse, status_code=201)
async def create_equipment(
    data: EquipmentCreate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Create a new equipment record.

    Requires: admin, dean, or management role.
    """
    equipment = Equipment(
        college_id=user.college_id,
        **data.model_dump(),
    )
    db.add(equipment)
    await db.commit()
    await db.refresh(equipment)

    return EquipmentResponse.model_validate(equipment)


@router.patch("/equipment/{equipment_id}", response_model=EquipmentResponse)
async def update_equipment(
    equipment_id: UUID,
    data: EquipmentUpdate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Update an equipment record.

    Requires: admin, dean, or management role.
    Only provided (non-None) fields are updated.
    """
    result = await db.execute(
        select(Equipment).where(Equipment.id == equipment_id)
    )
    item = result.scalar_one_or_none()

    if item is None:
        raise NotFoundException("Equipment", str(equipment_id))

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    await db.commit()
    await db.refresh(item)

    return EquipmentResponse.model_validate(item)


# ===================================================================
# Maintenance Tickets
# ===================================================================


@router.get("/tickets", response_model=MaintenanceTicketListResponse)
async def list_maintenance_tickets(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    department_id: UUID | None = Query(None, description="Filter by department"),
    entity_type: str | None = Query(
        None, description="Filter by entity type (equipment, infrastructure)"
    ),
    priority: str | None = Query(
        None, description="Filter by priority (low, medium, high, critical)"
    ),
    status: str | None = Query(
        None,
        description="Filter by status (open, assigned, in_progress, resolved, closed)",
    ),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List maintenance tickets with pagination and filters.

    All filters are optional and can be combined.
    """
    query = select(MaintenanceTicket)

    # Column filters
    if department_id is not None:
        query = query.where(MaintenanceTicket.department_id == department_id)

    if entity_type is not None:
        query = query.where(MaintenanceTicket.entity_type == entity_type)

    if priority is not None:
        query = query.where(MaintenanceTicket.priority == priority)

    if status is not None:
        query = query.where(MaintenanceTicket.status == status)

    # Count total matching rows
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(MaintenanceTicket.created_at.desc()).offset(offset).limit(page_size)

    result = await db.execute(query)
    tickets = result.scalars().all()

    return MaintenanceTicketListResponse(
        data=[MaintenanceTicketResponse.model_validate(t) for t in tickets],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.post("/tickets", response_model=MaintenanceTicketResponse, status_code=201)
async def create_maintenance_ticket(
    data: MaintenanceTicketCreate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Create a new maintenance ticket.

    Auto-generates a unique ticket number (TKT-YYYYMMDD-XXXXXX).
    Any authenticated user can report maintenance issues.
    """
    ticket = MaintenanceTicket(
        college_id=user.college_id,
        ticket_number=generate_ticket_number("MNT"),
        reported_by=user.user_id,
        **data.model_dump(),
    )
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)

    return MaintenanceTicketResponse.model_validate(ticket)


@router.patch("/tickets/{ticket_id}", response_model=MaintenanceTicketResponse)
async def update_maintenance_ticket(
    ticket_id: UUID,
    data: MaintenanceTicketUpdate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Update a maintenance ticket (status, assignment, resolution).

    Requires: admin, dean, or management role.
    Only provided (non-None) fields are updated.
    """
    result = await db.execute(
        select(MaintenanceTicket).where(MaintenanceTicket.id == ticket_id)
    )
    ticket = result.scalar_one_or_none()

    if ticket is None:
        raise NotFoundException("MaintenanceTicket", str(ticket_id))

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(ticket, field, value)

    await db.commit()
    await db.refresh(ticket)

    return MaintenanceTicketResponse.model_validate(ticket)
