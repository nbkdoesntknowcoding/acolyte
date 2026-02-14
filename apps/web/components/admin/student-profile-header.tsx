"use client";

import Image from "next/image";
import { Printer, Mail, Phone, Droplets, BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { StudentResponse } from "@/types/admin-api";

interface StudentProfileHeaderProps {
  student: StudentResponse;
}

const STATUS_BADGE: Record<string, { classes: string; label: string }> = {
  active: {
    classes: "border-green-800 bg-green-900/30 text-green-300",
    label: "Active Student",
  },
  enrolled: {
    classes: "border-blue-800 bg-blue-900/30 text-blue-300",
    label: "Enrolled",
  },
  dropped: {
    classes: "border-red-800 bg-red-900/30 text-red-300",
    label: "Dropped",
  },
  graduated: {
    classes: "border-emerald-800 bg-emerald-900/30 text-emerald-300",
    label: "Graduated",
  },
  suspended: {
    classes: "border-yellow-800 bg-yellow-900/30 text-yellow-300",
    label: "Suspended",
  },
};

export function StudentProfileHeader({ student }: StudentProfileHeaderProps) {
  const initials = student.name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const badge = STATUS_BADGE[student.status] ?? STATUS_BADGE.active;

  const enrolledDate = student.admission_date
    ? new Date(student.admission_date).toLocaleDateString("en-IN", {
        month: "short",
        year: "numeric",
      })
    : student.admission_year
      ? String(student.admission_year)
      : null;

  return (
    <div className="rounded-xl border border-dark-border bg-dark-surface p-6 shadow-sm">
      <div className="flex flex-col items-start gap-6 md:flex-row">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-emerald-500/20 bg-dark-elevated">
            {student.photo_url ? (
              <Image
                src={student.photo_url}
                alt={student.name}
                fill
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-gray-400">
                {initials}
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="w-full flex-1">
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h1 className="text-2xl font-bold text-white">{student.name}</h1>
              <div className="mt-1 flex items-center gap-2 text-sm text-gray-400">
                {student.enrollment_number && (
                  <>
                    <span className="flex items-center gap-1">
                      <BadgeCheck className="h-4 w-4" />
                      {student.enrollment_number}
                    </span>
                    <span className="text-gray-600">&bull;</span>
                  </>
                )}
                {enrolledDate && <span>Enrolled: {enrolledDate}</span>}
              </div>
            </div>

            <div className="flex gap-3">
              <Badge variant="default" className={badge.classes}>
                <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
                {badge.label}
              </Badge>
              <Button variant="outline" size="sm">
                <Printer className="mr-1.5 h-3.5 w-3.5" />
                Print Profile
              </Button>
            </div>
          </div>

          {/* Quick stats */}
          <div className="mt-4 grid grid-cols-2 gap-4 border-t border-dark-border pt-4 sm:grid-cols-4">
            <QuickStat
              label="Current Phase"
              value={student.current_phase ?? "—"}
            />
            <QuickStat
              label="Semester"
              value={student.current_semester ? `Semester ${student.current_semester}` : "—"}
            />
            <QuickStat
              label="Quota"
              value={student.admission_quota ?? "—"}
            />
            <QuickStat
              label="NEET Score"
              value={student.neet_score != null ? `${student.neet_score}/720` : "—"}
            />
          </div>

          {/* Contact row */}
          <div className="mt-4 flex flex-wrap gap-4">
            {student.email && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Mail className="h-4 w-4 text-emerald-500" />
                {student.email}
              </div>
            )}
            {student.phone && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Phone className="h-4 w-4 text-emerald-500" />
                +91 {student.phone}
              </div>
            )}
            {student.blood_group && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Droplets className="h-4 w-4 text-emerald-500" />
                {student.blood_group}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="mb-1 text-xs text-gray-500">{label}</p>
      <p
        className={
          highlight
            ? "cursor-pointer font-medium text-emerald-500 hover:underline"
            : "font-medium text-white"
        }
      >
        {value}
      </p>
    </div>
  );
}
