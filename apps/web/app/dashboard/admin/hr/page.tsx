"use client";

import { useState } from "react";
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
import { cn } from "@/lib/utils";
import type {
  DepartmentMSRStatus,
  FacultyRosterEntry,
  RetirementCountdownEntry,
} from "@/types/admin";

// TODO: Replace with API call — fetch from /api/v1/admin/faculty/msr-status
const MOCK_MSR_DEPARTMENTS: DepartmentMSRStatus[] = [
  { name: "Anatomy", required: 8, actual: 8 },
  { name: "Physiology", required: 8, actual: 9 },
  { name: "Biochemistry", required: 6, actual: 4 },
  { name: "Pharmacology", required: 5, actual: 5 },
  { name: "Pathology", required: 12, actual: 9 },
  { name: "Microbiology", required: 6, actual: 6 },
  { name: "Community Medicine", required: 14, actual: 12 },
  { name: "General Medicine", required: 24, actual: 26 },
  { name: "Pediatrics", required: 10, actual: 10 },
];

// TODO: Replace with API call — fetch from /api/v1/admin/faculty/roster
const MOCK_FACULTY: FacultyRosterEntry[] = [
  {
    id: "1",
    name: "Dr. Sunil Kumar",
    initials: "SK",
    initialsColor: "bg-indigo-500/20 text-indigo-400",
    gender: "Male",
    employmentType: "Regular",
    designation: "Professor & HOD",
    designationColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    department: "Anatomy",
    qualification: "MD Anatomy",
    aebasId: "100293",
    nmcId: "12345/2000",
    dateOfJoining: "12 Aug 2010",
    retirementCountdown: "3y 2m left",
    retirementUrgent: true,
    attendancePct: 98,
    status: "active",
  },
  {
    id: "2",
    name: "Dr. Rina Mehta",
    initials: "RM",
    initialsColor: "bg-pink-500/20 text-pink-400",
    gender: "Female",
    employmentType: "Regular",
    designation: "Assoc. Professor",
    designationColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    department: "Biochemistry",
    qualification: "MD Biochemistry",
    aebasId: "100456",
    nmcId: "56789/2005",
    dateOfJoining: "01 Jun 2018",
    retirementCountdown: "12y left",
    retirementUrgent: false,
    attendancePct: 85,
    status: "active",
  },
  {
    id: "3",
    name: "Dr. Amit Jain",
    initials: "AJ",
    initialsColor: "bg-gray-700 text-gray-300",
    gender: "Male",
    employmentType: "Regular",
    designation: "Asst. Professor",
    designationColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    department: "Pathology",
    qualification: "DNB Pathology",
    aebasId: "100882",
    nmcId: "99887/2015",
    dateOfJoining: "15 Jan 2020",
    retirementCountdown: "22y left",
    retirementUrgent: false,
    attendancePct: 60,
    status: "notice_period",
  },
  {
    id: "4",
    name: "Dr. Priya Verma",
    initials: "PV",
    initialsColor: "bg-orange-500/20 text-orange-400",
    gender: "Female",
    employmentType: "Regular",
    designation: "Senior Resident",
    designationColor: "bg-gray-500/10 text-gray-400 border-gray-500/20",
    department: "General Medicine",
    qualification: "MD Medicine",
    aebasId: "100991",
    nmcId: "44556/2019",
    dateOfJoining: "20 Mar 2022",
    retirementCountdown: "30y left",
    retirementUrgent: false,
    attendancePct: 92,
    status: "active",
  },
  {
    id: "5",
    name: "Dr. Naveen Kumar",
    initials: "NK",
    initialsColor: "bg-teal-500/20 text-teal-400",
    gender: "Male",
    employmentType: "Regular",
    designation: "Professor",
    designationColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    department: "Pharmacology",
    qualification: "MD Pharmacology",
    aebasId: "100112",
    nmcId: "66778/2001",
    dateOfJoining: "05 Feb 2011",
    retirementCountdown: "1y 8m left",
    retirementUrgent: true,
    attendancePct: 100,
    status: "active",
  },
];

