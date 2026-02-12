"use client";

import {
  CheckCircle,
  CloudUpload,
  AlertCircle,
  Upload,
  FileText,
  X,
  Clock,
  ScanLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AdmissionDocument } from "@/types/admin";

interface DocumentCardProps {
  document: AdmissionDocument;
  onPreview?: (id: string) => void;
  onRemove?: (id: string) => void;
  onReUpload?: (id: string) => void;
  onUpload?: (id: string) => void;
  onAiScan?: (id: string) => void;
}

const REQUIREMENT_STYLES: Record<
  AdmissionDocument["requirement"],
  { label: string; className: string }
> = {
  required: {
    label: "Required",
    className:
      "text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-300",
  },
  optional: {
    label: "Optional",
    className:
      "text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400",
  },
  if_applicable: {
    label: "If Applicable",
    className:
      "text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400",
  },
};

export function DocumentCard({
  document: doc,
  onPreview,
  onRemove,
  onReUpload,
  onUpload,
  onAiScan,
}: DocumentCardProps) {
  const reqStyle = REQUIREMENT_STYLES[doc.requirement];

  return (
    <div
      className={cn(
        "relative rounded-xl border p-5 shadow-sm transition-colors",
        "bg-white dark:bg-dark-surface",
        doc.status === "scan_failed"
          ? "border-red-300 dark:border-red-900"
          : doc.status === "pending"
            ? "border-dashed border-dark-border hover:border-emerald-500"
            : "border-gray-200 dark:border-dark-border hover:border-emerald-500/50",
        "group",
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold text-white">{doc.name}</h3>
          <span
            className={cn(
              "mt-1 inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
              reqStyle.className,
            )}
          >
            {reqStyle.label}
          </span>
        </div>
        <StatusIcon status={doc.status} />
      </div>

      {/* Body — varies by status */}
      {doc.status === "verified" && (
        <VerifiedBody
          fileName={doc.fileName}
          fileSize={doc.fileSize}
          scanResult={doc.scanResult}
        />
      )}
      {doc.status === "uploaded" && (
        <UploadedBody
          fileName={doc.fileName}
          onAiScan={onAiScan ? () => onAiScan(doc.id) : undefined}
        />
      )}
      {doc.status === "scan_failed" && (
        <FailedBody errorMessage={doc.errorMessage} />
      )}
      {doc.status === "pending" && (
        <PendingBody
          uploadHint={doc.uploadHint}
          onUpload={onUpload ? () => onUpload(doc.id) : undefined}
        />
      )}

      {/* Footer actions — varies by status */}
      {doc.status === "verified" && (
        <div className="mt-4 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
            onClick={() => onPreview?.(doc.id)}
          >
            Preview
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 border-red-900/30 bg-red-900/20 text-xs text-red-500 hover:bg-red-900/40"
            onClick={() => onRemove?.(doc.id)}
          >
            Remove
          </Button>
        </div>
      )}
      {doc.status === "uploaded" && (
        <div className="mt-4">
          <div className="mb-2 h-1.5 w-full rounded-full bg-gray-700">
            <div className="h-1.5 w-full rounded-full bg-blue-500" />
          </div>
          <div className="flex justify-between text-[10px] text-gray-500">
            <span>Upload Complete</span>
            <span className="font-medium text-blue-500">Ready for Scan</span>
          </div>
        </div>
      )}
      {doc.status === "scan_failed" && (
        <div className="mt-4">
          <Button
            size="sm"
            className="w-full text-xs"
            onClick={() => onReUpload?.(doc.id)}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Re-upload
          </Button>
        </div>
      )}
      {doc.status === "pending" && (
        <div className="mt-4 opacity-50 transition-opacity group-hover:opacity-100">
          <div className="h-1.5 w-full rounded-full bg-gray-700" />
        </div>
      )}
    </div>
  );
}

/* ---- Sub-components ---- */

function StatusIcon({ status }: { status: AdmissionDocument["status"] }) {
  if (status === "verified") {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-900/30 text-green-400">
        <CheckCircle className="h-5 w-5" />
      </div>
    );
  }
  if (status === "uploaded") {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-900/30 text-blue-400">
        <CloudUpload className="h-5 w-5" />
      </div>
    );
  }
  if (status === "scan_failed") {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-900/30 text-red-400">
        <X className="h-5 w-5" />
      </div>
    );
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-800 text-gray-400">
      <Clock className="h-5 w-5" />
    </div>
  );
}

function VerifiedBody({
  fileName,
  fileSize,
  scanResult,
}: {
  fileName?: string;
  fileSize?: string;
  scanResult?: string;
}) {
  return (
    <div className="relative h-32 overflow-hidden rounded-lg border border-dashed border-gray-700 bg-dark-elevated/50">
      <div className="absolute inset-0 flex items-center justify-center bg-green-900/10 backdrop-blur-[1px]">
        <div className="text-center">
          <FileText className="mx-auto mb-1 h-8 w-8 text-green-500" />
          <p className="text-xs font-medium text-green-400">
            {scanResult ?? "Verified by AI"}
          </p>
          {fileName && (
            <p className="text-[10px] text-gray-500">
              {fileName}
              {fileSize && ` (${fileSize})`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function UploadedBody({
  fileName,
  onAiScan,
}: {
  fileName?: string;
  onAiScan?: () => void;
}) {
  return (
    <div className="relative flex h-32 flex-col items-center justify-center rounded-lg border border-gray-700 bg-dark-elevated/50">
      <FileText className="mb-2 h-8 w-8 text-blue-500" />
      {fileName && (
        <p className="w-3/4 truncate text-center text-xs text-gray-400">
          {fileName}
        </p>
      )}
      {onAiScan && (
        <button
          onClick={onAiScan}
          className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-indigo-600 px-2 py-1 text-[10px] font-bold text-white shadow-lg shadow-indigo-500/30 transition-all hover:bg-indigo-700"
        >
          <ScanLine className="h-3.5 w-3.5" />
          AI Scan
        </button>
      )}
    </div>
  );
}

function FailedBody({ errorMessage }: { errorMessage?: string }) {
  return (
    <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-red-800 bg-red-900/10 p-2 text-center">
      <AlertCircle className="mb-1 h-8 w-8 text-red-500" />
      <p className="text-xs font-semibold text-red-400">Scan Failed</p>
      {errorMessage && (
        <p className="mt-1 text-[10px] text-red-500">{errorMessage}</p>
      )}
    </div>
  );
}

function PendingBody({
  uploadHint,
  onUpload,
}: {
  uploadHint?: string;
  onUpload?: () => void;
}) {
  return (
    <div
      onClick={onUpload}
      className="flex h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-700 bg-dark-elevated/30 transition-all hover:border-emerald-500 group-hover:bg-emerald-500/5"
    >
      <CloudUpload className="mb-2 h-6 w-6 text-gray-400 transition-colors group-hover:text-emerald-500" />
      <p className="text-xs font-medium text-gray-500 transition-colors group-hover:text-emerald-500">
        Drag &amp; Drop or Click
      </p>
      <p className="mt-1 text-[10px] text-gray-400">
        {uploadHint ?? "PDF, JPG (Max 5MB)"}
      </p>
    </div>
  );
}
