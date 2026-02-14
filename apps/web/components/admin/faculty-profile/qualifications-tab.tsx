"use client";

import { useState } from "react";
import {
  GraduationCap,
  CheckCircle,
  Clock,
  RefreshCw,
  Check,
  AlertTriangle,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useFacultyPortfolio,
  useValidateNMC,
} from "@/lib/hooks/admin/use-faculty";
import type { FacultyResponse, NMCValidationResponse } from "@/types/admin-api";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface QualificationsTabProps {
  faculty: FacultyResponse;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QualificationsTab({ faculty }: QualificationsTabProps) {
  const {
    data: portfolio,
    isLoading: portfolioLoading,
    error: portfolioError,
  } = useFacultyPortfolio(faculty.id);
  const validateMutation = useValidateNMC();
  const [validationResult, setValidationResult] =
    useState<NMCValidationResponse | null>(null);

  const qualifications = portfolio?.qualifications ?? [];

  const handleValidateNMC = () => {
    setValidationResult(null);
    validateMutation.mutate(faculty.id, {
      onSuccess: (result) => setValidationResult(result),
    });
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left Column — 2/3 */}
      <div className="space-y-6 lg:col-span-2">
        {/* Academic Qualifications Table */}
        <Card>
          <div className="flex items-center justify-between border-b border-dark-border px-6 py-4">
            <h2 className="flex items-center gap-2 text-base font-semibold text-white">
              <GraduationCap className="h-5 w-5 text-emerald-500" />
              Academic Qualifications
            </h2>
          </div>

          {portfolioLoading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : portfolioError ? (
            <div className="p-6">
              {/* Fallback: show the single qualification from FacultyResponse */}
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#262626]/50 text-[11px] uppercase tracking-wider text-gray-500">
                    <TableHead className="font-semibold">
                      Degree / Course
                    </TableHead>
                    <TableHead className="font-semibold">
                      Specialization
                    </TableHead>
                    <TableHead className="text-center font-semibold">
                      NMC Verified
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium text-white">
                      {faculty.qualification ?? "—"}
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {faculty.specialization ?? "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {faculty.qualification_validated ? (
                        <div
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500"
                          title="Verified"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </div>
                      ) : (
                        <div
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-700 text-gray-400"
                          title="Pending"
                        >
                          <Clock className="h-4 w-4" />
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <p className="mt-3 text-xs text-gray-500">
                Detailed qualifications will be available once the portfolio
                endpoint is configured.
              </p>
            </div>
          ) : qualifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">
              No qualifications recorded.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-[#262626]/50 text-[11px] uppercase tracking-wider text-gray-500">
                  <TableHead className="font-semibold">
                    Degree / Course
                  </TableHead>
                  <TableHead className="font-semibold">
                    University / Board
                  </TableHead>
                  <TableHead className="font-semibold">Year</TableHead>
                  <TableHead className="font-semibold">
                    Specialization
                  </TableHead>
                  <TableHead className="text-center font-semibold">
                    NMC Verified
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {qualifications.map((q) => (
                  <TableRow
                    key={q.id}
                    className="group transition-colors hover:bg-[#262626]/20"
                  >
                    <TableCell>
                      <div className="font-medium text-white">{q.degree}</div>
                      {q.is_highest && (
                        <span className="text-[10px] text-emerald-500">
                          Highest qualification
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {q.university ?? "—"}
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {q.year_of_passing ?? "—"}
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {q.specialization ?? "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {q.nmc_verified ? (
                        <div
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500"
                          title="Verified"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </div>
                      ) : (
                        <div
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-700 text-gray-400"
                          title="Pending Verification"
                        >
                          <Clock className="h-4 w-4" />
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      {/* Right Column — 1/3 */}
      <div className="space-y-6 lg:col-span-1">
        {/* NMC Validation */}
        <Card className="relative overflow-hidden">
          <CardContent className="p-5">
            <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-white">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
              NMC Rules Check
            </h3>

            {/* Validation result */}
            {validationResult && (
              <div className="mb-4 space-y-3">
                <div className="flex gap-3">
                  <div className="mt-0.5 shrink-0">
                    {validationResult.eligible ? (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20">
                        <Check className="h-3 w-3 text-emerald-500" />
                      </div>
                    ) : (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/20">
                        <AlertTriangle className="h-3 w-3 text-red-500" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      {validationResult.eligible
                        ? "Eligible"
                        : "Not Eligible"}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      Eligible designation:{" "}
                      {validationResult.designation_eligible}
                    </p>
                  </div>
                </div>
                {validationResult.notes && (
                  <div className="rounded-lg border border-dark-border bg-[#262626]/50 p-3 text-xs text-gray-300">
                    {validationResult.notes}
                  </div>
                )}
              </div>
            )}

            {/* Validation error */}
            {validateMutation.isError && (
              <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-400">
                Validation failed: {validateMutation.error?.message ?? "Endpoint not available yet."}
              </div>
            )}

            {/* Current status */}
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="mt-0.5 shrink-0">
                  {faculty.qualification_validated ? (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20">
                      <Check className="h-3 w-3 text-emerald-500" />
                    </div>
                  ) : (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-yellow-500/20">
                      <AlertTriangle className="h-3 w-3 text-yellow-500" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    Qualification Validation
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {faculty.qualification_validated
                      ? "Qualifications verified against NMC records"
                      : "Pending verification"}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="mt-0.5 shrink-0">
                  {faculty.is_eligible_per_nmc ? (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20">
                      <Check className="h-3 w-3 text-emerald-500" />
                    </div>
                  ) : (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-yellow-500/20">
                      <AlertTriangle className="h-3 w-3 text-yellow-500" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    NMC Eligibility
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {faculty.is_eligible_per_nmc
                      ? `Eligible as ${faculty.designation ?? "Faculty"}`
                      : "Eligibility not confirmed"}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-dark-border pt-4">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={handleValidateNMC}
                disabled={validateMutation.isPending}
              >
                {validateMutation.isPending ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-3.5 w-3.5" />
                )}
                Validate NMC
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
