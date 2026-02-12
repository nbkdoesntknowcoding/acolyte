"use client";

import {
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Plus,
  SlidersHorizontal,
  Settings,
  Bell,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Download,
  Send,
  GripVertical,
  AlertTriangle,
  Hospital,
  User,
  UtensilsCrossed,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TimetableSession } from "@/types/admin";

// ---------------------------------------------------------------------------
// TODO: Replace with API call — GET /api/v1/admin/academics/timetable
// ---------------------------------------------------------------------------

const DAYS = [
  { name: "Monday", date: "Oct 16" },
  { name: "Tuesday", date: "Oct 17" },
  { name: "Wednesday", date: "Oct 18" },
  { name: "Thursday", date: "Oct 19" },
  { name: "Friday", date: "Oct 20" },
  { name: "Saturday", date: "Oct 21" },
];

const DEPT_COLORS: Record<string, {
  bg: string; border: string; text: string;
  badgeBg: string; badgeText: string; badgeBorder: string;
  hover: string;
}> = {
  anatomy:    { bg: "bg-blue-500/10",   border: "border-blue-500",   text: "text-blue-400",   badgeBg: "bg-blue-500/20",   badgeText: "text-blue-300",   badgeBorder: "border-blue-500/30",   hover: "hover:bg-blue-500/20" },
  physiology: { bg: "bg-purple-500/10",  border: "border-purple-500", text: "text-purple-400", badgeBg: "bg-purple-500/20", badgeText: "text-purple-300", badgeBorder: "border-purple-500/30", hover: "hover:bg-purple-500/20" },
  biochem:    { bg: "bg-orange-500/10",  border: "border-orange-500", text: "text-orange-400", badgeBg: "bg-orange-500/20", badgeText: "text-orange-300", badgeBorder: "border-orange-500/30", hover: "hover:bg-orange-500/20" },
  community:  { bg: "bg-pink-500/10",    border: "border-pink-500",   text: "text-pink-400",   badgeBg: "bg-pink-500/20",   badgeText: "text-pink-300",   badgeBorder: "border-pink-500/30",   hover: "hover:bg-pink-500/20" },
  microbio:   { bg: "bg-red-500/5",      border: "border-red-500",    text: "text-red-400",    badgeBg: "bg-red-500/20",    badgeText: "text-red-300",    badgeBorder: "border-red-500/30",    hover: "hover:bg-red-500/20" },
  pathology:  { bg: "bg-yellow-500/10",  border: "border-yellow-500", text: "text-yellow-400", badgeBg: "bg-yellow-500/20", badgeText: "text-yellow-300", badgeBorder: "border-yellow-500/30", hover: "hover:bg-yellow-500/20" },
  sports:     { bg: "bg-gray-700/30",    border: "border-gray-500",   text: "text-gray-400",   badgeBg: "bg-gray-600/20",   badgeText: "text-gray-300",   badgeBorder: "border-gray-500/30",   hover: "hover:bg-gray-700/50" },
};

// Row 1: 08:00
const ROW_0800: (TimetableSession | null)[] = [
  { department: "Anatomy", departmentShort: "Anatomy", topic: "Upper Limb", faculty: "Dr. R. Kumar", room: "LH-1", sessionType: "Lec", colorKey: "anatomy" },
  { department: "Physiology", departmentShort: "Physiology", topic: "CVS Dynamics", faculty: "Dr. A. Desai", room: "LH-1", sessionType: "Lec", colorKey: "physiology" },
  { department: "Biochemistry", departmentShort: "Biochem", topic: "Enzymes II", faculty: "Dr. S. Menon", room: "LH-1", sessionType: "Lec", colorKey: "biochem" },
  null,
  { department: "Anatomy", departmentShort: "Anatomy", topic: "Thorax Review", faculty: "All Faculty", room: "DH", sessionType: "SGD", colorKey: "anatomy" },
  { department: "Community Medicine", departmentShort: "Com. Med", topic: "Family Visit", faculty: "Dr. V. Rao", room: "RHTC", sessionType: "Field", colorKey: "community" },
];

// Row 3: 13:00
const ROW_1300: (TimetableSession | null)[] = [
  { department: "Physiology", departmentShort: "Physiology", topic: "Hematology Lab", faculty: "Dr. K. Nair", room: "Lab-2", sessionType: "Prac", colorKey: "physiology" },
  { department: "Anatomy", departmentShort: "Anatomy", topic: "Upper Limb", faculty: "Tutors", room: "DH", sessionType: "Dissec", colorKey: "anatomy" },
  { department: "Biochemistry", departmentShort: "Biochem", topic: "Urinalysis", faculty: "Dr. J. Doe", room: "Lab-1", sessionType: "Prac", colorKey: "biochem" },
  { department: "Physiology", departmentShort: "Physiology", topic: "Nerve Muscle", faculty: "Dr. S. Singh", room: "LH-2", sessionType: "Tut", colorKey: "physiology" },
  { department: "Anatomy", departmentShort: "Anatomy", topic: "Epithelium", faculty: "Dr. P. Raj", room: "Histo Lab", sessionType: "Hist", colorKey: "anatomy" },
  null,
];

