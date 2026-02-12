"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeaveCalendarDay, LeaveCalendarEvent } from "@/types/admin";

interface LeaveCalendarProps {
  month: string;
  year: number;
  days: LeaveCalendarDay[];
  legend: { code: string; label: string; color: string }[];
  onPrev?: () => void;
  onNext?: () => void;
}

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export function LeaveCalendar({
  month,
  year,
  days,
  legend,
  onPrev,
  onNext,
}: LeaveCalendarProps) {
  return (
    <div className="rounded-xl border border-dark-border bg-dark-surface p-5 shadow-sm">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-white">
            {month} {year}
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={onPrev}
              className="rounded p-1 text-gray-400 hover:bg-[#262626]"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={onNext}
              className="rounded p-1 text-gray-400 hover:bg-[#262626]"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="flex gap-4 text-xs">
          {legend.map((item) => (
            <span key={item.code} className="flex items-center gap-1 text-gray-300">
              <span className={cn("h-2 w-2 rounded-full", item.color)} />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-dark-border bg-dark-border">
        {/* Weekday headers */}
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="bg-[#262626]/50 p-2 text-center text-xs font-semibold text-gray-400"
          >
            {d}
          </div>
        ))}

        {/* Day cells */}
        {days.map((cell, i) => (
          <div
            key={i}
            className={cn(
              "min-h-[100px] bg-dark-surface p-2",
              cell.isToday && "bg-[#262626]/20",
            )}
          >
            <div className="flex items-center gap-1">
              <span
                className={cn(
                  "text-sm",
                  cell.day === null
                    ? "text-transparent"
                    : cell.isCurrentMonth
                      ? "font-medium text-gray-300"
                      : "text-gray-600",
                )}
              >
                {cell.day ?? ""}
              </span>
              {cell.isToday && (
                <span className="text-[10px] text-gray-500">Today</span>
              )}
            </div>
            {cell.events.map((evt, j) => (
              <EventChip key={j} event={evt} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function EventChip({ event }: { event: LeaveCalendarEvent }) {
  return (
    <div
      className={cn(
        "mt-1 truncate rounded border px-1.5 py-0.5 text-[10px]",
        event.color,
      )}
    >
      {event.label}
    </div>
  );
}
