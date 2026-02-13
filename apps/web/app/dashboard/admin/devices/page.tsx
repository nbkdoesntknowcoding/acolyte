"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  RefreshCw,
  Smartphone,
  ShieldCheck,
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  RotateCcw,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/admin/stat-card";
import {
  useDevices,
  useDeviceStats,
  useFlaggedUsers,
  useResetDevice,
  type DeviceListParams,
} from "@/lib/hooks/admin/use-devices";

// ---------------------------------------------------------------------------
// Style maps
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-900/20 text-green-400 border-green-900/30",
  revoked: "bg-red-900/20 text-red-400 border-red-900/30",
  expired: "bg-gray-800 text-gray-400 border-gray-700",
  pending_sms_verification: "bg-yellow-900/20 text-yellow-400 border-yellow-900/30",
  transferred: "bg-blue-900/20 text-blue-400 border-blue-900/30",
  verification_failed: "bg-red-900/20 text-red-400 border-red-900/30",
  suspended: "bg-orange-900/20 text-orange-400 border-orange-900/30",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  revoked: "Revoked",
  expired: "Expired",
  pending_sms_verification: "Pending",
  transferred: "Transferred",
  verification_failed: "Failed",
  suspended: "Suspended",
};

const PLATFORM_STYLES: Record<string, string> = {
  android: "bg-green-900/20 text-green-400 border-green-900/30",
  ios: "bg-blue-900/20 text-blue-400 border-blue-900/30",
};

const STATUSES = ["active", "revoked", "expired", "pending_sms_verification", "transferred", "suspended"];
const PLATFORMS = ["android", "ios"];
const PAGE_SIZES = [10, 25, 50, 100];

