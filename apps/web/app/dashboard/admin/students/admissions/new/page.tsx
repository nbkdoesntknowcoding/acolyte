"use client";

import { Download } from "lucide-react";
import { AdmissionStepper } from "@/components/admin/admission-stepper";
import { DocumentCard } from "@/components/admin/document-card";
import { DocumentStatusBar } from "@/components/admin/document-status-bar";
import type { AdmissionStep, AdmissionDocument } from "@/types/admin";

// ---------------------------------------------------------------------------
// TODO: Replace with API call — GET /api/v1/admin/admissions/{id}
// ---------------------------------------------------------------------------

const ADMISSION_ID = "ADM-25-092";
const ACADEMIC_YEAR = "2025-26";

const STEPS: AdmissionStep[] = [
  { id: "basic-info", label: "Basic Info", status: "completed" },
  { id: "contact", label: "Contact Details", status: "completed" },
  { id: "documents", label: "Documents", status: "current" },
  { id: "fee-payment", label: "Fee Payment", status: "upcoming" },
  { id: "confirmation", label: "Confirmation", status: "upcoming" },
];

const DOCUMENTS: AdmissionDocument[] = [
  {
    id: "neet-scorecard",
    name: "NEET Scorecard",
    requirement: "required",
    status: "verified",
    fileName: "scorecard_2024.pdf",
    fileSize: "2.4 MB",
    scanResult: "Verified by AI",
  },
  {
    id: "class-12-marksheet",
    name: "Class 12 Marksheet",
    requirement: "required",
    status: "uploaded",
    fileName: "12th_marksheet_final.pdf",
  },
  {
    id: "transfer-certificate",
    name: "Transfer Certificate",
    requirement: "required",
    status: "scan_failed",
    errorMessage: "Image blurry or low resolution. Please re-upload.",
  },
  {
    id: "migration-certificate",
    name: "Migration Certificate",
    requirement: "optional",
    status: "pending",
    uploadHint: "PDF, JPG (Max 5MB)",
  },
  {
    id: "aadhar-card",
    name: "Aadhaar Card",
    requirement: "required",
    status: "pending",
    uploadHint: "Front & Back Side",
  },
  {
    id: "gap-certificate",
    name: "Gap Certificate",
    requirement: "if_applicable",
    status: "pending",
    uploadHint: "Notarized Copy",
  },
];

// ---------------------------------------------------------------------------

export default function NewAdmissionPage() {
  const uploaded = DOCUMENTS.filter(
    (d) => d.status !== "pending",
  ).length;
  const verified = DOCUMENTS.filter(
    (d) => d.status === "verified",
  ).length;
  const pendingReview = DOCUMENTS.filter(
    (d) => d.status === "uploaded",
  ).length;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">
          Admission Form — ID: {ADMISSION_ID}
        </h1>
        <span className="text-sm text-gray-500">
          Academic Year:{" "}
          <strong className="text-emerald-500">{ACADEMIC_YEAR}</strong>
        </span>
      </div>

      {/* Step Progress */}
      <AdmissionStepper steps={STEPS} />

      {/* Documents Section */}
      <div>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">
            Required Documents
          </h2>
          <button className="flex items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-sm font-medium text-emerald-500 transition-colors hover:bg-emerald-500/10">
            <Download className="h-4 w-4" />
            Download Guidelines
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {DOCUMENTS.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              // TODO: Wire to actual upload/preview/scan handlers
              onPreview={(id) => console.log("Preview", id)}
              onRemove={(id) => console.log("Remove", id)}
              onReUpload={(id) => console.log("Re-upload", id)}
              onUpload={(id) => console.log("Upload", id)}
              onAiScan={(id) => console.log("AI Scan", id)}
            />
          ))}
        </div>
      </div>

      {/* Sticky Bottom Action Bar */}
      <DocumentStatusBar
        uploaded={uploaded}
        total={DOCUMENTS.length}
        verified={verified}
        pendingReview={pendingReview}
        // TODO: Wire to router navigation
        onBack={() => console.log("Back to Contact Details")}
        onProceed={() => console.log("Proceed to Fee Payment")}
      />
    </div>
  );
}
