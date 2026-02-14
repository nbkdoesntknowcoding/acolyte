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
  Check,
  X,
  Zap,
  FileText,
  CalendarDays,
  Mail,
  Activity,
  QrCode,
  UtensilsCrossed,
  BookOpen,
  Building2,
  CheckCircle2,
  XCircle,
  ArrowRight,
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatCard } from "@/components/admin/stat-card";
import { formatINRCompact } from "@/lib/format";
import { formatINRShort, paisaToRupees } from "@/lib/utils/currency";
import {
  useDashboardStats,
  useFeeCollectionTrend,
  usePendingApprovals,
  useRecentActivity,
  useStudentDistribution,
} from "@/lib/hooks/admin/use-dashboard";
import type {
  FeeTrendItem,
  PendingApprovalItem,
  RecentActivityItem,
} from "@/lib/hooks/admin/use-dashboard";
import { useScanLogs, useScanLogSummary } from "@/lib/hooks/admin/use-scan-logs";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Month name helper
// ---------------------------------------------------------------------------

const MONTH_SHORT = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function feeTrendToChart(items: FeeTrendItem[]) {
  return items.map((item) => ({
    month: MONTH_SHORT[item.month] || `M${item.month}`,
    actual: paisaToRupees(item.amount),
    count: item.count,
  }));
}

// ---------------------------------------------------------------------------
// Phase pie chart colors
// ---------------------------------------------------------------------------

const PHASE_COLORS: Record<string, string> = {
  "Phase I": "#10B981",
  "Phase II": "#3B82F6",
  "Phase III": "#8B5CF6",
  CRMI: "#F59E0B",
  Unassigned: "#6B7280",
};

function phaseColor(phase: string): string {
  for (const [key, color] of Object.entries(PHASE_COLORS)) {
    if (phase.includes(key)) return color;
  }
  return "#6B7280";
}

// ---------------------------------------------------------------------------
// Section Error State
// ---------------------------------------------------------------------------

function SectionError({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <p className="text-xs text-red-400">{message || "Failed to load"}</p>
      {onRetry && (
        <Button
          onClick={onRetry}
          variant="outline"
          size="sm"
          className="mt-2"
        >
          Retry
        </Button>
      )}
    </div>
  );
}

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
// Skeleton components for each section
// ---------------------------------------------------------------------------

function StatCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="flex h-28 flex-col justify-between p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-16" />
              </div>
              <Skeleton className="h-8 w-8 rounded" />
            </div>
            <Skeleton className="h-3 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
      </div>
      <Skeleton className="h-[260px] w-full rounded" />
    </div>
  );
}

function TableSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

