'use client';

/**
 * Admin Scan Logs — paginated log table, anomaly alerts, summary stats, CSV export.
 *
 * Backend: /api/v1/admin/qr/scan-logs  (flat array, server-paged)
 *          /api/v1/admin/qr/scan-logs/summary   ({period_days, data})
 *          /api/v1/admin/qr/scan-logs/anomalies ({period_days, anomalies})
 *          /api/v1/admin/qr/scan-logs/export    (CSV stream)
 */

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  MapPin,
  ScanLine,
  Search,
  Shield,
  Smartphone,
  Timer,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  useScanLogs,
  useScanLogSummary,
  useScanLogAnomalies,
  useExportScanLogs,
  type ScanLogListParams,
} from '@/lib/hooks/admin/use-scan-logs';
import type { QRActionType } from '@/types/admin';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 50;

const ACTION_TYPE_META: Record<string, { emoji: string; label: string; color: string }> = {
  mess_entry:         { emoji: '🍽️', label: 'Mess',              color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  hostel_checkin:     { emoji: '🏠', label: 'Hostel',            color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  library_visit:      { emoji: '📚', label: 'Library',           color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
  library_checkout:   { emoji: '📖', label: 'Lib Checkout',      color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
  library_return:     { emoji: '📕', label: 'Lib Return',        color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
  attendance_mark:    { emoji: '✅', label: 'Attendance',         color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  equipment_checkout: { emoji: '🔧', label: 'Equipment',         color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  event_checkin:      { emoji: '🎫', label: 'Event',             color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' },
  exam_hall_entry:    { emoji: '📝', label: 'Exam',              color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  transport_boarding: { emoji: '🚌', label: 'Transport',         color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  clinical_posting:   { emoji: '🏥', label: 'Clinical',          color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
  fee_payment:        { emoji: '💰', label: 'Fee',               color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  visitor_entry:      { emoji: '🚪', label: 'Visitor',           color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  certificate_verify: { emoji: '📜', label: 'Certificate',       color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
};

const RESULT_META: Record<string, { icon: string; label: string; color: string }> = {
  success:          { icon: '✓', label: 'Success',          color: 'text-emerald-600 dark:text-emerald-400' },
  duplicate_scan:   { icon: '↻', label: 'Duplicate',        color: 'text-gray-500' },
  expired_token:    { icon: '⏰', label: 'Expired Token',    color: 'text-amber-600 dark:text-amber-400' },
  device_mismatch:  { icon: '🔒', label: 'Device Mismatch', color: 'text-red-600 dark:text-red-400' },
  geo_violation:    { icon: '📍', label: 'Outside Range',    color: 'text-red-600 dark:text-red-400' },
  time_violation:   { icon: '🕐', label: 'Time Violation',   color: 'text-red-600 dark:text-red-400' },
  revoked_device:   { icon: '🚫', label: 'Revoked Device',  color: 'text-red-600 dark:text-red-400' },
  unauthorized:     { icon: '⛔', label: 'Unauthorized',     color: 'text-red-600 dark:text-red-400' },
  invalid_qr:       { icon: '❌', label: 'Invalid QR',       color: 'text-red-600 dark:text-red-400' },
  no_handler:       { icon: '?',  label: 'No Handler',       color: 'text-red-600 dark:text-red-400' },
};

const ANOMALY_COLORS: Record<string, string> = {
  device_mismatch: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300',
  geo_violation:   'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300',
  revoked_device:  'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300',
  unauthorized:    'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300',
  expired_token:   'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300',
  time_violation:  'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300',
  duplicate_scan:  'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-400',
};
const DEFAULT_ANOMALY_COLOR = 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }) + ', ' + d.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function truncateUUID(uuid: string) {
  return uuid.length > 12 ? `${uuid.slice(0, 8)}…` : uuid;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-muted" />
        </td>
      ))}
    </tr>
  );
}

function StatMini({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <p className={`text-xl font-bold ${color ?? ''}`}>{value}</p>
      <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ScanLogsPage() {
  // ---- Filters ----
  const [typeFilter, setTypeFilter] = useState('');
  const [resultFilter, setResultFilter] = useState('');
  const [dateFrom, setDateFrom] = useState(todayISO());
  const [dateTo, setDateTo] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [page, setPage] = useState(1);

  const clearFilters = useCallback(() => {
    setTypeFilter('');
    setResultFilter('');
    setDateFrom(todayISO());
    setDateTo('');
    setUserSearch('');
    setPage(1);
  }, []);

  // Build query params for the list endpoint
  const queryParams = useMemo<ScanLogListParams>(() => {
    const p: ScanLogListParams = { page, page_size: PAGE_SIZE };
    if (typeFilter) p.action_type = typeFilter;
    if (resultFilter === '__failures__') {
      // We can't send "failures only" as a single param — we'll filter client-side
      // Actually, there's no single param for "all failures". We'll leave validation_result
      // empty and filter client-side, or pick a specific result. For simplicity, send nothing
      // and filter client-side. But that breaks server pagination...
      // Better approach: don't send validation_result, fetch all, filter client-side for
      // the "failures only" case. But that means we might miss some.
      // Since the backend doesn't support "not success", let's just not set it and note the limitation.
    } else if (resultFilter) {
      p.validation_result = resultFilter;
    }
    if (dateFrom) p.date_from = `${dateFrom}T00:00:00Z`;
    if (dateTo) p.date_to = `${dateTo}T23:59:59Z`;
    if (userSearch.trim()) p.user_id = userSearch.trim();
    return p;
  }, [typeFilter, resultFilter, dateFrom, dateTo, userSearch, page]);

  // ---- Data ----
  const { data: logs, isLoading, error } = useScanLogs(queryParams);
  const { data: summary, isLoading: summaryLoading } = useScanLogSummary(7);
  const { data: anomaliesData, isLoading: anomaliesLoading } = useScanLogAnomalies(7);

  // Client-side filter for "failures only" since backend can't do != success
  const displayLogs = useMemo(() => {
    if (!logs) return [];
    if (resultFilter === '__failures__') {
      return logs.filter((l) => l.validation_result !== 'success');
    }
    return logs;
  }, [logs, resultFilter]);

  // ---- Summary stats (aggregated from summary data) ----
  const summaryStats = useMemo(() => {
    if (!summary?.data) return null;
    const today = todayISO();
    const todayRows = summary.data.filter((d) => d.date === today);
    const totalToday = todayRows.reduce((s, r) => s + r.count, 0);

    // Most active action type today
    let mostActive = '—';
    let maxCount = 0;
    for (const row of todayRows) {
      if (row.count > maxCount) {
        maxCount = row.count;
        const meta = ACTION_TYPE_META[row.action_type];
        mostActive = meta ? `${meta.emoji} ${meta.label}` : row.action_type;
      }
    }

    return { totalToday, mostActive };
  }, [summary]);

  const anomalyStats = useMemo(() => {
    if (!anomaliesData?.anomalies) return null;
    const totalFailures = anomaliesData.anomalies.reduce((s, a) => s + a.count, 0);
    return { totalFailures, items: anomaliesData.anomalies };
  }, [anomaliesData]);

  // Compute today's success rate from logs (approximate — based on current page)
  // Better: derive from summary data
  const successRate = useMemo(() => {
    if (!logs || logs.length === 0) return null;
    const success = logs.filter((l) => l.validation_result === 'success').length;
    return Math.round((success / logs.length) * 100);
  }, [logs]);

  // ---- Anomaly expand ----
  const [anomalyExpanded, setAnomalyExpanded] = useState(false);

  // ---- Export ----
  const { exportCsv } = useExportScanLogs();
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      await exportCsv({
        action_type: typeFilter || undefined,
        date_from: dateFrom ? `${dateFrom}T00:00:00Z` : undefined,
        date_to: dateTo ? `${dateTo}T23:59:59Z` : undefined,
      });
    } finally {
      setExporting(false);
    }
  }, [exportCsv, typeFilter, dateFrom, dateTo]);

  // ---- Pagination ----
  const hasNextPage = (logs?.length ?? 0) >= PAGE_SIZE;
  const hasPrevPage = page > 1;

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
            <h1 className="text-3xl font-bold">Scan Logs</h1>
            <p className="text-muted-foreground">
              View all QR scan activity with filtering by action type, user, date, and validation result
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={exporting}>
          {exporting ? (
            <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Export CSV
        </Button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Summary stat strip */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {summaryLoading || anomaliesLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border p-3">
              <div className="mx-auto mb-1 h-6 w-12 rounded bg-muted" />
              <div className="mx-auto h-3 w-20 rounded bg-muted" />
            </div>
          ))
        ) : (
          <>
            <StatMini label="Successful Scans Today" value={summaryStats?.totalToday ?? 0} color="text-emerald-600" />
            <StatMini
              label="Success Rate (this page)"
              value={successRate != null ? `${successRate}%` : '—'}
              color={
                successRate == null
                  ? undefined
                  : successRate >= 90
                    ? 'text-emerald-600'
                    : successRate >= 70
                      ? 'text-yellow-600'
                      : 'text-red-600'
              }
            />
            <StatMini label="Most Active Today" value={summaryStats?.mostActive ?? '—'} />
            <StatMini
              label="Failures (7d)"
              value={anomalyStats?.totalFailures ?? 0}
              color={(anomalyStats?.totalFailures ?? 0) > 10 ? 'text-red-600' : undefined}
            />
            <StatMini label="Anomaly Types" value={anomalyStats?.items.length ?? 0} />
          </>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Anomaly alert */}
      {/* ------------------------------------------------------------------ */}
      {anomalyStats && anomalyStats.totalFailures > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3 text-sm"
            onClick={() => setAnomalyExpanded((v) => !v)}
          >
            <span className="flex items-center gap-2 font-medium text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              {anomalyStats.totalFailures} scan failure{anomalyStats.totalFailures !== 1 ? 's' : ''} detected in the last 7 days
            </span>
            {anomalyExpanded ? (
              <ChevronUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            )}
          </button>

          {anomalyExpanded && (
            <div className="border-t border-amber-200 px-4 py-3 dark:border-amber-800">
              <div className="flex flex-wrap gap-2">
                {anomalyStats.items.map((a, i) => {
                  const colorClass = ANOMALY_COLORS[a.validation_result] ?? DEFAULT_ANOMALY_COLOR;
                  const meta = RESULT_META[a.validation_result];
                  return (
                    <span
                      key={i}
                      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${colorClass}`}
                    >
                      <span>{meta?.icon ?? '!'}</span>
                      {a.validation_result.replace(/_/g, ' ')}
                      {a.rejection_reason && (
                        <span className="opacity-70">({a.rejection_reason})</span>
                      )}
                      <span className="ml-1 font-bold">{a.count}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Filters */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground">From</label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="h-9 w-36"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground">To</label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="h-9 w-36"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground">Type</label>
          <FilterDropdown
            label="Action Type"
            value={typeFilter}
            onChange={(v) => { setTypeFilter(v); setPage(1); }}
            options={[
              { value: '', label: 'All Types' },
              ...Object.entries(ACTION_TYPE_META).map(([k, v]) => ({
                value: k,
                label: `${v.emoji} ${v.label}`,
              })),
            ]}
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground">Result</label>
          <FilterDropdown
            label="Result"
            value={resultFilter}
            onChange={(v) => { setResultFilter(v); setPage(1); }}
            options={[
              { value: '', label: 'All Results' },
              { value: '__failures__', label: 'Failures Only' },
              ...Object.entries(RESULT_META).map(([k, v]) => ({
                value: k,
                label: `${v.icon} ${v.label}`,
              })),
            ]}
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground">User ID</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Paste user UUID…"
              value={userSearch}
              onChange={(e) => { setUserSearch(e.target.value); setPage(1); }}
              className="h-9 w-44 pl-8 text-xs"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground">&nbsp;</label>
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
            <X className="mr-1 h-3.5 w-3.5" /> Clear
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Error */}
      {/* ------------------------------------------------------------------ */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          Failed to load scan logs: {error.message}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Table */}
      {/* ------------------------------------------------------------------ */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Time</th>
              <th className="px-4 py-3 text-left font-medium">User</th>
              <th className="px-4 py-3 text-left font-medium">Action</th>
              <th className="hidden px-4 py-3 text-left font-medium sm:table-cell">Mode</th>
              <th className="px-4 py-3 text-left font-medium">Result</th>
              <th className="hidden px-4 py-3 text-left font-medium md:table-cell">GPS</th>
              <th className="hidden px-4 py-3 text-left font-medium md:table-cell">Device</th>
              <th className="hidden px-4 py-3 text-left font-medium lg:table-cell">Rejection Reason</th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={8} />)}

            {!isLoading && displayLogs.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center text-muted-foreground">
                  <ScanLine className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  No scan logs found for the selected filters.
                </td>
              </tr>
            )}

            {displayLogs.map((log) => {
              const actionMeta = ACTION_TYPE_META[log.action_type] ?? {
                emoji: '?',
                label: log.action_type,
                color: 'bg-gray-100 text-gray-700',
              };
              const resMeta = RESULT_META[log.validation_result] ?? {
                icon: '!',
                label: log.validation_result.replace(/_/g, ' '),
                color: 'text-red-600 dark:text-red-400',
              };
              const isSuccess = log.validation_result === 'success';

              return (
                <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  {/* Time */}
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    {formatDateTime(log.scanned_at)}
                  </td>

                  {/* User */}
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs" title={log.user_id}>
                      {truncateUUID(log.user_id)}
                    </span>
                    {log.user_type && (
                      <span className="ml-1.5 text-[10px] text-muted-foreground">{log.user_type}</span>
                    )}
                  </td>

                  {/* Action type badge */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${actionMeta.color}`}>
                      <span>{actionMeta.emoji}</span> {actionMeta.label}
                    </span>
                  </td>

                  {/* Mode */}
                  <td className="hidden px-4 py-3 sm:table-cell text-xs">
                    {log.qr_mode === 'mode_a' ? 'A' : log.qr_mode === 'mode_b' ? 'B' : log.qr_mode ?? '—'}
                  </td>

                  {/* Result */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${resMeta.color}`}>
                      <span>{resMeta.icon}</span> {resMeta.label}
                    </span>
                  </td>

                  {/* GPS */}
                  <td className="hidden px-4 py-3 md:table-cell">
                    {log.geo_validated === true ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                        <Check className="h-3 w-3" /> Verified
                      </span>
                    ) : log.scan_latitude != null ? (
                      <span className="text-xs text-muted-foreground">Recorded</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>

                  {/* Device */}
                  <td className="hidden px-4 py-3 md:table-cell">
                    {log.device_validated ? (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400">✓</span>
                    ) : (
                      <span className="text-xs text-red-500">✗</span>
                    )}
                  </td>

                  {/* Rejection reason */}
                  <td className="hidden px-4 py-3 lg:table-cell">
                    {!isSuccess && log.rejection_reason ? (
                      <span className="text-xs text-red-500/80">{log.rejection_reason}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Pagination */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Page {page} &middot; {displayLogs.length} row{displayLogs.length !== 1 ? 's' : ''}
          {displayLogs.length >= PAGE_SIZE && ' (more available)'}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!hasPrevPage}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasNextPage}
            onClick={() => setPage((p) => p + 1)}
          >
            Next <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
