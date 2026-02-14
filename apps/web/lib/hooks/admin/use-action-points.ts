'use client';

/**
 * Admin QR Action Points — Data-fetching hooks.
 *
 * Wired to /api/v1/admin/qr/action-points/* endpoints.
 * Backend returns a plain array (not paginated wrapper) for the list endpoint.
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
import type { QRActionPoint, GeneratedQR } from '@/types/admin';

// ---------------------------------------------------------------------------
// Response shapes from backend (differ from types/admin.ts)
// ---------------------------------------------------------------------------

export interface ActionPointStatsResponse {
  action_point_id: string;
  action_point_name: string;
  period_days: number;
  total_scans: number;
  successful_scans: number;
  success_rate: number;
  daily_breakdown: { date: string; count: number }[];
}

export interface ActionPointCreateInput {
  name: string;
  description?: string | null;
  action_type: string;
  location_code: string;
  qr_mode: string;
  building?: string | null;
  floor?: number | null;
  gps_latitude?: number | null;
  gps_longitude?: number | null;
  geo_radius_meters?: number;
  qr_rotation_minutes?: number;
  duplicate_window_minutes?: number;
  linked_entity_type?: string | null;
  linked_entity_id?: string | null;
  security_level?: string;
  active_hours_start?: string | null;
  active_hours_end?: string | null;
  active_days?: number[] | null;
  metadata?: Record<string, unknown> | null;
}

export interface ActionPointUpdateInput {
  name?: string;
  description?: string | null;
  action_type?: string;
  location_code?: string;
  qr_mode?: string;
  building?: string | null;
  floor?: number | null;
  gps_latitude?: number | null;
  gps_longitude?: number | null;
  geo_radius_meters?: number | null;
  qr_rotation_minutes?: number | null;
  duplicate_window_minutes?: number | null;
  linked_entity_type?: string | null;
  linked_entity_id?: string | null;
  security_level?: string;
  active_hours_start?: string | null;
  active_hours_end?: string | null;
  active_days?: number[] | null;
  metadata?: Record<string, unknown> | null;
  is_active?: boolean;
}

// ---------------------------------------------------------------------------
// List params
// ---------------------------------------------------------------------------

export interface ActionPointListParams {
  action_type?: string;
  building?: string;
  is_active?: boolean;
  page?: number;
  page_size?: number;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** List action points. Backend returns a flat array. */
export function useActionPoints(
  params?: ActionPointListParams,
  options?: { enabled?: boolean; refetchInterval?: number }
): UseQueryResult<QRActionPoint[]> {
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
  const path = qs ? `/qr/action-points?${qs}` : '/qr/action-points';

  return useQuery({
    queryKey: ['admin', 'qr', 'action-points', params ?? {}],
    queryFn: () => fetcher<QRActionPoint[]>(path),
    ...options,
  });
}

/** Create a new action point. */
export function useCreateActionPoint(): UseMutationResult<
  QRActionPoint,
  Error,
  ActionPointCreateInput
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data) =>
      fetcher<QRActionPoint>('/qr/action-points', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'qr', 'action-points'] });
    },
  });
}

/** Update an existing action point. */
export function useUpdateActionPoint(): UseMutationResult<
  QRActionPoint,
  Error,
  { id: string; data: ActionPointUpdateInput }
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) =>
      fetcher<QRActionPoint>(`/qr/action-points/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'qr', 'action-points'] });
    },
  });
}

/** Soft-deactivate an action point (DELETE = set is_active=false). */
export function useDeactivateActionPoint(): UseMutationResult<
  { status: string; message: string },
  Error,
  string
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id) =>
      fetcher<{ status: string; message: string }>(`/qr/action-points/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'qr', 'action-points'] });
    },
  });
}

/** Generate a printable QR code image for a Mode B action point. */
export function useGenerateQR(
  id: string | undefined,
  options?: { enabled?: boolean }
): UseQueryResult<GeneratedQR & { action_type: string }> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);

  return useQuery({
    queryKey: ['admin', 'qr', 'action-points', id, 'generate'],
    queryFn: () => fetcher<GeneratedQR & { action_type: string }>(`/qr/action-points/${id}/generate`),
    enabled: !!id && (options?.enabled !== false),
  });
}

/** Fetch scan statistics for a specific action point. */
export function useActionPointStats(
  id: string | undefined,
  options?: { enabled?: boolean }
): UseQueryResult<ActionPointStatsResponse> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);

  return useQuery({
    queryKey: ['admin', 'qr', 'action-points', id, 'stats'],
    queryFn: () => fetcher<ActionPointStatsResponse>(`/qr/action-points/${id}/stats`),
    enabled: !!id && (options?.enabled !== false),
  });
}
