"use client";

import {
  User,
  Briefcase,
  CheckCircle,
  Lock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { FacultyResponse } from "@/types/admin-api";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PersonalTabProps {
  faculty: FacultyResponse;
  departmentName: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function retirementCountdown(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return "Retired";
  const years = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  const months = Math.floor(
    (diff % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000)
  );
  if (years > 0) return `${years}Y ${months}M left`;
  return `${months}M left`;
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium uppercase text-gray-500">
        {label}
      </label>
      <p className="border-b border-dark-border pb-2 text-sm font-medium text-gray-200">
        {value}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PersonalTab({ faculty, departmentName }: PersonalTabProps) {
  const registrationIds = [
    {
      label: "NMC Registration",
      value: faculty.nmc_faculty_id ?? "—",
      subLabel: faculty.qualification_validated
        ? "Validated"
        : "Pending validation",
      verified: faculty.qualification_validated ?? false,
    },
    {
      label: "AEBAS ID",
      value: faculty.aebas_id ?? "—",
      verified: !!faculty.aebas_id,
    },
    {
      label: "Employee ID",
      value: faculty.employee_id ?? "—",
      verified: !!faculty.employee_id,
    },
    {
      label: "ORCID iD",
      value: faculty.orcid_id ?? "—",
      verified: !!faculty.orcid_id,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left Column — 2/3 */}
      <div className="space-y-6 lg:col-span-2">
        {/* Basic Information */}
        <Card>
          <CardContent className="p-6">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
              <User className="h-5 w-5 text-emerald-500" />
              Basic Information
            </h3>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <InfoField label="Full Name" value={faculty.name} />
              <InfoField
                label="Date of Birth"
                value={formatDate(faculty.date_of_birth)}
              />
              <InfoField label="Gender" value={faculty.gender ?? "—"} />
              <InfoField label="Email" value={faculty.email ?? "—"} />
              <InfoField label="Phone" value={faculty.phone ?? "—"} />
              <InfoField
                label="Specialization"
                value={faculty.specialization ?? "—"}
              />
              {faculty.sub_specialization && (
                <InfoField
                  label="Sub-Specialization"
                  value={faculty.sub_specialization}
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Service Details */}
        <Card>
          <CardContent className="p-6">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
              <Briefcase className="h-5 w-5 text-emerald-500" />
              Service Details
            </h3>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <InfoField
                label="Date of Joining"
                value={formatDate(faculty.date_of_joining)}
              />
              <InfoField
                label="Designation"
                value={faculty.designation ?? "—"}
              />
              <InfoField
                label="Department"
                value={departmentName}
              />
              <InfoField
                label="Employment Type"
                value={faculty.employment_type ?? "—"}
              />
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase text-gray-500">
                  Date of Retirement
                </label>
                <div className="flex items-center justify-between border-b border-dark-border pb-2">
                  <p className="text-sm font-medium text-gray-200">
                    {formatDate(faculty.retirement_date)}
                  </p>
                  <span className="rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
                    {retirementCountdown(faculty.retirement_date)}
                  </span>
                </div>
              </div>
              <InfoField
                label="Pay Scale"
                value={faculty.pay_scale_type ?? "—"}
              />
              <InfoField
                label="Teaching Experience"
                value={
                  faculty.teaching_experience_years != null
                    ? `${faculty.teaching_experience_years} years`
                    : "—"
                }
              />
              <InfoField
                label="Total Experience"
                value={
                  faculty.total_experience_years != null
                    ? `${faculty.total_experience_years} years`
                    : "—"
                }
              />
              <InfoField
                label="BCME Completed"
                value={
                  faculty.bcme_completed === true
                    ? "Yes"
                    : faculty.bcme_completed === false
                      ? "No"
                      : "—"
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Column — 1/3 */}
      <div className="space-y-6 lg:col-span-1">
        {/* Registration IDs */}
        <Card className="relative overflow-hidden">
          <CardContent className="p-5">
            <h3 className="mb-4 text-base font-bold text-white">
              Registration IDs
            </h3>
            <div className="space-y-4">
              {registrationIds.map((reg) => (
                <div
                  key={reg.label}
                  className="rounded-lg border border-dark-border bg-[#262626]/50 p-3 transition-colors hover:border-emerald-500/50"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-400">
                      {reg.label}
                    </span>
                    {reg.verified ? (
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Lock className="h-4 w-4 text-gray-600" />
                    )}
                  </div>
                  <div className="font-mono text-sm tracking-wide text-white">
                    {reg.value}
                  </div>
                  {"subLabel" in reg && reg.subLabel && (
                    <div className="mt-1 text-[10px] text-gray-500">
                      {reg.subLabel}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* NMC Eligibility Status */}
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-4 text-base font-bold text-white">
              NMC Eligibility
            </h3>
            <div className="rounded-lg border border-dark-border bg-[#262626]/50 p-4 text-center">
              {faculty.is_eligible_per_nmc === true ? (
                <>
                  <CheckCircle className="mx-auto h-8 w-8 text-emerald-500" />
                  <p className="mt-2 text-sm font-medium text-emerald-400">
                    Eligible per NMC
                  </p>
                </>
              ) : faculty.is_eligible_per_nmc === false ? (
                <>
                  <Lock className="mx-auto h-8 w-8 text-red-400" />
                  <p className="mt-2 text-sm font-medium text-red-400">
                    Not eligible per NMC
                  </p>
                </>
              ) : (
                <>
                  <Lock className="mx-auto h-8 w-8 text-gray-500" />
                  <p className="mt-2 text-sm font-medium text-gray-400">
                    Eligibility not validated
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
