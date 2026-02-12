"use client";

import {
  DoorOpen,
  FlaskConical,
  BriefcaseMedical,
  BadgeCheck,
  Ruler,
  Users,
  Monitor,
  CalendarDays,
  Search,
  Filter,
  Wrench,
  Calendar,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
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
  EquipmentRow,
  AMCStatus,
  MaintenanceTicket,
  NMCChecklistItem,
  AMCCalendarDay,
} from "@/types/admin";

// ---------------------------------------------------------------------------
// TODO: Replace with API call — GET /api/v1/admin/facilities/infrastructure
// ---------------------------------------------------------------------------

const INFRA_ICON_MAP: Record<string, LucideIcon> = {
  lecture: DoorOpen,
  lab: FlaskConical,
  ot: BriefcaseMedical,
};

const INFRA_CARDS = [
  {
    title: "Lecture Halls",
    iconKey: "lecture",
    count: 4,
    unit: "Halls",
    stats: [
      { iconKey: "ruler", label: "Total Area: 1200 sqm" },
      { iconKey: "users", label: "Cap: 180 each" },
    ],
  },
  {
    title: "Skill Labs",
    iconKey: "lab",
    count: 8,
    unit: "Labs",
    stats: [
      { iconKey: "ruler", label: "Total Area: 800 sqm" },
      { iconKey: "monitor", label: "Active Equip: 340" },
    ],
  },
  {
    title: "Operation Theatres",
    iconKey: "ot",
    count: 12,
    unit: "Active OTs",
    stats: [
      { iconKey: "ruler", label: "Total Area: 2400 sqm" },
      { iconKey: "calendar", label: "Last Audit: 2 Days ago" },
    ],
  },
];

const STAT_ICONS: Record<string, LucideIcon> = {
  ruler: Ruler,
  users: Users,
  monitor: Monitor,
  calendar: CalendarDays,
};

