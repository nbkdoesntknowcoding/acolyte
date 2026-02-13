'use client';

/**
 * Admin Grievances — Data-fetching hooks.
 *
 * Wired to /api/v1/admin/grievances/* endpoints.
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
  CommitteeResponse,
  GrievanceResponse,
  GrievanceCreate,
  GrievanceUpdate,
  PaginatedResponse,
} from '@/types/admin-api';

// ---------------------------------------------------------------------------
// Committees
// ---------------------------------------------------------------------------

export interface CommitteeListParams {
  page?: number;
  page_size?: number;
}

export function useCommittees(
  params?: CommitteeListParams,
  options?: { enabled?: boolean },
): UseQueryResult<PaginatedResponse<CommitteeResponse>> {
  return useAdminList<CommitteeResponse>(
    'grievances/committees',
    params as Record<string, string | number | boolean | undefined>,
    options,
  );
}

// ---------------------------------------------------------------------------
// Grievances
// ---------------------------------------------------------------------------

export interface GrievanceListParams {
  page?: number;
  page_size?: number;
  status?: string;
  category?: string;
  priority?: string;
  is_anonymous?: boolean;
}

export function useGrievances(
  params?: GrievanceListParams,
  options?: { enabled?: boolean },
): UseQueryResult<PaginatedResponse<GrievanceResponse>> {
  return useAdminList<GrievanceResponse>(
    'grievances',
    params as Record<string, string | number | boolean | undefined>,
    options,
  );
}

// ---------------------------------------------------------------------------
// Create Grievance Mutation
// ---------------------------------------------------------------------------

export function useCreateGrievance(): UseMutationResult<
  GrievanceResponse,
  Error,
  GrievanceCreate
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: GrievanceCreate) =>
      fetcher<GrievanceResponse>('/grievances', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'grievances'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Update Grievance Mutation
// ---------------------------------------------------------------------------

export function useUpdateGrievance(): UseMutationResult<
  GrievanceResponse,
  Error,
  { id: string; data: GrievanceUpdate }
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: GrievanceUpdate }) =>
      fetcher<GrievanceResponse>(`/grievances/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'grievances'] });
    },
  });
}
