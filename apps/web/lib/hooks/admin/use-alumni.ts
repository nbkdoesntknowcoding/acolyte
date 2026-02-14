'use client';

/**
 * Admin Alumni — Data-fetching hooks.
 *
 * Wired to /api/v1/admin/alumni/* endpoints.
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
  AlumniResponse,
  AlumniCreate,
  AlumniUpdate,
  PaginatedResponse,
} from '@/types/admin-api';

// ---------------------------------------------------------------------------
// Alumni List
// ---------------------------------------------------------------------------

export interface AlumniListParams {
  page?: number;
  page_size?: number;
  search?: string;
  graduation_year?: number;
  employment_type?: string;
  pg_specialization?: string;
  is_active_member?: boolean;
}

export function useAlumni(
  params?: AlumniListParams,
  options?: { enabled?: boolean },
): UseQueryResult<PaginatedResponse<AlumniResponse>> {
  return useAdminList<AlumniResponse>(
    'alumni',
    params as Record<string, string | number | boolean | undefined>,
    options,
  );
}

// ---------------------------------------------------------------------------
// Create Alumni Mutation
// ---------------------------------------------------------------------------

export function useCreateAlumni(): UseMutationResult<
  AlumniResponse,
  Error,
  AlumniCreate
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: AlumniCreate) =>
      fetcher<AlumniResponse>('/alumni', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'alumni'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Update Alumni Mutation
// ---------------------------------------------------------------------------

export function useUpdateAlumni(): UseMutationResult<
  AlumniResponse,
  Error,
  { id: string; data: AlumniUpdate }
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AlumniUpdate }) =>
      fetcher<AlumniResponse>(`/alumni/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'alumni'] });
    },
  });
}
