"use client";

import { format } from "date-fns";
import {
  Users,
  Stethoscope,
  IndianRupee,
  Clock,
  Filter,
  UserPlus,
  AlertTriangle,
  GraduationCap,
  Check,
  X,
  Zap,
  FileText,
  CalendarDays,
  Mail,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/admin/stat-card";
import { formatINRCompact } from "@/lib/format";
import type {
  PendingApproval,
  RecentAdmission,
  FeeCollectionMonth,
  StudentPhaseData,
} from "@/types/admin";

// ---------------------------------------------------------------------------
// Mock Data — TODO: Replace with API calls
// ---------------------------------------------------------------------------

// TODO: Replace with useQuery({ queryKey: ["admin", "dashboard", "feeCollection"], queryFn: fetchFeeCollection })
const MOCK_FEE_DATA: FeeCollectionMonth[] = [
  { month: "Apr", actual: 4_20_00_000, projected: 5_00_00_000 },
  { month: "May", actual: 5_80_00_000, projected: 6_20_00_000 },
  { month: "Jun", actual: 7_50_00_000, projected: 6_80_00_000 },
  { month: "Jul", actual: 4_80_00_000, projected: 5_60_00_000 },
  { month: "Aug", actual: 7_80_00_000, projected: 7_40_00_000 },
  { month: "Sep", actual: 8_60_00_000, projected: 8_70_00_000 },
  { month: "Oct", actual: 7_20_00_000, projected: 9_30_00_000 },
  { month: "Nov", actual: 10_20_00_000, projected: 9_90_00_000 },
  { month: "Dec", actual: 9_80_00_000, projected: 10_50_00_000 },
  { month: "Jan", actual: 11_30_00_000, projected: 11_10_00_000 },
  { month: "Feb", actual: 10_70_00_000, projected: 10_80_00_000 },
  { month: "Mar", actual: 13_80_00_000, projected: 12_00_00_000 },
];

// TODO: Replace with useQuery({ queryKey: ["admin", "dashboard", "studentPhases"], queryFn: fetchStudentPhases })
const MOCK_PHASE_DATA: StudentPhaseData[] = [
  { name: "Phase I (Pre-Clinical)", value: 650, color: "#10B981", percentage: 27 },
  { name: "Phase II (Para-Clinical)", value: 780, color: "#3B82F6", percentage: 32 },
  { name: "Phase III (Clinical)", value: 720, color: "#8B5CF6", percentage: 29 },
  { name: "CRMI (Internship)", value: 300, color: "#F59E0B", percentage: 12 },
];

// TODO: Replace with useQuery({ queryKey: ["admin", "dashboard", "approvals"], queryFn: fetchPendingApprovals })
const MOCK_APPROVALS: PendingApproval[] = [
  {
    id: "1",
    requestId: "REQ-2025-891",
    type: "Lab Equipment Purchase Order",
    requesterName: "Dr. Rajesh Patel",
    requesterInitials: "RP",
    priority: "high",
    createdAt: "2025-02-10",
  },
  {
    id: "2",
    requestId: "REQ-2025-892",
    type: "Leave Application",
    requesterName: "Dr. Meera Iyer",
    requesterInitials: "MI",
    priority: "medium",
    createdAt: "2025-02-11",
  },
  {
    id: "3",
    requestId: "REQ-2025-895",
    type: "Guest Lecture Honorarium",
    requesterName: "Dr. Arun Kumar",
    requesterInitials: "AK",
    priority: "low",
    createdAt: "2025-02-11",
  },
];

// TODO: Replace with useQuery({ queryKey: ["admin", "dashboard", "recentAdmissions"], queryFn: fetchRecentAdmissions })
const MOCK_ADMISSIONS: RecentAdmission[] = [
  {
    id: "1",
    studentName: "Shreya Banerjee",
    studentInitials: "SB",
    enrollmentNo: "MBBS-2025-0421",
    department: "Pathology",
    status: "active",
    feeStatus: "paid",
  },
  {
    id: "2",
    studentName: "Jai Lakshmanan",
    studentInitials: "JL",
    enrollmentNo: "MBBS-2025-0422",
    department: "Radiology",
    status: "active",
    feeStatus: "due",
  },
  {
    id: "3",
    studentName: "Mohammad Rashid",
    studentInitials: "MR",
    enrollmentNo: "MBBS-2025-0423",
    department: "General Surgery",
    status: "pending",
    feeStatus: "paid",
  },
  {
    id: "4",
    studentName: "Ananya Lakshmi",
    studentInitials: "AL",
    enrollmentNo: "MBBS-2025-0424",
    department: "Pediatrics",
    status: "active",
    feeStatus: "paid",
  },
];

// ---------------------------------------------------------------------------
// Custom Tooltip for Fee Chart
// ---------------------------------------------------------------------------

function FeeTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-dark-border bg-dark-surface p-3 shadow-xl">
      <p className="mb-1 text-xs font-medium text-white">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-xs text-gray-400">
          <span
            className="mr-1.5 inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          {entry.name}: {formatINRCompact(entry.value)}
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function AdminDashboard() {
  const today = format(new Date(), "MMM dd, yyyy");

  // TODO: Replace with actual API calls using TanStack Query
  // const { data: stats, isLoading } = useQuery({
  //   queryKey: ["admin", "dashboard", "stats"],
  //   queryFn: () => fetchDashboardStats(),
  // });

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Analytics Overview</h2>
          <p className="text-xs text-gray-400">
            Real-time data for{" "}
            <span className="font-medium text-emerald-500">{today}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4" />
            Filters
          </Button>
          <Button size="sm">
            <UserPlus className="h-4 w-4" />
            New Admission
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Students"
          value="2,450"
          subtitle="vs last sem"
          icon={<Users className="h-4 w-4 text-blue-400" />}
          iconBg="bg-blue-500/10"
          trend={{ value: "12.5%", positive: true }}
        />
        <StatCard
          title="Faculty"
          value="328"
          subtitle="new hires"
          icon={<Stethoscope className="h-4 w-4 text-purple-400" />}
          iconBg="bg-purple-500/10"
          trend={{ value: "2.1%", positive: true }}
        />
        <StatCard
          title="Collection"
          value={formatINRCompact(14_23_56_000)}
          subtitle="target reached"
          icon={<IndianRupee className="h-4 w-4 text-emerald-500" />}
          iconBg="bg-emerald-500/10"
          trend={{ value: "84.3%", positive: true }}
          highlight
        />
        <StatCard
          title="Pending"
          value="26"
          subtitle="actions needed"
          icon={<Clock className="h-4 w-4 text-orange-400" />}
          iconBg="bg-orange-500/10"
          trend={{ value: "14 Urgent", positive: false }}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Fee Collection Trend */}
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Fee Collection Trend
                </h3>
                <p className="text-xs text-gray-400">
                  Monthly breakdown vs projected targets (AY 2025-26)
                </p>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2 text-xs">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-gray-400">Actual</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="h-2 w-2 rounded-full bg-gray-700" />
                  <span className="text-gray-400">Projected</span>
                </div>
              </div>
            </div>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={MOCK_FEE_DATA}
                  margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                  barGap={2}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#1E1E1E"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#6B7280", fontSize: 11 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#6B7280", fontSize: 11 }}
                    tickFormatter={(v) => formatINRCompact(v)}
                  />
                  <Tooltip content={<FeeTooltip />} />
                  <Bar
                    dataKey="projected"
                    name="Projected"
                    fill="#374151"
                    radius={[4, 4, 0, 0]}
                    barSize={14}
                  />
                  <Bar
                    dataKey="actual"
                    name="Actual"
                    fill="#10B981"
                    radius={[4, 4, 0, 0]}
                    barSize={14}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Student Phases */}
        <Card>
          <CardContent className="flex h-full flex-col p-5">
            <h3 className="mb-2 text-sm font-bold text-white">
              Student Phases
            </h3>
            <div className="flex flex-1 flex-col items-center justify-center">
              <div className="relative h-44 w-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={MOCK_PHASE_DATA}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {MOCK_PHASE_DATA.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xs text-gray-400">Total</span>
                  <span className="text-lg font-bold text-white">2,450</span>
                </div>
              </div>
              <div className="mt-4 w-full space-y-2">
                {MOCK_PHASE_DATA.map((phase) => (
                  <div
                    key={phase.name}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: phase.color }}
                      />
                      <span className="text-gray-300">{phase.name}</span>
                    </div>
                    <span className="font-medium text-white">
                      {phase.percentage}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Pending Approvals */}
        <Card>
          <div className="flex items-center justify-between border-b border-dark-border p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-white">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Pending Approvals
            </h3>
            <button className="text-xs text-emerald-500 hover:underline">
              View All (26)
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-400">
              <thead className="bg-[#0f0f0f] text-[10px] uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Request Type</th>
                  <th className="px-4 py-3 font-medium">Requester</th>
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {MOCK_APPROVALS.map((approval) => (
                  <tr
                    key={approval.id}
                    className="group cursor-pointer transition-colors hover:bg-white/5"
                  >
                    <td className="px-4 py-3 font-medium text-white">
                      {approval.type}
                      <div className="text-[10px] font-normal text-gray-500">
                        #{approval.requestId}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-700 text-[9px] text-white">
                          {approval.requesterInitials}
                        </div>
                        <span>{approval.requesterName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          approval.priority === "high"
                            ? "destructive"
                            : approval.priority === "medium"
                              ? "warning"
                              : "info"
                        }
                      >
                        {approval.priority}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          className="flex h-6 w-6 items-center justify-center rounded bg-emerald-500/20 text-emerald-500 transition-colors hover:bg-emerald-500 hover:text-white"
                          aria-label="Approve request"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          className="flex h-6 w-6 items-center justify-center rounded bg-red-500/20 text-red-500 transition-colors hover:bg-red-500 hover:text-white"
                          aria-label="Reject request"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Recent Admissions */}
        <Card>
          <div className="flex items-center justify-between border-b border-dark-border p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-white">
              <GraduationCap className="h-4 w-4 text-blue-500" />
              Recent Admissions
            </h3>
            <button className="text-xs text-emerald-500 hover:underline">
              Full List
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-400">
              <thead className="bg-[#0f0f0f] text-[10px] uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Department</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Fee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {MOCK_ADMISSIONS.map((admission) => (
                  <tr
                    key={admission.id}
                    className="cursor-pointer transition-colors hover:bg-white/5"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded bg-gray-700 text-[10px] text-white">
                          {admission.studentInitials}
                        </div>
                        <div>
                          <div className="font-medium text-white">
                            {admission.studentName}
                          </div>
                          <div className="text-[9px]">
                            {admission.enrollmentNo}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">{admission.department}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            admission.status === "active"
                              ? "bg-emerald-500"
                              : admission.status === "pending"
                                ? "bg-yellow-500"
                                : "bg-blue-500"
                          }`}
                        />
                        <span className="capitalize">{admission.status}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span
                        className={`font-medium capitalize ${
                          admission.feeStatus === "paid"
                            ? "text-gray-300"
                            : admission.feeStatus === "due"
                              ? "text-orange-400"
                              : "text-yellow-400"
                        }`}
                      >
                        {admission.feeStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-dark-surface/70 p-4 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Quick Actions</h4>
            <p className="text-[10px] text-gray-400">
              Frequently used shortcuts for admin tasks
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            size="sm"
            className="border-gray-700 bg-gray-800/50 text-gray-300 hover:bg-gray-700/80"
          >
            <FileText className="h-4 w-4" />
            Generate Report
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-gray-700 bg-gray-800/50 text-gray-300 hover:bg-gray-700/80"
          >
            <CalendarDays className="h-4 w-4" />
            Manage Schedule
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-gray-700 bg-gray-800/50 text-gray-300 hover:bg-gray-700/80"
          >
            <Mail className="h-4 w-4" />
            Broadcast Msg
          </Button>
        </div>
      </div>
    </div>
  );
}
