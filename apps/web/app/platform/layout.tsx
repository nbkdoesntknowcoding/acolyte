import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { PlatformProviders } from '@/components/platform/providers';
import { PlatformSidebar } from '@/components/platform/sidebar';

export const dynamic = 'force-dynamic';

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const user = await currentUser();
  const meta = (user?.publicMetadata ?? {}) as Record<string, unknown>;
  const isPlatformAdmin = meta.is_platform_admin === true;

  const session = await auth();
  const orgSlug = session.orgSlug ?? '';
  const isPlatformOrg = orgSlug === 'acolyte-platform';

  if (!isPlatformAdmin && !isPlatformOrg) {
    return (
      <div className="flex h-screen items-center justify-center bg-dark-bg">
        <div className="max-w-md rounded-xl border border-dark-border bg-dark-surface p-8 text-center">
          <p className="text-2xl font-bold text-red-500">Access Denied</p>
          <p className="mt-3 text-sm text-gray-400">
            This area is restricted to Acolyte platform administrators.
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Signed in as {user?.emailAddresses?.[0]?.emailAddress}
          </p>
          <a
            href="/dashboard"
            className="mt-6 inline-block rounded-lg bg-brand-500 px-6 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <PlatformProviders>
      <div className="flex h-screen bg-dark-bg text-white">
        <PlatformSidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">{children}</div>
        </main>
      </div>
    </PlatformProviders>
  );
}
