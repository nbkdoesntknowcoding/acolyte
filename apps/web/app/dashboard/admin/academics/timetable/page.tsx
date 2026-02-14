"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Sparkles,
  ShieldCheck,
  Download,
  Send,
  AlertTriangle,
  User,
  Pencil,
  Trash2,
  X,
  Loader2,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useTimetableSlots,
  useCreateTimetableSlot,
  useUpdateTimetableSlot,
  useDeleteTimetableSlot,
} from "@/lib/hooks/admin/use-timetable";
import { useBatches } from "@/lib/hooks/admin/use-batches";
import { useFaculty } from "@/lib/hooks/admin/use-faculty";
import { useDepartments } from "@/lib/hooks/admin/use-departments";
import { useInfrastructure } from "@/lib/hooks/admin/use-infrastructure";
import type {
  TimetableSlotResponse,
  TimetableSlotCreate,
  TimetableSlotUpdate,
  FacultyResponse,
  DepartmentResponse,
  InfrastructureResponse,
} from "@/types/admin-api";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PHASES = [
  { value: "Phase I", label: "Phase I - MBBS" },
  { value: "Phase II", label: "Phase II - MBBS" },
  { value: "Phase III (Part 1)", label: "Phase III (Part 1)" },
  { value: "Phase III (Part 2)", label: "Phase III (Part 2)" },
  { value: "CRMI", label: "CRMI" },
];

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const TIME_SLOTS = [
  "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00",
];

const SESSION_TYPES = [
  { value: "lecture", label: "Lecture" },
  { value: "practical", label: "Practical" },
  { value: "clinical", label: "Clinical" },
  { value: "tutorial", label: "Tutorial" },
  { value: "demonstration", label: "Demonstration" },
  { value: "seminar", label: "Seminar" },
  { value: "sgd", label: "SGD" },
  { value: "dissection", label: "Dissection" },
  { value: "field_visit", label: "Field Visit" },
];

const SESSION_SHORT: Record<string, string> = {
  lecture: "Lec",
  practical: "Prac",
  clinical: "Clin",
  tutorial: "Tut",
  demonstration: "Demo",
  seminar: "Sem",
  sgd: "SGD",
  dissection: "Dissec",
  field_visit: "Field",
};

// Deterministic department color palette
const DEPT_PALETTE = [
  { bg: "bg-blue-500/10", border: "border-blue-500", text: "text-blue-400", badgeBg: "bg-blue-500/20", badgeText: "text-blue-300", badgeBorder: "border-blue-500/30", hover: "hover:bg-blue-500/20" },
  { bg: "bg-purple-500/10", border: "border-purple-500", text: "text-purple-400", badgeBg: "bg-purple-500/20", badgeText: "text-purple-300", badgeBorder: "border-purple-500/30", hover: "hover:bg-purple-500/20" },
  { bg: "bg-orange-500/10", border: "border-orange-500", text: "text-orange-400", badgeBg: "bg-orange-500/20", badgeText: "text-orange-300", badgeBorder: "border-orange-500/30", hover: "hover:bg-orange-500/20" },
  { bg: "bg-pink-500/10", border: "border-pink-500", text: "text-pink-400", badgeBg: "bg-pink-500/20", badgeText: "text-pink-300", badgeBorder: "border-pink-500/30", hover: "hover:bg-pink-500/20" },
  { bg: "bg-red-500/10", border: "border-red-500", text: "text-red-400", badgeBg: "bg-red-500/20", badgeText: "text-red-300", badgeBorder: "border-red-500/30", hover: "hover:bg-red-500/20" },
  { bg: "bg-yellow-500/10", border: "border-yellow-500", text: "text-yellow-400", badgeBg: "bg-yellow-500/20", badgeText: "text-yellow-300", badgeBorder: "border-yellow-500/30", hover: "hover:bg-yellow-500/20" },
  { bg: "bg-teal-500/10", border: "border-teal-500", text: "text-teal-400", badgeBg: "bg-teal-500/20", badgeText: "text-teal-300", badgeBorder: "border-teal-500/30", hover: "hover:bg-teal-500/20" },
  { bg: "bg-cyan-500/10", border: "border-cyan-500", text: "text-cyan-400", badgeBg: "bg-cyan-500/20", badgeText: "text-cyan-300", badgeBorder: "border-cyan-500/30", hover: "hover:bg-cyan-500/20" },
  { bg: "bg-indigo-500/10", border: "border-indigo-500", text: "text-indigo-400", badgeBg: "bg-indigo-500/20", badgeText: "text-indigo-300", badgeBorder: "border-indigo-500/30", hover: "hover:bg-indigo-500/20" },
  { bg: "bg-emerald-500/10", border: "border-emerald-500", text: "text-emerald-400", badgeBg: "bg-emerald-500/20", badgeText: "text-emerald-300", badgeBorder: "border-emerald-500/30", hover: "hover:bg-emerald-500/20" },
];

