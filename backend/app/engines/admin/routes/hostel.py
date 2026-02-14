"""Admin Engine — Hostel & Mess Management Routes.

Prefix: /api/v1/admin/hostel
Full CRUD for hostel blocks, rooms, allocations, mess units.
Includes occupancy summaries, room transfers, and capacity tracking.
"""

import math
from datetime import date, datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user, get_tenant_db, require_role
from app.engines.admin.models import (
    HostelAllocation,
    HostelBlock,
    HostelRoom,
    MessUnit,
    Student,
)
from app.engines.admin.schemas import (
    HostelAllocationCreate,
    HostelAllocationListResponse,
    HostelAllocationResponse,
    HostelBlockCreate,
    HostelBlockListResponse,
    HostelBlockResponse,
    HostelRoomCreate,
    HostelRoomListResponse,
    HostelRoomResponse,
    MessUnitCreate,
    MessUnitListResponse,
    MessUnitResponse,
)
from app.middleware.clerk_auth import CurrentUser, UserRole
from app.shared.exceptions import NotFoundException, ValidationException

router = APIRouter()


# ---------------------------------------------------------------------------
# Inline schemas — Update models not in the central schemas file
# ---------------------------------------------------------------------------

class HostelBlockUpdate(BaseModel):
    name: str | None = None
    block_type: str | None = None
    total_rooms: int | None = None
    total_beds: int | None = None
    floors: int | None = None
    warden_faculty_id: UUID | None = None
    warden_phone: str | None = None
    has_cctv: bool | None = None
    is_anti_ragging_compliant: bool | None = None
    is_active: bool | None = None


class HostelRoomUpdate(BaseModel):
    room_number: str | None = None
    floor: int | None = None
    capacity: int | None = None
    room_type: str | None = None
    has_ac: bool | None = None
    has_attached_bathroom: bool | None = None
    status: str | None = None


class MessUnitUpdate(BaseModel):
    name: str | None = None
    mess_type: str | None = None
    capacity: int | None = None
    vendor_name: str | None = None
    vendor_contact: str | None = None
    monthly_fee: int | None = None
    is_active: bool | None = None


class AllocateRequest(BaseModel):
    """Body for allocating a student to a hostel room."""
    student_id: UUID
    room_id: UUID
    block_id: UUID
    academic_year: str | None = None
    check_in_date: date | None = None


class TransferRequest(BaseModel):
    """Body for transferring a student between hostel rooms."""
    allocation_id: UUID = Field(..., description="Current active allocation to vacate")
    new_room_id: UUID = Field(..., description="Target room to move the student into")
    new_block_id: UUID = Field(..., description="Block of the target room")
    reason: str | None = Field(default=None, description="Reason for transfer")


class OccupancySummaryItem(BaseModel):
    block_id: UUID
    block_name: str
    total_beds: int
    occupied: int
    available: int
    occupancy_percentage: float


# ===================================================================
# Hostel Blocks
# ===================================================================


