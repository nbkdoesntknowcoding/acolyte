"""Admin Engine — Pydantic Schemas.

Create/Update/Response/ListResponse for all admin models.
All monetary fields in paisa (BigInteger). Frontend formats for display.
"""

from datetime import date, datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.shared.schemas import PaginatedResponse


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class NMCDepartmentType(str, Enum):
    PRECLINICAL = "preclinical"
    PARACLINICAL = "paraclinical"
    CLINICAL = "clinical"


# ===================================================================
# Department
# ===================================================================

class DepartmentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    code: str = Field(..., min_length=1, max_length=20)
    nmc_department_type: NMCDepartmentType
    department_type: str | None = None
    hod_id: UUID | None = None
    beds: int | None = Field(default=None, ge=0)
    opd_rooms: int | None = Field(default=None, ge=0)
    labs: int | None = Field(default=None, ge=0)
    lecture_halls: int | None = Field(default=None, ge=0)
    nmc_department_code: str | None = None
    display_order: int | None = None
    established_year: int | None = Field(default=None, ge=1900, le=2100)


class DepartmentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    code: str | None = Field(default=None, min_length=1, max_length=20)
    nmc_department_type: NMCDepartmentType | None = None
    department_type: str | None = None
    hod_id: UUID | None = None
    beds: int | None = None
    opd_rooms: int | None = None
    labs: int | None = None
    lecture_halls: int | None = None
    nmc_department_code: str | None = None
    is_active: bool | None = None
    display_order: int | None = None
    established_year: int | None = Field(default=None, ge=1900, le=2100)


class DepartmentResponse(BaseModel):
    id: UUID
    college_id: UUID
    name: str
    code: str
    nmc_department_type: str
    department_type: str | None = None
    hod_id: UUID | None = None
    beds: int | None = None
    opd_rooms: int | None = None
    labs: int | None = None
    lecture_halls: int | None = None
    nmc_department_code: str | None = None
    is_active: bool
    display_order: int | None = None
    established_year: int | None = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class DepartmentListResponse(PaginatedResponse):
    data: list[DepartmentResponse]


# ===================================================================
# Batch
# ===================================================================

class BatchCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    batch_type: str | None = None
    admission_year: int
    current_phase: str | None = None
    current_semester: int | None = None
    phase: str | None = None


class BatchUpdate(BaseModel):
    name: str | None = None
    batch_type: str | None = None
    admission_year: int | None = None
    current_phase: str | None = None
    current_semester: int | None = None
    phase: str | None = None
    student_count: int | None = None
    is_active: bool | None = None


class BatchResponse(BaseModel):
    id: UUID
    college_id: UUID
    name: str
    batch_type: str | None = None
    admission_year: int
    current_phase: str | None = None
    current_semester: int | None = None
    phase: str | None = None
    student_count: int
    is_active: bool | None = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class BatchListResponse(PaginatedResponse):
    data: list[BatchResponse]


# ===================================================================
# Student
# ===================================================================

class StudentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: str | None = None
    phone: str | None = Field(default=None, pattern=r"^[6-9]\d{9}$")
    date_of_birth: date | None = None
    gender: str | None = None
    blood_group: str | None = None
    nationality: str | None = "Indian"
    religion: str | None = None
    category: str | None = None
    father_name: str | None = None
    mother_name: str | None = None
    guardian_phone: str | None = None
    guardian_email: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    permanent_address: str | None = None
    city: str | None = None
    state: str | None = None
    pin_code: str | None = None
    neet_roll_number: str | None = None
    neet_score: int | None = Field(default=None, ge=0, le=720)
    neet_rank: int | None = Field(default=None, ge=1)
    neet_percentile: float | None = None
    neet_year: int | None = None
    admission_quota: str | None = None
    counseling_round: str | None = None
    allotment_order_number: str | None = None
    admission_date: date | None = None
    admission_year: int | None = None
    class_10_board: str | None = None
    class_10_percentage: float | None = None
    class_12_board: str | None = None
    class_12_percentage: float | None = None
    pcb_percentage: float | None = None
    gap_years: int | None = 0
    enrollment_number: str | None = None
    university_registration_number: str | None = None
    current_phase: str | None = None
    current_semester: int | None = None
    batch_id: UUID | None = None
    status: str | None = "active"
    is_hosteler: bool | None = False


class StudentUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = Field(default=None, pattern=r"^[6-9]\d{9}$")
    date_of_birth: date | None = None
    gender: str | None = None
    blood_group: str | None = None
    nationality: str | None = None
    religion: str | None = None
    category: str | None = None
    father_name: str | None = None
    mother_name: str | None = None
    guardian_phone: str | None = None
    guardian_email: str | None = None
    permanent_address: str | None = None
    city: str | None = None
    state: str | None = None
    pin_code: str | None = None
    neet_score: int | None = Field(default=None, ge=0, le=720)
    admission_quota: str | None = None
    enrollment_number: str | None = None
    university_registration_number: str | None = None
    current_phase: str | None = None
    current_semester: int | None = None
    batch_id: UUID | None = None
    status: str | None = None
    is_hosteler: bool | None = None


class StudentResponse(BaseModel):
    id: UUID
    college_id: UUID
    name: str
    email: str | None = None
    phone: str | None = None
    date_of_birth: date | None = None
    gender: str | None = None
    blood_group: str | None = None
    nationality: str | None = None
    category: str | None = None
    photo_url: str | None = None
    father_name: str | None = None
    mother_name: str | None = None
    neet_roll_number: str | None = None
    neet_score: int | None = None
    neet_rank: int | None = None
    neet_percentile: float | None = None
    admission_quota: str | None = None
    counseling_round: str | None = None
    admission_date: date | None = None
    admission_year: int | None = None
    enrollment_number: str | None = None
    university_registration_number: str | None = None
    current_phase: str | None = None
    current_semester: int | None = None
    batch_id: UUID | None = None
    status: str
    is_hosteler: bool | None = None
    nmc_uploaded: bool | None = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class StudentListResponse(PaginatedResponse):
    data: list[StudentResponse]


# ===================================================================
# Student Document
# ===================================================================

