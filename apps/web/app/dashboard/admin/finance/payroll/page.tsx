"use client";

import {
  Download,
  Settings,
  TrendingUp,
  PlayCircle,
  Search,
  Filter,
  ArrowRight,
  Calculator,
  CheckCircle2,
  Landmark,
  FileText,
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
import { cn } from "@/lib/utils";
import type {
  PayScaleEntry,
  StatutoryDeduction,
  PayrollLedgerEntry,
  PayrollPipelineStep,
} from "@/types/admin";

// ---------------------------------------------------------------------------
// TODO: Replace with API calls
// GET /api/v1/admin/payroll/dashboard
// GET /api/v1/admin/payroll/ledger?cycle=2026-02
// ---------------------------------------------------------------------------

const STAT_CARDS = [
  {
    label: "Total Monthly Payroll",
    value: "\u20B91,24,56,000",
    trend: "+2.4%",
    trendLabel: "vs last month",
    trendPositive: true,
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-500",
  },
  {
    label: "Teaching Staff",
    value: "\u20B989,34,000",
    subtext: "72% of total budget",
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-500",
  },
  {
    label: "Non-Teaching",
    value: "\u20B935,22,000",
    subtext: "28% of total budget",
    iconBg: "bg-purple-500/10",
    iconColor: "text-purple-500",
  },
];

const PAY_SCALE_DATA: PayScaleEntry[] = [
  {
    level: "Level 14",
    designation: "Professor / Dean",
    payBand: "144200 - 218200",
    gradePay: "10000",
    daPct: "50%",
    hraPct: "24%",
    npaPct: "20%",
    basicEntry: "\u20B91,44,200",
  },
  {
    level: "Level 13A",
    designation: "Assoc. Professor",
    payBand: "131400 - 217100",
    gradePay: "9000",
    daPct: "50%",
    hraPct: "24%",
    npaPct: "20%",
    basicEntry: "\u20B91,31,400",
  },
  {
    level: "Level 11",
    designation: "Asst. Professor",
    payBand: "67700 - 208700",
    gradePay: "6600",
    daPct: "50%",
    hraPct: "24%",
    npaPct: "20%",
    basicEntry: "\u20B967,700",
  },
];

const STATUTORY_DEDUCTIONS: StatutoryDeduction[] = [
  {
    code: "EPF",
    label: "Provident Fund",
    dueDay: "Due: 15th",
    amount: "\u20B912,45,200",
    subLabel: "Total Liability",
    iconColor: "text-blue-500",
    iconBg: "bg-blue-500/10",
  },
  {
    code: "TDS",
    label: "Tax Deducted",
    dueDay: "Due: 7th",
    amount: "\u20B98,32,150",
    subLabel: "Total Deduction",
    iconColor: "text-red-500",
    iconBg: "bg-red-500/10",
  },
  {
    code: "PT",
    label: "Professional Tax",
    dueDay: "Due: 30th",
    amount: "\u20B945,600",
    subLabel: "State Wise",
    iconColor: "text-orange-500",
    iconBg: "bg-orange-500/10",
  },
];

const LEDGER_ENTRIES: PayrollLedgerEntry[] = [
  {
    id: "1",
    name: "Dr. Sunil Kumar",
    initials: "SK",
    initialsColor: "bg-indigo-500/20 text-indigo-400",
    designation: "Prof & HOD",
    department: "Anatomy",
    basicPay: "\u20B91,44,200",
    da: "\u20B972,100",
    hra: "\u20B934,608",
    npa: "\u20B928,840",
    grossEarnings: "\u20B92,79,748",
    epf: "\u20B91,800",
    tds: "\u20B945,200",
    pt: "\u20B9200",
    netPay: "\u20B92,32,548",
    status: "pending",
  },
  {
    id: "2",
    name: "Dr. Rina Mehta",
    initials: "RM",
    initialsColor: "bg-pink-500/20 text-pink-400",
    designation: "Assoc. Prof",
    department: "Biochem",
    basicPay: "\u20B91,31,400",
    da: "\u20B965,700",
    hra: "\u20B931,536",
    npa: "\u20B926,280",
    grossEarnings: "\u20B92,54,916",
    epf: "\u20B91,800",
    tds: "\u20B938,500",
    pt: "\u20B9200",
    netPay: "\u20B92,14,416",
    status: "pending",
  },
  {
    id: "3",
    name: "Rajesh Jain",
    initials: "RJ",
    initialsColor: "bg-teal-500/20 text-teal-400",
    designation: "Lab Technician",
    department: "Patho",
    basicPay: "\u20B935,400",
    da: "\u20B917,700",
    hra: "\u20B98,496",
    npa: "-",
    grossEarnings: "\u20B961,596",
    epf: "\u20B94,248",
    tds: "\u20B91,200",
    pt: "\u20B9200",
    netPay: "\u20B955,948",
    status: "pending",
  },
];

const PIPELINE_STEPS: {
  id: PayrollPipelineStep;
  label: string;
  icon: typeof Calculator;
}[] = [
  { id: "calculate", label: "Calculate", icon: Calculator },
  { id: "approve", label: "Approve", icon: CheckCircle2 },
  { id: "bank_file", label: "Bank File", icon: Landmark },
  { id: "pay_slips", label: "Pay Slips", icon: FileText },
];

const CURRENT_STEP: PayrollPipelineStep = "approve";

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  processed: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  paid: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  hold: "bg-red-500/10 text-red-500 border-red-500/20",
};

