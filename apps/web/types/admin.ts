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
  | "logbook"
  | "campus_activity";

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

// ---------------------------------------------------------------------------
// Scholarship Management
// ---------------------------------------------------------------------------

export type SchemeStatus = "open" | "closing_soon" | "pending" | "closed";

export interface ScholarshipScheme {
  id: string;
  name: string;
  provider: string;
  status: SchemeStatus;
  eligibilityCriteria: string;
  amount: string;
  deadline: string;
  deadlineColor?: "default" | "red";
  appliedCount: number;
}

export interface PortalSyncStatus {
  portal: string;
  status: string;
  color: "emerald" | "orange" | "red" | "gray";
}

export interface ScholarshipStudentEntry {
  id: string;
  name: string;
  initials: string;
  initialsColor: string;
  enrollmentNo: string;
  category: string;
  categoryTag?: string;
  income: string;
  matchedSchemes: number;
  portalStatuses: PortalSyncStatus[];
}

// ---------------------------------------------------------------------------
// Faculty Roster & MSR Compliance
// ---------------------------------------------------------------------------

export type FacultyRosterStatus = "active" | "on_leave" | "notice_period";

export interface DepartmentMSRStatus {
  name: string;
  required: number;
  actual: number;
}

export interface FacultyRosterEntry {
  id: string;
  name: string;
  initials: string;
  initialsColor: string;
  gender: "Male" | "Female";
  employmentType: "Regular" | "Contractual" | "Visiting";
  designation: string;
  designationColor: string;
  department: string;
  qualification: string;
  aebasId: string;
  nmcId: string;
  dateOfJoining: string;
  retirementCountdown: string;
  retirementUrgent: boolean;
  attendancePct: number;
  status: FacultyRosterStatus;
}

export interface RetirementCountdownEntry {
  id: string;
  name: string;
  initials: string;
  initialsColor: string;
  designation: string;
  department: string;
  countdown: string;
  msrImpact: boolean;
}

// ---------------------------------------------------------------------------
// Faculty Profile — Detail View
// ---------------------------------------------------------------------------

export type FacultyProfileTab =
  | "personal"
  | "qualifications"
  | "publications"
  | "teaching";

export interface FacultyProfileData {
  id: string;
  name: string;
  initials: string;
  designation: string;
  department: string;
  qualification: string;
  email: string;
  phone: string;
  empId: string;
  status: "active" | "on_leave" | "notice_period";
  employmentType: "Regular" | "Contractual" | "Visiting";
  teachingExp: string;
  publications: number;
  hIndex: number;
  aebasAttendance: number;
}

export interface FacultyBasicInfo {
  fullName: string;
  dob: string;
  gender: string;
  maritalStatus: string;
  fatherName: string;
  nationality: string;
  address: string;
}

export interface FacultyServiceDetails {
  dateOfJoining: string;
  designationAtJoining: string;
  employmentType: string;
  retirementDate: string;
  retirementCountdown: string;
  lastPromotionDate: string;
}

export interface FacultyRegistrationId {
  label: string;
  value: string;
  subLabel?: string;
  verified: boolean;
  locked?: boolean;
}

export interface FacultyEmergencyContact {
  name: string;
  initials: string;
  relation: string;
  phone: string;
}

export interface FacultyDocumentItem {
  name: string;
  size: string;
  type: "pdf" | "image";
}

export interface AcademicQualification {
  id: string;
  degree: string;
  regNo?: string;
  university: string;
  year: string;
  specialization: string;
  nmcVerified: boolean;
}

export interface QualificationCertificate {
  id: string;
  name: string;
  size: string;
  uploadDate: string;
  type: "pdf" | "image";
}

export interface NMCRuleCheckItem {
  title: string;
  description: string;
  status: "passed" | "pending";
}

export interface FacultyPublication {
  id: string;
  title: string;
  articleType: string;
  articleTypeColor: string;
  doi?: string;
  journal: string;
  volume: string;
  indexing: { label: string; color: string }[];
  impactFactor: string;
  citations: number;
}

export interface ResearchCoAuthor {
  name: string;
  initials: string;
  department: string;
}

export interface TeachingLoadDay {
  day: string;
  heightPct: number;
  lectures: string;
  isLecture: boolean;
}

