"use client";

import {
  Bus,
  BriefcaseMedical,
  Moon,
  Clock,
  MapPin,
  User,
  Car,
  Search,
  Plus,
  Armchair,
  Wrench,
  Filter,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
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
  TransportRoute,
  VehicleFleetRow,
  VehicleStatus,
  MaintenanceLogEntry,
} from "@/types/admin";

// ---------------------------------------------------------------------------
// TODO: Replace with API call — GET /api/v1/admin/facilities/transport
// ---------------------------------------------------------------------------

const ROUTE_ICONS: Record<string, LucideIcon> = {
  shuttle: Bus,
  medical: BriefcaseMedical,
  night: Moon,
};

const ROUTES: TransportRoute[] = [
  {
    id: "r1",
    title: "Campus - Hospital Shuttle",
    description: "Regular service for clinical rotations",
    iconKey: "shuttle",
    badge: "Active",
    details: [
      { label: "Next Dep.", value: "08:30 AM" },
      { label: "Vehicles", value: "4 Active" },
      { label: "Lead Driver", value: "Rajesh K." },
    ],
  },
  {
    id: "r2",
    title: "RHTC (Rural Center)",
    description: "Weekly community medicine visit",
    iconKey: "medical",
    badge: "Scheduled",
    details: [
      { label: "Departure", value: "09:00 AM (Fri)" },
      { label: "Vehicles", value: "2 Buses" },
      { label: "Coordinator", value: "Dr. Menon" },
    ],
  },
  {
    id: "r3",
    title: "Night Duty Transport",
    description: "Emergency & late shift drop-offs",
    iconKey: "night",
    badge: "On Call",
    details: [
      { label: "Shift", value: "8 PM - 6 AM" },
      { label: "Vehicles", value: "1 Van" },
      { label: "On Duty", value: "Suresh M." },
    ],
  },
];

const DETAIL_ICONS: Record<string, LucideIcon> = {
  "Next Dep.": Clock,
  Departure: Clock,
  Shift: Clock,
  Vehicles: MapPin,
  "Lead Driver": User,
  Coordinator: User,
  "On Duty": User,
};

const VEHICLES: VehicleFleetRow[] = [
  {
    id: "v1",
    vehicleNo: "TN-01-AB-1234",
    type: "Bus (Non-AC)",
    capacity: "52 Seats",
    currentRoute: "Campus - Hospital",
    driver: "Rajesh Kumar",
    status: "active",
  },
  {
    id: "v2",
    vehicleNo: "TN-01-XY-9876",
    type: "Mini Van",
    capacity: "12 Seats",
    currentRoute: null,
    driver: "Suresh M.",
    status: "idle",
  },
  {
    id: "v3",
    vehicleNo: "TN-01-CC-4521",
    type: "Bus (AC)",
    capacity: "48 Seats",
    currentRoute: "RHTC Trip",
    driver: "Manoj Singh",
    status: "maintenance",
  },
  {
    id: "v4",
    vehicleNo: "TN-01-AB-2222",
    type: "Ambulance",
    capacity: "2 Stretchers",
    currentRoute: "Emergency Standby",
    driver: "Prakash D.",
    status: "active",
  },
];

const VEHICLE_STATUS_BADGE: Record<
  VehicleStatus,
  { label: string; classes: string }
