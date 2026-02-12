"""Admin Engine — SQLAlchemy Models.

28 model classes covering: College, Departments, Students, Faculty, Fees,
Scholarships, Payroll, Leave, Recruitment, Certificates, Alumni, Hostel,
Transport, Library, Infrastructure, Notices, Grievances, Workflows,
Documents, Academic Calendar, Timetable, Clinical Rotations.

All money stored as BigInteger in paisa (1 rupee = 100 paisa).
All tenant-scoped models extend TenantModel (college_id + RLS).
"""

import enum
import uuid

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
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

from app.shared.models import Base, TenantModel


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class NMCDepartmentType(str, enum.Enum):
    PRECLINICAL = "preclinical"
    PARACLINICAL = "paraclinical"
    CLINICAL = "clinical"


# ===================================================================
# 1. College (tenant root — NOT tenant-scoped)
# ===================================================================

class College(Base):
    """Top-level tenant entity. NOT tenant-scoped itself."""
    __tablename__ = "colleges"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    nmc_registration_number = Column(String(50), unique=True)
    university_affiliation = Column(String(255))
    state = Column(String(100), nullable=False)
    district = Column(String(100))
    address = Column(Text)
    city = Column(String(100))
    pin_code = Column(String(10))
    phone = Column(String(20))
    email = Column(String(255))
    website = Column(String(500))
    established_year = Column(Integer)
    college_type = Column(String(30))  # "government", "private", "deemed"
    sanctioned_intake = Column(Integer, nullable=False)
    total_intake = Column(Integer, nullable=False)
    intake_year_started = Column(Integer)
    logo_url = Column(String(500))

    required_faculty = Column(Integer)
    required_tutors = Column(Integer)
    required_beds = Column(Integer)

    nmc_recognition_status = Column(String(50))
    features = Column(JSONB, default={})
    config = Column(JSONB, default={})
    # config: academic_calendar_start, exam_pattern, languages, timezone,
    # fee_regulatory_authority, state_fee_cap_rules, attendance_thresholds,
    # teaching_weeks_per_year (default 39), working_days_per_week (default 6)

    status = Column(String(20), server_default="active")
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"))


# ===================================================================
# 2. Department
# ===================================================================

class Department(TenantModel):
    """Academic department within a college."""
    __tablename__ = "departments"
    __table_args__ = (
        UniqueConstraint("college_id", "code", name="uq_department_college_code"),
        Index("ix_dept_college_active", "college_id", "is_active"),
    )

    name = Column(String(100), nullable=False)
    code = Column(String(20), nullable=False)
    department_type = Column(String(30))  # "pre_clinical", "para_clinical", "clinical"
    nmc_department_type = Column(String(20), nullable=False)
    hod_id = Column(
        UUID(as_uuid=True),
        ForeignKey("faculty.id", use_alter=True),
        nullable=True,
    )
    beds = Column(Integer, default=0)
    opd_rooms = Column(Integer, default=0)
    labs = Column(Integer, default=0)
    lecture_halls = Column(Integer, default=0)
    nmc_department_code = Column(String(20))
    is_active = Column(Boolean, nullable=False, server_default="true")
    display_order = Column(Integer, default=0)
    established_year = Column(Integer, nullable=True)


# ===================================================================
# 3. Batch
# ===================================================================

class Batch(TenantModel):
    """Student batch groupings."""
    __tablename__ = "batches"

    name = Column(String(100), nullable=False)
    batch_type = Column(String(20))  # "admission_year" or "rotation_group"
    admission_year = Column(Integer, nullable=False)
    current_phase = Column(String(20))  # "Phase I", "Phase II", "Phase III", "CRMI"
    current_semester = Column(Integer)
    phase = Column(String(10))
    student_count = Column(Integer, default=0)
    is_active = Column(Boolean, server_default="true")


# ===================================================================
# 4. Student
# ===================================================================

class Student(TenantModel):
    """Student master record."""
    __tablename__ = "students"
    __table_args__ = (
        Index("ix_student_college_status", "college_id", "status"),
        Index("ix_student_college_batch", "college_id", "batch_id"),
        Index("ix_student_college_phase", "college_id", "current_phase"),
    )

    # Personal
    name = Column(String(255), nullable=False)
    email = Column(String(255))
    phone = Column(String(20))
    date_of_birth = Column(Date)
    gender = Column(String(20))
    blood_group = Column(String(10))
    nationality = Column(String(50), default="Indian")
    religion = Column(String(50))
    category = Column(String(20))  # "General", "SC", "ST", "OBC", "EWS", "PwD"
    aadhaar_hash = Column(String(64))  # SHA-256 only
    photo_url = Column(String(500))

    # Parent/Guardian
    father_name = Column(String(255))
    mother_name = Column(String(255))
    guardian_phone = Column(String(20))
    guardian_email = Column(String(255))
    emergency_contact_name = Column(String(255))
    emergency_contact_phone = Column(String(20))

    # Address
    permanent_address = Column(Text)
    city = Column(String(100))
    state = Column(String(100))
    pin_code = Column(String(10))

    # NEET & Admission
    neet_roll_number = Column(String(20))
    neet_score = Column(Integer)
    neet_rank = Column(Integer)
    neet_percentile = Column(Float)
    neet_year = Column(Integer)
    admission_quota = Column(String(30))  # "AIQ", "State", "Management", "NRI", "Institutional"
    counseling_round = Column(String(30))
    allotment_order_number = Column(String(100))
    admission_date = Column(Date)
    admission_year = Column(Integer)

    # Previous Education
    class_10_board = Column(String(100))
    class_10_percentage = Column(Float)
    class_12_board = Column(String(100))
    class_12_percentage = Column(Float)
    pcb_percentage = Column(Float)
    gap_years = Column(Integer, default=0)

    # Academic
    enrollment_number = Column(String(50), unique=True)
    university_registration_number = Column(String(50))
    current_phase = Column(String(20))
    current_semester = Column(Integer)
    batch_id = Column(UUID(as_uuid=True), ForeignKey("batches.id"), nullable=True)

    # Status
    status = Column(String(20), default="active")
    # "applied", "documents_submitted", "under_verification", "fee_pending",
    # "enrolled", "active", "suspended", "rusticated", "graduated", "dropped"

    # Hostel
    hostel_room_id = Column(UUID(as_uuid=True), ForeignKey("hostel_rooms.id", use_alter=True), nullable=True)
    is_hosteler = Column(Boolean, default=False)

    # NMC Data Upload
    nmc_uploaded = Column(Boolean, default=False)
    nmc_upload_date = Column(DateTime(timezone=True))

    # Auth
    clerk_user_id = Column(String(255), unique=True)


