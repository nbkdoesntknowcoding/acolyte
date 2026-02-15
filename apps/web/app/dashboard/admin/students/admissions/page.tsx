"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  Upload,
  Download,
  ClipboardCheck,
  Eye,
  MoreVertical,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Loader2,
  Users,
  UserCheck,
  UserMinus,
  Clock,
  Check,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CounselingTimeline } from "@/components/admin/counseling-timeline";
import { cn } from "@/lib/utils";

import {
  useSeatMatrix,
  useStudents,
  useCreateStudent,
  usePipelineSummary,
} from "@/lib/hooks/admin/use-students";
import { useCounselingRounds } from "@/lib/hooks/admin/use-admissions";
import type { StudentResponse, StudentCreate, SeatMatrixItem } from "@/types/admin-api";

// ---------------------------------------------------------------------------
// Pipeline status config
// ---------------------------------------------------------------------------

type PipelineStatus =
  | "applied"
  | "documents_submitted"
  | "under_verification"
  | "fee_pending"
  | "enrolled";

const PIPELINE_CONFIG: Record<
  PipelineStatus,
  { label: string; color: string; textColor: string; dotColor: string }
> = {
  applied: {
    label: "Applied",
    color: "bg-zinc-500/10 text-zinc-300",
    textColor: "text-zinc-400",
    dotColor: "bg-zinc-400",
  },
  documents_submitted: {
    label: "Docs Submitted",
    color: "bg-blue-500/10 text-blue-400",
    textColor: "text-blue-400",
    dotColor: "bg-blue-400",
  },
  under_verification: {
    label: "Verification",
    color: "bg-amber-500/10 text-amber-400",
    textColor: "text-amber-400",
    dotColor: "bg-amber-400",
  },
  fee_pending: {
    label: "Fee Pending",
    color: "bg-orange-500/10 text-orange-400",
    textColor: "text-orange-400",
    dotColor: "bg-orange-400",
  },
  enrolled: {
    label: "Enrolled",
    color: "bg-emerald-500/10 text-emerald-400",
    textColor: "text-emerald-400",
    dotColor: "bg-emerald-400",
  },
};

const ADMISSION_STATUSES: PipelineStatus[] = [
  "applied",
  "documents_submitted",
  "under_verification",
  "fee_pending",
  "enrolled",
];

const CATEGORY_STYLES: Record<string, string> = {
  General: "bg-zinc-500/10 text-zinc-300",
  OBC: "bg-blue-500/10 text-blue-400",
  "OBC-NCL": "bg-blue-500/10 text-blue-400",
  SC: "bg-purple-500/10 text-purple-400",
  ST: "bg-orange-500/10 text-orange-400",
  EWS: "bg-cyan-500/10 text-cyan-400",
  PwD: "bg-pink-500/10 text-pink-400",
};

const QUOTA_STYLES: Record<string, string> = {
  AIQ: "bg-blue-500/10 text-blue-400",
  State: "bg-emerald-500/10 text-emerald-400",
  Management: "bg-purple-500/10 text-purple-400",
  NRI: "bg-amber-500/10 text-amber-400",
  Institutional: "bg-zinc-500/10 text-zinc-400",
};

const QUOTA_LABELS: Record<string, string> = {
  AIQ: "AIQ",
  State: "State",
  Management: "Mgmt",
  NRI: "NRI",
  Institutional: "Inst.",
};

