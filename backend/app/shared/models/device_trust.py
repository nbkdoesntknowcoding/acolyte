"""Device Trust models — platform-level (NOT tenant-scoped).

These tables manage device registration, transfer, and audit for the
AQP (Acolyte QR Protocol) Device Trust Security Layer.

No RLS policies are applied — a user's device exists outside any single college.
"""

from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import UUID

from .base import Base


class DeviceTrust(Base):
    """Device registration and trust management.

    NOT tenant-scoped — a user's device exists outside any single college.
    Platform-level table.
    """

    __tablename__ = "device_trusts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    # ── Device Identification ──
    device_fingerprint = Column(String(64), nullable=False)
    platform = Column(String(10), nullable=False)  # "android", "ios"
    device_id = Column(String(100), nullable=False)  # Native device ID
    device_model = Column(String(100))
    device_manufacturer = Column(String(100))
    os_version = Column(String(20))
    app_version = Column(String(20))
    screen_width = Column(Integer)
    screen_height = Column(Integer)
    ram_mb = Column(Integer)
    sim_operator = Column(String(50))
    sim_country = Column(String(5))

    # ── Phone Verification ──
    claimed_phone = Column(String(15), nullable=False)
    verified_phone = Column(String(15))
    phone_verified_at = Column(DateTime(timezone=True))
    verification_code_hash = Column(String(64))
    verification_code_expires_at = Column(DateTime(timezone=True))
    sms_verified = Column(Boolean, default=False)
    sms_gateway_message_id = Column(String(100))

    # ── Trust Token ──
    device_trust_token_hash = Column(String(64))  # Hash of issued token for revocation check
    token_issued_at = Column(DateTime(timezone=True))
    token_expires_at = Column(DateTime(timezone=True))

    # ── Status ──
    status = Column(String(30), default="pending_sms_verification", index=True)
    # Values: "pending_sms_verification", "active", "revoked", "expired",
    # "transferred", "verification_failed", "suspended"

    # ── Revocation ──
    revoked_at = Column(DateTime(timezone=True))
    revoked_by = Column(UUID(as_uuid=True))
    revoke_reason = Column(String(100))

    # ── Activity ──
    last_active_at = Column(DateTime(timezone=True))
    total_qr_scans = Column(Integer, default=0)
    last_qr_scan_at = Column(DateTime(timezone=True))

    # ── Timestamps ──
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("NOW()"))

    __table_args__ = (
        # Only ONE active device per user
        Index(
            "ix_device_trust_user_active",
            "user_id",
            unique=True,
            postgresql_where=text("status = 'active'"),
        ),
        # Fast lookup by phone number (for SMS webhook matching)
        Index("ix_device_trust_phone_pending", "claimed_phone", "status"),
    )


class DeviceTransferRequest(Base):
    """Tracks device transfer requests (self-service phone change)."""

    __tablename__ = "device_transfer_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    old_device_trust_id = Column(
        UUID(as_uuid=True), ForeignKey("device_trusts.id"), nullable=False
    )
    transfer_code_hash = Column(String(64), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(20), default="pending")  # "pending", "completed", "expired"
    new_device_trust_id = Column(UUID(as_uuid=True), ForeignKey("device_trusts.id"))
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"))


class DeviceResetLog(Base):
    """Audit trail for admin-initiated device resets. Append-only."""

    __tablename__ = "device_reset_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    device_trust_id = Column(
        UUID(as_uuid=True), ForeignKey("device_trusts.id"), nullable=False
    )
    reset_by = Column(UUID(as_uuid=True), nullable=False)  # Admin who reset
    reset_reason = Column(String(100), nullable=False)
    admin_notes = Column(Text)
    reset_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