const AMC_STATUS_BADGE: Record<AMCStatus, { label: string; classes: string }> = {
  active: {
    label: "ACTIVE",
    classes: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  expired: {
    label: "EXPIRED",
    classes: "bg-red-500/10 text-red-400 border-red-500/20",
  },
  expiring_soon: {
    label: "EXPIRING SOON",
    classes: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  },
};

const EQUIPMENT: EquipmentRow[] = [
  {
    id: "eq1",
    name: "Anesthesia Workstation",
    department: "Anaesthesiology",
    serialNo: "AN-WS-2023-001",
    amcStatus: "active",
    amcExpiry: "12 Dec, 2024",
    calibrationDue: "15 Nov, 2023",
    calibrationHighlight: true,
  },
  {
    id: "eq2",
    name: "Digital X-Ray Machine",
    department: "Radiology",
    serialNo: "RAD-XR-2021-089",
    amcStatus: "expired",
    amcExpiry: "01 Oct, 2023",
    amcExpiryHighlight: true,
    calibrationDue: "20 Jan, 2024",
  },
  {
    id: "eq3",
    name: "Defibrillator (Biphasic)",
    department: "Emergency",
    serialNo: "EM-DEF-2022-112",
    amcStatus: "active",
    amcExpiry: "14 Mar, 2025",
    calibrationDue: "10 Feb, 2024",
  },
  {
    id: "eq4",
    name: "Ventilator (ICU)",
    department: "ICU",
    serialNo: "ICU-VEN-2023-045",
    amcStatus: "active",
    amcExpiry: "22 Aug, 2024",
    calibrationDue: "22 Aug, 2024",
  },
  {
    id: "eq5",
    name: "Surgical Microscope",
    department: "Ophthalmology",
    serialNo: "OPH-MIC-2020-003",
    amcStatus: "expiring_soon",
    amcExpiry: "10 Nov, 2023",
    calibrationDue: "15 Dec, 2023",
  },
];

const PRIORITY_BADGE: Record<string, { label: string; classes: string }> = {
  critical: {
    label: "CRITICAL",
    classes: "bg-red-500/10 text-red-500 border-red-500/20",
  },
  high: {
    label: "HIGH",
    classes: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  },
  normal: {
    label: "NORMAL",
    classes: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  },
};

const STATUS_DOT: Record<string, { label: string; color: string }> = {
  in_progress: { label: "In Progress", color: "bg-yellow-500 text-yellow-500" },
  pending: { label: "Pending", color: "bg-gray-400 text-gray-400" },
  assigned: { label: "Assigned", color: "bg-emerald-500 text-emerald-500" },
};

const TICKETS: MaintenanceTicket[] = [
  {
    id: "t1",
    ticketId: "#REQ-892",
    issue: "CT Scanner Cooling Failure",
    priority: "critical",
    status: "in_progress",
  },
  {
    id: "t2",
    ticketId: "#REQ-895",
    issue: "MRI Console Software Error",
    priority: "high",
    status: "pending",
  },
  {
    id: "t3",
    ticketId: "#REQ-901",
    issue: "Patient Monitor Calibration",
    priority: "normal",
    status: "assigned",
  },
];

const NMC_CHECKLIST: NMCChecklistItem[] = [
  { name: "Boyle's Apparatus", required: 4, available: 4, compliant: true },
  { name: "Multiparameter Monitor", required: 10, available: 12, compliant: true },
  { name: "Defibrillator", required: 2, available: 1, compliant: false },
  { name: "Ventilator", required: 2, available: 3, compliant: true },
  { name: "Suction Machine", required: 6, available: 8, compliant: true },
];

// AMC calendar: Oct 2023 starts on Sunday (offset 0), 31 days
const AMC_SPECIALS: Record<number, AMCCalendarDay> = {
  10: { day: 10, state: "amc_expiring", tooltip: "Radiology AMC Expiring" },
  24: { day: 24, state: "calibration", tooltip: "Pathology Calibration" },
};

function buildCalendarDays(): AMCCalendarDay[] {
  const days: AMCCalendarDay[] = [];
  for (let d = 1; d <= 31; d++) {
    days.push(AMC_SPECIALS[d] ?? { day: d, state: "normal" });
  }
  return days;
}

const CALENDAR_DAYS = buildCalendarDays();

// ---------------------------------------------------------------------------

export default function InfrastructurePage() {
  return (
    <div className="flex h-[calc(100vh-64px)] flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-dark-border bg-dark-surface px-6">
        <nav className="flex items-center text-sm font-medium text-gray-400">
          <span className="cursor-pointer hover:text-white">Facilities</span>
          <span className="mx-2 text-gray-600">/</span>
          <span className="font-semibold text-white">
            Infrastructure &amp; Equipment Tracking
          </span>
        </nav>
        <div className="flex items-center gap-4">
          <div className="flex items-center rounded-lg border border-dark-border bg-dark-surface p-1">
            <button className="flex items-center gap-2 rounded bg-[#262626] px-3 py-1.5 text-xs font-medium text-white shadow-sm">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Online
            </button>
            <button className="rounded px-3 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:text-white">
              Audit Log
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 space-y-6 overflow-auto p-6">
        {/* Infrastructure Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {INFRA_CARDS.map((card) => {
            const CardIcon = INFRA_ICON_MAP[card.iconKey] ?? DoorOpen;
            return (
              <div
                key={card.title}
                className="group relative overflow-hidden rounded-xl border border-dark-border bg-dark-surface p-5"
              >
                {/* Watermark Icon */}
                <div className="absolute right-0 top-0 p-4 opacity-10 transition-opacity group-hover:opacity-20">
                  <CardIcon className="h-16 w-16 text-white" />
                </div>
                <div className="relative z-10">
                  <div className="mb-4 flex items-start justify-between">
                    <h3 className="text-sm font-medium uppercase tracking-wide text-gray-400">
                      {card.title}
                    </h3>
                    <span className="flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-500">
                      <BadgeCheck className="h-3 w-3" /> NMC COMPLIANT
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-white">
                      {card.count}
                    </span>
                    <span className="text-sm text-gray-500">{card.unit}</span>
                  </div>
                  <div className="mt-4 flex items-center gap-4 text-xs text-gray-400">
                    {card.stats.map((s) => {
                      const StatIcon = STAT_ICONS[s.iconKey] ?? Ruler;
                      return (
                        <div
                          key={s.label}
                          className="flex items-center gap-1.5"
                        >
                          <StatIcon className="h-4 w-4 text-gray-500" />
                          <span>{s.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Main 12-Col Grid */}
        <div className="grid h-full grid-cols-12 gap-6">
          {/* Left — Equipment Table + Maintenance Tickets */}
          <div className="col-span-12 space-y-6 xl:col-span-8">
            {/* Equipment Management Table */}
            <div className="flex flex-col overflow-hidden rounded-xl border border-dark-border bg-dark-surface">
              <div className="flex flex-col justify-between gap-4 border-b border-dark-border px-6 py-4 md:flex-row md:items-center">
                <h3 className="whitespace-nowrap text-sm font-bold text-white">
                  Equipment Management
                </h3>
                <div className="flex w-full gap-2 md:w-auto">
                  <div className="relative flex-1 md:w-64">
                    <Search className="absolute left-2.5 top-2 h-[18px] w-[18px] text-gray-500" />
                    <input
                      type="text"
                      placeholder="Search by Serial No. or Name..."
                      className="w-full rounded-lg border border-dark-border bg-[#262626] py-2 pl-9 pr-3 text-xs text-gray-300 placeholder-gray-600 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <button className="flex items-center gap-2 rounded-lg border border-dark-border bg-[#262626] px-3 py-2 text-xs font-medium text-gray-300 transition-colors hover:bg-[#262626]/80">
                    <Filter className="h-4 w-4" /> Filter
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-dark-border bg-[#262626]">
                      <TableHead className="whitespace-nowrap text-gray-500">
                        Equipment Name
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-gray-500">
                        Dept
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-gray-500">
                        Serial No.
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-gray-500">
                        AMC Status
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-gray-500">
                        AMC Expiry
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-gray-500">
                        Calibration Due
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {EQUIPMENT.map((eq) => {
                      const badge = AMC_STATUS_BADGE[eq.amcStatus];
                      return (
                        <TableRow
                          key={eq.id}
                          className="border-dark-border transition-colors hover:bg-[#262626]/50"
                        >
                          <TableCell className="font-medium text-white">
                            {eq.name}
                          </TableCell>
                          <TableCell>{eq.department}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {eq.serialNo}
                          </TableCell>
                          <TableCell>
                            <span
                              className={cn(
                                "rounded border px-2 py-0.5 text-[10px] font-semibold uppercase",
                                badge.classes,
                              )}
                            >
                              {badge.label}
                            </span>
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-xs",
                              eq.amcExpiryHighlight && "text-red-400",
                            )}
                          >
                            {eq.amcExpiry}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-xs",
                              eq.calibrationHighlight && "text-orange-400",
                            )}
                          >
                            {eq.calibrationDue}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between border-t border-dark-border bg-[#262626]/20 px-6 py-3 text-xs text-gray-500">
                <span>Showing 1-5 of 128 items</span>
                <div className="flex gap-1">
                  <button className="rounded p-1 text-gray-400 hover:bg-[#262626]">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button className="rounded p-1 text-gray-400 hover:bg-[#262626]">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Maintenance Tickets */}
            <div className="rounded-xl border border-dark-border bg-dark-surface p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                  <Wrench className="h-5 w-5 text-gray-400" /> Maintenance
                  Tickets
                </h3>
                <button className="text-xs font-medium text-emerald-500 hover:text-emerald-400">
                  View All Requests
                </button>
              </div>
              <div className="overflow-hidden rounded-lg border border-dark-border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#262626] font-semibold text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Ticket ID</th>
                      <th className="px-3 py-2">Issue</th>
                      <th className="px-3 py-2">Priority</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-border bg-dark-surface">
                    {TICKETS.map((t) => {
                      const pBadge = PRIORITY_BADGE[t.priority];
                      const sDot = STATUS_DOT[t.status];
                      return (
                        <tr key={t.id}>
                          <td className="px-3 py-3 font-mono text-gray-400">
                            {t.ticketId}
                          </td>
                          <td className="px-3 py-3 text-white">{t.issue}</td>
                          <td className="px-3 py-3">
                            <span
                              className={cn(
                                "rounded border px-1.5 py-0.5 text-[10px] font-bold",
                                pBadge.classes,
                              )}
                            >
                              {pBadge.label}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={cn(
                                "flex items-center gap-1",
                                sDot.color.split(" ")[1],
                              )}
                            >
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 rounded-full",
                                  sDot.color.split(" ")[0],
                                )}
                              />
                              {sDot.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="col-span-12 space-y-6 xl:col-span-4">
            {/* NMC Checklist */}
            <div className="flex h-[400px] flex-col rounded-xl border border-dark-border bg-dark-surface p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">NMC Checklist</h3>
                <select className="appearance-none rounded border border-dark-border bg-[#262626] px-2 py-1 pr-6 text-xs text-white focus:border-emerald-500 focus:outline-none">
                  <option>Anaesthesiology</option>
                  <option>Radiology</option>
                  <option>Pathology</option>
                </select>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto pr-2">
                {NMC_CHECKLIST.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-start gap-3 rounded-lg border border-dark-border bg-[#262626]/30 p-3"
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                        item.compliant
                          ? "bg-emerald-500/20"
                          : "border border-red-500/20 bg-red-500/10",
                      )}
                    >
                      {item.compliant ? (
                        <Check className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <X className="h-3 w-3 text-red-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-200">
                        {item.name}
                      </p>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          Required: {item.required}
                        </span>
                        <span
                          className={cn(
                            "text-xs",
                            item.compliant
                              ? "text-emerald-500"
                              : "font-bold text-red-400",
                          )}
                        >
                          Available: {item.available}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AMC Renewals Calendar */}
            <div className="rounded-xl border border-dark-border bg-dark-surface p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                  <Calendar className="h-5 w-5 text-gray-400" /> AMC Renewals
                </h3>
                <span className="text-xs text-gray-500">Oct 2023</span>
              </div>

              {/* Day headers */}
              <div className="mb-3 grid grid-cols-7 gap-1 text-center text-xs text-gray-500">
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                  <div key={i}>{d}</div>
                ))}
              </div>

              {/* Calendar grid — Oct 2023 starts on Sunday */}
              <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-300">
                {CALENDAR_DAYS.map((cell) => {
                  const isSpecial = cell.state !== "normal";
                  return (
                    <div
                      key={cell.day}
                      title={cell.tooltip}
                      className={cn(
                        "rounded-md p-1.5",
                        cell.state === "amc_expiring" &&
                          "cursor-pointer border border-red-500/30 bg-red-500/20 font-bold text-red-400",
                        cell.state === "calibration" &&
                          "cursor-pointer border border-orange-500/30 bg-orange-500/20 font-bold text-orange-400",
                        !isSpecial && "opacity-30",
                      )}
                    >
                      {cell.day}
                    </div>
                  );
                })}
              </div>

              {/* Cost footer */}
              <div className="mt-4 border-t border-dark-border pt-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">
                    Est. Renewal Cost (Oct)
                  </span>
                  <span className="font-mono font-bold text-white">
                    &#8377; 4,25,000
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
