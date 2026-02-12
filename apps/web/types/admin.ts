// ---------------------------------------------------------------------------
// Admin Engine — TypeScript Type Definitions
// ---------------------------------------------------------------------------

export interface Student {
  id: string;
  name: string;
  enrollmentNo: string;
  universityRegNo: string;
  neetScore: number;
  neetRank: number;
  admissionQuota: "AIQ" | "State" | "Management" | "NRI" | "Institutional";
  category: "General" | "SC" | "ST" | "OBC" | "EWS" | "PwD";
  currentPhase: "Phase I" | "Phase II" | "Phase III" | "CRMI";
  batch: number;
  department: string;
  status: "active" | "suspended" | "rusticated" | "graduated" | "dropped";
  feeStatus: "paid" | "due" | "partial" | "waived";
}

export interface Faculty {
  id: string;
  name: string;
  designation:
    | "Professor"
    | "Associate Professor"
    | "Assistant Professor"
    | "Tutor"
    | "Senior Resident";
  department: string;
  qualification: string;
  employmentType: "permanent" | "contractual" | "visiting" | "adjunct";
  nmcFacultyId: string;
  aebasId: string;
  dateOfJoining: string;
  retirementDate: string;
}

export interface PendingApproval {
  id: string;
  requestId: string;
  type: string;
  requesterName: string;
  requesterInitials: string;
  priority: "high" | "medium" | "low";
  createdAt: string;
}

export interface RecentAdmission {
  id: string;
  studentName: string;
  studentInitials: string;
  enrollmentNo: string;
  department: string;
  status: "active" | "pending" | "provisional";
  feeStatus: "paid" | "due" | "partial";
}

export interface DashboardStat {
  title: string;
  value: string;
  subtitle: string;
  trend?: {
    value: string;
    positive: boolean;
  };
  icon: "students" | "faculty" | "collection" | "pending";
  iconColor: string;
  iconBg: string;
}

export interface FeeCollectionMonth {
  month: string;
  actual: number;
  projected: number;
}

export interface StudentPhaseData {
  name: string;
  value: number;
  color: string;
  percentage: number;
}

// ---------------------------------------------------------------------------
// Admissions
// ---------------------------------------------------------------------------

export interface SeatQuota {
  name: string;
  sanctioned: number;
  filled: number;
  vacant: number;
  percentage: number;
  color: "emerald" | "yellow" | "red" | "blue" | "orange";
}

export interface CounselingRound {
  id: string;
  name: string;
  status: "completed" | "in_progress" | "upcoming";
  admittedCount?: number;
  processingCount?: number;
}

export type AdmissionCategory =
  | "General"
  | "OBC"
  | "OBC-NCL"
  | "SC"
  | "ST"
  | "EWS"
  | "PwD";

export type AdmissionQuota =
  | "AIQ"
  | "State"
  | "Management"
  | "NRI"
  | "Institutional";

export type PipelineStage =
  | "applied"
  | "verifying"
  | "docs_verified"
  | "fee_pending"
  | "fee_paid"
  | "enrolled";

export interface AdmissionCandidate {
  id: string;
  admissionId: string;
  name: string;
  initials: string;
  avatarUrl?: string;
  neetRoll: string;
  neetScore: number;
  neetRank: number;
  category: AdmissionCategory;
  quota: AdmissionQuota;
  pipelineStage: PipelineStage;
}

// ---------------------------------------------------------------------------
// Admission Form — Multi-Step + Document Upload
// ---------------------------------------------------------------------------

export interface AdmissionStep {
  id: string;
  label: string;
  status: "completed" | "current" | "upcoming";
}

export type DocumentUploadStatus =
  | "verified"
  | "uploaded"
  | "scan_failed"
  | "pending";

export type DocumentRequirementLevel =
  | "required"
  | "optional"
  | "if_applicable";

export interface AdmissionDocument {
  id: string;
  name: string;
  requirement: DocumentRequirementLevel;
  status: DocumentUploadStatus;
  fileName?: string;
  fileSize?: string;
  scanResult?: string;
  errorMessage?: string;
  uploadHint?: string;
}

// ---------------------------------------------------------------------------
// Student Records — List View
// ---------------------------------------------------------------------------

export type StudentQuotaLabel = "Govt" | "Mgmt" | "NRI" | "AIQ" | "Institutional";

export interface StudentRecord {
  id: string;
  name: string;
  email: string;
  initials: string;
  avatarUrl?: string;
  enrollmentNo: string;
  universityRegNo: string;
  phase: "Phase I" | "Phase II" | "Phase III" | "CRMI";
  batch: string;
  quota: StudentQuotaLabel;
  neetScore: number;
  attendancePct: number;
  feeStatus: "paid" | "partial" | "due" | "waived";
}

// ---------------------------------------------------------------------------
// Student Profile
// ---------------------------------------------------------------------------

export type ProfileTab =
  | "personal"
  | "academic"
  | "attendance"
  | "fees"
  | "documents"
  | "logbook";