function PieSkeleton() {
  return (
    <div className="flex flex-col items-center space-y-3 p-4">
      <Skeleton className="h-44 w-44 rounded-full" />
      <div className="w-full space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function priorityBadgeVariant(
  priority: string
): "destructive" | "warning" | "info" | "outline" {
  if (priority === "urgent" || priority === "high") return "destructive";
  if (priority === "normal" || priority === "medium") return "warning";
  return "info";
}

function activityColor(action: string) {
  if (action === "create") return "bg-emerald-500/20";
  if (action === "update") return "bg-blue-500/20";
  if (action === "delete") return "bg-red-500/20";
  return "bg-gray-500/20";
}

function activityIconColor(action: string) {
  if (action === "create") return "text-emerald-400";
  if (action === "update") return "text-blue-400";
  if (action === "delete") return "text-red-400";
  return "text-gray-400";
}

function initials(name: string | null | undefined): string {
  if (!name) return "??";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function AdminDashboard() {
  const today = format(new Date(), "MMM dd, yyyy");

  const statsQuery = useDashboardStats();
  const feeTrendQuery = useFeeCollectionTrend();
  const approvalsQuery = usePendingApprovals(5);
  const activityQuery = useRecentActivity(5);
  const distributionQuery = useStudentDistribution();

  // Campus Activity (QR)
  const todayISO = format(new Date(), "yyyy-MM-dd");
  const { data: summaryData } = useScanLogSummary(1);
  const { data: recentScans } = useScanLogs({ page_size: 5 }, { refetchInterval: 30_000 });

  // Derive today's counts from summary (day=1 gives last 24h data)
  const todayMess = summaryData?.data?.filter((d) => d.action_type === "mess_entry").reduce((s, d) => s + d.count, 0) ?? 0;
  const todayLibrary = summaryData?.data?.filter((d) => d.action_type === "library_checkout").reduce((s, d) => s + d.count, 0) ?? 0;
  const todayAttendance = summaryData?.data?.filter((d) => d.action_type === "attendance_mark").reduce((s, d) => s + d.count, 0) ?? 0;
  const todayHostel = summaryData?.data?.filter((d) => d.action_type === "hostel_checkin").reduce((s, d) => s + d.count, 0) ?? 0;

  const stats = statsQuery.data;

  // Transform student distribution to pie chart data
  const phaseData = distributionQuery.data
    ? Object.entries(distributionQuery.data.by_phase).map(([name, value]) => ({
        name,
        value,
        color: phaseColor(name),
      }))
    : [];
  const totalStudents = phaseData.reduce((sum, p) => sum + p.value, 0);

  // Transform fee trend for recharts
  const feeChartData = feeTrendQuery.data
    ? feeTrendToChart(feeTrendQuery.data)
    : [];

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
      {statsQuery.isLoading ? (
        <StatCardsSkeleton />
      ) : statsQuery.isError ? (
        <SectionError
          message={statsQuery.error?.message}
          onRetry={() => statsQuery.refetch()}
        />
      ) : stats ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Students"
            value={stats.students.total.toLocaleString("en-IN")}
            subtitle={`${stats.students.active.toLocaleString("en-IN")} active`}
            icon={<Users className="h-4 w-4 text-blue-400" />}
            iconBg="bg-blue-500/10"
            trend={
              stats.students.admission_pipeline > 0
                ? {
                    value: `${stats.students.admission_pipeline} in pipeline`,
                    positive: true,
                  }
                : undefined
            }
          />
          <StatCard
            title="Faculty"
            value={stats.faculty.total.toLocaleString("en-IN")}
            subtitle={`${stats.faculty.active.toLocaleString("en-IN")} active`}
            icon={<Stethoscope className="h-4 w-4 text-purple-400" />}
            iconBg="bg-purple-500/10"
            trend={
              stats.faculty.on_leave > 0
                ? {
                    value: `${stats.faculty.on_leave} on leave`,
                    positive: false,
                  }
                : undefined
            }
          />
          <StatCard
            title="Fee Collection"
            value={formatINRShort(stats.fee_collection.total_collected)}
            subtitle={`AY ${stats.fee_collection.academic_year}`}
            icon={<IndianRupee className="h-4 w-4 text-emerald-500" />}
            iconBg="bg-emerald-500/10"
            trend={{
              value: `${stats.fee_collection.payment_count} payments`,
              positive: true,
            }}
            highlight
          />
          <StatCard
            title="Pending"
            value={String(
              stats.pending_approvals +
                stats.pending_leaves +
                stats.active_grievances
            )}
            subtitle="actions needed"
            icon={<Clock className="h-4 w-4 text-orange-400" />}
            iconBg="bg-orange-500/10"
            trend={
              stats.pending_approvals > 0
                ? {
                    value: `${stats.pending_approvals} approvals`,
                    positive: false,
                  }
                : undefined
            }
          />
        </div>
      ) : null}

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Fee Collection Trend */}
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            {feeTrendQuery.isLoading ? (
              <ChartSkeleton />
            ) : feeTrendQuery.isError ? (
              <SectionError
                message={feeTrendQuery.error?.message}
                onRetry={() => feeTrendQuery.refetch()}
              />
            ) : feeChartData.length === 0 ? (
              <div className="flex h-[300px] flex-col items-center justify-center text-center">
                <p className="text-sm text-gray-400">
                  No fee collection data yet
                </p>
                <p className="text-xs text-gray-500">
                  Payments will appear here once recorded
                </p>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Fee Collection Trend
                    </h3>
                    <p className="text-xs text-gray-400">
                      Monthly breakdown (
                      {stats?.fee_collection.academic_year || "current AY"})
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-gray-400">Collected</span>
                    </div>
                  </div>
                </div>
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={feeChartData}
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
                        dataKey="actual"
                        name="Collected"
                        fill="#10B981"
                        radius={[4, 4, 0, 0]}
                        barSize={18}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Student Phases */}
        <Card>
          <CardContent className="flex h-full flex-col p-5">
            <h3 className="mb-2 text-sm font-bold text-white">
              Student Phases
            </h3>
            {distributionQuery.isLoading ? (
              <PieSkeleton />
            ) : distributionQuery.isError ? (
              <SectionError
                message={distributionQuery.error?.message}
                onRetry={() => distributionQuery.refetch()}
              />
            ) : phaseData.length === 0 ? (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-xs text-gray-400">No student data</p>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center">
                <div className="relative h-44 w-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={phaseData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {phaseData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xs text-gray-400">Total</span>
                    <span className="text-lg font-bold text-white">
                      {totalStudents.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
                <div className="mt-4 w-full space-y-2">
                  {phaseData.map((phase) => (
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
                        {totalStudents > 0
                          ? Math.round((phase.value / totalStudents) * 100)
                          : 0}
                        %
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Campus Activity (Live) */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-dark-border p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-white">
            <QrCode className="h-4 w-4 text-emerald-500" />
            Campus Activity (Live)
          </h3>
          <Link href="/dashboard/admin/qr/analytics" className="flex items-center gap-1 text-xs text-emerald-500 hover:underline">
            View Analytics <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <CardContent className="p-4">
          {/* Today's numbers */}
          <div className="mb-4 grid grid-cols-4 gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-dark-border bg-dark-elevated/30 p-3">
              <UtensilsCrossed className="h-4 w-4 text-orange-400" />
              <div>
                <p className="text-lg font-bold text-white">{todayMess}</p>
                <p className="text-[10px] text-gray-500">Mess</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-dark-border bg-dark-elevated/30 p-3">
              <BookOpen className="h-4 w-4 text-blue-400" />
              <div>
                <p className="text-lg font-bold text-white">{todayLibrary}</p>
                <p className="text-[10px] text-gray-500">Library</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-dark-border bg-dark-elevated/30 p-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <div>
                <p className="text-lg font-bold text-white">{todayAttendance}</p>
                <p className="text-[10px] text-gray-500">Attendance</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-dark-border bg-dark-elevated/30 p-3">
              <Building2 className="h-4 w-4 text-purple-400" />
              <div>
                <p className="text-lg font-bold text-white">{todayHostel}</p>
                <p className="text-[10px] text-gray-500">Hostel</p>
              </div>
            </div>
          </div>

          {/* Mini timeline */}
          {recentScans && recentScans.length > 0 ? (
            <div className="space-y-1">
              {recentScans.map((scan) => {
                const isFail = scan.validation_result !== "success";
                const label = scan.action_type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
                const time = new Date(scan.scanned_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
                return (
                  <div key={scan.id} className="flex items-center gap-2 px-2 py-1.5 text-xs">
                    {isFail ? (
                      <XCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    )}
                    <span className={isFail ? "text-red-400" : "text-white"}>{label}</span>
                    <span className="flex-1 text-gray-600">·</span>
                    <span className="text-gray-500">{time}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-xs text-gray-500">No recent QR activity</p>
          )}
        </CardContent>
      </Card>

      {/* Tables Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Pending Approvals */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-dark-border p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-white">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Pending Approvals
            </h3>
            <Button variant="link" size="sm" className="h-auto p-0 text-xs">
              View All{stats ? ` (${stats.pending_approvals})` : ""}
            </Button>
          </div>
          {approvalsQuery.isLoading ? (
            <TableSkeleton rows={3} />
          ) : approvalsQuery.isError ? (
            <SectionError
              message={approvalsQuery.error?.message}
              onRetry={() => approvalsQuery.refetch()}
            />
          ) : !approvalsQuery.data?.length ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-xs text-gray-400">No pending approvals</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-dark-border bg-dark-elevated/50 hover:bg-dark-elevated/50">
                  <TableHead className="px-4 py-3 text-[10px] uppercase font-medium text-gray-500">
                    Request
                  </TableHead>
                  <TableHead className="px-4 py-3 text-[10px] uppercase font-medium text-gray-500">
                    Requester
                  </TableHead>
                  <TableHead className="px-4 py-3 text-[10px] uppercase font-medium text-gray-500">
                    Priority
                  </TableHead>
                  <TableHead className="px-4 py-3 text-[10px] uppercase font-medium text-gray-500 text-right">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvalsQuery.data.map((approval: PendingApprovalItem) => (
                  <TableRow
                    key={approval.id}
                    className="group cursor-pointer border-dark-border hover:bg-white/5"
                  >
                    <TableCell className="px-4 py-3 text-xs font-medium text-white">
                      {approval.title || approval.workflow_type}
                      <div className="text-[10px] font-normal text-gray-500">
                        {approval.workflow_type}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-xs text-gray-400">
                      <div className="flex items-center gap-2">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-700 text-[9px] text-white">
                          {initials(approval.requested_by_name)}
                        </div>
                        <span>
                          {approval.requested_by_name || "Unknown"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <Badge variant={priorityBadgeVariant(approval.priority)}>
                        {approval.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-white"
                          aria-label="Approve request"
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white"
                          aria-label="Reject request"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        {/* Recent Activity */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-dark-border p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-white">
              <Activity className="h-4 w-4 text-blue-500" />
              Recent Activity
            </h3>
            <Button variant="link" size="sm" className="h-auto p-0 text-xs">
              View All
            </Button>
          </div>
          {activityQuery.isLoading ? (
            <TableSkeleton rows={3} />
          ) : activityQuery.isError ? (
            <SectionError
              message={activityQuery.error?.message}
              onRetry={() => activityQuery.refetch()}
            />
          ) : !activityQuery.data?.length ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-xs text-gray-400">No recent activity</p>
            </div>
          ) : (
            <div className="divide-y divide-dark-border">
              {activityQuery.data.map((item: RecentActivityItem) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-white/5"
                >
                  <div
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${activityColor(item.action)} ${activityIconColor(item.action)}`}
                  >
                    <Activity className="h-3 w-3" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-white">
                      <span className="font-medium">
                        {item.user_name || "System"}
                      </span>{" "}
                      <span className="text-gray-400">{item.action}</span>{" "}
                      <span className="text-gray-300">{item.entity_type}</span>
                    </p>
                    <p className="text-[10px] text-gray-500">
                      {item.timestamp
                        ? format(new Date(item.timestamp), "MMM dd, h:mm a")
                        : "—"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
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
