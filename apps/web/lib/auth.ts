import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

/**
 * Application roles — mirrors backend UserRole and @acolyte/shared UserRole.
 */
export type UserRole =
  | 'student'
  | 'faculty'
  | 'hod'
  | 'dean'
  | 'admin'
  | 'compliance_officer'
  | 'management';

/**
 * Typed user context for server components.
 */
export interface AppUser {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
  collegeId: string | null;
  orgSlug: string | null;
  orgRole: string | null;
  imageUrl: string | null;
}

/**
 * Clerk org_role -> application UserRole mapping.
 */
const ORG_ROLE_MAP: Record<string, UserRole> = {
  'org:student': 'student',
  'org:faculty': 'faculty',
  'org:hod': 'hod',
  'org:dean': 'dean',
  'org:admin': 'admin',
  'org:compliance_officer': 'compliance_officer',
  'org:management': 'management',
  'org:member': 'student',
  admin: 'admin',
};

/**
 * Role -> dashboard path mapping.
 */
const ROLE_DASHBOARD: Record<UserRole, string> = {
  student: '/dashboard/student',
  faculty: '/dashboard/faculty',
  hod: '/dashboard/faculty',
  dean: '/dashboard/management',
  admin: '/dashboard/admin',
  compliance_officer: '/dashboard/compliance',
  management: '/dashboard/management',
};

/**
 * Extract the application UserRole from a Clerk org_role string.
 */
export function getUserRole(orgRole: string | null | undefined): UserRole {
  if (!orgRole) return 'student';
  return ORG_ROLE_MAP[orgRole] || 'student';
}

/**
 * Get the dashboard path for a given role.
 */
export function getDashboardPath(role: UserRole): string {
  return ROLE_DASHBOARD[role];
}

/**
 * Get the current authenticated user with typed role.
 * For use in Server Components and Server Actions.
 *
 * Returns null if not authenticated.
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  const session = await auth();
  if (!session.userId) return null;

  const user = await currentUser();
  if (!user) return null;

  const orgRole = session.orgRole as string | null;
  const role = getUserRole(orgRole);

  return {
    userId: session.userId,
    email: user.emailAddresses[0]?.emailAddress || '',
    fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
    role,
    collegeId: session.orgId || null,
    orgSlug: session.orgSlug || null,
    orgRole,
    imageUrl: user.imageUrl || null,
  };
}

/**
 * Require authentication. Redirects to /sign-in if not authenticated.
 */
export async function requireAuth(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/sign-in');
  }
  return user;
}

/**
 * Require the user to have one of the specified roles.
 * Redirects to their correct dashboard if they don't have the right role.
 */
export async function requireRole(...roles: UserRole[]): Promise<AppUser> {
  const user = await requireAuth();

  if (!roles.includes(user.role)) {
    const correctPath = getDashboardPath(user.role);
    redirect(correctPath);
  }

  return user;
}

/**
 * Require the user to belong to an organization (college).
 * Redirects to /onboarding if no org is set.
 */
export async function requireOrg(): Promise<AppUser> {
  const user = await requireAuth();

  if (!user.collegeId) {
    redirect('/onboarding');
  }

  return user;
}