# ===================================================================
# 5. Student Documents
# ===================================================================

class StudentDocument(TenantModel):
    """Student document uploads and verification."""
    __tablename__ = "student_documents"
    __table_args__ = (
        Index("ix_studdoc_college_student", "college_id", "student_id"),
    )

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    document_type = Column(String(50), nullable=False)
    # "neet_admit_card", "neet_scorecard", "class_10_marksheet", "class_12_marksheet",
    # "transfer_certificate", "domicile_certificate", "caste_certificate",
    # "income_certificate", "disability_certificate", "migration_certificate",
    # "gap_certificate", "character_certificate", "aadhaar_card", "birth_certificate",
    # "medical_fitness_certificate", "passport_photos"
    file_url = Column(String(500))
    file_name = Column(String(255))
    file_size = Column(Integer)
    mime_type = Column(String(100))
    is_required = Column(Boolean, default=True)
    verification_status = Column(String(20), default="not_uploaded")
    # "not_uploaded", "uploaded", "under_review", "verified", "rejected"
    verified_by = Column(UUID(as_uuid=True), nullable=True)
    verified_at = Column(DateTime(timezone=True))
    rejection_reason = Column(Text)
    ocr_extracted_data = Column(JSONB)


# ===================================================================
# 6. Faculty
# ===================================================================

class Faculty(TenantModel):
    """Faculty master record."""
    __tablename__ = "faculty"
    __table_args__ = (
        Index("ix_faculty_college_dept", "college_id", "department_id"),
        Index("ix_faculty_college_status", "college_id", "status"),
    )

    # Personal
    name = Column(String(255), nullable=False)
    email = Column(String(255))
    phone = Column(String(20))
    date_of_birth = Column(Date)
    gender = Column(String(20))
    photo_url = Column(String(500))
    aadhaar_hash = Column(String(64))
    pan_number_hash = Column(String(64))

    # Address
    permanent_address = Column(Text)
    city = Column(String(100))
    state = Column(String(100))
    pin_code = Column(String(10))

    # NMC Classification
    designation = Column(String(50))
    # "Professor", "Associate Professor", "Assistant Professor", "Tutor", "Senior Resident", "Demonstrator"
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=False)
    qualification = Column(String(100))
    specialization = Column(String(100))
    sub_specialization = Column(String(100))

    # NMC IDs
    nmc_faculty_id = Column(String(50))
    aebas_id = Column(String(50))
    employee_id = Column(String(50))

    # Employment
    date_of_joining = Column(Date)
    retirement_date = Column(Date)
    employment_type = Column(String(20))  # "permanent", "contractual", "visiting", "adjunct"
    pay_scale_type = Column(String(20))  # "7cpc", "private", "consolidated"

    # Experience
    teaching_experience_years = Column(Float)
    clinical_experience_years = Column(Float)
    total_experience_years = Column(Float)

    # Qualification Validation
    qualification_validated = Column(Boolean, default=False)
    is_eligible_per_nmc = Column(Boolean, default=True)
    validation_notes = Column(Text)

    # Academic
    orcid_id = Column(String(50))
    publications_count = Column(Integer, default=0)
    h_index = Column(Integer, default=0)
    bcme_completed = Column(Boolean, default=False)

    # Bank Details
    bank_account_number_hash = Column(String(64))
    bank_ifsc = Column(String(20))
    bank_name = Column(String(100))

    # Status
    status = Column(String(20), default="active")
    # "active", "on_leave", "sabbatical", "deputation", "resigned", "retired", "terminated"

    clerk_user_id = Column(String(255), unique=True)


# ===================================================================
# 7. Faculty Qualifications
# ===================================================================

class FacultyQualification(TenantModel):
    """Multiple degrees/qualifications per faculty member."""
    __tablename__ = "faculty_qualifications"
    __table_args__ = (
        Index("ix_facqual_college_faculty", "college_id", "faculty_id"),
    )

    faculty_id = Column(UUID(as_uuid=True), ForeignKey("faculty.id"), nullable=False)
    degree = Column(String(50), nullable=False)  # "MBBS", "MD", "MS", "DNB", "PhD", "DM", "MCh"
    specialization = Column(String(100))
    university = Column(String(255))
    year_of_passing = Column(Integer)
    certificate_url = Column(String(500))
    nmc_verified = Column(Boolean, default=False)
    hospital_bed_count = Column(Integer)  # For DNB equivalence check
    is_highest = Column(Boolean, default=False)


# ===================================================================
# 8. Fee Structure
# ===================================================================