function formatStatus(status: string) {
  return status
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function AdmissionsPage() {
  const router = useRouter();

  // Academic year state
  const [selectedYear, setSelectedYear] = useState("2025-26");
  const [showYearPicker, setShowYearPicker] = useState(false);
  const admissionYear = parseInt(selectedYear.split("-")[0]);

  // Search + filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [quotaFilter, setQuotaFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  // New Admission dialog
  const [showNewAdmission, setShowNewAdmission] = useState(false);

  // Debounce search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, quotaFilter, selectedYear]);

  // --- Data hooks ---
  const seatMatrix = useSeatMatrix(selectedYear);
  const counselingRounds = useCounselingRounds(admissionYear);
  const pipelineSummary = usePipelineSummary(selectedYear);

  // Pipeline students
  const statusParam =
    statusFilter === "all"
      ? ADMISSION_STATUSES.join(",")
      : statusFilter;

  const students = useStudents({
    page,
    page_size: pageSize,
    search: debouncedSearch || undefined,
    status: statusParam,
    admission_quota: quotaFilter === "all" ? undefined : quotaFilter,
    admission_year: admissionYear,
    sort_by: "neet_score",
    sort_order: "desc",
  });

  const ps = pipelineSummary.data;
  const totalResults = students.data?.total ?? 0;
  const totalPages = students.data?.total_pages ?? 1;
  const sm = seatMatrix.data;

  // NMC pending: enrolled students with nmc_uploaded = false
  const nmcPendingCount =
    students.data?.data.filter(
      (s) => s.nmc_uploaded === false && s.status === "enrolled"
    ).length ?? 0;

  // Status tab config with counts
  const statusTabs = [
    { value: "all", label: "All", count: ps?.total ?? 0 },
    { value: "applied", label: "Applied", count: ps?.applied ?? 0 },
    {
      value: "documents_submitted",
      label: "Docs Submitted",
      count: ps?.documents_submitted ?? 0,
    },
    {
      value: "under_verification",
      label: "Verification",
      count: ps?.under_verification ?? 0,
    },
    { value: "fee_pending", label: "Fee Pending", count: ps?.fee_pending ?? 0 },
    { value: "enrolled", label: "Enrolled", count: ps?.enrolled ?? 0 },
  ];

  const yearOptions = ["2025-26", "2024-25", "2023-24", "2022-23"];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Admissions</h1>
          <p className="mt-0.5 text-sm text-zinc-400">
            {sm?.annual_intake ?? "—"} intake &middot; AY {selectedYear}
          </p>
        </div>
        <div className="relative">
          <button
            className="flex items-center gap-2 rounded-lg border border-[#1E1E1E] bg-[#141414] px-4 py-2 text-sm transition-colors hover:border-emerald-500/50"
            onClick={() => setShowYearPicker(!showYearPicker)}
          >
            <span className="text-zinc-400">AY:</span>
            <span className="font-semibold text-white">{selectedYear}</span>
            <ChevronDown className="h-4 w-4 text-zinc-400" />
          </button>
          {showYearPicker && (
            <div className="absolute right-0 top-full z-20 mt-1 rounded-lg border border-[#1E1E1E] bg-[#141414] py-1 shadow-xl">
              {yearOptions.map((yr) => (
                <button
                  key={yr}
                  className={cn(
                    "block w-full px-4 py-2 text-left text-sm transition-colors hover:bg-[#1E1E1E]",
                    yr === selectedYear
                      ? "text-emerald-400"
                      : "text-zinc-300"
                  )}
                  onClick={() => {
                    setSelectedYear(yr);
                    setShowYearPicker(false);
                  }}
                >
                  {yr}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Summary Stats Row */}
      <div className="grid grid-cols-5 gap-3">
        {[
          {
            label: "Sanctioned",
            value: sm?.total_sanctioned,
            Icon: Users,
          },
          {
            label: "Admitted",
            value: sm?.total_filled,
            Icon: UserCheck,
          },
          {
            label: "Vacant",
            value: sm?.total_vacant,
            Icon: UserMinus,
            color:
              (sm?.total_vacant ?? 0) > 0
                ? "text-amber-400"
                : "text-emerald-400",
          },
          {
            label: "In Pipeline",
            value:
              (ps?.applied ?? 0) +
              (ps?.documents_submitted ?? 0) +
              (ps?.under_verification ?? 0) +
              (ps?.fee_pending ?? 0),
            Icon: Clock,
          },
          {
            label: "NMC Pending",
            value: nmcPendingCount || 0,
            Icon: AlertTriangle,
            color: "text-amber-400",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-[#1E1E1E] bg-[#141414] px-4 py-3"
          >
            <div className="mb-1 flex items-center gap-2 text-zinc-400">
              <stat.Icon className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wide">
                {stat.label}
              </span>
            </div>
            <div
              className={cn(
                "text-2xl font-semibold",
                stat.color || "text-white"
              )}
            >
              {seatMatrix.isLoading ? (
                <div className="h-8 w-12 animate-pulse rounded bg-zinc-800" />
              ) : (
                (stat.value ?? "—")
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Seat Matrix + Counseling Rounds */}
      <div className="grid grid-cols-5 gap-4">
        {/* Seat Matrix — 3 cols */}
        <div className="col-span-3 rounded-lg border border-[#1E1E1E] bg-[#141414] p-5">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-400">
            Seat Matrix
          </h2>
          {seatMatrix.isLoading ? (
            <SeatMatrixSkeleton />
          ) : sm?.quotas ? (
            <>
              <div className="space-y-3">
                {sm.quotas.map((q) => (
                  <div key={q.quota} className="flex items-center gap-4">
                    <span className="w-28 text-sm text-zinc-300">
                      {q.quota}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#1E1E1E]">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          q.fill_percentage >= 100
                            ? "bg-emerald-500"
                            : q.fill_percentage >= 75
                              ? "bg-emerald-500/70"
                              : q.fill_percentage >= 50
                                ? "bg-amber-500"
                                : "bg-red-500"
                        )}
                        style={{
                          width: `${Math.min(q.fill_percentage, 100)}%`,
                        }}
                      />
                    </div>
                    <span className="w-20 text-right text-sm text-zinc-300">
                      <span className="font-medium text-white">
                        {q.filled_seats}
                      </span>
                      <span className="text-zinc-500">
                        {" "}
                        / {q.total_seats}
                      </span>
                    </span>
                    <span className="w-20 text-right">
                      {q.vacant_seats > 0 ? (
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">
                          {q.vacant_seats} vacant
                        </span>
                      ) : (
                        <span className="text-xs text-emerald-500">Full</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              {/* Total */}
              <div className="mt-4 flex items-center gap-4 border-t border-[#1E1E1E] pt-3">
                <span className="w-28 text-sm font-medium text-zinc-200">
                  Total
                </span>
                <div className="flex-1" />
                <span className="w-20 text-right text-sm text-zinc-300">
                  <span className="font-semibold text-white">
                    {sm.total_filled}
                  </span>
                  <span className="text-zinc-500">
                    {" "}
                    / {sm.total_sanctioned}
                  </span>
                </span>
                <span className="w-20 text-right">
                  {sm.total_vacant > 0 ? (
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">
                      {sm.total_vacant} vacant
                    </span>
                  ) : (
                    <span className="text-xs text-emerald-500">Full</span>
                  )}
                </span>
              </div>
            </>
          ) : (
            <p className="py-8 text-center text-sm text-zinc-500">
              No seat matrix data available.
            </p>
          )}
        </div>

        {/* Counseling Rounds — 2 cols */}
        <div className="col-span-2">
          {counselingRounds.isLoading ? (
            <CounselingRoundsSkeleton />
          ) : counselingRounds.data ? (
            <CounselingTimeline
              rounds={counselingRounds.data.rounds}
              total={counselingRounds.data.total}
            />
          ) : (
            <Card className="flex h-full items-center justify-center">
              <p className="text-sm text-zinc-500">
                No counseling data available.
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Admission Pipeline */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-400">
            Admission Pipeline
          </h2>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() => setShowNewAdmission(true)}
          >
            <Plus className="mr-1 h-4 w-4" /> New Admission
          </Button>
        </div>

        {/* Status filter tabs */}
        <div className="mb-4 flex w-fit gap-1 rounded-lg border border-[#1E1E1E] bg-[#141414] p-1">
          {statusTabs.map((t) => (
            <button
              key={t.value}
              onClick={() => setStatusFilter(t.value)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                statusFilter === t.value
                  ? "bg-[#1E1E1E] text-white"
                  : "text-zinc-400 hover:text-zinc-300"
              )}
            >
              {t.label}
              {t.count > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-xs",
                    statusFilter === t.value
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-[#1E1E1E] text-zinc-500"
                  )}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search + quota filter */}
        <div className="mb-4 flex gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              className="w-full rounded-lg border border-[#1E1E1E] bg-[#141414] py-2 pl-9 pr-4 text-sm text-white placeholder-zinc-500 outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              placeholder="Search by name, phone, NEET roll..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="rounded-lg border border-[#1E1E1E] bg-[#141414] px-3 py-2 text-sm text-zinc-300 outline-none focus:border-emerald-500"
            value={quotaFilter}
            onChange={(e) => setQuotaFilter(e.target.value)}
          >
            <option value="all">All Quotas</option>
            <option value="AIQ">AIQ</option>
            <option value="State">State</option>
            <option value="Management">Management</option>
            <option value="NRI">NRI</option>
          </select>
          <div className="flex items-center gap-2 border-l border-[#1E1E1E] pl-3">
            <button
              className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-[#1E1E1E] hover:text-white"
              title="Import CSV"
            >
              <Upload className="h-4 w-4" />
            </button>
            <button
              className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-[#1E1E1E] hover:text-white"
              title="Export"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-lg border border-[#1E1E1E] bg-[#141414]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1E1E1E]">
                <th className="w-12 px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                  #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Candidate
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                  NEET Details
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Category / Quota
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Round
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Status
                </th>
                <th className="w-20 px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {students.isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))
              ) : students.data && students.data.data.length > 0 ? (
                students.data.data.map((student, idx) => (
                  <CandidateRow
                    key={student.id}
                    student={student}
                    index={(page - 1) * pageSize + idx + 1}
                    onView={() =>
                      router.push(
                        `/dashboard/admin/students/records/${student.id}`
                      )
                    }
                  />
                ))
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center"
                  >
                    <Users className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
                    <p className="text-sm text-zinc-400">
                      {students.isError
                        ? "Failed to load admission pipeline."
                        : "No candidates match your filters."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {totalResults > 0 && (
            <div className="flex items-center justify-between border-t border-[#1E1E1E] px-4 py-3">
              <span className="text-xs text-zinc-500">
                Showing {(page - 1) * pageSize + 1}–
                {Math.min(page * pageSize, totalResults)} of {totalResults}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* NMC Compliance Banner */}
      {nmcPendingCount > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-400" />
            <div>
              <p className="text-sm text-amber-200">
                {nmcPendingCount} students pending NMC portal upload
              </p>
              <p className="mt-0.5 text-xs text-amber-400/70">
                All admissions must be uploaded within 15 days of reporting
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
          >
            Upload Now
          </Button>
        </div>
      )}

      {/* New Admission Dialog */}
      <NewAdmissionDialog
        open={showNewAdmission}
        onOpenChange={setShowNewAdmission}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Candidate Row
// ---------------------------------------------------------------------------

function CandidateRow({
  student,
  index,
  onView,
}: {
  student: StudentResponse;
  index: number;
  onView: () => void;
}) {
  const pipeline =
    PIPELINE_CONFIG[student.status as PipelineStatus] ??
    PIPELINE_CONFIG.applied;

  const initials = student.name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <tr className="border-b border-[#1E1E1E] transition-colors hover:bg-[#1A1A1A]">
      <td className="px-4 py-3 text-sm text-zinc-500">{index}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-700 text-xs font-bold text-white">
            {initials}
          </div>
          <div>
            <div className="text-sm font-medium text-white">
              {student.name}
            </div>
            <div className="text-xs text-zinc-500">
              {student.phone || student.email || "—"}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="text-sm text-white">
          {student.neet_score ?? "—"}
          {student.neet_rank != null && (
            <span className="text-zinc-500">
              {" "}
              / {student.neet_rank.toLocaleString("en-IN")}
            </span>
          )}
        </div>
        <div className="text-xs text-zinc-500">
          {student.neet_roll_number || "—"}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1.5">
          {student.category && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs",
                CATEGORY_STYLES[student.category] ??
                  "bg-zinc-500/10 text-zinc-400"
              )}
            >
              {student.category}
            </span>
          )}
          {student.admission_quota && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs",
                QUOTA_STYLES[student.admission_quota] ??
                  "bg-zinc-500/10 text-zinc-400"
              )}
            >
              {QUOTA_LABELS[student.admission_quota] ??
                student.admission_quota}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-zinc-300">
        {student.counseling_round || "—"}
      </td>
      <td className="px-4 py-3">
        <span
          className={cn(
            "inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs",
            pipeline.color
          )}
        >
          <span
            className={cn("h-1.5 w-1.5 rounded-full", pipeline.dotColor)}
          />
          {formatStatus(student.status)}
        </span>
      </td>
      <td className="px-4 py-3">
        <button
          className="p-1 text-zinc-400 transition-colors hover:text-emerald-500"
          onClick={onView}
          title="View profile"
        >
          <Eye className="h-4 w-4" />
        </button>
        <button
          className="ml-1 p-1 text-zinc-400 transition-colors hover:text-emerald-500"
          title="More actions"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// New Admission Dialog — Multi-Step Form
// ---------------------------------------------------------------------------

type AdmissionFormStep = "personal" | "neet" | "admission" | "review";

const FORM_STEPS: { key: AdmissionFormStep; label: string }[] = [
  { key: "personal", label: "Personal Info" },
  { key: "neet", label: "NEET Details" },
  { key: "admission", label: "Admission Info" },
  { key: "review", label: "Review & Submit" },
];

interface AdmissionFormData {
  name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  gender: string;
  category: string;
  father_name: string;
  mother_name: string;
  neet_roll_number: string;
  neet_score: string;
  neet_rank: string;
  neet_percentile: string;
  neet_year: string;
  admission_quota: string;
  counseling_round: string;
  allotment_order_number: string;
  admission_date: string;
  admission_year: string;
}

const INITIAL_FORM: AdmissionFormData = {
  name: "",
  email: "",
  phone: "",
  date_of_birth: "",
  gender: "",
  category: "",
  father_name: "",
  mother_name: "",
  neet_roll_number: "",
  neet_score: "",
  neet_rank: "",
  neet_percentile: "",
  neet_year: "",
  admission_quota: "",
  counseling_round: "",
  allotment_order_number: "",
  admission_date: "",
  admission_year: "",
};

function NewAdmissionDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [step, setStep] = useState<AdmissionFormStep>("personal");
  const [form, setForm] = useState<AdmissionFormData>(INITIAL_FORM);
  const createStudent = useCreateStudent();

  const currentStepIdx = FORM_STEPS.findIndex((s) => s.key === step);

  function update(field: keyof AdmissionFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleNext() {
    const nextIdx = currentStepIdx + 1;
    if (nextIdx < FORM_STEPS.length) {
      setStep(FORM_STEPS[nextIdx].key);
    }
  }

  function handleBack() {
    const prevIdx = currentStepIdx - 1;
    if (prevIdx >= 0) {
      setStep(FORM_STEPS[prevIdx].key);
    }
  }

  function handleSubmit() {
    const payload: StudentCreate = {
      name: form.name,
      email: form.email || undefined,
      phone: form.phone || undefined,
      date_of_birth: form.date_of_birth || undefined,
      gender: form.gender || undefined,
      category: form.category || undefined,
      father_name: form.father_name || undefined,
      mother_name: form.mother_name || undefined,
      neet_roll_number: form.neet_roll_number || undefined,
      neet_score: form.neet_score ? Number(form.neet_score) : undefined,
      neet_rank: form.neet_rank ? Number(form.neet_rank) : undefined,
      neet_percentile: form.neet_percentile
        ? Number(form.neet_percentile)
        : undefined,
      neet_year: form.neet_year ? Number(form.neet_year) : undefined,
      admission_quota: form.admission_quota || undefined,
      counseling_round: form.counseling_round || undefined,
      allotment_order_number: form.allotment_order_number || undefined,
      admission_date: form.admission_date || undefined,
      admission_year: form.admission_year
        ? Number(form.admission_year)
        : undefined,
      status: "applied",
    };

    createStudent.mutate(payload, {
      onSuccess: () => {
        setForm(INITIAL_FORM);
        setStep("personal");
        onOpenChange(false);
      },
    });
  }

  function handleOpenChange(val: boolean) {
    if (!val) {
      setForm(INITIAL_FORM);
      setStep("personal");
      createStudent.reset();
    }
    onOpenChange(val);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl border-[#1E1E1E] bg-[#0A0A0A] text-white">
        <DialogHeader>
          <DialogTitle>New Admission</DialogTitle>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="mb-4 flex items-center gap-1">
          {FORM_STEPS.map((s, i) => (
            <div key={s.key} className="flex flex-1 items-center">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                  i < currentStepIdx
                    ? "bg-emerald-500 text-white"
                    : i === currentStepIdx
                      ? "bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500"
                      : "bg-[#1E1E1E] text-zinc-500"
                )}
              >
                {i < currentStepIdx ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  i + 1
                )}
              </div>
              {i < FORM_STEPS.length - 1 && (
                <div
                  className={cn(
                    "mx-1 h-0.5 flex-1",
                    i < currentStepIdx ? "bg-emerald-500" : "bg-zinc-700"
                  )}
                />
              )}
            </div>
          ))}
        </div>
        <p className="mb-4 text-sm text-zinc-400">
          Step {currentStepIdx + 1} of {FORM_STEPS.length} —{" "}
          {FORM_STEPS[currentStepIdx].label}
        </p>

        {/* Error */}
        {createStudent.isError && (
          <div className="mb-4 rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-300">
            <AlertTriangle className="mr-1 inline h-4 w-4" />
            {createStudent.error?.message ?? "Failed to create admission."}
          </div>
        )}

        {/* Step Forms */}
        <div className="min-h-[280px] space-y-4">
          {step === "personal" && (
            <PersonalStep form={form} update={update} />
          )}
          {step === "neet" && <NeetStep form={form} update={update} />}
          {step === "admission" && (
            <AdmissionInfoStep form={form} update={update} />
          )}
          {step === "review" && <ReviewStep form={form} />}
        </div>

        {/* Actions */}
        <div className="mt-4 flex justify-between border-t border-[#1E1E1E] pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBack}
            disabled={currentStepIdx === 0}
          >
            Back
          </Button>
          {step === "review" ? (
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!form.name || createStudent.isPending}
              className="shadow-lg shadow-emerald-500/20"
            >
              {createStudent.isPending && (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              )}
              Submit Application
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleNext}
              disabled={step === "personal" && !form.name}
            >
              Next
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Step components
// ---------------------------------------------------------------------------

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-zinc-400">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-[#1E1E1E] bg-[#141414] px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500";
const selectCls =
  "w-full rounded-lg border border-[#1E1E1E] bg-[#141414] px-3 py-2 text-sm text-zinc-300 outline-none focus:border-emerald-500";

function PersonalStep({
  form,
  update,
}: {
  form: AdmissionFormData;
  update: (k: keyof AdmissionFormData, v: string) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Full Name *">
          <input
            className={inputCls}
            placeholder="Enter full name"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
          />
        </FormField>
        <FormField label="Email">
          <input
            className={inputCls}
            type="email"
            placeholder="email@example.com"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
          />
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Phone">
          <input
            className={inputCls}
            placeholder="9876543210"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
          />
        </FormField>
        <FormField label="Date of Birth">
          <input
            className={inputCls}
            type="date"
            value={form.date_of_birth}
            onChange={(e) => update("date_of_birth", e.target.value)}
          />
        </FormField>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <FormField label="Gender">
          <select
            className={selectCls}
            value={form.gender}
            onChange={(e) => update("gender", e.target.value)}
          >
            <option value="">Select</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </FormField>
        <FormField label="Category">
          <select
            className={selectCls}
            value={form.category}
            onChange={(e) => update("category", e.target.value)}
          >
            <option value="">Select</option>
            <option value="General">General</option>
            <option value="OBC">OBC</option>
            <option value="SC">SC</option>
            <option value="ST">ST</option>
            <option value="EWS">EWS</option>
            <option value="PwD">PwD</option>
          </select>
        </FormField>
        <FormField label="Father&apos;s Name">
          <input
            className={inputCls}
            placeholder="Father's name"
            value={form.father_name}
            onChange={(e) => update("father_name", e.target.value)}
          />
        </FormField>
      </div>
    </>
  );
}

function NeetStep({
  form,
  update,
}: {
  form: AdmissionFormData;
  update: (k: keyof AdmissionFormData, v: string) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="NEET Roll Number">
          <input
            className={inputCls}
            placeholder="e.g., 2025-KA-123456"
            value={form.neet_roll_number}
            onChange={(e) => update("neet_roll_number", e.target.value)}
          />
        </FormField>
        <FormField label="NEET Year">
          <input
            className={inputCls}
            type="number"
            placeholder="2025"
            value={form.neet_year}
            onChange={(e) => update("neet_year", e.target.value)}
          />
        </FormField>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <FormField label="NEET Score (0-720)">
          <input
            className={inputCls}
            type="number"
            placeholder="685"
            min={0}
            max={720}
            value={form.neet_score}
            onChange={(e) => update("neet_score", e.target.value)}
          />
        </FormField>
        <FormField label="NEET Rank">
          <input
            className={inputCls}
            type="number"
            placeholder="1042"
            min={1}
            value={form.neet_rank}
            onChange={(e) => update("neet_rank", e.target.value)}
          />
        </FormField>
        <FormField label="NEET Percentile">
          <input
            className={inputCls}
            type="number"
            step="0.01"
            placeholder="99.5"
            value={form.neet_percentile}
            onChange={(e) => update("neet_percentile", e.target.value)}
          />
        </FormField>
      </div>
    </>
  );
}

function AdmissionInfoStep({
  form,
  update,
}: {
  form: AdmissionFormData;
  update: (k: keyof AdmissionFormData, v: string) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Admission Quota">
          <select
            className={selectCls}
            value={form.admission_quota}
            onChange={(e) => update("admission_quota", e.target.value)}
          >
            <option value="">Select Quota</option>
            <option value="AIQ">AIQ (15%)</option>
            <option value="State">State Quota</option>
            <option value="Management">Management</option>
            <option value="NRI">NRI</option>
            <option value="Institutional">Institutional</option>
          </select>
        </FormField>
        <FormField label="Counseling Round">
          <select
            className={selectCls}
            value={form.counseling_round}
            onChange={(e) => update("counseling_round", e.target.value)}
          >
            <option value="">Select Round</option>
            <option value="Round 1">Round 1</option>
            <option value="Round 2">Round 2</option>
            <option value="Round 3">Round 3</option>
            <option value="Mop-Up">Mop-Up</option>
            <option value="Stray Vacancy">Stray Vacancy</option>
            <option value="Special Stray">Special Stray</option>
          </select>
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Admission Date">
          <input
            className={inputCls}
            type="date"
            value={form.admission_date}
            onChange={(e) => update("admission_date", e.target.value)}
          />
        </FormField>
        <FormField label="Admission Year">
          <input
            className={inputCls}
            type="number"
            placeholder="2025"
            value={form.admission_year}
            onChange={(e) => update("admission_year", e.target.value)}
          />
        </FormField>
      </div>
      <FormField label="Allotment Order Number">
        <input
          className={inputCls}
          placeholder="Allotment order #"
          value={form.allotment_order_number}
          onChange={(e) => update("allotment_order_number", e.target.value)}
        />
      </FormField>
    </>
  );
}

function ReviewStep({ form }: { form: AdmissionFormData }) {
  const sections = [
    {
      title: "Personal Info",
      items: [
        { label: "Name", value: form.name },
        { label: "Email", value: form.email },
        { label: "Phone", value: form.phone },
        { label: "DOB", value: form.date_of_birth },
        { label: "Gender", value: form.gender },
        { label: "Category", value: form.category },
        { label: "Father", value: form.father_name },
      ],
    },
    {
      title: "NEET Details",
      items: [
        { label: "Roll No", value: form.neet_roll_number },
        { label: "Score", value: form.neet_score },
        { label: "Rank", value: form.neet_rank },
        { label: "Percentile", value: form.neet_percentile },
        { label: "Year", value: form.neet_year },
      ],
    },
    {
      title: "Admission Info",
      items: [
        { label: "Quota", value: form.admission_quota },
        { label: "Round", value: form.counseling_round },
        { label: "Date", value: form.admission_date },
        { label: "Year", value: form.admission_year },
        { label: "Allotment #", value: form.allotment_order_number },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-400">
        Review the details below before submitting. The student will be created
        with <strong className="text-yellow-400">Applied</strong> status.
      </p>
      {sections.map((section) => (
        <div key={section.title}>
          <h4 className="mb-2 text-xs font-semibold uppercase text-zinc-500">
            {section.title}
          </h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {section.items
              .filter((i) => i.value)
              .map((item) => (
                <div
                  key={item.label}
                  className="flex justify-between text-sm"
                >
                  <span className="text-zinc-500">{item.label}:</span>
                  <span className="text-white">{item.value}</span>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-[#1E1E1E]">
      <td className="px-4 py-3">
        <div className="h-4 w-6 rounded bg-zinc-800" />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-zinc-800" />
          <div className="space-y-1">
            <div className="h-4 w-28 rounded bg-zinc-800" />
            <div className="h-3 w-20 rounded bg-zinc-800" />
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="space-y-1">
          <div className="h-3 w-24 rounded bg-zinc-800" />
          <div className="h-3 w-16 rounded bg-zinc-800" />
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1.5">
          <div className="h-5 w-14 rounded-full bg-zinc-800" />
          <div className="h-5 w-12 rounded-full bg-zinc-800" />
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-16 rounded bg-zinc-800" />
      </td>
      <td className="px-4 py-3">
        <div className="h-5 w-20 rounded-full bg-zinc-800" />
      </td>
      <td className="px-4 py-3">
        <div className="h-5 w-10 rounded bg-zinc-800" />
      </td>
    </tr>
  );
}

function SeatMatrixSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-4">
          <div className="h-4 w-28 rounded bg-zinc-800" />
          <div className="h-2 flex-1 rounded bg-zinc-800" />
          <div className="h-4 w-16 rounded bg-zinc-800" />
        </div>
      ))}
    </div>
  );
}

function CounselingRoundsSkeleton() {
  return (
    <Card className="animate-pulse p-6">
      <div className="mb-8 h-5 w-40 rounded bg-zinc-800" />
      <div className="flex justify-between">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-zinc-800" />
            <div className="h-3 w-16 rounded bg-zinc-800" />
          </div>
        ))}
      </div>
    </Card>
  );
}
