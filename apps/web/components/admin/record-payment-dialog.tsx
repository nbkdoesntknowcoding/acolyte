"use client";

import { useState, useEffect } from "react";
import { User, X, Search, Receipt, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatINR } from "@/lib/format";
import { useRecordPayment } from "@/lib/hooks/admin/use-fee-collection";
import { useStudents } from "@/lib/hooks/admin/use-students";
import type { StudentResponse } from "@/types/admin-api";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  academicYear?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RecordPaymentDialog({
  open,
  onOpenChange,
  academicYear = "2025-26",
}: RecordPaymentDialogProps) {
  // Student search
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentResponse | null>(
    null,
  );

  // Payment form
  const [paymentMethod, setPaymentMethod] = useState("neft");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [amountRupees, setAmountRupees] = useState("");
  const [notes, setNotes] = useState("");

  const recordPayment = useRecordPayment();

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const students = useStudents(
    { search: debouncedSearch, page_size: 5 },
    { enabled: debouncedSearch.length >= 2 },
  );

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setDebouncedSearch("");
      setSelectedStudent(null);
      setPaymentMethod("neft");
      setReferenceNumber("");
      setBankName("");
      setPaymentDate(new Date().toISOString().split("T")[0]);
      setAmountRupees("");
      setNotes("");
    }
  }, [open]);

  async function handleSubmit() {
    if (!selectedStudent || !amountRupees) return;

    const amountPaisa = Math.round(parseFloat(amountRupees) * 100);
    if (amountPaisa <= 0) return;

    await recordPayment.mutateAsync({
      student_id: selectedStudent.id,
      amount: amountPaisa,
      payment_method: paymentMethod,
      reference_number: referenceNumber || undefined,
      bank_name: bankName || undefined,
      payment_date: paymentDate || undefined,
      academic_year: academicYear,
      notes: notes || undefined,
    });

    onOpenChange(false);
  }

  const initials = selectedStudent
    ? selectedStudent.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 border-dark-border bg-dark-surface">
        {/* Header */}
        <div className="p-6 border-b border-dark-border flex justify-between items-start bg-dark-elevated/30">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-800 to-emerald-900 flex items-center justify-center border border-emerald-700/50 text-emerald-100 font-bold text-lg shadow-lg shadow-emerald-900/20">
              {selectedStudent ? initials : <Receipt className="w-5 h-5" />}
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-white tracking-tight">
                Record Fee Payment
              </DialogTitle>
              {selectedStudent && (
                <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                  <span className="flex items-center gap-1">
                    <User className="w-4 h-4" /> {selectedStudent.name}
                  </span>
                  <span className="w-1 h-1 rounded-full bg-gray-600" />
                  <span className="font-mono text-emerald-400/80">
                    {selectedStudent.enrollment_number ??
                      selectedStudent.id.slice(0, 8)}
                  </span>
                  {selectedStudent.admission_quota && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-gray-600" />
                      <Badge variant="outline" className="text-xs">
                        {selectedStudent.admission_quota}
                      </Badge>
                    </>
                  )}
                </div>
              )}
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
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Student Search */}
          {!selectedStudent ? (
            <div>
              <Label className="text-xs text-gray-400">Search Student</Label>
              <div className="relative mt-1.5">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  placeholder="Search by name or enrollment number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-dark-elevated border-dark-border text-white placeholder:text-gray-600"
                  autoFocus
                />
              </div>
              {students.isLoading && debouncedSearch.length >= 2 && (
                <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Searching...
                </div>
              )}
              {students.data?.data && students.data.data.length > 0 && (
                <div className="mt-2 border border-dark-border rounded-lg overflow-hidden">
                  {students.data.data.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSelectedStudent(s);
                        setSearchQuery("");
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-dark-elevated/50 border-b border-dark-border last:border-0 transition-colors"
                    >
                      <p className="text-sm text-white font-medium">
                        {s.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {s.enrollment_number ?? "No enrollment #"} &bull;{" "}
                        {s.admission_quota ?? "Unknown quota"}
                      </p>
                    </button>
                  ))}
                </div>
              )}
              {students.data?.data?.length === 0 &&
                debouncedSearch.length >= 2 && (
                  <p className="mt-2 text-xs text-gray-500">
                    No students found.
                  </p>
                )}
            </div>
          ) : (
            <button
              onClick={() => setSelectedStudent(null)}
              className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              &larr; Change student
            </button>
          )}

          {/* Payment Form — shown after student selected */}
          {selectedStudent && (
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
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    className="mt-1.5 bg-dark-elevated border-dark-border text-white placeholder:text-gray-600"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-400">Bank Name</Label>
                  <Input
                    placeholder="Ex: HDFC Bank"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
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
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
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
                      value={amountRupees}
                      onChange={(e) => setAmountRupees(e.target.value)}
                      placeholder="0"
                      className="pl-8 bg-dark-elevated border-emerald-500/50 text-white font-bold text-lg shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                    />
                  </div>
                  {amountRupees && parseFloat(amountRupees) > 0 && (
                    <p className="text-[10px] text-gray-500 mt-1 text-right">
                      = ₹{formatINR(parseFloat(amountRupees))}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-xs text-gray-400">Remarks</Label>
                  <textarea
                    placeholder="Optional notes..."
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-1.5 w-full bg-dark-elevated border border-dark-border rounded-md px-3 py-2.5 text-white text-sm placeholder:text-gray-600 resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-dark-border bg-dark-elevated/20 flex justify-between items-center">
          <div className="text-xs text-gray-500">
            {recordPayment.isError && (
              <span className="text-red-400">
                Error: {recordPayment.error.message}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                !selectedStudent ||
                !amountRupees ||
                parseFloat(amountRupees) <= 0 ||
                recordPayment.isPending
              }
              className="px-6 shadow-lg shadow-emerald-500/20"
            >
              {recordPayment.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Recording...
                </>
              ) : (
                <>
                  <Receipt className="w-4 h-4" /> Record Payment
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
