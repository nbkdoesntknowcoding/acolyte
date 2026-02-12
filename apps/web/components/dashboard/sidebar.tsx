'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  UserCheck,
  FolderOpen,
  Award,
  GraduationCap,
  Landmark,
  Users,
  BookOpen,
  Building2,
  MessageSquare,
  Workflow,
} from 'lucide-react';
import type { UserRole } from '@/lib/auth';
import type { LucideIcon } from 'lucide-react';

// ---------------------------------------------------------------------------
// Navigation types
// ---------------------------------------------------------------------------

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

// ---------------------------------------------------------------------------
// Role-specific navigation configs
// ---------------------------------------------------------------------------

const ADMIN_NAV: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', href: '/dashboard/admin', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Students',
    items: [
      { label: 'Admissions', href: '/dashboard/admin/students/admissions', icon: UserCheck },
      { label: 'Student Records', href: '/dashboard/admin/students/records', icon: FolderOpen },
      { label: 'Certificates', href: '/dashboard/admin/students/certificates', icon: Award },
      { label: 'Alumni', href: '/dashboard/admin/students/alumni', icon: GraduationCap },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Finance', href: '/dashboard/admin/finance', icon: Landmark },
      { label: 'HR & Faculty', href: '/dashboard/admin/hr', icon: Users },
      { label: 'Academics', href: '/dashboard/admin/academics', icon: BookOpen },
      { label: 'Facilities', href: '/dashboard/admin/facilities', icon: Building2 },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Communication', href: '/dashboard/admin/communication', icon: MessageSquare },
      { label: 'Workflows', href: '/dashboard/admin/workflows', icon: Workflow },
    ],
  },
];

/** Simple top-level nav for non-admin roles (preserved from original). */
function getSimpleNav(role: UserRole): NavItem[] {
  const all: (NavItem & { roles: UserRole[] })[] = [
    { label: 'Student', href: '/dashboard/student', roles: ['student'], icon: LayoutDashboard },
    { label: 'Faculty', href: '/dashboard/faculty', roles: ['faculty', 'hod'], icon: LayoutDashboard },
    { label: 'Admin', href: '/dashboard/admin', roles: ['admin'], icon: LayoutDashboard },
    { label: 'Compliance', href: '/dashboard/compliance', roles: ['compliance_officer', 'dean', 'admin', 'management'], icon: LayoutDashboard },
    { label: 'Management', href: '/dashboard/management', roles: ['dean', 'management'], icon: LayoutDashboard },
  ];
  return all.filter((item) => item.roles.includes(role));
}

// ---------------------------------------------------------------------------
// Sidebar component
// ---------------------------------------------------------------------------

export function DashboardSidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();

  // Admin gets the full sectioned sidebar
  if (role === 'admin') {
    return (
      <aside className="flex w-[240px] flex-col border-r border-dark-border bg-dark-bg shrink-0">
        {/* Brand */}
        <div className="flex h-16 items-center gap-3 border-b border-dark-border px-6">
          <div className="h-8 w-8 rounded bg-emerald-500 flex items-center justify-center text-white font-bold text-lg">
            A
          </div>
          <span className="text-xl font-bold tracking-tight text-emerald-500">ACOLYTE</span>
        </div>

        {/* Nav sections */}
        <nav className="flex-1 overflow-y-auto py-6 space-y-8 px-4">
          {ADMIN_NAV.map((section) => (
            <div key={section.title}>
              <div className="mb-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {section.title}
              </div>
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const isActive =
                    item.href === '/dashboard/admin'
                      ? pathname === '/dashboard/admin'
                      : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={clsx(
                          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-emerald-500/10 text-white border-l-4 border-emerald-500'
                            : 'text-gray-400 hover:bg-dark-elevated hover:text-white',
                        )}
                      >
                        <Icon
                          className={clsx(
                            'w-5 h-5 shrink-0',
                            isActive ? 'text-emerald-500' : 'text-current',
                          )}
                        />
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-dark-border p-4">
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </aside>
    );
  }

  // Other roles: simple flat nav
  const visibleNav = getSimpleNav(role);

  return (
    <aside className="flex w-64 flex-col border-r border-dark-border bg-dark-surface">
      <div className="flex h-16 items-center gap-3 border-b border-dark-border px-6">
        <div className="h-8 w-8 rounded bg-emerald-500 flex items-center justify-center text-white font-bold text-lg">
          A
        </div>
        <span className="text-xl font-bold tracking-tight text-emerald-500">ACOLYTE</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {visibleNav.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : 'text-gray-400 hover:bg-dark-elevated hover:text-white',
              )}
            >
              <Icon className="w-5 h-5" />
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