@router.get("/blocks", response_model=HostelBlockListResponse)
async def list_hostel_blocks(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    is_active: bool | None = Query(None, description="Filter by active status"),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List hostel blocks with pagination and optional active filter."""
    query = select(HostelBlock)

    if is_active is not None:
        query = query.where(HostelBlock.is_active.is_(is_active))

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(HostelBlock.name.asc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    blocks = result.scalars().all()

    return HostelBlockListResponse(
        data=[HostelBlockResponse.model_validate(b) for b in blocks],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 0,
    )


@router.get("/blocks/{block_id}", response_model=HostelBlockResponse)
async def get_hostel_block(
    block_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get a single hostel block by ID."""
    result = await db.execute(
        select(HostelBlock).where(HostelBlock.id == block_id)
    )
    block = result.scalar_one_or_none()
    if block is None:
        raise NotFoundException("HostelBlock", str(block_id))
    return HostelBlockResponse.model_validate(block)


@router.post("/blocks", response_model=HostelBlockResponse, status_code=201)
async def create_hostel_block(
    data: HostelBlockCreate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Create a new hostel block.

    Requires: admin, dean, or management role.
    """
    block = HostelBlock(
        college_id=user.college_id,
        **data.model_dump(exclude_unset=True),
    )
    db.add(block)
    await db.commit()
    await db.refresh(block)
    return HostelBlockResponse.model_validate(block)


@router.patch("/blocks/{block_id}", response_model=HostelBlockResponse)
async def update_hostel_block(
    block_id: UUID,
    data: HostelBlockUpdate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Update an existing hostel block.

    Requires: admin, dean, or management role.
    Only fields present in the request body are updated.
    """
    result = await db.execute(
        select(HostelBlock).where(HostelBlock.id == block_id)
    )
    block = result.scalar_one_or_none()
    if block is None:
        raise NotFoundException("HostelBlock", str(block_id))

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(block, field, value)

    await db.commit()
    await db.refresh(block)
    return HostelBlockResponse.model_validate(block)


@router.delete("/blocks/{block_id}", status_code=204)
async def delete_hostel_block(
    block_id: UUID,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Soft-delete a hostel block by setting is_active=False.

    Requires: admin, dean, or management role.
    """
    result = await db.execute(
        select(HostelBlock).where(HostelBlock.id == block_id)
    )
    block = result.scalar_one_or_none()
    if block is None:
        raise NotFoundException("HostelBlock", str(block_id))

    block.is_active = False
    await db.commit()


# ===================================================================
# Hostel Rooms
# ===================================================================


@router.get("/rooms", response_model=HostelRoomListResponse)
async def list_hostel_rooms(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    block_id: UUID | None = Query(None, description="Filter by block"),
    status_filter: str | None = Query(
        None,
        alias="status",
        description="Filter by room status (available, full, maintenance, reserved)",
    ),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List hostel rooms with pagination and filters."""
    query = select(HostelRoom)

    if block_id is not None:
        query = query.where(HostelRoom.block_id == block_id)
    if status_filter is not None:
        query = query.where(HostelRoom.status == status_filter)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(HostelRoom.room_number.asc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    rooms = result.scalars().all()

    return HostelRoomListResponse(
        data=[HostelRoomResponse.model_validate(r) for r in rooms],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 0,
    )


@router.get("/rooms/{room_id}", response_model=HostelRoomResponse)
async def get_hostel_room(
    room_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get a single hostel room by ID."""
    result = await db.execute(
        select(HostelRoom).where(HostelRoom.id == room_id)
    )
    room = result.scalar_one_or_none()
    if room is None:
        raise NotFoundException("HostelRoom", str(room_id))
    return HostelRoomResponse.model_validate(room)


@router.post("/rooms", response_model=HostelRoomResponse, status_code=201)
async def create_hostel_room(
    data: HostelRoomCreate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Create a new hostel room.

    Requires: admin, dean, or management role.
    """
    # Verify block exists
    block_result = await db.execute(
        select(HostelBlock).where(HostelBlock.id == data.block_id)
    )
    if block_result.scalar_one_or_none() is None:
        raise NotFoundException("HostelBlock", str(data.block_id))

    room = HostelRoom(
        college_id=user.college_id,
        **data.model_dump(exclude_unset=True),
    )
    db.add(room)
    await db.commit()
    await db.refresh(room)
    return HostelRoomResponse.model_validate(room)


@router.patch("/rooms/{room_id}", response_model=HostelRoomResponse)
async def update_hostel_room(
    room_id: UUID,
    data: HostelRoomUpdate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Update an existing hostel room.

    Requires: admin, dean, or management role.
    Only fields present in the request body are updated.
    """
    result = await db.execute(
        select(HostelRoom).where(HostelRoom.id == room_id)
    )
    room = result.scalar_one_or_none()
    if room is None:
        raise NotFoundException("HostelRoom", str(room_id))

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(room, field, value)

    await db.commit()
    await db.refresh(room)
    return HostelRoomResponse.model_validate(room)


# ===================================================================
# Hostel Allocations
# ===================================================================


@router.get("/allocations", response_model=HostelAllocationListResponse)
async def list_hostel_allocations(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    student_id: UUID | None = Query(None, description="Filter by student"),
    block_id: UUID | None = Query(None, description="Filter by block"),
    academic_year: str | None = Query(None, description="Filter by academic year"),
    status_filter: str | None = Query(
        None,
        alias="status",
        description="Filter by allocation status (active, vacated, transferred)",
    ),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List hostel allocations with pagination and filters."""
    query = select(HostelAllocation)

    if student_id is not None:
        query = query.where(HostelAllocation.student_id == student_id)
    if block_id is not None:
        query = query.where(HostelAllocation.block_id == block_id)
    if academic_year is not None:
        query = query.where(HostelAllocation.academic_year == academic_year)
    if status_filter is not None:
        query = query.where(HostelAllocation.status == status_filter)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(HostelAllocation.created_at.desc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    allocations = result.scalars().all()

    return HostelAllocationListResponse(
        data=[HostelAllocationResponse.model_validate(a) for a in allocations],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 0,
    )


@router.post("/allocate", response_model=HostelAllocationResponse, status_code=201)
async def allocate_student(
    data: AllocateRequest,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Allocate a student to a hostel room.

    - Verifies the room exists and has available capacity.
    - Increments current_occupancy on the room.
    - Updates room status to "full" if capacity is reached.
    - Creates a new HostelAllocation record with status "active".

    Requires: admin, dean, or management role.
    """
    # Verify student exists
    student_result = await db.execute(
        select(Student).where(Student.id == data.student_id)
    )
    if student_result.scalar_one_or_none() is None:
        raise NotFoundException("Student", str(data.student_id))

    # Verify room exists and has capacity
    room_result = await db.execute(
        select(HostelRoom).where(HostelRoom.id == data.room_id)
    )
    room = room_result.scalar_one_or_none()
    if room is None:
        raise NotFoundException("HostelRoom", str(data.room_id))

    if room.current_occupancy >= room.capacity:
        raise ValidationException(
            message=f"Room {room.room_number} is already at full capacity "
                    f"({room.current_occupancy}/{room.capacity})",
        )

    # Check if student already has an active allocation
    existing_result = await db.execute(
        select(HostelAllocation).where(
            HostelAllocation.student_id == data.student_id,
            HostelAllocation.status == "active",
        )
    )
    if existing_result.scalar_one_or_none() is not None:
        raise ValidationException(
            message="Student already has an active hostel allocation. "
                    "Use transfer endpoint to move to a different room.",
        )

    # Create allocation
    allocation = HostelAllocation(
        college_id=user.college_id,
        student_id=data.student_id,
        room_id=data.room_id,
        block_id=data.block_id,
        academic_year=data.academic_year,
        check_in_date=data.check_in_date or date.today(),
        status="active",
    )
    db.add(allocation)

    # Update room occupancy
    room.current_occupancy = (room.current_occupancy or 0) + 1
    if room.current_occupancy >= room.capacity:
        room.status = "full"

    await db.commit()
    await db.refresh(allocation)
    return HostelAllocationResponse.model_validate(allocation)


@router.post("/transfer", response_model=HostelAllocationResponse, status_code=201)
async def transfer_student(
    data: TransferRequest,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Transfer a student from one hostel room to another.

    - Vacates the old allocation (sets status to "transferred", adds check_out_date).
    - Decrements current_occupancy on the old room and updates its status.
    - Creates a new allocation in the target room.
    - Increments current_occupancy on the new room.

    Requires: admin, dean, or management role.
    """
    # Fetch existing allocation
    alloc_result = await db.execute(
        select(HostelAllocation).where(HostelAllocation.id == data.allocation_id)
    )
    old_allocation = alloc_result.scalar_one_or_none()
    if old_allocation is None:
        raise NotFoundException("HostelAllocation", str(data.allocation_id))

    if old_allocation.status != "active":
        raise ValidationException(
            message=f"Allocation {data.allocation_id} is not active (status: {old_allocation.status}). "
                    "Only active allocations can be transferred.",
        )

    # Fetch old room
    old_room_result = await db.execute(
        select(HostelRoom).where(HostelRoom.id == old_allocation.room_id)
    )
    old_room = old_room_result.scalar_one_or_none()
    if old_room is None:
        raise NotFoundException("HostelRoom", str(old_allocation.room_id))

    # Fetch new room and verify capacity
    new_room_result = await db.execute(
        select(HostelRoom).where(HostelRoom.id == data.new_room_id)
    )
    new_room = new_room_result.scalar_one_or_none()
    if new_room is None:
        raise NotFoundException("HostelRoom", str(data.new_room_id))

    if new_room.current_occupancy >= new_room.capacity:
        raise ValidationException(
            message=f"Target room {new_room.room_number} is already at full capacity "
                    f"({new_room.current_occupancy}/{new_room.capacity})",
        )

    # Vacate old allocation
    old_allocation.status = "transferred"
    old_allocation.check_out_date = date.today()

    # Decrement old room occupancy
    old_room.current_occupancy = max(0, (old_room.current_occupancy or 0) - 1)
    if old_room.status == "full" and old_room.current_occupancy < old_room.capacity:
        old_room.status = "available"

    # Create new allocation
    new_allocation = HostelAllocation(
        college_id=user.college_id,
        student_id=old_allocation.student_id,
        room_id=data.new_room_id,
        block_id=data.new_block_id,
        academic_year=old_allocation.academic_year,
        check_in_date=date.today(),
        status="active",
    )
    db.add(new_allocation)

    # Increment new room occupancy
    new_room.current_occupancy = (new_room.current_occupancy or 0) + 1
    if new_room.current_occupancy >= new_room.capacity:
        new_room.status = "full"

    await db.commit()
    await db.refresh(new_allocation)
    return HostelAllocationResponse.model_validate(new_allocation)


# ===================================================================
# Occupancy Summary
# ===================================================================


@router.get("/occupancy", response_model=list[OccupancySummaryItem])
async def get_occupancy_summary(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Block-wise hostel occupancy summary.

    Returns total beds, occupied beds, available beds, and occupancy
    percentage for each active hostel block. Occupied count is derived
    from the sum of current_occupancy across all rooms in the block.
    """
    # Aggregate room occupancy per block
    room_stats = (
        select(
            HostelRoom.block_id,
            func.sum(HostelRoom.capacity).label("total_beds"),
            func.sum(HostelRoom.current_occupancy).label("occupied"),
        )
        .group_by(HostelRoom.block_id)
        .subquery()
    )

    query = (
        select(
            HostelBlock.id,
            HostelBlock.name,
            func.coalesce(room_stats.c.total_beds, 0).label("total_beds"),
            func.coalesce(room_stats.c.occupied, 0).label("occupied"),
        )
        .outerjoin(room_stats, HostelBlock.id == room_stats.c.block_id)
        .where(HostelBlock.is_active.is_(True))
        .order_by(HostelBlock.name.asc())
    )

    result = await db.execute(query)
    rows = result.all()

    summaries: list[OccupancySummaryItem] = []
    for row in rows:
        total_beds = int(row.total_beds)
        occupied = int(row.occupied)
        available = max(0, total_beds - occupied)
        pct = round((occupied / total_beds * 100), 1) if total_beds > 0 else 0.0

        summaries.append(
            OccupancySummaryItem(
                block_id=row.id,
                block_name=row.name,
                total_beds=total_beds,
                occupied=occupied,
                available=available,
                occupancy_percentage=pct,
            )
        )

    return summaries


# ===================================================================
# Mess Units
# ===================================================================


@router.get("/mess", response_model=MessUnitListResponse)
async def list_mess_units(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    is_active: bool | None = Query(None, description="Filter by active status"),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List mess units with pagination."""
    query = select(MessUnit)

    if is_active is not None:
        query = query.where(MessUnit.is_active.is_(is_active))

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(MessUnit.name.asc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    units = result.scalars().all()

    return MessUnitListResponse(
        data=[MessUnitResponse.model_validate(u) for u in units],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 0,
    )


@router.post("/mess", response_model=MessUnitResponse, status_code=201)
async def create_mess_unit(
    data: MessUnitCreate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Create a new mess unit.

    Requires: admin, dean, or management role.
    """
    unit = MessUnit(
        college_id=user.college_id,
        **data.model_dump(exclude_unset=True),
    )
    db.add(unit)
    await db.commit()
    await db.refresh(unit)
    return MessUnitResponse.model_validate(unit)


@router.patch("/mess/{mess_id}", response_model=MessUnitResponse)
async def update_mess_unit(
    mess_id: UUID,
    data: MessUnitUpdate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Update an existing mess unit.

    Requires: admin, dean, or management role.
    Only fields present in the request body are updated.
    """
    result = await db.execute(
        select(MessUnit).where(MessUnit.id == mess_id)
    )
    unit = result.scalar_one_or_none()
    if unit is None:
        raise NotFoundException("MessUnit", str(mess_id))

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(unit, field, value)

    await db.commit()
    await db.refresh(unit)
    return MessUnitResponse.model_validate(unit)