export interface AssignedBatch {
  id: string;
  subject: string;
  batch: string;
  studentCount: string;
  type: "Theory" | "Practical" | "Clinical";
  typeColor: string;
  iconColor: string;
  iconBg: string;
}

export type FacultyAttendanceDayStatus =
  | "present"
  | "absent"
  | "leave"
  | "on_duty"
  | "holiday";

// ---------------------------------------------------------------------------
// Payroll Management
// ---------------------------------------------------------------------------

export interface PayScaleEntry {
  level: string;
  designation: string;
  payBand: string;
  gradePay: string;
  daPct: string;
  hraPct: string;
  npaPct: string;
  basicEntry: string;
}

export interface StatutoryDeduction {
  code: string;
  label: string;
  dueDay: string;
  amount: string;
  subLabel: string;
  iconColor: string;
  iconBg: string;
}

export type PayrollStatus = "pending" | "processed" | "paid" | "hold";

export interface PayrollLedgerEntry {
  id: string;
  name: string;
  initials: string;
  initialsColor: string;
  designation: string;
  department: string;
  basicPay: string;
  da: string;
  hra: string;
  npa: string;
  grossEarnings: string;
  epf: string;
  tds: string;
  pt: string;
  netPay: string;
  status: PayrollStatus;
}

export type PayrollPipelineStep = "calculate" | "approve" | "bank_file" | "pay_slips";

// ---------------------------------------------------------------------------
// Leave Management
// ---------------------------------------------------------------------------

export type LeaveType =
  | "casual"
  | "earned"
  | "medical"
  | "study"
  | "maternity"
  | "duty"
  | "exam"
  | "sabbatical";

export type LeaveRequestStatus =
  | "pending_hod"
  | "pending_dean"
  | "pending_hr"
  | "approved"
  | "rejected";

export interface LeaveCalendarEvent {
  label: string;
  leaveTypeCode: string;
  color: string;
}

export interface LeaveCalendarDay {
  day: number | null;
  isCurrentMonth: boolean;
  isToday?: boolean;
  events: LeaveCalendarEvent[];
}

export interface ApprovalChainStep {
  label: string;
  approved: boolean;
}

export interface LeaveRequestEntry {
  id: string;
  name: string;
  initials: string;
  initialsColor: string;
  department: string;
  designation: string;
  leaveType: string;
  leaveTypeColor: string;
  dates: string;
  days: number;
  reason: string;
  approvalChain: ApprovalChainStep[];
  status: LeaveRequestStatus;
  statusLabel: string;
}

export interface DepartmentLeaveCard {
  name: string;
  onLeave: number;
  total: number;
  msrStatus: "ok" | "risk";
  pct: number;
}

export interface ApprovalQueueItem {
  id: string;
  name: string;
  initials: string;
  leaveType: string;
  leaveTypeColor: string;
  borderColor: string;
  days: number;
  timeAgo: string;
  waitingMessage?: string;
}

export interface LeaveEntitlementRow {
  code: string;
  days: number | null;
  color: string;
}

// ---------------------------------------------------------------------------
// Department Management
// ---------------------------------------------------------------------------

export interface DepartmentGridCard {
  id: string;
  name: string;
  iconKey: string;
  hodName: string;
  msrStatus: "compliant" | "at_risk" | "non_compliant";
  facultyCurrent: number;
  facultyRequired: number;
  students?: number;
  bedOccupied?: number;
  bedTotal?: number;
  teachingHoursCurrent: number;
  teachingHoursTotal: number;
}

// ---------------------------------------------------------------------------
// Faculty Recruitment
// ---------------------------------------------------------------------------

export interface RecruitmentPosition {
  id: string;
  title: string;
  department: string;
  priority: "critical" | "high" | "medium" | "active";
  qualification: string;
  applicants: { initials: string; color: string }[];
  overflow: number;
  totalApplicants: number;
}

export interface RecruitmentApplicant {
  id: string;
  name: string;
  initials: string;
  initialsColor: string;
  department: string;
  subtitle?: string;
  tags?: string[];
  timeAgo?: string;
  warningLabel?: string;
  scheduleBadge?: string;
  statusNote?: string;
  aiMatchPct?: number;
  nmcChecks?: { label: string; value: string; passed: boolean }[];
  clarificationNote?: string;
  onboardedNote?: string;
}