class FeeStructure(TenantModel):
    """Fee configuration per quota per academic year."""
    __tablename__ = "fee_structures"
    __table_args__ = (
        Index("ix_feestruct_college_year_quota", "college_id", "academic_year", "quota"),
    )

    academic_year = Column(String(10), nullable=False)
    quota = Column(String(30), nullable=False)  # "AIQ", "State", "Management", "NRI", "Institutional"

    # Fee components (all in paisa)
    tuition_fee = Column(BigInteger, nullable=False, default=0)
    development_fee = Column(BigInteger, default=0)
    hostel_fee_boys = Column(BigInteger, default=0)
    hostel_fee_girls = Column(BigInteger, default=0)
    hostel_fee = Column(BigInteger, default=0)
    mess_fee = Column(BigInteger, default=0)
    examination_fee = Column(BigInteger, default=0)
    exam_fee = Column(BigInteger, default=0)
    library_fee = Column(BigInteger, default=0)
    laboratory_fee = Column(BigInteger, default=0)
    lab_fee = Column(BigInteger, default=0)
    caution_deposit = Column(BigInteger, default=0)
    admission_charges = Column(BigInteger, default=0)
    university_registration_fee = Column(BigInteger, default=0)
    insurance_premium = Column(BigInteger, default=0)
    identity_card_fee = Column(BigInteger, default=0)
    other_fees = Column(BigInteger, default=0)
    other_fees_description = Column(Text)

    # Regulatory
    fee_regulatory_cap = Column(BigInteger)
    approved_by = Column(String(255))
    approval_date = Column(Date)
    approval_document_url = Column(String(500))

    # Installment config
    installment_config = Column(JSONB)
    # [{"installment_no": 1, "due_date": "2025-08-15", "percentage": 60}, ...]
    late_fee_per_day = Column(BigInteger, default=0)
    grace_period_days = Column(Integer, default=15)
    is_active = Column(Boolean, server_default="true")


# ===================================================================
# 9. Fee Payment
# ===================================================================

class FeePayment(TenantModel):
    """Individual fee payment records."""
    __tablename__ = "fee_payments"
    __table_args__ = (
        Index("ix_feepay_college_student", "college_id", "student_id"),
        Index("ix_feepay_college_status", "college_id", "status"),
    )

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    fee_structure_id = Column(UUID(as_uuid=True), ForeignKey("fee_structures.id"))
    academic_year = Column(String(10))
    semester = Column(Integer)
    installment_number = Column(Integer)

    # Payment
    amount = Column(BigInteger, nullable=False)  # In paisa
    payment_method = Column(String(20))
    # "upi", "credit_card", "debit_card", "net_banking", "neft", "rtgs", "demand_draft", "cash"

    # Razorpay
    razorpay_payment_id = Column(String(100))
    razorpay_order_id = Column(String(100))
    razorpay_signature = Column(String(255))

    # Non-Razorpay
    reference_number = Column(String(100))
    bank_name = Column(String(100))
    payment_date = Column(Date)

    # Fee component breakdown
    fee_component = Column(String(50))
    fee_breakdown = Column(JSONB)

    # Receipt
    receipt_number = Column(String(50), unique=True)
    receipt_url = Column(String(500))

    # Status
    status = Column(String(20), default="pending")
    # "pending", "captured", "settled", "refunded", "failed", "cancelled"

    # Late fee
    late_fee_amount = Column(BigInteger, default=0)
    late_fee_days = Column(Integer, default=0)

    # Recorded by
    recorded_by = Column(UUID(as_uuid=True))
    notes = Column(Text)


# ===================================================================
# 10. Fee Refund
# ===================================================================

class FeeRefund(TenantModel):
    """Fee refund tracking."""
    __tablename__ = "fee_refunds"
    __table_args__ = (
        Index("ix_feerefund_college_student", "college_id", "student_id"),
    )

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    original_payment_id = Column(UUID(as_uuid=True), ForeignKey("fee_payments.id"))
    reason = Column(String(50))
    # "withdrawal", "seat_upgrade", "excess_payment", "caution_deposit_return",
    # "mcc_round_exit", "state_counseling_exit", "other"
    original_amount_paid = Column(BigInteger, nullable=False)
    refund_amount = Column(BigInteger, nullable=False)
    deductions = Column(BigInteger, default=0)
    deduction_breakdown = Column(JSONB)

    # Bank details
    bank_account_number_last4 = Column(String(4))
    bank_ifsc = Column(String(20))
    bank_name = Column(String(100))
    account_holder_name = Column(String(255))

    # Processing
    status = Column(String(20), default="requested")
    # "requested", "approved", "processing", "completed", "rejected"
    approved_by = Column(UUID(as_uuid=True))
    approved_at = Column(DateTime(timezone=True))
    processed_at = Column(DateTime(timezone=True))
    neft_reference = Column(String(100))
    rejection_reason = Column(Text)
    expected_completion_date = Column(Date)
    notes = Column(Text)


# ===================================================================
# 11. Scholarship Scheme (NOT tenant-scoped)
# ===================================================================

class ScholarshipScheme(Base):
    """National/state scholarship schemes — shared across colleges."""
    __tablename__ = "scholarship_schemes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    awarding_body = Column(String(100))
    scheme_code = Column(String(50))

    # Eligibility
    eligible_categories = Column(JSONB)  # ["SC", "ST", "OBC", "EWS", "General", "Minority", "PwD"]
    income_ceiling = Column(BigInteger)
    merit_criteria = Column(Text)
    eligible_states = Column(JSONB)  # null = all states

    # Benefit
    amount_per_year = Column(BigInteger)
    amount_description = Column(Text)
    covers_components = Column(JSONB)  # ["tuition", "hostel", "mess"]

    # Application
    application_portal = Column(String(100))
    portal_url = Column(String(500))
    application_window_start = Column(Date)
    application_window_end = Column(Date)
    renewal_required = Column(Boolean, default=True)
    renewal_criteria = Column(Text)

    # Status
    is_active = Column(Boolean, server_default="true")
    academic_year = Column(String(10))
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"))


# ===================================================================
# 12. Student Scholarship (tenant-scoped)
# ===================================================================

class StudentScholarship(TenantModel):
    """Tracks student scholarship applications and disbursements."""
    __tablename__ = "student_scholarships"
    __table_args__ = (
        Index("ix_studschol_college_student", "college_id", "student_id"),
        Index("ix_studschol_college_status", "college_id", "application_status"),
    )

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    scheme_id = Column(UUID(as_uuid=True), ForeignKey("scholarship_schemes.id"), nullable=False)
    academic_year = Column(String(10))

    # Application
    application_status = Column(String(20), default="matched")
    # "matched", "applied", "l1_verified", "l2_verified", "approved", "rejected", "disbursed"
    application_id = Column(String(100))
    application_date = Column(Date)

    # Disbursement
    sanctioned_amount = Column(BigInteger)
    disbursed_amount = Column(BigInteger, default=0)
    disbursement_date = Column(Date)
    dbt_status = Column(String(20))
    aadhaar_seeded = Column(Boolean)

    # Verification
    l1_verified_by = Column(UUID(as_uuid=True))
    l1_verified_at = Column(DateTime(timezone=True))
    rejection_reason = Column(Text)
    notes = Column(Text)


