"""Admin Engine — Transport Management Routes.

Prefix: /api/v1/admin/transport
Full CRUD for vehicles, transport routes, bookings, and maintenance logs.
"""

import math
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user, get_tenant_db, require_role
from app.engines.admin.models import (
    TransportBooking,
    TransportRoute,
    Vehicle,
    VehicleMaintenanceLog,
)
from app.engines.admin.schemas import (
    TransportBookingCreate,
    TransportBookingListResponse,
    TransportBookingResponse,
    TransportRouteCreate,
    TransportRouteListResponse,
    TransportRouteResponse,
    VehicleCreate,
    VehicleListResponse,
    VehicleMaintenanceLogCreate,
    VehicleMaintenanceLogListResponse,
    VehicleMaintenanceLogResponse,
    VehicleResponse,
)
from app.middleware.clerk_auth import CurrentUser, UserRole
from app.shared.exceptions import NotFoundException

router = APIRouter()


# ---------------------------------------------------------------------------
# Inline schemas — Update models not in the central schemas file
# ---------------------------------------------------------------------------

class VehicleUpdate(BaseModel):
    vehicle_number: str | None = None
    vehicle_type: str | None = None
    capacity: int | None = None
    make_model: str | None = None
    year_of_purchase: int | None = None
    driver_name: str | None = None
    driver_phone: str | None = None
    driver_license_number: str | None = None
    insurance_expiry: date | None = None
    fitness_certificate_expiry: date | None = None
    last_service_date: date | None = None
    next_service_due: date | None = None
    current_km_reading: int | None = None
    status: str | None = None


class TransportRouteUpdate(BaseModel):
    name: str | None = None
    route_type: str | None = None
    origin: str | None = None
    destination: str | None = None
    distance_km: float | None = None
    schedule: list | None = None
    vehicle_id: UUID | None = None
    is_active: bool | None = None


class TransportBookingUpdate(BaseModel):
    route_id: UUID | None = None
    department_id: UUID | None = None
    booking_date: date | None = None
    departure_time: str | None = None
    num_passengers: int | None = None
    purpose: str | None = None
    faculty_accompanying: str | None = None
    vehicle_id: UUID | None = None
    status: str | None = None


# ===================================================================
# Vehicles
# ===================================================================


