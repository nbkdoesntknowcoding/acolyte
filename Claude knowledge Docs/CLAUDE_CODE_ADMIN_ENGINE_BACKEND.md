# Claude Code: Build Complete Admin Engine Backend

## Context

We are building the Admin Engine for Acolyte AI — an ERP/LMS platform for Indian medical colleges. The Central AI Engine (Prompts 1-28) is already built and merged to main. The Admin Engine frontend UI is being designed in Google Stitch and will be converted to Next.js 15 TSX.

**This prompt covers the ENTIRE backend for the Admin Engine: database schema, Alembic migrations, Pydantic schemas, FastAPI endpoints, and business logic. No AI features — pure CRUD, computation, and workflow logic.**

## Existing Architecture (DO NOT recreate — extend)

The codebase already has:
- `backend/app/main.py` — FastAPI app
- `backend/app/core/database.py` — async SQLAlchemy with Neon PostgreSQL, NullPool
- `backend/app/shared/models.py` — `Base` and `TenantModel` base classes (id, college_id, created_at, updated_at)
- `backend/app/middleware/tenant.py` — extracts college_id from Clerk JWT, sets RLS context
- `backend/app/middleware/auth.py` — Clerk RS256 JWT verification
- `backend/app/engines/` — package structure for all 6 engines
- Alembic configured at `backend/alembic/`
- RLS policies pattern established

The Admin Engine lives at: `backend/app/engines/admin/`

```
backend/app/engines/admin/
├── __init__.py          # Public interface (functions other engines call)
├── models.py            # ALL SQLAlchemy models for this engine
├── schemas.py           # ALL Pydantic request/response schemas
├── routes/
│   ├── __init__.py      # Router aggregation
│   ├── dashboard.py     # GET /api/v1/admin/dashboard/*
│   ├── students.py      # /api/v1/admin/students/*
│   ├── admissions.py    # /api/v1/admin/admissions/*
│   ├── faculty.py       # /api/v1/admin/faculty/*
│   ├── fees.py          # /api/v1/admin/fees/*
│   ├── scholarships.py  # /api/v1/admin/scholarships/*
│   ├── payroll.py       # /api/v1/admin/payroll/*
│   ├── leave.py         # /api/v1/admin/leave/*
│   ├── recruitment.py   # /api/v1/admin/recruitment/*
│   ├── departments.py   # /api/v1/admin/departments/*
│   ├── timetable.py     # /api/v1/admin/timetable/*
│   ├── calendar.py      # /api/v1/admin/calendar/*
│   ├── rotations.py     # /api/v1/admin/rotations/*
│   ├── certificates.py  # /api/v1/admin/certificates/*
│   ├── alumni.py        # /api/v1/admin/alumni/*
│   ├── hostel.py        # /api/v1/admin/hostel/*
│   ├── transport.py     # /api/v1/admin/transport/*
│   ├── library.py       # /api/v1/admin/library/*
│   ├── infrastructure.py# /api/v1/admin/infrastructure/*
│   ├── notices.py       # /api/v1/admin/notices/*
│   ├── grievances.py    # /api/v1/admin/grievances/*
│   ├── workflows.py     # /api/v1/admin/workflows/*
│   ├── documents.py     # /api/v1/admin/documents/*
│   ├── executive.py     # /api/v1/admin/executive/*
│   └── settings.py      # /api/v1/admin/settings/*
├── services/
│   ├── fee_calculator.py     # Fee computation, installment, late fee logic
│   ├── scholarship_matcher.py # Auto-match students to eligible schemes
│   ├── payroll_processor.py  # Salary computation, statutory deductions
│   ├── msr_checker.py        # Faculty MSR compliance calculation
│   ├── certificate_generator.py # PDF generation with QR codes
│   ├── rotation_scheduler.py # Clinical rotation constraint solver
│   ├── receipt_generator.py  # Fee receipt PDF generation
│   └── dashboard_aggregator.py # Stats aggregation for dashboards
└── utils/
    ├── indian_currency.py    # ₹ formatting, Indian number system
    └── validators.py         # NEET score, Aadhaar hash, phone validators
```

---

## PHASE 1: DATABASE SCHEMA (All Models)

Create ALL models in `backend/app/engines/admin/models.py`. Every model extends `TenantModel` (which gives id, college_id, created_at, updated_at) unless marked as non-tenant.

### 1.1 College & Configuration (already partially exists — extend)

```python
class College(Base):
    """NOT tenant-scoped. Top-level entity."""
    __tablename__ = "colleges"
    id = Column(UUID, primary_key=True, default=uuid4)
    name = Column(String(255), nullable=False)
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
    sanctioned_intake = Column(Integer, nullable=False)  # 100, 150, 200, 250
    logo_url = Column(String(500))
    config = Column(JSONB, default={})
    # config holds: academic_calendar_start, exam_pattern, languages, timezone,
    # fee_regulatory_authority, state_fee_cap_rules, attendance_thresholds,
    # teaching_weeks_per_year (default 39), working_days_per_week (default 6)
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
    status = Column(String(20), default="active")  # active, suspended, deregistered
```

### 1.2 Departments

```python
class Department(TenantModel):
    __tablename__ = "departments"
    name = Column(String(100), nullable=False)  # "Anatomy", "General Medicine", etc.
    department_code = Column(String(20))  # "ANAT", "MED", etc.
    department_type = Column(String(30))  # "pre_clinical", "para_clinical", "clinical"
    hod_faculty_id = Column(UUID, ForeignKey("faculty.id"), nullable=True)
    # Infrastructure
    beds = Column(Integer, default=0)  # For clinical departments
    opd_rooms = Column(Integer, default=0)
    labs = Column(Integer, default=0)
    lecture_halls = Column(Integer, default=0)
    # NMC tracking
    nmc_department_code = Column(String(20))  # NMC's internal code
    is_active = Column(Boolean, default=True)
    display_order = Column(Integer, default=0)
```

### 1.3 Batches

```python
class Batch(TenantModel):
    __tablename__ = "batches"
    name = Column(String(50), nullable=False)  # "Batch 2025", "Group A", etc.
    batch_type = Column(String(20))  # "admission_year" or "rotation_group"
    admission_year = Column(Integer)
    current_phase = Column(String(20))  # "Phase I", "Phase II", "Phase III", "CRMI"
    current_semester = Column(Integer)
    student_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
```

### 1.4 Students (extend existing)

```python
class Student(TenantModel):
    __tablename__ = "students"
    # Personal
    name = Column(String(255), nullable=False)
    email = Column(String(255))
    phone = Column(String(20))
    date_of_birth = Column(Date)
    gender = Column(String(20))  # "male", "female", "other"
    blood_group = Column(String(10))
    nationality = Column(String(50), default="Indian")
    religion = Column(String(50))
    category = Column(String(20))  # "General", "SC", "ST", "OBC", "EWS", "PwD"
    aadhaar_hash = Column(String(64))  # SHA-256 hash only, NEVER raw
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
    counseling_round = Column(String(30))  # "Round 1", "Round 2", "Mop-Up", "Stray", "Special Stray"
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
    current_phase = Column(String(20))  # "Phase I", "Phase II", "Phase III", "CRMI"
    current_semester = Column(Integer)
    batch_id = Column(UUID, ForeignKey("batches.id"))

    # Status
    status = Column(String(20), default="active")
    # "applied", "documents_submitted", "under_verification", "fee_pending",
    # "enrolled", "active", "suspended", "rusticated", "graduated", "dropped"

    # Hostel
    hostel_room_id = Column(UUID, ForeignKey("hostel_rooms.id"), nullable=True)
    is_hosteler = Column(Boolean, default=False)

    # NMC Data Upload
    nmc_uploaded = Column(Boolean, default=False)
    nmc_upload_date = Column(DateTime(timezone=True))

    # Auth
    clerk_user_id = Column(String(255), unique=True)
```

