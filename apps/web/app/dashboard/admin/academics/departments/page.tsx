"use client";

import { useState, useMemo } from "react";
import {
  Plus,
  LayoutGrid,
  List,
  Users,
  ShieldCheck,
  BedDouble,
  FlaskConical as Flask,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  Bone,
  HeartPulse,
  FlaskConical,
  Stethoscope,
  Scissors,
  Baby,
  Microscope,
  Bug,
  Pill,
  Accessibility,
  Eye,
  X,
  Building2,
  DoorOpen,
  MonitorSmartphone,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDepartments } from "@/lib/hooks/admin/use-departments";
import { useMSRCompliance, useFaculty } from "@/lib/hooks/admin/use-faculty";
import type {
  DepartmentResponse,
  MSRDepartmentStatus,
  FacultyResponse,
} from "@/types/admin-api";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEPT_ICONS: Record<string, LucideIcon> = {
  anatomy: Bone,
  physiology: HeartPulse,
  biochemistry: FlaskConical,
  medicine: Stethoscope,
  surgery: Scissors,
  obg: Baby,
  pediatrics: Baby,
  pathology: Microscope,
  microbiology: Bug,
  pharmacology: Pill,
  orthopaedics: Accessibility,
  ophthalmology: Eye,
  "gen. medicine": Stethoscope,
  "gen. surgery": Scissors,
  dermatology: Stethoscope,
  psychiatry: Stethoscope,
  radiology: MonitorSmartphone,
  anaesthesiology: Stethoscope,
  "community medicine": Users,
  "forensic medicine": Microscope,
  ent: Stethoscope,
  "respiratory medicine": HeartPulse,
  "emergency medicine": HeartPulse,
};

const MSR_BADGE: Record<
  string,
  { label: string; classes: string; borderClass?: string }
> = {
  compliant: {
    label: "Compliant",
    classes: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  at_risk: {
    label: "At Risk",
    classes: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  },
  non_compliant: {
    label: "Non-Compliant",
    classes: "bg-red-500/10 text-red-400 border-red-500/20",
    borderClass: "border-red-900/40",
  },
};

const FACULTY_COLOR: Record<string, string> = {
  compliant: "text-emerald-400",
  at_risk: "text-yellow-400",
  non_compliant: "text-red-400",
};

const NMC_TYPE_LABELS: Record<string, string> = {
  preclinical: "Pre-Clinical",
  paraclinical: "Para-Clinical",
  clinical: "Clinical",
};

function getDeptIconKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z. ]/g, "").trim();
}

