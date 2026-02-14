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
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SeatMatrix } from "@/components/admin/seat-matrix";
import { CounselingTimeline } from "@/components/admin/counseling-timeline";
import { ComplianceAlertBar } from "@/components/admin/compliance-alert-bar";
import { cn } from "@/lib/utils";

import { useSeatMatrix, useStudents, useCreateStudent } from "@/lib/hooks/admin/use-students";
import { useCounselingRounds } from "@/lib/hooks/admin/use-admissions";
import type { StudentResponse, StudentCreate } from "@/types/admin-api";

// ---------------------------------------------------------------------------
// Pipeline status config — matches backend student statuses
// ---------------------------------------------------------------------------

type PipelineStatus =
  | "applied"
  | "documents_submitted"
  | "under_verification"
  | "fee_pending"
  | "enrolled";

const PIPELINE_CONFIG: Record<
  PipelineStatus,
  { label: string; progress: number; color: string; textColor: string }
> = {
  applied: {
    label: "Applied",
    progress: 10,
    color: "bg-gray-500",
    textColor: "text-gray-400",
  },
  documents_submitted: {
    label: "Docs Submitted",
    progress: 30,
    color: "bg-orange-400",
    textColor: "text-orange-400",
  },
  under_verification: {
    label: "Under Verification",
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
  enrolled: {
    label: "Enrolled",
    progress: 100,
    color: "bg-emerald-500",
    textColor: "text-emerald-500",
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
  General: "border-purple-800 bg-purple-900/30 text-purple-300",
  OBC: "border-orange-800 bg-orange-900/30 text-orange-300",
  "OBC-NCL": "border-orange-800 bg-orange-900/30 text-orange-300",
  SC: "border-blue-800 bg-blue-900/30 text-blue-300",
  ST: "border-teal-800 bg-teal-900/30 text-teal-300",
  EWS: "border-amber-800 bg-amber-900/30 text-amber-300",
  PwD: "border-pink-800 bg-pink-900/30 text-pink-300",
};

const QUOTA_STYLES: Record<string, string> = {
  AIQ: "border-blue-800 bg-blue-900/30 text-blue-300",
  State: "border-green-800 bg-green-900/30 text-green-300",
  Management: "border-blue-800 bg-blue-900/30 text-blue-300",
  NRI: "border-teal-800 bg-teal-900/30 text-teal-300",
  Institutional: "border-indigo-800 bg-indigo-900/30 text-indigo-300",
};

const QUOTA_LABELS: Record<string, string> = {
  AIQ: "AIQ (15%)",
  State: "State Quota",
  Management: "Management Quota",
  NRI: "NRI Quota",
  Institutional: "Institutional",
};

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function AdmissionsPage() {
  const router = useRouter();

  // Search + filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [quotaFilter, setQuotaFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  // New Admission dialog
  const [showNewAdmission, setShowNewAdmission] = useState(false);

  // Debounce search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  // --- Data hooks ---
  const seatMatrix = useSeatMatrix();
  const counselingRounds = useCounselingRounds();

  // Pipeline students — filter by admission statuses
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
  });

  // NMC compliance count — students where nmc_uploaded is false
  const nmcPendingCount = students.data?.data.filter(
    (s) => s.nmc_uploaded === false && s.status === "enrolled",
  ).length ?? 0;

  const totalResults = students.data?.total ?? 0;
  const totalPages = students.data?.total_pages ?? 1;

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
          {seatMatrix.isLoading ? (
            <SeatMatrixSkeleton />
          ) : seatMatrix.data ? (
            <SeatMatrix quotas={seatMatrix.data} />
          ) : (
            <Card className="flex h-48 items-center justify-center">
              <p className="text-sm text-gray-500">No seat matrix data available.</p>
            </Card>
          )}
        </div>
        <div className="lg:col-span-7">
          {counselingRounds.isLoading ? (
            <CounselingRoundsSkeleton />
          ) : counselingRounds.data ? (
            <CounselingTimeline
              rounds={counselingRounds.data.rounds}
              total={counselingRounds.data.total}
            />
          ) : (
            <Card className="flex h-48 items-center justify-center">
              <p className="text-sm text-gray-500">No counseling data available.</p>
            </Card>
          )}
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
              {students.isLoading
                ? "Loading..."
                : `${totalResults} applicants across all quotas and counseling rounds.`}
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
                placeholder="Search Name, Roll No..."
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Status Filter */}
            <select
              className="rounded-lg border border-dark-border bg-dark-elevated px-3 py-2 text-sm text-gray-300 outline-none focus:border-emerald-500"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">Status: All</option>
              {ADMISSION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PIPELINE_CONFIG[s].label}
                </option>
              ))}
            </select>

            {/* Quota Filter */}
            <select
              className="hidden rounded-lg border border-dark-border bg-dark-elevated px-3 py-2 text-sm text-gray-300 outline-none focus:border-emerald-500 md:block"
              value={quotaFilter}
              onChange={(e) => {
                setQuotaFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">Quota: All</option>
              <option value="AIQ">AIQ</option>
              <option value="State">State</option>
              <option value="Management">Management</option>
              <option value="NRI">NRI</option>
            </select>

            {/* New Admission */}
            <Button
              size="sm"
              className="shadow-lg shadow-emerald-500/20"
              onClick={() => setShowNewAdmission(true)}
            >
              <Plus className="h-4 w-4" />
              New Admission
            </Button>

            {/* Toolbar actions */}
            <div className="flex items-center gap-2 border-l border-dark-border pl-3">
              <button
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-dark-elevated hover:text-white"
                title="Import CSV"
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
                        `/dashboard/admin/students/records/${student.id}`,
                      )
                    }
                  />
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-sm text-gray-500"
                  >
                    {students.isError
                      ? "Failed to load admission pipeline."
                      : "No candidates match your filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-dark-border px-6 py-4">
            <p className="text-xs text-gray-400">
              Showing{" "}
              <span className="font-medium text-white">
                {(page - 1) * pageSize + 1}
              </span>{" "}
              to{" "}
              <span className="font-medium text-white">
                {Math.min(page * pageSize, totalResults)}
              </span>{" "}
              of{" "}
              <span className="font-medium text-white">{totalResults}</span>{" "}
              results
            </p>
            <div className="flex gap-2">
              <button
                className="rounded border border-dark-border bg-dark-elevated px-3 py-1 text-sm text-gray-400 hover:bg-gray-800 disabled:opacity-50"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    className={cn(
                      "rounded px-3 py-1 text-sm",
                      pageNum === page
                        ? "bg-emerald-500 font-medium text-white shadow-md shadow-emerald-500/20"
                        : "border border-dark-border bg-dark-elevated text-gray-400 hover:bg-gray-800",
                    )}
                    onClick={() => setPage(pageNum)}
                  >
                    {pageNum}
                  </button>
                );
              })}
              {totalPages > 5 && (
                <span className="px-2 py-1 text-sm text-gray-500">...</span>
              )}
              <button
                className="rounded border border-dark-border bg-dark-elevated px-3 py-1 text-sm text-gray-400 hover:bg-gray-800 disabled:opacity-50"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* NMC Compliance Alert Bar */}
      {nmcPendingCount > 0 && (
        <ComplianceAlertBar
          title="NMC Compliance Check Required"
          description={`${nmcPendingCount} enrolled student${nmcPendingCount !== 1 ? "s" : ""} pending NMC portal upload.`}
          actionLabel="Upload Now"
        />
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
    PIPELINE_CONFIG[student.status as PipelineStatus] ?? PIPELINE_CONFIG.applied;

  const initials = student.name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const startLabel =
    student.status === "enrolled"
      ? "Fee Paid"
      : student.status === "fee_pending"
        ? "Docs Verified"
        : "Applied";

  return (
    <tr className="group transition-colors hover:bg-dark-elevated/40">
      <td className="px-6 py-4 text-gray-500">
        {String(index).padStart(2, "0")}
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gray-700 ring-2 ring-transparent transition-all group-hover:ring-emerald-500/50">
            <span className="text-sm font-bold text-white">{initials}</span>
          </div>
          <div>
            <div className="font-medium text-white">{student.name}</div>
            <div className="text-xs text-gray-500">
              {student.enrollment_number
                ? `ID: ${student.enrollment_number}`
                : student.counseling_round ?? "—"}
            </div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-col gap-1">
          {student.neet_roll_number && (
            <div className="text-xs text-gray-500">
              Roll:{" "}
              <span className="font-mono text-gray-300">
                {student.neet_roll_number}
              </span>
            </div>
          )}
          <div className="flex gap-3">
            {student.neet_score != null && (
              <span className="rounded bg-emerald-500/10 px-1.5 text-xs font-medium text-emerald-500">
                Score: {student.neet_score}
              </span>
            )}
            {student.neet_rank != null && (
              <span className="rounded bg-gray-800 px-1.5 text-xs font-medium text-gray-400">
                Rank: {student.neet_rank.toLocaleString("en-IN")}
              </span>
            )}
          </div>
          {!student.neet_score && !student.neet_rank && (
            <span className="text-xs text-gray-600">No NEET data</span>
          )}
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-col items-start gap-1.5">
          {student.category && (
            <span
              className={cn(
                "inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium",
                CATEGORY_STYLES[student.category] ??
                  "border-gray-700 bg-gray-800 text-gray-400",
              )}
            >
              {student.category}
            </span>
          )}
          {student.admission_quota && (
            <span
              className={cn(
                "inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium",
                QUOTA_STYLES[student.admission_quota] ??
                  "border-gray-700 bg-gray-800 text-gray-400",
              )}
            >
              {QUOTA_LABELS[student.admission_quota] ??
                `${student.admission_quota} Quota`}
            </span>
          )}
          {!student.category && !student.admission_quota && (
            <span className="text-xs text-gray-600">—</span>
          )}
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
          aria-label={`View ${student.name}`}
          onClick={onView}
        >
          <Eye className="h-4 w-4" />
        </button>
        <button
          className="ml-2 p-1 text-gray-400 transition-colors hover:text-emerald-500"
          aria-label={`More actions for ${student.name}`}
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
      <DialogContent className="max-w-2xl border-dark-border bg-dark-surface text-white">
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
                      : "bg-dark-elevated text-gray-500",
                )}
              >
                {i + 1}
              </div>
              {i < FORM_STEPS.length - 1 && (
                <div
                  className={cn(
                    "mx-1 h-0.5 flex-1",
                    i < currentStepIdx ? "bg-emerald-500" : "bg-gray-700",
                  )}
                />
              )}
            </div>
          ))}
        </div>
        <p className="mb-4 text-sm text-gray-400">
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
        <div className="mt-4 flex justify-between border-t border-dark-border pt-4">
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
      <label className="mb-1 block text-xs font-medium text-gray-400">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-dark-border bg-dark-elevated px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500";
