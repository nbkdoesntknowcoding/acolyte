"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  ChevronDown,
  AlertTriangle,
  Loader2,
  MoreHorizontal,
  Check,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  useSeatMatrix,
  useStudents,
  useCreateStudent,
  usePipelineSummary,
} from "@/lib/hooks/admin/use-students";
import { useCounselingRounds } from "@/lib/hooks/admin/use-admissions";
import type { StudentResponse, StudentCreate } from "@/types/admin-api";

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { color: string; bgColor: string; label: string }> = {
  applied:             { color: "text-zinc-300",    bgColor: "bg-zinc-500/10",    label: "Applied" },
  documents_submitted: { color: "text-blue-400",    bgColor: "bg-blue-500/10",    label: "Docs Submitted" },
  under_verification:  { color: "text-amber-400",   bgColor: "bg-amber-500/10",   label: "Verifying" },
  fee_pending:         { color: "text-orange-400",   bgColor: "bg-orange-500/10",  label: "Fee Due" },
  enrolled:            { color: "text-emerald-400",  bgColor: "bg-emerald-500/10", label: "Enrolled" },
  active:              { color: "text-emerald-400",  bgColor: "bg-emerald-500/10", label: "Active" },
};

function getQuotaStyle(quota: string): string {
  const map: Record<string, string> = {
    AIQ: "bg-blue-500/15 text-blue-400",
    State: "bg-emerald-500/15 text-emerald-400",
    Management: "bg-violet-500/15 text-violet-400",
    NRI: "bg-amber-500/15 text-amber-400",
    Institutional: "bg-zinc-500/15 text-zinc-400",
  };
  return map[quota] || "bg-zinc-500/10 text-zinc-400";
}

function formatPhone(phone: string | null): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return phone;
}

const PIPELINE_TABS = [
  { id: "pipeline", label: "In Pipeline", filter: "applied,documents_submitted,under_verification,fee_pending" },
  { id: "enrolled", label: "Enrolled", filter: "enrolled" },
  { id: "all", label: "All", filter: "" },
];

