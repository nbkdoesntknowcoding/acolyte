import type { AxiosInstance } from "axios";

// ---------------------------------------------------------------------------
// Types (mirrored from web types/admin.ts — keep in sync)
// ---------------------------------------------------------------------------

export interface DashboardStats {
  students: { total: number; active: number; new_this_month: number };
  faculty: { total: number; active: number };
  departments: { total: number };
  compliance_score: number;
  fee_collection: { collected: number; pending: number; total: number };
}

export interface PendingApproval {
  id: string;
  type: string;
  title: string;
  submitted_by: string;
  submitted_at: string;
  priority: string;
}

export interface RecentActivity {
  id: string;
  type: string;
  description: string;
  actor_name: string;
  timestamp: string;
}

export interface ExpiringRole {
  id: string;
  user_name: string;
  role_name: string;
  expires_at: string;
}

export interface HourlyScanVolume {
  hour: number; // 0-23
  count: number;
}

export interface StudentSummary {
  id: string;
  name: string;
  enrollment_number: string;
  current_phase: string;
  status: string;
  email?: string;
  phone?: string;
  batch?: string;
  quota?: string;
  program?: string;
}

export interface StudentDetail extends StudentSummary {
  semester?: number;
  date_of_birth?: string;
  date_of_admission?: string;
  guardian_name?: string;
  guardian_phone?: string;
  address?: string;
  neet_roll_number?: string;
  neet_score?: number;
  photo_url?: string;
}

export interface StudentFeeSummary {
  total_fee: number;
  paid: number;
  outstanding: number;
  overdue: boolean;
  last_payment_date?: string;
  last_payment_amount?: number;
}

export interface StudentAttendanceSummary {
  theory_percentage: number;
  practical_percentage: number;
  total_classes: number;
  attended_classes: number;
  nmc_threshold: number; // typically 75
}

export interface FacultySummary {
  id: string;
  name: string;
  designation: string;
  department_name?: string;
  email?: string;
  status: string;
  nmc_faculty_id?: string;
}

export interface FacultyDetail extends FacultySummary {
  qualification?: string;
  employment_type?: string; // "regular" | "contractual" | "adhoc"
  date_of_joining?: string;
  teaching_experience_years?: number;
  phone?: string;
  specialization?: string;
  photo_url?: string;
}

// ---------------------------------------------------------------------------
// Grievance types
// ---------------------------------------------------------------------------

export interface Grievance {
  id: string;
  ticket_number: string;
  category: string; // "academic" | "hostel" | "fee" | "harassment" | "infrastructure" | "other"
  description: string;
  filed_by: string;
  filed_by_id: string;
  filed_at: string;
  status: string; // "open" | "under_review" | "in_progress" | "resolved" | "closed"
  priority: string; // "low" | "medium" | "high" | "urgent"
  resolution_notes?: string;
  resolved_at?: string;
}

// ---------------------------------------------------------------------------
// Notice types
// ---------------------------------------------------------------------------

export interface Notice {
  id: string;
  title: string;
  body: string;
  priority: string; // "normal" | "important" | "urgent"
  target_audience: string; // "all" | "students" | "faculty" | "staff"
  published_at: string;
  published_by: string;
  read_count: number;
}

// ---------------------------------------------------------------------------
// MSR Compliance types
// ---------------------------------------------------------------------------

export interface MSRGap {
  department_name: string;
  gaps: { designation: string; required: number; current: number; deficit: number }[];
}

export interface FeeDefaulterSummary {
  overdue_count: number;
  overdue_30_days: number;
  overdue_60_days: number;
  total_outstanding: number;
}

export interface AttendanceAlertSummary {
  below_threshold_count: number;
  threshold: number;
}

// ---------------------------------------------------------------------------
// Workflow types
// ---------------------------------------------------------------------------

export interface WorkflowInstance {
  id: string;
  workflow_type: string; // "leave" | "certificate" | "purchase" | "transfer" | ...
  title: string;
  status: string; // "pending" | "approved" | "rejected"
  priority: string; // "low" | "medium" | "high" | "urgent"
  submitted_by: string;
  submitted_by_id: string;
  submitted_at: string;
  current_step: string;
  department_name?: string;
  phone?: string;
  metadata: Record<string, unknown>;
}

export interface LeaveRequest {
  id: string;
  faculty_id: string;
  faculty_name: string;
  department_name: string;
  designation: string;
  leave_type: string; // "casual" | "earned" | "medical" | "study" | "maternity" | "duty" | "exam"
  start_date: string;
  end_date: string;
  days: number;
  reason: string;
  status: string;
  priority: string;
  submitted_at: string;
  phone?: string;
  leave_balance: {
    type: string;
    used: number;
    total: number;
    remaining: number;
  };
  dept_impact: {
    faculty_on_leave: number;
    faculty_names: string[];
  };
}

