"use client";

import { useState } from "react";
import {
  Shield,
  Users,
  Gavel,
  UsersRound,
  BadgeCheck,
  Search,
  Filter,
  Plus,
  MoreHorizontal,
  AlertTriangle,
  Upload,
  FileText,
  CalendarDays,
  CheckCircle2,
  Download,
  UserX,
  ChevronRight,
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
  CommitteeCard,
  GrievanceRow,
  MeetingActionEntry,
} from "@/types/admin";

// ---------------------------------------------------------------------------
// Icon mapping
// ---------------------------------------------------------------------------
const COMMITTEE_ICONS: Record<string, React.ElementType> = {
  security: Shield,
  diversity_3: Users,
  gavel: Gavel,
  groups: UsersRound,
  verified: BadgeCheck,
};

// ---------------------------------------------------------------------------
// Mock data — TODO: Replace with API call
// ---------------------------------------------------------------------------
const COMMITTEES: CommitteeCard[] = [
  {
    id: "1",
    name: "Anti-Ragging",
    iconKey: "security",
    iconColor: "text-red-500",
    iconBg: "bg-red-500/10",
    iconBorder: "border-red-500/20",
    badgeLabel: "Critical",
    badgeBg: "bg-red-500/10",
    badgeText: "text-red-400",
    badgeBorder: "border-red-500/20",
    members: 12,
    lastMeeting: "Oct 10",
    openCases: 0,
  },
  {
    id: "2",
    name: "ICC (POSH)",
    iconKey: "diversity_3",
    iconColor: "text-purple-500",
    iconBg: "bg-purple-500/10",
    iconBorder: "border-purple-500/20",
    badgeLabel: "Active",
    badgeBg: "bg-purple-500/10",
    badgeText: "text-purple-400",
    badgeBorder: "border-purple-500/20",
    members: 8,
    lastMeeting: "Sep 24",
    openCases: 1,
  },
  {
    id: "3",
    name: "Grievance Cell",
    iconKey: "gavel",
    iconColor: "text-blue-500",
    iconBg: "bg-blue-500/10",
    iconBorder: "border-blue-500/20",
    badgeLabel: "Monthly",
    badgeBg: "bg-blue-500/10",
    badgeText: "text-blue-400",
    badgeBorder: "border-blue-500/20",
    members: 15,
    lastMeeting: "Oct 01",
    openCases: 5,
  },
  {
    id: "4",
    name: "Student Council",
    iconKey: "groups",
    iconColor: "text-orange-500",
    iconBg: "bg-orange-500/10",
    iconBorder: "border-orange-500/20",
    badgeLabel: "Elected",
    badgeBg: "bg-orange-500/10",
    badgeText: "text-orange-400",
    badgeBorder: "border-orange-500/20",
    members: 24,
    lastMeeting: "Oct 15",
    openCases: 3,
    openCasesLabel: "Open Actions",
  },
  {
    id: "5",
    name: "IQAC",
    iconKey: "verified",
    iconColor: "text-teal-500",
    iconBg: "bg-teal-500/10",
    iconBorder: "border-teal-500/20",
    badgeLabel: "Quarterly",
    badgeBg: "bg-teal-500/10",
    badgeText: "text-teal-400",
    badgeBorder: "border-teal-500/20",
    members: 10,
    lastMeeting: "Aug 20",
    openCases: 2,
    openCasesLabel: "Pending Audits",
  },
];

