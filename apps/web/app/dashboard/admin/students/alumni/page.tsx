"use client";

import { useState } from "react";
import {
  Users,
  GraduationCap,
  Briefcase,
  ClipboardCheck,
  TrendingUp,
  Mail,
  Phone,
  MoreVertical,
  Search,
  Filter,
  ChevronDown,
  Plus,
  Calendar,
  Heart,
  Banknote,
  BookOpen,
  Handshake,
  Star,
  FileText,
  ExternalLink,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  AlumniRecord,
  GraduateOutcome,
  PGAdmissionTrend,
  AlumniEvent,
  AlumniContribution,
} from "@/types/admin";

// ---------------------------------------------------------------------------
// Mock data — TODO: Replace with API calls
// ---------------------------------------------------------------------------

const STATS = [
  {
    label: "Total Alumni",
    value: "4,230",
    icon: Users,
    iconColor: "text-emerald-500",
    iconBg: "bg-emerald-500/10",
    trend: "+12% from last year",
    trendPositive: true,
  },
  {
    label: "PG Admissions",
    value: "67%",
    icon: GraduationCap,
    iconColor: "text-blue-500",
    iconBg: "bg-blue-500/10",
    subtitle: "Admitted to higher studies",
  },
  {
    label: "Employment Rate",
    value: "94%",
    icon: Briefcase,
    iconColor: "text-emerald-500",
    iconBg: "bg-emerald-500/10",
    trend: "+2% this quarter",
    trendPositive: true,
  },
  {
    label: "NAAC Crit 5 Score",
    value: "3.2",
    valueSuffix: "/4",
    icon: ClipboardCheck,
    iconColor: "text-purple-500",
    iconBg: "bg-purple-500/10",
    subtitle: "Criterion 5: Student Support",
  },
];

const GRADUATE_OUTCOMES: GraduateOutcome[] = [
  { label: "PG India", percentage: 45, color: "#10b981" },
  { label: "Govt Service", percentage: 18, color: "#3b82f6" },
  { label: "Pvt Practice", percentage: 15, color: "#f59e0b" },
  { label: "PG Abroad", percentage: 12, color: "#ec4899" },
  { label: "Research", percentage: 5, color: "#8b5cf6" },
  { label: "Other", percentage: 5, color: "#64748b" },
];

const PG_TRENDS: PGAdmissionTrend[] = [
  { year: "2019", percentage: 58 },
  { year: "2020", percentage: 62 },
  { year: "2021", percentage: 55 },
  { year: "2022", percentage: 70 },
  { year: "2023", percentage: 82 },
];

const ALUMNI_DIRECTORY: AlumniRecord[] = [
  {
    id: "1",
    name: "Dr. Aarav Patel",
    avatarUrl: undefined,
    initials: "AP",
    batch: "2018",
    currentPosition: "Sr. Resident",
    organization: "AIIMS, Delhi",
    location: "New Delhi",
    pgQualification: "MD Medicine",
    pgBadgeColor: "blue",
    lastUpdated: "2 days ago",
    hasEmail: true,
    hasPhone: true,
  },
  {
    id: "2",
    name: "Dr. Sneha Rao",
    initials: "SR",
    batch: "2019",
    currentPosition: "Consultant",
    organization: "Apollo Hospitals",
    location: "Chennai",
    pgQualification: "MS Surgery",
    pgBadgeColor: "purple",
    lastUpdated: "1 week ago",
    hasEmail: true,
    hasPhone: false,
  },
  {
    id: "3",
    name: "Dr. Vikram Singh",
    initials: "VS",
    batch: "2017",
    currentPosition: "Research Fellow",
    organization: "Mayo Clinic",
    location: "USA",
    pgQualification: "PhD Neuro",
    pgBadgeColor: "teal",
    lastUpdated: "Today",
    hasEmail: true,
    hasPhone: false,
  },
];

const EVENTS: AlumniEvent[] = [
  {
    id: "1",
    month: "Nov",
    day: 14,
    title: "Annual Alumni Meet 2024",
    location: "College Auditorium",
    time: "10:00 AM",
  },
  {
    id: "2",
    month: "Dec",
    day: 5,
    title: "Guest Lecture Series: Dr. Vikram",
    location: "Virtual Webinar",
    time: "06:00 PM",
  },
];

