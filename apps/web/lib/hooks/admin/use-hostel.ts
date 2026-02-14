'use client';

/**
 * Admin Hostel — Data-fetching hooks.
 *
 * Wired to /api/v1/admin/hostel/* endpoints.
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
import { useAdminList } from '@/lib/hooks/use-admin-query';
import type {
  HostelBlockResponse,
  HostelRoomResponse,
  HostelAllocationResponse,
  OccupancySummaryItem,
  AllocateRequest,
  NMCHostelComplianceResponse,
  PaginatedResponse,
} from '@/types/admin-api';

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

export interface HostelBlockListParams {
  page?: number;
  page_size?: number;
  is_active?: boolean;
}

export function useHostelBlocks(
  params?: HostelBlockListParams,
  options?: { enabled?: boolean },
): UseQueryResult<PaginatedResponse<HostelBlockResponse>> {
  return useAdminList<HostelBlockResponse>(
    'hostel/blocks',
    params as Record<string, string | number | boolean | undefined>,
    options,
  );
}

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

export interface HostelRoomListParams {
  page?: number;
  page_size?: number;
  block_id?: string;
  status?: string;
}

export function useHostelRooms(
  params?: HostelRoomListParams,
  options?: { enabled?: boolean },
): UseQueryResult<PaginatedResponse<HostelRoomResponse>> {
  return useAdminList<HostelRoomResponse>(
    'hostel/rooms',
    params as Record<string, string | number | boolean | undefined>,
    options,
  );
}

// ---------------------------------------------------------------------------
// Allocations
// ---------------------------------------------------------------------------

export interface HostelAllocationListParams {
  page?: number;
  page_size?: number;
  student_id?: string;
  block_id?: string;
  academic_year?: string;
  status?: string;
}

export function useHostelAllocations(
  params?: HostelAllocationListParams,
  options?: { enabled?: boolean },
): UseQueryResult<PaginatedResponse<HostelAllocationResponse>> {
  return useAdminList<HostelAllocationResponse>(
    'hostel/allocations',
    params as Record<string, string | number | boolean | undefined>,
    options,
  );
}

// ---------------------------------------------------------------------------
// Occupancy summary
// ---------------------------------------------------------------------------

export function useHostelOccupancy(): UseQueryResult<OccupancySummaryItem[]> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);

  return useQuery({
    queryKey: ['admin', 'hostel', 'occupancy'],
    queryFn: () => fetcher<OccupancySummaryItem[]>('/hostel/occupancy'),
  });
}

// ---------------------------------------------------------------------------
// NMC Compliance
// ---------------------------------------------------------------------------

export function useHostelNMCCompliance(): UseQueryResult<NMCHostelComplianceResponse> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);

  return useQuery({
    queryKey: ['admin', 'hostel', 'nmc-compliance'],
    queryFn: () =>
      fetcher<NMCHostelComplianceResponse>('/hostel/nmc-compliance'),
  });
}

// ---------------------------------------------------------------------------
// Allocate student mutation
// ---------------------------------------------------------------------------

export function useAllocateStudent(): UseMutationResult<
  HostelAllocationResponse,
  Error,
  AllocateRequest
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: AllocateRequest) =>
      fetcher<HostelAllocationResponse>('/hostel/allocate', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'hostel'] });
    },
  });
}