### 1.5 Student Documents

```python
class StudentDocument(TenantModel):
    __tablename__ = "student_documents"
    student_id = Column(UUID, ForeignKey("students.id"), nullable=False)
    document_type = Column(String(50), nullable=False)
    # "neet_admit_card", "neet_scorecard", "class_10_marksheet", "class_12_marksheet",
    # "transfer_certificate", "domicile_certificate", "caste_certificate",
    # "income_certificate", "disability_certificate", "migration_certificate",
    # "gap_certificate", "character_certificate", "aadhaar_card", "birth_certificate",
    # "medical_fitness_certificate", "passport_photos"
    file_url = Column(String(500))  # Cloudflare R2 URL
    file_name = Column(String(255))
    file_size = Column(Integer)  # bytes
    mime_type = Column(String(100))
    is_required = Column(Boolean, default=True)
    verification_status = Column(String(20), default="not_uploaded")
    # "not_uploaded", "uploaded", "under_review", "verified", "rejected"
    verified_by = Column(UUID, ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime(timezone=True))
    rejection_reason = Column(Text)
    ocr_extracted_data = Column(JSONB)  # AI OCR auto-extraction results
```

### 1.6 Faculty (extend existing)

```python
class Faculty(TenantModel):
    __tablename__ = "faculty"
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
    designation = Column(String(50), nullable=False)
    # "Professor", "Associate Professor", "Assistant Professor", "Tutor", "Senior Resident", "Demonstrator"
    department_id = Column(UUID, ForeignKey("departments.id"), nullable=False)
    qualification = Column(String(100))  # "MD", "MS", "DNB", "PhD", "DM", "MCh"
    specialization = Column(String(100))
    sub_specialization = Column(String(100))

    # NMC IDs
    nmc_faculty_id = Column(String(50))
    aebas_id = Column(String(50))
    employee_id = Column(String(50))

    # Employment
    date_of_joining = Column(Date)
    date_of_birth = Column(Date)
    retirement_date = Column(Date)  # Calculated: DOB + 70 years
    employment_type = Column(String(20))  # "permanent", "contractual", "visiting", "adjunct"
    pay_scale_type = Column(String(20))  # "7cpc", "private", "consolidated"

    # Experience
    teaching_experience_years = Column(Float)
    clinical_experience_years = Column(Float)
    total_experience_years = Column(Float)

    # Qualification Validation (NMC Faculty Qualification Rules 2025)
    qualification_validated = Column(Boolean, default=False)
    is_eligible_per_nmc = Column(Boolean, default=True)
    validation_notes = Column(Text)
    # DNB from 500+ bed = MD/MS equivalent
    # DNB from smaller = +1 year SR needed
    # Non-teaching govt specialist (220+ beds, 2+ years) = eligible Asst Prof
    # 10+ years experience = eligible Assoc Prof

    # Academic
    orcid_id = Column(String(50))
    publications_count = Column(Integer, default=0)
    h_index = Column(Integer, default=0)
    bcme_completed = Column(Boolean, default=False)  # Basic Course in Medical Education

    # Bank Details (encrypted/hashed in practice)
    bank_account_number_hash = Column(String(64))
    bank_ifsc = Column(String(20))
    bank_name = Column(String(100))

    # Status
    status = Column(String(20), default="active")
    # "active", "on_leave", "sabbatical", "deputation", "resigned", "retired", "terminated"

    clerk_user_id = Column(String(255), unique=True)
```

### 1.7 Faculty Qualifications (separate table for multiple degrees)

```python
class FacultyQualification(TenantModel):
    __tablename__ = "faculty_qualifications"
    faculty_id = Column(UUID, ForeignKey("faculty.id"), nullable=False)
    degree = Column(String(50), nullable=False)  # "MBBS", "MD", "MS", "DNB", "PhD", "DM", "MCh"
    specialization = Column(String(100))
    university = Column(String(255))
    year_of_passing = Column(Integer)
    certificate_url = Column(String(500))
    nmc_verified = Column(Boolean, default=False)
    hospital_bed_count = Column(Integer)  # For DNB: needed for equivalence check
    is_highest = Column(Boolean, default=False)
```

### 1.8 Fee Structures

```python
class FeeStructure(TenantModel):
    __tablename__ = "fee_structures"
    academic_year = Column(String(10), nullable=False)  # "2025-26"
    quota = Column(String(30), nullable=False)  # "AIQ", "State", "Management", "NRI", "Institutional"
    # Fee Components (all in paisa for precision, divide by 100 for display)
    tuition_fee = Column(BigInteger, nullable=False, default=0)
    development_fee = Column(BigInteger, default=0)
    hostel_fee_boys = Column(BigInteger, default=0)
    hostel_fee_girls = Column(BigInteger, default=0)
    mess_fee = Column(BigInteger, default=0)
    examination_fee = Column(BigInteger, default=0)
    library_fee = Column(BigInteger, default=0)
    laboratory_fee = Column(BigInteger, default=0)
    caution_deposit = Column(BigInteger, default=0)  # Refundable
    admission_charges = Column(BigInteger, default=0)  # One-time
    university_registration_fee = Column(BigInteger, default=0)
    insurance_premium = Column(BigInteger, default=0)
    identity_card_fee = Column(BigInteger, default=0)
    other_fees = Column(BigInteger, default=0)
    other_fees_description = Column(Text)
    # Regulatory
    fee_regulatory_cap = Column(BigInteger)  # State FRC cap if applicable
    approved_by = Column(String(255))  # "KFRC", "KEA", "Maharashtra FRA", etc.
    approval_date = Column(Date)
    approval_document_url = Column(String(500))
    # Installment config
    installment_config = Column(JSONB)
    # [{"installment_no": 1, "due_date": "2025-08-15", "percentage": 60},
    #  {"installment_no": 2, "due_date": "2026-01-15", "percentage": 40}]
    late_fee_per_day = Column(BigInteger, default=0)  # In paisa
    grace_period_days = Column(Integer, default=15)
    is_active = Column(Boolean, default=True)
```

### 1.9 Fee Payments

```python
class FeePayment(TenantModel):
    __tablename__ = "fee_payments"
    student_id = Column(UUID, ForeignKey("students.id"), nullable=False)
    fee_structure_id = Column(UUID, ForeignKey("fee_structures.id"))
    academic_year = Column(String(10), nullable=False)
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
    reference_number = Column(String(100))  # UTR, DD number, etc.
    bank_name = Column(String(100))
    payment_date = Column(Date)
    # Fee component breakdown
    fee_component = Column(String(50))  # "tuition", "hostel", "exam", "all", etc.
    fee_breakdown = Column(JSONB)  # {"tuition": 500000, "hostel": 100000, ...}
    # Receipt
    receipt_number = Column(String(50), unique=True)
    receipt_url = Column(String(500))  # R2 URL to generated receipt PDF
    # Status
    status = Column(String(20), default="pending")
    # "pending", "captured", "settled", "refunded", "failed", "cancelled"
    # Late fee
    late_fee_amount = Column(BigInteger, default=0)
    late_fee_days = Column(Integer, default=0)
    # Recorded by
    recorded_by = Column(UUID)  # Admin who recorded offline payment
    notes = Column(Text)
```

### 1.10 Fee Refunds

