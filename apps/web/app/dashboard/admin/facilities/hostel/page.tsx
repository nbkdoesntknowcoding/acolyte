"use client";

import { useState, useMemo } from "react";
import {
  Building2,
  Users,
  BedDouble,
  ShieldCheck,
  MoreVertical,
  IdCard,
  Ambulance,
  Bus,
  Search,
  X,
  AlertTriangle,
  Check,
  UserPlus,
  DoorOpen,
  ChevronDown,
  ChevronUp,
  ExternalLink,
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
  useHostelBlocks,
  useHostelRooms,
  useHostelAllocations,
  useHostelOccupancy,
  useHostelNMCCompliance,
  useAllocateStudent,
} from "@/lib/hooks/admin/use-hostel";
import { useStudents } from "@/lib/hooks/admin/use-students";
import { useFaculty } from "@/lib/hooks/admin/use-faculty";
import { useScanLogs } from "@/lib/hooks/admin/use-scan-logs";
import Link from "next/link";
import type {
  HostelRoomResponse,
  HostelBlockResponse,
} from "@/types/admin-api";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROOM_STATUS_CLASSES: Record<string, string> = {
  available:
    "bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/20",
  full: "bg-blue-600/20 border border-blue-600/40 text-blue-400 hover:bg-blue-600/30",
  maintenance:
    "bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/20",
  reserved:
    "bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20",
};