class StudentDocumentCreate(BaseModel):
    student_id: UUID
    document_type: str
    file_url: str | None = None
    file_name: str | None = None
    file_size: int | None = None
    mime_type: str | None = None
    is_required: bool = True


class StudentDocumentUpdate(BaseModel):
    file_url: str | None = None
    file_name: str | None = None
    verification_status: str | None = None
    rejection_reason: str | None = None


class StudentDocumentResponse(BaseModel):
    id: UUID
    college_id: UUID
    student_id: UUID
    document_type: str
    file_url: str | None = None
    file_name: str | None = None
    file_size: int | None = None
    mime_type: str | None = None
    is_required: bool
    verification_status: str
    verified_by: UUID | None = None
    verified_at: datetime | None = None
    rejection_reason: str | None = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class StudentDocumentListResponse(PaginatedResponse):
    data: list[StudentDocumentResponse]


# ===================================================================
# Faculty
# ===================================================================

class FacultyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: str | None = None
    phone: str | None = Field(default=None, pattern=r"^[6-9]\d{9}$")
    date_of_birth: date | None = None
    gender: str | None = None
    designation: str | None = None
    department_id: UUID
    qualification: str | None = None
    specialization: str | None = None
    sub_specialization: str | None = None
    nmc_faculty_id: str | None = None
    aebas_id: str | None = None
    employee_id: str | None = None
    date_of_joining: date | None = None
    retirement_date: date | None = None
    employment_type: str | None = None
    pay_scale_type: str | None = None
    teaching_experience_years: float | None = None
    clinical_experience_years: float | None = None
    total_experience_years: float | None = None
    orcid_id: str | None = None
    bcme_completed: bool | None = False
    bank_ifsc: str | None = None
    bank_name: str | None = None
    status: str | None = "active"


class FacultyUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = Field(default=None, pattern=r"^[6-9]\d{9}$")
    date_of_birth: date | None = None
    gender: str | None = None
    designation: str | None = None
    department_id: UUID | None = None
    qualification: str | None = None
    specialization: str | None = None
    sub_specialization: str | None = None
    nmc_faculty_id: str | None = None
    aebas_id: str | None = None
    employee_id: str | None = None
    date_of_joining: date | None = None
    retirement_date: date | None = None
    employment_type: str | None = None
    pay_scale_type: str | None = None
    teaching_experience_years: float | None = None
    clinical_experience_years: float | None = None
    total_experience_years: float | None = None
    qualification_validated: bool | None = None
    is_eligible_per_nmc: bool | None = None
    validation_notes: str | None = None
    orcid_id: str | None = None
    publications_count: int | None = None
    h_index: int | None = None
    bcme_completed: bool | None = None
    bank_ifsc: str | None = None
    bank_name: str | None = None
    status: str | None = None


class FacultyResponse(BaseModel):
    id: UUID
    college_id: UUID
    name: str
    email: str | None = None
    phone: str | None = None
    date_of_birth: date | None = None
    gender: str | None = None
    photo_url: str | None = None
    designation: str | None = None
    department_id: UUID
    qualification: str | None = None
    specialization: str | None = None
    sub_specialization: str | None = None
    nmc_faculty_id: str | None = None
    aebas_id: str | None = None
    employee_id: str | None = None
    date_of_joining: date | None = None
    retirement_date: date | None = None
    employment_type: str | None = None
    pay_scale_type: str | None = None
    teaching_experience_years: float | None = None
    clinical_experience_years: float | None = None
    total_experience_years: float | None = None
    qualification_validated: bool | None = None
    is_eligible_per_nmc: bool | None = None
    orcid_id: str | None = None
    publications_count: int | None = None
    h_index: int | None = None
    bcme_completed: bool | None = None
    status: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class FacultyListResponse(PaginatedResponse):
    data: list[FacultyResponse]


class FacultyCount(BaseModel):
    department_id: UUID
    professors: int = 0
    associate_professors: int = 0
    assistant_professors: int = 0
    tutors: int = 0
    senior_residents: int = 0
    total: int = 0


# ===================================================================
# Faculty Qualification
# ===================================================================

class FacultyQualificationCreate(BaseModel):
    faculty_id: UUID
    degree: str
    specialization: str | None = None
    university: str | None = None
    year_of_passing: int | None = None
    certificate_url: str | None = None
    hospital_bed_count: int | None = None
    is_highest: bool = False


class FacultyQualificationResponse(BaseModel):
    id: UUID
    college_id: UUID
    faculty_id: UUID
    degree: str
    specialization: str | None = None
    university: str | None = None
    year_of_passing: int | None = None
    certificate_url: str | None = None
    nmc_verified: bool
    hospital_bed_count: int | None = None
    is_highest: bool
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ===================================================================
# Fee Structure
# ===================================================================

class FeeStructureCreate(BaseModel):
    academic_year: str = Field(..., min_length=4, max_length=10)
    quota: str
    tuition_fee: int = Field(default=0, ge=0)
    development_fee: int = 0
    hostel_fee_boys: int = 0
    hostel_fee_girls: int = 0
    hostel_fee: int = 0
    mess_fee: int = 0
    examination_fee: int = 0
    exam_fee: int = 0
    library_fee: int = 0
    laboratory_fee: int = 0
    lab_fee: int = 0
    caution_deposit: int = 0
    admission_charges: int = 0
    university_registration_fee: int = 0
    insurance_premium: int = 0
    identity_card_fee: int = 0
    other_fees: int = 0
    other_fees_description: str | None = None
    fee_regulatory_cap: int | None = None
    approved_by: str | None = None
    approval_date: date | None = None
    installment_config: list | None = None
    late_fee_per_day: int = 0
    grace_period_days: int = 15


class FeeStructureUpdate(BaseModel):
    academic_year: str | None = None
    quota: str | None = None
    tuition_fee: int | None = None
    development_fee: int | None = None
    hostel_fee_boys: int | None = None
    hostel_fee_girls: int | None = None
    mess_fee: int | None = None
    examination_fee: int | None = None
    library_fee: int | None = None
    laboratory_fee: int | None = None
    caution_deposit: int | None = None
    admission_charges: int | None = None
    other_fees: int | None = None
    fee_regulatory_cap: int | None = None
    approved_by: str | None = None
    installment_config: list | None = None
    late_fee_per_day: int | None = None
    grace_period_days: int | None = None
    is_active: bool | None = None


