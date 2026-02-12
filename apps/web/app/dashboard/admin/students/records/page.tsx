"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search,
  CloudUpload,
  Download,
  Upload,
  Plus,
  RefreshCw,
  Settings,
  MoreVertical,
  X,
  ChevronDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StudentRecord } from "@/types/admin";

// ---------------------------------------------------------------------------
// TODO: Replace with API call — GET /api/v1/admin/students?page=1&limit=10
// ---------------------------------------------------------------------------

const STUDENTS: StudentRecord[] = [
  {
    id: "1",
    name: "Aarav Patel",
    email: "patel.aarav@acolyte.edu",
    initials: "AP",
    avatarUrl: "/placeholder-avatar.jpg",
    enrollmentNo: "MBBS-2023-001",
    universityRegNo: "U-8829102",
    phase: "Phase I",
    batch: "2023-24",
    quota: "Govt",
    neetScore: 685,
    attendancePct: 92,
    feeStatus: "paid",
  },
  {
    id: "2",
    name: "Sneha Rao",
    email: "sneha.r@acolyte.edu",
    initials: "SR",
    enrollmentNo: "MBBS-2023-042",
    universityRegNo: "U-8829145",
    phase: "Phase I",
    batch: "2023-24",
    quota: "Mgmt",
    neetScore: 520,
    attendancePct: 78,
    feeStatus: "partial",
  },
  {
    id: "3",
    name: "Vikram Singh",
    email: "v.singh@acolyte.edu",
    initials: "VS",
    avatarUrl: "/placeholder-avatar.jpg",
    enrollmentNo: "MBBS-2022-108",
    universityRegNo: "U-7738291",
    phase: "Phase II",
    batch: "2022-23",
    quota: "Govt",
    neetScore: 710,
    attendancePct: 96,
    feeStatus: "paid",
  },
  {
    id: "4",
    name: "Meera Joshi",
    email: "meera.j@acolyte.edu",
    initials: "MJ",
    enrollmentNo: "MBBS-2023-015",
    universityRegNo: "U-8829118",
    phase: "Phase I",
    batch: "2023-24",
    quota: "NRI",
    neetScore: 480,
    attendancePct: 65,
    feeStatus: "due",
  },
  {
    id: "5",
    name: "Rohan Das",
    email: "rohan.d@acolyte.edu",
    initials: "RD",
    avatarUrl: "/placeholder-avatar.jpg",
    enrollmentNo: "MBBS-2022-055",
    universityRegNo: "U-7738230",
    phase: "Phase II",
    batch: "2022-23",
    quota: "Govt",
    neetScore: 655,
    attendancePct: 88,
    feeStatus: "paid",
  },
  {
    id: "6",
    name: "Amit Kumar",
    email: "amit.k@acolyte.edu",
    initials: "AK",
    enrollmentNo: "MBBS-2024-002",
    universityRegNo: "U-9910231",
    phase: "CRMI",
    batch: "2024-25",
    quota: "Mgmt",
    neetScore: 590,
    attendancePct: 82,
    feeStatus: "paid",
  },
];

const TOTAL_COUNT = 847;

// ---------------------------------------------------------------------------
// Style maps
// ---------------------------------------------------------------------------

const PHASE_STYLES: Record<string, string> = {
  "Phase I":
    "bg-blue-900/20 text-blue-300 border-blue-900/30",
  "Phase II":
    "bg-indigo-900/20 text-indigo-300 border-indigo-900/30",
  "Phase III":
    "bg-violet-900/20 text-violet-300 border-violet-900/30",
  CRMI: "bg-emerald-900/20 text-emerald-300 border-emerald-900/30",
};

const QUOTA_STYLES: Record<string, string> = {
  Govt: "bg-purple-900/20 text-purple-300",
  Mgmt: "bg-orange-900/20 text-orange-300",
  NRI: "bg-teal-900/20 text-teal-300",
  AIQ: "bg-blue-900/20 text-blue-300",
  Institutional: "bg-gray-800 text-gray-300",
};

const FEE_STYLES: Record<string, string> = {
  paid: "bg-green-900/20 text-green-400 border-green-900/30",
  partial: "bg-yellow-900/20 text-yellow-400 border-yellow-900/30",
  due: "bg-red-900/20 text-red-400 border-red-900/30",
  waived: "bg-gray-800 text-gray-400 border-gray-700",
};

function attendanceColor(pct: number) {
  if (pct >= 85) return { dot: "bg-green-500", text: "text-green-400" };
  if (pct >= 75) return { dot: "bg-yellow-500", text: "text-yellow-400" };
  return { dot: "bg-red-500", text: "text-red-400" };
}

// ---------------------------------------------------------------------------