// TODO: Replace with API call — fetch from /api/v1/admin/faculty/retirement-countdown
const MOCK_RETIREMENTS: RetirementCountdownEntry[] = [
  {
    id: "1",
    name: "Dr. Sunil Kumar",
    initials: "SK",
    initialsColor: "bg-indigo-500/20 text-indigo-400",
    designation: "Prof & HOD",
    department: "Anatomy",
    countdown: "3y 2m 15d",
    msrImpact: true,
  },
  {
    id: "5",
    name: "Dr. Naveen Kumar",
    initials: "NK",
    initialsColor: "bg-teal-500/20 text-teal-400",
    designation: "Professor",
    department: "Pharmacology",
    countdown: "1y 8m 10d",
    msrImpact: true,
  },
  {
    id: "6",
    name: "Dr. Anita Desai",
    initials: "AD",
    initialsColor: "bg-purple-500/20 text-purple-400",
    designation: "Assoc. Prof",
    department: "Physiology",
    countdown: "2y 11m 02d",
    msrImpact: false,
  },
];

function getAttendanceColor(pct: number) {
  if (pct >= 90) return "border-emerald-500 text-emerald-500";
  if (pct >= 75) return "border-yellow-500 text-yellow-500";
  return "border-red-500 text-red-500";
}

const STATUS_DOT: Record<string, { color: string; title: string }> = {
  active: { color: "bg-emerald-500", title: "Active" },
  on_leave: { color: "bg-yellow-500", title: "On Leave" },
  notice_period: { color: "bg-red-500", title: "Notice Period" },
};

