/**
 * Admin Engine — API Response Types
 *
 * These types mirror the backend Pydantic Response schemas EXACTLY (snake_case).
 * Used by the API client layer and query hooks.
 *
 * DO NOT confuse with types/admin.ts which has camelCase UI-oriented types
 * used by the existing mock-powered pages. As pages get wired to the backend,
 * they switch to these types.
 */

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ---------------------------------------------------------------------------
// Department
// ---------------------------------------------------------------------------

export type NMCDepartmentType = 'preclinical' | 'paraclinical' | 'clinical';

export interface DepartmentResponse {
  id: string;
  college_id: string;
  name: string;
  code: string;
  nmc_department_type: string;
  department_type: string | null;
  hod_id: string | null;
  beds: number | null;
  opd_rooms: number | null;
  labs: number | null;
  lecture_halls: number | null;
  nmc_department_code: string | null;
  is_active: boolean;
  display_order: number | null;
  established_year: number | null;
  created_at: string;
  updated_at: string;
}

export interface DepartmentCreate {
  name: string;
  code: string;
  nmc_department_type: NMCDepartmentType;
  department_type?: string | null;
  hod_id?: string | null;
  beds?: number | null;
  opd_rooms?: number | null;
  labs?: number | null;
  lecture_halls?: number | null;
  nmc_department_code?: string | null;
  display_order?: number | null;
  established_year?: number | null;
}

export interface DepartmentUpdate {
  name?: string | null;
  code?: string | null;
  nmc_department_type?: NMCDepartmentType | null;
  department_type?: string | null;
  hod_id?: string | null;
  beds?: number | null;
  opd_rooms?: number | null;
  labs?: number | null;
  lecture_halls?: number | null;
  nmc_department_code?: string | null;
  is_active?: boolean | null;
  display_order?: number | null;
  established_year?: number | null;
}

// ---------------------------------------------------------------------------
// Batch
// ---------------------------------------------------------------------------