> = {
  active: {
    label: "Active",
    classes: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  idle: {
    label: "Idle",
    classes: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  },
  maintenance: {
    label: "Maintenance",
    classes: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  },
};

const MAINTENANCE_LOG: MaintenanceLogEntry[] = [
  {
    id: "ml1",
    date: "Oct 24, 2023",
    vehicle: "TN-01-CC-4521",
    serviceType: "Engine Breakdown",
    serviceColor: "bg-red-500",
    cost: "12,500",
  },
  {
    id: "ml2",
    date: "Oct 20, 2023",
    vehicle: "TN-01-AB-1234",
    serviceType: "Routine Service",
    serviceColor: "bg-blue-500",
    cost: "4,200",
  },
  {
    id: "ml3",
    date: "Oct 18, 2023",
    vehicle: "TN-01-XY-9876",
    serviceType: "Tire Replacement",
    serviceColor: "bg-yellow-500",
    cost: "8,000",
  },
  {
    id: "ml4",
    date: "Oct 15, 2023",
    vehicle: "TN-01-AB-2222",
    serviceType: "Oil Change",
    serviceColor: "bg-blue-500",
    cost: "2,500",
  },
];

// ---------------------------------------------------------------------------

export default function TransportPage() {
  return (
    <div className="flex h-[calc(100vh-64px)] flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-dark-border bg-dark-surface px-6">
        <nav className="flex items-center text-sm font-medium text-gray-400">
          <span className="cursor-pointer hover:text-white">Facilities</span>
          <span className="mx-2 text-gray-600">/</span>
          <span className="font-semibold text-white">
            Transport Management
          </span>
        </nav>
        <div className="flex items-center gap-4">
          <div className="flex items-center rounded-lg border border-dark-border bg-dark-surface p-1">
            <button className="flex items-center gap-2 rounded bg-[#262626] px-3 py-1.5 text-xs font-medium text-white shadow-sm">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              Live Status
            </button>
            <button className="rounded px-3 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:text-white">
              Reports
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 space-y-6 overflow-auto p-6">
        {/* Route Management */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight text-white">
              Route Management
            </h2>
            <div className="flex gap-2">
              <button className="rounded-full p-1 text-gray-400 transition-colors hover:bg-[#262626]">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button className="rounded-full p-1 text-gray-400 transition-colors hover:bg-[#262626]">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {ROUTES.map((route) => {
              const RouteIcon = ROUTE_ICONS[route.iconKey] ?? Bus;
              return (
                <div
                  key={route.id}
                  className="group rounded-xl border border-dark-border bg-dark-surface p-5 transition-colors hover:border-emerald-500/30"
                >
                  <div className="mb-4 flex items-start justify-between">
                    <div className="rounded-lg bg-emerald-500/10 p-2">
                      <RouteIcon className="h-5 w-5 text-emerald-500" />
                    </div>
                    <span className="rounded border border-dark-border bg-[#262626] px-2 py-1 text-xs text-gray-300">
                      {route.badge}
                    </span>
                  </div>
                  <h3 className="mb-1 text-base font-semibold text-white">
                    {route.title}
                  </h3>
                  <p className="mb-4 text-xs text-gray-500">
                    {route.description}
                  </p>
                  <div className="space-y-2">
                    {route.details.map((d) => {
                      const DetailIcon = DETAIL_ICONS[d.label] ?? Clock;
                      return (
                        <div
                          key={d.label}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="flex items-center gap-2 text-gray-400">
                            <DetailIcon className="h-4 w-4" />
                            {d.label}
                          </span>
                          <span className="font-medium text-white">
                            {d.value}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Vehicle Fleet Table */}
        <div className="overflow-hidden rounded-xl border border-dark-border bg-dark-surface">
          <div className="flex items-center justify-between border-b border-dark-border px-6 py-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-white">
              <Car className="h-5 w-5 text-gray-400" /> Vehicle Fleet
            </h3>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-[18px] w-[18px] text-gray-500" />
                <input
                  type="text"
                  placeholder="Search vehicle..."
                  className="w-48 rounded-lg border border-dark-border bg-[#262626] py-2 pl-9 pr-3 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" /> Add Vehicle
              </Button>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-dark-border bg-[#262626]">
                <TableHead className="text-gray-500">Vehicle No.</TableHead>
                <TableHead className="text-gray-500">Type</TableHead>
                <TableHead className="text-gray-500">Capacity</TableHead>
                <TableHead className="text-gray-500">Current Route</TableHead>
                <TableHead className="text-gray-500">Driver</TableHead>
                <TableHead className="text-right text-gray-500">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {VEHICLES.map((v) => {
                const badge = VEHICLE_STATUS_BADGE[v.status];
                return (
                  <TableRow
                    key={v.id}
                    className="border-dark-border transition-colors hover:bg-[#262626]/50"
                  >
                    <TableCell className="font-medium text-white">
                      {v.vehicleNo}
                    </TableCell>
                    <TableCell>{v.type}</TableCell>
                    <TableCell>{v.capacity}</TableCell>
                    <TableCell>
                      {v.currentRoute ?? (
                        <span className="italic text-gray-600">None</span>
                      )}
                    </TableCell>
                    <TableCell>{v.driver}</TableCell>
                    <TableCell className="text-right">
                      <span
                        className={cn(
                          "rounded border px-2 py-0.5 text-xs",
                          badge.classes,
                        )}
                      >
                        {badge.label}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Trip Booking + Maintenance Log */}
        <div className="grid grid-cols-12 gap-6">
          {/* Trip Booking Form */}
          <div className="col-span-12 rounded-xl border border-dark-border bg-dark-surface p-6 lg:col-span-5">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                <Armchair className="h-5 w-5 text-gray-400" /> Trip Booking
              </h3>
              <span className="cursor-pointer text-xs font-medium text-emerald-500 hover:underline">
                View All Requests
              </span>
            </div>
            <form className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-400">
                  Department
                </label>
                <select className="w-full rounded-lg border border-dark-border bg-[#262626] px-3 py-2.5 text-sm text-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                  <option>Community Medicine (RHTC)</option>
                  <option>Forensic Medicine</option>
                  <option>Anatomy (Field Visit)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-400">
                    Date
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-dark-border bg-[#262626] px-3 py-2.5 text-sm text-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-400">
                    Time
                  </label>
                  <input
                    type="time"
                    className="w-full rounded-lg border border-dark-border bg-[#262626] px-3 py-2.5 text-sm text-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-400">
                  Student Count
                </label>
                <input
                  type="number"
                  placeholder="Enter number of students"
                  className="w-full rounded-lg border border-dark-border bg-[#262626] px-3 py-2.5 text-sm text-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div className="pt-2">
                <Button type="button" className="w-full shadow-sm">
                  Request Vehicle
                </Button>
              </div>
            </form>
          </div>

          {/* Maintenance Log */}
          <div className="col-span-12 flex flex-col overflow-hidden rounded-xl border border-dark-border bg-dark-surface lg:col-span-7">
            <div className="flex items-center justify-between border-b border-dark-border px-6 py-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                <Wrench className="h-5 w-5 text-gray-400" /> Maintenance Log
              </h3>
              <button className="text-gray-400 transition-colors hover:text-white">
                <Filter className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[#262626] font-semibold text-gray-500">
                  <tr>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Vehicle</th>
                    <th className="px-6 py-3">Service Type</th>
                    <th className="px-6 py-3 text-right">Cost (&#8377;)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-border bg-dark-surface text-gray-300">
                  {MAINTENANCE_LOG.map((entry) => (
                    <tr
                      key={entry.id}
                      className="transition-colors hover:bg-[#262626]/50"
                    >
                      <td className="px-6 py-3 text-gray-400">{entry.date}</td>
                      <td className="px-6 py-3 font-medium">
                        {entry.vehicle}
                      </td>
                      <td className="px-6 py-3">
                        <span className="flex items-center gap-2">
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              entry.serviceColor,
                            )}
                          />
                          {entry.serviceType}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right font-mono text-gray-300">
                        {entry.cost}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-dark-border bg-[#262626]/20 px-6 py-3">
              <span className="text-xs text-gray-500">Total Monthly Cost</span>
              <span className="text-sm font-bold text-white">&#8377; 27,200</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
