"use client";

import {
  CalendarDays,
  List,
  Plus,
  ArrowRight,
  Filter,
  Download,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
import { LeaveCalendar } from "@/components/admin/leave-calendar";
import type {
  LeaveCalendarDay,
  LeaveRequestEntry,
  DepartmentLeaveCard,
  ApprovalQueueItem,
  LeaveEntitlementRow,
} from "@/types/admin";

// ---------------------------------------------------------------------------
// TODO: Replace with API call — GET /api/v1/admin/hr/leave/dashboard
// ---------------------------------------------------------------------------

const LEAVE_LEGEND = [
  { code: "CL", label: "CL", color: "bg-blue-500" },
  { code: "EL", label: "EL", color: "bg-emerald-500" },
  { code: "ML", label: "ML", color: "bg-red-500" },
  { code: "Study", label: "Study", color: "bg-purple-500" },
  { code: "Mat", label: "Mat.", color: "bg-pink-500" },
];

const EVENT_COLORS: Record<string, string> = {
  CL: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  EL: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  ML: "bg-red-500/20 text-red-300 border-red-500/30",
  Study: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  Conf: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  Mat: "bg-pink-500/20 text-pink-300 border-pink-500/30",
};

function buildFebDays(): LeaveCalendarDay[] {
  // Feb 2026 starts on Sunday (day index 0), 28 days
  const days: LeaveCalendarDay[] = [];

  // Previous month fill — none needed, Feb 1 = Sunday
  // But the design shows 29,30,31 from January
  for (const d of [29, 30, 31]) {
    days.push({ day: d, isCurrentMonth: false, events: [] });
  }

  for (let d = 1; d <= 18; d++) {
    const events: LeaveCalendarDay["events"] = [];
    if (d === 2)
      events.push({ label: "Dr. Rina (CL)", leaveTypeCode: "CL", color: EVENT_COLORS.CL });
    if (d === 6)
      events.push({ label: "Dr. Sunil (Conf)", leaveTypeCode: "Conf", color: EVENT_COLORS.Conf });
    if (d === 7)
      events.push({ label: "Dr. Sunil (Conf)", leaveTypeCode: "Conf", color: EVENT_COLORS.Conf });
    if (d === 10)
      events.push({ label: "P. Singh (ML)", leaveTypeCode: "ML", color: EVENT_COLORS.ML });
    if (d === 13)
      events.push({ label: "S. Gupta (EL)", leaveTypeCode: "EL", color: EVENT_COLORS.EL });
    if (d === 14)
      events.push({ label: "S. Gupta (EL)", leaveTypeCode: "EL", color: EVENT_COLORS.EL });

    days.push({
      day: d,
      isCurrentMonth: true,
      isToday: d === 15,
      events,
    });
  }

  return days;
}

const CALENDAR_DAYS = buildFebDays();

const LEAVE_REQUESTS: LeaveRequestEntry[] = [
  {
    id: "1",
    name: "Dr. Amit Mishra",
    initials: "AM",
    initialsColor: "bg-indigo-500/20 text-indigo-400",
    department: "Cardiology",
    designation: "Asst. Prof",
    leaveType: "Study Leave",
    leaveTypeColor: "text-purple-400",
    dates: "Feb 20 - Feb 24",
    days: 5,
    reason: "Attending Int. Cardio Conference",
    approvalChain: [
      { label: "HOD Approved", approved: true },
      { label: "Dean Approved", approved: true },
      { label: "HR Pending", approved: false },
    ],
    status: "pending_hr",
    statusLabel: "Pending HR",
  },
  {
    id: "2",
    name: "Sarah Jenkins",
    initials: "SJ",
    initialsColor: "bg-pink-500/20 text-pink-400",
    department: "Nursing",
    designation: "Senior Nurse",
    leaveType: "Casual Leave",
    leaveTypeColor: "text-blue-400",
    dates: "Feb 18",
    days: 1,
    reason: "Personal work",
    approvalChain: [
      { label: "Matron Approved", approved: true },
      { label: "HR Pending", approved: false },
    ],
    status: "pending_hr",
    statusLabel: "Pending HR",
  },
];

const DEPT_OVERVIEW: DepartmentLeaveCard[] = [
  { name: "Pathology", onLeave: 2, total: 18, msrStatus: "ok", pct: 15 },
  { name: "Anatomy", onLeave: 5, total: 12, msrStatus: "risk", pct: 45 },
  { name: "Pediatrics", onLeave: 1, total: 15, msrStatus: "ok", pct: 8 },
];

const APPROVAL_QUEUE: ApprovalQueueItem[] = [
  {
    id: "1",
    name: "John Doe",
    initials: "JD",
    leaveType: "Medical Leave",
    leaveTypeColor: "text-yellow-500",
    borderColor: "border-yellow-500",
    days: 3,
    timeAgo: "2m ago",
  },
  {
    id: "2",
    name: "Priya Singh",
    initials: "PS",
    leaveType: "Casual Leave",
    leaveTypeColor: "text-blue-400",
    borderColor: "border-blue-500",
    days: 1,
    timeAgo: "1h ago",
  },
  {
    id: "3",
    name: "Raj Kumar",
    initials: "RK",
    leaveType: "Study Leave",
    leaveTypeColor: "text-purple-400",
    borderColor: "border-purple-500",
    days: 7,
    timeAgo: "1d ago",
    waitingMessage: "Waiting for HOD remarks",
  },
];

const TEACHING_ENTITLEMENTS: LeaveEntitlementRow[] = [
  { code: "CL", days: 12, color: "text-blue-400" },
  { code: "EL", days: 30, color: "text-emerald-400" },
  { code: "Acad", days: 15, color: "text-purple-400" },
];

const NON_TEACHING_ENTITLEMENTS: LeaveEntitlementRow[] = [
  { code: "CL", days: 12, color: "text-blue-400" },
  { code: "EL", days: 30, color: "text-emerald-400" },
  { code: "Acad", days: null, color: "text-gray-600" },
];

// ---------------------------------------------------------------------------

export default function LeaveManagementPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Leave Dashboard</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-gray-400">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              NMC Compliant
            </span>
            <span className="text-gray-600">&bull;</span>
            Today: 12 Faculty on Leave
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border border-dark-border bg-dark-surface p-1">
            <button className="flex items-center gap-2 rounded bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm">
              <CalendarDays className="h-3.5 w-3.5" /> Calendar
            </button>
            <button className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:text-white">
              <List className="h-3.5 w-3.5" /> List View
            </button>
          </div>
          <Button variant="outline" size="sm" className="text-sm">
            <Plus className="mr-2 h-4 w-4" /> New Request
          </Button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
        {/* Left — 3/4 */}
        <div className="space-y-6 xl:col-span-3">
          {/* Leave Calendar */}
          <LeaveCalendar
            month="February"
            year={2026}
            days={CALENDAR_DAYS}
            legend={LEAVE_LEGEND}
          />

          {/* Recent Leave Requests */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-dark-border px-5 py-4">
              <h3 className="text-base font-semibold text-white">
                Recent Leave Requests
              </h3>
              <button className="flex items-center gap-1 text-xs font-medium text-emerald-500 hover:text-emerald-400">
                View All <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-[#262626]/50 text-[11px] uppercase tracking-wider text-gray-500">
                  <TableHead className="font-semibold">Employee</TableHead>
                  <TableHead className="font-semibold">Type</TableHead>
                  <TableHead className="font-semibold">Dates</TableHead>
                  <TableHead className="font-semibold">Days</TableHead>
                  <TableHead className="font-semibold">Reason</TableHead>
                  <TableHead className="font-semibold">
                    Approval Chain
                  </TableHead>
                  <TableHead className="text-center font-semibold">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {LEAVE_REQUESTS.map((req) => (
                  <TableRow
                    key={req.id}
                    className="transition-colors hover:bg-[#262626]/20"
                  >
                    <TableCell className="py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
                            req.initialsColor,
                          )}
                        >
                          {req.initials}
                        </div>
                        <div>
                          <p className="font-medium text-white">{req.name}</p>
                          <p className="text-[10px] text-gray-500">
                            {req.department} &bull; {req.designation}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <span className={req.leaveTypeColor}>
                        {req.leaveType}
                      </span>
                    </TableCell>
                    <TableCell className="py-4 text-gray-300">
                      {req.dates}
                    </TableCell>
                    <TableCell className="py-4 text-gray-300">
                      {req.days}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate py-4 text-gray-400">
                      {req.reason}
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-1">
                        {req.approvalChain.map((step, idx) => (
                          <span key={idx} className="flex items-center gap-1">
                            <span
                              className={cn(
                                "h-2 w-2 rounded-full",
                                step.approved
                                  ? "bg-emerald-500"
                                  : "border border-gray-500 bg-gray-600",
                              )}
                              title={step.label}
                            />
                            {idx < req.approvalChain.length - 1 && (
                              <span
                                className={cn(
                                  "h-px w-4",
                                  step.approved
                                    ? "bg-emerald-500"
                                    : "bg-gray-600",
                                )}
                              />
                            )}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="py-4 text-center">
                      <span className="rounded border border-yellow-500/20 bg-yellow-500/10 px-2 py-0.5 text-[10px] text-yellow-500">
                        {req.statusLabel}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Department Leave Overview */}
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">
                Department Leave Overview
              </h3>
              <button className="text-gray-400 hover:text-white">
                <Filter className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {DEPT_OVERVIEW.map((dept) => (
                <div
                  key={dept.name}
                  className="relative overflow-hidden rounded-lg border border-dark-border bg-[#262626] p-3"
                >
                  <div className="flex items-start justify-between">
                    <h4 className="text-sm font-medium text-white">
                      {dept.name}
                    </h4>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-xs",
                        dept.msrStatus === "ok"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "animate-pulse bg-red-500/20 text-red-400",
                      )}
                    >
                      {dept.msrStatus === "ok" ? "MSR OK" : "MSR Risk"}
                    </span>
                  </div>
                  <div className="mt-3 flex items-end justify-between">
                    <div className="text-xs text-gray-400">
                      On Leave:{" "}
                      <span className="font-bold text-white">
                        {dept.onLeave}
                      </span>{" "}
                      / {dept.total}
                    </div>
                    <div className="h-1 w-16 overflow-hidden rounded-full bg-gray-700">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          dept.msrStatus === "ok"
                            ? "bg-emerald-500"
                            : "bg-red-500",
                        )}
                        style={{ width: `${dept.pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Sidebar — 1/4 */}
        <div className="space-y-6 xl:col-span-1">
          {/* Approval Queue */}
          <Card className="flex h-[400px] flex-col">
            <div className="flex items-center justify-between border-b border-dark-border p-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                Your Approval Queue
              </h3>
              <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                3
              </span>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-3">
              {APPROVAL_QUEUE.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-lg border-l-2 bg-[#262626] p-3",
                    item.borderColor,
                    item.waitingMessage && "opacity-60",
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-700 text-xs text-gray-300">
                        {item.initials}
                      </div>
                      <span className="text-sm font-medium text-white">
                        {item.name}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-500">
                      {item.timeAgo}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-gray-400">
                    <span className={item.leaveTypeColor}>
                      {item.leaveType}
                    </span>{" "}
                    &bull; {item.days} {item.days === 1 ? "Day" : "Days"}
                  </div>
                  {item.waitingMessage ? (
                    <div className="mt-3 text-[10px] italic text-yellow-500">
                      {item.waitingMessage}
                    </div>
                  ) : (
                    <div className="mt-3 flex gap-2">
                      <button className="flex-1 rounded border border-emerald-600/20 bg-emerald-600/20 py-1 text-[10px] text-emerald-400 transition-colors hover:bg-emerald-600/30">
                        Approve
                      </button>
                      <button className="flex-1 rounded border border-red-600/20 bg-red-600/20 py-1 text-[10px] text-red-400 transition-colors hover:bg-red-600/30">
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Entitlement Policy */}
          <Card>
            <CardContent className="p-4">
              <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-white">
                Entitlement Policy (2026)
              </h3>
              <div className="space-y-4">
                <EntitlementSection
                  label="Teaching Staff"
                  rows={TEACHING_ENTITLEMENTS}
                />
                <div className="h-px bg-dark-border" />
                <EntitlementSection
                  label="Non-Teaching"
                  rows={NON_TEACHING_ENTITLEMENTS}
                />
              </div>
              <div className="mt-4 border-t border-dark-border pt-3">
                <button className="flex w-full items-center justify-center gap-1 text-xs text-emerald-500 hover:underline">
                  <Download className="h-3 w-3" /> Download Full Policy PDF
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EntitlementSection({
  label,
  rows,
}: {
  label: string;
  rows: LeaveEntitlementRow[];
}) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold text-gray-400">{label}</h4>
      <div className="grid grid-cols-3 gap-2 text-center">
        {rows.map((row) => (
          <div
            key={row.code}
            className={cn(
              "rounded border border-dark-border bg-[#262626] p-2",
              row.days === null && "opacity-50",
            )}
          >
            <div className="text-[10px] text-gray-500">{row.code}</div>
            <div className={cn("text-sm font-bold", row.color)}>
              {row.days ?? "-"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
