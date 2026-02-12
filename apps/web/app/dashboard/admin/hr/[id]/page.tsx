"use client";

import { useState } from "react";
import {
  Edit,
  Printer,
  GraduationCap,
  BookOpen,
  TrendingUp,
  Fingerprint,
  Check,
  Mail,
  Phone,
  BadgeCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PersonalTab } from "@/components/admin/faculty-profile/personal-tab";
import { QualificationsTab } from "@/components/admin/faculty-profile/qualifications-tab";
import { PublicationsTab } from "@/components/admin/faculty-profile/publications-tab";
import { TeachingTab } from "@/components/admin/faculty-profile/teaching-tab";
import type { FacultyProfileTab, FacultyProfileData } from "@/types/admin";

// ---------------------------------------------------------------------------
// TODO: Replace with API call — GET /api/v1/admin/faculty/{id}
// ---------------------------------------------------------------------------

const FACULTY: FacultyProfileData = {
  id: "1",
  name: "Dr. Sunil Kumar",
  initials: "SK",
  designation: "Professor & HOD",
  department: "Department of Anatomy",
  qualification: "MBBS, MS (Anatomy), DNB",
  email: "sunil.kumar@acolyte.edu",
  phone: "+91 98765 43210",
  empId: "FAC-1002",
  status: "active",
  employmentType: "Regular",
  teachingExp: "18 Yrs",
  publications: 12,
  hIndex: 8,
  aebasAttendance: 92,
};

const TABS: { id: FacultyProfileTab; label: string }[] = [
  { id: "personal", label: "Personal" },
  { id: "qualifications", label: "Qualifications" },
  { id: "publications", label: "Publications" },
  { id: "teaching", label: "Teaching & Attendance" },
];

const STAT_CARDS = [
  {
    value: FACULTY.teachingExp,
    label: "Teaching Exp",
    icon: GraduationCap,
    iconColor: "text-purple-400",
    iconBg: "bg-purple-500/10",
  },
  {
    value: String(FACULTY.publications),
    label: "Publications",
    icon: BookOpen,
    iconColor: "text-blue-400",
    iconBg: "bg-blue-500/10",
  },
  {
    value: String(FACULTY.hIndex),
    label: "H-Index",
    icon: TrendingUp,
    iconColor: "text-orange-400",
    iconBg: "bg-orange-500/10",
  },
  {
    value: `${FACULTY.aebasAttendance}%`,
    label: "AEBAS Attd.",
    icon: Fingerprint,
    iconColor: "text-emerald-400",
    iconBg: "bg-emerald-500/10",
    valueColor: "text-emerald-400",
  },
];

export default function FacultyProfilePage() {
  const [activeTab, setActiveTab] = useState<FacultyProfileTab>("personal");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Hero Card */}
      <div className="overflow-hidden rounded-xl border border-dark-border bg-dark-surface">
        {/* Gradient Banner */}
        <div className="relative h-32 bg-gradient-to-r from-emerald-900/40 to-dark-surface" />

        {/* Profile Info */}
        <div className="relative px-6 pb-6">
          {/* Avatar */}
          <div className="absolute -top-16 left-6 h-32 w-32 rounded-xl bg-[#262626] p-1 ring-4 ring-dark-surface">
            <div className="flex h-full w-full items-center justify-center rounded-lg bg-gradient-to-br from-gray-700 to-gray-600 text-4xl font-bold text-gray-400">
              {FACULTY.initials}
            </div>
            <div className="absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-dark-surface bg-emerald-500">
              <Check className="h-3.5 w-3.5 text-white" />
            </div>
          </div>

          {/* Name + Meta */}
          <div className="ml-40 flex flex-col justify-between gap-4 pt-2 md:flex-row md:items-start">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white">
                  {FACULTY.name}
                </h1>
                <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-400">
                  Active
                </span>
                <span className="rounded border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-400">
                  Permanent
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-400">
                <span className="font-medium text-white">
                  {FACULTY.designation}
                </span>
                <span className="text-gray-600">&bull;</span>
                <span>{FACULTY.department}</span>
                <span className="text-gray-600">&bull;</span>
                <span>{FACULTY.qualification}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-500">
                <div className="flex items-center gap-1.5">
                  <Mail className="h-4 w-4 text-gray-400" />
                  {FACULTY.email}
                </div>
                <div className="flex items-center gap-1.5">
                  <Phone className="h-4 w-4 text-gray-400" />
                  {FACULTY.phone}
                </div>
                <div className="flex items-center gap-1.5">
                  <BadgeCheck className="h-4 w-4 text-gray-400" />
                  Emp ID: {FACULTY.empId}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" size="sm">
                <Edit className="mr-2 h-4 w-4" />
                Edit Profile
              </Button>
              <Button size="sm">
                <Printer className="mr-2 h-4 w-4" />
                Print ID Card
              </Button>
            </div>
          </div>

          {/* Stat Mini-Cards */}
          <div className="mt-8 grid grid-cols-2 gap-4 border-t border-dark-border pt-6 md:grid-cols-4">
            {STAT_CARDS.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="flex items-center gap-3 rounded-lg border border-dark-border bg-[#262626]/30 p-3"
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full",
                      stat.iconBg,
                    )}
                  >
                    <Icon className={cn("h-5 w-5", stat.iconColor)} />
                  </div>
                  <div>
                    <div
                      className={cn(
                        "text-lg font-bold",
                        stat.valueColor ?? "text-white",
                      )}
                    >
                      {stat.value}
                    </div>
                    <div className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
                      {stat.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-t border-dark-border bg-[#262626]/20 px-6">
          <nav className="flex gap-6 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "whitespace-nowrap border-b-2 py-4 text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "border-emerald-500 text-emerald-500"
                    : "border-transparent text-gray-400 hover:border-gray-600 hover:text-white",
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "personal" && <PersonalTab />}
      {activeTab === "qualifications" && <QualificationsTab />}
      {activeTab === "publications" && <PublicationsTab />}
      {activeTab === "teaching" && <TeachingTab />}
    </div>
  );
}
