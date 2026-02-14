"use client";

import { useState, useMemo } from "react";
import {
  Check,
  Download,
  GanttChart,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
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
import {
  useRotations,
  useRotationMatrix,
  useGenerateRotations,
  useValidateNMCRotations,
} from "@/lib/hooks/admin/use-rotations";
import { useBatches } from "@/lib/hooks/admin/use-batches";
import { useDepartments } from "@/lib/hooks/admin/use-departments";
import { useFaculty } from "@/lib/hooks/admin/use-faculty";
import type {
  ClinicalRotationResponse,
  NMCValidationResponse,
} from "@/types/admin-api";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PHASES = ["Phase II", "Phase III Part 1", "Phase III Part 2"];

const DEPT_COLORS = [
  { bg: "bg-blue-500/20", border: "border-blue-500/40", text: "text-blue-200", hoverBg: "hover:bg-blue-500/30", subText: "text-blue-300/70", legend: "bg-blue-500/80", label: "text-blue-400" },
  { bg: "bg-purple-500/20", border: "border-purple-500/40", text: "text-purple-200", hoverBg: "hover:bg-purple-500/30", subText: "text-purple-300/70", legend: "bg-purple-500/80", label: "text-purple-400" },
  { bg: "bg-pink-500/20", border: "border-pink-500/40", text: "text-pink-200", hoverBg: "hover:bg-pink-500/30", subText: "text-pink-300/70", legend: "bg-pink-500/80", label: "text-pink-400" },
  { bg: "bg-orange-500/20", border: "border-orange-500/40", text: "text-orange-200", hoverBg: "hover:bg-orange-500/30", subText: "text-orange-300/70", legend: "bg-orange-500/80", label: "text-orange-400" },
  { bg: "bg-teal-500/20", border: "border-teal-500/40", text: "text-teal-200", hoverBg: "hover:bg-teal-500/30", subText: "text-teal-300/70", legend: "bg-teal-500/80", label: "text-teal-400" },
  { bg: "bg-amber-500/20", border: "border-amber-500/40", text: "text-amber-200", hoverBg: "hover:bg-amber-500/30", subText: "text-amber-300/70", legend: "bg-amber-500/80", label: "text-amber-400" },
  { bg: "bg-indigo-500/20", border: "border-indigo-500/40", text: "text-indigo-200", hoverBg: "hover:bg-indigo-500/30", subText: "text-indigo-300/70", legend: "bg-indigo-500/80", label: "text-indigo-400" },
  { bg: "bg-cyan-500/20", border: "border-cyan-500/40", text: "text-cyan-200", hoverBg: "hover:bg-cyan-500/30", subText: "text-cyan-300/70", legend: "bg-cyan-500/80", label: "text-cyan-400" },
  { bg: "bg-rose-500/20", border: "border-rose-500/40", text: "text-rose-200", hoverBg: "hover:bg-rose-500/30", subText: "text-rose-300/70", legend: "bg-rose-500/80", label: "text-rose-400" },
  { bg: "bg-lime-500/20", border: "border-lime-500/40", text: "text-lime-200", hoverBg: "hover:bg-lime-500/30", subText: "text-lime-300/70", legend: "bg-lime-500/80", label: "text-lime-400" },
];

function deptColorByHash(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  return DEPT_COLORS[Math.abs(hash) % DEPT_COLORS.length];
}

const STATUS_BADGE: Record<string, { label: string; classes: string }> = {
  scheduled: { label: "Scheduled", classes: "bg-gray-500/10 text-gray-400 border-gray-500/20" },
  active:    { label: "Active",    classes: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  completed: { label: "Completed", classes: "bg-green-500/10 text-green-400 border-green-500/20" },
  assessed:  { label: "Assessed",  classes: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
};

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

const TABS = [
  { key: "mbbs" as const, label: "MBBS Postings" },
  { key: "crmi" as const, label: "Internship (CRMI)" },
  { key: "electives" as const, label: "Electives" },
];

const CONSTRAINT_DEFS = [
  { key: "nmcHours", label: "NMC Minimum Hours", desc: "Enforce mandated hours" },
  { key: "facultyAvail", label: "Faculty Availability", desc: "Check roster conflicts" },
  { key: "overlapPrev", label: "Overlap Prevention", desc: "Avoid double booking" },
  { key: "holidayExcl", label: "Holiday Exclusion", desc: "Skip public holidays" },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface GanttGroup {
  name: string;
  studentCount: number;
  rotations: ClinicalRotationResponse[];
}

function buildGanttGroups(
  studentRotations: Record<string, ClinicalRotationResponse[]>,
) {
  const groupMap = new Map<
    string,
    { students: Set<string>; rotations: ClinicalRotationResponse[] }
  >();

  for (const [studentId, rots] of Object.entries(studentRotations)) {
    for (const rot of rots) {
      const group = rot.rotation_group ?? "Unassigned";
      if (!groupMap.has(group)) {
        groupMap.set(group, { students: new Set(), rotations: [] });
      }
      const g = groupMap.get(group)!;
      g.students.add(studentId);
      // Deduplicate by dept + dates
      if (
        !g.rotations.some(
          (r) =>
            r.department_id === rot.department_id &&
            r.start_date === rot.start_date &&
            r.end_date === rot.end_date,
        )
      ) {
        g.rotations.push(rot);
      }
    }
  }

  return Array.from(groupMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([name, data]): GanttGroup => ({
        name,
        studentCount: data.students.size,
        rotations: data.rotations.sort((a, b) =>
          a.start_date.localeCompare(b.start_date),
        ),
      }),
    );
}

function fmtShortDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", {
    month: "short",
    day: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ClinicalRotationsPage() {
  const [phase, setPhase] = useState("Phase II");
  const [batchId, setBatchId] = useState("");
  const [tab, setTab] = useState<"mbbs" | "crmi" | "electives">("mbbs");
  const [banner, setBanner] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);
  const [validationResult, setValidationResult] =
    useState<NMCValidationResponse | null>(null);
  const [constraints, setConstraints] = useState({
    nmcHours: true,
    facultyAvail: true,
    overlapPrev: true,
    holidayExcl: false,
  });

  // -- Data -----------------------------------------------------------------

  const isCrmi = tab === "crmi";

  const { data: matrixData, isLoading: matrixLoading } = useRotationMatrix({
    phase,
    batch_id: batchId || undefined,
  });

  const { data: rotationsData } = useRotations({
    phase,
    batch_id: batchId || undefined,
    is_crmi: isCrmi || undefined,
    page_size: 200,
  });

  const { data: batchesData } = useBatches({ page_size: 100 });
  const { data: deptsData } = useDepartments({ page_size: 100 });
  const { data: facultyData } = useFaculty({ page_size: 500 });

  const generate = useGenerateRotations();
  const validate = useValidateNMCRotations();

  // -- Lookup maps ----------------------------------------------------------

  const deptMap = useMemo(() => {
    const m = new Map<string, string>();
    deptsData?.data?.forEach((d) => m.set(d.id, d.name));
    return m;
  }, [deptsData]);

  const facultyMap = useMemo(() => {
    const m = new Map<string, string>();
    facultyData?.data?.forEach((f) => m.set(f.id, f.name));
    return m;
  }, [facultyData]);

  // -- Gantt data -----------------------------------------------------------

  const { groups, weekLabels, minDate, totalWeeks } = useMemo(() => {
    if (!matrixData?.student_rotations) {
      return { groups: [] as GanttGroup[], weekLabels: [] as string[], minDate: new Date(), totalWeeks: 0 };
    }

    const allRots = Object.values(matrixData.student_rotations).flat();
    if (allRots.length === 0) {
      return { groups: [] as GanttGroup[], weekLabels: [] as string[], minDate: new Date(), totalWeeks: 0 };
    }

    const dates = allRots.flatMap((r) => [
      new Date(r.start_date).getTime(),
      new Date(r.end_date).getTime(),
    ]);
    const minD = new Date(Math.min(...dates));
    const maxD = new Date(Math.max(...dates));
    const weeks = Math.max(1, Math.ceil((maxD.getTime() - minD.getTime()) / MS_PER_WEEK));
    const labels = Array.from({ length: weeks }, (_, i) => `Wk ${i + 1}`);
    const ganttGroups = buildGanttGroups(matrixData.student_rotations);

    return { groups: ganttGroups, weekLabels: labels, minDate: minD, totalWeeks: weeks };
  }, [matrixData]);

  // -- Status rows ----------------------------------------------------------

  const statusRows = useMemo(() => {
    if (!rotationsData?.data) return [];

    const groupStatusMap = new Map<
      string,
      {
        group: string;
        deptId: string;
        supervisorId: string | null;
        startDate: string;
        endDate: string;
        completedHours: number;
        requiredHours: number;
        status: string;
      }
    >();

    const priority = (s: string) =>
      s === "active" ? 0 : s === "scheduled" ? 1 : 2;

    for (const rot of rotationsData.data) {
      const group = rot.rotation_group ?? "Unassigned";
      const existing = groupStatusMap.get(group);
      if (!existing || priority(rot.status) < priority(existing.status)) {
        groupStatusMap.set(group, {
          group,
          deptId: rot.department_id,
          supervisorId: rot.supervisor_faculty_id,
          startDate: rot.start_date,
          endDate: rot.end_date,
          completedHours: rot.completed_hours,
          requiredHours: rot.required_hours ?? 0,
          status: rot.status,
        });
      }
    }

    return Array.from(groupStatusMap.values()).sort((a, b) =>
      a.group.localeCompare(b.group),
    );
  }, [rotationsData]);

  // -- Legend ---------------------------------------------------------------

  const legend = useMemo(() => {
    if (!matrixData?.student_rotations) return [];
    const depts = new Set<string>();
    for (const rots of Object.values(matrixData.student_rotations)) {
      for (const r of rots) depts.add(r.department_id);
    }
    return Array.from(depts).map((id) => ({
      id,
      name: deptMap.get(id) ?? id.slice(0, 8),
      color: deptColorByHash(id),
    }));
  }, [matrixData, deptMap]);

  // -- Handlers -------------------------------------------------------------

  async function handleGenerate() {
    setBanner(null);
    try {
      const result = await generate.mutateAsync({
        phase,
        batch_id: batchId || undefined,
      });
      setBanner({
        type: "success",
        msg: `Generated ${result.created_count} rotation(s).`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate schedule.";
      setBanner({ type: "error", msg });
    }
  }

  async function handleValidate() {
    setBanner(null);
    setValidationResult(null);
    try {
      const result = await validate.mutateAsync({
        phase,
        batch_id: batchId || undefined,
      });
      setValidationResult(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to validate.";
      setBanner({ type: "error", msg });
    }
  }

  // -- Render ---------------------------------------------------------------

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Banner */}
        {banner && (
          <div
            className={cn(
              "px-6 py-2 text-sm",
              banner.type === "success"
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-red-500/10 text-red-400",
            )}
          >
            {banner.msg}
            <button
              className="ml-4 underline"
              onClick={() => setBanner(null)}
            >
              dismiss
            </button>
          </div>
        )}

        {/* Toolbar */}
        <div className="shrink-0 space-y-4 border-b border-dark-border bg-dark-surface px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <h1 className="text-2xl font-bold text-white">
                Clinical Rotations — {phase}
              </h1>
              {batchId && batchesData?.data && (
                <span className="text-sm text-gray-500">
                  {batchesData.data.find((b) => b.id === batchId)?.name ?? ""}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <select
                value={phase}
                onChange={(e) => setPhase(e.target.value)}
                className="rounded-lg border border-dark-border bg-[#262626] p-2 text-sm text-white focus:border-emerald-500 focus:ring-emerald-500"
              >
                {PHASES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <select
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                className="rounded-lg border border-dark-border bg-[#262626] p-2 text-sm text-white focus:border-emerald-500 focus:ring-emerald-500"
              >
                <option value="">All Batches</option>
                {batchesData?.data?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <button className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-500 transition-colors hover:bg-emerald-500/20">
                <Download className="h-4 w-4" /> Export
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-6 border-b border-dark-border/50">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "border-b-2 px-1 pb-3 text-sm font-medium transition-colors",
                  tab === t.key
                    ? "border-emerald-500 text-emerald-500"
                    : "border-transparent text-gray-400 hover:border-gray-700 hover:text-white",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 space-y-6 overflow-auto p-6">
          {matrixLoading ? (
            <div className="flex h-40 items-center justify-center text-gray-500">
              Loading rotations&hellip;
            </div>
          ) : groups.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-gray-500">
              <GanttChart className="h-8 w-8" />
              <p>No rotations found for {phase}.</p>
              <p className="text-xs">
                Use &ldquo;AI Generate Schedule&rdquo; to create a rotation
                schedule.
              </p>
            </div>
          ) : (
            <>
              {/* Rotation Matrix (Gantt) */}
              <div className="overflow-hidden rounded-xl border border-dark-border bg-dark-surface shadow-sm">
                <div className="flex items-center justify-between border-b border-dark-border p-4">
                  <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-300">
                    <GanttChart className="h-5 w-5" /> Rotation Matrix
                  </h2>
                  <div className="flex flex-wrap gap-4 text-xs">
                    {legend.map((l) => (
                      <div key={l.id} className="flex items-center gap-1.5">
                        <span
                          className={cn("h-3 w-3 rounded-sm", l.color.legend)}
                        />
                        <span className="text-gray-400">{l.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <div className="min-w-[1000px] p-4">
                    {/* Week headers */}
                    <div
                      className="mb-2 grid items-center"
                      style={{
                        gridTemplateColumns: `120px repeat(${totalWeeks}, 1fr)`,
                      }}
                    >
                      <div className="py-2 text-xs font-bold uppercase text-gray-500">
                        Group
                      </div>
                      {weekLabels.map((w) => (
                        <div
                          key={w}
                          className="border-l border-dark-border py-2 text-center text-xs text-gray-500"
                        >
                          {w}
                        </div>
                      ))}
                    </div>

                    {/* Group rows */}
                    {groups.map((group) => (
                      <div
                        key={group.name}
                        className="mb-3 grid items-center"
                        style={{
                          gridTemplateColumns: `120px repeat(${totalWeeks}, 1fr)`,
                        }}
                      >
                        <div className="flex flex-col py-2">
                          <span className="text-sm font-medium text-white">
                            {group.name}
                          </span>
                          <span className="text-[10px] text-gray-500">
                            {group.studentCount} Students
                          </span>
                        </div>

                        {group.rotations.map((rot) => {
                          const startMs =
                            new Date(rot.start_date).getTime() -
                            minDate.getTime();
                          const endMs =
                            new Date(rot.end_date).getTime() -
                            minDate.getTime();
                          const startCol =
                            Math.floor(startMs / MS_PER_WEEK) + 2;
                          const endCol = Math.min(
                            Math.ceil(endMs / MS_PER_WEEK) + 2,
                            totalWeeks + 2,
                          );
                          const span = Math.max(1, endCol - startCol);
                          const c = deptColorByHash(rot.department_id);
                          const dName =
                            deptMap.get(rot.department_id) ?? "";
                          const sName = rot.supervisor_faculty_id
                            ? (facultyMap.get(rot.supervisor_faculty_id) ?? "")
                            : "";

                          return (
                            <div
                              key={rot.id}
                              className={cn(
                                "group relative mx-0.5 h-12 cursor-pointer rounded-lg border transition-colors",
                                c.bg,
                                c.border,
                                c.hoverBg,
                              )}
                              style={{
                                gridColumn: `${startCol} / span ${span}`,
                              }}
                              title={`${dName}\n${sName}\n${rot.start_date} → ${rot.end_date}\n${rot.completed_hours}/${rot.required_hours ?? "?"} hrs`}
                            >
                              <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden p-1">
                                <span
                                  className={cn(
                                    "w-full truncate text-center text-xs font-bold",
                                    c.text,
                                  )}
                                >
                                  {dName}
                                </span>
                                <span
                                  className={cn(
                                    "w-full truncate text-center text-[10px]",
                                    c.subText,
                                  )}
                                >
                                  {sName}
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
              {statusRows.length > 0 && (
                <div>
                  <h3 className="mb-3 text-sm font-bold text-white">
                    Department Rotation Status
                  </h3>
                  <div className="overflow-hidden rounded-lg border border-dark-border bg-dark-surface">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-dark-border bg-[#262626]">
                          <TableHead className="text-gray-500">
                            Group
                          </TableHead>
                          <TableHead className="text-gray-500">
                            Current Dept
                          </TableHead>
                          <TableHead className="text-gray-500">
                            Supervisor
                          </TableHead>
                          <TableHead className="text-gray-500">
                            Dates
                          </TableHead>
                          <TableHead className="text-gray-500">
                            Progress (Hours)
                          </TableHead>
                          <TableHead className="text-right text-gray-500">
                            Status
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {statusRows.map((row) => {
                          const dName =
                            deptMap.get(row.deptId) ??
                            row.deptId.slice(0, 8);
                          const sName = row.supervisorId
                            ? (facultyMap.get(row.supervisorId) ?? "—")
                            : "—";
                          const pct =
                            row.requiredHours > 0
                              ? Math.round(
                                  (row.completedHours / row.requiredHours) *
                                    100,
                                )
                              : 0;
                          const isLagging = pct > 0 && pct < 75;
                          const barColor = isLagging
                            ? "bg-yellow-500"
                            : "bg-emerald-500";
                          const pctColor = isLagging
                            ? "text-yellow-500"
                            : "text-emerald-500";
                          const badge =
                            STATUS_BADGE[row.status] ?? STATUS_BADGE.scheduled;
                          const c = deptColorByHash(row.deptId);

                          return (
                            <TableRow
                              key={row.group}
                              className="border-dark-border transition-colors hover:bg-[#262626]/50"
                            >
                              <TableCell className="font-medium text-white">
                                {row.group}
                              </TableCell>
                              <TableCell className={c.label}>
                                {dName}
                              </TableCell>
                              <TableCell>{sName}</TableCell>
                              <TableCell className="text-xs">
                                {fmtShortDate(row.startDate)} –{" "}
                                {fmtShortDate(row.endDate)}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  <div className="flex justify-between text-[10px]">
                                    <span className="text-gray-400">
                                      {row.completedHours}/{row.requiredHours}{" "}
                                      hrs
                                    </span>
                                    <span className={pctColor}>{pct}%</span>
                                  </div>
                                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-700">
                                    <div
                                      className={cn("h-full", barColor)}
                                      style={{
                                        width: `${Math.min(pct, 100)}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <span
                                  className={cn(
                                    "inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium",
                                    badge.classes,
                                  )}
                                >
                                  {badge.label}
                                </span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right Sidebar */}
      <aside className="flex w-[320px] shrink-0 flex-col overflow-hidden border-l border-dark-border bg-[#0A0A0A]">
        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {/* Action Buttons */}
          <div className="space-y-3">
            <Button
              className="w-full py-3 text-sm font-semibold shadow-lg shadow-emerald-900/20"
              onClick={handleGenerate}
              disabled={generate.isPending}
            >
              <Sparkles className="mr-2 h-5 w-5" />
              {generate.isPending ? "Generating…" : "AI Generate Schedule"}
            </Button>
            <button
              onClick={handleValidate}
              disabled={validate.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-[#262626] py-3 text-sm font-medium text-emerald-400 transition-colors hover:bg-dark-surface disabled:opacity-50"
            >
              <ShieldCheck className="h-5 w-5" />
              {validate.isPending ? "Validating…" : "Validate Against NMC"}
            </button>
          </div>

          {/* Validation Result */}
          {validationResult && (
            <div className="rounded-lg border border-dark-border bg-dark-surface p-4 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
                <ShieldCheck className="h-5 w-5 text-gray-400" /> NMC
                Validation
              </h3>
              {validationResult.valid ? (
                <div className="flex items-center gap-2 text-sm text-emerald-400">
                  <Check className="h-4 w-4" /> All departments meet NMC
                  requirements.
                </div>
              ) : (
                <div className="space-y-3">
                  {validationResult.issues.map((issue, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <X className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                      <div>
                        <p className="text-sm text-white">
                          {issue.department}
                        </p>
                        <p className="text-xs text-gray-500">
                          {issue.scheduled_hours}/{issue.required_hours} hrs (
                          {issue.required_hours - issue.scheduled_hours} deficit)
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Constraints */}
          <div className="rounded-lg border border-dark-border bg-dark-surface p-4 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
              <SlidersHorizontal className="h-5 w-5 text-gray-400" />{" "}
              Constraints
            </h3>
            <div className="space-y-4">
              {CONSTRAINT_DEFS.map((c, i) => {
                const enabled =
                  constraints[c.key as keyof typeof constraints];
                return (
                  <div
                    key={c.key}
                    className={cn(
                      "flex items-center justify-between py-1",
                      i > 0 && "border-t border-dark-border pt-3",
                    )}
                  >
                    <div className="flex flex-col">
                      <span
                        className={cn(
                          "text-xs font-medium",
                          enabled ? "text-white" : "text-gray-400",
                        )}
                      >
                        {c.label}
                      </span>
                      <span
                        className={cn(
                          "text-[10px]",
                          enabled ? "text-gray-500" : "text-gray-600",
                        )}
                      >
                        {c.desc}
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        setConstraints((prev) => ({
                          ...prev,
                          [c.key]:
                            !prev[c.key as keyof typeof prev],
                        }))
                      }
                      className={cn(
                        "relative h-5 w-10 rounded-full border",
                        enabled
                          ? "border-emerald-500/40 bg-emerald-500/20"
                          : "border-dark-border bg-[#262626]",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 h-3.5 w-3.5 rounded-full shadow-sm transition-transform",
                          enabled
                            ? "right-1 bg-emerald-500"
                            : "left-1 bg-gray-500",
                        )}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Compliance Status */}
          {legend.length > 0 && (
            <div>
              <h3 className="mb-4 border-b border-dark-border pb-2 text-sm font-bold uppercase tracking-wider text-white">
                Compliance Status
              </h3>
              <div className="space-y-4">
                {legend.map((dept) => {
                  const issue = validationResult?.issues?.find(
                    (i) => i.department === dept.name,
                  );
                  const isOk = validationResult ? !issue : null;
                  return (
                    <div
                      key={dept.id}
                      className={cn(
                        "relative border-l-2 pl-4",
                        isOk === true
                          ? "border-emerald-500"
                          : isOk === false
                            ? "border-yellow-500"
                            : "border-gray-600",
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <h4 className="text-sm font-medium text-white">
                          {dept.name}
                        </h4>
                        {isOk !== null && (
                          <span
                            className={cn(
                              "rounded px-1.5 text-xs",
                              isOk
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "bg-yellow-500/10 text-yellow-400",
                            )}
                          >
                            {isOk
                              ? "100%"
                              : `${issue!.scheduled_hours}/${issue!.required_hours} hrs`}
                          </span>
                        )}
                      </div>
                      {issue && (
                        <p className="mt-1 text-xs text-gray-500">
                          {issue.required_hours - issue.scheduled_hours} hours
                          deficit
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Summary Stats */}
          <div className="rounded-lg border border-dark-border bg-[#262626]/50 p-3">
            <div className="grid grid-cols-2 gap-4 divide-x divide-dark-border text-center">
              <div>
                <div className="text-2xl font-bold text-white">
                  {groups.length}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500">
                  Active Groups
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">
                  {matrixData?.total_students ?? 0}
                </div>
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
