'use client';

/**
 * Admin Devices — Data-fetching hooks.
 *
 * Wired to /api/v1/admin/devices/* endpoints.
 * Uses custom hooks because the backend returns { data, meta } shape
 * (different from the generic PaginatedResponse used by useAdminList).
 */

import { useAuth } from '@clerk/nextjs';
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import { createAdminFetcher } from '@/lib/api/admin-client-browser';
import type { DeviceTrust, DeviceStats, FlaggedUser } from '@/types/admin';

// ---------------------------------------------------------------------------
// Response shapes from backend
// ---------------------------------------------------------------------------

interface DeviceListMeta {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

interface DeviceListResponse {
  data: DeviceTrust[];
  meta: DeviceListMeta;
}

interface FlaggedListResponse {
  data: FlaggedUser[];
  meta: { threshold: number; period_days: number };
}

// Normalized shape for the page to consume
export interface DeviceListResult {
  data: DeviceTrust[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ---------------------------------------------------------------------------
// List params
// ---------------------------------------------------------------------------

export interface DeviceListParams {
  page?: number;
  page_size?: number;
  status?: string;
  platform?: string;
  search?: string;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useDevices(
  params?: DeviceListParams,
  options?: { enabled?: boolean; refetchInterval?: number }
): UseQueryResult<DeviceListResult> {
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
  const path = qs ? `/devices/?${qs}` : '/devices/';

  return useQuery({
    queryKey: ['admin', 'devices', params ?? {}],
    queryFn: async () => {
      const res = await fetcher<DeviceListResponse>(path);
      return {
        data: res.data,
        total: res.meta.total,
        page: res.meta.page,
        page_size: res.meta.page_size,
        total_pages: res.meta.total_pages,
      };
    },
    ...options,
  });
}

export function useDeviceStats(
  options?: { enabled?: boolean; refetchInterval?: number }
): UseQueryResult<DeviceStats> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);

  return useQuery({
    queryKey: ['admin', 'devices', 'stats'],
    queryFn: () => fetcher<DeviceStats>('/devices/stats'),
    refetchInterval: 60_000,
    ...options,
  });
}

export function useFlaggedUsers(
  threshold?: number,
  periodDays?: number,
  options?: { enabled?: boolean }
): UseQueryResult<FlaggedUser[]> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);

  const searchParams = new URLSearchParams();
  if (threshold !== undefined) searchParams.set('threshold', String(threshold));
  if (periodDays !== undefined) searchParams.set('period_days', String(periodDays));
  const qs = searchParams.toString();
  const path = qs ? `/devices/flagged?${qs}` : '/devices/flagged';

  return useQuery({
    queryKey: ['admin', 'devices', 'flagged', { threshold, periodDays }],
    queryFn: async () => {
      const res = await fetcher<FlaggedListResponse>(path);
      return res.data;
    },
    ...options,
  });
}

export function useDeviceDetail(
  userId: string | undefined
): UseQueryResult<DeviceTrust> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);

  return useQuery({
    queryKey: ['admin', 'devices', userId],
    queryFn: () => fetcher<DeviceTrust>(`/devices/${userId}`),
    enabled: !!userId,
  });
}

export function useResetDevice(): UseMutationResult<
  { status: string; message: string },
  Error,
  { userId: string; reason: string; admin_notes?: string }
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, reason, admin_notes }) =>
      fetcher<{ status: string; message: string }>(`/devices/${userId}/reset`, {
        method: 'POST',
        body: JSON.stringify({ reason, admin_notes }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'devices'] });
    },
  });
}