class FeeStructureResponse(BaseModel):
    id: UUID
    college_id: UUID
    academic_year: str
    quota: str
    tuition_fee: int
    development_fee: int | None = None
    hostel_fee_boys: int | None = None
    hostel_fee_girls: int | None = None
    hostel_fee: int | None = None
    mess_fee: int | None = None
    examination_fee: int | None = None
    exam_fee: int | None = None
    library_fee: int | None = None
    laboratory_fee: int | None = None
    lab_fee: int | None = None
    caution_deposit: int | None = None
    admission_charges: int | None = None
    fee_regulatory_cap: int | None = None
    approved_by: str | None = None
    installment_config: list | None = None
    late_fee_per_day: int | None = None
    grace_period_days: int | None = None
    is_active: bool | None = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class FeeStructureListResponse(PaginatedResponse):
    data: list[FeeStructureResponse]


# ===================================================================
# Fee Payment
# ===================================================================

class FeePaymentCreate(BaseModel):
    student_id: UUID
    fee_structure_id: UUID | None = None
    academic_year: str | None = None
    semester: int | None = None
    installment_number: int | None = None
    amount: int = Field(..., gt=0)
    payment_method: str | None = None
    razorpay_payment_id: str | None = None
    razorpay_order_id: str | None = None
    reference_number: str | None = None
    bank_name: str | None = None
    payment_date: date | None = None
    fee_component: str | None = None
    fee_breakdown: dict | None = None
    notes: str | None = None


class FeePaymentUpdate(BaseModel):
    status: str | None = None
    payment_method: str | None = None
    reference_number: str | None = None
    bank_name: str | None = None
    payment_date: date | None = None
    notes: str | None = None


class FeePaymentResponse(BaseModel):
    id: UUID
    college_id: UUID
    student_id: UUID
    fee_structure_id: UUID | None = None
    academic_year: str | None = None
    semester: int | None = None
    installment_number: int | None = None
    amount: int
    payment_method: str | None = None
    razorpay_payment_id: str | None = None
    reference_number: str | None = None
    bank_name: str | None = None
    payment_date: date | None = None
    fee_component: str | None = None
    fee_breakdown: dict | None = None
    receipt_number: str | None = None
    receipt_url: str | None = None
    status: str
    late_fee_amount: int | None = None
    late_fee_days: int | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class FeePaymentListResponse(PaginatedResponse):
    data: list[FeePaymentResponse]


# ===================================================================
# Fee Refund
# ===================================================================

class FeeRefundCreate(BaseModel):
    student_id: UUID
    original_payment_id: UUID | None = None
    reason: str | None = None
    original_amount_paid: int
    refund_amount: int
    deductions: int = 0
    deduction_breakdown: dict | None = None
    bank_account_number_last4: str | None = None
    bank_ifsc: str | None = None
    bank_name: str | None = None
    account_holder_name: str | None = None
    expected_completion_date: date | None = None
    notes: str | None = None


class FeeRefundUpdate(BaseModel):
    status: str | None = None
    rejection_reason: str | None = None
    neft_reference: str | None = None
    notes: str | None = None


class FeeRefundResponse(BaseModel):
    id: UUID
    college_id: UUID
    student_id: UUID
    original_payment_id: UUID | None = None
    reason: str | None = None
    original_amount_paid: int
    refund_amount: int
    deductions: int | None = None
    status: str
    neft_reference: str | None = None
    expected_completion_date: date | None = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class FeeRefundListResponse(PaginatedResponse):
    data: list[FeeRefundResponse]


# ===================================================================
# Scholarship Scheme
# ===================================================================

class ScholarshipSchemeCreate(BaseModel):
    name: str
    awarding_body: str | None = None
    scheme_code: str | None = None
    eligible_categories: list | None = None
    income_ceiling: int | None = None
    merit_criteria: str | None = None
    eligible_states: list | None = None
    amount_per_year: int | None = None
    amount_description: str | None = None
    covers_components: list | None = None
    application_portal: str | None = None
    portal_url: str | None = None
    application_window_start: date | None = None
    application_window_end: date | None = None
    renewal_required: bool = True
    renewal_criteria: str | None = None
    academic_year: str | None = None


class ScholarshipSchemeResponse(BaseModel):
    id: UUID
    name: str
    awarding_body: str | None = None
    scheme_code: str | None = None
    eligible_categories: list | None = None
    income_ceiling: int | None = None
    merit_criteria: str | None = None
    eligible_states: list | None = None
    amount_per_year: int | None = None
    amount_description: str | None = None
    covers_components: list | None = None
    application_portal: str | None = None
    portal_url: str | None = None
    renewal_required: bool
    is_active: bool
    academic_year: str | None = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ScholarshipSchemeListResponse(PaginatedResponse):
    data: list[ScholarshipSchemeResponse]


# ===================================================================
# Student Scholarship
# ===================================================================

class StudentScholarshipCreate(BaseModel):
    student_id: UUID
    scheme_id: UUID
    academic_year: str | None = None
    application_status: str = "matched"


class StudentScholarshipUpdate(BaseModel):
    application_status: str | None = None
    application_id: str | None = None
    sanctioned_amount: int | None = None
    disbursed_amount: int | None = None
    disbursement_date: date | None = None
    dbt_status: str | None = None
    rejection_reason: str | None = None
    notes: str | None = None


class StudentScholarshipResponse(BaseModel):
    id: UUID
    college_id: UUID
    student_id: UUID
    scheme_id: UUID
    academic_year: str | None = None
    application_status: str
    application_id: str | None = None
    sanctioned_amount: int | None = None
    disbursed_amount: int | None = None
    disbursement_date: date | None = None
    dbt_status: str | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class StudentScholarshipListResponse(PaginatedResponse):
    data: list[StudentScholarshipResponse]