# ===================================================================
# 13. Payroll Record
# ===================================================================

class PayrollRecord(TenantModel):
    """Monthly payroll calculation and disbursement."""
    __tablename__ = "payroll_records"
    __table_args__ = (
        Index("ix_payroll_college_faculty", "college_id", "faculty_id"),
        Index("ix_payroll_college_month", "college_id", "year", "month"),
    )

    faculty_id = Column(UUID(as_uuid=True), ForeignKey("faculty.id"), nullable=False)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)

    # Earnings (all in paisa)
    basic_pay = Column(BigInteger, default=0)
    dearness_allowance = Column(BigInteger, default=0)
    house_rent_allowance = Column(BigInteger, default=0)
    non_practicing_allowance = Column(BigInteger, default=0)
    transport_allowance = Column(BigInteger, default=0)
    special_allowance = Column(BigInteger, default=0)
    other_allowances = Column(BigInteger, default=0)
    other_allowances_breakdown = Column(JSONB)
    gross_earnings = Column(BigInteger, default=0)

    # Deductions
    epf_employee = Column(BigInteger, default=0)
    epf_employer = Column(BigInteger, default=0)
    esi_employee = Column(BigInteger, default=0)
    esi_employer = Column(BigInteger, default=0)
    tds = Column(BigInteger, default=0)
    professional_tax = Column(BigInteger, default=0)
    other_deductions = Column(BigInteger, default=0)
    other_deductions_breakdown = Column(JSONB)
    total_deductions = Column(BigInteger, default=0)

    # Net
    net_pay = Column(BigInteger, default=0)

    # Processing
    status = Column(String(20), default="draft")
    # "draft", "calculated", "approved", "disbursed"
    calculated_at = Column(DateTime(timezone=True))
    approved_by = Column(UUID(as_uuid=True))
    approved_at = Column(DateTime(timezone=True))
    disbursed_at = Column(DateTime(timezone=True))
    bank_file_generated = Column(Boolean, default=False)
    pay_slip_url = Column(String(500))
    pay_slip_emailed = Column(Boolean, default=False)


# ===================================================================
# 14. Salary Structure
# ===================================================================

class SalaryStructure(TenantModel):
    """Salary configuration per designation/pay scale."""
    __tablename__ = "salary_structures"

    designation = Column(String(50), nullable=False)
    pay_scale_type = Column(String(20), nullable=False)

    # 7th CPC fields
    pay_level = Column(Integer)
    pay_band_min = Column(BigInteger)
    pay_band_max = Column(BigInteger)

    # Private/consolidated
    basic_pay = Column(BigInteger)

    # Allowance percentages
    da_percentage = Column(Float, default=55.0)
    hra_percentage = Column(Float, default=24.0)
    npa_percentage = Column(Float, default=20.0)
    transport_allowance = Column(BigInteger, default=360000)  # ₹3,600/month

    # Deduction rates
    epf_employee_percentage = Column(Float, default=12.0)
    epf_employer_percentage = Column(Float, default=12.0)
    esi_employee_percentage = Column(Float, default=0.75)
    esi_employer_percentage = Column(Float, default=3.25)
    esi_salary_ceiling = Column(BigInteger, default=2100000)  # ₹21,000
    professional_tax_slab = Column(JSONB)
    is_active = Column(Boolean, server_default="true")


# ===================================================================
# 15. Leave Policy
# ===================================================================

class LeavePolicy(TenantModel):
    """Leave entitlements per staff category."""
    __tablename__ = "leave_policies"

    staff_category = Column(String(30), nullable=False)
    # "teaching_faculty", "hospital_staff", "admin_staff", "intern"
    leave_type = Column(String(30), nullable=False)
    # "casual_leave", "earned_leave", "medical_leave", "study_leave",
    # "maternity_leave", "sabbatical", "duty_leave", "examination_duty"
    annual_entitlement = Column(Integer)
    max_accumulation = Column(Integer)
    can_carry_forward = Column(Boolean, default=False)
    requires_document = Column(Boolean, default=False)
    min_service_for_eligibility = Column(Integer, default=0)
    is_active = Column(Boolean, server_default="true")


# ===================================================================
# 16. Leave Request
# ===================================================================

class LeaveRequest(TenantModel):
    """Leave request with approval chain."""
    __tablename__ = "leave_requests"
    __table_args__ = (
        Index("ix_leavereq_college_employee", "college_id", "employee_id"),
        Index("ix_leavereq_college_status", "college_id", "status"),
    )

    employee_id = Column(UUID(as_uuid=True), nullable=False)
    employee_type = Column(String(20))  # "faculty", "staff", "student"
    leave_type = Column(String(30), nullable=False)
    from_date = Column(Date, nullable=False)
    to_date = Column(Date, nullable=False)
    days = Column(Float, nullable=False)
    reason = Column(Text)
    supporting_document_url = Column(String(500))

    # Approval chain
    current_approver_id = Column(UUID(as_uuid=True))
    approval_chain = Column(JSONB)
    status = Column(String(20), default="pending")
    # "pending", "partially_approved", "approved", "rejected", "cancelled"
    rejection_reason = Column(Text)
    escalated = Column(Boolean, default=False)
    escalation_date = Column(DateTime(timezone=True))


# ===================================================================
# 17. Leave Balance
# ===================================================================

class LeaveBalance(TenantModel):
    """Leave balance tracking per employee per year."""
    __tablename__ = "leave_balances"
    __table_args__ = (
        Index("ix_leavebal_college_employee", "college_id", "employee_id"),
    )

    employee_id = Column(UUID(as_uuid=True), nullable=False)
    employee_type = Column(String(20))
    leave_type = Column(String(30), nullable=False)
    academic_year = Column(String(10), nullable=False)
    entitled = Column(Float, default=0)
    taken = Column(Float, default=0)
    pending = Column(Float, default=0)
    balance = Column(Float, default=0)
    carried_forward = Column(Float, default=0)


