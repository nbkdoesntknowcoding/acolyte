"use client";

import { useState } from "react";
import {
  CreditCard,
  IdCard,
  Home,
  ClipboardList,
  Users,
  Phone,
  Calendar,
  Receipt,
  Download,
  AlertTriangle,
  CheckCircle,
  Send,
  PenLine,
  Printer,
  Verified,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatINRCurrency } from "@/lib/format";
import { StudentProfileHeader } from "@/components/admin/student-profile-header";
import { StudentProfileTabs } from "@/components/admin/student-profile-tabs";
import { AttendanceCalendar } from "@/components/admin/attendance-calendar";
import type {
  ProfileTab,
  StudentProfile,
  PersonalInfo,
  ContactInfo,
  AdmissionDetail,
  GuardianInfo,
  AttendanceSummary,
  AttendanceMonth,
  FeePaymentRecord,
  OutstandingBalance,
  AnnualFeeSummary,
} from "@/types/admin";

// ---------------------------------------------------------------------------
// TODO: Replace with API call — GET /api/v1/admin/students/{id}
// ---------------------------------------------------------------------------

const STUDENT: StudentProfile = {
  id: "42",
  name: "Ananya Singh",
  enrollmentNo: "MBBS-2023-042",
  universityRegNo: "U-8829145",
  enrolledDate: "Aug 2023",
  status: "active",
  phase: "Phase I (Pre-Clinical)",
  batch: "Batch of 2023",
  section: "Section A",
  mentorName: "Dr. Rajesh Kumar",
  email: "ananya.singh@example.com",
  phone: "+91 98765 43210",
  bloodGroup: "O+",
};

const PERSONAL_INFO: PersonalInfo = {
  fullName: "Ananya Singh",
  dob: "15 May 2004",
  age: 19,
  gender: "Female",
  bloodGroup: "O Positive (O+)",
  nationality: "Indian",
  religion: "Hindu",
  category: "General",
  aadharMasked: "XXXX-XXXX-4582",
};

const CONTACT: ContactInfo = {
  email: "ananya.singh@example.com",
  emailVerified: true,
  phone: "+91 98765 43210",
  phoneVerified: true,
  permanentAddress:
    "House No. 42, Green Avenue, Sector 15\nNear City Park, Chandigarh, Punjab — 160015",
  correspondenceAddress:
    "Room 204, Girls Hostel Block B, Acolyte Medical College Campus\nNew Delhi — 110029",
};

const ADMISSION_DETAILS: AdmissionDetail[] = [
  { label: "Admission Date", value: "12 Aug 2023" },
  { label: "Quota", value: "State Quota" },
  { label: "NEET Rank", value: "1,245" },
  { label: "NEET Score", value: "685/720" },
  { label: "Scholarship", value: "Merit (50%)", highlight: true },
];

const GUARDIANS: GuardianInfo[] = [
  {
    relation: "Father",
    name: "Mr. Vikram Singh",
    phone: "+91 98765 43211",
    occupation: "Govt. Employee",
  },
  {
    relation: "Mother",
    name: "Mrs. Priya Singh",
    phone: "+91 98765 43212",
    occupation: "Teacher",
  },
];

// --- Attendance & Fees mock data ---

const ATTENDANCE_SUMMARIES: AttendanceSummary[] = [
  {
    label: "Theory Attendance",
    percentage: 78,
    nmcRequirement: 75,
    status: "warning",
  },
  {
    label: "Practical/Clinical",
    percentage: 85,
    nmcRequirement: 80,
    status: "safe",
  },
];

const ATTENDANCE_MONTHS: AttendanceMonth[] = [
  {
    month: "October",
    year: 2024,
    days: [
      { day: 0, status: "blank" },
      { day: 1, status: "half_day" },
      { day: 2, status: "present" },
      { day: 3, status: "present" },
      { day: 4, status: "absent" },
      { day: 5, status: "present" },
      { day: 6, status: "holiday" },
      { day: 7, status: "present" },
      { day: 8, status: "present" },
      { day: 9, status: "late" },
      { day: 10, status: "present" },
      { day: 11, status: "present" },
      { day: 12, status: "half_day" },
      { day: 13, status: "holiday" },
      { day: 14, status: "absent" },
      { day: 15, status: "present" },
      { day: 16, status: "present" },
      { day: 17, status: "present" },
      { day: 18, status: "present" },
      { day: 19, status: "present" },
      { day: 20, status: "holiday" },
      { day: 21, status: "present" },
      { day: 22, status: "present" },
      { day: 23, status: "present" },
      { day: 24, status: "present" },
      { day: 25, status: "present" },
      { day: 26, status: "present" },
      { day: 27, status: "holiday" },
    ],
  },
];

