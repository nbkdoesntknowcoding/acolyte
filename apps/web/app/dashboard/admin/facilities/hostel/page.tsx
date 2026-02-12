"use client";

import {
  Building2,
  Users,
  BedDouble,
  ShieldCheck,
  MoreVertical,
  Wrench,
  Croissant,
  UtensilsCrossed,
  CookingPot,
  Receipt,
  IdCard,
  Ambulance,
  Bus,
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
import { cn } from "@/lib/utils";
import type {
  HostelRoom,
  HostelRoomStatus,
  HostelAllocationRow,
  MessMealCount,
  DutyRosterEntry,
} from "@/types/admin";

// ---------------------------------------------------------------------------
// TODO: Replace with API call — GET /api/v1/admin/facilities/hostel
// ---------------------------------------------------------------------------

const STAT_CARDS = [
  {
    label: "Total Capacity",
    value: "680",
    icon: Building2,
    iconColor: "text-blue-500",
    iconBg: "bg-blue-500/10",
  },
  {
    label: "Occupied",
    value: "612",
    extra: "(90%)",
    extraColor: "text-emerald-500",
    icon: Users,
    iconColor: "text-emerald-500",
    iconBg: "bg-emerald-500/10",
  },
  {
    label: "Available",
    value: "68",
    icon: BedDouble,
    iconColor: "text-orange-500",
    iconBg: "bg-orange-500/10",
  },
];

const HOSTEL_TABS = [
  "Boys Hostel 1 (UG)",
  "Boys Hostel 2 (PG)",
  "Girls Hostel 1 (UG)",
  "Freshers Block",
];

const ROOM_STATUS_CLASSES: Record<HostelRoomStatus, string> = {
  occupied:
    "bg-blue-600/20 border border-blue-600/40 text-blue-400 hover:bg-blue-600/30",
  available:
    "bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/20",
  maintenance:
    "bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/20",
};

const ROOMS: HostelRoom[] = [
  { number: "101", status: "occupied" },
  { number: "102", status: "occupied" },
  { number: "103", status: "occupied" },
  { number: "104", status: "occupied" },
  { number: "105", status: "available" },
  { number: "106", status: "available" },
  { number: "107", status: "maintenance", tooltip: "Leaking tap" },
  { number: "108", status: "occupied" },
  { number: "109", status: "occupied" },
  { number: "110", status: "occupied" },
  { number: "111", status: "occupied" },
  { number: "112", status: "occupied" },
];

const ALLOCATIONS: HostelAllocationRow[] = [
  {
    roomNo: "101",
    block: "Boys H1 (UG)",
    occupants: [
      { name: "Arjun Singh", program: "MBBS-I" },
      { name: "Rahul Verma", program: "MBBS-I" },
    ],
    status: "occupied",
  },
  {
    roomNo: "105",
    block: "Boys H1 (UG)",
    occupants: [],
    status: "available",
  },
  {
    roomNo: "107",
    block: "Boys H1 (UG)",
    occupants: [],
    status: "maintenance",
  },
];

const ALLOCATION_STATUS_BADGE: Record<
  HostelRoomStatus,
  { label: string; classes: string }
> = {
  occupied: {
    label: "Occupied",
    classes: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  available: {
    label: "Available",
    classes: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  maintenance: {
    label: "Maintenance",
    classes: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  },
};

const MEALS: MessMealCount[] = [
  {
    id: "m1",
    meal: "Breakfast",
    menu: "Idli & Sambar",
    count: 580,
    status: "consumed",
  },
  {
    id: "m2",
    meal: "Lunch (Live)",
    menu: "Rice, Dal, Veg",
    count: 342,
    status: "live",
  },
  {
    id: "m3",
    meal: "Dinner",
    menu: "Chapati & Paneer",
    count: null,
    status: "upcoming",
  },
];

const MEAL_ICON_MAP: Record<string, { icon: typeof Croissant; color: string; bg: string }> = {
  Breakfast: { icon: Croissant, color: "text-orange-400", bg: "bg-orange-400/10" },
  "Lunch (Live)": { icon: UtensilsCrossed, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  Dinner: { icon: CookingPot, color: "text-blue-400", bg: "bg-blue-400/10" },
};

const DUTY_ROSTER: DutyRosterEntry[] = [
  { shift: "Day (8-4)", warden: "Dr. Rao", contact: "Ext 201" },
  { shift: "Eve (4-12)", warden: "Mr. Das", contact: "Ext 202" },
  { shift: "Night (12-8)", warden: "Mr. Khan", contact: "Ext 203" },
];

// ---------------------------------------------------------------------------

export default function HostelMessPage() {
  return (
    <div className="flex h-[calc(100vh-64px)] flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-dark-border bg-dark-surface px-6">
        <div className="flex items-center gap-2">
          <nav className="flex items-center text-sm font-medium text-gray-400">
            <span className="cursor-pointer hover:text-white">Facilities</span>
            <span className="mx-2 text-gray-600">/</span>
            <span className="font-semibold text-white">
              Hostel &amp; Mess Management
            </span>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center rounded-lg border border-dark-border bg-dark-surface p-1">
            <button className="flex items-center gap-2 rounded bg-[#262626] px-3 py-1.5 text-xs font-medium text-white shadow-sm">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
              Live
            </button>
            <button className="rounded px-3 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:text-white">
              Archive
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 space-y-6 overflow-auto p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {STAT_CARDS.map((card) => (
            <div
              key={card.label}
              className="flex items-center justify-between rounded-xl border border-dark-border bg-dark-surface p-4"
            >
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {card.label}
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-white">{card.value}</p>
                  {card.extra && (
                    <span className={cn("text-sm font-medium", card.extraColor)}>
                      {card.extra}
                    </span>
                  )}
                </div>
              </div>
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full",
                  card.iconBg,
                )}
              >
                <card.icon className={cn("h-5 w-5", card.iconColor)} />
              </div>
            </div>
          ))}

          {/* Compliance card */}
          <div className="group relative flex items-center justify-between overflow-hidden rounded-xl border border-dark-border bg-dark-surface p-4">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent" />
            <div className="relative z-10">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Compliance
              </p>
              <div className="mt-1 flex items-center gap-2">
                <p className="text-xl font-bold text-white">NMC Compliant</p>
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Main 12-Col Grid */}
        <div className="grid grid-cols-12 gap-6">
          {/* Left — Room Grid + Allocations Table */}
          <div className="col-span-12 space-y-6 xl:col-span-8">
            {/* Room Grid */}
            <div className="overflow-hidden rounded-xl border border-dark-border bg-dark-surface">
              {/* Hostel Tabs + Legend */}
              <div className="flex items-center justify-between border-b border-dark-border bg-[#262626]/30 px-4 pt-3">
                <div className="flex gap-4">
                  {HOSTEL_TABS.map((tab, i) => (
                    <button
                      key={tab}
                      className={cn(
                        "border-b-2 px-2 pb-3 text-sm font-medium transition-colors",
                        i === 0
                          ? "border-emerald-500 text-white"
                          : "border-transparent text-gray-400 hover:text-gray-300",
                      )}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 pb-2">
                  <span className="flex items-center gap-1.5 text-xs text-gray-400">
                    <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                    Available
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-gray-400">
                    <span className="h-2.5 w-2.5 rounded-sm bg-blue-600" />
                    Occupied
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-gray-400">
                    <span className="h-2.5 w-2.5 rounded-sm bg-yellow-500" />
                    Maint.
                  </span>
                </div>
              </div>

              {/* Floor Selector + Room Grid */}
              <div className="p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-300">
                    Floor 1 - Wing A
                  </h3>
                  <select className="rounded border border-dark-border bg-[#262626] px-2 py-1 text-xs text-gray-300 focus:border-emerald-500 focus:outline-none">
                    <option>Floor 1</option>
                    <option>Floor 2</option>
                    <option>Floor 3</option>
                  </select>
                </div>
                <div
                  className="grid gap-2"
                  style={{
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(60px, 1fr))",
                  }}
                >
                  {ROOMS.map((room) => (
                    <div
                      key={room.number}
                      title={room.tooltip}
                      className={cn(
                        "flex aspect-square cursor-pointer items-center justify-center rounded text-xs font-medium",
                        ROOM_STATUS_CLASSES[room.status],
                      )}
                    >
                      {room.number}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Allocations & Status */}
            <div className="overflow-hidden rounded-xl border border-dark-border bg-dark-surface">
              <div className="flex items-center justify-between border-b border-dark-border px-6 py-4">
                <h3 className="text-sm font-bold text-white">
                  Recent Allocations &amp; Status
                </h3>
                <button className="text-xs font-medium text-emerald-500 hover:text-emerald-400">
                  View All
                </button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-dark-border bg-[#262626]">
                    <TableHead className="text-gray-500">Room No</TableHead>
                    <TableHead className="text-gray-500">Block</TableHead>
                    <TableHead className="text-gray-500">Occupants</TableHead>
                    <TableHead className="text-gray-500">Status</TableHead>
                    <TableHead className="text-right text-gray-500">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ALLOCATIONS.map((row) => {
                    const badge = ALLOCATION_STATUS_BADGE[row.status];
                    return (
                      <TableRow
                        key={row.roomNo}
                        className="border-dark-border transition-colors hover:bg-[#262626]/50"
                      >
                        <TableCell className="font-medium text-white">
                          {row.roomNo}
                        </TableCell>
                        <TableCell>{row.block}</TableCell>
                        <TableCell>
                          {row.occupants.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              {row.occupants.map((o) => (
                                <span
                                  key={o.name}
                                  className="cursor-pointer text-emerald-500 hover:underline"
                                >
                                  {o.name} ({o.program})
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="italic text-gray-600">None</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "rounded border px-2 py-0.5 text-xs",
                              badge.classes,
                            )}
                          >
                            {badge.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {row.status === "available" ? (
                            <button className="rounded bg-[#262626] px-2 py-1 text-xs text-white transition-colors hover:bg-gray-700">
                              Allocate
                            </button>
                          ) : row.status === "maintenance" ? (
                            <button className="text-gray-500 hover:text-white">
                              <Wrench className="h-4 w-4" />
                            </button>
                          ) : (
                            <button className="text-gray-500 hover:text-white">
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Right Sidebar — Mess + Duty + Transport */}
          <div className="col-span-12 space-y-6 xl:col-span-4">
            {/* Today's Mess Count */}
            <div className="rounded-xl border border-dark-border bg-dark-surface p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">
                  Today&apos;s Mess Count
                </h3>
                <span className="text-xs text-gray-500">24 Oct, 2023</span>
              </div>
              <div className="space-y-3">
                {MEALS.map((meal) => {
                  const mealStyle = MEAL_ICON_MAP[meal.meal];
                  const MealIcon = mealStyle?.icon ?? UtensilsCrossed;
                  const isLive = meal.status === "live";
                  const isUpcoming = meal.status === "upcoming";

                  return (
                    <div
                      key={meal.id}
                      className={cn(
                        "relative flex items-center justify-between rounded-lg border border-dark-border bg-[#262626]/50 p-3",
                        isUpcoming && "opacity-70",
                      )}
                    >
                      {isLive && (
                        <div className="absolute bottom-0 left-0 top-0 w-1 rounded-l bg-emerald-500" />
                      )}
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "rounded-lg p-1.5",
                            mealStyle?.bg ?? "bg-gray-500/10",
                          )}
                        >
                          <MealIcon
                            className={cn(
                              "h-5 w-5",
                              mealStyle?.color ?? "text-gray-400",
                            )}
                          />
                        </div>
                        <div>
                          <p className="text-xs uppercase text-gray-400">
                            {meal.meal}
                          </p>
                          <p className="text-sm font-semibold text-white">
                            {meal.menu}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-white">
                          {meal.count ?? "--"}
                        </p>
                        <p
                          className={cn(
                            "text-[10px]",
                            meal.status === "consumed" && "text-green-500",
                            meal.status === "live" && "text-emerald-500",
                            meal.status === "upcoming" && "text-gray-500",
                          )}
                        >
                          {meal.status === "consumed"
                            ? "Consumed"
                            : meal.status === "live"
                              ? "Scanning..."
                              : "Upcoming"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Button className="mt-4 w-full shadow-lg shadow-emerald-500/20">
                <Receipt className="mr-2 h-4 w-4" /> Generate Mess Billing
              </Button>
            </div>

            {/* Duty Roster */}
            <div className="rounded-xl border border-dark-border bg-dark-surface p-5">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
                <IdCard className="h-5 w-5 text-gray-400" /> Duty Roster
              </h3>
              <div className="overflow-hidden rounded-lg border border-dark-border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#262626] font-semibold text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Shift</th>
                      <th className="px-3 py-2">Warden</th>
                      <th className="px-3 py-2">Contact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-border bg-dark-surface">
                    {DUTY_ROSTER.map((entry) => (
                      <tr key={entry.shift}>
                        <td className="px-3 py-2 text-gray-400">
                          {entry.shift}
                        </td>
                        <td className="px-3 py-2 text-white">
                          {entry.warden}
                        </td>
                        <td className="px-3 py-2 font-mono text-emerald-500">
                          {entry.contact}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Night Duty Transport */}
            <div className="rounded-xl border border-dark-border bg-dark-surface p-5">
              <div className="mb-3 flex items-start justify-between">
                <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                  <Ambulance className="h-5 w-5 text-gray-400" /> Night Duty
                  Transport
                </h3>
                <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-500">
                  Active
                </span>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-dark-border bg-[#262626]/30 p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-800">
                  <Bus className="h-5 w-5 text-gray-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    Van TN-01-AB-1234
                  </p>
                  <p className="text-xs text-gray-500">
                    Driver: Suresh K. &bull;{" "}
                    <span className="text-emerald-500">On Campus</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