# ===================================================================
# 18. Recruitment Position
# ===================================================================

class RecruitmentPosition(TenantModel):
    """Open faculty/staff position for hiring."""
    __tablename__ = "recruitment_positions"
    __table_args__ = (
        Index("ix_recruit_college_dept", "college_id", "department_id"),
    )

    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=False)
    designation = Column(String(50), nullable=False)
    specialization_required = Column(String(100))
    qualification_required = Column(String(100))
    experience_required_years = Column(Float)
    vacancies = Column(Integer, default=1)
    priority = Column(String(20), default="medium")
    msr_impact = Column(Boolean, default=False)
    job_description = Column(Text)
    salary_range_min = Column(BigInteger)
    salary_range_max = Column(BigInteger)
    status = Column(String(20), default="draft")
    # "draft", "open", "screening", "interview", "offered", "filled", "cancelled"
    posted_date = Column(Date)
    deadline = Column(Date)


# ===================================================================
# 19. Recruitment Candidate
# ===================================================================

class RecruitmentCandidate(TenantModel):
    """Candidate in recruitment pipeline."""
    __tablename__ = "recruitment_candidates"
    __table_args__ = (
        Index("ix_candidate_college_position", "college_id", "position_id"),
    )

    position_id = Column(UUID(as_uuid=True), ForeignKey("recruitment_positions.id"), nullable=False)
    name = Column(String(255), nullable=False)
    email = Column(String(255))
    phone = Column(String(20))
    current_organization = Column(String(255))
    current_designation = Column(String(100))
    qualification = Column(String(100))
    specialization = Column(String(100))
    experience_years = Column(Float)
    publications_count = Column(Integer, default=0)
    resume_url = Column(String(500))

    # NMC Validation
    nmc_eligible = Column(Boolean)
    nmc_eligibility_notes = Column(Text)

    # Pipeline
    pipeline_stage = Column(String(20), default="applied")
    # "applied", "screening", "nmc_check", "interview", "offer", "joined", "rejected"
    interview_date = Column(DateTime(timezone=True))
    interview_notes = Column(Text)
    offer_amount = Column(BigInteger)
    offer_date = Column(Date)
    joining_date = Column(Date)
    rejection_reason = Column(Text)


# ===================================================================
# 20. Certificate
# ===================================================================

class Certificate(TenantModel):
    """Student certificates with QR verification."""
    __tablename__ = "certificates"
    __table_args__ = (
        Index("ix_cert_college_student", "college_id", "student_id"),
    )

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    certificate_type = Column(String(30), nullable=False)
    # "bonafide", "migration", "transfer", "character", "noc",
    # "fee_paid", "course_completion", "custom"
    certificate_number = Column(String(50), unique=True)
    purpose = Column(String(255))
    purpose_detail = Column(Text)
    qr_code_data = Column(String(500))
    qr_verification_url = Column(String(500))
    digital_signature_applied = Column(Boolean, default=False)
    signed_by = Column(String(255))
    file_url = Column(String(500))
    status = Column(String(20), default="generated")
    # "requested", "generated", "signed", "issued", "revoked"
    issued_date = Column(Date)
    revoked_date = Column(Date)
    revocation_reason = Column(Text)
    generated_by = Column(UUID(as_uuid=True))
    custom_fields = Column(JSONB)


# ===================================================================
# 21. Alumni
# ===================================================================

class Alumni(TenantModel):
    """Alumni records and engagement tracking."""
    __tablename__ = "alumni"

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=True)
    name = Column(String(255), nullable=False)
    graduation_year = Column(Integer)
    batch = Column(String(50))
    email = Column(String(255))
    phone = Column(String(20))

    # Current status
    current_position = Column(String(255))
    current_organization = Column(String(255))
    current_location_city = Column(String(100))
    current_location_state = Column(String(100))
    current_location_country = Column(String(100), default="India")

    # PG / Higher education
    pg_qualification = Column(String(100))
    pg_specialization = Column(String(100))
    pg_institution = Column(String(255))
    pg_year = Column(Integer)

    # Employment
    employment_type = Column(String(30))
    # "government_service", "private_practice", "hospital_employed",
    # "academic", "research", "abroad", "other"

    # Engagement
    is_active_member = Column(Boolean, default=False)
    last_engagement_date = Column(Date)
    contributions = Column(JSONB)
    notes = Column(Text)


# ===================================================================
# 22. Hostel Block
# ===================================================================

class HostelBlock(TenantModel):
    """Hostel building/block."""
    __tablename__ = "hostel_blocks"

    name = Column(String(100), nullable=False)
    block_type = Column(String(30))
    total_rooms = Column(Integer, default=0)
    total_beds = Column(Integer, default=0)
    floors = Column(Integer, default=1)
    warden_faculty_id = Column(UUID(as_uuid=True), ForeignKey("faculty.id"), nullable=True)
    warden_phone = Column(String(20))
    has_cctv = Column(Boolean, default=False)
    is_anti_ragging_compliant = Column(Boolean, default=False)
    is_active = Column(Boolean, server_default="true")


# ===================================================================
# 23. Hostel Room
# ===================================================================

class HostelRoom(TenantModel):
    """Individual hostel room."""
    __tablename__ = "hostel_rooms"
    __table_args__ = (
        Index("ix_hostelroom_college_block", "college_id", "block_id"),
    )

    block_id = Column(UUID(as_uuid=True), ForeignKey("hostel_blocks.id"), nullable=False)
    room_number = Column(String(20), nullable=False)
    floor = Column(Integer, default=0)
    capacity = Column(Integer, default=2)
    current_occupancy = Column(Integer, default=0)
    room_type = Column(String(20), default="regular")
    has_ac = Column(Boolean, default=False)
    has_attached_bathroom = Column(Boolean, default=False)
    status = Column(String(20), default="available")
    # "available", "full", "maintenance", "reserved"


