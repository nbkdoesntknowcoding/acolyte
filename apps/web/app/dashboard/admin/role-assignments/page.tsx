'use client';

/**
 * Admin Dynamic Role Assignments — CRUD table, expiring alert, create sheet.
 *
 * Backend: /api/v1/admin/role-assignments (flat array, not paginated wrapper)
 */

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ShieldOff,
  Users,
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
  useRoleAssignments,
  useExpiringRoles,
  useCreateRoleAssignment,
  useUpdateRoleAssignment,
  useRevokeRoleAssignment,
  type RoleAssignmentCreateInput,
  type RoleAssignmentUpdateInput,
} from '@/lib/hooks/admin/use-role-assignments';
import type { DynamicRoleAssignment, DynamicRoleType } from '@/types/admin';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

interface RoleMeta {
  label: string;
  category: 'committee' | 'academic' | 'administrative' | 'temporary';
}

const ROLE_META: Record<DynamicRoleType, RoleMeta> = {
  committee_chair:      { label: 'Committee Chair',      category: 'committee' },
  committee_member:     { label: 'Committee Member',     category: 'committee' },
  committee_secretary:  { label: 'Committee Secretary',  category: 'committee' },
  committee_external:   { label: 'External Member',      category: 'committee' },
  class_representative: { label: 'Class Representative', category: 'academic' },
  exam_invigilator:     { label: 'Exam Invigilator',     category: 'academic' },
  rotation_supervisor:  { label: 'Rotation Supervisor',  category: 'academic' },
  mentor:               { label: 'Mentor',               category: 'academic' },
  duty_warden:          { label: 'Duty Warden',          category: 'administrative' },
  event_coordinator:    { label: 'Event Coordinator',    category: 'administrative' },
  ncc_officer:          { label: 'NCC Officer',          category: 'administrative' },
  nss_coordinator:      { label: 'NSS Coordinator',      category: 'administrative' },
  sports_incharge:      { label: 'Sports In-charge',     category: 'administrative' },
  temporary_admin:      { label: 'Temporary Admin',      category: 'temporary' },
  audit_viewer:         { label: 'Audit Viewer',         category: 'temporary' },
};

const CATEGORY_BADGE: Record<string, 'default' | 'info' | 'outline' | 'warning'> = {
  committee:      'default',
  academic:       'info',
  administrative: 'outline',
  temporary:      'warning',
};

const USER_TYPE_STYLE: Record<string, string> = {
  student:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  faculty:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  staff:    'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  external: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

const CONTEXT_TYPES = ['committee', 'exam', 'event', 'department', 'batch', 'hostel', 'other'] as const;

const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  committee_chair:      ['view_cases', 'update_status', 'resolve_case', 'file_minutes', 'schedule_meeting', 'manage_members', 'view_documents'],
  committee_member:     ['view_cases', 'view_minutes', 'view_documents'],
  committee_secretary:  ['view_cases', 'file_minutes', 'view_minutes', 'view_documents', 'schedule_meeting'],
  committee_external:   ['view_cases', 'view_minutes', 'view_documents'],
  exam_invigilator:     ['access_exam_hall', 'verify_students', 'report_incidents'],
  class_representative: ['view_notices', 'submit_feedback', 'represent_batch'],
  rotation_supervisor:  ['view_students', 'sign_logbook', 'submit_evaluations'],
  mentor:               ['view_mentees', 'view_academic_records', 'submit_mentor_reports'],
  duty_warden:          ['view_hostel_residents', 'mark_attendance', 'report_incidents'],
  event_coordinator:    ['manage_event', 'view_registrations', 'send_notifications'],
  ncc_officer:          ['manage_ncc_cadets', 'view_attendance', 'submit_reports'],
  nss_coordinator:      ['manage_nss_volunteers', 'view_hours', 'submit_reports'],
  sports_incharge:      ['manage_teams', 'schedule_events', 'view_participation'],
  temporary_admin:      ['view_all', 'manage_settings'],
  audit_viewer:         ['view_audit_logs', 'view_reports'],
};