const CONTRIBUTIONS: AlumniContribution[] = [
  {
    id: "1",
    label: "Donations Collected",
    sublabel: "FY 2023-24",
    value: "\u20B9 24.5 Lakhs",
    iconColor: "text-green-500",
    iconBg: "bg-green-500/10",
  },
  {
    id: "2",
    label: "Books Donated",
    sublabel: "To Library",
    value: "450+ Units",
    iconColor: "text-blue-500",
    iconBg: "bg-blue-500/10",
  },
  {
    id: "3",
    label: "Mentorship Sessions",
    sublabel: "Hours committed",
    value: "120 Hours",
    iconColor: "text-purple-500",
    iconBg: "bg-purple-500/10",
  },
];

const CONTRIBUTION_ICONS: Record<string, typeof Banknote> = {
  "1": Banknote,
  "2": BookOpen,
  "3": Handshake,
};

const PG_BADGE_STYLES: Record<string, string> = {
  blue: "bg-blue-900/20 text-blue-300",
  purple: "bg-purple-900/20 text-purple-300",
  teal: "bg-teal-900/20 text-teal-300",
  emerald: "bg-emerald-900/20 text-emerald-300",
  amber: "bg-amber-900/20 text-amber-300",
};

// ---------------------------------------------------------------------------
// Custom Recharts Tooltip
// ---------------------------------------------------------------------------

function BarTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-dark-surface border border-dark-border rounded px-3 py-1.5 text-xs font-bold text-emerald-500 shadow-lg">
      {payload[0].value}%
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AlumniManagementPage() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">Alumni Dashboard</h1>
          <Badge className="rounded-full border-emerald-500/20">
            Active Network
          </Badge>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="outline">
            <Mail className="w-4 h-4" /> Send Bulk Communication
          </Button>
          <Button>
            <Plus className="w-4 h-4" /> Add Alumni
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    {stat.label}
                  </p>
                  <h3 className="text-2xl font-bold text-white mt-1">
                    {stat.value}
                    {stat.valueSuffix && (
                      <span className="text-base text-gray-400 font-normal">
                        {stat.valueSuffix}
                      </span>
                    )}
                  </h3>
                </div>
                <div className={`p-2 ${stat.iconBg} rounded-lg`}>
                  <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
                </div>
              </div>
              {stat.trend && (
                <p className="text-xs text-green-400 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {stat.trend}
                </p>
              )}
              {stat.subtitle && (
                <p className="text-xs text-gray-400">{stat.subtitle}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Graduate Outcomes Donut */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg">Graduate Outcomes</CardTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="w-4 h-4 text-gray-400" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-center gap-8">
              <div className="w-48 h-48 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={GRADUATE_OUTCOMES}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="percentage"
                      strokeWidth={0}
                    >
                      {GRADUATE_OUTCOMES.map((entry) => (
                        <Cell key={entry.label} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {GRADUATE_OUTCOMES.map((outcome) => (
                  <div key={outcome.label} className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: outcome.color }}
                    />
                    <span className="text-gray-300">
                      {outcome.label} ({outcome.percentage}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PG Admission Trends Bar Chart */}
        <Card className="flex flex-col">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg">
              PG Admission Trends (5 Years)
            </CardTitle>
            <span className="px-2 py-1 bg-dark-elevated rounded text-xs text-gray-500">
              Last 5 Years
            </span>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={PG_TRENDS}
                  margin={{ top: 10, right: 0, left: -20, bottom: 0 }}
                >
                  <XAxis
                    dataKey="year"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#6b7280", fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#6b7280", fontSize: 12 }}
                    domain={[0, 100]}
                    tickFormatter={(v: number) => `${v}%`}
                  />
                  <Tooltip
                    content={<BarTooltip />}
                    cursor={{ fill: "rgba(16,185,127,0.05)" }}
                  />
                  <Bar
                    dataKey="percentage"
                    fill="#10b981"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={48}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alumni Directory */}
      <Card>
        <CardContent className="p-4">
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-4">
            <div className="flex items-center gap-3 flex-1 w-full overflow-x-auto pb-2 md:pb-0">
              <div className="relative w-full md:w-64 shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search directory..."
                  className="pl-9 bg-dark-elevated border-dark-border text-white placeholder:text-gray-500"
                />
              </div>
              <div className="h-8 w-px bg-dark-border mx-2 hidden md:block" />
              <div className="flex gap-2">
                <FilterChip label="Year: 2018-2023" />
                <FilterChip label="Spec: Cardiology" />
                <FilterChip label="Location: All" />
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Filter className="w-4 h-4" />
            </Button>
          </div>

          {/* Table */}
          <div className="rounded-lg border border-dark-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-dark-border bg-dark-elevated/50 hover:bg-dark-elevated/50">
                  <TableHead className="w-10 px-4">
                    <input
                      type="checkbox"
                      className="rounded border-gray-600 bg-transparent"
                    />
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 min-w-[200px]">
                    Alumni Name
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4">
                    Batch
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4">
                    Current Position
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4">
                    Organization
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4">
                    Location
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4">
                    PG Qualification
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 text-center">
                    Contact
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ALUMNI_DIRECTORY.map((alumni) => (
                  <TableRow
                    key={alumni.id}
                    className="border-dark-border hover:bg-dark-elevated/30"
                  >
                    <TableCell className="px-4">
                      <input
                        type="checkbox"
                        className="rounded border-gray-600 bg-transparent"
                      />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-dark-elevated flex-shrink-0 flex items-center justify-center text-gray-400 font-bold text-sm overflow-hidden">
                          {alumni.avatarUrl ? (
                            <img
                              src={alumni.avatarUrl}
                              alt={alumni.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            alumni.initials
                          )}
                        </div>
                        <div>
                          <button className="font-medium text-white hover:text-emerald-500 transition-colors text-sm">
                            {alumni.name}
                          </button>
                          <p className="text-xs text-gray-500">
                            Last updated: {alumni.lastUpdated}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-gray-300">
                      {alumni.batch}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-gray-300">
                      {alumni.currentPosition}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-gray-300">
                      {alumni.organization}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-gray-400">
                      {alumni.location}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${PG_BADGE_STYLES[alumni.pgBadgeColor]}`}
                      >
                        {alumni.pgQualification}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-center">
                      {alumni.hasEmail && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 hover:text-emerald-500"
                        >
                          <Mail className="w-4 h-4" />
                        </Button>
                      )}
                      {alumni.hasPhone && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 hover:text-emerald-500"
                        >
                          <Phone className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 hover:text-emerald-500 hover:bg-dark-elevated"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Events + Contributions Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upcoming Events */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-500" />
              Upcoming Alumni Events
            </CardTitle>
            <button className="text-sm text-emerald-500 hover:underline">
              View All
            </button>
          </CardHeader>
          <CardContent className="space-y-4">
            {EVENTS.map((event) => (
              <div
                key={event.id}
                className="flex gap-4 items-start p-3 rounded-lg hover:bg-dark-elevated/50 transition-colors cursor-pointer"
              >
                <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex flex-col items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-emerald-500 uppercase">
                    {event.month}
                  </span>
                  <span className="text-lg font-bold text-white">
                    {event.day}
                  </span>
                </div>
                <div>
                  <h4 className="font-medium text-white">{event.title}</h4>
                  <p className="text-sm text-gray-400 mt-1">
                    {event.location} &bull; {event.time}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Alumni Contributions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Heart className="w-5 h-5 text-emerald-500" />
              Alumni Contributions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {CONTRIBUTIONS.map((item) => {
              const Icon = CONTRIBUTION_ICONS[item.id] ?? Banknote;
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 ${item.iconBg} rounded-full ${item.iconColor}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {item.label}
                      </p>
                      <p className="text-xs text-gray-500">{item.sublabel}</p>
                    </div>
                  </div>
                  <span className="font-bold text-white">{item.value}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* NAAC SSR Banner */}
      <div className="bg-gradient-to-r from-dark-surface to-dark-elevated rounded-xl border border-dark-border p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-yellow-500/20 rounded-lg text-yellow-500">
            <Star className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-white font-medium">
              NAAC SSR Criterion 5 Auto-Population
            </h4>
            <p className="text-sm text-gray-400">
              All alumni data shown here is automatically formatted for NAAC
              Self Study Report Criterion 5.1 &amp; 5.2.
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          className="bg-white text-gray-900 hover:bg-gray-100 whitespace-nowrap"
        >
          <FileText className="w-4 h-4" /> Generate NAAC Report
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FilterChip({ label }: { label: string }) {
  return (
    <button className="px-3 py-1.5 text-sm font-medium text-gray-300 bg-dark-elevated border border-dark-border rounded-lg hover:border-emerald-500/50 transition-colors flex items-center gap-2 whitespace-nowrap">
      <span>{label}</span>
      <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
    </button>
  );
}