# ===================================================================
# 24. Hostel Allocation
# ===================================================================

class HostelAllocation(TenantModel):
    """Student room allocation."""
    __tablename__ = "hostel_allocations"
    __table_args__ = (
        Index("ix_hostelalloc_college_student", "college_id", "student_id"),
    )

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    room_id = Column(UUID(as_uuid=True), ForeignKey("hostel_rooms.id"), nullable=False)
    block_id = Column(UUID(as_uuid=True), ForeignKey("hostel_blocks.id"), nullable=False)
    academic_year = Column(String(10))
    check_in_date = Column(Date)
    check_out_date = Column(Date)
    status = Column(String(20), default="active")


# ===================================================================
# 25. Mess Unit
# ===================================================================

class MessUnit(TenantModel):
    """Mess/dining facility."""
    __tablename__ = "mess_units"

    name = Column(String(100), nullable=False)
    mess_type = Column(String(20))
    capacity = Column(Integer)
    vendor_name = Column(String(255))
    vendor_contact = Column(String(20))
    monthly_fee = Column(BigInteger)
    is_active = Column(Boolean, server_default="true")


# ===================================================================
# 26. Vehicle
# ===================================================================

class Vehicle(TenantModel):
    """Transport fleet vehicle."""
    __tablename__ = "vehicles"

    vehicle_number = Column(String(20), nullable=False)
    vehicle_type = Column(String(20))
    capacity = Column(Integer)
    make_model = Column(String(100))
    year_of_purchase = Column(Integer)
    driver_name = Column(String(255))
    driver_phone = Column(String(20))
    driver_license_number = Column(String(50))
    insurance_expiry = Column(Date)
    fitness_certificate_expiry = Column(Date)
    last_service_date = Column(Date)
    next_service_due = Column(Date)
    current_km_reading = Column(Integer)
    status = Column(String(20), default="active")


# ===================================================================
# 27. Transport Route
# ===================================================================

class TransportRoute(TenantModel):
    """Transport route definition."""
    __tablename__ = "transport_routes"

    name = Column(String(100), nullable=False)
    route_type = Column(String(30))
    origin = Column(String(255))
    destination = Column(String(255))
    distance_km = Column(Float)
    schedule = Column(JSONB)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.id"), nullable=True)
    is_active = Column(Boolean, server_default="true")


# ===================================================================
# 28. Transport Booking
# ===================================================================

class TransportBooking(TenantModel):
    """Vehicle/route booking request."""
    __tablename__ = "transport_bookings"

    route_id = Column(UUID(as_uuid=True), ForeignKey("transport_routes.id"), nullable=True)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)
    requested_by = Column(UUID(as_uuid=True))
    booking_date = Column(Date, nullable=False)
    departure_time = Column(String(10))
    num_passengers = Column(Integer)
    purpose = Column(Text)
    faculty_accompanying = Column(String(255))
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.id"), nullable=True)
    status = Column(String(20), default="requested")


# ===================================================================
# 29. Vehicle Maintenance Log
# ===================================================================

class VehicleMaintenanceLog(TenantModel):
    """Vehicle maintenance/repair records."""
    __tablename__ = "vehicle_maintenance_logs"

    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.id"), nullable=False)
    maintenance_type = Column(String(20))
    description = Column(Text)
    cost = Column(BigInteger)
    vendor = Column(String(255))
    date = Column(Date)
    km_reading = Column(Integer)
    next_scheduled = Column(Date)


# ===================================================================
# 30. Library Book
# ===================================================================

class LibraryBook(TenantModel):
    """Library book inventory."""
    __tablename__ = "library_books"
    __table_args__ = (
        Index("ix_libbook_college_dept", "college_id", "department_id"),
    )

    accession_number = Column(String(50), unique=True)
    title = Column(String(500), nullable=False)
    author = Column(String(500))
    publisher = Column(String(255))
    year_of_publication = Column(Integer)
    edition = Column(String(50))
    isbn = Column(String(20))
    subject = Column(String(100))
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)
    location = Column(String(50))
    shelf_number = Column(String(20))
    total_copies = Column(Integer, default=1)
    available_copies = Column(Integer, default=1)
    status = Column(String(20), default="available")
    price = Column(BigInteger)


# ===================================================================
# 31. Library Journal
# ===================================================================

class LibraryJournal(TenantModel):
    """Library journal subscriptions."""
    __tablename__ = "library_journals"

    name = Column(String(500), nullable=False)
    publisher = Column(String(255))
    issn = Column(String(20))
    journal_type = Column(String(20))
    indexed_in = Column(JSONB)
    subscription_status = Column(String(20), default="active")
    subscription_start = Column(Date)
    subscription_end = Column(Date)
    annual_cost = Column(BigInteger)
    is_online = Column(Boolean, default=False)
    access_url = Column(String(500))


# ===================================================================
# 32. Library Issuance
# ===================================================================

class LibraryIssuance(TenantModel):
    """Book issue/return tracking."""
    __tablename__ = "library_issuances"
    __table_args__ = (
        Index("ix_libissue_college_borrower", "college_id", "borrower_id"),
    )

    book_id = Column(UUID(as_uuid=True), ForeignKey("library_books.id"), nullable=False)
    borrower_id = Column(UUID(as_uuid=True), nullable=False)
    borrower_type = Column(String(20))
    issued_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False)
    returned_date = Column(Date)
    fine_amount = Column(BigInteger, default=0)
    status = Column(String(20), default="issued")


# ===================================================================
# 33. Infrastructure
# ===================================================================