export interface StudentProfile {
  id: string;
  name: string;
  avatarUrl?: string;
  enrollmentNo: string;
  universityRegNo: string;
  enrolledDate: string;
  status: "active" | "suspended" | "rusticated" | "graduated" | "dropped";
  phase: string;
  batch: string;
  section: string;
  semester?: string;
  mentorName?: string;
  email: string;
  phone: string;
  bloodGroup: string;
}

export interface PersonalInfo {
  fullName: string;
  dob: string;
  age: number;
  gender: string;
  bloodGroup: string;
  nationality: string;
  religion: string;
  category: string;
  aadharMasked: string;
}

export interface ContactInfo {
  email: string;
  emailVerified: boolean;
  phone: string;
  phoneVerified: boolean;
  permanentAddress: string;
  correspondenceAddress?: string;
}

export interface AdmissionDetail {
  label: string;
  value: string;
  highlight?: boolean;
}

export interface GuardianInfo {
  relation: "Father" | "Mother" | "Guardian";
  name: string;
  phone: string;
  occupation: string;
}

// ---------------------------------------------------------------------------
// Attendance & Fees Tab
// ---------------------------------------------------------------------------

export type AttendanceDayStatus =
  | "present"
  | "absent"
  | "late"
  | "half_day"
  | "holiday"
  | "blank";

export interface AttendanceDay {
  day: number;
  status: AttendanceDayStatus;
}

export interface AttendanceMonth {
  month: string;
  year: number;
  days: AttendanceDay[];
}

export interface AttendanceSummary {
  label: string;
  percentage: number;
  nmcRequirement: number;
  status: "safe" | "warning" | "danger";
}

export interface FeePaymentRecord {
  id: string;
  date: string;
  receiptNo: string;
  particulars: string;
  method: "UPI" | "NEFT" | "Cash" | "Card" | "DD";
  amount: number;
}

export interface OutstandingBalance {
  amount: number;
  description: string;
  dueDate: string;
  isOverdue: boolean;
}

export interface AnnualFeeSummary {
  totalFees: number;
  paidAmount: number;
  attendanceDays: number;
  totalDays: number;
}

// ---------------------------------------------------------------------------
// Certificate Management
// ---------------------------------------------------------------------------

export type CertificateType =
  | "Bonafide"
  | "Transfer Certificate"
  | "Character Certificate"
  | "Course Completion"
  | "Migration Certificate";

export type CertificateStatus = "issued" | "pending_sign" | "revoked";

export interface CertificateLogEntry {
  id: string;
  certNo: string;
  type: CertificateType;
  studentName: string;
  enrollmentNo: string;
  date: string;
  generatedBy: string;
  hasDigiSig: boolean;
  status: CertificateStatus;
}

// ---------------------------------------------------------------------------
// Alumni Management
// ---------------------------------------------------------------------------

export interface AlumniRecord {
  id: string;
  name: string;
  initials?: string;
  avatarUrl?: string;
  batch: string;
  currentPosition: string;
  organization: string;
  location: string;
  pgQualification: string;
  pgBadgeColor: "blue" | "purple" | "teal" | "emerald" | "amber";
  lastUpdated: string;
  hasEmail: boolean;
  hasPhone: boolean;
}

export interface GraduateOutcome {
  label: string;
  percentage: number;
  color: string;
}

export interface PGAdmissionTrend {
  year: string;
  percentage: number;
}

export interface AlumniEvent {
  id: string;
  month: string;
  day: number;
  title: string;
  location: string;
  time: string;
}

export interface AlumniContribution {
  id: string;
  label: string;
  sublabel: string;
  value: string;
  iconColor: string;
  iconBg: string;
}

// ---------------------------------------------------------------------------
// Fee Structure
// ---------------------------------------------------------------------------

export type FeeQuota = "aiq" | "state" | "management" | "nri" | "institutional";

export interface FeeComponent {
  id: string;
  name: string;
  sem1: number;
  sem2: number;
  annual: number;
  isRefundable: boolean;
  isOneTime: boolean;
}

export interface InstallmentRow {
  id: string;
  number: number;
  dueDate: string;
  splitPct: number;
  amount: number;
  lateFeePerDay: number;
  gracePeriod: string;
}

export interface FeeSummaryLine {
  label: string;
  amount: string;
}

// ---------------------------------------------------------------------------
// Fee Collection Dashboard
// ---------------------------------------------------------------------------

export type FeePaymentStatus = "paid_full" | "partial" | "overdue" | "defaulter";

export interface MonthlyCollectionData {
  month: string;
  upi: number;
  card: number;
  netBanking: number;
  neft: number;
  dd: number;
  cash: number;
}

export interface StudentFeeLedgerEntry {
  id: string;
  name: string;
  initials: string;
  initialsColor: string;
  enrollmentNo: string;
  quota: string;
  phase: string;
  totalFee: number;
  paid: number;
  balance: number;
  lastPayment: string | null;
  status: FeePaymentStatus;
}

// ---------------------------------------------------------------------------
// Record Fee Payment Modal
// ---------------------------------------------------------------------------

export interface OutstandingDue {
  component: string;
  total: number;
  paid: number;
  balance: number;
}

export interface PaymentAllocationItem {
  id: string;
  component: string;
  enabled: boolean;
  amount: number;
  maxAmount: number;
}