# ===================================================================
# Payroll
# ===================================================================

class PayrollRecordCreate(BaseModel):
    faculty_id: UUID
    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=2000, le=2100)


class PayrollRecordResponse(BaseModel):
    id: UUID
    college_id: UUID
    faculty_id: UUID
    month: int
    year: int
    basic_pay: int
    dearness_allowance: int
    house_rent_allowance: int
    non_practicing_allowance: int
    transport_allowance: int
    gross_earnings: int
    epf_employee: int
    esi_employee: int
    tds: int
    professional_tax: int
    total_deductions: int
    net_pay: int
    status: str
    approved_by: UUID | None = None
    approved_at: datetime | None = None
    disbursed_at: datetime | None = None
    bank_file_generated: bool
    pay_slip_url: str | None = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class PayrollRecordListResponse(PaginatedResponse):
    data: list[PayrollRecordResponse]


class SalaryStructureCreate(BaseModel):
    designation: str
    pay_scale_type: str
    pay_level: int | None = None
    pay_band_min: int | None = None
    pay_band_max: int | None = None
    basic_pay: int | None = None
    da_percentage: float = 55.0
    hra_percentage: float = 24.0
    npa_percentage: float = 20.0
    transport_allowance: int = 360000


class SalaryStructureUpdate(BaseModel):
    designation: str | None = None
    pay_scale_type: str | None = None
    pay_level: int | None = None
    basic_pay: int | None = None
    da_percentage: float | None = None
    hra_percentage: float | None = None
    npa_percentage: float | None = None
    transport_allowance: int | None = None
    is_active: bool | None = None


class SalaryStructureResponse(BaseModel):
    id: UUID
    college_id: UUID
    designation: str
    pay_scale_type: str
    pay_level: int | None = None
    basic_pay: int | None = None
    da_percentage: float
    hra_percentage: float
    npa_percentage: float
    transport_allowance: int
    is_active: bool | None = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class SalaryStructureListResponse(PaginatedResponse):
    data: list[SalaryStructureResponse]


# ===================================================================
# Leave
# ===================================================================

class LeavePolicyCreate(BaseModel):
    staff_category: str
    leave_type: str
    annual_entitlement: int | None = None
    max_accumulation: int | None = None
    can_carry_forward: bool = False
    requires_document: bool = False
    min_service_for_eligibility: int = 0


class LeavePolicyResponse(BaseModel):
    id: UUID
    college_id: UUID
    staff_category: str
    leave_type: str
    annual_entitlement: int | None = None
    max_accumulation: int | None = None
    can_carry_forward: bool
    requires_document: bool
    min_service_for_eligibility: int
    is_active: bool | None = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class LeavePolicyListResponse(PaginatedResponse):
    data: list[LeavePolicyResponse]


class LeaveRequestCreate(BaseModel):
    employee_id: UUID
    employee_type: str | None = None
    leave_type: str
    from_date: date
    to_date: date
    days: float = Field(..., gt=0)
    reason: str | None = None
    supporting_document_url: str | None = None


class LeaveRequestUpdate(BaseModel):
    status: str | None = None
    rejection_reason: str | None = None


class LeaveRequestResponse(BaseModel):
    id: UUID
    college_id: UUID
    employee_id: UUID
    employee_type: str | None = None
    leave_type: str
    from_date: date
    to_date: date
    days: float
    reason: str | None = None
    current_approver_id: UUID | None = None
    approval_chain: list | None = None
    status: str
    rejection_reason: str | None = None
    escalated: bool
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class LeaveRequestListResponse(PaginatedResponse):
    data: list[LeaveRequestResponse]


class LeaveBalanceResponse(BaseModel):
    id: UUID
    college_id: UUID
    employee_id: UUID
    employee_type: str | None = None
    leave_type: str
    academic_year: str
    entitled: float
    taken: float
    pending: float
    balance: float
    carried_forward: float
    model_config = ConfigDict(from_attributes=True)


class LeaveBalanceListResponse(PaginatedResponse):
    data: list[LeaveBalanceResponse]


# ===================================================================
# Recruitment
# ===================================================================

class RecruitmentPositionCreate(BaseModel):
    department_id: UUID
    designation: str
    specialization_required: str | None = None
    qualification_required: str | None = None
    experience_required_years: float | None = None
    vacancies: int = 1
    priority: str = "medium"
    msr_impact: bool = False
    job_description: str | None = None
    salary_range_min: int | None = None
    salary_range_max: int | None = None
    deadline: date | None = None


class RecruitmentPositionUpdate(BaseModel):
    designation: str | None = None
    vacancies: int | None = None
    priority: str | None = None
    status: str | None = None
    deadline: date | None = None


class RecruitmentPositionResponse(BaseModel):
    id: UUID
    college_id: UUID
    department_id: UUID
    designation: str
    specialization_required: str | None = None
    qualification_required: str | None = None
    experience_required_years: float | None = None
    vacancies: int
    priority: str
    msr_impact: bool
    status: str
    posted_date: date | None = None
    deadline: date | None = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class RecruitmentPositionListResponse(PaginatedResponse):
    data: list[RecruitmentPositionResponse]


class RecruitmentCandidateCreate(BaseModel):
    position_id: UUID
    name: str
    email: str | None = None
    phone: str | None = None
    current_organization: str | None = None
    current_designation: str | None = None
    qualification: str | None = None
    specialization: str | None = None
    experience_years: float | None = None
    resume_url: str | None = None


class RecruitmentCandidateUpdate(BaseModel):
    pipeline_stage: str | None = None
    interview_date: datetime | None = None
    interview_notes: str | None = None
    nmc_eligible: bool | None = None
    offer_amount: int | None = None
    offer_date: date | None = None
    joining_date: date | None = None
    rejection_reason: str | None = None


class RecruitmentCandidateResponse(BaseModel):
    id: UUID
    college_id: UUID
    position_id: UUID
    name: str
    email: str | None = None
    phone: str | None = None
    current_organization: str | None = None
    qualification: str | None = None
    specialization: str | None = None
    experience_years: float | None = None
    nmc_eligible: bool | None = None
    pipeline_stage: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class RecruitmentCandidateListResponse(PaginatedResponse):
    data: list[RecruitmentCandidateResponse]


