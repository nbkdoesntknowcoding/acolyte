'use client';

/**
 * Admin QR Analytics — composite hook.
 *
 * Combines scan summary, anomalies, action points, and device stats
 * into a single analytics view object. Reuses existing hooks.
 */

import { useMemo } from 'react';
import { useScanLogSummary, useScanLogAnomalies } from './use-scan-logs';
import { useActionPoints } from './use-action-points';
import { useDeviceStats } from './use-devices';
import type { ScanSummaryItem, AnomalyItem } from './use-scan-logs';
import type { QRActionPoint, DeviceStats } from '@/types/admin';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QRAnalyticsData {
  // Summary
  totalScans: number;
  totalSuccess: number;
  totalFailures: number;
  successRate: number;
  weekChange: number | null; // percentage change vs prior week (null if not enough data)

  // Action points
  actionPoints: QRActionPoint[];
  activePointCount: number;

  // Device stats
  deviceStats: DeviceStats | null;

  // Chart data
  dailyData: DailyChartRow[];       // for stacked area/bar chart
  typeDistribution: TypeSlice[];    // for pie chart
  failureBreakdown: FailureSlice[]; // for failure donut

  // Raw data for custom processing
  summaryItems: ScanSummaryItem[];
  anomalyItems: AnomalyItem[];
}

export interface DailyChartRow {
  date: string;
  total: number;
  [actionType: string]: number | string; // dynamic keys per action_type
}

export interface TypeSlice {
  action_type: string;
  count: number;
}

export interface FailureSlice {
  validation_result: string;
  count: number;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useQRAnalytics(days: number = 30) {
  const {
    data: summaryResp,
    isLoading: summaryLoading,
    error: summaryError,
  } = useScanLogSummary(days);

  const {
    data: anomaliesResp,
    isLoading: anomaliesLoading,
    error: anomaliesError,
  } = useScanLogAnomalies(days);

  const {
    data: actionPoints,
    isLoading: apLoading,
    error: apError,
  } = useActionPoints();

  const {
    data: deviceStats,
    isLoading: devLoading,
    error: devError,
  } = useDeviceStats();

  const isLoading = summaryLoading || anomaliesLoading || apLoading || devLoading;
  const error = summaryError || anomaliesError || apError || devError;

  const analytics = useMemo<QRAnalyticsData | null>(() => {
    if (!summaryResp && !anomaliesResp && !actionPoints) return null;

    const items = summaryResp?.data ?? [];
    const anomalies = anomaliesResp?.anomalies ?? [];
    const points = actionPoints ?? [];

    // Totals
    const totalSuccess = items.reduce((s, r) => s + r.count, 0);
    const totalFailures = anomalies.reduce((s, a) => s + a.count, 0);
    const totalScans = totalSuccess + totalFailures;
    const successRate = totalScans > 0 ? Math.round((totalSuccess / totalScans) * 1000) / 10 : 0;

    // Week-over-week change (compare last 7 days vs prior 7 days)
    let weekChange: number | null = null;
    if (days >= 14) {
      const allDates = items.map((r) => r.date).sort();
      if (allDates.length > 0) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 7);
        const cutoffStr = cutoff.toISOString().slice(0, 10);
        const thisWeek = items.filter((r) => r.date >= cutoffStr).reduce((s, r) => s + r.count, 0);
        const lastWeek = items.filter((r) => r.date < cutoffStr).reduce((s, r) => s + r.count, 0);
        if (lastWeek > 0) {
          weekChange = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
        }
      }
    }

    // Active action points
    const activePointCount = points.filter((p) => p.is_active).length;

    // Daily chart data: group by date, sum per action_type
    const dailyMap = new Map<string, Record<string, number>>();
    for (const row of items) {
      const entry = dailyMap.get(row.date) ?? {};
      entry[row.action_type] = (entry[row.action_type] ?? 0) + row.count;
      dailyMap.set(row.date, entry);
    }
    const dailyData: DailyChartRow[] = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, types]) => {
        const total = Object.values(types).reduce((s, c) => s + c, 0);
        return { date, total, ...types };
      });

    // Type distribution (for pie chart)
    const typeMap = new Map<string, number>();
    for (const row of items) {
      typeMap.set(row.action_type, (typeMap.get(row.action_type) ?? 0) + row.count);
    }
    const typeDistribution: TypeSlice[] = Array.from(typeMap.entries())
      .map(([action_type, count]) => ({ action_type, count }))
      .sort((a, b) => b.count - a.count);

    // Failure breakdown
    const failureMap = new Map<string, number>();
    for (const a of anomalies) {
      failureMap.set(a.validation_result, (failureMap.get(a.validation_result) ?? 0) + a.count);
    }
    const failureBreakdown: FailureSlice[] = Array.from(failureMap.entries())
      .map(([validation_result, count]) => ({ validation_result, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalScans,
      totalSuccess,
      totalFailures,
      successRate,
      weekChange,
      actionPoints: points,
      activePointCount,
      deviceStats: deviceStats ?? null,
      dailyData,
      typeDistribution,
      failureBreakdown,
      summaryItems: items,
      anomalyItems: anomalies,
    };
  }, [summaryResp, anomaliesResp, actionPoints, deviceStats, days]);

  return { data: analytics, isLoading, error };
}
