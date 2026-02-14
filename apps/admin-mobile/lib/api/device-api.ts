import type { AxiosInstance } from "axios";
import type { DeviceInfoPayload } from "../device-trust/fingerprint";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeviceTrust {
  id: string;
  user_id: string;
  user_name?: string;
  user_type?: string;
  phone?: string;
  device_id: string;
  device_model: string;
  platform: string;
  os_version: string;
  app_version: string;
  status: string;
  total_qr_scans: number;
  last_active_at: string;
  registered_at: string;
  revoked_at?: string;
  revoke_reason?: string;
  reset_count?: number;
  last_reset_at?: string;
}

export interface DeviceStats {
  total_registered: number;
  active_count: number;
  revoked_count: number;
  registered_this_week?: number;
  platforms: Record<string, number>;
}

export interface RegisterDeviceResponse {
  verification_id: string;
  sms_target_number: string;
  sms_body_template: string;
  verification_code: string;
  expires_in_seconds: number;
  dev_mode: boolean;
}

export interface DeviceStatusResponse {
  status: "pending" | "active" | "failed" | string;
  device_trust_token?: string;
  token_expires_at?: string;
  message?: string;
}

// ---------------------------------------------------------------------------
// User-facing device registration API
// ---------------------------------------------------------------------------

export const deviceRegistrationApi = {
  register: (api: AxiosInstance, phoneNumber: string, deviceInfo: DeviceInfoPayload) =>
    api
      .post<RegisterDeviceResponse>("/device/register", {
        phone_number: phoneNumber,
        device_info: deviceInfo,
      })
      .then((r) => r.data),

  checkStatus: (api: AxiosInstance, verificationId: string) =>
    api
      .get<DeviceStatusResponse>("/device/status", {
        params: { verification_id: verificationId },
      })
      .then((r) => r.data),

  revoke: (api: AxiosInstance) =>
    api.delete("/device/revoke").then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Admin device management API
// ---------------------------------------------------------------------------

export const deviceApi = {
  getStats: (api: AxiosInstance) =>
    api.get<DeviceStats>("/admin/devices/stats").then((r) => r.data),

  list: (
    api: AxiosInstance,
    params?: { status?: string; search?: string; page?: number; page_size?: number },
  ) => api.get<DeviceTrust[]>("/admin/devices", { params }).then((r) => r.data),

  getByUser: (api: AxiosInstance, userId: string) =>
    api.get<DeviceTrust>(`/admin/devices/user/${userId}`).then((r) => r.data),

  revoke: (api: AxiosInstance, deviceId: string, reason: string) =>
    api.post(`/admin/devices/${deviceId}/revoke`, { reason }).then((r) => r.data),

  resetForUser: (api: AxiosInstance, userId: string, reason: string) =>
    api.post(`/admin/devices/user/${userId}/reset`, { reason }).then((r) => r.data),

  getFlagged: (api: AxiosInstance) =>
    api.get<{ data: DeviceTrust[]; count: number }>("/admin/devices/flagged").then((r) => r.data),
};
