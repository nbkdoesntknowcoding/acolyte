"use client";

import {
  Shield,
  ArrowLeft,
  Plus,
  Filter,
  AlertTriangle,
  CheckCircle,
  FileText,
  Clock,
  AlertCircle,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import Link from "next/link";
import {
  useCommittees,
  useGrievances,
  useCreateGrievance,
  useUpdateGrievance,
} from "@/lib/hooks/admin/use-grievances";
import { LoadingState } from "@/components/admin/loading-state";
import { ErrorState } from "@/components/admin/error-state";
import { EmptyState } from "@/components/admin/empty-state";
import { DataTableWrapper } from "@/components/admin/data-table-wrapper";

interface TimelineEvent {
  timestamp: string;
  status: string;
  description: string;
  updated_by?: string;
}

export default function GrievancesPage() {
  // Filters
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");

  // File grievance modal
  const [fileModalOpen, setFileModalOpen] = useState(false);
  const [grievanceCategory, setGrievanceCategory] = useState<string>("academic");
  const [grievanceDescription, setGrievanceDescription] = useState("");
  const [grievancePriority, setGrievancePriority] = useState<string>("medium");
  const [isAnonymous, setIsAnonymous] = useState(false);

  // Timeline modal
  const [timelineModalOpen, setTimelineModalOpen] = useState(false);
  const [selectedGrievance, setSelectedGrievance] = useState<typeof grievances[0] | null>(null);

  // Update status modal
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updateGrievanceId, setUpdateGrievanceId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<string>("");
  const [resolutionNotes, setResolutionNotes] = useState("");

  // Success/Error banners
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Queries
  const {
    data: committeesData,
    isLoading: committeesLoading,
    error: committeesError,
  } = useCommittees({ page_size: 100 });

  const {
    data: grievancesData,
    isLoading: grievancesLoading,
    error: grievancesError,
  } = useGrievances({
    status: selectedStatus !== "all" ? selectedStatus : undefined,
    category: selectedCategory !== "all" ? selectedCategory : undefined,
    priority: selectedPriority !== "all" ? selectedPriority : undefined,
    page_size: 100,
  });

  // Mutations
  const createGrievanceMutation = useCreateGrievance();
  const updateGrievanceMutation = useUpdateGrievance();

  // Extract data
  const committees = committeesData?.data ?? [];
  const grievances = grievancesData?.data ?? [];

  // Filter NMC-mandated committees
  const nmcCommittees = committees.filter((c) => c.is_nmc_mandated);

  // Handle file grievance
  const handleFileGrievance = async () => {
    if (!grievanceCategory || !grievanceDescription) {
      setErrorMessage("Please fill in all required fields.");
      return;
    }

    try {
      await createGrievanceMutation.mutateAsync({
        is_anonymous: isAnonymous,
        category: grievanceCategory,
        description: grievanceDescription,
        priority: grievancePriority,
      });
      setSuccessMessage("Grievance filed successfully!");
      setFileModalOpen(false);
      resetFileForm();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to file grievance."
      );
    }
  };

  // Handle update status
  const handleUpdateStatus = async () => {
    if (!updateGrievanceId || !newStatus) {
      setErrorMessage("Please select a status.");
      return;
    }

    try {
      await updateGrievanceMutation.mutateAsync({
        id: updateGrievanceId,
        data: {
          status: newStatus,
          resolution_description: resolutionNotes || undefined,
        },
      });
      setSuccessMessage("Grievance status updated successfully!");
      setUpdateModalOpen(false);
      setUpdateGrievanceId(null);
      setNewStatus("");
      setResolutionNotes("");
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to update status."
      );
    }
  };

  // Reset file form
  const resetFileForm = () => {
    setGrievanceCategory("academic");
    setGrievanceDescription("");
    setGrievancePriority("medium");
    setIsAnonymous(false);
  };

  // Open timeline modal
  const openTimeline = (grievance: typeof grievances[0]) => {
    setSelectedGrievance(grievance);
    setTimelineModalOpen(true);
  };

  // Open update status modal
  const openUpdateStatus = (grievanceId: string, currentStatus: string) => {
    setUpdateGrievanceId(grievanceId);
    setNewStatus(currentStatus);
    setUpdateModalOpen(true);
  };

  // Parse timeline
  const parseTimeline = (timeline: unknown[] | null): TimelineEvent[] => {
    if (!timeline || !Array.isArray(timeline)) return [];
    return timeline as TimelineEvent[];
  };

  // Get status badge variant
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "resolved":
      case "closed":
        return "default";
      case "under_review":
      case "hearing_scheduled":
        return "default";
      case "acknowledged":
        return "outline";
      case "escalated":
        return "destructive";
      default:
        return "outline";
    }
  };

  // Get priority badge variant
  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case "high":
      case "critical":
        return "destructive";
      case "medium":
        return "default";
      default:
        return "outline";
    }
  };

  // Loading states
  if (committeesLoading || grievancesLoading) {
    return <LoadingState />;
  }

  // Error states
  if (committeesError || grievancesError) {
    return <ErrorState error={committeesError || grievancesError} />;
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Grievance Management</h1>
            <p className="text-muted-foreground">
              NMC-mandated committees and grievance tracking
            </p>
          </div>
        </div>
        <Button onClick={() => setFileModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          File Grievance
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

      {/* NMC-Mandated Committees */}
      <div>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5 text-emerald-500" />
          NMC-Mandated Committees
        </h2>
        {nmcCommittees.length === 0 ? (
          <EmptyState
            title="No NMC committees found"
            description="NMC-mandated committees will appear here."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {nmcCommittees.map((committee) => (
              <Card key={committee.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="h-4 w-4 text-emerald-500" />
                    {committee.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {committee.committee_type && (
                    <div className="text-xs text-muted-foreground">
                      Type: {committee.committee_type}
                    </div>
                  )}
                  {committee.chairperson_name && (
                    <div className="text-sm">
                      <span className="font-medium">Chairperson:</span>{" "}
                      {committee.chairperson_name}
                    </div>
                  )}
                  {committee.meeting_frequency && (
                    <div className="text-xs text-muted-foreground">
                      Meetings: {committee.meeting_frequency}
                    </div>
                  )}
                  {committee.last_meeting_date && (
                    <div className="text-xs text-muted-foreground">
                      Last Meeting:{" "}
                      {new Date(committee.last_meeting_date).toLocaleDateString()}
                    </div>
                  )}
                  <Badge
                    variant={
                      committee.status === "active" ? "default" : "outline"
                    }
                  >
                    {committee.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Grievance Tracker */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Grievance Tracker</CardTitle>
            <div className="flex gap-2">
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-40">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="filed">Filed</SelectItem>
                  <SelectItem value="acknowledged">Acknowledged</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="hearing_scheduled">
                    Hearing Scheduled
                  </SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="escalated">Escalated</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={selectedCategory}
                onValueChange={setSelectedCategory}
              >
                <SelectTrigger className="w-40">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="academic">Academic</SelectItem>
                  <SelectItem value="harassment">Harassment</SelectItem>
                  <SelectItem value="discrimination">Discrimination</SelectItem>
                  <SelectItem value="facilities">Facilities</SelectItem>
                  <SelectItem value="hostel">Hostel</SelectItem>
                  <SelectItem value="ragging">Ragging</SelectItem>
                  <SelectItem value="administrative">Administrative</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={selectedPriority}
                onValueChange={setSelectedPriority}
              >
                <SelectTrigger className="w-40">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {grievances.length === 0 ? (
            <EmptyState
              title="No grievances found"
              description="File a new grievance to get started."
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
                      Category
                    </th>
                    <th className="p-2 text-left text-sm font-medium">
                      Filed By
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
                      Filed On
                    </th>
                    <th className="p-2 text-left text-sm font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {grievances.map((grievance) => (
                    <tr key={grievance.id} className="border-b">
                      <td className="p-2 text-sm font-mono">
                        {grievance.ticket_number}
                      </td>
                      <td className="p-2 text-sm">
                        <Badge variant="outline">{grievance.category}</Badge>
                      </td>
                      <td className="p-2 text-sm">
                        {grievance.is_anonymous ? (
                          <span className="italic text-muted-foreground">
                            Anonymous
                          </span>
                        ) : (
                          grievance.filed_by_name || "—"
                        )}
                      </td>
                      <td className="p-2 text-sm max-w-xs truncate">
                        {grievance.description}
                      </td>
                      <td className="p-2 text-sm">
                        <Badge variant={getPriorityBadgeVariant(grievance.priority)}>
                          {grievance.priority}
                        </Badge>
                      </td>
                      <td className="p-2 text-sm">
                        <Badge variant={getStatusBadgeVariant(grievance.status)}>
                          {grievance.status}
                        </Badge>
                      </td>
                      <td className="p-2 text-sm">
                        {new Date(grievance.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-2 text-sm">
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openTimeline(grievance)}
                          >
                            <Clock className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              openUpdateStatus(grievance.id, grievance.status)
                            }
                          >
                            <FileText className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableWrapper>
          )}
        </CardContent>
      </Card>

      {/* File Grievance Modal */}
      <Dialog open={fileModalOpen} onOpenChange={setFileModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>File a Grievance</DialogTitle>
            <DialogDescription>
              Submit a grievance for review by the appropriate committee.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="category">Category *</Label>
              <Select value={grievanceCategory} onValueChange={setGrievanceCategory}>
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="academic">Academic</SelectItem>
                  <SelectItem value="harassment">Harassment</SelectItem>
                  <SelectItem value="discrimination">Discrimination</SelectItem>
                  <SelectItem value="facilities">Facilities</SelectItem>
                  <SelectItem value="hostel">Hostel</SelectItem>
                  <SelectItem value="ragging">Ragging</SelectItem>
                  <SelectItem value="administrative">Administrative</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Describe your grievance in detail..."
                value={grievanceDescription}
                onChange={(e) => setGrievanceDescription(e.target.value)}
                rows={6}
              />
            </div>
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select value={grievancePriority} onValueChange={setGrievancePriority}>
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
            <div className="flex items-center justify-between">
              <Label htmlFor="anonymous">File Anonymously</Label>
              <Switch
                id="anonymous"
                checked={isAnonymous}
                onCheckedChange={setIsAnonymous}
              />
            </div>
            <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
              Note: Evidence upload functionality is under development. For now,
              you can include URLs in the description.
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setFileModalOpen(false);
                resetFileForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleFileGrievance}>File Grievance</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Timeline Modal */}
      <Dialog open={timelineModalOpen} onOpenChange={setTimelineModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grievance Timeline</DialogTitle>
            <DialogDescription>
              {selectedGrievance?.ticket_number || "View status history"}
            </DialogDescription>
          </DialogHeader>
          {selectedGrievance && (
            <div className="space-y-4">
              {parseTimeline(selectedGrievance.timeline).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No timeline events yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {parseTimeline(selectedGrievance.timeline).map(
                    (event, index) => (
                      <div
                        key={index}
                        className="flex gap-3 border-l-2 border-muted pl-3"
                      >
                        <div className="flex-shrink-0 mt-1">
                          {event.status === "resolved" || event.status === "closed" ? (
                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                          ) : event.status === "escalated" ? (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          ) : (
                            <Clock className="h-4 w-4 text-blue-500" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={getStatusBadgeVariant(event.status)}
                              className="text-xs"
                            >
                              {event.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(event.timestamp).toLocaleString()}
                            </span>
                          </div>
                          {event.description && (
                            <p className="text-sm mt-1">{event.description}</p>
                          )}
                          {event.updated_by && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Updated by: {event.updated_by}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setTimelineModalOpen(false);
                setSelectedGrievance(null);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Status Modal */}
      <Dialog open={updateModalOpen} onOpenChange={setUpdateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Grievance Status</DialogTitle>
            <DialogDescription>
              Change the status and optionally add resolution notes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="status">Status *</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="filed">Filed</SelectItem>
                  <SelectItem value="acknowledged">Acknowledged</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="hearing_scheduled">
                    Hearing Scheduled
                  </SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="escalated">Escalated</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="resolution">Resolution Notes (Optional)</Label>
              <Textarea
                id="resolution"
                placeholder="Add notes about the resolution or status change..."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setUpdateModalOpen(false);
                setUpdateGrievanceId(null);
                setNewStatus("");
                setResolutionNotes("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateStatus}>Update Status</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
