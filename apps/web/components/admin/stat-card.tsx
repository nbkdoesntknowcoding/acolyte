"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  iconBg?: string;
  trend?: {
    value: string;
    positive: boolean;
  };
  /** Adds a subtle gradient overlay on the right side */
  highlight?: boolean;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  iconBg = "bg-emerald-500/10",
  trend,
  highlight = false,
}: StatCardProps) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all hover:border-emerald-500/30",
        highlight && "group",
      )}
    >
      {highlight && (
        <div className="absolute bottom-0 right-0 top-0 w-16 bg-gradient-to-l from-emerald-500/5 to-transparent" />
      )}
      <CardContent className="flex h-28 flex-col justify-between p-4">
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              {title}
            </p>
            <h3 className="mt-1 text-2xl font-bold text-white">{value}</h3>
          </div>
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded",
              iconBg,
            )}
          >
            {icon}
          </div>
        </div>
        {trend && (
          <div className="relative z-10 mt-2 flex items-center gap-2">
            <span
              className={cn(
                "flex items-center text-xs font-medium",
                trend.positive ? "text-emerald-500" : "text-red-400",
              )}
            >
              {trend.positive ? "↑" : "↓"} {trend.value}
            </span>
            <span className="text-[10px] text-gray-400">{subtitle}</span>
          </div>
        )}
        {!trend && (
          <p className="relative z-10 mt-2 text-[10px] text-gray-400">
            {subtitle}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
