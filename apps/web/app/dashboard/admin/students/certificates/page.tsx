"use client";

import { useState } from "react";
import {
  BadgeCheck,
  Clock,
  BarChart3,
  Fingerprint,
  PlusCircle,
  Settings,
  Search,
  ScanLine,
  Eye,
  Printer,
  PenLine,
  Filter,
  RefreshCw,
  Download,
  QrCode,
  ShieldCheck,
  Ban,
  Check,
  X,
  Lock,
  CloudCog,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CertificateLogEntry, CertificateStatus } from "@/types/admin";

interface CertStat {
  label: string;
  value: string;
  icon: typeof BadgeCheck;
  iconColor: string;
  iconBg: string;
  smallText?: boolean;
  pulse?: boolean;
}

// TODO: Replace with API call
const STATS: CertStat[] = [
  {
    label: "Total Issued",
    value: "342",
    icon: BadgeCheck,
    iconColor: "text-emerald-500",
    iconBg: "bg-emerald-500/10",
  },
  {
    label: "Pending Requests",
    value: "12",
    icon: Clock,
    iconColor: "text-yellow-500",
    iconBg: "bg-yellow-500/10",
  },
  {
    label: "Most Requested",
    value: "Bonafide (156)",
    icon: BarChart3,
    iconColor: "text-blue-500",
    iconBg: "bg-blue-500/10",
    smallText: true,
  },
  {
    label: "Digital Signatures",
    value: "Active",
    icon: Fingerprint,
    iconColor: "text-green-500",
    iconBg: "bg-green-500/10",
    pulse: true,
  },
];

// TODO: Replace with API call
const CERTIFICATE_LOG: CertificateLogEntry[] = [
  {
    id: "1",
    certNo: "CF-2025-092",
    type: "Bonafide",
    studentName: "Rahul Verma",
    enrollmentNo: "ENR2023001",
    date: "Oct 24, 2025",
    generatedBy: "Admin",
    hasDigiSig: true,
    status: "issued",
  },
  {
    id: "2",
    certNo: "CF-2025-091",
    type: "Transfer Certificate",
    studentName: "Sarah Kahn",
    enrollmentNo: "ENR2021056",
    date: "Oct 23, 2025",
    generatedBy: "Dr. Sharma",
    hasDigiSig: true,
    status: "issued",
  },
  {
    id: "3",
    certNo: "CF-2025-089",
    type: "Character Certificate",
    studentName: "Amit Patel",
    enrollmentNo: "ENR2022112",
    date: "Oct 22, 2025",
    generatedBy: "Clerk 1",
    hasDigiSig: false,
    status: "pending_sign",
  },
  {
    id: "4",
    certNo: "CF-2025-085",
    type: "Bonafide",
    studentName: "Priya Singh",
    enrollmentNo: "ENR2023044",
    date: "Oct 20, 2025",
    generatedBy: "Admin",
    hasDigiSig: true,
    status: "revoked",
  },
];

const STATUS_CONFIG: Record<
  CertificateStatus,
  { label: string; variant: "default" | "warning" | "destructive" }
> = {
  issued: { label: "Issued", variant: "default" },
  pending_sign: { label: "Pending Sign", variant: "warning" },
  revoked: { label: "Revoked", variant: "destructive" },
};