const STATUS_BADGE: Record<string, { label: string; classes: string }> = {
  available: {
    label: "Available",
    classes: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  full: {
    label: "Full",
    classes: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  maintenance: {
    label: "Maintenance",
    classes: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  },
  reserved: {
    label: "Reserved",
    classes: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  },
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HostelMessPage() {
  const [selectedBlockId, setSelectedBlockId] = useState<string>("");
  const [selectedFloor, setSelectedFloor] = useState<number | "all">("all");
  const [allocateOpen, setAllocateOpen] = useState(false);
  const [allocateRoomId, setAllocateRoomId] = useState<string>("");
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [banner, setBanner] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);
  const [gateOpen, setGateOpen] = useState(true);

  // -- Data -----------------------------------------------------------------

  const { data: blocksData, isLoading: blocksLoading } = useHostelBlocks({
    page_size: 50,
    is_active: true,
  });
  const blocks = useMemo(() => blocksData?.data ?? [], [blocksData?.data]);

  // Auto-select first block
  const activeBlockId = selectedBlockId || blocks[0]?.id || "";

  const { data: roomsData, isLoading: roomsLoading } = useHostelRooms(
    { block_id: activeBlockId, page_size: 200 },
    { enabled: !!activeBlockId },
  );
  const rooms = useMemo(() => roomsData?.data ?? [], [roomsData?.data]);

  const { data: occupancy } = useHostelOccupancy();
  const { data: nmcCompliance } = useHostelNMCCompliance();

  const { data: allocationsData } = useHostelAllocations({
    block_id: activeBlockId || undefined,
    status: "active",
    page_size: 50,
  });
  const allocations = allocationsData?.data ?? [];

  const { data: facultyData } = useFaculty({ page_size: 500 });

  // Student search for allocate modal
  const { data: searchResults } = useStudents(
    { search: studentSearch, page_size: 10 },
    { enabled: studentSearch.length >= 2 },
  );

  const allocate = useAllocateStudent();

  // Gate activity (hostel check-in scan logs)
  const { data: gateScans } = useScanLogs(
    { action_type: "hostel_checkin", page_size: 20 },
    { refetchInterval: 30_000 },
  );

  // -- Computed -------------------------------------------------------------

  const facultyMap = useMemo(() => {
    const m = new Map<string, string>();
    facultyData?.data?.forEach((f) => m.set(f.id, f.name));
    return m;
  }, [facultyData]);

  const studentMap = useMemo(() => {
    const m = new Map<string, string>();
    searchResults?.data?.forEach((s) => m.set(s.id, s.name));
    return m;
  }, [searchResults]);

  // Occupancy totals
  const totalCapacity = occupancy?.reduce((s, b) => s + b.total_beds, 0) ?? 0;
  const totalOccupied = occupancy?.reduce((s, b) => s + b.occupied, 0) ?? 0;
  const totalAvailable = occupancy?.reduce((s, b) => s + b.available, 0) ?? 0;
  const occupancyPct =
    totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0;

  // Floors for selected block
  const floors = useMemo(() => {
    const s = new Set<number>();
    rooms.forEach((r) => s.add(r.floor));
    return Array.from(s).sort((a, b) => a - b);
  }, [rooms]);

  // Filtered rooms by floor
  const filteredRooms =
    selectedFloor === "all"
      ? rooms
      : rooms.filter((r) => r.floor === selectedFloor);

  // Room map for allocation table
  const roomMap = useMemo(() => {
    const m = new Map<string, HostelRoomResponse>();
    rooms.forEach((r) => m.set(r.id, r));
    return m;
  }, [rooms]);

  // Block map for names
  const blockMap = useMemo(() => {
    const m = new Map<string, HostelBlockResponse>();
    blocks.forEach((b) => m.set(b.id, b));
    return m;
  }, [blocks]);

  // Active block
  const activeBlock = blockMap.get(activeBlockId);

  // -- Handlers -------------------------------------------------------------

  function openAllocateModal(roomId?: string) {
    setAllocateRoomId(roomId ?? "");
    setSelectedStudentId("");
    setStudentSearch("");
    setAllocateOpen(true);
  }

  async function handleAllocate() {
    if (!selectedStudentId || !allocateRoomId || !activeBlockId) return;
    setBanner(null);
    try {
      await allocate.mutateAsync({
        student_id: selectedStudentId,
        room_id: allocateRoomId,
        block_id: activeBlockId,
      });
      setBanner({ type: "success", msg: "Student allocated successfully." });
      setAllocateOpen(false);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to allocate student.";
      setBanner({ type: "error", msg });
    }
  }

  // -- Render ---------------------------------------------------------------

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
          <Button size="sm" onClick={() => openAllocateModal()}>
            <UserPlus className="mr-2 h-4 w-4" /> Allocate Student
          </Button>
        </div>
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
        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center justify-between rounded-xl border border-dark-border bg-dark-surface p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Total Capacity
              </p>
              <p className="mt-1 text-2xl font-bold text-white">
                {totalCapacity}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
              <Building2 className="h-5 w-5 text-blue-500" />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-dark-border bg-dark-surface p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Occupied
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <p className="text-2xl font-bold text-white">
                  {totalOccupied}
                </p>
                <span className="text-sm font-medium text-emerald-500">
                  ({occupancyPct}%)
                </span>
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
              <Users className="h-5 w-5 text-emerald-500" />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-dark-border bg-dark-surface p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Available
              </p>
              <p className="mt-1 text-2xl font-bold text-white">
                {totalAvailable}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/10">
              <BedDouble className="h-5 w-5 text-orange-500" />
            </div>
          </div>

          {/* NMC Compliance card */}
          <div className="group relative flex items-center justify-between overflow-hidden rounded-xl border border-dark-border bg-dark-surface p-4">
            <div
              className={cn(
                "absolute inset-0",
                nmcCompliance?.compliant
                  ? "bg-gradient-to-r from-emerald-500/5 to-transparent"
                  : "bg-gradient-to-r from-red-500/5 to-transparent",
              )}
            />
            <div className="relative z-10">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Compliance
              </p>
              <div className="mt-1 flex items-center gap-2">
                {nmcCompliance ? (
                  <>
                    <p className="text-xl font-bold text-white">
                      {nmcCompliance.compliant
                        ? "NMC Compliant"
                        : "Non-Compliant"}
                    </p>
                    {nmcCompliance.compliant ? (
                      <ShieldCheck className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                    )}
                  </>
                ) : (
                  <p className="text-xl font-bold text-gray-500">Loading…</p>
                )}
              </div>
              {nmcCompliance && !nmcCompliance.compliant && (
                <p className="mt-1 text-xs text-red-400">
                  {nmcCompliance.message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Gate Activity Feed */}
        <div className="overflow-hidden rounded-xl border border-dark-border bg-dark-surface">
          <button
            onClick={() => setGateOpen(!gateOpen)}
            className="flex w-full items-center justify-between border-b border-dark-border px-6 py-3"
          >
            <h3 className="flex items-center gap-2 text-sm font-bold text-white">
              <DoorOpen className="h-5 w-5 text-emerald-500" />
              Gate Activity
              {gateScans && (
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">
                  {gateScans.length} recent
                </span>
              )}
            </h3>
            {gateOpen ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
          </button>
          {gateOpen && (
            <div className="divide-y divide-dark-border">
              {!gateScans || gateScans.length === 0 ? (
                <p className="px-6 py-6 text-center text-sm text-gray-500">
                  No recent gate activity
                </p>
              ) : (
                <>
                  {gateScans.slice(0, 10).map((scan) => {
                    const time = new Date(scan.scanned_at).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    const isFail = scan.validation_result !== "success";
                    // Check curfew (after 10 PM or before 5 AM)
                    const hour = new Date(scan.scanned_at).getHours();
                    const isCurfew = hour >= 22 || hour < 5;

                    return (
                      <div
                        key={scan.id}
                        className={cn(
                          "flex items-center gap-3 px-6 py-2.5",
                          isFail
                            ? "bg-red-500/5"
                            : isCurfew
                              ? "bg-amber-500/5"
                              : "",
                        )}
                      >
                        <span className="text-lg">{isFail ? "\u274C" : "\uD83C\uDFE0"}</span>
                        <div className="min-w-0 flex-1">
                          <span className="text-sm text-white">
                            {isFail ? "Rejected" : "Entry"} — {scan.user_id?.slice(0, 8)}…
                          </span>
                          {isFail && scan.rejection_reason && (
                            <span className="ml-2 text-xs text-red-400">
                              ({scan.rejection_reason})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {isCurfew && !isFail && (
                            <span className="rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-400">
                              Curfew
                            </span>
                          )}
                          <span className="text-xs text-gray-500">{time}</span>
                        </div>
                      </div>
                    );
                  })}
                  <div className="px-6 py-2">
                    <Link
                      href="/dashboard/admin/qr/scan-logs?action_type=hostel_checkin"
                      className="flex items-center gap-1 text-xs text-emerald-500 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" /> View Full Log
                    </Link>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-12 gap-6">
          {/* Left — Room Grid + Allocations Table */}
          <div className="col-span-12 space-y-6 xl:col-span-8">
            {/* Room Grid */}
            <div className="overflow-hidden rounded-xl border border-dark-border bg-dark-surface">
              {/* Block Tabs + Legend */}
              <div className="flex items-center justify-between border-b border-dark-border bg-[#262626]/30 px-4 pt-3">
                <div className="flex gap-4 overflow-x-auto">
                  {blocksLoading ? (
                    <span className="pb-3 text-sm text-gray-500">
                      Loading blocks…
                    </span>
                  ) : blocks.length === 0 ? (
                    <span className="pb-3 text-sm text-gray-500">
                      No hostel blocks found
                    </span>
                  ) : (
                    blocks.map((block) => (
                      <button
                        key={block.id}
                        onClick={() => {
                          setSelectedBlockId(block.id);
                          setSelectedFloor("all");
                        }}
                        className={cn(
                          "whitespace-nowrap border-b-2 px-2 pb-3 text-sm font-medium transition-colors",
                          activeBlockId === block.id
                            ? "border-emerald-500 text-white"
                            : "border-transparent text-gray-400 hover:text-gray-300",
                        )}
                      >
                        {block.name}
                      </button>
                    ))
                  )}
                </div>
                <div className="flex items-center gap-2 pb-2">
                  <span className="flex items-center gap-1.5 text-xs text-gray-400">
                    <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                    Available
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-gray-400">
                    <span className="h-2.5 w-2.5 rounded-sm bg-blue-600" />
                    Full
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
                    {activeBlock?.name ?? "Rooms"}
                    {selectedFloor !== "all" && ` — Floor ${selectedFloor}`}
                  </h3>
                  <div className="flex items-center gap-3">
                    {activeBlock && (
                      <span className="text-xs text-gray-500">
                        Warden:{" "}
                        {activeBlock.warden_faculty_id
                          ? (facultyMap.get(activeBlock.warden_faculty_id) ??
                            "—")
                          : "—"}
                      </span>
                    )}
                    <select
                      value={String(selectedFloor)}
                      onChange={(e) =>
                        setSelectedFloor(
                          e.target.value === "all"
                            ? "all"
                            : Number(e.target.value),
                        )
                      }
                      className="rounded border border-dark-border bg-[#262626] px-2 py-1 text-xs text-gray-300 focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="all">All Floors</option>
                      {floors.map((f) => (
                        <option key={f} value={f}>
                          Floor {f}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {roomsLoading ? (
                  <p className="py-8 text-center text-sm text-gray-500">
                    Loading rooms…
                  </p>
                ) : filteredRooms.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-500">
                    No rooms found
                  </p>
                ) : (
                  <div
                    className="grid gap-2"
                    style={{
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(70px, 1fr))",
                    }}
                  >
                    {filteredRooms.map((room) => (
                      <div
                        key={room.id}
                        onClick={() => {
                          if (room.status === "available") {
                            openAllocateModal(room.id);
                          }
                        }}
                        title={`${room.room_number} — ${room.status} (${room.current_occupancy}/${room.capacity})`}
                        className={cn(
                          "flex aspect-square cursor-pointer flex-col items-center justify-center rounded text-xs font-medium",
                          ROOM_STATUS_CLASSES[room.status] ??
                            ROOM_STATUS_CLASSES.available,
                        )}
                      >
                        <span>{room.room_number}</span>
                        <span className="text-[9px] opacity-70">
                          {room.current_occupancy}/{room.capacity}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Allocations Table */}
            <div className="overflow-hidden rounded-xl border border-dark-border bg-dark-surface">
              <div className="flex items-center justify-between border-b border-dark-border px-6 py-4">
                <h3 className="text-sm font-bold text-white">
                  Active Allocations
                </h3>
                <span className="text-xs text-gray-500">
                  {allocations.length} active
                </span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-dark-border bg-[#262626]">
                    <TableHead className="text-gray-500">Room</TableHead>
                    <TableHead className="text-gray-500">Block</TableHead>
                    <TableHead className="text-gray-500">Student</TableHead>
                    <TableHead className="text-gray-500">Check-in</TableHead>
                    <TableHead className="text-gray-500">
                      Room Status
                    </TableHead>
                    <TableHead className="text-right text-gray-500">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allocations.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-8 text-center text-gray-500"
                      >
                        No active allocations
                      </TableCell>
                    </TableRow>
                  ) : (
                    allocations.map((alloc) => {
                      const room = roomMap.get(alloc.room_id);
                      const blk = blockMap.get(alloc.block_id);
                      const roomStatus = room?.status ?? "available";
                      const badge =
                        STATUS_BADGE[roomStatus] ?? STATUS_BADGE.available;

                      return (
                        <TableRow
                          key={alloc.id}
                          className="border-dark-border transition-colors hover:bg-[#262626]/50"
                        >
                          <TableCell className="font-medium text-white">
                            {room?.room_number ?? "—"}
                          </TableCell>
                          <TableCell>{blk?.name ?? "—"}</TableCell>
                          <TableCell className="text-emerald-500">
                            {alloc.student_id.slice(0, 8)}…
                          </TableCell>
                          <TableCell className="text-xs">
                            {alloc.check_in_date
                              ? new Date(
                                  alloc.check_in_date,
                                ).toLocaleDateString("en-IN", {
                                  month: "short",
                                  day: "2-digit",
                                  year: "numeric",
                                })
                              : "—"}
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
                            <button className="text-gray-500 hover:text-white">
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Right Sidebar — Block Occupancy + Details */}
          <div className="col-span-12 space-y-6 xl:col-span-4">
            {/* Block Occupancy Breakdown */}
            <div className="rounded-xl border border-dark-border bg-dark-surface p-5">
              <h3 className="mb-4 text-sm font-bold text-white">
                Block Occupancy
              </h3>
              <div className="space-y-3">
                {(occupancy ?? []).map((block) => {
                  const pct = block.occupancy_percentage;
                  const barColor =
                    pct >= 90
                      ? "bg-red-500"
                      : pct >= 75
                        ? "bg-yellow-500"
                        : "bg-emerald-500";
                  return (
                    <div key={block.block_id}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-white">
                          {block.block_name}
                        </span>
                        <span className="text-gray-400">
                          {block.occupied}/{block.total_beds} (
                          {Math.round(pct)}%)
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-700">
                        <div
                          className={cn("h-full rounded-full", barColor)}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Warden Info for Active Block */}
            {activeBlock && (
              <div className="rounded-xl border border-dark-border bg-dark-surface p-5">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
                  <IdCard className="h-5 w-5 text-gray-400" /> Block Details
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Type</span>
                    <span className="text-white">
                      {activeBlock.block_type ?? "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Floors</span>
                    <span className="text-white">{activeBlock.floors}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total Rooms</span>
                    <span className="text-white">
                      {activeBlock.total_rooms}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total Beds</span>
                    <span className="text-white">
                      {activeBlock.total_beds}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Warden</span>
                    <span className="text-white">
                      {activeBlock.warden_faculty_id
                        ? (facultyMap.get(activeBlock.warden_faculty_id) ?? "—")
                        : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">CCTV</span>
                    <span
                      className={
                        activeBlock.has_cctv
                          ? "text-emerald-400"
                          : "text-gray-500"
                      }
                    >
                      {activeBlock.has_cctv ? "Yes" : "No"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Anti-Ragging</span>
                    <span
                      className={
                        activeBlock.is_anti_ragging_compliant
                          ? "text-emerald-400"
                          : "text-red-400"
                      }
                    >
                      {activeBlock.is_anti_ragging_compliant
                        ? "Compliant"
                        : "Non-compliant"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* NMC Compliance Detail */}
            {nmcCompliance && (
              <div className="rounded-xl border border-dark-border bg-dark-surface p-5">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
                  <ShieldCheck className="h-5 w-5 text-gray-400" /> NMC Hostel
                  Compliance
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Required Capacity</span>
                    <span className="text-white">{nmcCompliance.required}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Current Capacity</span>
                    <span className="text-white">{nmcCompliance.capacity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Status</span>
                    <span
                      className={
                        nmcCompliance.compliant
                          ? "text-emerald-400"
                          : "text-red-400"
                      }
                    >
                      {nmcCompliance.compliant ? "Compliant" : "Non-Compliant"}
                    </span>
                  </div>
                  <p className="mt-2 text-gray-400">{nmcCompliance.message}</p>
                </div>
              </div>
            )}

            {/* Night Duty Transport (static — no backend yet) */}
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

      {/* Allocate Student Modal */}
      {allocateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-xl border border-dark-border bg-dark-surface p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">
                Allocate Student
              </h2>
              <button
                onClick={() => setAllocateOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Student Search */}
            <div className="mb-4">
              <label className="mb-1 block text-xs font-medium text-gray-400">
                Search Student
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => {
                    setStudentSearch(e.target.value);
                    setSelectedStudentId("");
                  }}
                  placeholder="Type name or roll number…"
                  className="w-full rounded-lg border border-dark-border bg-[#262626] py-2 pl-10 pr-3 text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              {studentSearch.length >= 2 && searchResults?.data && (
                <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-dark-border bg-[#1a1a1a]">
                  {searchResults.data.length === 0 ? (
                    <p className="p-2 text-xs text-gray-500">
                      No students found
                    </p>
                  ) : (
                    searchResults.data.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setSelectedStudentId(s.id);
                          setStudentSearch(s.name);
                        }}
                        className={cn(
                          "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[#262626]",
                          selectedStudentId === s.id
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "text-white",
                        )}
                      >
                        <span>{s.name}</span>
                        <span className="text-xs text-gray-500">
                          {s.current_phase ?? ""}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
              {selectedStudentId && (
                <p className="mt-1 flex items-center gap-1 text-xs text-emerald-400">
                  <Check className="h-3 w-3" /> Selected:{" "}
                  {studentMap.get(selectedStudentId) ?? selectedStudentId}
                </p>
              )}
            </div>

            {/* Room Selector */}
            <div className="mb-4">
              <label className="mb-1 block text-xs font-medium text-gray-400">
                Room
              </label>
              <select
                value={allocateRoomId}
                onChange={(e) => setAllocateRoomId(e.target.value)}
                className="w-full rounded-lg border border-dark-border bg-[#262626] p-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="">Select a room</option>
                {rooms
                  .filter((r) => r.status === "available")
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.room_number} — Floor {r.floor} ({r.current_occupancy}/
                      {r.capacity})
                    </option>
                  ))}
              </select>
            </div>

            {/* Block (read-only) */}
            <div className="mb-6">
              <label className="mb-1 block text-xs font-medium text-gray-400">
                Block
              </label>
              <input
                type="text"
                readOnly
                value={activeBlock?.name ?? "—"}
                className="w-full rounded-lg border border-dark-border bg-[#262626]/50 p-2 text-sm text-gray-400"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setAllocateOpen(false)}
                className="rounded-lg border border-dark-border px-4 py-2 text-sm text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <Button
                onClick={handleAllocate}
                disabled={
                  !selectedStudentId || !allocateRoomId || allocate.isPending
                }
              >
                {allocate.isPending ? "Allocating…" : "Allocate"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