export default function FacultyRosterPage() {
  const [deptFilter, setDeptFilter] = useState("all");
  const [designationFilter, setDesignationFilter] = useState("all");
  const [employmentFilter, setEmploymentFilter] = useState("all");
  const [qualFilter, setQualFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Faculty Roster</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-gray-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            156 Active Faculty Members
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export Roster
          </Button>
          <Button className="gap-2 bg-emerald-600 shadow-lg shadow-emerald-500/20 hover:bg-emerald-700">
            <UserPlus className="h-4 w-4" />
            Add Faculty
          </Button>
        </div>
      </div>

      {/* MSR Compliance Status Bar */}
      <Card className="overflow-hidden">
        {/* Status Header */}
        <div className="flex flex-col items-center justify-between gap-2 border-b border-dark-border bg-dark-elevated/50 px-4 py-3 md:flex-row">
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            College MSR Status:{" "}
            <span className="font-bold text-emerald-400">82% Compliant</span>
            <span className="mx-2 text-gray-500">&mdash;</span>
            <span className="text-orange-400">
              12 positions to fill across 4 departments
            </span>
          </div>
          <Button variant="link" size="sm" className="h-auto p-0 text-xs">
            View Detailed MSR Report
          </Button>
        </div>

        {/* Department MSR Pills — horizontal scroll */}
        <div className="flex items-center gap-4 overflow-x-auto p-4 scrollbar-none">
          {MOCK_MSR_DEPARTMENTS.map((dept) => {
            const isDeficient = dept.actual < dept.required;
            return (
              <div
                key={dept.name}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-lg border bg-dark-elevated px-3 py-1.5",
                  isDeficient ? "border-red-900/30" : "border-dark-border",
                )}
              >
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    isDeficient ? "animate-pulse bg-red-500" : "bg-emerald-500",
                  )}
                />
                <span className="text-sm font-medium text-gray-300">
                  {dept.name}
                </span>
                <span className="ml-1 text-xs text-gray-500">
                  Req: {dept.required} / Act: {dept.actual}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Main 3/4 + 1/4 Grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
        {/* Left Column — Filters + Table + Retirement */}
        <div className="space-y-6 xl:col-span-3">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                <Select value={deptFilter} onValueChange={setDeptFilter}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    <SelectItem value="anatomy">Anatomy</SelectItem>
                    <SelectItem value="physiology">Physiology</SelectItem>
                    <SelectItem value="biochemistry">Biochemistry</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={designationFilter}
                  onValueChange={setDesignationFilter}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="All Designations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Designations</SelectItem>
                    <SelectItem value="professor">Professor</SelectItem>
                    <SelectItem value="assoc">Assoc. Prof</SelectItem>
                    <SelectItem value="asst">Asst. Prof</SelectItem>
                    <SelectItem value="tutor_sr">Tutor/SR</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={employmentFilter}
                  onValueChange={setEmploymentFilter}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Employment Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Employment Type</SelectItem>
                    <SelectItem value="regular">Regular</SelectItem>
                    <SelectItem value="contractual">Contractual</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={qualFilter} onValueChange={setQualFilter}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Qualification" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Qualification</SelectItem>
                    <SelectItem value="md_ms">MD/MS</SelectItem>
                    <SelectItem value="dnb">DNB</SelectItem>
                    <SelectItem value="msc_phd">MSc PhD</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on_leave">On Leave</SelectItem>
                    <SelectItem value="notice_period">
                      Notice Period
                    </SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative flex items-center">
                  <span className="absolute -top-2 left-1 bg-dark-surface px-1 text-[10px] text-gray-500">
                    Retiring &lt; 5 yrs
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    defaultValue="5"
                    className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-dark-elevated accent-emerald-500"
                  />
                </div>
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
                      Attd %
                    </TableHead>
                    <TableHead className="p-3 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Status
                    </TableHead>
                    <TableHead className="w-10 p-3" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MOCK_FACULTY.map((f) => {
                    const statusInfo = STATUS_DOT[f.status];
                    return (
                      <TableRow
                        key={f.id}
                        className={cn(
                          "group cursor-pointer border-dark-border transition-colors hover:bg-[#262626]/20",
                          f.status === "notice_period" && "bg-red-500/5",
                        )}
                      >
                        <TableCell className="p-3 text-center">
                          <Checkbox />
                        </TableCell>
                        <TableCell className="p-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${f.initialsColor}`}
                            >
                              {f.initials}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-white">
                                {f.name}
                              </p>
                              <p className="text-[10px] text-gray-500">
                                {f.employmentType} &bull; {f.gender}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="p-3">
                          <span
                            className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium ${f.designationColor}`}
                          >
                            {f.designation}
                          </span>
                        </TableCell>
                        <TableCell className="p-3 text-xs text-gray-300">
                          {f.department}
                        </TableCell>
                        <TableCell className="p-3 text-xs text-gray-400">
                          {f.qualification}
                        </TableCell>
                        <TableCell className="p-3 text-gray-400">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs text-gray-300">
                              AE: {f.aebasId}
                            </span>
                            <span className="text-[10px]">
                              NMC: {f.nmcId}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="p-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs text-gray-300">
                              DOJ: {f.dateOfJoining}
                            </span>
                            <span
                              className={cn(
                                "text-[10px]",
                                f.retirementUrgent
                                  ? "font-medium text-orange-400"
                                  : "text-gray-500",
                              )}
                            >
                              Ret: {f.retirementCountdown}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="p-3 text-center">
                          <div
                            className={cn(
                              "inline-flex h-8 w-8 items-center justify-center rounded-full border-2 text-[10px] font-bold",
                              getAttendanceColor(f.attendancePct),
                            )}
                          >
                            {f.attendancePct}
                          </div>
                        </TableCell>
                        <TableCell className="p-3 text-center">
                          <span
                            className={`inline-block h-2 w-2 rounded-full ${statusInfo.color}`}
                            title={statusInfo.title}
                          />
                        </TableCell>
                        <TableCell className="p-3 text-center">
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
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-dark-border bg-dark-elevated/30 p-3 text-xs text-gray-400">
              <div>Showing 1-5 of 156 faculty</div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 bg-dark-elevated text-white"
                >
                  1
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  2
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  3
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>

          {/* Retirement Countdown */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-300">
              <Hourglass className="h-4 w-4 text-orange-400" />
              Retirement Countdown (Next 3 Years)
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {MOCK_RETIREMENTS.map((r) => (
                <Card
                  key={r.id}
                  className="group relative overflow-hidden transition-all hover:border-orange-500/30"
                >
                  <div className="absolute right-0 top-0 p-2">
                    <span
                      className={cn(
                        "rounded border px-2 py-0.5 text-[10px] font-medium",
                        r.msrImpact
                          ? "border-red-500/20 bg-red-500/10 text-red-400"
                          : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
                      )}
                    >
                      {r.msrImpact ? "Impact on MSR" : "Safe"}
                    </span>
                  </div>
                  <CardContent className="p-4">
                    <div className="mt-1 flex items-start gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${r.initialsColor}`}
                      >
                        {r.initials}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">
                          {r.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {r.designation} &bull; {r.department}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-dark-border pt-3">
                      <span className="text-xs text-gray-400">
                        Retires in:
                      </span>
                      <span className="font-mono text-sm font-bold text-orange-400">
                        {r.countdown}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column — NMC Rules Quick Reference */}
        <div className="xl:col-span-1">
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
        </div>
      </div>
    </div>
  );
}