function deptColor(deptId: string | null | undefined) {
  if (!deptId) return DEPT_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < deptId.length; i++) {
    hash = (hash * 31 + deptId.charCodeAt(i)) | 0;
  }
  return DEPT_PALETTE[Math.abs(hash) % DEPT_PALETTE.length];
}

function currentAcademicYear(): string {
  const now = new Date();
  const y = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
  return `${y}-${String(y + 1).slice(2)}`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TimetableManagementPage() {
  const [phase, setPhase] = useState("Phase I");
  const [batchId, setBatchId] = useState<string>("");
  const [academicYear, setAcademicYear] = useState(currentAcademicYear);

  // Dialog state
  const [dialog, setDialog] = useState<
    | { mode: "create"; dayOfWeek: number; startTime: string }
    | { mode: "edit"; slot: TimetableSlotResponse }
    | null
  >(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Data hooks
  const { data: slotData, isLoading: slotsLoading } = useTimetableSlots({
    academic_year: academicYear,
    phase,
    batch_id: batchId || undefined,
    page_size: 200,
  });
  const { data: batchData } = useBatches({ page_size: 100 });
  const { data: facultyData } = useFaculty({ page_size: 500 });
  const { data: deptData } = useDepartments({ page_size: 50 });
  const { data: infraData } = useInfrastructure({
    page_size: 200,
    category: "lecture_hall",
  });
  // Also fetch labs for practical rooms
  const { data: labData } = useInfrastructure({
    page_size: 200,
    category: "laboratory",
  });

  const slots = useMemo(() => slotData?.data ?? [], [slotData?.data]);
  const batches = batchData?.data ?? [];
  const facultyList = useMemo(() => facultyData?.data ?? [], [facultyData?.data]);
  const departments = useMemo(() => deptData?.data ?? [], [deptData?.data]);
  const rooms = useMemo(() => {
    const all = [...(infraData?.data ?? []), ...(labData?.data ?? [])];
    const seen = new Set<string>();
    return all.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  }, [infraData, labData]);

  // Lookup maps
  const facultyMap = useMemo(() => {
    const m = new Map<string, FacultyResponse>();
    facultyList.forEach((f) => m.set(f.id, f));
    return m;
  }, [facultyList]);

  const deptMap = useMemo(() => {
    const m = new Map<string, DepartmentResponse>();
    departments.forEach((d) => m.set(d.id, d));
    return m;
  }, [departments]);

  const roomMap = useMemo(() => {
    const m = new Map<string, InfrastructureResponse>();
    rooms.forEach((r) => m.set(r.id, r));
    return m;
  }, [rooms]);

  // Grid: Map<"day:time" -> TimetableSlotResponse[]>
  const gridMap = useMemo(() => {
    const m = new Map<string, TimetableSlotResponse[]>();
    for (const s of slots) {
      const key = `${s.day_of_week}:${s.start_time}`;
      const arr = m.get(key) ?? [];
      arr.push(s);
      m.set(key, arr);
    }
    return m;
  }, [slots]);

  // Faculty weekly load (count hours from slots)
  const facultyLoad = useMemo(() => {
    const load = new Map<string, number>();
    for (const s of slots) {
      if (!s.faculty_id) continue;
      const startH = parseInt(s.start_time.split(":")[0]);
      const endH = parseInt(s.end_time.split(":")[0]);
      const h = Math.max(0, endH - startH);
      load.set(s.faculty_id, (load.get(s.faculty_id) ?? 0) + h);
    }
    return load;
  }, [slots]);

  // Top-loaded faculty for sidebar
  const topFaculty = useMemo(() => {
    return Array.from(facultyLoad.entries())
      .map(([id, hours]) => ({ id, hours, name: facultyMap.get(id)?.name ?? "Unknown" }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 6);
  }, [facultyLoad, facultyMap]);

  const handleCellClick = useCallback(
    (dayOfWeek: number, startTime: string) => {
      const existing = gridMap.get(`${dayOfWeek}:${startTime}`);
      if (existing && existing.length > 0) {
        setDialog({ mode: "edit", slot: existing[0] });
      } else {
        setDialog({ mode: "create", dayOfWeek, startTime });
      }
    },
    [gridMap],
  );

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-dark-border bg-dark-surface px-6">
          <div className="flex items-center gap-4">
            {/* Phase selector */}
            <select
              value={phase}
              onChange={(e) => setPhase(e.target.value)}
              className="rounded-lg border border-dark-border bg-[#262626] p-2 text-sm text-white focus:border-emerald-500 focus:ring-emerald-500"
            >
              {PHASES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>

            {/* Batch selector */}
            <select
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              className="rounded-lg border border-dark-border bg-[#262626] p-2 text-sm text-white focus:border-emerald-500 focus:ring-emerald-500"
            >
              <option value="">All Batches</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            {/* Academic year */}
            <div className="flex items-center rounded-lg border border-dark-border bg-[#262626]">
              <button
                onClick={() => {
                  const [start] = academicYear.split("-");
                  const y = parseInt(start) - 1;
                  setAcademicYear(`${y}-${String(y + 1).slice(2)}`);
                }}
                className="p-2 text-gray-400 hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="flex items-center gap-2 border-x border-dark-border px-3 text-sm font-medium text-white">
                <CalendarDays className="h-3 w-3 text-emerald-500" />
                {academicYear}
              </span>
              <button
                onClick={() => {
                  const [start] = academicYear.split("-");
                  const y = parseInt(start) + 1;
                  setAcademicYear(`${y}-${String(y + 1).slice(2)}`);
                }}
                className="p-2 text-gray-400 hover:text-white"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <span className="text-xs text-gray-500">
              {slots.length} slot{slots.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button className="text-gray-400 hover:text-white">
              <SlidersHorizontal className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {errorMsg && (
          <div className="flex items-center gap-2 border-b border-red-900/40 bg-red-500/10 px-6 py-2 text-sm text-red-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{errorMsg}</span>
            <button
              onClick={() => setErrorMsg(null)}
              className="shrink-0 text-red-400 hover:text-red-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Timetable Grid */}
        <div className="flex-1 overflow-auto p-6">
          {slotsLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-400">Loading timetable\u2026</span>
            </div>
          ) : (
            <div className="min-w-[1000px] overflow-hidden rounded-lg border border-dark-border bg-dark-surface">
              {/* Day headers */}
              <div className="grid grid-cols-[60px_repeat(6,1fr)] border-b border-dark-border bg-[#262626]">
                <div className="border-r border-dark-border p-3 text-center text-xs font-semibold text-gray-500">
                  TIME
                </div>
                {DAY_NAMES.map((d, i) => (
                  <div
                    key={d}
                    className={cn(
                      "border-r border-dark-border p-3 text-center last:border-r-0",
                      i === 5 && "bg-[#262626]/80",
                    )}
                  >
                    <span className="text-sm font-semibold text-white">{d}</span>
                  </div>
                ))}
              </div>

              {/* Time rows */}
              {TIME_SLOTS.map((time) => (
                <div
                  key={time}
                  className="grid min-h-[100px] grid-cols-[60px_repeat(6,1fr)] border-b border-dark-border last:border-b-0"
                >
                  <div className="flex flex-col justify-center border-r border-dark-border p-2 text-center text-xs text-gray-500">
                    {time}
                  </div>
                  {Array.from({ length: 6 }, (_, dayIdx) => {
                    const cellSlots = gridMap.get(`${dayIdx}:${time}`) ?? [];
                    return (
                      <div
                        key={dayIdx}
                        onClick={() => handleCellClick(dayIdx, time)}
                        className={cn(
                          "cursor-pointer border-r border-dark-border p-1 last:border-r-0",
                          dayIdx === 5 && "bg-[#262626]/10",
                          time === "12:00" && "bg-[#262626]/20",
                        )}
                      >
                        {cellSlots.length > 0 ? (
                          cellSlots.map((slot) => (
                            <SlotCard
                              key={slot.id}
                              slot={slot}
                              deptMap={deptMap}
                              facultyMap={facultyMap}
                              roomMap={roomMap}
                            />
                          ))
                        ) : time === "12:00" ? (
                          <div className="flex h-full items-center justify-center text-xs font-medium uppercase tracking-widest text-gray-600 opacity-50">
                            Lunch
                          </div>
                        ) : (
                          <div className="group flex h-full w-full items-center justify-center rounded border border-dashed border-gray-700 text-gray-600 transition-colors hover:border-gray-500 hover:text-gray-400">
                            <Plus className="h-5 w-5 transition-transform group-hover:scale-110" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Action Bar */}
        <div className="flex h-14 shrink-0 items-center justify-between border-t border-dark-border bg-dark-surface px-6">
          <div className="flex items-center gap-3">
            <Button size="sm" className="shadow-lg shadow-emerald-500/20">
              <Sparkles className="mr-2 h-4 w-4" /> Auto-Generate
            </Button>
            <Button size="sm" className="shadow-lg shadow-emerald-500/20">
              <ShieldCheck className="mr-2 h-4 w-4" /> Check NMC Hours
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
            <Button
              size="sm"
              className="ml-2 bg-emerald-600 hover:bg-emerald-700"
            >
              <Send className="mr-2 h-4 w-4" /> Publish
            </Button>
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <aside className="flex w-[280px] shrink-0 flex-col overflow-hidden border-l border-dark-border bg-[#0A0A0A]">
        <div className="flex-1 space-y-6 overflow-y-auto p-4">
          {/* Department Legend */}
          <div>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-white">
              Departments
            </h3>
            <div className="space-y-1">
              {departments.slice(0, 12).map((d) => {
                const c = deptColor(d.id);
                return (
                  <div key={d.id} className="flex items-center gap-2">
                    <div className={cn("h-2 w-2 rounded-full", c.border.replace("border-", "bg-"))} />
                    <span className="text-xs text-gray-300">{d.name}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Room Availability */}
          <div>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-white">
              Rooms
              <span className="ml-1 text-xs font-normal normal-case text-gray-500">
                ({rooms.length})
              </span>
            </h3>
            <div className="space-y-2">
              {rooms.slice(0, 8).map((room) => {
                const isUsed = slots.some((s) => s.room_id === room.id);
                return (
                  <div
                    key={room.id}
                    className="flex items-center justify-between rounded border border-dark-border bg-dark-surface p-2"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "h-2 w-2 rounded-full",
                          isUsed ? "bg-red-500" : "bg-emerald-500",
                        )}
                      />
                      <span className="max-w-[140px] truncate text-xs text-gray-300">
                        {room.name}
                      </span>
                    </div>
                    <span className={cn("text-[10px]", isUsed ? "text-red-400" : "text-emerald-400")}>
                      {isUsed ? "In Use" : "Free"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Faculty Load */}
          <div>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-white">
              Faculty Load
              <span className="ml-1 text-xs font-normal normal-case text-gray-500">
                (Weekly)
              </span>
            </h3>
            <div className="space-y-4">
              {topFaculty.map((f) => {
                const maxHours = 14;
                const isOver = f.hours > maxHours;
                const pct = Math.min(Math.round((f.hours / maxHours) * 100), 100);
                return (
                  <div key={f.id}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="max-w-[140px] truncate text-gray-400">{f.name}</span>
                      <span className={cn("font-medium", isOver ? "text-red-400" : "text-white")}>
                        {f.hours}h
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full border border-dark-border bg-dark-surface">
                      <div
                        className={cn(
                          "h-1.5 rounded-full",
                          isOver ? "bg-red-500" : "bg-blue-500",
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {isOver && (
                      <p className="mt-0.5 text-right text-[10px] text-red-500">Overloaded</p>
                    )}
                  </div>
                );
              })}
              {topFaculty.length === 0 && (
                <p className="text-xs text-gray-500">No faculty assigned yet</p>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Create / Edit Dialog */}
      {dialog && (
        <SlotDialog
          dialog={dialog}
          academicYear={academicYear}
          phase={phase}
          batchId={batchId || undefined}
          departments={departments}
          facultyList={facultyList}
          rooms={rooms}
          onClose={() => setDialog(null)}
          onError={setErrorMsg}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slot Card
// ---------------------------------------------------------------------------

function SlotCard({
  slot,
  deptMap,
  facultyMap,
  roomMap,
}: {
  slot: TimetableSlotResponse;
  deptMap: Map<string, DepartmentResponse>;
  facultyMap: Map<string, FacultyResponse>;
  roomMap: Map<string, InfrastructureResponse>;
}) {
  const c = deptColor(slot.department_id);
  const deptName = slot.department_id ? deptMap.get(slot.department_id)?.name : null;
  const facultyName = slot.faculty_id ? facultyMap.get(slot.faculty_id)?.name : null;
  const roomName = slot.room_name ?? (slot.room_id ? roomMap.get(slot.room_id)?.name : null);
  const sessionLabel = slot.session_type ? (SESSION_SHORT[slot.session_type] ?? slot.session_type) : null;

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col gap-1 rounded border-l-4 p-2 transition-colors",
        c.bg,
        c.border,
        c.hover,
      )}
    >
      <div className="flex items-start justify-between">
        <span className={cn("truncate text-xs font-bold uppercase tracking-wide", c.text)}>
          {deptName ?? slot.subject ?? "\u2014"}
        </span>
        {sessionLabel && (
          <span
            className={cn(
              "shrink-0 rounded border px-1.5 py-0.5 text-[10px]",
              c.badgeBg,
              c.badgeText,
              c.badgeBorder,
            )}
          >
            {sessionLabel}
          </span>
        )}
      </div>
      {slot.subject && deptName && (
        <p className="truncate text-xs font-medium text-white">{slot.subject}</p>
      )}
      <div className="mt-auto flex items-center justify-between">
        {facultyName && (
          <span className="flex items-center gap-1 truncate text-[10px] text-gray-400">
            <User className="h-2.5 w-2.5 shrink-0" /> {facultyName}
          </span>
        )}
        {roomName && (
          <span className="truncate text-[10px] text-gray-400">{roomName}</span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create / Edit Dialog
// ---------------------------------------------------------------------------

function SlotDialog({
  dialog,
  academicYear,
  phase,
  batchId,
  departments,
  facultyList,
  rooms,
  onClose,
  onError,
}: {
  dialog:
    | { mode: "create"; dayOfWeek: number; startTime: string }
    | { mode: "edit"; slot: TimetableSlotResponse };
  academicYear: string;
  phase: string;
  batchId: string | undefined;
  departments: DepartmentResponse[];
  facultyList: FacultyResponse[];
  rooms: InfrastructureResponse[];
  onClose: () => void;
  onError: (msg: string) => void;
}) {
  const isEdit = dialog.mode === "edit";
  const existing = isEdit ? dialog.slot : null;

  const [subject, setSubject] = useState(existing?.subject ?? "");
  const [departmentId, setDepartmentId] = useState(existing?.department_id ?? "");
  const [facultyId, setFacultyId] = useState(existing?.faculty_id ?? "");
  const [roomId, setRoomId] = useState(existing?.room_id ?? "");
  const [sessionType, setSessionType] = useState(existing?.session_type ?? "lecture");
  const [startTime, setStartTime] = useState(
    isEdit ? existing!.start_time : dialog.startTime,
  );
  const [endTime, setEndTime] = useState(
    isEdit
      ? existing!.end_time
      : `${String(parseInt(dialog.startTime) + 1).padStart(2, "0")}:00`,
  );
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const createMut = useCreateTimetableSlot();
  const updateMut = useUpdateTimetableSlot();
  const deleteMut = useDeleteTimetableSlot();

  const handleSave = async () => {
    setSaving(true);
    onError("");
    try {
      if (isEdit && existing) {
        const data: TimetableSlotUpdate = {
          subject: subject || null,
          faculty_id: facultyId || null,
          session_type: sessionType || null,
          room_id: roomId || null,
          room_name: roomId ? rooms.find((r) => r.id === roomId)?.name ?? null : null,
        };
        await updateMut.mutateAsync({ id: existing.id, data });
      } else {
        const dayOfWeek = dialog.mode === "create" ? dialog.dayOfWeek : existing!.day_of_week;
        const data: TimetableSlotCreate = {
          academic_year: academicYear,
          phase,
          batch_id: batchId ?? null,
          day_of_week: dayOfWeek,
          start_time: startTime,
          end_time: endTime,
          subject: subject || null,
          department_id: departmentId || null,
          faculty_id: facultyId || null,
          session_type: sessionType || null,
          room_id: roomId || null,
          room_name: roomId ? rooms.find((r) => r.id === roomId)?.name ?? null : null,
        };
        await createMut.mutateAsync(data);
      }
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to save slot";
      // 409 conflict detection
      if (msg.includes("409") || msg.toLowerCase().includes("conflict")) {
        onError(`Conflict: ${msg}. The room or faculty is already booked at this time.`);
      } else {
        onError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    setSaving(true);
    try {
      await deleteMut.mutateAsync(existing.id);
      onClose();
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : "Failed to delete slot");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl border border-dark-border bg-dark-surface p-6 shadow-xl">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">
            {isEdit ? "Edit Slot" : "New Timetable Slot"}
          </h2>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-[#262626]">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Context */}
        <div className="mb-4 flex flex-wrap gap-2 text-xs text-gray-400">
          <span className="rounded bg-[#262626] px-2 py-1">
            {isEdit ? DAY_NAMES[existing!.day_of_week] : DAY_NAMES[dialog.dayOfWeek]}
          </span>
          <span className="rounded bg-[#262626] px-2 py-1">{phase}</span>
          <span className="rounded bg-[#262626] px-2 py-1">{academicYear}</span>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-gray-400">Start Time</label>
              <select
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                disabled={isEdit}
                className="w-full rounded-lg border border-dark-border bg-[#262626] p-2 text-sm text-white disabled:opacity-50"
              >
                {TIME_SLOTS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">End Time</label>
              <select
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                disabled={isEdit}
                className="w-full rounded-lg border border-dark-border bg-[#262626] p-2 text-sm text-white disabled:opacity-50"
              >
                {TIME_SLOTS.filter((t) => t > startTime).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
                <option value="17:00">17:00</option>
              </select>
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="mb-1 block text-xs text-gray-400">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Upper Limb, CVS Dynamics"
              className="w-full rounded-lg border border-dark-border bg-[#262626] p-2 text-sm text-white placeholder:text-gray-600"
            />
          </div>

          {/* Department */}
          <div>
            <label className="mb-1 block text-xs text-gray-400">Department</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              disabled={isEdit}
              className="w-full rounded-lg border border-dark-border bg-[#262626] p-2 text-sm text-white disabled:opacity-50"
            >
              <option value="">\u2014 Select \u2014</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Faculty */}
          <div>
            <label className="mb-1 block text-xs text-gray-400">Faculty</label>
            <select
              value={facultyId}
              onChange={(e) => setFacultyId(e.target.value)}
              className="w-full rounded-lg border border-dark-border bg-[#262626] p-2 text-sm text-white"
            >
              <option value="">\u2014 Select \u2014</option>
              {facultyList
                .filter((f) => !departmentId || f.department_id === departmentId)
                .map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
            </select>
          </div>

          {/* Room */}
          <div>
            <label className="mb-1 block text-xs text-gray-400">Room</label>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full rounded-lg border border-dark-border bg-[#262626] p-2 text-sm text-white"
            >
              <option value="">\u2014 Select \u2014</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} {r.capacity ? `(${r.capacity} seats)` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Session Type */}
          <div>
            <label className="mb-1 block text-xs text-gray-400">Session Type</label>
            <select
              value={sessionType}
              onChange={(e) => setSessionType(e.target.value)}
              className="w-full rounded-lg border border-dark-border bg-[#262626] p-2 text-sm text-white"
            >
              {SESSION_TYPES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-between">
          {isEdit ? (
            <div>
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-400">Delete this slot?</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmDelete(false)}
                    className="h-7 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleDelete}
                    disabled={saving}
                    className="h-7 bg-red-600 text-xs hover:bg-red-700"
                  >
                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm"}
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmDelete(true)}
                  className="h-8 text-red-400 hover:text-red-300"
                >
                  <Trash2 className="mr-1 h-3 w-3" /> Delete
                </Button>
              )}
            </div>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : isEdit ? (
                <Pencil className="mr-2 h-4 w-4" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              {isEdit ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
