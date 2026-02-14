"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  UserPlus,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Hourglass,
  Gavel,
  Lightbulb,
  Search,
  AlertTriangle,
  Loader2,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import {
  useFaculty,
  useCreateFaculty,
  useMSRCompliance,
  useRetirementForecast,
} from "@/lib/hooks/admin/use-faculty";
import { useDepartments } from "@/lib/hooks/admin/use-departments";
import type {
  FacultyResponse,
  FacultyCreate,
  MSRDepartmentStatus,
  RetirementForecastItem,
  DepartmentResponse,
} from "@/types/admin-api";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_DOT: Record<string, { color: string; title: string }> = {
  active: { color: "bg-emerald-500", title: "Active" },
  on_leave: { color: "bg-yellow-500", title: "On Leave" },
  sabbatical: { color: "bg-blue-500", title: "Sabbatical" },
  deputation: { color: "bg-purple-500", title: "Deputation" },
  resigned: { color: "bg-orange-500", title: "Resigned" },
  retired: { color: "bg-gray-500", title: "Retired" },
  terminated: { color: "bg-red-500", title: "Terminated" },
  notice_period: { color: "bg-red-500", title: "Notice Period" },
};

const DESIGNATION_STYLES: Record<string, string> = {
  Professor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  "Associate Professor": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "Assistant Professor": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Tutor: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  "Senior Resident": "bg-orange-500/10 text-orange-400 border-orange-500/20",
  Demonstrator: "bg-teal-500/10 text-teal-400 border-teal-500/20",
};

const INITIALS_COLORS = [
  "bg-indigo-500/20 text-indigo-400",
  "bg-pink-500/20 text-pink-400",
  "bg-teal-500/20 text-teal-400",
  "bg-orange-500/20 text-orange-400",
  "bg-purple-500/20 text-purple-400",
  "bg-cyan-500/20 text-cyan-400",
  "bg-rose-500/20 text-rose-400",
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter((w) => w.length > 0)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function getInitialsColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return INITIALS_COLORS[Math.abs(hash) % INITIALS_COLORS.length];
}

