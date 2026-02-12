"use client";

import { useState } from "react";
import {
  Megaphone,
  ShieldCheck,
  Wallet,
  Clock,
  Upload,
  Sparkles,
  Search,
  Landmark,
  GraduationCap,
  Star,
  Droplets,
  ListChecks,
  IndianRupee,
  RefreshCw,
  Network,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { formatINRCurrency } from "@/lib/format";
import type {
  ScholarshipScheme,
  ScholarshipStudentEntry,
} from "@/types/admin";

// TODO: Replace with API call — fetch from /api/v1/admin/scholarships/schemes
const MOCK_SCHEMES: ScholarshipScheme[] = [
  {
    id: "1",
    name: "Central Sector Scheme",
    provider: "Ministry of Education, GoI",
    status: "open",
    eligibilityCriteria: ">80th Percentile in 12th",
    amount: "₹10,000 - ₹20,000 / annum",
    deadline: "Oct 31, 2025",
    appliedCount: 45,
  },
  {
    id: "2",
    name: "Post-Matric Scholarship",
    provider: "Ministry of Minority Affairs",
    status: "open",
    eligibilityCriteria: "Minority Community, < 2L Income",
    amount: "Admission + Tuition Fee",
    deadline: "Nov 15, 2025",
    appliedCount: 128,
  },
  {
    id: "3",
    name: "PM-YASASVI Scheme",
    provider: "Ministry of Social Justice",
    status: "closing_soon",
    eligibilityCriteria: "OBC/EBC/DNT Students",
    amount: "Up to ₹75,000 / annum",
    deadline: "Sep 30, 2025",
    deadlineColor: "red",
    appliedCount: 32,
  },
  {
    id: "4",
    name: "ONGC Scholarship (Medical)",
    provider: "ONGC Foundation",
    status: "pending",
    eligibilityCriteria: "SC/ST/OBC, 1st Year MBBS",
    amount: "₹48,000 / annum",
    deadline: "Opens: Dec 01, 2025",
    appliedCount: 0,
  },
];

// TODO: Replace with API call — fetch from /api/v1/admin/scholarships/students
const MOCK_STUDENTS: ScholarshipStudentEntry[] = [
  {
    id: "1",
    name: "Rahul Joshi",
    initials: "RJ",
    initialsColor: "bg-indigo-500/20 text-indigo-400",
    enrollmentNo: "MBBS20220045",
    category: "OBC",
    categoryTag: "NCL",
    income: "₹1.5L / Annum",
    matchedSchemes: 3,
    portalStatuses: [
      { portal: "NSP", status: "Verified (L1)", color: "emerald" },
      { portal: "State", status: "Not Applied", color: "gray" },
    ],
  },
  {
    id: "2",
    name: "Ananya Singh",
    initials: "AS",
    initialsColor: "bg-pink-500/20 text-pink-400",
    enrollmentNo: "MBBS20220112",
    category: "General (EWS)",
    income: "₹4.2L / Annum",
    matchedSchemes: 1,
    portalStatuses: [
      { portal: "NSP", status: "Pending Docs", color: "orange" },
    ],
  },
  {
    id: "3",
    name: "Mohit Kumar",
    initials: "MK",
    initialsColor: "bg-orange-500/20 text-orange-400",
    enrollmentNo: "MBBS20210088",
    category: "SC",
    income: "₹1.2L / Annum",
    matchedSchemes: 5,
    portalStatuses: [
      { portal: "NSP", status: "Approved", color: "emerald" },
      { portal: "State", status: "Disbursed", color: "emerald" },
    ],
  },
  {
    id: "4",
    name: "Sarah Jenkins",
    initials: "SJ",
    initialsColor: "bg-teal-500/20 text-teal-400",
    enrollmentNo: "MBBS20230156",
    category: "General",
    income: "₹8.5L / Annum",
    matchedSchemes: 0,
    portalStatuses: [],
  },
  {
    id: "5",
    name: "Vikram Patel",
    initials: "VP",
    initialsColor: "bg-purple-500/20 text-purple-400",
    enrollmentNo: "MBBS20210032",
    category: "ST",
    income: "₹90k / Annum",
    matchedSchemes: 4,
    portalStatuses: [
      { portal: "NSP", status: "Rejected (Bank)", color: "red" },
    ],
  },
];

const SCHEME_ICONS: Record<string, React.ReactNode> = {
  "1": <Landmark className="h-4 w-4 text-gray-800" />,
  "2": <GraduationCap className="h-4 w-4 text-gray-800" />,
  "3": <Star className="h-4 w-4 text-gray-800" />,
  "4": <Droplets className="h-4 w-4 text-gray-800" />,
};

const STATUS_BADGE: Record<
  string,
  { label: string; className: string }
> = {
  open: {
    label: "Open",
    className:
      "border-emerald-800 bg-emerald-900 text-emerald-400",
  },
  closing_soon: {
    label: "Closing Soon",
    className:
      "border-yellow-800 bg-yellow-900 text-yellow-400",
  },
  pending: {
    label: "Pending",
    className: "border-gray-700 bg-gray-800 text-gray-400",
  },
  closed: {
    label: "Closed",
    className: "border-red-800 bg-red-900 text-red-400",
  },
};

const SYNC_DOT_COLORS: Record<string, string> = {
  emerald: "bg-emerald-500",
  orange: "bg-orange-500",
  red: "bg-red-500",
  gray: "bg-gray-600",
};

const SYNC_TEXT_COLORS: Record<string, string> = {
  emerald: "text-gray-300",
  orange: "text-orange-300",
  red: "text-red-300",
  gray: "text-gray-500",
};

export default function ScholarshipsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Scholarship Management
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Academic Year 2025-26 &bull; DBT Direct Benefit Transfer Cycle
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <Upload className="h-4 w-4" />
            Import NSP Data
          </Button>
          <Button className="gap-2 bg-emerald-600 shadow-lg shadow-emerald-500/20 hover:bg-emerald-700">
            <Sparkles className="h-4 w-4" />
            Run AI Auto-Match
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Active Schemes */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-2 flex items-start justify-between">
              <div className="rounded-lg bg-blue-500/10 p-2">
                <Megaphone className="h-5 w-5 text-blue-500" />
              </div>
              <Badge variant="info">Open</Badge>
            </div>
            <h3 className="mt-2 text-2xl font-bold text-white">47</h3>
            <p className="mt-1 text-sm text-gray-400">Active Schemes</p>
          </CardContent>
        </Card>

        {/* Students Matched */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-2 flex items-start justify-between">
              <div className="rounded-lg bg-emerald-500/10 p-2">
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
              </div>
              <Badge>+12% vs LY</Badge>
            </div>
            <h3 className="mt-2 text-2xl font-bold text-white">234</h3>
            <div className="mt-1 flex items-center justify-between">
              <p className="text-sm text-gray-400">Students Matched</p>
              <span className="text-sm font-semibold text-emerald-500">
                92%
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#262626]">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: "92%" }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Total Disbursed */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-2 flex items-start justify-between">
              <div className="rounded-lg bg-purple-500/10 p-2">
                <Wallet className="h-5 w-5 text-purple-500" />
              </div>
              <Badge className="border-purple-500/30 bg-purple-500/10 text-purple-500">
                DBT
              </Badge>
            </div>
            <h3 className="mt-2 text-2xl font-bold text-white">
              {formatINRCurrency(18234000)}
            </h3>
            <p className="mt-1 text-sm text-gray-400">Total Disbursed</p>
          </CardContent>
        </Card>

        {/* Pending Applications */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-2 flex items-start justify-between">
              <div className="rounded-lg bg-orange-500/10 p-2">
                <Clock className="h-5 w-5 text-orange-500" />
              </div>
              <Badge variant="warning">Verification</Badge>
            </div>
            <h3 className="mt-2 text-2xl font-bold text-white">56</h3>
            <div className="mt-1 flex items-center gap-2">
              <p className="text-sm text-gray-400">Pending Applications</p>
              <span className="rounded bg-orange-500/10 px-1.5 text-xs font-medium text-orange-400">
                L1 Stage
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content — Schemes + Student Tracker */}
      <div className="grid h-auto grid-cols-1 gap-6 xl:h-[600px] xl:grid-cols-12">
        {/* Active Schemes Panel */}
        <Card className="flex flex-col overflow-hidden xl:col-span-4">
          <div className="flex shrink-0 items-center justify-between border-b border-dark-border p-4">
            <h2 className="text-base font-semibold text-white">
              Active Schemes
            </h2>
            <Button variant="link" size="sm" className="h-auto p-0 text-xs">
              View All
            </Button>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {MOCK_SCHEMES.map((scheme) => {
              const badge = STATUS_BADGE[scheme.status];
              return (
                <div
                  key={scheme.id}
                  className="group relative cursor-pointer overflow-hidden rounded-lg border border-dark-border bg-[#262626]/40 p-4 transition-colors hover:border-emerald-500/50"
                >
                  {scheme.status === "open" && (
                    <div className="absolute right-0 top-0 h-full w-2 bg-emerald-500/20" />
                  )}
                  <div className="mb-2 flex items-start justify-between">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white p-1">
                      {SCHEME_ICONS[scheme.id]}
                    </div>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <h3 className="font-bold text-white transition-colors group-hover:text-emerald-500">
                    {scheme.name}
                  </h3>
                  <p className="mb-3 text-xs text-gray-400">
                    {scheme.provider}
                  </p>
                  <div className="mb-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-gray-300">
                      <ListChecks className="h-3.5 w-3.5 text-gray-500" />
                      <span>{scheme.eligibilityCriteria}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-300">
                      <IndianRupee className="h-3.5 w-3.5 text-gray-500" />
                      <span>{scheme.amount}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-dark-border pt-3">
                    <span
                      className={`text-xs ${scheme.deadlineColor === "red" ? "text-red-400" : "text-gray-500"}`}
                    >
                      {scheme.deadline.startsWith("Opens")
                        ? scheme.deadline
                        : `Deadline: ${scheme.deadline}`}
                    </span>
                    <span className="text-xs font-medium text-white">
                      {scheme.appliedCount} Applied
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Student Matcher & Tracker */}
        <Card className="flex flex-col overflow-hidden xl:col-span-8">
          <div className="flex shrink-0 flex-col gap-4 border-b border-dark-border p-4 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="shrink-0 text-base font-semibold text-white">
              Student Matcher & Tracker
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-40 pl-9"
                />
              </div>
              <Select
                value={categoryFilter}
                onValueChange={setCategoryFilter}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="sc_st">SC/ST</SelectItem>
                  <SelectItem value="obc">OBC</SelectItem>
                  <SelectItem value="ews">EWS</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="matched">Matched</SelectItem>
                  <SelectItem value="applied">Applied</SelectItem>
                  <SelectItem value="verification">
                    Verification Pending
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-dark-border bg-dark-elevated/50 hover:bg-dark-elevated/50">
                  <TableHead className="min-w-[200px] px-4 py-3 text-[10px] font-semibold uppercase text-gray-500">
                    Student / ID
                  </TableHead>
                  <TableHead className="px-4 py-3 text-[10px] font-semibold uppercase text-gray-500">
                    Category / Income
                  </TableHead>
                  <TableHead className="px-4 py-3 text-center text-[10px] font-semibold uppercase text-gray-500">
                    Matched Schemes
                  </TableHead>
                  <TableHead className="px-4 py-3 text-[10px] font-semibold uppercase text-gray-500">
                    Portal Sync Status
                  </TableHead>
                  <TableHead className="w-24 px-4 py-3 text-center text-[10px] font-semibold uppercase text-gray-500">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_STUDENTS.map((student) => (
                  <TableRow
                    key={student.id}
                    className="group cursor-pointer border-dark-border hover:bg-[#262626]/20"
                  >
                    <TableCell className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${student.initialsColor}`}
                        >
                          {student.initials}
                        </div>
                        <div>
                          <p className="font-medium text-white">
                            {student.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {student.enrollmentNo}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-4 text-gray-300">
                      <div className="flex flex-col">
                        <span className="inline-flex items-center gap-1">
                          {student.category}
                          {student.categoryTag && (
                            <span className="rounded bg-gray-700 px-1 text-[10px]">
                              {student.categoryTag}
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-gray-500">
                          {student.income}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-4 text-center">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                          student.matchedSchemes > 0
                            ? "bg-emerald-500/20 text-emerald-500"
                            : "bg-[#262626] text-gray-500"
                        }`}
                      >
                        {student.matchedSchemes}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <div className="flex flex-col gap-1">
                        {student.portalStatuses.length > 0 ? (
                          student.portalStatuses.map((ps, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2"
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${SYNC_DOT_COLORS[ps.color]}`}
                              />
                              <span
                                className={`text-xs ${SYNC_TEXT_COLORS[ps.color]}`}
                              >
                                {ps.portal}: {ps.status}
                              </span>
                            </div>
                          ))
                        ) : (
                          <span className="text-xs italic text-gray-600">
                            No eligible schemes
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-4 text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        className={`h-7 text-xs ${
                          student.matchedSchemes > 0
                            ? "border-dark-border text-emerald-500 hover:bg-emerald-500/20 hover:text-white"
                            : "border-dark-border text-gray-500 hover:bg-gray-700 hover:text-white"
                        }`}
                      >
                        Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* NSP & DBT Integration Status Banner */}
      <Card className="relative overflow-hidden bg-gradient-to-r from-[#141414] to-[#262626]">
        <div className="absolute right-0 top-0 h-full w-64 bg-gradient-to-l from-emerald-900/10 to-transparent" />
        <CardContent className="relative z-10 p-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-white p-3 shadow-sm">
                <Network className="h-7 w-7 text-gray-900" />
              </div>
              <div>
                <h3 className="flex items-center gap-2 text-lg font-bold text-white">
                  NSP & DBT Integration Status
                  <Badge className="border-emerald-500/30 bg-emerald-500/20 text-[10px] text-emerald-400">
                    Live Sync
                  </Badge>
                </h3>
                <p className="mt-1 max-w-xl text-sm text-gray-400">
                  National Scholarship Portal (NSP) synchronization is active.
                  L1 Verification queue is updated every 4 hours. Direct Benefit
                  Transfer (DBT) tracking enabled.
                </p>
              </div>
            </div>
            <div className="flex gap-8 divide-x divide-gray-700">
              <div className="first:pl-0 pl-4">
                <p className="mb-1 text-xs uppercase tracking-wide text-gray-500">
                  L1 Verification Queue
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-white">12</span>
                  <span className="rounded bg-orange-500/10 px-1.5 text-xs font-medium text-orange-400">
                    Pending
                  </span>
                </div>
              </div>
              <div className="pl-8">
                <p className="mb-1 text-xs uppercase tracking-wide text-gray-500">
                  Last Sync
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-medium text-gray-300">
                    14 mins ago
                  </span>
                  <button className="text-emerald-500 transition-colors hover:text-white">
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="pl-8">
                <p className="mb-1 text-xs uppercase tracking-wide text-gray-500">
                  Failed Transactions
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-white">3</span>
                  <span className="rounded bg-red-500/10 px-1.5 text-xs font-medium text-red-400">
                    Action Req.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
