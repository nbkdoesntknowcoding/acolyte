"""Admin Engine — SQLAlchemy Models."""

import uuid

from sqlalchemy import BigInteger, Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.shared.models import Base, TenantModel


class College(Base):
    """Top-level tenant entity. NOT tenant-scoped itself."""
    __tablename__ = "colleges"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False)

    state = Column(String(100), nullable=False)
    district = Column(String(100))
    university_affiliation = Column(String(255))
    nmc_recognition_status = Column(String(50))

    total_intake = Column(Integer, nullable=False)
    intake_year_started = Column(Integer)

    required_faculty = Column(Integer)
    required_tutors = Column(Integer)
    required_beds = Column(Integer)

    features = Column(JSONB, default={})
    config = Column(JSONB, default={})

    created_at = Column(DateTime(timezone=True), server_default="NOW()")


class Department(TenantModel):
    """Department definitions with MSR thresholds."""
    __tablename__ = "departments"

    name = Column(String(100), nullable=False)
    code = Column(String(20))
    department_type = Column(String(20))  # "preclinical", "paraclinical", "clinical"
    hod_id = Column(UUID(as_uuid=True), ForeignKey("faculty.id", use_alter=True))


class Student(TenantModel):
    """Student master record."""
    __tablename__ = "students"

    name = Column(String(255), nullable=False)
    email = Column(String(255))
    phone = Column(String(20))
    date_of_birth = Column(Date)
    gender = Column(String(20))
    aadhaar_hash = Column(String(64))  # SHA-256 only

    neet_roll_number = Column(String(20))
    neet_score = Column(Integer)
    neet_rank = Column(Integer)
    neet_percentile = Column(Float)
    admission_quota = Column(String(30))
    admission_year = Column(Integer)

    current_phase = Column(String(10))
    current_semester = Column(Integer)
    enrollment_number = Column(String(50))
    university_registration_number = Column(String(50))

    status = Column(String(20), default="active")
    clerk_user_id = Column(String(255), unique=True)


class Faculty(TenantModel):
    """Faculty master record."""
    __tablename__ = "faculty"

    name = Column(String(255), nullable=False)
    email = Column(String(255))
    phone = Column(String(20))

    designation = Column(String(50))
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=False)
    qualification = Column(String(100))
    specialization = Column(String(100))

    nmc_faculty_id = Column(String(50))
    aebas_id = Column(String(50))
    date_of_joining = Column(Date)
    date_of_birth = Column(Date)
    retirement_date = Column(Date)

    teaching_experience_years = Column(Float)
    clinical_experience_years = Column(Float)

    qualification_validated = Column(Boolean, default=False)
    is_eligible_per_nmc = Column(Boolean, default=True)
    validation_notes = Column(Text)

    status = Column(String(20), default="active")
    employment_type = Column(String(20))
    clerk_user_id = Column(String(255), unique=True)


class Batch(TenantModel):
    """Student batch groupings."""
    __tablename__ = "batches"

    name = Column(String(100), nullable=False)
    admission_year = Column(Integer, nullable=False)
    phase = Column(String(10))
    student_count = Column(Integer, default=0)


class FeeStructure(TenantModel):
    """Fee configuration per quota per academic year."""
    __tablename__ = "fee_structures"

    academic_year = Column(String(10), nullable=False)
    quota = Column(String(30), nullable=False)

    tuition_fee = Column(BigInteger, nullable=False)
    development_fee = Column(BigInteger, default=0)
    hostel_fee = Column(BigInteger, default=0)
    mess_fee = Column(BigInteger, default=0)
    exam_fee = Column(BigInteger, default=0)
    library_fee = Column(BigInteger, default=0)
    lab_fee = Column(BigInteger, default=0)
    caution_deposit = Column(BigInteger, default=0)
    admission_charges = Column(BigInteger, default=0)

    fee_regulatory_cap = Column(BigInteger)
    approved_by = Column(String(255))


class FeePayment(TenantModel):
    """Individual fee payment records."""
    __tablename__ = "fee_payments"

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    fee_structure_id = Column(UUID(as_uuid=True), ForeignKey("fee_structures.id"))

    amount = Column(BigInteger, nullable=False)
    payment_method = Column(String(20))
    razorpay_payment_id = Column(String(100))
    razorpay_order_id = Column(String(100))

    status = Column(String(20), default="pending")
    fee_component = Column(String(50))
    semester = Column(Integer)
    installment_number = Column(Integer)

    receipt_number = Column(String(50), unique=True)
    receipt_url = Column(String(500))
