import { useAuth, useUser, useOrganization } from '@clerk/clerk-expo';
import { useRouter, useSegments } from 'expo-router';
import { useEffect, useMemo } from 'react';

/** Application roles — mirrors backend UserRole and web auth.ts */
export type UserRole =
  | 'student'
  | 'faculty'
  | 'hod'
  | 'dean'
  | 'admin'
  | 'compliance_officer'
  | 'management';

/** Typed user context for the mobile app */
export interface MobileUser {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
  collegeId: string | null;
  orgSlug: string | null;
  orgRole: string | null;
  imageUrl: string | null;
}

/** Clerk org_role -> application UserRole mapping (same as web) */
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
 * Map a Clerk org role string to an application UserRole.
 */
export function mapOrgRole(orgRole: string | null | undefined): UserRole {
  if (!orgRole) return 'student';
  return ORG_ROLE_MAP[orgRole] || 'student';
}

/**
 * Hook that returns the authenticated user with typed role and college context.
 * Returns null if not authenticated or data is still loading.
 */
export function useAuthenticatedUser(): { user: MobileUser | null; isLoaded: boolean } {
  const { isSignedIn, isLoaded: authLoaded, orgRole, orgId, orgSlug } = useAuth();
  const { user: clerkUser, isLoaded: userLoaded } = useUser();

  const isLoaded = authLoaded && userLoaded;

  const user = useMemo<MobileUser | null>(() => {
    if (!isLoaded || !isSignedIn || !clerkUser) return null;

    return {
      userId: clerkUser.id,
      email: clerkUser.emailAddresses[0]?.emailAddress || '',
      fullName: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim(),
      role: mapOrgRole(orgRole as string | null),
      collegeId: orgId || null,
      orgSlug: orgSlug || null,
      orgRole: (orgRole as string) || null,
      imageUrl: clerkUser.imageUrl || null,
    };
  }, [isLoaded, isSignedIn, clerkUser, orgRole, orgId, orgSlug]);

  return { user, isLoaded };
}

/**
 * Hook that redirects to sign-in if the user is not authenticated.
 * Use in screens that require authentication.
 */
export function useRequireAuth(): MobileUser | null {
  const { user, isLoaded } = useAuthenticatedUser();
  const { isSignedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;
    const inAuthGroup = segments[0] === '(auth)';

    if (!isSignedIn && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    }
  }, [isLoaded, isSignedIn, segments, router]);

  return user;
}

/**
 * Get the current Clerk session token for API calls.
 * Use this in the api-client to attach Bearer tokens.
 */
export async function getAuthToken(): Promise<string | null> {
  // This is a standalone function — must be called from within a component
  // that has ClerkProvider context. For non-component use, pass getToken from useAuth().
  // Typically used via the pattern: const { getToken } = useAuth(); await getToken();
  return null;
}

/**
 * Hook that provides the getToken function for API calls.
 * Preferred over the standalone getAuthToken().
 */
export function useAuthToken() {
  const { getToken } = useAuth();
  return { getToken };
}
