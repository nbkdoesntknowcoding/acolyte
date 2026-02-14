'use client';

/**
 * Admin QR Action Points — full CRUD, QR generation, scan stats.
 *
 * Backend: /api/v1/admin/qr/action-points (flat array, not paginated wrapper)
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  Printer,
  QrCode,
  Search,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  useActionPoints,
  useCreateActionPoint,
  useUpdateActionPoint,
  useDeactivateActionPoint,
  useGenerateQR,
  useActionPointStats,
  type ActionPointCreateInput,
  type ActionPointUpdateInput,
} from '@/lib/hooks/admin/use-action-points';
import type { QRActionPoint, QRActionType, SecurityLevel } from '@/types/admin';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTION_TYPE_META: Record<QRActionType, { emoji: string; label: string; color: string }> = {
  mess_entry:         { emoji: '🍽️', label: 'Mess Entry',         color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  hostel_checkin:     { emoji: '🏠', label: 'Hostel Check-in',    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  library_visit:      { emoji: '📚', label: 'Library Visit',      color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
  library_checkout:   { emoji: '📖', label: 'Library Checkout',   color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
  library_return:     { emoji: '📕', label: 'Library Return',     color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
  attendance_mark:    { emoji: '✅', label: 'Attendance',          color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  equipment_checkout: { emoji: '🔧', label: 'Equipment Checkout', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  event_checkin:      { emoji: '🎫', label: 'Event Check-in',     color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' },
  exam_hall_entry:    { emoji: '📝', label: 'Exam Hall',          color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  transport_boarding: { emoji: '🚌', label: 'Transport',          color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  clinical_posting:   { emoji: '🏥', label: 'Clinical Posting',   color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
  fee_payment:        { emoji: '💰', label: 'Fee Payment',        color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  visitor_entry:      { emoji: '🚪', label: 'Visitor Entry',      color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  certificate_verify: { emoji: '📜', label: 'Certificate Verify', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
};

const SECURITY_BADGE: Record<SecurityLevel, { label: string; variant: 'outline' | 'info' | 'destructive' }> = {
  standard: { label: 'Standard', variant: 'outline' },
  elevated: { label: 'Elevated', variant: 'info' },
  strict:   { label: 'Strict',   variant: 'destructive' },
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const EMPTY_FORM: ActionPointCreateInput = {
  name: '',
  description: null,
  action_type: 'attendance_mark',
  location_code: '',
  qr_mode: 'mode_a',
  building: null,
  floor: null,
  gps_latitude: null,
  gps_longitude: null,
  geo_radius_meters: 100,
  qr_rotation_minutes: 5,
  duplicate_window_minutes: 30,
  security_level: 'standard',
  active_hours_start: null,
  active_hours_end: null,
  active_days: null,
};

// ---------------------------------------------------------------------------
// Slugify helper (name → location_code)
// ---------------------------------------------------------------------------

function slugify(str: string) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 50);
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

function StatBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border p-4 text-center">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GenerateQRDialog
// ---------------------------------------------------------------------------

function GenerateQRDialog({
  actionPointId,
  open,
  onClose,
}: {
  actionPointId: string | undefined;
  open: boolean;
  onClose: () => void;
}) {
  const { data, isLoading, error } = useGenerateQR(actionPointId, {
    enabled: open && !!actionPointId,
  });

  const handleDownload = useCallback(() => {
    if (!data?.qr_image_base64) return;
    const link = document.createElement('a');
    link.download = `qr-${data.location_code || 'code'}.png`;
    link.href = `data:image/png;base64,${data.qr_image_base64}`;
    link.click();
  }, [data]);

  const handlePrint = useCallback(() => {
    if (!data?.qr_image_base64) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>QR — ${data.action_point_name}</title>
      <style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:system-ui}img{max-width:400px}h2{margin:24px 0 4px}p{color:#666;font-size:14px}</style>
      </head><body>
      <h2>${data.action_point_name}</h2>
      <p>${data.action_type} &mdash; ${data.location_code}</p>
      <img src="data:image/png;base64,${data.qr_image_base64}" />
      <script>window.onload=()=>{window.print()}</script>
      </body></html>
    `);
    win.document.close();
  }, [data]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generated QR Code</DialogTitle>
          <DialogDescription>Print or download this QR code for your action point.</DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        )}
        {error && (
          <p className="text-sm text-destructive">
            {error.message || 'Failed to generate QR code. Only Mode B action points support QR generation.'}
          </p>
        )}
        {data && (
          <div className="flex flex-col items-center gap-4 py-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/png;base64,${data.qr_image_base64}`}
              alt="QR Code"
              className="h-56 w-56 rounded border"
            />
            <div className="text-center">
              <p className="font-medium">{data.action_point_name}</p>
              <p className="text-xs text-muted-foreground">
                {data.action_type} &mdash; {data.location_code}
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleDownload} disabled={!data}>
            <Download className="mr-2 h-4 w-4" /> Download PNG
          </Button>
          <Button onClick={handlePrint} disabled={!data}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// StatsDialog
// ---------------------------------------------------------------------------

function StatsDialog({
  actionPointId,
  actionPointName,
  open,
  onClose,
}: {
  actionPointId: string | undefined;
  actionPointName: string;
  open: boolean;
  onClose: () => void;
}) {
  const { data, isLoading } = useActionPointStats(actionPointId, {
    enabled: open && !!actionPointId,
  });

  const maxCount = useMemo(() => {
    if (!data?.daily_breakdown?.length) return 1;
    return Math.max(...data.daily_breakdown.map((d) => d.count), 1);
  }, [data]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Stats &mdash; {actionPointName}</DialogTitle>
          <DialogDescription>
            Scan statistics for the last {data?.period_days ?? 30} days.
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex h-32 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatBlock label="Total Scans" value={data.total_scans} />
              <StatBlock label="Successful" value={data.successful_scans} />
              <StatBlock
                label="Failed"
                value={data.total_scans - data.successful_scans}
              />
              <StatBlock
                label="Success Rate"
                value={`${data.success_rate}%`}
              />
            </div>

            {data.daily_breakdown.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Daily Trend</p>
                <div className="flex items-end gap-[2px]" style={{ height: 80 }}>
                  {data.daily_breakdown.map((d) => (
                    <div
                      key={d.date}
                      title={`${d.date}: ${d.count}`}
                      className="flex-1 rounded-t bg-emerald-500 transition-all hover:bg-emerald-400"
                      style={{
                        height: `${Math.max((d.count / maxCount) * 100, 4)}%`,
                        minWidth: 3,
                      }}
                    />
                  ))}
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                  <span>{data.daily_breakdown[0]?.date}</span>
                  <span>{data.daily_breakdown[data.daily_breakdown.length - 1]?.date}</span>
                </div>
              </div>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function QRActionPointsPage() {
  // ---- Filters ----
  const [typeFilter, setTypeFilter] = useState('');
  const [buildingFilter, setBuildingFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState<'' | 'true' | 'false'>('');
  const [searchTerm, setSearchTerm] = useState('');

  // ---- Data ----
  const queryParams = useMemo(
    () => ({
      ...(typeFilter ? { action_type: typeFilter } : {}),
      ...(buildingFilter ? { building: buildingFilter } : {}),
      ...(activeFilter !== '' ? { is_active: activeFilter === 'true' } : {}),
    }),
    [typeFilter, buildingFilter, activeFilter],
  );
  const { data: actionPoints, isLoading, error } = useActionPoints(queryParams);

  // Client-side text search over fetched results
  const filteredPoints = useMemo(() => {
    if (!actionPoints) return [];
    if (!searchTerm.trim()) return actionPoints;
    const lower = searchTerm.toLowerCase();
    return actionPoints.filter(
      (ap) =>
        ap.name.toLowerCase().includes(lower) ||
        ap.location_code.toLowerCase().includes(lower) ||
        (ap.building ?? '').toLowerCase().includes(lower),
    );
  }, [actionPoints, searchTerm]);

  // Unique buildings for filter
  const buildingOptions = useMemo(() => {
    if (!actionPoints) return [];
    const bldgs = new Set(actionPoints.map((ap) => ap.building).filter(Boolean) as string[]);
    return Array.from(bldgs).sort();
  }, [actionPoints]);

  // ---- Sheet (create / edit) ----
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingPoint, setEditingPoint] = useState<QRActionPoint | null>(null);
  const [form, setForm] = useState<ActionPointCreateInput>({ ...EMPTY_FORM });
  const [showSchedule, setShowSchedule] = useState(false);
  const [formError, setFormError] = useState('');

  const createMutation = useCreateActionPoint();
  const updateMutation = useUpdateActionPoint();

  const openCreate = useCallback(() => {
    setEditingPoint(null);
    setForm({ ...EMPTY_FORM });
    setFormError('');
    setShowSchedule(false);
    setSheetOpen(true);
  }, []);

  const openEdit = useCallback((ap: QRActionPoint) => {
    setEditingPoint(ap);
    setForm({
      name: ap.name,
      description: ap.description,
      action_type: ap.action_type,
      location_code: ap.location_code,
      qr_mode: ap.qr_mode,
      building: ap.building,
      floor: ap.floor,
      gps_latitude: ap.gps_latitude,
      gps_longitude: ap.gps_longitude,
      geo_radius_meters: ap.geo_radius_meters,
      qr_rotation_minutes: ap.qr_rotation_minutes,
      duplicate_window_minutes: ap.duplicate_window_minutes,
      security_level: ap.security_level,
      active_hours_start: ap.active_hours_start,
      active_hours_end: ap.active_hours_end,
      active_days: ap.active_days?.length ? ap.active_days : null,
    });
    setFormError('');
    setShowSchedule(
      !!(ap.active_hours_start || ap.active_hours_end || ap.active_days?.length),
    );
    setSheetOpen(true);
  }, []);

  const handleNameChange = useCallback(
    (name: string) => {
      setForm((prev) => ({
        ...prev,
        name,
        // Auto-generate location_code only for new action points
        ...(!editingPoint ? { location_code: slugify(name) } : {}),
      }));
    },
    [editingPoint],
  );

  const handleSubmit = useCallback(async () => {
    if (!form.name.trim() || !form.location_code.trim()) {
      setFormError('Name and Location Code are required.');
      return;
    }
    setFormError('');
    try {
      if (editingPoint) {
        const updateData: ActionPointUpdateInput = { ...form };
        await updateMutation.mutateAsync({ id: editingPoint.id, data: updateData });
      } else {
        await createMutation.mutateAsync(form);
      }
      setSheetOpen(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }, [form, editingPoint, createMutation, updateMutation]);

  // ---- Deactivate confirm ----
  const [deactivateTarget, setDeactivateTarget] = useState<QRActionPoint | null>(null);
  const deactivateMutation = useDeactivateActionPoint();

  const confirmDeactivate = useCallback(async () => {
    if (!deactivateTarget) return;
    try {
      await deactivateMutation.mutateAsync(deactivateTarget.id);
      setDeactivateTarget(null);
    } catch {
      // keep dialog open on failure
    }
  }, [deactivateTarget, deactivateMutation]);

  // ---- Generate QR dialog ----
  const [qrTarget, setQrTarget] = useState<QRActionPoint | null>(null);

  // ---- Stats dialog ----
  const [statsTarget, setStatsTarget] = useState<QRActionPoint | null>(null);

  // ---- Row dropdown ----
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // ---- Feedback banner ----
  const successMessage = createMutation.isSuccess || updateMutation.isSuccess || deactivateMutation.isSuccess
    ? editingPoint
      ? 'Action point updated.'
      : deactivateMutation.isSuccess
        ? 'Action point deactivated.'
        : 'Action point created.'
    : null;

  // ---- Summary stats (derived from loaded data) ----
  const stats = useMemo(() => {
    if (!actionPoints) return null;
    const total = actionPoints.length;
    const active = actionPoints.filter((ap) => ap.is_active).length;
    const modeBCount = actionPoints.filter((ap) => ap.qr_mode === 'mode_b').length;
    const uniqueBuildings = new Set(
      actionPoints.map((ap) => ap.building).filter(Boolean),
    ).size;
    return { total, active, modeBCount, uniqueBuildings };
  }, [actionPoints]);

  return (
    <div className="space-y-6 p-6">
      {/* ------------------------------------------------------------------ */}
      {/* Header */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">QR Action Points</h1>
            <p className="text-muted-foreground">
              Configure QR scan locations — mess, library, lecture halls, hostels, and more
            </p>
          </div>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Add Action Point
        </Button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Stat cards */}
      {/* ------------------------------------------------------------------ */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border p-4">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total Action Points</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-2xl font-bold text-emerald-600">{stats.active}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-2xl font-bold">{stats.modeBCount}</p>
            <p className="text-xs text-muted-foreground">Mode B (Static QR)</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-2xl font-bold">{stats.uniqueBuildings}</p>
            <p className="text-xs text-muted-foreground">Buildings</p>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Feedback banners */}
      {/* ------------------------------------------------------------------ */}
      {successMessage && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
          {successMessage}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          Failed to load action points: {error.message}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Filter bar */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, code, building…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <FilterDropdown
          label="Action Type"
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            { value: '', label: 'All Types' },
            ...Object.entries(ACTION_TYPE_META).map(([k, v]) => ({
              value: k,
              label: `${v.emoji} ${v.label}`,
            })),
          ]}
        />

        {buildingOptions.length > 0 && (
          <FilterDropdown
            label="Building"
            value={buildingFilter}
            onChange={setBuildingFilter}
            options={[
              { value: '', label: 'All Buildings' },
              ...buildingOptions.map((b) => ({ value: b, label: b })),
            ]}
          />
        )}

        <FilterDropdown
          label="Status"
          value={activeFilter}
          onChange={(v) => setActiveFilter(v as '' | 'true' | 'false')}
          options={[
            { value: '', label: 'All Status' },
            { value: 'true', label: 'Active' },
            { value: 'false', label: 'Inactive' },
          ]}
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Table */}
      {/* ------------------------------------------------------------------ */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Action Type</th>
              <th className="px-4 py-3 text-left font-medium">QR Mode</th>
              <th className="hidden px-4 py-3 text-left font-medium md:table-cell">Building / Floor</th>
              <th className="hidden px-4 py-3 text-left font-medium lg:table-cell">Security</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={7} />)}

            {!isLoading && filteredPoints.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">
                  <QrCode className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {actionPoints?.length === 0
                    ? 'No action points yet. Click "Add Action Point" to create one.'
                    : 'No action points match your filters.'}
                </td>
              </tr>
            )}

            {filteredPoints.map((ap) => {
              const meta = ACTION_TYPE_META[ap.action_type] ?? {
                emoji: '?',
                label: ap.action_type,
                color: 'bg-gray-100 text-gray-700',
              };
              const secBadge = SECURITY_BADGE[ap.security_level] ?? SECURITY_BADGE.standard;

              return (
                <tr key={ap.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  {/* Name + location_code */}
                  <td className="px-4 py-3">
                    <p className="font-medium">{ap.name}</p>
                    <p className="text-xs text-muted-foreground">{ap.location_code}</p>
                  </td>

                  {/* Action type badge */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.color}`}>
                      <span>{meta.emoji}</span> {meta.label}
                    </span>
                  </td>

                  {/* QR Mode */}
                  <td className="px-4 py-3 text-xs">
                    {ap.qr_mode === 'mode_a' ? 'Mode A (Dynamic)' : 'Mode B (Static)'}
                  </td>

                  {/* Building / Floor */}
                  <td className="hidden px-4 py-3 md:table-cell">
                    {ap.building ? (
                      <span className="text-xs">
                        {ap.building}
                        {ap.floor != null && <span className="text-muted-foreground"> / F{ap.floor}</span>}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>

                  {/* Security */}
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <Badge variant={secBadge.variant} className="text-xs">
                      {secBadge.label}
                    </Badge>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          ap.is_active ? 'bg-emerald-500' : 'bg-gray-400'
                        }`}
                      />
                      {ap.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>

                  {/* Actions dropdown */}
                  <td className="px-4 py-3 text-right">
                    <div className="relative inline-block">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setOpenMenuId(openMenuId === ap.id ? null : ap.id)}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>

                      {openMenuId === ap.id && (
                        <div
                          ref={menuRef}
                          className="absolute right-0 z-20 mt-1 w-44 rounded-md border bg-popover p-1 shadow-md"
                          onMouseLeave={() => setOpenMenuId(null)}
                        >
                          <button
                            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                            onClick={() => { openEdit(ap); setOpenMenuId(null); }}
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </button>

                          {ap.qr_mode === 'mode_b' && (
                            <button
                              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                              onClick={() => { setQrTarget(ap); setOpenMenuId(null); }}
                            >
                              <QrCode className="h-3.5 w-3.5" /> Generate QR
                            </button>
                          )}

                          <button
                            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                            onClick={() => { setStatsTarget(ap); setOpenMenuId(null); }}
                          >
                            <Eye className="h-3.5 w-3.5" /> View Stats
                          </button>

                          {ap.is_active && (
                            <button
                              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
                              onClick={() => { setDeactivateTarget(ap); setOpenMenuId(null); }}
                            >
                              <Power className="h-3.5 w-3.5" /> Deactivate
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Create / Edit Sheet */}
      {/* ------------------------------------------------------------------ */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{editingPoint ? 'Edit Action Point' : 'Create Action Point'}</SheetTitle>
            <SheetDescription>
              {editingPoint
                ? `Editing "${editingPoint.name}"`
                : 'Configure a new QR scan location.'}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* -- Basic Info -- */}
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold">Basic Info</legend>

              <div className="space-y-1">
                <Label htmlFor="ap-name">Name *</Label>
                <Input
                  id="ap-name"
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Main Mess Hall Entry"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="ap-loc">Location Code *</Label>
                <Input
                  id="ap-loc"
                  value={form.location_code}
                  onChange={(e) => setForm((p) => ({ ...p, location_code: e.target.value }))}
                  placeholder="main-mess-hall-entry"
                />
                <p className="text-xs text-muted-foreground">Unique slug identifying this location.</p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="ap-desc">Description</Label>
                <Textarea
                  id="ap-desc"
                  value={form.description ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value || null }))}
                  rows={2}
                  placeholder="Optional description for admins"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="ap-type">Action Type *</Label>
                <select
                  id="ap-type"
                  value={form.action_type}
                  onChange={(e) => setForm((p) => ({ ...p, action_type: e.target.value }))}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {Object.entries(ACTION_TYPE_META).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.emoji} {v.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label>QR Mode *</Label>
                <div className="flex gap-4">
                  {(['mode_a', 'mode_b'] as const).map((mode) => (
                    <label key={mode} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="qr_mode"
                        value={mode}
                        checked={form.qr_mode === mode}
                        onChange={() => setForm((p) => ({ ...p, qr_mode: mode }))}
                        className="accent-emerald-600"
                      />
                      {mode === 'mode_a' ? 'Mode A — Dynamic (app-generated)' : 'Mode B — Static (printed QR)'}
                    </label>
                  ))}
                </div>
              </div>
            </fieldset>

            {/* -- Location -- */}
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold">Location</legend>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="ap-bldg">Building</Label>
                  <Input
                    id="ap-bldg"
                    value={form.building ?? ''}
                    onChange={(e) => setForm((p) => ({ ...p, building: e.target.value || null }))}
                    placeholder="Main Block"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ap-floor">Floor</Label>
                  <Input
                    id="ap-floor"
                    type="number"
                    value={form.floor ?? ''}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        floor: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="ap-lat">GPS Latitude</Label>
                  <Input
                    id="ap-lat"
                    type="number"
                    step="any"
                    value={form.gps_latitude ?? ''}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        gps_latitude: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ap-lng">GPS Longitude</Label>
                  <Input
                    id="ap-lng"
                    type="number"
                    step="any"
                    value={form.gps_longitude ?? ''}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        gps_longitude: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="ap-radius">Geo Radius (meters)</Label>
                <Input
                  id="ap-radius"
                  type="number"
                  value={form.geo_radius_meters ?? 100}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      geo_radius_meters: e.target.value ? Number(e.target.value) : 100,
                    }))
                  }
                />
              </div>
            </fieldset>

            {/* -- Security -- */}
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold">Security</legend>
              <div className="space-y-1">
                <Label>Security Level</Label>
                <div className="flex gap-4">
                  {(['standard', 'elevated', 'strict'] as const).map((level) => (
                    <label key={level} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="security_level"
                        value={level}
                        checked={form.security_level === level}
                        onChange={() => setForm((p) => ({ ...p, security_level: level }))}
                        className="accent-emerald-600"
                      />
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Strict requires device trust + geo + biometric. Elevated needs device + geo.
                </p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="ap-dup">Duplicate Window (minutes)</Label>
                <Input
                  id="ap-dup"
                  type="number"
                  value={form.duplicate_window_minutes ?? 30}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      duplicate_window_minutes: e.target.value ? Number(e.target.value) : 30,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Ignore repeat scans from the same user within this window.
                </p>
              </div>
            </fieldset>

            {/* -- Schedule (collapsible) -- */}
            <fieldset className="space-y-4">
              <button
                type="button"
                className="flex items-center gap-2 text-sm font-semibold"
                onClick={() => setShowSchedule((v) => !v)}
              >
                {showSchedule ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                Schedule (optional)
              </button>

              {showSchedule && (
                <div className="space-y-4 pl-1">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="ap-hrs-start">Active Hours Start</Label>
                      <Input
                        id="ap-hrs-start"
                        type="time"
                        value={form.active_hours_start ?? ''}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, active_hours_start: e.target.value || null }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="ap-hrs-end">Active Hours End</Label>
                      <Input
                        id="ap-hrs-end"
                        type="time"
                        value={form.active_hours_end ?? ''}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, active_hours_end: e.target.value || null }))
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label>Active Days</Label>
                    <div className="flex flex-wrap gap-2">
                      {DAY_LABELS.map((day, idx) => {
                        const selected = form.active_days?.includes(idx) ?? false;
                        return (
                          <button
                            key={idx}
                            type="button"
                            className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                              selected
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                : 'hover:bg-muted'
                            }`}
                            onClick={() =>
                              setForm((prev) => {
                                const current = prev.active_days ?? [];
                                const next = selected
                                  ? current.filter((d) => d !== idx)
                                  : [...current, idx].sort();
                                return { ...prev, active_days: next.length ? next : null };
                              })
                            }
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="ap-rot">QR Rotation (minutes)</Label>
                    <Input
                      id="ap-rot"
                      type="number"
                      value={form.qr_rotation_minutes ?? 5}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          qr_rotation_minutes: e.target.value ? Number(e.target.value) : 5,
                        }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      How often Mode A QR codes rotate. Lower = more secure but harder to share.
                    </p>
                  </div>
                </div>
              )}
            </fieldset>

            {/* Form error */}
            {formError && (
              <p className="text-sm text-destructive">{formError}</p>
            )}

            {/* Submit */}
            <div className="flex justify-end gap-3 border-t pt-4">
              <Button variant="outline" onClick={() => setSheetOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                )}
                {editingPoint ? 'Save Changes' : 'Create'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ------------------------------------------------------------------ */}
      {/* Deactivate confirmation dialog */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={!!deactivateTarget} onOpenChange={(v) => !v && setDeactivateTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Deactivate Action Point</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate{' '}
              <span className="font-medium">{deactivateTarget?.name}</span>? Scans at this location
              will stop working.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeactivateTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeactivate}
              disabled={deactivateMutation.isPending}
            >
              {deactivateMutation.isPending && (
                <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              )}
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* Generate QR Dialog */}
      {/* ------------------------------------------------------------------ */}
      <GenerateQRDialog
        actionPointId={qrTarget?.id}
        open={!!qrTarget}
        onClose={() => setQrTarget(null)}
      />

      {/* ------------------------------------------------------------------ */}
      {/* Stats Dialog */}
      {/* ------------------------------------------------------------------ */}
      <StatsDialog
        actionPointId={statsTarget?.id}
        actionPointName={statsTarget?.name ?? ''}
        open={!!statsTarget}
        onClose={() => setStatsTarget(null)}
      />
    </div>
  );
}
