"use client";

import { Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AdmissionStep } from "@/types/admin";

interface AdmissionStepperProps {
  steps: AdmissionStep[];
}

export function AdmissionStepper({ steps }: AdmissionStepperProps) {
  const currentIndex = steps.findIndex((s) => s.status === "current");
  const progressPct =
    currentIndex >= 0
      ? ((currentIndex + 0.5) / (steps.length - 1)) * 100
      : 100;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="relative flex items-center justify-between">
          {/* Background track */}
          <div className="absolute left-0 top-1/2 h-1 w-full -translate-y-1/2 bg-gray-800" />
          {/* Filled track */}
          <div
            className="absolute left-0 top-1/2 h-1 -translate-y-1/2 bg-emerald-500 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />

          {steps.map((step) => (
            <div
              key={step.id}
              className={cn(
                "relative z-10 flex flex-col items-center",
                step.status === "upcoming" && "cursor-not-allowed opacity-50",
                step.status === "completed" && "cursor-pointer",
              )}
            >
              {/* Node */}
              {step.status === "completed" && (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-white shadow ring-4 ring-dark-surface">
                  <Check className="h-4 w-4" />
                </div>
              )}
              {step.status === "current" && (
                <div className="flex h-10 w-10 scale-110 items-center justify-center rounded-full bg-emerald-500 font-bold text-white shadow-lg ring-4 ring-dark-surface transition-transform">
                  {steps.indexOf(step) + 1}
                </div>
              )}
              {step.status === "upcoming" && (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-dark-elevated text-sm font-bold text-gray-500 shadow ring-4 ring-dark-surface">
                  {steps.indexOf(step) + 1}
                </div>
              )}

              {/* Label */}
              <span
                className={cn(
                  "absolute w-32 text-center",
                  step.status === "current"
                    ? "top-12 mt-1 text-sm font-bold text-white"
                    : "top-10 text-xs font-medium",
                  step.status === "completed" && "text-emerald-500",
                  step.status === "upcoming" && "text-gray-500",
                )}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>
        {/* Spacer for labels below the track */}
        <div className="mt-10" />
      </CardContent>
    </Card>
  );
}
