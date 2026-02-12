"use client";

import { useState } from "react";
import {
  Wallet,
  CreditCard,
  Clock,
  AlertTriangle,
  Download,
  Bell,
  Search,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
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
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
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
import { formatINR, formatINRCurrency } from "@/lib/format";
import { RecordPaymentDialog } from "@/components/admin/record-payment-dialog";
import type {
  MonthlyCollectionData,
  StudentFeeLedgerEntry,
  FeePaymentStatus,
} from "@/types/admin";

// ---------------------------------------------------------------------------
// Mock data — TODO: Replace with API calls
// ---------------------------------------------------------------------------

const MONTHLY_DATA: MonthlyCollectionData[] = [
  { month: "Aug", upi: 30, card: 20, netBanking: 20, neft: 15, dd: 10, cash: 5 },
  { month: "Sep", upi: 30, card: 15, netBanking: 30, neft: 10, dd: 10, cash: 5 },
  { month: "Oct", upi: 30, card: 20, netBanking: 25, neft: 15, dd: 5, cash: 5 },
  { month: "Nov", upi: 30, card: 20, netBanking: 20, neft: 10, dd: 10, cash: 10 },
  { month: "Dec", upi: 30, card: 20, netBanking: 20, neft: 10, dd: 15, cash: 5 },
  { month: "Jan", upi: 25, card: 20, netBanking: 30, neft: 15, dd: 8, cash: 2 },
  { month: "Feb", upi: 25, card: 20, netBanking: 25, neft: 15, dd: 10, cash: 5 },
  { month: "Mar", upi: 25, card: 20, netBanking: 25, neft: 20, dd: 5, cash: 5 },
  { month: "Apr", upi: 25, card: 20, netBanking: 25, neft: 20, dd: 5, cash: 5 },
  { month: "May", upi: 25, card: 20, netBanking: 25, neft: 20, dd: 5, cash: 5 },
  { month: "Jun", upi: 25, card: 20, netBanking: 25, neft: 20, dd: 5, cash: 5 },
  { month: "Jul", upi: 25, card: 20, netBanking: 25, neft: 20, dd: 5, cash: 5 },
];

// Scale factors to match visual bar heights from Stitch (percentage of max)
const MONTH_SCALE: Record<string, number> = {
  Aug: 0.4, Sep: 0.65, Oct: 0.55, Nov: 0.3, Dec: 0.45,
  Jan: 0.9, Feb: 0.75, Mar: 0.6, Apr: 0.4, May: 0.35,
  Jun: 0.5, Jul: 0.8,
};

const SCALED_DATA = MONTHLY_DATA.map((d) => {
  const scale = MONTH_SCALE[d.month] ?? 0.5;
  return {
    month: d.month,
    UPI: Math.round(d.upi * scale * 2),
    Card: Math.round(d.card * scale * 2),
    "Net Banking": Math.round(d.netBanking * scale * 2),
    NEFT: Math.round(d.neft * scale * 2),
    DD: Math.round(d.dd * scale * 2),
    Cash: Math.round(d.cash * scale * 2),
  };
});

const STUDENTS: StudentFeeLedgerEntry[] = [
  {
    id: "1", name: "Rahul Joshi", initials: "RJ", initialsColor: "indigo",
    enrollmentNo: "MBBS20220045", quota: "State Quota", phase: "Phase II (2nd Year)",
    totalFee: 300500, paid: 300500, balance: 0, lastPayment: "Aug 15, 2025",
    status: "paid_full",
  },
  {
    id: "2", name: "Ananya Singh", initials: "AS", initialsColor: "pink",
    enrollmentNo: "MBBS20220112", quota: "Management", phase: "Phase I (1st Year)",
    totalFee: 1250000, paid: 800000, balance: 450000, lastPayment: "Sep 02, 2025",
    status: "partial",
  },
  {
    id: "3", name: "Mohit Kumar", initials: "MK", initialsColor: "orange",
    enrollmentNo: "MBBS20210088", quota: "State Quota", phase: "Phase III (3rd Year)",
    totalFee: 300500, paid: 50000, balance: 250500, lastPayment: "May 10, 2025",
    status: "overdue",
  },
  {
    id: "4", name: "Sarah Jenkins", initials: "SJ", initialsColor: "teal",
    enrollmentNo: "MBBS20230156", quota: "NRI Quota", phase: "Phase I (1st Year)",
    totalFee: 2500000, paid: 0, balance: 2500000, lastPayment: null,
    status: "defaulter",
  },
  {
    id: "5", name: "Vikram Patel", initials: "VP", initialsColor: "purple",
    enrollmentNo: "MBBS20210032", quota: "State Quota", phase: "Phase III (3rd Year)",
    totalFee: 300500, paid: 300500, balance: 0, lastPayment: "Aug 20, 2025",
    status: "paid_full",
  },
];

const BAR_COLORS = {
  UPI: "#10b981",
  Card: "#3b82f6",
  "Net Banking": "#a855f7",
  NEFT: "#eab308",
  DD: "#f97316",
  Cash: "#6b7280",
};

const STATUS_STYLES: Record<FeePaymentStatus, { bg: string; text: string; label: string }> = {
  paid_full: { bg: "bg-emerald-500/10 border-emerald-500/20", text: "text-emerald-400", label: "Paid Full" },
  partial: { bg: "bg-blue-500/10 border-blue-500/20", text: "text-blue-400", label: "Partial" },
  overdue: { bg: "bg-red-500/10 border-red-500/20", text: "text-red-400", label: "Overdue" },
  defaulter: { bg: "bg-gray-700 border-gray-600", text: "text-gray-300", label: "Defaulter" },
};

const INITIALS_COLORS: Record<string, string> = {
  indigo: "bg-indigo-500/20 text-indigo-400",
  pink: "bg-pink-500/20 text-pink-400",
  orange: "bg-orange-500/20 text-orange-400",
  teal: "bg-teal-500/20 text-teal-400",
  purple: "bg-purple-500/20 text-purple-400",
};

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

function ChartTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-dark-surface border border-dark-border rounded-lg p-3 shadow-xl text-xs">
      <p className="text-white font-semibold mb-2">{label}</p>
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
            <span className="text-gray-400">{entry.name}</span>
          </span>
          <span className="text-white font-medium">{entry.value}%</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FeeCollectionPage() {
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [phaseFilter, setPhaseFilter] = useState("all");
  const [quotaFilter, setQuotaFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentFeeLedgerEntry | null>(null);

  const filteredStudents = STUDENTS.filter((s) => {
    if (overdueOnly && s.status !== "overdue" && s.status !== "defaulter") return false;
    if (phaseFilter !== "all" && !s.phase.toLowerCase().includes(phaseFilter.toLowerCase())) return false;
    if (quotaFilter !== "all" && !s.quota.toLowerCase().includes(quotaFilter.toLowerCase())) return false;
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (searchQuery && !s.name.toLowerCase().includes(searchQuery.toLowerCase()) && !s.enrollmentNo.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  function openPaymentDialog(student: StudentFeeLedgerEntry) {
    setSelectedStudent(student);
    setPaymentDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Fee Collection</h1>
          <p className="text-sm text-gray-400 mt-1">
            Academic Year 2025-26 Overview
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline">
            <Download className="w-4 h-4" /> Export Defaulters List
          </Button>
          <Button className="shadow-lg shadow-emerald-500/20">
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
              <Badge variant="info" className="text-[10px]">Total</Badge>
            </div>
            <h3 className="text-2xl font-bold text-white mt-2">
              ₹18,24,50,000
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
              <Badge className="text-[10px]">+12% vs LY</Badge>
            </div>
            <h3 className="text-2xl font-bold text-white mt-2">
              ₹14,23,56,000
            </h3>
            <div className="flex items-center justify-between mt-1">
              <p className="text-sm text-gray-400">Collected</p>
              <span className="text-sm font-semibold text-emerald-500">
                78%
              </span>
            </div>
            <div className="w-full bg-dark-elevated h-1.5 mt-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full"
                style={{ width: "78%" }}
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
              <Badge variant="warning" className="text-[10px]">Due Soon</Badge>
            </div>
            <h3 className="text-2xl font-bold text-white mt-2">
              ₹4,00,94,000
            </h3>
            <p className="text-sm text-gray-400 mt-1">Outstanding Balance</p>
          </CardContent>
        </Card>

        {/* Overdue */}
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
              ₹1,23,45,000
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-gray-400">Overdue</p>
              <span className="text-xs font-medium text-red-400 bg-red-500/10 px-1.5 rounded">
                47 Students
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Collection Trends Chart */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">
            Monthly Fee Collection Trends
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 text-xs text-gray-400">
              {Object.entries(BAR_COLORS).map(([name, color]) => (
                <span key={name} className="flex items-center gap-1.5">
                  <span
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: color }}
                  />
                  {name}
                </span>
              ))}
            </div>
            <Select defaultValue="12m">
              <SelectTrigger className="h-7 w-auto text-xs bg-dark-elevated border-dark-border text-gray-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12m">Last 12 Months</SelectItem>
                <SelectItem value="sem">Current Semester</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={SCALED_DATA} barCategoryGap="20%">
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#9ca3af", fontSize: 10, fontWeight: 500 }}
              />
              <YAxis hide />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
              />
              {Object.entries(BAR_COLORS).map(([key, color]) => (
                <Bar
                  key={key}
                  dataKey={key}
                  stackId="stack"
                  fill={color}
                  radius={key === "UPI" ? [4, 4, 0, 0] : undefined}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Student Fee Ledger */}
      <Card className="overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-dark-border flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-white shrink-0">
            Student Fee Ledger
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                placeholder="Search student..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-48 h-8 text-sm bg-dark-elevated border-dark-border text-gray-200 placeholder:text-gray-500"
              />
            </div>
            <Select value={phaseFilter} onValueChange={setPhaseFilter}>
              <SelectTrigger className="h-8 w-auto text-sm bg-dark-elevated border-dark-border text-gray-300">
                <SelectValue placeholder="All Phases" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Phases</SelectItem>
                <SelectItem value="phase i">Phase I</SelectItem>
                <SelectItem value="phase ii">Phase II</SelectItem>
                <SelectItem value="phase iii">Phase III</SelectItem>
              </SelectContent>
            </Select>
            <Select value={quotaFilter} onValueChange={setQuotaFilter}>
              <SelectTrigger className="h-8 w-auto text-sm bg-dark-elevated border-dark-border text-gray-300">
                <SelectValue placeholder="All Quotas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Quotas</SelectItem>
                <SelectItem value="state">State Quota</SelectItem>
                <SelectItem value="management">Management</SelectItem>
                <SelectItem value="nri">NRI</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-auto text-sm bg-dark-elevated border-dark-border text-gray-300">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Status</SelectItem>
                <SelectItem value="paid_full">Paid Full</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="defaulter">Defaulter</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center ml-2 border-l border-dark-border pl-4 gap-2">
              <span className="text-sm text-gray-400">Overdue Only</span>
              <Switch
                checked={overdueOnly}
                onCheckedChange={setOverdueOnly}
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-dark-border bg-dark-elevated/50 hover:bg-dark-elevated/50">
                <TableHead className="p-4 w-12 text-center">
                  <Checkbox className="border-gray-600" />
                </TableHead>
                <TableHead className="p-4 text-xs uppercase font-semibold text-gray-400 min-w-[200px]">
                  Student Name / Enrollment
                </TableHead>
                <TableHead className="p-4 text-xs uppercase font-semibold text-gray-400">
                  Quota / Phase
                </TableHead>
                <TableHead className="p-4 text-xs uppercase font-semibold text-gray-400 text-right">
                  Total Fee
                </TableHead>
                <TableHead className="p-4 text-xs uppercase font-semibold text-gray-400 text-right">
                  Paid
                </TableHead>
                <TableHead className="p-4 text-xs uppercase font-semibold text-gray-400 text-right">
                  Balance
                </TableHead>
                <TableHead className="p-4 text-xs uppercase font-semibold text-gray-400">
                  Last Payment
                </TableHead>
                <TableHead className="p-4 text-xs uppercase font-semibold text-gray-400 text-center">
                  Status
                </TableHead>
                <TableHead className="p-4 w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.map((student) => {
                const st = STATUS_STYLES[student.status];
                const ic = INITIALS_COLORS[student.initialsColor] ?? "bg-gray-500/20 text-gray-400";
                return (
                  <TableRow
                    key={student.id}
                    className={`border-dark-border hover:bg-dark-elevated/20 transition-colors ${student.status === "overdue" ? "bg-red-500/5" : ""}`}
                  >
                    <TableCell className="p-4 text-center">
                      <Checkbox className="border-gray-600" />
                    </TableCell>
                    <TableCell className="p-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full ${ic} flex items-center justify-center font-bold text-xs`}
                        >
                          {student.initials}
                        </div>
                        <div>
                          <p className="font-medium text-white">
                            {student.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {student.enrollmentNo}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="p-4 text-gray-300">
                      <div className="flex flex-col">
                        <span>{student.quota}</span>
                        <span className="text-xs text-gray-500">
                          {student.phase}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="p-4 text-right text-gray-300">
                      {formatINRCurrency(student.totalFee)}
                    </TableCell>
                    <TableCell
                      className={`p-4 text-right font-medium ${student.paid === student.totalFee ? "text-emerald-400" : "text-gray-300"}`}
                    >
                      {formatINRCurrency(student.paid)}
                    </TableCell>
                    <TableCell
                      className={`p-4 text-right ${student.balance > 0 ? (student.status === "overdue" || student.status === "defaulter" ? "text-red-400 font-bold" : "text-orange-400 font-medium") : "text-gray-500"}`}
                    >
                      {student.balance > 0
                        ? formatINRCurrency(student.balance)
                        : "-"}
                    </TableCell>
                    <TableCell className="p-4 text-gray-400">
                      {student.lastPayment ?? "-"}
                    </TableCell>
                    <TableCell className="p-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${st.bg} ${st.text}`}
                      >
                        {st.label}
                      </span>
                    </TableCell>
                    <TableCell className="p-4 text-center">
                      <button
                        onClick={() => openPaymentDialog(student)}
                        className="text-gray-500 hover:text-white transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-dark-border flex items-center justify-between text-sm text-gray-400">
          <div>Showing 1-{filteredStudents.length} of 124 students</div>
          <div className="flex items-center gap-2">
            <button
              className="p-1 rounded hover:bg-dark-elevated disabled:opacity-50"
              disabled
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button className="px-3 py-1 bg-dark-elevated text-white rounded">
              1
            </button>
            <button className="px-3 py-1 hover:bg-dark-elevated rounded">
              2
            </button>
            <button className="px-3 py-1 hover:bg-dark-elevated rounded">
              3
            </button>
            <span className="px-1">...</span>
            <button className="px-3 py-1 hover:bg-dark-elevated rounded">
              25
            </button>
            <button className="p-1 rounded hover:bg-dark-elevated">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Card>

      {/* Record Payment Dialog */}
      <RecordPaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        studentName={selectedStudent?.name}
        studentInitials={selectedStudent?.initials}
        enrollmentNo={selectedStudent?.enrollmentNo}
        quota={selectedStudent?.quota}
      />
    </div>
  );
}
