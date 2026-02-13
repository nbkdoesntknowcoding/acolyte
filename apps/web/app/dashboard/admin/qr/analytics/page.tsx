'use client';

/**
 * Admin QR Analytics Dashboard — charts, stats, leaderboard.
 *
 * Data sources:
 *   GET /api/v1/admin/qr/scan-logs/summary   (daily successful scans by type)
 *   GET /api/v1/admin/qr/scan-logs/anomalies  (failures grouped by reason)
 *   GET /api/v1/admin/qr/action-points         (all action points)
 *   GET /api/v1/admin/devices/stats            (device registration counts)
 *
 * All data combined via useQRAnalytics() composite hook.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BarChart3,
  Minus,
  Smartphone,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart as ReBarChart,
  Bar,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { useQRAnalytics } from '@/lib/hooks/admin/use-qr-analytics';

// ---------------------------------------------------------------------------
// Color palettes
// ---------------------------------------------------------------------------

const ACTION_TYPE_META: Record<string, { label: string; color: string }> = {
  mess_entry:         { label: 'Mess Entry',         color: '#f97316' },
  hostel_checkin:     { label: 'Hostel Check-in',    color: '#3b82f6' },
  library_visit:      { label: 'Library Visit',      color: '#6366f1' },
  library_checkout:   { label: 'Library Checkout',   color: '#818cf8' },
  library_return:     { label: 'Library Return',     color: '#a5b4fc' },
  attendance_mark:    { label: 'Attendance',          color: '#10b981' },
  equipment_checkout: { label: 'Equipment',           color: '#6b7280' },
  event_checkin:      { label: 'Event',               color: '#ec4899' },
  exam_hall_entry:    { label: 'Exam Hall',           color: '#ef4444' },
  transport_boarding: { label: 'Transport',           color: '#eab308' },
  clinical_posting:   { label: 'Clinical Posting',    color: '#14b8a6' },
  fee_payment:        { label: 'Fee Payment',         color: '#22c55e' },
  visitor_entry:      { label: 'Visitor',              color: '#a855f7' },
  certificate_verify: { label: 'Certificate',         color: '#f59e0b' },
};

const FAILURE_COLORS: Record<string, string> = {
  duplicate_scan:  '#9ca3af',
  expired_token:   '#f59e0b',
  device_mismatch: '#ef4444',
  geo_violation:   '#dc2626',
  time_violation:  '#f97316',
  revoked_device:  '#b91c1c',
  unauthorized:    '#991b1b',
  invalid_qr:      '#7f1d1d',
  no_handler:      '#6b7280',
};

const PERIOD_OPTIONS = [
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatShortDate(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function OverviewCard({
  label,
  value,
  sub,
  change,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  change?: number | null;
  color?: string;
}) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color ?? ''}`}>{value}</p>
      {change != null && (
        <p className={`mt-0.5 flex items-center gap-1 text-xs ${change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
          {change > 0 ? (
            <ArrowUp className="h-3 w-3" />
          ) : change < 0 ? (
            <ArrowDown className="h-3 w-3" />
          ) : (
            <Minus className="h-3 w-3" />
          )}
          {change > 0 ? '+' : ''}{change}% vs prior period
        </p>
      )}
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-lg border p-4">
      <div className="h-3 w-20 rounded bg-muted" />
      <div className="mt-2 h-7 w-16 rounded bg-muted" />
      <div className="mt-1 h-3 w-24 rounded bg-muted" />
    </div>
  );
}

function SkeletonChart({ height }: { height: number }) {
  return (
    <div className="animate-pulse rounded-lg border p-4" style={{ height }}>
      <div className="h-4 w-40 rounded bg-muted" />
      <div className="mt-4 h-full max-h-[200px] w-full rounded bg-muted/50" />
    </div>
  );
}

function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function QRAnalyticsPage() {
  const [days, setDays] = useState(30);
  const { data, isLoading, error } = useQRAnalytics(days);

  // Unique action types present in chart data (for stacked areas)
  const chartActionTypes = useMemo(() => {
    if (!data?.dailyData.length) return [];
    const typeSet = new Set<string>();
    for (const row of data.dailyData) {
      for (const key of Object.keys(row)) {
        if (key !== 'date' && key !== 'total') typeSet.add(key);
      }
    }
    return Array.from(typeSet).sort();
  }, [data]);

  // Legend items for the stacked area chart
  const areaLegend = useMemo(
    () =>
      chartActionTypes.map((t) => ({
        label: ACTION_TYPE_META[t]?.label ?? t,
        color: ACTION_TYPE_META[t]?.color ?? '#6b7280',
      })),
    [chartActionTypes],
  );

  // Pie data with colors
  const pieData = useMemo(
    () =>
      (data?.typeDistribution ?? []).map((d) => ({
        ...d,
        name: ACTION_TYPE_META[d.action_type]?.label ?? d.action_type,
        fill: ACTION_TYPE_META[d.action_type]?.color ?? '#6b7280',
      })),
    [data],
  );

  // Failure bar data with colors
  const failureData = useMemo(
    () =>
      (data?.failureBreakdown ?? []).map((d) => ({
        ...d,
        name: d.validation_result.replace(/_/g, ' '),
        fill: FAILURE_COLORS[d.validation_result] ?? '#6b7280',
      })),
    [data],
  );

  // Top action points ranked by type scan volume
  const topPoints = useMemo(() => {
    if (!data) return [];
    const typeCountMap = new Map<string, number>();
    for (const item of data.summaryItems) {
      typeCountMap.set(item.action_type, (typeCountMap.get(item.action_type) ?? 0) + item.count);
    }
    return data.actionPoints
      .filter((p) => p.is_active)
      .map((p) => ({
        id: p.id,
        name: p.name,
        action_type: p.action_type,
        location_code: p.location_code,
        building: p.building,
        typeScans: typeCountMap.get(p.action_type) ?? 0,
      }))
      .sort((a, b) => b.typeScans - a.typeScans)
      .slice(0, 10);
  }, [data]);

  return (
    <div className="space-y-6 p-6">
      {/* ------------------------------------------------------------------ */}
      {/* Header */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/admin/qr">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">QR Analytics</h1>
            <p className="text-muted-foreground">
              Scan volume trends, success rates, and per-type statistics
            </p>
          </div>
        </div>

        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="h-9 w-32 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          {PERIOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              Last {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          Failed to load analytics: {error.message}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Row 1 — Overview Cards */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : data ? (
          <>
            <OverviewCard
              label="Total Scans"
              value={data.totalScans.toLocaleString()}
              change={data.weekChange}
              sub={`${data.totalSuccess.toLocaleString()} successful`}
            />
            <OverviewCard
              label="Active Action Points"
              value={data.activePointCount}
              sub={`${data.actionPoints.length} total configured`}
            />
            <OverviewCard
              label="Registered Devices"
              value={data.deviceStats?.total_registered.toLocaleString() ?? '—'}
              sub={
                data.deviceStats
                  ? `${data.deviceStats.active_count} active`
                  : undefined
              }
            />
            <OverviewCard
              label="Avg Success Rate"
              value={`${data.successRate}%`}
              color={
                data.successRate >= 90
                  ? 'text-emerald-600'
                  : data.successRate >= 70
                    ? 'text-yellow-600'
                    : 'text-red-600'
              }
              sub={`${data.totalFailures.toLocaleString()} failures`}
            />
          </>
        ) : null}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Row 2 — Daily Scan Volume (Stacked Area Chart) */}
      {/* ------------------------------------------------------------------ */}
      {isLoading ? (
        <SkeletonChart height={320} />
      ) : data && data.dailyData.length > 0 ? (
        <div className="rounded-lg border p-4">
          <p className="mb-3 text-sm font-semibold">Daily Scan Volume</p>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.dailyData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatShortDate}
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    borderColor: 'hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelFormatter={formatShortDate}
                />
                {chartActionTypes.map((type) => (
                  <Area
                    key={type}
                    type="monotone"
                    dataKey={type}
                    stackId="1"
                    stroke={ACTION_TYPE_META[type]?.color ?? '#6b7280'}
                    fill={ACTION_TYPE_META[type]?.color ?? '#6b7280'}
                    fillOpacity={0.6}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <ChartLegend items={areaLegend} />
        </div>
      ) : !isLoading ? (
        <div className="flex h-64 items-center justify-center rounded-lg border text-sm text-muted-foreground">
          <div className="text-center">
            <BarChart3 className="mx-auto mb-2 h-8 w-8 opacity-40" />
            No scan data available for the selected period.
          </div>
        </div>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {/* Row 3 — Two columns: Pie + Failure breakdown */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Scans by Action Type (Donut) */}
        {isLoading ? (
          <SkeletonChart height={320} />
        ) : pieData.length > 0 ? (
          <div className="rounded-lg border p-4">
            <p className="mb-3 text-sm font-semibold">Scans by Action Type</p>
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={2}
                  >
                    {pieData.map((d, i) => (
                      <Cell key={i} fill={d.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ChartLegend
              items={pieData.map((d) => ({
                label: `${d.name} (${d.count.toLocaleString()})`,
                color: d.fill,
              }))}
            />
          </div>
        ) : !isLoading ? (
          <div className="flex h-64 items-center justify-center rounded-lg border text-sm text-muted-foreground">
            No type distribution data.
          </div>
        ) : null}

        {/* Success vs Failure Breakdown */}
        {isLoading ? (
          <SkeletonChart height={320} />
        ) : data ? (
          <div className="rounded-lg border p-4">
            <p className="mb-3 text-sm font-semibold">Failure Breakdown</p>
            {failureData.length > 0 ? (
              <>
                {/* Success/failure proportion bar */}
                <div className="mb-4">
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>Success: {data.totalSuccess.toLocaleString()}</span>
                    <span>Failures: {data.totalFailures.toLocaleString()}</span>
                  </div>
                  <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                    <div
                      className="bg-emerald-500 transition-all"
                      style={{
                        width: data.totalScans > 0
                          ? `${(data.totalSuccess / data.totalScans) * 100}%`
                          : '100%',
                      }}
                    />
                    <div
                      className="bg-red-500 transition-all"
                      style={{
                        width: data.totalScans > 0
                          ? `${(data.totalFailures / data.totalScans) * 100}%`
                          : '0%',
                      }}
                    />
                  </div>
                </div>

                {/* Horizontal bar chart of failure types */}
                <div style={{ width: '100%', height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ReBarChart
                      data={failureData}
                      layout="vertical"
                      margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-muted"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11 }}
                        className="fill-muted-foreground"
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={110}
                        tick={{ fontSize: 11 }}
                        className="fill-muted-foreground"
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          borderColor: 'hsl(var(--border))',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {failureData.map((d, i) => (
                          <Cell key={i} fill={d.fill} />
                        ))}
                      </Bar>
                    </ReBarChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                No failures recorded — everything is running smoothly.
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Row 4 — Heatmap note */}
      {/* ------------------------------------------------------------------ */}
      {/* Skipped for MVP — scan-logs/summary only provides daily granularity.
          Would need an hourly-granularity endpoint to build the hour × day heatmap. */}

      {/* ------------------------------------------------------------------ */}
      {/* Row 5 — Top Action Points Table */}
      {/* ------------------------------------------------------------------ */}
      {!isLoading && topPoints.length > 0 && (
        <div className="rounded-lg border">
          <div className="border-b px-4 py-3">
            <p className="text-sm font-semibold">Top Action Points by Scan Volume</p>
            <p className="text-xs text-muted-foreground">
              Ranked by total successful scans for the action type in the selected period
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2.5 text-left font-medium w-10">#</th>
                  <th className="px-4 py-2.5 text-left font-medium">Name</th>
                  <th className="px-4 py-2.5 text-left font-medium">Action Type</th>
                  <th className="hidden px-4 py-2.5 text-left font-medium sm:table-cell">
                    Building
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium">Type Scans</th>
                </tr>
              </thead>
              <tbody>
                {topPoints.map((p, i) => {
                  const meta = ACTION_TYPE_META[p.action_type];
                  return (
                    <tr
                      key={p.id}
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-2.5">
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.location_code}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          {meta && (
                            <span
                              className="inline-block h-3 w-3 rounded-sm"
                              style={{ backgroundColor: meta.color }}
                            />
                          )}
                          {meta?.label ?? p.action_type}
                        </span>
                      </td>
                      <td className="hidden px-4 py-2.5 text-xs text-muted-foreground sm:table-cell">
                        {p.building ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs">
                        {p.typeScans.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isLoading && topPoints.length === 0 && data && (
        <div className="flex h-32 items-center justify-center rounded-lg border text-sm text-muted-foreground">
          <div className="text-center">
            <Smartphone className="mx-auto mb-2 h-6 w-6 opacity-40" />
            No active action points to rank.
          </div>
        </div>
      )}
    </div>
  );
}
