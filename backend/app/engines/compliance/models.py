"""Compliance Engine — SQLAlchemy Models."""

import uuid

from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.shared.models import Base, TenantModel


class ComplianceSnapshot(TenantModel):
    """Daily compliance score snapshot per department."""
    __tablename__ = "compliance_snapshots"
    __table_args__ = (
        UniqueConstraint("college_id", "department_id", "snapshot_date"),
    )

    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"))
    snapshot_date = Column(Date, nullable=False)

    # Faculty MSR
    faculty_required = Column(Integer)
    faculty_actual = Column(Integer)
    faculty_ratio = Column(Float)
    faculty_status = Column(String(10))  # "green", "yellow", "orange", "red"

    # Attendance
    avg_faculty_attendance_pct = Column(Float)
    avg_student_attendance_pct = Column(Float)
    attendance_status = Column(String(10))

    # Hospital Infrastructure
    bed_occupancy_pct = Column(Float)
    opd_daily_avg = Column(Integer)
    ipd_daily_avg = Column(Integer)

    # Overall
    compliance_score = Column(Float)  # 0-100
    risk_level = Column(String(10))   # "low", "medium", "high", "critical"

    # Predictions (Prophet forecasting)
    predicted_score_30d = Column(Float)
    predicted_score_60d = Column(Float)


class NMCStandard(Base):
    """Reference table: NMC MSR thresholds by intake size. NOT tenant-scoped."""
    __tablename__ = "nmc_standards"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    intake_size = Column(Integer, nullable=False)
    department = Column(String(100))

    min_professors = Column(Integer)
    min_associate_professors = Column(Integer)
    min_assistant_professors = Column(Integer)
    min_tutors_demonstrators = Column(Integer)
    min_senior_residents = Column(Integer)

    min_beds = Column(Integer)
    min_opd_per_day = Column(Integer)
    min_lecture_hall_capacity = Column(Integer)
    min_library_books = Column(Integer)
    min_indian_journals = Column(Integer)
    min_foreign_journals = Column(Integer)

    regulation_reference = Column(String(255))
    effective_date = Column(Date)


class SAFSubmission(TenantModel):
    """Tracks SAF form generation and submission status."""
    __tablename__ = "saf_submissions"

    form_type = Column(String(10), nullable=False)  # "AI", "AII", "AIII"
    academic_year = Column(String(10))
    status = Column(String(20), default="draft")

    form_data = Column(JSONB)
    discrepancies = Column(JSONB, default=[])

    generated_at = Column(DateTime(timezone=True))
    generated_by = Column(UUID(as_uuid=True))
    reviewed_by = Column(UUID(as_uuid=True))
    reviewed_at = Column(DateTime(timezone=True))
    submitted_at = Column(DateTime(timezone=True))


class MSRAlert(TenantModel):
    """Faculty MSR strength breach alerts."""
    __tablename__ = "msr_alerts"

    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"))
    alert_type = Column(String(50))  # "faculty_shortage", "retirement_upcoming", "ratio_breach"
    severity = Column(String(10))    # "warning", "critical"
    message = Column(Text)
    data = Column(JSONB)
    acknowledged = Column(DateTime(timezone=True))
    resolved = Column(DateTime(timezone=True))