@router.get("/vehicles", response_model=VehicleListResponse)
async def list_vehicles(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    vehicle_type: str | None = Query(None, description="Filter by vehicle type (bus, van, ambulance, etc.)"),
    status_filter: str | None = Query(
        None,
        alias="status",
        description="Filter by vehicle status (active, maintenance, retired)",
    ),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List vehicles with pagination and filters."""
    query = select(Vehicle)

    if vehicle_type is not None:
        query = query.where(Vehicle.vehicle_type == vehicle_type)
    if status_filter is not None:
        query = query.where(Vehicle.status == status_filter)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(Vehicle.vehicle_number.asc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    vehicles = result.scalars().all()

    return VehicleListResponse(
        data=[VehicleResponse.model_validate(v) for v in vehicles],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 0,
    )


@router.get("/vehicles/{vehicle_id}", response_model=VehicleResponse)
async def get_vehicle(
    vehicle_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get a single vehicle by ID."""
    result = await db.execute(
        select(Vehicle).where(Vehicle.id == vehicle_id)
    )
    vehicle = result.scalar_one_or_none()
    if vehicle is None:
        raise NotFoundException("Vehicle", str(vehicle_id))
    return VehicleResponse.model_validate(vehicle)


@router.post("/vehicles", response_model=VehicleResponse, status_code=201)
async def create_vehicle(
    data: VehicleCreate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Create a new vehicle record.

    Requires: admin, dean, or management role.
    """
    vehicle = Vehicle(
        college_id=user.college_id,
        **data.model_dump(exclude_unset=True),
    )
    db.add(vehicle)
    await db.commit()
    await db.refresh(vehicle)
    return VehicleResponse.model_validate(vehicle)


@router.patch("/vehicles/{vehicle_id}", response_model=VehicleResponse)
async def update_vehicle(
    vehicle_id: UUID,
    data: VehicleUpdate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Update an existing vehicle record.

    Requires: admin, dean, or management role.
    Only fields present in the request body are updated.
    """
    result = await db.execute(
        select(Vehicle).where(Vehicle.id == vehicle_id)
    )
    vehicle = result.scalar_one_or_none()
    if vehicle is None:
        raise NotFoundException("Vehicle", str(vehicle_id))

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(vehicle, field, value)

    await db.commit()
    await db.refresh(vehicle)
    return VehicleResponse.model_validate(vehicle)


# ===================================================================
# Transport Routes
# ===================================================================


@router.get("/routes", response_model=TransportRouteListResponse)
async def list_transport_routes(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    route_type: str | None = Query(None, description="Filter by route type"),
    is_active: bool | None = Query(None, description="Filter by active status"),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List transport routes with pagination and filters."""
    query = select(TransportRoute)

    if route_type is not None:
        query = query.where(TransportRoute.route_type == route_type)
    if is_active is not None:
        query = query.where(TransportRoute.is_active.is_(is_active))

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(TransportRoute.name.asc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    routes = result.scalars().all()

    return TransportRouteListResponse(
        data=[TransportRouteResponse.model_validate(r) for r in routes],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 0,
    )


@router.get("/routes/{route_id}", response_model=TransportRouteResponse)
async def get_transport_route(
    route_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get a single transport route by ID."""
    result = await db.execute(
        select(TransportRoute).where(TransportRoute.id == route_id)
    )
    route = result.scalar_one_or_none()
    if route is None:
        raise NotFoundException("TransportRoute", str(route_id))
    return TransportRouteResponse.model_validate(route)


@router.post("/routes", response_model=TransportRouteResponse, status_code=201)
async def create_transport_route(
    data: TransportRouteCreate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Create a new transport route.

    Requires: admin, dean, or management role.
    """
    # Verify vehicle exists if provided
    if data.vehicle_id is not None:
        vehicle_result = await db.execute(
            select(Vehicle).where(Vehicle.id == data.vehicle_id)
        )
        if vehicle_result.scalar_one_or_none() is None:
            raise NotFoundException("Vehicle", str(data.vehicle_id))

    route = TransportRoute(
        college_id=user.college_id,
        **data.model_dump(exclude_unset=True),
    )
    db.add(route)
    await db.commit()
    await db.refresh(route)
    return TransportRouteResponse.model_validate(route)


@router.patch("/routes/{route_id}", response_model=TransportRouteResponse)
async def update_transport_route(
    route_id: UUID,
    data: TransportRouteUpdate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Update an existing transport route.

    Requires: admin, dean, or management role.
    Only fields present in the request body are updated.
    """
    result = await db.execute(
        select(TransportRoute).where(TransportRoute.id == route_id)
    )
    route = result.scalar_one_or_none()
    if route is None:
        raise NotFoundException("TransportRoute", str(route_id))

    # Verify vehicle exists if being updated
    update_data = data.model_dump(exclude_unset=True)
    if "vehicle_id" in update_data and update_data["vehicle_id"] is not None:
        vehicle_result = await db.execute(
            select(Vehicle).where(Vehicle.id == update_data["vehicle_id"])
        )
        if vehicle_result.scalar_one_or_none() is None:
            raise NotFoundException("Vehicle", str(update_data["vehicle_id"]))

    for field, value in update_data.items():
        setattr(route, field, value)

    await db.commit()
    await db.refresh(route)
    return TransportRouteResponse.model_validate(route)


# ===================================================================
# Transport Bookings
# ===================================================================


@router.get("/bookings", response_model=TransportBookingListResponse)
async def list_transport_bookings(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    route_id: UUID | None = Query(None, description="Filter by route"),
    department_id: UUID | None = Query(None, description="Filter by department"),
    status_filter: str | None = Query(
        None,
        alias="status",
        description="Filter by booking status (requested, approved, rejected, completed, cancelled)",
    ),
    booking_date: date | None = Query(None, description="Filter by booking date"),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List transport bookings with pagination and filters."""
    query = select(TransportBooking)

    if route_id is not None:
        query = query.where(TransportBooking.route_id == route_id)
    if department_id is not None:
        query = query.where(TransportBooking.department_id == department_id)
    if status_filter is not None:
        query = query.where(TransportBooking.status == status_filter)
    if booking_date is not None:
        query = query.where(TransportBooking.booking_date == booking_date)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(TransportBooking.booking_date.desc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    bookings = result.scalars().all()

    return TransportBookingListResponse(
        data=[TransportBookingResponse.model_validate(b) for b in bookings],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 0,
    )


@router.post("/bookings", response_model=TransportBookingResponse, status_code=201)
async def create_transport_booking(
    data: TransportBookingCreate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Create a new transport booking request.

    Any authenticated user can create a booking request.
    The booking is created with status "requested" and requires approval.
    """
    booking = TransportBooking(
        college_id=user.college_id,
        requested_by=user.user_id,
        **data.model_dump(exclude_unset=True),
    )
    db.add(booking)
    await db.commit()
    await db.refresh(booking)
    return TransportBookingResponse.model_validate(booking)


@router.patch("/bookings/{booking_id}", response_model=TransportBookingResponse)
async def update_transport_booking(
    booking_id: UUID,
    data: TransportBookingUpdate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Update a transport booking (approve, reject, assign vehicle, etc.).

    Requires: admin, dean, or management role.
    Only fields present in the request body are updated.
    """
    result = await db.execute(
        select(TransportBooking).where(TransportBooking.id == booking_id)
    )
    booking = result.scalar_one_or_none()
    if booking is None:
        raise NotFoundException("TransportBooking", str(booking_id))

    update_data = data.model_dump(exclude_unset=True)

    # Verify vehicle exists if being assigned
    if "vehicle_id" in update_data and update_data["vehicle_id"] is not None:
        vehicle_result = await db.execute(
            select(Vehicle).where(Vehicle.id == update_data["vehicle_id"])
        )
        if vehicle_result.scalar_one_or_none() is None:
            raise NotFoundException("Vehicle", str(update_data["vehicle_id"]))

    for field, value in update_data.items():
        setattr(booking, field, value)

    await db.commit()
    await db.refresh(booking)
    return TransportBookingResponse.model_validate(booking)


# ===================================================================
# Vehicle Maintenance Logs
# ===================================================================


@router.get("/maintenance", response_model=VehicleMaintenanceLogListResponse)
async def list_maintenance_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    vehicle_id: UUID | None = Query(None, description="Filter by vehicle"),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List vehicle maintenance logs with pagination and optional vehicle filter."""
    query = select(VehicleMaintenanceLog)

    if vehicle_id is not None:
        query = query.where(VehicleMaintenanceLog.vehicle_id == vehicle_id)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(VehicleMaintenanceLog.date.desc().nullslast()).offset(offset).limit(page_size)
    result = await db.execute(query)
    logs = result.scalars().all()

    return VehicleMaintenanceLogListResponse(
        data=[VehicleMaintenanceLogResponse.model_validate(l) for l in logs],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 0,
    )


@router.post("/maintenance", response_model=VehicleMaintenanceLogResponse, status_code=201)
async def create_maintenance_log(
    data: VehicleMaintenanceLogCreate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Create a new vehicle maintenance log entry.

    Requires: admin, dean, or management role.
    Optionally updates the vehicle's last_service_date and next_service_due
    if maintenance_type is "scheduled" or "service".
    """
    # Verify vehicle exists
    vehicle_result = await db.execute(
        select(Vehicle).where(Vehicle.id == data.vehicle_id)
    )
    vehicle = vehicle_result.scalar_one_or_none()
    if vehicle is None:
        raise NotFoundException("Vehicle", str(data.vehicle_id))

    log = VehicleMaintenanceLog(
        college_id=user.college_id,
        **data.model_dump(exclude_unset=True),
    )
    db.add(log)

    # Update vehicle service tracking if this is a scheduled service
    if data.maintenance_type in ("scheduled", "service"):
        if data.date is not None:
            vehicle.last_service_date = data.date
        if data.km_reading is not None:
            vehicle.current_km_reading = data.km_reading

    await db.commit()
    await db.refresh(log)
    return VehicleMaintenanceLogResponse.model_validate(log)
