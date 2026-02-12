"use client";

import {
  ClipboardCheck,
  BookOpen,
  AlertTriangle,
  Globe,
  CheckCircle,
  Search,
  Filter,
  Plus,
  MoreVertical,
  History,
  BellRing,
  Building,
  ShoppingCart,
  TrendingUp,
  Check,
  X,
  ShieldCheck,
  type LucideIcon,
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
import { cn } from "@/lib/utils";
import type {
  LibraryMSRCard,
  LibraryBookRow,
  LibraryReturnEntry,
  LibraryOverdueEntry,
  DeptLibraryProgress,
  AcquisitionRequest,
  EResourceItem,
} from "@/types/admin";

// ---------------------------------------------------------------------------
// TODO: Replace with API call — GET /api/v1/admin/facilities/library
// ---------------------------------------------------------------------------

const MSR_ICON_MAP: Record<string, LucideIcon> = {
  books: BookOpen,
  warning: AlertTriangle,
  globe: Globe,
  check: CheckCircle,
};

const MSR_CARDS: LibraryMSRCard[] = [
  {
    label: "Total Books",
    value: "8,450",
    target: "Target: 11,000",
    pct: 76,
    barColor: "bg-yellow-500",
    hoverBorder: "hover:border-yellow-500/30",
    iconKey: "books",
  },
  {
    label: "Indian Journals",
    value: "28",
    target: "Target: 36",
    pct: 77,
    barColor: "bg-red-500",
    hoverBorder: "hover:border-red-500/30",
    iconKey: "warning",
  },
  {
    label: "Foreign Journals",
    value: "14",
    target: "Target: 18",
    pct: 77,
    barColor: "bg-yellow-500",
    hoverBorder: "hover:border-yellow-500/30",
    iconKey: "globe",
  },
  {
    label: "E-Library Nodes",
    value: "40/40",
    target: "Fully Compliant",
    pct: 100,
    barColor: "bg-emerald-500",
    hoverBorder: "hover:border-emerald-500/30",
    iconKey: "check",
  },
  {
    label: "Seating Area",
    value: "300+",
    target: "Exceeds MSR",
    pct: 100,
    barColor: "bg-emerald-500",
    hoverBorder: "hover:border-emerald-500/30",
    iconKey: "check",
  },
];

const MSR_ICON_COLOR: Record<string, string> = {
  books: "text-yellow-500",
  warning: "text-red-500",
  globe: "text-yellow-500",
  check: "text-emerald-500",
};

const TABS = ["Book Inventory", "Journal Subscriptions", "E-Library & Analytics"];

const SUBJECT_CLASSES: Record<string, string> = {
  Anatomy: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Physiology: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  Pathology: "bg-red-500/10 text-red-400 border-red-500/20",
  "General Med": "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

const BOOKS: LibraryBookRow[] = [
  {
    accessionNo: "AC-2023-001",
    title: "Gray's Anatomy",
    author: "Susan Standring",
    subject: "Anatomy",
    subjectClasses: SUBJECT_CLASSES["Anatomy"],
    totalCopies: 12,
    availableCopies: 4,
    location: "Rack A-12, Shelf 3",
  },
  {
    accessionNo: "AC-2023-045",
    title: "Guyton and Hall Textbook of Medical Physiology",
    author: "John E. Hall",
    subject: "Physiology",
    subjectClasses: SUBJECT_CLASSES["Physiology"],
    totalCopies: 20,
    availableCopies: 0,
    location: "Rack B-05, Shelf 1",
  },
  {
    accessionNo: "AC-2023-089",
    title: "Robbins Basic Pathology",
    author: "Kumar, Abbas, Aster",
    subject: "Pathology",
    subjectClasses: SUBJECT_CLASSES["Pathology"],
    totalCopies: 15,
    availableCopies: 8,
    location: "Rack C-02, Shelf 4",
  },
  {
    accessionNo: "AC-2023-112",
    title: "Harrison's Principles of Internal Medicine",
    author: "J. Larry Jameson",
    subject: "General Med",
    subjectClasses: SUBJECT_CLASSES["General Med"],
    totalCopies: 8,
    availableCopies: 2,
    location: "Rack D-10, Shelf 2",
  },
];

const RETURNS: LibraryReturnEntry[] = [
  { student: "Rahul M. (MBBS-II)", book: "Pathology Vol 1", fine: null },
  { student: "Sneha K. (Intern)", book: "Surgery Essence", fine: "₹ 20" },
  { student: "Amit P. (MBBS-I)", book: "Biochemistry", fine: null },
];

const OVERDUE: LibraryOverdueEntry[] = [
  { name: "Vikram Singh", detail: "Due: 2 days ago • Anatomy" },
  { name: "Priya D.", detail: "Due: 5 days ago • Pharma" },
];

const DEPT_PROGRESS: DeptLibraryProgress[] = [
  { department: "Anatomy", current: 120, target: 150, barColor: "bg-blue-500" },
  { department: "Physiology", current: 98, target: 100, barColor: "bg-emerald-500" },
  { department: "Biochemistry", current: 45, target: 80, barColor: "bg-yellow-500" },
  { department: "Community Medicine", current: 150, target: 200, barColor: "bg-blue-500" },
];

const ACQUISITIONS: AcquisitionRequest[] = [
  {
    id: "aq1",
    title: "Forensic Medicine & Toxicology",
    requestedBy: "Dr. Reddy (FMT)",
    qty: 5,
    estimate: "₹ 12,000",
    status: "pending",
  },
  {
    id: "aq2",
    title: "Clinical Methods by Hutchison",
    requestedBy: "Dr. Sharma (Gen Med)",
    qty: 10,
    estimate: "₹ 8,500",
    status: "pending",
  },
  {
    id: "aq3",
    title: "Histology Text & Atlas",
    requestedBy: "Approved • Processing",
    qty: 0,
    estimate: "",
    status: "processing",
  },
];

const E_RESOURCES: EResourceItem[] = [
  {
    initial: "U",
    name: "UpToDate",
    accesses: "1,240 Accesses this week",
    trend: "+12%",
    trendColor: "text-emerald-500",
    bgColor: "bg-blue-900/30",
    textColor: "text-blue-400",
    borderColor: "border-blue-900/50",
  },
  {
    initial: "M",
    name: "MEDLINE",
    accesses: "856 Accesses this week",
    trend: "+5%",
    trendColor: "text-emerald-500",
    bgColor: "bg-green-900/30",
    textColor: "text-green-400",
    borderColor: "border-green-900/50",
  },
  {
    initial: "C",
    name: "ClinicalKey",
    accesses: "620 Accesses this week",
    trend: "0%",
    trendColor: "text-gray-500",
    bgColor: "bg-orange-900/30",
    textColor: "text-orange-400",
    borderColor: "border-orange-900/50",
  },
];

// ---------------------------------------------------------------------------

export default function LibraryPage() {
  return (
    <div className="flex h-[calc(100vh-64px)] flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-dark-border bg-dark-surface px-6">
        <nav className="flex items-center text-sm font-medium text-gray-400">
          <span className="cursor-pointer hover:text-white">Facilities</span>
          <span className="mx-2 text-gray-600">/</span>
          <span className="font-semibold text-white">Library Management</span>
        </nav>
        <div className="flex items-center gap-4">
          <div className="flex items-center rounded-lg border border-dark-border bg-dark-surface p-1">
            <button className="flex items-center gap-2 rounded bg-[#262626] px-3 py-1.5 text-xs font-medium text-white shadow-sm">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              NMC Compliant
            </button>
            <button className="rounded px-3 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:text-white">
              Reports
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 space-y-6 overflow-auto p-6">
        {/* NMC MSR Section */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-white">
              <ClipboardCheck className="h-5 w-5 text-emerald-500" />
              NMC Minimum Standard Requirements (MSR)
            </h2>
            <div className="text-xs text-gray-500">Updated: Today, 09:00 AM</div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            {MSR_CARDS.map((card) => {
              const Icon = MSR_ICON_MAP[card.iconKey] ?? BookOpen;
              const iconColor = MSR_ICON_COLOR[card.iconKey] ?? "text-gray-400";
              const isCompliant = card.pct === 100;
              return (
                <div
                  key={card.label}
                  className={cn(
                    "rounded-xl border border-dark-border bg-dark-surface p-4 transition-colors",
                    card.hoverBorder,
                  )}
                >
                  <div className="mb-2 flex items-start justify-between">
                    <span className="text-xs font-semibold uppercase text-gray-400">
                      {card.label}
                    </span>
                    <Icon className={cn("h-5 w-5", iconColor)} />
                  </div>
                  <div className="mb-1 text-2xl font-bold text-white">
                    {card.value}
                  </div>
                  <div
                    className={cn(
                      "mb-2 text-xs",
                      isCompliant ? "text-emerald-500" : "text-gray-500",
                    )}
                  >
                    {card.target}
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-gray-800">
                    <div
                      className={cn("h-1.5 rounded-full", card.barColor)}
                      style={{ width: `${card.pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Main 12-Col Grid */}
        <div className="grid min-h-[500px] grid-cols-12 gap-6">
          {/* Left — Tabs + Book Table + Returns/Overdue */}
          <div className="col-span-12 flex flex-col gap-6 lg:col-span-8">
            {/* Tabs */}
            <div className="flex border-b border-dark-border">
              {TABS.map((tab, i) => (
                <button
                  key={tab}
                  className={cn(
                    "px-4 py-2 text-sm font-medium transition-colors",
                    i === 0
                      ? "border-b-2 border-emerald-500 text-white"
                      : "text-gray-500 hover:text-gray-300",
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Book Inventory Table */}
            <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-dark-border bg-dark-surface">
              <div className="flex items-center justify-between border-b border-dark-border px-6 py-4">
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2 h-[18px] w-[18px] text-gray-500" />
                    <input
                      type="text"
                      placeholder="Search by Title, Author or ISBN..."
                      className="w-64 rounded-lg border border-dark-border bg-[#262626] py-2 pl-9 pr-3 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <button className="flex items-center gap-1 rounded-lg border border-dark-border bg-[#262626] px-3 py-2 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-700">
                    <Filter className="h-4 w-4" /> Filter
                  </button>
                </div>
                <Button size="sm">
                  <Plus className="mr-1 h-4 w-4" /> Add New Book
                </Button>
              </div>
              <div className="flex-1 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-dark-border bg-[#262626]">
                      <TableHead className="text-gray-500">
                        Accession No.
                      </TableHead>
                      <TableHead className="text-gray-500">
                        Title / Author
                      </TableHead>
                      <TableHead className="text-gray-500">Subject</TableHead>
                      <TableHead className="text-gray-500">
                        Copies (Tot/Avl)
                      </TableHead>
                      <TableHead className="text-gray-500">Location</TableHead>
                      <TableHead className="text-right text-gray-500">
                        Action
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {BOOKS.map((book) => (
                      <TableRow
                        key={book.accessionNo}
                        className="border-dark-border transition-colors hover:bg-[#262626]/50"
                      >
                        <TableCell className="font-mono text-xs text-gray-500">
                          {book.accessionNo}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-white">
                            {book.title}
                          </div>
                          <div className="text-xs text-gray-500">
                            {book.author}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "rounded border px-2 py-0.5 text-xs",
                              book.subjectClasses,
                            )}
                          >
                            {book.subject}
                          </span>
                        </TableCell>
                        <TableCell className="text-gray-300">
                          <span className="font-bold">{book.totalCopies}</span>
                          <span className="mx-1 text-gray-600">/</span>
                          <span
                            className={
                              book.availableCopies === 0
                                ? "text-red-500"
                                : "text-emerald-500"
                            }
                          >
                            {book.availableCopies}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs">
                          {book.location}
                        </TableCell>
                        <TableCell className="text-right">
                          <button className="text-gray-400 hover:text-white">
                            <MoreVertical className="h-[18px] w-[18px]" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Today's Returns + Overdue */}
            <div className="flex flex-col overflow-hidden rounded-xl border border-dark-border bg-dark-surface lg:flex-row">
              {/* Returns */}
              <div className="flex-1 border-r border-dark-border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                    <History className="h-5 w-5 text-gray-400" /> Today&apos;s
                    Returns
                  </h3>
                  <span className="cursor-pointer text-xs font-medium text-emerald-500 hover:underline">
                    View All
                  </span>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-dark-border text-gray-500">
                    <tr>
                      <th className="pb-2 font-medium">Student</th>
                      <th className="pb-2 font-medium">Book</th>
                      <th className="pb-2 text-right font-medium">Fine</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-400">
                    {RETURNS.map((r, i) => (
                      <tr
                        key={i}
                        className={cn(
                          i < RETURNS.length - 1 &&
                            "border-b border-dark-border/50",
                        )}
                      >
                        <td className="py-2">{r.student}</td>
                        <td className="py-2 text-white">{r.book}</td>
                        <td
                          className={cn(
                            "py-2 text-right",
                            r.fine ? "text-red-400" : "text-gray-500",
                          )}
                        >
                          {r.fine ?? "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Overdue */}
              <div className="w-full bg-[#262626]/30 p-4 lg:w-1/3">
                <div className="mb-3">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-red-400">
                    <BellRing className="h-[18px] w-[18px] text-red-400" />{" "}
                    Overdue
                  </h3>
                </div>
                <div className="space-y-3">
                  {OVERDUE.map((o) => (
                    <div
                      key={o.name}
                      className="flex items-center justify-between rounded border border-dark-border bg-dark-surface p-2"
                    >
                      <div>
                        <div className="text-xs font-medium text-white">
                          {o.name}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          {o.detail}
                        </div>
                      </div>
                      <button className="rounded border border-gray-600 px-2 py-1 text-[10px] text-gray-300 transition-colors hover:bg-gray-700">
                        Remind
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="col-span-12 flex flex-col gap-6 lg:col-span-4">
            {/* Dept. Library Tracker */}
            <div className="h-fit rounded-xl border border-dark-border bg-dark-surface p-5">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
                <Building className="h-5 w-5 text-gray-400" /> Dept. Library
                Tracker
              </h3>
              <div className="space-y-4">
                {DEPT_PROGRESS.map((d) => {
                  const pct = Math.round((d.current / d.target) * 100);
                  return (
                    <div key={d.department}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-gray-300">{d.department}</span>
                        <span className="text-gray-500">
                          {d.current}/{d.target} Books
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-[#262626]">
                        <div
                          className={cn("h-1.5 rounded-full", d.barColor)}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Acquisition Queue */}
            <div className="flex-1 rounded-xl border border-dark-border bg-dark-surface p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                  <ShoppingCart className="h-5 w-5 text-gray-400" /> Acquisition
                  Queue
                </h3>
                <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-500">
                  3 New
                </span>
              </div>
              <div className="space-y-3">
                {ACQUISITIONS.map((aq) =>
                  aq.status === "pending" ? (
                    <div
                      key={aq.id}
                      className="rounded-lg border border-dark-border bg-[#262626]/30 p-3 transition-colors hover:border-gray-600"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="line-clamp-1 text-xs font-medium text-white">
                            {aq.title}
                          </p>
                          <p className="mt-1 text-[10px] text-gray-500">
                            Req by: {aq.requestedBy}
                          </p>
                          <p className="mt-0.5 text-[10px] text-gray-400">
                            Qty: {aq.qty} &bull; Est: {aq.estimate}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1">
                          <button className="rounded bg-emerald-500/10 p-1 text-emerald-500 transition-colors hover:bg-emerald-500/20">
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button className="rounded bg-red-500/10 p-1 text-red-500 transition-colors hover:bg-red-500/20">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={aq.id}
                      className="rounded-lg border border-dark-border bg-[#262626]/30 p-3 opacity-60"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="line-clamp-1 text-xs font-medium text-gray-400">
                            {aq.title}
                          </p>
                          <p className="mt-1 text-[10px] text-gray-500">
                            {aq.requestedBy}
                          </p>
                        </div>
                        <span className="text-[10px] font-medium text-emerald-500">
                          PO Sent
                        </span>
                      </div>
                    </div>
                  ),
                )}
              </div>
              <div className="mt-4 border-t border-dark-border pt-3 text-center">
                <button className="w-full text-xs text-gray-400 transition-colors hover:text-white">
                  View All Requests
                </button>
              </div>
            </div>

            {/* Top E-Resources */}
            <div className="rounded-xl border border-dark-border bg-dark-surface p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
                <TrendingUp className="h-5 w-5 text-gray-400" /> Top E-Resources
              </h3>
              <ul className="space-y-3">
                {E_RESOURCES.map((res) => (
                  <li key={res.name} className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded border text-xs font-bold",
                        res.bgColor,
                        res.textColor,
                        res.borderColor,
                      )}
                    >
                      {res.initial}
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-medium text-white">
                        {res.name}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {res.accesses}
                      </div>
                    </div>
                    <span
                      className={cn("text-xs font-medium", res.trendColor)}
                    >
                      {res.trend}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