class Infrastructure(TenantModel):
    """Physical infrastructure inventory."""
    __tablename__ = "infrastructure"
    __table_args__ = (
        Index("ix_infra_college_dept", "college_id", "department_id"),
    )

    name = Column(String(255), nullable=False)
    category = Column(String(30))
    # "lecture_hall", "laboratory", "tutorial_room", "skill_lab", "library",
    # "auditorium", "exam_hall", "opd_room", "ward", "operation_theatre",
    # "icu", "emergency", "museum", "demonstration_room", "seminar_hall"
    building = Column(String(100))
    floor = Column(Integer)
    room_number = Column(String(20))
    area_sqm = Column(Float)
    capacity = Column(Integer)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)
    has_ac = Column(Boolean, default=False)
    has_projector = Column(Boolean, default=False)
    has_smart_board = Column(Boolean, default=False)
    condition = Column(String(20), default="good")
    last_inspection_date = Column(Date)
    is_active = Column(Boolean, server_default="true")


# ===================================================================
# 34. Equipment
# ===================================================================

class Equipment(TenantModel):
    """Department equipment inventory."""
    __tablename__ = "equipment"
    __table_args__ = (
        Index("ix_equip_college_dept", "college_id", "department_id"),
    )

    name = Column(String(255), nullable=False)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=False)
    serial_number = Column(String(100))
    make_model = Column(String(255))
    purchase_date = Column(Date)
    purchase_cost = Column(BigInteger)
    supplier_vendor = Column(String(255))
    warranty_expiry = Column(Date)

    # AMC
    amc_status = Column(String(20), default="not_covered")
    amc_vendor = Column(String(255))
    amc_start_date = Column(Date)
    amc_end_date = Column(Date)
    amc_annual_cost = Column(BigInteger)

    # Calibration
    requires_calibration = Column(Boolean, default=False)
    last_calibration_date = Column(Date)
    next_calibration_due = Column(Date)
    calibration_vendor = Column(String(255))

    # Status
    condition = Column(String(20), default="working")
    location = Column(String(100))
    is_nmc_required = Column(Boolean, default=False)
    nmc_specification_met = Column(Boolean, default=True)


# ===================================================================
# 35. Maintenance Ticket
# ===================================================================

class MaintenanceTicket(TenantModel):
    """Equipment/infrastructure maintenance ticket."""
    __tablename__ = "maintenance_tickets"
    __table_args__ = (
        Index("ix_maint_college_dept", "college_id", "department_id"),
    )

    ticket_number = Column(String(50), unique=True)
    entity_type = Column(String(20))  # "equipment", "infrastructure"
    entity_id = Column(UUID(as_uuid=True))
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)
    reported_by = Column(UUID(as_uuid=True))
    reported_by_name = Column(String(255))
    description = Column(Text, nullable=False)
    priority = Column(String(20), default="medium")
    status = Column(String(20), default="open")
    # "open", "assigned", "in_progress", "resolved", "closed"
    assigned_to = Column(String(255))
    resolution_description = Column(Text)
    resolution_date = Column(DateTime(timezone=True))
    cost = Column(BigInteger)


# ===================================================================
# 36. Notice
# ===================================================================

class Notice(TenantModel):
    """Notices, circulars, and communications."""
    __tablename__ = "notices"
    __table_args__ = (
        Index("ix_notice_college_status", "college_id", "status"),
    )

    title = Column(String(500), nullable=False)
    content = Column(Text, nullable=False)
    notice_type = Column(String(20))
    priority = Column(String(20), default="normal")
    target_audience = Column(JSONB)
    posted_by = Column(UUID(as_uuid=True))
    posted_by_name = Column(String(255))
    delivery_channels = Column(JSONB)
    requires_acknowledgment = Column(Boolean, default=False)
    published_at = Column(DateTime(timezone=True))
    expires_at = Column(DateTime(timezone=True))
    is_pinned = Column(Boolean, default=False)
    attachments = Column(JSONB)
    status = Column(String(20), default="draft")
    read_count = Column(Integer, default=0)
    total_recipients = Column(Integer, default=0)
    acknowledged_count = Column(Integer, default=0)


# ===================================================================
# 37. Notice Read Receipt
# ===================================================================