const RESET_REASONS = [
  { value: "phone_lost", label: "Phone Lost" },
  { value: "phone_stolen", label: "Phone Stolen" },
  { value: "phone_upgraded", label: "Phone Upgraded" },
  { value: "security_concern", label: "Security Concern" },
  { value: "other", label: "Other" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  if (phone.length >= 10) {
    return phone.slice(0, phone.length - 4).replace(/./g, "*") + phone.slice(-4);
  }
  return phone;
}

function relativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function truncateUUID(uuid: string): string {
  return uuid.slice(0, 8) + "...";
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function DeviceManagementPage() {
  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [platformFilter, setPlatformFilter] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Reset dialog
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<{ userId: string; deviceModel: string | null } | null>(null);
  const [resetReason, setResetReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  // Messages
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Dropdown
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Flagged expand
  const [flaggedExpanded, setFlaggedExpanded] = useState(false);

  // Debounce search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  // Query params
  const params: DeviceListParams = {
    page,
    page_size: pageSize,
    search: debouncedSearch || undefined,
    status: statusFilter,
    platform: platformFilter,
  };

  // Hooks
  const { data: deviceData, isLoading, isError, error, refetch } = useDevices(params);
  const { data: stats, isLoading: statsLoading } = useDeviceStats();
  const { data: flaggedUsers } = useFlaggedUsers(3, 30);
  const resetDevice = useResetDevice();

  const devices = useMemo(() => deviceData?.data ?? [], [deviceData?.data]);
  const total = deviceData?.total ?? 0;
  const totalPages = deviceData?.total_pages ?? 1;

  // Reset page on filter change
  const applyFilter = useCallback(
    (setter: (v: string | undefined) => void, value: string | undefined) => {
      setter(value);
      setPage(1);
    },
    []
  );

  // Close dropdown on outside click
  useEffect(() => {
    if (!openDropdown) return;
    const handler = () => setOpenDropdown(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [openDropdown]);

  // Reset handlers
  const openResetDialog = useCallback((userId: string, deviceModel: string | null) => {
    setResetTarget({ userId, deviceModel });
    setResetReason("");
    setAdminNotes("");
    setResetDialogOpen(true);
    setOpenDropdown(null);
  }, []);

  const handleReset = useCallback(async () => {
    if (!resetTarget || !resetReason) {
      setErrorMessage("Please select a reason for device reset.");
      return;
    }
    try {
      await resetDevice.mutateAsync({
        userId: resetTarget.userId,
        reason: resetReason,
        admin_notes: adminNotes || undefined,
      });
      setSuccessMessage("Device reset successful.");
      setResetDialogOpen(false);
      setResetTarget(null);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to reset device.");
    }
  }, [resetTarget, resetReason, adminNotes, resetDevice]);

  // Auto-clear messages
  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(""), 5000);
    return () => clearTimeout(t);
  }, [successMessage]);

  useEffect(() => {
    if (!errorMessage) return;
    const t = setTimeout(() => setErrorMessage(""), 5000);
    return () => clearTimeout(t);
  }, [errorMessage]);

  // Pagination
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  // Platform donut percentages
  const androidCount = stats?.by_platform?.android ?? 0;
  const iosCount = stats?.by_platform?.ios ?? 0;
  const platformTotal = androidCount + iosCount;
  const androidPct = platformTotal > 0 ? Math.round((androidCount / platformTotal) * 100) : 0;
  const iosPct = platformTotal > 0 ? 100 - androidPct : 0;

  return (
    <div className="space-y-6">
      {/* Success / Error banners */}
      {successMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          {successMessage}
          <button onClick={() => setSuccessMessage("")} className="ml-auto">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {errorMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {errorMessage}
          <button onClick={() => setErrorMessage("")} className="ml-auto">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">Device Management</h1>
          {!statsLoading && stats && (
            <Badge className="border-emerald-500/20 bg-emerald-500/10 text-xs font-semibold text-emerald-500">
              {stats.total_registered} Devices
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="rounded-md p-2 text-gray-400 hover:bg-dark-elevated hover:text-gray-200"
            title="Refresh"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* ═══════════ Section A: Stats Bar ═══════════ */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg border border-dark-border bg-dark-surface" />
          ))
        ) : (
          <>
            <StatCard
              title="Total Registered"
              value={String(stats?.total_registered ?? 0)}
              subtitle="All time"
              icon={<Smartphone className="h-4 w-4 text-emerald-500" />}
              iconBg="bg-emerald-500/10"
            />
            <StatCard
              title="Active Devices"
              value={String(stats?.active_count ?? 0)}
              subtitle="Currently active"
              icon={<ShieldCheck className="h-4 w-4 text-green-400" />}
              iconBg="bg-green-500/10"
              highlight
            />
            <StatCard
              title="Revoked"
              value={String(stats?.revoked_count ?? 0)}
              subtitle="Reset or revoked"
              icon={<AlertTriangle className="h-4 w-4 text-red-400" />}
              iconBg="bg-red-500/10"
            />
            <StatCard
              title="This Week"
              value={String(stats?.registrations_this_week ?? 0)}
              subtitle="New registrations"
              icon={<RotateCcw className="h-4 w-4 text-purple-400" />}
              iconBg="bg-purple-500/10"
            />
            {/* Mini platform donut */}
            <div className="flex items-center gap-4 rounded-lg border border-dark-border bg-dark-surface p-4">
              <div className="relative h-16 w-16 shrink-0">
                <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
                  <circle
                    cx="18" cy="18" r="15.915"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="text-gray-700"
                  />
                  {platformTotal > 0 && (
                    <>
                      <circle
                        cx="18" cy="18" r="15.915"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeDasharray={`${androidPct} ${100 - androidPct}`}
                        className="text-green-500"
                      />
                      <circle
                        cx="18" cy="18" r="15.915"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeDasharray={`${iosPct} ${100 - iosPct}`}
                        strokeDashoffset={`-${androidPct}`}
                        className="text-blue-500"
                      />
                    </>
                  )}
                </svg>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-gray-400">Android</span>
                  <span className="font-medium text-white">{androidCount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  <span className="text-gray-400">iOS</span>
                  <span className="font-medium text-white">{iosCount}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ═══════════ Section B: Flagged Accounts Alert ═══════════ */}
      {flaggedUsers && flaggedUsers.length > 0 && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5">
          <button
            onClick={() => setFlaggedExpanded(!flaggedExpanded)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left"
          >
            <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-500" />
            <span className="flex-1 text-sm font-medium text-yellow-400">
              {flaggedUsers.length} account{flaggedUsers.length !== 1 ? "s" : ""} flagged for suspicious device resets
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-yellow-500 transition-transform",
                flaggedExpanded && "rotate-180"
              )}
            />
          </button>
          {flaggedExpanded && (
            <div className="border-t border-yellow-500/20 px-4 pb-4">
              <table className="mt-3 w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase text-gray-400">
                    <th className="pb-2 font-semibold">User ID</th>
                    <th className="pb-2 font-semibold">Reset Count</th>
                    <th className="pb-2 font-semibold">Last Reset</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-border">
                  {flaggedUsers.map((u) => (
                    <tr key={u.user_id} className="text-gray-300">
                      <td className="py-2 font-mono text-xs">{truncateUUID(u.user_id)}</td>
                      <td className="py-2">
                        <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-400">
                          {u.reset_count}x
                        </span>
                      </td>
                      <td className="py-2 text-xs text-gray-400">
                        {u.last_reset_at ? relativeTime(u.last_reset_at) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ Section C: Device Registry Table ═══════════ */}

      {/* Filter Bar */}
      <div className="rounded-xl border border-dark-border bg-dark-surface p-4 shadow-sm">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex flex-1 items-center gap-3 overflow-x-auto pb-2 md:pb-0">
            {/* Search */}
            <div className="relative w-full shrink-0 md:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                className="w-full rounded-lg border border-gray-700 bg-dark-elevated py-2 pl-9 pr-4 text-sm text-gray-200 placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="Search by phone or device model..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="mx-2 hidden h-8 w-px bg-gray-700 md:block" />

            {/* Filter chips */}
            <div className="flex gap-2">
              <FilterDropdown
                label="Status"
                value={statusFilter}
                options={STATUSES}
                displayMap={STATUS_LABELS}
                onChange={(v) => applyFilter(setStatusFilter, v)}
              />
              <FilterDropdown
                label="Platform"
                value={platformFilter}
                options={PLATFORMS}
                onChange={(v) => applyFilter(setPlatformFilter, v)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="hidden md:inline">
              {total > 0
                ? `Showing ${startItem}-${endItem} of ${total}`
                : "No results"}
            </span>
          </div>
        </div>
      </div>

      {/* Error State */}
      {isError && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-8 text-center">
          <AlertTriangle className="h-8 w-8 text-red-400" />
          <p className="text-sm text-red-400">
            {error?.message || "Failed to load devices"}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      )}

      {/* Data Table */}
      {!isError && (
        <div className="overflow-hidden rounded-xl border border-dark-border bg-dark-surface shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-dark-border bg-dark-elevated/50 text-xs font-semibold uppercase text-gray-400">
                  <th className="p-4 min-w-[120px]">User</th>
                  <th className="p-4">Platform</th>
                  <th className="p-4 min-w-[140px]">Device Model</th>
                  <th className="p-4">Phone</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4">Last Active</th>
                  <th className="p-4 text-right">Scans</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border text-sm">
                {isLoading &&
                  Array.from({ length: Math.min(pageSize, 10) }).map((_, i) => (
                    <SkeletonRow key={i} />
                  ))}
                {!isLoading &&
                  devices.map((d) => {
                    const statusLabel = STATUS_LABELS[d.status] ?? d.status;
                    return (
                      <tr
                        key={d.id}
                        className="group transition-colors hover:bg-dark-elevated/30"
                      >
                        <td className="p-4 font-mono text-xs text-gray-300">
                          {truncateUUID(d.user_id)}
                        </td>
                        <td className="p-4">
                          <span
                            className={cn(
                              "inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                              PLATFORM_STYLES[d.platform] ?? "bg-gray-800 text-gray-300 border-gray-700"
                            )}
                          >
                            {d.platform}
                          </span>
                        </td>
                        <td className="p-4 text-gray-200">{d.device_model || "—"}</td>
                        <td className="p-4 font-mono text-xs text-gray-400">
                          {maskPhone(d.verified_phone)}
                        </td>
                        <td className="p-4 text-center">
                          <span
                            className={cn(
                              "inline-flex items-center rounded border px-2 py-1 text-xs font-medium",
                              STATUS_STYLES[d.status] ?? "bg-gray-800 text-gray-400 border-gray-700"
                            )}
                          >
                            {statusLabel}
                          </span>
                        </td>
                        <td className="p-4 text-xs text-gray-400">
                          {relativeTime(d.last_active_at)}
                        </td>
                        <td className="p-4 text-right font-medium text-white">
                          {d.total_qr_scans}
                        </td>
                        <td className="relative p-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDropdown(openDropdown === d.id ? null : d.id);
                            }}
                            className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-dark-elevated hover:text-emerald-500"
                          >
                            <MoreVertical className="h-[18px] w-[18px]" />
                          </button>
                          {openDropdown === d.id && (
                            <div className="absolute right-4 top-12 z-20 w-44 rounded-lg border border-dark-border bg-dark-surface py-1 shadow-lg">
                              {d.status === "active" && (
                                <button
                                  onClick={() => openResetDialog(d.user_id, d.device_model)}
                                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  Reset Device
                                </button>
                              )}
                              <button
                                onClick={() => setOpenDropdown(null)}
                                className="block w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-dark-elevated hover:text-white"
                              >
                                View Details
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* Empty state */}
          {!isLoading && devices.length === 0 && (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <Smartphone className="h-8 w-8 text-gray-600" />
              <p className="text-sm text-gray-400">
                No registered devices yet. Devices are registered when users install the mobile app.
              </p>
            </div>
          )}

          {/* Pagination */}
          {total > 0 && (
            <div className="flex flex-col items-center justify-between gap-3 border-t border-dark-border px-4 py-3 sm:flex-row">
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>
                  Showing{" "}
                  <span className="font-medium text-white">{startItem}</span> to{" "}
                  <span className="font-medium text-white">{endItem}</span> of{" "}
                  <span className="font-medium text-white">{total}</span> results
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded border border-gray-700 bg-dark-elevated px-2 py-1 text-xs text-gray-300 focus:border-emerald-500 focus:outline-none"
                >
                  {PAGE_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s} / page
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                  Previous
                </Button>
                <PageButtons current={page} total={totalPages} onChange={setPage} />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                  <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ Reset Device Dialog ═══════════ */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Device Registration</DialogTitle>
            <DialogDescription>
              This will revoke the device registration for user{" "}
              <span className="font-mono text-white">
                {resetTarget ? truncateUUID(resetTarget.userId) : ""}
              </span>
              {resetTarget?.deviceModel && (
                <> ({resetTarget.deviceModel})</>
              )}
              . They will need to re-register with a new device.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="reset-reason">Reason *</Label>
              <select
                id="reset-reason"
                value={resetReason}
                onChange={(e) => setResetReason(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-dark-elevated px-3 py-2 text-sm text-gray-200 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">Select a reason...</option>
                {RESET_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-notes">Admin Notes (optional)</Label>
              <Textarea
                id="admin-notes"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReset}
              disabled={!resetReason || resetDevice.isPending}
            >
              {resetDevice.isPending ? "Resetting..." : "Reset Device"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FilterDropdown({
  label,
  value,
  options,
  displayMap,
  onChange,
}: {
  label: string;
  value: string | undefined;
  options: string[];
  displayMap?: Record<string, string>;
  onChange: (v: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const displayLabel = value ? (displayMap?.[value] ?? value) : "All";

  if (value) {
    return (
      <button
        onClick={() => onChange(undefined)}
        className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-emerald-500/50 bg-emerald-500/20 px-3 py-1.5 text-sm font-medium text-emerald-500 transition-colors hover:bg-emerald-500/30"
      >
        {label}: {displayLabel}
        <X className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-gray-700 bg-dark-elevated px-3 py-1.5 text-sm font-medium text-gray-300 transition-colors hover:border-emerald-500/50"
      >
        {label}: All
        <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded-lg border border-dark-border bg-dark-surface py-1 shadow-lg">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className="block w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-dark-elevated hover:text-white"
            >
              {displayMap?.[opt] ?? opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-dark-border">
      <td className="p-4"><div className="h-3.5 w-20 animate-pulse rounded bg-gray-700" /></td>
      <td className="p-4"><div className="h-5 w-16 animate-pulse rounded bg-gray-700" /></td>
      <td className="p-4"><div className="h-3.5 w-28 animate-pulse rounded bg-gray-700" /></td>
      <td className="p-4"><div className="h-3.5 w-24 animate-pulse rounded bg-gray-700" /></td>
      <td className="p-4 text-center"><div className="mx-auto h-6 w-14 animate-pulse rounded bg-gray-700" /></td>
      <td className="p-4"><div className="h-3.5 w-16 animate-pulse rounded bg-gray-700" /></td>
      <td className="p-4 text-right"><div className="ml-auto h-3.5 w-8 animate-pulse rounded bg-gray-700" /></td>
      <td className="p-4 text-right"><div className="ml-auto h-5 w-5 animate-pulse rounded bg-gray-700" /></td>
    </tr>
  );
}

function PageButtons({
  current,
  total,
  onChange,
}: {
  current: number;
  total: number;
  onChange: (p: number) => void;
}) {
  if (total <= 5) {
    return (
      <>
        {Array.from({ length: total }, (_, i) => i + 1).map((p) => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={cn(
              "h-8 w-8 rounded text-xs font-medium transition-colors",
              p === current
                ? "bg-emerald-500/20 text-emerald-500"
                : "text-gray-400 hover:bg-dark-elevated hover:text-white"
            )}
          >
            {p}
          </button>
        ))}
      </>
    );
  }

  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push("...");
  if (total > 1) pages.push(total);

  return (
    <>
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`dots-${i}`} className="px-1 text-xs text-gray-500">
            ...
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={cn(
              "h-8 w-8 rounded text-xs font-medium transition-colors",
              p === current
                ? "bg-emerald-500/20 text-emerald-500"
                : "text-gray-400 hover:bg-dark-elevated hover:text-white"
            )}
          >
            {p}
          </button>
        )
      )}
    </>
  );
}
