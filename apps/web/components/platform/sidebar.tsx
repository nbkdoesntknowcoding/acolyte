'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useHealthOverview } from '@/lib/platform-api';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/platform', icon: '◉' },
  { label: 'Licenses', href: '/platform/licenses', icon: '⊟' },
  { label: 'Onboarding', href: '/platform/onboard', icon: '⊕' },
  { label: 'System Health', href: '/platform/health', icon: '♥' },
  { label: 'AI Costs', href: '/platform/ai-costs', icon: '$' },
  { label: 'Alerts', href: '/platform/alerts', icon: '!' },
  { label: 'Audit Log', href: '/platform/audit-log', icon: '▤' },
];

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'healthy'
      ? 'bg-green-500'
      : status === 'degraded'
        ? 'bg-yellow-500'
        : status === 'critical' || status === 'unhealthy'
          ? 'bg-red-500'
          : 'bg-gray-500';
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${color}`}
      title={status}
    />
  );
}

export function PlatformSidebar() {
  const pathname = usePathname();
  const { data: health } = useHealthOverview();

  const systemStatus = health?.system_status ?? 'unknown';

  return (
    <aside className="flex h-full w-56 flex-col border-r border-dark-border bg-dark-surface">
      {/* Brand */}
      <div className="flex items-center gap-2 border-b border-dark-border px-4 py-4">
        <span className="text-lg font-bold text-brand-500">Acolyte</span>
        <span className="rounded bg-dark-elevated px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
          PLATFORM
        </span>
      </div>

      {/* System status bar */}
      <div className="flex items-center gap-2 border-b border-dark-border px-4 py-2">
        <StatusDot status={systemStatus} />
        <span className="text-xs text-gray-400">
          System: {systemStatus}
        </span>
        {health && (
          <span className="ml-auto text-[10px] text-gray-500">
            {health.active_alerts} alerts
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === '/platform'
              ? pathname === '/platform'
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`mx-2 mb-0.5 flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-brand-500/10 text-brand-500 font-medium'
                  : 'text-gray-400 hover:bg-dark-elevated hover:text-white'
              }`}
            >
              <span className="w-4 text-center text-xs">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-dark-border px-4 py-3">
        <p className="text-[10px] text-gray-600">Platform Admin v0.1</p>
      </div>
    </aside>
  );
}