export interface RecruitmentKanbanColumn {
  id: string;
  title: string;
  count: number;
  dotColor: string;
  highlighted?: boolean;
  cards: RecruitmentApplicant[];
}

// ---------------------------------------------------------------------------
// Academic Timetable Management
// ---------------------------------------------------------------------------

export type TimetableSessionType =
  | "Lec"
  | "SGD"
  | "Prac"
  | "Dissec"
  | "Hist"
  | "Tut"
  | "Field"
  | "Ext";

export interface TimetableSession {
  department: string;
  departmentShort: string;
  topic: string;
  faculty: string;
  room: string;
  sessionType: TimetableSessionType;
  colorKey: string;
  hasConflict?: boolean;
  conflictMessage?: string;
}

export interface TimetableClinicalBlock {
  title: string;
  timeRange: string;
  batches: string[];
}

export interface UnassignedSlotItem {
  id: string;
  department: string;
  colorKey: string;
  topic: string;
  sessionType: TimetableSessionType;
  duration: string;
}

export interface RoomAvailabilityItem {
  name: string;
  isOccupied: boolean;
}

export interface FacultyWeeklyLoad {
  name: string;
  department: string;
  currentHours: number;
  maxHours: number;
  barColor: string;
}

// ---------------------------------------------------------------------------
// Academic Calendar Management
// ---------------------------------------------------------------------------

export type AcademicCalendarDayState =
  | "normal"
  | "semester_start"
  | "semester"
  | "exam_start"
  | "exam"
  | "holiday"
  | "nmc"
  | "today";

export interface AcademicCalendarDay {
  day: number | null;
  state: AcademicCalendarDayState;
  tooltip?: string;
}

export interface AcademicCalendarEvent {
  id: string;
  date: string;
  name: string;
  typeBadge: string;
  typeBadgeClasses: string;
  phases: { label: string; classes: string }[];
}

export interface KeyDateItem {
  title: string;
  statusLabel: string;
  statusClasses: string;
  borderColor: string;
  date: string;
  subNote?: string;
}

// ---------------------------------------------------------------------------
// Clinical Rotation Scheduler
// ---------------------------------------------------------------------------

export interface RotationBlock {
  department: string;
  supervisor: string;
  colorKey: string;
  spanWeeks: number;
}

export interface RotationGroup {
  name: string;
  studentCount: number;
  blocks: RotationBlock[];
}

export interface RotationStatusRow {
  group: string;
  department: string;
  deptColorClass: string;
  supervisor: string;
  dates: string;
  currentHours: number;
  totalHours: number;
  pct: number;
  status: "on_track" | "lagging" | "behind";
}

// ---------------------------------------------------------------------------
// Hostel & Mess Management
// ---------------------------------------------------------------------------

export type HostelRoomStatus = "occupied" | "available" | "maintenance";

export interface HostelRoom {
  number: string;
  status: HostelRoomStatus;
  tooltip?: string;
}

export interface HostelBlock {
  id: string;
  name: string;
}

export interface HostelAllocationRow {
  roomNo: string;
  block: string;
  occupants: { name: string; program: string }[];
  status: HostelRoomStatus;
}

export interface MessMealCount {
  id: string;
  meal: string;
  menu: string;
  count: number | null;
  status: "consumed" | "live" | "upcoming";
}

export interface DutyRosterEntry {
  shift: string;
  warden: string;
  contact: string;
}

// ---------------------------------------------------------------------------
// Transport & Fleet Management
// ---------------------------------------------------------------------------

export type VehicleStatus = "active" | "idle" | "maintenance";

export interface TransportRoute {
  id: string;
  title: string;
  description: string;
  iconKey: string;
  badge: string;
  details: { label: string; value: string }[];
}

export interface VehicleFleetRow {
  id: string;
  vehicleNo: string;
  type: string;
  capacity: string;
  currentRoute: string | null;
  driver: string;
  status: VehicleStatus;
}

export interface MaintenanceLogEntry {
  id: string;
  date: string;
  vehicle: string;
  serviceType: string;
  serviceColor: string;
  cost: string;
}

// ---------------------------------------------------------------------------
// Library Management & NMC Compliance
// ---------------------------------------------------------------------------

export interface LibraryMSRCard {
  label: string;
  value: string;
  target: string;
  pct: number;
  barColor: string;
  hoverBorder: string;
  iconKey: string;
}

