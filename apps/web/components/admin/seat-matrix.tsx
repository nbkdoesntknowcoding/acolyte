"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SeatMatrixItem } from "@/types/admin-api";

/** Derive color from fill percentage */
function getColor(pct: number): "emerald" | "yellow" | "red" {
  if (pct >= 80) return "emerald";
  if (pct >= 50) return "yellow";
  return "red";
}

const PROGRESS_COLORS = {
  emerald: "bg-emerald-500",
  yellow: "bg-yellow-500",
  red: "bg-red-500",
} as const;

const TEXT_COLORS = {
  emerald: "text-emerald-500",
  yellow: "text-yellow-500",
  red: "text-red-500",
} as const;

/** Friendly label for quota codes */
const QUOTA_LABELS: Record<string, string> = {
  AIQ: "AIQ (15%)",
  State: "State Quota",
  Management: "Management",
  NRI: "NRI",
  Institutional: "Institutional",
};

interface SeatMatrixProps {
  quotas: SeatMatrixItem[];
}

export function SeatMatrix({ quotas }: SeatMatrixProps) {
  const totalSanctioned = quotas.reduce((s, q) => s + q.total_seats, 0);
  const totalFilled = quotas.reduce((s, q) => s + q.filled_seats, 0);
  const totalVacant = quotas.reduce((s, q) => s + q.vacant_seats, 0);

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-dark-border bg-dark-elevated/30 px-5 py-4">
        <h2 className="flex items-center gap-2 font-semibold text-white">
          <svg
            className="h-5 w-5 text-emerald-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
            />
          </svg>
          Seat Matrix
        </h2>
        <Badge variant="default" className="text-[10px]">
          Live Updates
        </Badge>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-dark-border bg-dark-elevated/50 text-[10px] uppercase text-gray-500">
            <tr>
              <th className="px-5 py-3 font-medium">Quota</th>
              <th className="px-4 py-3 text-right font-medium">Sanct.</th>
              <th className="px-4 py-3 text-right font-medium">Filled</th>
              <th className="px-4 py-3 text-right font-medium">Vacant</th>
              <th className="w-1/4 px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-border">
            {quotas.map((q) => {
              const color = getColor(q.fill_percentage);
              return (
                <tr
                  key={q.quota}
                  className="transition-colors hover:bg-dark-elevated/30"
                >
                  <td className="px-5 py-3 font-medium text-white">
                    {QUOTA_LABELS[q.quota] ?? q.quota}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    {q.total_seats}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right font-semibold",
                      TEXT_COLORS[color],
                    )}
                  >
                    {q.filled_seats}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right",
                      q.vacant_seats > 10
                        ? "font-semibold text-white"
                        : "text-gray-400",
                    )}
                  >
                    {q.vacant_seats}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-full rounded-full bg-gray-700">
                        <div
                          className={cn(
                            "h-1.5 rounded-full",
                            PROGRESS_COLORS[color],
                          )}
                          style={{ width: `${q.fill_percentage}%` }}
                        />
                      </div>
                      <span
                        className={cn(
                          "text-xs font-medium",
                          TEXT_COLORS[color],
                        )}
                      >
                        {q.fill_percentage}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t border-dark-border bg-dark-elevated/50">
            <tr>
              <td className="px-5 py-3" colSpan={5}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-500">
                    Total Summary
                  </span>
                  <div className="flex gap-4">
                    <span className="text-gray-400">
                      {totalSanctioned}{" "}
                      <span className="ml-1 text-xs">Sanctioned</span>
                    </span>
                    <span className="font-bold text-emerald-500">
                      {totalFilled}{" "}
                      <span className="ml-1 text-xs font-normal">Filled</span>
                    </span>
                    <span className="font-bold text-red-400">
                      {totalVacant}{" "}
                      <span className="ml-1 text-xs font-normal">Vacant</span>
                    </span>
                  </div>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}
