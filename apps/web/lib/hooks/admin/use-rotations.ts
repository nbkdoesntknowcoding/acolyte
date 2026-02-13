'use client';

/**
 * Admin Clinical Rotations — Data-fetching hooks.
 *
 * Wired to /api/v1/admin/rotations/* endpoints.
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
  ClinicalRotationResponse,
  RotationMatrixResponse,
  RotationGenerateRequest,
  RotationGenerateResponse,
  NMCValidationResponse,
  PaginatedResponse,
} from '@/types/admin-api';

// ---------------------------------------------------------------------------
// List params
// ---------------------------------------------------------------------------

export interface RotationListParams {
  page?: number;
  page_size?: number;
  student_id?: string;
  department_id?: string;
  batch_id?: string;
  phase?: string;
  status?: string;
  is_crmi?: boolean;
}

// ---------------------------------------------------------------------------
// List hook
// ---------------------------------------------------------------------------

export function useRotations(
  params?: RotationListParams,
  options?: { enabled?: boolean }
): UseQueryResult<PaginatedResponse<ClinicalRotationResponse>> {
  return useAdminList<ClinicalRotationResponse>(
    'rotations',
    params as Record<string, string | number | boolean | undefined>,
    options,
  );
}

// ---------------------------------------------------------------------------
// Matrix hook (Gantt chart data)
// ---------------------------------------------------------------------------

export interface RotationMatrixParams {
  batch_id?: string;
  phase?: string;
}

export function useRotationMatrix(
  params?: RotationMatrixParams,
  options?: { enabled?: boolean }
): UseQueryResult<RotationMatrixResponse> {
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
  const path = qs ? `/rotations/matrix?${qs}` : '/rotations/matrix';

  return useQuery({
    queryKey: ['admin', 'rotations', 'matrix', params ?? {}],
    queryFn: () => fetcher<RotationMatrixResponse>(path),
    ...options,
  });
}

// ---------------------------------------------------------------------------
// Generate mutation (AI schedule generation)
// ---------------------------------------------------------------------------

export function useGenerateRotations(): UseMutationResult<
  RotationGenerateResponse,
  Error,
  RotationGenerateRequest
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: RotationGenerateRequest) =>
      fetcher<RotationGenerateResponse>('/rotations/generate', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'rotations'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Validate NMC mutation
// ---------------------------------------------------------------------------

export function useValidateNMCRotations(): UseMutationResult<
  NMCValidationResponse,
  Error,
  { phase: string; batch_id?: string }
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);

  return useMutation({
    mutationFn: (data) =>
      fetcher<NMCValidationResponse>('/rotations/validate-nmc', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  });
}
