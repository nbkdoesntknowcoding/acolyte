"use client";

import {
  Wallet,
  Gavel,
  Users,
  BadgeAlert,
  AlertTriangle,
  FileText,
  Shield,
  DollarSign,
  ListChecks,
  Send,
  CalendarX2,
  UsersRound,
} from "lucide-react";
import type {
  FinancialBarMonth,
  RevenueBreakdown,
  HeatmapRow,
  HeatmapRisk,
  DecisionCard,
  QuickActionItem,
  SystemStatusItem,
} from "@/types/admin";

// ---------------------------------------------------------------------------
// Mock data — TODO: Replace with API call
// ---------------------------------------------------------------------------
const FINANCIAL_BARS: FinancialBarMonth[] = [
  { month: "Apr", revenuePct: 60, expenditurePct: 40 },
  { month: "May", revenuePct: 75, expenditurePct: 45 },
  { month: "Jun", revenuePct: 50, expenditurePct: 50 },
  { month: "Jul", revenuePct: 85, expenditurePct: 55 },
  { month: "Aug", revenuePct: 90, expenditurePct: 60 },
  { month: "Sep", revenuePct: 70, expenditurePct: 45 },
];

const REVENUE_BREAKDOWN: RevenueBreakdown[] = [
  { label: "Tuition", pct: 70 },
  { label: "Hostel", pct: 20 },
  { label: "Other", pct: 10 },
];

const HEATMAP_DATA: HeatmapRow[] = [
  {
    department: "Anatomy",
    faculty: "low",
    attendance: "low",
    infra: "low",
    material: "med",
    equipment: "low",
  },
  {
    department: "Physiology",
    faculty: "low",
    attendance: "high",
    infra: "low",
    material: "low",
    equipment: "low",
  },
  {
    department: "Pathology",
    faculty: "crit",
    attendance: "low",
    infra: "med",
    material: "low",
    equipment: "med",
  },
  {
    department: "Gen Medicine",
    faculty: "med",
    attendance: "low",
    infra: "crit",
    material: "low",
    equipment: "low",
  },
];

const HEATMAP_COLUMNS = [
  "Faculty",
  "Attendance",
  "Infra",
  "Material",
  "Equipment",
] as const;

const DECISIONS: DecisionCard[] = [
  {
    id: "1",
    title: "12 Faculty Positions",
    description:
      "Approval pending for Pathology & Gen Med senior residents.",
    borderColor: "bg-red-500",
    badgeLabel: "Urgent",
    badgeBg: "bg-red-500/10",
    badgeText: "text-red-400",
    badgeBorder: "border-red-500/20",
    buttonLabel: "Review Candidates",
    buttonHoverBg: "hover:bg-red-600 hover:border-red-600",
  },
  {
    id: "2",
    title: "NMC SAF Deadline",
    description: "Self Assessment Form needs final digital signature.",
    borderColor: "bg-yellow-500",
    badgeLabel: "2 Days",
    badgeBg: "bg-yellow-500/10",
    badgeText: "text-yellow-500",
    badgeBorder: "border-yellow-500/20",
    buttonLabel: "Sign Document",
    buttonHoverBg: "hover:bg-yellow-600 hover:border-yellow-600",
  },
  {
    id: "3",
    title: "₹1.2 Cr Outstanding",
    description:
      "Scholarship reimbursements pending from state gov.",
    borderColor: "bg-blue-500",
    badgeLabel: "Finance",
    badgeBg: "bg-blue-500/10",
    badgeText: "text-blue-400",
    badgeBorder: "border-blue-500/20",
    buttonLabel: "View Details",
    buttonHoverBg: "hover:bg-blue-600 hover:border-blue-600",
  },
];

const QUICK_ACTIONS: QuickActionItem[] = [
  { label: "New Task", iconKey: "task", iconColor: "text-emerald-500" },
  { label: "Send Circular", iconKey: "send", iconColor: "text-blue-400" },
  {
    label: "Leave Approval",
    iconKey: "calendar",
    iconColor: "text-yellow-500",
  },
  { label: "HR Portal", iconKey: "users", iconColor: "text-purple-400" },
];

const SYSTEM_STATUS: SystemStatusItem[] = [
  {
    label: "Bio-metric Server",
    status: "Online",
    statusColor: "text-emerald-500",
  },
  { label: "LMS Portal", status: "Online", statusColor: "text-emerald-500" },
  {
    label: "Hospital HMS",
    status: "99.9% Uptime",
    statusColor: "text-emerald-500",
  },
];

