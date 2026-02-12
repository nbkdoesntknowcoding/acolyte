"use client";

import {
  Fingerprint,
  Calendar,
  GraduationCap,
  BookOpen,
  FlaskConical,
  HeartPulse,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Hourglass,
  ClipboardCheck,
  Star,
  Users,
  Download,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  TeachingLoadDay,
  AssignedBatch,
  FacultyAttendanceDayStatus,
} from "@/types/admin";

// ---------------------------------------------------------------------------
// TODO: Replace with API calls
// GET /api/v1/admin/faculty/{id}/attendance
// GET /api/v1/admin/faculty/{id}/teaching-load
// ---------------------------------------------------------------------------

const AEBAS_STATS = {
  currentMonth: 98,
  threeMonthAvg: 96,
  threeMonthTrend: "+2%",
  yearlyAvg: 94,
  totalWorkingDays: 214,
  present: 198,
  leaves: 12,
  absent: 4,
};

// October 2023 attendance calendar
// Sun=0, Mon=1, ..., Sat=6
// Oct 1 2023 is a Sunday
type CalendarDay = {
  day: number;
  status: FacultyAttendanceDayStatus;
};

const OCTOBER_DAYS: (CalendarDay | null)[] = [
  null, // Sun placeholder (Oct starts on Sun, but 1st is holiday/blank)
  null, // Mon placeholder
  { day: 1, status: "holiday" }, // Tue
  { day: 2, status: "present" },
  { day: 3, status: "present" },
  { day: 4, status: "present" },
  { day: 5, status: "holiday" },
  { day: 6, status: "holiday" },
  { day: 7, status: "present" },
  { day: 8, status: "present" },
  { day: 9, status: "leave" },
  { day: 10, status: "present" },
  { day: 11, status: "present" },
  { day: 12, status: "holiday" },
  { day: 13, status: "holiday" },
  { day: 14, status: "present" },
  { day: 15, status: "present" },
  { day: 16, status: "present" },
  { day: 17, status: "present" },
  { day: 18, status: "absent" },
  { day: 19, status: "holiday" },
  { day: 20, status: "holiday" },
  { day: 21, status: "present" },
  { day: 22, status: "present" },
  { day: 23, status: "present" },
  { day: 24, status: "present" },
  { day: 25, status: "on_duty" },
  { day: 26, status: "holiday" },
  { day: 27, status: "holiday" },
  { day: 28, status: "present" },
  { day: 29, status: "present" },
  { day: 30, status: "present" },
  { day: 31, status: "present" },
];

const DAY_STATUS_STYLES: Record<FacultyAttendanceDayStatus, string> = {
  present:
    "bg-emerald-500/20 border-emerald-500/30 text-emerald-400 font-bold",
  absent: "bg-red-500/20 border-red-500/30 text-red-400 font-bold",
  leave: "bg-orange-500/20 border-orange-500/30 text-orange-400 font-bold",
  on_duty: "bg-blue-500/20 border-blue-500/30 text-blue-400 font-bold",
  holiday: "bg-[#262626] border-dark-border text-gray-600",
};

const TEACHING_DAYS: TeachingLoadDay[] = [
  { day: "Mon", heightPct: 40, lectures: "Tutorials", isLecture: false },
  { day: "Tue", heightPct: 70, lectures: "4 Lectures", isLecture: true },
  { day: "Wed", heightPct: 50, lectures: "3 Lectures", isLecture: true },
  { day: "Thu", heightPct: 60, lectures: "3.5 Lectures", isLecture: true },
  { day: "Fri", heightPct: 30, lectures: "2 Lectures", isLecture: true },
  { day: "Sat", heightPct: 20, lectures: "Lab", isLecture: false },
];

const ASSIGNED_BATCHES: AssignedBatch[] = [
  {
    id: "1",
    subject: "Human Anatomy - Upper Limb",
    batch: "MBBS Batch 2023 • Semester 1",
    studentCount: "150 Students",
    type: "Theory",
    typeColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    iconColor: "text-blue-400",
    iconBg: "bg-blue-500/10",
  },
  {
    id: "2",
    subject: "Histology Practical",
    batch: "MBBS Batch 2023 • Group A",
    studentCount: "45 Students",
    type: "Practical",
    typeColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    iconColor: "text-purple-400",
    iconBg: "bg-purple-500/10",
  },
  {
    id: "3",
    subject: "Clinical Anatomy",
    batch: "Post Graduate (MD) • Year 1",
    studentCount: "12 Residents",
    type: "Clinical",
    typeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    iconColor: "text-emerald-400",
    iconBg: "bg-emerald-500/10",
  },
];

