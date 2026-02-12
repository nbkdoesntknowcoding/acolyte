"use client";

import {
  Plus,
  Columns3,
  Table2,
  BadgeCheck,
  Sparkles,
  ShieldCheck,
  MoreHorizontal,
  AlertTriangle,
  CheckCircle,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  RecruitmentPosition,
  RecruitmentKanbanColumn,
} from "@/types/admin";

// ---------------------------------------------------------------------------
// TODO: Replace with API call — GET /api/v1/admin/hr/recruitment/dashboard
// ---------------------------------------------------------------------------

const PRIORITY_BADGE: Record<string, string> = {
  critical: "bg-red-500/10 text-red-400 border-red-500/20",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

const POSITIONS: RecruitmentPosition[] = [
  {
    id: "1",
    title: "Assoc. Professor",
    department: "Anatomy Department",
    priority: "critical",
    qualification: "MD Anatomy + 4y Exp",
    applicants: [
      { initials: "JD", color: "bg-blue-600" },
      { initials: "AS", color: "bg-purple-600" },
    ],
    overflow: 5,
    totalApplicants: 7,
  },
  {
    id: "2",
    title: "Senior Resident",
    department: "General Medicine",
    priority: "high",
    qualification: "MD/DNB Medicine",
    applicants: [{ initials: "RK", color: "bg-teal-600" }],
    overflow: 12,
    totalApplicants: 13,
  },
  {
    id: "3",
    title: "Asst. Professor",
    department: "Pathology",
    priority: "medium",
    qualification: "MD Path + 1y SRship",
    applicants: [
      { initials: "MN", color: "bg-pink-600" },
      { initials: "ST", color: "bg-indigo-600" },
    ],
    overflow: 3,
    totalApplicants: 5,
  },
  {
    id: "4",
    title: "Professor",
    department: "Physiology",
    priority: "active",
    qualification: "MD Physio + 8y Exp",
    applicants: [],
    overflow: 0,
    totalApplicants: 0,
  },
];

const KANBAN_COLUMNS: RecruitmentKanbanColumn[] = [
  {
    id: "applied",
    title: "Applied",
    count: 14,
    dotColor: "bg-gray-500",
    cards: [
      {
        id: "a1",
        name: "Dr. Rakesh K.",
        initials: "RK",
        initialsColor: "bg-blue-900/30 text-blue-400 border-blue-900/50",
        department: "Anatomy",
        subtitle: "Asst. Prof @ AIIMS",
        tags: ["MD Anatomy", "5y Exp"],
        timeAgo: "2h ago",
      },
      {
        id: "a2",
        name: "Dr. Sarah J.",
        initials: "SJ",
        initialsColor: "bg-purple-900/30 text-purple-400 border-purple-900/50",
        department: "Gen. Med",
        subtitle: "SR @ GMC",
        tags: ["MD Medicine"],
        timeAgo: "5h ago",
      },
    ],
  },
  {
    id: "screening",
    title: "Screening",
    count: 5,
    dotColor: "bg-blue-500",
    cards: [
      {
        id: "s1",
        name: "Dr. Amit M.",
        initials: "AM",
        initialsColor: "bg-indigo-900/30 text-indigo-400 border-indigo-900/50",
        department: "Pathology",
        subtitle: "Current: Tutor",
        warningLabel: "Docs Pending",
        timeAgo: "1d ago",
      },
    ],
  },
  {
    id: "nmc_check",
    title: "NMC Qual. Check",
    count: 3,
    dotColor: "bg-emerald-500",
    highlighted: true,
    cards: [
      {
        id: "n1",
        name: "Dr. Priya S.",
        initials: "PS",
        initialsColor: "bg-emerald-900/30 text-emerald-400 border-emerald-900/50",
        department: "Anatomy",
        subtitle: "MD Anatomy",
        aiMatchPct: 98,
        nmcChecks: [
          { label: "Qualification", value: "Valid (MD)", passed: true },
          { label: "Publications", value: "3/2 Reqd", passed: true },
          { label: "Experience", value: "5.2 Years", passed: true },
        ],
      },
      {
        id: "n2",
        name: "Dr. Vikram T.",
        initials: "VT",
        initialsColor: "bg-teal-900/30 text-teal-400 border-teal-900/50",
        department: "Physiology",
        clarificationNote: "Publication indexing check pending for SCOPUS.",
      },
    ],
  },
  {
    id: "interview",
    title: "Interview",
    count: 2,
    dotColor: "bg-purple-500",
    cards: [
      {
        id: "i1",
        name: "Dr. Anjali D.",
        initials: "AD",
        initialsColor: "bg-gray-700 text-gray-300",
        department: "Gen. Med",
        subtitle: "Panel: Dean, HOD Medicine",
        scheduleBadge: "Tomorrow, 10 AM",
      },
    ],
  },
  {
    id: "offer",
    title: "Offer",
    count: 1,
    dotColor: "bg-yellow-500",
    cards: [
      {
        id: "o1",
        name: "Dr. J. Singh",
        initials: "JS",
        initialsColor: "bg-pink-900/30 text-pink-400 border-pink-900/50",
        department: "Biochem",
        statusNote: "Negotiating Salary",
      },
    ],
  },
  {
    id: "joined",
    title: "Joined",
    count: 4,
    dotColor: "bg-emerald-500",
    cards: [
      {
        id: "j1",
        name: "Dr. K. Verma",
        initials: "KV",
        initialsColor: "bg-gray-700 text-gray-300",
        department: "Anatomy",
        subtitle: "Tutor - Anatomy",
        onboardedNote: "Onboarded 2 days ago",
      },
    ],
  },
];

// ---------------------------------------------------------------------------

export default function RecruitmentDashboardPage() {
  return (
    <div className="flex h-[calc(100vh-64px)] flex-col overflow-hidden">
      {/* Fixed Header */}
      <div className="shrink-0 border-b border-dark-border p-6">
        <div className="mx-auto max-w-[1920px] space-y-6">
          {/* Title Row */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">
                Faculty Recruitment
              </h1>
              <p className="mt-1 flex items-center gap-2 text-sm text-gray-400">
                MSR Gap Analysis:{" "}
                <span className="font-semibold text-white">
                  12 Open Positions
                </span>
                <span className="h-1 w-1 rounded-full bg-gray-500" />
                4 Departments Impacted
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-gradient-to-r from-emerald-500/20 to-emerald-900/20 px-3 py-1.5">
                <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-400">
                  AI Shortlist Active
                </span>
              </div>
              <div className="flex rounded-lg border border-dark-border bg-[#262626] p-1">
                <button className="flex items-center gap-1 rounded bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm">
                  <Columns3 className="h-3.5 w-3.5" /> Kanban
                </button>
                <button className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:text-white">
                  <Table2 className="h-3.5 w-3.5" /> Table
                </button>
              </div>
              <Button size="sm" className="shadow-lg shadow-emerald-500/20">
                <Plus className="mr-2 h-4 w-4" /> Post New Job
              </Button>
            </div>
          </div>

          {/* Open Positions */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {POSITIONS.map((pos) => (
              <div
                key={pos.id}
                className="group cursor-pointer rounded-lg border border-dark-border bg-dark-surface p-5 shadow-md transition-all hover:border-gray-600 hover:shadow-lg"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-dark-border bg-[#262626] text-gray-400 transition-colors group-hover:border-emerald-500/20 group-hover:bg-emerald-500/10 group-hover:text-emerald-500">
                      <BadgeCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white transition-colors group-hover:text-emerald-500">
                        {pos.title}
                      </h3>
                      <p className="text-[11px] text-gray-400">
                        {pos.department}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "rounded-md border px-2 py-1 text-[10px] font-semibold capitalize",
                      PRIORITY_BADGE[pos.priority],
                    )}
                  >
                    {pos.priority}
                  </span>
                </div>
                <div className="mb-4 flex items-center gap-2 rounded-md border border-dark-border/50 bg-[#262626]/50 px-3 py-2 text-[11px] text-gray-400">
                  <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" />
                  <span>{pos.qualification}</span>
                </div>
                <div className="flex items-center justify-between border-t border-dark-border pt-3">
                  <div className="flex -space-x-2">
                    {pos.applicants.map((a, i) => (
                      <div
                        key={i}
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full text-[9px] text-white ring-2 ring-dark-surface",
                          a.color,
                        )}
                      >
                        {a.initials}
                      </div>
                    ))}
                    {pos.overflow > 0 && (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#262626] text-[9px] text-gray-400 ring-2 ring-dark-surface">
                        +{pos.overflow}
                      </div>
                    )}
                    {pos.totalApplicants === 0 && (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#262626] text-[9px] text-gray-600 ring-2 ring-dark-surface">
                        0
                      </div>
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium transition-colors group-hover:text-white",
                      pos.totalApplicants === 0
                        ? "text-gray-500"
                        : "text-gray-400",
                    )}
                  >
                    {pos.totalApplicants === 0
                      ? "No Applicants"
                      : `${pos.totalApplicants} Applicants`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Kanban Board — horizontally scrollable */}
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex h-full min-w-max gap-6">
          {KANBAN_COLUMNS.map((col) => (
            <div
              key={col.id}
              className={cn(
                "flex h-full w-80 flex-col rounded-lg",
                col.highlighted
                  ? "border border-emerald-500/20 bg-dark-surface/60 shadow-lg shadow-emerald-500/5"
                  : "border border-dark-border/50 bg-dark-surface/30",
              )}
            >
              {/* Column Header */}
              <div
                className={cn(
                  "flex items-center justify-between rounded-t-lg p-4",
                  col.highlighted
                    ? "border-b border-emerald-500/20 bg-dark-surface/80"
                    : "border-b border-dark-border bg-dark-surface/30",
                )}
              >
                <div className="flex items-center gap-2">
                  {col.highlighted ? (
                    <ShieldCheck className="h-4 w-4 animate-pulse text-emerald-500" />
                  ) : (
                    <span className={cn("h-2 w-2 rounded-full", col.dotColor)} />
                  )}
                  <h3 className="text-sm font-semibold text-white">
                    {col.title}
                  </h3>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-xs",
                      col.highlighted
                        ? "border border-emerald-500/20 bg-emerald-500/20 text-emerald-500"
                        : "bg-[#262626] text-gray-400",
                    )}
                  >
                    {col.count}
                  </span>
                </div>
                {col.highlighted && (
                  <button className="text-gray-500 hover:text-white">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Column Cards */}
              <div
                className={cn(
                  "flex-1 space-y-3 overflow-y-auto p-3",
                  col.highlighted &&
                    "bg-gradient-to-b from-emerald-500/5 to-transparent",
                  col.id === "joined" &&
                    "opacity-70 transition-opacity hover:opacity-100",
                )}
              >
                {col.cards.map((card) => (
                  <KanbanCard key={card.id} card={card} columnId={col.id} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating AI Button */}
      <div className="absolute bottom-6 right-6 z-20">
        <button className="group flex transform items-center gap-2 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3 text-white shadow-lg shadow-emerald-900/40 transition-all hover:scale-105 hover:from-emerald-500 hover:to-teal-500">
          <Bot className="h-5 w-5 animate-pulse" />
          <span className="text-sm font-medium">AI Screening Report</span>
          <span className="ml-1 rounded bg-white/20 px-1.5 py-0.5 text-xs">
            New
          </span>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Kanban Card — renders differently per column
// ---------------------------------------------------------------------------

function KanbanCard({
  card,
  columnId,
}: {
  card: RecruitmentKanbanColumn["cards"][number];
  columnId: string;
}) {
  const isNmcHighlight = columnId === "nmc_check" && card.aiMatchPct;

  return (
    <div
      className={cn(
        "cursor-grab rounded-lg border p-4 shadow-sm transition-all active:cursor-grabbing",
        isNmcHighlight
          ? "border-emerald-500/40 bg-[#262626] hover:border-emerald-500"
          : "border-dark-border bg-dark-surface hover:border-gray-500",
        card.onboardedNote && "cursor-default",
      )}
    >
      {/* AI Match Badge */}
      {card.aiMatchPct && (
        <div className="mb-2 flex justify-end">
          <span className="flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-500">
            <Sparkles className="h-3 w-3" /> {card.aiMatchPct}%
          </span>
        </div>
      )}

      {/* Onboarded note (Joined column) */}
      {card.onboardedNote && (
        <div className="mb-3 flex items-center gap-2">
          <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-[11px] font-medium text-gray-400">
            {card.onboardedNote}
          </span>
        </div>
      )}

      {/* Department + Time Row */}
      {!card.onboardedNote && (
        <div className="mb-3 flex items-start justify-between">
          <span className="rounded-md border border-dark-border bg-[#262626] px-2 py-0.5 text-[10px] font-medium text-gray-400">
            {card.department}
          </span>
          {card.timeAgo && (
            <span className="text-[10px] text-gray-500">{card.timeAgo}</span>
          )}
          {card.scheduleBadge && (
            <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
              {card.scheduleBadge}
            </span>
          )}
        </div>
      )}

      {/* Avatar + Name */}
      <div className="mb-3 flex items-center gap-3">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full border text-xs font-bold",
            card.initialsColor,
          )}
        >
          {card.initials}
        </div>
        <div>
          <h4
            className={cn(
              "text-sm font-semibold text-white",
              isNmcHighlight && "font-bold",
            )}
          >
            {card.name}
          </h4>
          {card.subtitle && (
            <p className="text-[11px] text-gray-400">{card.subtitle}</p>
          )}
          {card.statusNote && (
            <p className="text-[11px] font-medium text-yellow-500">
              {card.statusNote}
            </p>
          )}
          {card.clarificationNote && (
            <span className="mt-0.5 inline-block rounded border border-yellow-500/20 bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-medium text-yellow-500">
              Clarification Needed
            </span>
          )}
        </div>
      </div>

      {/* Tags (Applied column) */}
      {card.tags && card.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-dark-border/50 pt-2">
          {card.tags.map((tag) => (
            <span
              key={tag}
              className="rounded border border-dark-border/40 bg-[#262626]/60 px-2 py-1 text-[10px] text-gray-400"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Warning + Review (Screening column) */}
      {card.warningLabel && (
        <div className="flex items-center justify-between border-t border-dark-border/50 pt-2">
          <span className="flex items-center gap-1 rounded border border-orange-500/20 bg-orange-500/10 px-2 py-0.5 text-[10px] font-medium text-orange-400">
            <AlertTriangle className="h-3 w-3" /> {card.warningLabel}
          </span>
          <button className="text-[11px] font-medium text-emerald-500 transition-colors hover:text-white">
            Review
          </button>
        </div>
      )}

      {/* NMC Qualification Checks */}
      {card.nmcChecks && (
        <>
          <div className="space-y-2 rounded-lg border border-dark-border/50 bg-black/20 p-2.5">
            {card.nmcChecks.map((check) => (
              <div
                key={check.label}
                className="flex items-center justify-between text-[11px]"
              >
                <span className="text-gray-400">{check.label}</span>
                <span className="flex items-center gap-1 font-medium text-emerald-400">
                  <CheckCircle className="h-3 w-3" /> {check.value}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button className="flex-1 rounded-md bg-emerald-500 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-colors hover:bg-emerald-600">
              Approve
            </button>
            <button className="rounded-md border border-dark-border bg-dark-surface px-3 py-1.5 text-[11px] font-medium text-gray-300 transition-colors hover:bg-gray-700">
              Details
            </button>
          </div>
        </>
      )}

      {/* Clarification Note */}
      {card.clarificationNote && (
        <div className="rounded-md border border-dark-border bg-[#262626] p-2 text-[11px] leading-snug text-gray-400">
          <span className="mr-1 text-yellow-500">&#9888;</span>
          {card.clarificationNote}
        </div>
      )}

      {/* Reschedule (Interview column) */}
      {card.scheduleBadge && (
        <button className="mt-1 w-full rounded-md border border-dark-border bg-[#262626] py-1.5 text-[11px] font-medium text-gray-400 transition-colors hover:bg-dark-surface hover:text-white">
          Reschedule Interview
        </button>
      )}
    </div>
  );
}
