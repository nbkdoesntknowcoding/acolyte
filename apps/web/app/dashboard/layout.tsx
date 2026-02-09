import { requireOrg } from '@/lib/auth';
import { DashboardSidebar } from '@/components/dashboard/sidebar';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireOrg();

  return (
    <div className="flex h-screen">
      <DashboardSidebar role={user.role} />
      <main className="flex-1 overflow-auto bg-dark-bg">
        <header className="flex h-16 items-center justify-between border-b border-dark-border px-8">
          <h1 className="text-lg font-medium">Dashboard</h1>
          <span className="text-sm text-gray-400">{user.fullName || user.email}</span>
        </header>
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