export default function StudentRecordsPage() {
  const [search, setSearch] = useState("");
  const [phaseFilter, setPhaseFilter] = useState<string | null>("Phase I");

  const filtered = STUDENTS.filter((s) => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (phaseFilter && s.phase !== phaseFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">Student Records</h1>
          <Badge className="border-emerald-500/20 bg-emerald-500/10 text-xs font-semibold text-emerald-500">
            {TOTAL_COUNT} Active
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm">
            <CloudUpload className="mr-2 h-4 w-4" />
            NMC Data Upload
          </Button>
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <Upload className="mr-2 h-4 w-4" />
            Bulk Import
          </Button>
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Student
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-xl border border-dark-border bg-dark-surface p-4 shadow-sm">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex flex-1 items-center gap-3 overflow-x-auto pb-2 md:pb-0">
            {/* Search */}
            <div className="relative w-full shrink-0 md:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                className="w-full rounded-lg border border-gray-700 bg-dark-elevated py-2 pl-9 pr-4 text-sm text-gray-200 placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="Filter by keyword..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="mx-2 hidden h-8 w-px bg-gray-700 md:block" />

            {/* Filter chips */}
            <div className="flex gap-2">
              <FilterChip label="Batch: All" />
              {phaseFilter ? (
                <button
                  onClick={() => setPhaseFilter(null)}
                  className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-emerald-500/50 bg-emerald-500/20 px-3 py-1.5 text-sm font-medium text-emerald-500 transition-colors hover:bg-emerald-500/30"
                >
                  Phase: {phaseFilter}
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : (
                <FilterChip
                  label="Phase: All"
                  onClick={() => setPhaseFilter("Phase I")}
                />
              )}
              <FilterChip label="Status: Active" />
              <FilterChip label="Quota: All" />
              <FilterChip label="Category: All" />
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="hidden md:inline">
              Showing 1-{filtered.length} of {TOTAL_COUNT}
            </span>
            <button className="rounded-md p-1.5 text-gray-400 hover:bg-dark-elevated hover:text-gray-200">
              <RefreshCw className="h-4 w-4" />
            </button>
            <button className="rounded-md p-1.5 text-gray-400 hover:bg-dark-elevated hover:text-gray-200">
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-hidden rounded-xl border border-dark-border bg-dark-surface shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-dark-border bg-dark-elevated/50 text-xs font-semibold uppercase text-gray-400">
                <th className="w-10 p-4">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-600 bg-transparent text-emerald-500 focus:ring-emerald-500"
                  />
                </th>
                <th className="min-w-[200px] p-4">Student Name</th>
                <th className="p-4">Enrollment No.</th>
                <th className="p-4">Univ. Reg. No.</th>
                <th className="p-4">Phase</th>
                <th className="p-4">Batch</th>
                <th className="p-4">Quota</th>
                <th className="p-4 text-right">NEET Score</th>
                <th className="p-4 text-center">Attendance</th>
                <th className="p-4 text-center">Fee Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border text-sm">
              {filtered.map((s) => {
                const att = attendanceColor(s.attendancePct);
                return (
                  <tr
                    key={s.id}
                    className="group transition-colors hover:bg-dark-elevated/30"
                  >
                    <td className="p-4">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-600 bg-transparent text-emerald-500 focus:ring-emerald-500"
                      />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar
                          initials={s.initials}
                          avatarUrl={s.avatarUrl}
                        />
                        <div>
                          <Link
                            href={`/dashboard/admin/students/records/${s.id}`}
                            className="font-medium text-white transition-colors hover:text-emerald-500"
                          >
                            {s.name}
                          </Link>
                          <p className="text-xs text-gray-500">{s.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 font-mono text-xs text-gray-300">
                      {s.enrollmentNo}
                    </td>
                    <td className="p-4 font-mono text-xs text-gray-400">
                      {s.universityRegNo}
                    </td>
                    <td className="p-4">
                      <span
                        className={cn(
                          "inline-flex items-center rounded border px-2 py-1 text-xs font-medium",
                          PHASE_STYLES[s.phase],
                        )}
                      >
                        {s.phase}
                      </span>
                    </td>
                    <td className="p-4 text-gray-300">{s.batch}</td>
                    <td className="p-4">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                          QUOTA_STYLES[s.quota],
                        )}
                      >
                        {s.quota}
                      </span>
                    </td>
                    <td className="p-4 text-right font-medium text-white">
                      {s.neetScore}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <div
                          className={cn("h-1.5 w-1.5 rounded-full", att.dot)}
                        />
                        <span className={cn("font-medium", att.text)}>
                          {s.attendancePct}%
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span
                        className={cn(
                          "inline-flex items-center rounded border px-2 py-1 text-xs font-medium capitalize",
                          FEE_STYLES[s.feeStatus],
                        )}
                      >
                        {s.feeStatus}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-dark-elevated hover:text-emerald-500">
                        <MoreVertical className="h-[18px] w-[18px]" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-dark-border px-4 py-3">
          <div className="text-xs text-gray-400">
            Showing <span className="font-medium text-white">1</span> to{" "}
            <span className="font-medium text-white">{filtered.length}</span> of{" "}
            <span className="font-medium text-white">{TOTAL_COUNT}</span>{" "}
            results
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
            <Button variant="outline" size="sm">
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- Sub-components ---- */

function Avatar({
  initials,
  avatarUrl,
}: {
  initials: string;
  avatarUrl?: string;
}) {
  // TODO: Replace with actual avatar images from R2
  const colors = [
    "bg-indigo-900/30 text-indigo-400",
    "bg-pink-900/30 text-pink-400",
    "bg-orange-900/30 text-orange-400",
    "bg-teal-900/30 text-teal-400",
    "bg-blue-900/30 text-blue-400",
  ];
  const colorIndex =
    initials.charCodeAt(0) % colors.length;

  return (
    <div
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
        colors[colorIndex],
      )}
    >
      {initials}
    </div>
  );
}

function FilterChip({
  label,
  onClick,
}: {
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-gray-700 bg-dark-elevated px-3 py-1.5 text-sm font-medium text-gray-300 transition-colors hover:border-emerald-500/50"
    >
      {label}
      <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
    </button>
  );
}
