import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

/**
 * Role -> dashboard route mapping.
 * Clerk org_role values: "org:student", "org:faculty", "org:hod", etc.
 */
const ROLE_DASHBOARDS: Record<string, string> = {
  'org:student': '/dashboard/student',
  'org:faculty': '/dashboard/faculty',
  'org:hod': '/dashboard/faculty',
  'org:dean': '/dashboard/management',
  'org:admin': '/dashboard/admin',
  'org:compliance_officer': '/dashboard/compliance',
  'org:management': '/dashboard/management',
  // Clerk built-in fallbacks
  'org:member': '/dashboard/student',
  admin: '/dashboard/admin',
};

/**
 * Which roles can access which dashboard paths.
 */
const DASHBOARD_ALLOWED_ROLES: Record<string, string[]> = {
  '/dashboard/student': ['org:student', 'org:member'],
  '/dashboard/faculty': ['org:faculty', 'org:hod'],
  '/dashboard/admin': ['org:admin', 'admin'],
  '/dashboard/compliance': [
    'org:compliance_officer',
    'org:dean',
    'org:admin',
    'admin',
    'org:management',
  ],
  '/dashboard/management': ['org:dean', 'org:management'],
};

// Public routes — no auth required
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/onboarding(.*)',
  '/api/webhooks(.*)',
  '/api/health',
]);

function getDashboardForRole(orgRole: string | undefined): string {
  if (!orgRole) return '/dashboard/student';
  return ROLE_DASHBOARDS[orgRole] || '/dashboard/student';
}

function getDashboardSegment(pathname: string): string | null {
  const match = pathname.match(/^\/dashboard\/([^/]+)/);
  return match ? `/dashboard/${match[1]}` : null;
}

export default clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl;

  // Let public routes through
  if (isPublicRoute(request)) {
    return;
  }

  // All other routes require authentication
  const session = await auth.protect();

  const orgRole = session.orgRole as string | undefined;
  const orgId = session.orgId;

  // No org (no college assigned) -> onboarding
  if (!orgId && pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/onboarding', request.url));
  }

  // Role-based dashboard access control
  const dashboardSegment = getDashboardSegment(pathname);
  if (dashboardSegment) {
    const allowedRoles = DASHBOARD_ALLOWED_ROLES[dashboardSegment];
    if (allowedRoles && orgRole && !allowedRoles.includes(orgRole)) {
      // Redirect to their correct dashboard
      const correctDashboard = getDashboardForRole(orgRole);
      return NextResponse.redirect(new URL(correctDashboard, request.url));
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
