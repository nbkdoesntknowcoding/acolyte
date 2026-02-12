"use client";

import { useState } from "react";
import {
  Search,
  Plus,
  Upload,
  Download,
  ClipboardCheck,
  Eye,
  MoreVertical,
  ChevronDown,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SeatMatrix } from "@/components/admin/seat-matrix";
import { CounselingTimeline } from "@/components/admin/counseling-timeline";
import { ComplianceAlertBar } from "@/components/admin/compliance-alert-bar";
import { cn } from "@/lib/utils";
import type {
  SeatQuota,
  CounselingRound,
  AdmissionCandidate,
  AdmissionCategory,
  AdmissionQuota,
  PipelineStage,
} from "@/types/admin";

// ---------------------------------------------------------------------------
// Pipeline helpers
// ---------------------------------------------------------------------------

const PIPELINE_CONFIG: Record<
  PipelineStage,
  { label: string; progress: number; color: string; textColor: string }
> = {
  applied: {
    label: "Applied",
    progress: 10,
    color: "bg-gray-500",
    textColor: "text-gray-400",
  },
  verifying: {
    label: "Verifying",
    progress: 25,
    color: "bg-orange-400",
    textColor: "text-orange-400",
  },
  docs_verified: {
    label: "Docs Verified",
    progress: 50,
    color: "bg-blue-500",
    textColor: "text-blue-500",
  },
  fee_pending: {
    label: "Fee Pending",
    progress: 75,
    color: "bg-yellow-500",
    textColor: "text-yellow-500",
  },
  fee_paid: {
    label: "Fee Paid",
    progress: 90,
    color: "bg-emerald-500",
    textColor: "text-emerald-500",
  },
  enrolled: {
    label: "Enrolled",
    progress: 100,
    color: "bg-emerald-500",
    textColor: "text-emerald-500",
  },
};

const CATEGORY_STYLES: Record<AdmissionCategory, string> = {
  General: "border-purple-800 bg-purple-900/30 text-purple-300",
  OBC: "border-orange-800 bg-orange-900/30 text-orange-300",
  "OBC-NCL": "border-orange-800 bg-orange-900/30 text-orange-300",
  SC: "border-blue-800 bg-blue-900/30 text-blue-300",
  ST: "border-teal-800 bg-teal-900/30 text-teal-300",
  EWS: "border-amber-800 bg-amber-900/30 text-amber-300",
  PwD: "border-pink-800 bg-pink-900/30 text-pink-300",
};

const QUOTA_STYLES: Record<AdmissionQuota, string> = {
  AIQ: "border-blue-800 bg-blue-900/30 text-blue-300",
  State: "border-green-800 bg-green-900/30 text-green-300",
  Management: "border-blue-800 bg-blue-900/30 text-blue-300",
  NRI: "border-teal-800 bg-teal-900/30 text-teal-300",
  Institutional: "border-indigo-800 bg-indigo-900/30 text-indigo-300",
};

// ---------------------------------------------------------------------------
// Mock Data — TODO: Replace with API calls
// ---------------------------------------------------------------------------

// TODO: Replace with useQuery({ queryKey: ["admin", "admissions", "seatMatrix"], queryFn: fetchSeatMatrix })
const MOCK_SEAT_QUOTAS: SeatQuota[] = [
  { name: "AIQ (15%)", sanctioned: 37, filled: 35, vacant: 2, percentage: 95, color: "emerald" },
  { name: "State Quota", sanctioned: 85, filled: 70, vacant: 15, percentage: 82, color: "yellow" },
  { name: "Management", sanctioned: 103, filled: 98, vacant: 5, percentage: 95, color: "emerald" },
  { name: "NRI", sanctioned: 25, filled: 10, vacant: 15, percentage: 40, color: "red" },
];

// TODO: Replace with useQuery({ queryKey: ["admin", "admissions", "counselingRounds"], queryFn: fetchCounselingRounds })
const MOCK_ROUNDS: CounselingRound[] = [
  { id: "1", name: "Round 1", status: "completed", admittedCount: 145 },
  { id: "2", name: "Round 2", status: "completed", admittedCount: 58 },
  { id: "3", name: "Mop-Up", status: "in_progress", processingCount: 10 },
  { id: "4", name: "Stray Vacancy", status: "upcoming" },
  { id: "5", name: "Special Stray", status: "upcoming" },
];

