'use client';

import { useState, useMemo } from 'react';
import {
  Loader2,
  AlertCircle,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Plus,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useFeeRefunds, useUpdateFeeRefund } from '@/lib/hooks/admin/use-refunds';
import type { FeeRefundResponse } from '@/types/admin-api';
import { cn } from '@/lib/utils';

const STATUS_COLORS = {
  requested: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  approved: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  processing: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const STATUS_LABELS = {
  requested: 'Requested',
  approved: 'Approved',
  processing: 'Processing',
  completed: 'Completed',
  rejected: 'Rejected',
};

export default function RefundsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [rulesExpanded, setRulesExpanded] = useState(false);

  const { data: refundsData, isLoading, error } = useFeeRefunds({
    status: statusFilter === 'all' ? undefined : statusFilter,
    page_size: 100,
  });

  const refunds = refundsData?.data ?? [];

  const toRupees = (paisa: number | null) => {
    if (!paisa) return 0;
    return paisa / 100;
  };

  // Stats
  const stats = useMemo(() => {
    const pendingRefunds = refunds.filter((r) => r.status === 'requested' || r.status === 'approved');
    const pendingAmount = pendingRefunds.reduce((sum, r) => sum + (r.refund_amount || 0), 0);

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const processedThisMonth = refunds.filter(
      (r) =>
        r.status === 'completed' &&
        r.processed_at &&
        new Date(r.processed_at) >= firstDayOfMonth
    );
    const processedAmount = processedThisMonth.reduce((sum, r) => sum + (r.refund_amount || 0), 0);

    return {
      pendingCount: pendingRefunds.length,
      pendingAmount: toRupees(pendingAmount),
      processedCount: processedThisMonth.length,
      processedAmount: toRupees(processedAmount),
    };
  }, [refunds]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Fee Refunds</h1>
          <p className="text-gray-400 mt-2">
            Manage refund requests and processing workflow
          </p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="h-4 w-4 mr-2" />
          New Refund Request
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-[#141414] border-[#262626]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pending Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-500">{stats.pendingCount}</div>
            <p className="text-sm text-gray-400 mt-1">
              ₹{stats.pendingAmount.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#141414] border-[#262626]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Pending Amount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-500">
              ₹{stats.pendingAmount.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#141414] border-[#262626]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Processed This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-500">{stats.processedCount}</div>
            <p className="text-sm text-gray-400 mt-1">
              ₹{stats.processedAmount.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#141414] border-[#262626]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Total Refunds
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{refunds.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Refund Rules Card */}
      <Card className="bg-[#141414] border-[#262626]">
        <CardHeader
          className="cursor-pointer hover:bg-[#1E1E1E] transition-colors"
          onClick={() => setRulesExpanded(!rulesExpanded)}
        >
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">Refund Rules & Guidelines</CardTitle>
              <CardDescription className="text-gray-400">
                MCC and state counseling refund policies
              </CardDescription>
            </div>
            {rulesExpanded ? (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronRight className="h-5 w-5 text-gray-400" />
            )}
          </div>
        </CardHeader>
        {rulesExpanded && (
            <CardContent className="space-y-4">
              {/* MCC Rules */}
              <div className="border-l-4 border-emerald-500 pl-4">
                <h3 className="text-sm font-semibold text-white mb-2">
                  MCC (Medical Counseling Committee) Rules
                </h3>
                <ul className="space-y-1 text-sm text-gray-400">
                  <li>• Full refund if withdrawal before Round 1 allotment</li>
                  <li>• ₹10,000 deduction if withdrawal after Round 1 but before Round 2</li>
                  <li>• ₹50,000 deduction if withdrawal after Round 2</li>
                  <li>• Security deposit: Refundable after 1 year (₹2,00,000)</li>
                  <li>• Processing time: 15-30 working days via NEFT</li>
                </ul>
              </div>

              {/* State Counseling Rules */}
              <div className="border-l-4 border-blue-500 pl-4">
                <h3 className="text-sm font-semibold text-white mb-2">
                  State Counseling Rules (Karnataka Example)
                </h3>
                <ul className="space-y-1 text-sm text-gray-400">
                  <li>• Full refund if seat not allotted</li>
                  <li>• ₹5,000 deduction for cancellation before joining</li>
                  <li>• ₹25,000 deduction for withdrawal after joining</li>
                  <li>• Caution deposit: ₹50,000 (refundable at completion)</li>
                  <li>• No refund after 15 days of joining</li>
                </ul>
              </div>

              {/* Excess Payment */}
              <div className="border-l-4 border-yellow-500 pl-4">
                <h3 className="text-sm font-semibold text-white mb-2">Excess Payment Refunds</h3>
                <ul className="space-y-1 text-sm text-gray-400">
                  <li>• Full refund of excess amount paid (no deductions)</li>
                  <li>• Processed within 7 working days</li>
                  <li>• Verification against fee structure required</li>
                </ul>
              </div>

              {/* Processing Notes */}
              <div className="bg-[#1E1E1E] border border-[#262626] rounded-lg p-4 mt-4">
                <h3 className="text-sm font-semibold text-white mb-2">Processing Notes</h3>
                <ul className="space-y-1 text-sm text-gray-400">
                  <li>• All refunds processed via NEFT (no cash/cheque)</li>
                  <li>• Bank details must match student records</li>
                  <li>• Dean/Principal approval required for refunds &gt; ₹1,00,000</li>
                  <li>• NEFT reference number shared via email after completion</li>
                </ul>
              </div>
            </CardContent>
        )}
      </Card>

      {/* Refund Queue */}
      <Card className="bg-[#141414] border-[#262626]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">Refund Queue</CardTitle>
              <CardDescription className="text-gray-400">
                Track and process refund requests
              </CardDescription>
            </div>
            <div className="w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-[#1E1E1E] border-[#262626] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="requested">Requested</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <p className="text-gray-400">Failed to load refunds</p>
                <p className="text-xs text-gray-500 mt-2">
                  Backend routes may not be implemented yet
                </p>
              </div>
            </div>
          ) : refunds.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No refund requests found</p>
            </div>
          ) : (
            <div className="border border-[#262626] rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#1E1E1E] border-[#262626] hover:bg-[#1E1E1E]">
                    <TableHead className="text-gray-300">Student</TableHead>
                    <TableHead className="text-gray-300">Reason</TableHead>
                    <TableHead className="text-gray-300">Amount</TableHead>
                    <TableHead className="text-gray-300">Deductions</TableHead>
                    <TableHead className="text-gray-300">Refund Amount</TableHead>
                    <TableHead className="text-gray-300">Bank Details</TableHead>
                    <TableHead className="text-gray-300">Status</TableHead>
                    <TableHead className="text-gray-300">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {refunds.map((refund) => (
                    <RefundRow key={refund.id} refund={refund} toRupees={toRupees} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Refund Row Component
// ---------------------------------------------------------------------------

function RefundRow({
  refund,
  toRupees,
}: {
  refund: FeeRefundResponse;
  toRupees: (paisa: number | null) => number;
}) {
  const [showStatusDialog, setShowStatusDialog] = useState(false);

  return (
    <>
      <TableRow className="border-[#262626]">
        <TableCell className="text-gray-300">
          <div className="font-mono text-xs text-gray-500">{refund.student_id.slice(0, 8)}...</div>
        </TableCell>
        <TableCell className="text-gray-300">
          <Badge variant="outline" className="text-xs">
            {refund.reason || 'Not specified'}
          </Badge>
        </TableCell>
        <TableCell className="text-white font-semibold">
          ₹{toRupees(refund.original_amount_paid).toLocaleString()}
        </TableCell>
        <TableCell className="text-red-400">
          {refund.deductions ? `- ₹${toRupees(refund.deductions).toLocaleString()}` : '₹0'}
        </TableCell>
        <TableCell className="text-emerald-400 font-semibold">
          ₹{toRupees(refund.refund_amount).toLocaleString()}
        </TableCell>
        <TableCell className="text-gray-400 font-mono text-xs">
          {refund.bank_account_number_last4 ? (
            <div>
              <div>XXXX {refund.bank_account_number_last4}</div>
              <div className="text-gray-500">{refund.bank_name}</div>
            </div>
          ) : (
            '—'
          )}
        </TableCell>
        <TableCell>
          <Badge
            variant="outline"
            className={cn('text-xs', STATUS_COLORS[refund.status as keyof typeof STATUS_COLORS])}
          >
            {STATUS_LABELS[refund.status as keyof typeof STATUS_LABELS]}
          </Badge>
        </TableCell>
        <TableCell>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowStatusDialog(true)}
            className="text-emerald-500 hover:text-emerald-400"
          >
            Update
          </Button>
        </TableCell>
      </TableRow>

      {/* Status Update Dialog */}
      <StatusUpdateDialog
        refund={refund}
        open={showStatusDialog}
        onOpenChange={setShowStatusDialog}
        toRupees={toRupees}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Status Update Dialog
// ---------------------------------------------------------------------------

function StatusUpdateDialog({
  refund,
  open,
  onOpenChange,
  toRupees,
}: {
  refund: FeeRefundResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toRupees: (paisa: number | null) => number;
}) {
  const [targetStatus, setTargetStatus] = useState(refund.status);
  const updateMutation = useUpdateFeeRefund(refund.id);

  const getNextStatuses = (currentStatus: string) => {
    switch (currentStatus) {
      case 'requested':
        return ['approved', 'rejected'];
      case 'approved':
        return ['processing', 'rejected'];
      case 'processing':
        return ['completed', 'rejected'];
      case 'completed':
        return [];
      case 'rejected':
        return [];
      default:
        return [];
    }
  };

  const nextStatuses = getNextStatuses(refund.status);

  const handleUpdate = async () => {
    if (targetStatus === refund.status) {
      onOpenChange(false);
      return;
    }

    try {
      await updateMutation.mutateAsync({
        status: targetStatus as any,
      });
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to update refund:', err);
      alert(err instanceof Error ? err.message : 'Failed to update refund');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#141414] border-[#262626] max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white">Update Refund Status</DialogTitle>
          <DialogDescription className="text-gray-400">
            Manage refund workflow and status transitions
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Refund Details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <Label className="text-gray-400">Original Amount</Label>
              <p className="text-white font-semibold mt-1">
                ₹{toRupees(refund.original_amount_paid).toLocaleString()}
              </p>
            </div>
            <div>
              <Label className="text-gray-400">Deductions</Label>
              <p className="text-red-400 font-semibold mt-1">
                - ₹{toRupees(refund.deductions).toLocaleString()}
              </p>
            </div>
            <div>
              <Label className="text-gray-400">Refund Amount</Label>
              <p className="text-emerald-400 font-semibold text-lg mt-1">
                ₹{toRupees(refund.refund_amount).toLocaleString()}
              </p>
            </div>
            <div>
              <Label className="text-gray-400">Reason</Label>
              <Badge variant="outline" className="mt-1">
                {refund.reason || 'Not specified'}
              </Badge>
            </div>
          </div>

          {/* Bank Details */}
          {refund.bank_account_number_last4 && (
            <div className="border-t border-[#262626] pt-4">
              <Label className="text-gray-300 mb-2 block">Bank Details</Label>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-400">Account Number</p>
                  <p className="text-white font-mono mt-1">XXXX XXXX XXXX {refund.bank_account_number_last4}</p>
                </div>
                <div>
                  <p className="text-gray-400">Bank Name</p>
                  <p className="text-white mt-1">{refund.bank_name || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-400">IFSC Code</p>
                  <p className="text-white font-mono mt-1">{refund.bank_ifsc || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-400">Account Holder</p>
                  <p className="text-white mt-1">{refund.account_holder_name || '—'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Status Stepper */}
          <div className="border-t border-[#262626] pt-4">
            <Label className="text-gray-300 mb-4 block">Refund Workflow</Label>
            <div className="flex items-center gap-2">
              {['requested', 'approved', 'processing', 'completed'].map((status, idx, arr) => (
                <div key={status} className="flex items-center flex-1">
                  <div
                    className={cn(
                      'flex items-center justify-center h-10 w-10 rounded-full border-2',
                      refund.status === status
                        ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                        : STATUS_COLORS[status as keyof typeof STATUS_COLORS].includes(refund.status)
                          ? 'border-gray-600 bg-gray-600/20 text-gray-400'
                          : 'border-gray-700 bg-transparent text-gray-600'
                    )}
                  >
                    {refund.status === status ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-current" />
                    )}
                  </div>
                  <div className="ml-2 flex-1">
                    <p
                      className={cn(
                        'text-xs font-medium',
                        refund.status === status ? 'text-emerald-400' : 'text-gray-500'
                      )}
                    >
                      {STATUS_LABELS[status as keyof typeof STATUS_LABELS]}
                    </p>
                  </div>
                  {idx < arr.length - 1 && (
                    <ArrowRight className="h-4 w-4 text-gray-600 mx-2" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Next Status Actions */}
          {nextStatuses.length > 0 && (
            <div className="border-t border-[#262626] pt-4">
              <Label htmlFor="status" className="text-gray-300">
                Move to Status
              </Label>
              <Select value={targetStatus} onValueChange={setTargetStatus}>
                <SelectTrigger className="bg-[#1E1E1E] border-[#262626] text-white mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={refund.status}>
                    {STATUS_LABELS[refund.status as keyof typeof STATUS_LABELS]} (Current)
                  </SelectItem>
                  {nextStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {STATUS_LABELS[status as keyof typeof STATUS_LABELS]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* NEFT Reference */}
          {refund.neft_reference && (
            <div className="border-t border-[#262626] pt-4">
              <Label className="text-gray-300">NEFT Reference</Label>
              <p className="text-white font-mono mt-1">{refund.neft_reference}</p>
            </div>
          )}

          {/* Notes */}
          {refund.notes && (
            <div className="border-t border-[#262626] pt-4">
              <Label className="text-gray-300">Notes</Label>
              <p className="text-gray-400 text-sm mt-1">{refund.notes}</p>
            </div>
          )}

          {/* Action Buttons */}
          {nextStatuses.length > 0 && (
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={updateMutation.isPending || targetStatus === refund.status}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Update Status
                  </>
                )}
              </Button>
            </div>
          )}

          {refund.status === 'completed' && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
              <p className="text-sm text-emerald-400 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Refund completed successfully
              </p>
            </div>
          )}

          {refund.status === 'rejected' && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <p className="text-sm text-red-400 flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                Refund rejected
              </p>
              {refund.rejection_reason && (
                <p className="text-xs text-gray-400 mt-2">
                  Reason: {refund.rejection_reason}
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