export interface CertificateRequest {
  id: string;
  student_id: string;
  student_name: string;
  enrollment_number: string;
  current_phase: string;
  batch: string;
  certificate_type: string; // "bonafide" | "transfer" | "character" | "conduct" | "migration"
  purpose: string;
  status: string;
  submitted_at: string;
  previously_issued: number;
  phone?: string;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export const adminApi = {
  // Dashboard
  getDashboardStats: (api: AxiosInstance) =>
    api.get<DashboardStats>("/admin/dashboard/stats").then((r) => r.data),

  getPendingApprovals: (api: AxiosInstance, limit = 10) =>
    api
      .get<{ data: PendingApproval[] }>("/admin/dashboard/pending-approvals", {
        params: { limit },
      })
      .then((r) => r.data),

  getRecentActivity: (api: AxiosInstance, limit = 10) =>
    api
      .get<{ data: RecentActivity[] }>("/admin/dashboard/recent-activity", {
        params: { limit },
      })
      .then((r) => r.data),

  // Workflows
  getWorkflows: (
    api: AxiosInstance,
    params?: { status?: string; type?: string; page?: number; page_size?: number },
  ) =>
    api
      .get<{ data: WorkflowInstance[]; total: number }>("/admin/workflows/pending", {
        params,
      })
      .then((r) => r.data),

  getWorkflow: (api: AxiosInstance, id: string) =>
    api.get<WorkflowInstance>(`/admin/workflows/${id}`).then((r) => r.data),

  approveWorkflow: (api: AxiosInstance, id: string) =>
    api.post(`/admin/workflows/${id}/approve`).then((r) => r.data),

  rejectWorkflow: (api: AxiosInstance, id: string, reason?: string) =>
    api.post(`/admin/workflows/${id}/reject`, { reason }).then((r) => r.data),

  // Leave requests
  getLeaveRequests: (
    api: AxiosInstance,
    params?: { status?: string; page?: number; page_size?: number },
  ) =>
    api
      .get<{ data: LeaveRequest[]; total: number }>("/admin/leave", { params })
      .then((r) => r.data),

  getLeaveRequest: (api: AxiosInstance, id: string) =>
    api.get<LeaveRequest>(`/admin/leave/${id}`).then((r) => r.data),

  approveLeave: (api: AxiosInstance, id: string) =>
    api.post(`/admin/leave/${id}/approve`).then((r) => r.data),

  rejectLeave: (api: AxiosInstance, id: string, reason: string) =>
    api.post(`/admin/leave/${id}/reject`, { reason }).then((r) => r.data),

  // Certificate requests
  getCertificateRequests: (
    api: AxiosInstance,
    params?: { status?: string; page?: number; page_size?: number },
  ) =>
    api
      .get<{ data: CertificateRequest[]; total: number }>("/admin/certificates/requests", {
        params,
      })
      .then((r) => r.data),

  // People search
  searchStudents: (api: AxiosInstance, search: string, pageSize = 20) =>
    api
      .get<{ data: StudentSummary[] }>("/admin/students", {
        params: { search, page_size: pageSize },
      })
      .then((r) => r.data),

  getStudent: (api: AxiosInstance, id: string) =>
    api.get<StudentDetail>(`/admin/students/${id}`).then((r) => r.data),

  getStudentFees: (api: AxiosInstance, id: string) =>
    api.get<StudentFeeSummary>(`/admin/students/${id}/fee-summary`).then((r) => r.data),

  getStudentAttendance: (api: AxiosInstance, id: string) =>
    api.get<StudentAttendanceSummary>(`/admin/students/${id}/attendance-summary`).then((r) => r.data),

  searchFaculty: (api: AxiosInstance, search: string, pageSize = 20) =>
    api
      .get<{ data: FacultySummary[] }>("/admin/faculty", {
        params: { search, page_size: pageSize },
      })
      .then((r) => r.data),

  getFaculty: (api: AxiosInstance, id: string) =>
    api.get<FacultyDetail>(`/admin/faculty/${id}`).then((r) => r.data),

  // Grievances
  getGrievances: (
    api: AxiosInstance,
    params?: { status?: string; page_size?: number },
  ) =>
    api
      .get<{ data: Grievance[] }>("/admin/grievances", { params })
      .then((r) => r.data),

  getGrievance: (api: AxiosInstance, id: string) =>
    api.get<Grievance>(`/admin/grievances/${id}`).then((r) => r.data),

  updateGrievanceStatus: (
    api: AxiosInstance,
    id: string,
    status: string,
    notes?: string,
  ) =>
    api
      .patch(`/admin/grievances/${id}/status`, { status, resolution_notes: notes })
      .then((r) => r.data),

  // Notices
  getNotices: (
    api: AxiosInstance,
    params?: { status?: string; page_size?: number },
  ) =>
    api
      .get<{ data: Notice[] }>("/admin/notices", { params })
      .then((r) => r.data),

  publishNotice: (
    api: AxiosInstance,
    body: { title: string; body: string; priority: string; target_audience: string },
  ) => api.post("/admin/notices", body).then((r) => r.data),

  // Expiring role assignments
  getExpiringRoles: (api: AxiosInstance, days = 7) =>
    api
      .get<{ data: ExpiringRole[] }>("/admin/role-assignments/expiring", {
        params: { days },
      })
      .then((r) => r.data),

  // MSR Compliance
  getMSRGaps: (api: AxiosInstance) =>
    api
      .get<{ data: MSRGap[] }>("/admin/faculty/msr-compliance")
      .then((r) => r.data),

  getFeeDefaulters: (api: AxiosInstance) =>
    api
      .get<FeeDefaulterSummary>("/admin/students/fee-defaulters/summary")
      .then((r) => r.data),

  getAttendanceAlerts: (api: AxiosInstance) =>
    api
      .get<AttendanceAlertSummary>("/admin/students/attendance-alerts/summary")
      .then((r) => r.data),
};
