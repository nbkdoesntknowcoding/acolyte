"use client";

import { useState, useMemo } from "react";
import {
  Bus,
  BriefcaseMedical,
  Moon,
  MapPin,
  Car,
  Search,
  Plus,
  Wrench,
  Filter,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  X,
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
import {
  useVehicles,
  useTransportRoutes,
  useTransportBookings,
  useVehicleMaintenanceLogs,
  useCreateTransportBooking,
} from "@/lib/hooks/admin/use-transport";
import { useDepartments } from "@/lib/hooks/admin/use-departments";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROUTE_ICONS: Record<string, typeof Bus> = {
  shuttle: Bus,
  medical: BriefcaseMedical,
  night: Moon,
  regular: Bus,
};

const VEHICLE_STATUS_BADGE: Record<
  string,
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
  retired: {
    label: "Retired",
    classes: "bg-red-500/10 text-red-400 border-red-500/20",
  },
};

const MAINTENANCE_TYPE_COLORS: Record<string, string> = {
  scheduled: "bg-blue-500",
  service: "bg-blue-500",
  repair: "bg-red-500",
  breakdown: "bg-red-500",
  tire: "bg-yellow-500",
  oil: "bg-blue-500",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TransportPage() {
  const [addVehicleOpen, setAddVehicleOpen] = useState(false);
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [bookingForm, setBookingForm] = useState({
    department_id: "",
    booking_date: "",
    departure_time: "",
    num_passengers: "",
    purpose: "",
  });
  const [banner, setBanner] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);

  // -- Data -----------------------------------------------------------------

  const { data: routesData } = useTransportRoutes({
    page_size: 50,
    is_active: true,
  });
  const routes = useMemo(() => routesData?.data ?? [], [routesData?.data]);

  const { data: vehiclesData } = useVehicles({ page_size: 100 });
  const vehicles = useMemo(() => vehiclesData?.data ?? [], [vehiclesData?.data]);

  const { data: bookingsData } = useTransportBookings({
    page_size: 20,
    status: "requested",
  });
  const bookings = bookingsData?.data ?? [];

  const { data: maintenanceData } = useVehicleMaintenanceLogs(
    { vehicle_id: selectedVehicleId || undefined, page_size: 50 },
    { enabled: !!selectedVehicleId },
  );
  const maintenanceLogs = maintenanceData?.data ?? [];

  const { data: deptsData } = useDepartments({ page_size: 100 });

  const createBooking = useCreateTransportBooking();

  // -- Computed -------------------------------------------------------------

  const vehicleMap = useMemo(() => {
    const m = new Map<string, string>();
    vehicles.forEach((v) => m.set(v.id, v.vehicle_number));
    return m;
  }, [vehicles]);

  // Check for expired insurance/fitness
  const today = new Date();
  const vehiclesWithExpiry = vehicles.map((v) => {
    const insExpired = v.insurance_expiry
      ? new Date(v.insurance_expiry) < today
      : false;
    const fitExpired = v.fitness_certificate_expiry
      ? new Date(v.fitness_certificate_expiry) < today
      : false;
    return { ...v, insExpired, fitExpired };
  });

  const filteredVehicles = vehiclesWithExpiry.filter((v) =>
    v.vehicle_number.toLowerCase().includes(vehicleSearch.toLowerCase()),
  );

  // Total monthly maintenance cost
  const totalMaintenanceCost =
    maintenanceLogs.reduce((sum, log) => sum + (log.cost ?? 0), 0) / 100; // paisa to rupees

  // -- Handlers -------------------------------------------------------------

  async function handleCreateBooking(e: React.FormEvent) {
    e.preventDefault();
    setBanner(null);
    try {
      await createBooking.mutateAsync({
        department_id: bookingForm.department_id || null,
        booking_date: bookingForm.booking_date,
        departure_time: bookingForm.departure_time || null,
        num_passengers: bookingForm.num_passengers
          ? Number(bookingForm.num_passengers)
          : null,
        purpose: bookingForm.purpose || null,
      });
      setBanner({ type: "success", msg: "Booking request submitted." });
      setBookingForm({
        department_id: "",
        booking_date: "",
        departure_time: "",
        num_passengers: "",
        purpose: "",
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to create booking.";
      setBanner({ type: "error", msg });
    }
  }

  // -- Render ---------------------------------------------------------------

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
      </div>

      {/* Banner */}
      {banner && (
        <div
          className={cn(
            "px-6 py-2 text-sm",
            banner.type === "success"
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-red-500/10 text-red-400",
          )}
        >
          {banner.msg}
          <button
            className="ml-4 underline"
            onClick={() => setBanner(null)}
          >
            dismiss
          </button>
        </div>
      )}

      {/* Scrollable Content */}
      <div className="flex-1 space-y-6 overflow-auto p-6">
        {/* Route Management */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight text-white">
              Route Management
            </h2>
            {routes.length > 3 && (
              <div className="flex gap-2">
                <button className="rounded-full p-1 text-gray-400 transition-colors hover:bg-[#262626]">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button className="rounded-full p-1 text-gray-400 transition-colors hover:bg-[#262626]">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>
          {routes.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">
              No active routes found
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {routes.slice(0, 6).map((route) => {
                const RouteIcon =
                  ROUTE_ICONS[route.route_type?.toLowerCase() ?? ""] ?? Bus;
                const assignedVehicle = route.vehicle_id
                  ? vehicleMap.get(route.vehicle_id)
                  : null;

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
                        {route.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <h3 className="mb-1 text-base font-semibold text-white">
                      {route.name}
                    </h3>
                    <p className="mb-4 text-xs text-gray-500">
                      {route.route_type ?? "—"}
                    </p>
                    <div className="space-y-2">
                      {route.origin && route.destination && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 text-gray-400">
                            <MapPin className="h-4 w-4" />
                            Route
                          </span>
                          <span className="truncate font-medium text-white">
                            {route.origin} → {route.destination}
                          </span>
                        </div>
                      )}
                      {route.distance_km && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 text-gray-400">
                            <MapPin className="h-4 w-4" />
                            Distance
                          </span>
                          <span className="font-medium text-white">
                            {route.distance_km} km
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-gray-400">
                          <Car className="h-4 w-4" />
                          Vehicle
                        </span>
                        <span className="truncate font-medium text-white">
                          {assignedVehicle ?? "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
                  value={vehicleSearch}
                  onChange={(e) => setVehicleSearch(e.target.value)}
                  placeholder="Search vehicle..."
                  className="w-48 rounded-lg border border-dark-border bg-[#262626] py-2 pl-9 pr-3 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <Button size="sm" onClick={() => setAddVehicleOpen(true)}>
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
                <TableHead className="text-gray-500">Driver</TableHead>
                <TableHead className="text-gray-500">Insurance</TableHead>
                <TableHead className="text-gray-500">Fitness</TableHead>
                <TableHead className="text-right text-gray-500">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVehicles.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-8 text-center text-gray-500"
                  >
                    No vehicles found
                  </TableCell>
                </TableRow>
              ) : (
                filteredVehicles.map((v) => {
                  const badge =
                    VEHICLE_STATUS_BADGE[v.status] ??
                    VEHICLE_STATUS_BADGE.active;
                  return (
                    <TableRow
                      key={v.id}
                      onClick={() => setSelectedVehicleId(v.id)}
                      className="cursor-pointer border-dark-border transition-colors hover:bg-[#262626]/50"
                    >
                      <TableCell className="font-medium text-white">
                        {v.vehicle_number}
                      </TableCell>
                      <TableCell>{v.vehicle_type ?? "—"}</TableCell>
                      <TableCell>
                        {v.capacity ? `${v.capacity} Seats` : "—"}
                      </TableCell>
                      <TableCell>{v.driver_name ?? "—"}</TableCell>
                      <TableCell>
                        {v.insurance_expiry ? (
                          <span
                            className={cn(
                              "text-xs",
                              v.insExpired
                                ? "flex items-center gap-1 text-red-400"
                                : "text-gray-400",
                            )}
                          >
                            {v.insExpired && (
                              <AlertTriangle className="h-3 w-3" />
                            )}
                            {new Date(v.insurance_expiry).toLocaleDateString(
                              "en-IN",
                              { month: "short", year: "numeric" },
                            )}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {v.fitness_certificate_expiry ? (
                          <span
                            className={cn(
                              "text-xs",
                              v.fitExpired
                                ? "flex items-center gap-1 text-red-400"
                                : "text-gray-400",
                            )}
                          >
                            {v.fitExpired && (
                              <AlertTriangle className="h-3 w-3" />
                            )}
                            {new Date(
                              v.fitness_certificate_expiry,
                            ).toLocaleDateString("en-IN", {
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
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
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Trip Booking + Maintenance Log */}
        <div className="grid grid-cols-12 gap-6">
          {/* Trip Booking Form */}
          <div className="col-span-12 rounded-xl border border-dark-border bg-dark-surface p-6 lg:col-span-5">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                <Bus className="h-5 w-5 text-gray-400" /> Trip Booking
              </h3>
              <span className="text-xs text-gray-500">
                {bookings.length} pending
              </span>
            </div>
            <form onSubmit={handleCreateBooking} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-400">
                  Department
                </label>
                <select
                  value={bookingForm.department_id}
                  onChange={(e) =>
                    setBookingForm((prev) => ({
                      ...prev,
                      department_id: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-dark-border bg-[#262626] px-3 py-2.5 text-sm text-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">Select department</option>
                  {deptsData?.data?.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-400">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={bookingForm.booking_date}
                    onChange={(e) =>
                      setBookingForm((prev) => ({
                        ...prev,
                        booking_date: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-dark-border bg-[#262626] px-3 py-2.5 text-sm text-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-400">
                    Time
                  </label>
                  <input
                    type="time"
                    value={bookingForm.departure_time}
                    onChange={(e) =>
                      setBookingForm((prev) => ({
                        ...prev,
                        departure_time: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-dark-border bg-[#262626] px-3 py-2.5 text-sm text-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-400">
                  Passenger Count
                </label>
                <input
                  type="number"
                  value={bookingForm.num_passengers}
                  onChange={(e) =>
                    setBookingForm((prev) => ({
                      ...prev,
                      num_passengers: e.target.value,
                    }))
                  }
                  placeholder="Enter number of passengers"
                  className="w-full rounded-lg border border-dark-border bg-[#262626] px-3 py-2.5 text-sm text-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-400">
                  Purpose
                </label>
                <input
                  type="text"
                  value={bookingForm.purpose}
                  onChange={(e) =>
                    setBookingForm((prev) => ({
                      ...prev,
                      purpose: e.target.value,
                    }))
                  }
                  placeholder="Purpose of trip"
                  className="w-full rounded-lg border border-dark-border bg-[#262626] px-3 py-2.5 text-sm text-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full shadow-sm"
                  disabled={createBooking.isPending}
                >
                  {createBooking.isPending
                    ? "Submitting…"
                    : "Request Vehicle"}
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
              {selectedVehicleId ? (
                <button
                  onClick={() => setSelectedVehicleId("")}
                  className="text-xs text-emerald-500 hover:underline"
                >
                  Show All
                </button>
              ) : (
                <button className="text-gray-400 transition-colors hover:text-white">
                  <Filter className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[#262626] font-semibold text-gray-500">
                  <tr>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Vehicle</th>
                    <th className="px-6 py-3">Service Type</th>
                    <th className="px-6 py-3 text-right">Cost (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-border bg-dark-surface text-gray-300">
                  {maintenanceLogs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-8 text-center text-gray-500"
                      >
                        {selectedVehicleId
                          ? "No maintenance records for this vehicle"
                          : "Select a vehicle to view maintenance logs"}
                      </td>
                    </tr>
                  ) : (
                    maintenanceLogs.map((entry) => {
                      const color =
                        MAINTENANCE_TYPE_COLORS[
                          entry.maintenance_type?.toLowerCase() ?? ""
                        ] ?? "bg-gray-500";
                      const vehicle = vehicleMap.get(entry.vehicle_id) ?? "—";
                      return (
                        <tr
                          key={entry.id}
                          className="transition-colors hover:bg-[#262626]/50"
                        >
                          <td className="px-6 py-3 text-gray-400">
                            {entry.date
                              ? new Date(entry.date).toLocaleDateString(
                                  "en-IN",
                                  {
                                    month: "short",
                                    day: "2-digit",
                                    year: "numeric",
                                  },
                                )
                              : "—"}
                          </td>
                          <td className="px-6 py-3 font-medium">{vehicle}</td>
                          <td className="px-6 py-3">
                            <span className="flex items-center gap-2">
                              <span
                                className={cn("h-1.5 w-1.5 rounded-full", color)}
                              />
                              {entry.maintenance_type ?? "—"}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-right font-mono text-gray-300">
                            {entry.cost
                              ? (entry.cost / 100).toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                })
                              : "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {maintenanceLogs.length > 0 && (
              <div className="flex items-center justify-between border-t border-dark-border bg-[#262626]/20 px-6 py-3">
                <span className="text-xs text-gray-500">
                  {selectedVehicleId
                    ? "Vehicle Total"
                    : "Total (Filtered)"}
                </span>
                <span className="text-sm font-bold text-white">
                  ₹{" "}
                  {totalMaintenanceCost.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Vehicle Modal (stub — just closes) */}
      {addVehicleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-xl border border-dark-border bg-dark-surface p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Add Vehicle</h2>
              <button
                onClick={() => setAddVehicleOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500">
              Add vehicle form will be implemented here.
            </p>
            <div className="mt-6 flex justify-end">
              <Button onClick={() => setAddVehicleOpen(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
