"use client";

import { useState } from "react";
import {
  Clock,
  Search,
  Filter,
  Plus,
  Check,
  X,
  MoreVertical,
  History,
  GitBranch,
  BarChart3,
  Settings,
  User,
  Users,
  GraduationCap,
  Wallet,
  TrendingDown,
  ShoppingCart,
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
import type {
  ApprovalQueueCard,
  ApprovalTab,
  PurchaseOrderRow,
  WorkflowChainStep,
  ApprovalBottleneck,
} from "@/types/admin";

// ---------------------------------------------------------------------------
// Mock data — TODO: Replace with API call
// ---------------------------------------------------------------------------
const APPROVAL_CARDS: ApprovalQueueCard[] = [
  {
    id: "1",
    requester: {
      name: "Dr. Sharma",
      initials: "DS",
      initialsColor: "bg-blue-500/20 text-blue-400",
      department: "Pathology Dept",
    },
    priority: "high",
    title: "Leave Request",
    description:
      "Requesting 3 days sick leave from Oct 24-26 due to viral fever.",
  },
  {
    id: "2",
    requester: {
      name: "A. Khan",
      initials: "AK",
      initialsColor: "bg-purple-500/20 text-purple-400",
      department: "Purchase",
    },
    priority: "normal",
    title: "PO Approval #9021",
    description: "Microscopes for Anatomy Lab - batch of 50 units.",
  },
  {
    id: "3",
    requester: {
      name: "R. Verma",
      initials: "RV",
      initialsColor: "bg-orange-500/20 text-orange-400",
      department: "Faculty",
    },
    priority: "normal",
    title: "Travel Claim",
    description:
      "Reimbursement for National Medical Conference, Delhi.",
  },
  {
    id: "4",
    requester: {
      name: "S. Jain",
      initials: "SJ",
      initialsColor: "bg-teal-500/20 text-teal-400",
      department: "Research",
    },
    priority: "high",
    title: "Grant Utilization",
    description: "Approval for Q3 research grant fund allocation.",
  },
];

const TABS: { id: ApprovalTab; label: string }[] = [
  { id: "leave", label: "Leave Requests" },
  { id: "certificate", label: "Certificate Requests" },
  { id: "purchase_order", label: "Purchase Orders" },
  { id: "travel", label: "Travel Claims" },
  { id: "equipment", label: "Equipment Requests" },
];

const PURCHASE_ORDERS: PurchaseOrderRow[] = [
  {
    id: "1",
    requestNo: "#PO-2023-9021",
    department: "Anatomy",
    itemDescription: "Lab Microscopes (50u)",
    cost: "2,50,000",
    budgetApproved: true,
    workflowSteps: [
      { label: "Req", status: "completed" },
      { label: "HOD", status: "completed" },
      { label: "Fin", status: "active" },
      { label: "Ord", status: "pending" },
    ],
  },
  {
    id: "2",
    requestNo: "#PO-2023-9020",
    department: "IT Dept",
    itemDescription: "Server Rack Units",
    cost: "85,000",
    budgetApproved: true,
    workflowSteps: [
      { label: "Req", status: "completed" },
      { label: "HOD", status: "completed" },
      { label: "Fin", status: "completed" },
      { label: "Ord", status: "completed" },
    ],
  },
  {
    id: "3",
    requestNo: "#PO-2023-9019",
    department: "Library",
    itemDescription: "New Medical Journals",
    cost: "45,000",
    budgetApproved: false,
    workflowSteps: [
      { label: "Req", status: "completed" },
      { label: "HOD", status: "rejected" },
      { label: "Fin", status: "pending" },
      { label: "Ord", status: "pending" },
    ],
  },
  {
    id: "4",
    requestNo: "#PO-2023-9018",
    department: "Hostel",
    itemDescription: "Water Purification System",
    cost: "1,20,000",
    budgetApproved: true,
    workflowSteps: [
      { label: "Req", status: "completed" },
      { label: "HOD", status: "completed" },
      { label: "Fin", status: "active" },
      { label: "Ord", status: "pending" },
    ],
  },
];

const WORKFLOW_CHAIN: WorkflowChainStep[] = [
  {
    step: 1,
    title: "Requester",
    description: "Initiates the Purchase Order",
    iconKey: "person",
    active: true,
  },
  {
    step: 2,
    title: "Head of Department (HOD)",
    description: "Verifies requirement & quantity",
    iconKey: "supervisor",
    active: false,
  },
  {
    step: 3,
    title: "Dean",
    description: "Approves if cost > ₹50k",
    iconKey: "school",
    active: false,
  },
  {
    step: 4,
    title: "Finance Dept",
    description: "Checks budget availability & orders",
    iconKey: "payments",
    active: false,
  },
];

const BOTTLENECKS: ApprovalBottleneck[] = [
  {
    label: "Finance Dept",
    avgDays: "4.5 days avg",
    barColor: "bg-red-500/60",
    barPct: 75,
    textColor: "text-red-400",
  },
  {
    label: "Dean's Office",
    avgDays: "2.1 days avg",
    barColor: "bg-yellow-500/60",
    barPct: 45,
    textColor: "text-yellow-400",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const CHAIN_ICONS: Record<string, React.ElementType> = {
  person: User,
  supervisor: Users,
  school: GraduationCap,
  payments: Wallet,
};

const STEP_DOT_CLASSES: Record<string, string> = {
  completed: "bg-emerald-500",
  active: "bg-yellow-500 animate-pulse",
  rejected: "bg-red-500",
  pending: "bg-gray-600",
};

const STEP_TEXT_CLASSES: Record<string, string> = {
  completed: "text-emerald-500",
  active: "text-yellow-500",
  rejected: "text-red-500",
  pending: "text-gray-500",
};

const STEP_LINE_CLASSES: Record<string, string> = {
  completed: "bg-emerald-500",
  active: "bg-gray-600",
  rejected: "bg-red-500",
  pending: "bg-gray-600",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ApprovalsPage() {
  const [activeTab, setActiveTab] = useState<ApprovalTab>("purchase_order");
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col overflow-hidden bg-[#0A0A0A]">
      {/* Top Bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-[#1E1E1E] px-6 py-3">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="cursor-pointer hover:text-white">Workflows</span>
          <span className="text-gray-600">/</span>
          <span className="font-semibold text-white">Approvals</span>
        </div>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> New Request
        </Button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-auto p-6">
        {/* ---- My Approvals Queue ---- */}
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
              <Clock className="h-5 w-5 text-orange-400" />
              My Approvals Queue
              <span className="ml-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                4 Pending
              </span>
            </h2>
            <button className="flex items-center gap-1 text-xs font-medium text-emerald-500 hover:text-emerald-400">
              History <History className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {APPROVAL_CARDS.map((card) => (
              <div
                key={card.id}
                className="rounded-xl border border-[#1E1E1E] bg-[#141414] p-4 shadow-lg shadow-black/20 transition-colors hover:border-emerald-500/30"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${card.requester.initialsColor}`}
                    >
                      {card.requester.initials}
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">
                        {card.requester.name}
                      </p>
                      <p className="text-[10px] text-gray-500">
                        {card.requester.department}
                      </p>
                    </div>
                  </div>
                  {card.priority === "high" ? (
                    <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-400">
                      High Priority
                    </span>
                  ) : (
                    <span className="rounded-full border border-gray-600/30 bg-gray-700/50 px-2 py-0.5 text-[10px] font-medium text-gray-400">
                      Normal
                    </span>
                  )}
                </div>

                <h3 className="mb-1 text-sm font-semibold text-gray-200">
                  {card.title}
                </h3>
                <p className="mb-4 line-clamp-2 text-xs text-gray-500">
                  {card.description}
                </p>

                <div className="flex gap-2">
                  <button className="flex flex-1 items-center justify-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 py-1.5 text-[10px] font-medium text-emerald-500 transition-colors hover:bg-emerald-500/20">
                    <Check className="h-3.5 w-3.5" /> Approve
                  </button>
                  <button className="flex flex-1 items-center justify-center gap-1 rounded border border-red-500/30 bg-red-500/10 py-1.5 text-[10px] font-medium text-red-500 transition-colors hover:bg-red-500/20">
                    <X className="h-3.5 w-3.5" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ---- Category Tabs ---- */}
        <div className="mb-6 border-b border-[#1E1E1E]">
          <div className="flex gap-6 overflow-x-auto pb-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "border-emerald-500 font-bold text-emerald-500"
                    : "border-transparent text-gray-400 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ---- Main grid: PO Table + Sidebar ---- */}
        <div className="grid grid-cols-12 gap-6 pb-6">
          {/* Purchase Orders Table */}
          <div className="col-span-12 flex flex-col xl:col-span-8">
            <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-[#1E1E1E] bg-[#141414]">
              {/* Header */}
              <div className="flex flex-col items-center justify-between gap-4 border-b border-[#1E1E1E] p-4 sm:flex-row">
                <h3 className="flex items-center gap-2 text-base font-semibold text-white">
                  <ShoppingCart className="h-5 w-5 text-gray-400" />
                  Purchase Orders Overview
                </h3>
                <div className="flex w-full gap-2 sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3 top-2 h-3.5 w-3.5 text-gray-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search PO No, Item..."
                      className="w-full rounded-lg border border-[#1E1E1E] bg-[#262626] py-1.5 pl-9 pr-3 text-xs text-gray-200 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <button className="flex items-center gap-1 rounded-lg border border-[#1E1E1E] bg-[#262626] px-3 py-1.5 text-xs text-gray-300 transition-colors hover:bg-[#262626]/80">
                    <Filter className="h-3.5 w-3.5" /> Filter
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="flex-1 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#1E1E1E] bg-[#262626]/50">
                      <TableHead className="text-xs font-medium uppercase text-gray-400">
                        Request No
                      </TableHead>
                      <TableHead className="text-xs font-medium uppercase text-gray-400">
                        Dept
                      </TableHead>
                      <TableHead className="text-xs font-medium uppercase text-gray-400">
                        Item Description
                      </TableHead>
                      <TableHead className="text-xs font-medium uppercase text-gray-400">
                        Cost (₹)
                      </TableHead>
                      <TableHead className="text-center text-xs font-medium uppercase text-gray-400">
                        Budget
                      </TableHead>
                      <TableHead className="text-xs font-medium uppercase text-gray-400">
                        Workflow Status
                      </TableHead>
                      <TableHead className="text-right text-xs font-medium uppercase text-gray-400">
                        Action
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {PURCHASE_ORDERS.map((po) => (
                      <TableRow
                        key={po.id}
                        className="border-[#1E1E1E] transition-colors hover:bg-[#262626]/30"
                      >
                        <TableCell className="font-mono text-xs text-emerald-500">
                          {po.requestNo}
                        </TableCell>
                        <TableCell className="text-xs text-gray-400">
                          {po.department}
                        </TableCell>
                        <TableCell className="font-medium text-white">
                          {po.itemDescription}
                        </TableCell>
                        <TableCell className="font-mono">
                          {po.cost}
                        </TableCell>
                        <TableCell className="text-center">
                          {po.budgetApproved ? (
                            <div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                              <Check className="h-3.5 w-3.5" />
                            </div>
                          ) : (
                            <div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-500/10 text-red-500">
                              <X className="h-3.5 w-3.5" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-[10px] text-gray-500">
                            {po.workflowSteps.map((step, i) => (
                              <div key={step.label} className="flex items-center gap-1">
                                <div className="flex flex-col items-center">
                                  <span
                                    className={`mb-1 h-2 w-2 rounded-full ${STEP_DOT_CLASSES[step.status]}`}
                                  />
                                  <span
                                    className={STEP_TEXT_CLASSES[step.status]}
                                  >
                                    {step.label}
                                  </span>
                                </div>
                                {i < po.workflowSteps.length - 1 && (
                                  <span
                                    className={`h-[1px] w-3 ${STEP_LINE_CLASSES[step.status]}`}
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <button className="text-gray-500 hover:text-white">
                            <MoreVertical className="h-[18px] w-[18px]" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between border-t border-[#1E1E1E] p-3 text-xs text-gray-500">
                <span>Showing 1-4 of 12 orders</span>
                <div className="flex gap-1">
                  <button
                    disabled
                    className="rounded px-2 py-1 transition-colors hover:bg-[#262626] disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <button className="rounded bg-[#262626] px-2 py-1 text-white transition-colors">
                    1
                  </button>
                  <button className="rounded px-2 py-1 transition-colors hover:bg-[#262626]">
                    2
                  </button>
                  <button className="rounded px-2 py-1 transition-colors hover:bg-[#262626]">
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ---- Sidebar ---- */}
          <div className="col-span-12 flex flex-col space-y-6 xl:col-span-4">
            {/* Current Workflow Chain */}
            <div className="flex flex-col rounded-xl border border-[#1E1E1E] bg-[#141414] p-5">
              <h3 className="mb-6 flex items-center gap-2 text-sm font-bold text-white">
                <GitBranch className="h-4 w-4 text-emerald-500" />
                Current Workflow Chain
              </h3>

              <div className="relative space-y-8 border-l-2 border-[#1E1E1E] pl-6">
                {WORKFLOW_CHAIN.map((step) => {
                  const Icon = CHAIN_ICONS[step.iconKey] ?? User;
                  return (
                    <div key={step.step} className="relative">
                      <div
                        className={`absolute -left-[31px] top-0 z-10 flex h-6 w-6 items-center justify-center rounded-full border-4 border-[#141414] text-[10px] font-bold ${
                          step.active
                            ? "bg-emerald-500 text-white"
                            : "bg-[#262626] text-gray-400"
                        }`}
                      >
                        {step.step}
                      </div>
                      <div className="rounded-lg border border-[#1E1E1E] bg-[#262626]/40 p-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="text-sm font-medium text-gray-200">
                              {step.title}
                            </h4>
                            <p className="mt-0.5 text-xs text-gray-500">
                              {step.description}
                            </p>
                          </div>
                          <Icon className="h-5 w-5 text-gray-600" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button className="mt-6 flex w-full items-center justify-center gap-2 rounded border border-[#1E1E1E] bg-[#262626] py-2 text-xs font-medium text-gray-300 transition-colors hover:bg-[#262626]/80">
                <Settings className="h-3.5 w-3.5" /> Configure Workflow
              </button>
            </div>

            {/* Efficiency Stats */}
            <div className="flex flex-1 flex-col rounded-xl border border-[#1E1E1E] bg-[#141414] p-5">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
                <BarChart3 className="h-4 w-4 text-gray-400" /> Efficiency
                Stats
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-[#1E1E1E] bg-[#262626]/30 p-3">
                  <p className="text-[10px] font-semibold uppercase text-gray-500">
                    Avg. Approval Time
                  </p>
                  <p className="mt-1 text-xl font-bold text-white">
                    2.4 Days
                  </p>
                  <span className="mt-1 flex items-center text-[10px] text-emerald-500">
                    <TrendingDown className="mr-0.5 h-3 w-3" /> -12% vs last
                    month
                  </span>
                </div>
                <div className="rounded-lg border border-[#1E1E1E] bg-[#262626]/30 p-3">
                  <p className="text-[10px] font-semibold uppercase text-gray-500">
                    Pending Requests
                  </p>
                  <p className="mt-1 text-xl font-bold text-white">12</p>
                  <span className="mt-1 flex items-center text-[10px] text-gray-500">
                    Across all depts
                  </span>
                </div>
              </div>

              <div className="mt-6">
                <p className="mb-2 text-xs font-medium text-gray-400">
                  Approval Bottlenecks
                </p>
                <div className="space-y-3">
                  {BOTTLENECKS.map((b) => (
                    <div key={b.label}>
                      <div className="mb-1 flex justify-between text-[10px] text-gray-500">
                        <span>{b.label}</span>
                        <span className={b.textColor}>{b.avgDays}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#262626]">
                        <div
                          className={`h-full rounded-full ${b.barColor}`}
                          style={{ width: `${b.barPct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