const YEAR_OPTIONS = ["2025-26", "2024-25", "2023-24", "2022-23"];

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function AdmissionsPage() {
  const router = useRouter();

  // Academic year
  const [selectedYear, setSelectedYear] = useState("2025-26");
  const [showYearPicker, setShowYearPicker] = useState(false);
  const admissionYear = parseInt(selectedYear.split("-")[0]);

  // Tabs + sub-filter
  const [activeTab, setActiveTab] = useState("pipeline");
  const [subFilter, setSubFilter] = useState<string | null>(null);

  // Search + filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [quotaFilter, setQuotaFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Action menu
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

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

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [activeTab, subFilter, quotaFilter, categoryFilter, selectedYear]);

  // --- Data hooks ---
  const seatMatrix = useSeatMatrix(selectedYear);
  const counselingRounds = useCounselingRounds(admissionYear);
  const pipelineSummary = usePipelineSummary(selectedYear);
  const ps = pipelineSummary.data;
  const sm = seatMatrix.data;

  // Pipeline count
  const pipelineCount = ps
    ? ps.applied + ps.documents_submitted + ps.under_verification + ps.fee_pending
    : 0;

  // NMC pending count from pipeline summary — enrolled students not yet uploaded
  // We need a separate query for this. For now, approximate from pipeline summary.
  // enrolled students with nmc_uploaded=false needs a dedicated endpoint or param.
  // We'll use a separate query to count nmc_pending.
  const nmcPendingQuery = useStudents({
    page: 1,
    page_size: 1,
    status: "enrolled",
    admission_year: admissionYear,
  });
  // Rough: count enrolled students from page total, minus those with nmc_uploaded
  // Better approach: just show the enrolled count minus nmc_uploaded from the filtered list
  // For a proper count we'd need a backend endpoint. For now we rely on pipelineSummary.

  // Default to pipeline tab if there are pipeline students
  useEffect(() => {
    if (ps && pipelineCount === 0) {
      setActiveTab("all");
    }
  }, [ps, pipelineCount]);

  // Build status filter from tab + sub-filter
  const currentTab = PIPELINE_TABS.find(t => t.id === activeTab) || PIPELINE_TABS[0];
  const statusParam = subFilter || currentTab.filter || undefined;

  const students = useStudents({
    page,
    page_size: pageSize,
    search: debouncedSearch || undefined,
    status: statusParam,
    admission_quota: quotaFilter || undefined,
    admission_year: admissionYear,
    sort_by: activeTab === "pipeline" ? "pipeline_priority" : "neet_score",
    sort_order: activeTab === "pipeline" ? "asc" : "desc",
  });

  const totalResults = students.data?.total ?? 0;
  const totalPages = students.data?.total_pages ?? 1;
  const offset = (page - 1) * pageSize;
  const hasMore = page < totalPages;

  // Close menu on outside click
  useEffect(() => {
    if (!openMenuId) return;
    const handler = () => setOpenMenuId(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [openMenuId]);

  return (
    <div className="space-y-5">
      {/* ========== HEADER LINE ========== */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Admissions</h1>
          <p className="text-sm text-zinc-500">
            AY {selectedYear}
            {sm && (
              <>
                {" · "}{sm.total_filled}/{sm.annual_intake} seats filled
                {sm.total_vacant > 0 && (
                  <span className="text-amber-400 ml-2">· {sm.total_vacant} vacant</span>
                )}
              </>
            )}
            {pipelineCount > 0 && (
              <span className="text-blue-400 ml-2">· {pipelineCount} in pipeline</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Year picker */}
          <div className="relative">
            <button
              className="flex items-center gap-2 rounded-md border border-[#1E1E1E] bg-[#141414] px-3 py-1.5 text-sm transition-colors hover:border-zinc-600"
              onClick={() => setShowYearPicker(!showYearPicker)}
            >
              <span className="text-zinc-400">AY</span>
              <span className="font-medium text-white">{selectedYear}</span>
              <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
            </button>
            {showYearPicker && (
              <div className="absolute right-0 top-full z-20 mt-1 rounded-md border border-[#1E1E1E] bg-[#141414] py-1 shadow-xl">
                {YEAR_OPTIONS.map((yr) => (
                  <button
                    key={yr}
                    className={cn(
                      "block w-full px-4 py-1.5 text-left text-sm transition-colors hover:bg-[#1E1E1E]",
                      yr === selectedYear ? "text-emerald-400" : "text-zinc-300"
                    )}
                    onClick={() => { setSelectedYear(yr); setShowYearPicker(false); }}
                  >
                    {yr}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========== SEAT MATRIX + COUNSELING (single card) ========== */}
      <div className="bg-[#141414] border border-[#1E1E1E] rounded-lg overflow-hidden">
        <div className="grid grid-cols-12">
          {/* LEFT: Seat Matrix — 8 cols */}
          <div className="col-span-8 p-5">
            <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-4">Seat Matrix</h2>
            {seatMatrix.isLoading ? (
              <SeatMatrixSkeleton />
            ) : sm?.quotas ? (
              <>
                <div className="space-y-2.5">
                  {sm.quotas.map((q) => {
                    const pct = q.total_seats > 0 ? Math.min((q.filled_seats / q.total_seats) * 100, 100) : 0;
                    const overflowed = q.filled_seats > q.total_seats;
                    return (
                      <div key={q.quota} className="flex items-center gap-3">
                        <span className="w-24 text-[13px] text-zinc-400 shrink-0">{q.quota}</span>
                        <div className="flex-1 h-1.5 bg-[#1E1E1E] rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              overflowed ? "bg-red-500" :
                              pct >= 100 ? "bg-emerald-500" :
                              pct >= 80 ? "bg-emerald-500/80" :
                              pct >= 50 ? "bg-amber-500" :
                              "bg-red-400"
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="w-16 text-right shrink-0">
                          <span className={cn("text-[13px] font-medium tabular-nums", overflowed ? "text-red-400" : "text-zinc-300")}>
                            {q.filled_seats}
                          </span>
                          <span className="text-[13px] text-zinc-600">/{q.total_seats}</span>
                        </div>
                        <div className="w-14 shrink-0 text-right">
                          {overflowed ? (
                            <span className="text-[11px] text-red-400">Over</span>
                          ) : q.vacant_seats === 0 ? (
                            <span className="text-[11px] text-emerald-500">Full</span>
                          ) : (
                            <span className="text-[11px] text-amber-400">{q.vacant_seats} left</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Total row */}
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#1E1E1E]">
                  <span className="w-24 text-[13px] font-medium text-zinc-300 shrink-0">Total</span>
                  <div className="flex-1" />
                  <div className="w-16 text-right shrink-0">
                    <span className="text-[13px] font-semibold text-white tabular-nums">{sm.total_filled}</span>
                    <span className="text-[13px] text-zinc-600">/{sm.annual_intake}</span>
                  </div>
                  <div className="w-14 shrink-0 text-right">
                    {sm.total_vacant > 0 ? (
                      <span className="text-[11px] text-amber-400">{sm.total_vacant} left</span>
                    ) : (
                      <span className="text-[11px] text-emerald-500">Full</span>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <p className="py-6 text-center text-sm text-zinc-600">No seat matrix data.</p>
            )}
          </div>

          {/* RIGHT: Counseling Rounds — 4 cols */}
          <div className="col-span-4 p-5 border-l border-[#1E1E1E]">
            <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-4">Counseling Rounds</h2>
            {counselingRounds.isLoading ? (
              <div className="space-y-3 animate-pulse">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-zinc-800" />
                    <div className="flex-1 h-3 rounded bg-zinc-800" />
                    <div className="w-8 h-3 rounded bg-zinc-800" />
                  </div>
                ))}
              </div>
            ) : counselingRounds.data?.rounds ? (
              <>
                <div className="space-y-2">
                  {counselingRounds.data.rounds.map((r) => (
                    <div key={r.counseling_round} className="flex items-center gap-3">
                      <div className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        r.count > 0 ? "bg-emerald-500" : "bg-zinc-700"
                      )} />
                      <span className={cn(
                        "text-[13px] flex-1",
                        r.count > 0 ? "text-zinc-300" : "text-zinc-600"
                      )}>
                        {r.counseling_round}
                      </span>
                      <span className={cn(
                        "text-[13px] tabular-nums font-medium",
                        r.count > 0 ? "text-white" : "text-zinc-700"
                      )}>
                        {r.count > 0 ? r.count : "—"}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-[#1E1E1E]">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-zinc-400">Total admitted</span>
                    <span className="text-[13px] font-semibold text-white tabular-nums">
                      {sm?.total_filled ?? counselingRounds.data.total}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <p className="py-6 text-center text-sm text-zinc-600">No counseling data.</p>
            )}
          </div>
        </div>
      </div>

      {/* ========== PIPELINE SECTION ========== */}
      <div>
        {/* Tab bar */}
        <div className="flex items-center gap-1 mb-1">
          {PIPELINE_TABS.map((t) => {
            const count = t.id === "pipeline" ? pipelineCount
              : t.id === "enrolled" ? (ps?.enrolled ?? 0)
              : (ps?.total ?? 0);
            return (
              <button
                key={t.id}
                onClick={() => { setActiveTab(t.id); setSubFilter(null); }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors",
                  activeTab === t.id ? "bg-[#1E1E1E] text-white" : "text-zinc-500 hover:text-zinc-400"
                )}
              >
                {t.label}
                {count > 0 && (
                  <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded-full",
                    activeTab === t.id ? "bg-emerald-500/20 text-emerald-400" : "bg-[#1E1E1E] text-zinc-600"
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Sub-filters for pipeline tab */}
        {activeTab === "pipeline" && (
          <div className="flex gap-1.5 mb-3">
            {[
              { status: "applied", label: "Applied", count: ps?.applied ?? 0 },
              { status: "documents_submitted", label: "Docs", count: ps?.documents_submitted ?? 0 },
              { status: "under_verification", label: "Verifying", count: ps?.under_verification ?? 0 },
              { status: "fee_pending", label: "Fee Due", count: ps?.fee_pending ?? 0 },
            ].filter(s => s.count > 0).map(s => (
              <button
                key={s.status}
                onClick={() => setSubFilter(subFilter === s.status ? null : s.status)}
                className={cn(
                  "text-xs px-2 py-1 rounded-md transition-colors",
                  subFilter === s.status
                    ? "bg-[#1E1E1E] text-white"
                    : "text-zinc-500 hover:text-zinc-400"
                )}
              >
                {s.label} <span className="text-zinc-600 ml-0.5">{s.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Filter row */}
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search name, NEET roll, enrollment..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full h-8 pl-8 pr-3 bg-[#0A0A0A] border border-[#1E1E1E] rounded-md text-[13px] text-white placeholder-zinc-600 focus:border-zinc-600 focus:outline-none transition-colors"
            />
          </div>
          <select
            value={quotaFilter}
            onChange={(e) => { setQuotaFilter(e.target.value); setPage(1); }}
            className="h-8 px-2 bg-[#0A0A0A] border border-[#1E1E1E] rounded-md text-[13px] text-zinc-400 focus:outline-none"
          >
            <option value="">All Quotas</option>
            <option value="AIQ">AIQ</option>
            <option value="State">State</option>
            <option value="Management">Management</option>
            <option value="NRI">NRI</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="h-8 px-2 bg-[#0A0A0A] border border-[#1E1E1E] rounded-md text-[13px] text-zinc-400 focus:outline-none"
          >
            <option value="">All Categories</option>
            <option value="General">General</option>
            <option value="OBC">OBC</option>
            <option value="SC">SC</option>
            <option value="ST">ST</option>
            <option value="EWS">EWS</option>
          </select>
          <div className="flex-1" />
          <button
            onClick={() => setShowNewAdmission(true)}
            className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-medium rounded-md flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Admission
          </button>
        </div>

        {/* Table */}
        <div className="bg-[#141414] border border-[#1E1E1E] rounded-lg overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#1E1E1E]">
                <th className="text-[11px] uppercase tracking-wider font-medium text-zinc-600 px-4 py-2.5 w-10">#</th>
                <th className="text-[11px] uppercase tracking-wider font-medium text-zinc-600 px-4 py-2.5">Candidate</th>
                <th className="text-[11px] uppercase tracking-wider font-medium text-zinc-600 px-4 py-2.5 w-28">NEET</th>
                <th className="text-[11px] uppercase tracking-wider font-medium text-zinc-600 px-4 py-2.5 w-32">Category</th>
                <th className="text-[11px] uppercase tracking-wider font-medium text-zinc-600 px-4 py-2.5 w-28">Status</th>
                <th className="text-[11px] uppercase tracking-wider font-medium text-zinc-600 px-4 py-2.5 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {students.isLoading ? (
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              ) : students.data && students.data.data.length > 0 ? (
                students.data.data.map((s, i) => {
                  const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.applied;
                  return (
                    <tr
                      key={s.id}
                      className="border-b border-[#1E1E1E]/50 last:border-0 cursor-pointer hover:bg-[#161616] transition-colors"
                      onClick={() => router.push(`/dashboard/admin/students/records/${s.id}`)}
                    >
                      {/* # */}
                      <td className="px-4 py-2.5 text-[13px] text-zinc-600 tabular-nums">
                        {offset + i + 1}
                      </td>

                      {/* Candidate */}
                      <td className="px-4 py-2.5">
                        <div className="text-[13px] font-medium text-zinc-200">{s.name}</div>
                        <div className="text-xs text-zinc-600 mt-0.5">
                          {s.status === "enrolled" || s.status === "active"
                            ? (s.enrollment_number || formatPhone(s.phone))
                            : formatPhone(s.phone)
                          }
                        </div>
                      </td>

                      {/* NEET */}
                      <td className="px-4 py-2.5">
                        <div className="text-[13px] text-zinc-200 tabular-nums">{s.neet_score ?? "—"}</div>
                        <div className="text-xs text-zinc-600 mt-0.5">
                          {s.neet_rank != null ? `#${s.neet_rank.toLocaleString("en-IN")}` : "—"}
                        </div>
                      </td>

                      {/* Category + Quota */}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] text-zinc-400">{s.category || "—"}</span>
                          {s.admission_quota && (
                            <span className={cn("text-[11px] px-1.5 py-0.5 rounded font-medium", getQuotaStyle(s.admission_quota))}>
                              {s.admission_quota}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-2.5">
                        <span className={cn("text-[11px] px-2 py-0.5 rounded-full font-medium", cfg.bgColor, cfg.color)}>
                          {cfg.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="relative">
                          <button
                            className="p-1 rounded hover:bg-[#1E1E1E] text-zinc-600 hover:text-zinc-400 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(openMenuId === s.id ? null : s.id);
                            }}
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                          {openMenuId === s.id && (
                            <div
                              className="absolute right-0 top-full z-30 mt-1 w-44 rounded-md border border-[#1E1E1E] bg-[#141414] py-1 shadow-xl"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                className="w-full text-left px-3 py-1.5 text-[13px] text-zinc-300 hover:bg-[#1E1E1E] transition-colors"
                                onClick={() => { router.push(`/dashboard/admin/students/records/${s.id}`); setOpenMenuId(null); }}
                              >
                                View Profile
                              </button>
                              {s.status === "applied" && (
                                <button className="w-full text-left px-3 py-1.5 text-[13px] text-zinc-300 hover:bg-[#1E1E1E] transition-colors">
                                  Request Documents
                                </button>
                              )}
                              {s.status === "documents_submitted" && (
                                <button className="w-full text-left px-3 py-1.5 text-[13px] text-zinc-300 hover:bg-[#1E1E1E] transition-colors">
                                  Start Verification
                                </button>
                              )}
                              {s.status === "under_verification" && (
                                <button className="w-full text-left px-3 py-1.5 text-[13px] text-zinc-300 hover:bg-[#1E1E1E] transition-colors">
                                  Approve Documents
                                </button>
                              )}
                              {s.status === "fee_pending" && (
                                <button className="w-full text-left px-3 py-1.5 text-[13px] text-zinc-300 hover:bg-[#1E1E1E] transition-colors">
                                  Record Payment
                                </button>
                              )}
                              {!["enrolled", "active"].includes(s.status) && (
                                <>
                                  <div className="my-1 border-t border-[#1E1E1E]" />
                                  <button className="w-full text-left px-3 py-1.5 text-[13px] text-emerald-400 hover:bg-[#1E1E1E] transition-colors">
                                    Enroll Student
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <p className="text-sm text-zinc-500">
                      {students.isError ? "Failed to load data." : "No candidates match these filters"}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {totalResults > pageSize && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#1E1E1E]">
              <span className="text-xs text-zinc-600">
                {offset + 1}–{Math.min(offset + pageSize, totalResults)} of {totalResults}
              </span>
              <div className="flex gap-1">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="px-2.5 py-1 text-xs text-zinc-400 border border-[#1E1E1E] rounded hover:bg-[#1E1E1E] disabled:opacity-30 disabled:cursor-default transition-colors"
                >
                  Prev
                </button>
                <button
                  disabled={!hasMore}
                  onClick={() => setPage(p => p + 1)}
                  className="px-2.5 py-1 text-xs text-zinc-400 border border-[#1E1E1E] rounded hover:bg-[#1E1E1E] disabled:opacity-30 disabled:cursor-default transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========== NMC BANNER ========== */}
      {ps && ps.enrolled > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-400" />
            <div>
              <p className="text-sm text-amber-200">
                NMC portal upload required for enrolled students
              </p>
              <p className="text-xs text-amber-400/60">
                All admissions must be uploaded within 15 days of reporting
              </p>
            </div>
          </div>
          <button className="text-xs border border-amber-500/30 text-amber-400 px-3 py-1.5 rounded-md hover:bg-amber-500/10 transition-colors">
            Upload Now
          </button>
        </div>
      )}

      {/* ========== NEW ADMISSION DIALOG ========== */}
      <NewAdmissionDialog open={showNewAdmission} onOpenChange={setShowNewAdmission} />
    </div>
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
  name: "", email: "", phone: "", date_of_birth: "", gender: "", category: "",
  father_name: "", mother_name: "", neet_roll_number: "", neet_score: "",
  neet_rank: "", neet_percentile: "", neet_year: "", admission_quota: "",
  counseling_round: "", allotment_order_number: "", admission_date: "", admission_year: "",
};

function NewAdmissionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [step, setStep] = useState<AdmissionFormStep>("personal");
  const [form, setForm] = useState<AdmissionFormData>(INITIAL_FORM);
  const createStudent = useCreateStudent();
  const currentStepIdx = FORM_STEPS.findIndex((s) => s.key === step);

  function update(field: keyof AdmissionFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleNext() {
    const nextIdx = currentStepIdx + 1;
    if (nextIdx < FORM_STEPS.length) setStep(FORM_STEPS[nextIdx].key);
  }

  function handleBack() {
    const prevIdx = currentStepIdx - 1;
    if (prevIdx >= 0) setStep(FORM_STEPS[prevIdx].key);
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
      neet_percentile: form.neet_percentile ? Number(form.neet_percentile) : undefined,
      neet_year: form.neet_year ? Number(form.neet_year) : undefined,
      admission_quota: form.admission_quota || undefined,
      counseling_round: form.counseling_round || undefined,
      allotment_order_number: form.allotment_order_number || undefined,
      admission_date: form.admission_date || undefined,
      admission_year: form.admission_year ? Number(form.admission_year) : undefined,
      status: "applied",
    };
    createStudent.mutate(payload, {
      onSuccess: () => { setForm(INITIAL_FORM); setStep("personal"); onOpenChange(false); },
    });
  }

  function handleOpenChange(val: boolean) {
    if (!val) { setForm(INITIAL_FORM); setStep("personal"); createStudent.reset(); }
    onOpenChange(val);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl border-[#1E1E1E] bg-[#0A0A0A] text-white">
        <DialogHeader><DialogTitle>New Admission</DialogTitle></DialogHeader>

        {/* Step indicator */}
        <div className="mb-4 flex items-center gap-1">
          {FORM_STEPS.map((s, i) => (
            <div key={s.key} className="flex flex-1 items-center">
              <div className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                i < currentStepIdx ? "bg-emerald-500 text-white"
                  : i === currentStepIdx ? "bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500"
                  : "bg-[#1E1E1E] text-zinc-500"
              )}>
                {i < currentStepIdx ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              {i < FORM_STEPS.length - 1 && (
                <div className={cn("mx-1 h-0.5 flex-1", i < currentStepIdx ? "bg-emerald-500" : "bg-zinc-700")} />
              )}
            </div>
          ))}
        </div>
        <p className="mb-4 text-sm text-zinc-400">
          Step {currentStepIdx + 1} of {FORM_STEPS.length} — {FORM_STEPS[currentStepIdx].label}
        </p>

        {createStudent.isError && (
          <div className="mb-4 rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-300">
            <AlertTriangle className="mr-1 inline h-4 w-4" />
            {createStudent.error?.message ?? "Failed to create admission."}
          </div>
        )}

        <div className="min-h-[280px] space-y-4">
          {step === "personal" && <PersonalStep form={form} update={update} />}
          {step === "neet" && <NeetStep form={form} update={update} />}
          {step === "admission" && <AdmissionInfoStep form={form} update={update} />}
          {step === "review" && <ReviewStep form={form} />}
        </div>

        <div className="mt-4 flex justify-between border-t border-[#1E1E1E] pt-4">
          <Button variant="outline" size="sm" onClick={handleBack} disabled={currentStepIdx === 0}>Back</Button>
          {step === "review" ? (
            <Button size="sm" onClick={handleSubmit} disabled={!form.name || createStudent.isPending} className="shadow-lg shadow-emerald-500/20">
              {createStudent.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Submit Application
            </Button>
          ) : (
            <Button size="sm" onClick={handleNext} disabled={step === "personal" && !form.name}>Next</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Form Steps
// ---------------------------------------------------------------------------

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-zinc-400">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-[#1E1E1E] bg-[#141414] px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500";
const selectCls = "w-full rounded-lg border border-[#1E1E1E] bg-[#141414] px-3 py-2 text-sm text-zinc-300 outline-none focus:border-emerald-500";

function PersonalStep({ form, update }: { form: AdmissionFormData; update: (k: keyof AdmissionFormData, v: string) => void }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Full Name *">
          <input className={inputCls} placeholder="Enter full name" value={form.name} onChange={(e) => update("name", e.target.value)} />
        </FormField>
        <FormField label="Email">
          <input className={inputCls} type="email" placeholder="email@example.com" value={form.email} onChange={(e) => update("email", e.target.value)} />
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Phone">
          <input className={inputCls} placeholder="9876543210" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
        </FormField>
        <FormField label="Date of Birth">
          <input className={inputCls} type="date" value={form.date_of_birth} onChange={(e) => update("date_of_birth", e.target.value)} />
        </FormField>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <FormField label="Gender">
          <select className={selectCls} value={form.gender} onChange={(e) => update("gender", e.target.value)}>
            <option value="">Select</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </FormField>
        <FormField label="Category">
          <select className={selectCls} value={form.category} onChange={(e) => update("category", e.target.value)}>
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
          <input className={inputCls} placeholder="Father's name" value={form.father_name} onChange={(e) => update("father_name", e.target.value)} />
        </FormField>
      </div>
    </>
  );
}

function NeetStep({ form, update }: { form: AdmissionFormData; update: (k: keyof AdmissionFormData, v: string) => void }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="NEET Roll Number">
          <input className={inputCls} placeholder="e.g., 2025-KA-123456" value={form.neet_roll_number} onChange={(e) => update("neet_roll_number", e.target.value)} />
        </FormField>
        <FormField label="NEET Year">
          <input className={inputCls} type="number" placeholder="2025" value={form.neet_year} onChange={(e) => update("neet_year", e.target.value)} />
        </FormField>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <FormField label="NEET Score (0-720)">
          <input className={inputCls} type="number" placeholder="685" min={0} max={720} value={form.neet_score} onChange={(e) => update("neet_score", e.target.value)} />
        </FormField>
        <FormField label="NEET Rank">
          <input className={inputCls} type="number" placeholder="1042" min={1} value={form.neet_rank} onChange={(e) => update("neet_rank", e.target.value)} />
        </FormField>
        <FormField label="NEET Percentile">
          <input className={inputCls} type="number" step="0.01" placeholder="99.5" value={form.neet_percentile} onChange={(e) => update("neet_percentile", e.target.value)} />
        </FormField>
      </div>
    </>
  );
}

function AdmissionInfoStep({ form, update }: { form: AdmissionFormData; update: (k: keyof AdmissionFormData, v: string) => void }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Admission Quota">
          <select className={selectCls} value={form.admission_quota} onChange={(e) => update("admission_quota", e.target.value)}>
            <option value="">Select Quota</option>
            <option value="AIQ">AIQ (15%)</option>
            <option value="State">State Quota</option>
            <option value="Management">Management</option>
            <option value="NRI">NRI</option>
            <option value="Institutional">Institutional</option>
          </select>
        </FormField>
        <FormField label="Counseling Round">
          <select className={selectCls} value={form.counseling_round} onChange={(e) => update("counseling_round", e.target.value)}>
            <option value="">Select Round</option>
            <option value="Round 1">Round 1</option>
            <option value="Round 2">Round 2</option>
            <option value="Mop-Up">Mop-Up</option>
            <option value="Stray Vacancy">Stray Vacancy</option>
          </select>
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Admission Date">
          <input className={inputCls} type="date" value={form.admission_date} onChange={(e) => update("admission_date", e.target.value)} />
        </FormField>
        <FormField label="Admission Year">
          <input className={inputCls} type="number" placeholder="2025" value={form.admission_year} onChange={(e) => update("admission_year", e.target.value)} />
        </FormField>
      </div>
      <FormField label="Allotment Order Number">
        <input className={inputCls} placeholder="Allotment order #" value={form.allotment_order_number} onChange={(e) => update("allotment_order_number", e.target.value)} />
      </FormField>
    </>
  );
}

function ReviewStep({ form }: { form: AdmissionFormData }) {
  const sections = [
    { title: "Personal Info", items: [
      { label: "Name", value: form.name }, { label: "Email", value: form.email },
      { label: "Phone", value: form.phone }, { label: "DOB", value: form.date_of_birth },
      { label: "Gender", value: form.gender }, { label: "Category", value: form.category },
      { label: "Father", value: form.father_name },
    ]},
    { title: "NEET Details", items: [
      { label: "Roll No", value: form.neet_roll_number }, { label: "Score", value: form.neet_score },
      { label: "Rank", value: form.neet_rank }, { label: "Percentile", value: form.neet_percentile },
      { label: "Year", value: form.neet_year },
    ]},
    { title: "Admission Info", items: [
      { label: "Quota", value: form.admission_quota }, { label: "Round", value: form.counseling_round },
      { label: "Date", value: form.admission_date }, { label: "Year", value: form.admission_year },
      { label: "Allotment #", value: form.allotment_order_number },
    ]},
  ];
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-400">
        Review the details below before submitting. The student will be created with <strong className="text-yellow-400">Applied</strong> status.
      </p>
      {sections.map((section) => (
        <div key={section.title}>
          <h4 className="mb-2 text-xs font-semibold uppercase text-zinc-500">{section.title}</h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {section.items.filter((i) => i.value).map((item) => (
              <div key={item.label} className="flex justify-between text-sm">
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
      <td className="px-4 py-2.5"><div className="h-3 w-6 rounded bg-zinc-800" /></td>
      <td className="px-4 py-2.5">
        <div className="space-y-1">
          <div className="h-3.5 w-28 rounded bg-zinc-800" />
          <div className="h-3 w-20 rounded bg-zinc-800" />
        </div>
      </td>
      <td className="px-4 py-2.5">
        <div className="space-y-1">
          <div className="h-3 w-12 rounded bg-zinc-800" />
          <div className="h-3 w-16 rounded bg-zinc-800" />
        </div>
      </td>
      <td className="px-4 py-2.5">
        <div className="flex gap-1.5">
          <div className="h-4 w-10 rounded bg-zinc-800" />
          <div className="h-4 w-10 rounded-full bg-zinc-800" />
        </div>
      </td>
      <td className="px-4 py-2.5"><div className="h-5 w-16 rounded-full bg-zinc-800" /></td>
      <td className="px-3 py-2.5"><div className="h-4 w-4 rounded bg-zinc-800" /></td>
    </tr>
  );
}

function SeatMatrixSkeleton() {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-3">
          <div className="h-3 w-24 rounded bg-zinc-800" />
          <div className="h-1.5 flex-1 rounded-full bg-zinc-800" />
          <div className="h-3 w-16 rounded bg-zinc-800" />
          <div className="h-3 w-10 rounded bg-zinc-800" />
        </div>
      ))}
    </div>
  );
}
