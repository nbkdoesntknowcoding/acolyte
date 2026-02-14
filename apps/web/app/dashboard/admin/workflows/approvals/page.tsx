'use client';

import { useState } from 'react';
import {
  Clock,
  Search,
  Check,
  X,
  MoreVertical,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock as ClockIcon,
  TrendingUp,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useWorkflows,
  usePendingWorkflows,
  useWorkflowStats,
  useApproveWorkflow,
  useRejectWorkflow,
} from '@/lib/hooks/admin/use-workflows';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WorkflowType =
  | 'leave'
  | 'certificate'
  | 'purchase_order'
  | 'travel'
  | 'equipment';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ApprovalsPage() {
  const [activeTab, setActiveTab] = useState<WorkflowType>('leave');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [approveConfirmWorkflowId, setApproveConfirmWorkflowId] = useState<
    string | null
  >(null);
  const [approveComment, setApproveComment] = useState('');
  const [rejectWorkflowId, setRejectWorkflowId] = useState<string | null>(
    null,
  );
  const [rejectReason, setRejectReason] = useState('');

  // API calls
  const {
    data: pendingData,
    isLoading: pendingLoading,
    error: pendingError,
  } = usePendingWorkflows({ page_size: 100 });

  const {
    data: workflowsData,
    isLoading: workflowsLoading,
    error: workflowsError,
  } = useWorkflows({
    workflow_type: activeTab,
    status: statusFilter || undefined,
    page_size: 50,
  });

  const {
    data: statsData,
    isLoading: statsLoading,
    error: statsError,
  } = useWorkflowStats();

  const approveMutation = useApproveWorkflow();
  const rejectMutation = useRejectWorkflow();

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleApproveClick = (workflowId: string) => {
    setApproveConfirmWorkflowId(workflowId);
    setApproveComment('');
  };

  const handleApproveConfirm = async () => {
    if (!approveConfirmWorkflowId) return;
    try {
      await approveMutation.mutateAsync({
        id: approveConfirmWorkflowId,
        data: approveComment ? { comment: approveComment } : undefined,
      });
      setApproveConfirmWorkflowId(null);
      setApproveComment('');
    } catch (error) {
      console.error('Failed to approve workflow:', error);
    }
  };

  const handleRejectClick = (workflowId: string) => {
    setRejectWorkflowId(workflowId);
    setRejectReason('');
  };

  const handleRejectConfirm = async () => {
    if (!rejectWorkflowId || !rejectReason.trim()) return;
    try {
      await rejectMutation.mutateAsync({
        id: rejectWorkflowId,
        data: { reason: rejectReason },
      });
      setRejectWorkflowId(null);
      setRejectReason('');
    } catch (error) {
      console.error('Failed to reject workflow:', error);
    }
  };

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const pendingWorkflows = pendingData?.data || [];
  const workflows = workflowsData?.data || [];

  const filteredWorkflows = workflows.filter((wf) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      wf.title?.toLowerCase().includes(query) ||
      wf.description?.toLowerCase().includes(query) ||
      wf.requested_by_name?.toLowerCase().includes(query)
    );
  });

  const stats = {
    pending: statsData?.pending ?? 0,
    approved_this_month: statsData?.approved_this_month ?? 0,
    rejected_this_month: statsData?.rejected_this_month ?? 0,
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const getPriorityBadge = (priority: string) => {
    if (priority === 'high' || priority === 'urgent') {
      return (
        <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-400">
          High Priority
        </span>
      );
    }
    return (
      <span className="rounded-full border border-gray-600/30 bg-gray-700/50 px-2 py-0.5 text-[10px] font-medium text-gray-400">
        Normal
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <div className="flex items-center gap-1 text-xs text-yellow-400">
            <ClockIcon className="h-3 w-3" /> Pending
          </div>
        );
      case 'approved':
        return (
          <div className="flex items-center gap-1 text-xs text-emerald-400">
            <CheckCircle className="h-3 w-3" /> Approved
          </div>
        );
      case 'rejected':
        return (
          <div className="flex items-center gap-1 text-xs text-red-400">
            <XCircle className="h-3 w-3" /> Rejected
          </div>
        );
      case 'in_progress':
        return (
          <div className="flex items-center gap-1 text-xs text-blue-400">
            <TrendingUp className="h-3 w-3" /> In Progress
          </div>
        );
      case 'cancelled':
        return (
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <XCircle className="h-3 w-3" /> Cancelled
          </div>
        );
      default:
        return <span className="text-xs text-gray-400">{status}</span>;
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return '??';
    const parts = name.split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getInitialsColor = (index: number) => {
    const colors = [
      'bg-blue-500/20 text-blue-400',
      'bg-purple-500/20 text-purple-400',
      'bg-orange-500/20 text-orange-400',
      'bg-teal-500/20 text-teal-400',
      'bg-pink-500/20 text-pink-400',
      'bg-indigo-500/20 text-indigo-400',
    ];
    return colors[index % colors.length];
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (pendingError || workflowsError || statsError) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center bg-[#0A0A0A]">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <p className="mt-2 text-sm text-gray-400">
            Failed to load workflows data
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col overflow-hidden bg-[#0A0A0A]">
      {/* Top Bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-[#1E1E1E] px-6 py-3">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="cursor-pointer hover:text-white">Workflows</span>
          <span className="text-gray-600">/</span>
          <span className="font-semibold text-white">Approvals</span>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-auto p-6">
        {/* Stats Cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-[#1E1E1E] bg-[#141414] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-gray-500">
                  Pending Approvals
                </p>
                <p className="mt-1 text-2xl font-bold text-white">
                  {statsLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  ) : (
                    stats.pending
                  )}
                </p>
              </div>
              <div className="rounded-full bg-yellow-500/10 p-3">
                <Clock className="h-6 w-6 text-yellow-400" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#1E1E1E] bg-[#141414] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-gray-500">
                  Approved This Month
                </p>
                <p className="mt-1 text-2xl font-bold text-white">
                  {statsLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  ) : (
                    stats.approved_this_month
                  )}
                </p>
              </div>
              <div className="rounded-full bg-emerald-500/10 p-3">
                <CheckCircle className="h-6 w-6 text-emerald-400" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#1E1E1E] bg-[#141414] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-gray-500">
                  Rejected This Month
                </p>
                <p className="mt-1 text-2xl font-bold text-white">
                  {statsLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  ) : (
                    stats.rejected_this_month
                  )}
                </p>
              </div>
              <div className="rounded-full bg-red-500/10 p-3">
                <XCircle className="h-6 w-6 text-red-400" />
              </div>
            </div>
          </div>
        </div>

        {/* My Approvals Queue */}
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
              <Clock className="h-5 w-5 text-orange-400" />
              My Approvals Queue
              {pendingWorkflows.length > 0 && (
                <span className="ml-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {pendingWorkflows.length} Pending
                </span>
              )}
            </h2>
          </div>

          {pendingLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : pendingWorkflows.length === 0 ? (
            <div className="rounded-xl border border-[#1E1E1E] bg-[#141414] p-8 text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-emerald-500" />
              <p className="mt-2 text-sm text-gray-400">
                No pending approvals
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {pendingWorkflows.map((wf, index) => (
                <div
                  key={wf.id}
                  className="rounded-xl border border-[#1E1E1E] bg-[#141414] p-4 shadow-lg shadow-black/20 transition-colors hover:border-emerald-500/30"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${getInitialsColor(index)}`}
                      >
                        {getInitials(wf.requested_by_name)}
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">
                          {wf.requested_by_name || 'Unknown'}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          Step {wf.current_step}
                        </p>
                      </div>
                    </div>
                    {getPriorityBadge(wf.priority)}
                  </div>

                  <h3 className="mb-1 text-sm font-semibold text-gray-200">
                    {wf.title || wf.workflow_type}
                  </h3>
                  <p className="mb-2 line-clamp-2 text-xs text-gray-500">
                    {wf.description || 'No description'}
                  </p>

                  {wf.due_date && (
                    <div className="mb-3 flex items-center gap-1 text-[10px] text-gray-500">
                      <AlertTriangle className="h-3 w-3 text-yellow-500" />
                      Due: {new Date(wf.due_date).toLocaleDateString()}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApproveClick(wf.id)}
                      disabled={approveMutation.isPending}
                      className="flex flex-1 items-center justify-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 py-1.5 text-[10px] font-medium text-emerald-500 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" /> Approve
                    </button>
                    <button
                      onClick={() => handleRejectClick(wf.id)}
                      disabled={rejectMutation.isPending}
                      className="flex flex-1 items-center justify-center gap-1 rounded border border-red-500/30 bg-red-500/10 py-1.5 text-[10px] font-medium text-red-500 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Category Tabs */}
        <div className="mb-6 border-b border-[#1E1E1E]">
          <div className="flex gap-6 overflow-x-auto pb-1">
            {[
              { id: 'leave' as WorkflowType, label: 'Leave Requests' },
              {
                id: 'certificate' as WorkflowType,
                label: 'Certificate Requests',
              },
              {
                id: 'purchase_order' as WorkflowType,
                label: 'Purchase Orders',
              },
              { id: 'travel' as WorkflowType, label: 'Travel Claims' },
              { id: 'equipment' as WorkflowType, label: 'Equipment Requests' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-emerald-500 font-bold text-emerald-500'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Workflows Table */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-[#1E1E1E] bg-[#141414]">
          {/* Header */}
          <div className="flex flex-col items-center justify-between gap-4 border-b border-[#1E1E1E] p-4 sm:flex-row">
            <h3 className="flex items-center gap-2 text-base font-semibold text-white">
              {activeTab === 'leave' && 'Leave Requests'}
              {activeTab === 'certificate' && 'Certificate Requests'}
              {activeTab === 'purchase_order' && 'Purchase Orders'}
              {activeTab === 'travel' && 'Travel Claims'}
              {activeTab === 'equipment' && 'Equipment Requests'}
            </h3>
            <div className="flex w-full gap-2 sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-2 h-3.5 w-3.5 text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search title, description..."
                  className="w-full rounded-lg border border-[#1E1E1E] bg-[#262626] py-1.5 pl-9 pr-3 text-xs text-gray-200 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-[#1E1E1E] bg-[#262626] px-3 py-1.5 text-xs text-gray-300 outline-none focus:border-emerald-500"
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {workflowsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : filteredWorkflows.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">
                No workflows found
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1E1E1E] bg-[#262626]/50">
                    <TableHead className="text-xs font-medium uppercase text-gray-400">
                      Requested By
                    </TableHead>
                    <TableHead className="text-xs font-medium uppercase text-gray-400">
                      Title
                    </TableHead>
                    <TableHead className="text-xs font-medium uppercase text-gray-400">
                      Description
                    </TableHead>
                    <TableHead className="text-xs font-medium uppercase text-gray-400">
                      Priority
                    </TableHead>
                    <TableHead className="text-xs font-medium uppercase text-gray-400">
                      Step
                    </TableHead>
                    <TableHead className="text-xs font-medium uppercase text-gray-400">
                      Status
                    </TableHead>
                    <TableHead className="text-xs font-medium uppercase text-gray-400">
                      Due Date
                    </TableHead>
                    <TableHead className="text-right text-xs font-medium uppercase text-gray-400">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWorkflows.map((wf) => (
                    <TableRow
                      key={wf.id}
                      className="border-[#1E1E1E] transition-colors hover:bg-[#262626]/30"
                    >
                      <TableCell className="text-xs text-gray-400">
                        {wf.requested_by_name || 'Unknown'}
                      </TableCell>
                      <TableCell className="font-medium text-white">
                        {wf.title || wf.workflow_type}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-gray-400">
                        {wf.description || '—'}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-[10px] font-medium ${
                            wf.priority === 'high' || wf.priority === 'urgent'
                              ? 'bg-red-500/10 text-red-400'
                              : 'bg-gray-700/50 text-gray-400'
                          }`}
                        >
                          {wf.priority}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-gray-400">
                        Step {wf.current_step}
                      </TableCell>
                      <TableCell>{getStatusBadge(wf.status)}</TableCell>
                      <TableCell className="text-xs text-gray-400">
                        {wf.due_date
                          ? new Date(wf.due_date).toLocaleDateString()
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <button className="text-gray-500 hover:text-white">
                          <MoreVertical className="h-[18px] w-[18px]" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Pagination */}
          {!workflowsLoading && workflowsData && (
            <div className="flex items-center justify-between border-t border-[#1E1E1E] p-3 text-xs text-gray-500">
              <span>
                Showing 1-{workflowsData.data.length} of {workflowsData.total}
              </span>
              <div className="flex gap-1">
                <button
                  disabled={workflowsData.page === 1}
                  className="rounded px-2 py-1 transition-colors hover:bg-[#262626] disabled:opacity-50"
                >
                  Prev
                </button>
                <button className="rounded bg-[#262626] px-2 py-1 text-white transition-colors">
                  {workflowsData.page}
                </button>
                <button
                  disabled={workflowsData.page >= workflowsData.total_pages}
                  className="rounded px-2 py-1 transition-colors hover:bg-[#262626] disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Approve Confirm Modal */}
      {approveConfirmWorkflowId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#1E1E1E] bg-[#141414] p-6">
            <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
              Confirm Approval
            </div>
            <p className="mb-4 text-sm text-gray-400">
              Are you sure you want to approve this workflow? This will advance
              it to the next step.
            </p>
            <div className="mb-4">
              <label className="mb-1 block text-xs font-medium text-gray-400">
                Comment (Optional)
              </label>
              <textarea
                value={approveComment}
                onChange={(e) => setApproveComment(e.target.value)}
                placeholder="Add a comment..."
                rows={3}
                className="w-full rounded-lg border border-[#1E1E1E] bg-[#262626] p-2 text-sm text-gray-200 outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setApproveConfirmWorkflowId(null)}
                disabled={approveMutation.isPending}
                className="flex-1 rounded border border-[#1E1E1E] bg-[#262626] py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-[#262626]/80 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleApproveConfirm}
                disabled={approveMutation.isPending}
                className="flex flex-1 items-center justify-center gap-2 rounded bg-emerald-500 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
              >
                {approveMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectWorkflowId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#1E1E1E] bg-[#141414] p-6">
            <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
              <XCircle className="h-5 w-5 text-red-500" />
              Reject Workflow
            </div>
            <p className="mb-4 text-sm text-gray-400">
              Please provide a reason for rejecting this workflow.
            </p>
            <div className="mb-4">
              <label className="mb-1 block text-xs font-medium text-gray-400">
                Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this workflow is being rejected..."
                rows={4}
                className="w-full rounded-lg border border-[#1E1E1E] bg-[#262626] p-2 text-sm text-gray-200 outline-none focus:border-red-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setRejectWorkflowId(null)}
                disabled={rejectMutation.isPending}
                className="flex-1 rounded border border-[#1E1E1E] bg-[#262626] py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-[#262626]/80 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectConfirm}
                disabled={rejectMutation.isPending || !rejectReason.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded bg-red-500 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
              >
                {rejectMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
