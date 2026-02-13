"""QR Engine models — tenant-scoped action points and scan logs.

QRActionPoint: Configurable locations where QR actions happen (mess, library, etc.)
QRScanLog: Immutable, append-only log of every QR interaction.

Both are tenant-scoped (TenantModel) with RLS on college_id.
"""

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID

from .base import TenantModel


class QRActionPoint(TenantModel):
    """Physical or virtual location where QR actions occur.

    Examples: 'Main Mess Entrance', 'Library Desk 1', 'Anatomy Lecture Hall 3'

    Each action point defines:
    - What action happens here (mess_entry, library_checkout, etc.)
    - How the QR works (Mode A scanner reads people, or Mode B people scan QR here)
    - Security requirements (GPS radius, biometric, time windows)
    - Duplicate scan prevention window
    """

    __tablename__ = "qr_action_points"

    name = Column(String(255), nullable=False)
    description = Column(Text)

    # ── Action Configuration ──
    action_type = Column(String(30), nullable=False, index=True)
    # "mess_entry", "hostel_checkin", "library_visit", "library_checkout",
    # "library_return", "attendance_mark", "equipment_checkout", "event_checkin",
    # "exam_hall_entry", "transport_boarding", "clinical_posting", "fee_payment",
    # "visitor_entry", "certificate_verify"

    location_code = Column(String(50), nullable=False)
    # Unique within a college: "mess_main_1", "lib_desk_1", "anat_lh_3"

    # ── QR Mode ──
    qr_mode = Column(String(10), nullable=False)  # "mode_a" or "mode_b"

    # ── Physical Location ──
    building = Column(String(100))
    floor = Column(Integer)
    gps_latitude = Column(Float)
    gps_longitude = Column(Float)
    geo_radius_meters = Column(Integer, default=100)

    # ── QR Generation Config (for Mode B) ──
    qr_rotation_minutes = Column(Integer, default=0)
    # 0 = static (printed sticker), 5 = rotates every 5 min, etc.
    qr_secret = Column(String(64))  # Per-action-point HMAC secret

    # ── Duplicate Prevention ──
    duplicate_window_minutes = Column(Integer, default=30)
    # 30 = can't scan same action type again within 30 minutes
    # 0 = no duplicate prevention

    # ── Linked Entity ──
    linked_entity_type = Column(String(30))
    linked_entity_id = Column(UUID(as_uuid=True))

    # ── Security Level ──
    security_level = Column(String(20), default="standard")
    # "standard" — Clerk JWT + Device Trust
    # "elevated" — above + GPS within radius
    # "strict" — above + device biometric

    # ── Scanner Device (for Mode A — a fixed tablet/scanner) ──
    scanner_device_trust_id = Column(
        UUID(as_uuid=True), ForeignKey("device_trusts.id"), nullable=True
    )

    # ── Operational Hours ──
    active_hours_start = Column(String(5))  # "06:00"
    active_hours_end = Column(String(5))  # "22:00"
    active_days = Column(JSONB, server_default="[0,1,2,3,4,5]")  # Mon-Sat

    # ── Extra Data ──
    # NOTE: Python attr is `extra_data` because `metadata` is reserved by SQLAlchemy.
    # The DB column is still named `metadata`.
    extra_data = Column("metadata", JSONB, server_default="{}")

    is_active = Column(Boolean, default=True, server_default="true")

    __table_args__ = (
        UniqueConstraint("college_id", "location_code", name="uq_action_point_location"),
        Index("ix_action_point_type", "college_id", "action_type"),
    )


class QRScanLog(TenantModel):
    """Immutable, append-only log of every QR interaction.

    This is the SINGLE SOURCE OF TRUTH for mess meals, library visits,
    attendance marks, equipment checkouts, etc.

    Other systems read from this table to derive their own state.
    """

    __tablename__ = "qr_scan_logs"

    # ── Who ──
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    user_type = Column(String(10))  # "stu", "fac", "sta", "vis"
    device_trust_id = Column(UUID(as_uuid=True), ForeignKey("device_trusts.id"))

    # ── What ──
    action_type = Column(String(30), nullable=False, index=True)
    action_point_id = Column(
        UUID(as_uuid=True), ForeignKey("qr_action_points.id"), nullable=True
    )
    qr_mode = Column(String(10))  # "mode_a" or "mode_b"

    # ── Context ──
    entity_type = Column(String(30))  # "book", "equipment", "event", "exam", "meal"
    entity_id = Column(UUID(as_uuid=True))
    # NOTE: Python attr is `extra_data` because `metadata` is reserved by SQLAlchemy.
    extra_data = Column("metadata", JSONB, server_default="{}")

    # ── Location ──
    scan_latitude = Column(Float)
    scan_longitude = Column(Float)
    geo_validated = Column(Boolean)

    # ── Validation ──
    device_validated = Column(Boolean, nullable=False, default=False, server_default="false")
    biometric_confirmed = Column(Boolean, default=False, server_default="false")
    validation_result = Column(String(20), nullable=False)
    # "success", "device_mismatch", "expired_token", "geo_violation",
    # "time_violation", "duplicate_scan", "revoked_device", "unauthorized",
    # "invalid_qr", "no_handler"
    rejection_reason = Column(Text)

    # ── Timestamp ──
    scanned_at = Column(DateTime(timezone=True), server_default=text("NOW()"))

    __table_args__ = (
        Index(
            "ix_scan_log_user_action_time",
            "college_id",
            "user_id",
            "action_type",
            "scanned_at",
        ),
        Index(
            "ix_scan_log_action_point_time",
            "college_id",
            "action_point_id",
            "scanned_at",
        ),
    )
