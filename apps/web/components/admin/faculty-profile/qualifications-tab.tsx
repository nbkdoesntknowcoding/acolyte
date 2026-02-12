"use client";

import {
  GraduationCap,
  Plus,
  Edit,
  CheckCircle,
  Clock,
  CloudUpload,
  FileText,
  Image,
  Eye,
  Trash2,
  RefreshCw,
  History,
  Mail,
  Printer,
  Check,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type {
  AcademicQualification,
  QualificationCertificate,
  NMCRuleCheckItem,
} from "@/types/admin";

// ---------------------------------------------------------------------------
// TODO: Replace with API call — GET /api/v1/admin/faculty/{id}/qualifications
// ---------------------------------------------------------------------------

const QUALIFICATIONS: AcademicQualification[] = [
  {
    id: "1",
    degree: "MBBS",
    regNo: "12345/2000",
    university: "AIIMS New Delhi",
    year: "2000",
    specialization: "General Medicine",
    nmcVerified: true,
  },
  {
    id: "2",
    degree: "MD",
    regNo: "56789/2005",
    university: "PGIMER Chandigarh",
    year: "2005",
    specialization: "Anatomy",
    nmcVerified: true,
  },
  {
    id: "3",
    degree: "Fellowship (FAMS)",
    university: "National Academy of Medical Sciences",
    year: "2012",
    specialization: "Anatomy",
    nmcVerified: false,
  },
];

const CERTIFICATES: QualificationCertificate[] = [
  {
    id: "1",
    name: "MBBS_Degree.pdf",
    size: "2.4 MB",
    uploadDate: "12 Aug 2023",
    type: "pdf",
  },
  {
    id: "2",
    name: "MD_Certificate.jpg",
    size: "1.8 MB",
    uploadDate: "15 Aug 2023",
    type: "image",
  },
];

const NMC_CHECKS: NMCRuleCheckItem[] = [
  {
    title: "Recognized University",
    description:
      "MD degree is from PGIMER, which is in the NMC recognized list.",
    status: "passed",
  },
  {
    title: "Registration Validity",
    description:
      "Registration No. 56789 is active and verified in IMR database.",
    status: "passed",
  },
  {
    title: "Additional Qualification",
    description:
      "Additional qualification (MD) successfully registered on 2005.",
    status: "passed",
  },
  {
    title: "Fellowship Verification",
    description: "FAMS verification pending from granting authority.",
    status: "pending",
  },
];

export function QualificationsTab() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left Column — 2/3 */}
      <div className="space-y-6 lg:col-span-2">
        {/* Academic Qualifications Table */}
        <Card>
          <div className="flex items-center justify-between border-b border-dark-border px-6 py-4">
            <h2 className="flex items-center gap-2 text-base font-semibold text-white">
              <GraduationCap className="h-5 w-5 text-emerald-500" />
              Academic Qualifications
            </h2>
            <Button variant="ghost" size="sm" className="text-emerald-500">
              <Plus className="mr-1 h-4 w-4" /> Add New
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-[#262626]/50 text-[11px] uppercase tracking-wider text-gray-500">
                <TableHead className="font-semibold">
                  Degree / Course
                </TableHead>
                <TableHead className="font-semibold">
                  University / Board
                </TableHead>
                <TableHead className="font-semibold">Year</TableHead>
                <TableHead className="font-semibold">Specialization</TableHead>
                <TableHead className="text-center font-semibold">
                  NMC Verified
                </TableHead>
                <TableHead className="text-right font-semibold">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {QUALIFICATIONS.map((q) => (
                <TableRow
                  key={q.id}
                  className="group transition-colors hover:bg-[#262626]/20"
                >
                  <TableCell>
                    <div className="font-medium text-white">{q.degree}</div>
                    {q.regNo && (
                      <div className="text-xs text-gray-500">
                        Reg No: {q.regNo}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-gray-300">
                    {q.university}
                  </TableCell>
                  <TableCell className="text-gray-300">{q.year}</TableCell>
                  <TableCell className="text-gray-300">
                    {q.specialization}
                  </TableCell>
                  <TableCell className="text-center">
                    {q.nmcVerified ? (
                      <div
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500"
                        title="Verified"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </div>
                    ) : (
                      <div
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-700 text-gray-400"
                        title="Pending Verification"
                      >
                        <Clock className="h-4 w-4" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <button className="p-1 text-gray-500 hover:text-white">
                      <Edit className="h-4 w-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* Qualification Certificates */}
        <Card>
          <CardContent className="p-6">
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-white">
              <CloudUpload className="h-5 w-5 text-gray-400" />
              Qualification Certificates
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Upload Dropzone */}
              <div className="group flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-gray-600 p-6 text-center transition-colors hover:bg-[#262626]/30">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#262626] transition-all group-hover:bg-emerald-500/20">
                  <CloudUpload className="h-5 w-5 text-gray-400 group-hover:text-emerald-500" />
                </div>
                <p className="text-sm font-medium text-gray-300">
                  Upload Certificate
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  PDF, JPG up to 5MB
                </p>
              </div>

              {/* Uploaded Files */}
              <div className="space-y-3">
                {CERTIFICATES.map((cert) => (
                  <div
                    key={cert.id}
                    className="flex items-center justify-between rounded-lg border border-dark-border bg-[#262626] p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded",
                          cert.type === "pdf"
                            ? "bg-red-500/10 text-red-400"
                            : "bg-blue-500/10 text-blue-400",
                        )}
                      >
                        {cert.type === "pdf" ? (
                          <FileText className="h-4 w-4" />
                        ) : (
                          <Image className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">
                          {cert.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {cert.size} &bull; Uploaded {cert.uploadDate}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <button className="p-1 text-gray-400 hover:text-white">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button className="p-1 text-gray-400 hover:text-red-400">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Column — 1/3 */}
      <div className="space-y-6 lg:col-span-1">
        {/* NMC Rules Check */}
        <Card className="relative overflow-hidden">
          <CardContent className="p-5">
            <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-white">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
              NMC Rules Check
            </h3>
            <div className="space-y-4">
              {NMC_CHECKS.map((check) => (
                <div key={check.title} className="flex gap-3">
                  <div className="mt-0.5 shrink-0">
                    {check.status === "passed" ? (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20">
                        <Check className="h-3 w-3 text-emerald-500" />
                      </div>
                    ) : (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-yellow-500/20">
                        <AlertTriangle className="h-3 w-3 text-yellow-500" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      {check.title}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {check.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 border-t border-dark-border pt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  Last automated check:
                </span>
                <span className="font-mono text-xs text-gray-300">
                  Today, 09:41 AM
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full text-xs"
              >
                <RefreshCw className="mr-2 h-3.5 w-3.5" /> Re-run Validation
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-4 text-sm font-semibold text-gray-300">
              Quick Actions
            </h3>
            <div className="space-y-2">
              <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-gray-400 transition-colors hover:bg-[#262626] hover:text-white">
                <History className="h-5 w-5" />
                Request Transcript
              </button>
              <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-gray-400 transition-colors hover:bg-[#262626] hover:text-white">
                <Mail className="h-5 w-5" />
                Email Verification Link
              </button>
              <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-gray-400 transition-colors hover:bg-[#262626] hover:text-white">
                <Printer className="h-5 w-5" />
                Print Qualification Report
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
