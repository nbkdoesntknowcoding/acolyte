"""Pydantic schemas for QR Engine."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ScanResult(BaseModel):
    """Result of a QR scan operation."""

    success: bool
    action_type: Optional[str] = None
    message: str = ""
    data: Optional[dict[str, Any]] = None
    scan_log_id: Optional[UUID] = None


class GPSCoordinates(BaseModel):
    """GPS coordinates from the scanning device."""

    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)


class ModeAScanRequest(BaseModel):
    """Mode A: Scanner device reads a person's QR code."""

    scanned_qr_data: str = Field(..., description="JWT token from scanned person's QR")
    action_point_id: UUID
    gps: Optional[GPSCoordinates] = None


class ModeBScanRequest(BaseModel):
    """Mode B: Person scans a location QR code."""

    scanned_qr_data: str = Field(..., description="acolyte:// URL from location QR")
    gps: Optional[GPSCoordinates] = None


class ModeBConfirmRequest(BaseModel):
    """Mode B confirmation: Select entity after scan (e.g., which book to return)."""

    scan_log_id: UUID
    selected_entity_id: UUID


class IdentityQRResponse(BaseModel):
    """Response containing the user's rotating QR identity token."""

    token: str
    expires_in: int
    refresh_in: int


# ---------------------------------------------------------------------------
# Action Point CRUD schemas
# ---------------------------------------------------------------------------

class QRActionPointCreate(BaseModel):
    """Create a new QR action point."""

    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    action_type: str = Field(..., max_length=30)
    location_code: str = Field(..., max_length=50)
    qr_mode: str = Field(..., pattern="^(mode_a|mode_b)$")
    building: Optional[str] = Field(None, max_length=100)
    floor: Optional[int] = None
    gps_latitude: Optional[float] = None
    gps_longitude: Optional[float] = None
    geo_radius_meters: int = 100
    qr_rotation_minutes: int = 0
    duplicate_window_minutes: int = 30
    linked_entity_type: Optional[str] = Field(None, max_length=30)
    linked_entity_id: Optional[UUID] = None
    security_level: str = Field("standard", pattern="^(standard|elevated|strict)$")
    active_hours_start: Optional[str] = Field(None, max_length=5)
    active_hours_end: Optional[str] = Field(None, max_length=5)
    active_days: Optional[list[int]] = None
    metadata: Optional[dict[str, Any]] = None


class QRActionPointUpdate(BaseModel):
    """Update an existing QR action point (all fields optional)."""

    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    action_type: Optional[str] = Field(None, max_length=30)
    location_code: Optional[str] = Field(None, max_length=50)
    qr_mode: Optional[str] = Field(None, pattern="^(mode_a|mode_b)$")
    building: Optional[str] = Field(None, max_length=100)
    floor: Optional[int] = None
    gps_latitude: Optional[float] = None
    gps_longitude: Optional[float] = None
    geo_radius_meters: Optional[int] = None
    qr_rotation_minutes: Optional[int] = None
    duplicate_window_minutes: Optional[int] = None
    linked_entity_type: Optional[str] = Field(None, max_length=30)
    linked_entity_id: Optional[UUID] = None
    security_level: Optional[str] = Field(None, pattern="^(standard|elevated|strict)$")
    active_hours_start: Optional[str] = Field(None, max_length=5)
    active_hours_end: Optional[str] = Field(None, max_length=5)
    active_days: Optional[list[int]] = None
    metadata: Optional[dict[str, Any]] = None
    is_active: Optional[bool] = None


class QRActionPointResponse(BaseModel):
    """Action point response for API."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    college_id: UUID
    name: str
    description: Optional[str] = None
    action_type: str
    location_code: str
    qr_mode: str
    building: Optional[str] = None
    floor: Optional[int] = None
    gps_latitude: Optional[float] = None
    gps_longitude: Optional[float] = None
    geo_radius_meters: Optional[int] = None
    qr_rotation_minutes: int = 0
    duplicate_window_minutes: int = 30
    security_level: str = "standard"
    active_hours_start: Optional[str] = None
    active_hours_end: Optional[str] = None
    active_days: Optional[list[int]] = None
    is_active: bool = True
    created_at: datetime


class QRScanLogResponse(BaseModel):
    """Scan log entry response for API."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    user_type: Optional[str] = None
    action_type: str
    action_point_id: Optional[UUID] = None
    qr_mode: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[UUID] = None
    scan_latitude: Optional[float] = None
    scan_longitude: Optional[float] = None
    geo_validated: Optional[bool] = None
    device_validated: bool = False
    validation_result: str
    rejection_reason: Optional[str] = None
    scanned_at: Optional[datetime] = None


class ScanLogFilterParams(BaseModel):
    """Query parameters for filtering scan logs."""

    user_id: Optional[UUID] = None
    action_type: Optional[str] = None
    validation_result: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    page: int = 1
    page_size: int = 20
