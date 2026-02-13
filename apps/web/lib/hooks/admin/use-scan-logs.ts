'use client';

/**
 * Admin QR Scan Logs — Data-fetching hooks.
 *
 * Wired to /api/v1/admin/qr/scan-logs/* endpoints.
 * Backend returns a flat array for the list endpoint (no total count).
 * Summary returns { period_days, data: [{date, action_type, count}] }.
 * Anomalies returns { period_days, anomalies: [{validation_result, rejection_reason, count}] }.
 * Export returns a CSV StreamingResponse.
 */

import { useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import {
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query';
import { createAdminFetcher } from '@/lib/api/admin-client-browser';
import type { QRScanLog } from '@/types/admin';

// ---------------------------------------------------------------------------
// Response shapes (match backend exactly)
// ---------------------------------------------------------------------------

export interface ScanSummaryItem {
  date: string;
  action_type: string;
  count: number;
}

export interface ScanSummaryResponse {
  period_days: number;
  data: ScanSummaryItem[];
}

export interface AnomalyItem {
  validation_result: string;
  rejection_reason: string | null;
  count: number;
}

export interface AnomaliesResponse {
  period_days: number;
  anomalies: AnomalyItem[];
}

// ---------------------------------------------------------------------------
// List params
// ---------------------------------------------------------------------------

export interface ScanLogListParams {
  user_id?: string;
  action_type?: string;
  validation_result?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/** List scan logs (flat array, server-side paginated by page/page_size). */
export function useScanLogs(
  params?: ScanLogListParams,
  options?: { enabled?: boolean; refetchInterval?: number },
): UseQueryResult<QRScanLog[]> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);

  const searchParams = new URLSearchParams();
  if (params) {
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined && val !== null && val !== '') {
        searchParams.set(key, String(val));
      }
    }
  }
  const qs = searchParams.toString();
  const path = qs ? `/qr/scan-logs?${qs}` : '/qr/scan-logs';

  return useQuery({
    queryKey: ['admin', 'qr', 'scan-logs', params ?? {}],
    queryFn: () => fetcher<QRScanLog[]>(path),
    ...options,
  });
}

/** Daily scan summary (successful scans by action type). */
export function useScanLogSummary(
  days: number = 30,
  options?: { enabled?: boolean },
): UseQueryResult<ScanSummaryResponse> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);

  return useQuery({
    queryKey: ['admin', 'qr', 'scan-logs', 'summary', days],
    queryFn: () => fetcher<ScanSummaryResponse>(`/qr/scan-logs/summary?days=${days}`),
    ...options,
  });
}

/** Anomalies — failed scans grouped by reason. */
export function useScanLogAnomalies(
  days: number = 30,
  options?: { enabled?: boolean },
): UseQueryResult<AnomaliesResponse> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);

  return useQuery({
    queryKey: ['admin', 'qr', 'scan-logs', 'anomalies', days],
    queryFn: () => fetcher<AnomaliesResponse>(`/qr/scan-logs/anomalies?days=${days}`),
    ...options,
  });
}

/** Returns a function that triggers CSV export download. */
export function useExportScanLogs(): {
  exportCsv: (params?: { action_type?: string; date_from?: string; date_to?: string }) => Promise<void>;
  isExporting: boolean;
} {
  const { getToken } = useAuth();

  const exportCsv = useCallback(
    async (params?: { action_type?: string; date_from?: string; date_to?: string }) => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const searchParams = new URLSearchParams();
      if (params) {
        for (const [key, val] of Object.entries(params)) {
          if (val) searchParams.set(key, val);
        }
      }
      const qs = searchParams.toString();
      const url = `${API_BASE}/api/v1/admin/qr/scan-logs/export${qs ? `?${qs}` : ''}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);

      const blob = await res.blob();
      const dateFrom = params?.date_from?.slice(0, 10) ?? 'all';
      const dateTo = params?.date_to?.slice(0, 10) ?? 'today';
      const filename = `scan_logs_${dateFrom}_to_${dateTo}.csv`;

      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    },
    [getToken],
  );

  // Simple flag — caller can track pending state via try/catch + useState
  return { exportCsv, isExporting: false };
}