# ===================================================================
# Certificate
# ===================================================================

class CertificateCreate(BaseModel):
    student_id: UUID
    certificate_type: str
    purpose: str | None = None
    purpose_detail: str | None = None


class CertificateResponse(BaseModel):
    id: UUID
    college_id: UUID
    student_id: UUID
    certificate_type: str
    certificate_number: str | None = None
    purpose: str | None = None
    qr_verification_url: str | None = None
    file_url: str | None = None
    status: str
    issued_date: date | None = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class CertificateListResponse(PaginatedResponse):
    data: list[CertificateResponse]


# ===================================================================
# Alumni
# ===================================================================

class AlumniCreate(BaseModel):
    student_id: UUID | None = None
    name: str
    graduation_year: int | None = None
    batch: str | None = None
    email: str | None = None
    phone: str | None = None
    current_position: str | None = None
    current_organization: str | None = None
    current_location_city: str | None = None
    current_location_state: str | None = None
    current_location_country: str = "India"
    pg_qualification: str | None = None
    pg_specialization: str | None = None
    employment_type: str | None = None


class AlumniUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    current_position: str | None = None
    current_organization: str | None = None
    employment_type: str | None = None
    is_active_member: bool | None = None
    notes: str | None = None


class AlumniResponse(BaseModel):
    id: UUID
    college_id: UUID
    student_id: UUID | None = None
    name: str
    graduation_year: int | None = None
    batch: str | None = None
    email: str | None = None
    phone: str | None = None
    current_position: str | None = None
    current_organization: str | None = None
    current_location_city: str | None = None
    current_location_state: str | None = None
    current_location_country: str | None = None
    pg_qualification: str | None = None
    pg_specialization: str | None = None
    employment_type: str | None = None
    is_active_member: bool
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class AlumniListResponse(PaginatedResponse):
    data: list[AlumniResponse]


# ===================================================================
# Hostel
# ===================================================================

class HostelBlockCreate(BaseModel):
    name: str
    block_type: str | None = None
    total_rooms: int = 0
    total_beds: int = 0
    floors: int = 1
    warden_faculty_id: UUID | None = None
    warden_phone: str | None = None


class HostelBlockResponse(BaseModel):
    id: UUID
    college_id: UUID
    name: str
    block_type: str | None = None
    total_rooms: int
    total_beds: int
    floors: int
    warden_faculty_id: UUID | None = None
    has_cctv: bool
    is_anti_ragging_compliant: bool
    is_active: bool | None = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class HostelBlockListResponse(PaginatedResponse):
    data: list[HostelBlockResponse]


class HostelRoomCreate(BaseModel):
    block_id: UUID
    room_number: str
    floor: int = 0
    capacity: int = 2
    room_type: str = "regular"


class HostelRoomResponse(BaseModel):
    id: UUID
    college_id: UUID
    block_id: UUID
    room_number: str
    floor: int
    capacity: int
    current_occupancy: int
    room_type: str
    status: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class HostelRoomListResponse(PaginatedResponse):
    data: list[HostelRoomResponse]


class HostelAllocationCreate(BaseModel):
    student_id: UUID
    room_id: UUID
    block_id: UUID
    academic_year: str | None = None
    check_in_date: date | None = None


class HostelAllocationResponse(BaseModel):
    id: UUID
    college_id: UUID
    student_id: UUID
    room_id: UUID
    block_id: UUID
    academic_year: str | None = None
    check_in_date: date | None = None
    check_out_date: date | None = None
    status: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class HostelAllocationListResponse(PaginatedResponse):
    data: list[HostelAllocationResponse]


class MessUnitCreate(BaseModel):
    name: str
    mess_type: str | None = None
    capacity: int | None = None
    vendor_name: str | None = None
    monthly_fee: int | None = None


class MessUnitResponse(BaseModel):
    id: UUID
    college_id: UUID
    name: str
    mess_type: str | None = None
    capacity: int | None = None
    vendor_name: str | None = None
    monthly_fee: int | None = None
    is_active: bool | None = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class MessUnitListResponse(PaginatedResponse):
    data: list[MessUnitResponse]


# ===================================================================
# Transport
# ===================================================================

class VehicleCreate(BaseModel):
    vehicle_number: str
    vehicle_type: str | None = None
    capacity: int | None = None
    make_model: str | None = None
    driver_name: str | None = None
    driver_phone: str | None = None
    insurance_expiry: date | None = None


class VehicleResponse(BaseModel):
    id: UUID
    college_id: UUID
    vehicle_number: str
    vehicle_type: str | None = None
    capacity: int | None = None
    make_model: str | None = None
    driver_name: str | None = None
    insurance_expiry: date | None = None
    fitness_certificate_expiry: date | None = None
    current_km_reading: int | None = None
    status: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class VehicleListResponse(PaginatedResponse):
    data: list[VehicleResponse]


class TransportRouteCreate(BaseModel):
    name: str
    route_type: str | None = None
    origin: str | None = None
    destination: str | None = None
    distance_km: float | None = None
    schedule: list | None = None
    vehicle_id: UUID | None = None


class TransportRouteResponse(BaseModel):
    id: UUID
    college_id: UUID
    name: str
    route_type: str | None = None
    origin: str | None = None
    destination: str | None = None
    distance_km: float | None = None
    vehicle_id: UUID | None = None
    is_active: bool | None = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class TransportRouteListResponse(PaginatedResponse):
    data: list[TransportRouteResponse]


class TransportBookingCreate(BaseModel):
    route_id: UUID | None = None
    department_id: UUID | None = None
    booking_date: date
    num_passengers: int | None = None
    purpose: str | None = None
    vehicle_id: UUID | None = None


class TransportBookingResponse(BaseModel):
    id: UUID
    college_id: UUID
    route_id: UUID | None = None
    department_id: UUID | None = None
    booking_date: date
    num_passengers: int | None = None
    purpose: str | None = None
    vehicle_id: UUID | None = None
    status: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class TransportBookingListResponse(PaginatedResponse):
    data: list[TransportBookingResponse]