```python
class FeeRefund(TenantModel):
    __tablename__ = "fee_refunds"
    student_id = Column(UUID, ForeignKey("students.id"), nullable=False)
    original_payment_id = Column(UUID, ForeignKey("fee_payments.id"))
    reason = Column(String(50))
    # "withdrawal", "seat_upgrade", "excess_payment", "caution_deposit_return",
    # "mcc_round_exit", "state_counseling_exit", "other"
    original_amount_paid = Column(BigInteger, nullable=False)
    refund_amount = Column(BigInteger, nullable=False)
    deductions = Column(BigInteger, default=0)
    deduction_breakdown = Column(JSONB)  # {"processing_fee": 5000, ...}
    # Bank details for NEFT
    bank_account_number_last4 = Column(String(4))
    bank_ifsc = Column(String(20))
    bank_name = Column(String(100))
    account_holder_name = Column(String(255))
    # Processing
    status = Column(String(20), default="requested")
    # "requested", "approved", "processing", "completed", "rejected"
    approved_by = Column(UUID)
    approved_at = Column(DateTime(timezone=True))
    processed_at = Column(DateTime(timezone=True))
    neft_reference = Column(String(100))
    rejection_reason = Column(Text)
    expected_completion_date = Column(Date)
    notes = Column(Text)
```

### 1.11 Scholarships

```python
class ScholarshipScheme(Base):
    """NOT tenant-scoped — national/state schemes shared across colleges."""
    __tablename__ = "scholarship_schemes"
    id = Column(UUID, primary_key=True, default=uuid4)
    name = Column(String(255), nullable=False)
    awarding_body = Column(String(100))  # "Central Government", "State Government", "Institutional", "Private"
    scheme_code = Column(String(50))
    # Eligibility
    eligible_categories = Column(JSONB)  # ["SC", "ST", "OBC", "EWS", "General", "Minority", "PwD"]
    income_ceiling = Column(BigInteger)  # Max family income in paisa
    merit_criteria = Column(Text)  # "50%+ marks in previous exam"
    eligible_states = Column(JSONB)  # null = all states, or ["Karnataka", "Tamil Nadu"]
    # Benefit
    amount_per_year = Column(BigInteger)
    amount_description = Column(Text)  # "Full tuition reimbursement" or "₹60,000/year"
    covers_components = Column(JSONB)  # ["tuition", "hostel", "mess"]
    # Application
    application_portal = Column(String(100))  # "NSP", "State Portal", "Institutional"
    portal_url = Column(String(500))
    application_window_start = Column(Date)
    application_window_end = Column(Date)
    renewal_required = Column(Boolean, default=True)
    renewal_criteria = Column(Text)  # "50%+ marks and minimum attendance"
    # Status
    is_active = Column(Boolean, default=True)
    academic_year = Column(String(10))
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"))


class StudentScholarship(TenantModel):
    """Tracks student scholarship applications and disbursements."""
    __tablename__ = "student_scholarships"
    student_id = Column(UUID, ForeignKey("students.id"), nullable=False)
    scheme_id = Column(UUID, ForeignKey("scholarship_schemes.id"), nullable=False)
    academic_year = Column(String(10))
    # Application
    application_status = Column(String(20), default="matched")
    # "matched", "applied", "l1_verified", "l2_verified", "approved", "rejected", "disbursed"
    application_id = Column(String(100))  # NSP/portal application ID
    application_date = Column(Date)
    # Disbursement
    sanctioned_amount = Column(BigInteger)
    disbursed_amount = Column(BigInteger, default=0)
    disbursement_date = Column(Date)
    dbt_status = Column(String(20))  # "pending", "credited", "failed"
    aadhaar_seeded = Column(Boolean)  # Bank account linked to Aadhaar for DBT
    # Verification
    l1_verified_by = Column(UUID)  # Institute-level verification
    l1_verified_at = Column(DateTime(timezone=True))
    rejection_reason = Column(Text)
    notes = Column(Text)
```

### 1.12 Payroll

```python
class PayrollRecord(TenantModel):
    __tablename__ = "payroll_records"
    faculty_id = Column(UUID, ForeignKey("faculty.id"), nullable=False)
    month = Column(Integer, nullable=False)  # 1-12
    year = Column(Integer, nullable=False)
    # Earnings
    basic_pay = Column(BigInteger, default=0)
    dearness_allowance = Column(BigInteger, default=0)  # DA — currently ~55% of basic for 7th CPC
    house_rent_allowance = Column(BigInteger, default=0)  # HRA — 8/16/24% by city class
    non_practicing_allowance = Column(BigInteger, default=0)  # NPA — 20% for medical faculty
    transport_allowance = Column(BigInteger, default=0)
    special_allowance = Column(BigInteger, default=0)
    other_allowances = Column(BigInteger, default=0)
    other_allowances_breakdown = Column(JSONB)
    gross_earnings = Column(BigInteger, default=0)
    # Deductions
    epf_employee = Column(BigInteger, default=0)  # 12% of basic
    epf_employer = Column(BigInteger, default=0)  # 12% of basic (not deducted from salary)
    esi_employee = Column(BigInteger, default=0)  # 0.75% if salary ≤ ₹21,000/month
    esi_employer = Column(BigInteger, default=0)  # 3.25%
    tds = Column(BigInteger, default=0)  # Income tax as per slab
    professional_tax = Column(BigInteger, default=0)  # State-specific
    other_deductions = Column(BigInteger, default=0)
    other_deductions_breakdown = Column(JSONB)
    total_deductions = Column(BigInteger, default=0)
    # Net
    net_pay = Column(BigInteger, default=0)
    # Processing
    status = Column(String(20), default="draft")
    # "draft", "calculated", "approved", "disbursed"
    calculated_at = Column(DateTime(timezone=True))
    approved_by = Column(UUID)
    approved_at = Column(DateTime(timezone=True))
    disbursed_at = Column(DateTime(timezone=True))
    bank_file_generated = Column(Boolean, default=False)
    pay_slip_url = Column(String(500))  # R2 URL
    pay_slip_emailed = Column(Boolean, default=False)


class SalaryStructure(TenantModel):
    """Salary configuration per designation/pay scale."""
    __tablename__ = "salary_structures"
    designation = Column(String(50), nullable=False)
    pay_scale_type = Column(String(20), nullable=False)  # "7cpc", "private", "consolidated"
    # 7th CPC fields
    pay_level = Column(Integer)  # Level 10-15
    pay_band_min = Column(BigInteger)
    pay_band_max = Column(BigInteger)
    # Private/consolidated
    basic_pay = Column(BigInteger)
    # Allowance percentages
    da_percentage = Column(Float, default=55.0)  # Current DA rate
    hra_percentage = Column(Float, default=24.0)  # City class dependent
    npa_percentage = Column(Float, default=20.0)  # For medical faculty
    transport_allowance = Column(BigInteger, default=360000)  # ₹3,600/month = 360000 paisa
    # Deduction rates
    epf_employee_percentage = Column(Float, default=12.0)
    epf_employer_percentage = Column(Float, default=12.0)
    esi_employee_percentage = Column(Float, default=0.75)
    esi_employer_percentage = Column(Float, default=3.25)
    esi_salary_ceiling = Column(BigInteger, default=2100000)  # ₹21,000 in paisa
    professional_tax_slab = Column(JSONB)  # State-specific slabs
    is_active = Column(Boolean, default=True)
```

### 1.13 Leave Management

