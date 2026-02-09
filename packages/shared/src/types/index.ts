// ============================================================
// Acolyte Shared Types — Used across web, mobile, and backend
// ============================================================

/** User roles in the Acolyte platform */
export enum UserRole {
  STUDENT = 'student',
  FACULTY = 'faculty',
  HOD = 'hod',
  DEAN = 'dean',
  ADMIN = 'admin',
  COMPLIANCE_OFFICER = 'compliance_officer',
  MANAGEMENT = 'management',
}

/** Dashboard route mapping per role */
export const ROLE_DASHBOARD_ROUTES: Record<UserRole, string> = {
  [UserRole.STUDENT]: '/student',
  [UserRole.FACULTY]: '/faculty',
  [UserRole.HOD]: '/faculty',
  [UserRole.DEAN]: '/management',
  [UserRole.ADMIN]: '/admin',
  [UserRole.COMPLIANCE_OFFICER]: '/compliance',
  [UserRole.MANAGEMENT]: '/management',
};

/** Base API response envelope */
export interface ApiResponse<T> {
  data: T;
  message?: string;
  timestamp: string;
}

/** Paginated response */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/** Error response from API */
export interface ApiError {
  detail: string;
  code: string;
  timestamp: string;
}

/** Authenticated user context */
export interface UserContext {
  id: string;
  clerk_user_id: string;
  email: string;
  name: string;
  role: UserRole;
  college_id: string;
  department_id?: string;
}

/** College (tenant) info */
export interface College {
  id: string;
  name: string;
  code: string;
  state: string;
  total_intake: number;
  nmc_recognition_status: string;
}

/** MBBS phases */
export enum MBBSPhase {
  PHASE_I = 'Phase I',
  PHASE_II = 'Phase II',
  PHASE_III = 'Phase III',
  CRMI = 'CRMI',
}

/** Bloom's taxonomy levels */
export enum BloomsLevel {
  REMEMBER = 'Remember',
  UNDERSTAND = 'Understand',
  APPLY = 'Apply',
  ANALYZE = 'Analyze',
  EVALUATE = 'Evaluate',
  CREATE = 'Create',
}

/** NMC competency knowledge levels */
export enum CompetencyLevel {
  K = 'K',
  KH = 'KH',
  S = 'S',
  SH = 'SH',
  P = 'P',
}

/** Compliance risk levels */
export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}