export interface LibraryBookRow {
  accessionNo: string;
  title: string;
  author: string;
  subject: string;
  subjectClasses: string;
  totalCopies: number;
  availableCopies: number;
  location: string;
}

export interface LibraryReturnEntry {
  student: string;
  book: string;
  fine: string | null;
}

export interface LibraryOverdueEntry {
  name: string;
  detail: string;
}

export interface DeptLibraryProgress {
  department: string;
  current: number;
  target: number;
  barColor: string;
}

export interface AcquisitionRequest {
  id: string;
  title: string;
  requestedBy: string;
  qty: number;
  estimate: string;
  status: "pending" | "processing";
}

export interface EResourceItem {
  initial: string;
  name: string;
  accesses: string;
  trend: string;
  trendColor: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}

// ---------------------------------------------------------------------------
// Infrastructure & Equipment Tracking
// ---------------------------------------------------------------------------

export type AMCStatus = "active" | "expired" | "expiring_soon";

export interface InfrastructureCard {
  id: string;
  title: string;
  iconKey: string;
  count: number;
  unit: string;
  stats: { icon: string; label: string }[];
}

export interface EquipmentRow {
  id: string;
  name: string;
  department: string;
  serialNo: string;
  amcStatus: AMCStatus;
  amcExpiry: string;
  amcExpiryHighlight?: boolean;
  calibrationDue: string;
  calibrationHighlight?: boolean;
}

export interface MaintenanceTicket {
  id: string;
  ticketId: string;
  issue: string;
  priority: "critical" | "high" | "normal";
  status: "in_progress" | "pending" | "assigned";
}

export interface NMCChecklistItem {
  name: string;
  required: number;
  available: number;
  compliant: boolean;
}

export interface AMCCalendarDay {
  day: number;
  state: "normal" | "amc_expiring" | "calibration";
  tooltip?: string;
}

// ---------------------------------------------------------------------------
// Notices & Circulars Management
// ---------------------------------------------------------------------------

export type NoticeType = "circular" | "notice" | "order";
export type NoticePriority = "urgent" | "important" | "normal";

export interface NoticeCard {
  id: string;
  type: NoticeType;
  priority?: NoticePriority;
  title: string;
  excerpt: string;
  tags: { icon: string; label: string }[];
  author: {
    initials: string;
    role: string;
    time: string;
    avatarBg: string;
    avatarText: string;
    avatarBorder: string;
  };
  readCount: number;
  totalCount: number;
  readBarColor: string;
  pinned?: boolean;
}

export interface NMCMandatoryNotice {
  id: string;
  title: string;
  lastNotice: string;
  iconBg: string;
  iconColor: string;
  iconBorder: string;
}

// ---------------------------------------------------------------------------
// Committees & Grievance Redressal
// ---------------------------------------------------------------------------

export interface CommitteeCard {
  id: string;
  name: string;
  iconKey: string;
  iconColor: string;
  iconBg: string;
  iconBorder: string;
  badgeLabel: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  members: number;
  lastMeeting: string;
  openCases: number;
  openCasesLabel?: string;
}

export type GrievanceCategory =
  | "Harassment"
  | "Academic"
  | "Infrastructure"
  | "Ragging"
  | "Fees";

export type GrievanceStatus =
  | "investigation"
  | "resolved"
  | "received"
  | "hearing_scheduled";

export type GrievancePriority = "critical" | "high" | "medium" | "normal";

export interface GrievanceRow {
  id: string;
  ticketId: string;
  filedBy: {
    name: string;
    initials?: string;
    initialsColor?: string;
    anonymous: boolean;
  };
  category: GrievanceCategory;
  categoryColor: string;
  assignedTo: string;
  status: GrievanceStatus;
  statusLabel: string;
  statusColor: string;
  priority: GrievancePriority;
}

export interface MeetingActionEntry {
  id: string;
  title: string;
  date: string;
  description: string;
  completed: boolean;
  actions: { label: string; variant: "primary" | "secondary" }[];
}

// ---------------------------------------------------------------------------
// Approval Workflow Management
// ---------------------------------------------------------------------------

export type ApprovalPriority = "high" | "normal";

export interface ApprovalQueueCard {
  id: string;
  requester: {
    name: string;
    initials: string;
    initialsColor: string;
    department: string;
  };
  priority: ApprovalPriority;
  title: string;
  description: string;
}

