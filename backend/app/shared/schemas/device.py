"""Pydantic schemas for Device Trust."""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class DeviceInfo(BaseModel):
    """Device identification attributes collected from mobile app."""

    platform: str = Field(..., max_length=10)  # "android" | "ios"
    device_id: str = Field(..., max_length=100)
    device_model: str = Field(..., max_length=100)
    device_manufacturer: str = Field("", max_length=100)
    os_version: str = Field("", max_length=20)
    app_version: str = Field("", max_length=20)
    screen_width: int = 0
    screen_height: int = 0
    ram_mb: int = 0
    sim_operator: str = Field("", max_length=50)
    sim_country: str = Field("", max_length=5)


class RegisterDeviceRequest(BaseModel):
    """Request to initiate device registration."""

    phone_number: str = Field(..., max_length=15)
    device_info: DeviceInfo

    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        v = v.strip()
        # Accept +91XXXXXXXXXX or 10-digit starting with 6-9
        if v.startswith("+91") and len(v) == 13 and v[3:].isdigit():
            return v
        if len(v) == 10 and v[0] in "6789" and v.isdigit():
            return f"+91{v}"
        raise ValueError("Phone must be +91XXXXXXXXXX or 10-digit Indian number")


class RegisterDeviceResponse(BaseModel):
    """Response after initiating device registration."""

    verification_id: UUID
    sms_target_number: str
    sms_body_template: str
    verification_code: str
    expires_in_seconds: int


class DeviceStatusResponse(BaseModel):
    """Response for device registration status check."""

    status: str
    device_trust_token: Optional[str] = None
    token_expires_at: Optional[datetime] = None
    message: Optional[str] = None


class TransferInitiateResponse(BaseModel):
    """Response after initiating device transfer."""

    transfer_code: str
    expires_in: int


class TransferCompleteRequest(BaseModel):
    """Request to complete device transfer on new device."""

    transfer_code: str
    device_info: DeviceInfo


class DeviceResetRequest(BaseModel):
    """Admin request to reset a user's device."""

    reason: str = Field(..., max_length=100)
    admin_notes: Optional[str] = None


class DeviceTrustResponse(BaseModel):
    """Device trust record response for admin views."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    device_model: Optional[str] = None
    platform: str
    status: str
    verified_phone: Optional[str] = None
    last_active_at: Optional[datetime] = None
    total_qr_scans: int = 0
    created_at: datetime


class FlaggedUserResponse(BaseModel):
    """User flagged for suspicious device resets."""

    user_id: UUID
    reset_count: int
    last_reset_at: Optional[datetime] = None