class VehicleMaintenanceLogCreate(BaseModel):
    vehicle_id: UUID
    maintenance_type: str | None = None
    description: str | None = None
    cost: int | None = None
    vendor: str | None = None
    date: Optional[date] = None


class VehicleMaintenanceLogResponse(BaseModel):
    id: UUID
    college_id: UUID
    vehicle_id: UUID
    maintenance_type: str | None = None
    description: str | None = None
    cost: int | None = None
    vendor: str | None = None
    date: Optional[date] = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class VehicleMaintenanceLogListResponse(PaginatedResponse):
    data: list[VehicleMaintenanceLogResponse]


# ===================================================================
# Library
# ===================================================================

class LibraryBookCreate(BaseModel):
    title: str
    author: str | None = None
    publisher: str | None = None
    year_of_publication: int | None = None
    isbn: str | None = None
    subject: str | None = None
    department_id: UUID | None = None
    location: str | None = None
    total_copies: int = 1
    price: int | None = None


class LibraryBookUpdate(BaseModel):
    title: str | None = None
    author: str | None = None
    subject: str | None = None
    location: str | None = None
    total_copies: int | None = None
    available_copies: int | None = None
    status: str | None = None


class LibraryBookResponse(BaseModel):
    id: UUID
    college_id: UUID
    accession_number: str | None = None
    title: str
    author: str | None = None
    publisher: str | None = None
    isbn: str | None = None
    subject: str | None = None
    department_id: UUID | None = None
    total_copies: int
    available_copies: int
    status: str
    price: int | None = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class LibraryBookListResponse(PaginatedResponse):
    data: list[LibraryBookResponse]


class LibraryJournalCreate(BaseModel):
    name: str
    publisher: str | None = None
    issn: str | None = None
    journal_type: str | None = None
    indexed_in: list | None = None
    subscription_status: str = "active"
    annual_cost: int | None = None
    is_online: bool = False


class LibraryJournalResponse(BaseModel):
    id: UUID
    college_id: UUID
    name: str
    publisher: str | None = None
    issn: str | None = None
    journal_type: str | None = None
    indexed_in: list | None = None
    subscription_status: str
    annual_cost: int | None = None
    is_online: bool
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class LibraryJournalListResponse(PaginatedResponse):
    data: list[LibraryJournalResponse]


class LibraryIssuanceCreate(BaseModel):
    book_id: UUID
    borrower_id: UUID
    borrower_type: str | None = None
    issued_date: date
    due_date: date


class LibraryIssuanceResponse(BaseModel):
    id: UUID
    college_id: UUID
    book_id: UUID
    borrower_id: UUID
    borrower_type: str | None = None
    issued_date: date
    due_date: date
    returned_date: date | None = None
    fine_amount: int
    status: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class LibraryIssuanceListResponse(PaginatedResponse):
    data: list[LibraryIssuanceResponse]


# ===================================================================
# Infrastructure & Equipment
# ===================================================================

class InfrastructureCreate(BaseModel):
    name: str
    category: str | None = None
    building: str | None = None
    floor: int | None = None
    room_number: str | None = None
    area_sqm: float | None = None
    capacity: int | None = None
    department_id: UUID | None = None
    condition: str = "good"


class InfrastructureUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    capacity: int | None = None
    condition: str | None = None
    is_active: bool | None = None


class InfrastructureResponse(BaseModel):
    id: UUID
    college_id: UUID
    name: str
    category: str | None = None
    building: str | None = None
    floor: int | None = None
    room_number: str | None = None
    area_sqm: float | None = None
    capacity: int | None = None
    department_id: UUID | None = None
    has_ac: bool
    has_projector: bool
    has_smart_board: bool
    condition: str
    is_active: bool | None = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class InfrastructureListResponse(PaginatedResponse):
    data: list[InfrastructureResponse]


class EquipmentCreate(BaseModel):
    name: str
    department_id: UUID
    serial_number: str | None = None
    make_model: str | None = None
    purchase_date: date | None = None
    purchase_cost: int | None = None
    condition: str = "working"
    is_nmc_required: bool = False


class EquipmentUpdate(BaseModel):
    name: str | None = None
    condition: str | None = None
    amc_status: str | None = None
    is_nmc_required: bool | None = None
    nmc_specification_met: bool | None = None


class EquipmentResponse(BaseModel):
    id: UUID
    college_id: UUID
    name: str
    department_id: UUID
    serial_number: str | None = None
    make_model: str | None = None
    purchase_date: date | None = None
    purchase_cost: int | None = None
    amc_status: str
    condition: str
    is_nmc_required: bool
    nmc_specification_met: bool
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class EquipmentListResponse(PaginatedResponse):
    data: list[EquipmentResponse]


class MaintenanceTicketCreate(BaseModel):
    entity_type: str
    entity_id: UUID | None = None
    department_id: UUID | None = None
    description: str
    priority: str = "medium"


class MaintenanceTicketUpdate(BaseModel):
    status: str | None = None
    assigned_to: str | None = None
    resolution_description: str | None = None
    cost: int | None = None


class MaintenanceTicketResponse(BaseModel):
    id: UUID
    college_id: UUID
    ticket_number: str | None = None
    entity_type: str
    entity_id: UUID | None = None
    department_id: UUID | None = None
    description: str
    priority: str
    status: str
    assigned_to: str | None = None
    resolution_description: str | None = None
    cost: int | None = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class MaintenanceTicketListResponse(PaginatedResponse):
    data: list[MaintenanceTicketResponse]


# ===================================================================
# Notices
# ===================================================================

class NoticeCreate(BaseModel):
    title: str
    content: str
    notice_type: str | None = None
    priority: str = "normal"
    target_audience: dict | None = None
    requires_acknowledgment: bool = False
    is_pinned: bool = False
    attachments: list | None = None


class NoticeUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    priority: str | None = None
    status: str | None = None
    is_pinned: bool | None = None