function msrStatusKey(msrDept: MSRDepartmentStatus | undefined): string {
  if (!msrDept) return "compliant";
  if (msrDept.is_compliant) return "compliant";
  if (msrDept.compliance_percentage >= 80) return "at_risk";
  return "non_compliant";
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DepartmentManagementPage() {
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Data hooks
  const { data: deptData, isLoading: deptLoading } = useDepartments({
    page,
    page_size: pageSize,
  });
  const { data: msrData } = useMSRCompliance();
  const { data: allFaculty } = useFaculty({ page_size: 500 });

  // Maps
  const msrMap = useMemo(() => {
    const m = new Map<string, MSRDepartmentStatus>();
    msrData?.departments?.forEach((d) => m.set(d.department_id, d));
    return m;
  }, [msrData]);

  const facultyMap = useMemo(() => {
    const m = new Map<string, FacultyResponse>();
    allFaculty?.data?.forEach((f) => m.set(f.id, f));
    return m;
  }, [allFaculty]);

  const departments = deptData?.data ?? [];
  const total = deptData?.total ?? 0;
  const totalPages = deptData?.total_pages ?? 0;

  // Stat cards derived from real data
  const totalFacultyActual = msrData?.total_actual ?? 0;
  const totalFacultyRequired = msrData?.total_required ?? 0;
  const msrCompliancePct = msrData?.overall_compliance_percentage ?? 0;
  const totalBeds = departments.reduce((s, d) => s + (d.beds ?? 0), 0);
  const compliantDepts = msrData?.compliant_departments ?? 0;
  const totalDepts = (msrData?.compliant_departments ?? 0) + (msrData?.non_compliant_departments ?? 0);

  const STAT_CARDS = [
    {
      label: "Total Faculty",
      value: String(totalFacultyActual),
      sub: `/ ${totalFacultyRequired}`,
      icon: Users,
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-400",
    },
    {
      label: "MSR Compliance",
      value: `${Math.round(msrCompliancePct)}%`,
      icon: ShieldCheck,
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-400",
      valueColor:
        msrCompliancePct >= 100
          ? "text-emerald-400"
          : msrCompliancePct >= 80
            ? "text-yellow-400"
            : "text-red-400",
    },
    {
      label: "Total Beds",
      value: String(totalBeds),
      icon: BedDouble,
      iconBg: "bg-purple-500/10",
      iconColor: "text-purple-400",
    },
    {
      label: "Compliant Depts",
      value: `${compliantDepts}/${totalDepts}`,
      icon: GraduationCap,
      iconBg: "bg-orange-500/10",
      iconColor: "text-orange-400",
    },
  ];

  // Selected department for detail panel
  const selectedDept = departments.find((d) => d.id === selectedDeptId) ?? null;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Departments</h1>
          <p className="mt-1 text-sm text-gray-400">
            {total > 0
              ? `${total} Clinical, Para-clinical and Pre-clinical Departments`
              : "Loading departments\u2026"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-dark-border bg-dark-surface p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "rounded p-1.5 transition-colors",
                viewMode === "grid"
                  ? "bg-[#262626] text-white shadow-sm"
                  : "text-gray-400 hover:text-white",
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "rounded p-1.5 transition-colors",
                viewMode === "list"
                  ? "bg-[#262626] text-white shadow-sm"
                  : "text-gray-400 hover:text-white",
              )}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
          <Button size="sm" className="shadow-lg shadow-emerald-500/20">
            <Plus className="mr-2 h-4 w-4" /> New Department
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {STAT_CARDS.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                  {stat.label}
                </p>
                <p className={cn("mt-1 text-2xl font-bold", stat.valueColor ?? "text-white")}>
                  {stat.value}
                  {stat.sub && (
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      {stat.sub}
                    </span>
                  )}
                </p>
              </div>
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-full", stat.iconBg)}>
                <Icon className={cn("h-5 w-5", stat.iconColor)} />
              </div>
            </Card>
          );
        })}
      </div>

      {/* Loading */}
      {deptLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-sm text-gray-400">Loading departments\u2026</span>
        </div>
      )}

      {/* Department Cards Grid */}
      {!deptLoading && viewMode === "grid" && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {departments.map((dept) => (
            <DepartmentCard
              key={dept.id}
              dept={dept}
              msrDept={msrMap.get(dept.id)}
              hodName={dept.hod_id ? facultyMap.get(dept.hod_id)?.name : undefined}
              onClick={() => setSelectedDeptId(dept.id)}
            />
          ))}
        </div>
      )}

      {/* Department List View */}
      {!deptLoading && viewMode === "list" && (
        <div className="overflow-hidden rounded-xl border border-dark-border bg-dark-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-border bg-[#262626]/50 text-xs uppercase tracking-wider text-gray-400">
                <th className="px-4 py-3 text-left">Department</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">HOD</th>
                <th className="px-4 py-3 text-center">Faculty</th>
                <th className="px-4 py-3 text-center">Beds</th>
                <th className="px-4 py-3 text-center">Labs</th>
                <th className="px-4 py-3 text-center">MSR Status</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((dept) => {
                const msr = msrMap.get(dept.id);
                const status = msrStatusKey(msr);
                const badge = MSR_BADGE[status];
                return (
                  <tr
                    key={dept.id}
                    onClick={() => setSelectedDeptId(dept.id)}
                    className="cursor-pointer border-b border-dark-border transition-colors last:border-0 hover:bg-[#262626]/50"
                  >
                    <td className="px-4 py-3 font-medium text-white">{dept.name}</td>
                    <td className="px-4 py-3 text-gray-400">
                      {NMC_TYPE_LABELS[dept.nmc_department_type] ?? dept.nmc_department_type}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {dept.hod_id ? (facultyMap.get(dept.hod_id)?.name ?? "\u2014") : "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("font-mono font-medium", FACULTY_COLOR[status])}>
                        {msr?.actual ?? "\u2014"}/{msr?.required ?? "\u2014"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-300">{dept.beds ?? 0}</td>
                    <td className="px-4 py-3 text-center text-gray-300">{dept.labs ?? 0}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-bold", badge.classes)}>
                        {badge.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-dark-border pt-4">
          <div className="text-xs text-gray-400">
            Showing {(page - 1) * pageSize + 1}\u2013{Math.min(page * pageSize, total)} of {total} departments
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded p-2 text-gray-400 hover:bg-[#262626] disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={cn(
                  "rounded px-3 py-1 text-xs font-medium",
                  p === page
                    ? "border border-dark-border bg-[#262626] text-white"
                    : "text-gray-400 hover:bg-[#262626]",
                )}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded p-2 text-gray-400 hover:bg-[#262626] disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Department Detail Panel (slide-over) */}
      {selectedDept && (
        <DepartmentDetail
          dept={selectedDept}
          msrDept={msrMap.get(selectedDept.id)}
          hodName={selectedDept.hod_id ? facultyMap.get(selectedDept.hod_id)?.name : undefined}
          onClose={() => setSelectedDeptId(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Department Card
// ---------------------------------------------------------------------------

function DepartmentCard({
  dept,
  msrDept,
  hodName,
  onClick,
}: {
  dept: DepartmentResponse;
  msrDept: MSRDepartmentStatus | undefined;
  hodName: string | undefined;
  onClick: () => void;
}) {
  const status = msrStatusKey(msrDept);
  const badge = MSR_BADGE[status];
  const iconKey = getDeptIconKey(dept.name);
  const Icon = DEPT_ICONS[iconKey] ?? Stethoscope;

  const isClinical = dept.nmc_department_type === "clinical";

  return (
    <Card
      onClick={onClick}
      className={cn(
        "group relative cursor-pointer overflow-hidden transition-colors hover:border-emerald-500/50",
        badge.borderClass,
      )}
    >
      {/* MSR Badge */}
      <div className="absolute right-3 top-3">
        <span
          className={cn(
            "inline-flex items-center rounded border px-2 py-1 text-[10px] font-bold",
            badge.classes,
          )}
        >
          {badge.label}
        </span>
      </div>

      <div className="p-5">
        {/* Department Name + Icon */}
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-700 bg-gray-800">
            <Icon className="h-5 w-5 text-gray-300" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{dept.name}</h3>
            <p className="text-[10px] uppercase tracking-wider text-gray-500">
              {NMC_TYPE_LABELS[dept.nmc_department_type] ?? dept.nmc_department_type}
            </p>
          </div>
        </div>

        {/* HOD */}
        <div className="mb-5 flex items-center gap-3 rounded-lg border border-dark-border bg-[#262626]/50 p-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-700 text-xs font-bold text-gray-300">
            {hodName
              ? hodName
                  .replace(/^Dr\.\s*/i, "")
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()
              : "\u2014"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-400">Head of Department</p>
            <p className="truncate text-sm font-medium text-white">
              {hodName ?? "Not Assigned"}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-4">
          {/* Faculty count */}
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1 text-gray-400">
              <Users className="h-3 w-3" /> Faculty
            </span>
            <span className={cn("font-mono font-medium", FACULTY_COLOR[status])}>
              {msrDept?.actual ?? "\u2014"}
              <span className="text-gray-500">/{msrDept?.required ?? "\u2014"}</span>
            </span>
          </div>

          {/* Bed count (clinical departments) */}
          {isClinical && (dept.beds ?? 0) > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1 text-gray-400">
                <BedDouble className="h-3 w-3" /> Beds
              </span>
              <span className="font-mono font-medium text-white">
                {dept.beds}
              </span>
            </div>
          )}

          {/* Labs (pre/para-clinical) */}
          {!isClinical && (dept.labs ?? 0) > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1 text-gray-400">
                <Flask className="h-3 w-3" /> Labs
              </span>
              <span className="font-mono font-medium text-white">
                {dept.labs}
              </span>
            </div>
          )}

          {/* MSR Gap bar */}
          {msrDept && (
            <div className="space-y-1">
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-gray-400">MSR Compliance</span>
                <span className={FACULTY_COLOR[status]}>
                  {Math.round(msrDept.compliance_percentage)}%
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-gray-800">
                <div
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    status === "compliant"
                      ? "bg-emerald-500"
                      : status === "at_risk"
                        ? "bg-yellow-500"
                        : "bg-red-500",
                  )}
                  style={{
                    width: `${Math.min(100, Math.round(msrDept.compliance_percentage))}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Department Detail Panel (slide-over)
// ---------------------------------------------------------------------------

function DepartmentDetail({
  dept,
  msrDept,
  hodName,
  onClose,
}: {
  dept: DepartmentResponse;
  msrDept: MSRDepartmentStatus | undefined;
  hodName: string | undefined;
  onClose: () => void;
}) {
  const { data: deptFaculty, isLoading: facultyLoading } = useFaculty({
    department_id: dept.id,
    page_size: 100,
  });

  const status = msrStatusKey(msrDept);
  const badge = MSR_BADGE[status];
  const faculty = deptFaculty?.data ?? [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-lg overflow-y-auto bg-dark-surface shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-dark-border bg-dark-surface p-5">
          <div>
            <h2 className="text-xl font-bold text-white">{dept.name}</h2>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xs text-gray-400">
                {NMC_TYPE_LABELS[dept.nmc_department_type] ?? dept.nmc_department_type}
              </span>
              <span className="text-gray-600">\u00b7</span>
              <span className="text-xs text-gray-400">{dept.code}</span>
              <span
                className={cn(
                  "ml-2 inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-bold",
                  badge.classes,
                )}
              >
                {badge.label}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-[#262626]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 p-5">
          {/* HOD */}
          <div className="rounded-lg border border-dark-border p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400">
              Head of Department
            </p>
            <p className="text-sm font-medium text-white">
              {hodName ?? "Not Assigned"}
            </p>
          </div>

          {/* MSR Summary */}
          {msrDept && (
            <div className="rounded-lg border border-dark-border p-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-400">
                MSR Faculty Strength
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-2xl font-bold text-white">{msrDept.actual}</p>
                  <p className="text-xs text-gray-400">Actual</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{msrDept.required}</p>
                  <p className="text-xs text-gray-400">Required</p>
                </div>
                <div>
                  <p
                    className={cn(
                      "text-2xl font-bold",
                      msrDept.gap > 0 ? "text-red-400" : "text-emerald-400",
                    )}
                  >
                    {msrDept.gap > 0 ? `\u2212${msrDept.gap}` : "0"}
                  </p>
                  <p className="text-xs text-gray-400">Gap</p>
                </div>
              </div>
              <div className="mt-3 h-2 w-full rounded-full bg-gray-800">
                <div
                  className={cn(
                    "h-2 rounded-full",
                    status === "compliant"
                      ? "bg-emerald-500"
                      : status === "at_risk"
                        ? "bg-yellow-500"
                        : "bg-red-500",
                  )}
                  style={{
                    width: `${Math.min(100, Math.round(msrDept.compliance_percentage))}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Infrastructure */}
          <div className="rounded-lg border border-dark-border p-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-400">
              Infrastructure
            </p>
            <div className="grid grid-cols-2 gap-3">
              <InfraStat icon={BedDouble} label="Beds" value={dept.beds ?? 0} />
              <InfraStat icon={DoorOpen} label="OPD Rooms" value={dept.opd_rooms ?? 0} />
              <InfraStat icon={Flask} label="Labs" value={dept.labs ?? 0} />
              <InfraStat icon={Building2} label="Lecture Halls" value={dept.lecture_halls ?? 0} />
            </div>
          </div>

          {/* Faculty List */}
          <div className="rounded-lg border border-dark-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                Faculty ({faculty.length})
              </p>
            </div>
            {facultyLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : faculty.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-500">
                No faculty records found
              </p>
            ) : (
              <div className="space-y-2">
                {faculty.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between rounded-lg bg-[#262626]/50 px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-700 text-xs font-bold text-gray-300">
                        {f.name
                          .replace(/^Dr\.\s*/i, "")
                          .split(" ")
                          .map((w) => w[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{f.name}</p>
                        <p className="text-xs text-gray-400">
                          {f.designation ?? "Faculty"}
                          {f.specialization ? ` \u00b7 ${f.specialization}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={cn(
                          "inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium",
                          f.status === "active"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-gray-500/10 text-gray-400",
                        )}
                      >
                        {f.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Additional Info */}
          {dept.established_year && (
            <p className="text-center text-xs text-gray-500">
              Established {dept.established_year}
              {dept.nmc_department_code && ` \u00b7 NMC Code: ${dept.nmc_department_code}`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Infrastructure stat chip
// ---------------------------------------------------------------------------

function InfraStat({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-[#262626]/50 p-3">
      <Icon className="h-4 w-4 text-gray-400" />
      <div>
        <p className="text-lg font-bold text-white">{value}</p>
        <p className="text-[10px] text-gray-400">{label}</p>
      </div>
    </div>
  );
}
