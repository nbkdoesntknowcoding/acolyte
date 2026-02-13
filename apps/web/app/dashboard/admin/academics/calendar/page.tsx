"use client";

import { useState, useMemo } from "react";
import {
  SlidersHorizontal,
  Printer,
  PlusCircle,
  Upload,
  RefreshCw,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  AlertTriangle,
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
import { MiniMonthGrid } from "@/components/admin/mini-month-grid";
import {
  useCalendarEvents,
  useCreateCalendarEvent,
  useDeleteCalendarEvent,
} from "@/lib/hooks/admin/use-calendar";
import { useDepartments } from "@/lib/hooks/admin/use-departments";
import type {
  AcademicCalendarEventCreate,
} from "@/types/admin-api";
import type { AcademicCalendarDay, AcademicCalendarDayState } from "@/types/admin";
import type { AcademicCalendarEventResponse } from "@/types/admin-api";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PHASES = ["Phase I", "Phase II", "Phase III (Part 1)", "Phase III (Part 2)", "CRMI"];

const EVENT_TYPES = [
  { value: "exam", label: "Examination" },
  { value: "holiday", label: "Holiday" },
  { value: "semester_start", label: "Semester Start" },
  { value: "semester_end", label: "Semester End" },
  { value: "orientation", label: "Orientation" },
  { value: "conference", label: "Conference" },
  { value: "workshop", label: "Workshop" },
  { value: "meeting", label: "Meeting" },
  { value: "nmc_deadline", label: "NMC Deadline" },
  { value: "rotation", label: "Clinical Rotation" },
  { value: "other", label: "Other" },
];

const EVENT_TYPE_BADGE: Record<string, { classes: string; borderColor: string }> = {
  exam:           { classes: "bg-red-500/10 text-red-400 border-red-500/20", borderColor: "border-red-500" },
  holiday:        { classes: "bg-gray-700/50 text-gray-300 border-gray-600", borderColor: "border-gray-500" },
  semester_start: { classes: "bg-blue-500/10 text-blue-400 border-blue-500/20", borderColor: "border-blue-500" },
  semester_end:   { classes: "bg-blue-500/10 text-blue-400 border-blue-500/20", borderColor: "border-blue-500" },
  orientation:    { classes: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", borderColor: "border-emerald-500" },
  conference:     { classes: "bg-orange-500/10 text-orange-400 border-orange-500/20", borderColor: "border-orange-500" },
  workshop:       { classes: "bg-orange-500/10 text-orange-400 border-orange-500/20", borderColor: "border-orange-500" },
  meeting:        { classes: "bg-purple-500/10 text-purple-400 border-purple-500/20", borderColor: "border-purple-500" },
  nmc_deadline:   { classes: "bg-purple-500/10 text-purple-400 border-purple-500/20", borderColor: "border-purple-500" },
  rotation:       { classes: "bg-teal-500/10 text-teal-400 border-teal-500/20", borderColor: "border-teal-500" },
  other:          { classes: "bg-gray-500/10 text-gray-400 border-gray-500/20", borderColor: "border-gray-500" },
};

const EVENT_TYPE_TO_STATE: Record<string, AcademicCalendarDayState> = {
  exam: "exam",
  holiday: "holiday",
  semester_start: "semester_start",
  semester_end: "semester",
  orientation: "semester",
  nmc_deadline: "nmc",
  meeting: "nmc",
  conference: "nmc",
  workshop: "nmc",
  rotation: "semester",
};

const LEGEND = [
  { label: "Semester", color: "bg-blue-500" },
  { label: "Exams", color: "bg-red-500" },
  { label: "NMC / Admin", color: "bg-purple-500" },
  { label: "Holiday", color: "bg-gray-600" },
];

const KEY_DATE_TYPES = new Set(["semester_start", "semester_end", "exam", "nmc_deadline", "orientation"]);

function currentAcademicYear(): string {
  const now = new Date();
  const y = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
  return `${y}-${String(y + 1).slice(2)}`;
}

function formatDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateRange(start: string, end: string | null): string {
  if (!end || end === start) return formatDate(start);
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const sameMonth = s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth();
  if (sameMonth) {
    return `${s.toLocaleDateString("en-IN", { month: "short", day: "numeric" })} \u2013 ${e.getDate()}, ${e.getFullYear()}`;
  }
  return `${formatDate(start)} \u2013 ${formatDate(end)}`;
}

function eventTypeBadge(type: string | null) {
  return EVENT_TYPE_BADGE[type ?? "other"] ?? EVENT_TYPE_BADGE.other;
}

function eventTypeLabel(type: string | null) {
  const found = EVENT_TYPES.find((e) => e.value === type);
  return found?.label ?? type ?? "Other";
}

// ---------------------------------------------------------------------------
// Build 12 mini-month grids from events
// ---------------------------------------------------------------------------

function buildYearGrids(
  events: AcademicCalendarEventResponse[],
  startYear: number,
): { label: string; days: AcademicCalendarDay[] }[] {
  const months: { year: number; month: number }[] = [];
  // Academic year: Jun(5) of startYear through May(4) of startYear+1
  for (let m = 5; m < 12; m++) months.push({ year: startYear, month: m });
  for (let m = 0; m < 5; m++) months.push({ year: startYear + 1, month: m });

  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return months.map(({ year, month }) => {
    const label = `${MONTH_NAMES[month]} ${year}`;
    const firstDay = new Date(year, month, 1);
    const offset = firstDay.getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const specials: Record<number, { state: AcademicCalendarDayState; tooltip?: string }> = {};
    for (const ev of events) {
      const evStart = new Date(ev.start_date + "T00:00:00");
      const evEnd = ev.end_date ? new Date(ev.end_date + "T00:00:00") : evStart;
      for (let d = 1; d <= totalDays; d++) {
        const cellDate = new Date(year, month, d);
        if (cellDate >= evStart && cellDate <= evEnd) {
          const state = EVENT_TYPE_TO_STATE[ev.event_type ?? "other"] ?? "normal";
          if (state !== "normal") {
            specials[d] = { state, tooltip: ev.title };
          }
        }
      }
    }

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (dateStr === todayStr && !specials[d]) {
        specials[d] = { state: "today", tooltip: "Today" };
      }
    }

    const days: AcademicCalendarDay[] = [];
    for (let i = 0; i < offset; i++) {
      days.push({ day: null, state: "normal" });
    }
    for (let d = 1; d <= totalDays; d++) {
      const s = specials[d];
      days.push({ day: d, state: s?.state ?? "normal", tooltip: s?.tooltip });
    }
    return { label, days };
  });
}

// ---------------------------------------------------------------------------
// Compute teaching stats
// ---------------------------------------------------------------------------

function computeTeachingStats(events: AcademicCalendarEventResponse[]) {
  const teachingDays = events.filter((e) => e.is_teaching_day).length;
  const holidays = events.filter((e) => e.event_type === "holiday").length;

  const weekSet = new Set<string>();
  for (const e of events) {
    if (!e.is_teaching_day) continue;
    const d = new Date(e.start_date + "T00:00:00");
    weekSet.add(`${d.getFullYear()}-W${String(isoWeek(d)).padStart(2, "0")}`);
  }

  const today = new Date();
  const cw = `${today.getFullYear()}-W${String(isoWeek(today)).padStart(2, "0")}`;
  const sorted = Array.from(weekSet).sort();
  const cwIdx = sorted.indexOf(cw);

  return {
    teachingDays,
    holidays,
    teachingWeeks: weekSet.size,
    currentWeek: cwIdx >= 0 ? cwIdx + 1 : 0,
  };
}

function isoWeek(d: Date): number {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const w1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - w1.getTime()) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AcademicCalendarPage() {
  const [academicYear, setAcademicYear] = useState(currentAcademicYear);
  const [phaseFilter, setPhaseFilter] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formType, setFormType] = useState("exam");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formPhases, setFormPhases] = useState<string[]>([]);
  const [formDeptId, setFormDeptId] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formIsTeachingDay, setFormIsTeachingDay] = useState(true);

  // Data hooks
  const { data: eventData, isLoading } = useCalendarEvents({
    academic_year: academicYear,
    page_size: 100,
    affects_phases: phaseFilter || undefined,
  });
  const { data: deptData } = useDepartments({ page_size: 50 });
  const createMut = useCreateCalendarEvent();
  const deleteMut = useDeleteCalendarEvent();

  const events = useMemo(() => eventData?.data ?? [], [eventData?.data]);
  const departments = useMemo(() => deptData?.data ?? [], [deptData?.data]);
  const startYear = parseInt(academicYear.split("-")[0]);

  const yearGrids = useMemo(() => buildYearGrids(events, startYear), [events, startYear]);
  const stats = useMemo(() => computeTeachingStats(events), [events]);

  const keyDates = useMemo(() => {
    return events
      .filter((e) => KEY_DATE_TYPES.has(e.event_type ?? ""))
      .sort((a, b) => a.start_date.localeCompare(b.start_date))
      .slice(0, 6);
  }, [events]);

  const upcomingEvents = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return [...events]
      .sort((a, b) => a.start_date.localeCompare(b.start_date))
      .filter((e) => (e.end_date ?? e.start_date) >= today)
      .slice(0, 20);
  }, [events]);

  const handleCreate = async () => {
    if (!formTitle || !formStartDate) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const data: AcademicCalendarEventCreate = {
        title: formTitle,
        event_type: formType || null,
        start_date: formStartDate,
        end_date: formEndDate || null,
        affects_phases: formPhases.length > 0 ? formPhases : null,
        department_id: formDeptId || null,
        description: formDescription || null,
        academic_year: academicYear,
        is_teaching_day: formIsTeachingDay,
      };
      await createMut.mutateAsync(data);
      setSuccessMsg("Event created");
      setFormTitle("");
      setFormStartDate("");
      setFormEndDate("");
      setFormPhases([]);
      setFormDeptId("");
      setFormDescription("");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to create event");
    }
  };

  const handleDelete = async (id: string) => {
    setErrorMsg(null);
    try {
      await deleteMut.mutateAsync(id);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to delete event");
    }
  };

  const togglePhase = (p: string) => {
    setFormPhases((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  };

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-dark-border bg-dark-surface px-6">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white">Academic Year</h1>
              <div className="flex items-center rounded-lg border border-dark-border bg-[#262626]">
                <button
                  onClick={() => {
                    const y = startYear - 1;
                    setAcademicYear(`${y}-${String(y + 1).slice(2)}`);
                  }}
                  className="p-1.5 text-gray-400 hover:text-white"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-2 text-sm font-medium text-white">{academicYear}</span>
                <button
                  onClick={() => {
                    const y = startYear + 1;
                    setAcademicYear(`${y}-${String(y + 1).slice(2)}`);
                  }}
                  className="p-1.5 text-gray-400 hover:text-white"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            {stats.currentWeek > 0 && (
              <div className="flex items-center gap-2 rounded-full border border-dark-border bg-[#262626] px-3 py-1">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                <span className="text-xs font-medium text-white">
                  Week {stats.currentWeek} of {stats.teachingWeeks}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={phaseFilter}
              onChange={(e) => setPhaseFilter(e.target.value)}
              className="rounded-lg border border-dark-border bg-[#262626] p-2 text-sm text-white focus:border-emerald-500 focus:ring-emerald-500"
            >
              <option value="">All Phases</option>
              {PHASES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <button className="p-2 text-gray-400 hover:text-white">
              <SlidersHorizontal className="h-5 w-5" />
            </button>
            <button className="p-2 text-gray-400 hover:text-white">
              <Printer className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Error / Success */}
        {errorMsg && (
          <div className="flex items-center gap-2 border-b border-red-900/40 bg-red-500/10 px-6 py-2 text-sm text-red-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="shrink-0"><X className="h-4 w-4" /></button>
          </div>
        )}
        {successMsg && (
          <div className="border-b border-emerald-900/40 bg-emerald-500/10 px-6 py-2 text-sm text-emerald-400">
            {successMsg}
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 space-y-6 overflow-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-400">Loading calendar\u2026</span>
            </div>
          ) : (
            <>
              {/* Year Overview Grid */}
              <div className="rounded-xl border border-dark-border bg-dark-surface p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-300">
                    Year Overview ({academicYear})
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
                  {yearGrids.map((m) => (
                    <MiniMonthGrid key={m.label} label={m.label} days={m.days} />
                  ))}
                </div>
              </div>

              {/* Upcoming Events Table */}
              <div>
                <h3 className="mb-3 text-sm font-bold text-white">
                  Upcoming Events
                  <span className="ml-2 text-xs font-normal text-gray-500">
                    ({upcomingEvents.length})
                  </span>
                </h3>
                <div className="overflow-hidden rounded-lg border border-dark-border bg-dark-surface">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-dark-border bg-[#262626]">
                        <TableHead className="text-gray-500">Date</TableHead>
                        <TableHead className="text-gray-500">Event Name</TableHead>
                        <TableHead className="text-gray-500">Type</TableHead>
                        <TableHead className="text-gray-500">Phases</TableHead>
                        <TableHead className="text-gray-500">Teaching</TableHead>
                        <TableHead className="text-right text-gray-500">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {upcomingEvents.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-8 text-center text-sm text-gray-500">
                            No upcoming events
                          </TableCell>
                        </TableRow>
                      ) : (
                        upcomingEvents.map((evt) => {
                          const badge = eventTypeBadge(evt.event_type);
                          const phases = Array.isArray(evt.affects_phases) ? evt.affects_phases : [];
                          return (
                            <TableRow
                              key={evt.id}
                              className="border-dark-border transition-colors hover:bg-[#262626]/50"
                            >
                              <TableCell className="font-medium text-white">
                                {formatDateRange(evt.start_date, evt.end_date)}
                              </TableCell>
                              <TableCell className="text-gray-300">{evt.title}</TableCell>
                              <TableCell>
                                <span className={cn("rounded border px-2 py-0.5 text-xs", badge.classes)}>
                                  {eventTypeLabel(evt.event_type)}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {phases.length > 0
                                    ? phases.map((p) => (
                                        <span
                                          key={String(p)}
                                          className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400"
                                        >
                                          {String(p)}
                                        </span>
                                      ))
                                    : <span className="text-xs text-gray-500">All</span>}
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className={cn("text-xs", evt.is_teaching_day ? "text-emerald-400" : "text-gray-500")}>
                                  {evt.is_teaching_day ? "Yes" : "No"}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button className="text-gray-500 hover:text-white">
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(evt.id)}
                                    className="text-gray-500 hover:text-red-400"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Bottom Bar */}
        <div className="flex h-14 shrink-0 items-center justify-between border-t border-dark-border bg-dark-surface px-6">
          <span className="text-xs text-gray-500">
            {events.length} events for {academicYear}
          </span>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm">
              <Upload className="mr-2 h-4 w-4" /> Import University Calendar
            </Button>
            <Button variant="outline" size="sm">
              <RefreshCw className="mr-2 h-4 w-4" /> Sync
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
                <label className="mb-1 block text-xs font-medium text-gray-400">Event Name</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Clinical Assessment"
                  className="w-full rounded border border-dark-border bg-[#262626] px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-400">Start Date</label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full rounded border border-dark-border bg-[#262626] px-2 py-2 text-sm text-gray-300 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-400">End Date</label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full rounded border border-dark-border bg-[#262626] px-2 py-2 text-sm text-gray-300 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">Type</label>
                <select
                  value={formType}
                  onChange={(e) => {
                    setFormType(e.target.value);
                    if (e.target.value === "holiday") setFormIsTeachingDay(false);
                    else setFormIsTeachingDay(true);
                  }}
                  className="w-full rounded border border-dark-border bg-[#262626] px-3 py-2 text-sm text-gray-300 focus:border-emerald-500 focus:outline-none"
                >
                  {EVENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Phase selector */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">Affected Phases</label>
                <div className="flex flex-wrap gap-1.5">
                  {PHASES.map((p) => (
                    <button
                      key={p}
                      onClick={() => togglePhase(p)}
                      className={cn(
                        "rounded border px-2 py-1 text-xs transition-colors",
                        formPhases.includes(p)
                          ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400"
                          : "border-dark-border bg-[#262626] text-gray-400 hover:text-white",
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Department */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">Department (optional)</label>
                <select
                  value={formDeptId}
                  onChange={(e) => setFormDeptId(e.target.value)}
                  className="w-full rounded border border-dark-border bg-[#262626] px-3 py-2 text-sm text-gray-300 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">Description</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={2}
                  placeholder="Optional description"
                  className="w-full resize-none rounded border border-dark-border bg-[#262626] px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Teaching day toggle */}
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-gray-400">Teaching Day</span>
                <button
                  onClick={() => setFormIsTeachingDay(!formIsTeachingDay)}
                  className={cn(
                    "relative h-5 w-10 rounded-full border transition-colors",
                    formIsTeachingDay
                      ? "border-emerald-500/40 bg-emerald-500/20"
                      : "border-dark-border bg-[#262626]",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-3.5 w-3.5 rounded-full shadow-sm transition-transform",
                      formIsTeachingDay
                        ? "right-1 bg-emerald-500"
                        : "left-1 bg-gray-500",
                    )}
                  />
                </button>
              </div>

              <Button
                onClick={handleCreate}
                disabled={!formTitle || !formStartDate || createMut.isPending}
                className="mt-2 w-full shadow-lg shadow-emerald-500/20"
              >
                {createMut.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <PlusCircle className="mr-2 h-4 w-4" />
                )}
                Create Event
              </Button>
            </div>
          </div>

          {/* Key Dates */}
          <div>
            <h3 className="mb-4 border-b border-dark-border pb-2 text-sm font-bold uppercase tracking-wider text-white">
              Key Dates
            </h3>
            {keyDates.length === 0 ? (
              <p className="text-xs text-gray-500">No key dates found</p>
            ) : (
              <div className="space-y-4">
                {keyDates.map((kd) => {
                  const badge = eventTypeBadge(kd.event_type);
                  const today = new Date().toISOString().slice(0, 10);
                  const isPast = (kd.end_date ?? kd.start_date) < today;
                  const isActive = kd.start_date <= today && (kd.end_date ?? kd.start_date) >= today;
                  return (
                    <div key={kd.id} className={cn("relative border-l-2 pl-4", badge.borderColor)}>
                      <div className="flex items-start justify-between">
                        <h4 className="text-sm font-medium text-white">{kd.title}</h4>
                        <span
                          className={cn(
                            "rounded px-1.5 text-xs",
                            isActive
                              ? "bg-emerald-500/10 text-emerald-400"
                              : isPast
                                ? "bg-gray-500/10 text-gray-500"
                                : "bg-yellow-500/10 text-yellow-400",
                          )}
                        >
                          {isActive ? "Active" : isPast ? "Past" : "Upcoming"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        {formatDateRange(kd.start_date, kd.end_date)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Summary Stats */}
          <div className="rounded-lg border border-dark-border bg-[#262626]/50 p-3">
            <div className="grid grid-cols-2 gap-4 divide-x divide-dark-border text-center">
              <div>
                <div className="text-2xl font-bold text-white">{stats.holidays}</div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500">Holidays</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{stats.teachingDays}</div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500">Teaching Days</div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
