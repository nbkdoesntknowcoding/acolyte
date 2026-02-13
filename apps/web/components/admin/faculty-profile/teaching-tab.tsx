"use client";

import {
  Fingerprint,
  GraduationCap,
  BookOpen,
  FlaskConical,
  HeartPulse,
  Info,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useFacultyPortfolio } from "@/lib/hooks/admin/use-faculty";
import type { FacultyResponse } from "@/types/admin-api";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TeachingTabProps {
  faculty: FacultyResponse;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TeachingTab({ faculty }: TeachingTabProps) {
  const { data: portfolio, isLoading } = useFacultyPortfolio(faculty.id);

  const teachingHours = portfolio?.teaching_hours ?? null;
  const subjects = portfolio?.subjects ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left — AEBAS + Experience */}
        <div className="space-y-6 xl:col-span-5">
          {/* AEBAS Compliance */}
          <Card>
            <div className="flex items-center justify-between border-b border-dark-border p-4">
              <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                <Fingerprint className="h-5 w-5 text-emerald-500" />
                AEBAS Compliance
              </h2>
            </div>
            <div className="p-6">
              <div className="flex items-start gap-3 rounded-lg border border-blue-900/30 bg-blue-900/10 p-4">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-400" />
                <div>
                  <p className="text-sm font-medium text-blue-200">
                    AEBAS attendance data not yet connected
                  </p>
                  <p className="mt-1 text-xs text-blue-200/60">
                    Once the AEBAS integration module is configured, attendance
                    records will appear here automatically.
                  </p>
                </div>
              </div>

              {/* Experience summary from faculty record */}
              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-dark-border bg-[#262626]/50 p-4 text-center">
                  <p className="text-xs uppercase tracking-wide text-gray-400">
                    Teaching Exp
                  </p>
                  <p className="mt-1 text-2xl font-bold text-white">
                    {faculty.teaching_experience_years != null
                      ? `${faculty.teaching_experience_years}y`
                      : "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-dark-border bg-[#262626]/50 p-4 text-center">
                  <p className="text-xs uppercase tracking-wide text-gray-400">
                    Clinical Exp
                  </p>
                  <p className="mt-1 text-2xl font-bold text-white">
                    {faculty.clinical_experience_years != null
                      ? `${faculty.clinical_experience_years}y`
                      : "—"}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right — Teaching Load + Subjects */}
        <div className="space-y-6 xl:col-span-7">
          {/* Teaching Load */}
          <Card>
            <CardContent className="p-6">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                  <GraduationCap className="h-5 w-5 text-purple-400" />
                  Teaching Load
                </h2>
                {teachingHours != null && (
                  <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400">
                    {teachingHours} hrs/wk
                  </span>
                )}
              </div>

              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-6 w-64" />
                  <Skeleton className="h-6 w-40" />
                </div>
              ) : subjects.length > 0 ? (
                <div className="space-y-3">
                  {subjects.map((subject) => {
                    const Icon =
                      subject.toLowerCase().includes("practical")
                        ? FlaskConical
                        : subject.toLowerCase().includes("clinical")
                          ? HeartPulse
                          : BookOpen;
                    const iconColor =
                      subject.toLowerCase().includes("practical")
                        ? "text-purple-400"
                        : subject.toLowerCase().includes("clinical")
                          ? "text-emerald-400"
                          : "text-blue-400";
                    const iconBg =
                      subject.toLowerCase().includes("practical")
                        ? "bg-purple-500/10"
                        : subject.toLowerCase().includes("clinical")
                          ? "bg-emerald-500/10"
                          : "bg-blue-500/10";

                    return (
                      <div
                        key={subject}
                        className="flex items-center gap-3 rounded-lg border border-dark-border p-3 transition-colors hover:bg-[#262626]/30"
                      >
                        <div
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded",
                            iconBg
                          )}
                        >
                          <Icon className={cn("h-5 w-5", iconColor)} />
                        </div>
                        <p className="text-sm font-medium text-white">
                          {subject}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-dark-border bg-[#262626]/30 p-8 text-center">
                  <GraduationCap className="mx-auto h-8 w-8 text-gray-600" />
                  <p className="mt-2 text-sm text-gray-500">
                    Teaching load data will appear once the portfolio endpoint is
                    configured.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