function formatRetirementCountdown(yearsUntil: number): string {
  const years = Math.floor(yearsUntil);
  const months = Math.round((yearsUntil - years) * 12);
  if (years === 0) return `${months}m left`;
  return months > 0 ? `${years}y ${months}m left` : `${years}y left`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FacultyRosterPage() {
  const router = useRouter();

  // Filters
  const [deptFilter, setDeptFilter] = useState("all");
  const [designationFilter, setDesignationFilter] = useState("all");
  const [employmentFilter, setEmploymentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  // Add Faculty dialog
  const [showAddFaculty, setShowAddFaculty] = useState(false);

  // Debounce search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  // --- Data hooks ---
  const msr = useMSRCompliance();
  const retirement = useRetirementForecast(3);
  const departments = useDepartments({ page_size: 100, active_only: true });

  const faculty = useFaculty({
    page,
    page_size: pageSize,
    search: debouncedSearch || undefined,
    department_id: deptFilter === "all" ? undefined : deptFilter,
    designation: designationFilter === "all" ? undefined : designationFilter,
    employment_type: employmentFilter === "all" ? undefined : employmentFilter,
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const totalResults = faculty.data?.total ?? 0;
  const totalPages = faculty.data?.total_pages ?? 1;
  const deptList = departments.data?.data ?? [];

  // Department lookup map for table
  const deptMap = new Map<string, string>();
  for (const d of deptList) {
    deptMap.set(d.id, d.name);
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Faculty Roster</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-gray-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {faculty.isLoading
              ? "Loading..."
              : `${totalResults} Faculty Members`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export Roster
          </Button>
          <Button
            className="gap-2 bg-emerald-600 shadow-lg shadow-emerald-500/20 hover:bg-emerald-700"
            onClick={() => setShowAddFaculty(true)}
          >
            <UserPlus className="h-4 w-4" />
            Add Faculty
          </Button>
        </div>
      </div>

      {/* MSR Compliance Status Bar */}
      {msr.isLoading ? (
        <MSRSkeleton />
      ) : msr.data ? (
        <MSRComplianceBanner data={msr.data} />
      ) : null}

      {/* Main 3/4 + 1/4 Grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
        {/* Left Column — Filters + Table + Retirement */}
        <div className="space-y-6 xl:col-span-3">
          {/* Search + Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                {/* Search */}
                <div className="relative col-span-2 md:col-span-1">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                    <Search className="h-3.5 w-3.5" />
                  </span>
                  <input
                    className="w-full rounded-lg border border-dark-border bg-dark-elevated py-2 pl-9 pr-3 text-xs text-white placeholder-gray-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    placeholder="Search name, email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                {/* Department — real data */}
                <Select
                  value={deptFilter}
                  onValueChange={(v) => { setDeptFilter(v); setPage(1); }}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {deptList.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Designation */}
                <Select
                  value={designationFilter}
                  onValueChange={(v) => { setDesignationFilter(v); setPage(1); }}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="All Designations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Designations</SelectItem>
                    <SelectItem value="Professor">Professor</SelectItem>
                    <SelectItem value="Associate Professor">Assoc. Prof</SelectItem>
                    <SelectItem value="Assistant Professor">Asst. Prof</SelectItem>
                    <SelectItem value="Tutor">Tutor</SelectItem>
                    <SelectItem value="Senior Resident">Senior Resident</SelectItem>
                    <SelectItem value="Demonstrator">Demonstrator</SelectItem>
                  </SelectContent>
                </Select>

                {/* Employment Type */}
                <Select
                  value={employmentFilter}
                  onValueChange={(v) => { setEmploymentFilter(v); setPage(1); }}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Employment Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Employment Type</SelectItem>
                    <SelectItem value="permanent">Permanent</SelectItem>
                    <SelectItem value="contractual">Contractual</SelectItem>
                    <SelectItem value="visiting">Visiting</SelectItem>
                    <SelectItem value="adjunct">Adjunct</SelectItem>
                  </SelectContent>
                </Select>

                {/* Status */}
                <Select
                  value={statusFilter}
                  onValueChange={(v) => { setStatusFilter(v); setPage(1); }}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on_leave">On Leave</SelectItem>
                    <SelectItem value="sabbatical">Sabbatical</SelectItem>
                    <SelectItem value="deputation">Deputation</SelectItem>
                    <SelectItem value="resigned">Resigned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Faculty Table */}
          <Card className="flex flex-col overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-dark-border bg-dark-elevated/50 hover:bg-dark-elevated/50">
                    <TableHead className="w-10 p-3 text-center">
                      <Checkbox />
                    </TableHead>
                    <TableHead className="min-w-[200px] p-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Faculty Name
                    </TableHead>
                    <TableHead className="p-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Designation
                    </TableHead>
                    <TableHead className="p-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Department
                    </TableHead>
                    <TableHead className="p-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Qualification
                    </TableHead>
                    <TableHead className="p-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      IDs (AEBAS/NMC)
                    </TableHead>
                    <TableHead className="p-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Service Dates
                    </TableHead>
                    <TableHead className="p-3 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Status
                    </TableHead>
                    <TableHead className="w-10 p-3" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {faculty.isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <FacultySkeletonRow key={i} />
                    ))
                  ) : faculty.data && faculty.data.data.length > 0 ? (
                    faculty.data.data.map((f) => (
                      <FacultyTableRow
                        key={f.id}
                        faculty={f}
                        deptName={deptMap.get(f.department_id) ?? "—"}
                        onView={() =>
                          router.push(`/dashboard/admin/hr/${f.id}`)
                        }
                      />
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="py-12 text-center text-sm text-gray-500"
                      >
                        {faculty.isError
                          ? "Failed to load faculty data."
                          : "No faculty match your filters."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-dark-border bg-dark-elevated/30 p-3 text-xs text-gray-400">
              <div>
                {faculty.isLoading
                  ? "Loading..."
                  : `Showing ${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, totalResults)} of ${totalResults} faculty`}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                  const pNum = i + 1;
                  return (
                    <Button
                      key={pNum}
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-7 w-7",
                        pNum === page && "bg-dark-elevated text-white",
                      )}
                      onClick={() => setPage(pNum)}
                    >
                      {pNum}
                    </Button>
                  );
                })}
                {totalPages > 5 && (
                  <span className="px-1 text-gray-500">...</span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>

          {/* Retirement Countdown */}
          {retirement.isLoading ? (
            <RetirementSkeleton />
          ) : retirement.data && retirement.data.retirements.length > 0 ? (
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-300">
                <Hourglass className="h-4 w-4 text-orange-400" />
                Retirement Countdown (Next {retirement.data.forecast_years} Years)
                <span className="ml-auto text-xs font-normal text-gray-500">
                  {retirement.data.total_retiring} faculty retiring
                </span>
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {retirement.data.retirements.map((r) => (
                  <RetirementCard key={r.faculty_id} item={r} />
                ))}
              </div>
            </div>
          ) : retirement.data ? (
            <Card className="p-6 text-center text-sm text-gray-500">
              No retirements forecast in the next 3 years.
            </Card>
          ) : null}
        </div>

        {/* Right Column — NMC Rules Quick Reference */}
        <div className="xl:col-span-1">
          <NMCQuickReference />
        </div>
      </div>

      {/* Add Faculty Dialog */}
      <AddFacultyDialog
        open={showAddFaculty}
        onOpenChange={setShowAddFaculty}
        departments={deptList}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// MSR Compliance Banner
// ---------------------------------------------------------------------------

function MSRComplianceBanner({
  data,
}: {
  data: {
    overall_compliance_percentage: number;
    severity: string;
    total_required: number;
    total_actual: number;
    total_gap: number;
    non_compliant_departments: number;
    departments: MSRDepartmentStatus[];
  };
}) {
  const severityColor: Record<string, string> = {
    green: "text-emerald-400",
    yellow: "text-yellow-400",
    orange: "text-orange-400",
    red: "text-red-400",
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col items-center justify-between gap-2 border-b border-dark-border bg-dark-elevated/50 px-4 py-3 md:flex-row">
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          <ShieldCheck className="h-5 w-5 text-emerald-500" />
          College MSR Status:{" "}
          <span
            className={cn(
              "font-bold",
              severityColor[data.severity] ?? "text-gray-400",
            )}
          >
            {Math.round(data.overall_compliance_percentage)}% Compliant
          </span>
          {data.total_gap > 0 && (
            <>
              <span className="mx-2 text-gray-500">&mdash;</span>
              <span className="text-orange-400">
                {data.total_gap} positions to fill across{" "}
                {data.non_compliant_departments} departments
              </span>
            </>
          )}
        </div>
        <Button variant="link" size="sm" className="h-auto p-0 text-xs">
          View Detailed MSR Report
        </Button>
      </div>

      <div className="flex items-center gap-4 overflow-x-auto p-4 scrollbar-none">
        {data.departments.map((dept) => (
          <div
            key={dept.department_id}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-lg border bg-dark-elevated px-3 py-1.5",
              !dept.is_compliant ? "border-red-900/30" : "border-dark-border",
            )}
          >
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                !dept.is_compliant
                  ? "animate-pulse bg-red-500"
                  : "bg-emerald-500",
              )}
            />
            <span className="text-sm font-medium text-gray-300">
              {dept.department_name}
            </span>
            <span className="ml-1 text-xs text-gray-500">
              Req: {dept.required} / Act: {dept.actual}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Faculty Table Row
// ---------------------------------------------------------------------------

function FacultyTableRow({
  faculty: f,
  deptName,
  onView,
}: {
  faculty: FacultyResponse;
  deptName: string;
  onView: () => void;
}) {
  const initials = getInitials(f.name);
  const initialsColor = getInitialsColor(f.id);
  const statusInfo = STATUS_DOT[f.status] ?? STATUS_DOT.active;
  const desigStyle =
    DESIGNATION_STYLES[f.designation ?? ""] ??
    "bg-gray-500/10 text-gray-400 border-gray-500/20";

  const retirementYears =
    f.retirement_date
      ? Math.max(
          0,
          (new Date(f.retirement_date).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24 * 365.25),
        )
      : null;

  const dojFormatted = f.date_of_joining
    ? new Date(f.date_of_joining).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

  return (
    <TableRow
      className={cn(
        "group cursor-pointer border-dark-border transition-colors hover:bg-[#262626]/20",
        f.status === "resigned" && "bg-red-500/5",
        f.status === "terminated" && "bg-red-500/5",
      )}
      onClick={onView}
    >
      <TableCell className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
        <Checkbox />
      </TableCell>
      <TableCell className="p-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
              initialsColor,
            )}
          >
            {initials}
          </div>
          <div>
            <p className="text-sm font-medium text-white">{f.name}</p>
            <p className="text-[10px] text-gray-500">
              {f.employment_type ?? "—"} &bull; {f.gender ?? "—"}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className="p-3">
        {f.designation ? (
          <span
            className={cn(
              "inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium",
              desigStyle,
            )}
          >
            {f.designation}
          </span>
        ) : (
          <span className="text-xs text-gray-600">—</span>
        )}
      </TableCell>
      <TableCell className="p-3 text-xs text-gray-300">{deptName}</TableCell>
      <TableCell className="p-3 text-xs text-gray-400">
        {f.qualification ?? "—"}
        {f.specialization && (
          <span className="block text-[10px] text-gray-500">
            {f.specialization}
          </span>
        )}
      </TableCell>
      <TableCell className="p-3 text-gray-400">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-gray-300">
            AE: {f.aebas_id ?? "—"}
          </span>
          <span className="text-[10px]">NMC: {f.nmc_faculty_id ?? "—"}</span>
        </div>
      </TableCell>
      <TableCell className="p-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-gray-300">DOJ: {dojFormatted}</span>
          {retirementYears != null && (
            <span
              className={cn(
                "text-[10px]",
                retirementYears <= 3
                  ? "font-medium text-orange-400"
                  : "text-gray-500",
              )}
            >
              Ret: {formatRetirementCountdown(retirementYears)}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="p-3 text-center">
        <span
          className={cn("inline-block h-2 w-2 rounded-full", statusInfo.color)}
          title={statusInfo.title}
        />
      </TableCell>
      <TableCell className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-gray-500 hover:text-white"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

// ---------------------------------------------------------------------------
// Retirement Card
// ---------------------------------------------------------------------------

function RetirementCard({ item: r }: { item: RetirementForecastItem }) {
  const initials = getInitials(r.faculty_name);
  const initialsColor = getInitialsColor(r.faculty_id);
  const isMSRImpact = r.msr_impact === "true" || r.msr_impact === "high";

  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all hover:border-orange-500/30",
        isMSRImpact && "border-red-900/30",
      )}
    >
      <div className="absolute right-0 top-0 p-2">
        <span
          className={cn(
            "rounded border px-2 py-0.5 text-[10px] font-medium",
            isMSRImpact
              ? "border-red-500/20 bg-red-500/10 text-red-400"
              : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
          )}
        >
          {isMSRImpact ? "Impact on MSR" : "Safe"}
        </span>
      </div>
      <CardContent className="p-4">
        <div className="mt-1 flex items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold",
              initialsColor,
            )}
          >
            {initials}
          </div>
          <div>
            <p className="text-sm font-medium text-white">{r.faculty_name}</p>
            <p className="text-xs text-gray-500">
              {r.designation} &bull; {r.department_name}
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-dark-border pt-3">
          <span className="text-xs text-gray-400">Retires in:</span>
          <span className="font-mono text-sm font-bold text-orange-400">
            {formatRetirementCountdown(r.years_until_retirement)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Add Faculty Dialog
// ---------------------------------------------------------------------------

interface FacultyFormData {
  name: string;
  email: string;
  phone: string;
  gender: string;
  designation: string;
  department_id: string;
  qualification: string;
  specialization: string;
  employment_type: string;
  date_of_joining: string;
  nmc_faculty_id: string;
  aebas_id: string;
}

const INITIAL_FACULTY_FORM: FacultyFormData = {
  name: "",
  email: "",
  phone: "",
  gender: "",
  designation: "",
  department_id: "",
  qualification: "",
  specialization: "",
  employment_type: "",
  date_of_joining: "",
  nmc_faculty_id: "",
  aebas_id: "",
};

function AddFacultyDialog({
  open,
  onOpenChange,
  departments,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departments: DepartmentResponse[];
}) {
  const [form, setForm] = useState<FacultyFormData>(INITIAL_FACULTY_FORM);
  const createFaculty = useCreateFaculty();

  function update(field: keyof FacultyFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit() {
    const payload: FacultyCreate = {
      name: form.name,
      email: form.email || undefined,
      phone: form.phone || undefined,
      gender: form.gender || undefined,
      designation: form.designation || undefined,
      department_id: form.department_id,
      qualification: form.qualification || undefined,
      specialization: form.specialization || undefined,
      employment_type: form.employment_type || undefined,
      date_of_joining: form.date_of_joining || undefined,
      nmc_faculty_id: form.nmc_faculty_id || undefined,
      aebas_id: form.aebas_id || undefined,
    };

    createFaculty.mutate(payload, {
      onSuccess: () => {
        setForm(INITIAL_FACULTY_FORM);
        onOpenChange(false);
      },
    });
  }

  function handleOpenChange(val: boolean) {
    if (!val) {
      setForm(INITIAL_FACULTY_FORM);
      createFaculty.reset();
    }
    onOpenChange(val);
  }

  const inputCls =
    "w-full rounded-lg border border-dark-border bg-dark-elevated px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500";
  const selectCls =
    "w-full rounded-lg border border-dark-border bg-dark-elevated px-3 py-2 text-sm text-gray-300 outline-none focus:border-emerald-500";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl border-dark-border bg-dark-surface text-white">
        <DialogHeader>
          <DialogTitle>Add Faculty Member</DialogTitle>
        </DialogHeader>

        {createFaculty.isError && (
          <div className="mb-4 rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-300">
            <AlertTriangle className="mr-1 inline h-4 w-4" />
            {createFaculty.error?.message ?? "Failed to add faculty."}
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">
                Full Name *
              </label>
              <input
                className={inputCls}
                placeholder="Dr. Full Name"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">
                Email
              </label>
              <input
                className={inputCls}
                type="email"
                placeholder="email@college.edu"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">
                Phone
              </label>
              <input
                className={inputCls}
                placeholder="9876543210"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">
                Gender
              </label>
              <select
                className={selectCls}
                value={form.gender}
                onChange={(e) => update("gender", e.target.value)}
              >
                <option value="">Select</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">
                Employment Type
              </label>
              <select
                className={selectCls}
                value={form.employment_type}
                onChange={(e) => update("employment_type", e.target.value)}
              >
                <option value="">Select</option>
                <option value="permanent">Permanent</option>
                <option value="contractual">Contractual</option>
                <option value="visiting">Visiting</option>
                <option value="adjunct">Adjunct</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">
                Department *
              </label>
              <select
                className={selectCls}
                value={form.department_id}
                onChange={(e) => update("department_id", e.target.value)}
              >
                <option value="">Select Department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">
                Designation
              </label>
              <select
                className={selectCls}
                value={form.designation}
                onChange={(e) => update("designation", e.target.value)}
              >
                <option value="">Select</option>
                <option value="Professor">Professor</option>
                <option value="Associate Professor">Associate Professor</option>
                <option value="Assistant Professor">Assistant Professor</option>
                <option value="Tutor">Tutor</option>
                <option value="Senior Resident">Senior Resident</option>
                <option value="Demonstrator">Demonstrator</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">
                Qualification
              </label>
              <select
                className={selectCls}
                value={form.qualification}
                onChange={(e) => update("qualification", e.target.value)}
              >
                <option value="">Select</option>
                <option value="MBBS">MBBS</option>
                <option value="MD">MD</option>
                <option value="MS">MS</option>
                <option value="DNB">DNB</option>
                <option value="PhD">PhD</option>
                <option value="DM">DM</option>
                <option value="MCh">MCh</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">
                Specialization
              </label>
              <input
                className={inputCls}
                placeholder="e.g., Anatomy, Pathology"
                value={form.specialization}
                onChange={(e) => update("specialization", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">
                Date of Joining
              </label>
              <input
                className={inputCls}
                type="date"
                value={form.date_of_joining}
                onChange={(e) => update("date_of_joining", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">
                NMC Faculty ID
              </label>
              <input
                className={inputCls}
                placeholder="e.g., 12345/2000"
                value={form.nmc_faculty_id}
                onChange={(e) => update("nmc_faculty_id", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">
                AEBAS ID
              </label>
              <input
                className={inputCls}
                placeholder="e.g., 100293"
                value={form.aebas_id}
                onChange={(e) => update("aebas_id", e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-3 border-t border-dark-border pt-4">
          <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!form.name || !form.department_id || createFaculty.isPending}
            className="shadow-lg shadow-emerald-500/20"
          >
            {createFaculty.isPending && (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            )}
            Add Faculty
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// NMC Quick Reference (static — kept from original)
// ---------------------------------------------------------------------------

function NMCQuickReference() {
  return (
    <Card className="sticky top-6">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Gavel className="h-5 w-5 text-emerald-500" />
          <h3 className="text-base font-bold text-white">
            NMC Rules Quick Reference
          </h3>
        </div>
        <div className="space-y-4">
          <div className="border-b border-dark-border pb-4">
            <h4 className="mb-1 text-sm font-medium text-gray-200">
              DNB Equivalency
            </h4>
            <p className="text-xs leading-relaxed text-gray-400">
              DNB candidates need{" "}
              <span className="font-medium text-emerald-500">
                1 additional year
              </span>{" "}
              of senior residency in an NMC-recognized college to be
              eligible for Assistant Professor.
            </p>
          </div>
          <div className="border-b border-dark-border pb-4">
            <h4 className="mb-1 text-sm font-medium text-gray-200">
              Non-Medical Teachers
            </h4>
            <p className="text-xs leading-relaxed text-gray-400">
              Permissible up to{" "}
              <span className="font-medium text-emerald-500">30%</span> in
              Anatomy, Physiology, Biochemistry, and{" "}
              <span className="font-medium text-emerald-500">15%</span> in
              Microbiology, Pharmacology.
            </p>
          </div>
          <div className="border-b border-dark-border pb-4">
            <h4 className="mb-1 text-sm font-medium text-gray-200">
              Govt. Specialist Quota
            </h4>
            <p className="text-xs leading-relaxed text-gray-400">
              Specialists with &gt;8 years experience in Govt. hospitals
              can be designated as{" "}
              <span className="font-medium text-emerald-500">
                Assistant Professor
              </span>{" "}
              directly (Consultant designation).
            </p>
          </div>
          <div>
            <h4 className="mb-1 text-sm font-medium text-gray-200">
              Visiting Faculty
            </h4>
            <p className="text-xs leading-relaxed text-gray-400">
              Visiting faculty do NOT count towards MSR requirements for
              undergraduate courses.
            </p>
          </div>
        </div>
        <div className="mt-6 rounded-lg border border-dark-border bg-dark-elevated/50 p-3">
          <div className="flex gap-2">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
            <p className="text-[10px] text-gray-400">
              Tip: Always cross-verify AEBAS attendance. &lt; 75%
              attendance triggers automatic NMC deficiency notice.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function MSRSkeleton() {
  return (
    <Card className="animate-pulse">
      <div className="border-b border-dark-border px-4 py-3">
        <div className="h-5 w-64 rounded bg-gray-800" />
      </div>
      <div className="flex gap-4 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 w-32 shrink-0 rounded-lg bg-gray-800" />
        ))}
      </div>
    </Card>
  );
}

function FacultySkeletonRow() {
  return (
    <TableRow className="animate-pulse border-dark-border">
      <TableCell className="p-3 text-center">
        <div className="mx-auto h-4 w-4 rounded bg-gray-800" />
      </TableCell>
      <TableCell className="p-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-gray-800" />
          <div className="space-y-1">
            <div className="h-4 w-28 rounded bg-gray-800" />
            <div className="h-3 w-20 rounded bg-gray-800" />
          </div>
        </div>
      </TableCell>
      <TableCell className="p-3">
        <div className="h-5 w-20 rounded bg-gray-800" />
      </TableCell>
      <TableCell className="p-3">
        <div className="h-4 w-24 rounded bg-gray-800" />
      </TableCell>
      <TableCell className="p-3">
        <div className="h-4 w-20 rounded bg-gray-800" />
      </TableCell>
      <TableCell className="p-3">
        <div className="space-y-1">
          <div className="h-3 w-16 rounded bg-gray-800" />
          <div className="h-3 w-20 rounded bg-gray-800" />
        </div>
      </TableCell>
      <TableCell className="p-3">
        <div className="space-y-1">
          <div className="h-3 w-24 rounded bg-gray-800" />
          <div className="h-3 w-16 rounded bg-gray-800" />
        </div>
      </TableCell>
      <TableCell className="p-3 text-center">
        <div className="mx-auto h-2 w-2 rounded-full bg-gray-800" />
      </TableCell>
      <TableCell className="p-3">
        <div className="mx-auto h-5 w-5 rounded bg-gray-800" />
      </TableCell>
    </TableRow>
  );
}

function RetirementSkeleton() {
  return (
    <div>
      <div className="mb-3 h-5 w-52 rounded bg-gray-800" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-gray-800" />
                <div className="space-y-1">
                  <div className="h-4 w-28 rounded bg-gray-800" />
                  <div className="h-3 w-36 rounded bg-gray-800" />
                </div>
              </div>
              <div className="mt-4 flex justify-between border-t border-dark-border pt-3">
                <div className="h-3 w-16 rounded bg-gray-800" />
                <div className="h-4 w-20 rounded bg-gray-800" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
