"use client";

import { useState } from "react";
import {
  Search,
  FolderOpen,
  Folder,
  CornerDownRight,
  Upload,
  Filter,
  LayoutGrid,
  MoreVertical,
  FileText,
  FileType2,
  Check,
  X,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  DocumentFolder,
  DocumentRow,
  InspectionCheckItem,
  DocumentActivityEntry,
} from "@/types/admin";

// ---------------------------------------------------------------------------
// Mock data — TODO: Replace with API call
// ---------------------------------------------------------------------------
const FOLDERS: DocumentFolder[] = [
  { id: "1", name: "Academic Year 2025-26", count: 12, active: true },
  {
    id: "2",
    name: "Meeting Minutes",
    count: 4,
    children: [
      { id: "2a", name: "Academic Council" },
      { id: "2b", name: "Anti-Ragging" },
    ],
  },
  { id: "3", name: "Audit Reports", count: 8 },
  { id: "4", name: "NMC Correspondence", count: 2 },
  { id: "5", name: "SAF Submissions", count: 5 },
];

const DOCUMENTS: DocumentRow[] = [
  {
    id: "1",
    name: "Faculty_Declaration_Form_B.pdf",
    size: "2.4 MB",
    fileType: "pdf",
    folder: "NMC / Faculty",
    version: "v2.1",
    accessLevel: "public",
    lastModified: "2 hours ago",
  },
  {
    id: "2",
    name: "Department_Wise_Bed_Census.docx",
    size: "850 KB",
    fileType: "docx",
    folder: "NMC / Clinical",
    version: "v1.0",
    accessLevel: "admin_only",
    lastModified: "Yesterday",
  },
  {
    id: "3",
    name: "Internship_Completion_List_2023.pdf",
    size: "4.1 MB",
    fileType: "pdf",
    folder: "Academic / Records",
    version: "v3.0",
    accessLevel: "public",
    lastModified: "Oct 22, 2023",
  },
  {
    id: "4",
    name: "Minutes_Academic_Council_Sept.docx",
    size: "120 KB",
    fileType: "docx",
    folder: "Minutes / Council",
    version: "v1.2",
    accessLevel: "admin_only",
    lastModified: "Oct 20, 2023",
  },
];

const INSPECTION_CHECKS: InspectionCheckItem[] = [
  {
    label: "Faculty Appointment Orders",
    sublabel: "All updated for 2025-26",
    status: "ok",
  },
  {
    label: "Council Meeting Minutes",
    sublabel: "Last 6 months available",
    status: "ok",
  },
  {
    label: "AMC Contracts",
    sublabel: "Missing MRI & CT contracts",
    status: "missing",
  },
  {
    label: "Bed Census Reports",
    sublabel: "Signature pending from MS",
    status: "pending",
  },
];