class NoticeResponse(BaseModel):
    id: UUID
    college_id: UUID
    title: str
    content: str
    notice_type: str | None = None
    priority: str
    target_audience: dict | None = None
    posted_by: UUID | None = None
    posted_by_name: str | None = None
    published_at: datetime | None = None
    is_pinned: bool
    status: str
    read_count: int
    total_recipients: int
    acknowledged_count: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class NoticeListResponse(PaginatedResponse):
    data: list[NoticeResponse]


# ===================================================================
# Grievances & Committees
# ===================================================================

class CommitteeCreate(BaseModel):
    name: str
    committee_type: str | None = None
    is_nmc_mandated: bool = False
    chairperson_name: str | None = None
    chairperson_contact: str | None = None
    meeting_frequency: str | None = None


class CommitteeUpdate(BaseModel):
    name: str | None = None
    chairperson_name: str | None = None
    meeting_frequency: str | None = None
    last_meeting_date: date | None = None
    next_meeting_date: date | None = None
    status: str | None = None


class CommitteeResponse(BaseModel):
    id: UUID
    college_id: UUID
    name: str
    committee_type: str | None = None
    is_nmc_mandated: bool
    chairperson_name: str | None = None
    chairperson_contact: str | None = None
    meeting_frequency: str | None = None
    last_meeting_date: date | None = None
    next_meeting_date: date | None = None
    status: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class CommitteeListResponse(PaginatedResponse):
    data: list[CommitteeResponse]


class CommitteeMemberCreate(BaseModel):
    committee_id: UUID
    member_name: str
    member_role: str | None = None
    member_type: str | None = None
    user_id: UUID | None = None
    contact_phone: str | None = None
    contact_email: str | None = None


class CommitteeMemberResponse(BaseModel):
    id: UUID
    college_id: UUID
    committee_id: UUID
    member_name: str
    member_role: str | None = None
    member_type: str | None = None
    is_active: bool | None = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class CommitteeMemberListResponse(PaginatedResponse):
    data: list[CommitteeMemberResponse]


class CommitteeMemberUpdate(BaseModel):
    member_name: str | None = None
    member_role: str | None = None
    member_type: str | None = None
    contact_phone: str | None = None
    contact_email: str | None = None
    is_active: bool | None = None



class GrievanceCreate(BaseModel):
    is_anonymous: bool = False
    category: str
    description: str
    priority: str = "medium"


class GrievanceUpdate(BaseModel):
    assigned_committee_id: UUID | None = None
    priority: str | None = None
    status: str | None = None
    resolution_description: str | None = None


class GrievanceResponse(BaseModel):
    id: UUID
    college_id: UUID
    ticket_number: str | None = None
    filed_by: UUID | None = None
    filed_by_name: str | None = None
    is_anonymous: bool
    category: str
    assigned_committee_id: UUID | None = None
    description: str
    priority: str
    status: str
    resolution_description: str | None = None
    timeline: list | None = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class GrievanceListResponse(PaginatedResponse):
    data: list[GrievanceResponse]


# ===================================================================
# Workflows
# ===================================================================

class WorkflowDefinitionCreate(BaseModel):
    name: str
    workflow_type: str
    approval_chain: list


class WorkflowDefinitionUpdate(BaseModel):
    name: str | None = None
    approval_chain: list | None = None
    is_active: bool | None = None


class WorkflowDefinitionResponse(BaseModel):
    id: UUID
    college_id: UUID
    name: str
    workflow_type: str
    approval_chain: list
    is_active: bool | None = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class WorkflowDefinitionListResponse(PaginatedResponse):
    data: list[WorkflowDefinitionResponse]


class WorkflowInstanceCreate(BaseModel):
    definition_id: UUID | None = None
    workflow_type: str
    reference_type: str | None = None
    reference_id: UUID | None = None
    title: str | None = None
    description: str | None = None
    priority: str = "normal"
    due_date: date | None = None


class WorkflowInstanceUpdate(BaseModel):
    status: str | None = None


class WorkflowInstanceResponse(BaseModel):
    id: UUID
    college_id: UUID
    definition_id: UUID | None = None
    workflow_type: str
    reference_type: str | None = None
    reference_id: UUID | None = None
    requested_by: UUID
    requested_by_name: str | None = None
    title: str | None = None
    description: str | None = None
    current_step: int
    current_approver_id: UUID | None = None
    approval_history: list | None = None
    status: str
    priority: str
    due_date: date | None = None
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class WorkflowInstanceListResponse(PaginatedResponse):
    data: list[WorkflowInstanceResponse]


# ===================================================================
# Documents
# ===================================================================

class DocumentCreate(BaseModel):
    title: str
    category: str | None = None
    sub_category: str | None = None
    file_url: str
    file_name: str | None = None
    file_size: int | None = None
    mime_type: str | None = None
    description: str | None = None
    tags: list | None = None
    access_level: str = "admin_only"
    parent_document_id: UUID | None = None
    academic_year: str | None = None


class DocumentUpdate(BaseModel):
    title: str | None = None
    category: str | None = None
    description: str | None = None
    tags: list | None = None
    access_level: str | None = None
    is_archived: bool | None = None


class DocumentResponse(BaseModel):
    id: UUID
    college_id: UUID
    title: str
    category: str | None = None
    sub_category: str | None = None
    file_url: str
    file_name: str | None = None
    file_size: int | None = None
    mime_type: str | None = None
    uploaded_by: UUID | None = None
    uploaded_by_name: str | None = None
    description: str | None = None
    tags: list | None = None
    access_level: str
    version: int
    parent_document_id: UUID | None = None
    academic_year: str | None = None
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class DocumentListResponse(PaginatedResponse):
    data: list[DocumentResponse]


# ===================================================================
# Academic Calendar
# ===================================================================

class AcademicCalendarEventCreate(BaseModel):
    title: str
    event_type: str | None = None
    start_date: date
    end_date: date | None = None
    is_all_day: bool = True
    start_time: str | None = None
    end_time: str | None = None
    affects_phases: list | None = None
    department_id: UUID | None = None
    description: str | None = None
    academic_year: str | None = None
    is_teaching_day: bool = True


