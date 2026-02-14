"use client";

import { useState, useMemo, useCallback } from "react";
import {
  CalendarDays,
  List,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Check,
  X,
  AlertTriangle,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { LeaveCalendar } from "@/components/admin/leave-calendar";
import {
  useLeaveRequests,
  useLeavePolicies,
  useApproveLeave,
  useRejectLeave,
} from "@/lib/hooks/admin/use-leave";
import { useFaculty } from "@/lib/hooks/admin/use-faculty";
import type { LeaveRequestResponse, FacultyResponse } from "@/types/admin-api";
import type { LeaveCalendarDay } from "@/types/admin";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const LEAVE_TYPE_LABELS: Record<string, string> = {
  casual_leave: "CL",
  earned_leave: "EL",
  medical_leave: "ML",
  study_leave: "Study",
  maternity_leave: "Mat.",
  sabbatical: "Sabb.",
  duty_leave: "Duty",
  examination_duty: "Exam",
};

const LEAVE_TYPE_FULL: Record<string, string> = {
  casual_leave: "Casual Leave",
  earned_leave: "Earned Leave",
  medical_leave: "Medical Leave",
  study_leave: "Study Leave",
  maternity_leave: "Maternity Leave",
  sabbatical: "Sabbatical",
  duty_leave: "Duty Leave",
  examination_duty: "Exam Duty",
};

const LEAVE_TYPE_COLORS: Record<string, string> = {
  casual_leave: "text-blue-400",
  earned_leave: "text-emerald-400",
  medical_leave: "text-red-400",
  study_leave: "text-purple-400",
  maternity_leave: "text-pink-400",
  sabbatical: "text-amber-400",
  duty_leave: "text-cyan-400",
  examination_duty: "text-teal-400",
};

const LEAVE_EVENT_COLORS: Record<string, string> = {
  casual_leave: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  earned_leave: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  medical_leave: "bg-red-500/20 text-red-300 border-red-500/30",
  study_leave: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  maternity_leave: "bg-pink-500/20 text-pink-300 border-pink-500/30",
  sabbatical: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  duty_leave: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  examination_duty: "bg-teal-500/20 text-teal-300 border-teal-500/30",
};

const LEAVE_LEGEND = [
  { code: "CL", label: "CL", color: "bg-blue-500" },
  { code: "EL", label: "EL", color: "bg-emerald-500" },
  { code: "ML", label: "ML", color: "bg-red-500" },
  { code: "Study", label: "Study", color: "bg-purple-500" },
  { code: "Mat", label: "Mat.", color: "bg-pink-500" },
];

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  partially_approved:
    "bg-blue-500/10 text-blue-500 border-blue-500/20",
  approved: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  rejected: "bg-red-500/10 text-red-400 border-red-500/20",
  cancelled: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  partially_approved: "Partial",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const SIDEBAR_BORDER_COLORS: Record<string, string> = {
  casual_leave: "border-blue-500",
  earned_leave: "border-emerald-500",
  medical_leave: "border-red-500",
  study_leave: "border-purple-500",
  maternity_leave: "border-pink-500",
  sabbatical: "border-amber-500",
  duty_leave: "border-cyan-500",
  examination_duty: "border-teal-500",
};

const INITIALS_COLORS = [
  "bg-indigo-500/20 text-indigo-400",
  "bg-pink-500/20 text-pink-400",
  "bg-teal-500/20 text-teal-400",
  "bg-amber-500/20 text-amber-400",
  "bg-cyan-500/20 text-cyan-400",
  "bg-rose-500/20 text-rose-400",
  "bg-violet-500/20 text-violet-400",
  "bg-lime-500/20 text-lime-400",
];

const STAFF_CATEGORY_LABELS: Record<string, string> = {
  teaching_faculty: "Teaching Staff",
  hospital_staff: "Hospital Staff",
  admin_staff: "Non-Teaching",
  intern: "Interns",
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getInitialsColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++)
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return INITIALS_COLORS[Math.abs(hash) % INITIALS_COLORS.length];
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
  });
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ---------------------------------------------------------------------------
// Build calendar days from leave requests
// ---------------------------------------------------------------------------

