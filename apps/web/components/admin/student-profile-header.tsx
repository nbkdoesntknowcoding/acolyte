"use client";

import { Printer, Mail, Phone, Droplets, BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { StudentProfile } from "@/types/admin";

interface StudentProfileHeaderProps {
  student: StudentProfile;
}

export function StudentProfileHeader({ student }: StudentProfileHeaderProps) {
  return (
    <div className="rounded-xl border border-dark-border bg-dark-surface p-6 shadow-sm">
      <div className="flex flex-col items-start gap-6 md:flex-row">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="h-24 w-24 overflow-hidden rounded-full border-2 border-emerald-500/20 bg-dark-elevated">
            {/* TODO: Replace with actual avatar from R2 */}
            <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-gray-400">
              {student.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="w-full flex-1">
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h1 className="text-2xl font-bold text-white">{student.name}</h1>
              <div className="mt-1 flex items-center gap-2 text-sm text-gray-400">
                <span className="flex items-center gap-1">
                  <BadgeCheck className="h-4 w-4" />
                  {student.enrollmentNo}
                </span>
                <span className="text-gray-600">&bull;</span>
                <span>Enrolled: {student.enrolledDate}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Badge
                variant="default"
                className="border-green-800 bg-green-900/30 text-green-300"
              >
                <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-green-500" />
                Active Student
              </Badge>
              <Button variant="outline" size="sm">
                <Printer className="mr-1.5 h-3.5 w-3.5" />
                Print Profile
              </Button>
            </div>
          </div>

          {/* Quick stats */}
          <div className="mt-4 grid grid-cols-2 gap-4 border-t border-dark-border pt-4 sm:grid-cols-4">
            <QuickStat label="Current Phase" value={student.phase} />
            <QuickStat label="Batch" value={student.batch} />
            <QuickStat label="Section" value={student.section} />
            {student.mentorName && (
              <QuickStat
                label="Mentor"
                value={student.mentorName}
                highlight
              />
            )}
          </div>

          {/* Contact row (for Attendance tab variant) */}
          {student.email && (
            <div className="mt-4 flex flex-wrap gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Mail className="h-4 w-4 text-emerald-500" />
                {student.email}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Phone className="h-4 w-4 text-emerald-500" />
                {student.phone}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Droplets className="h-4 w-4 text-emerald-500" />
                {student.bloodGroup}
              </div>
            </div>
          )}
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
