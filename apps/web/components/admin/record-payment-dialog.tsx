"use client";

import { useState, useMemo } from "react";
import {
  User,
  X,
  PieChart,
  ShieldCheck,
  Send,
  Receipt,
  QrCode,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatINR } from "@/lib/format";
import type { OutstandingDue, PaymentAllocationItem } from "@/types/admin";

// ---------------------------------------------------------------------------
// Mock data — TODO: Replace with API calls
// ---------------------------------------------------------------------------

const OUTSTANDING_DUES: OutstandingDue[] = [
  { component: "Tuition Fee", total: 72000, paid: 20000, balance: 52000 },
  { component: "Hostel Fee", total: 45000, paid: 0, balance: 45000 },
  { component: "Mess Charges", total: 30000, paid: 0, balance: 30000 },
];

const INITIAL_ALLOCATIONS: PaymentAllocationItem[] = [
  { id: "1", component: "Tuition Fee", enabled: true, amount: 30000, maxAmount: 52000 },
  { id: "2", component: "Hostel Fee", enabled: true, amount: 20000, maxAmount: 45000 },
  { id: "3", component: "Mess Charges", enabled: false, amount: 0, maxAmount: 30000 },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentName?: string;
  studentInitials?: string;
  enrollmentNo?: string;
  quota?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RecordPaymentDialog({
  open,
  onOpenChange,
  studentName = "Jyothi Sharma",
  studentInitials = "JS",
  enrollmentNo = "MBBS-2023-042",
  quota = "Merit Quota",
}: RecordPaymentDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState("neft");
  const [paymentAmount, setPaymentAmount] = useState(50000);
  const [allocations, setAllocations] = useState(INITIAL_ALLOCATIONS);

  const totalOutstanding = OUTSTANDING_DUES.reduce((s, d) => s + d.balance, 0);
  const totalAllocated = useMemo(
    () => allocations.filter((a) => a.enabled).reduce((s, a) => s + a.amount, 0),
    [allocations],
  );

  function toggleAllocation(id: string) {
    setAllocations((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, enabled: !a.enabled, amount: a.enabled ? 0 : a.amount }
          : a,
      ),
    );
  }

  function updateAllocationAmount(id: string, value: number) {
    setAllocations((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, amount: Math.min(value, a.maxAmount) } : a,
      ),
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden flex flex-col p-0 gap-0 border-dark-border bg-dark-surface">
        {/* Custom Header — not using DialogHeader because of complex layout */}
        <div className="p-6 border-b border-dark-border flex justify-between items-start bg-dark-elevated/30">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-800 to-emerald-900 flex items-center justify-center border border-emerald-700/50 text-emerald-100 font-bold text-lg shadow-lg shadow-emerald-900/20">
              {studentInitials}
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-white tracking-tight">
                Record Fee Payment
              </DialogTitle>
              <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                <span className="flex items-center gap-1">
                  <User className="w-4 h-4" /> {studentName}
                </span>
                <span className="w-1 h-1 rounded-full bg-gray-600" />
                <span className="font-mono text-emerald-400/80">
                  {enrollmentNo}
                </span>
                <span className="w-1 h-1 rounded-full bg-gray-600" />
                <Badge variant="outline" className="text-xs">
                  {quota}
                </Badge>
              </div>
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="text-gray-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-dark-elevated"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-12 gap-6">
            {/* Left: 8 cols */}
            <div className="col-span-12 lg:col-span-8 space-y-6">
              {/* Outstanding Dues */}
              <div className="bg-dark-elevated/20 border border-dark-border rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
                    Outstanding Dues
                  </h3>
                  <span className="text-xs text-gray-500">
                    AY 2025-26 &bull; Sem 1
                  </span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="border-dark-border hover:bg-transparent">
                      <TableHead className="text-xs text-gray-500 font-medium pb-2">
                        Component
                      </TableHead>
                      <TableHead className="text-xs text-gray-500 font-medium pb-2 text-right">
                        Total (₹)
                      </TableHead>
                      <TableHead className="text-xs text-gray-500 font-medium pb-2 text-right">
                        Paid (₹)
                      </TableHead>
                      <TableHead className="text-xs text-white font-medium pb-2 text-right">
                        Balance (₹)
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {OUTSTANDING_DUES.map((due) => (
                      <TableRow
                        key={due.component}
                        className="border-dark-border/50 hover:bg-transparent"
                      >
                        <TableCell className="py-2 text-gray-300">
                          {due.component}
                        </TableCell>
                        <TableCell className="py-2 text-right text-gray-400">
                          {formatINR(due.total)}
                        </TableCell>
                        <TableCell className="py-2 text-right text-gray-400">
                          {formatINR(due.paid)}
                        </TableCell>
                        <TableCell className="py-2 text-right text-red-400 font-medium">
                          {formatINR(due.balance)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="border-t border-dark-border pt-3 mt-1 flex justify-between items-center">
                  <span className="font-semibold text-white">
                    Total Outstanding
                  </span>
                  <span className="text-lg font-bold text-red-400">
                    ₹{formatINR(totalOutstanding)}
                  </span>
                </div>
              </div>

              {/* Payment Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-gray-400">
                      Payment Method
                    </Label>
                    <Select
                      value={paymentMethod}
                      onValueChange={setPaymentMethod}
                    >
                      <SelectTrigger className="mt-1.5 bg-dark-elevated border-dark-border text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="neft">NEFT / RTGS</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                        <SelectItem value="card">
                          Credit / Debit Card
                        </SelectItem>
                        <SelectItem value="netbanking">Net Banking</SelectItem>
                        <SelectItem value="dd">Demand Draft (DD)</SelectItem>
                        <SelectItem value="cash">Cash</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-400">
                      Reference No. (UTR / DD No.)
                    </Label>
                    <Input
                      placeholder="Ex: UTR88392010"
                      className="mt-1.5 bg-dark-elevated border-dark-border text-white placeholder:text-gray-600"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-400">Bank Name</Label>
                    <Input
                      placeholder="Ex: HDFC Bank"
                      className="mt-1.5 bg-dark-elevated border-dark-border text-white placeholder:text-gray-600"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-gray-400">
                      Transaction Date
                    </Label>
                    <Input
                      type="date"
                      defaultValue="2025-06-15"
                      className="mt-1.5 bg-dark-elevated border-dark-border text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-400">
                      Payment Amount (₹)
                    </Label>
                    <div className="relative mt-1.5">
                      <span className="absolute left-3 top-2.5 text-gray-500 font-semibold">
                        ₹
                      </span>
                      <Input
                        type="number"
                        value={paymentAmount}
                        onChange={(e) =>
                          setPaymentAmount(Number(e.target.value) || 0)
                        }
                        className="pl-8 bg-dark-elevated border-emerald-500/50 text-white font-bold text-lg shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                      />
                    </div>
                    <p className="text-[10px] text-emerald-500 mt-1 text-right font-medium">
                      Partial payment accepted
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-400">Remarks</Label>
                    <textarea
                      placeholder="Optional notes..."
                      rows={1}
                      className="mt-1.5 w-full bg-dark-elevated border border-dark-border rounded-md px-3 py-2.5 text-white text-sm placeholder:text-gray-600 resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Payment Allocation */}
              <div className="bg-dark-elevated/10 border border-dark-border rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-emerald-500" /> Payment
                  Allocation
                </h3>
                <div className="space-y-3">
                  {allocations.map((alloc) => (
                    <div
                      key={alloc.id}
                      className={`flex items-center gap-3 ${!alloc.enabled ? "opacity-50" : ""}`}
                    >
                      <Checkbox
                        checked={alloc.enabled}
                        onCheckedChange={() => toggleAllocation(alloc.id)}
                        className="border-gray-600 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                      />
                      <span className="text-sm text-gray-300 w-32">
                        {alloc.component}
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={alloc.maxAmount}
                        value={alloc.amount}
                        disabled={!alloc.enabled}
                        onChange={(e) =>
                          updateAllocationAmount(
                            alloc.id,
                            Number(e.target.value),
                          )
                        }
                        className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500 disabled:cursor-default"
                      />
                      <div className="w-28 relative">
                        <span className="absolute left-2 top-1.5 text-gray-500 text-xs">
                          ₹
                        </span>
                        <Input
                          type="number"
                          value={alloc.amount}
                          disabled={!alloc.enabled}
                          onChange={(e) =>
                            updateAllocationAmount(
                              alloc.id,
                              Number(e.target.value) || 0,
                            )
                          }
                          className="h-7 pl-5 text-right text-sm bg-dark-elevated border-dark-border text-white disabled:text-gray-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t border-dark-border flex justify-end gap-2 text-sm">
                  <span className="text-gray-400">Allocated:</span>
                  <span className="text-emerald-400 font-bold">
                    ₹{formatINR(totalAllocated)}
                  </span>
                  <span className="text-gray-600 mx-1">/</span>
                  <span className="text-gray-400">Entered:</span>
                  <span className="text-white font-bold">
                    ₹{formatINR(paymentAmount)}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Receipt Preview — 4 cols */}
            <div className="col-span-12 lg:col-span-4">
              <div className="bg-dark-elevated/10 border border-dark-border rounded-xl p-4 flex flex-col h-full">
                <h3 className="text-sm font-semibold text-gray-300 mb-4">
                  Receipt Preview
                </h3>
                <div className="flex-1 bg-white rounded-lg p-4 shadow-lg relative overflow-hidden border border-gray-200">
                  <div className="text-[8px] text-gray-800 leading-tight space-y-2 opacity-80 pointer-events-none select-none">
                    {/* Receipt header */}
                    <div className="flex justify-between items-start border-b border-gray-200 pb-2">
                      <div>
                        <div className="font-bold text-emerald-800 text-[10px]">
                          ACOLYTE MEDICAL COLLEGE
                        </div>
                        <div>Bangalore, Karnataka</div>
                      </div>
                      <div className="text-right">
                        <div>Date: 15/06/2025</div>
                        <div>
                          Rcpt #:{" "}
                          <span className="text-red-500">DRAFT</span>
                        </div>
                      </div>
                    </div>
                    {/* Student info */}
                    <div className="grid grid-cols-2 gap-2 py-1">
                      <div>
                        <span className="font-bold">Student:</span>{" "}
                        {studentName}
                        <br />
                        <span className="font-bold">ID:</span> {enrollmentNo}
                      </div>
                      <div className="text-right">
                        <span className="font-bold">Batch:</span> 2023-24
                        <br />
                        <span className="font-bold">Sem:</span> 3
                      </div>
                    </div>
                    {/* Items */}
                    <table className="w-full border-collapse border border-gray-200 mt-2">
                      <tbody>
                        <tr className="bg-gray-100 font-bold">
                          <td className="p-1 border border-gray-200">
                            Description
                          </td>
                          <td className="p-1 border border-gray-200 text-right">
                            Amount
                          </td>
                        </tr>
                        {allocations
                          .filter((a) => a.enabled && a.amount > 0)
                          .map((a) => (
                            <tr key={a.id}>
                              <td className="p-1 border border-gray-200">
                                {a.component} Payment
                              </td>
                              <td className="p-1 border border-gray-200 text-right">
                                {formatINR(a.amount)}.00
                              </td>
                            </tr>
                          ))}
                        <tr className="font-bold">
                          <td className="p-1 border border-gray-200 text-right">
                            Total Paid
                          </td>
                          <td className="p-1 border border-gray-200 text-right">
                            {formatINR(totalAllocated)}.00
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    {/* Footer */}
                    <div className="flex justify-between items-end pt-4 mt-auto">
                      <div className="w-10 h-10 bg-gray-100 border border-gray-200 flex items-center justify-center">
                        <QrCode className="w-4 h-4 text-gray-400" />
                      </div>
                      <div className="text-center">
                        <div className="h-6 w-16 mb-1 mx-auto border-b border-gray-300" />
                        <div className="text-[6px] text-gray-500">
                          Authorized Signatory
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* PREVIEW watermark */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-4xl font-black text-gray-300/20 -rotate-45 border-4 border-gray-300/20 p-2 rounded">
                      PREVIEW
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-gray-500 bg-dark-elevated/30 p-2 rounded">
                    <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Digital Signature Applied</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 bg-dark-elevated/30 p-2 rounded">
                    <Send className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>Will be emailed to student</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-dark-border bg-dark-elevated/20 flex justify-between items-center">
          <div className="text-xs text-gray-500">
            <span className="font-semibold text-gray-400">Note:</span> Receipt
            generation is irreversible.
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button className="px-6 shadow-lg shadow-emerald-500/20">
              <Receipt className="w-4 h-4" /> Record &amp; Generate Receipt
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
