"use client";

import {
  Download,
  SlidersHorizontal,
  Sparkles,
  ShieldCheck,
  GanttChart,
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

// ---------------------------------------------------------------------------
// TODO: Replace with API call — GET /api/v1/admin/academics/rotations
// ---------------------------------------------------------------------------

const ROTATION_COLORS: Record<
  string,
  { bg: string; border: string; text: string; hoverBg: string; subText: string }
> = {
  medicine:   { bg: "bg-blue-500/20",   border: "border-blue-500/40",   text: "text-blue-200",   hoverBg: "hover:bg-blue-500/30",   subText: "text-blue-300/70" },
  surgery:    { bg: "bg-purple-500/20",  border: "border-purple-500/40", text: "text-purple-200", hoverBg: "hover:bg-purple-500/30", subText: "text-purple-300/70" },
  obgyn:      { bg: "bg-pink-500/20",    border: "border-pink-500/40",   text: "text-pink-200",   hoverBg: "hover:bg-pink-500/30",   subText: "text-pink-300/70" },
  community:  { bg: "bg-orange-500/20",  border: "border-orange-500/40", text: "text-orange-200", hoverBg: "hover:bg-orange-500/30", subText: "text-orange-300/70" },
};

const LEGEND = [
  { label: "Medicine", color: "bg-blue-500/80" },
  { label: "Surgery", color: "bg-purple-500/80" },
  { label: "OB-GYN", color: "bg-pink-500/80" },
  { label: "Community Med", color: "bg-orange-500/80" },
];

const WEEKS = Array.from({ length: 12 }, (_, i) => `Wk ${i + 1}`);

const GROUPS = [
  {
    name: "Group A",
    studentCount: 42,
    blocks: [
      { department: "General Medicine", supervisor: "Dr. A. Sharma", colorKey: "medicine", spanWeeks: 4 },
      { department: "General Surgery", supervisor: "Dr. P. Kumar", colorKey: "surgery", spanWeeks: 4 },
      { department: "OB-GYN", supervisor: "Dr. R. Gupta", colorKey: "obgyn", spanWeeks: 4 },
    ],
  },
  {
    name: "Group B",
    studentCount: 40,
    blocks: [
      { department: "General Surgery", supervisor: "Dr. P. Kumar", colorKey: "surgery", spanWeeks: 4 },
      { department: "OB-GYN", supervisor: "Dr. R. Gupta", colorKey: "obgyn", spanWeeks: 4 },
      { department: "Community Med", supervisor: "Dr. S. Reddy", colorKey: "community", spanWeeks: 4 },
    ],
  },
  {
    name: "Group C",
    studentCount: 41,
    blocks: [
      { department: "OB-GYN", supervisor: "Dr. R. Gupta", colorKey: "obgyn", spanWeeks: 4 },
      { department: "Community Med", supervisor: "Dr. S. Reddy", colorKey: "community", spanWeeks: 4 },
      { department: "General Medicine", supervisor: "Dr. A. Sharma", colorKey: "medicine", spanWeeks: 4 },
    ],
  },
  {
    name: "Group D",
    studentCount: 39,
    blocks: [
      { department: "Community Med", supervisor: "Dr. S. Reddy", colorKey: "community", spanWeeks: 4 },
      { department: "General Medicine", supervisor: "Dr. A. Sharma", colorKey: "medicine", spanWeeks: 4 },
      { department: "General Surgery", supervisor: "Dr. P. Kumar", colorKey: "surgery", spanWeeks: 4 },
    ],
  },
];

const STATUS_ROWS = [
  { group: "Group A", department: "General Medicine", deptColorClass: "text-blue-400", supervisor: "Dr. A. Sharma", dates: "Aug 01 - Aug 28", currentHours: 96, totalHours: 120, pct: 80, status: "on_track" as const },
  { group: "Group B", department: "General Surgery", deptColorClass: "text-purple-400", supervisor: "Dr. P. Kumar", dates: "Aug 01 - Aug 28", currentHours: 110, totalHours: 120, pct: 91, status: "on_track" as const },
  { group: "Group C", department: "OB-GYN", deptColorClass: "text-pink-400", supervisor: "Dr. R. Gupta", dates: "Aug 01 - Aug 28", currentHours: 75, totalHours: 120, pct: 62, status: "lagging" as const },
  { group: "Group D", department: "Community Med", deptColorClass: "text-orange-400", supervisor: "Dr. S. Reddy", dates: "Aug 01 - Aug 28", currentHours: 100, totalHours: 120, pct: 83, status: "on_track" as const },
];

const STATUS_BADGE: Record<string, { label: string; classes: string }> = {
  on_track: { label: "On Track", classes: "bg-green-500/10 text-green-400 border-green-500/20" },
  lagging:  { label: "Lagging",  classes: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  behind:   { label: "Behind",   classes: "bg-red-500/10 text-red-400 border-red-500/20" },
};

const CONSTRAINTS = [
  { label: "NMC Minimum Hours", description: "Enforce mandated hours", enabled: true },
  { label: "Faculty Availability", description: "Check roster conflicts", enabled: true },
  { label: "Overlap Prevention", description: "Avoid double booking", enabled: true },
  { label: "Holiday Exclusion", description: "Skip public holidays", enabled: false },
];

const COMPLIANCE = [
  { department: "General Medicine", statusLabel: "100%", statusClasses: "text-emerald-400 bg-emerald-500/10", borderColor: "border-emerald-500", note: "4 Weeks / 120 Hours allocated" },
  { department: "General Surgery", statusLabel: "100%", statusClasses: "text-emerald-400 bg-emerald-500/10", borderColor: "border-emerald-500", note: "4 Weeks / 120 Hours allocated" },
  { department: "Pediatrics", statusLabel: "Warning", statusClasses: "text-yellow-400 bg-yellow-500/10", borderColor: "border-yellow-500", note: "Faculty shortage detected in Wk 7" },
];

// ---------------------------------------------------------------------------

export default function ClinicalRotationsPage() {
  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="shrink-0 space-y-4 border-b border-dark-border bg-dark-surface px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <h1 className="text-2xl font-bold text-white">
                Clinical Rotations — Phase II
              </h1>
              <span className="text-sm text-gray-500">Batch 2024</span>
            </div>
            <div className="flex items-center gap-3">
              <select className="rounded-lg border border-dark-border bg-[#262626] p-2 text-sm text-white focus:border-emerald-500 focus:ring-emerald-500">
                <option>Phase II - MBBS</option>
                <option>Phase III (Part 1)</option>
                <option>Phase III (Part 2)</option>
              </select>
              <select className="rounded-lg border border-dark-border bg-[#262626] p-2 text-sm text-white focus:border-emerald-500 focus:ring-emerald-500">
                <option>Batch 2024</option>
                <option>Batch 2023</option>
                <option>Batch 2022</option>
              </select>
              <button className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-500 transition-colors hover:bg-emerald-500/20">
                <Download className="h-4 w-4" /> Export
              </button>
            </div>
          </div>
          {/* Tabs */}
          <div className="flex items-center gap-6 border-b border-dark-border/50">
            <button className="border-b-2 border-emerald-500 px-1 pb-3 text-sm font-medium text-emerald-500">
              MBBS Postings
            </button>
            <button className="border-b-2 border-transparent px-1 pb-3 text-sm font-medium text-gray-400 transition-colors hover:border-gray-700 hover:text-white">
              Internship (CRMI)
            </button>
            <button className="border-b-2 border-transparent px-1 pb-3 text-sm font-medium text-gray-400 transition-colors hover:border-gray-700 hover:text-white">
              Electives
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 space-y-6 overflow-auto p-6">
          {/* Rotation Matrix */}
          <div className="overflow-hidden rounded-xl border border-dark-border bg-dark-surface shadow-sm">
            <div className="flex items-center justify-between border-b border-dark-border p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-300">
                <GanttChart className="h-5 w-5" /> Rotation Matrix
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

            <div className="overflow-x-auto">
              <div className="min-w-[1000px] p-4">
                {/* Week headers */}
                <div
                  className="mb-2 grid items-center"
                  style={{ gridTemplateColumns: "120px repeat(12, 1fr)" }}
                >
                  <div className="py-2 text-xs font-bold uppercase text-gray-500">
                    Group
                  </div>
                  {WEEKS.map((w) => (
                    <div
                      key={w}
                      className="border-l border-dark-border py-2 text-center text-xs text-gray-500"
                    >
                      {w}
                    </div>
                  ))}
                </div>

                {/* Group rows */}
                {GROUPS.map((group) => (
                  <div
                    key={group.name}
                    className="mb-3 grid items-center"
                    style={{ gridTemplateColumns: "120px repeat(12, 1fr)" }}
                  >
                    <div className="flex flex-col py-2">
                      <span className="text-sm font-medium text-white">
                        {group.name}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {group.studentCount} Students
                      </span>
                    </div>
                    {group.blocks.map((block, bi) => {
                      const c = ROTATION_COLORS[block.colorKey];
                      return (
                        <div
                          key={bi}
                          className={cn(
                            "group relative mx-1 h-12 cursor-pointer rounded-lg border transition-colors",
                            c?.bg,
                            c?.border,
                            c?.hoverBg,
                          )}
                          style={{
                            gridColumn: `span ${block.spanWeeks}`,
                          }}
                        >
                          <div className="absolute inset-0 flex flex-col items-center justify-center p-1">
                            <span
                              className={cn("text-xs font-bold", c?.text)}
                            >
                              {block.department}
                            </span>
                            <span
                              className={cn(
                                "w-full truncate text-center text-[10px] group-hover:text-opacity-100",
                                c?.subText,
                              )}
                            >
                              {block.supervisor}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Department Rotation Status */}
          <div>
            <h3 className="mb-3 text-sm font-bold text-white">
              Department Rotation Status
            </h3>
            <div className="overflow-hidden rounded-lg border border-dark-border bg-dark-surface">
              <Table>
                <TableHeader>
                  <TableRow className="border-dark-border bg-[#262626]">
                    <TableHead className="text-gray-500">Group</TableHead>
                    <TableHead className="text-gray-500">Current Dept</TableHead>
                    <TableHead className="text-gray-500">Supervisor</TableHead>
                    <TableHead className="text-gray-500">Dates</TableHead>
                    <TableHead className="text-gray-500">
                      Progress (Hours)
                    </TableHead>
                    <TableHead className="text-right text-gray-500">
                      Status
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {STATUS_ROWS.map((row) => {
                    const badge = STATUS_BADGE[row.status];
                    const barColor =
                      row.status === "lagging"
                        ? "bg-yellow-500"
                        : "bg-emerald-500";
                    const pctColor =
                      row.status === "lagging"
                        ? "text-yellow-500"
                        : "text-emerald-500";
                    return (
                      <TableRow
                        key={row.group}
                        className="border-dark-border transition-colors hover:bg-[#262626]/50"
                      >
                        <TableCell className="font-medium text-white">
                          {row.group}
                        </TableCell>
                        <TableCell className={row.deptColorClass}>
                          {row.department}
                        </TableCell>
                        <TableCell>{row.supervisor}</TableCell>
                        <TableCell className="text-xs">{row.dates}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="flex justify-between text-[10px]">
                              <span className="text-gray-400">
                                {row.currentHours}/{row.totalHours} hrs
                              </span>
                              <span className={pctColor}>{row.pct}%</span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-700">
                              <div
                                className={cn("h-full", barColor)}
                                style={{ width: `${row.pct}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={cn(
                              "inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium",
                              badge?.classes,
                            )}
                          >
                            {badge?.label}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <aside className="flex w-[320px] shrink-0 flex-col overflow-hidden border-l border-dark-border bg-[#0A0A0A]">
        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {/* Action Buttons */}
          <div className="space-y-3">
            <Button className="w-full py-3 text-sm font-semibold shadow-lg shadow-emerald-900/20">
              <Sparkles className="mr-2 h-5 w-5" /> AI Generate Schedule
            </Button>
            <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-[#262626] py-3 text-sm font-medium text-emerald-400 transition-colors hover:bg-dark-surface">
              <ShieldCheck className="h-5 w-5" /> Validate Against NMC
            </button>
          </div>

          {/* Constraints */}
          <div className="rounded-lg border border-dark-border bg-dark-surface p-4 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
              <SlidersHorizontal className="h-5 w-5 text-gray-400" />{" "}
              Constraints
            </h3>
            <div className="space-y-4">
              {CONSTRAINTS.map((c, i) => (
                <div
                  key={c.label}
                  className={cn(
                    "flex items-center justify-between py-1",
                    i > 0 && "border-t border-dark-border pt-3",
                  )}
                >
                  <div className="flex flex-col">
                    <span
                      className={cn(
                        "text-xs font-medium",
                        c.enabled ? "text-white" : "text-gray-400",
                      )}
                    >
                      {c.label}
                    </span>
                    <span
                      className={cn(
                        "text-[10px]",
                        c.enabled ? "text-gray-500" : "text-gray-600",
                      )}
                    >
                      {c.description}
                    </span>
                  </div>
                  {c.enabled ? (
                    <button className="relative h-5 w-10 rounded-full border border-emerald-500/40 bg-emerald-500/20">
                      <span className="absolute right-1 top-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 shadow-sm transition-transform" />
                    </button>
                  ) : (
                    <button className="relative h-5 w-10 rounded-full border border-dark-border bg-[#262626]">
                      <span className="absolute left-1 top-0.5 h-3.5 w-3.5 rounded-full bg-gray-500 transition-transform" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Compliance Status */}
          <div>
            <h3 className="mb-4 border-b border-dark-border pb-2 text-sm font-bold uppercase tracking-wider text-white">
              Compliance Status
            </h3>
            <div className="space-y-4">
              {COMPLIANCE.map((item) => (
                <div
                  key={item.department}
                  className={cn(
                    "relative border-l-2 pl-4",
                    item.borderColor,
                  )}
                >
                  <div className="flex items-start justify-between">
                    <h4 className="text-sm font-medium text-white">
                      {item.department}
                    </h4>
                    <span
                      className={cn(
                        "rounded px-1.5 text-xs",
                        item.statusClasses,
                      )}
                    >
                      {item.statusLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{item.note}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Summary Stats */}
          <div className="rounded-lg border border-dark-border bg-[#262626]/50 p-3">
            <div className="grid grid-cols-2 gap-4 divide-x divide-dark-border text-center">
              <div>
                <div className="text-2xl font-bold text-white">4</div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500">
                  Active Groups
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">162</div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500">
                  Total Students
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
