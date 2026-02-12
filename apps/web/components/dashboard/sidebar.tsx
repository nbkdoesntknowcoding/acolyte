'use client';

import { useState } from 'react';
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
  ChevronDown,
  CreditCard,
  Receipt,
  BadgeDollarSign,
  HandCoins,
  UserCog,
  CalendarDays,
  Briefcase,
  CalendarRange,
  Building,
  RotateCcw,
  Hotel,
  Bus,
  BookMarked,
  Wrench,
  Megaphone,
  UsersRound,
  ClipboardCheck,
  FileText,
  ShieldCheck,
  Settings,
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
  children?: { label: string; href: string; icon: LucideIcon }[];
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
    title: 'Finance',
    items: [
      {
        label: 'Finance',
        href: '/dashboard/admin/finance',
        icon: Landmark,
        children: [
          { label: 'Fee Structure', href: '/dashboard/admin/finance/fee-structure', icon: CreditCard },
          { label: 'Fee Collection', href: '/dashboard/admin/finance/fee-collection', icon: Receipt },
          { label: 'Payroll', href: '/dashboard/admin/finance/payroll', icon: BadgeDollarSign },
          { label: 'Scholarships', href: '/dashboard/admin/finance/scholarships', icon: HandCoins },
        ],
      },
    ],
  },
  {
    title: 'HR & Faculty',
    items: [
      {
        label: 'HR & Faculty',
        href: '/dashboard/admin/hr',
        icon: Users,
        children: [
          { label: 'Faculty Roster', href: '/dashboard/admin/hr', icon: UserCog },
          { label: 'Leave Management', href: '/dashboard/admin/hr/leave', icon: CalendarDays },
          { label: 'Recruitment', href: '/dashboard/admin/hr/recruitment', icon: Briefcase },
        ],
      },
    ],
  },
  {
    title: 'Academics',
    items: [
      {
        label: 'Academics',
        href: '/dashboard/admin/academics',
        icon: BookOpen,
        children: [
          { label: 'Departments', href: '/dashboard/admin/academics/departments', icon: Building },
          { label: 'Timetable', href: '/dashboard/admin/academics/timetable', icon: CalendarRange },
          { label: 'Calendar', href: '/dashboard/admin/academics/calendar', icon: CalendarDays },
          { label: 'Rotations', href: '/dashboard/admin/academics/rotations', icon: RotateCcw },
        ],
      },
    ],
  },
  {
    title: 'Facilities',
    items: [
      {
        label: 'Facilities',
        href: '/dashboard/admin/facilities',
        icon: Building2,
        children: [
          { label: 'Hostel & Mess', href: '/dashboard/admin/facilities/hostel', icon: Hotel },
          { label: 'Transport', href: '/dashboard/admin/facilities/transport', icon: Bus },
          { label: 'Library', href: '/dashboard/admin/facilities/library', icon: BookMarked },
          { label: 'Infrastructure', href: '/dashboard/admin/facilities/infrastructure', icon: Wrench },
        ],
      },
    ],
  },
  {
    title: 'System',
    items: [
      {
        label: 'Communications',
        href: '/dashboard/admin/communications',
        icon: MessageSquare,
        children: [
          { label: 'Notices', href: '/dashboard/admin/communications/notices', icon: Megaphone },
          { label: 'Committees', href: '/dashboard/admin/communications/committees', icon: UsersRound },
        ],
      },
      {
        label: 'Workflows',
        href: '/dashboard/admin/workflows',
        icon: Workflow,
        children: [
          { label: 'Approvals', href: '/dashboard/admin/workflows/approvals', icon: ClipboardCheck },
          { label: 'Documents', href: '/dashboard/admin/workflows/documents', icon: FileText },
        ],
      },
      {
        label: 'Settings',
        href: '/dashboard/admin/settings/roles',
        icon: Settings,
        children: [
          { label: 'Roles & Permissions', href: '/dashboard/admin/settings/roles', icon: ShieldCheck },
        ],
      },
    ],
  },
];

/** Simple top-level nav for non-admin roles (preserved from original). */
function getSimpleNav(role: UserRole): { label: string; href: string; icon: LucideIcon }[] {
  const all: ({ label: string; href: string; icon: LucideIcon } & { roles: UserRole[] })[] = [
    { label: 'Student', href: '/dashboard/student', roles: ['student'], icon: LayoutDashboard },
    { label: 'Faculty', href: '/dashboard/faculty', roles: ['faculty', 'hod'], icon: LayoutDashboard },
    { label: 'Admin', href: '/dashboard/admin', roles: ['admin'], icon: LayoutDashboard },
    { label: 'Compliance', href: '/dashboard/compliance', roles: ['compliance_officer', 'dean', 'admin', 'management'], icon: LayoutDashboard },
    { label: 'Management', href: '/dashboard/management', roles: ['dean', 'management'], icon: LayoutDashboard },
  ];
  return all.filter((item) => item.roles.includes(role));
}

// ---------------------------------------------------------------------------
// Collapsible nav item with children
// ---------------------------------------------------------------------------

function CollapsibleNavItem({
  item,
  pathname,
}: {
  item: NavItem;
  pathname: string;
}) {
  const isChildActive = item.children?.some((child) => pathname === child.href || pathname.startsWith(child.href + '/')) ?? false;
  const isSelfActive = pathname === item.href;
  const isExpanded = isChildActive || isSelfActive;
  const [open, setOpen] = useState(isExpanded);

  const Icon = item.icon;

  return (
    <li>
      <button
        onClick={() => setOpen(!open)}
        className={clsx(
          'flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
          isChildActive || isSelfActive
            ? 'bg-emerald-500/10 text-white'
            : 'text-gray-400 hover:bg-gray-800 hover:text-white',
        )}
      >
        <Icon
          className={clsx(
            'w-5 h-5 shrink-0',
            isChildActive || isSelfActive ? 'text-emerald-500' : 'text-current',
          )}
        />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown
          className={clsx(
            'w-4 h-4 shrink-0 transition-transform',
            open ? 'rotate-180' : '',
          )}
        />
      </button>
      {open && item.children && (
        <ul className="mt-1 ml-4 pl-3 border-l border-[#1E1E1E] space-y-0.5">
          {item.children.map((child) => {
            const isActive = pathname === child.href || pathname.startsWith(child.href + '/');
            const ChildIcon = child.icon;
            return (
              <li key={child.href}>
                <Link
                  href={child.href}
                  className={clsx(
                    'flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    isActive
                      ? 'text-emerald-400 bg-emerald-500/5'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50',
                  )}
                >
                  <ChildIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>{child.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
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
        <nav className="flex-1 overflow-y-auto py-6 space-y-6 px-4">
          {ADMIN_NAV.map((section) => (
            <div key={section.title}>
              <div className="mb-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {section.title}
              </div>
              <ul className="space-y-1">
                {section.items.map((item) => {
                  // Items with children get collapsible behavior
                  if (item.children && item.children.length > 0) {
                    return (
                      <CollapsibleNavItem
                        key={item.href}
                        item={item}
                        pathname={pathname}
                      />
                    );
                  }

                  // Simple items (no children)
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
                            : 'text-gray-400 hover:bg-gray-800 hover:text-white',
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
