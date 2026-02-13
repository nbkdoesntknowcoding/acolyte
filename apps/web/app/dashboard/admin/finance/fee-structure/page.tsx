"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import {
  Plus,
  Copy,
  ShieldCheck,
  AlertTriangle,
  FileText,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useFeeStructures,
  useCreateFeeStructure,
  useUpdateFeeStructure,
} from "@/lib/hooks/admin/use-fee-structures";
import type {
  FeeStructureResponse,
  FeeStructureCreate,
  FeeStructureUpdate,
} from "@/types/admin-api";

// ---------------------------------------------------------------------------
// Fee component mapping — backend flat columns → display rows
// ---------------------------------------------------------------------------

type FeeField = keyof FeeStructureResponse;

interface FeeComponentDef {
  field: FeeField;
  label: string;
  isRefundable: boolean;
  isOneTime: boolean;
}

const FEE_COMPONENTS: FeeComponentDef[] = [
  { field: "tuition_fee", label: "Tuition Fee", isRefundable: false, isOneTime: false },
  { field: "development_fee", label: "Development Fee", isRefundable: false, isOneTime: false },
  { field: "hostel_fee_boys", label: "Hostel (Boys)", isRefundable: false, isOneTime: false },
  { field: "hostel_fee_girls", label: "Hostel (Girls)", isRefundable: false, isOneTime: false },
  { field: "hostel_fee", label: "Hostel Fee", isRefundable: false, isOneTime: false },
  { field: "mess_fee", label: "Mess Charges", isRefundable: false, isOneTime: false },
  { field: "examination_fee", label: "Examination Fee", isRefundable: false, isOneTime: false },
  { field: "exam_fee", label: "Exam Fee", isRefundable: false, isOneTime: false },
  { field: "library_fee", label: "Library Fee", isRefundable: false, isOneTime: false },
  { field: "laboratory_fee", label: "Laboratory Fee", isRefundable: false, isOneTime: false },
  { field: "lab_fee", label: "Lab Fee", isRefundable: false, isOneTime: false },
  { field: "caution_deposit", label: "Caution Deposit", isRefundable: true, isOneTime: true },
  { field: "admission_charges", label: "Admission Charges", isRefundable: false, isOneTime: true },
];

const QUOTA_TABS = [
  { value: "AIQ", label: "All India Quota" },
  { value: "State", label: "State Quota" },
  { value: "Management", label: "Management Quota" },
  { value: "NRI", label: "NRI Quota" },
  { value: "Institutional", label: "Institutional Quota" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert paisa to rupees and format as Indian locale */
function formatINR(paisa: number): string {
  const rupees = paisa / 100;
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(rupees);
}

/** Convert rupees input to paisa for backend */
function rupeesToPaisa(rupees: number): number {
  return Math.round(rupees * 100);
}

/** Convert paisa to rupees for input display */
function paisaToRupees(paisa: number): number {
  return paisa / 100;
}

/** Get previous academic year string (e.g., "2025-26" → "2024-25") */
function previousAcademicYear(year: string): string {
  const parts = year.split("-");
  if (parts.length !== 2) return year;
  const startYear = parseInt(parts[0], 10) - 1;
  const endYear = parseInt(parts[1], 10) - 1;
  return `${startYear}-${String(endYear).padStart(2, "0")}`;
}

/** Sum all fee component values from a structure */
function getTotalPaisa(structure: FeeStructureResponse): number {
  return FEE_COMPONENTS.reduce((sum, comp) => {
    const val = structure[comp.field];
    return sum + (typeof val === "number" ? val : 0);
  }, 0);
}

// ---------------------------------------------------------------------------
// Installment config type (matches backend JSONB shape)
// ---------------------------------------------------------------------------

interface InstallmentConfig {
  installment_no: number;
  due_date: string;
  percentage: number;
}

// ---------------------------------------------------------------------------
// Editable Cell
// ---------------------------------------------------------------------------

function EditableAmountCell({
  value,
  onSave,
  disabled,
}: {
  value: number; // paisa
  onSave: (newPaisa: number) => void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(paisaToRupees(value)));
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setDraft(String(paisaToRupees(value)));
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commit = () => {
    setEditing(false);
    const rupees = parseFloat(draft) || 0;
    const newPaisa = rupeesToPaisa(rupees);
    if (newPaisa !== value) {
      onSave(newPaisa);
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={startEdit}
        disabled={disabled}
        className="w-full text-right font-mono text-sm text-gray-300 hover:text-white transition-colors cursor-text disabled:cursor-default"
      >
        {formatINR(value)}
      </button>
    );
  }

  return (
    <Input
      ref={inputRef}
      type="number"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setEditing(false);
      }}
      className="h-7 text-xs text-right bg-dark-elevated border-dark-border text-white w-full"
    />
  );
}