// Row 4: 14:00
const ROW_1400: (TimetableSession | null)[] = [
  { department: "Microbiology", departmentShort: "Microbio", topic: "Sterilization", faculty: "Dr. S. Reddy", room: "LH-2", sessionType: "Prac", colorKey: "microbio", hasConflict: true, conflictMessage: "Room Conflict" },
  null,
  { department: "Pathology", departmentShort: "Pathology", topic: "Inflammation", faculty: "Dr. A. Jain", room: "Path Lab", sessionType: "Prac", colorKey: "pathology" },
  null,
  { department: "Sports", departmentShort: "Sports", topic: "Physical Ed.", faculty: "Coach", room: "Ground", sessionType: "Ext", colorKey: "sports" },
  null, // Saturday gray
];

const CLINICAL_BATCHES = ["Medicine: Batch A", "Surgery: Batch B", "OBG: Batch C"];

const UNASSIGNED = [
  { id: "u1", department: "Anatomy", colorKey: "anatomy", topic: "Lower Limb Intro", sessionType: "Lec" as const, duration: "1 Hour" },
  { id: "u2", department: "Pathology", colorKey: "pathology", topic: "Cell Injury II", sessionType: "Lec" as const, duration: "1 Hour" },
  { id: "u3", department: "Physiology", colorKey: "physiology", topic: "ECG Analysis", sessionType: "Prac" as const, duration: "2 Hours" },
];

const ROOMS = [
  { name: "Lecture Hall 1", isOccupied: true },
  { name: "Lecture Hall 2", isOccupied: true },
  { name: "Exam Hall", isOccupied: false },
  { name: "Demo Room A", isOccupied: false },
];

const FACULTY_LOAD = [
  { name: "Dr. Rajesh Kumar", department: "Anatomy", currentHours: 12, maxHours: 14, barColor: "bg-blue-500" },
  { name: "Dr. Anita Desai", department: "Physio", currentHours: 10, maxHours: 12, barColor: "bg-purple-500" },
  { name: "Dr. S. Reddy", department: "Micro", currentHours: 15, maxHours: 12, barColor: "bg-red-500" },
];

// ---------------------------------------------------------------------------