const ACTIVITY: DocumentActivityEntry[] = [
  {
    id: "1",
    time: "10:42 AM • Today",
    dotColor: "bg-blue-500",
    actor: "Dr. Sharma",
    description: "approved",
    linkText: "SAF_Part_1.pdf",
  },
  {
    id: "2",
    time: "09:15 AM • Today",
    dotColor: "bg-emerald-500",
    actor: "Admin Office",
    description: "uploaded 3 new faculty declarations.",
  },
  {
    id: "3",
    time: "04:30 PM • Yesterday",
    dotColor: "bg-gray-600",
    actor: "System",
    description: "archived Academic Year 2023-24 folders.",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const FILE_ICON_CLASSES: Record<string, { bg: string; text: string }> = {
  pdf: { bg: "bg-red-500/10", text: "text-red-500" },
  docx: { bg: "bg-blue-500/10", text: "text-blue-500" },
};

const ACCESS_CLASSES: Record<string, string> = {
  public:
    "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  admin_only:
    "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
};

const ACCESS_LABELS: Record<string, string> = {
  public: "Public",
  admin_only: "Admin-Only",
};

// Circular progress SVG constants
const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const READINESS_PCT = 78;
const DASH_OFFSET = CIRCUMFERENCE * (1 - READINESS_PCT / 100);

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function DocumentManagerPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFolder, setActiveFolder] = useState("1");

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col overflow-hidden bg-[#0A0A0A]">
      {/* Top Bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-[#1E1E1E] px-6 py-3">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="cursor-pointer hover:text-white">Workflows</span>
          <span className="text-gray-600">/</span>
          <span className="font-semibold text-white">Document Manager</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative hidden w-96 md:block">
            <Search className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3 h-4 w-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents, file contents..."
              className="w-full rounded-lg border border-[#1E1E1E] bg-[#141414] py-2 pl-10 pr-3 text-sm text-gray-300 placeholder-gray-500 outline-none focus:border-emerald-500 focus:ring-emerald-500"
            />
          </div>
          <Button size="sm" className="gap-1.5">
            <Upload className="h-4 w-4" /> Upload Document
          </Button>
        </div>
      </div>

      {/* 3-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* ---- Left sidebar: File Browser ---- */}
        <div className="flex w-72 shrink-0 flex-col overflow-hidden border-r border-[#1E1E1E] bg-[#141414]">
          <div className="border-b border-[#1E1E1E] p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              File Browser
            </h2>
          </div>

          <div className="flex-1 space-y-1 overflow-y-auto p-2">
            {FOLDERS.map((f) => (
              <div key={f.id}>
                <button
                  onClick={() => setActiveFolder(f.id)}
                  className={`group flex w-full items-center gap-2 rounded-lg px-3 py-2 transition-colors ${
                    activeFolder === f.id
                      ? "bg-emerald-500/10 text-emerald-500"
                      : "text-gray-400 hover:bg-[#262626] hover:text-white"
                  }`}
                >
                  {activeFolder === f.id ? (
                    <FolderOpen className="h-5 w-5" />
                  ) : (
                    <Folder className="h-5 w-5" />
                  )}
                  <span className="text-sm font-medium">{f.name}</span>
                  <span
                    className={`ml-auto text-xs ${
                      activeFolder === f.id ? "opacity-60" : "text-gray-600"
                    }`}
                  >
                    {f.count}
                  </span>
                </button>

                {/* Sub-folders */}
                {f.children && (
                  <div className="space-y-1 pl-9">
                    {f.children.map((child) => (
                      <button
                        key={child.id}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-300"
                      >
                        <CornerDownRight className="h-4 w-4" />
                        {child.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Storage */}
          <div className="border-t border-[#1E1E1E] bg-[#262626]/30 p-4">
            <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
              <span>Storage Used</span>
              <span>75%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-gray-700">
              <div
                className="h-1.5 rounded-full bg-emerald-500"
                style={{ width: "75%" }}
              />
            </div>
            <div className="mt-2 text-xs text-gray-600">
              150GB of 200GB used
            </div>
          </div>
        </div>

        {/* ---- Center: Document Table ---- */}
        <div className="flex min-w-0 flex-1 flex-col bg-[#111111]">
          {/* Folder header */}
          <div className="flex items-center justify-between border-b border-[#1E1E1E] p-6">
            <div>
              <h1 className="text-xl font-bold text-white">
                Academic Year 2025-26
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Found 12 documents in this folder
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button className="rounded-lg border border-[#1E1E1E] bg-[#141414] p-2 text-gray-400 hover:bg-[#262626] hover:text-white">
                <Filter className="h-5 w-5" />
              </button>
              <button className="rounded-lg border border-[#1E1E1E] bg-[#141414] p-2 text-gray-400 hover:bg-[#262626] hover:text-white">
                <LayoutGrid className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto p-6">
            <div className="overflow-hidden rounded-xl border border-[#1E1E1E] bg-[#141414]">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1E1E1E] bg-[#262626]">
                    <TableHead className="w-10 px-6">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-600 bg-[#141414] text-emerald-500 focus:ring-emerald-500"
                      />
                    </TableHead>
                    <TableHead className="px-6 text-xs font-semibold uppercase text-gray-500">
                      Document Name
                    </TableHead>
                    <TableHead className="px-6 text-xs font-semibold uppercase text-gray-500">
                      Folder
                    </TableHead>
                    <TableHead className="px-6 text-xs font-semibold uppercase text-gray-500">
                      Version
                    </TableHead>
                    <TableHead className="px-6 text-xs font-semibold uppercase text-gray-500">
                      Access Level
                    </TableHead>
                    <TableHead className="px-6 text-right text-xs font-semibold uppercase text-gray-500">
                      Last Modified
                    </TableHead>
                    <TableHead className="px-6 text-right text-xs font-semibold uppercase text-gray-500">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {DOCUMENTS.map((doc) => {
                    const iconClasses = FILE_ICON_CLASSES[doc.fileType];
                    const FileIcon =
                      doc.fileType === "pdf" ? FileType2 : FileText;
                    return (
                      <TableRow
                        key={doc.id}
                        className="group border-[#1E1E1E] transition-colors hover:bg-[#262626]/50"
                      >
                        <TableCell className="px-6">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-600 bg-[#141414] text-emerald-500 focus:ring-emerald-500"
                          />
                        </TableCell>
                        <TableCell className="px-6">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-8 w-8 items-center justify-center rounded ${iconClasses.bg}`}
                            >
                              <FileIcon
                                className={`h-[18px] w-[18px] ${iconClasses.text}`}
                              />
                            </div>
                            <div>
                              <p className="cursor-pointer text-sm font-medium text-white transition-colors group-hover:text-emerald-500">
                                {doc.name}
                              </p>
                              <p className="text-xs text-gray-600">
                                {doc.size}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-6 text-gray-500">
                          {doc.folder}
                        </TableCell>
                        <TableCell className="px-6">
                          <span className="rounded border border-gray-700 bg-gray-800 px-2 py-0.5 text-xs text-gray-300">
                            {doc.version}
                          </span>
                        </TableCell>
                        <TableCell className="px-6">
                          <span
                            className={`rounded border px-2 py-0.5 text-xs ${ACCESS_CLASSES[doc.accessLevel]}`}
                          >
                            {ACCESS_LABELS[doc.accessLevel]}
                          </span>
                        </TableCell>
                        <TableCell className="px-6 text-right text-xs">
                          {doc.lastModified}
                        </TableCell>
                        <TableCell className="px-6 text-right">
                          <button className="rounded p-1 text-gray-500 hover:bg-gray-800 hover:text-white">
                            <MoreVertical className="h-[18px] w-[18px]" />
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        {/* ---- Right sidebar: Inspection + Activity ---- */}
        <div className="flex w-80 shrink-0 flex-col space-y-6 overflow-y-auto border-l border-[#1E1E1E] bg-[#0A0A0A] p-6">
          {/* NMC Inspection Readiness */}
          <div className="relative overflow-hidden rounded-xl border border-[#1E1E1E] bg-[#141414] p-5">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent" />

            <h3 className="relative z-10 mb-4 text-sm font-bold text-white">
              NMC Inspection Readiness
            </h3>

            {/* Circular progress */}
            <div className="relative z-10 mb-6 flex justify-center">
              <div className="relative h-32 w-32">
                <svg
                  className="h-full w-full -rotate-90"
                  viewBox="0 0 100 100"
                >
                  <circle
                    cx="50"
                    cy="50"
                    r={RADIUS}
                    fill="none"
                    stroke="#262626"
                    strokeWidth="8"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r={RADIUS}
                    fill="none"
                    stroke="#10b77f"
                    strokeWidth="8"
                    strokeDasharray={CIRCUMFERENCE}
                    strokeDashoffset={DASH_OFFSET}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-white">
                    {READINESS_PCT}%
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-gray-400">
                    Ready
                  </span>
                </div>
              </div>
            </div>

            {/* Checklist */}
            <div className="relative z-10 space-y-3">
              {INSPECTION_CHECKS.map((item) => (
                <div key={item.label} className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                      item.status === "ok"
                        ? "bg-emerald-500/20"
                        : "bg-red-500/20"
                    }`}
                  >
                    {item.status === "ok" ? (
                      <Check className="h-3 w-3 text-emerald-500" />
                    ) : item.status === "missing" ? (
                      <X className="h-3 w-3 text-red-500" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 text-red-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p
                      className={`text-sm ${
                        item.status === "ok"
                          ? "text-gray-300"
                          : "font-medium text-white"
                      }`}
                    >
                      {item.label}
                    </p>
                    <p
                      className={`text-xs ${
                        item.status === "ok"
                          ? "text-gray-500"
                          : "text-red-400"
                      }`}
                    >
                      {item.sublabel}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <Button className="relative z-10 mt-6 w-full shadow-lg shadow-emerald-500/20">
              Generate Inspection Package
            </Button>
          </div>

          {/* Recent Activity */}
          <div className="rounded-xl border border-[#1E1E1E] bg-[#141414] p-5">
            <h3 className="mb-4 text-sm font-bold text-white">
              Recent Activity
            </h3>
            <div className="space-y-4">
              {ACTIVITY.map((a) => (
                <div key={a.id} className="flex gap-3">
                  <div
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${a.dotColor}`}
                  />
                  <div>
                    <p className="mb-0.5 text-xs text-gray-400">{a.time}</p>
                    <p className="text-sm text-gray-300">
                      <span className="font-medium text-white">
                        {a.actor}
                      </span>{" "}
                      {a.description}
                      {a.linkText && (
                        <>
                          {" "}
                          <span className="cursor-pointer text-emerald-500 hover:underline">
                            {a.linkText}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
