'use client';

import { useEffect, useState } from 'react';
import { useOrganizationList, useUser, SignOutButton } from '@clerk/nextjs';

/**
 * Onboarding page — handles auto-activation of Clerk organizations.
 *
 * Flow:
 * 1. User signs in → middleware detects no active org → redirects here
 * 2. We check if the user has any org memberships
 * 3. If exactly 1 org → auto-activate it → hard redirect to dashboard
 * 4. If 0 orgs → show "contact admin" message with domain info
 * 5. If 2+ orgs → show org picker (future)
 *
 * CRITICAL: After setActive(), we MUST use window.location.href (hard navigation)
 * instead of router.replace() (soft navigation). Clerk needs a full page reload
 * to propagate the org_id into the session cookie and JWT token.
 */

const ROLE_DASHBOARDS: Record<string, string> = {
  'org:student': '/dashboard/student',
  'org:faculty': '/dashboard/faculty',
  'org:hod': '/dashboard/faculty',
  'org:dean': '/dashboard/management',
  'org:admin': '/dashboard/admin',
  'org:compliance_officer': '/dashboard/compliance',
  'org:management': '/dashboard/management',
  'org:member': '/dashboard/student',
};

export default function OnboardingPage() {
  const { user, isLoaded: userLoaded } = useUser();
  const { userMemberships, isLoaded: orgsLoaded, setActive } = useOrganizationList({
    userMemberships: { infinite: true },
  });

  const [status, setStatus] = useState<'loading' | 'activating' | 'no-org' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const email = user?.emailAddresses?.[0]?.emailAddress || '';
  const domain = email.includes('@') ? email.split('@')[1] : '';

  useEffect(() => {
    if (!userLoaded || !orgsLoaded) return;

    const memberships = userMemberships?.data ?? [];

    if (memberships.length === 0) {
      setStatus('no-org');
      return;
    }

    // Auto-activate the first (or only) org
    const firstOrg = memberships[0];
    const orgId = firstOrg.organization.id;
    const orgRole = firstOrg.role;

    setStatus('activating');
    setActive({ organization: orgId })
      .then(() => {
        // HARD navigation — forces full page reload so Clerk refreshes
        // the session cookie and JWT with the newly activated org_id.
        const dashboard = ROLE_DASHBOARDS[orgRole] || '/dashboard/admin';
        window.location.href = dashboard;
      })
      .catch((err: Error) => {
        console.error('Failed to activate organization:', err);
        setErrorMsg(err.message || 'Failed to activate organization');
        setStatus('error');
      });
  }, [userLoaded, orgsLoaded, userMemberships, setActive]);

  // Loading state
  if (status === 'loading' || status === 'activating') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A]">
        <div className="w-full max-w-md space-y-6 text-center p-8">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
          <p className="text-gray-400">
            {status === 'activating'
              ? 'Setting up your organization...'
              : 'Checking your account...'}
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A]">
        <div className="w-full max-w-md space-y-6 text-center p-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
            <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Something Went Wrong</h1>
          <p className="text-gray-400">{errorMsg}</p>
          <div className="space-y-3 pt-4 border-t border-gray-800">
            <p className="text-xs text-gray-600">Signed in as {email}</p>
            <SignOutButton>
              <button className="text-sm text-gray-400 underline hover:text-white transition-colors">
                Sign out and try again
              </button>
            </SignOutButton>
          </div>
        </div>
      </div>
    );
  }

  // No org — user's domain not registered
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A]">
      <div className="w-full max-w-md space-y-6 text-center p-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/10">
          <svg className="h-8 w-8 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-white">Organization Not Found</h1>

        {domain ? (
          <div className="space-y-3">
            <p className="text-gray-400">
              The email domain{' '}
              <span className="font-mono text-white">@{domain}</span> is not
              associated with any registered institution on Acolyte.
            </p>
            <p className="text-sm text-gray-500">
              If your institution uses Acolyte, ask your administrator to add{' '}
              <span className="font-mono text-gray-400">{domain}</span> to the
              allowed domains list.
            </p>
          </div>
        ) : (
          <p className="text-gray-400">
            You are not assigned to any institution. Please contact your administrator.
          </p>
        )}

        <div className="space-y-3 pt-4 border-t border-gray-800">
          <p className="text-xs text-gray-600">Signed in as {email}</p>
          <SignOutButton>
            <button className="text-sm text-gray-400 underline hover:text-white transition-colors">
              Sign out
            </button>
          </SignOutButton>
        </div>
      </div>
    </div>
  );
}
