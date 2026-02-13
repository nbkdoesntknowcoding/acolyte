"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Download,
  Settings,
  PlayCircle,
  Search,
  Filter,
  ArrowRight,
  Calculator,
  CheckCircle2,
  Landmark,
  FileText,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";
import { formatINRCurrency, formatINRCompact } from "@/lib/format";
import {
  usePayrollRecords,
  useSalaryStructures,
  useStatutorySummary,
  useCalculatePayroll,
  useApprovePayroll,
  useGenerateBankFile,
} from "@/lib/hooks/admin/use-payroll";
import { useFaculty } from "@/lib/hooks/admin/use-faculty";
import type { FacultyResponse } from "@/types/admin-api";

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

type PipelineStep = "calculate" | "approve" | "bank_file" | "pay_slips";

const PIPELINE_STEPS: {
  id: PipelineStep;
  label: string;
  icon: typeof Calculator;
}[] = [
  { id: "calculate", label: "Calculate", icon: Calculator },
  { id: "approve", label: "Approve", icon: CheckCircle2 },
  { id: "bank_file", label: "Bank File", icon: Landmark },
  { id: "pay_slips", label: "Pay Slips", icon: FileText },
];

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  calculated: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  approved: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  disbursed: "bg-purple-500/10 text-purple-400 border-purple-500/20",
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

/** Convert paisa to rupees and format with ₹ */
function p(paisa: number) {
  return formatINRCurrency(paisa / 100);
}

/** Convert paisa to rupees compact (Cr/L) */
function pc(paisa: number) {
  return formatINRCompact(paisa / 100);
}

// ---------------------------------------------------------------------------
// Derive pipeline step from payroll record statuses
// ---------------------------------------------------------------------------

function derivePipelineStep(
  records: { status: string; bank_file_generated: boolean }[] | undefined,
): PipelineStep {
  if (!records || records.length === 0) return "calculate";
  const statuses = new Set(records.map((r) => r.status));
  if (statuses.has("disbursed")) return "pay_slips";
  if (records.some((r) => r.bank_file_generated)) return "pay_slips";
  if (statuses.has("approved")) return "bank_file";
  if (statuses.has("calculated")) return "approve";
  return "calculate";
}