const FEE_PAYMENTS: FeePaymentRecord[] = [
  {
    id: "1",
    date: "15 Oct 2024",
    receiptNo: "RCPT-24-902",
    particulars: "Tuition Fee — Sem 5",
    method: "UPI",
    amount: 75_000,
  },
  {
    id: "2",
    date: "10 Aug 2024",
    receiptNo: "RCPT-24-550",
    particulars: "Hostel Fee — Annual",
    method: "NEFT",
    amount: 45_000,
  },
  {
    id: "3",
    date: "02 Apr 2024",
    receiptNo: "RCPT-24-112",
    particulars: "Exam Fee — Sem 4",
    method: "Cash",
    amount: 3_500,
  },
];

const OUTSTANDING: OutstandingBalance = {
  amount: 25_000,
  description: "Library Fine & Lab Fees",
  dueDate: "30 Oct 2024",
  isOverdue: true,
};

const ANNUAL_SUMMARY: AnnualFeeSummary = {
  totalFees: 4_50_000,
  paidAmount: 4_25_000,
  attendanceDays: 142,
  totalDays: 180,
};

const METHOD_STYLES: Record<string, string> = {
  UPI: "bg-blue-900/30 text-blue-300",
  NEFT: "bg-purple-900/30 text-purple-300",
  Cash: "bg-green-900/30 text-green-300",
  Card: "bg-orange-900/30 text-orange-300",
  DD: "bg-gray-800 text-gray-300",
};

// ---------------------------------------------------------------------------