```python
class LeavePolicy(TenantModel):
    """Leave entitlements per staff category."""
    __tablename__ = "leave_policies"
    staff_category = Column(String(30), nullable=False)
    # "teaching_faculty", "hospital_staff", "admin_staff", "intern"
    leave_type = Column(String(30), nullable=False)
    # "casual_leave", "earned_leave", "medical_leave", "study_leave",
    # "maternity_leave", "sabbatical", "duty_leave", "examination_duty"
    annual_entitlement = Column(Integer)  # Days per year, null = as needed
    max_accumulation = Column(Integer)  # Max days that can carry over
    can_carry_forward = Column(Boolean, default=False)
    requires_document = Column(Boolean, default=False)  # e.g., medical certificate
    min_service_for_eligibility = Column(Integer, default=0)  # Months
    is_active = Column(Boolean, default=True)


class LeaveRequest(TenantModel):
    __tablename__ = "leave_requests"
    employee_id = Column(UUID, nullable=False)  # Can be faculty or staff
    employee_type = Column(String(20))  # "faculty", "staff", "student"
    leave_type = Column(String(30), nullable=False)
    from_date = Column(Date, nullable=False)
    to_date = Column(Date, nullable=False)
    days = Column(Float, nullable=False)  # Supports half-day
    reason = Column(Text)
    supporting_document_url = Column(String(500))
    # Approval chain
    current_approver_id = Column(UUID)
    approval_chain = Column(JSONB)
    # [{"step": 1, "role": "HOD", "user_id": "...", "status": "approved", "date": "...", "comment": "..."},
    #  {"step": 2, "role": "Dean", "user_id": "...", "status": "pending"}]
    status = Column(String(20), default="pending")
    # "pending", "partially_approved", "approved", "rejected", "cancelled"
    rejection_reason = Column(Text)
    # Auto-escalation
    escalated = Column(Boolean, default=False)
    escalation_date = Column(DateTime(timezone=True))


class LeaveBalance(TenantModel):
    __tablename__ = "leave_balances"
    employee_id = Column(UUID, nullable=False)
    employee_type = Column(String(20))
    leave_type = Column(String(30), nullable=False)
    academic_year = Column(String(10), nullable=False)
    entitled = Column(Float, default=0)
    taken = Column(Float, default=0)
    pending = Column(Float, default=0)  # Approved but not yet taken
    balance = Column(Float, default=0)
    carried_forward = Column(Float, default=0)
```

### 1.14 Recruitment

```python
class RecruitmentPosition(TenantModel):
    __tablename__ = "recruitment_positions"
    department_id = Column(UUID, ForeignKey("departments.id"), nullable=False)
    designation = Column(String(50), nullable=False)
    specialization_required = Column(String(100))
    qualification_required = Column(String(100))
    experience_required_years = Column(Float)
    vacancies = Column(Integer, default=1)
    priority = Column(String(20), default="medium")  # "critical", "high", "medium", "low"
    msr_impact = Column(Boolean, default=False)  # True if filling this fixes MSR gap
    job_description = Column(Text)
    salary_range_min = Column(BigInteger)
    salary_range_max = Column(BigInteger)
    status = Column(String(20), default="draft")
    # "draft", "open", "screening", "interview", "offered", "filled", "cancelled"
    posted_date = Column(Date)
    deadline = Column(Date)


class RecruitmentCandidate(TenantModel):
    __tablename__ = "recruitment_candidates"
    position_id = Column(UUID, ForeignKey("recruitment_positions.id"), nullable=False)
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
    nmc_eligible = Column(Boolean)  # Auto-calculated from qualification rules
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
```

### 1.15 Certificates

```python
class Certificate(TenantModel):
    __tablename__ = "certificates"
    student_id = Column(UUID, ForeignKey("students.id"), nullable=False)
    certificate_type = Column(String(30), nullable=False)
    # "bonafide", "migration", "transfer", "character", "noc",
    # "fee_paid", "course_completion", "custom"
    certificate_number = Column(String(50), unique=True)
    purpose = Column(String(255))
    purpose_detail = Column(Text)
    qr_code_data = Column(String(500))  # Verification URL encoded in QR
    qr_verification_url = Column(String(500))
    digital_signature_applied = Column(Boolean, default=False)
    signed_by = Column(String(255))  # Name of signatory (Principal/Dean)
    file_url = Column(String(500))  # R2 URL
    # Status
    status = Column(String(20), default="generated")
    # "requested", "generated", "signed", "issued", "revoked"
    issued_date = Column(Date)
    revoked_date = Column(Date)
    revocation_reason = Column(Text)
    generated_by = Column(UUID)
    custom_fields = Column(JSONB)  # For custom certificates
```

### 1.16 Alumni

```python
class Alumni(TenantModel):
    __tablename__ = "alumni"
    student_id = Column(UUID, ForeignKey("students.id"), nullable=True)  # Link to student record
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
    pg_qualification = Column(String(100))  # "MD", "MS", "DNB", "MHA", etc.
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
    contributions = Column(JSONB)  # ["donation", "guest_lecture", "mentoring"]
    notes = Column(Text)
```

### 1.17 Hostel

```python
class HostelBlock(TenantModel):
    __tablename__ = "hostel_blocks"
    name = Column(String(100), nullable=False)  # "Boys Hostel 1", "Girls Hostel 1"
    block_type = Column(String(30))  # "ug_boys", "ug_girls", "pg_boys", "pg_girls", "intern", "freshers"
    total_rooms = Column(Integer, default=0)
    total_beds = Column(Integer, default=0)
    floors = Column(Integer, default=1)
    warden_faculty_id = Column(UUID, ForeignKey("faculty.id"))
    warden_phone = Column(String(20))
    has_cctv = Column(Boolean, default=False)
    is_anti_ragging_compliant = Column(Boolean, default=False)  # Separate fresher block
    is_active = Column(Boolean, default=True)


class HostelRoom(TenantModel):
    __tablename__ = "hostel_rooms"
    block_id = Column(UUID, ForeignKey("hostel_blocks.id"), nullable=False)
    room_number = Column(String(20), nullable=False)
    floor = Column(Integer, default=0)
    capacity = Column(Integer, default=2)  # Max 2-3 per NMC
    current_occupancy = Column(Integer, default=0)
    room_type = Column(String(20), default="regular")
    # "regular", "duty_room", "warden_room", "study_room", "visitor_room"
    has_ac = Column(Boolean, default=False)
    has_attached_bathroom = Column(Boolean, default=False)
    status = Column(String(20), default="available")
    # "available", "full", "maintenance", "reserved"


class HostelAllocation(TenantModel):
    __tablename__ = "hostel_allocations"
    student_id = Column(UUID, ForeignKey("students.id"), nullable=False)
    room_id = Column(UUID, ForeignKey("hostel_rooms.id"), nullable=False)
    block_id = Column(UUID, ForeignKey("hostel_blocks.id"), nullable=False)
    academic_year = Column(String(10))
    check_in_date = Column(Date)
    check_out_date = Column(Date)
    status = Column(String(20), default="active")  # "active", "vacated", "transferred"


class MessUnit(TenantModel):
    __tablename__ = "mess_units"
    name = Column(String(100), nullable=False)
    mess_type = Column(String(20))  # "boys", "girls", "intern", "common"
    capacity = Column(Integer)
    vendor_name = Column(String(255))
    vendor_contact = Column(String(20))
    monthly_fee = Column(BigInteger)  # In paisa
    is_active = Column(Boolean, default=True)
```

### 1.18 Transport

```python
class Vehicle(TenantModel):
    __tablename__ = "vehicles"
    vehicle_number = Column(String(20), nullable=False)
    vehicle_type = Column(String(20))  # "bus", "van", "car", "ambulance"
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
    status = Column(String(20), default="active")  # "active", "maintenance", "idle", "decommissioned"


class TransportRoute(TenantModel):
    __tablename__ = "transport_routes"
    name = Column(String(100), nullable=False)  # "Campus-Hospital Shuttle"
    route_type = Column(String(30))
    # "campus_hospital", "campus_rhtc", "campus_uhtc", "hostel_campus", "night_duty"
    origin = Column(String(255))
    destination = Column(String(255))
    distance_km = Column(Float)
    schedule = Column(JSONB)
    # [{"departure": "06:00", "vehicle_id": "...", "days": ["Mon","Tue","Wed","Thu","Fri","Sat"]}]
    vehicle_id = Column(UUID, ForeignKey("vehicles.id"))
    is_active = Column(Boolean, default=True)


class TransportBooking(TenantModel):
    __tablename__ = "transport_bookings"
    route_id = Column(UUID, ForeignKey("transport_routes.id"))
    department_id = Column(UUID, ForeignKey("departments.id"))
    requested_by = Column(UUID)
    booking_date = Column(Date, nullable=False)
    departure_time = Column(String(10))
    num_passengers = Column(Integer)
    purpose = Column(Text)
    faculty_accompanying = Column(String(255))
    vehicle_id = Column(UUID, ForeignKey("vehicles.id"))
    status = Column(String(20), default="requested")
    # "requested", "approved", "assigned", "completed", "cancelled"


class VehicleMaintenanceLog(TenantModel):
    __tablename__ = "vehicle_maintenance_logs"
    vehicle_id = Column(UUID, ForeignKey("vehicles.id"), nullable=False)
    maintenance_type = Column(String(20))  # "scheduled", "breakdown", "accident"
    description = Column(Text)
    cost = Column(BigInteger)  # In paisa
    vendor = Column(String(255))
    date = Column(Date)
    km_reading = Column(Integer)
    next_scheduled = Column(Date)
```