class NoticeReadReceipt(TenantModel):
    """Notice read/acknowledgment tracking."""
    __tablename__ = "notice_read_receipts"
    __table_args__ = (
        Index("ix_noticerr_college_notice", "college_id", "notice_id"),
    )

    notice_id = Column(UUID(as_uuid=True), ForeignKey("notices.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    read_at = Column(DateTime(timezone=True))
    acknowledged_at = Column(DateTime(timezone=True))
    channel = Column(String(20))


# ===================================================================
# 38. Committee
# ===================================================================

class Committee(TenantModel):
    """NMC-mandated and institutional committees."""
    __tablename__ = "committees"

    name = Column(String(255), nullable=False)
    committee_type = Column(String(30))
    is_nmc_mandated = Column(Boolean, default=False)
    chairperson_name = Column(String(255))
    chairperson_contact = Column(String(100))
    meeting_frequency = Column(String(50))
    last_meeting_date = Column(Date)
    next_meeting_date = Column(Date)
    status = Column(String(20), default="active")


# ===================================================================
# 39. Committee Member
# ===================================================================

class CommitteeMember(TenantModel):
    """Committee membership."""
    __tablename__ = "committee_members"
    __table_args__ = (
        Index("ix_commember_college_committee", "college_id", "committee_id"),
    )

    committee_id = Column(UUID(as_uuid=True), ForeignKey("committees.id"), nullable=False)
    member_name = Column(String(255), nullable=False)
    member_role = Column(String(100))
    member_type = Column(String(20))
    user_id = Column(UUID(as_uuid=True), nullable=True)
    contact_phone = Column(String(20))
    contact_email = Column(String(255))
    is_active = Column(Boolean, server_default="true")


# ===================================================================
# 40. Grievance
# ===================================================================

class Grievance(TenantModel):
    """Student/faculty grievance with timeline tracking."""
    __tablename__ = "grievances"
    __table_args__ = (
        Index("ix_grievance_college_status", "college_id", "status"),
    )

    ticket_number = Column(String(50), unique=True)
    filed_by = Column(UUID(as_uuid=True))
    filed_by_name = Column(String(255))
    filed_by_role = Column(String(20))
    is_anonymous = Column(Boolean, default=False)
    category = Column(String(30))
    assigned_committee_id = Column(UUID(as_uuid=True), ForeignKey("committees.id"), nullable=True)
    description = Column(Text, nullable=False)
    evidence_urls = Column(JSONB)
    priority = Column(String(20), default="medium")
    status = Column(String(20), default="filed")
    # "filed", "acknowledged", "under_review", "hearing_scheduled",
    # "resolved", "escalated", "closed"
    resolution_description = Column(Text)
    resolution_date = Column(DateTime(timezone=True))
    resolved_by = Column(UUID(as_uuid=True))
    timeline = Column(JSONB)


# ===================================================================
# 41. Workflow Definition
# ===================================================================

class WorkflowDefinition(TenantModel):
    """Workflow/approval chain definition."""
    __tablename__ = "workflow_definitions"

    name = Column(String(100), nullable=False)
    workflow_type = Column(String(30), nullable=False)
    approval_chain = Column(JSONB, nullable=False)
    is_active = Column(Boolean, server_default="true")


# ===================================================================
# 42. Workflow Instance
# ===================================================================

class WorkflowInstance(TenantModel):
    """Active workflow/approval instance."""
    __tablename__ = "workflow_instances"
    __table_args__ = (
        Index("ix_wfinst_college_status", "college_id", "status"),
        Index("ix_wfinst_college_approver", "college_id", "current_approver_id"),
    )

    definition_id = Column(UUID(as_uuid=True), ForeignKey("workflow_definitions.id"), nullable=True)
    workflow_type = Column(String(30), nullable=False)
    reference_type = Column(String(30))
    reference_id = Column(UUID(as_uuid=True))
    requested_by = Column(UUID(as_uuid=True), nullable=False)
    requested_by_name = Column(String(255))
    title = Column(String(500))
    description = Column(Text)
    current_step = Column(Integer, default=1)
    current_approver_id = Column(UUID(as_uuid=True))
    approval_history = Column(JSONB)
    status = Column(String(20), default="pending")
    # "pending", "in_progress", "approved", "rejected", "cancelled"
    priority = Column(String(20), default="normal")
    due_date = Column(Date)
    completed_at = Column(DateTime(timezone=True))


# ===================================================================
# 43. Document
# ===================================================================

class Document(TenantModel):
    """Document management with versioning."""
    __tablename__ = "documents"
    __table_args__ = (
        Index("ix_doc_college_category", "college_id", "category"),
    )

    title = Column(String(500), nullable=False)
    category = Column(String(50))
    sub_category = Column(String(100))
    file_url = Column(String(500), nullable=False)
    file_name = Column(String(255))
    file_size = Column(Integer)
    mime_type = Column(String(100))
    uploaded_by = Column(UUID(as_uuid=True))
    uploaded_by_name = Column(String(255))
    description = Column(Text)
    tags = Column(JSONB)
    access_level = Column(String(20), default="admin_only")
    version = Column(Integer, default=1)
    parent_document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=True)
    academic_year = Column(String(10))
    is_archived = Column(Boolean, default=False)


# ===================================================================
# 44. Academic Calendar Event
# ===================================================================

class AcademicCalendarEvent(TenantModel):
    """Academic calendar events."""
    __tablename__ = "academic_calendar_events"

    title = Column(String(500), nullable=False)
    event_type = Column(String(30))
    start_date = Column(Date, nullable=False)
    end_date = Column(Date)
    is_all_day = Column(Boolean, default=True)
    start_time = Column(String(10))
    end_time = Column(String(10))
    affects_phases = Column(JSONB)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)
    description = Column(Text)
    is_recurring = Column(Boolean, default=False)
    recurrence_rule = Column(String(100))
    notify_roles = Column(JSONB)
    academic_year = Column(String(10))
    is_teaching_day = Column(Boolean, default=True)


# ===================================================================
# 45. Timetable Slot
# ===================================================================

class TimetableSlot(TenantModel):
    """Timetable scheduling."""
    __tablename__ = "timetable_slots"
    __table_args__ = (
        Index("ix_timetable_college_phase_day", "college_id", "phase", "day_of_week"),
    )

    academic_year = Column(String(10), nullable=False)
    phase = Column(String(20), nullable=False)
    batch_id = Column(UUID(as_uuid=True), ForeignKey("batches.id"), nullable=True)
    day_of_week = Column(Integer, nullable=False)  # 0=Monday ... 5=Saturday
    start_time = Column(String(10), nullable=False)
    end_time = Column(String(10), nullable=False)
    subject = Column(String(100))
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)
    faculty_id = Column(UUID(as_uuid=True), ForeignKey("faculty.id"), nullable=True)
    session_type = Column(String(20))
    room_id = Column(UUID(as_uuid=True), ForeignKey("infrastructure.id"), nullable=True)
    room_name = Column(String(100))
    is_active = Column(Boolean, server_default="true")
    effective_from = Column(Date)
    effective_until = Column(Date)


# ===================================================================
# 46. Clinical Rotation
# ===================================================================

class ClinicalRotation(TenantModel):
    """Clinical rotation scheduling and tracking."""
    __tablename__ = "clinical_rotations"
    __table_args__ = (
        Index("ix_clinrot_college_student", "college_id", "student_id"),
        Index("ix_clinrot_college_dept", "college_id", "department_id"),
    )

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=False)
    batch_id = Column(UUID(as_uuid=True), ForeignKey("batches.id"), nullable=True)
    rotation_group = Column(String(20))
    phase = Column(String(20))
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    required_hours = Column(Integer)
    completed_hours = Column(Integer, default=0)
    supervisor_faculty_id = Column(UUID(as_uuid=True), ForeignKey("faculty.id"), nullable=True)
    posting_assessment_score = Column(Float)
    assessed_by = Column(UUID(as_uuid=True), ForeignKey("faculty.id"), nullable=True)
    assessed_at = Column(DateTime(timezone=True))
    status = Column(String(20), default="scheduled")
    # "scheduled", "active", "completed", "assessed"
    attendance_percentage = Column(Float)
    is_crmi = Column(Boolean, default=False)
    crmi_leave_days_taken = Column(Integer, default=0)
