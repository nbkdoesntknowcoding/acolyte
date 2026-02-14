"use client";

import {
  ArrowLeft,
  Plus,
  Filter,
  AlertTriangle,
  CheckCircle,
  Pin,
  Users,
  Eye,
  CheckCheck,
  Send,
  FileText,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import {
  useNotices,
  useCreateNotice,
  usePublishNotice,
  useNoticeAnalytics,
} from "@/lib/hooks/admin/use-notices";
import { LoadingState } from "@/components/admin/loading-state";
import { ErrorState } from "@/components/admin/error-state";
import { EmptyState } from "@/components/admin/empty-state";

export default function NoticesPage() {
  // Filters
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");

  // Create notice modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeContent, setNoticeContent] = useState("");
  const [noticeType, setNoticeType] = useState<string>("general");
  const [noticePriority, setNoticePriority] = useState<string>("normal");
  const [requiresAcknowledgment, setRequiresAcknowledgment] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [deliveryChannels, setDeliveryChannels] = useState<string[]>(["web"]);

  // Analytics modal
  const [analyticsModalOpen, setAnalyticsModalOpen] = useState(false);
  const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null);

  // Success/Error banners
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Queries
  const {
    data: noticesData,
    isLoading: noticesLoading,
    error: noticesError,
  } = useNotices({
    status: selectedStatus !== "all" ? selectedStatus : undefined,
    priority: selectedPriority !== "all" ? selectedPriority : undefined,
    notice_type: selectedType !== "all" ? selectedType : undefined,
    page_size: 100,
  });

  const {
    data: analyticsData,
    isLoading: analyticsLoading,
    error: analyticsError,
  } = useNoticeAnalytics(selectedNoticeId || "", {
    enabled: !!selectedNoticeId && analyticsModalOpen,
  });

  // Mutations
  const createNoticeMutation = useCreateNotice();
  const publishNoticeMutation = usePublishNotice();

  // Extract data
  const notices = noticesData?.data ?? [];

  // Handle create notice
  const handleCreateNotice = async () => {
    if (!noticeTitle || !noticeContent) {
      setErrorMessage("Please fill in all required fields.");
      return;
    }

    try {
      await createNoticeMutation.mutateAsync({
        title: noticeTitle,
        content: noticeContent,
        notice_type: noticeType,
        priority: noticePriority,
        requires_acknowledgment: requiresAcknowledgment,
        is_pinned: isPinned,
        target_audience: targetRoles.length > 0 ? { roles: targetRoles } : null,
        delivery_channels: deliveryChannels,
      });
      setSuccessMessage("Notice created successfully as draft!");
      setCreateModalOpen(false);
      resetForm();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to create notice."
      );
    }
  };

  // Handle publish notice
  const handlePublishNotice = async (noticeId: string) => {
    try {
      await publishNoticeMutation.mutateAsync(noticeId);
      setSuccessMessage("Notice published successfully!");
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to publish notice."
      );
    }
  };

  // Reset form
  const resetForm = () => {
    setNoticeTitle("");
    setNoticeContent("");
    setNoticeType("general");
    setNoticePriority("normal");
    setRequiresAcknowledgment(false);
    setIsPinned(false);
    setTargetRoles([]);
    setDeliveryChannels(["web"]);
  };

  // Toggle role selection
  const toggleRole = (role: string) => {
    setTargetRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  // Toggle channel selection
  const toggleChannel = (channel: string) => {
    setDeliveryChannels((prev) =>
      prev.includes(channel)
        ? prev.filter((c) => c !== channel)
        : [...prev, channel]
    );
  };

  // Open analytics
  const openAnalytics = (noticeId: string) => {
    setSelectedNoticeId(noticeId);
    setAnalyticsModalOpen(true);
  };

  // Loading states
  if (noticesLoading) {
    return <LoadingState />;
  }

  // Error states
  if (noticesError) {
    return <ErrorState error={noticesError} />;
  }

  // Calculate read rate
  const getReadRate = (notice: typeof notices[0]) => {
    if (notice.total_recipients === 0) return 0;
    return (notice.read_count / notice.total_recipients) * 100;
  };

  // Calculate acknowledgment rate
  const getAcknowledgmentRate = (notice: typeof notices[0]) => {
    if (notice.total_recipients === 0) return 0;
    return (notice.acknowledged_count / notice.total_recipients) * 100;
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/admin/communications">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Notice Board</h1>
            <p className="text-muted-foreground">
              Create and manage notices for students, faculty, and staff
            </p>
          </div>
        </div>
        <Button onClick={() => setCreateModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Notice
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
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-40">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Select value={selectedPriority} onValueChange={setSelectedPriority}>
          <SelectTrigger className="w-40">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="important">Important</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger className="w-40">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="general">General</SelectItem>
            <SelectItem value="academic">Academic</SelectItem>
            <SelectItem value="exam">Exam</SelectItem>
            <SelectItem value="event">Event</SelectItem>
            <SelectItem value="administrative">Administrative</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Notice Cards */}
      {notices.length === 0 ? (
        <EmptyState
          title="No notices found"
          description="Create your first notice to get started."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {notices.map((notice) => {
            const readRate = getReadRate(notice);
            const ackRate = getAcknowledgmentRate(notice);

            return (
              <Card
                key={notice.id}
                className={notice.is_pinned ? "border-emerald-500" : ""}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <CardTitle className="text-base flex items-center gap-2">
                        {notice.is_pinned && (
                          <Pin className="h-4 w-4 text-emerald-500" />
                        )}
                        {notice.title}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        {notice.posted_by_name || "Unknown"} •{" "}
                        {notice.published_at
                          ? new Date(notice.published_at).toLocaleDateString()
                          : "Not published"}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Badge
                        variant={
                          notice.priority === "urgent"
                            ? "destructive"
                            : notice.priority === "important"
                              ? "default"
                              : "outline"
                        }
                      >
                        {notice.priority}
                      </Badge>
                      <Badge
                        variant={
                          notice.status === "published"
                            ? "default"
                            : "outline"
                        }
                      >
                        {notice.status}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm line-clamp-3">{notice.content}</p>

                  {notice.notice_type && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <FileText className="h-3 w-3" />
                      {notice.notice_type}
                    </div>
                  )}

                  {/* Read Progress */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        Read Rate
                      </span>
                      <span className="font-medium">
                        {notice.read_count} / {notice.total_recipients} (
                        {readRate.toFixed(0)}%)
                      </span>
                    </div>
                    <Progress value={readRate} className="h-1.5" />
                  </div>

                  {/* Acknowledgment Progress (if required) */}
                  {notice.requires_acknowledgment && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1">
                          <CheckCheck className="h-3 w-3" />
                          Acknowledgment
                        </span>
                        <span className="font-medium">
                          {notice.acknowledged_count} /{" "}
                          {notice.total_recipients} ({ackRate.toFixed(0)}%)
                        </span>
                      </div>
                      <Progress value={ackRate} className="h-1.5" />
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    {notice.status === "draft" && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handlePublishNotice(notice.id)}
                        className="flex-1"
                      >
                        <Send className="mr-1 h-3 w-3" />
                        Publish
                      </Button>
                    )}
                    {notice.status === "published" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openAnalytics(notice.id)}
                        className="flex-1"
                      >
                        <Eye className="mr-1 h-3 w-3" />
                        Analytics
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Notice Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Notice</DialogTitle>
            <DialogDescription>
              Create a new notice. It will be saved as a draft until published.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="Notice title..."
                value={noticeTitle}
                onChange={(e) => setNoticeTitle(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="content">Content *</Label>
              <Textarea
                id="content"
                placeholder="Notice content..."
                value={noticeContent}
                onChange={(e) => setNoticeContent(e.target.value)}
                rows={6}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="type">Type</Label>
                <Select value={noticeType} onValueChange={setNoticeType}>
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="academic">Academic</SelectItem>
                    <SelectItem value="exam">Exam</SelectItem>
                    <SelectItem value="event">Event</SelectItem>
                    <SelectItem value="administrative">
                      Administrative
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select value={noticePriority} onValueChange={setNoticePriority}>
                  <SelectTrigger id="priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="important">Important</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Target Audience (Roles)</Label>
              <div className="flex flex-wrap gap-2">
                {["student", "faculty", "hod", "admin", "staff"].map((role) => (
                  <Button
                    key={role}
                    type="button"
                    variant={targetRoles.includes(role) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleRole(role)}
                  >
                    <Users className="mr-1 h-3 w-3" />
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Leave empty to target all users
              </p>
            </div>

            <div>
              <Label className="mb-2 block">Delivery Channels</Label>
              <div className="flex flex-wrap gap-2">
                {["web", "email", "sms"].map((channel) => (
                  <Button
                    key={channel}
                    type="button"
                    variant={
                      deliveryChannels.includes(channel) ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => toggleChannel(channel)}
                  >
                    {channel.toUpperCase()}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="requires-ack">Requires Acknowledgment</Label>
              <Switch
                id="requires-ack"
                checked={requiresAcknowledgment}
                onCheckedChange={setRequiresAcknowledgment}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is-pinned">Pin to Top</Label>
              <Switch
                id="is-pinned"
                checked={isPinned}
                onCheckedChange={setIsPinned}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateModalOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateNotice}>Create as Draft</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Analytics Modal */}
      <Dialog open={analyticsModalOpen} onOpenChange={setAnalyticsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notice Analytics</DialogTitle>
            <DialogDescription>
              View read and acknowledgment statistics for this notice.
            </DialogDescription>
          </DialogHeader>
          {analyticsLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Loading analytics...
            </div>
          ) : analyticsError ? (
            <div className="py-8 text-center text-sm text-red-600">
              Failed to load analytics.
            </div>
          ) : analyticsData ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Total Recipients
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {analyticsData.total_recipients}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Read Count
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {analyticsData.read_count}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {analyticsData.total_recipients > 0
                        ? (
                            (analyticsData.read_count /
                              analyticsData.total_recipients) *
                            100
                          ).toFixed(0)
                        : 0}
                      % read rate
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Acknowledged
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {analyticsData.acknowledged_count}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {analyticsData.total_recipients > 0
                        ? (
                            (analyticsData.acknowledged_count /
                              analyticsData.total_recipients) *
                            100
                          ).toFixed(0)
                        : 0}
                      % acknowledged
                    </p>
                  </CardContent>
                </Card>
              </div>

              {analyticsData.read_by_role &&
                Object.keys(analyticsData.read_by_role).length > 0 && (
                  <div>
                    <Label className="mb-2 block">Read by Role</Label>
                    <div className="space-y-2">
                      {Object.entries(analyticsData.read_by_role).map(
                        ([role, count]) => (
                          <div
                            key={role}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="capitalize">{role}</span>
                            <Badge variant="outline">{count as number}</Badge>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAnalyticsModalOpen(false);
                setSelectedNoticeId(null);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
