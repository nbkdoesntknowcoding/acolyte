"use client";

import {
  IndianRupee,
  FileText,
  Download,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { usePayrollRecords } from "@/lib/hooks/admin/use-payroll";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PayrollTabProps {
  facultyId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Backend stores amounts in paisa — convert to rupees for display */
function formatCurrency(paisa: number): string {
  const rupees = paisa / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

const MONTH_NAMES = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  draft: { bg: "bg-gray-500/10", text: "text-gray-400", border: "border-gray-500/20" },
  calculated: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
  approved: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  disbursed: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PayrollTab({ facultyId }: PayrollTabProps) {
  const { data, isLoading, error } = usePayrollRecords({
    faculty_id: facultyId,
    page_size: 12,
  });

  const records = data?.data ?? [];

  // Latest record for summary
  const latest = records.length > 0 ? records[0] : null;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-8 text-center">
        <p className="text-sm text-red-400">
          Failed to load payroll records: {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Latest Payslip Summary */}
      {latest && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-gray-400">
                Gross Earnings
              </p>
              <p className="mt-1 text-2xl font-bold text-white">
                {formatCurrency(latest.gross_earnings)}
              </p>
              <p className="mt-1 text-[10px] text-gray-500">
                {MONTH_NAMES[latest.month]} {latest.year}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-gray-400">
                Total Deductions
              </p>
              <p className="mt-1 text-2xl font-bold text-red-400">
                {formatCurrency(latest.total_deductions)}
              </p>
              <p className="mt-1 text-[10px] text-gray-500">
                EPF + ESI + TDS + PT
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-gray-400">
                Net Pay
              </p>
              <p className="mt-1 text-2xl font-bold text-emerald-400">
                {formatCurrency(latest.net_pay)}
              </p>
              <p className="mt-1 text-[10px] text-gray-500">
                {latest.status === "disbursed" ? "Disbursed" : "Pending"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Payroll Records Table */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-dark-border px-6 py-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-white">
            <IndianRupee className="h-5 w-5 text-emerald-500" />
            Payroll History
          </h2>
        </div>

        {records.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No payroll records found for this faculty member.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-[#262626]/50 text-[11px] uppercase tracking-wider text-gray-500">
                <TableHead className="font-semibold">Period</TableHead>
                <TableHead className="text-right font-semibold">
                  Basic
                </TableHead>
                <TableHead className="text-right font-semibold">DA</TableHead>
                <TableHead className="text-right font-semibold">
                  HRA
                </TableHead>
                <TableHead className="text-right font-semibold">
                  Gross
                </TableHead>
                <TableHead className="text-right font-semibold">
                  Deductions
                </TableHead>
                <TableHead className="text-right font-semibold">
                  Net Pay
                </TableHead>
                <TableHead className="text-center font-semibold">
                  Status
                </TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((rec) => {
                const style =
                  STATUS_STYLES[rec.status] ?? STATUS_STYLES.draft;
                return (
                  <TableRow
                    key={rec.id}
                    className="transition-colors hover:bg-[#262626]/20"
                  >
                    <TableCell className="font-medium text-white">
                      {MONTH_NAMES[rec.month]} {rec.year}
                    </TableCell>
                    <TableCell className="text-right font-mono text-gray-300">
                      {formatCurrency(rec.basic_pay)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-gray-300">
                      {formatCurrency(rec.dearness_allowance)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-gray-300">
                      {formatCurrency(rec.house_rent_allowance)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-white">
                      {formatCurrency(rec.gross_earnings)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-red-400">
                      {formatCurrency(rec.total_deductions)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-emerald-400">
                      {formatCurrency(rec.net_pay)}
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={cn(
                          "inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium uppercase",
                          style.bg,
                          style.text,
                          style.border
                        )}
                      >
                        {rec.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      {rec.pay_slip_url ? (
                        <a
                          href={rec.pay_slip_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-500 transition-colors hover:text-white"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      ) : (
                        <FileText className="h-4 w-4 text-gray-700" />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {/* Pagination info */}
        {data && data.total_pages > 1 && (
          <div className="border-t border-dark-border bg-[#262626]/30 p-3 text-center text-xs text-gray-500">
            Showing {records.length} of {data.total} records
          </div>
        )}
      </Card>
    </div>
  );
}