### 1.19 Library

```python
class LibraryBook(TenantModel):
    __tablename__ = "library_books"
    accession_number = Column(String(50), unique=True)
    title = Column(String(500), nullable=False)
    author = Column(String(500))
    publisher = Column(String(255))
    year_of_publication = Column(Integer)
    edition = Column(String(50))
    isbn = Column(String(20))
    subject = Column(String(100))
    department_id = Column(UUID, ForeignKey("departments.id"))
    location = Column(String(50))  # "main_library", "dept_anatomy", etc.
    shelf_number = Column(String(20))
    total_copies = Column(Integer, default=1)
    available_copies = Column(Integer, default=1)
    status = Column(String(20), default="available")
    # "available", "all_issued", "lost", "damaged", "weeded_out"
    price = Column(BigInteger)  # In paisa


class LibraryJournal(TenantModel):
    __tablename__ = "library_journals"
    name = Column(String(500), nullable=False)
    publisher = Column(String(255))
    issn = Column(String(20))
    journal_type = Column(String(20))  # "indian", "foreign"
    indexed_in = Column(JSONB)  # ["SCI", "Scopus", "DOAJ", "PubMed", "Embase"]
    subscription_status = Column(String(20), default="active")
    # "active", "expiring", "expired", "cancelled"
    subscription_start = Column(Date)
    subscription_end = Column(Date)
    annual_cost = Column(BigInteger)  # In paisa
    is_online = Column(Boolean, default=False)
    access_url = Column(String(500))


class LibraryIssuance(TenantModel):
    __tablename__ = "library_issuances"
    book_id = Column(UUID, ForeignKey("library_books.id"), nullable=False)
    borrower_id = Column(UUID, nullable=False)
    borrower_type = Column(String(20))  # "student", "faculty", "staff"
    issued_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False)
    returned_date = Column(Date)
    fine_amount = Column(BigInteger, default=0)  # Late return fine in paisa
    status = Column(String(20), default="issued")  # "issued", "returned", "overdue", "lost"
```

### 1.20 Infrastructure & Equipment

```python
class Infrastructure(TenantModel):
    __tablename__ = "infrastructure"
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
    department_id = Column(UUID, ForeignKey("departments.id"))
    has_ac = Column(Boolean, default=False)
    has_projector = Column(Boolean, default=False)
    has_smart_board = Column(Boolean, default=False)
    condition = Column(String(20), default="good")  # "good", "fair", "poor", "under_renovation"
    last_inspection_date = Column(Date)
    is_active = Column(Boolean, default=True)


class Equipment(TenantModel):
    __tablename__ = "equipment"
    name = Column(String(255), nullable=False)
    department_id = Column(UUID, ForeignKey("departments.id"), nullable=False)
    serial_number = Column(String(100))
    make_model = Column(String(255))
    purchase_date = Column(Date)
    purchase_cost = Column(BigInteger)  # In paisa
    supplier_vendor = Column(String(255))
    warranty_expiry = Column(Date)
    # AMC
    amc_status = Column(String(20), default="not_covered")
    # "active", "expiring", "expired", "not_covered"
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
    # "working", "minor_issue", "major_issue", "non_functional", "condemned"
    location = Column(String(100))
    is_nmc_required = Column(Boolean, default=False)  # Part of NMC equipment list
    nmc_specification_met = Column(Boolean, default=True)


class MaintenanceTicket(TenantModel):
    __tablename__ = "maintenance_tickets"
    ticket_number = Column(String(50), unique=True)
    entity_type = Column(String(20))  # "equipment", "infrastructure"
    entity_id = Column(UUID)
    department_id = Column(UUID, ForeignKey("departments.id"))
    reported_by = Column(UUID)
    reported_by_name = Column(String(255))
    description = Column(Text, nullable=False)
    priority = Column(String(20), default="medium")  # "critical", "high", "medium", "low"
    status = Column(String(20), default="open")
    # "open", "assigned", "in_progress", "resolved", "closed"
    assigned_to = Column(String(255))
    resolution_description = Column(Text)
    resolution_date = Column(DateTime(timezone=True))
    cost = Column(BigInteger)  # Repair cost in paisa
```

### 1.21 Notices & Communication

```python
class Notice(TenantModel):
    __tablename__ = "notices"
    title = Column(String(500), nullable=False)
    content = Column(Text, nullable=False)
    notice_type = Column(String(20))  # "notice", "circular", "order", "memo", "minutes"
    priority = Column(String(20), default="normal")  # "urgent", "important", "normal"
    target_audience = Column(JSONB)
    # {"roles": ["student", "faculty", "admin"], "departments": [...], "batches": [...], "include_parents": false}
    posted_by = Column(UUID)
    posted_by_name = Column(String(255))
    # Delivery
    delivery_channels = Column(JSONB, default=["in_app"])  # ["in_app", "push", "sms", "email"]
    # Acknowledgment
    requires_acknowledgment = Column(Boolean, default=False)
    # Schedule
    published_at = Column(DateTime(timezone=True))
    expires_at = Column(DateTime(timezone=True))
    is_pinned = Column(Boolean, default=False)
    # Attachments
    attachments = Column(JSONB)  # [{"name": "...", "url": "...", "size": ...}]
    # Status
    status = Column(String(20), default="draft")  # "draft", "published", "archived"
    # Stats
    read_count = Column(Integer, default=0)
    total_recipients = Column(Integer, default=0)
    acknowledged_count = Column(Integer, default=0)


class NoticeReadReceipt(TenantModel):
    __tablename__ = "notice_read_receipts"
    notice_id = Column(UUID, ForeignKey("notices.id"), nullable=False)
    user_id = Column(UUID, nullable=False)
    read_at = Column(DateTime(timezone=True))
    acknowledged_at = Column(DateTime(timezone=True))
    channel = Column(String(20))  # How they read it: "in_app", "email", "push"
```

### 1.22 Grievances & Committees