const GRIEVANCES: GrievanceRow[] = [
  {
    id: "1",
    ticketId: "#GR-2023-089",
    filedBy: { name: "Anonymous", anonymous: true },
    category: "Harassment",
    categoryColor: "bg-red-500/10 text-red-400 border-red-500/20",
    assignedTo: "ICC (Internal)",
    status: "investigation",
    statusLabel: "Investigation",
    statusColor: "text-yellow-500",
    priority: "high",
  },
  {
    id: "2",
    ticketId: "#GR-2023-088",
    filedBy: {
      name: "R. Dave (Student)",
      initials: "RD",
      initialsColor: "bg-blue-500/20 text-blue-400",
      anonymous: false,
    },
    category: "Academic",
    categoryColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    assignedTo: "Exam Cell",
    status: "resolved",
    statusLabel: "Resolved",
    statusColor: "text-emerald-500",
    priority: "normal",
  },
  {
    id: "3",
    ticketId: "#GR-2023-087",
    filedBy: {
      name: "A. Khan (Faculty)",
      initials: "AK",
      initialsColor: "bg-purple-500/20 text-purple-400",
      anonymous: false,
    },
    category: "Infrastructure",
    categoryColor: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    assignedTo: "Maintenance",
    status: "received",
    statusLabel: "Received",
    statusColor: "text-gray-400",
    priority: "medium",
  },
  {
    id: "4",
    ticketId: "#GR-2023-086",
    filedBy: { name: "Anonymous", anonymous: true },
    category: "Ragging",
    categoryColor: "bg-red-500/10 text-red-400 border-red-500/20",
    assignedTo: "Anti-Ragging Comm.",
    status: "hearing_scheduled",
    statusLabel: "Hearing Scheduled",
    statusColor: "text-blue-500",
    priority: "critical",
  },
  {
    id: "5",
    ticketId: "#GR-2023-085",
    filedBy: {
      name: "S. Mehra (Student)",
      initials: "SM",
      initialsColor: "bg-teal-500/20 text-teal-400",
      anonymous: false,
    },
    category: "Fees",
    categoryColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    assignedTo: "Accounts Dept",
    status: "resolved",
    statusLabel: "Resolved",
    statusColor: "text-emerald-500",
    priority: "normal",
  },
];

const MEETING_ACTIONS: MeetingActionEntry[] = [
  {
    id: "1",
    title: "Anti-Ragging Monthly Review",
    date: "Yesterday",
    description:
      "Minutes pending approval. Action items assigned to Warden.",
    completed: false,
    actions: [
      { label: "Upload Minutes", variant: "primary" },
      { label: "View Actions", variant: "secondary" },
    ],
  },
  {
    id: "2",
    title: "Grievance Cell Hearing",
    date: "Oct 05",
    description: "Case #GR-2023-082 resolved. Report filed.",
    completed: true,
    actions: [
      { label: "Filed", variant: "primary" },
      { label: "Download PDF", variant: "secondary" },
    ],
  },
  {
    id: "3",
    title: "IQAC Quarterly Audit",
    date: "Sep 15",
    description: "Audit completed successfully.",
    completed: true,
    actions: [],
  },
];

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------
const STATUS_DOT_COLOR: Record<string, string> = {
  investigation: "bg-yellow-500 animate-pulse",
  resolved: "bg-emerald-500",
  received: "bg-gray-500",
  hearing_scheduled: "bg-blue-500",
};