function getStepStatus(stepId: PipelineStep, currentStep: PipelineStep) {
  const order: PipelineStep[] = [
    "calculate",
    "approve",
    "bank_file",
    "pay_slips",
  ];
  const currentIdx = order.indexOf(currentStep);
  const stepIdx = order.indexOf(stepId);
  if (stepIdx < currentIdx) return "completed";
  if (stepIdx === currentIdx) return "current";
  return "upcoming";
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PayrollPage() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [search, setSearch] = useState("");
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

  // --- Data hooks ---
  const payrollQ = usePayrollRecords({
    month: selectedMonth,
    year: selectedYear,
    page,
    page_size: pageSize,
  });

  const salaryStructuresQ = useSalaryStructures({ page_size: 50 });

  const statutoryQ = useStatutorySummary(selectedMonth, selectedYear, {
    enabled: (payrollQ.data?.total ?? 0) > 0,
  });

  // Faculty lookup for names
  const facultyQ = useFaculty({ page_size: 500 });

  const facultyMap = useMemo(() => {
    const m = new Map<
      string,
      { name: string; designation: string | null }
    >();
    if (facultyQ.data?.data) {
      for (const f of facultyQ.data.data as FacultyResponse[]) {
        m.set(f.id, { name: f.name, designation: f.designation });
      }
    }
    return m;
  }, [facultyQ.data]);

  // --- Mutations ---
  const calculateMut = useCalculatePayroll();
  const approveMut = useApprovePayroll();
  const bankFileMut = useGenerateBankFile();

  // --- Derived ---
  const records = useMemo(() => payrollQ.data?.data ?? [], [payrollQ.data?.data]);
  const totalRecords = payrollQ.data?.total ?? 0;
  const totalPages = payrollQ.data?.total_pages ?? 0;
  const structures = useMemo(() => salaryStructuresQ.data?.data ?? [], [salaryStructuresQ.data?.data]);
  const statutory = statutoryQ.data;

  const totalGross = statutory?.total_gross ?? 0;
  const totalNet = statutory?.total_net ?? 0;
  const employeeCount = statutory?.employee_count ?? totalRecords;

  // Derive pipeline step
  const currentStep = derivePipelineStep(records);
  const runStatusLabel =
    currentStep === "calculate"
      ? "Not Started"
      : currentStep === "approve"
        ? "Calculated"
        : currentStep === "bank_file"
          ? "Approved"
          : "Disbursed";
  const runStatusColor =
    currentStep === "calculate"
      ? "text-yellow-500"
      : currentStep === "approve"
        ? "text-blue-500"
        : currentStep === "bank_file"
          ? "text-emerald-500"
          : "text-purple-400";

  // --- Action handlers ---
  const handleCalculate = () => {
    calculateMut.mutate(
      { month: selectedMonth, year: selectedYear },
      {
        onSuccess: (data) => {
          showBanner(
            "success",
            `Payroll calculated for ${data.processed} employees${data.errors > 0 ? ` (${data.errors} errors)` : ""}`,
          );
        },
        onError: (err) => showBanner("error", err.message),
      },
    );
  };

  const handleApprove = () => {
    approveMut.mutate(
      { month: selectedMonth, year: selectedYear },
      {
        onSuccess: (data) => {
          showBanner("success", `${data.approved_count} records approved`);
        },
        onError: (err) => showBanner("error", err.message),
      },
    );
  };

  const handleBankFile = () => {
    bankFileMut.mutate(
      { month: selectedMonth, year: selectedYear },
      {
        onSuccess: (data) => {
          showBanner(
            "success",
            `Bank file generated: ${data.transfer_count} transfers, ${pc(data.total_amount)} total`,
          );
        },
        onError: (err) => showBanner("error", err.message),
      },
    );
  };

  const handlePaySlips = () => {
    // TODO: POST /payroll/generate-payslips not yet in backend
    showBanner("error", "Pay slip generation not yet implemented");
  };

  const handlePipelineAction = () => {
    if (currentStep === "calculate") handleCalculate();
    else if (currentStep === "approve") handleApprove();
    else if (currentStep === "bank_file") handleBankFile();
    else handlePaySlips();
  };

  const pipelineCTALabel =
    currentStep === "calculate"
      ? "Calculate Payroll"
      : currentStep === "approve"
        ? "Approve Payroll"
        : currentStep === "bank_file"
          ? "Generate Bank File"
          : "Generate Pay Slips";

  const pipelineLoading =
    calculateMut.isPending || approveMut.isPending || bankFileMut.isPending;

  // --- Filter records by search ---
  const filteredRecords = useMemo(() => {
    if (!search.trim()) return records;
    const q = search.toLowerCase();
    return records.filter((r) => {
      const fac = facultyMap.get(r.faculty_id);
      const name = fac?.name?.toLowerCase() ?? "";
      return (
        name.includes(q) ||
        r.faculty_id.toLowerCase().includes(q) ||
        r.status.includes(q)
      );
    });
  }, [records, search, facultyMap]);

  // Salary structure tab toggle
  const [scaleTab, setScaleTab] = useState<"7cpc" | "private">("7cpc");
  const filteredStructures = useMemo(
    () =>
      structures.filter(
        (s) =>
          s.pay_scale_type === scaleTab ||
          (scaleTab === "private" && s.pay_scale_type === "consolidated"),
      ),
    [structures, scaleTab],
  );

  const monthLabel = `${MONTHS[selectedMonth - 1]} ${selectedYear}`;

  return (
    <div className="space-y-6 pb-24">
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
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Payroll Dashboard</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-gray-400">
            Cycle: {monthLabel}
            {employeeCount > 0 && (
              <>
                <span className="h-1 w-1 rounded-full bg-gray-500" />
                {employeeCount} Employees
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Month selector */}
          <Select
            value={String(selectedMonth)}
            onValueChange={(v) => {
              setSelectedMonth(Number(v));
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={String(i + 1)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Year selector */}
          <Select
            value={String(selectedYear)}
            onValueChange={(v) => {
              setSelectedYear(Number(v));
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Reports
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="mr-2 h-4 w-4" />
            Config
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {/* Total Monthly Payroll */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                  Total Monthly Payroll
                </p>
                <h3 className="mt-1 text-2xl font-bold text-white">
                  {totalGross > 0 ? pc(totalGross) : "--"}
                </h3>
              </div>
              <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-500">
                <Landmark className="h-5 w-5" />
              </div>
            </div>
            {totalNet > 0 && (
              <div className="text-xs text-gray-400">
                Net disbursement: {pc(totalNet)}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Employee Count */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                  Employees Processed
                </p>
                <h3 className="mt-1 text-2xl font-bold text-white">
                  {employeeCount > 0 ? employeeCount : "--"}
                </h3>
              </div>
              <div className="rounded-lg bg-blue-500/10 p-2 text-blue-500">
                <Landmark className="h-5 w-5" />
              </div>
            </div>
            <div className="text-xs text-gray-400">For {monthLabel}</div>
          </CardContent>
        </Card>

        {/* Total Deductions */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                  Total Deductions
                </p>
                <h3 className="mt-1 text-2xl font-bold text-white">
                  {statutory
                    ? pc(
                        (statutory.statutory.epf_total ?? 0) +
                          (statutory.statutory.esi_total ?? 0) +
                          statutory.statutory.tds +
                          statutory.statutory.professional_tax,
                      )
                    : "--"}
                </h3>
              </div>
              <div className="rounded-lg bg-red-500/10 p-2 text-red-500">
                <Landmark className="h-5 w-5" />
              </div>
            </div>
            <div className="text-xs text-gray-400">EPF + ESI + TDS + PT</div>
          </CardContent>
        </Card>

        {/* Payroll Run Status */}
        <Card className="relative overflow-hidden">
          <div
            className={cn(
              "absolute bottom-0 right-0 top-0 w-1",
              currentStep === "calculate"
                ? "bg-yellow-500"
                : currentStep === "approve"
                  ? "bg-blue-500"
                  : currentStep === "bank_file"
                    ? "bg-emerald-500"
                    : "bg-purple-500",
            )}
          />
          <CardContent className="p-5">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                  Payroll Run Status
                </p>
                <h3 className={cn("mt-1 text-lg font-bold", runStatusColor)}>
                  {monthLabel} - {runStatusLabel}
                </h3>
              </div>
              <div className="rounded-lg bg-yellow-500/10 p-2 text-yellow-500">
                <PlayCircle className="h-5 w-5" />
              </div>
            </div>
            <Button
              className="mt-2 w-full bg-emerald-600 hover:bg-emerald-700"
              onClick={handlePipelineAction}
              disabled={pipelineLoading}
            >
              {pipelineLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PlayCircle className="mr-2 h-4 w-4" />
              )}
              {pipelineCTALabel}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Pay Scale Config + Statutory Deductions */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Pay Scale Configuration — 2/3 */}
        <Card className="xl:col-span-2">
          <div className="flex items-center justify-between border-b border-dark-border px-5 py-4">
            <h3 className="flex items-center gap-2 text-base font-semibold text-white">
              <Settings className="h-5 w-5 text-emerald-500" />
              Pay Scale Configuration
            </h3>
            <div className="flex rounded-lg bg-[#262626] p-1">
              <button
                className={cn(
                  "rounded px-3 py-1.5 text-xs font-medium transition-colors",
                  scaleTab === "7cpc"
                    ? "bg-emerald-500 text-white shadow-sm"
                    : "text-gray-400 hover:text-white",
                )}
                onClick={() => setScaleTab("7cpc")}
              >
                7th CPC (Govt)
              </button>
              <button
                className={cn(
                  "rounded px-3 py-1.5 text-xs font-medium transition-colors",
                  scaleTab === "private"
                    ? "bg-emerald-500 text-white shadow-sm"
                    : "text-gray-400 hover:text-white",
                )}
                onClick={() => setScaleTab("private")}
              >
                Private Scale
              </button>
            </div>
          </div>
          <div className="overflow-x-auto p-5">
            {salaryStructuresQ.isLoading ? (
              <div className="flex items-center justify-center py-12 text-gray-400">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading salary structures...
              </div>
            ) : filteredStructures.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-500">
                No {scaleTab === "7cpc" ? "7th CPC" : "private"} salary
                structures configured
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-dark-border text-xs uppercase text-gray-500">
                    <th className="pb-3 font-semibold">
                      {scaleTab === "7cpc" ? "Level / " : ""}Designation
                    </th>
                    {scaleTab === "7cpc" && (
                      <th className="pb-3 font-semibold">Pay Level</th>
                    )}
                    <th className="pb-3 text-center font-semibold">DA %</th>
                    <th className="pb-3 text-center font-semibold">HRA %</th>
                    <th className="pb-3 text-center font-semibold">NPA %</th>
                    <th className="pb-3 text-right font-semibold">
                      Transport
                    </th>
                    {scaleTab === "private" && (
                      <th className="pb-3 text-right font-semibold">
                        Basic Pay
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-border text-gray-300">
                  {filteredStructures.map((row) => (
                    <tr key={row.id}>
                      <td className="py-3">
                        <div className="font-medium text-white">
                          {row.designation}
                        </div>
                      </td>
                      {scaleTab === "7cpc" && (
                        <td className="py-3">
                          {row.pay_level ? `Level ${row.pay_level}` : "-"}
                        </td>
                      )}
                      <td className="py-3 text-center text-emerald-400">
                        {row.da_percentage}%
                      </td>
                      <td className="py-3 text-center">
                        {row.hra_percentage}%
                      </td>
                      <td className="py-3 text-center">
                        {row.npa_percentage}%
                      </td>
                      <td className="py-3 text-right font-mono">
                        {p(row.transport_allowance)}
                      </td>
                      {scaleTab === "private" && (
                        <td className="py-3 text-right font-mono">
                          {row.basic_pay ? p(row.basic_pay) : "-"}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        {/* Statutory Deductions — 1/3 */}
        <div className="space-y-4 xl:col-span-1">
          {statutoryQ.isLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center p-8 text-gray-400">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading...
              </CardContent>
            </Card>
          ) : !statutory ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-gray-500">
                Run payroll to see statutory deductions
              </CardContent>
            </Card>
          ) : (
            <>
              {/* EPF */}
              <Card>
                <CardContent className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-500/10 text-xs font-bold text-blue-500">
                        EPF
                      </div>
                      <span className="text-sm font-medium text-white">
                        Provident Fund
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">Due: 15th</span>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs text-gray-400">Total Liability</p>
                      <p className="text-lg font-bold text-white">
                        {p(statutory.statutory.epf_total)}
                      </p>
                      <p className="mt-0.5 text-[10px] text-gray-500">
                        Employee: {p(statutory.statutory.epf_employee)} |
                        Employer: {p(statutory.statutory.epf_employer)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px]"
                    >
                      Generate Challan
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* ESI (only if applicable) */}
              {statutory.statutory.esi_total > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-green-500/10 text-xs font-bold text-green-500">
                          ESI
                        </div>
                        <span className="text-sm font-medium text-white">
                          Employee State Insurance
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">Due: 15th</span>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-xs text-gray-400">Total Liability</p>
                        <p className="text-lg font-bold text-white">
                          {p(statutory.statutory.esi_total)}
                        </p>
                        <p className="mt-0.5 text-[10px] text-gray-500">
                          Employee: {p(statutory.statutory.esi_employee)} |
                          Employer: {p(statutory.statutory.esi_employer)}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[10px]"
                      >
                        Generate Challan
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* TDS */}
              <Card>
                <CardContent className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-red-500/10 text-xs font-bold text-red-500">
                        TDS
                      </div>
                      <span className="text-sm font-medium text-white">
                        Tax Deducted at Source
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">Due: 7th</span>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs text-gray-400">Total Deduction</p>
                      <p className="text-lg font-bold text-white">
                        {p(statutory.statutory.tds)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px]"
                    >
                      Generate Challan
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* PT */}
              <Card>
                <CardContent className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-orange-500/10 text-xs font-bold text-orange-500">
                        PT
                      </div>
                      <span className="text-sm font-medium text-white">
                        Professional Tax
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">Due: 30th</span>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs text-gray-400">State Wise</p>
                      <p className="text-lg font-bold text-white">
                        {p(statutory.statutory.professional_tax)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px]"
                    >
                      Generate Challan
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Payroll Ledger */}
      <Card className="overflow-hidden">
        <div className="flex flex-col items-start justify-between gap-4 border-b border-dark-border px-5 py-4 sm:flex-row sm:items-center">
          <h3 className="text-base font-semibold text-white">
            Payroll Ledger ({monthLabel})
          </h3>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search employee..."
                className="h-8 w-full pl-8 text-xs sm:w-64"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {payrollQ.isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading payroll records...
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-gray-500">
              {totalRecords === 0
                ? `No payroll records for ${monthLabel}. Click "Calculate Payroll" to start.`
                : "No matching records found."}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table className="whitespace-nowrap">
                <TableHeader>
                  <TableRow className="bg-[#262626]/50 text-[11px] uppercase tracking-wider text-gray-500">
                    <TableHead className="min-w-[200px] font-semibold">
                      Employee
                    </TableHead>
                    <TableHead className="text-right font-semibold">
                      Basic Pay
                    </TableHead>
                    <TableHead className="text-right font-semibold">
                      DA
                    </TableHead>
                    <TableHead className="text-right font-semibold">
                      HRA
                    </TableHead>
                    <TableHead className="text-right font-semibold">
                      NPA
                    </TableHead>
                    <TableHead className="text-right font-semibold">
                      Gross
                    </TableHead>
                    <TableHead className="text-right font-semibold text-red-400">
                      EPF
                    </TableHead>
                    <TableHead className="text-right font-semibold text-red-400">
                      TDS
                    </TableHead>
                    <TableHead className="text-right font-semibold text-red-400">
                      PT
                    </TableHead>
                    <TableHead className="text-right font-semibold text-white">
                      Net Pay
                    </TableHead>
                    <TableHead className="text-center font-semibold">
                      Status
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {filteredRecords.map((entry) => {
                    const fac = facultyMap.get(entry.faculty_id);
                    const name = fac?.name ?? entry.faculty_id.slice(0, 8);
                    const designation = fac?.designation ?? "";
                    return (
                      <TableRow
                        key={entry.id}
                        className="transition-colors hover:bg-[#262626]/20"
                      >
                        <TableCell className="py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
                                getInitialsColor(entry.faculty_id),
                              )}
                            >
                              {fac ? getInitials(fac.name) : "?"}
                            </div>
                            <div>
                              <p className="font-medium text-white">{name}</p>
                              {designation && (
                                <p className="text-[10px] text-gray-500">
                                  {designation}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-gray-300">
                          {p(entry.basic_pay)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-gray-400">
                          {p(entry.dearness_allowance)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-gray-400">
                          {p(entry.house_rent_allowance)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-gray-400">
                          {entry.non_practicing_allowance > 0
                            ? p(entry.non_practicing_allowance)
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium text-emerald-400">
                          {p(entry.gross_earnings)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-gray-400">
                          {p(entry.epf_employee)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-gray-400">
                          {p(entry.tds)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-gray-400">
                          {p(entry.professional_tax)}
                        </TableCell>
                        <TableCell className="text-right bg-[#262626]/30 font-mono font-bold text-white">
                          {p(entry.net_pay)}
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={cn(
                              "rounded border px-2 py-0.5 text-[10px]",
                              STATUS_BADGE[entry.status] ?? STATUS_BADGE.draft,
                            )}
                          >
                            {entry.status.charAt(0).toUpperCase() +
                              entry.status.slice(1)}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-dark-border px-5 py-3">
                <p className="text-xs text-gray-500">
                  Showing {(page - 1) * pageSize + 1}–
                  {Math.min(page * pageSize, totalRecords)} of {totalRecords}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={page <= 1}
                    onClick={() => setPage((prev) => prev - 1)}
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
                    onClick={() => setPage((prev) => prev + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Payroll Pipeline — Sticky Bottom Bar */}
      <div className="fixed bottom-6 left-0 right-0 z-20 px-6">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-6 rounded-xl border border-dark-border bg-dark-surface p-4 shadow-2xl">
          {/* Pipeline Steps */}
          <div className="relative flex flex-1 items-center">
            {/* Track line */}
            <div className="absolute left-0 right-0 top-1/2 -z-10 h-0.5 bg-[#262626]" />
            {/* Progress line */}
            {(() => {
              const order: PipelineStep[] = [
                "calculate",
                "approve",
                "bank_file",
                "pay_slips",
              ];
              const idx = order.indexOf(currentStep);
              const pct = idx <= 0 ? 0 : (idx / (order.length - 1)) * 100;
              return (
                <div
                  className="absolute left-0 top-1/2 -z-10 h-0.5 bg-emerald-500 transition-all"
                  style={{ width: `${pct}%` }}
                />
              );
            })()}

            <div className="flex w-full justify-between">
              {PIPELINE_STEPS.map((step) => {
                const status = getStepStatus(step.id, currentStep);
                const Icon = step.icon;
                return (
                  <div
                    key={step.id}
                    className={cn(
                      "flex cursor-pointer flex-col items-center gap-2",
                      status === "upcoming" && "opacity-40",
                      status === "current" && "opacity-50",
                    )}
                    onClick={() => {
                      if (step.id === "calculate") handleCalculate();
                      else if (step.id === "approve") handleApprove();
                      else if (step.id === "bank_file") handleBankFile();
                      else handlePaySlips();
                    }}
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full border-4 border-dark-surface shadow-sm",
                        status === "completed"
                          ? "bg-emerald-500 text-white"
                          : "bg-[#262626] text-gray-400",
                        status === "current" && "ring-2 ring-emerald-500",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <span
                      className={cn(
                        "text-[10px] font-medium",
                        status === "completed"
                          ? "text-white"
                          : status === "current"
                            ? "text-emerald-500"
                            : "text-gray-400",
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CTA */}
          <div className="border-l border-dark-border pl-6">
            <Button
              className="shadow-lg shadow-emerald-500/20"
              onClick={handlePipelineAction}
              disabled={pipelineLoading}
            >
              {pipelineLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {pipelineCTALabel}
              {!pipelineLoading && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