function buildCalendarDays(
  month: number, // 1-indexed
  year: number,
  requests: LeaveRequestResponse[],
  facultyMap: Map<string, { name: string }>,
): LeaveCalendarDay[] {
  const days: LeaveCalendarDay[] = [];
  const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate();
  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() + 1 === month;

  // Build events map: day number → events
  const eventMap = new Map<
    number,
    { label: string; leaveTypeCode: string; color: string }[]
  >();

  for (const req of requests) {
    if (req.status === "rejected" || req.status === "cancelled") continue;
    const from = new Date(req.from_date);
    const to = new Date(req.to_date);
    const fac = facultyMap.get(req.employee_id);
    const name = fac?.name
      ? fac.name.split(" ").slice(0, 2).join(" ")
      : req.employee_id.slice(0, 6);
    const code = LEAVE_TYPE_LABELS[req.leave_type] ?? req.leave_type;
    const color =
      LEAVE_EVENT_COLORS[req.leave_type] ??
      "bg-gray-500/20 text-gray-300 border-gray-500/30";

    // Iterate over each day in the range that falls in this month
    const start = new Date(
      Math.max(from.getTime(), new Date(year, month - 1, 1).getTime()),
    );
    const end = new Date(
      Math.min(to.getTime(), new Date(year, month - 1, daysInMonth).getTime()),
    );

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayNum = d.getDate();
      if (!eventMap.has(dayNum)) eventMap.set(dayNum, []);
      const arr = eventMap.get(dayNum)!;
      // Limit to 2 events per day to avoid overflow
      if (arr.length < 2) {
        arr.push({ label: `${name} (${code})`, leaveTypeCode: code, color });
      }
    }
  }

  // Fill previous month days
  for (let i = firstDay - 1; i >= 0; i--) {
    days.push({
      day: daysInPrevMonth - i,
      isCurrentMonth: false,
      events: [],
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({
      day: d,
      isCurrentMonth: true,
      isToday: isCurrentMonth && today.getDate() === d,
      events: eventMap.get(d) ?? [],
    });
  }

  return days;
}

// ---------------------------------------------------------------------------
// Derive department impact from leave requests + faculty data
// ---------------------------------------------------------------------------

interface DepartmentImpact {
  name: string;
  departmentId: string;
  onLeave: number;
  total: number;
  msrRisk: boolean;
  pct: number;
}

function deriveDepartmentImpact(
  requests: LeaveRequestResponse[],
  facultyData: FacultyResponse[],
): DepartmentImpact[] {
  const today = new Date().toISOString().split("T")[0];

  // Count faculty on leave today (approved or pending)
  const onLeaveByDept = new Map<string, number>();
  for (const req of requests) {
    if (req.status !== "approved" && req.status !== "pending") continue;
    if (req.from_date > today || req.to_date < today) continue;
    const fac = facultyData.find((f) => f.id === req.employee_id);
    if (!fac) continue;
    const deptId = fac.department_id;
    onLeaveByDept.set(deptId, (onLeaveByDept.get(deptId) ?? 0) + 1);
  }

  // Count total faculty per department
  const totalByDept = new Map<string, number>();
  const deptNames = new Map<string, string>();
  for (const f of facultyData) {
    totalByDept.set(
      f.department_id,
      (totalByDept.get(f.department_id) ?? 0) + 1,
    );
    // We don't have department names from faculty response, use dept ID shorthand
    if (!deptNames.has(f.department_id)) {
      deptNames.set(f.department_id, f.department_id.slice(0, 8));
    }
  }

  // Build impact list for depts that have on-leave faculty
  const impacts: DepartmentImpact[] = [];
  for (const [deptId, onLeave] of onLeaveByDept) {
    const total = totalByDept.get(deptId) ?? 1;
    const pct = Math.round((onLeave / total) * 100);
    impacts.push({
      name: deptNames.get(deptId) ?? deptId.slice(0, 8),
      departmentId: deptId,
      onLeave,
      total,
      msrRisk: pct > 30, // >30% on leave = MSR risk heuristic
      pct,
    });
  }

  return impacts.sort((a, b) => b.pct - a.pct);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LeaveManagementPage() {
  const now = new Date();
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Banner state
  const [banner, setBanner] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const showBanner = useCallback(
    (type: "success" | "error", message: string) => {
      setBanner({ type, message });
      setTimeout(() => setBanner(null), 5000);
    },
    [],
  );

  // Reject dialog
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Approve confirm dialog
  const [approveTarget, setApproveTarget] = useState<string | null>(null);

  // --- Data hooks ---
  const requestsQ = useLeaveRequests({
    status: statusFilter !== "all" ? statusFilter : undefined,
    leave_type: typeFilter !== "all" ? typeFilter : undefined,
    page,
    page_size: pageSize,
  });

  // Calendar data: all non-cancelled requests overlapping the calendar month
  const firstOfMonth = `${calYear}-${String(calMonth).padStart(2, "0")}-01`;
  const daysInMonth = new Date(calYear, calMonth, 0).getDate();
  const lastOfMonth = `${calYear}-${String(calMonth).padStart(2, "0")}-${daysInMonth}`;

  const calendarRequestsQ = useLeaveRequests(
    {
      from_date: firstOfMonth,
      to_date: lastOfMonth,
      page_size: 100,
    },
    { enabled: viewMode === "calendar" },
  );

  const policiesQ = useLeavePolicies();
  const facultyQ = useFaculty({ page_size: 500 });

  const facultyMap = useMemo(() => {
    const m = new Map<
      string,
      { name: string; designation: string | null; department_id: string }
    >();
    if (facultyQ.data?.data) {
      for (const f of facultyQ.data.data as FacultyResponse[]) {
        m.set(f.id, {
          name: f.name,
          designation: f.designation,
          department_id: f.department_id,
        });
      }
    }
    return m;
  }, [facultyQ.data]);

  // Mutations
  const approveMut = useApproveLeave();
  const rejectMut = useRejectLeave();

  // --- Derived data ---
  const requests = useMemo(() => requestsQ.data?.data ?? [], [requestsQ.data?.data]);
  const totalRecords = requestsQ.data?.total ?? 0;
  const totalPages = requestsQ.data?.total_pages ?? 0;
  const calendarRequests = useMemo(() => calendarRequestsQ.data?.data ?? [], [calendarRequestsQ.data?.data]);
  const policies = useMemo(() => policiesQ.data?.data ?? [], [policiesQ.data?.data]);

  // Pending requests for approval queue sidebar
  const pendingRequests = useMemo(
    () =>
      requests.filter(
        (r) => r.status === "pending" || r.status === "partially_approved",
      ),
    [requests],
  );

  // Today's on-leave count
  const todayStr = now.toISOString().split("T")[0];
  const onLeaveToday = useMemo(
    () =>
      requests.filter(
        (r) =>
          (r.status === "approved" || r.status === "pending") &&
          r.from_date <= todayStr &&
          r.to_date >= todayStr,
      ).length,
    [requests, todayStr],
  );

  // Calendar days
  const calendarDays = useMemo(
    () =>
      buildCalendarDays(
        calMonth,
        calYear,
        calendarRequests,
        facultyMap as Map<string, { name: string }>,
      ),
    [calMonth, calYear, calendarRequests, facultyMap],
  );

  // Department impact
  const deptImpact = useMemo(
    () =>
      deriveDepartmentImpact(
        requests,
        (facultyQ.data?.data as FacultyResponse[]) ?? [],
      ),
    [requests, facultyQ.data],
  );

  // Leave policies grouped by staff category
  const policyGroups = useMemo(() => {
    const groups = new Map<
      string,
      { code: string; days: number | null; color: string }[]
    >();
    for (const p of policies) {
      if (!p.is_active) continue;
      const cat = p.staff_category;
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push({
        code: LEAVE_TYPE_LABELS[p.leave_type] ?? p.leave_type,
        days: p.annual_entitlement,
        color: LEAVE_TYPE_COLORS[p.leave_type] ?? "text-gray-400",
      });
    }
    return groups;
  }, [policies]);

  // --- Handlers ---
  const handleApproveConfirm = () => {
    if (!approveTarget) return;
    approveMut.mutate(approveTarget, {
      onSuccess: () => {
        showBanner("success", "Leave request approved");
        setApproveTarget(null);
      },
      onError: (err) => showBanner("error", err.message),
    });
  };

  const handleRejectConfirm = () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    rejectMut.mutate(
      { id: rejectTarget, rejection_reason: rejectReason.trim() },
      {
        onSuccess: () => {
          showBanner("success", "Leave request rejected");
          setRejectTarget(null);
          setRejectReason("");
        },
        onError: (err) => showBanner("error", err.message),
      },
    );
  };

  const handleCalPrev = () => {
    if (calMonth === 1) {
      setCalMonth(12);
      setCalYear((y) => y - 1);
    } else {
      setCalMonth((m) => m - 1);
    }
  };

  const handleCalNext = () => {
    if (calMonth === 12) {
      setCalMonth(1);
      setCalYear((y) => y + 1);
    } else {
      setCalMonth((m) => m + 1);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      {banner && (
        <div
          className={cn(
            "rounded-lg border px-4 py-3 text-sm",
            banner.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-red-500/30 bg-red-500/10 text-red-400",
          )}
        >
          {banner.message}
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Leave Dashboard</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-gray-400">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {pendingRequests.length} Pending Approvals
            </span>
            <span className="text-gray-600">&bull;</span>
            Today: {onLeaveToday} on Leave
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border border-dark-border bg-dark-surface p-1">
            <button
              className={cn(
                "flex items-center gap-2 rounded px-3 py-1.5 text-xs font-medium transition-colors",
                viewMode === "calendar"
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "text-gray-400 hover:text-white",
              )}
              onClick={() => setViewMode("calendar")}
            >
              <CalendarDays className="h-3.5 w-3.5" /> Calendar
            </button>
            <button
              className={cn(
                "flex items-center gap-2 rounded px-3 py-1.5 text-xs font-medium transition-colors",
                viewMode === "list"
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "text-gray-400 hover:text-white",
              )}
              onClick={() => setViewMode("list")}
            >
              <List className="h-3.5 w-3.5" /> List View
            </button>
          </div>

          {/* Filters */}
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={typeFilter}
            onValueChange={(v) => {
              setTypeFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-36">
              <SelectValue placeholder="Leave Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="casual_leave">Casual Leave</SelectItem>
              <SelectItem value="earned_leave">Earned Leave</SelectItem>
              <SelectItem value="medical_leave">Medical Leave</SelectItem>
              <SelectItem value="study_leave">Study Leave</SelectItem>
              <SelectItem value="maternity_leave">Maternity</SelectItem>
              <SelectItem value="duty_leave">Duty Leave</SelectItem>
              <SelectItem value="examination_duty">Exam Duty</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
        {/* Left — 3/4 */}
        <div className="space-y-6 xl:col-span-3">
          {/* Calendar or List view */}
          {viewMode === "calendar" && (
            <LeaveCalendar
              month={MONTHS[calMonth - 1]}
              year={calYear}
              days={calendarDays}
              legend={LEAVE_LEGEND}
              onPrev={handleCalPrev}
              onNext={handleCalNext}
            />
          )}

          {/* Leave Requests Table */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-dark-border px-5 py-4">
              <h3 className="text-base font-semibold text-white">
                {viewMode === "list" ? "All Leave Requests" : "Recent Leave Requests"}
              </h3>
              <span className="text-xs text-gray-500">
                {totalRecords} total
              </span>
            </div>

            {requestsQ.isLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-400">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading leave requests...
              </div>
            ) : requests.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-500">
                No leave requests found
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#262626]/50 text-[11px] uppercase tracking-wider text-gray-500">
                      <TableHead className="font-semibold">Employee</TableHead>
                      <TableHead className="font-semibold">Type</TableHead>
                      <TableHead className="font-semibold">Dates</TableHead>
                      <TableHead className="font-semibold">Days</TableHead>
                      <TableHead className="font-semibold">Reason</TableHead>
                      <TableHead className="text-center font-semibold">
                        Status
                      </TableHead>
                      <TableHead className="text-center font-semibold">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((req) => {
                      const fac = facultyMap.get(req.employee_id);
                      const name =
                        fac?.name ?? req.employee_id.slice(0, 8);
                      const designation = fac?.designation ?? "";
                      const isPending =
                        req.status === "pending" ||
                        req.status === "partially_approved";
                      return (
                        <TableRow
                          key={req.id}
                          className="transition-colors hover:bg-[#262626]/20"
                        >
                          <TableCell className="py-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
                                  getInitialsColor(req.employee_id),
                                )}
                              >
                                {fac ? getInitials(fac.name) : "?"}
                              </div>
                              <div>
                                <p className="font-medium text-white">
                                  {name}
                                </p>
                                {designation && (
                                  <p className="text-[10px] text-gray-500">
                                    {designation}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            <span
                              className={
                                LEAVE_TYPE_COLORS[req.leave_type] ??
                                "text-gray-400"
                              }
                            >
                              {LEAVE_TYPE_FULL[req.leave_type] ??
                                req.leave_type}
                            </span>
                          </TableCell>
                          <TableCell className="py-4 text-gray-300">
                            {formatDate(req.from_date)}
                            {req.from_date !== req.to_date &&
                              ` - ${formatDate(req.to_date)}`}
                          </TableCell>
                          <TableCell className="py-4 text-gray-300">
                            {req.days}
                          </TableCell>
                          <TableCell className="max-w-[150px] truncate py-4 text-gray-400">
                            {req.reason ?? "-"}
                          </TableCell>
                          <TableCell className="py-4 text-center">
                            <span
                              className={cn(
                                "rounded border px-2 py-0.5 text-[10px]",
                                STATUS_BADGE[req.status] ??
                                  STATUS_BADGE.pending,
                              )}
                            >
                              {STATUS_LABELS[req.status] ?? req.status}
                            </span>
                            {req.rejection_reason && (
                              <p
                                className="mt-1 max-w-[120px] truncate text-[9px] text-red-400"
                                title={req.rejection_reason}
                              >
                                {req.rejection_reason}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="py-4 text-center">
                            {isPending && (
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7 border-emerald-600/20 bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20"
                                  onClick={() => setApproveTarget(req.id)}
                                  disabled={approveMut.isPending}
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7 border-red-600/20 bg-red-600/10 text-red-400 hover:bg-red-600/20"
                                  onClick={() => setRejectTarget(req.id)}
                                  disabled={rejectMut.isPending}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-dark-border px-5 py-3">
                    <p className="text-xs text-gray-500">
                      Showing {(page - 1) * pageSize + 1}–
                      {Math.min(page * pageSize, totalRecords)} of{" "}
                      {totalRecords}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="px-2 text-xs text-gray-400">
                        {page} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>

          {/* Department Leave Overview */}
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">
                Department Leave Overview
              </h3>
              <Filter className="h-4 w-4 text-gray-400" />
            </div>
            {deptImpact.length === 0 ? (
              <p className="text-center text-sm text-gray-500">
                No departments with active leaves today
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {deptImpact.map((dept) => (
                  <div
                    key={dept.departmentId}
                    className="relative overflow-hidden rounded-lg border border-dark-border bg-[#262626] p-3"
                  >
                    <div className="flex items-start justify-between">
                      <h4 className="text-sm font-medium text-white">
                        Dept {dept.name}
                      </h4>
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-xs",
                          dept.msrRisk
                            ? "animate-pulse bg-red-500/20 text-red-400"
                            : "bg-emerald-500/20 text-emerald-400",
                        )}
                      >
                        {dept.msrRisk ? (
                          <span className="flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            MSR Risk
                          </span>
                        ) : (
                          "MSR OK"
                        )}
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
                            dept.msrRisk ? "bg-red-500" : "bg-emerald-500",
                          )}
                          style={{ width: `${Math.min(dept.pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right Sidebar — 1/4 */}
        <div className="space-y-6 xl:col-span-1">
          {/* Approval Queue */}
          <Card className="flex h-[400px] flex-col">
            <div className="flex items-center justify-between border-b border-dark-border p-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                Approval Queue
              </h3>
              {pendingRequests.length > 0 && (
                <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {pendingRequests.length}
                </span>
              )}
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-3">
              {pendingRequests.length === 0 ? (
                <p className="py-8 text-center text-xs text-gray-500">
                  No pending approvals
                </p>
              ) : (
                pendingRequests.map((item) => {
                  const fac = facultyMap.get(item.employee_id);
                  const name = fac?.name ?? item.employee_id.slice(0, 8);
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "rounded-lg border-l-2 bg-[#262626] p-3",
                        SIDEBAR_BORDER_COLORS[item.leave_type] ??
                          "border-gray-500",
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-700 text-xs text-gray-300">
                            {fac ? getInitials(fac.name) : "?"}
                          </div>
                          <span className="text-sm font-medium text-white">
                            {name}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-500">
                          {timeAgo(item.created_at)}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-gray-400">
                        <span
                          className={
                            LEAVE_TYPE_COLORS[item.leave_type] ??
                            "text-gray-400"
                          }
                        >
                          {LEAVE_TYPE_FULL[item.leave_type] ?? item.leave_type}
                        </span>{" "}
                        &bull; {item.days} {item.days === 1 ? "Day" : "Days"}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          className="flex-1 rounded border border-emerald-600/20 bg-emerald-600/20 py-1 text-[10px] text-emerald-400 transition-colors hover:bg-emerald-600/30 disabled:opacity-50"
                          onClick={() => setApproveTarget(item.id)}
                          disabled={approveMut.isPending}
                        >
                          Approve
                        </button>
                        <button
                          className="flex-1 rounded border border-red-600/20 bg-red-600/20 py-1 text-[10px] text-red-400 transition-colors hover:bg-red-600/30 disabled:opacity-50"
                          onClick={() => setRejectTarget(item.id)}
                          disabled={rejectMut.isPending}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          {/* Entitlement Policy */}
          <Card>
            <CardContent className="p-4">
              <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-white">
                Entitlement Policy
              </h3>
              {policiesQ.isLoading ? (
                <div className="flex items-center justify-center py-6 text-gray-400">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </div>
              ) : policyGroups.size === 0 ? (
                <p className="py-4 text-center text-xs text-gray-500">
                  No leave policies configured
                </p>
              ) : (
                <div className="space-y-4">
                  {Array.from(policyGroups.entries()).map(
                    ([category, rows], idx) => (
                      <div key={category}>
                        {idx > 0 && <div className="mb-4 h-px bg-dark-border" />}
                        <EntitlementSection
                          label={
                            STAFF_CATEGORY_LABELS[category] ?? category
                          }
                          rows={rows}
                        />
                      </div>
                    ),
                  )}
                </div>
              )}
              <div className="mt-4 border-t border-dark-border pt-3">
                <button className="flex w-full items-center justify-center gap-1 text-xs text-emerald-500 hover:underline">
                  <Download className="h-3 w-3" /> Download Full Policy PDF
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Approve Confirm Dialog */}
      <Dialog
        open={approveTarget !== null}
        onOpenChange={(open) => !open && setApproveTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approve Leave Request</DialogTitle>
            <DialogDescription>
              Are you sure you want to approve this leave request? The
              employee&apos;s leave balance will be updated.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApproveTarget(null)}
              disabled={approveMut.isPending}
            >
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleApproveConfirm}
              disabled={approveMut.isPending}
            >
              {approveMut.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog with Reason */}
      <Dialog
        open={rejectTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null);
            setRejectReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Leave Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this leave request.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <textarea
              className="w-full rounded-md border border-dark-border bg-[#1a1a1a] px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              rows={3}
              placeholder="Reason for rejection..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectTarget(null);
                setRejectReason("");
              }}
              disabled={rejectMut.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={rejectMut.isPending || !rejectReason.trim()}
            >
              {rejectMut.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <X className="mr-2 h-4 w-4" />
              )}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  rows: { code: string; days: number | null; color: string }[];
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
