'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { clsx } from 'clsx';
import type { UserRole } from '@/lib/auth';

interface NavItem {
  label: string;
  href: string;
  roles: UserRole[];
}

const navigation: NavItem[] = [
  { label: 'Student', href: '/dashboard/student', roles: ['student'] },
  { label: 'Faculty', href: '/dashboard/faculty', roles: ['faculty', 'hod'] },
  { label: 'Admin', href: '/dashboard/admin', roles: ['admin'] },
  {
    label: 'Compliance',
    href: '/dashboard/compliance',
    roles: ['compliance_officer', 'dean', 'admin', 'management'],
  },
  { label: 'Management', href: '/dashboard/management', roles: ['dean', 'management'] },
];

export function DashboardSidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();

  // Filter navigation to items the user's role can access
  const visibleNav = navigation.filter((item) => item.roles.includes(role));

  return (
    <aside className="flex w-64 flex-col border-r border-dark-border bg-dark-surface">
      <div className="flex h-16 items-center gap-3 border-b border-dark-border px-6">
        <div className="h-8 w-8 rounded-lg bg-brand-500" />
        <span className="text-lg font-semibold">Acolyte</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {visibleNav.map((item) => {
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
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-dark-border p-4">
        <UserButton afterSignOutUrl="/sign-in" />
      </div>
    </aside>
  );
}
