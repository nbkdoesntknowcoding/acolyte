'use client';

import Link from 'next/link';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  useAnalyticsOverview,
  useAlerts,
  useLicenses,
  useHealthOverview,
  useAICosts,
  useHealthMetrics,
} from '@/lib/platform-api';

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function Stat({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-dark-border bg-dark-surface p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color ?? 'text-white'}`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-gray-500">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Severity badge
// ---------------------------------------------------------------------------

function SeverityBadge({ severity }: { severity: string }) {
  const cls =
    severity === 'critical'
      ? 'bg-red-500/20 text-red-400'
      : severity === 'error'
        ? 'bg-orange-500/20 text-orange-400'
        : severity === 'warning'
          ? 'bg-yellow-500/20 text-yellow-400'
          : 'bg-blue-500/20 text-blue-400';
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>
      {severity}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Dashboard page
// ---------------------------------------------------------------------------

export default function PlatformDashboard() {
  const { data: analytics, isLoading: loadingAnalytics } =
    useAnalyticsOverview();
  const { data: health } = useHealthOverview();
  const { data: alerts } = useAlerts({ status: 'active', per_page: 10 });
  const { data: expiring } = useLicenses({
    expiring_within_days: 30,
    per_page: 10,
  });
  const { data: aiCosts } = useAICosts();
  const { data: dauMetrics } = useHealthMetrics('api', 'requests_count');

  const systemColor =
    health?.system_status === 'healthy'
      ? 'text-green-400'
      : health?.system_status === 'degraded'
        ? 'text-yellow-400'
        : 'text-red-400';

  // DAU chart from health metrics
  const dauChartData = (dauMetrics ?? [])
    .slice()
    .reverse()
    .map((p) => ({
      day: new Date(p.timestamp).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
      }),
      users: p.value,
    }));

  // AI cost trend from health metrics
  const costChartData = aiCosts
    ? [
        {
          day: 'Today',
          cost: aiCosts.total_cost_today_usd,
        },
        {
          day: 'Month',
          cost: aiCosts.total_cost_this_month_usd,
        },
        {
          day: 'Projected',
          cost: aiCosts.projected_monthly_cost_usd,
        },
      ]
    : [];

  if (loadingAnalytics) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-500">
        Loading platform data...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Platform Dashboard</h1>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat
          label="Active Licenses"
          value={analytics?.active_licenses ?? '--'}
          sub={`${analytics?.total_licenses ?? 0} total`}
        />
        <Stat
          label="Total Students"
          value={(analytics?.total_students ?? 0).toLocaleString()}
        />
        <Stat
          label="Total Faculty"
          value={(analytics?.total_faculty ?? 0).toLocaleString()}
        />
        <Stat
          label="MRR"
          value={`₹${((analytics?.mrr_inr ?? 0) / 100_000).toFixed(1)}L`}
          sub="Monthly recurring"
          color="text-brand-500"
        />
        <Stat
          label="System Status"
          value={health?.system_status ?? 'unknown'}
          color={systemColor}
          sub={`${health?.active_alerts ?? 0} active alerts`}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-dark-border bg-dark-surface p-4">
          <h3 className="mb-3 text-sm font-medium text-gray-400">
            API Requests Trend
          </h3>
          <div className="h-48">
            {dauChartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-gray-600">
                No metrics data yet. Charts will populate as health metrics are collected.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dauChartData}>
                  <XAxis
                    dataKey="day"
                    tick={{ fill: '#666', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#666', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#111',
                      border: '1px solid #333',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="users"
                    stroke="#00C853"
                    fill="#00C853"
                    fillOpacity={0.1}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-dark-border bg-dark-surface p-4">
          <h3 className="mb-3 text-sm font-medium text-gray-400">
            AI Costs Overview
          </h3>
          <div className="h-48">
            {costChartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-gray-600">
                No AI cost data yet. Costs appear once colleges start using AI features.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={costChartData}>
                  <XAxis
                    dataKey="day"
                    tick={{ fill: '#666', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#666', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#111',
                      border: '1px solid #333',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => [`$${v.toFixed(2)}`, 'Cost']}
                  />
                  <Area
                    type="monotone"
                    dataKey="cost"
                    stroke="#6366f1"
                    fill="#6366f1"
                    fillOpacity={0.1}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Tables row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Recent alerts */}
        <div className="rounded-lg border border-dark-border bg-dark-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-400">
              Recent Alerts
            </h3>
            <Link
              href="/platform/alerts"
              className="text-xs text-brand-500 hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {alerts?.items.length === 0 && (
              <p className="text-xs text-gray-600">No active alerts</p>
            )}
            {alerts?.items.map((a) => (
              <div
                key={a.id}
                className="flex items-start gap-2 rounded border border-dark-border p-2"
              >
                <SeverityBadge severity={a.severity} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-white">{a.title}</p>
                  <p className="truncate text-[10px] text-gray-500">
                    {a.details}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Expiring licenses */}
        <div className="rounded-lg border border-dark-border bg-dark-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-400">
              Licenses Expiring (30d)
            </h3>
            <Link
              href="/platform/licenses"
              className="text-xs text-brand-500 hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {expiring?.items.length === 0 && (
              <p className="text-xs text-gray-600">
                No licenses expiring soon
              </p>
            )}
            {expiring?.items.map((lic) => (
              <Link
                key={lic.id}
                href={`/platform/licenses/${lic.id}`}
                className="flex items-center justify-between rounded border border-dark-border p-2 hover:bg-dark-elevated"
              >
                <div>
                  <p className="text-xs font-medium text-white">
                    {lic.college_name || lic.plan_name}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {lic.plan_tier} &middot; {lic.status}
                  </p>
                </div>
                <span className="text-[10px] text-yellow-400">
                  {lic.expires_at
                    ? new Date(lic.expires_at).toLocaleDateString()
                    : '--'}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
