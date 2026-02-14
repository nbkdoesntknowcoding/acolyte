"use client";

import { Check, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DocumentStatusBarProps {
  uploaded: number;
  total: number;
  verified: number;
  pendingReview: number;
  onBack?: () => void;
  onProceed?: () => void;
}

export function DocumentStatusBar({
  uploaded,
  total,
  verified,
  pendingReview,
  onBack,
  onProceed,
}: DocumentStatusBarProps) {
  const remaining = total - uploaded;

  return (
    <div className="-mx-8 -mb-8 sticky bottom-0 z-50 border-t border-dark-border bg-dark-surface">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-4 px-6 py-4 sm:flex-row">
        {/* Left — status summary */}
        <div className="flex w-full items-center gap-4 rounded-lg border border-gray-700 bg-dark-elevated px-4 py-2 sm:w-auto">
          <div className="flex -space-x-2">
            <div
              className="z-30 flex h-8 w-8 items-center justify-center rounded-full border-2 border-dark-surface bg-green-500"
              title="Verified"
            >
              <Check className="h-3.5 w-3.5 text-white" />
            </div>
            <div
              className="z-20 flex h-8 w-8 items-center justify-center rounded-full border-2 border-dark-surface bg-yellow-500"
              title="Pending"
            >
              <Clock className="h-3.5 w-3.5 text-white" />
            </div>
            {remaining > 0 && (
              <div
                className="z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-dark-surface bg-gray-600"
                title="Remaining"
              >
                <span className="text-[10px] font-bold text-gray-300">
                  +{remaining}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col">
            <p className="text-sm font-semibold text-white">Document Status</p>
            <p className="text-xs text-gray-400">
              {uploaded}/{total} uploaded, {verified} verified, {pendingReview}{" "}
              pending review
            </p>
          </div>
        </div>

        {/* Right — actions */}
        <div className="flex w-full items-center justify-end gap-3 sm:w-auto">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button onClick={onProceed}>
            Proceed to Payment
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