const GROUPED_ROLES = [
  { group: 'Committee Roles', roles: ['committee_chair', 'committee_member', 'committee_secretary', 'committee_external'] },
  { group: 'Academic Roles', roles: ['class_representative', 'exam_invigilator', 'rotation_supervisor', 'mentor'] },
  { group: 'Administrative Roles', roles: ['duty_warden', 'event_coordinator', 'ncc_officer', 'nss_coordinator', 'sports_incharge'] },
  { group: 'Temporary Roles', roles: ['temporary_admin', 'audit_viewer'] },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

type AssignmentStatus = 'active' | 'expiring' | 'expired' | 'revoked';

function deriveStatus(r: DynamicRoleAssignment): AssignmentStatus {
  if (!r.is_active) return 'revoked';
  if (r.valid_until) {
    const d = daysUntil(r.valid_until);
    if (d < 0) return 'expired';
    if (d <= 30) return 'expiring';
  }
  return 'active';
}

const STATUS_STYLE: Record<AssignmentStatus, { label: string; color: string; dot: string }> = {
  active:   { label: 'Active',        color: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  expiring: { label: 'Expiring Soon', color: 'text-amber-600 dark:text-amber-400',     dot: 'bg-amber-500' },
  expired:  { label: 'Expired',       color: 'text-red-600 dark:text-red-400',         dot: 'bg-red-500' },
  revoked:  { label: 'Revoked',       color: 'text-gray-500',                          dot: 'bg-gray-400' },
};

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
  options: { value: string; label: string; group?: string }[];
  onChange: (v: string) => void;
}) {
  const groups = new Map<string, { value: string; label: string }[]>();
  const ungrouped: { value: string; label: string }[] = [];
  for (const o of options) {
    if (o.group) {
      if (!groups.has(o.group)) groups.set(o.group, []);
      groups.get(o.group)!.push(o);
    } else {
      ungrouped.push(o);
    }
  }

  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
    >
      {ungrouped.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
      {Array.from(groups.entries()).map(([group, items]) => (
        <optgroup key={group} label={group}>
          {items.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </optgroup>
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

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function RoleAssignmentsPage() {
  // ---- Filters ----
  const [roleFilter, setRoleFilter] = useState('');
  const [contextFilter, setContextFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'expiring'>('');
  const [searchTerm, setSearchTerm] = useState('');

  const queryParams = useMemo(() => {
    const p: Record<string, string | boolean> = {};
    if (roleFilter) p.role_type = roleFilter;
    if (contextFilter) p.context_type = contextFilter;
    if (statusFilter === 'active') p.is_active = true;
    return p;
  }, [roleFilter, contextFilter, statusFilter]);

  const { data: assignments, isLoading, error } = useRoleAssignments(queryParams);
  const { data: expiringRoles } = useExpiringRoles(30);

  // Client-side search + expiring filter
  const displayRows = useMemo(() => {
    if (!assignments) return [];
    let rows = assignments;
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.user_name ?? '').toLowerCase().includes(lower) ||
          (r.context_name ?? '').toLowerCase().includes(lower),
      );
    }
    if (statusFilter === 'expiring') {
      rows = rows.filter((r) => deriveStatus(r) === 'expiring');
    }
    return rows;
  }, [assignments, searchTerm, statusFilter]);

  // ---- Summary stats ----
  const stats = useMemo(() => {
    if (!assignments) return null;
    const active = assignments.filter((r) => r.is_active).length;
    const committeeCount = assignments.filter(
      (r) => r.is_active && ROLE_META[r.role_type as DynamicRoleType]?.category === 'committee',
    ).length;
    return { total: assignments.length, active, expiring: expiringRoles?.length ?? 0, committeeCount };
  }, [assignments, expiringRoles]);

  // ---- Expiring alert ----
  const [expiringExpanded, setExpiringExpanded] = useState(false);

  // ---- Sheet ----
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<DynamicRoleAssignment | null>(null);

  const [form, setForm] = useState<RoleAssignmentCreateInput>({
    user_id: '', user_type: 'faculty', user_name: '', role_type: 'committee_member',
    context_type: 'committee', context_id: '', context_name: '',
    valid_from: todayISO(), valid_until: null, auto_deactivate: true,
    assignment_order_url: null, notes: null,
    permissions: DEFAULT_PERMISSIONS['committee_member'] ?? [],
  });
  const [editForm, setEditForm] = useState({ valid_until: '', notes: '', permissions: [] as string[] });
  const [formError, setFormError] = useState('');

  const createMutation = useCreateRoleAssignment();
  const updateMutation = useUpdateRoleAssignment();
  const revokeMutation = useRevokeRoleAssignment();

  const openCreate = useCallback(() => {
    setEditingAssignment(null);
    setForm({
      user_id: '', user_type: 'faculty', user_name: '', role_type: 'committee_member',
      context_type: 'committee', context_id: '', context_name: '',
      valid_from: todayISO(), valid_until: null, auto_deactivate: true,
      assignment_order_url: null, notes: null,
      permissions: DEFAULT_PERMISSIONS['committee_member'] ?? [],
    });
    setFormError('');
    setSheetOpen(true);
  }, []);

  const openEdit = useCallback((r: DynamicRoleAssignment) => {
    setEditingAssignment(r);
    setEditForm({ valid_until: r.valid_until ?? '', notes: r.notes ?? '', permissions: [...r.permissions] });
    setFormError('');
    setSheetOpen(true);
  }, []);

  const openExtend = useCallback((r: DynamicRoleAssignment) => {
    const ext = new Date();
    ext.setDate(ext.getDate() + 90);
    setEditingAssignment(r);
    setEditForm({ valid_until: ext.toISOString().slice(0, 10), notes: r.notes ?? '', permissions: [...r.permissions] });
    setFormError('');
    setSheetOpen(true);
  }, []);

  const handleRoleTypeChange = useCallback((roleType: string) => {
    const perms = DEFAULT_PERMISSIONS[roleType] ?? [];
    const isCommittee = roleType.startsWith('committee_');
    setForm((prev) => ({
      ...prev,
      role_type: roleType,
      permissions: [...perms],
      ...(isCommittee ? { context_type: 'committee' } : {}),
    }));
  }, []);

  const togglePermission = useCallback((perm: string) => {
    if (editingAssignment) {
      setEditForm((prev) => ({
        ...prev,
        permissions: prev.permissions.includes(perm)
          ? prev.permissions.filter((p) => p !== perm)
          : [...prev.permissions, perm],
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        permissions: (prev.permissions ?? []).includes(perm)
          ? (prev.permissions ?? []).filter((p) => p !== perm)
          : [...(prev.permissions ?? []), perm],
      }));
    }
  }, [editingAssignment]);

  const handleSubmit = useCallback(async () => {
    setFormError('');
    try {
      if (editingAssignment) {
        const data: RoleAssignmentUpdateInput = {
          valid_until: editForm.valid_until || null,
          notes: editForm.notes || null,
          permissions: editForm.permissions,
        };
        await updateMutation.mutateAsync({ id: editingAssignment.id, data });
      } else {
        if (!form.user_id.trim() || !form.user_name.trim()) {
          setFormError('User ID and User Name are required.');
          return;
        }
        if (!form.context_id.trim() || !form.context_name.trim()) {
          setFormError('Context ID and Context Name are required.');
          return;
        }
        await createMutation.mutateAsync({
          ...form,
          valid_until: form.valid_until || null,
          notes: form.notes || null,
        });
      }
      setSheetOpen(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }, [form, editForm, editingAssignment, createMutation, updateMutation]);

  // ---- Revoke dialog ----
  const [revokeTarget, setRevokeTarget] = useState<DynamicRoleAssignment | null>(null);

  const confirmRevoke = useCallback(async () => {
    if (!revokeTarget) return;
    try {
      await revokeMutation.mutateAsync({ id: revokeTarget.id });
      setRevokeTarget(null);
    } catch {
      // keep dialog open
    }
  }, [revokeTarget, revokeMutation]);

  // ---- Row dropdown ----
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Permission chip set for form
  const allPermsForRole = editingAssignment
    ? DEFAULT_PERMISSIONS[editingAssignment.role_type] ?? editingAssignment.permissions
    : DEFAULT_PERMISSIONS[form.role_type] ?? [];

  const activePerms = editingAssignment ? editForm.permissions : (form.permissions ?? []);

  // Role filter options
  const roleFilterOptions = useMemo(() => {
    const opts: { value: string; label: string; group?: string }[] = [{ value: '', label: 'All Roles' }];
    for (const g of GROUPED_ROLES) {
      for (const r of g.roles) {
        const meta = ROLE_META[r as DynamicRoleType];
        if (meta) opts.push({ value: r, label: meta.label, group: g.group });
      }
    }
    return opts;
  }, []);

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
            <h1 className="text-3xl font-bold">Role Assignments</h1>
            <p className="text-muted-foreground">
              Manage dynamic roles — committee members, exam invigilators, wardens, and temporary assignments
            </p>
          </div>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Assign Role
        </Button>
      </div>

      {/* Stat cards */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border p-4">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total Assignments</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-2xl font-bold text-emerald-600">{stats.active}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className={`text-2xl font-bold ${stats.expiring > 0 ? 'text-amber-600' : ''}`}>{stats.expiring}</p>
            <p className="text-xs text-muted-foreground">Expiring in 30 Days</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-2xl font-bold">{stats.committeeCount}</p>
            <p className="text-xs text-muted-foreground">Committee Members</p>
          </div>
        </div>
      )}

      {/* Expiring roles alert */}
      {expiringRoles && expiringRoles.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3 text-sm"
            onClick={() => setExpiringExpanded((v) => !v)}
          >
            <span className="flex items-center gap-2 font-medium text-amber-700 dark:text-amber-300">
              <CalendarClock className="h-4 w-4" />
              {expiringRoles.length} role assignment{expiringRoles.length !== 1 ? 's' : ''} expiring within 30 days
            </span>
            {expiringExpanded ? <ChevronUp className="h-4 w-4 text-amber-600" /> : <ChevronDown className="h-4 w-4 text-amber-600" />}
          </button>

          {expiringExpanded && (
            <div className="border-t border-amber-200 dark:border-amber-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-amber-700 dark:text-amber-400">
                    <th className="px-4 py-2 font-medium">User</th>
                    <th className="px-4 py-2 font-medium">Role</th>
                    <th className="hidden px-4 py-2 font-medium sm:table-cell">Context</th>
                    <th className="px-4 py-2 font-medium">Expires</th>
                    <th className="px-4 py-2 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {expiringRoles.map((r) => (
                    <tr key={r.id} className="border-t border-amber-100 dark:border-amber-800/50">
                      <td className="px-4 py-2">{r.user_name || r.user_id}</td>
                      <td className="px-4 py-2 text-xs">{ROLE_META[r.role_type as DynamicRoleType]?.label ?? r.role_type}</td>
                      <td className="hidden px-4 py-2 text-xs sm:table-cell">{r.context_name || r.context_type}</td>
                      <td className="px-4 py-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                        {formatDate(r.valid_until)}
                        {r.valid_until && <span className="ml-1 text-[10px]">({daysUntil(r.valid_until)}d)</span>}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openExtend(r)}>
                          Extend
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          Failed to load role assignments: {error.message}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search user or context…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <FilterDropdown label="Role Type" value={roleFilter} onChange={setRoleFilter} options={roleFilterOptions} />
        <FilterDropdown
          label="Context"
          value={contextFilter}
          onChange={setContextFilter}
          options={[
            { value: '', label: 'All Contexts' },
            ...CONTEXT_TYPES.map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) })),
          ]}
        />
        <FilterDropdown
          label="Status"
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as '' | 'active' | 'expiring')}
          options={[
            { value: '', label: 'All Status' },
            { value: 'active', label: 'Active' },
            { value: 'expiring', label: 'Expiring Soon' },
          ]}
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">User</th>
              <th className="px-4 py-3 text-left font-medium">Role</th>
              <th className="hidden px-4 py-3 text-left font-medium md:table-cell">Context</th>
              <th className="hidden px-4 py-3 text-left font-medium sm:table-cell">Valid From</th>
              <th className="hidden px-4 py-3 text-left font-medium sm:table-cell">Valid Until</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="hidden px-4 py-3 text-left font-medium lg:table-cell">Permissions</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={8} />)}

            {!isLoading && displayRows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center text-muted-foreground">
                  <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {assignments?.length === 0
                    ? 'No role assignments yet. Click "Assign Role" to create one.'
                    : 'No assignments match your filters.'}
                </td>
              </tr>
            )}

            {displayRows.map((r) => {
              const meta = ROLE_META[r.role_type as DynamicRoleType];
              const catBadge = meta ? CATEGORY_BADGE[meta.category] : undefined;
              const status = deriveStatus(r);
              const st = STATUS_STYLE[status];
              const utStyle = USER_TYPE_STYLE[r.user_type] ?? USER_TYPE_STYLE.staff;
              const perms = r.permissions ?? [];

              return (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.user_name || 'Unknown'}</p>
                    <span className={`inline-block mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${utStyle}`}>
                      {r.user_type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={catBadge ?? 'outline'} className="text-xs">
                      {meta?.label ?? r.role_type}
                    </Badge>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <p className="text-xs">{r.context_name || '—'}</p>
                    <p className="text-[10px] text-muted-foreground">{r.context_type}</p>
                  </td>
                  <td className="hidden px-4 py-3 text-xs sm:table-cell">{formatDate(r.valid_from)}</td>
                  <td className="hidden px-4 py-3 text-xs sm:table-cell">
                    {r.valid_until ? formatDate(r.valid_until) : <span className="text-muted-foreground">Indefinite</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${st.color}`}>
                      <span className={`inline-block h-2 w-2 rounded-full ${st.dot}`} />
                      {st.label}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    {perms.length > 0 ? (
                      <span className="text-xs text-muted-foreground">
                        {perms.slice(0, 2).join(', ')}
                        {perms.length > 2 && <span className="ml-1 text-[10px]">+{perms.length - 2} more</span>}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="relative inline-block">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpenMenuId(openMenuId === r.id ? null : r.id)}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                      {openMenuId === r.id && (
                        <div className="absolute right-0 z-20 mt-1 w-36 rounded-md border bg-popover p-1 shadow-md" onMouseLeave={() => setOpenMenuId(null)}>
                          <button className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent" onClick={() => { openEdit(r); setOpenMenuId(null); }}>
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </button>
                          {r.is_active && (
                            <button className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10" onClick={() => { setRevokeTarget(r); setOpenMenuId(null); }}>
                              <ShieldOff className="h-3.5 w-3.5" /> Revoke
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

      {/* Create / Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{editingAssignment ? 'Edit Assignment' : 'Assign Role'}</SheetTitle>
            <SheetDescription>
              {editingAssignment
                ? `Editing ${editingAssignment.user_name}'s role as ${ROLE_META[editingAssignment.role_type as DynamicRoleType]?.label ?? editingAssignment.role_type}`
                : 'Assign a dynamic role to a user for a specific context.'}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {editingAssignment ? (
              <>
                <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
                  <p><span className="text-muted-foreground">User:</span> {editingAssignment.user_name}</p>
                  <p><span className="text-muted-foreground">Role:</span> {ROLE_META[editingAssignment.role_type as DynamicRoleType]?.label ?? editingAssignment.role_type}</p>
                  <p><span className="text-muted-foreground">Context:</span> {editingAssignment.context_name} ({editingAssignment.context_type})</p>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="edit-until">Valid Until</Label>
                  <Input id="edit-until" type="date" value={editForm.valid_until} onChange={(e) => setEditForm((p) => ({ ...p, valid_until: e.target.value }))} />
                  <p className="text-xs text-muted-foreground">Leave empty for indefinite.</p>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="edit-notes">Notes</Label>
                  <Textarea id="edit-notes" value={editForm.notes} onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))} rows={2} />
                </div>

                <div className="space-y-2">
                  <Label>Permissions</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from(new Set([...allPermsForRole, ...editForm.permissions])).map((perm) => {
                      const active = editForm.permissions.includes(perm);
                      return (
                        <button key={perm} type="button" onClick={() => togglePermission(perm)} className={`rounded-md border px-2 py-0.5 text-xs transition-colors ${active ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'opacity-40 hover:opacity-70'}`}>
                          {perm}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* User section */}
                <fieldset className="space-y-3">
                  <legend className="text-sm font-semibold">User</legend>
                  <div className="space-y-1">
                    <Label htmlFor="ra-uid">User ID (UUID) *</Label>
                    <Input id="ra-uid" value={form.user_id} onChange={(e) => setForm((p) => ({ ...p, user_id: e.target.value }))} placeholder="Paste user UUID" className="font-mono text-xs" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="ra-uname">User Name *</Label>
                      <Input id="ra-uname" value={form.user_name} onChange={(e) => setForm((p) => ({ ...p, user_name: e.target.value }))} placeholder="Dr. Sharma" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="ra-utype">User Type</Label>
                      <select id="ra-utype" value={form.user_type} onChange={(e) => setForm((p) => ({ ...p, user_type: e.target.value }))} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                        <option value="faculty">Faculty</option>
                        <option value="student">Student</option>
                        <option value="staff">Staff</option>
                        <option value="external">External</option>
                      </select>
                    </div>
                  </div>
                </fieldset>

                {/* Role + Context section */}
                <fieldset className="space-y-3">
                  <legend className="text-sm font-semibold">Role &amp; Context</legend>
                  <div className="space-y-1">
                    <Label htmlFor="ra-role">Role Type *</Label>
                    <select id="ra-role" value={form.role_type} onChange={(e) => handleRoleTypeChange(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                      {GROUPED_ROLES.map((g) => (
                        <optgroup key={g.group} label={g.group}>
                          {g.roles.map((r) => (
                            <option key={r} value={r}>{ROLE_META[r as DynamicRoleType]?.label ?? r}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="ra-ctx-type">Context Type *</Label>
                      <select id="ra-ctx-type" value={form.context_type} onChange={(e) => setForm((p) => ({ ...p, context_type: e.target.value }))} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                        {CONTEXT_TYPES.map((c) => (
                          <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="ra-ctx-id">Context ID (UUID) *</Label>
                      <Input id="ra-ctx-id" value={form.context_id} onChange={(e) => setForm((p) => ({ ...p, context_id: e.target.value }))} placeholder="Committee UUID" className="font-mono text-xs" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ra-ctx-name">Context Name *</Label>
                    <Input id="ra-ctx-name" value={form.context_name} onChange={(e) => setForm((p) => ({ ...p, context_name: e.target.value }))} placeholder="Anti-Ragging Committee" />
                  </div>
                </fieldset>

                {/* Permissions (auto-filled, toggleable) */}
                <fieldset className="space-y-2">
                  <legend className="text-sm font-semibold">Permissions</legend>
                  <p className="text-xs text-muted-foreground">Auto-filled based on role type. Toggle individual permissions.</p>
                  <div className="flex flex-wrap gap-1.5">
                    {allPermsForRole.map((perm) => {
                      const active = (form.permissions ?? []).includes(perm);
                      return (
                        <button key={perm} type="button" onClick={() => togglePermission(perm)} className={`rounded-md border px-2 py-0.5 text-xs transition-colors ${active ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'opacity-40 hover:opacity-70'}`}>
                          {perm}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                {/* Validity */}
                <fieldset className="space-y-3">
                  <legend className="text-sm font-semibold">Validity</legend>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="ra-from">Valid From *</Label>
                      <Input id="ra-from" type="date" value={form.valid_from} onChange={(e) => setForm((p) => ({ ...p, valid_from: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="ra-until">Valid Until</Label>
                      <Input id="ra-until" type="date" value={form.valid_until ?? ''} onChange={(e) => setForm((p) => ({ ...p, valid_until: e.target.value || null }))} />
                      <p className="text-[10px] text-muted-foreground">Empty = indefinite</p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.auto_deactivate ?? true} onChange={(e) => setForm((p) => ({ ...p, auto_deactivate: e.target.checked }))} className="accent-emerald-600" />
                    Auto-deactivate when validity expires
                  </label>
                  <div className="space-y-1">
                    <Label htmlFor="ra-notes">Notes</Label>
                    <Textarea id="ra-notes" value={form.notes ?? ''} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value || null }))} rows={2} placeholder="Optional notes" />
                  </div>
                </fieldset>
              </>
            )}

            {formError && <p className="text-sm text-destructive">{formError}</p>}

            <div className="flex justify-end gap-3 border-t pt-4">
              <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) && (
                  <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                )}
                {editingAssignment ? 'Save Changes' : 'Assign Role'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Revoke confirmation */}
      <Dialog open={!!revokeTarget} onOpenChange={(v) => !v && setRevokeTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Revoke Role Assignment</DialogTitle>
            <DialogDescription>
              Revoke <span className="font-medium">{revokeTarget?.user_name}</span>&apos;s role as{' '}
              <span className="font-medium">{ROLE_META[revokeTarget?.role_type as DynamicRoleType]?.label ?? revokeTarget?.role_type}</span>{' '}
              on <span className="font-medium">{revokeTarget?.context_name}</span>?
              They will immediately lose access to the associated pages and data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRevokeTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmRevoke} disabled={revokeMutation.isPending}>
              {revokeMutation.isPending && <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
              Revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
