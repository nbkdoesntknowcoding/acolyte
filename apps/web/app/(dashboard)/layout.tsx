'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { clsx } from 'clsx';

const navigation = [
  { label: 'Student', href: '/student', icon: '📚' },
  { label: 'Faculty', href: '/faculty', icon: '👨‍🏫' },
  { label: 'Admin', href: '/admin', icon: '⚙️' },
  { label: 'Compliance', href: '/compliance', icon: '📋' },
  { label: 'Management', href: '/management', icon: '📊' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r border-dark-border bg-dark-surface">
        <div className="flex h-16 items-center gap-3 border-b border-dark-border px-6">
          <div className="h-8 w-8 rounded-lg bg-brand-500" />
          <span className="text-lg font-semibold">Acolyte</span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navigation.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-brand-500/10 text-brand-500'
                    : 'text-gray-400 hover:bg-dark-elevated hover:text-white',
                )}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-dark-border p-4">
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-dark-bg">
        <header className="flex h-16 items-center justify-between border-b border-dark-border px-8">
          <h1 className="text-lg font-medium capitalize">
            {pathname.split('/')[1] || 'Dashboard'}
          </h1>
        </header>
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
