'use client';

import { useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  FileText,
  ArrowRight,
  Loader2,
  AlertCircle as AlertCircleIcon,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  useFinancialOverview,
  useComplianceHeatmap,
  useActionItems,
} from '@/lib/hooks/admin/use-executive';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RiskLevel = 'safe' | 'watch' | 'at_risk' | 'non_compliant';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ExecutiveDashboardPage() {
  // API calls
  const {
    data: financialData,
    isLoading: financialLoading,
    error: financialError,
  } = useFinancialOverview();

  const {
    data: complianceData,
    isLoading: complianceLoading,
    error: complianceError,
  } = useComplianceHeatmap();

  const {
    data: actionItemsData,
    isLoading: actionItemsLoading,
    error: actionItemsError,
  } = useActionItems();

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  // Convert paisa to rupees
  const toRupees = (paisa: number) => paisa / 100;

  // Financial metrics
  const financialMetrics = useMemo(() => {
    if (!financialData) {
      return {
        revenue: 0,
        expenditure: 0,
        netProfit: 0,
        profitMargin: 0,
      };
    }

    const revenue = toRupees(financialData.grand_total_captured);
    const pending = toRupees(financialData.grand_total_pending);
    const outstanding = toRupees(financialData.grand_total_outstanding);

    // Expenditure is pending + outstanding (simplified)
    const expenditure = pending + outstanding;
    const netProfit = revenue - expenditure;
    const profitMargin =
      revenue > 0 ? ((netProfit / revenue) * 100).toFixed(1) : '0.0';

    return {
      revenue,
      expenditure,
      netProfit,
      profitMargin: parseFloat(profitMargin),
    };
  }, [financialData]);

  // Revenue by year for chart
  const revenueChartData = useMemo(() => {
    if (!financialData?.years) return [];

    return financialData.years.map((year) => ({
      year: year.academic_year,
      revenue: toRupees(year.total_captured),
      pending: toRupees(year.total_pending),
    }));
  }, [financialData]);

  // Compliance score (based on action items)
  const complianceScore = useMemo(() => {
    if (!actionItemsData) return 0;

    const totalIssues =
      actionItemsData.msr_gaps_count +
      actionItemsData.expiring_documents_count +
      actionItemsData.faculty_retiring_soon_count;

    // Simple scoring: 100 - (issues * 5), capped at 0
    return Math.max(0, 100 - totalIssues * 5);
  }, [actionItemsData]);

  // Action items list
  const actionItems = useMemo(() => {
    if (!actionItemsData) return [];

    const items: Array<{
      title: string;
      description: string;
      priority: 'high' | 'medium' | 'low';
      link: string;
      count: number;
    }> = [];

    if (actionItemsData.overdue_fees_count > 0) {
      items.push({
        title: 'Overdue Fee Payments',
        description: `${actionItemsData.overdue_fees_count} payments overdue for >30 days`,
        priority: 'high',
        link: '/dashboard/admin/finance/fee-collection',
        count: actionItemsData.overdue_fees_count,
      });
    }

    if (actionItemsData.msr_gaps_count > 0) {
      items.push({
        title: 'Faculty MSR Gaps',
        description: `${actionItemsData.msr_gaps_count} departments below MSR requirements`,
        priority: 'high',
        link: '/dashboard/admin/hr',
        count: actionItemsData.msr_gaps_count,
      });
    }

    if (actionItemsData.pending_approvals_count > 0) {
      items.push({
        title: 'Pending Approvals',
        description: `${actionItemsData.pending_approvals_count} workflows awaiting approval`,
        priority: 'medium',
        link: '/dashboard/admin/workflows/approvals',
        count: actionItemsData.pending_approvals_count,
      });
    }

    if (actionItemsData.expiring_documents_count > 0) {
      items.push({
        title: 'Expiring Documents',
        description: `${actionItemsData.expiring_documents_count} documents expiring soon`,
        priority: 'medium',
        link: '/dashboard/admin/documents',
        count: actionItemsData.expiring_documents_count,
      });
    }

    if (actionItemsData.faculty_retiring_soon_count > 0) {
      items.push({
        title: 'Faculty Retirements',
        description: `${actionItemsData.faculty_retiring_soon_count} faculty retiring in next 6 months`,
        priority: 'low',
        link: '/dashboard/admin/hr',
        count: actionItemsData.faculty_retiring_soon_count,
      });
    }

    return items;
  }, [actionItemsData]);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const getRiskColor = (level: RiskLevel) => {
    switch (level) {
      case 'safe':
        return 'bg-emerald-500/20 text-emerald-400';
      case 'watch':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'at_risk':
        return 'bg-orange-500/20 text-orange-400';
      case 'non_compliant':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getPriorityBadge = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high':
        return (
          <Badge className="border-red-500/20 bg-red-500/10 text-red-400">
            High Priority
          </Badge>
        );
      case 'medium':
        return (
          <Badge className="border-yellow-500/20 bg-yellow-500/10 text-yellow-400">
            Medium Priority
          </Badge>
        );
      case 'low':
        return (
          <Badge className="border-blue-500/20 bg-blue-500/10 text-blue-400">
            Low Priority
          </Badge>
        );
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (financialError || complianceError || actionItemsError) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center bg-[#0A0A0A]">
        <div className="text-center">
          <AlertCircleIcon className="mx-auto h-12 w-12 text-red-500" />
          <p className="mt-2 text-sm text-gray-400">
            Failed to load executive dashboard data
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Executive Dashboard
          </h1>
          <p className="text-sm text-gray-400">
            High-level overview for college management
          </p>
        </div>
      </div>

      {/* Large Metric Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Revenue Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">
                  Total Revenue
                </p>
                <h3 className="mt-2 text-3xl font-bold text-white">
                  {financialLoading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  ) : (
                    formatCurrency(financialMetrics.revenue)
                  )}
                </h3>
                <div className="mt-2 flex items-center gap-1 text-sm text-emerald-400">
                  <TrendingUp className="h-4 w-4" />
                  Fee collections
                </div>
              </div>
              <div className="rounded-lg bg-emerald-500/10 p-3">
                <DollarSign className="h-6 w-6 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Expenditure Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">
                  Outstanding
                </p>
                <h3 className="mt-2 text-3xl font-bold text-white">
                  {financialLoading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  ) : (
                    formatCurrency(financialMetrics.expenditure)
                  )}
                </h3>
                <div className="mt-2 flex items-center gap-1 text-sm text-gray-400">
                  <TrendingDown className="h-4 w-4" />
                  Pending + Outstanding
                </div>
              </div>
              <div className="rounded-lg bg-orange-500/10 p-3">
                <AlertTriangle className="h-6 w-6 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Compliance Score Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">
                  Compliance Score
                </p>
                <h3 className="mt-2 text-3xl font-bold text-white">
                  {actionItemsLoading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  ) : (
                    `${complianceScore}%`
                  )}
                </h3>
                <div className="mt-2 flex items-center gap-1 text-sm text-emerald-400">
                  <CheckCircle className="h-4 w-4" />
                  Based on action items
                </div>
              </div>
              <div className="rounded-lg bg-blue-500/10 p-3">
                <CheckCircle className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Items Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">
                  Action Items
                </p>
                <h3 className="mt-2 text-3xl font-bold text-white">
                  {actionItemsLoading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  ) : (
                    actionItems.length
                  )}
                </h3>
                <div className="mt-2 flex items-center gap-1 text-sm text-red-400">
                  <Clock className="h-4 w-4" />
                  Require attention
                </div>
              </div>
              <div className="rounded-lg bg-red-500/10 p-3">
                <AlertTriangle className="h-6 w-6 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Revenue by Year Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Revenue by Academic Year</CardTitle>
          </CardHeader>
          <CardContent>
            {financialLoading ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : revenueChartData.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-sm text-gray-400">
                No revenue data available
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueChartData}>
                    <XAxis
                      dataKey="year"
                      stroke="#6b7280"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#6b7280"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `₹${(value / 100000).toFixed(0)}L`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="rounded border border-[#1E1E1E] bg-[#141414] p-3 shadow-lg">
                            <p className="text-xs text-gray-400">
                              {payload[0].payload.year}
                            </p>
                            <p className="text-sm font-bold text-emerald-400">
                              Revenue: {formatCurrency(payload[0].value as number)}
                            </p>
                            <p className="text-sm font-bold text-orange-400">
                              Pending: {formatCurrency(payload[1].value as number)}
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="pending" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Placeholder for Fee by Quota (not in backend yet) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Fee Collections by Quota</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-64 items-center justify-center text-sm text-gray-400">
              <div className="text-center">
                <FileText className="mx-auto mb-2 h-8 w-8" />
                <p>Fee by quota data not yet available</p>
                <p className="mt-1 text-xs text-gray-500">
                  Backend endpoint pending implementation
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Compliance Risk Heatmap</CardTitle>
        </CardHeader>
        <CardContent>
          {complianceLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : complianceData?.departments?.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              <div className="text-center">
                <AlertTriangle className="mx-auto mb-2 h-8 w-8" />
                <p>No compliance data available</p>
                <p className="mt-1 text-xs text-gray-500">
                  Compliance heatmap pending Compliance Engine integration
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1E1E1E]">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-400">
                      Department
                    </th>
                    {complianceData?.categories?.map((category) => (
                      <th
                        key={category}
                        className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-400"
                      >
                        {category}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {complianceData?.departments?.map((dept, index) => (
                    <tr
                      key={index}
                      className="border-b border-[#1E1E1E] hover:bg-[#1A1A1A]"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-white">
                        {dept}
                      </td>
                      {complianceData?.categories?.map((category) => {
                        // This is a placeholder - real data structure TBD
                        const riskLevel: RiskLevel = 'safe';
                        return (
                          <td key={category} className="px-4 py-3 text-center">
                            <span
                              className={`inline-block rounded px-3 py-1 text-xs font-medium ${getRiskColor(riskLevel)}`}
                            >
                              Safe
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Academic Performance (placeholder) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Academic Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center text-sm text-gray-400">
            <div className="text-center">
              <Users className="mx-auto mb-2 h-8 w-8" />
              <p>Academic performance data not yet available</p>
              <p className="mt-1 text-xs text-gray-500">
                Backend endpoint pending implementation
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Decisions Needed */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Key Decisions Needed</CardTitle>
        </CardHeader>
        <CardContent>
          {actionItemsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : actionItems.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              <CheckCircle className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
              <p>No urgent action items at this time</p>
            </div>
          ) : (
            <div className="space-y-3">
              {actionItems.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border border-[#1E1E1E] bg-[#141414] p-4 transition-colors hover:border-emerald-500/30"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-white">{item.title}</h4>
                      {getPriorityBadge(item.priority)}
                    </div>
                    <p className="mt-1 text-sm text-gray-400">
                      {item.description}
                    </p>
                  </div>
                  <a
                    href={item.link}
                    className="ml-4 flex items-center gap-2 text-sm font-medium text-emerald-500 hover:text-emerald-400"
                  >
                    View <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