export default function StudentProfilePage() {
  const [activeTab, setActiveTab] = useState<ProfileTab>("personal");

  return (
    <div className="space-y-6">
      <StudentProfileHeader student={STUDENT} />
      <StudentProfileTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "personal" && <PersonalTabContent />}
      {activeTab === "attendance" && <AttendanceTabContent />}

      {/* Placeholder for other tabs */}
      {activeTab !== "personal" && activeTab !== "attendance" && (
        <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-dark-border">
          <p className="text-sm text-gray-500">
            {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} tab —
            coming soon
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Personal Tab
// ---------------------------------------------------------------------------

function PersonalTabContent() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left — 2/3 */}
      <div className="space-y-6 lg:col-span-2">
        {/* Personal Info */}
        <SectionCard
          icon={<IdCard className="h-5 w-5 text-emerald-500" />}
          title="Personal Information"
          action="Edit Details"
        >
          <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
            <InfoField label="Full Name" value={PERSONAL_INFO.fullName} />
            <InfoField
              label="Date of Birth"
              value={`${PERSONAL_INFO.dob} (${PERSONAL_INFO.age} Years)`}
            />
            <InfoField label="Gender" value={PERSONAL_INFO.gender} />
            <InfoField label="Blood Group" value={PERSONAL_INFO.bloodGroup} />
            <InfoField label="Nationality" value={PERSONAL_INFO.nationality} />
            <InfoField label="Religion" value={PERSONAL_INFO.religion} />
            <InfoField label="Category" value={PERSONAL_INFO.category} />
            <InfoField
              label="Aadhar Number"
              value={PERSONAL_INFO.aadharMasked}
            />
          </div>
        </SectionCard>

        {/* Contact & Address */}
        <SectionCard
          icon={<Home className="h-5 w-5 text-emerald-500" />}
          title="Contact & Address"
          action="Edit Details"
        >
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
              <InfoField label="Email Address" value={CONTACT.email} verified />
              <InfoField
                label="Mobile Number"
                value={CONTACT.phone}
                verified
              />
            </div>

            <div className="border-t border-dark-border pt-4">
              <InfoField
                label="Permanent Address"
                value={CONTACT.permanentAddress}
                multiline
              />
            </div>

            {CONTACT.correspondenceAddress && (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Correspondence Address
                </label>
                <div className="flex items-start gap-2">
                  <p className="whitespace-pre-line text-sm leading-relaxed text-white">
                    {CONTACT.correspondenceAddress}
                  </p>
                  <span className="rounded bg-gray-700 px-2 py-0.5 text-[10px] text-gray-300">
                    Current
                  </span>
                </div>
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      {/* Right — 1/3 */}
      <div className="space-y-6">
        {/* Admission Details */}
        <SectionCard
          icon={<ClipboardList className="h-5 w-5 text-emerald-500" />}
          title="Admission Details"
        >
          <div className="space-y-4">
            {ADMISSION_DETAILS.map((d) => (
              <div
                key={d.label}
                className={cn(
                  "flex items-center justify-between py-2",
                  d !== ADMISSION_DETAILS[ADMISSION_DETAILS.length - 1] &&
                    "border-b border-dark-border",
                )}
              >
                <span className="text-xs text-gray-500">{d.label}</span>
                <span
                  className={cn(
                    "text-sm font-medium",
                    d.highlight ? "text-green-400" : "text-white",
                  )}
                >
                  {d.value}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Guardian Info */}
        <SectionCard
          icon={<Users className="h-5 w-5 text-emerald-500" />}
          title="Guardian Info"
        >
          <div className="space-y-6">
            {GUARDIANS.map((g) => (
              <div key={g.relation} className="flex gap-4">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                    g.relation === "Father"
                      ? "bg-blue-900/30 text-blue-400"
                      : "bg-pink-900/30 text-pink-400",
                  )}
                >
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="mb-0.5 text-xs text-gray-500">{g.relation}</p>
                  <p className="text-sm font-semibold text-white">{g.name}</p>
                  <p className="mt-1 text-xs text-gray-500">{g.phone}</p>
                  <p className="text-xs text-gray-500">{g.occupation}</p>
                </div>
              </div>
            ))}

            <Button variant="outline" size="sm" className="w-full">
              <Phone className="mr-2 h-3.5 w-3.5" />
              Emergency Contact
            </Button>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Attendance & Fees Tab
// ---------------------------------------------------------------------------

function AttendanceTabContent() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left — 2/3 */}
      <div className="space-y-6 lg:col-span-2">
        {/* Attendance Overview */}
        <Card>
          <CardContent className="p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                <Calendar className="h-5 w-5 text-emerald-500" />
                Attendance Overview
              </h2>
              {/* TODO: Replace with actual academic year selector */}
              <select className="cursor-pointer rounded-lg border-none bg-dark-elevated py-1.5 pl-3 pr-8 text-sm text-gray-300 focus:ring-1 focus:ring-emerald-500">
                <option>Academic Year 2024-25</option>
                <option>Academic Year 2023-24</option>
              </select>
            </div>

            {/* Theory / Practical progress */}
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {ATTENDANCE_SUMMARIES.map((att) => (
                <div
                  key={att.label}
                  className="rounded-lg border border-dark-border bg-dark-elevated/30 p-4"
                >
                  <div className="mb-2 flex items-end justify-between">
                    <span className="text-sm font-medium text-gray-400">
                      {att.label}
                    </span>
                    <span className="text-2xl font-bold text-white">
                      {att.percentage}%
                    </span>
                  </div>

                  {/* Progress bar with NMC threshold */}
                  <div className="relative mb-1 h-2 w-full rounded-full bg-gray-700">
                    <div
                      className={cn(
                        "absolute left-0 top-0 h-2 rounded-full",
                        att.status === "safe"
                          ? "bg-emerald-500"
                          : att.status === "warning"
                            ? "bg-yellow-500"
                            : "bg-red-500",
                      )}
                      style={{ width: `${att.percentage}%` }}
                    />
                    {/* NMC threshold marker */}
                    <div
                      className="absolute -top-1 z-10 h-4 w-0.5 bg-gray-500"
                      style={{ left: `${att.nmcRequirement}%` }}
                      title={`NMC Requirement: ${att.nmcRequirement}%`}
                    />
                  </div>

                  <div className="mt-1 flex justify-between text-[10px] text-gray-400">
                    <span>Current</span>
                    <span className="text-gray-500">
                      NMC Requirement: {att.nmcRequirement}%
                    </span>
                  </div>

                  <p
                    className={cn(
                      "mt-2 flex items-center gap-1 text-xs",
                      att.status === "safe"
                        ? "text-green-400"
                        : att.status === "warning"
                          ? "text-yellow-400"
                          : "text-red-400",
                    )}
                  >
                    {att.status === "safe" ? (
                      <CheckCircle className="h-3.5 w-3.5" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    )}
                    {att.status === "safe"
                      ? "Safe Zone"
                      : "Just above threshold"}
                  </p>
                </div>
              ))}
            </div>

            {/* Calendar heatmap */}
            <h3 className="mb-3 text-sm font-semibold text-gray-300">
              Monthly Breakdown
            </h3>
            <AttendanceCalendar months={ATTENDANCE_MONTHS} />
          </CardContent>
        </Card>

        {/* Fee Payment History */}
        <Card>
          <CardContent className="p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                <Receipt className="h-5 w-5 text-emerald-500" />
                Fee Payment History
              </h2>
              <Button variant="outline" size="sm">
                Download Statement
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-dark-border text-xs uppercase text-gray-500">
                    <th className="px-2 py-3 font-medium">Date</th>
                    <th className="px-2 py-3 font-medium">Receipt No.</th>
                    <th className="px-2 py-3 font-medium">Particulars</th>
                    <th className="px-2 py-3 font-medium">Method</th>
                    <th className="px-2 py-3 text-right font-medium">
                      Amount (INR)
                    </th>
                    <th className="px-2 py-3 text-center font-medium">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {FEE_PAYMENTS.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-dark-border/50 transition-colors hover:bg-dark-elevated/30"
                    >
                      <td className="px-2 py-3 text-gray-300">{p.date}</td>
                      <td className="px-2 py-3 font-mono text-xs text-gray-500">
                        {p.receiptNo}
                      </td>
                      <td className="px-2 py-3 text-gray-300">
                        {p.particulars}
                      </td>
                      <td className="px-2 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium",
                            METHOD_STYLES[p.method],
                          )}
                        >
                          {p.method}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-right font-medium text-white">
                        {formatINRCurrency(p.amount)}
                      </td>
                      <td className="px-2 py-3 text-center">
                        <button className="text-gray-400 transition-colors hover:text-emerald-500">
                          <Download className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right — 1/3 */}
      <div className="space-y-6">
        {/* Outstanding Balance */}
        <Card className="relative overflow-hidden border-red-900/50">
          <CardContent className="p-6">
            <div className="pointer-events-none absolute right-0 top-0 p-4 opacity-10">
              <CreditCard className="h-20 w-20 text-red-500" />
            </div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
              Outstanding Balance
            </h3>
            <div className="mb-2 mt-4">
              <span className="text-3xl font-bold text-red-400">
                {formatINRCurrency(OUTSTANDING.amount)}
              </span>
            </div>
            <p className="mb-6 text-sm text-gray-300">
              Due for:{" "}
              <span className="font-medium">{OUTSTANDING.description}</span>
            </p>

            <div className="space-y-3">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Due Date</span>
                <span className="font-medium text-red-500">
                  {OUTSTANDING.dueDate}{" "}
                  {OUTSTANDING.isOverdue && "(Overdue)"}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-gray-800">
                <div className="h-1.5 w-full rounded-full bg-red-500" />
              </div>
            </div>

            <div className="mt-6">
              <Button
                variant="outline"
                className="w-full border-red-800 bg-red-900/20 text-red-400 hover:bg-red-900/30"
              >
                <Send className="mr-2 h-3.5 w-3.5" />
                Send Reminder
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-4 text-sm font-semibold text-white">
              Quick Actions
            </h3>
            <div className="space-y-2">
              <QuickAction
                icon={<CreditCard className="h-4 w-4" />}
                iconBg="bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white"
                label="Record New Fee"
                description="Add manual payment"
              />
              <QuickAction
                icon={<PenLine className="h-4 w-4" />}
                iconBg="bg-blue-900/30 text-blue-400 group-hover:bg-blue-600 group-hover:text-white"
                label="Modify Attendance"
                description="Request correction"
              />
              <QuickAction
                icon={<Printer className="h-4 w-4" />}
                iconBg="bg-orange-900/30 text-orange-400 group-hover:bg-orange-600 group-hover:text-white"
                label="Print Report"
                description="Attendance summary"
              />
            </div>
          </CardContent>
        </Card>

        {/* Annual Summary */}
        <div className="rounded-xl border border-gray-800 bg-gradient-to-br from-gray-800 to-black p-5 text-white shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-200">
            Annual Summary
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-gray-700 pb-2">
              <span className="text-xs text-gray-400">Total Fees</span>
              <span className="font-mono text-sm">
                {formatINRCurrency(ANNUAL_SUMMARY.totalFees)}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-gray-700 pb-2">
              <span className="text-xs text-gray-400">Paid Amount</span>
              <span className="font-mono text-sm text-emerald-500">
                {formatINRCurrency(ANNUAL_SUMMARY.paidAmount)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Attendance Days</span>
              <span className="font-mono text-sm">
                {ANNUAL_SUMMARY.attendanceDays} / {ANNUAL_SUMMARY.totalDays}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function SectionCard({
  icon,
  title,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  action?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-dark-border bg-dark-elevated/30 px-6 py-4">
        <h3 className="flex items-center gap-2 text-base font-semibold text-white">
          {icon}
          {title}
        </h3>
        {action && (
          <button className="text-xs font-medium text-emerald-500 hover:underline">
            {action}
          </button>
        )}
      </div>
      <CardContent className="p-6">{children}</CardContent>
    </Card>
  );
}

function InfoField({
  label,
  value,
  verified,
  multiline,
}: {
  label: string;
  value: string;
  verified?: boolean;
  multiline?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <p
          className={cn(
            "text-sm font-medium text-white",
            multiline && "whitespace-pre-line leading-relaxed",
          )}
        >
          {value}
        </p>
        {verified && <Verified className="h-3.5 w-3.5 text-green-500" />}
      </div>
    </div>
  );
}

function QuickAction({
  icon,
  iconBg,
  label,
  description,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  description: string;
}) {
  return (
    <button className="group flex w-full items-center gap-3 rounded-lg border border-transparent px-4 py-3 text-left transition-all hover:border-gray-700 hover:bg-dark-elevated">
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
          iconBg,
        )}
      >
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-200">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
    </button>
  );
}
