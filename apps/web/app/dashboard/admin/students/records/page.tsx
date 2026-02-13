"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  CloudUpload,
  Download,
  Upload,
  Plus,
  RefreshCw,
  Settings,
  MoreVertical,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useStudents,
  useDeleteStudent,
  type StudentListParams,
} from "@/lib/hooks/admin/use-students";

// ---------------------------------------------------------------------------
// Style maps
// ---------------------------------------------------------------------------

const PHASE_STYLES: Record<string, string> = {
  "Phase I": "bg-blue-900/20 text-blue-300 border-blue-900/30",
  "Phase II": "bg-indigo-900/20 text-indigo-300 border-indigo-900/30",
  "Phase III Part 1": "bg-violet-900/20 text-violet-300 border-violet-900/30",
  "Phase III Part 2": "bg-purple-900/20 text-purple-300 border-purple-900/30",
  CRMI: "bg-emerald-900/20 text-emerald-300 border-emerald-900/30",
};

const QUOTA_STYLES: Record<string, string> = {
  AIQ: "bg-blue-900/20 text-blue-300",
  State: "bg-purple-900/20 text-purple-300",
  Management: "bg-orange-900/20 text-orange-300",
  NRI: "bg-teal-900/20 text-teal-300",
};

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-900/20 text-green-400 border-green-900/30",
  enrolled: "bg-blue-900/20 text-blue-400 border-blue-900/30",
  dropped: "bg-red-900/20 text-red-400 border-red-900/30",
  graduated: "bg-emerald-900/20 text-emerald-400 border-emerald-900/30",
  suspended: "bg-yellow-900/20 text-yellow-400 border-yellow-900/30",
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PHASES = ["Phase I", "Phase II", "Phase III Part 1", "Phase III Part 2", "CRMI"];
const STATUSES = ["active", "enrolled", "dropped", "graduated", "suspended"];
const QUOTAS = ["AIQ", "State", "Management", "NRI"];
const PAGE_SIZES = [10, 25, 50, 100];

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function StudentRecordsPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [phaseFilter, setPhaseFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [quotaFilter, setQuotaFilter] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState<string>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Debounce search input
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  // Build query params
  const params: StudentListParams = {
    page,
    page_size: pageSize,
    search: debouncedSearch || undefined,
    current_phase: phaseFilter,
    status: statusFilter,
    admission_quota: quotaFilter,
    sort_by: sortBy,
    sort_order: sortOrder,
  };

  const { data, isLoading, isError, error, refetch } = useStudents(params);
  const deleteStudent = useDeleteStudent();

  const students = useMemo(() => data?.data ?? [], [data?.data]);
  const total = data?.total ?? 0;
  const totalPages = data?.total_pages ?? 1;

  // Reset page when filters change
  const applyFilter = useCallback(
    (setter: (v: string | undefined) => void, value: string | undefined) => {
      setter(value);
      setPage(1);
    },
    []
  );

  // Sort handler
  const handleSort = useCallback(
    (column: string) => {
      if (sortBy === column) {
        setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
      } else {
        setSortBy(column);
        setSortOrder("asc");
      }
      setPage(1);
    },
    [sortBy]
  );

  // Selection
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedIds.size === students.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(students.map((s) => s.id)));
    }
  }, [students, selectedIds.size]);

  // Delete handler
  const handleDelete = useCallback(
    (id: string) => {
      setOpenDropdown(null);
      deleteStudent.mutate(id);
    },
    [deleteStudent]
  );

  // Close dropdown on outside click
  useEffect(() => {
    if (!openDropdown) return;
    const handler = () => setOpenDropdown(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [openDropdown]);

  // Pagination range
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">Student Records</h1>
          {!isLoading && (
            <Badge className="border-emerald-500/20 bg-emerald-500/10 text-xs font-semibold text-emerald-500">
              {total} Total
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* TODO: Wire to NMC upload endpoint */}
          <Button variant="outline" size="sm">
            <CloudUpload className="mr-2 h-4 w-4" />
            NMC Data Upload
          </Button>
          {/* TODO: Wire to CSV export endpoint */}
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          {/* TODO: Wire to CSV import endpoint */}
          <Button variant="outline" size="sm">
            <Upload className="mr-2 h-4 w-4" />
            Bulk Import
          </Button>
          <Link href="/dashboard/admin/students/admissions/new">
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Student
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-xl border border-dark-border bg-dark-surface p-4 shadow-sm">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex flex-1 items-center gap-3 overflow-x-auto pb-2 md:pb-0">
            {/* Search */}
            <div className="relative w-full shrink-0 md:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                className="w-full rounded-lg border border-gray-700 bg-dark-elevated py-2 pl-9 pr-4 text-sm text-gray-200 placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="Search by name or enrollment..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="mx-2 hidden h-8 w-px bg-gray-700 md:block" />

            {/* Filter chips */}
            <div className="flex gap-2">
              <FilterDropdown
                label="Phase"
                value={phaseFilter}
                options={PHASES}
                onChange={(v) => applyFilter(setPhaseFilter, v)}
              />
              <FilterDropdown
                label="Status"
                value={statusFilter}
                options={STATUSES}
                onChange={(v) => applyFilter(setStatusFilter, v)}
              />
              <FilterDropdown
                label="Quota"
                value={quotaFilter}
                options={QUOTAS}
                onChange={(v) => applyFilter(setQuotaFilter, v)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="hidden md:inline">
              {total > 0
                ? `Showing ${startItem}-${endItem} of ${total}`
                : "No results"}
            </span>
            <button
              onClick={() => refetch()}
              className="rounded-md p-1.5 text-gray-400 hover:bg-dark-elevated hover:text-gray-200"
              title="Refresh"
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </button>
            <button className="rounded-md p-1.5 text-gray-400 hover:bg-dark-elevated hover:text-gray-200">
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Error State */}
      {isError && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-8 text-center">
          <AlertTriangle className="h-8 w-8 text-red-400" />
          <p className="text-sm text-red-400">
            {error?.message || "Failed to load students"}
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
                  <th className="w-10 p-4">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-600 bg-transparent text-emerald-500 focus:ring-emerald-500"
                      checked={students.length > 0 && selectedIds.size === students.length}
                      onChange={toggleAll}
                    />
                  </th>
                  <SortableHeader
                    label="Student Name"
                    column="name"
                    current={sortBy}
                    order={sortOrder}
                    onSort={handleSort}
                    className="min-w-[200px]"
                  />
                  <th className="p-4">Enrollment No.</th>
                  <th className="p-4">Univ. Reg. No.</th>
                  <th className="p-4">Phase</th>
                  <th className="p-4">Quota</th>
                  <SortableHeader
                    label="NEET Score"
                    column="neet_score"
                    current={sortBy}
                    order={sortOrder}
                    onSort={handleSort}
                    className="text-right"
                  />
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border text-sm">
                {isLoading &&
                  Array.from({ length: pageSize > 10 ? 10 : pageSize }).map((_, i) => (
                    <SkeletonRow key={i} />
                  ))}
                {!isLoading &&
                  students.map((s) => (
                    <tr
                      key={s.id}
                      className="group transition-colors hover:bg-dark-elevated/30"
                    >
                      <td className="p-4">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-600 bg-transparent text-emerald-500 focus:ring-emerald-500"
                          checked={selectedIds.has(s.id)}
                          onChange={() => toggleSelect(s.id)}
                        />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={s.name} />
                          <div>
                            <Link
                              href={`/dashboard/admin/students/records/${s.id}`}
                              className="font-medium text-white transition-colors hover:text-emerald-500"
                            >
                              {s.name}
                            </Link>
                            {s.email && (
                              <p className="text-xs text-gray-500">{s.email}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-mono text-xs text-gray-300">
                        {s.enrollment_number || "—"}
                      </td>
                      <td className="p-4 font-mono text-xs text-gray-400">
                        {s.university_registration_number || "—"}
                      </td>
                      <td className="p-4">
                        {s.current_phase ? (
                          <span
                            className={cn(
                              "inline-flex items-center rounded border px-2 py-1 text-xs font-medium",
                              PHASE_STYLES[s.current_phase] ??
                                "bg-gray-800 text-gray-300 border-gray-700"
                            )}
                          >
                            {s.current_phase}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500">—</span>
                        )}
                      </td>
                      <td className="p-4">
                        {s.admission_quota ? (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                              QUOTA_STYLES[s.admission_quota] ??
                                "bg-gray-800 text-gray-300"
                            )}
                          >
                            {s.admission_quota}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500">—</span>
                        )}
                      </td>
                      <td className="p-4 text-right font-medium text-white">
                        {s.neet_score ?? "—"}
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={cn(
                            "inline-flex items-center rounded border px-2 py-1 text-xs font-medium capitalize",
                            STATUS_STYLES[s.status] ??
                              "bg-gray-800 text-gray-400 border-gray-700"
                          )}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="relative p-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenDropdown(openDropdown === s.id ? null : s.id);
                          }}
                          className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-dark-elevated hover:text-emerald-500"
                        >
                          <MoreVertical className="h-[18px] w-[18px]" />
                        </button>
                        {openDropdown === s.id && (
                          <div className="absolute right-4 top-12 z-20 w-40 rounded-lg border border-dark-border bg-dark-surface py-1 shadow-lg">
                            <Link
                              href={`/dashboard/admin/students/records/${s.id}`}
                              className="block w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-dark-elevated hover:text-white"
                            >
                              View Details
                            </Link>
                            <button
                              onClick={() => handleDelete(s.id)}
                              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Drop Student
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Empty state */}
          {!isLoading && students.length === 0 && (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <Search className="h-8 w-8 text-gray-600" />
              <p className="text-sm text-gray-400">
                No students found. Add your first student or import from CSV.
              </p>
              <Link href="/dashboard/admin/students/admissions/new">
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Student
                </Button>
              </Link>
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
    </div>
  );
}

/* ---- Sub-components ---- */

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const colors = [
    "bg-indigo-900/30 text-indigo-400",
    "bg-pink-900/30 text-pink-400",
    "bg-orange-900/30 text-orange-400",
    "bg-teal-900/30 text-teal-400",
    "bg-blue-900/30 text-blue-400",
  ];
  const colorIndex = initials.charCodeAt(0) % colors.length;

  return (
    <div
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
        colors[colorIndex],
      )}
    >
      {initials}
    </div>
  );
}

function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | undefined;
  options: string[];
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

  if (value) {
    return (
      <button
        onClick={() => onChange(undefined)}
        className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-emerald-500/50 bg-emerald-500/20 px-3 py-1.5 text-sm font-medium text-emerald-500 transition-colors hover:bg-emerald-500/30"
      >
        {label}: {value}
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
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SortableHeader({
  label,
  column,
  current,
  order,
  onSort,
  className,
}: {
  label: string;
  column: string;
  current: string;
  order: "asc" | "desc";
  onSort: (col: string) => void;
  className?: string;
}) {
  const isActive = current === column;
  return (
    <th
      className={cn("cursor-pointer select-none p-4 transition-colors hover:text-gray-200", className)}
      onClick={() => onSort(column)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && (
          <span className="text-emerald-500">
            {order === "asc" ? "↑" : "↓"}
          </span>
        )}
      </span>
    </th>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-dark-border">
      <td className="p-4">
        <div className="h-4 w-4 animate-pulse rounded bg-gray-700" />
      </td>
      <td className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 animate-pulse rounded-full bg-gray-700" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-32 animate-pulse rounded bg-gray-700" />
            <div className="h-3 w-40 animate-pulse rounded bg-gray-700/60" />
          </div>
        </div>
      </td>
      <td className="p-4"><div className="h-3.5 w-28 animate-pulse rounded bg-gray-700" /></td>
      <td className="p-4"><div className="h-3.5 w-24 animate-pulse rounded bg-gray-700" /></td>
      <td className="p-4"><div className="h-6 w-16 animate-pulse rounded bg-gray-700" /></td>
      <td className="p-4"><div className="h-5 w-12 animate-pulse rounded-full bg-gray-700" /></td>
      <td className="p-4 text-right"><div className="ml-auto h-3.5 w-10 animate-pulse rounded bg-gray-700" /></td>
      <td className="p-4 text-center"><div className="mx-auto h-6 w-14 animate-pulse rounded bg-gray-700" /></td>
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

  // Show: 1 ... current-1 current current+1 ... total
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
