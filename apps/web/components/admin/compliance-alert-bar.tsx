"use client";

import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ComplianceAlertBarProps {
  title: string;
  description: string;
  actionLabel: string;
  onAction?: () => void;
}

export function ComplianceAlertBar({
  title,
  description,
  actionLabel,
  onAction,
}: ComplianceAlertBarProps) {
  return (
    <div className="-mx-8 -mb-8 sticky bottom-0 z-50 border-t border-red-800/50 bg-red-900/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 text-red-200" />
          <div className="flex flex-col gap-0 sm:flex-row sm:items-center sm:gap-2">
            <p className="text-sm font-semibold text-white">{title}</p>
            <span className="hidden text-red-200/50 sm:inline">|</span>
            <p className="text-xs text-red-100 sm:text-sm">{description}</p>
          </div>
        </div>
        <Button
          onClick={onAction}
          className="bg-white text-red-900 shadow hover:bg-gray-100"
          size="sm"
        >
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}