export type ApprovalTab =
  | "leave"
  | "certificate"
  | "purchase_order"
  | "travel"
  | "equipment";

export type POWorkflowStepStatus = "completed" | "active" | "rejected" | "pending";

export interface POWorkflowStep {
  label: string;
  status: POWorkflowStepStatus;
}

export interface PurchaseOrderRow {
  id: string;
  requestNo: string;
  department: string;
  itemDescription: string;
  cost: string;
  budgetApproved: boolean;
  workflowSteps: POWorkflowStep[];
}

export interface WorkflowChainStep {
  step: number;
  title: string;
  description: string;
  iconKey: string;
  active: boolean;
}

export interface ApprovalBottleneck {
  label: string;
  avgDays: string;
  barColor: string;
  barPct: number;
  textColor: string;
}

// ---------------------------------------------------------------------------
// Document & Compliance Manager
// ---------------------------------------------------------------------------

export type DocumentAccessLevel = "public" | "admin_only";

export interface DocumentFolder {
  id: string;
  name: string;
  count: number;
  active?: boolean;
  children?: { id: string; name: string }[];
}

export interface DocumentRow {
  id: string;
  name: string;
  size: string;
  fileType: "pdf" | "docx";
  folder: string;
  version: string;
  accessLevel: DocumentAccessLevel;
  lastModified: string;
}

export interface InspectionCheckItem {
  label: string;
  sublabel: string;
  status: "ok" | "missing" | "pending";
}

export interface DocumentActivityEntry {
  id: string;
  time: string;
  dotColor: string;
  actor: string;
  description: string;
  linkText?: string;
}

// ---------------------------------------------------------------------------
// Executive Dean / Management Dashboard
// ---------------------------------------------------------------------------

export interface DeanKPICard {
  id: string;
  label: string;
  value: string;
  valueSuffix?: string;
  iconKey: string;
  iconColor: string;
  iconBg: string;
}

export interface FinancialBarMonth {
  month: string;
  revenuePct: number;
  expenditurePct: number;
}

export interface RevenueBreakdown {
  label: string;
  pct: number;
}

export type HeatmapRisk = "low" | "med" | "high" | "crit";

export interface HeatmapCell {
  risk: HeatmapRisk;
}

export interface HeatmapRow {
  department: string;
  faculty: HeatmapRisk;
  attendance: HeatmapRisk;
  infra: HeatmapRisk;
  material: HeatmapRisk;
  equipment: HeatmapRisk;
}

export interface DecisionCard {
  id: string;
  title: string;
  description: string;
  borderColor: string;
  badgeLabel: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  buttonLabel: string;
  buttonHoverBg: string;
}

export interface QuickActionItem {
  label: string;
  iconKey: string;
  iconColor: string;
}

export interface SystemStatusItem {
  label: string;
  status: string;
  statusColor: string;
}

// ---------------------------------------------------------------------------
// Settings — Role & Permissions
// ---------------------------------------------------------------------------

export interface RoleColumnDef {
  id: string;
  name: string;
  subtitle: string;
  badgeLabel?: string;
  badgeClasses?: string;
  isLocked: boolean;
}

export interface PermissionMatrixModule {
  id: string;
  name: string;
  description: string;
  iconKey: string;
  iconColor: string;
  iconBg: string;
  permissions: Record<string, boolean>;
}

