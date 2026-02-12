"use client";

import {
  Plus,
  LayoutGrid,
  List,
  Users,
  ShieldCheck,
  BedDouble,
  Clock,
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
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// TODO: Replace with API call — GET /api/v1/admin/academics/departments
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

const DEPARTMENTS = [
  { id: "1", name: "Anatomy", iconKey: "anatomy", hodName: "Dr. Rajesh Kumar", msrStatus: "compliant", facultyCurrent: 8, facultyRequired: 8, students: 150, teachingHoursCurrent: 120, teachingHoursTotal: 140 },
  { id: "2", name: "Physiology", iconKey: "physiology", hodName: "Dr. Anita Desai", msrStatus: "at_risk", facultyCurrent: 7, facultyRequired: 8, students: 150, teachingHoursCurrent: 130, teachingHoursTotal: 140 },
  { id: "3", name: "Biochemistry", iconKey: "biochemistry", hodName: "Dr. Suresh Menon", msrStatus: "compliant", facultyCurrent: 6, facultyRequired: 6, students: 150, teachingHoursCurrent: 90, teachingHoursTotal: 100 },
  { id: "4", name: "Gen. Medicine", iconKey: "medicine", hodName: "Dr. P. Venkat", msrStatus: "compliant", facultyCurrent: 26, facultyRequired: 24, bedOccupied: 180, bedTotal: 200, teachingHoursCurrent: 210, teachingHoursTotal: 250 },
  { id: "5", name: "Gen. Surgery", iconKey: "surgery", hodName: "Dr. K. Nair", msrStatus: "compliant", facultyCurrent: 24, facultyRequired: 24, bedOccupied: 165, bedTotal: 180, teachingHoursCurrent: 200, teachingHoursTotal: 250 },
  { id: "6", name: "OBG", iconKey: "obg", hodName: "Dr. Sarah John", msrStatus: "at_risk", facultyCurrent: 11, facultyRequired: 12, bedOccupied: 88, bedTotal: 100, teachingHoursCurrent: 110, teachingHoursTotal: 150 },
  { id: "7", name: "Pediatrics", iconKey: "pediatrics", hodName: "Dr. R. Gupta", msrStatus: "compliant", facultyCurrent: 10, facultyRequired: 10, bedOccupied: 75, bedTotal: 90, teachingHoursCurrent: 100, teachingHoursTotal: 120 },
  { id: "8", name: "Pathology", iconKey: "pathology", hodName: "Dr. Amit Jain", msrStatus: "non_compliant", facultyCurrent: 9, facultyRequired: 12, students: 150, teachingHoursCurrent: 140, teachingHoursTotal: 180 },
  { id: "9", name: "Microbiology", iconKey: "microbiology", hodName: "Dr. S. Reddy", msrStatus: "compliant", facultyCurrent: 6, facultyRequired: 6, students: 150, teachingHoursCurrent: 95, teachingHoursTotal: 100 },
  { id: "10", name: "Pharmacology", iconKey: "pharmacology", hodName: "Dr. Naveen Kumar", msrStatus: "compliant", facultyCurrent: 5, facultyRequired: 5, students: 150, teachingHoursCurrent: 110, teachingHoursTotal: 110 },
  { id: "11", name: "Orthopaedics", iconKey: "orthopaedics", hodName: "Dr. V. Sharma", msrStatus: "compliant", facultyCurrent: 12, facultyRequired: 12, bedOccupied: 85, bedTotal: 90, teachingHoursCurrent: 98, teachingHoursTotal: 100 },
  { id: "12", name: "Ophthalmology", iconKey: "ophthalmology", hodName: "Dr. A. Mehra", msrStatus: "compliant", facultyCurrent: 5, facultyRequired: 5, bedOccupied: 40, bedTotal: 40, teachingHoursCurrent: 60, teachingHoursTotal: 60 },
];

const STAT_CARDS = [
  { label: "Total Faculty", value: "248", sub: "/ 260", icon: Users, iconBg: "bg-blue-500/10", iconColor: "text-blue-400" },
  { label: "MSR Compliance", value: "94%", icon: ShieldCheck, iconBg: "bg-emerald-500/10", iconColor: "text-emerald-400", valueColor: "text-emerald-400" },
  { label: "Total Beds", value: "850", sub: "Occupied", icon: BedDouble, iconBg: "bg-purple-500/10", iconColor: "text-purple-400" },
  { label: "Avg Attendance", value: "92%", icon: Clock, iconBg: "bg-orange-500/10", iconColor: "text-orange-400" },
];

// ---------------------------------------------------------------------------

export default function DepartmentManagementPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Departments</h1>
          <p className="mt-1 text-sm text-gray-400">
            Overview of 19 Clinical, Para-clinical and Pre-clinical Departments
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-dark-border bg-dark-surface p-1">
            <button className="rounded bg-[#262626] p-1.5 text-white shadow-sm">
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button className="rounded p-1.5 text-gray-400 transition-colors hover:text-white">
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

      {/* Department Cards Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {DEPARTMENTS.map((dept) => (
          <DepartmentCard key={dept.id} dept={dept} />
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t border-dark-border pt-4">
        <div className="text-xs text-gray-400">Showing 12 of 19 departments</div>
        <div className="flex items-center gap-2">
          <button className="rounded p-2 text-gray-400 hover:bg-[#262626] disabled:opacity-50" disabled>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button className="rounded border border-dark-border bg-[#262626] px-3 py-1 text-xs font-medium text-white">
            1
          </button>
          <button className="rounded px-3 py-1 text-xs font-medium text-gray-400 hover:bg-[#262626]">
            2
          </button>
          <button className="rounded p-2 text-gray-400 hover:bg-[#262626]">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Department Card
// ---------------------------------------------------------------------------

function DepartmentCard({ dept }: { dept: (typeof DEPARTMENTS)[number] }) {
  const badge = MSR_BADGE[dept.msrStatus];
  const Icon = DEPT_ICONS[dept.iconKey] ?? Stethoscope;
  const teachingPct = Math.round(
    (dept.teachingHoursCurrent / dept.teachingHoursTotal) * 100,
  );

  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-colors hover:border-emerald-500/50",
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
          <h3 className="text-lg font-bold text-white">{dept.name}</h3>
        </div>

        {/* HOD */}
        <div className="mb-5 flex items-center gap-3 rounded-lg border border-dark-border bg-[#262626]/50 p-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-700 text-xs font-bold text-gray-300">
            {dept.hodName
              .replace("Dr. ", "")
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-400">Head of Department</p>
            <p className="truncate text-sm font-medium text-white">
              {dept.hodName}
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
            <span className={cn("font-mono font-medium", FACULTY_COLOR[dept.msrStatus])}>
              {dept.facultyCurrent}
              <span className="text-gray-500">/{dept.facultyRequired}</span>
            </span>
          </div>

          {/* Students (pre-clinical / para-clinical) */}
          {dept.students != null && (
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1 text-gray-400">
                <GraduationCap className="h-3 w-3" /> Students
              </span>
              <span className="font-mono font-medium text-white">
                {dept.students}
              </span>
            </div>
          )}

          {/* Bed Occupancy (clinical) */}
          {dept.bedOccupied != null && dept.bedTotal != null && (
            <div className="space-y-1">
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-gray-400">Bed Occupancy</span>
                <span className="text-white">
                  {dept.bedOccupied}/{dept.bedTotal}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-gray-800">
                <div
                  className="h-1.5 rounded-full bg-blue-500"
                  style={{
                    width: `${Math.round((dept.bedOccupied / dept.bedTotal) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Teaching Hours */}
          <div className="space-y-1">
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-gray-400">Teaching Hours</span>
              <span className="text-white">
                {dept.teachingHoursCurrent}/{dept.teachingHoursTotal} hrs
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-gray-800">
              <div
                className="h-1.5 rounded-full bg-emerald-500"
                style={{ width: `${teachingPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
