'use client';

/**
 * Admin QR Action Points — full CRUD, template-first creation, QR preview.
 *
 * Backend: /api/v1/admin/qr/action-points (flat array, not paginated wrapper)
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Coffee,
  CreditCard,
  Download,
  Eye,
  FileText,
  Home,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  Printer,
  QrCode,
  Search,
  Shield,
  Truck,
  UserPlus,
  Wrench,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
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
// ACTION_TYPE_CONFIG — central icon/label/color mapping (Lucide, no emoji)
// ---------------------------------------------------------------------------

const ACTION_TYPE_CONFIG: Record<string, {
  icon: LucideIcon;
  label: string;
  color: string;
  badgeColor: string;
}> = {
  mess_entry:         { icon: Coffee,      label: 'Mess Entry',         color: '#F59E0B', badgeColor: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  library_checkout:   { icon: BookOpen,    label: 'Library Checkout',   color: '#3B82F6', badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
  library_return:     { icon: BookOpen,    label: 'Library Return',     color: '#3B82F6', badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
  library_visit:      { icon: BookOpen,    label: 'Library Visit',      color: '#6366F1', badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
  attendance_mark:    { icon: CheckCircle, label: 'Attendance',         color: '#10B981', badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  hostel_checkin:     { icon: Home,        label: 'Hostel Gate',        color: '#8B5CF6', badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  clinical_posting:   { icon: Activity,    label: 'Clinical Posting',   color: '#EF4444', badgeColor: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
  exam_hall_entry:    { icon: FileText,    label: 'Exam Hall',          color: '#F59E0B', badgeColor: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  equipment_checkout: { icon: Wrench,      label: 'Equipment',          color: '#6B7280', badgeColor: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  event_checkin:      { icon: Calendar,    label: 'Event Check-in',     color: '#8B5CF6', badgeColor: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' },
  transport_boarding: { icon: Truck,       label: 'Transport',          color: '#EAB308', badgeColor: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  fee_payment:        { icon: CreditCard,  label: 'Fee Payment',        color: '#10B981', badgeColor: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  visitor_entry:      { icon: UserPlus,    label: 'Visitor Entry',      color: '#6B7280', badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  certificate_verify: { icon: Shield,      label: 'Certificate',        color: '#3B82F6', badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
};

// ---------------------------------------------------------------------------
// Templates — smart defaults for each action type
// ---------------------------------------------------------------------------

interface ActionPointTemplate {
  action_type: string;
  qr_mode: string;
  security_level: string;
  duplicate_window_minutes: number;
  geo_radius_meters: number;
  qr_rotation_minutes?: number;
  suggested_name: string;
  suggested_location_code: string;
  description: string;
}

const TEMPLATES: { key: string; icon: LucideIcon; label: string; template: ActionPointTemplate }[] = [
  {
    key: 'mess_entry',
    icon: Coffee,
    label: 'Mess Entry',
    template: {
      action_type: 'mess_entry',
      qr_mode: 'mode_b',
      security_level: 'standard',
      duplicate_window_minutes: 30,
      geo_radius_meters: 100,
      suggested_name: 'Main Mess Hall',
      suggested_location_code: 'mess-main',
      description: 'Students and staff scan this QR when entering the mess for meals.',
    },
  },
  {
    key: 'library',
    icon: BookOpen,
    label: 'Library',
    template: {
      action_type: 'library_checkout',
      qr_mode: 'mode_b',
      security_level: 'standard',
      duplicate_window_minutes: 0,
      geo_radius_meters: 50,
      suggested_name: 'Library Checkout Desk',
      suggested_location_code: 'lib-checkout',
      description: 'Scan to check out or return books from the library.',
    },
  },
  {
    key: 'attendance_mark',
    icon: CheckCircle,
    label: 'Attendance',
    template: {
      action_type: 'attendance_mark',
      qr_mode: 'mode_b',
      security_level: 'standard',
      duplicate_window_minutes: 60,
      geo_radius_meters: 100,
      qr_rotation_minutes: 5,
      suggested_name: 'Lecture Hall',
      suggested_location_code: 'lh-',
      description: 'Students scan to mark attendance for a class.',
    },
  },
  {
    key: 'hostel_checkin',
    icon: Home,
    label: 'Hostel Gate',
    template: {
      action_type: 'hostel_checkin',
      qr_mode: 'mode_b',
      security_level: 'standard',
      duplicate_window_minutes: 5,
      geo_radius_meters: 50,
      suggested_name: 'Hostel Gate',
      suggested_location_code: 'hostel-gate',
      description: 'Track entry and exit at hostel gates.',
    },
  },
  {
    key: 'clinical_posting',
    icon: Activity,
    label: 'Clinical Posting',
    template: {
      action_type: 'clinical_posting',
      qr_mode: 'mode_b',
      security_level: 'elevated',
      duplicate_window_minutes: 60,
      geo_radius_meters: 200,
      suggested_name: 'Ward Check-in',
      suggested_location_code: 'ward-',
      description: 'Students scan when arriving for clinical rotation duty.',
    },
  },
  {
    key: 'exam_hall_entry',
    icon: FileText,
    label: 'Exam Hall',
    template: {
      action_type: 'exam_hall_entry',
      qr_mode: 'mode_a',
      security_level: 'strict',
      duplicate_window_minutes: 0,
      geo_radius_meters: 100,
      suggested_name: 'Exam Hall',
      suggested_location_code: 'exam-hall-',
      description: 'Verify student identity before entering exam hall.',
    },
  },
  {
    key: 'equipment_checkout',
    icon: Wrench,
    label: 'Equipment',
    template: {
      action_type: 'equipment_checkout',
      qr_mode: 'mode_b',
      security_level: 'standard',
      duplicate_window_minutes: 0,
      geo_radius_meters: 100,
      suggested_name: 'Equipment Room',
      suggested_location_code: 'equip-',
      description: 'Scan to check out lab equipment.',
    },
  },
  {
    key: 'event_checkin',
    icon: Calendar,
    label: 'Event Check-in',
    template: {
      action_type: 'event_checkin',
      qr_mode: 'mode_b',
      security_level: 'standard',
      duplicate_window_minutes: 0,
      geo_radius_meters: 200,
      suggested_name: 'Event Venue',
      suggested_location_code: 'event-',
      description: 'Track attendance at conferences, CMEs, workshops.',
    },
  },
];

const SECURITY_BADGE: Record<SecurityLevel, { label: string; variant: 'outline' | 'info' | 'destructive' }> = {
  standard: { label: 'Standard', variant: 'outline' },
  elevated: { label: 'Elevated', variant: 'info' },
  strict:   { label: 'Strict',   variant: 'destructive' },
};

const SECURITY_DESCRIPTIONS: Record<string, string> = {
  standard: 'Device trust + duplicate check only',
  elevated: 'Adds GPS geofencing verification',
  strict: 'GPS + biometric confirmation required',
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
// Helpers
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
// GenerateQRDialog — shows QR code after creation or from table
// ---------------------------------------------------------------------------

function GenerateQRDialog({
  actionPointId,
  actionPointName,
  open,
  onClose,
}: {
  actionPointId: string | undefined;
  actionPointName?: string;
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

  const displayName = data?.action_point_name || actionPointName || 'Action Point';
  const config = data ? ACTION_TYPE_CONFIG[data.action_type] : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Action Point Created</DialogTitle>
          <DialogDescription>
            Your QR code is ready. Print it and place at the scan location.
          </DialogDescription>
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
              <p className="font-medium">{displayName}</p>
              <p className="text-xs text-muted-foreground">
                {data.location_code}
                {config && (
                  <>
                    {' '}&middot;{' '}
                    <span className="inline-flex items-center gap-1">
                      <config.icon className="inline h-3 w-3" />
                      {config.label}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleDownload} disabled={!data}>
            <Download className="mr-2 h-4 w-4" /> Download PNG
          </Button>
          <Button variant="outline" onClick={handlePrint} disabled={!data}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
          <Button onClick={onClose}>Done</Button>
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
              <StatBlock label="Failed" value={data.total_scans - data.successful_scans} />
              <StatBlock label="Success Rate" value={`${data.success_rate}%`} />
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
// CreateActionPointDialog — template-first, 2-step flow
// ---------------------------------------------------------------------------

function CreateActionPointDialog({
  open,
  onOpenChange,
  editingPoint,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingPoint: QRActionPoint | null;
  onCreated?: (point: QRActionPoint) => void;
}) {
  const [step, setStep] = useState<'template' | 'form'>(editingPoint ? 'form' : 'template');
  const [selectedTemplate, setSelectedTemplate] = useState<typeof TEMPLATES[number] | null>(null);
  const [form, setForm] = useState<ActionPointCreateInput>({ ...EMPTY_FORM });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [formError, setFormError] = useState('');

  const createMutation = useCreateActionPoint();
  const updateMutation = useUpdateActionPoint();

  // Reset state when opening
  const handleOpenChange = useCallback((v: boolean) => {
    if (v) {
      if (editingPoint) {
        setStep('form');
        setSelectedTemplate(null);
        setForm({
          name: editingPoint.name,
          description: editingPoint.description,
          action_type: editingPoint.action_type,
          location_code: editingPoint.location_code,
          qr_mode: editingPoint.qr_mode,
          building: editingPoint.building,
          floor: editingPoint.floor,
          gps_latitude: editingPoint.gps_latitude,
          gps_longitude: editingPoint.gps_longitude,
          geo_radius_meters: editingPoint.geo_radius_meters,
          qr_rotation_minutes: editingPoint.qr_rotation_minutes,
          duplicate_window_minutes: editingPoint.duplicate_window_minutes,
          security_level: editingPoint.security_level,
          active_hours_start: editingPoint.active_hours_start,
          active_hours_end: editingPoint.active_hours_end,
          active_days: editingPoint.active_days?.length ? editingPoint.active_days : null,
        });
        setShowAdvanced(false);
      } else {
        setStep('template');
        setSelectedTemplate(null);
        setForm({ ...EMPTY_FORM });
        setShowAdvanced(false);
      }
      setFormError('');
    }
    onOpenChange(v);
  }, [editingPoint, onOpenChange]);

  const selectTemplate = useCallback((tmpl: typeof TEMPLATES[number]) => {
    setSelectedTemplate(tmpl);
    const t = tmpl.template;
    setForm({
      name: t.suggested_name,
      description: t.description,
      action_type: t.action_type,
      location_code: t.suggested_location_code,
      qr_mode: t.qr_mode,
      building: null,
      floor: null,
      gps_latitude: null,
      gps_longitude: null,
      geo_radius_meters: t.geo_radius_meters,
      qr_rotation_minutes: t.qr_rotation_minutes ?? 0,
      duplicate_window_minutes: t.duplicate_window_minutes,
      security_level: t.security_level,
      active_hours_start: null,
      active_hours_end: null,
      active_days: null,
    });
    setStep('form');
  }, []);

  const handleNameChange = useCallback(
    (name: string) => {
      setForm((prev) => ({
        ...prev,
        name,
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
        onOpenChange(false);
      } else {
        const result = await createMutation.mutateAsync(form);
        onCreated?.(result);
      }
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }, [form, editingPoint, createMutation, updateMutation, onOpenChange, onCreated]);

  const config = ACTION_TYPE_CONFIG[form.action_type];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
        {/* Step 1: Pick template */}
        {step === 'template' && !editingPoint && (
          <>
            <DialogHeader>
              <DialogTitle>Create Action Point</DialogTitle>
              <DialogDescription>
                What type of QR scan location are you setting up?
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-3 gap-3 py-2">
              {TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.key}
                  onClick={() => selectTemplate(tmpl)}
                  className="group flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center transition-all hover:border-emerald-500/50 hover:bg-card/80"
                >
                  <tmpl.icon className="h-6 w-6 text-muted-foreground group-hover:text-emerald-500 transition-colors" />
                  <span className="text-sm font-medium">{tmpl.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 2: Confirm details */}
        {step === 'form' && (
          <>
            <DialogHeader>
              <DialogTitle>
                {editingPoint ? 'Edit Action Point' : 'Create Action Point'}
              </DialogTitle>
              {!editingPoint && selectedTemplate && (
                <DialogDescription className="flex items-center gap-2">
                  <button
                    onClick={() => setStep('template')}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronLeft className="inline h-3 w-3" /> Back
                  </button>
                  <span className="text-xs">|</span>
                  {config && (
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <config.icon className="h-3.5 w-3.5 text-emerald-500" />
                      {config.label}
                    </span>
                  )}
                </DialogDescription>
              )}
              {editingPoint && (
                <DialogDescription>Editing &ldquo;{editingPoint.name}&rdquo;</DialogDescription>
              )}
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Type description */}
              {form.description && !editingPoint && (
                <p className="text-xs text-muted-foreground rounded-md bg-muted/50 px-3 py-2">
                  {form.description}
                </p>
              )}

              {/* Name */}
              <div className="space-y-1">
                <Label htmlFor="ap-name">Name *</Label>
                <Input
                  id="ap-name"
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Main Mess Hall"
                />
              </div>

              {/* Location code */}
              <div className="space-y-1">
                <Label htmlFor="ap-loc">Location Code *</Label>
                <Input
                  id="ap-loc"
                  value={form.location_code}
                  onChange={(e) => setForm((p) => ({ ...p, location_code: e.target.value }))}
                  placeholder="mess-main"
                />
                <p className="text-[11px] text-muted-foreground">Unique identifier for this location.</p>
              </div>

              {/* Building / Floor */}
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

              {/* Description (for edit mode) */}
              {editingPoint && (
                <div className="space-y-1">
                  <Label htmlFor="ap-desc">Description</Label>
                  <Textarea
                    id="ap-desc"
                    value={form.description ?? ''}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value || null }))}
                    rows={2}
                    placeholder="Optional description"
                  />
                </div>
              )}

              {/* Action type (for edit mode) */}
              {editingPoint && (
                <div className="space-y-1">
                  <Label htmlFor="ap-type">Action Type</Label>
                  <select
                    id="ap-type"
                    value={form.action_type}
                    onChange={(e) => setForm((p) => ({ ...p, action_type: e.target.value }))}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {Object.entries(ACTION_TYPE_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* QR Mode (for edit mode) */}
              {editingPoint && (
                <div className="space-y-1">
                  <Label>QR Mode</Label>
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
                        {mode === 'mode_a' ? 'Scanner reads (Mode A)' : 'Printed QR (Mode B)'}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Advanced settings (collapsed) */}
              <button
                type="button"
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                Advanced Settings
              </button>

              {showAdvanced && (
                <div className="space-y-4 rounded-lg border p-4">
                  {/* Security level */}
                  <div className="space-y-2">
                    <Label>Security Level</Label>
                    <div className="space-y-2">
                      {(['standard', 'elevated', 'strict'] as const).map((level) => (
                        <label key={level} className="flex items-start gap-2 text-sm cursor-pointer">
                          <input
                            type="radio"
                            name="security_level"
                            value={level}
                            checked={form.security_level === level}
                            onChange={() => setForm((p) => ({ ...p, security_level: level }))}
                            className="accent-emerald-600 mt-0.5"
                          />
                          <div>
                            <span className="font-medium">{level.charAt(0).toUpperCase() + level.slice(1)}</span>
                            <p className="text-[11px] text-muted-foreground">{SECURITY_DESCRIPTIONS[level]}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Duplicate window */}
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
                    <p className="text-[11px] text-muted-foreground">
                      Ignore repeat scans from the same user within this window. 0 = no limit.
                    </p>
                  </div>

                  {/* QR rotation */}
                  <div className="space-y-1">
                    <Label htmlFor="ap-rot">QR Rotation (minutes)</Label>
                    <Input
                      id="ap-rot"
                      type="number"
                      value={form.qr_rotation_minutes ?? 0}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          qr_rotation_minutes: e.target.value ? Number(e.target.value) : 0,
                        }))
                      }
                    />
                    <p className="text-[11px] text-muted-foreground">
                      How often the QR code changes. 0 = static (never changes).
                    </p>
                  </div>

                  {/* GPS coordinates */}
                  {form.security_level !== 'standard' && (
                    <>
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
                    </>
                  )}

                  {/* Schedule */}
                  <div className="space-y-3 border-t pt-3">
                    <p className="text-xs font-medium text-muted-foreground">Schedule (optional)</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="ap-hrs-start">Active From</Label>
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
                        <Label htmlFor="ap-hrs-end">Active Until</Label>
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
                  </div>
                </div>
              )}

              {/* Form error */}
              {formError && (
                <p className="text-sm text-destructive">{formError}</p>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                )}
                {editingPoint ? 'Save Changes' : 'Create Action Point'}
              </Button>
            </DialogFooter>
          </>
        )}
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

  // Client-side text search
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

  // ---- Create / Edit dialog ----
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPoint, setEditingPoint] = useState<QRActionPoint | null>(null);

  // ---- Post-creation QR preview ----
  const [newlyCreatedId, setNewlyCreatedId] = useState<string | null>(null);
  const [newlyCreatedName, setNewlyCreatedName] = useState<string>('');

  const openCreate = useCallback(() => {
    setEditingPoint(null);
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((ap: QRActionPoint) => {
    setEditingPoint(ap);
    setDialogOpen(true);
  }, []);

  const handleCreated = useCallback((point: QRActionPoint) => {
    setDialogOpen(false);
    if (point.qr_mode === 'mode_b') {
      setNewlyCreatedId(point.id);
      setNewlyCreatedName(point.name);
    }
  }, []);

  // ---- Deactivate ----
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

  // ---- QR preview from table ----
  const [qrTarget, setQrTarget] = useState<QRActionPoint | null>(null);

  // ---- Stats ----
  const [statsTarget, setStatsTarget] = useState<QRActionPoint | null>(null);

  // ---- Row dropdown ----
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // ---- Summary stats ----
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
      {/* Header */}
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

      {/* Stat cards */}
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
            <p className="text-xs text-muted-foreground">Printed QR (Mode B)</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-2xl font-bold">{stats.uniqueBuildings}</p>
            <p className="text-xs text-muted-foreground">Buildings</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          Failed to load action points: {error.message}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, code, building..."
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
            ...Object.entries(ACTION_TYPE_CONFIG).map(([k, v]) => ({
              value: k,
              label: v.label,
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

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Action Type</th>
              <th className="px-4 py-3 text-left font-medium">QR Mode</th>
              <th className="hidden px-4 py-3 text-left font-medium md:table-cell">Location</th>
              <th className="hidden px-4 py-3 text-left font-medium lg:table-cell">Security</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-center font-medium w-10">QR</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={8} />)}

            {!isLoading && filteredPoints.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center text-muted-foreground">
                  <QrCode className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {actionPoints?.length === 0
                    ? 'No action points yet. Click "Add Action Point" to create one.'
                    : 'No action points match your filters.'}
                </td>
              </tr>
            )}

            {filteredPoints.map((ap) => {
              const cfg = ACTION_TYPE_CONFIG[ap.action_type] ?? {
                icon: QrCode,
                label: ap.action_type,
                color: '#6B7280',
                badgeColor: 'bg-gray-100 text-gray-700',
              };
              const secBadge = SECURITY_BADGE[ap.security_level] ?? SECURITY_BADGE.standard;
              const IconComp = cfg.icon;

              return (
                <tr key={ap.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium">{ap.name}</p>
                    <p className="text-xs text-muted-foreground">{ap.location_code}</p>
                  </td>

                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.badgeColor}`}>
                      <IconComp className="h-3.5 w-3.5" /> {cfg.label}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-xs">
                    {ap.qr_mode === 'mode_a' ? 'Scanner reads' : 'Printed QR'}
                  </td>

                  <td className="hidden px-4 py-3 md:table-cell">
                    {ap.building ? (
                      <span className="text-xs">
                        {ap.building}
                        {ap.floor != null && `, Floor ${ap.floor}`}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">&mdash;</span>
                    )}
                  </td>

                  <td className="hidden px-4 py-3 lg:table-cell">
                    <Badge variant={secBadge.variant} className="text-xs">
                      {secBadge.label}
                    </Badge>
                  </td>

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

                  <td className="px-4 py-3 text-center">
                    {ap.qr_mode === 'mode_b' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setQrTarget(ap)}
                        title="View QR Code"
                      >
                        <QrCode className="h-4 w-4" />
                      </Button>
                    )}
                  </td>

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
                              <QrCode className="h-3.5 w-3.5" /> QR Code
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

      {/* Create / Edit dialog */}
      <CreateActionPointDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingPoint={editingPoint}
        onCreated={handleCreated}
      />

      {/* Post-creation QR preview */}
      <GenerateQRDialog
        actionPointId={newlyCreatedId ?? undefined}
        actionPointName={newlyCreatedName}
        open={!!newlyCreatedId}
        onClose={() => setNewlyCreatedId(null)}
      />

      {/* QR preview from table */}
      <GenerateQRDialog
        actionPointId={qrTarget?.id}
        actionPointName={qrTarget?.name}
        open={!!qrTarget}
        onClose={() => setQrTarget(null)}
      />

      {/* Stats Dialog */}
      <StatsDialog
        actionPointId={statsTarget?.id}
        actionPointName={statsTarget?.name ?? ''}
        open={!!statsTarget}
        onClose={() => setStatsTarget(null)}
      />

      {/* Deactivate confirmation */}
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
    </div>
  );
}
