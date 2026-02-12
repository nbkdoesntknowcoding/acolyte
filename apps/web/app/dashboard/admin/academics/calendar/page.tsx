"use client";

import {
  SlidersHorizontal,
  Printer,
  PlusCircle,
  Upload,
  RefreshCw,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { MiniMonthGrid, buildMonthGrid } from "@/components/admin/mini-month-grid";

// ---------------------------------------------------------------------------
// TODO: Replace with API call — GET /api/v1/admin/academics/calendar
// ---------------------------------------------------------------------------

const LEGEND = [
  { label: "Semester", color: "bg-blue-500" },
  { label: "Exams", color: "bg-red-500" },
  { label: "NMC Audit", color: "bg-purple-500" },
  { label: "Holiday", color: "bg-gray-600" },
];

const MONTHS = [
  {
    label: "August 2023",
    days: buildMonthGrid(2, 31, {
      7:  { state: "semester_start", tooltip: "Semester Start" },
      8:  { state: "semester" },
      9:  { state: "semester" },
      10: { state: "semester" },
      11: { state: "semester" },
      13: { state: "holiday", tooltip: "Sunday" },
      15: { state: "holiday", tooltip: "Independence Day" },
    }),
  },
  {
    label: "September 2023",
    days: buildMonthGrid(5, 30, {
      4:  { state: "nmc", tooltip: "NMC Visit" },
      11: { state: "exam" },
      12: { state: "exam" },
      13: { state: "exam" },
      19: { state: "holiday", tooltip: "Ganesh Chaturthi" },
    }),
  },
  {
    label: "October 2023",
    days: buildMonthGrid(0, 31, {
      2:  { state: "holiday", tooltip: "Gandhi Jayanti" },
      16: { state: "today" },
      24: { state: "holiday", tooltip: "Dussehra" },
    }),
  },
  {
    label: "November 2023",
    days: buildMonthGrid(3, 30, {
      12: { state: "holiday", tooltip: "Diwali" },
      17: { state: "exam_start", tooltip: "Term Exams" },
      18: { state: "exam" },
      19: { state: "exam" },
      20: { state: "exam" },
      21: { state: "exam" },
    }),
  },
];

const EVENTS = [
  {
    id: "e1",
    date: "Oct 24, 2023",
    name: "Dussehra Holiday",
    typeBadge: "Holiday",
    typeBadgeClasses: "bg-gray-700/50 text-gray-300 border-gray-600",
    phases: [{ label: "All Phases", classes: "bg-blue-500/10 text-blue-400" }],
  },
  {
    id: "e2",
    date: "Nov 17 - Nov 21, 2023",
    name: "1st Internal Assessment",
    typeBadge: "Exam",
    typeBadgeClasses: "bg-red-500/10 text-red-400 border-red-500/20",
    phases: [
      {
        label: "Phase I",
        classes: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
      },
    ],
  },
  {
    id: "e3",
    date: "Dec 15, 2023",
    name: "NMC Compliance Audit",
    typeBadge: "Administrative",
    typeBadgeClasses: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    phases: [{ label: "Faculty Only", classes: "bg-gray-800 text-gray-400" }],
  },
  {
    id: "e4",
    date: "Jan 05, 2024",
    name: "Foundation Course Start",
    typeBadge: "Academic",
    typeBadgeClasses: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    phases: [
      {
        label: "New Batch",
        classes: "bg-orange-500/10 text-orange-400 border border-orange-500/20",
      },
    ],
  },
];

const KEY_DATES = [
  {
    title: "Phase I Start",
    statusLabel: "Active",
    statusClasses: "text-emerald-400 bg-emerald-500/10",
    borderColor: "border-emerald-500",
    date: "Started: Aug 01, 2023",
  },
  {
    title: "Univ. Exams",
    statusLabel: "Upcoming",
    statusClasses: "text-gray-400 bg-[#262626]",
    borderColor: "border-red-500",
    date: "Jul 15 - Jul 30, 2024",
    subNote: "Application due: Jun 15",
  },
  {
    title: "NMC Report",
    statusLabel: "Pending",
    statusClasses: "text-yellow-400 bg-yellow-500/10",
    borderColor: "border-purple-500",
    date: "Deadline: Dec 31, 2023",
  },
  {
    title: "NAAC Cycle 2",
    statusLabel: "Planning",
    statusClasses: "text-gray-400 bg-[#262626]",
    borderColor: "border-blue-500",
    date: "Self Study Report: Feb '24",
  },
];

// ---------------------------------------------------------------------------

export default function AcademicCalendarPage() {
  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-dark-border bg-dark-surface px-6">
          <div className="flex items-center gap-6">
            <div className="flex items-baseline gap-2">
              <h1 className="text-2xl font-bold text-white">
                Academic Year 2023-24
              </h1>
              <span className="text-sm text-gray-500">MBBS Phase I</span>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-dark-border bg-[#262626] px-3 py-1">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              <span className="text-xs font-medium text-white">
                Week 24 of 39
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select className="rounded-lg border border-dark-border bg-[#262626] p-2 text-sm text-white focus:border-emerald-500 focus:ring-emerald-500">
              <option>Phase I - MBBS</option>
              <option>Phase II - MBBS</option>
              <option>Phase III (Part 1)</option>
              <option>Phase III (Part 2)</option>
              <option>CRMI</option>
            </select>
            <button className="p-2 text-gray-400 hover:text-white">
              <SlidersHorizontal className="h-5 w-5" />
            </button>
            <button className="p-2 text-gray-400 hover:text-white">
              <Printer className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 space-y-6 overflow-auto p-6">
          {/* Year Overview */}
          <div className="rounded-xl border border-dark-border bg-dark-surface p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-300">
                Year Overview (Aug &apos;23 - Jul &apos;24)
              </h2>
              <div className="flex gap-4 text-xs">
                {LEGEND.map((l) => (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <span className={cn("h-3 w-3 rounded-sm", l.color)} />
                    <span className="text-gray-400">{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-6 xl:grid-cols-4">
              {MONTHS.map((m) => (
                <MiniMonthGrid key={m.label} label={m.label} days={m.days} />
              ))}
            </div>
          </div>

          {/* Upcoming Events */}
          <div>
            <h3 className="mb-3 text-sm font-bold text-white">
              Upcoming Events
            </h3>
            <div className="overflow-hidden rounded-lg border border-dark-border bg-dark-surface">
              <Table>
                <TableHeader>
                  <TableRow className="border-dark-border bg-[#262626]">
                    <TableHead className="text-gray-500">Date</TableHead>
                    <TableHead className="text-gray-500">Event Name</TableHead>
                    <TableHead className="text-gray-500">Type</TableHead>
                    <TableHead className="text-gray-500">
                      Affected Phases
                    </TableHead>
                    <TableHead className="text-right text-gray-500">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {EVENTS.map((evt) => (
                    <TableRow
                      key={evt.id}
                      className="border-dark-border transition-colors hover:bg-[#262626]/50"
                    >
                      <TableCell className="font-medium text-white">
                        {evt.date}
                      </TableCell>
                      <TableCell>{evt.name}</TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "rounded border px-2 py-0.5 text-xs",
                            evt.typeBadgeClasses,
                          )}
                        >
                          {evt.typeBadge}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {evt.phases.map((p) => (
                            <span
                              key={p.label}
                              className={cn(
                                "rounded px-2 py-0.5 text-xs",
                                p.classes,
                              )}
                            >
                              {p.label}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <button className="text-gray-500 hover:text-white">
                          <Pencil className="h-4 w-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="flex h-14 shrink-0 items-center justify-between border-t border-dark-border bg-dark-surface px-6">
          <span className="text-xs text-gray-500">
            Last synced: Today at 09:30 AM
          </span>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm">
              <Upload className="mr-2 h-4 w-4" /> Import University Calendar
            </Button>
            <Button variant="outline" size="sm">
              <RefreshCw className="mr-2 h-4 w-4" /> Sync with Google Calendar
            </Button>
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <aside className="flex w-[320px] shrink-0 flex-col overflow-hidden border-l border-dark-border bg-[#0A0A0A]">
        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {/* Add New Event Form */}
          <div className="rounded-lg border border-dark-border bg-dark-surface p-4 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
              <PlusCircle className="h-5 w-5 text-emerald-500" /> Add New Event
            </h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">
                  Event Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Clinical Assessment"
                  className="w-full rounded border border-dark-border bg-[#262626] px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-400">
                    Start Date
                  </label>
                  <input
                    type="date"
                    className="w-full rounded border border-dark-border bg-[#262626] px-2 py-2 text-sm text-gray-300 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-400">
                    End Date
                  </label>
                  <input
                    type="date"
                    className="w-full rounded border border-dark-border bg-[#262626] px-2 py-2 text-sm text-gray-300 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">
                  Type
                </label>
                <select className="w-full rounded border border-dark-border bg-[#262626] px-3 py-2 text-sm text-gray-300 focus:border-emerald-500 focus:outline-none">
                  <option>Examination</option>
                  <option>Holiday</option>
                  <option>Academic Session</option>
                  <option>NMC/Administrative</option>
                </select>
              </div>

              {/* Recurring toggle (off) */}
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-gray-400">Recurring Event</span>
                <button className="relative h-5 w-10 rounded-full border border-dark-border bg-[#262626]">
                  <span className="absolute left-1 top-0.5 h-3.5 w-3.5 rounded-full bg-gray-500 transition-transform" />
                </button>
              </div>

              {/* Notify toggle (on) */}
              <div className="flex items-center justify-between border-t border-dark-border py-1 pt-3">
                <span className="text-xs text-gray-400">Notify Students</span>
                <button className="relative h-5 w-10 rounded-full border border-emerald-500/40 bg-emerald-500/20">
                  <span className="absolute right-1 top-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 shadow-sm transition-transform" />
                </button>
              </div>

              <Button className="mt-2 w-full shadow-lg shadow-emerald-500/20">
                Create Event
              </Button>
            </div>
          </div>

          {/* Key Dates Status */}
          <div>
            <h3 className="mb-4 border-b border-dark-border pb-2 text-sm font-bold uppercase tracking-wider text-white">
              Key Dates Status
            </h3>
            <div className="space-y-4">
              {KEY_DATES.map((kd) => (
                <div
                  key={kd.title}
                  className={cn("relative border-l-2 pl-4", kd.borderColor)}
                >
                  <div className="flex items-start justify-between">
                    <h4 className="text-sm font-medium text-white">
                      {kd.title}
                    </h4>
                    <span
                      className={cn(
                        "rounded px-1.5 text-xs",
                        kd.statusClasses,
                      )}
                    >
                      {kd.statusLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{kd.date}</p>
                  {kd.subNote && (
                    <p className="mt-0.5 text-[10px] text-red-400">
                      {kd.subNote}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Summary Stats */}
          <div className="rounded-lg border border-dark-border bg-[#262626]/50 p-3">
            <div className="grid grid-cols-2 gap-4 divide-x divide-dark-border text-center">
              <div>
                <div className="text-2xl font-bold text-white">18</div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500">
                  Holidays
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">245</div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500">
                  Teaching Days
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