```python
class Committee(TenantModel):
    __tablename__ = "committees"
    name = Column(String(255), nullable=False)
    committee_type = Column(String(30))
    # "anti_ragging", "icc_posh", "grievance_redressal", "student_council",
    # "iqac", "academic_council", "board_of_studies", "governing_body", "custom"
    is_nmc_mandated = Column(Boolean, default=False)
    chairperson_name = Column(String(255))
    chairperson_contact = Column(String(100))
    meeting_frequency = Column(String(50))  # "monthly", "quarterly", "as_needed"
    last_meeting_date = Column(Date)
    next_meeting_date = Column(Date)
    status = Column(String(20), default="active")


class CommitteeMember(TenantModel):
    __tablename__ = "committee_members"
    committee_id = Column(UUID, ForeignKey("committees.id"), nullable=False)
    member_name = Column(String(255), nullable=False)
    member_role = Column(String(100))
    # "chairperson", "member", "external_member", "student_representative",
    # "parent_representative", "civil_representative", "ngo_representative"
    member_type = Column(String(20))  # "faculty", "staff", "student", "external"
    user_id = Column(UUID, nullable=True)  # Link to platform user if internal
    contact_phone = Column(String(20))
    contact_email = Column(String(255))
    is_active = Column(Boolean, default=True)


class Grievance(TenantModel):
    __tablename__ = "grievances"
    ticket_number = Column(String(50), unique=True)
    filed_by = Column(UUID)
    filed_by_name = Column(String(255))
    filed_by_role = Column(String(20))  # "student", "faculty", "staff", "parent"
    is_anonymous = Column(Boolean, default=False)
    category = Column(String(30))
    # "academic", "anti_ragging", "harassment", "infrastructure",
    # "administrative", "fee_related", "hostel", "other"
    assigned_committee_id = Column(UUID, ForeignKey("committees.id"))
    description = Column(Text, nullable=False)
    evidence_urls = Column(JSONB)  # [{"name": "...", "url": "..."}]
    priority = Column(String(20), default="medium")
    status = Column(String(20), default="filed")
    # "filed", "acknowledged", "under_review", "hearing_scheduled",
    # "resolved", "escalated", "closed"
    resolution_description = Column(Text)
    resolution_date = Column(DateTime(timezone=True))
    resolved_by = Column(UUID)
    timeline = Column(JSONB)
    # [{"date": "...", "action": "Filed", "by": "...", "notes": "..."}]
```

### 1.23 Workflows & Approvals

```python
class WorkflowDefinition(TenantModel):
    __tablename__ = "workflow_definitions"
    name = Column(String(100), nullable=False)
    workflow_type = Column(String(30), nullable=False)
    # "leave_request", "certificate_request", "purchase_order",
    # "travel_claim", "transfer_request", "fee_concession",
    # "equipment_request", "event_approval"
    approval_chain = Column(JSONB, nullable=False)
    # [{"step": 1, "role": "HOD", "auto_escalate_days": 3},
    #  {"step": 2, "role": "Dean", "auto_escalate_days": 5}]
    is_active = Column(Boolean, default=True)


class WorkflowInstance(TenantModel):
    __tablename__ = "workflow_instances"
    definition_id = Column(UUID, ForeignKey("workflow_definitions.id"))
    workflow_type = Column(String(30), nullable=False)
    reference_type = Column(String(30))  # "leave_request", "purchase_order", etc.
    reference_id = Column(UUID)  # ID of the entity being approved
    requested_by = Column(UUID, nullable=False)
    requested_by_name = Column(String(255))
    title = Column(String(500))
    description = Column(Text)
    current_step = Column(Integer, default=1)
    current_approver_id = Column(UUID)
    approval_history = Column(JSONB)
    # [{"step": 1, "approver": "...", "status": "approved", "date": "...", "comment": "..."}]
    status = Column(String(20), default="pending")
    # "pending", "in_progress", "approved", "rejected", "cancelled"
    priority = Column(String(20), default="normal")
    due_date = Column(Date)
    completed_at = Column(DateTime(timezone=True))
```

### 1.24 Document Management

```python
class Document(TenantModel):
    __tablename__ = "documents"
    title = Column(String(500), nullable=False)
    category = Column(String(50))
    # "circular", "meeting_minutes", "committee_proceedings", "audit_report",
    # "nmc_correspondence", "saf_submission", "naac_documentation",
    # "university_correspondence", "faculty_appointment", "student_records",
    # "hospital_records", "infrastructure", "policy", "other"
    sub_category = Column(String(100))
    file_url = Column(String(500), nullable=False)
    file_name = Column(String(255))
    file_size = Column(Integer)
    mime_type = Column(String(100))
    uploaded_by = Column(UUID)
    uploaded_by_name = Column(String(255))
    description = Column(Text)
    tags = Column(JSONB)  # ["nmc", "2025-26", "anatomy"]
    access_level = Column(String(20), default="admin_only")
    # "public", "admin_only", "committee_only", "confidential"
    version = Column(Integer, default=1)
    parent_document_id = Column(UUID, ForeignKey("documents.id"))  # For versioning
    academic_year = Column(String(10))
    is_archived = Column(Boolean, default=False)
```

### 1.25 Academic Calendar

```python
class AcademicCalendarEvent(TenantModel):
    __tablename__ = "academic_calendar_events"
    title = Column(String(500), nullable=False)
    event_type = Column(String(30))
    # "semester_start", "semester_end", "exam", "holiday", "nmc_deadline",
    # "naac_deadline", "clinical_posting_change", "administrative",
    # "crmi_rotation", "orientation", "convocation", "university_event"
    start_date = Column(Date, nullable=False)
    end_date = Column(Date)
    is_all_day = Column(Boolean, default=True)
    start_time = Column(String(10))  # For non-all-day events
    end_time = Column(String(10))
    affects_phases = Column(JSONB)  # ["Phase I", "Phase II", "all"]
    department_id = Column(UUID, ForeignKey("departments.id"))  # null = all departments
    description = Column(Text)
    is_recurring = Column(Boolean, default=False)
    recurrence_rule = Column(String(100))  # "weekly", "monthly", "annual"
    notify_roles = Column(JSONB)  # ["student", "faculty", "admin"]
    academic_year = Column(String(10))
    is_teaching_day = Column(Boolean, default=True)  # For counting teaching weeks
```

### 1.26 Timetable

```python
class TimetableSlot(TenantModel):
    __tablename__ = "timetable_slots"
    academic_year = Column(String(10), nullable=False)
    phase = Column(String(20), nullable=False)
    batch_id = Column(UUID, ForeignKey("batches.id"))
    day_of_week = Column(Integer, nullable=False)  # 0=Monday ... 5=Saturday
    start_time = Column(String(10), nullable=False)  # "08:00"
    end_time = Column(String(10), nullable=False)  # "09:00"
    subject = Column(String(100))
    department_id = Column(UUID, ForeignKey("departments.id"))
    faculty_id = Column(UUID, ForeignKey("faculty.id"))
    session_type = Column(String(20))
    # "lecture", "practical", "sgd", "pbl", "cbl", "clinical_posting",
    # "sdl", "ece", "tutorial", "demonstration", "dissection"
    room_id = Column(UUID, ForeignKey("infrastructure.id"))  # Lecture hall/lab
    room_name = Column(String(100))  # Denormalized for quick display
    is_active = Column(Boolean, default=True)
    effective_from = Column(Date)
    effective_until = Column(Date)
```

### 1.27 Clinical Rotations

```python
class ClinicalRotation(TenantModel):
    __tablename__ = "clinical_rotations"
    student_id = Column(UUID, ForeignKey("students.id"), nullable=False)
    department_id = Column(UUID, ForeignKey("departments.id"), nullable=False)
    batch_id = Column(UUID, ForeignKey("batches.id"))
    rotation_group = Column(String(20))  # "Group A", "Group B", etc.
    phase = Column(String(20))  # "Phase II", "Phase III", "CRMI"
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    required_hours = Column(Integer)  # NMC minimum for this department
    completed_hours = Column(Integer, default=0)
    supervisor_faculty_id = Column(UUID, ForeignKey("faculty.id"))
    posting_assessment_score = Column(Float)
    assessed_by = Column(UUID, ForeignKey("faculty.id"))
    assessed_at = Column(DateTime(timezone=True))
    status = Column(String(20), default="scheduled")
    # "scheduled", "active", "completed", "assessed"
    attendance_percentage = Column(Float)
    is_crmi = Column(Boolean, default=False)
    crmi_leave_days_taken = Column(Integer, default=0)  # Max 15 total for CRMI
```

### 1.28 Audit Log (already exists in shared — ensure it covers admin)

