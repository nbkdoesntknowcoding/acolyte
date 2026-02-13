"use client";

import { useState, useMemo } from "react";
import {
  Wallet,
  CreditCard,
  Clock,
  AlertTriangle,
  Download,
  Bell,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  type TooltipProps,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatINRCompact, formatINRCurrency } from "@/lib/format";
import { RecordPaymentDialog } from "@/components/admin/record-payment-dialog";
import {
  useCollectionSummary,
  useFeeTrend,
  useFeePayments,
  useFeeDefaulters,
} from "@/lib/hooks/admin/use-fee-collection";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  completed: { bg: "bg-emerald-500/10 border-emerald-500/20", text: "text-emerald-400", label: "Completed" },
  pending: { bg: "bg-yellow-500/10 border-yellow-500/20", text: "text-yellow-400", label: "Pending" },
  failed: { bg: "bg-red-500/10 border-red-500/20", text: "text-red-400", label: "Failed" },
  refunded: { bg: "bg-gray-700 border-gray-600", text: "text-gray-300", label: "Refunded" },
};

// ---------------------------------------------------------------------------
// Chart Tooltip
// ---------------------------------------------------------------------------

function ChartTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-dark-surface border border-dark-border rounded-lg p-3 shadow-xl text-xs">
      <p className="text-white font-semibold mb-1">{label}</p>
      {payload.map((entry) => (
        <div
          key={entry.name}
          className="flex items-center justify-between gap-4 py-0.5"
        >
          <span className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-400">Collected</span>
          </span>
          <span className="text-white font-medium">
            {formatINRCurrency((entry.value as number) / 100)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FeeCollectionPage() {
  const [academicYear, setAcademicYear] = useState("2025-26");
  const [paymentPage, setPaymentPage] = useState(1);
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [defaulterPage, setDefaulterPage] = useState(1);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  // Data hooks
  const summary = useCollectionSummary(academicYear);
  const trend = useFeeTrend(academicYear);
  const payments = useFeePayments({
    page: paymentPage,
    page_size: 10,
    academic_year: academicYear,
    status: paymentStatus !== "all" ? paymentStatus : undefined,
  });
  const defaulters = useFeeDefaulters(academicYear, {
    page: defaulterPage,
    page_size: 10,
  });

  // Chart data — transform FeeTrendPoint[] → recharts format
  const chartData = useMemo(() => {
    if (!trend.data) return [];
    return trend.data.map((pt) => ({
      month: MONTH_NAMES[pt.month - 1] ?? `M${pt.month}`,
      Amount: pt.amount, // paisa — formatted in tooltip
      count: pt.count,
    }));
  }, [trend.data]);

  // Derived stats from collection summary
  const totalExpected = summary.data?.grand_total_expected ?? 0;
  const totalCollected = summary.data?.grand_total_collected ?? 0;
  const outstanding = totalExpected - totalCollected;
  const collectionPct =
    totalExpected > 0
      ? Math.round((totalCollected / totalExpected) * 100)
      : 0;

  const isLoading = summary.isLoading;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Fee Collection</h1>
          <p className="text-sm text-gray-400 mt-1">
            Academic Year {academicYear} Overview
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={academicYear} onValueChange={setAcademicYear}>
            <SelectTrigger className="h-9 w-36 bg-dark-elevated border-dark-border text-gray-300">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2025-26">2025-26</SelectItem>
              <SelectItem value="2024-25">2024-25</SelectItem>
              <SelectItem value="2023-24">2023-24</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="w-4 h-4" /> Export
          </Button>
          {/* TODO: Send Bulk Reminders */}
          <Button className="shadow-lg shadow-emerald-500/20" disabled>
            <Bell className="w-4 h-4" /> Send Bulk Reminders
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Receivable */}
        <Card>
          <CardContent className="p-5">
            <div className="flex justify-between items-start mb-2">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Wallet className="w-5 h-5 text-blue-500" />
              </div>
              <Badge variant="info" className="text-[10px]">
                Total
              </Badge>
            </div>
            <h3 className="text-2xl font-bold text-white mt-2">
              {isLoading ? "..." : formatINRCompact(totalExpected / 100)}
            </h3>
            <p className="text-sm text-gray-400 mt-1">Total Receivable</p>
          </CardContent>
        </Card>

        {/* Collected */}
        <Card>
          <CardContent className="p-5">
            <div className="flex justify-between items-start mb-2">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <CreditCard className="w-5 h-5 text-emerald-500" />
              </div>
              <Badge className="text-[10px]">{collectionPct}%</Badge>
            </div>
            <h3 className="text-2xl font-bold text-white mt-2">
              {isLoading ? "..." : formatINRCompact(totalCollected / 100)}
            </h3>
            <div className="flex items-center justify-between mt-1">
              <p className="text-sm text-gray-400">Collected</p>
              <span className="text-sm font-semibold text-emerald-500">
                {collectionPct}%
              </span>
            </div>
            <div className="w-full bg-dark-elevated h-1.5 mt-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all"
                style={{ width: `${collectionPct}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Outstanding */}
        <Card>
          <CardContent className="p-5">
            <div className="flex justify-between items-start mb-2">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Clock className="w-5 h-5 text-orange-500" />
              </div>
              <Badge variant="warning" className="text-[10px]">
                Due
              </Badge>
            </div>
            <h3 className="text-2xl font-bold text-white mt-2">
              {isLoading ? "..." : formatINRCompact(outstanding / 100)}
            </h3>
            <p className="text-sm text-gray-400 mt-1">Outstanding Balance</p>
          </CardContent>
        </Card>

        {/* Defaulters */}
        <Card>
          <CardContent className="p-5">
            <div className="flex justify-between items-start mb-2">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <Badge variant="destructive" className="text-[10px]">
                Critical
              </Badge>
            </div>
            <h3 className="text-2xl font-bold text-white mt-2">
              {defaulters.isLoading ? "..." : (defaulters.data?.total ?? 0)}
            </h3>
            <p className="text-sm text-gray-400 mt-1">Fee Defaulters</p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Collection Trends Chart */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">
            Monthly Fee Collection Trends
          </h2>
        </div>
        <div className="h-64 w-full">
          {trend.isLoading ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading
              chart...
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              No collection data for this period.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barCategoryGap="20%">
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#9ca3af", fontSize: 10, fontWeight: 500 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#6b7280", fontSize: 10 }}
                  tickFormatter={(v: number) => formatINRCompact(v / 100)}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                />
                <Bar
                  dataKey="Amount"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Payments / Defaulters Tabs */}
      <Tabs defaultValue="payments" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="payments">Recent Payments</TabsTrigger>
            <TabsTrigger value="defaulters">
              Defaulters
              {defaulters.data && defaulters.data.total > 0 && (
                <span className="ml-1.5 text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">
                  {defaulters.data.total}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          <Button
            onClick={() => setPaymentDialogOpen(true)}
            className="shadow-lg shadow-emerald-500/20"
          >
            Record Payment
          </Button>
        </div>

        {/* Payments Tab */}
        <TabsContent value="payments">
          <Card className="overflow-hidden">
            {/* Filter bar */}
            <div className="p-4 border-b border-dark-border flex items-center gap-3">
              <Select
                value={paymentStatus}
                onValueChange={(v) => {
                  setPaymentStatus(v);
                  setPaymentPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-auto text-sm bg-dark-elevated border-dark-border text-gray-300">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Payments Table */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-dark-border bg-dark-elevated/50 hover:bg-dark-elevated/50">
                    <TableHead className="p-4 text-xs uppercase font-semibold text-gray-400">
                      Date
                    </TableHead>
                    <TableHead className="p-4 text-xs uppercase font-semibold text-gray-400">
                      Receipt #
                    </TableHead>
                    <TableHead className="p-4 text-xs uppercase font-semibold text-gray-400 text-right">
                      Amount
                    </TableHead>
                    <TableHead className="p-4 text-xs uppercase font-semibold text-gray-400">
                      Method
                    </TableHead>
                    <TableHead className="p-4 text-xs uppercase font-semibold text-gray-400">
                      Reference
                    </TableHead>
                    <TableHead className="p-4 text-xs uppercase font-semibold text-gray-400">
                      Student ID
                    </TableHead>
                    <TableHead className="p-4 text-xs uppercase font-semibold text-gray-400 text-center">
                      Status
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.isLoading ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center py-8 text-gray-500"
                      >
                        <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
                        Loading payments...
                      </TableCell>
                    </TableRow>
                  ) : !payments.data?.data?.length ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center py-8 text-gray-500"
                      >
                        No payments found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    payments.data.data.map((payment) => {
                      const st =
                        STATUS_STYLES[payment.status] ?? STATUS_STYLES.pending;
                      return (
                        <TableRow
                          key={payment.id}
                          className="border-dark-border hover:bg-dark-elevated/20 transition-colors"
                        >
                          <TableCell className="p-4 text-gray-300">
                            {payment.payment_date
                              ? new Date(
                                  payment.payment_date,
                                ).toLocaleDateString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "-"}
                          </TableCell>
                          <TableCell className="p-4 text-gray-400 font-mono text-xs">
                            {payment.receipt_number ?? "-"}
                          </TableCell>
                          <TableCell className="p-4 text-right text-white font-medium">
                            {formatINRCurrency(payment.amount / 100)}
                          </TableCell>
                          <TableCell className="p-4 text-gray-300 capitalize">
                            {payment.payment_method?.replace(/_/g, " ") ?? "-"}
                          </TableCell>
                          <TableCell className="p-4 text-gray-400 font-mono text-xs">
                            {payment.reference_number ?? "-"}
                          </TableCell>
                          <TableCell className="p-4 text-gray-500 font-mono text-xs">
                            {payment.student_id.slice(0, 8)}...
                          </TableCell>
                          <TableCell className="p-4 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${st.bg} ${st.text}`}
                            >
                              {st.label}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {payments.data && payments.data.total_pages > 1 && (
              <div className="p-4 border-t border-dark-border flex items-center justify-between text-sm text-gray-400">
                <div>
                  Page {payments.data.page} of {payments.data.total_pages} (
                  {payments.data.total} payments)
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPaymentPage((p) => Math.max(1, p - 1))}
                    disabled={paymentPage <= 1}
                    className="p-1 rounded hover:bg-dark-elevated disabled:opacity-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 py-1 bg-dark-elevated text-white rounded text-sm">
                    {paymentPage}
                  </span>
                  <button
                    onClick={() => setPaymentPage((p) => p + 1)}
                    disabled={
                      paymentPage >= (payments.data?.total_pages ?? 1)
                    }
                    className="p-1 rounded hover:bg-dark-elevated disabled:opacity-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Defaulters Tab */}
        <TabsContent value="defaulters">
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-dark-border bg-dark-elevated/50 hover:bg-dark-elevated/50">
                    <TableHead className="p-4 text-xs uppercase font-semibold text-gray-400">
                      Student
                    </TableHead>
                    <TableHead className="p-4 text-xs uppercase font-semibold text-gray-400">
                      Enrollment
                    </TableHead>
                    <TableHead className="p-4 text-xs uppercase font-semibold text-gray-400">
                      Quota
                    </TableHead>
                    <TableHead className="p-4 text-xs uppercase font-semibold text-gray-400 text-right">
                      Overdue Amount
                    </TableHead>
                    <TableHead className="p-4 text-xs uppercase font-semibold text-gray-400 text-right">
                      Late Fee
                    </TableHead>
                    <TableHead className="p-4 text-xs uppercase font-semibold text-gray-400 text-right">
                      Days Overdue
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {defaulters.isLoading ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-8 text-gray-500"
                      >
                        <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
                        Loading defaulters...
                      </TableCell>
                    </TableRow>
                  ) : !defaulters.data?.data?.length ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-8 text-gray-500"
                      >
                        No fee defaulters found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    defaulters.data.data.map((d) => (
                      <TableRow
                        key={d.student_id}
                        className="border-dark-border hover:bg-dark-elevated/20 bg-red-500/5"
                      >
                        <TableCell className="p-4 text-white font-medium">
                          {d.student_name}
                        </TableCell>
                        <TableCell className="p-4 text-gray-400 font-mono text-xs">
                          {d.enrollment_number}
                        </TableCell>
                        <TableCell className="p-4 text-gray-300">
                          {d.quota}
                        </TableCell>
                        <TableCell className="p-4 text-right text-red-400 font-bold">
                          {formatINRCurrency(d.overdue_amount / 100)}
                        </TableCell>
                        <TableCell className="p-4 text-right text-orange-400">
                          {formatINRCurrency(d.late_fee / 100)}
                        </TableCell>
                        <TableCell className="p-4 text-right text-red-400 font-medium">
                          {d.days_overdue} days
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {defaulters.data && defaulters.data.total_pages > 1 && (
              <div className="p-4 border-t border-dark-border flex items-center justify-between text-sm text-gray-400">
                <div>
                  Page {defaulters.data.page} of{" "}
                  {defaulters.data.total_pages} ({defaulters.data.total}{" "}
                  defaulters)
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setDefaulterPage((p) => Math.max(1, p - 1))
                    }
                    disabled={defaulterPage <= 1}
                    className="p-1 rounded hover:bg-dark-elevated disabled:opacity-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 py-1 bg-dark-elevated text-white rounded text-sm">
                    {defaulterPage}
                  </span>
                  <button
                    onClick={() => setDefaulterPage((p) => p + 1)}
                    disabled={
                      defaulterPage >= (defaulters.data?.total_pages ?? 1)
                    }
                    className="p-1 rounded hover:bg-dark-elevated disabled:opacity-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Record Payment Dialog */}
      <RecordPaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        academicYear={academicYear}
      />
    </div>
  );
}