function getStepStatus(
  stepId: PayrollPipelineStep,
  currentStep: PayrollPipelineStep,
) {
  const order: PayrollPipelineStep[] = [
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

export default function PayrollPage() {
  return (
    <div className="space-y-6 pb-24">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Payroll Dashboard</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-gray-400">
            Cycle: Feb 2026
            <span className="h-1 w-1 rounded-full bg-gray-500" />
            342 Employees Processed
          </p>
        </div>
        <div className="flex items-center gap-3">
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
        {STAT_CARDS.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-5">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                    {stat.label}
                  </p>
                  <h3 className="mt-1 text-2xl font-bold text-white">
                    {stat.value}
                  </h3>
                </div>
                <div
                  className={cn(
                    "rounded-lg p-2",
                    stat.iconBg,
                    stat.iconColor,
                  )}
                >
                  <Landmark className="h-5 w-5" />
                </div>
              </div>
              {stat.trend && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="flex items-center text-emerald-500">
                    <TrendingUp className="mr-0.5 h-3.5 w-3.5" />
                    {stat.trend}
                  </span>
                  {stat.trendLabel}
                </div>
              )}
              {stat.subtext && (
                <div className="text-xs text-gray-400">{stat.subtext}</div>
              )}
            </CardContent>
          </Card>
        ))}

        {/* Payroll Run Status — special card */}
        <Card className="relative overflow-hidden">
          <div className="absolute bottom-0 right-0 top-0 w-1 bg-yellow-500" />
          <CardContent className="p-5">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                  Payroll Run Status
                </p>
                <h3 className="mt-1 text-lg font-bold text-yellow-500">
                  Feb 2026 - Pending
                </h3>
              </div>
              <div className="rounded-lg bg-yellow-500/10 p-2 text-yellow-500">
                <PlayCircle className="h-5 w-5" />
              </div>
            </div>
            <Button className="mt-2 w-full bg-emerald-600 hover:bg-emerald-700">
              <PlayCircle className="mr-2 h-4 w-4" />
              Run Payroll
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
              <button className="rounded bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm">
                7th CPC (Govt)
              </button>
              <button className="px-3 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:text-white">
                Private Scale
              </button>
            </div>
          </div>
          <div className="overflow-x-auto p-5">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-dark-border text-xs uppercase text-gray-500">
                  <th className="pb-3 font-semibold">Level / Designation</th>
                  <th className="pb-3 font-semibold">Pay Band</th>
                  <th className="pb-3 font-semibold">Grade Pay</th>
                  <th className="pb-3 text-center font-semibold">DA %</th>
                  <th className="pb-3 text-center font-semibold">HRA %</th>
                  <th className="pb-3 text-center font-semibold">NPA %</th>
                  <th className="pb-3 text-right font-semibold">
                    Basic Entry
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border text-gray-300">
                {PAY_SCALE_DATA.map((row) => (
                  <tr key={row.level}>
                    <td className="py-3">
                      <div className="font-medium text-white">{row.level}</div>
                      <div className="text-[10px] text-gray-500">
                        {row.designation}
                      </div>
                    </td>
                    <td className="py-3">{row.payBand}</td>
                    <td className="py-3">{row.gradePay}</td>
                    <td className="py-3 text-center text-emerald-400">
                      {row.daPct}
                    </td>
                    <td className="py-3 text-center">{row.hraPct}</td>
                    <td className="py-3 text-center">{row.npaPct}</td>
                    <td className="py-3 text-right font-mono">
                      {row.basicEntry}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 flex justify-end">
              <button className="flex items-center gap-1 text-xs font-medium text-emerald-500 hover:text-emerald-400">
                View Full Scale Chart
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </Card>

        {/* Statutory Deductions — 1/3 */}
        <div className="space-y-4 xl:col-span-1">
          {STATUTORY_DEDUCTIONS.map((ded) => (
            <Card key={ded.code}>
              <CardContent className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded text-xs font-bold",
                        ded.iconBg,
                        ded.iconColor,
                      )}
                    >
                      {ded.code}
                    </div>
                    <span className="text-sm font-medium text-white">
                      {ded.label}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">{ded.dueDay}</span>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-gray-400">{ded.subLabel}</p>
                    <p className="text-lg font-bold text-white">{ded.amount}</p>
                  </div>
                  <Button variant="outline" size="sm" className="h-7 text-[10px]">
                    Generate Challan
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Payroll Ledger */}
      <Card className="overflow-hidden">
        <div className="flex flex-col items-start justify-between gap-4 border-b border-dark-border px-5 py-4 sm:flex-row sm:items-center">
          <h3 className="text-base font-semibold text-white">
            Payroll Ledger (Feb 2026)
          </h3>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search employee..."
                className="h-8 w-full pl-8 text-xs sm:w-64"
              />
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>
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
                  DA (50%)
                </TableHead>
                <TableHead className="text-right font-semibold">HRA</TableHead>
                <TableHead className="text-right font-semibold">NPA</TableHead>
                <TableHead className="text-right font-semibold">
                  Gross Earnings
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
              {LEDGER_ENTRIES.map((entry) => (
                <TableRow
                  key={entry.id}
                  className="transition-colors hover:bg-[#262626]/20"
                >
                  <TableCell className="py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
                          entry.initialsColor,
                        )}
                      >
                        {entry.initials}
                      </div>
                      <div>
                        <p className="font-medium text-white">{entry.name}</p>
                        <p className="text-[10px] text-gray-500">
                          {entry.designation} &bull; {entry.department}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-gray-300">
                    {entry.basicPay}
                  </TableCell>
                  <TableCell className="text-right font-mono text-gray-400">
                    {entry.da}
                  </TableCell>
                  <TableCell className="text-right font-mono text-gray-400">
                    {entry.hra}
                  </TableCell>
                  <TableCell className="text-right font-mono text-gray-400">
                    {entry.npa}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium text-emerald-400">
                    {entry.grossEarnings}
                  </TableCell>
                  <TableCell className="text-right font-mono text-gray-400">
                    {entry.epf}
                  </TableCell>
                  <TableCell className="text-right font-mono text-gray-400">
                    {entry.tds}
                  </TableCell>
                  <TableCell className="text-right font-mono text-gray-400">
                    {entry.pt}
                  </TableCell>
                  <TableCell className="text-right bg-[#262626]/30 font-mono font-bold text-white">
                    {entry.netPay}
                  </TableCell>
                  <TableCell className="text-center">
                    <span
                      className={cn(
                        "rounded border px-2 py-0.5 text-[10px]",
                        STATUS_BADGE[entry.status],
                      )}
                    >
                      {entry.status.charAt(0).toUpperCase() +
                        entry.status.slice(1)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Payroll Pipeline — Sticky Bottom Bar */}
      <div className="fixed bottom-6 left-0 right-0 z-20 px-6">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-6 rounded-xl border border-dark-border bg-dark-surface p-4 shadow-2xl">
          {/* Pipeline Steps */}
          <div className="relative flex flex-1 items-center">
            {/* Track line */}
            <div className="absolute left-0 right-0 top-1/2 -z-10 h-0.5 bg-[#262626]" />
            <div className="absolute left-0 top-1/2 -z-10 h-0.5 w-1/4 bg-emerald-500" />

            <div className="flex w-full justify-between">
              {PIPELINE_STEPS.map((step) => {
                const status = getStepStatus(step.id, CURRENT_STEP);
                const Icon = step.icon;
                return (
                  <div
                    key={step.id}
                    className={cn(
                      "flex cursor-pointer flex-col items-center gap-2",
                      status === "upcoming" && "opacity-40",
                      status === "current" && "opacity-50",
                    )}
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
            <Button className="shadow-lg shadow-emerald-500/20">
              Proceed to Approval
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
