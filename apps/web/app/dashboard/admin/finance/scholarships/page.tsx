"use client";

import { useState, useMemo } from "react";
import {
  Megaphone,
  ShieldCheck,
  Wallet,
  Clock,
  Upload,
  Sparkles,
  ListChecks,
  IndianRupee,
  RefreshCw,
  Network,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatINRCompact, formatINRCurrency } from "@/lib/format";
import {
  useScholarshipSchemes,
  useStudentScholarships,
  useDisbursementSummary,
  useAutoMatch,
} from "@/lib/hooks/admin/use-scholarships";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_BADGE: Record<
  string,
  { label: string; className: string }
> = {
  matched: {
    label: "Matched",
    className: "border-blue-800 bg-blue-900 text-blue-400",
  },
  applied: {
    label: "Applied",
    className: "border-emerald-800 bg-emerald-900 text-emerald-400",
  },
  l1_verified: {
    label: "L1 Verified",
    className: "border-teal-800 bg-teal-900 text-teal-400",
  },
  l2_verified: {
    label: "L2 Verified",
    className: "border-cyan-800 bg-cyan-900 text-cyan-400",
  },
  approved: {
    label: "Approved",
    className: "border-emerald-800 bg-emerald-900 text-emerald-400",
  },
  rejected: {
    label: "Rejected",
    className: "border-red-800 bg-red-900 text-red-400",
  },
  disbursed: {
    label: "Disbursed",
    className: "border-purple-800 bg-purple-900 text-purple-400",
  },
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ScholarshipsPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [appPage, setAppPage] = useState(1);
  const [schemePage, setSchemePage] = useState(1);

  // Data hooks
  const schemes = useScholarshipSchemes({ page: schemePage, page_size: 20 });
  const disbursement = useDisbursementSummary();
  const autoMatch = useAutoMatch();

  const studentScholarships = useStudentScholarships(
    {
      page: appPage,
      page_size: 10,
      application_status: statusFilter !== "all" ? statusFilter : undefined,
    },
  );

  // Build scheme name lookup from loaded schemes
  const schemeLookup = useMemo(() => {
    const map = new Map<string, string>();
    if (schemes.data?.data) {
      for (const s of schemes.data.data) {
        map.set(s.id, s.name);
      }
    }
    return map;
  }, [schemes.data]);

  // Stat card values from disbursement summary
  const totalDisbursed = disbursement.data?.grand_total_disbursed ?? 0;
  const totalPending = disbursement.data?.grand_total_pending ?? 0;
  const totalSchemes = schemes.data?.total ?? 0;
  const totalApplications = useMemo(() => {
    if (!disbursement.data?.schemes) return 0;
    return disbursement.data.schemes.reduce(
      (s, d) => s + d.total_applications,
      0,
    );
  }, [disbursement.data]);

  async function handleAutoMatch() {
    await autoMatch.mutateAsync();
  }

  const isLoading = disbursement.isLoading || schemes.isLoading;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Scholarship Management
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Academic Year 2025-26 &bull; DBT Direct Benefit Transfer Cycle
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* TODO: Import NSP Data */}
          <Button variant="outline" className="gap-2" disabled>
            <Upload className="h-4 w-4" />
            Import NSP Data
          </Button>
          <Button
            className="gap-2 bg-emerald-600 shadow-lg shadow-emerald-500/20 hover:bg-emerald-700"
            onClick={handleAutoMatch}
            disabled={autoMatch.isPending}
          >
            {autoMatch.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Matching...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Run AI Auto-Match
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Auto-Match Result Banner */}
      {autoMatch.isSuccess && autoMatch.data && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          <p className="text-sm text-emerald-300">
            Auto-match complete: processed{" "}
            <span className="font-bold">{autoMatch.data.students_processed}</span>{" "}
            students, found{" "}
            <span className="font-bold">{autoMatch.data.total_matches}</span> new
            matches across{" "}
            <span className="font-bold">
              {autoMatch.data.students_with_matches}
            </span>{" "}
            students.
          </p>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Active Schemes */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-2 flex items-start justify-between">
              <div className="rounded-lg bg-blue-500/10 p-2">
                <Megaphone className="h-5 w-5 text-blue-500" />
              </div>
              <Badge variant="info">Schemes</Badge>
            </div>
            <h3 className="mt-2 text-2xl font-bold text-white">
              {isLoading ? "..." : totalSchemes}
            </h3>
            <p className="mt-1 text-sm text-gray-400">Active Schemes</p>
          </CardContent>
        </Card>

        {/* Total Applications */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-2 flex items-start justify-between">
              <div className="rounded-lg bg-emerald-500/10 p-2">
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
              </div>
              <Badge>Applications</Badge>
            </div>
            <h3 className="mt-2 text-2xl font-bold text-white">
              {isLoading ? "..." : totalApplications}
            </h3>
            <p className="mt-1 text-sm text-gray-400">Total Applications</p>
          </CardContent>
        </Card>

        {/* Total Disbursed */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-2 flex items-start justify-between">
              <div className="rounded-lg bg-purple-500/10 p-2">
                <Wallet className="h-5 w-5 text-purple-500" />
              </div>
              <Badge className="border-purple-500/30 bg-purple-500/10 text-purple-500">
                DBT
              </Badge>
            </div>
            <h3 className="mt-2 text-2xl font-bold text-white">
              {isLoading
                ? "..."
                : formatINRCompact(totalDisbursed / 100)}
            </h3>
            <p className="mt-1 text-sm text-gray-400">Total Disbursed</p>
          </CardContent>
        </Card>

        {/* Pending */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-2 flex items-start justify-between">
              <div className="rounded-lg bg-orange-500/10 p-2">
                <Clock className="h-5 w-5 text-orange-500" />
              </div>
              <Badge variant="warning">Pending</Badge>
            </div>
            <h3 className="mt-2 text-2xl font-bold text-white">
              {isLoading
                ? "..."
                : formatINRCompact(totalPending / 100)}
            </h3>
            <p className="mt-1 text-sm text-gray-400">Pending Disbursement</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content — Schemes + Student Tracker */}
      <div className="grid h-auto grid-cols-1 gap-6 xl:h-[600px] xl:grid-cols-12">
        {/* Active Schemes Panel */}
        <Card className="flex flex-col overflow-hidden xl:col-span-4">
          <div className="flex shrink-0 items-center justify-between border-b border-dark-border p-4">
            <h2 className="text-base font-semibold text-white">
              Scholarship Schemes
            </h2>
            <span className="text-xs text-gray-500">
              {schemes.data?.total ?? 0} total
            </span>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {schemes.isLoading ? (
              <div className="flex items-center justify-center py-12 text-gray-500">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Loading schemes...
              </div>
            ) : !schemes.data?.data?.length ? (
              <div className="text-center py-12 text-gray-500 text-sm">
                No scholarship schemes found.
              </div>
            ) : (
              schemes.data.data.map((scheme) => {
                const categories = Array.isArray(scheme.eligible_categories)
                  ? (scheme.eligible_categories as string[]).join(", ")
                  : null;

                return (
                  <div
                    key={scheme.id}
                    className="group relative cursor-pointer overflow-hidden rounded-lg border border-dark-border bg-[#262626]/40 p-4 transition-colors hover:border-emerald-500/50"
                  >
                    {scheme.is_active && (
                      <div className="absolute right-0 top-0 h-full w-2 bg-emerald-500/20" />
                    )}
                    <div className="mb-2 flex items-start justify-between">
                      <Badge
                        variant="outline"
                        className="text-[10px]"
                      >
                        {scheme.application_portal ?? "General"}
                      </Badge>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          scheme.is_active
                            ? "border-emerald-800 bg-emerald-900 text-emerald-400"
                            : "border-gray-700 bg-gray-800 text-gray-400"
                        }`}
                      >
                        {scheme.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <h3 className="font-bold text-white transition-colors group-hover:text-emerald-500">
                      {scheme.name}
                    </h3>
                    <p className="mb-3 text-xs text-gray-400">
                      {scheme.awarding_body ?? "Unknown provider"}
                    </p>
                    <div className="mb-3 space-y-2">
                      {categories && (
                        <div className="flex items-center gap-2 text-xs text-gray-300">
                          <ListChecks className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                          <span className="truncate">{categories}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-gray-300">
                        <IndianRupee className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                        <span>
                          {scheme.amount_per_year
                            ? formatINRCurrency(scheme.amount_per_year / 100) +
                              " / year"
                            : scheme.amount_description ?? "Amount varies"}
                        </span>
                      </div>
                    </div>
                    {scheme.merit_criteria && (
                      <p className="text-[10px] text-gray-500 truncate">
                        Merit: {scheme.merit_criteria}
                      </p>
                    )}
                  </div>
                );
              })
            )}
            {/* Scheme pagination */}
            {schemes.data && schemes.data.total_pages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  onClick={() => setSchemePage((p) => Math.max(1, p - 1))}
                  disabled={schemePage <= 1}
                  className="p-1 rounded hover:bg-dark-elevated disabled:opacity-50 text-gray-400"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-gray-500">
                  {schemePage} / {schemes.data.total_pages}
                </span>
                <button
                  onClick={() => setSchemePage((p) => p + 1)}
                  disabled={schemePage >= (schemes.data?.total_pages ?? 1)}
                  className="p-1 rounded hover:bg-dark-elevated disabled:opacity-50 text-gray-400"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </Card>

        {/* Student Scholarship Applications */}
        <Card className="flex flex-col overflow-hidden xl:col-span-8">
          <div className="flex shrink-0 flex-col gap-4 border-b border-dark-border p-4 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="shrink-0 text-base font-semibold text-white">
              Scholarship Applications
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v);
                  setAppPage(1);
                }}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="matched">Matched</SelectItem>
                  <SelectItem value="applied">Applied</SelectItem>
                  <SelectItem value="l1_verified">L1 Verified</SelectItem>
                  <SelectItem value="l2_verified">L2 Verified</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="disbursed">Disbursed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-dark-border bg-dark-elevated/50 hover:bg-dark-elevated/50">
                  <TableHead className="px-4 py-3 text-[10px] font-semibold uppercase text-gray-500">
                    Scheme
                  </TableHead>
                  <TableHead className="px-4 py-3 text-[10px] font-semibold uppercase text-gray-500">
                    Student ID
                  </TableHead>
                  <TableHead className="px-4 py-3 text-center text-[10px] font-semibold uppercase text-gray-500">
                    Status
                  </TableHead>
                  <TableHead className="px-4 py-3 text-right text-[10px] font-semibold uppercase text-gray-500">
                    Sanctioned
                  </TableHead>
                  <TableHead className="px-4 py-3 text-right text-[10px] font-semibold uppercase text-gray-500">
                    Disbursed
                  </TableHead>
                  <TableHead className="px-4 py-3 text-[10px] font-semibold uppercase text-gray-500">
                    Date
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studentScholarships.isLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-8 text-gray-500"
                    >
                      <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
                      Loading applications...
                    </TableCell>
                  </TableRow>
                ) : !studentScholarships.data?.data?.length ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-8 text-gray-500"
                    >
                      No scholarship applications found.
                      {statusFilter !== "all" && (
                        <button
                          onClick={() => setStatusFilter("all")}
                          className="ml-2 text-emerald-400 hover:underline"
                        >
                          Clear filter
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  studentScholarships.data.data.map((ss) => {
                    const badge =
                      STATUS_BADGE[ss.application_status] ??
                      STATUS_BADGE.matched;
                    const schemeName =
                      schemeLookup.get(ss.scheme_id) ??
                      ss.scheme_id.slice(0, 8) + "...";
                    return (
                      <TableRow
                        key={ss.id}
                        className="border-dark-border hover:bg-[#262626]/20"
                      >
                        <TableCell className="px-4 py-3">
                          <p className="text-sm font-medium text-white truncate max-w-[200px]">
                            {schemeName}
                          </p>
                          <p className="text-[10px] text-gray-500">
                            {ss.academic_year ?? "-"}
                          </p>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-gray-400 font-mono text-xs">
                          {ss.student_id.slice(0, 8)}...
                        </TableCell>
                        <TableCell className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right text-gray-300">
                          {ss.sanctioned_amount
                            ? formatINRCurrency(ss.sanctioned_amount / 100)
                            : "-"}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right">
                          <span
                            className={
                              ss.disbursed_amount && ss.disbursed_amount > 0
                                ? "text-emerald-400 font-medium"
                                : "text-gray-500"
                            }
                          >
                            {ss.disbursed_amount && ss.disbursed_amount > 0
                              ? formatINRCurrency(ss.disbursed_amount / 100)
                              : "-"}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-gray-500 text-xs">
                          {ss.disbursement_date
                            ? new Date(
                                ss.disbursement_date,
                              ).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : new Date(ss.created_at).toLocaleDateString(
                                "en-IN",
                                {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                },
                              )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {studentScholarships.data &&
            studentScholarships.data.total_pages > 1 && (
              <div className="p-4 border-t border-dark-border flex items-center justify-between text-sm text-gray-400">
                <div>
                  Page {studentScholarships.data.page} of{" "}
                  {studentScholarships.data.total_pages} (
                  {studentScholarships.data.total} records)
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAppPage((p) => Math.max(1, p - 1))}
                    disabled={appPage <= 1}
                    className="p-1 rounded hover:bg-dark-elevated disabled:opacity-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 py-1 bg-dark-elevated text-white rounded text-sm">
                    {appPage}
                  </span>
                  <button
                    onClick={() => setAppPage((p) => p + 1)}
                    disabled={
                      appPage >=
                      (studentScholarships.data?.total_pages ?? 1)
                    }
                    className="p-1 rounded hover:bg-dark-elevated disabled:opacity-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
        </Card>
      </div>

      {/* NSP & DBT Integration Status Banner */}
      <Card className="relative overflow-hidden bg-gradient-to-r from-[#141414] to-[#262626]">
        <div className="absolute right-0 top-0 h-full w-64 bg-gradient-to-l from-emerald-900/10 to-transparent" />
        <CardContent className="relative z-10 p-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-white p-3 shadow-sm">
                <Network className="h-7 w-7 text-gray-900" />
              </div>
              <div>
                <h3 className="flex items-center gap-2 text-lg font-bold text-white">
                  NSP & DBT Integration Status
                  <Badge className="border-gray-500/30 bg-gray-500/20 text-[10px] text-gray-400">
                    Coming Soon
                  </Badge>
                </h3>
                <p className="mt-1 max-w-xl text-sm text-gray-400">
                  National Scholarship Portal (NSP) synchronization will enable
                  automatic L1 verification queue updates and Direct Benefit
                  Transfer (DBT) tracking.
                </p>
              </div>
            </div>
            <div className="flex gap-8 divide-x divide-gray-700">
              <div className="first:pl-0 pl-4">
                <p className="mb-1 text-xs uppercase tracking-wide text-gray-500">
                  Disbursed (Total)
                </p>
                <span className="text-xl font-bold text-white">
                  {disbursement.isLoading
                    ? "..."
                    : formatINRCompact(totalDisbursed / 100)}
                </span>
              </div>
              <div className="pl-8">
                <p className="mb-1 text-xs uppercase tracking-wide text-gray-500">
                  Pending
                </p>
                <span className="text-xl font-bold text-orange-400">
                  {disbursement.isLoading
                    ? "..."
                    : formatINRCompact(totalPending / 100)}
                </span>
              </div>
              <div className="pl-8">
                <p className="mb-1 text-xs uppercase tracking-wide text-gray-500">
                  Last Sync
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-medium text-gray-500">
                    Not connected
                  </span>
                  <button
                    className="text-gray-600 cursor-not-allowed"
                    disabled
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