export default function CertificateManagementPage() {
  const [certType, setCertType] = useState("bonafide");
  const [studentSearch, setStudentSearch] = useState("");
  const [purpose, setPurpose] = useState("");
  const [addressedTo, setAddressedTo] = useState("");
  const [validity, setValidity] = useState("6");
  const [filterText, setFilterText] = useState("");

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 font-medium">
                  {stat.label}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {stat.pulse && (
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  )}
                  <h3
                    className={`font-bold text-white ${stat.smallText ? "text-lg" : "text-2xl"}`}
                  >
                    {stat.value}
                  </h3>
                </div>
              </div>
              <div
                className={`w-10 h-10 rounded-full ${stat.iconBg} flex items-center justify-center`}
              >
                <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content: Generate Form + Certificate Log */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Generate Certificate Form */}
        <div className="xl:col-span-1">
          <Card className="h-full flex flex-col">
            <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-dark-border p-5">
              <CardTitle className="flex items-center gap-2 text-lg">
                <PlusCircle className="w-5 h-5 text-emerald-500" />
                Generate Certificate
              </CardTitle>
              <Button variant="ghost" size="icon">
                <Settings className="w-4 h-4 text-gray-400" />
              </Button>
            </CardHeader>

            <div className="p-6 space-y-5 flex-1 overflow-y-auto">
              {/* Certificate Type */}
              <div className="space-y-2">
                <Label className="text-gray-300">Certificate Type</Label>
                <Select value={certType} onValueChange={setCertType}>
                  <SelectTrigger className="bg-dark-elevated border-dark-border text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bonafide">
                      Bonafide Certificate
                    </SelectItem>
                    <SelectItem value="tc">
                      Transfer Certificate (TC)
                    </SelectItem>
                    <SelectItem value="character">
                      Character Certificate
                    </SelectItem>
                    <SelectItem value="completion">
                      Course Completion
                    </SelectItem>
                    <SelectItem value="migration">
                      Migration Certificate
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Student Search */}
              <div className="space-y-2">
                <Label className="text-gray-300">Student Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Search by Name or Enrollment No..."
                    className="pl-10 pr-10 bg-dark-elevated border-dark-border text-white placeholder:text-gray-500"
                  />
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-emerald-500 transition-colors">
                    <ScanLine className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Purpose */}
              <div className="space-y-2">
                <Label className="text-gray-300">Purpose / Reason</Label>
                <Input
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g. For Passport Application"
                  className="bg-dark-elevated border-dark-border text-white placeholder:text-gray-500"
                />
              </div>

              {/* Dynamic Fields */}
              <div className="p-4 bg-dark-elevated/50 rounded-lg border border-dashed border-dark-border space-y-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Dynamic Fields
                </p>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-400">
                      Addressed To
                    </Label>
                    <Input
                      value={addressedTo}
                      onChange={(e) => setAddressedTo(e.target.value)}
                      placeholder="The Passport Officer"
                      className="h-8 text-sm bg-dark-surface border-dark-border text-white placeholder:text-gray-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-400">
                      Validity (Months)
                    </Label>
                    <Input
                      type="number"
                      value={validity}
                      onChange={(e) => setValidity(e.target.value)}
                      className="h-8 text-sm bg-dark-surface border-dark-border text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Template Preview */}
              <div className="space-y-2">
                <Label className="text-gray-300">Template Preview</Label>
                <div className="aspect-[1.414/1] w-full bg-white rounded border border-gray-200 flex items-center justify-center relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gray-100 flex flex-col p-4 opacity-50">
                    <div className="h-4 w-1/3 bg-gray-300 mb-4 self-center rounded" />
                    <div className="h-2 w-full bg-gray-200 mb-2 rounded" />
                    <div className="h-2 w-full bg-gray-200 mb-2 rounded" />
                    <div className="h-2 w-3/4 bg-gray-200 mb-2 rounded" />
                    <div className="mt-auto h-8 w-8 bg-gray-300 self-end rounded-full" />
                  </div>
                  <div className="relative z-10 bg-white/90 px-4 py-2 rounded shadow text-xs font-medium text-gray-800 flex items-center gap-1 cursor-pointer hover:text-emerald-600 transition-colors">
                    <Eye className="w-3.5 h-3.5" /> Preview
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-5 border-t border-dark-border flex flex-col gap-3">
              <Button className="w-full shadow-lg shadow-emerald-500/20">
                <Printer className="w-4 h-4" /> Generate
              </Button>
              <Button variant="outline" className="w-full">
                <PenLine className="w-4 h-4 text-green-500" /> Generate with
                Digital Signature
              </Button>
            </div>
          </Card>
        </div>

        {/* Certificate Log + Verification Banner */}
        <div className="xl:col-span-2 flex flex-col gap-6">
          {/* Certificate Log Table */}
          <Card className="flex-1 flex flex-col">
            <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-dark-border p-5">
              <CardTitle className="text-lg">Certificate Log</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                  <Input
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    placeholder="Filter..."
                    className="pl-8 h-8 w-48 text-sm bg-dark-elevated border-dark-border text-white placeholder:text-gray-500"
                  />
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <RefreshCw className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>

            <div className="flex-1 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-dark-border bg-dark-elevated/30 hover:bg-dark-elevated/30">
                    <TableHead className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4">
                      Cert No.
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4">
                      Type
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4">
                      Student
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4">
                      Date
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4">
                      Generated By
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 text-center">
                      Digi Sig
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4">
                      Status
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {CERTIFICATE_LOG.map((cert) => {
                    const statusCfg = STATUS_CONFIG[cert.status];
                    const isRevoked = cert.status === "revoked";
                    return (
                      <TableRow
                        key={cert.id}
                        className={`border-dark-border hover:bg-dark-elevated/50 ${isRevoked ? "opacity-60" : ""}`}
                      >
                        <TableCell className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <QrCode className="w-4 h-4 text-gray-400" />
                            <span
                              className={`text-sm font-medium text-white ${isRevoked ? "line-through" : ""}`}
                            >
                              {cert.certNo}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-300">
                          {cert.type === "Transfer Certificate"
                            ? "Transfer Cert"
                            : cert.type === "Character Certificate"
                              ? "Character Cert"
                              : cert.type}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-white">
                              {cert.studentName}
                            </p>
                            <p className="text-[10px] text-gray-500">
                              {cert.enrollmentNo}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-300">
                          {cert.date}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-300">
                          {cert.generatedBy}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${
                              cert.hasDigiSig
                                ? "bg-green-500/20 text-green-500"
                                : "bg-gray-500/20 text-gray-500"
                            }`}
                          >
                            {cert.hasDigiSig ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <X className="w-3.5 h-3.5" />
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <Badge variant={statusCfg.variant}>
                            {statusCfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right">
                          {isRevoked ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 cursor-not-allowed opacity-50"
                              disabled
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 hover:text-emerald-500 hover:bg-emerald-500/10"
                                title="Download"
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 hover:text-blue-500 hover:bg-blue-500/10"
                                title="Verify"
                              >
                                <ShieldCheck className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 hover:text-red-500 hover:bg-red-500/10"
                                title="Revoke"
                              >
                                <Ban className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="p-4 border-t border-dark-border flex justify-between items-center">
              <span className="text-xs text-gray-400">
                Showing 1-4 of 342 entries
              </span>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" disabled className="text-xs">
                  Previous
                </Button>
                <Button size="sm" className="text-xs px-3">
                  1
                </Button>
                <Button variant="ghost" size="sm" className="text-xs px-3">
                  2
                </Button>
                <Button variant="ghost" size="sm" className="text-xs px-3">
                  3
                </Button>
                <Button variant="ghost" size="sm" className="text-xs">
                  Next
                </Button>
              </div>
            </div>
          </Card>

          {/* QR Verification Banner */}
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl border border-dark-border p-6 flex flex-col sm:flex-row items-center gap-6 relative overflow-hidden">
            {/* Glow effect */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

            {/* QR Icon */}
            <div className="bg-white p-3 rounded-lg shadow-xl shrink-0 z-10">
              <QrCode className="w-16 h-16 text-gray-800" />
            </div>

            {/* Description */}
            <div className="flex-1 space-y-2 z-10 text-center sm:text-left">
              <h3 className="text-xl font-bold text-white flex items-center justify-center sm:justify-start gap-2">
                <BadgeCheck className="w-5 h-5 text-emerald-500" />
                Instant Public Verification
              </h3>
              <p className="text-gray-400 text-sm max-w-xl">
                Every certificate generated includes a unique, tamper-proof QR
                code. External parties can scan this code to instantly verify
                authenticity on our public portal at{" "}
                <span className="text-emerald-500 font-mono">
                  verify.acolyte.edu/cert
                </span>
                .
              </p>
              <div className="pt-2">
                <button className="text-xs font-medium text-emerald-500 hover:text-emerald-400 flex items-center justify-center sm:justify-start gap-1 transition-colors">
                  View Public Verification Page Preview
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Divider + Badges (desktop only) */}
            <div className="hidden lg:block w-px h-24 bg-gray-700 mx-4" />
            <div className="hidden lg:flex flex-col gap-3 min-w-[200px] z-10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-900/50 flex items-center justify-center text-green-500 border border-green-800">
                  <Lock className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs text-gray-300">
                  Cryptographically Signed
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-900/50 flex items-center justify-center text-blue-500 border border-blue-800">
                  <CloudCog className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs text-gray-300">
                  Blockchain Ledger
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
