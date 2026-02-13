"use client";

import { Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CounselingRoundItem } from "@/types/admin-api";

interface CounselingTimelineProps {
  rounds: CounselingRoundItem[];
  total: number;
}

/**
 * Known counseling round display order.
 * Rounds not in this list appear at the end in their original order.
 */
const ROUND_ORDER = [
  "Round 1",
  "Round 2",
  "Round 3",
  "Mop-Up",
  "Stray Vacancy",
  "Special Stray",
];

function sortRounds(rounds: CounselingRoundItem[]): CounselingRoundItem[] {
  return [...rounds]
    .filter((r) => r.counseling_round !== "Not Specified")
    .sort((a, b) => {
      const ia = ROUND_ORDER.indexOf(a.counseling_round);
      const ib = ROUND_ORDER.indexOf(b.counseling_round);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
}

export function CounselingTimeline({
  rounds,
  total,
}: CounselingTimelineProps) {
  const sorted = sortRounds(rounds);
  const filledCount = sorted.filter((r) => r.count > 0).length;
  const progressWidth =
    sorted.length > 0
      ? `${(filledCount / sorted.length) * 100}%`
      : "0%";

  return (
    <Card>
      <CardContent className="flex h-full flex-col justify-center p-6">
        <div className="mb-8 flex items-center justify-between">
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
                d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
              />
            </svg>
            Counseling Schedule
          </h2>
          <span className="text-sm text-gray-500">
            Total Admitted:{" "}
            <strong className="text-emerald-500">{total}</strong>
          </span>
        </div>

        {sorted.length === 0 ? (
          <p className="text-center text-sm text-gray-500">
            No counseling round data available yet.
          </p>
        ) : (
          <div className="relative">
            {/* Background track */}
            <div className="absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2 bg-gray-800" />
            {/* Filled track */}
            <div
              className="absolute left-0 top-1/2 h-0.5 -translate-y-1/2 bg-emerald-500/30"
              style={{ width: progressWidth }}
            />

            <div className="relative z-10 flex w-full justify-between">
              {sorted.map((round, idx) => {
                const hasAdmissions = round.count > 0;
                return (
                  <div
                    key={round.counseling_round}
                    className={cn(
                      "flex flex-col items-center",
                      !hasAdmissions && "opacity-50",
                    )}
                  >
                    {/* Node */}
                    {hasAdmissions ? (
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border-4 border-dark-surface bg-emerald-500 shadow-md">
                        <Check className="h-4 w-4 text-white" />
                      </div>
                    ) : (
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border-4 border-dark-surface bg-dark-elevated text-gray-400">
                        <span className="text-xs font-bold">{idx + 1}</span>
                      </div>
                    )}

                    {/* Label */}
                    <div className="text-center">
                      <p
                        className={cn(
                          "text-sm font-semibold",
                          hasAdmissions ? "text-white" : "text-gray-500",
                        )}
                      >
                        {round.counseling_round}
                      </p>
                      {hasAdmissions && (
                        <span className="mt-1 inline-block rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-xs text-emerald-500">
                          +{round.count} Admitted
                        </span>
                      )}
                      {!hasAdmissions && (
                        <p className="mt-0.5 text-xs text-gray-500">Pending</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
