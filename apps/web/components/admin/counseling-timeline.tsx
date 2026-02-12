"use client";

import { Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CounselingRound } from "@/types/admin";

interface CounselingTimelineProps {
  rounds: CounselingRound[];
  currentPhase: string;
}

export function CounselingTimeline({
  rounds,
  currentPhase,
}: CounselingTimelineProps) {
  const completedCount = rounds.filter((r) => r.status === "completed").length;
  const progressWidth = `${((completedCount + 0.5) / rounds.length) * 100}%`;

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
            Current Phase:{" "}
            <strong className="text-emerald-500">{currentPhase}</strong>
          </span>
        </div>

        <div className="relative">
          {/* Background track */}
          <div className="absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2 bg-gray-800" />
          {/* Filled track */}
          <div
            className="absolute left-0 top-1/2 h-0.5 -translate-y-1/2 bg-emerald-500/30"
            style={{ width: progressWidth }}
          />

          <div className="relative z-10 flex w-full justify-between">
            {rounds.map((round) => (
              <div
                key={round.id}
                className={cn(
                  "flex cursor-pointer flex-col items-center",
                  round.status === "upcoming" && "opacity-50",
                )}
              >
                {/* Node */}
                {round.status === "completed" && (
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border-4 border-dark-surface bg-emerald-500 shadow-md">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                )}
                {round.status === "in_progress" && (
                  <div className="relative mb-3">
                    <span className="absolute left-1/2 top-1/2 h-full w-full -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-emerald-500/40" />
                    <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-4 border-emerald-500 bg-dark-surface text-emerald-500 shadow-lg shadow-emerald-500/20">
                      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
                    </div>
                  </div>
                )}
                {round.status === "upcoming" && (
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border-4 border-dark-surface bg-dark-elevated text-gray-400">
                    <span className="text-xs font-bold">
                      {rounds.indexOf(round) + 1}
                    </span>
                  </div>
                )}

                {/* Label */}
                <div className="text-center">
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      round.status === "in_progress"
                        ? "font-bold text-emerald-500"
                        : round.status === "completed"
                          ? "text-white"
                          : "text-gray-500",
                    )}
                  >
                    {round.name}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {round.status === "completed"
                      ? "Completed"
                      : round.status === "in_progress"
                        ? "In Progress"
                        : "Upcoming"}
                  </p>
                  {round.admittedCount != null && (
                    <span className="mt-1 inline-block rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-xs text-emerald-500">
                      +{round.admittedCount} Admitted
                    </span>
                  )}
                  {round.processingCount != null && (
                    <span className="mt-1 inline-block rounded bg-yellow-500/10 px-1.5 py-0.5 font-mono text-xs text-yellow-500">
                      ~{round.processingCount} Processing
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