// ---------------------------------------------------------------------------
// Quota Tab Content
// ---------------------------------------------------------------------------

function QuotaContent({
  structure,
  academicYear,
  quota,
}: {
  structure: FeeStructureResponse | undefined;
  academicYear: string;
  quota: string;
}) {
  const updateMutation = useUpdateFeeStructure();
  const createMutation = useCreateFeeStructure();

  const handleFieldUpdate = useCallback(
    (field: FeeField, newPaisa: number) => {
      if (!structure) return;
      updateMutation.mutate({
        id: structure.id,
        data: { [field]: newPaisa } as FeeStructureUpdate,
      });
    },
    [structure, updateMutation]
  );

  const handleCreateStructure = () => {
    createMutation.mutate({
      academic_year: academicYear,
      quota,
      tuition_fee: 0,
    });
  };

  // No structure for this quota yet
  if (!structure) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-dark-border p-12">
        <p className="mb-4 text-sm text-gray-400">
          No fee structure defined for {quota} ({academicYear})
        </p>
        <Button onClick={handleCreateStructure} disabled={createMutation.isPending}>
          {createMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          Create Fee Structure
        </Button>
      </div>
    );
  }

  // Only show components with non-zero values, plus always show tuition
  const displayComponents = FEE_COMPONENTS.filter((comp) => {
    if (comp.field === "tuition_fee") return true;
    const val = structure[comp.field];
    return typeof val === "number" && val > 0;
  });

  const totalPaisa = getTotalPaisa(structure);
  const isSaving = updateMutation.isPending;

  // Regulatory compliance
  const cap = structure.fee_regulatory_cap;
  const tuitionPaisa = structure.tuition_fee ?? 0;
  const isWithinCap = cap == null || tuitionPaisa <= cap;
  const capUsagePct = cap && cap > 0 ? Math.min((tuitionPaisa / cap) * 100, 100) : 0;
  const bufferPaisa = cap != null ? cap - tuitionPaisa : 0;

  // Installment config
  const installments: InstallmentConfig[] = Array.isArray(structure.installment_config)
    ? (structure.installment_config as InstallmentConfig[])
    : [];

  // Structure summary groups
  const tuitionAndAcademics =
    (structure.tuition_fee ?? 0) +
    (structure.development_fee ?? 0) +
    (structure.examination_fee ?? 0) +
    (structure.exam_fee ?? 0) +
    (structure.library_fee ?? 0) +
    (structure.laboratory_fee ?? 0) +
    (structure.lab_fee ?? 0);
  const hostelAndMess =
    (structure.hostel_fee_boys ?? 0) +
    (structure.hostel_fee_girls ?? 0) +
    (structure.hostel_fee ?? 0) +
    (structure.mess_fee ?? 0);
  const oneTimeRefundable =
    (structure.caution_deposit ?? 0) + (structure.admission_charges ?? 0);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left Column: Tables */}
      <div className="space-y-6 lg:col-span-2">
        {/* Fee Components Breakdown */}
        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-dark-border p-4">
            <CardTitle className="text-base">
              Fee Components Breakdown
              {isSaving && (
                <Loader2 className="ml-2 inline h-4 w-4 animate-spin text-gray-400" />
              )}
            </CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-dark-border bg-dark-elevated/50 hover:bg-dark-elevated/50">
                  <TableHead className="min-w-[180px] px-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Component Name
                  </TableHead>
                  <TableHead className="w-32 px-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Amount (₹)
                  </TableHead>
                  <TableHead className="px-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Refundable
                  </TableHead>
                  <TableHead className="px-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-400">
                    One-Time
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayComponents.map((comp) => {
                  const val = (structure[comp.field] as number | null) ?? 0;
                  return (
                    <TableRow
                      key={comp.field}
                      className="border-dark-border hover:bg-dark-elevated/20"
                    >
                      <TableCell className="px-4 py-3 font-medium text-white">
                        {comp.label}
                      </TableCell>
                      <TableCell className="px-2 py-2 text-right">
                        <EditableAmountCell
                          value={val}
                          onSave={(newPaisa) => handleFieldUpdate(comp.field, newPaisa)}
                        />
                      </TableCell>
                      <TableCell className="px-4 py-3 text-center">
                        {comp.isRefundable ? (
                          <CheckCircle className="mx-auto h-4 w-4 text-emerald-500" />
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-center">
                        {comp.isOneTime ? (
                          <CheckCircle className="mx-auto h-4 w-4 text-emerald-500" />
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow className="border-t border-dark-border bg-dark-elevated/30 hover:bg-dark-elevated/30">
                  <TableCell className="px-4 py-3 font-semibold text-white">
                    TOTAL
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right text-lg font-semibold text-emerald-400">
                    ₹{formatINR(totalPaisa)}
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </Card>

        {/* Installment Plan */}
        {installments.length > 0 && (
          <Card className="overflow-hidden">
            <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-dark-border bg-dark-elevated/20 p-4">
              <CardTitle className="text-base">
                Installment Plan Configuration
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-dark-border hover:bg-transparent">
                    <TableHead className="w-16 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                      No.
                    </TableHead>
                    <TableHead className="px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Due Date
                    </TableHead>
                    <TableHead className="w-24 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                      % Split
                    </TableHead>
                    <TableHead className="px-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Amount (₹)
                    </TableHead>
                    <TableHead className="w-32 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Late Fee / Day
                    </TableHead>
                    <TableHead className="w-32 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Grace Period
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {installments.map((inst) => {
                    const amount = Math.round((totalPaisa * inst.percentage) / 100);
                    return (
                      <TableRow
                        key={inst.installment_no}
                        className="border-dark-border hover:bg-dark-elevated/20"
                      >
                        <TableCell className="px-3 py-3 text-gray-400">
                          {inst.installment_no}
                        </TableCell>
                        <TableCell className="px-3 py-3 text-sm text-gray-300">
                          {inst.due_date}
                        </TableCell>
                        <TableCell className="px-3 py-3 text-sm text-gray-300">
                          {inst.percentage}%
                        </TableCell>
                        <TableCell className="px-3 py-3 text-right font-mono text-gray-300">
                          ₹{formatINR(amount)}
                        </TableCell>
                        <TableCell className="px-3 py-3 text-sm text-gray-400">
                          {structure.late_fee_per_day != null
                            ? `₹${formatINR(structure.late_fee_per_day)}`
                            : "—"}
                        </TableCell>
                        <TableCell className="px-3 py-3 text-sm text-gray-400">
                          {structure.grace_period_days != null
                            ? `${structure.grace_period_days} Days`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </div>

      {/* Right Column: Compliance + Summary */}
      <div className="space-y-6 lg:col-span-1">
        {/* Regulatory Compliance */}
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-start justify-between">
              <h3 className="text-base font-semibold text-white">
                Regulatory Compliance
              </h3>
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="space-y-4">
              {cap != null ? (
                <>
                  <div className="rounded-lg border border-dark-border bg-dark-elevated/50 p-3">
                    <div className="mb-2 flex items-end justify-between">
                      <div>
                        <p className="text-xs text-gray-400">Maximum Cap (Tuition)</p>
                        <p className="text-lg font-bold text-white">₹{formatINR(cap)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Current Tuition</p>
                        <p className={`text-lg font-bold ${isWithinCap ? "text-emerald-400" : "text-red-400"}`}>
                          ₹{formatINR(tuitionPaisa)}
                        </p>
                      </div>
                    </div>
                    <div className="mb-2 h-1.5 w-full rounded-full bg-gray-700">
                      <div
                        className={`h-1.5 rounded-full ${isWithinCap ? "bg-emerald-500" : "bg-red-500"}`}
                        style={{ width: `${capUsagePct}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge
                        className={`rounded px-1.5 py-0.5 text-[10px] ${
                          isWithinCap
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-red-500/10 text-red-400 border-red-500/20"
                        }`}
                      >
                        {isWithinCap ? "Within Cap" : "Exceeds Cap"}
                      </Badge>
                      {isWithinCap && bufferPaisa > 0 && (
                        <span className="text-[10px] text-gray-500">
                          (₹{formatINR(bufferPaisa)} remaining buffer)
                        </span>
                      )}
                    </div>
                  </div>

                  {isWithinCap && capUsagePct > 95 && (
                    <div className="flex items-start gap-3 rounded-lg border border-yellow-500/10 bg-yellow-500/5 p-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
                      <div>
                        <p className="mb-0.5 text-xs font-medium text-yellow-300">Near Cap Limit</p>
                        <p className="text-[11px] leading-tight text-yellow-400/80">
                          Tuition fee is within 5% of regulatory cap. Any increase may require FRC approval.
                        </p>
                      </div>
                    </div>
                  )}

                  {!isWithinCap && (
                    <div className="flex items-start gap-3 rounded-lg border border-red-500/10 bg-red-500/5 p-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                      <div>
                        <p className="mb-0.5 text-xs font-medium text-red-300">Exceeds Regulatory Cap</p>
                        <p className="text-[11px] leading-tight text-red-400/80">
                          Tuition fee exceeds the FRC cap by ₹{formatINR(Math.abs(bufferPaisa))}. Reduce tuition or obtain special approval.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-lg border border-dark-border bg-dark-elevated/50 p-4 text-center">
                  <p className="text-xs text-gray-500">No regulatory cap configured for this structure.</p>
                  <p className="mt-1 text-[10px] text-gray-600">
                    Set fee_regulatory_cap on the structure to enable compliance tracking.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Structure Summary */}
        <Card>
          <CardContent className="p-6">
            <h3 className="mb-4 text-base font-semibold text-white">Structure Summary</h3>
            <div className="space-y-3 text-sm">
              {tuitionAndAcademics > 0 && (
                <div className="flex items-center justify-between border-b border-dashed border-dark-border py-2">
                  <span className="text-gray-400">Tuition & Academics</span>
                  <span className="font-medium text-white">₹{formatINR(tuitionAndAcademics)}</span>
                </div>
              )}
              {hostelAndMess > 0 && (
                <div className="flex items-center justify-between border-b border-dashed border-dark-border py-2">
                  <span className="text-gray-400">Hostel & Mess</span>
                  <span className="font-medium text-white">₹{formatINR(hostelAndMess)}</span>
                </div>
              )}
              {oneTimeRefundable > 0 && (
                <div className="flex items-center justify-between border-b border-dashed border-dark-border py-2">
                  <span className="text-gray-400">One-Time / Refundable</span>
                  <span className="font-medium text-white">₹{formatINR(oneTimeRefundable)}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-2">
                <span className="font-semibold text-gray-200">Grand Total</span>
                <span className="text-lg font-bold text-emerald-400">₹{formatINR(totalPaisa)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status */}
        <Card>
          <CardContent className="p-6">
            <h3 className="mb-3 text-sm font-semibold text-gray-400">Status</h3>
            <div className="flex items-center gap-2">
              <div
                className={`h-2.5 w-2.5 rounded-full ${structure.is_active ? "bg-emerald-500" : "bg-yellow-500"}`}
              />
              <span className="text-sm font-medium text-white">
                {structure.is_active ? "Published" : "Draft"}
              </span>
            </div>
            {structure.approved_by && (
              <p className="mt-2 text-[10px] text-gray-500">Approved by: {structure.approved_by}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Copy From Previous Year button
// ---------------------------------------------------------------------------

function CopyFromPreviousYear({
  academicYear,
  existingQuotas,
}: {
  academicYear: string;
  existingQuotas: string[];
}) {
  const prevYear = previousAcademicYear(academicYear);
  const { data: prevData } = useFeeStructures({ academic_year: prevYear, page_size: 25 });
  const createMutation = useCreateFeeStructure();
  const [copying, setCopying] = useState(false);

  const prevStructures = prevData?.data ?? [];
  const copiable = prevStructures.filter((s) => !existingQuotas.includes(s.quota));

  const handleCopy = async () => {
    if (copiable.length === 0) return;
    setCopying(true);
    for (const s of copiable) {
      const payload: Record<string, unknown> = {
        academic_year: academicYear,
        quota: s.quota,
      };
      for (const comp of FEE_COMPONENTS) {
        const val = s[comp.field];
        if (typeof val === "number" && val > 0) {
          payload[comp.field] = val;
        }
      }
      if (s.fee_regulatory_cap != null) payload.fee_regulatory_cap = s.fee_regulatory_cap;
      if (s.installment_config != null) payload.installment_config = s.installment_config;
      if (s.late_fee_per_day != null) payload.late_fee_per_day = s.late_fee_per_day;
      if (s.grace_period_days != null) payload.grace_period_days = s.grace_period_days;

      createMutation.mutate(payload as unknown as FeeStructureCreate);
    }
    setCopying(false);
  };

  return (
    <Button
      variant="outline"
      onClick={handleCopy}
      disabled={copiable.length === 0 || copying || createMutation.isPending}
    >
      {copying || createMutation.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
      Copy from {prevYear}
      {copiable.length > 0 && (
        <span className="ml-1 text-gray-400">({copiable.length})</span>
      )}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FeeStructurePage() {
  const [academicYear, setAcademicYear] = useState("2025-26");
  const [activeQuota, setActiveQuota] = useState("State");

  const { data, isLoading, error } = useFeeStructures({
    academic_year: academicYear,
    page_size: 25,
  });

  const updateMutation = useUpdateFeeStructure();

  // Group structures by quota
  const structuresByQuota = useMemo(() => {
    const map: Record<string, FeeStructureResponse> = {};
    for (const s of data?.data ?? []) {
      map[s.quota] = s;
    }
    return map;
  }, [data]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-white">Fee Structure</h1>
          <div className="flex items-center gap-2 rounded-lg border border-dark-border bg-dark-elevated px-3 py-1.5">
            <span className="text-sm text-gray-400">Academic Year:</span>
            <Select value={academicYear} onValueChange={setAcademicYear}>
              <SelectTrigger className="h-auto w-auto gap-1 border-none bg-transparent p-0 text-sm font-medium text-white shadow-none focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2025-26">2025-26</SelectItem>
                <SelectItem value="2024-25">2024-25</SelectItem>
                <SelectItem value="2023-24">2023-24</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <CopyFromPreviousYear
          academicYear={academicYear}
          existingQuotas={Object.keys(structuresByQuota)}
        />
      </div>

      {/* Loading / Error */}
      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-8 text-center">
          <p className="text-sm text-red-400">
            Failed to load fee structures: {error.message}
          </p>
        </div>
      )}

      {/* Quota Tabs */}
      {!isLoading && !error && (
        <Tabs value={activeQuota} onValueChange={setActiveQuota}>
          <TabsList className="h-auto w-full justify-start gap-6 rounded-none border-b border-dark-border bg-transparent p-0">
            {QUOTA_TABS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="rounded-none border-b-2 border-transparent px-1 py-4 text-sm font-medium text-gray-400 shadow-none hover:text-gray-200 data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent data-[state=active]:text-emerald-500 data-[state=active]:shadow-none"
              >
                {tab.label}
                {structuresByQuota[tab.value] && (
                  <span className="ml-2 inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {QUOTA_TABS.map((tab) => (
            <TabsContent key={tab.value} value={tab.value} className="mt-6">
              <QuotaContent
                structure={structuresByQuota[tab.value]}
                academicYear={academicYear}
                quota={tab.value}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Footer Actions */}
      {!isLoading && structuresByQuota[activeQuota] && (
        <div className="flex items-center justify-end gap-3 border-t border-dark-border pt-6">
          <Button variant="outline">
            <FileText className="h-4 w-4" /> Export for FRC Submission
          </Button>
          {!structuresByQuota[activeQuota]?.is_active && (
            <Button
              className="px-6 shadow-lg shadow-emerald-500/20"
              onClick={() => {
                const s = structuresByQuota[activeQuota];
                if (s) {
                  updateMutation.mutate({ id: s.id, data: { is_active: true } });
                }
              }}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Publish Fee Structure
            </Button>
          )}
          {structuresByQuota[activeQuota]?.is_active && (
            <Badge className="rounded bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-400 border-emerald-500/20">
              <CheckCircle className="mr-1.5 h-3 w-3" /> Published
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
