"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  CreditCard,
  IdCard,
  Home,
  ClipboardList,
  Users,
  Calendar,
  Receipt,
  Download,
  AlertTriangle,
  CheckCircle,
  Send,
  Printer,
  Verified,
  ArrowLeft,
  RefreshCw,
  Save,
  X,
  Folder,
  GraduationCap,
  BookOpen,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatINRCurrency } from "@/lib/format";
import { paisaToRupees } from "@/lib/utils/currency";
import { StudentProfileHeader } from "@/components/admin/student-profile-header";
import { StudentProfileTabs } from "@/components/admin/student-profile-tabs";
import {
  useStudent,
  useUpdateStudent,
  useStudentFeeSummary,
} from "@/lib/hooks/admin/use-students";
import type { ProfileTab } from "@/types/admin";
import type { StudentResponse, StudentUpdate } from "@/types/admin-api";

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function StudentProfilePage() {
  const params = useParams<{ id: string }>();
  const studentId = params.id;

  const { data: student, isLoading, isError, error, refetch } = useStudent(studentId);
  const [activeTab, setActiveTab] = useState<ProfileTab>("personal");

  // 404
  if (!isLoading && !student && !isError) {
    return <NotFoundState />;
  }

  // Error
  if (isError) {
    return (
      <div className="space-y-6">
        <BackButton />
        <div className="flex flex-col items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-12 text-center">
          <AlertTriangle className="h-8 w-8 text-red-400" />
          <p className="text-sm text-red-400">
            {error?.message === "API error 404"
              ? "Student not found"
              : error?.message || "Failed to load student"}
          </p>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
            <Link href="/dashboard/admin/students/records">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to List
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Loading
  if (isLoading || !student) {
    return (
      <div className="space-y-6">
        <BackButton />
        <HeaderSkeleton />
        <div className="h-12 animate-pulse rounded bg-gray-800" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <CardSkeleton lines={8} />
            <CardSkeleton lines={4} />
          </div>
          <div className="space-y-6">
            <CardSkeleton lines={5} />
            <CardSkeleton lines={3} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackButton />
      <StudentProfileHeader student={student} />
      <StudentProfileTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "personal" && <PersonalTabContent student={student} />}
      {activeTab === "academic" && <AcademicTabContent student={student} />}
      {activeTab === "attendance" && <AttendanceTabPlaceholder />}
      {activeTab === "fees" && <FeeTabContent studentId={student.id} />}
      {activeTab === "documents" && <DocumentsTabPlaceholder />}
      {activeTab === "logbook" && <LogbookTabPlaceholder />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Back button
// ---------------------------------------------------------------------------

function BackButton() {
  return (
    <Link
      href="/dashboard/admin/students/records"
      className="inline-flex items-center gap-1 text-sm text-gray-400 transition-colors hover:text-emerald-500"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to Student Records
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Personal Tab
// ---------------------------------------------------------------------------

function PersonalTabContent({ student }: { student: StudentResponse }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<StudentUpdate>({});
  const updateStudent = useUpdateStudent();

  const startEdit = () => {
    setForm({
      name: student.name,
      email: student.email,
      phone: student.phone,
      date_of_birth: student.date_of_birth,
      gender: student.gender,
      blood_group: student.blood_group,
      nationality: student.nationality,
      category: student.category,
      father_name: student.father_name,
      mother_name: student.mother_name,
    });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setForm({});
  };

  const saveEdit = () => {
    updateStudent.mutate(
      { id: student.id, data: form },
      { onSuccess: () => setEditing(false) }
    );
  };

  const updateField = (field: keyof StudentUpdate, value: string | null) => {
    setForm((prev) => ({ ...prev, [field]: value || null }));
  };

  const dobFormatted = student.date_of_birth
    ? new Date(student.date_of_birth).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const age = student.date_of_birth
    ? Math.floor(
        (Date.now() - new Date(student.date_of_birth).getTime()) /
          (365.25 * 24 * 60 * 60 * 1000)
      )
    : null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left — 2/3 */}
      <div className="space-y-6 lg:col-span-2">
        {/* Personal Info */}
        <SectionCard
          icon={<IdCard className="h-5 w-5 text-emerald-500" />}
          title="Personal Information"
          action={
            editing ? (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={cancelEdit}
                  disabled={updateStudent.isPending}
                >
                  <X className="mr-1 h-3.5 w-3.5" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={saveEdit}
                  disabled={updateStudent.isPending}
                >
                  <Save className="mr-1 h-3.5 w-3.5" />
                  {updateStudent.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            ) : (
              <button
                onClick={startEdit}
                className="text-xs font-medium text-emerald-500 hover:underline"
              >
                Edit Details
              </button>
            )
          }
        >
          {editing ? (
            <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
              <EditField label="Full Name" value={form.name ?? ""} onChange={(v) => updateField("name", v)} />
              <EditField label="Date of Birth" value={form.date_of_birth ?? ""} onChange={(v) => updateField("date_of_birth", v)} type="date" />
              <EditField label="Gender" value={form.gender ?? ""} onChange={(v) => updateField("gender", v)} />
              <EditField label="Blood Group" value={form.blood_group ?? ""} onChange={(v) => updateField("blood_group", v)} />
              <EditField label="Nationality" value={form.nationality ?? ""} onChange={(v) => updateField("nationality", v)} />
              <EditField label="Category" value={form.category ?? ""} onChange={(v) => updateField("category", v)} />
              <EditField label="Email" value={form.email ?? ""} onChange={(v) => updateField("email", v)} type="email" />
              <EditField label="Phone" value={form.phone ?? ""} onChange={(v) => updateField("phone", v)} />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
              <InfoField label="Full Name" value={student.name} />
              <InfoField
                label="Date of Birth"
                value={dobFormatted ? `${dobFormatted}${age ? ` (${age} Years)` : ""}` : "—"}
              />
              <InfoField label="Gender" value={student.gender ?? "—"} />
              <InfoField label="Blood Group" value={student.blood_group ?? "—"} />
              <InfoField label="Nationality" value={student.nationality ?? "—"} />
              <InfoField label="Category" value={student.category ?? "—"} />
            </div>
          )}
          {updateStudent.isError && (
            <p className="mt-3 text-xs text-red-400">
              Failed to save: {updateStudent.error.message}
            </p>
          )}
        </SectionCard>

        {/* Contact & Address */}
        <SectionCard
          icon={<Home className="h-5 w-5 text-emerald-500" />}
          title="Contact & Address"
        >
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
              <InfoField
                label="Email Address"
                value={student.email ?? "—"}
                verified={!!student.email}
              />
              <InfoField
                label="Mobile Number"
                value={student.phone ? `+91 ${student.phone}` : "—"}
                verified={!!student.phone}
              />
            </div>

            {/* TODO: Address fields not on StudentResponse — needs profile extension */}
            <div className="border-t border-dark-border pt-4">
              <p className="text-xs text-gray-500">
                Address information requires the student profile extension
                endpoint (coming soon).
              </p>
            </div>
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
            <AdmissionRow label="Admission Date" value={
              student.admission_date
                ? new Date(student.admission_date).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "—"
            } />
            <AdmissionRow label="Quota" value={student.admission_quota ?? "—"} />
            <AdmissionRow label="NEET Rank" value={student.neet_rank != null ? student.neet_rank.toLocaleString("en-IN") : "—"} />
            <AdmissionRow
              label="NEET Score"
              value={student.neet_score != null ? `${student.neet_score}/720` : "—"}
              highlight={student.neet_score != null && student.neet_score >= 650}
            />
            <AdmissionRow label="Counseling Round" value={student.counseling_round ?? "—"} />
            <AdmissionRow
              label="NMC Uploaded"
              value={student.nmc_uploaded ? "Yes" : "No"}
              highlight={!!student.nmc_uploaded}
              last
            />
          </div>
        </SectionCard>

        {/* Guardian Info */}
        <SectionCard
          icon={<Users className="h-5 w-5 text-emerald-500" />}
          title="Guardian Info"
        >
          <div className="space-y-6">
            {student.father_name && (
              <GuardianCard relation="Father" name={student.father_name} />
            )}
            {student.mother_name && (
              <GuardianCard relation="Mother" name={student.mother_name} />
            )}
            {!student.father_name && !student.mother_name && (
              <p className="text-sm text-gray-500">No guardian information available.</p>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Academic Tab
// ---------------------------------------------------------------------------

function AcademicTabContent({ student }: { student: StudentResponse }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <SectionCard
          icon={<GraduationCap className="h-5 w-5 text-emerald-500" />}
          title="Academic Progress"
        >
          <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
            <InfoField label="Current Phase" value={student.current_phase ?? "—"} />
            <InfoField
              label="Current Semester"
              value={student.current_semester ? `Semester ${student.current_semester}` : "—"}
            />
            <InfoField label="Enrollment Number" value={student.enrollment_number ?? "—"} />
            <InfoField
              label="University Reg. No."
              value={student.university_registration_number ?? "—"}
            />
            <InfoField label="Admission Year" value={student.admission_year?.toString() ?? "—"} />
            <InfoField label="Hosteler" value={student.is_hosteler ? "Yes" : "No"} />
          </div>
        </SectionCard>

        {/* Subject-wise performance placeholder */}
        <Card>
          <CardContent className="flex h-48 items-center justify-center p-6">
            <div className="text-center">
              <BookOpen className="mx-auto mb-2 h-8 w-8 text-gray-600" />
              <p className="text-sm text-gray-500">
                Subject-wise performance data coming soon.
              </p>
              <p className="mt-1 text-xs text-gray-600">
                Depends on Student Engine assessment integration.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <SectionCard
          icon={<ClipboardList className="h-5 w-5 text-emerald-500" />}
          title="NEET Details"
        >
          <div className="space-y-4">
            <AdmissionRow label="Roll Number" value={student.neet_roll_number ?? "—"} />
            <AdmissionRow label="Score" value={student.neet_score != null ? `${student.neet_score}/720` : "—"} />
            <AdmissionRow label="Rank" value={student.neet_rank != null ? student.neet_rank.toLocaleString("en-IN") : "—"} />
            <AdmissionRow
              label="Percentile"
              value={student.neet_percentile != null ? `${student.neet_percentile}%` : "—"}
              last
            />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fee Tab
// ---------------------------------------------------------------------------

function FeeTabContent({ studentId }: { studentId: string }) {
  const { data: feeSummary, isLoading, isError, error, refetch } = useStudentFeeSummary(studentId);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2"><CardSkeleton lines={6} /></div>
        <div><CardSkeleton lines={4} /></div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-8 text-center">
        <AlertTriangle className="h-6 w-6 text-red-400" />
        <p className="text-sm text-red-400">{error?.message || "Failed to load fee data"}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" /> Retry
        </Button>
      </div>
    );
  }

  if (!feeSummary) return null;

  const totalFee = paisaToRupees(feeSummary.total_fee);
  const totalPaid = paisaToRupees(feeSummary.total_paid);
  const outstanding = paisaToRupees(feeSummary.outstanding);
  const overpaid = paisaToRupees(feeSummary.overpaid);
  const paidPct = totalFee > 0 ? Math.round((totalPaid / totalFee) * 100) : 0;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left — Fee breakdown */}
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardContent className="p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                <Receipt className="h-5 w-5 text-emerald-500" />
                Fee Summary
              </h2>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Download Statement
              </Button>
            </div>

            {/* Summary cards */}
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <FeeStat label="Total Fee" value={formatINRCurrency(totalFee)} />
              <FeeStat label="Paid" value={formatINRCurrency(totalPaid)} valueClass="text-emerald-500" />
              <FeeStat label="Outstanding" value={formatINRCurrency(outstanding)} valueClass={outstanding > 0 ? "text-red-400" : "text-gray-400"} />
              <FeeStat label="Overpaid" value={formatINRCurrency(overpaid)} valueClass={overpaid > 0 ? "text-blue-400" : "text-gray-400"} />
            </div>

            {/* Progress bar */}
            <div className="mb-2">
              <div className="flex justify-between text-xs text-gray-400">
                <span>Payment Progress</span>
                <span className="font-medium text-white">{paidPct}%</span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-gray-700">
                <div
                  className={cn(
                    "h-2 rounded-full transition-all",
                    paidPct >= 100 ? "bg-emerald-500" : paidPct >= 50 ? "bg-yellow-500" : "bg-red-500"
                  )}
                  style={{ width: `${Math.min(paidPct, 100)}%` }}
                />
              </div>
            </div>

            {/* Payment history placeholder */}
            <div className="mt-8 border-t border-dark-border pt-6">
              <h3 className="mb-3 text-sm font-semibold text-gray-300">
                Payment History
              </h3>
              <p className="text-xs text-gray-500">
                Individual payment transactions will be available when the fee
                payments list endpoint is wired. The summary above reflects the
                aggregate calculation.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right — Outstanding card */}
      <div className="space-y-6">
        {outstanding > 0 ? (
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
                  {formatINRCurrency(outstanding)}
                </span>
              </div>
              <div className="mt-4 h-1.5 w-full rounded-full bg-gray-800">
                <div className="h-1.5 w-full rounded-full bg-red-500" />
              </div>
              <div className="mt-6">
                {/* TODO: Wire to notification/reminder endpoint */}
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
        ) : (
          <Card className="relative overflow-hidden border-emerald-900/50">
            <CardContent className="p-6">
              <div className="pointer-events-none absolute right-0 top-0 p-4 opacity-10">
                <CheckCircle className="h-20 w-20 text-emerald-500" />
              </div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
                Fee Status
              </h3>
              <div className="mt-4 flex items-center gap-2">
                <CheckCircle className="h-6 w-6 text-emerald-500" />
                <span className="text-lg font-bold text-emerald-400">All Paid</span>
              </div>
              {overpaid > 0 && (
                <p className="mt-2 text-sm text-blue-400">
                  Overpaid: {formatINRCurrency(overpaid)}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-4 text-sm font-semibold text-white">Quick Actions</h3>
            <div className="space-y-2">
              <QuickAction
                icon={<CreditCard className="h-4 w-4" />}
                iconBg="bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white"
                label="Record New Fee"
                description="Add manual payment"
              />
              <QuickAction
                icon={<Printer className="h-4 w-4" />}
                iconBg="bg-orange-900/30 text-orange-400 group-hover:bg-orange-600 group-hover:text-white"
                label="Print Fee Receipt"
                description="Latest payment"
              />
            </div>
          </CardContent>
        </Card>

        {/* Fee Overview */}
        <div className="rounded-xl border border-gray-800 bg-gradient-to-br from-gray-800 to-black p-5 text-white shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-200">Fee Overview</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-gray-700 pb-2">
              <span className="text-xs text-gray-400">Total Fees</span>
              <span className="font-mono text-sm">{formatINRCurrency(totalFee)}</span>
            </div>
            <div className="flex items-center justify-between border-b border-gray-700 pb-2">
              <span className="text-xs text-gray-400">Paid Amount</span>
              <span className="font-mono text-sm text-emerald-500">
                {formatINRCurrency(totalPaid)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Balance</span>
              <span
                className={cn(
                  "font-mono text-sm",
                  outstanding > 0 ? "text-red-400" : "text-emerald-500"
                )}
              >
                {outstanding > 0
                  ? formatINRCurrency(outstanding)
                  : formatINRCurrency(0)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Placeholder tabs (no backend endpoint yet)
// ---------------------------------------------------------------------------

function AttendanceTabPlaceholder() {
  return (
    <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-dark-border">
      <Calendar className="mb-3 h-8 w-8 text-gray-600" />
      <p className="text-sm text-gray-500">
        Attendance data coming soon
      </p>
      <p className="mt-1 text-xs text-gray-600">
        Requires Integration Engine AEBAS attendance endpoint.
      </p>
    </div>
  );
}

function DocumentsTabPlaceholder() {
  return (
    <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-dark-border">
      <Folder className="mb-3 h-8 w-8 text-gray-600" />
      <p className="text-sm text-gray-500">
        Student documents coming soon
      </p>
      <p className="mt-1 text-xs text-gray-600">
        StudentDocument model exists — routes need to be registered.
      </p>
    </div>
  );
}

function LogbookTabPlaceholder() {
  return (
    <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-dark-border">
      <BookOpen className="mb-3 h-8 w-8 text-gray-600" />
      <p className="text-sm text-gray-500">
        CBME Logbook coming soon
      </p>
      <p className="mt-1 text-xs text-gray-600">
        Requires Student Engine logbook integration.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 404 state
// ---------------------------------------------------------------------------

function NotFoundState() {
  return (
    <div className="space-y-6">
      <BackButton />
      <div className="flex flex-col items-center gap-4 rounded-xl border border-dark-border bg-dark-surface p-16 text-center">
        <AlertTriangle className="h-10 w-10 text-yellow-500" />
        <h2 className="text-xl font-bold text-white">Student Not Found</h2>
        <p className="text-sm text-gray-400">
          This student record may have been removed or the ID is invalid.
        </p>
        <Link href="/dashboard/admin/students/records">
          <Button>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Student Records
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function HeaderSkeleton() {
  return (
    <div className="rounded-xl border border-dark-border bg-dark-surface p-6">
      <div className="flex items-start gap-6">
        <div className="h-24 w-24 animate-pulse rounded-full bg-gray-700" />
        <div className="flex-1 space-y-3">
          <div className="h-7 w-48 animate-pulse rounded bg-gray-700" />
          <div className="h-4 w-64 animate-pulse rounded bg-gray-700/60" />
          <div className="mt-4 grid grid-cols-4 gap-4 border-t border-dark-border pt-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="h-3 w-16 animate-pulse rounded bg-gray-700/60" />
                <div className="h-4 w-24 animate-pulse rounded bg-gray-700" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CardSkeleton({ lines }: { lines: number }) {
  return (
    <Card>
      <div className="border-b border-dark-border bg-dark-elevated/30 px-6 py-4">
        <div className="h-5 w-40 animate-pulse rounded bg-gray-700" />
      </div>
      <CardContent className="space-y-3 p-6">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="h-4 animate-pulse rounded bg-gray-700/60" style={{ width: `${60 + Math.random() * 30}%` }} />
        ))}
      </CardContent>
    </Card>
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
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-dark-border bg-dark-elevated/30 px-6 py-4">
        <h3 className="flex items-center gap-2 text-base font-semibold text-white">
          {icon}
          {title}
        </h3>
        {action}
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

function EditField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-700 bg-dark-elevated px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
      />
    </div>
  );
}

function AdmissionRow({
  label,
  value,
  highlight,
  last,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between py-2",
        !last && "border-b border-dark-border",
      )}
    >
      <span className="text-xs text-gray-500">{label}</span>
      <span
        className={cn(
          "text-sm font-medium",
          highlight ? "text-green-400" : "text-white",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function GuardianCard({ relation, name }: { relation: string; name: string }) {
  return (
    <div className="flex gap-4">
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          relation === "Father"
            ? "bg-blue-900/30 text-blue-400"
            : "bg-pink-900/30 text-pink-400",
        )}
      >
        <Users className="h-5 w-5" />
      </div>
      <div>
        <p className="mb-0.5 text-xs text-gray-500">{relation}</p>
        <p className="text-sm font-semibold text-white">{name}</p>
      </div>
    </div>
  );
}

function FeeStat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-lg border border-dark-border bg-dark-elevated/30 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={cn("mt-1 text-lg font-bold", valueClass ?? "text-white")}>
        {value}
      </p>
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