```python
class AuditLog(TenantModel):
    __tablename__ = "audit_log"
    user_id = Column(UUID)
    user_name = Column(String(255))
    user_role = Column(String(50))
    action = Column(String(20), nullable=False)  # "create", "update", "delete", "view", "export", "login"
    entity_type = Column(String(50), nullable=False)  # "student", "faculty", "fee_payment", etc.
    entity_id = Column(UUID)
    changes = Column(JSONB)  # {"field": {"old": "...", "new": "..."}}
    ip_address = Column(String(50))
    user_agent = Column(String(500))
    # This table is APPEND ONLY — no updates or deletes ever
```

---

## PHASE 2: ALEMBIC MIGRATIONS

After creating all models, generate the Alembic migration:

```bash
cd backend
alembic revision --autogenerate -m "admin_engine_complete_schema"
```

Then review the generated migration. Ensure:
1. Every table has `college_id` column (except College, ScholarshipScheme, NMCStandard)
2. All foreign keys are correct
3. Indexes on: (college_id, id), (college_id, student_id), (college_id, faculty_id), (college_id, department_id) for frequently queried columns
4. JSONB columns have GIN indexes where searched
5. Partition audit_log and fee_payments by month using pg_partman if volume justifies it

After migration, add RLS policies for every tenant-scoped table:

```sql
-- Generate RLS for each table
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename NOT IN ('colleges', 'scholarship_schemes', 'nmc_standards', 'naac_metrics', 'alembic_version')
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('CREATE POLICY tenant_isolation_%I ON %I USING (college_id = current_setting(''app.current_college_id'')::uuid)', tbl, tbl);
    END LOOP;
END $$;
```

---

## PHASE 3: PYDANTIC SCHEMAS

Create `backend/app/engines/admin/schemas.py` with request/response schemas for every model. Follow these rules:

1. Every model gets: `{Model}Create`, `{Model}Update`, `{Model}Response`, `{Model}ListResponse`
2. `Create` schemas omit id, college_id, created_at, updated_at (backend sets these)
3. `Update` schemas make all fields Optional
4. `Response` schemas include all fields plus computed fields
5. `ListResponse` includes pagination: `items: list[{Model}Response]`, `total: int`, `page: int`, `page_size: int`
6. Use Pydantic v2 syntax (model_config, field_validator)
7. All monetary amounts come in as paisa (integer), formatted to ₹ in frontend

Example pattern:
```python
from pydantic import BaseModel, Field, field_validator
from datetime import date, datetime
from uuid import UUID

class StudentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: str | None = None
    phone: str | None = Field(None, pattern=r'^[6-9]\d{9}$')  # Indian phone
    date_of_birth: date | None = None
    gender: str | None = Field(None, pattern=r'^(male|female|other)$')
    category: str | None = None
    neet_roll_number: str | None = None
    neet_score: int | None = Field(None, ge=0, le=720)
    neet_rank: int | None = Field(None, ge=1)
    admission_quota: str | None = None
    # ... all fields

class StudentUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    # ... all fields optional

class StudentResponse(BaseModel):
    id: UUID
    college_id: UUID
    name: str
    # ... all fields
    # Computed
    fee_status: str | None = None  # Calculated from fee_payments
    attendance_percentage: float | None = None  # Calculated from attendance_records
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

class StudentListResponse(BaseModel):
    items: list[StudentResponse]
    total: int
    page: int
    page_size: int
```

---

## PHASE 4: API ENDPOINTS

Create FastAPI routers for each module. Every router follows this pattern:

```python
# Standard CRUD pattern for each entity
router = APIRouter(prefix="/api/v1/admin/{entity}", tags=["Admin - {Entity}"])

@router.get("/", response_model={Entity}ListResponse)
async def list_{entities}(
    page: int = 1,
    page_size: int = 25,
    search: str = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    # Entity-specific filters
    status: str = None,
    department_id: UUID = None,
    # ... other filters
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """List with search, filter, sort, pagination."""

@router.get("/{id}", response_model={Entity}Response)
async def get_{entity}(id: UUID, ...)

@router.post("/", response_model={Entity}Response, status_code=201)
async def create_{entity}(data: {Entity}Create, ...)

@router.put("/{id}", response_model={Entity}Response)
async def update_{entity}(id: UUID, data: {Entity}Update, ...)

@router.delete("/{id}", status_code=204)
async def delete_{entity}(id: UUID, ...)
```

### Additional Non-CRUD Endpoints:

#### Dashboard
```
GET  /api/v1/admin/dashboard/stats           → overview stats (student count, faculty count, fee collection, etc.)
GET  /api/v1/admin/dashboard/fee-trend        → monthly fee collection chart data
GET  /api/v1/admin/dashboard/pending-approvals → top pending approvals
GET  /api/v1/admin/dashboard/recent-activity  → recent activity feed
GET  /api/v1/admin/dashboard/compliance-summary → NMC compliance quick view
```

#### Students
```
POST /api/v1/admin/students/bulk-import       → CSV import
POST /api/v1/admin/students/{id}/verify-document → verify a specific document
POST /api/v1/admin/students/{id}/promote      → promote to next phase/semester
GET  /api/v1/admin/students/{id}/fee-summary  → fee status for one student
GET  /api/v1/admin/students/{id}/attendance-summary → attendance for one student
POST /api/v1/admin/students/nmc-upload        → mark students as uploaded to NMC
GET  /api/v1/admin/students/seat-matrix       → quota-wise seat fill status
```

#### Admissions
```
GET  /api/v1/admin/admissions/pipeline        → admission pipeline grouped by status
GET  /api/v1/admin/admissions/counseling-rounds → round-wise admission counts
POST /api/v1/admin/admissions/bulk-verify     → verify multiple student documents at once
```

#### Fees
```
POST /api/v1/admin/fees/record-payment        → record an offline/manual payment
POST /api/v1/admin/fees/generate-receipt/{payment_id} → generate receipt PDF
GET  /api/v1/admin/fees/defaulters            → list of students with overdue fees
POST /api/v1/admin/fees/send-reminder         → send fee reminder to student(s)
GET  /api/v1/admin/fees/collection-summary    → total collected / outstanding / overdue by quota
POST /api/v1/admin/fees/calculate-late-fee    → compute late fee for a student
GET  /api/v1/admin/fees/structures/{id}/total → calculate total fee for a quota
```

#### Scholarships
```
POST /api/v1/admin/scholarships/auto-match    → match all students to eligible schemes
GET  /api/v1/admin/scholarships/matched/{student_id} → schemes a student is eligible for
POST /api/v1/admin/scholarships/update-status → update NSP/portal status
GET  /api/v1/admin/scholarships/disbursement-summary → total disbursed, pending
```

#### Faculty & MSR
```
GET  /api/v1/admin/faculty/msr-compliance     → department-wise MSR gap analysis
GET  /api/v1/admin/faculty/retirement-forecast → faculty retiring in next 1/2/3/5 years with MSR impact
GET  /api/v1/admin/faculty/{id}/portfolio     → auto-generated faculty portfolio
POST /api/v1/admin/faculty/bulk-import        → CSV import of faculty roster
POST /api/v1/admin/faculty/{id}/validate-nmc  → run NMC qualification rules check
```

#### Payroll
```
POST /api/v1/admin/payroll/calculate          → calculate payroll for month/year
POST /api/v1/admin/payroll/approve            → approve calculated payroll
POST /api/v1/admin/payroll/generate-bank-file → generate NEFT bank transfer file
POST /api/v1/admin/payroll/generate-payslips  → generate pay slip PDFs
POST /api/v1/admin/payroll/email-payslips     → email pay slips to all
GET  /api/v1/admin/payroll/statutory-summary  → EPF/ESI/TDS/PT totals for the month
```

