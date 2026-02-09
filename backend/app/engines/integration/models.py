"""Integration Engine — SQLAlchemy Models."""

from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.shared.models import TenantModel


class AttendanceRecord(TenantModel):
    """AEBAS parallel capture attendance records. Partitioned by month."""
    __tablename__ = "attendance_records"

    person_id = Column(UUID(as_uuid=True), nullable=False)  # FK to students or faculty
    person_type = Column(String(10), nullable=False)  # "student", "faculty"
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"))

    date = Column(Date, nullable=False)
    check_in = Column(DateTime(timezone=True))
    check_out = Column(DateTime(timezone=True))
    hours_present = Column(Float)

    source = Column(String(20), default="manual")  # "manual", "aebas", "gps"
    gps_latitude = Column(Float)
    gps_longitude = Column(Float)
    within_geofence = Column(String(5))  # "yes", "no"


class HMISDataPoint(TenantModel):
    """Hospital Management Information System bridge records."""
    __tablename__ = "hmis_data_points"

    data_type = Column(String(50), nullable=False)  # "opd_count", "ipd_count", "bed_occupancy"
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"))
    date = Column(Date, nullable=False)
    value = Column(Float, nullable=False)
    source_system = Column(String(50))  # HMIS vendor name
    raw_data = Column(JSONB)


class PaymentTransaction(TenantModel):
    """Razorpay webhook events."""
    __tablename__ = "payment_transactions"

    razorpay_event_id = Column(String(100), unique=True)
    event_type = Column(String(50))  # "payment.captured", "payment.failed", "refund.processed"
    payload = Column(JSONB)
    processed = Column(DateTime(timezone=True))
    status = Column(String(20), default="received")
