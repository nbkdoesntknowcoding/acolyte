"use client";

import {
  Building,
  ArrowLeft,
  Filter,
  AlertTriangle,
  CheckCircle,
  Wrench,
  Plus,
  Search,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import {
  useInfrastructure,
  useEquipment,
  useMaintenanceTickets,
  useCreateMaintenanceTicket,
} from "@/lib/hooks/admin/use-infrastructure";
import { useDepartments } from "@/lib/hooks/admin/use-departments";
import { LoadingState } from "@/components/admin/loading-state";
import { ErrorState } from "@/components/admin/error-state";
import { EmptyState } from "@/components/admin/empty-state";
import { DataTableWrapper } from "@/components/admin/data-table-wrapper";

export default function InfrastructurePage() {
  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [selectedAmcStatus, setSelectedAmcStatus] = useState<string>("all");
  const [selectedTicketStatus, setSelectedTicketStatus] =
    useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Create ticket modal
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [ticketEntityType, setTicketEntityType] = useState<string>("equipment");
  const [ticketEntityId, setTicketEntityId] = useState("");
  const [ticketDepartmentId, setTicketDepartmentId] = useState("");
  const [ticketDescription, setTicketDescription] = useState("");
  const [ticketPriority, setTicketPriority] = useState<string>("medium");

  // Success/Error banners
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Queries
  const {
    data: infrastructureData,
    isLoading: infrastructureLoading,
    error: infrastructureError,
  } = useInfrastructure({
    category: selectedCategory !== "all" ? selectedCategory : undefined,
    department_id:
      selectedDepartment !== "all" ? selectedDepartment : undefined,
    page_size: 500,
  });

  const {
    data: equipmentData,
    isLoading: equipmentLoading,
    error: equipmentError,
  } = useEquipment({
    department_id:
      selectedDepartment !== "all" ? selectedDepartment : undefined,
    amc_status: selectedAmcStatus !== "all" ? selectedAmcStatus : undefined,
    page_size: 500,
  });

  const {
    data: ticketsData,
    isLoading: ticketsLoading,
    error: ticketsError,
  } = useMaintenanceTickets({
    status: selectedTicketStatus !== "all" ? selectedTicketStatus : undefined,
    page_size: 100,
  });

  const {
    data: departmentsData,
    isLoading: departmentsLoading,
    error: departmentsError,
  } = useDepartments({ page_size: 500 });

  // Mutations
  const createTicketMutation = useCreateMaintenanceTicket();

  // Extract data
  const infrastructure = infrastructureData?.data ?? [];
  const equipment = equipmentData?.data ?? [];
  const tickets = ticketsData?.data ?? [];
  const departments = departmentsData?.data ?? [];

  // Build department map
  const departmentMap = new Map(departments.map((d) => [d.id, d.name]));

  // Group infrastructure by category
  const infrastructureByCategory = infrastructure.reduce(
    (acc, item) => {
      const category = item.category || "Uncategorized";
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item);
      return acc;
    },
    {} as Record<string, typeof infrastructure>
  );

  const categories = Object.keys(infrastructureByCategory).sort();

  // Filter equipment by search
  const filteredEquipment = equipment.filter((eq) =>
    searchTerm
      ? eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        eq.serial_number?.toLowerCase().includes(searchTerm.toLowerCase())
      : true
  );

  // Check AMC expiry status
  const today = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const equipmentWithAmcStatus = filteredEquipment.map((eq) => {
    let amcExpired = false;
    let amcExpiringSoon = false;

    if (eq.amc_status === "active" && eq.amc_end_date) {
      const endDate = new Date(eq.amc_end_date);
      amcExpired = endDate < today;
      amcExpiringSoon = !amcExpired && endDate <= thirtyDaysFromNow;
    }

    return {
      ...eq,
      amcExpired,
      amcExpiringSoon,
    };
  });

  // Handle create ticket
  const handleCreateTicket = async () => {
    if (!ticketDescription || !ticketPriority) {
      setErrorMessage("Please fill in all required fields.");
      return;
    }

    try {
      await createTicketMutation.mutateAsync({
        entity_type: ticketEntityType,
        entity_id: ticketEntityId || undefined,
        department_id: ticketDepartmentId || undefined,
        description: ticketDescription,
        priority: ticketPriority,
      });
      setSuccessMessage("Maintenance ticket created successfully!");
      setTicketModalOpen(false);
      setTicketEntityType("equipment");
      setTicketEntityId("");
      setTicketDepartmentId("");
      setTicketDescription("");
      setTicketPriority("medium");
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to create ticket."
      );
    }
  };

  // Loading states
  if (
    infrastructureLoading ||
    equipmentLoading ||
    ticketsLoading ||
    departmentsLoading
  ) {
    return <LoadingState />;
  }

  // Error states
  if (
    infrastructureError ||
    equipmentError ||
    ticketsError ||
    departmentsError
  ) {
    return (
      <ErrorState
        error={
          infrastructureError ||
          equipmentError ||
          ticketsError ||
          departmentsError
        }
      />
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/admin/facilities">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Infrastructure & Equipment</h1>
            <p className="text-muted-foreground">
              Manage rooms, equipment, and maintenance
            </p>
          </div>
        </div>
        <Button onClick={() => setTicketModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Ticket
        </Button>
      </div>

      {/* Success/Error Banners */}
      {successMessage && (
        <div className="flex items-center gap-2 rounded-md bg-emerald-50 p-4 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-100">
          <CheckCircle className="h-5 w-5" />
          <p>{successMessage}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSuccessMessage(null)}
            className="ml-auto"
          >
            Dismiss
          </Button>
        </div>
      )}
      {errorMessage && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 p-4 text-red-900 dark:bg-red-900/20 dark:text-red-100">
          <AlertTriangle className="h-5 w-5" />
          <p>{errorMessage}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setErrorMessage(null)}
            className="ml-auto"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        <Select
          value={selectedCategory}
          onValueChange={setSelectedCategory}
        >
          <SelectTrigger className="w-48">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={selectedDepartment}
          onValueChange={setSelectedDepartment}
        >
          <SelectTrigger className="w-48">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map((dept) => (
              <SelectItem key={dept.id} value={dept.id}>
                {dept.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Infrastructure Category Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {categories.length === 0 ? (
          <EmptyState
            title="No infrastructure found"
            description="Try adjusting your filters."
          />
        ) : (
          categories.map((category) => {
            const items = infrastructureByCategory[category];
            const totalCapacity = items.reduce(
              (sum, item) => sum + (item.capacity || 0),
              0
            );
            const totalArea = items.reduce(
              (sum, item) => sum + (item.area_sqm || 0),
              0
            );

            return (
              <Card key={category}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    {category}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div>
                      <div className="text-2xl font-bold">{items.length}</div>
                      <p className="text-xs text-muted-foreground">Rooms</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <div className="font-medium">{totalCapacity}</div>
                        <p className="text-xs text-muted-foreground">
                          Total Capacity
                        </p>
                      </div>
                      <div>
                        <div className="font-medium">
                          {totalArea.toFixed(0)} m²
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Total Area
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Equipment Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Equipment Inventory</CardTitle>
            <div className="flex gap-2">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search equipment..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select
                value={selectedAmcStatus}
                onValueChange={setSelectedAmcStatus}
              >
                <SelectTrigger className="w-48">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="AMC Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All AMC Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="none">No AMC</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {equipmentWithAmcStatus.length === 0 ? (
            <EmptyState
              title="No equipment found"
              description="Try adjusting your filters."
            />
          ) : (
            <DataTableWrapper>
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-left text-sm font-medium">Name</th>
                    <th className="p-2 text-left text-sm font-medium">
                      Serial #
                    </th>
                    <th className="p-2 text-left text-sm font-medium">
                      Department
                    </th>
                    <th className="p-2 text-left text-sm font-medium">
                      Make/Model
                    </th>
                    <th className="p-2 text-left text-sm font-medium">
                      AMC Status
                    </th>
                    <th className="p-2 text-left text-sm font-medium">
                      AMC End Date
                    </th>
                    <th className="p-2 text-left text-sm font-medium">
                      Condition
                    </th>
                    <th className="p-2 text-left text-sm font-medium">
                      NMC Required
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {equipmentWithAmcStatus.map((eq) => (
                    <tr key={eq.id} className="border-b">
                      <td className="p-2 text-sm font-medium">{eq.name}</td>
                      <td className="p-2 text-sm">
                        {eq.serial_number || "—"}
                      </td>
                      <td className="p-2 text-sm">
                        {departmentMap.get(eq.department_id) || "—"}
                      </td>
                      <td className="p-2 text-sm">{eq.make_model || "—"}</td>
                      <td className="p-2 text-sm">
                        <Badge
                          variant={
                            eq.amc_status === "active"
                              ? "default"
                              : eq.amc_status === "expired"
                                ? "destructive"
                                : "outline"
                          }
                        >
                          {eq.amc_status}
                        </Badge>
                      </td>
                      <td
                        className={`p-2 text-sm ${
                          eq.amcExpired
                            ? "text-red-600 font-bold"
                            : eq.amcExpiringSoon
                              ? "text-yellow-600 font-bold"
                              : ""
                        }`}
                      >
                        {eq.amc_end_date ? (
                          <div className="flex items-center gap-1">
                            {eq.amcExpired && (
                              <AlertTriangle className="h-4 w-4 text-red-600" />
                            )}
                            {eq.amcExpiringSoon && !eq.amcExpired && (
                              <AlertTriangle className="h-4 w-4 text-yellow-600" />
                            )}
                            {new Date(eq.amc_end_date).toLocaleDateString()}
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-2 text-sm">
                        <Badge
                          variant={
                            eq.condition === "good"
                              ? "default"
                              : eq.condition === "needs_repair"
                                ? "destructive"
                                : "outline"
                          }
                        >
                          {eq.condition}
                        </Badge>
                      </td>
                      <td className="p-2 text-sm">
                        {eq.is_nmc_required ? (
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableWrapper>
          )}
        </CardContent>
      </Card>

      {/* Maintenance Tickets */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Maintenance Tickets
            </CardTitle>
            <Select
              value={selectedTicketStatus}
              onValueChange={setSelectedTicketStatus}
            >
              <SelectTrigger className="w-40">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {tickets.length === 0 ? (
            <EmptyState
              title="No tickets found"
              description="Create a new maintenance ticket to get started."
            />
          ) : (
            <DataTableWrapper>
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-left text-sm font-medium">
                      Ticket #
                    </th>
                    <th className="p-2 text-left text-sm font-medium">
                      Entity Type
                    </th>
                    <th className="p-2 text-left text-sm font-medium">
                      Department
                    </th>
                    <th className="p-2 text-left text-sm font-medium">
                      Description
                    </th>
                    <th className="p-2 text-left text-sm font-medium">
                      Priority
                    </th>
                    <th className="p-2 text-left text-sm font-medium">
                      Status
                    </th>
                    <th className="p-2 text-left text-sm font-medium">
                      Created
                    </th>
                    <th className="p-2 text-left text-sm font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.id} className="border-b">
                      <td className="p-2 text-sm font-mono">
                        {ticket.ticket_number}
                      </td>
                      <td className="p-2 text-sm">
                        <Badge variant="outline">{ticket.entity_type}</Badge>
                      </td>
                      <td className="p-2 text-sm">
                        {ticket.department_id
                          ? departmentMap.get(ticket.department_id) || "—"
                          : "—"}
                      </td>
                      <td className="p-2 text-sm max-w-xs truncate">
                        {ticket.description}
                      </td>
                      <td className="p-2 text-sm">
                        <Badge
                          variant={
                            ticket.priority === "critical"
                              ? "destructive"
                              : ticket.priority === "high"
                                ? "destructive"
                                : ticket.priority === "medium"
                                  ? "default"
                                  : "outline"
                          }
                        >
                          {ticket.priority}
                        </Badge>
                      </td>
                      <td className="p-2 text-sm">
                        <Badge
                          variant={
                            ticket.status === "resolved" ||
                            ticket.status === "closed"
                              ? "default"
                              : ticket.status === "in_progress"
                                ? "default"
                                : "outline"
                          }
                        >
                          {ticket.status}
                        </Badge>
                      </td>
                      <td className="p-2 text-sm">
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-2 text-sm">
                        {ticket.cost
                          ? `₹${(ticket.cost / 100).toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                            })}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableWrapper>
          )}
        </CardContent>
      </Card>

      {/* Create Ticket Modal */}
      <Dialog open={ticketModalOpen} onOpenChange={setTicketModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Maintenance Ticket</DialogTitle>
            <DialogDescription>
              Report an issue with equipment or infrastructure.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="entity-type">Entity Type</Label>
              <Select value={ticketEntityType} onValueChange={setTicketEntityType}>
                <SelectTrigger id="entity-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equipment">Equipment</SelectItem>
                  <SelectItem value="infrastructure">Infrastructure</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="entity-id">
                Entity ID (Optional)
              </Label>
              <Input
                id="entity-id"
                placeholder="UUID of equipment or infrastructure"
                value={ticketEntityId}
                onChange={(e) => setTicketEntityId(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="department-id">Department (Optional)</Label>
              <Select
                value={ticketDepartmentId}
                onValueChange={setTicketDepartmentId}
              >
                <SelectTrigger id="department-id">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the issue..."
                value={ticketDescription}
                onChange={(e) => setTicketDescription(e.target.value)}
                rows={4}
              />
            </div>
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select value={ticketPriority} onValueChange={setTicketPriority}>
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTicketModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTicket}>Create Ticket</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