export default function TimetableManagementPage() {
  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-dark-border bg-dark-surface px-6">
          <div className="flex items-center gap-4">
            {/* Phase selector */}
            <select className="rounded-lg border border-dark-border bg-[#262626] p-2 text-sm text-white focus:border-emerald-500 focus:ring-emerald-500">
              <option>Phase I - MBBS</option>
              <option>Phase II - MBBS</option>
              <option>Phase III (Part 1)</option>
              <option>Phase III (Part 2)</option>
              <option>CRMI</option>
            </select>

            {/* Batch selector */}
            <select className="rounded-lg border border-dark-border bg-[#262626] p-2 text-sm text-white focus:border-emerald-500 focus:ring-emerald-500">
              <option>Batch A (2023)</option>
              <option>Batch B (2023)</option>
              <option>Batch C (2023)</option>
            </select>

            {/* Week navigation */}
            <div className="ml-4 flex items-center rounded-lg border border-dark-border bg-[#262626]">
              <button className="p-2 text-gray-400 hover:text-white">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="flex items-center gap-2 border-x border-dark-border px-3 text-sm font-medium text-white">
                <CalendarDays className="h-3 w-3 text-emerald-500" />
                Oct 16 - Oct 21, 2023
              </span>
              <button className="p-2 text-gray-400 hover:text-white">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-500">
              Current Week
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button className="text-gray-400 hover:text-white">
              <SlidersHorizontal className="h-5 w-5" />
            </button>
            <button className="text-gray-400 hover:text-white">
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Timetable Grid (scrollable) */}
        <div className="flex-1 overflow-auto p-6">
          <div className="min-w-[1000px] overflow-hidden rounded-lg border border-dark-border bg-dark-surface">
            {/* Day headers */}
            <div className="grid grid-cols-[60px_repeat(6,1fr)] border-b border-dark-border bg-[#262626]">
              <div className="border-r border-dark-border p-3 text-center text-xs font-semibold text-gray-500">
                TIME
              </div>
              {DAYS.map((d) => (
                <div
                  key={d.name}
                  className="border-r border-dark-border p-3 text-center last:border-r-0"
                >
                  <span className="text-sm font-semibold text-white">{d.name}</span>
                  <span className="block text-xs text-gray-500">{d.date}</span>
                </div>
              ))}
            </div>

            {/* 08:00 Row */}
            <TimeRow time="08:00" sessions={ROW_0800} />

            {/* 09:00–11:00 Clinical Postings Block */}
            <div className="grid min-h-[280px] grid-cols-[60px_repeat(6,1fr)] border-b border-dark-border">
              <div className="flex flex-col border-r border-dark-border">
                <div className="flex flex-1 items-center justify-center border-b border-dark-border p-2 text-center text-xs text-gray-500">
                  09:00
                </div>
                <div className="flex flex-1 items-center justify-center border-b border-dark-border p-2 text-center text-xs text-gray-500">
                  10:00
                </div>
                <div className="flex flex-1 items-center justify-center p-2 text-center text-xs text-gray-500">
                  11:00
                </div>
              </div>
              <div className="col-span-6 p-2">
                <div className="flex h-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-teal-500/30 bg-teal-500/10 p-3 transition-all hover:bg-teal-500/20">
                  <div className="flex items-center gap-2">
                    <Hospital className="h-8 w-8 text-teal-400" />
                    <div className="text-center">
                      <h3 className="text-lg font-bold text-white">Clinical Postings</h3>
                      <p className="text-sm text-teal-400">09:00 AM - 12:00 PM</p>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-4">
                    {CLINICAL_BATCHES.map((b) => (
                      <span
                        key={b}
                        className="rounded border border-dark-border bg-dark-surface px-2 py-1 text-xs text-gray-300"
                      >
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 12:00 Lunch Break */}
            <div className="grid min-h-[60px] grid-cols-[60px_repeat(6,1fr)] border-b border-dark-border bg-[#262626]/30">
              <div className="flex flex-col justify-center border-r border-dark-border p-2 text-center text-xs text-gray-500">
                12:00
              </div>
              <div className="col-span-6 flex items-center justify-center text-sm font-medium uppercase tracking-widest text-gray-500 opacity-50">
                <UtensilsCrossed className="mr-2 h-4 w-4" /> Lunch Break
              </div>
            </div>

            {/* 13:00 Row */}
            <TimeRow time="13:00" sessions={ROW_1300} />

            {/* 14:00 Row */}
            <TimeRow time="14:00" sessions={ROW_1400} isSaturdayGray />

            {/* 15:00 Row (empty) */}
            <div className="grid min-h-[100px] grid-cols-[60px_repeat(6,1fr)] border-b border-dark-border">
              <div className="flex flex-col justify-center border-r border-dark-border p-2 text-center text-xs text-gray-500">
                15:00
              </div>
              {DAYS.map((d, i) => (
                <div
                  key={d.name}
                  className={cn(
                    "border-r border-dark-border p-1 last:border-r-0",
                    i === 5 && "bg-[#262626]/10",
                  )}
                />
              ))}
            </div>
          </div>
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
              <RefreshCw className="mr-2 h-4 w-4" /> Sync
            </Button>
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
      <aside className="flex w-[300px] shrink-0 flex-col overflow-hidden border-l border-dark-border bg-[#0A0A0A]">
        <div className="flex-1 space-y-6 overflow-y-auto p-4">
          {/* Unassigned Slots */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                Unassigned Slots
              </h3>
              <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
                {UNASSIGNED.length}
              </span>
            </div>
            <div className="space-y-2">
              {UNASSIGNED.map((slot) => {
                const c = DEPT_COLORS[slot.colorKey];
                return (
                  <div
                    key={slot.id}
                    className="group cursor-grab rounded-lg border border-dark-border bg-dark-surface p-3 transition-colors hover:border-emerald-500/50 active:cursor-grabbing"
                  >
                    <div className="mb-1 flex items-start justify-between">
                      <span className={cn("text-xs font-bold", c?.text)}>
                        {slot.department}
                      </span>
                      <GripVertical className="h-4 w-4 text-gray-600 transition-colors group-hover:text-emerald-500" />
                    </div>
                    <p className="text-sm font-medium text-white">{slot.topic}</p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                      <span
                        className={cn(
                          "rounded border px-1.5 py-0.5",
                          c?.badgeBg,
                          c?.badgeText,
                          c?.badgeBorder,
                        )}
                      >
                        {slot.sessionType}
                      </span>
                      <span>{slot.duration}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Room Availability */}
          <div>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-white">
              Room Availability{" "}
              <span className="ml-1 text-xs font-normal normal-case text-gray-500">
                (Now)
              </span>
            </h3>
            <div className="space-y-2">
              {ROOMS.map((room) => (
                <div
                  key={room.name}
                  className="flex items-center justify-between rounded border border-dark-border bg-dark-surface p-2"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "h-2 w-2 rounded-full",
                        room.isOccupied
                          ? "animate-pulse bg-red-500"
                          : "bg-emerald-500",
                      )}
                    />
                    <span className="text-sm text-gray-300">{room.name}</span>
                  </div>
                  <span
                    className={cn(
                      "text-xs",
                      room.isOccupied ? "text-red-400" : "text-emerald-400",
                    )}
                  >
                    {room.isOccupied ? "Occupied" : "Available"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Faculty Load */}
          <div>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-white">
              Faculty Load{" "}
              <span className="ml-1 text-xs font-normal normal-case text-gray-500">
                (Weekly)
              </span>
            </h3>
            <div className="space-y-4">
              {FACULTY_LOAD.map((f) => {
                const isOverloaded = f.currentHours > f.maxHours;
                const pct = Math.min(
                  Math.round((f.currentHours / f.maxHours) * 100),
                  100,
                );
                return (
                  <div key={f.name}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-gray-400">
                        {f.name} ({f.department})
                      </span>
                      <span
                        className={cn(
                          "font-medium",
                          isOverloaded ? "text-red-400" : "text-white",
                        )}
                      >
                        {f.currentHours}/{f.maxHours} hrs
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full border border-dark-border bg-dark-surface">
                      <div
                        className={cn("h-1.5 rounded-full", f.barColor)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {isOverloaded && (
                      <p className="mt-0.5 text-right text-[10px] text-red-500">
                        Overloaded
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Time Row — renders a single time slot row with 6 day cells
// ---------------------------------------------------------------------------

function TimeRow({
  time,
  sessions,
  isSaturdayGray,
}: {
  time: string;
  sessions: (TimetableSession | null)[];
  isSaturdayGray?: boolean;
}) {
  return (
    <div className="grid min-h-[110px] grid-cols-[60px_repeat(6,1fr)] border-b border-dark-border">
      <div className="flex flex-col justify-center border-r border-dark-border p-2 text-center text-xs text-gray-500">
        {time}
      </div>
      {sessions.map((session, i) => (
        <div
          key={i}
          className={cn(
            "border-r border-dark-border p-1 last:border-r-0",
            isSaturdayGray && i === 5 && !session && "bg-[#262626]/10",
          )}
        >
          {session ? (
            <SessionCard session={session} />
          ) : !isSaturdayGray || i !== 5 ? (
            <EmptySlot />
          ) : null}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Session Card — a single timetable event
// ---------------------------------------------------------------------------

function SessionCard({ session }: { session: TimetableSession }) {
  const c = DEPT_COLORS[session.colorKey];

  if (session.hasConflict) {
    return (
      <div className="relative h-full w-full">
        <div className="flex h-full w-full cursor-pointer flex-col gap-1 rounded border-2 border-dashed border-red-500 bg-red-500/5 p-2">
          <div className="flex items-start justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-red-400">
              {session.departmentShort}
            </span>
            <AlertTriangle className="h-4 w-4 animate-pulse text-red-500" />
          </div>
          <p className="text-xs font-medium text-white">{session.topic}</p>
          <div className="mt-auto flex items-center justify-between">
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <User className="h-2.5 w-2.5" /> {session.faculty}
            </span>
            <span className="text-[10px] font-bold text-red-400">
              {session.room}
            </span>
          </div>
        </div>
        <div className="absolute -right-2 -top-2 z-10 rounded border border-red-400 bg-red-600 px-2 py-0.5 text-[10px] text-white shadow-lg">
          {session.conflictMessage}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-full w-full cursor-pointer flex-col gap-1 rounded border-l-4 p-2 transition-colors",
        c?.bg,
        c?.border,
        c?.hover,
      )}
    >
      <div className="flex items-start justify-between">
        <span
          className={cn("text-xs font-bold uppercase tracking-wide", c?.text)}
        >
          {session.departmentShort}
        </span>
        <span
          className={cn(
            "rounded border px-1.5 py-0.5 text-[10px]",
            c?.badgeBg,
            c?.badgeText,
            c?.badgeBorder,
          )}
        >
          {session.sessionType}
        </span>
      </div>
      <p className="text-xs font-medium text-white">{session.topic}</p>
      <div className="mt-auto flex items-center justify-between">
        <span className="flex items-center gap-1 text-[10px] text-gray-400">
          <User className="h-2.5 w-2.5" /> {session.faculty}
        </span>
        <span className="text-[10px] text-gray-400">{session.room}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty Slot placeholder
// ---------------------------------------------------------------------------

function EmptySlot() {
  return (
    <div className="group flex h-full w-full cursor-pointer items-center justify-center rounded border border-dashed border-gray-700 text-gray-600 transition-colors hover:border-gray-500 hover:text-gray-400">
      <Plus className="h-5 w-5 transition-transform group-hover:scale-110" />
    </div>
  );
}
