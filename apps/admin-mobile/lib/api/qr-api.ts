import type { AxiosInstance } from "axios";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QRScanLog {
  id: string;
  user_id: string;
  user_name?: string;
  user_type: string;
  action_type: string;
  action_point_id?: string;
  action_point_name?: string;
  qr_mode: string;
  validation_result: string;
  rejection_reason?: string;
  scan_latitude?: number;
  scan_longitude?: number;
  geo_validated?: boolean;
  device_validated?: boolean;
  device_model?: string;
  entity_id?: string;
  entity_type?: string;
  scanned_at: string;
}

export interface ScanSummaryItem {
  date: string;
  action_type: string;
  count: number;
}

export interface ScanSummary {
  period_days: number;
  data: ScanSummaryItem[];
}

export interface ScanAnomaly {
  validation_result: string;
  rejection_reason: string;
  count: number;
}

export interface QRActionPoint {
  id: string;
  name: string;
  action_type: string;
  location_code: string;
  qr_mode: string;
  building?: string;
  floor?: string;
  is_active: boolean;
}

export interface ActionPointStats {
  action_point_id: string;
  action_point_name: string;
  period_days: number;
  total_scans: number;
  successful_scans: number;
  success_rate: number;
  daily_breakdown: { date: string; count: number }[];
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export const qrApi = {
  getScanLogs: (
    api: AxiosInstance,
    params?: {
      user_id?: string;
      action_type?: string;
      validation_result?: string;
      date_from?: string;
      date_to?: string;
      page?: number;
      page_size?: number;
    },
  ) => api.get<QRScanLog[]>("/admin/qr/scan-logs", { params }).then((r) => r.data),

  getSummary: (api: AxiosInstance, days = 30) =>
    api
      .get<ScanSummary>("/admin/qr/scan-logs/summary", { params: { days } })
      .then((r) => r.data),

  getAnomalies: (api: AxiosInstance, days = 30) =>
    api
      .get<{ period_days: number; anomalies: ScanAnomaly[] }>(
        "/admin/qr/scan-logs/anomalies",
        { params: { days } },
      )
      .then((r) => r.data),

  getActionPoints: (api: AxiosInstance, params?: { is_active?: boolean }) =>
    api
      .get<QRActionPoint[]>("/admin/qr/action-points", { params })
      .then((r) => r.data),

  getActionPointStats: (api: AxiosInstance, id: string, days = 30) =>
    api
      .get<ActionPointStats>(`/admin/qr/action-points/${id}/stats`, {
        params: { days },
      })
      .then((r) => r.data),

  getHourlyVolume: (api: AxiosInstance) =>
    api
      .get<{ data: { hour: number; count: number }[] }>(
        "/admin/qr/scan-logs/hourly",
      )
      .then((r) => r.data),
};