const PRIORITY_LABEL: Record<string, React.ReactNode> = {
  critical: (
    <span className="flex items-center gap-1 text-xs font-medium text-red-400">
      <AlertTriangle className="h-3.5 w-3.5" /> Critical
    </span>
  ),
  high: (
    <span className="flex items-center gap-1 text-xs font-medium text-red-400">
      <AlertTriangle className="h-3.5 w-3.5" /> High
    </span>
  ),
  medium: (
    <span className="text-xs font-medium text-yellow-500">Medium</span>
  ),
  normal: (
    <span className="text-xs font-medium text-gray-400">Normal</span>
  ),
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function CommitteesPage() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col overflow-hidden bg-[#0A0A0A]">
      {/* Top Bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-[#1E1E1E] px-6 py-3">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="hover:text-white cursor-pointer">Communication</span>
          <span className="text-gray-600">/</span>
          <span className="font-semibold text-white">
            Committees &amp; Grievance Redressal
          </span>
        </div>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> New Grievance
        </Button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-auto p-6">
        {/* ---- NMC Mandated Committees ---- */}
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              NMC Mandated Committees
            </h2>
            <button className="flex items-center gap-1 text-xs font-medium text-emerald-500 hover:text-emerald-400">
              View All <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
            {COMMITTEES.map((c) => {
              const Icon = COMMITTEE_ICONS[c.iconKey] ?? Users;
              return (
                <div
                  key={c.id}
                  className="rounded-xl border border-[#1E1E1E] bg-[#141414] p-4 transition-colors hover:border-emerald-500/30"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border ${c.iconBg} ${c.iconBorder}`}
                    >
                      <Icon className={`h-[18px] w-[18px] ${c.iconColor}`} />
                    </div>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${c.badgeBg} ${c.badgeText} ${c.badgeBorder}`}
                    >
                      {c.badgeLabel}
                    </span>
                  </div>

                  <h3 className="mb-1 text-sm font-semibold text-gray-200">
                    {c.name}
                  </h3>

                  <div className="mb-4 space-y-1">
                    <p className="flex justify-between text-xs text-gray-500">
                      Members:{" "}
                      <span className="text-gray-300">{c.members}</span>
                    </p>
                    <p className="flex justify-between text-xs text-gray-500">
                      Last Meeting:{" "}
                      <span className="text-gray-300">{c.lastMeeting}</span>
                    </p>
                    <p className="flex justify-between text-xs text-gray-500">
                      {c.openCasesLabel ?? "Open Cases"}:{" "}
                      <span className="font-bold text-white">
                        {c.openCases}
                      </span>
                    </p>
                  </div>

                  <button className="w-full rounded border border-[#1E1E1E] bg-[#262626] py-1.5 text-[10px] font-medium text-emerald-500 transition-colors hover:bg-[#262626]/80">
                    Schedule Meeting
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ---- Main grid: Grievance Tracker + Sidebar ---- */}
        <div className="grid grid-cols-12 gap-6 pb-6">
          {/* Grievance Tracker */}
          <div className="col-span-12 flex flex-col xl:col-span-8">
            <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-[#1E1E1E] bg-[#141414]">
              {/* Header */}
              <div className="flex flex-col items-center justify-between gap-4 border-b border-[#1E1E1E] p-4 sm:flex-row">
                <h3 className="flex items-center gap-2 text-base font-semibold text-white">
                  <FileText className="h-5 w-5 text-gray-400" />
                  Grievance Tracker
                </h3>
                <div className="flex w-full gap-2 sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3 top-2 h-3.5 w-3.5 text-gray-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by ID or name..."
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
                        Ticket ID
                      </TableHead>
                      <TableHead className="text-xs font-medium uppercase text-gray-400">
                        Filed By
                      </TableHead>
                      <TableHead className="text-xs font-medium uppercase text-gray-400">
                        Category
                      </TableHead>
                      <TableHead className="text-xs font-medium uppercase text-gray-400">
                        Assigned To
                      </TableHead>
                      <TableHead className="text-xs font-medium uppercase text-gray-400">
                        Status
                      </TableHead>
                      <TableHead className="text-xs font-medium uppercase text-gray-400">
                        Priority
                      </TableHead>
                      <TableHead className="text-right text-xs font-medium uppercase text-gray-400">
                        Action
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {GRIEVANCES.map((g) => (
                      <TableRow
                        key={g.id}
                        className="border-[#1E1E1E] transition-colors hover:bg-[#262626]/30"
                      >
                        <TableCell className="font-mono text-xs text-gray-400">
                          {g.ticketId}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {g.filedBy.anonymous ? (
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-700">
                                <UserX className="h-3.5 w-3.5 text-gray-400" />
                              </div>
                            ) : (
                              <div
                                className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${g.filedBy.initialsColor}`}
                              >
                                {g.filedBy.initials}
                              </div>
                            )}
                            <span
                              className={`text-xs ${g.filedBy.anonymous ? "italic text-gray-400" : ""}`}
                            >
                              {g.filedBy.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`rounded border px-2 py-0.5 text-[10px] font-medium ${g.categoryColor}`}
                          >
                            {g.category}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs">
                          {g.assignedTo}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`h-2 w-2 rounded-full ${STATUS_DOT_COLOR[g.status]}`}
                            />
                            <span
                              className={`text-xs ${g.statusColor}`}
                            >
                              {g.statusLabel}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {PRIORITY_LABEL[g.priority]}
                        </TableCell>
                        <TableCell className="text-right">
                          <button className="text-gray-500 hover:text-white">
                            <MoreHorizontal className="h-[18px] w-[18px]" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between border-t border-[#1E1E1E] p-3 text-xs text-gray-500">
                <span>Showing 1-5 of 86 grievances</span>
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
                    3
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
            {/* File New Grievance */}
            <div className="flex flex-col rounded-xl border border-[#1E1E1E] bg-[#141414] p-5">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
                <FileText className="h-4 w-4 text-emerald-500" /> File New
                Grievance
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-400">
                    Category
                  </label>
                  <select className="w-full rounded-lg border border-[#1E1E1E] bg-[#262626] px-2 py-2 text-xs text-gray-200 outline-none focus:ring-1 focus:ring-emerald-500">
                    <option>Academic Issue</option>
                    <option>Harassment / Ragging</option>
                    <option>Infrastructure / Hostel</option>
                    <option>Examination</option>
                    <option>Other</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-400">
                    Description
                  </label>
                  <textarea
                    className="h-24 w-full resize-none rounded-lg border border-[#1E1E1E] bg-[#262626] px-3 py-2 text-xs text-gray-200 outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="Describe the grievance in detail..."
                  />
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-gray-400">
                      Priority
                    </label>
                    <select className="w-full rounded-lg border border-[#1E1E1E] bg-[#262626] px-2 py-2 text-xs text-gray-200 outline-none focus:ring-1 focus:ring-emerald-500">
                      <option>Normal</option>
                      <option>High</option>
                      <option>Critical</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-gray-400">
                      Attachment
                    </label>
                    <button className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-gray-600 bg-[#262626] px-2 py-2 text-xs text-gray-400 transition-colors hover:border-emerald-500 hover:text-emerald-500">
                      <Upload className="h-4 w-4" /> Upload
                    </button>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between border-t border-[#1E1E1E] pt-4">
                  <label className="group flex cursor-pointer items-center gap-2">
                    <div className="relative flex items-center">
                      <input type="checkbox" className="peer sr-only" />
                      <div className="flex h-4 w-4 items-center justify-center rounded border-2 border-gray-600 bg-[#262626] transition-colors peer-checked:border-emerald-500 peer-checked:bg-emerald-500">
                        <svg
                          className="pointer-events-none hidden h-3 w-3 text-white peer-checked:block"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M5 13l4 4L19 7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                          />
                        </svg>
                      </div>
                    </div>
                    <span className="text-xs text-gray-300 transition-colors group-hover:text-white">
                      File Anonymously
                    </span>
                  </label>
                  <Button size="sm" className="shadow-lg shadow-emerald-900/20">
                    Submit Ticket
                  </Button>
                </div>
              </div>
            </div>

            {/* Meeting Actions */}
            <div className="flex flex-1 flex-col rounded-xl border border-[#1E1E1E] bg-[#141414] p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                  <CalendarDays className="h-4 w-4 text-gray-400" /> Meeting
                  Actions
                </h3>
                <button className="text-[10px] text-emerald-500 hover:underline">
                  View Calendar
                </button>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                {MEETING_ACTIONS.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-lg border border-[#1E1E1E] bg-[#262626]/30 p-3 transition-colors hover:bg-[#262626]/50 ${
                      m.completed && m.actions.length === 0
                        ? "opacity-60"
                        : ""
                    }`}
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <h4 className="text-xs font-medium text-gray-200">
                        {m.title}
                      </h4>
                      <span className="text-[10px] text-gray-500">
                        {m.date}
                      </span>
                    </div>
                    <p className="mb-3 text-[10px] text-gray-400">
                      {m.description}
                    </p>
                    {m.actions.length > 0 && (
                      <div className="flex gap-2">
                        {m.actions.map((a) =>
                          m.completed && a.variant === "primary" ? (
                            <div
                              key={a.label}
                              className="flex flex-1 items-center justify-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/10 py-1.5 text-[10px] text-emerald-400"
                            >
                              <CheckCircle2 className="h-3 w-3" /> {a.label}
                            </div>
                          ) : (
                            <button
                              key={a.label}
                              className="flex flex-1 items-center justify-center gap-1 rounded border border-[#1E1E1E] bg-[#262626] py-1.5 text-[10px] text-gray-300 transition-colors hover:bg-[#141414]"
                            >
                              {a.variant === "primary" && (
                                <Upload className="h-3 w-3" />
                              )}
                              {a.label === "Download PDF" && (
                                <Download className="h-3 w-3" />
                              )}
                              {a.label !== "Download PDF" &&
                                a.variant !== "primary" &&
                                null}
                              {a.label}
                            </button>
                          )
                        )}
                      </div>
                    )}
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
