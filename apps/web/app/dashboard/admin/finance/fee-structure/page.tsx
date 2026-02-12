"use client";

import { useState, useMemo } from "react";
import {
  Plus,
  Copy,
  Trash2,
  Check,
  X,
  ShieldCheck,
  AlertTriangle,
  FileText,
  CheckCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { FeeComponent, FeeQuota, InstallmentRow } from "@/types/admin";

// ---------------------------------------------------------------------------
// Mock data — TODO: Replace with API calls
// ---------------------------------------------------------------------------

const INITIAL_COMPONENTS: FeeComponent[] = [
  { id: "1", name: "Tuition Fee", sem1: 72000, sem2: 72000, annual: 144000, isRefundable: false, isOneTime: false },
  { id: "2", name: "Development Fee", sem1: 15000, sem2: 15000, annual: 30000, isRefundable: false, isOneTime: false },
  { id: "3", name: "Hostel (Boys)", sem1: 45000, sem2: 0, annual: 45000, isRefundable: false, isOneTime: false },
  { id: "4", name: "Mess Charges", sem1: 30000, sem2: 30000, annual: 60000, isRefundable: false, isOneTime: false },
  { id: "5", name: "Library Fee", sem1: 5000, sem2: 0, annual: 5000, isRefundable: false, isOneTime: false },
  { id: "6", name: "Caution Deposit", sem1: 10000, sem2: 0, annual: 10000, isRefundable: true, isOneTime: true },
  { id: "7", name: "Admission Fee", sem1: 2500, sem2: 0, annual: 2500, isRefundable: false, isOneTime: true },
  { id: "8", name: "Univ. Registration", sem1: 4000, sem2: 0, annual: 4000, isRefundable: false, isOneTime: true },
];

const INSTALLMENTS: InstallmentRow[] = [
  { id: "1", number: 1, dueDate: "2025-08-01", splitPct: 60, amount: 180300, lateFeePerDay: 100, gracePeriod: "7 Days" },
  { id: "2", number: 2, dueDate: "2026-01-15", splitPct: 40, amount: 120200, lateFeePerDay: 100, gracePeriod: "7 Days" },
];

const SUMMARY_LINES = [
  { label: "Tuition & Academics", amount: "\u20B91,74,000" },
  { label: "Hostel & Mess", amount: "\u20B91,05,000" },
  { label: "One-Time / Refundable", amount: "\u20B921,500" },
];

const QUOTA_TABS: { value: FeeQuota; label: string }[] = [
  { value: "aiq", label: "All India Quota" },
  { value: "state", label: "State Quota" },
  { value: "management", label: "Management Quota" },
  { value: "nri", label: "NRI Quota" },
  { value: "institutional", label: "Institutional Quota" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatINR(amount: number): string {
  return amount.toLocaleString("en-IN");
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FeeStructurePage() {
  const [academicYear, setAcademicYear] = useState("2025-26");
  const [activeQuota, setActiveQuota] = useState<FeeQuota>("state");
  const [components, setComponents] = useState(INITIAL_COMPONENTS);
  const [installments] = useState(INSTALLMENTS);

  const totals = useMemo(() => {
    const sem1 = components.reduce((sum, c) => sum + c.sem1, 0);
    const sem2 = components.reduce((sum, c) => sum + c.sem2, 0);
    return { sem1, sem2, annual: sem1 + sem2 };
  }, [components]);

  function updateComponent(id: string, field: "sem1" | "sem2", value: number) {
    setComponents((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const updated = { ...c, [field]: value };
        updated.annual = updated.sem1 + updated.sem2;
        return updated;
      }),
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-white">Fee Structure</h1>
          <div className="flex items-center gap-2 bg-dark-elevated border border-dark-border rounded-lg px-3 py-1.5">
            <span className="text-sm text-gray-400">Academic Year:</span>
            <Select value={academicYear} onValueChange={setAcademicYear}>
              <SelectTrigger className="border-none bg-transparent text-white text-sm font-medium p-0 h-auto w-auto gap-1 shadow-none focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2025-26">2025-26</SelectItem>
                <SelectItem value="2024-25">2024-25</SelectItem>
                <SelectItem value="2023-24">2023-24</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button variant="outline">
          <Copy className="w-4 h-4" /> Copy from Previous Year
        </Button>
      </div>

      {/* Quota Tabs */}
      <Tabs value={activeQuota} onValueChange={(v) => setActiveQuota(v as FeeQuota)}>
        <TabsList className="bg-transparent border-b border-dark-border rounded-none h-auto p-0 w-full justify-start gap-6">
          {QUOTA_TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-none border-b-2 border-transparent px-1 py-4 text-sm font-medium text-gray-400 shadow-none data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none hover:text-gray-200"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeQuota} className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Tables */}
            <div className="lg:col-span-2 space-y-6">
              {/* Fee Components Breakdown */}
              <Card className="overflow-hidden">
                <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-dark-border p-4">
                  <CardTitle className="text-base">
                    Fee Components Breakdown
                  </CardTitle>
                  <button className="text-emerald-500 text-sm hover:text-emerald-400 font-medium flex items-center gap-1">
                    <Plus className="w-4 h-4" /> Add Component
                  </button>
                </CardHeader>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-dark-border bg-dark-elevated/50 hover:bg-dark-elevated/50">
                        <TableHead className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 min-w-[180px]">
                          Component Name
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 w-28 text-right">
                          Sem 1 (\u20B9)
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 w-28 text-right">
                          Sem 2 (\u20B9)
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 w-28 text-right">
                          Annual (\u20B9)
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 text-center">
                          Refundable
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 text-center">
                          One-Time
                        </TableHead>
                        <TableHead className="px-4 w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {components.map((comp) => (
                        <TableRow
                          key={comp.id}
                          className="border-dark-border hover:bg-dark-elevated/20"
                        >
                          <TableCell className="px-4 py-3 font-medium text-white">
                            {comp.name}
                          </TableCell>
                          <TableCell className="px-2 py-2 text-right">
                            <Input
                              type="number"
                              value={comp.sem1}
                              onChange={(e) =>
                                updateComponent(
                                  comp.id,
                                  "sem1",
                                  Number(e.target.value) || 0,
                                )
                              }
                              className="h-7 text-xs text-right bg-dark-elevated border-dark-border text-white w-full"
                            />
                          </TableCell>
                          <TableCell className="px-2 py-2 text-right">
                            <Input
                              type="number"
                              value={comp.sem2}
                              onChange={(e) =>
                                updateComponent(
                                  comp.id,
                                  "sem2",
                                  Number(e.target.value) || 0,
                                )
                              }
                              className="h-7 text-xs text-right bg-dark-elevated border-dark-border text-white w-full"
                            />
                          </TableCell>
                          <TableCell className="px-4 py-3 text-right font-semibold text-white">
                            {formatINR(comp.annual)}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-center">
                            {comp.isRefundable ? (
                              <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                            ) : (
                              <X className="w-4 h-4 text-gray-500 mx-auto" />
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-center">
                            {comp.isOneTime ? (
                              <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                            ) : (
                              <X className="w-4 h-4 text-gray-500 mx-auto" />
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-center">
                            <button className="text-gray-500 hover:text-red-400 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow className="bg-dark-elevated/30 border-t border-dark-border hover:bg-dark-elevated/30">
                        <TableCell className="px-4 py-3 font-semibold text-white">
                          TOTAL
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right text-gray-300 font-semibold">
                          \u20B9{formatINR(totals.sem1)}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right text-gray-300 font-semibold">
                          \u20B9{formatINR(totals.sem2)}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right text-emerald-400 text-lg font-semibold">
                          \u20B9{formatINR(totals.annual)}
                        </TableCell>
                        <TableCell colSpan={3} />
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              </Card>

              {/* Installment Plan */}
              <Card className="overflow-hidden">
                <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-dark-border p-4 bg-dark-elevated/20">
                  <CardTitle className="text-base">
                    Installment Plan Configuration
                  </CardTitle>
                  <button className="text-emerald-500 text-xs hover:text-emerald-400 font-medium uppercase tracking-wide">
                    Reset to Default
                  </button>
                </CardHeader>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-dark-border hover:bg-transparent">
                        <TableHead className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 w-16">
                          No.
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3">
                          Due Date
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 w-24">
                          % Split
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 text-right">
                          Amount (\u20B9)
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 w-32">
                          Late Fee / Day
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 w-32">
                          Grace Period
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {installments.map((inst) => (
                        <TableRow
                          key={inst.id}
                          className="border-dark-border hover:bg-dark-elevated/20"
                        >
                          <TableCell className="px-3 py-3 text-gray-400">
                            {inst.number}
                          </TableCell>
                          <TableCell className="px-3 py-3">
                            <Input
                              type="date"
                              defaultValue={inst.dueDate}
                              className="h-7 text-xs bg-dark-elevated border-dark-border text-white w-full"
                            />
                          </TableCell>
                          <TableCell className="px-3 py-3">
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                defaultValue={inst.splitPct}
                                className="h-7 w-12 text-xs text-center bg-dark-elevated border-dark-border text-white"
                              />
                              <span className="text-sm text-gray-400">%</span>
                            </div>
                          </TableCell>
                          <TableCell className="px-3 py-3 text-right text-gray-300">
                            {formatINR(inst.amount)}
                          </TableCell>
                          <TableCell className="px-3 py-3">
                            <div className="flex items-center gap-1">
                              <span className="text-sm text-gray-400">
                                \u20B9
                              </span>
                              <Input
                                type="number"
                                defaultValue={inst.lateFeePerDay}
                                className="h-7 text-xs bg-dark-elevated border-dark-border text-white w-full"
                              />
                            </div>
                          </TableCell>
                          <TableCell className="px-3 py-3 text-gray-400 text-sm">
                            {inst.gracePeriod}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </div>

            {/* Right Column: Compliance + Summary */}
            <div className="lg:col-span-1 space-y-6">
              {/* Regulatory Compliance */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-base font-semibold text-white">
                      Regulatory Compliance
                    </h3>
                    <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="space-y-4">
                    {/* Authority */}
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-semibold mb-1">
                        Authority
                      </p>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-yellow-600/20 text-yellow-500 flex items-center justify-center text-xs font-bold border border-yellow-600/30">
                          K
                        </div>
                        <span className="text-sm text-gray-200">
                          Karnataka KEA (Govt Quota)
                        </span>
                      </div>
                    </div>

                    {/* Cap Progress */}
                    <div className="p-3 rounded-lg bg-dark-elevated/50 border border-dark-border">
                      <div className="flex justify-between items-end mb-2">
                        <div>
                          <p className="text-xs text-gray-400">
                            Maximum Cap (Tuition)
                          </p>
                          <p className="text-lg font-bold text-white">
                            \u20B91,44,250
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-400">
                            Current Total
                          </p>
                          <p className="text-lg font-bold text-emerald-400">
                            \u20B91,44,000
                          </p>
                        </div>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-1.5 mb-2">
                        <div
                          className="bg-emerald-500 h-1.5 rounded-full"
                          style={{ width: "99.8%" }}
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge className="text-[10px] px-1.5 py-0.5 rounded">
                          Within Cap
                        </Badge>
                        <span className="text-[10px] text-gray-500">
                          (\u20B9250 remaining buffer)
                        </span>
                      </div>
                    </div>

                    {/* Audit Alert */}
                    <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10 flex gap-3 items-start">
                      <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-red-300 font-medium mb-0.5">
                          Audit Alert
                        </p>
                        <p className="text-[11px] text-red-400/80 leading-tight">
                          Caution deposit exceeds recommended 5% of tuition fee.
                          Please justify in FRC remarks.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Structure Summary */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-base font-semibold text-white mb-4">
                    Structure Summary
                  </h3>
                  <div className="space-y-3 text-sm">
                    {SUMMARY_LINES.map((line) => (
                      <div
                        key={line.label}
                        className="flex justify-between items-center py-2 border-b border-dashed border-dark-border"
                      >
                        <span className="text-gray-400">{line.label}</span>
                        <span className="text-white font-medium">
                          {line.amount}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-gray-200 font-semibold">
                        Grand Total
                      </span>
                      <span className="text-emerald-400 font-bold text-lg">
                        \u20B9{formatINR(totals.annual)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Footer Actions */}
      <div className="flex items-center justify-end gap-3 pt-6 border-t border-dark-border">
        <Button variant="ghost">Save Draft</Button>
        <Button variant="outline">
          <FileText className="w-4 h-4" /> Export for FRC Submission
        </Button>
        <Button className="px-6 shadow-lg shadow-emerald-500/20">
          <CheckCircle className="w-4 h-4" /> Publish Fee Structure
        </Button>
      </div>
    </div>
  );
}
