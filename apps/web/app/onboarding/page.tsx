import { requireAuth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { SignOutButton } from '@clerk/nextjs';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const user = await requireAuth();

  // If user already has a college, send them to dashboard
  if (user.collegeId) {
    redirect('/dashboard');
  }

  const email = user.email || '';
  const domain = email.includes('@') ? email.split('@')[1] : '';

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A]">
      <div className="w-full max-w-md space-y-6 text-center p-8">
        {/* Warning icon */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/10">
          <svg
            className="h-8 w-8 text-yellow-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
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
            You are not assigned to any institution. Please contact your
            administrator.
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