// TODO: Replace with useQuery({ queryKey: ["admin", "admissions", "candidates"], queryFn: fetchAdmissionCandidates })
const MOCK_CANDIDATES: AdmissionCandidate[] = [
  {
    id: "1",
    admissionId: "ADM-25-001",
    name: "Aarav Sharma",
    initials: "AS",
    neetRoll: "23059124",
    neetScore: 685,
    neetRank: 1042,
    category: "General",
    quota: "AIQ",
    pipelineStage: "enrolled",
  },
  {
    id: "2",
    admissionId: "ADM-25-045",
    name: "Vidya Patel",
    initials: "VP",
    neetRoll: "23059882",
    neetScore: 610,
    neetRank: 8520,
    category: "OBC-NCL",
    quota: "State",
    pipelineStage: "fee_pending",
  },
  {
    id: "3",
    admissionId: "ADM-25-067",
    name: "Rohan Das",
    initials: "RD",
    neetRoll: "23061002",
    neetScore: 480,
    neetRank: 42100,
    category: "General",
    quota: "NRI",
    pipelineStage: "verifying",
  },
  {
    id: "4",
    admissionId: "ADM-25-072",
    name: "Sara Khan",
    initials: "SK",
    neetRoll: "23062391",
    neetScore: 635,
    neetRank: 4201,
    category: "General",
    quota: "Management",
    pipelineStage: "enrolled",
  },
];

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function AdmissionsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [quotaFilter, setQuotaFilter] = useState("all");

  // TODO: Replace with useQuery + server-side filtering
  const filteredCandidates = MOCK_CANDIDATES.filter((c) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !c.name.toLowerCase().includes(q) &&
        !c.neetRoll.includes(q) &&
        !c.admissionId.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    if (statusFilter !== "all" && c.pipelineStage !== statusFilter) return false;
    if (quotaFilter !== "all" && c.quota !== quotaFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Admissions Management
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Manage intake, counseling rounds, and student onboarding.
          </p>
        </div>
        <button className="flex items-center gap-2 rounded-lg border border-dark-border bg-dark-surface px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:border-emerald-500">
          <span className="text-gray-400">Academic Year:</span>
          <span className="font-bold text-emerald-500">2025-26</span>
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </button>
      </div>

      {/* Top Row: Seat Matrix + Counseling Schedule */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <SeatMatrix quotas={MOCK_SEAT_QUOTAS} />
        </div>
        <div className="lg:col-span-7">
          <CounselingTimeline rounds={MOCK_ROUNDS} currentPhase="Mop-Up Round" />
        </div>
      </div>

      {/* Admission Pipeline Table */}
      <Card className="flex min-h-[500px] flex-col">
        {/* Table Header + Filters */}
        <div className="flex flex-col items-start justify-between gap-4 border-b border-dark-border p-5 sm:flex-row sm:items-center">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-bold text-white">
              Admission Pipeline
            </h3>
            <p className="text-xs text-gray-400">
              Manage applicants across all quotas and counseling rounds.
            </p>
          </div>
          <div className="flex w-full flex-wrap gap-3 sm:w-auto">
            {/* Search */}
            <div className="relative flex-grow sm:flex-grow-0">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <Search className="h-4 w-4" />
              </span>
              <input
                className="w-full rounded-lg border border-dark-border bg-dark-elevated py-2 pl-10 pr-4 text-sm text-white placeholder-gray-500 outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 sm:w-64"
                placeholder="Search Roll No, Name..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Status Filter */}
            <select
              className="rounded-lg border border-dark-border bg-dark-elevated px-3 py-2 text-sm text-gray-300 outline-none focus:border-emerald-500"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Status: All</option>
              <option value="enrolled">Enrolled</option>
              <option value="fee_paid">Fee Paid</option>
              <option value="fee_pending">Fee Pending</option>
              <option value="docs_verified">Docs Verified</option>
              <option value="verifying">Verifying</option>
              <option value="applied">Applied</option>
            </select>

            {/* Quota Filter */}
            <select
              className="hidden rounded-lg border border-dark-border bg-dark-elevated px-3 py-2 text-sm text-gray-300 outline-none focus:border-emerald-500 md:block"
              value={quotaFilter}
              onChange={(e) => setQuotaFilter(e.target.value)}
            >
              <option value="all">Quota: All</option>
              <option value="AIQ">AIQ</option>
              <option value="State">State</option>
              <option value="Management">Management</option>
              <option value="NRI">NRI</option>
            </select>

            {/* New Admission */}
            <Button size="sm" className="shadow-lg shadow-emerald-500/20">
              <Plus className="h-4 w-4" />
              New Admission
            </Button>

            {/* Toolbar actions */}
            <div className="flex items-center gap-2 border-l border-dark-border pl-3">
              <button
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-dark-elevated hover:text-white"
                title="Import"
                aria-label="Import admissions"
              >
                <Upload className="h-4 w-4" />
              </button>
              <button
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-dark-elevated hover:text-white"
                title="Export"
                aria-label="Export admissions"
              >
                <Download className="h-4 w-4" />
              </button>
              <button
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-dark-elevated hover:text-white"
                title="Bulk Verify"
                aria-label="Bulk verify admissions"
              >
                <ClipboardCheck className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-dark-border bg-dark-elevated text-[10px] uppercase text-gray-500">
              <tr>
                <th className="w-16 px-6 py-4 font-medium">S.No</th>
                <th className="px-6 py-4 font-medium">Candidate Name</th>
                <th className="px-6 py-4 font-medium">NEET Details</th>
                <th className="px-6 py-4 font-medium">Category / Quota</th>
                <th className="px-6 py-4 font-medium">Pipeline Status</th>
                <th className="px-6 py-4 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {filteredCandidates.map((candidate, idx) => {
                const pipeline = PIPELINE_CONFIG[candidate.pipelineStage];
                const startLabel =
                  candidate.pipelineStage === "enrolled" ||
                  candidate.pipelineStage === "fee_paid"
                    ? "Fee Paid"
                    : candidate.pipelineStage === "fee_pending"
                      ? "Docs Verified"
                      : "Applied";

                return (
                  <tr
                    key={candidate.id}
                    className="group transition-colors hover:bg-dark-elevated/40"
                  >
                    <td className="px-6 py-4 text-gray-500">
                      {String(idx + 1).padStart(2, "0")}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gray-700 ring-2 ring-transparent transition-all group-hover:ring-emerald-500/50">
                          <span className="text-sm font-bold text-white">
                            {candidate.initials}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-white">
                            {candidate.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            ID: {candidate.admissionId}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="text-xs text-gray-500">
                          Roll:{" "}
                          <span className="font-mono text-gray-300">
                            {candidate.neetRoll}
                          </span>
                        </div>
                        <div className="flex gap-3">
                          <span className="rounded bg-emerald-500/10 px-1.5 text-xs font-medium text-emerald-500">
                            Score: {candidate.neetScore}
                          </span>
                          <span className="rounded bg-gray-800 px-1.5 text-xs font-medium text-gray-400">
                            Rank: {candidate.neetRank.toLocaleString("en-IN")}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-start gap-1.5">
                        <span
                          className={cn(
                            "inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium",
                            CATEGORY_STYLES[candidate.category],
                          )}
                        >
                          {candidate.category}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium",
                            QUOTA_STYLES[candidate.quota],
                          )}
                        >
                          {candidate.quota === "AIQ"
                            ? "AIQ (15%)"
                            : candidate.quota === "State"
                              ? "State Quota"
                              : `${candidate.quota} Quota`}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-full max-w-[140px]">
                        <div className="mb-1 flex justify-between text-[10px] text-gray-500">
                          <span>{startLabel}</span>
                          <span className={cn("font-bold", pipeline.textColor)}>
                            {pipeline.label}
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-gray-700">
                          <div
                            className={cn(
                              "h-1.5 rounded-full transition-all",
                              pipeline.color,
                            )}
                            style={{ width: `${pipeline.progress}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        className="p-1 text-gray-400 transition-colors hover:text-emerald-500"
                        aria-label={`View ${candidate.name}`}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        className="ml-2 p-1 text-gray-400 transition-colors hover:text-emerald-500"
                        aria-label={`More actions for ${candidate.name}`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredCandidates.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-sm text-gray-500"
                  >
                    No candidates match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-dark-border px-6 py-4">
          <p className="text-xs text-gray-400">
            Showing <span className="font-medium text-white">1</span> to{" "}
            <span className="font-medium text-white">
              {filteredCandidates.length}
            </span>{" "}
            of <span className="font-medium text-white">128</span> results
          </p>
          <div className="flex gap-2">
            <button
              className="rounded border border-dark-border bg-dark-elevated px-3 py-1 text-sm text-gray-400 hover:bg-gray-800 disabled:opacity-50"
              disabled
            >
              Previous
            </button>
            <button className="rounded bg-emerald-500 px-3 py-1 text-sm font-medium text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-600">
              1
            </button>
            <button className="rounded border border-dark-border bg-dark-elevated px-3 py-1 text-sm text-gray-400 hover:bg-gray-800">
              2
            </button>
            <button className="rounded border border-dark-border bg-dark-elevated px-3 py-1 text-sm text-gray-400 hover:bg-gray-800">
              3
            </button>
            <button className="rounded border border-dark-border bg-dark-elevated px-3 py-1 text-sm text-gray-400 hover:bg-gray-800">
              Next
            </button>
          </div>
        </div>
      </Card>

      {/* NMC Compliance Alert Bar */}
      <ComplianceAlertBar
        title="NMC Compliance Check Required"
        description="12 candidates have pending biometric uploads for the Mop-Up round."
        actionLabel="Upload Now"
      />
    </div>
  );
}
