"use client";

import {
  Calendar,
  Clock,
  CheckCircle,
  AlertTriangle,
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
import { useLeaveBalances } from "@/lib/hooks/admin/use-leave";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LeaveTabProps {
  facultyId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LEAVE_TYPE_LABELS: Record<string, string> = {
  casual_leave: "Casual Leave",
  earned_leave: "Earned Leave",
  medical_leave: "Medical Leave",
  study_leave: "Study Leave",
  maternity_leave: "Maternity Leave",
  sabbatical: "Sabbatical",
  duty_leave: "Duty Leave",
  examination_duty: "Examination Duty",
};

const LEAVE_TYPE_COLORS: Record<string, string> = {
  casual_leave: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  earned_leave: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  medical_leave: "bg-red-500/10 text-red-400 border-red-500/20",
  study_leave: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  maternity_leave: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  sabbatical: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  duty_leave: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  examination_duty: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
};

function getBalanceColor(balance: number, entitled: number): string {
  if (entitled === 0) return "text-gray-400";
  const pct = balance / entitled;
  if (pct > 0.5) return "text-emerald-400";
  if (pct > 0.2) return "text-yellow-400";
  return "text-red-400";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LeaveTab({ facultyId }: LeaveTabProps) {
  const { data, isLoading, error } = useLeaveBalances(facultyId);

  const balances = data?.data ?? [];

  // Summary stats
  const totalEntitled = balances.reduce((s, b) => s + b.entitled, 0);
  const totalTaken = balances.reduce((s, b) => s + b.taken, 0);
  const totalPending = balances.reduce((s, b) => s + b.pending, 0);
  const totalBalance = balances.reduce((s, b) => s + b.balance, 0);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
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
          Failed to load leave balances: {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Calendar className="mx-auto h-6 w-6 text-blue-400" />
            <p className="mt-2 text-2xl font-bold text-white">
              {totalEntitled}
            </p>
            <p className="text-xs text-gray-500">Total Entitled</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle className="mx-auto h-6 w-6 text-emerald-400" />
            <p className="mt-2 text-2xl font-bold text-white">
              {totalTaken}
            </p>
            <p className="text-xs text-gray-500">Taken</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="mx-auto h-6 w-6 text-orange-400" />
            <p className="mt-2 text-2xl font-bold text-white">
              {totalPending}
            </p>
            <p className="text-xs text-gray-500">Pending Approval</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <AlertTriangle
              className={cn(
                "mx-auto h-6 w-6",
                totalBalance > totalEntitled * 0.3
                  ? "text-emerald-400"
                  : "text-yellow-400"
              )}
            />
            <p className="mt-2 text-2xl font-bold text-white">
              {totalBalance}
            </p>
            <p className="text-xs text-gray-500">Balance</p>
          </CardContent>
        </Card>
      </div>

      {/* Leave Balances Table */}
      <Card className="overflow-hidden">
        <div className="border-b border-dark-border px-6 py-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-white">
            <Calendar className="h-5 w-5 text-emerald-500" />
            Leave Balances
            {balances.length > 0 && (
              <span className="text-xs font-normal text-gray-500">
                &mdash; {balances[0]?.academic_year}
              </span>
            )}
          </h2>
        </div>

        {balances.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No leave balances found for this faculty member.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-[#262626]/50 text-[11px] uppercase tracking-wider text-gray-500">
                <TableHead className="font-semibold">Leave Type</TableHead>
                <TableHead className="text-center font-semibold">
                  Entitled
                </TableHead>
                <TableHead className="text-center font-semibold">
                  Taken
                </TableHead>
                <TableHead className="text-center font-semibold">
                  Pending
                </TableHead>
                <TableHead className="text-center font-semibold">
                  Balance
                </TableHead>
                <TableHead className="text-center font-semibold">
                  Carried Fwd
                </TableHead>
                <TableHead className="font-semibold">Usage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {balances.map((b) => {
                const usedPct =
                  b.entitled > 0
                    ? Math.round((b.taken / b.entitled) * 100)
                    : 0;
                const color =
                  LEAVE_TYPE_COLORS[b.leave_type] ??
                  "bg-gray-500/10 text-gray-400 border-gray-500/20";

                return (
                  <TableRow
                    key={b.id}
                    className="transition-colors hover:bg-[#262626]/20"
                  >
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium",
                          color
                        )}
                      >
                        {LEAVE_TYPE_LABELS[b.leave_type] ?? b.leave_type}
                      </span>
                    </TableCell>
                    <TableCell className="text-center font-mono text-gray-300">
                      {b.entitled}
                    </TableCell>
                    <TableCell className="text-center font-mono text-gray-300">
                      {b.taken}
                    </TableCell>
                    <TableCell className="text-center font-mono text-orange-400">
                      {b.pending > 0 ? b.pending : "—"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-center font-mono font-bold",
                        getBalanceColor(b.balance, b.entitled)
                      )}
                    >
                      {b.balance}
                    </TableCell>
                    <TableCell className="text-center font-mono text-gray-500">
                      {b.carried_forward > 0 ? b.carried_forward : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 rounded-full bg-[#262626]">
                          <div
                            className={cn(
                              "h-1.5 rounded-full",
                              usedPct > 80
                                ? "bg-red-500"
                                : usedPct > 50
                                  ? "bg-yellow-500"
                                  : "bg-emerald-500"
                            )}
                            style={{ width: `${Math.min(usedPct, 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-500">
                          {usedPct}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