// Student phase mini-bars
const PHASE_BARS = [
  { label: "I", pct: 40, opacity: "bg-blue-500/20" },
  { label: "II", pct: 60, opacity: "bg-blue-500/40" },
  { label: "III-1", pct: 80, opacity: "bg-blue-500/60" },
  { label: "III-2", pct: 100, opacity: "bg-blue-500" },
  { label: "INT", pct: 30, opacity: "bg-blue-500/30" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const RISK_CLASSES: Record<
  HeatmapRisk,
  { bg: string; text: string; label: string }
> = {
  low: { bg: "bg-emerald-500/20", text: "text-emerald-500", label: "Low" },
  med: { bg: "bg-yellow-500/20", text: "text-yellow-500", label: "Med" },
  high: { bg: "bg-orange-500/20", text: "text-orange-500", label: "High" },
  crit: { bg: "bg-red-500/20", text: "text-red-500", label: "Crit" },
};

const ACTION_ICONS: Record<string, React.ElementType> = {
  task: ListChecks,
  send: Send,
  calendar: CalendarX2,
  users: UsersRound,
};

// Revenue donut SVG segments
const DONUT_SEGMENTS = [
  { pct: 70, offset: 0, fill: "#10b981" },
  { pct: 20, offset: -70, fill: "#059669" },
  { pct: 10, offset: -90, fill: "#047857" },
];

// Revenue circular progress
const REV_R = 15.9155;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function DeanDashboardPage() {
  return (
    <div className="flex h-[calc(100vh-64px)] flex-col overflow-hidden bg-[#0A0A0A]">
      {/* Top Bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-[#1E1E1E] px-6 py-3">
        <div>
          <h1 className="text-lg font-bold leading-tight text-white">
            Good Morning, Dr. A. Sharma
          </h1>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>24 Oct, 2023</span>
            <span className="h-1 w-1 rounded-full bg-gray-600" />
            <span className="font-medium text-emerald-500">
              Academic Week 24
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 rounded border border-[#1E1E1E] bg-[#262626] px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-[#262626]/80 hover:text-white">
            <FileText className="h-3.5 w-3.5" /> Board Report
          </button>
          <button className="flex items-center gap-2 rounded border border-[#1E1E1E] bg-[#262626] px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-[#262626]/80 hover:text-white">
            <Shield className="h-3.5 w-3.5" /> NMC Compliance
          </button>
          <button className="flex items-center gap-2 rounded border border-[#1E1E1E] bg-[#262626] px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-[#262626]/80 hover:text-white">
            <DollarSign className="h-3.5 w-3.5" /> Financial Summary
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 space-y-6 overflow-auto p-6">
        {/* ---- 4 KPI Cards ---- */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Revenue */}
          <div className="relative overflow-hidden rounded-xl border border-[#1E1E1E] bg-[#141414] p-5">
            <div className="z-10 mb-2 flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Revenue Collected
                </p>
                <div className="mt-1 flex items-baseline gap-1">
                  <p className="text-2xl font-bold text-white">₹14.2 Cr</p>
                  <span className="text-xs text-gray-500">/ ₹18.2 Cr</span>
                </div>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                <Wallet className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-4">
              <div className="relative h-16 w-16">
                <svg
                  className="h-full w-full -rotate-90"
                  viewBox="0 0 36 36"
                >
                  <path
                    d={`M18 2.0845 a ${REV_R} ${REV_R} 0 0 1 0 ${REV_R * 2} a ${REV_R} ${REV_R} 0 0 1 0 -${REV_R * 2}`}
                    fill="none"
                    stroke="#262626"
                    strokeWidth="4"
                  />
                  <path
                    d={`M18 2.0845 a ${REV_R} ${REV_R} 0 0 1 0 ${REV_R * 2} a ${REV_R} ${REV_R} 0 0 1 0 -${REV_R * 2}`}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="4"
                    strokeDasharray="78, 100"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                  78%
                </div>
              </div>
              <p className="text-xs font-medium text-emerald-500">
                +12% vs last year
              </p>
            </div>
          </div>

          {/* NMC Compliance */}
          <div className="flex flex-col justify-between rounded-xl border border-[#1E1E1E] bg-[#141414] p-5">
            <div className="mb-2 flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  NMC Compliance
                </p>
                <p className="mt-1 text-2xl font-bold text-white">
                  76
                  <span className="text-sm font-normal text-gray-500">
                    /100
                  </span>
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-500/10">
                <Gavel className="h-5 w-5 text-yellow-500" />
              </div>
            </div>
            <div className="mt-4">
              <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-gray-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-emerald-500"
                  style={{ width: "76%" }}
                />
              </div>
              <p className="flex items-center gap-1 text-xs font-medium text-red-400">
                <AlertTriangle className="h-3.5 w-3.5" /> 3 critical items
                pending
              </p>
            </div>
          </div>

          {/* Student Strength */}
          <div className="flex flex-col justify-between rounded-xl border border-[#1E1E1E] bg-[#141414] p-5">
            <div className="mb-2 flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Student Strength
                </p>
                <p className="mt-1 text-2xl font-bold text-white">
                  847{" "}
                  <span className="text-xs font-normal text-gray-500">
                    Active
                  </span>
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
            </div>
            <div className="mt-auto flex h-8 items-end justify-between gap-1">
              {PHASE_BARS.map((b) => (
                <div
                  key={b.label}
                  className={`w-full rounded-t-sm ${b.opacity}`}
                  style={{ height: `${b.pct}%` }}
                  title={`Phase ${b.label}`}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] uppercase text-gray-500">
              {PHASE_BARS.map((b) => (
                <span key={b.label}>{b.label}</span>
              ))}
            </div>
          </div>

          {/* Faculty MSR */}
          <div className="flex flex-col justify-between rounded-xl border border-[#1E1E1E] bg-[#141414] p-5">
            <div className="mb-2 flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Faculty MSR
                </p>
                <p className="mt-1 text-2xl font-bold text-white">
                  82%{" "}
                  <span className="text-sm font-normal text-gray-500">
                    Compliant
                  </span>
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
                <BadgeAlert className="h-5 w-5 text-red-500" />
              </div>
            </div>
            <div className="mt-3 rounded border border-red-500/20 bg-red-500/10 px-3 py-2">
              <p className="flex items-center gap-2 text-xs font-medium text-red-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                12 Vacancies Critical
              </p>
            </div>
          </div>
        </div>

        {/* ---- Main grid: Financial + Heatmap | Sidebar ---- */}
        <div className="grid grid-cols-12 gap-6">
          {/* Left column */}
          <div className="col-span-12 space-y-6 xl:col-span-8">
            {/* Financial Overview */}
            <div className="rounded-xl border border-[#1E1E1E] bg-[#141414] p-6">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">
                  Financial Overview
                </h3>
                <select className="rounded border border-[#1E1E1E] bg-[#262626] px-2 py-1 text-xs text-gray-400 outline-none focus:border-emerald-500">
                  <option>FY 2023-24</option>
                  <option>FY 2022-23</option>
                </select>
              </div>

              <div className="flex flex-col gap-8 lg:flex-row">
                {/* Bar chart */}
                <div className="flex-1">
                  <div className="mb-4 flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1 text-gray-400">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />{" "}
                      Revenue
                    </div>
                    <div className="flex items-center gap-1 text-gray-400">
                      <span className="h-2 w-2 rounded-full bg-gray-600" />{" "}
                      Expenditure
                    </div>
                  </div>
                  <div className="flex h-48 items-end justify-between gap-4 border-b border-[#1E1E1E] pb-2">
                    {FINANCIAL_BARS.map((bar) => (
                      <div
                        key={bar.month}
                        className="group flex h-full flex-1 flex-col justify-end gap-1"
                      >
                        <div
                          className="w-full rounded-t-sm bg-emerald-500 transition-opacity group-hover:opacity-90"
                          style={{ height: `${bar.revenuePct}%` }}
                        />
                        <div
                          className="w-full rounded-t-sm bg-gray-700"
                          style={{ height: `${bar.expenditurePct}%` }}
                        />
                        <span className="mt-1 text-center text-[10px] text-gray-500">
                          {bar.month}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Donut chart */}
                <div className="flex w-full flex-col items-center justify-center lg:w-48">
                  <div className="relative mb-4 h-32 w-32">
                    <svg
                      className="h-full w-full -rotate-90"
                      viewBox="0 0 32 32"
                    >
                      {DONUT_SEGMENTS.map((seg) => (
                        <circle
                          key={seg.fill}
                          cx="16"
                          cy="16"
                          r="16"
                          fill={seg.fill}
                          stroke="#141414"
                          strokeWidth="0"
                          strokeDasharray={`${seg.pct} 100`}
                          strokeDashoffset={seg.offset}
                        />
                      ))}
                      <circle cx="16" cy="16" r="8" fill="#141414" />
                    </svg>
                  </div>
                  <div className="w-full space-y-1 text-xs">
                    {REVENUE_BREAKDOWN.map((r) => (
                      <div
                        key={r.label}
                        className="flex justify-between text-gray-400"
                      >
                        <span>{r.label}</span>
                        <span className="font-medium text-white">
                          {r.pct}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Compliance Risk Heatmap */}
            <div className="overflow-hidden rounded-xl border border-[#1E1E1E] bg-[#141414]">
              <div className="flex items-center justify-between border-b border-[#1E1E1E] px-6 py-4">
                <h3 className="text-sm font-bold text-white">
                  Compliance Risk Heatmap
                </h3>
                <button className="text-xs font-medium text-emerald-500 hover:text-emerald-400">
                  Detailed View
                </button>
              </div>
              <div className="overflow-x-auto p-6">
                <table className="w-full border-collapse text-center text-xs">
                  <thead>
                    <tr>
                      <th className="pb-4 pl-2 text-left font-medium text-gray-500">
                        Department
                      </th>
                      {HEATMAP_COLUMNS.map((col) => (
                        <th
                          key={col}
                          className="pb-4 font-medium text-gray-500"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-white">
                    {HEATMAP_DATA.map((row) => (
                      <tr key={row.department}>
                        <td className="py-2 pl-2 text-left font-medium">
                          {row.department}
                        </td>
                        {(
                          [
                            "faculty",
                            "attendance",
                            "infra",
                            "material",
                            "equipment",
                          ] as const
                        ).map((key) => {
                          const risk = row[key];
                          const c = RISK_CLASSES[risk];
                          return (
                            <td key={key} className="px-1 py-1">
                              <div
                                className={`flex h-8 w-full cursor-help items-center justify-center rounded transition-transform hover:scale-105 ${c.bg} ${c.text}`}
                              >
                                {c.label}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ---- Right Sidebar ---- */}
          <div className="col-span-12 space-y-6 xl:col-span-4">
            {/* Key Decisions Needed */}
            <div className="rounded-xl border border-[#1E1E1E] bg-[#141414] p-5">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                Key Decisions Needed
              </h3>
              <div className="space-y-3">
                {DECISIONS.map((d) => (
                  <div
                    key={d.id}
                    className="group relative cursor-pointer overflow-hidden rounded-lg border border-[#1E1E1E] bg-[#262626]/50 p-3 transition-colors"
                  >
                    <div
                      className={`absolute bottom-0 left-0 top-0 w-1 ${d.borderColor}`}
                    />
                    <div className="mb-1 flex items-start justify-between">
                      <p className="text-sm font-semibold text-white">
                        {d.title}
                      </p>
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[10px] ${d.badgeBg} ${d.badgeText} ${d.badgeBorder}`}
                      >
                        {d.badgeLabel}
                      </span>
                    </div>
                    <p className="mb-2 text-xs text-gray-400">
                      {d.description}
                    </p>
                    <div className="flex justify-end">
                      <button
                        className={`rounded border border-[#1E1E1E] bg-[#262626] px-2 py-1 text-[10px] text-white transition-colors ${d.buttonHoverBg}`}
                      >
                        {d.buttonLabel}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="rounded-xl border border-[#1E1E1E] bg-[#141414] p-5">
              <h3 className="mb-4 text-sm font-bold text-white">
                Quick Actions
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {QUICK_ACTIONS.map((a) => {
                  const Icon = ACTION_ICONS[a.iconKey] ?? ListChecks;
                  return (
                    <button
                      key={a.label}
                      className="group flex flex-col items-center justify-center rounded-lg border border-[#1E1E1E] bg-[#262626]/30 p-3 transition-colors hover:bg-[#262626]"
                    >
                      <Icon
                        className={`mb-1 h-5 w-5 transition-transform group-hover:scale-110 ${a.iconColor}`}
                      />
                      <span className="text-xs font-medium text-gray-300">
                        {a.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* System Status */}
            <div className="rounded-xl border border-[#1E1E1E] bg-[#141414] p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">System Status</h3>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
              </div>
              <div className="space-y-3">
                {SYSTEM_STATUS.map((s) => (
                  <div
                    key={s.label}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-gray-400">{s.label}</span>
                    <span className={`font-medium ${s.statusColor}`}>
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
