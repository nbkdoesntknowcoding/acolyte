'use client';

/**
 * Admin Transport — Data-fetching hooks.
 *
 * Wired to /api/v1/admin/transport/* endpoints.
 */

import { useAuth } from '@clerk/nextjs';
import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { createAdminFetcher } from '@/lib/api/admin-client-browser';
import { useAdminList } from '@/lib/hooks/use-admin-query';
import type {
  VehicleResponse,
  VehicleCreate,
  TransportRouteResponse,
  TransportRouteCreate,
  TransportBookingResponse,
  TransportBookingCreate,
  VehicleMaintenanceLogResponse,
  VehicleMaintenanceLogCreate,
  PaginatedResponse,
} from '@/types/admin-api';

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

export interface VehicleListParams {
  page?: number;
  page_size?: number;
  vehicle_type?: string;
  status?: string;
}

export function useVehicles(
  params?: VehicleListParams,
  options?: { enabled?: boolean },
): UseQueryResult<PaginatedResponse<VehicleResponse>> {
  return useAdminList<VehicleResponse>(
    'transport/vehicles',
    params as Record<string, string | number | boolean | undefined>,
    options,
  );
}

export function useCreateVehicle(): UseMutationResult<
  VehicleResponse,
  Error,
  VehicleCreate
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: VehicleCreate) =>
      fetcher<VehicleResponse>('/transport/vehicles', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'transport/vehicles'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export interface TransportRouteListParams {
  page?: number;
  page_size?: number;
  route_type?: string;
  is_active?: boolean;
}

export function useTransportRoutes(
  params?: TransportRouteListParams,
  options?: { enabled?: boolean },
): UseQueryResult<PaginatedResponse<TransportRouteResponse>> {
  return useAdminList<TransportRouteResponse>(
    'transport/routes',
    params as Record<string, string | number | boolean | undefined>,
    options,
  );
}

export function useCreateTransportRoute(): UseMutationResult<
  TransportRouteResponse,
  Error,
  TransportRouteCreate
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: TransportRouteCreate) =>
      fetcher<TransportRouteResponse>('/transport/routes', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'transport/routes'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

export interface TransportBookingListParams {
  page?: number;
  page_size?: number;
  route_id?: string;
  department_id?: string;
  status?: string;
  booking_date?: string;
}

export function useTransportBookings(
  params?: TransportBookingListParams,
  options?: { enabled?: boolean },
): UseQueryResult<PaginatedResponse<TransportBookingResponse>> {
  return useAdminList<TransportBookingResponse>(
    'transport/bookings',
    params as Record<string, string | number | boolean | undefined>,
    options,
  );
}

export function useCreateTransportBooking(): UseMutationResult<
  TransportBookingResponse,
  Error,
  TransportBookingCreate
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: TransportBookingCreate) =>
      fetcher<TransportBookingResponse>('/transport/bookings', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'transport/bookings'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Maintenance Logs
// ---------------------------------------------------------------------------

export interface VehicleMaintenanceLogListParams {
  page?: number;
  page_size?: number;
  vehicle_id?: string;
}

export function useVehicleMaintenanceLogs(
  params?: VehicleMaintenanceLogListParams,
  options?: { enabled?: boolean },
): UseQueryResult<PaginatedResponse<VehicleMaintenanceLogResponse>> {
  return useAdminList<VehicleMaintenanceLogResponse>(
    'transport/maintenance',
    params as Record<string, string | number | boolean | undefined>,
    options,
  );
}

export function useCreateVehicleMaintenanceLog(): UseMutationResult<
  VehicleMaintenanceLogResponse,
  Error,
  VehicleMaintenanceLogCreate
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: VehicleMaintenanceLogCreate) =>
      fetcher<VehicleMaintenanceLogResponse>('/transport/maintenance', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'transport/maintenance'] });
    },
  });
}