export interface BatchResponse {
  id: string;
  college_id: string;
  name: string;
  batch_type: string | null;
  admission_year: number;
  current_phase: string | null;
  current_semester: number | null;
  phase: string | null;
  student_count: number;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface BatchCreate {
  name: string;
  batch_type?: string | null;
  admission_year: number;
  current_phase?: string | null;
  current_semester?: number | null;
  phase?: string | null;
}

export interface BatchUpdate {
  name?: string | null;
  batch_type?: string | null;
  admission_year?: number | null;
  current_phase?: string | null;
  current_semester?: number | null;
  phase?: string | null;
  student_count?: number | null;
  is_active?: boolean | null;
}

// ---------------------------------------------------------------------------
// Student
// ---------------------------------------------------------------------------

export interface StudentResponse {
  id: string;
  college_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
  blood_group: string | null;
  nationality: string | null;
  category: string | null;
  photo_url: string | null;
  father_name: string | null;
  mother_name: string | null;
  neet_roll_number: string | null;
  neet_score: number | null;
  neet_rank: number | null;
  neet_percentile: number | null;
  admission_quota: string | null;
  counseling_round: string | null;
  admission_date: string | null;
  admission_year: number | null;
  enrollment_number: string | null;
  university_registration_number: string | null;
  current_phase: string | null;
  current_semester: number | null;
  batch_id: string | null;
  status: string;
  is_hosteler: boolean | null;
  nmc_uploaded: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface StudentCreate {
  name: string;
  email?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  blood_group?: string | null;
  nationality?: string | null;
  religion?: string | null;
  category?: string | null;
  father_name?: string | null;
  mother_name?: string | null;
  guardian_phone?: string | null;
  guardian_email?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  permanent_address?: string | null;
  city?: string | null;
  state?: string | null;
  pin_code?: string | null;
  neet_roll_number?: string | null;
  neet_score?: number | null;
  neet_rank?: number | null;
  neet_percentile?: number | null;
  neet_year?: number | null;
  admission_quota?: string | null;
  counseling_round?: string | null;
  allotment_order_number?: string | null;
  admission_date?: string | null;
  admission_year?: number | null;
  class_10_board?: string | null;
  class_10_percentage?: number | null;
  class_12_board?: string | null;
  class_12_percentage?: number | null;
  pcb_percentage?: number | null;
  gap_years?: number | null;
  enrollment_number?: string | null;
  university_registration_number?: string | null;
  current_phase?: string | null;
  current_semester?: number | null;
  batch_id?: string | null;
  status?: string | null;
  is_hosteler?: boolean | null;
}

export interface StudentUpdate {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  blood_group?: string | null;
  nationality?: string | null;
  religion?: string | null;
  category?: string | null;
  father_name?: string | null;
  mother_name?: string | null;
  guardian_phone?: string | null;
  guardian_email?: string | null;
  permanent_address?: string | null;
  city?: string | null;
  state?: string | null;
  pin_code?: string | null;
  neet_score?: number | null;
  admission_quota?: string | null;
  enrollment_number?: string | null;
  university_registration_number?: string | null;
  current_phase?: string | null;
  current_semester?: number | null;
  batch_id?: string | null;
  status?: string | null;
  is_hosteler?: boolean | null;
}

// ---------------------------------------------------------------------------
// Student Document
// ---------------------------------------------------------------------------

export interface StudentDocumentResponse {
  id: string;
  college_id: string;
  student_id: string;
  document_type: string;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  is_required: boolean;
  verification_status: string;
  verified_by: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Faculty
// ---------------------------------------------------------------------------

export interface FacultyResponse {
  id: string;
  college_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
  photo_url: string | null;
  designation: string | null;
  department_id: string;
  qualification: string | null;
  specialization: string | null;
  sub_specialization: string | null;
  nmc_faculty_id: string | null;
  aebas_id: string | null;
  employee_id: string | null;
  date_of_joining: string | null;
  retirement_date: string | null;
  employment_type: string | null;
  pay_scale_type: string | null;
  teaching_experience_years: number | null;
  clinical_experience_years: number | null;
  total_experience_years: number | null;
  qualification_validated: boolean | null;
  is_eligible_per_nmc: boolean | null;
  orcid_id: string | null;
  publications_count: number | null;
  h_index: number | null;
  bcme_completed: boolean | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface FacultyCreate {
  name: string;
  email?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  designation?: string | null;
  department_id: string;
  qualification?: string | null;
  specialization?: string | null;
  sub_specialization?: string | null;
  nmc_faculty_id?: string | null;
  aebas_id?: string | null;
  employee_id?: string | null;
  date_of_joining?: string | null;
  retirement_date?: string | null;
  employment_type?: string | null;
  pay_scale_type?: string | null;
  teaching_experience_years?: number | null;
  clinical_experience_years?: number | null;
  total_experience_years?: number | null;
  orcid_id?: string | null;
  bcme_completed?: boolean | null;
  bank_ifsc?: string | null;
  bank_name?: string | null;
  status?: string | null;
}

export interface FacultyUpdate {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  designation?: string | null;
  department_id?: string | null;
  qualification?: string | null;
  specialization?: string | null;
  sub_specialization?: string | null;
  nmc_faculty_id?: string | null;
  aebas_id?: string | null;
  employee_id?: string | null;
  date_of_joining?: string | null;
  retirement_date?: string | null;
  employment_type?: string | null;
  pay_scale_type?: string | null;
  teaching_experience_years?: number | null;
  clinical_experience_years?: number | null;
  total_experience_years?: number | null;
  qualification_validated?: boolean | null;
  is_eligible_per_nmc?: boolean | null;
  validation_notes?: string | null;
  orcid_id?: string | null;
  publications_count?: number | null;
  h_index?: number | null;
  bcme_completed?: boolean | null;
  bank_ifsc?: string | null;
  bank_name?: string | null;
  status?: string | null;
}

export interface FacultyCount {
  department_id: string;
  professors: number;
  associate_professors: number;
  assistant_professors: number;
  tutors: number;
  senior_residents: number;
  total: number;
}

export interface FacultyQualificationResponse {
  id: string;
  college_id: string;
  faculty_id: string;
  degree: string;
  specialization: string | null;
  university: string | null;
  year_of_passing: number | null;
  certificate_url: string | null;
  nmc_verified: boolean;
  hospital_bed_count: number | null;
  is_highest: boolean;
  created_at: string;
  updated_at: string;
}

export interface FacultyPublicationItem {
  title: string;
  journal: string | null;
  year: number | null;
  doi: string | null;
  article_type: string | null;
  indexing: string[] | null;
  impact_factor: number | null;
  citations: number | null;
}

export interface FacultyPortfolioResponse {
  teaching_hours: number;
  subjects: string[];
  publications: FacultyPublicationItem[];
  leave_summary: Record<string, number> | null;
  qualifications: FacultyQualificationResponse[];
}

export interface NMCValidationResponse {
  eligible: boolean;
  designation_eligible: string;
  notes: string;
}

// ---------------------------------------------------------------------------
// Fee Structure
// ---------------------------------------------------------------------------

export interface FeeStructureResponse {
  id: string;
  college_id: string;
  academic_year: string;
  quota: string;
  tuition_fee: number;
  development_fee: number | null;
  hostel_fee_boys: number | null;
  hostel_fee_girls: number | null;
  hostel_fee: number | null;
  mess_fee: number | null;
  examination_fee: number | null;
  exam_fee: number | null;
  library_fee: number | null;
  laboratory_fee: number | null;
  lab_fee: number | null;
  caution_deposit: number | null;
  admission_charges: number | null;
  fee_regulatory_cap: number | null;
  approved_by: string | null;
  installment_config: unknown[] | null;
  late_fee_per_day: number | null;
  grace_period_days: number | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface FeeStructureCreate {
  academic_year: string;
  quota: string;
  tuition_fee?: number;
  development_fee?: number;
  hostel_fee_boys?: number;
  hostel_fee_girls?: number;
  hostel_fee?: number;
  mess_fee?: number;
  examination_fee?: number;
  exam_fee?: number;
  library_fee?: number;
  laboratory_fee?: number;
  lab_fee?: number;
  caution_deposit?: number;
  admission_charges?: number;
  university_registration_fee?: number;
  insurance_premium?: number;
  identity_card_fee?: number;
  other_fees?: number;
  other_fees_description?: string | null;
  fee_regulatory_cap?: number | null;
  approved_by?: string | null;
  approval_date?: string | null;
  installment_config?: unknown[] | null;
  late_fee_per_day?: number;
  grace_period_days?: number;
}

export interface FeeStructureUpdate {
  academic_year?: string;
  quota?: string;
  tuition_fee?: number;
  development_fee?: number;
  hostel_fee_boys?: number;
  hostel_fee_girls?: number;
  mess_fee?: number;
  examination_fee?: number;
  library_fee?: number;
  laboratory_fee?: number;
  caution_deposit?: number;
  admission_charges?: number;
  other_fees?: number;
  fee_regulatory_cap?: number | null;
  approved_by?: string | null;
  installment_config?: unknown[] | null;
  late_fee_per_day?: number;
  grace_period_days?: number;
  is_active?: boolean;
}

// ---------------------------------------------------------------------------
// Fee Payment
// ---------------------------------------------------------------------------

export interface FeePaymentResponse {
  id: string;
  college_id: string;
  student_id: string;
  fee_structure_id: string | null;
  academic_year: string | null;
  semester: number | null;
  installment_number: number | null;
  amount: number;
  payment_method: string | null;
  razorpay_payment_id: string | null;
  reference_number: string | null;
  bank_name: string | null;
  payment_date: string | null;
  fee_component: string | null;
  fee_breakdown: Record<string, unknown> | null;
  receipt_number: string | null;
  receipt_url: string | null;
  status: string;
  late_fee_amount: number | null;
  late_fee_days: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeePaymentCreate {
  student_id: string;
  fee_structure_id?: string | null;
  academic_year?: string | null;
  semester?: number | null;
  installment_number?: number | null;
  amount: number;
  payment_method?: string | null;
  razorpay_payment_id?: string | null;
  razorpay_order_id?: string | null;
  reference_number?: string | null;
  bank_name?: string | null;
  payment_date?: string | null;
  fee_component?: string | null;
  fee_breakdown?: Record<string, unknown> | null;
  notes?: string | null;
}

// ---------------------------------------------------------------------------
// Fee Collection Summary
// ---------------------------------------------------------------------------

export interface CollectionQuotaSummary {
  quota: string;
  student_count: number;
  total_expected: number;
  total_collected: number;
  outstanding: number;
  collection_percentage: number;
}

export interface CollectionSummaryResponse {
  academic_year: string;
  quotas: CollectionQuotaSummary[];
  grand_total_expected: number;
  grand_total_collected: number;
}

// ---------------------------------------------------------------------------
// Fee Trend
// ---------------------------------------------------------------------------

export interface FeeTrendPoint {
  month: number;
  year: number;
  amount: number;
  count: number;
}

// ---------------------------------------------------------------------------
// Fee Refund
// ---------------------------------------------------------------------------

export interface FeeRefundResponse {
  id: string;
  college_id: string;
  student_id: string;
  original_payment_id: string | null;
  reason: string | null;
  original_amount_paid: number;
  refund_amount: number;
  deductions: number | null;
  deduction_breakdown: Record<string, unknown> | null;
  bank_account_number_last4: string | null;
  bank_ifsc: string | null;
  bank_name: string | null;
  account_holder_name: string | null;
  status: 'requested' | 'approved' | 'processing' | 'completed' | 'rejected';
  approved_by: string | null;
  approved_at: string | null;
  processed_at: string | null;
  neft_reference: string | null;
  rejection_reason: string | null;
  expected_completion_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Scholarship
// ---------------------------------------------------------------------------

export interface ScholarshipSchemeResponse {
  id: string;
  name: string;
  awarding_body: string | null;
  scheme_code: string | null;
  eligible_categories: unknown[] | null;
  income_ceiling: number | null;
  merit_criteria: string | null;
  eligible_states: unknown[] | null;
  amount_per_year: number | null;
  amount_description: string | null;
  covers_components: unknown[] | null;
  application_portal: string | null;
  portal_url: string | null;
  renewal_required: boolean;
  is_active: boolean;
  academic_year: string | null;
  created_at: string;
}

export interface StudentScholarshipResponse {
  id: string;
  college_id: string;
  student_id: string;
  scheme_id: string;
  academic_year: string | null;
  application_status: string;
  application_id: string | null;
  sanctioned_amount: number | null;
  disbursed_amount: number | null;
  disbursement_date: string | null;
  dbt_status: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudentScholarshipUpdate {
  application_status?: string | null;
  application_id?: string | null;
  sanctioned_amount?: number | null;
  disbursed_amount?: number | null;
  disbursement_date?: string | null;
  dbt_status?: string | null;
  rejection_reason?: string | null;
  notes?: string | null;
}

// ---------------------------------------------------------------------------
// Scholarship — Auto-Match
// ---------------------------------------------------------------------------

export interface AutoMatchResponse {
  students_processed: number;
  total_matches: number;
  students_with_matches: number;
  details: {
    student_id: string;
    student_name: string;
    enrollment_number: string | null;
    matches: number;
  }[];
}

// ---------------------------------------------------------------------------
// Scholarship — Matched Schemes
// ---------------------------------------------------------------------------

export interface MatchedSchemeItem {
  scheme_id: string;
  scheme_name: string;
  awarding_body: string | null;
  amount_per_year: number | null;
  amount_description: string | null;
  covers_components: unknown[] | null;
  application_portal: string | null;
  portal_url: string | null;
  match_reasons: string[];
  already_applied: boolean;
}

// ---------------------------------------------------------------------------
// Scholarship — Disbursement Summary
// ---------------------------------------------------------------------------

export interface DisbursementSchemeItem {
  scheme_name: string;
  total_applications: number;
  disbursed_count: number;
  total_disbursed: number;
  total_sanctioned: number;
  pending_amount: number;
}

export interface DisbursementSummaryResponse {
  schemes: DisbursementSchemeItem[];
  grand_total_disbursed: number;
  grand_total_sanctioned: number;
  grand_total_pending: number;
}

// ---------------------------------------------------------------------------
// Payroll
// ---------------------------------------------------------------------------

export interface PayrollRecordResponse {
  id: string;
  college_id: string;
  faculty_id: string;
  month: number;
  year: number;
  basic_pay: number;
  dearness_allowance: number;
  house_rent_allowance: number;
  non_practicing_allowance: number;
  transport_allowance: number;
  gross_earnings: number;
  epf_employee: number;
  esi_employee: number;
  tds: number;
  professional_tax: number;
  total_deductions: number;
  net_pay: number;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  disbursed_at: string | null;
  bank_file_generated: boolean;
  pay_slip_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalaryStructureResponse {
  id: string;
  college_id: string;
  designation: string;
  pay_scale_type: string;
  pay_level: number | null;
  basic_pay: number | null;
  da_percentage: number;
  hra_percentage: number;
  npa_percentage: number;
  transport_allowance: number;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface StatutorySummaryResponse {
  month: number;
  year: number;
  employee_count: number;
  total_gross: number;
  total_net: number;
  statutory: {
    epf_employee: number;
    epf_employer: number;
    epf_total: number;
    esi_employee: number;
    esi_employer: number;
    esi_total: number;
    tds: number;
    professional_tax: number;
  };
}

export interface PayrollCalculateResponse {
  month: number;
  year: number;
  processed: number;
  errors: number;
  records: {
    faculty_id: string;
    faculty_name: string;
    designation: string;
    pay_scale_type: string;
    basic_pay: number;
    dearness_allowance: number;
    house_rent_allowance: number;
    non_practicing_allowance: number;
    transport_allowance: number;
    gross_earnings: number;
    epf_employee: number;
    epf_employer: number;
    esi_employee: number;
    esi_employer: number;
    tds: number;
    professional_tax: number;
    total_deductions: number;
    net_pay: number;
  }[];
  error_details: {
    faculty_id: string;
    faculty_name: string;
    error: string;
  }[];
  saved_record_ids?: string[];
}

export interface PayrollApproveResponse {
  month: number;
  year: number;
  approved_count: number;
  approved_at: string;
}

export interface BankFileResponse {
  month: number;
  year: number;
  transfer_count: number;
  total_amount: number;
  transfers: {
    beneficiary_name: string;
    account_number: string;
    ifsc: string;
    bank_name: string;
    amount: number;
    employee_id: string;
    narration: string;
  }[];
}

// ---------------------------------------------------------------------------
// Leave
// ---------------------------------------------------------------------------

export interface LeavePolicyResponse {
  id: string;
  college_id: string;
  staff_category: string;
  leave_type: string;
  annual_entitlement: number | null;
  max_accumulation: number | null;
  can_carry_forward: boolean;
  requires_document: boolean;
  min_service_for_eligibility: number;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface LeaveRequestResponse {
  id: string;
  college_id: string;
  employee_id: string;
  employee_type: string | null;
  leave_type: string;
  from_date: string;
  to_date: string;
  days: number;
  reason: string | null;
  current_approver_id: string | null;
  approval_chain: unknown[] | null;
  status: string;
  rejection_reason: string | null;
  escalated: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeaveBalanceResponse {
  id: string;
  college_id: string;
  employee_id: string;
  employee_type: string | null;
  leave_type: string;
  academic_year: string;
  entitled: number;
  taken: number;
  pending: number;
  balance: number;
  carried_forward: number;
}

// ---------------------------------------------------------------------------
// Recruitment
// ---------------------------------------------------------------------------

export interface RecruitmentPositionResponse {
  id: string;
  college_id: string;
  department_id: string;
  designation: string;
  specialization_required: string | null;
  qualification_required: string | null;
  experience_required_years: number | null;
  vacancies: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  msr_impact: boolean;
  job_description: string | null;
  salary_range_min: number | null;
  salary_range_max: number | null;
  status: 'draft' | 'open' | 'screening' | 'interview' | 'offered' | 'filled' | 'cancelled';
  posted_date: string | null;
  deadline: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecruitmentCandidateResponse {
  id: string;
  college_id: string;
  position_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  current_organization: string | null;
  current_designation: string | null;
  qualification: string | null;
  specialization: string | null;
  experience_years: number | null;
  publications_count: number;
  resume_url: string | null;
  nmc_eligible: boolean | null;
  nmc_eligibility_notes: string | null;
  pipeline_stage: 'applied' | 'screening' | 'nmc_check' | 'interview' | 'offer' | 'joined' | 'rejected';
  interview_date: string | null;
  interview_notes: string | null;
  offer_amount: number | null;
  offer_date: string | null;
  joining_date: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Certificate
// ---------------------------------------------------------------------------

export interface CertificateResponse {
  id: string;
  college_id: string;
  student_id: string;
  certificate_type: string;
  certificate_number: string | null;
  purpose: string | null;
  qr_verification_url: string | null;
  file_url: string | null;
  status: string;
  issued_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface CertificateCreate {
  student_id: string;
  certificate_type: string;
  purpose?: string | null;
  purpose_detail?: string | null;
}

export interface CertificateRevokeRequest {
  revocation_reason: string;
}

export interface CertificateVerifyResponse {
  valid: boolean;
  certificate_type?: string;
  status?: string;
  issued_date?: string | null;
  student_name?: string;
  college_name?: string;
  signed_by?: string;
  revoked_date?: string | null;
  revocation_reason?: string | null;
}

// ---------------------------------------------------------------------------
// Alumni
// ---------------------------------------------------------------------------

export interface AlumniResponse {
  id: string;
  college_id: string;
  student_id: string | null;
  name: string;
  graduation_year: number | null;
  batch: string | null;
  email: string | null;
  phone: string | null;
  current_position: string | null;
  current_organization: string | null;
  current_location_city: string | null;
  current_location_state: string | null;
  current_location_country: string | null;
  pg_qualification: string | null;
  pg_specialization: string | null;
  employment_type: string | null;
  is_active_member: boolean;
  created_at: string;
  updated_at: string;
}

export interface AlumniCreate {
  student_id?: string | null;
  name: string;
  graduation_year?: number | null;
  batch?: string | null;
  email?: string | null;
  phone?: string | null;
  current_position?: string | null;
  current_organization?: string | null;
  current_location_city?: string | null;
  current_location_state?: string | null;
  current_location_country?: string;
  pg_qualification?: string | null;
  pg_specialization?: string | null;
  employment_type?: string | null;
}

export interface AlumniUpdate {
  name?: string;
  email?: string | null;
  phone?: string | null;
  current_position?: string | null;
  current_organization?: string | null;
  employment_type?: string | null;
  is_active_member?: boolean;
  notes?: string | null;
}

// ---------------------------------------------------------------------------
// Hostel
// ---------------------------------------------------------------------------

export interface HostelBlockResponse {
  id: string;
  college_id: string;
  name: string;
  block_type: string | null;
  total_rooms: number;
  total_beds: number;
  floors: number;
  warden_faculty_id: string | null;
  has_cctv: boolean;
  is_anti_ragging_compliant: boolean;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface HostelRoomResponse {
  id: string;
  college_id: string;
  block_id: string;
  room_number: string;
  floor: number;
  capacity: number;
  current_occupancy: number;
  room_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface HostelAllocationResponse {
  id: string;
  college_id: string;
  student_id: string;
  room_id: string;
  block_id: string;
  academic_year: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface MessUnitResponse {
  id: string;
  college_id: string;
  name: string;
  mess_type: string | null;
  capacity: number | null;
  vendor_name: string | null;
  monthly_fee: number | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface OccupancySummaryItem {
  block_id: string;
  block_name: string;
  total_beds: number;
  occupied: number;
  available: number;
  occupancy_percentage: number;
}

export interface AllocateRequest {
  student_id: string;
  room_id: string;
  block_id: string;
  academic_year?: string | null;
  check_in_date?: string | null;
}

export interface NMCHostelComplianceResponse {
  compliant: boolean;
  capacity: number;
  required: number;
  message: string;
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

export interface VehicleResponse {
  id: string;
  college_id: string;
  vehicle_number: string;
  vehicle_type: string | null;
  capacity: number | null;
  make_model: string | null;
  driver_name: string | null;
  insurance_expiry: string | null;
  fitness_certificate_expiry: string | null;
  current_km_reading: number | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface TransportRouteResponse {
  id: string;
  college_id: string;
  name: string;
  route_type: string | null;
  origin: string | null;
  destination: string | null;
  distance_km: number | null;
  vehicle_id: string | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface TransportBookingResponse {
  id: string;
  college_id: string;
  route_id: string | null;
  department_id: string | null;
  booking_date: string;
  num_passengers: number | null;
  purpose: string | null;
  vehicle_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface VehicleMaintenanceLogResponse {
  id: string;
  college_id: string;
  vehicle_id: string;
  maintenance_type: string | null;
  description: string | null;
  cost: number | null;
  vendor: string | null;
  date: string | null;
  created_at: string;
  updated_at: string;
}

export interface VehicleCreate {
  vehicle_number: string;
  vehicle_type?: string | null;
  capacity?: number | null;
  make_model?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  insurance_expiry?: string | null;
}

export interface TransportRouteCreate {
  name: string;
  route_type?: string | null;
  origin?: string | null;
  destination?: string | null;
  distance_km?: number | null;
  schedule?: unknown[] | null;
  vehicle_id?: string | null;
}

export interface TransportBookingCreate {
  booking_date: string;
  route_id?: string | null;
  department_id?: string | null;
  num_passengers?: number | null;
  purpose?: string | null;
  vehicle_id?: string | null;
  departure_time?: string | null;
}

export interface VehicleMaintenanceLogCreate {
  vehicle_id: string;
  maintenance_type?: string | null;
  description?: string | null;
  cost?: number | null;
  vendor?: string | null;
  date?: string | null;
}

// ---------------------------------------------------------------------------
// Library
// ---------------------------------------------------------------------------

export interface LibraryBookResponse {
  id: string;
  college_id: string;
  accession_number: string | null;
  title: string;
  author: string | null;
  publisher: string | null;
  isbn: string | null;
  subject: string | null;
  department_id: string | null;
  total_copies: number;
  available_copies: number;
  status: string;
  price: number | null;
  created_at: string;
  updated_at: string;
}

export interface LibraryJournalResponse {
  id: string;
  college_id: string;
  name: string;
  publisher: string | null;
  issn: string | null;
  journal_type: string | null;
  indexed_in: unknown[] | null;
  subscription_status: string;
  annual_cost: number | null;
  is_online: boolean;
  created_at: string;
  updated_at: string;
}

export interface LibraryIssuanceResponse {
  id: string;
  college_id: string;
  book_id: string;
  borrower_id: string;
  borrower_type: string | null;
  issued_date: string;
  due_date: string;
  returned_date: string | null;
  fine_amount: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface IssueBookRequest {
  book_id: string;
  borrower_id: string;
  borrower_type?: string | null;
  issued_date?: string | null;
  due_date?: string | null;
}

export interface ReturnBookRequest {
  issuance_id: string;
  returned_date?: string | null;
}

export interface ReturnBookResponse {
  issuance: LibraryIssuanceResponse;
  fine_amount: number;
  overdue_days: number;
}

export interface NMCLibraryComplianceResponse {
  books: {
    total: number;
    required: number;
  };
  indian_journals: {
    total: number;
    required: number;
  };
  foreign_journals: {
    total: number;
    required: number;
  };
  e_library: boolean;
}

// ---------------------------------------------------------------------------
// Infrastructure & Equipment
// ---------------------------------------------------------------------------

export interface InfrastructureResponse {
  id: string;
  college_id: string;
  name: string;
  category: string | null;
  building: string | null;
  floor: number | null;
  room_number: string | null;
  area_sqm: number | null;
  capacity: number | null;
  department_id: string | null;
  has_ac: boolean;
  has_projector: boolean;
  has_smart_board: boolean;
  condition: string;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface EquipmentResponse {
  id: string;
  college_id: string;
  name: string;
  department_id: string;
  serial_number: string | null;
  make_model: string | null;
  purchase_date: string | null;
  purchase_cost: number | null;
  amc_status: string;
  amc_vendor: string | null;
  amc_start_date: string | null;
  amc_end_date: string | null;
  amc_annual_cost: number | null;
  condition: string;
  is_nmc_required: boolean;
  nmc_specification_met: boolean;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceTicketResponse {
  id: string;
  college_id: string;
  ticket_number: string | null;
  entity_type: string;
  entity_id: string | null;
  department_id: string | null;
  description: string;
  priority: string;
  status: string;
  assigned_to: string | null;
  resolution_description: string | null;
  cost: number | null;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceTicketCreate {
  entity_type: string;
  entity_id?: string | null;
  department_id?: string | null;
  description: string;
  priority: string;
}

// ---------------------------------------------------------------------------
// Notices
// ---------------------------------------------------------------------------

export interface NoticeResponse {
  id: string;
  college_id: string;
  title: string;
  content: string;
  notice_type: string | null;
  priority: string;
  target_audience: Record<string, unknown> | null;
  posted_by: string | null;
  posted_by_name: string | null;
  delivery_channels: unknown[] | null;
  requires_acknowledgment: boolean;
  published_at: string | null;
  expires_at: string | null;
  is_pinned: boolean;
  attachments: unknown[] | null;
  status: string;
  read_count: number;
  total_recipients: number;
  acknowledged_count: number;
  created_at: string;
  updated_at: string;
}

export interface NoticeCreate {
  title: string;
  content: string;
  notice_type?: string | null;
  priority?: string;
  target_audience?: Record<string, unknown> | null;
  delivery_channels?: unknown[] | null;
  requires_acknowledgment?: boolean;
  is_pinned?: boolean;
  attachments?: unknown[] | null;
}

export interface NoticeAnalyticsResponse {
  read_count: number;
  total_recipients: number;
  acknowledged_count: number;
  read_by_role: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Committees & Grievances
// ---------------------------------------------------------------------------

export interface CommitteeResponse {
  id: string;
  college_id: string;
  name: string;
  committee_type: string | null;
  is_nmc_mandated: boolean;
  chairperson_name: string | null;
  chairperson_contact: string | null;
  meeting_frequency: string | null;
  last_meeting_date: string | null;
  next_meeting_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CommitteeMemberResponse {
  id: string;
  college_id: string;
  committee_id: string;
  member_name: string;
  member_role: string | null;
  member_type: string | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface GrievanceResponse {
  id: string;
  college_id: string;
  ticket_number: string | null;
  filed_by: string | null;
  filed_by_name: string | null;
  filed_by_role: string | null;
  is_anonymous: boolean;
  category: string;
  assigned_committee_id: string | null;
  description: string;
  evidence_urls: unknown[] | null;
  priority: string;
  status: string;
  resolution_description: string | null;
  resolution_date: string | null;
  resolved_by: string | null;
  timeline: unknown[] | null;
  created_at: string;
  updated_at: string;
}

export interface GrievanceCreate {
  is_anonymous?: boolean;
  category: string;
  description: string;
  priority?: string;
}

export interface GrievanceUpdate {
  assigned_committee_id?: string | null;
  priority?: string | null;
  status?: string | null;
  resolution_description?: string | null;
}

// ---------------------------------------------------------------------------
// Workflows
// ---------------------------------------------------------------------------

export interface WorkflowDefinitionResponse {
  id: string;
  college_id: string;
  name: string;
  workflow_type: string;
  approval_chain: unknown[];
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowInstanceResponse {
  id: string;
  college_id: string;
  definition_id: string | null;
  workflow_type: string;
  reference_type: string | null;
  reference_id: string | null;
  requested_by: string;
  requested_by_name: string | null;
  title: string | null;
  description: string | null;
  current_step: number;
  current_approver_id: string | null;
  approval_history: unknown[] | null;
  status: string;
  priority: string;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowInstanceCreate {
  definition_id?: string | null;
  workflow_type: string;
  reference_type?: string | null;
  reference_id?: string | null;
  title?: string | null;
  description?: string | null;
  priority?: string;
  due_date?: string | null;
}

export interface WorkflowApproveRequest {
  comment?: string | null;
}

export interface WorkflowRejectRequest {
  reason: string;
}

export interface WorkflowStatsResponse {
  pending: number;
  approved_this_month: number;
  rejected_this_month: number;
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export interface DocumentResponse {
  id: string;
  college_id: string;
  title: string;
  category: string | null;
  sub_category: string | null;
  file_url: string;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  description: string | null;
  tags: unknown[] | null;
  access_level: string;
  version: number;
  parent_document_id: string | null;
  academic_year: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface DocumentCreate {
  title: string;
  category?: string | null;
  sub_category?: string | null;
  file_url: string;
  file_name?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  description?: string | null;
  tags?: unknown[] | null;
  access_level?: string;
  parent_document_id?: string | null;
  academic_year?: string | null;
}

export interface DocumentUpdate {
  title?: string;
  category?: string | null;
  description?: string | null;
  tags?: unknown[] | null;
  access_level?: string | null;
  is_archived?: boolean;
}

// ---------------------------------------------------------------------------
// Academic Calendar
// ---------------------------------------------------------------------------

export interface AcademicCalendarEventResponse {
  id: string;
  college_id: string;
  title: string;
  event_type: string | null;
  start_date: string;
  end_date: string | null;
  is_all_day: boolean;
  start_time: string | null;
  end_time: string | null;
  affects_phases: unknown[] | null;
  department_id: string | null;
  description: string | null;
  academic_year: string | null;
  is_teaching_day: boolean;
  created_at: string;
  updated_at: string;
}

export interface AcademicCalendarEventCreate {
  title: string;
  event_type?: string | null;
  start_date: string;
  end_date?: string | null;
  is_all_day?: boolean;
  start_time?: string | null;
  end_time?: string | null;
  affects_phases?: string[] | null;
  department_id?: string | null;
  description?: string | null;
  academic_year?: string | null;
  is_teaching_day?: boolean;
}

export interface AcademicCalendarEventUpdate {
  title?: string | null;
  event_type?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  description?: string | null;
  academic_year?: string | null;
  is_teaching_day?: boolean | null;
}

// ---------------------------------------------------------------------------
// Timetable
// ---------------------------------------------------------------------------

export interface TimetableSlotResponse {
  id: string;
  college_id: string;
  academic_year: string;
  phase: string;
  batch_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject: string | null;
  department_id: string | null;
  faculty_id: string | null;
  session_type: string | null;
  room_id: string | null;
  room_name: string | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface TimetableSlotCreate {
  academic_year: string;
  phase: string;
  batch_id?: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject?: string | null;
  department_id?: string | null;
  faculty_id?: string | null;
  session_type?: string | null;
  room_id?: string | null;
  room_name?: string | null;
}

export interface TimetableSlotUpdate {
  subject?: string | null;
  faculty_id?: string | null;
  session_type?: string | null;
  room_id?: string | null;
  room_name?: string | null;
  is_active?: boolean | null;
}

// ---------------------------------------------------------------------------
// Clinical Rotations
// ---------------------------------------------------------------------------

export interface ClinicalRotationResponse {
  id: string;
  college_id: string;
  student_id: string;
  department_id: string;
  batch_id: string | null;
  rotation_group: string | null;
  phase: string | null;
  start_date: string;
  end_date: string;
  required_hours: number | null;
  completed_hours: number;
  supervisor_faculty_id: string | null;
  posting_assessment_score: number | null;
  status: string;
  attendance_percentage: number | null;
  is_crmi: boolean;
  crmi_leave_days_taken: number;
  created_at: string;
  updated_at: string;
}

export interface RotationMatrixResponse {
  student_rotations: Record<string, ClinicalRotationResponse[]>;
  total_students: number;
}

export interface RotationGenerateRequest {
  phase: string;
  batch_id?: string | null;
}

export interface RotationGenerateResponse {
  created_count: number;
}

export interface NMCValidationIssue {
  department: string;
  required_hours: number;
  scheduled_hours: number;
}

export interface NMCValidationResponse {
  valid: boolean;
  issues: NMCValidationIssue[];
}

// ---------------------------------------------------------------------------
// Admissions Analytics
// ---------------------------------------------------------------------------

export interface PipelineStageItem {
  status: string;
  count: number;
  percentage: number;
}

export interface PipelineResponse {
  stages: PipelineStageItem[];
  total: number;
}

export interface CounselingRoundItem {
  counseling_round: string;
  count: number;
  percentage: number;
}

export interface CounselingRoundsResponse {
  rounds: CounselingRoundItem[];
  total: number;
}

export interface QuotaBreakdownItem {
  status: string;
  count: number;
}

export interface QuotaAnalysisItem {
  quota: string;
  total: number;
  breakdown: QuotaBreakdownItem[];
}

export interface QuotaAnalysisResponse {
  quotas: QuotaAnalysisItem[];
  grand_total: number;
}

// ---------------------------------------------------------------------------
// Dashboard & Aggregates
// ---------------------------------------------------------------------------

export interface DashboardStats {
  total_students: number;
  total_faculty: number;
  total_departments: number;
  fee_collection_total: number;
  fee_outstanding_total: number;
  pending_admissions: number;
  active_leave_requests: number;
  pending_approvals: number;
  msr_compliance_score: number | null;
}

export interface FeeCollectionTrend {
  month: string;
  collected: number;
  outstanding: number;
}

export interface RecentActivity {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  user_name: string | null;
  timestamp: string;
  details: string | null;
}

export interface PendingApproval {
  id: string;
  workflow_type: string;
  title: string | null;
  requested_by_name: string | null;
  priority: string;
  created_at: string;
}

export interface MSRComplianceSummary {
  department_id: string;
  department_name: string;
  required_professors: number;
  actual_professors: number;
  required_associate_professors: number;
  actual_associate_professors: number;
  required_assistant_professors: number;
  actual_assistant_professors: number;
  required_tutors: number;
  actual_tutors: number;
  compliance_percentage: number;
  status: string;
}

export interface CollectionSummary {
  total_collected: number;
  total_outstanding: number;
  total_overdue: number;
  by_quota: Record<string, unknown> | null;
}

export interface SeatMatrixItem {
  quota: string;
  total_seats: number;
  filled_seats: number;
  vacant_seats: number;
  fill_percentage: number;
}

export interface SeatMatrixResponse {
  academic_year: string;
  annual_intake: number;
  quotas: SeatMatrixItem[];
  total_sanctioned: number;
  total_filled: number;
  total_vacant: number;
}

export interface PipelineSummary {
  applied: number;
  documents_submitted: number;
  under_verification: number;
  fee_pending: number;
  enrolled: number;
  active: number;
  total: number;
}

export interface RetirementForecastItem {
  faculty_id: string;
  faculty_name: string;
  department_id: string;
  department_name: string;
  department_code: string;
  designation: string;
  retirement_date: string;
  days_until_retirement: number;
  years_until_retirement: number;
  specialization: string | null;
  msr_impact: string;
}

export interface RetirementYearlySummary {
  year: string;
  retiring_count: number;
  departments_affected: string[];
}

export interface RetirementForecastResponse {
  forecast_years: number;
  total_retiring: number;
  yearly_summary: RetirementYearlySummary[];
  retirements: RetirementForecastItem[];
}

export interface MSRDepartmentStatus {
  department_id: string;
  department_name: string;
  department_code: string;
  required: number;
  actual: number;
  gap: number;
  is_compliant: boolean;
  compliance_percentage: number;
}

export interface MSRComplianceResponse {
  overall_compliance_percentage: number;
  severity: string;
  total_required: number;
  total_actual: number;
  total_gap: number;
  compliant_departments: number;
  non_compliant_departments: number;
  departments: MSRDepartmentStatus[];
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface CollegeProfileResponse {
  id: string;
  name: string;
  code: string;
  nmc_registration_number: string | null;
  university_affiliation: string | null;
  state: string;
  district: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  established_year: number | null;
  college_type: string | null;
  sanctioned_intake: number;
  total_intake: number;
  logo_url: string | null;
  config: Record<string, unknown> | null;
  status: string | null;
}

export interface CollegeProfileUpdate {
  name?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  district?: string;
  logo_url?: string;
  config?: Record<string, unknown>;
}

export interface AuditLogResponse {
  id: string;
  college_id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  changes: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Executive Dashboard
// ---------------------------------------------------------------------------

export interface AcademicYearRevenue {
  academic_year: string;
  total_captured: number;
  total_pending: number;
  total_failed: number;
  total_refunded: number;
  payment_count: number;
}

export interface FinancialOverviewResponse {
  years: AcademicYearRevenue[];
  grand_total_captured: number;
  grand_total_pending: number;
  grand_total_outstanding: number;
}

export interface ComplianceHeatmapResponse {
  departments: string[];
  categories: string[];
  data: Record<string, unknown>[];
}

export interface ActionItemsResponse {
  overdue_fees_count: number;
  msr_gaps_count: number;
  pending_approvals_count: number;
  expiring_documents_count: number;
  faculty_retiring_soon_count: number;
}

// ---------------------------------------------------------------------------
// Recruitment (Create / Update)
// ---------------------------------------------------------------------------

export interface RecruitmentPositionCreate {
  department_id: string;
  designation: string;
  specialization_required?: string;
  qualification_required?: string;
  experience_required_years?: number;
  vacancies?: number;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  msr_impact?: boolean;
  job_description?: string;
  salary_range_min?: number;
  salary_range_max?: number;
  deadline?: string;
}

export interface RecruitmentPositionUpdate {
  designation?: string;
  vacancies?: number;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  status?: 'draft' | 'open' | 'screening' | 'interview' | 'offered' | 'filled' | 'cancelled';
  deadline?: string;
}

export interface RecruitmentCandidateCreate {
  position_id: string;
  name: string;
  email?: string;
  phone?: string;
  current_organization?: string;
  current_designation?: string;
  qualification?: string;
  specialization?: string;
  experience_years?: number;
  resume_url?: string;
}

export interface RecruitmentCandidateUpdate {
  pipeline_stage?: 'applied' | 'screening' | 'nmc_check' | 'interview' | 'offer' | 'joined' | 'rejected';
  interview_date?: string;
  interview_notes?: string;
  nmc_eligible?: boolean;
  nmc_eligibility_notes?: string;
  offer_amount?: number;
  offer_date?: string;
  joining_date?: string;
  rejection_reason?: string;
}

// ---------------------------------------------------------------------------
// Fee Refund (Create / Update)
// ---------------------------------------------------------------------------

export interface FeeRefundCreate {
  student_id: string;
  original_payment_id?: string;
  reason?: 'withdrawal' | 'seat_upgrade' | 'excess_payment' | 'caution_deposit_return' | 'mcc_round_exit' | 'state_counseling_exit' | 'other';
  original_amount_paid: number;
  refund_amount: number;
  deductions?: number;
  deduction_breakdown?: Record<string, unknown>;
  bank_account_number_last4?: string;
  bank_ifsc?: string;
  bank_name?: string;
  account_holder_name?: string;
  expected_completion_date?: string;
  notes?: string;
}

export interface FeeRefundUpdate {
  status?: 'requested' | 'approved' | 'processing' | 'completed' | 'rejected';
  rejection_reason?: string;
  neft_reference?: string;
  notes?: string;
}