#### Leave
```
POST /api/v1/admin/leave/{id}/approve         → approve a leave request
POST /api/v1/admin/leave/{id}/reject          → reject with reason
GET  /api/v1/admin/leave/calendar             → leave calendar data for all staff
GET  /api/v1/admin/leave/balance/{employee_id} → leave balances for one employee
GET  /api/v1/admin/leave/department-impact     → department-wise leave vs MSR risk
```

#### Certificates
```
POST /api/v1/admin/certificates/generate      → generate certificate PDF with QR
GET  /api/v1/admin/certificates/verify/{cert_number} → public verification endpoint (no auth)
POST /api/v1/admin/certificates/{id}/revoke   → revoke an issued certificate
```

#### Hostel
```
GET  /api/v1/admin/hostel/occupancy           → block-wise occupancy summary
POST /api/v1/admin/hostel/allocate            → allocate student to room
POST /api/v1/admin/hostel/auto-allocate       → auto-allocate freshers
POST /api/v1/admin/hostel/transfer            → transfer student between rooms
GET  /api/v1/admin/hostel/nmc-compliance      → is capacity ≥ 75% of intake?
```

#### Library
```
GET  /api/v1/admin/library/nmc-compliance     → books/journals vs NMC minimums
POST /api/v1/admin/library/issue-book         → issue a book
POST /api/v1/admin/library/return-book        → return a book, calculate fine
GET  /api/v1/admin/library/overdue            → list of overdue issuances
```

#### Clinical Rotations
```
POST /api/v1/admin/rotations/generate         → generate rotation schedule (constraint solver)
GET  /api/v1/admin/rotations/matrix           → Gantt chart data for rotation visualization
POST /api/v1/admin/rotations/validate-nmc     → validate against NMC minimum hours
```

#### Executive Dashboard
```
GET  /api/v1/admin/executive/financial-overview → revenue, expenditure, projections
GET  /api/v1/admin/executive/compliance-heatmap → dept × risk category matrix
GET  /api/v1/admin/executive/academic-performance → pass rates, NEET-PG conversion
GET  /api/v1/admin/executive/action-items      → critical items needing Dean's attention
```

#### Notices
```
POST /api/v1/admin/notices/{id}/publish       → publish a draft notice
GET  /api/v1/admin/notices/{id}/analytics     → read rate, acknowledgment stats
POST /api/v1/admin/notices/bulk-send          → send notice via multiple channels
```

#### Workflows
```
GET  /api/v1/admin/workflows/pending          → all pending approvals for current user
POST /api/v1/admin/workflows/{id}/approve     → approve current step
POST /api/v1/admin/workflows/{id}/reject      → reject with reason
GET  /api/v1/admin/workflows/stats            → pending/approved/rejected counts
```

#### Settings
```
GET  /api/v1/admin/settings/college-profile   → get college configuration
PUT  /api/v1/admin/settings/college-profile   → update college configuration
GET  /api/v1/admin/settings/audit-log         → query audit log with filters
```

---

## PHASE 5: SERVICE LAYER (Business Logic)

### 5.1 Fee Calculator (`services/fee_calculator.py`)
- `calculate_total_fee(student_id, academic_year)` — sum all components for student's quota
- `calculate_outstanding(student_id)` — total fee minus total payments
- `calculate_late_fee(student_id, as_of_date)` — days past due × late_fee_per_day
- `generate_installment_schedule(fee_structure_id)` — return installment dates and amounts
- `check_fee_regulatory_compliance(fee_structure_id)` — is total within state FRC cap?

### 5.2 MSR Checker (`services/msr_checker.py`)
- `get_msr_requirements(college_id)` — load NMC MSR minimums for college's intake size
- `calculate_department_compliance(college_id, department_id)` — actual vs required faculty per designation
- `get_overall_compliance_score(college_id)` — weighted compliance across all departments
- `forecast_retirement_impact(college_id, years_ahead)` — what happens when faculty retire
- `get_critical_gaps(college_id)` — departments where hiring is urgent

### 5.3 Payroll Processor (`services/payroll_processor.py`)
- `calculate_salary(faculty_id, month, year)` — compute full salary with all allowances and deductions
- `calculate_epf(basic_pay)` — 12% employee + 12% employer
- `calculate_esi(gross, esi_ceiling)` — 0.75% + 3.25% if gross ≤ ₹21,000
- `calculate_tds(annual_income, regime)` — income tax per slab
- `calculate_professional_tax(gross, state)` — state-specific PT slabs
- `generate_bank_file(college_id, month, year)` — NEFT/RTGS format for bulk transfer

### 5.4 Scholarship Matcher (`services/scholarship_matcher.py`)
- `match_student_to_schemes(student_id)` — compare student profile against all active schemes
- `auto_match_all_students(college_id)` — batch run for entire college
- `check_renewal_eligibility(student_scholarship_id)` — does student still meet criteria?

### 5.5 Certificate Generator (`services/certificate_generator.py`)
- `generate_certificate(student_id, cert_type, purpose)` — create PDF with college header, QR code
- `generate_qr_code(certificate_number)` — QR encoding verification URL
- `verify_certificate(certificate_number)` — public verification check

### 5.6 Dashboard Aggregator (`services/dashboard_aggregator.py`)
- `get_dashboard_stats(college_id)` — aggregate all key metrics
- `get_fee_collection_trend(college_id, academic_year)` — monthly collection data
- `get_recent_activity(college_id, limit)` — recent creates/updates across all entities
- `get_pending_approvals(college_id, user_id)` — items needing current user's approval

---

## PHASE 6: SEED DATA

Create seed script at `backend/scripts/seed_admin.py`:

1. **NMC Standards** — MSR requirements by intake size (100/150/200/250) and department
2. **19 Departments** — Anatomy, Physiology, Biochemistry, Pathology, Microbiology, Pharmacology, Forensic Medicine, Community Medicine, General Medicine, General Surgery, OB-GYN, Pediatrics, Orthopaedics, Ophthalmology, ENT, Dermatology, Psychiatry, Anaesthesiology, Radiology
3. **Scholarship Schemes** — at least 15 major national schemes with real data
4. **Leave Policies** — default policies for teaching faculty, hospital staff, admin staff
5. **Salary Structures** — 7th CPC pay levels 10-15 with current DA rates
6. **Workflow Definitions** — default approval chains for leave, certificate, purchase order
7. **Sample College** — one test college with realistic configuration (Karnataka, 150-seat private)
8. **Sample Data** — 20 students, 10 faculty, 3 fee payments, 2 leave requests (for testing)

---

## EXECUTION ORDER

Run these in sequence:

1. **Models** — Create all SQLAlchemy models in `models.py`
2. **Migration** — Run `alembic revision --autogenerate` and review
3. **RLS** — Add RLS policies to migration
4. **Schemas** — Create all Pydantic schemas in `schemas.py`
5. **Services** — Build business logic services
6. **Routes** — Build all API endpoints
7. **Seed** — Create and run seed data script
8. **Test** — Create basic tests for each endpoint (at minimum: create, read, list, update, delete)

After this is done, the frontend can replace ALL mock data with real API calls.

---

## IMPORTANT RULES

- **Multi-tenant everywhere.** Every query must filter by college_id. RLS is the safety net, but application code should also filter explicitly.
- **Async only.** Use `async def` for all route handlers and service functions. Use SQLAlchemy async sessions.
- **Paisa for money.** Store all monetary values as BigInteger in paisa (1 rupee = 100 paisa). Frontend converts for display.
- **No AI in this phase.** The AI Engine is separate. This is pure CRUD + computation.
- **Audit everything.** Every create/update/delete should write to audit_log.
- **Indian context.** Phone validation for Indian numbers (10 digits starting with 6-9). Aadhaar stored as SHA-256 hash only. State names match Indian states. Dates in IST.
- **Soft delete preferred.** Use status fields rather than actual DELETE where possible (students, faculty, etc.). Hard delete only for truly ephemeral data.
- **Pagination default 25.** All list endpoints paginate with default page_size=25.