const BATCH_ICONS: Record<string, typeof BookOpen> = {
  Theory: BookOpen,
  Practical: FlaskConical,
  Clinical: HeartPulse,
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const LEGEND_ITEMS: { color: string; label: string }[] = [
  {
    color: "bg-emerald-500/20 border-emerald-500/30",
    label: "Present",
  },
  { color: "bg-red-500/20 border-red-500/30", label: "Absent" },
  {
    color: "bg-orange-500/20 border-orange-500/30",
    label: "Leave",
  },
  { color: "bg-blue-500/20 border-blue-500/30", label: "On Duty" },
  {
    color: "bg-[#262626] border-dark-border",
    label: "Holiday",
  },
];

export function TeachingTab() {
  return (
    <div className="space-y-6">
      {/* Main 2-column grid: Attendance (5/12) + Teaching (7/12) */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left — AEBAS Compliance + Attendance Calendar */}
        <div className="space-y-6 xl:col-span-5">
          {/* AEBAS Compliance */}
          <Card>
            <div className="flex items-center justify-between border-b border-dark-border p-4">
              <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                <Fingerprint className="h-5 w-5 text-emerald-500" />
                AEBAS Compliance
              </h2>
              <span className="text-xs text-gray-500">
                Updated: Today, 09:30 AM
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 divide-x divide-dark-border p-6 text-center">
              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-gray-400">
                  Current Month
                </p>
                <div className="text-3xl font-bold text-emerald-500">
                  {AEBAS_STATS.currentMonth}%
                </div>
                <p className="mt-1 text-[10px] text-gray-500">
                  Target: &gt;75%
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-gray-400">
                  3-Month Avg
                </p>
                <div className="text-3xl font-bold text-emerald-400">
                  {AEBAS_STATS.threeMonthAvg}%
                </div>
                <p className="mt-1 flex items-center justify-center gap-1 text-[10px] text-emerald-500/80">
                  <TrendingUp className="h-2.5 w-2.5" />{" "}
                  {AEBAS_STATS.threeMonthTrend}
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-gray-400">
                  Yearly Avg
                </p>
                <div className="text-3xl font-bold text-white">
                  {AEBAS_STATS.yearlyAvg}%
                </div>
                <p className="mt-1 text-[10px] text-gray-500">Consistent</p>
              </div>
            </div>
            <div className="px-6 pb-6 pt-2">
              <div className="flex items-center justify-between rounded-lg border border-dark-border bg-[#262626]/50 p-3">
                <div>
                  <p className="text-sm font-medium text-gray-300">
                    Total Working Days
                  </p>
                  <p className="text-xs text-gray-500">
                    Current Academic Year
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-white">
                    {AEBAS_STATS.totalWorkingDays}{" "}
                    <span className="text-xs font-normal text-gray-400">
                      Days
                    </span>
                  </p>
                  <p className="text-[10px] text-gray-400">
                    Present: {AEBAS_STATS.present} &bull; Leaves:{" "}
                    {AEBAS_STATS.leaves} &bull; Absent: {AEBAS_STATS.absent}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Attendance Log Calendar */}
          <Card>
            <div className="flex items-center justify-between border-b border-dark-border p-4">
              <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                <Calendar className="h-5 w-5 text-orange-400" />
                Attendance Log
              </h2>
              <div className="flex gap-2">
                <button className="rounded p-1 text-gray-400 hover:bg-[#262626]">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="self-center text-sm font-medium text-gray-300">
                  October 2023
                </span>
                <button className="rounded p-1 text-gray-400 hover:bg-[#262626]">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="p-5">
              {/* Weekday headers */}
              <div className="mb-2 grid grid-cols-7 gap-1 text-center">
                {WEEKDAY_LABELS.map((d) => (
                  <div
                    key={d}
                    className="py-1 text-xs font-medium text-gray-500"
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-2">
                {OCTOBER_DAYS.map((item, i) =>
                  item === null ? (
                    <div key={`blank-${i}`} className="aspect-square" />
                  ) : (
                    <div
                      key={item.day}
                      className={cn(
                        "flex aspect-square items-center justify-center rounded border text-xs",
                        DAY_STATUS_STYLES[item.status],
                      )}
                      title={`${item.day} - ${item.status.replace("_", " ")}`}
                    >
                      {item.day}
                    </div>
                  ),
                )}
              </div>

              {/* Legend */}
              <div className="mt-4 flex flex-wrap justify-center gap-4 text-[10px] text-gray-400">
                {LEGEND_ITEMS.map((item) => (
                  <div key={item.label} className="flex items-center gap-1">
                    <span
                      className={cn(
                        "h-2.5 w-2.5 rounded border",
                        item.color,
                      )}
                    />
                    {item.label}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Right — Teaching Load + Assigned Batches */}
        <div className="space-y-6 xl:col-span-7">
          {/* Teaching Load Bar Chart */}
          <Card>
            <CardContent className="p-6">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                  <GraduationCap className="h-5 w-5 text-purple-400" />
                  Teaching Load
                </h2>
                <div className="flex items-center gap-3">
                  <span className="rounded bg-[#262626] px-2 py-1 text-xs text-gray-400">
                    Dept Avg: 12 hrs/wk
                  </span>
                  <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400">
                    Faculty: 14 hrs/wk
                  </span>
                </div>
              </div>

              {/* Bar Chart */}
              <div className="relative flex h-48 w-full items-end justify-between gap-4 border-b border-dark-border px-2 pb-2">
                {TEACHING_DAYS.map((day) => (
                  <div
                    key={day.day}
                    className="group flex w-full cursor-pointer flex-col items-center gap-2"
                  >
                    <div
                      className={cn(
                        "relative w-full max-w-[40px] rounded-t transition-all",
                        day.isLecture
                          ? "bg-emerald-500 shadow-[0_0_15px_rgba(16,183,127,0.3)] hover:bg-emerald-600"
                          : "bg-[#262626] hover:bg-[#262626]/80",
                      )}
                      style={{ height: `${day.heightPct}%` }}
                    >
                      <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                        {day.lectures}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "text-[10px]",
                        day.isLecture
                          ? "font-medium text-white"
                          : "text-gray-500",
                      )}
                    >
                      {day.day}
                    </span>
                  </div>
                ))}
              </div>

              {/* Chart Legend */}
              <div className="mt-4 flex justify-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded bg-emerald-500" />
                  <span className="text-xs text-gray-400">
                    Lectures (Theory)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded bg-[#262626]" />
                  <span className="text-xs text-gray-400">
                    Tutorials / Lab
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Assigned Batches & Subjects */}
          <Card>
            <div className="flex items-center justify-between border-b border-dark-border p-4">
              <h3 className="text-base font-bold text-white">
                Assigned Batches &amp; Subjects
              </h3>
              <button className="text-xs font-medium text-emerald-500 hover:underline">
                View Schedule
              </button>
            </div>
            <div className="divide-y divide-dark-border">
              {ASSIGNED_BATCHES.map((batch) => {
                const Icon = BATCH_ICONS[batch.type] ?? BookOpen;
                return (
                  <div
                    key={batch.id}
                    className="flex items-center justify-between p-4 transition-colors hover:bg-[#262626]/30"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded",
                          batch.iconBg,
                        )}
                      >
                        <Icon className={cn("h-5 w-5", batch.iconColor)} />
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-white">
                          {batch.subject}
                        </h4>
                        <p className="text-xs text-gray-500">{batch.batch}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="mb-1 flex items-center justify-end gap-1 text-xs text-gray-400">
                        <Users className="h-3.5 w-3.5" />
                        <span>{batch.studentCount}</span>
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium",
                          batch.typeColor,
                        )}
                      >
                        {batch.type}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-dark-border bg-[#262626]/20 p-3 text-center">
              <button className="flex w-full items-center justify-center gap-1 text-xs text-gray-400 transition-colors hover:text-white">
                Show all assigned subjects{" "}
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </Card>
        </div>
      </div>

      {/* Bottom Stat Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-dark-surface to-[#262626]">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500/10 text-orange-500">
              <Hourglass className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">
                Pending Evaluations
              </p>
              <p className="text-xl font-bold text-white">
                14{" "}
                <span className="text-xs font-normal text-gray-500">
                  Papers
                </span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-dark-surface to-[#262626]">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 text-blue-500">
              <ClipboardCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">
                Logbook Verification
              </p>
              <p className="text-xl font-bold text-white">
                92%{" "}
                <span className="text-xs font-normal text-gray-500">
                  Completed
                </span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-dark-surface to-[#262626]">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
              <Star className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">
                Student Feedback
              </p>
              <p className="text-xl font-bold text-white">
                4.8{" "}
                <span className="text-xs font-normal text-gray-500">
                  / 5.0
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