export interface GranularAccessModule {
  id: string;
  name: string;
  iconKey: string;
  iconColor: string;
  enabled: boolean;
  dimmed: boolean;
  actions: { label: string; checked: boolean }[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Device Trust
// ═══════════════════════════════════════════════════════════════════════════

export interface DeviceInfo {
  platform: "android" | "ios";
  device_id: string;
  device_model: string;
  device_manufacturer: string;
  os_version: string;
  app_version: string;
  screen_width: number;
  screen_height: number;
  ram_mb: number;
  sim_operator: string;
  sim_country: string;
}

export interface DeviceTrust {
  id: string;
  user_id: string;
  device_fingerprint: string;
  platform: string;
  device_model: string;
  device_manufacturer: string;
  os_version: string;
  app_version: string;
  sim_operator: string;
  status: "pending_sms_verification" | "active" | "revoked" | "expired" | "transferred" | "verification_failed" | "suspended";
  claimed_phone: string;
  verified_phone: string | null;
  sms_verified: boolean;
  last_active_at: string | null;
  total_qr_scans: number;
  last_qr_scan_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeviceResetLog {
  id: string;
  user_id: string;
  device_trust_id: string;
  reset_by: string;
  reset_reason: string;
  admin_notes: string | null;
  reset_at: string;
}

export interface FlaggedUser {
  user_id: string;
  user_name: string;
  reset_count: number;
  last_reset_at: string;
  current_status: string;
}

export interface DeviceStats {
  total_registered: number;
  active_count: number;
  revoked_count: number;
  pending_count: number;
  by_platform: { android: number; ios: number };
  registrations_this_week: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// QR Engine
// ═══════════════════════════════════════════════════════════════════════════

export type QRActionType = "mess_entry" | "hostel_checkin" | "library_visit" | "library_checkout" | "library_return" | "attendance_mark" | "equipment_checkout" | "event_checkin" | "exam_hall_entry" | "transport_boarding" | "clinical_posting" | "fee_payment" | "visitor_entry" | "certificate_verify";

export type QRMode = "mode_a" | "mode_b";
export type SecurityLevel = "standard" | "elevated" | "strict";

export interface QRActionPoint {
  id: string;
  college_id: string;
  name: string;
  description: string | null;
  action_type: QRActionType;
  location_code: string;
  qr_mode: QRMode;
  building: string | null;
  floor: number | null;
  gps_latitude: number | null;
  gps_longitude: number | null;
  geo_radius_meters: number;
  qr_rotation_minutes: number;
  duplicate_window_minutes: number;
  linked_entity_type: string | null;
  linked_entity_id: string | null;
  security_level: SecurityLevel;
  active_hours_start: string | null;
  active_hours_end: string | null;
  active_days: number[];
  metadata: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface QRScanLog {
  id: string;
  college_id: string;
  user_id: string;
  user_type: string;
  device_trust_id: string | null;
  action_type: QRActionType;
  action_point_id: string;
  qr_mode: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  scan_latitude: number | null;
  scan_longitude: number | null;
  geo_validated: boolean | null;
  device_validated: boolean;
  biometric_confirmed: boolean;
  validation_result: "success" | "device_mismatch" | "expired_token" | "geo_violation" | "time_violation" | "duplicate_scan" | "revoked_device" | "unauthorized" | "invalid_qr" | "no_handler";
  rejection_reason: string | null;
  scanned_at: string;
}

export interface ScanLogSummary {
  date: string;
  action_type: string;
  success_count: number;
  failure_count: number;
  total: number;
}

export interface ActionPointStats {
  total_scans: number;
  success_rate: number;
  scans_today: number;
  scans_this_week: number;
  peak_hour: number;
  most_common_failure: string | null;
  daily_trend: { date: string; count: number }[];
}

export interface GeneratedQR {
  qr_data: string;
  qr_image_base64: string;
  action_point_name: string;
  location_code: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Dynamic Roles
// ═══════════════════════════════════════════════════════════════════════════

export type DynamicRoleType = "committee_chair" | "committee_member" | "committee_secretary" | "committee_external" | "class_representative" | "exam_invigilator" | "rotation_supervisor" | "mentor" | "duty_warden" | "event_coordinator" | "ncc_officer" | "nss_coordinator" | "sports_incharge" | "temporary_admin" | "audit_viewer";

export interface DynamicRoleAssignment {
  id: string;
  college_id: string;
  user_id: string;
  user_type: string;
  user_name: string;
  role_type: DynamicRoleType;
  context_type: string;
  context_id: string;
  context_name: string;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  assigned_by: string | null;
  assigned_by_name: string | null;
  assignment_order_url: string | null;
  permissions: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommitteeMeeting {
  id: string;
  committee_id: string;
  title: string;
  description: string | null;
  meeting_date: string;
  location: string | null;
  agenda: { item: string; presenter?: string }[];
  minutes_text: string | null;
  minutes_file_url: string | null;
  attendees: { user_id: string; name: string; present: boolean }[];
  quorum_met: boolean | null;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  created_at: string;
}

export interface CommitteeActionItem {
  id: string;
  committee_id: string;
  meeting_id: string | null;
  title: string;
  description: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  due_date: string | null;
  status: "pending" | "in_progress" | "completed" | "overdue";
  completed_at: string | null;
}