class AcademicCalendarEventUpdate(BaseModel):
    title: str | None = None
    event_type: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    description: str | None = None
    academic_year: str | None = None
    is_teaching_day: bool | None = None


class AcademicCalendarEventResponse(BaseModel):
    id: UUID
    college_id: UUID
    title: str
    event_type: str | None = None
    start_date: date
    end_date: date | None = None
    is_all_day: bool
    start_time: str | None = None
    end_time: str | None = None
    affects_phases: list | None = None
    department_id: UUID | None = None
    description: str | None = None
    academic_year: str | None = None
    is_teaching_day: bool
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class AcademicCalendarEventListResponse(PaginatedResponse):
    data: list[AcademicCalendarEventResponse]


# ===================================================================
# Timetable
# ===================================================================

class TimetableSlotCreate(BaseModel):
    academic_year: str
    phase: str
    batch_id: UUID | None = None
    day_of_week: int = Field(..., ge=0, le=6)
    start_time: str
    end_time: str
    subject: str | None = None
    department_id: UUID | None = None
    faculty_id: UUID | None = None
    session_type: str | None = None
    room_id: UUID | None = None
    room_name: str | None = None


class TimetableSlotUpdate(BaseModel):
    subject: str | None = None
    faculty_id: UUID | None = None
    session_type: str | None = None
    room_id: UUID | None = None
    room_name: str | None = None
    is_active: bool | None = None


class TimetableSlotResponse(BaseModel):
    id: UUID
    college_id: UUID
    academic_year: str
    phase: str
    batch_id: UUID | None = None
    day_of_week: int
    start_time: str
    end_time: str
    subject: str | None = None
    department_id: UUID | None = None
    faculty_id: UUID | None = None
    session_type: str | None = None
    room_id: UUID | None = None
    room_name: str | None = None
    is_active: bool | None = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class TimetableSlotListResponse(PaginatedResponse):
    data: list[TimetableSlotResponse]


# ===================================================================
# Clinical Rotations
# ===================================================================

class ClinicalRotationCreate(BaseModel):
    student_id: UUID
    department_id: UUID
    batch_id: UUID | None = None
    rotation_group: str | None = None
    phase: str | None = None
    start_date: date
    end_date: date
    required_hours: int | None = None
    supervisor_faculty_id: UUID | None = None
    is_crmi: bool = False


class ClinicalRotationUpdate(BaseModel):
    completed_hours: int | None = None
    posting_assessment_score: float | None = None
    status: str | None = None
    attendance_percentage: float | None = None


class ClinicalRotationResponse(BaseModel):
    id: UUID
    college_id: UUID
    student_id: UUID
    department_id: UUID
    batch_id: UUID | None = None
    rotation_group: str | None = None
    phase: str | None = None
    start_date: date
    end_date: date
    required_hours: int | None = None
    completed_hours: int
    supervisor_faculty_id: UUID | None = None
    posting_assessment_score: float | None = None
    status: str
    attendance_percentage: float | None = None
    is_crmi: bool
    crmi_leave_days_taken: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ClinicalRotationListResponse(PaginatedResponse):
    data: list[ClinicalRotationResponse]


# ===================================================================
# Dashboard & Aggregate Schemas
# ===================================================================

class DashboardStats(BaseModel):
    total_students: int = 0
    total_faculty: int = 0
    total_departments: int = 0
    fee_collection_total: int = 0
    fee_outstanding_total: int = 0
    pending_admissions: int = 0
    active_leave_requests: int = 0
    pending_approvals: int = 0
    msr_compliance_score: float | None = None


class FeeCollectionTrend(BaseModel):
    month: str
    collected: int
    outstanding: int


class RecentActivity(BaseModel):
    id: UUID
    action: str
    entity_type: str
    entity_id: UUID | None = None
    user_name: str | None = None
    timestamp: datetime
    details: str | None = None


class PendingApproval(BaseModel):
    id: UUID
    workflow_type: str
    title: str | None = None
    requested_by_name: str | None = None
    priority: str
    created_at: datetime


class MSRComplianceSummary(BaseModel):
    department_id: UUID
    department_name: str
    required_professors: int
    actual_professors: int
    required_associate_professors: int
    actual_associate_professors: int
    required_assistant_professors: int
    actual_assistant_professors: int
    required_tutors: int
    actual_tutors: int
    compliance_percentage: float
    status: str


class CollectionSummary(BaseModel):
    total_collected: int = 0
    total_outstanding: int = 0
    total_overdue: int = 0
    by_quota: dict | None = None


class SeatMatrixItem(BaseModel):
    quota: str
    total_seats: int
    filled_seats: int
    vacant_seats: int
    fill_percentage: float


class RetirementForecastItem(BaseModel):
    faculty_id: UUID
    faculty_name: str
    department_id: UUID
    department_name: str
    designation: str
    retirement_date: date
    years_until_retirement: float
    msr_impact: str


# ===================================================================
# Settings
# ===================================================================

class CollegeProfileResponse(BaseModel):
    id: UUID
    name: str
    code: str
    nmc_registration_number: str | None = None
    university_affiliation: str | None = None
    state: str
    district: str | None = None
    address: str | None = None
    city: str | None = None
    phone: str | None = None
    email: str | None = None
    website: str | None = None
    established_year: int | None = None
    college_type: str | None = None
    sanctioned_intake: int
    total_intake: int
    logo_url: str | None = None
    config: dict | None = None
    status: str | None = None
    model_config = ConfigDict(from_attributes=True)


class CollegeProfileUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    email: str | None = None
    website: str | None = None
    address: str | None = None
    city: str | None = None
    district: str | None = None
    logo_url: str | None = None
    config: dict | None = None


class AuditLogResponse(BaseModel):
    id: UUID
    college_id: UUID
    user_id: UUID
    action: str
    entity_type: str
    entity_id: UUID | None = None
    changes: dict | None = None
    ip_address: str | None = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class AuditLogListResponse(PaginatedResponse):
    data: list[AuditLogResponse]
