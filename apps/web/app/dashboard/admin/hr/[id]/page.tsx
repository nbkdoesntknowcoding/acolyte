"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Edit,
  Printer,
  GraduationCap,
  BookOpen,
  TrendingUp,
  Fingerprint,
  Check,
  Mail,
  Phone,
  BadgeCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useFacultyDetail } from "@/lib/hooks/admin/use-faculty";
import { useDepartments } from "@/lib/hooks/admin/use-departments";
import { PersonalTab } from "@/components/admin/faculty-profile/personal-tab";
import { QualificationsTab } from "@/components/admin/faculty-profile/qualifications-tab";
import { PublicationsTab } from "@/components/admin/faculty-profile/publications-tab";
import { TeachingTab } from "@/components/admin/faculty-profile/teaching-tab";
import { LeaveTab } from "@/components/admin/faculty-profile/leave-tab";
import { PayrollTab } from "@/components/admin/faculty-profile/payroll-tab";
import type { FacultyResponse } from "@/types/admin-api";

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

type FacultyProfileTab =
  | "personal"
  | "qualifications"
  | "teaching"
  | "publications"
  | "leave"
  | "payroll";

const TABS: { id: FacultyProfileTab; label: string }[] = [
  { id: "personal", label: "Personal" },
  { id: "qualifications", label: "Qualifications" },
  { id: "teaching", label: "Teaching & Attendance" },
  { id: "publications", label: "Publications" },
  { id: "leave", label: "Leave" },
  { id: "payroll", label: "Payroll" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  active: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  on_leave: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20" },
  sabbatical: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
  deputation: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" },
  resigned: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20" },
  retired: { bg: "bg-gray-500/10", text: "text-gray-400", border: "border-gray-500/20" },
  terminated: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20" },
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatExperience(years: number | null): string {
  if (years === null || years === undefined) return "—";
  if (years < 1) return `${Math.round(years * 12)} Mo`;
  return `${Math.round(years)} Yrs`;
}

function buildStatCards(faculty: FacultyResponse) {
  return [
    {
      value: formatExperience(faculty.teaching_experience_years),
      label: "Teaching Exp",
      icon: GraduationCap,
      iconColor: "text-purple-400",
      iconBg: "bg-purple-500/10",
    },
    {
      value: String(faculty.publications_count ?? 0),
      label: "Publications",
      icon: BookOpen,
      iconColor: "text-blue-400",
      iconBg: "bg-blue-500/10",
    },
    {
      value: String(faculty.h_index ?? 0),
      label: "H-Index",
      icon: TrendingUp,
      iconColor: "text-orange-400",
      iconBg: "bg-orange-500/10",
    },
    {
      value: "—",
      label: "AEBAS Attd.",
      icon: Fingerprint,
      iconColor: "text-emerald-400",
      iconBg: "bg-emerald-500/10",
      valueColor: "text-gray-500",
    },
  ];
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FacultyProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const facultyId = params.id;

  const { data: faculty, isLoading, error } = useFacultyDetail(facultyId);
  const { data: deptData } = useDepartments({ page_size: 100, active_only: true });

  const [activeTab, setActiveTab] = useState<FacultyProfileTab>("personal");

  // Department name lookup
  const departmentName =
    deptData?.data?.find((d) => d.id === faculty?.department_id)?.name ?? "—";

  // Loading state
  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="overflow-hidden rounded-xl border border-dark-border bg-dark-surface">
          <Skeleton className="h-32 w-full" />
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
            <div className="grid grid-cols-4 gap-4 pt-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !faculty) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-8 text-center">
          <p className="text-red-400">
            {error?.message ?? "Faculty record not found."}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => router.push("/dashboard/admin/hr")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to HR
          </Button>
        </div>
      </div>
    );
  }

  const statusStyle = STATUS_STYLES[faculty.status] ?? STATUS_STYLES.active;
  const statCards = buildStatCards(faculty);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Back button */}
      <button
        onClick={() => router.push("/dashboard/admin/hr")}
        className="flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Faculty Roster
      </button>

      {/* Hero Card */}
      <div className="overflow-hidden rounded-xl border border-dark-border bg-dark-surface">
        {/* Gradient Banner */}
        <div className="relative h-32 bg-gradient-to-r from-emerald-900/40 to-dark-surface" />

        {/* Profile Info */}
        <div className="relative px-6 pb-6">
          {/* Avatar */}
          <div className="absolute -top-16 left-6 h-32 w-32 rounded-xl bg-[#262626] p-1 ring-4 ring-dark-surface">
            <div className="flex h-full w-full items-center justify-center rounded-lg bg-gradient-to-br from-gray-700 to-gray-600 text-4xl font-bold text-gray-400">
              {getInitials(faculty.name)}
            </div>
            {faculty.status === "active" && (
              <div className="absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-dark-surface bg-emerald-500">
                <Check className="h-3.5 w-3.5 text-white" />
              </div>
            )}
          </div>

          {/* Name + Meta */}
          <div className="ml-40 flex flex-col justify-between gap-4 pt-2 md:flex-row md:items-start">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white">
                  {faculty.name}
                </h1>
                <span
                  className={cn(
                    "rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                    statusStyle.bg,
                    statusStyle.text,
                    statusStyle.border
                  )}
                >
                  {faculty.status.replace("_", " ")}
                </span>
                {faculty.employment_type && (
                  <span className="rounded border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-400">
                    {faculty.employment_type}
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-400">
                {faculty.designation && (
                  <span className="font-medium text-white">
                    {faculty.designation}
                  </span>
                )}
                <span className="text-gray-600">&bull;</span>
                <span>{departmentName}</span>
                {faculty.qualification && (
                  <>
                    <span className="text-gray-600">&bull;</span>
                    <span>{faculty.qualification}</span>
                  </>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-500">
                {faculty.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-4 w-4 text-gray-400" />
                    {faculty.email}
                  </div>
                )}
                {faculty.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-4 w-4 text-gray-400" />
                    {faculty.phone}
                  </div>
                )}
                {faculty.employee_id && (
                  <div className="flex items-center gap-1.5">
                    <BadgeCheck className="h-4 w-4 text-gray-400" />
                    Emp ID: {faculty.employee_id}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" size="sm">
                <Edit className="mr-2 h-4 w-4" />
                Edit Profile
              </Button>
              <Button size="sm">
                <Printer className="mr-2 h-4 w-4" />
                Print ID Card
              </Button>
            </div>
          </div>

          {/* Stat Mini-Cards */}
          <div className="mt-8 grid grid-cols-2 gap-4 border-t border-dark-border pt-6 md:grid-cols-4">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="flex items-center gap-3 rounded-lg border border-dark-border bg-[#262626]/30 p-3"
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full",
                      stat.iconBg
                    )}
                  >
                    <Icon className={cn("h-5 w-5", stat.iconColor)} />
                  </div>
                  <div>
                    <div
                      className={cn(
                        "text-lg font-bold",
                        "valueColor" in stat && stat.valueColor
                          ? stat.valueColor
                          : "text-white"
                      )}
                    >
                      {stat.value}
                    </div>
                    <div className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
                      {stat.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-t border-dark-border bg-[#262626]/20 px-6">
          <nav className="flex gap-6 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "whitespace-nowrap border-b-2 py-4 text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "border-emerald-500 text-emerald-500"
                    : "border-transparent text-gray-400 hover:border-gray-600 hover:text-white"
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "personal" && (
        <PersonalTab faculty={faculty} departmentName={departmentName} />
      )}
      {activeTab === "qualifications" && (
        <QualificationsTab faculty={faculty} />
      )}
      {activeTab === "teaching" && <TeachingTab faculty={faculty} />}
      {activeTab === "publications" && (
        <PublicationsTab faculty={faculty} />
      )}
      {activeTab === "leave" && <LeaveTab facultyId={faculty.id} />}
      {activeTab === "payroll" && <PayrollTab facultyId={faculty.id} />}
    </div>
  );
}
