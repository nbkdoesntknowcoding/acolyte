"use client";

import { cn } from "@/lib/utils";
import type { AttendanceMonth, AttendanceDayStatus } from "@/types/admin";

interface AttendanceCalendarProps {
  months: AttendanceMonth[];
}

const DAY_COLORS: Record<AttendanceDayStatus, string> = {
  present: "bg-green-600 text-white",
  absent: "bg-red-600 text-white",
  late: "bg-yellow-600 text-white",
  half_day:
    "bg-green-500/20 border border-green-500/50 text-green-300",
  holiday: "bg-gray-800 text-gray-400",
  blank: "bg-transparent",
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function AttendanceCalendar({ months }: AttendanceCalendarProps) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="min-w-[600px]">
        {/* Weekday header */}
        <div className="mb-2 grid grid-cols-7 gap-2 text-center text-xs font-medium text-gray-500">
          {WEEKDAYS.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        <div className="space-y-4">
          {months.map((month) => (
            <div key={`${month.month}-${month.year}`}>
              <p className="mb-2 text-xs font-medium text-gray-400">
                {month.month} {month.year}
              </p>
              <div className="grid grid-cols-7 gap-1">
                {month.days.map((day, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex aspect-square items-center justify-center rounded text-[10px]",
                      DAY_COLORS[day.status],
                    )}
                    title={
                      day.status !== "blank"
                        ? `${day.day} - ${day.status}`
                        : undefined
                    }
                  >
                    {day.status !== "blank" ? day.day : ""}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap justify-center gap-4">
          <LegendItem color="bg-green-600" label="Present" />
          <LegendItem color="bg-red-600" label="Absent" />
          <LegendItem color="bg-yellow-600" label="Late" />
          <LegendItem
            color="bg-green-500/20 border border-green-500/50"
            label="Half Day"
          />
        </div>
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-400">
      <div className={cn("h-3 w-3 rounded", color)} />
      {label}
    </div>
  );
}
