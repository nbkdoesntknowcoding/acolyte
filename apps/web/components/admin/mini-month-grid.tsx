"use client";

import { cn } from "@/lib/utils";
import type { AcademicCalendarDay, AcademicCalendarDayState } from "@/types/admin";

interface MiniMonthGridProps {
  label: string;
  days: AcademicCalendarDay[];
  className?: string;
}

const STATE_CLASSES: Record<AcademicCalendarDayState, string> = {
  normal:
    "bg-[#262626] text-gray-400 hover:bg-gray-700 transition-colors",
  semester_start:
    "bg-blue-500 text-white font-bold",
  semester:
    "bg-blue-500/20 text-blue-400 border border-blue-500/30",
  exam_start:
    "bg-red-500 text-white font-bold",
  exam:
    "bg-red-500/20 text-red-400 border border-red-500/30",
  holiday:
    "bg-gray-600 text-white font-medium",
  nmc:
    "bg-purple-500 text-white font-bold",
  today:
    "bg-emerald-500/20 text-gray-400 ring-1 ring-emerald-500",
};

export function MiniMonthGrid({ label, days, className }: MiniMonthGridProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <h3 className="text-xs font-medium text-gray-500">{label}</h3>
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((cell, i) => (
          <div
            key={i}
            title={cell.tooltip}
            className={cn(
              "flex aspect-square items-center justify-center rounded-sm text-[0.65rem]",
              cell.day === null ? "text-gray-700" : STATE_CLASSES[cell.state],
            )}
          >
            {cell.day ?? ""}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Helper to build a month grid from an offset + special day map.
 * offset = number of empty cells before day 1 (Sun-based week).
 */
export function buildMonthGrid(
  offset: number,
  totalDays: number,
  specials: Record<number, { state: AcademicCalendarDayState; tooltip?: string }> = {},
): AcademicCalendarDay[] {
  const days: AcademicCalendarDay[] = [];
  for (let i = 0; i < offset; i++) {
    days.push({ day: null, state: "normal" });
  }
  for (let d = 1; d <= totalDays; d++) {
    const s = specials[d];
    days.push({
      day: d,
      state: s?.state ?? "normal",
      tooltip: s?.tooltip,
    });
  }
  return days;
}
