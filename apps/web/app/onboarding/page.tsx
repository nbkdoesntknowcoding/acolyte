import { requireAuth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const user = await requireAuth();

  // If user already has a college, send them to dashboard
  if (user.collegeId) {
    redirect('/dashboard');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-dark-bg">
      <div className="w-full max-w-md space-y-6 text-center">
        <h1 className="text-2xl font-bold">Welcome to Acolyte</h1>
        <p className="text-gray-400">
          You are not assigned to any college yet. Please contact your institution
          administrator to get added to your college organization.
        </p>
        <p className="text-sm text-gray-500">Signed in as {user.email}</p>
      </div>
    </div>
  );
}