const selectCls =
  "w-full rounded-lg border border-dark-border bg-dark-elevated px-3 py-2 text-sm text-gray-300 outline-none focus:border-emerald-500";

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
            <option value="M">Male</option>
            <option value="F">Female</option>
            <option value="Other">Other</option>
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
            <option value="OBC-NCL">OBC-NCL</option>
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
            placeholder="e.g., 23059124"
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
        {
          label: "Quota",
          value: QUOTA_LABELS[form.admission_quota] || form.admission_quota,
        },
        { label: "Round", value: form.counseling_round },
        { label: "Date", value: form.admission_date },
        { label: "Year", value: form.admission_year },
        { label: "Allotment #", value: form.allotment_order_number },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        Review the details below before submitting. The student will be created
        with <strong className="text-yellow-400">Applied</strong> status.
      </p>
      {sections.map((section) => (
        <div key={section.title}>
          <h4 className="mb-2 text-xs font-semibold uppercase text-gray-500">
            {section.title}
          </h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {section.items
              .filter((i) => i.value)
              .map((item) => (
                <div key={item.label} className="flex justify-between text-sm">
                  <span className="text-gray-500">{item.label}:</span>
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
    <tr className="animate-pulse">
      <td className="px-6 py-4">
        <div className="h-4 w-6 rounded bg-gray-800" />
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gray-800" />
          <div className="space-y-1">
            <div className="h-4 w-28 rounded bg-gray-800" />
            <div className="h-3 w-20 rounded bg-gray-800" />
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="space-y-1">
          <div className="h-3 w-24 rounded bg-gray-800" />
          <div className="h-3 w-32 rounded bg-gray-800" />
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="space-y-1">
          <div className="h-5 w-16 rounded bg-gray-800" />
          <div className="h-5 w-20 rounded bg-gray-800" />
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="w-full max-w-[140px] space-y-1">
          <div className="h-3 w-full rounded bg-gray-800" />
          <div className="h-1.5 w-full rounded bg-gray-800" />
        </div>
      </td>
      <td className="px-6 py-4 text-right">
        <div className="inline-block h-5 w-10 rounded bg-gray-800" />
      </td>
    </tr>
  );
}

function SeatMatrixSkeleton() {
  return (
    <Card className="animate-pulse">
      <div className="border-b border-dark-border px-5 py-4">
        <div className="h-5 w-28 rounded bg-gray-800" />
      </div>
      <div className="space-y-3 p-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="h-4 w-24 rounded bg-gray-800" />
            <div className="h-1.5 flex-1 rounded bg-gray-800" />
          </div>
        ))}
      </div>
    </Card>
  );
}

function CounselingRoundsSkeleton() {
  return (
    <Card className="animate-pulse p-6">
      <div className="mb-8 h-5 w-40 rounded bg-gray-800" />
      <div className="flex justify-between">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-gray-800" />
            <div className="h-3 w-16 rounded bg-gray-800" />
          </div>
        ))}
      </div>
    </Card>
  );
}
