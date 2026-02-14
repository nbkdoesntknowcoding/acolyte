'use client';

/**
 * Admin Fee Structures — Data-fetching hooks.
 *
 * Wired to /api/v1/admin/fees/structures/* endpoints.
 * Uses custom hooks because the fee routes sit under /fees/ prefix
 * and the backend uses PATCH (not PUT) for updates.
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
import type {
  FeeStructureResponse,
  FeeStructureCreate,
  FeeStructureUpdate,
  PaginatedResponse,
} from '@/types/admin-api';

// ---------------------------------------------------------------------------
// List params
// ---------------------------------------------------------------------------

export interface FeeStructureListParams {
  page?: number;
  page_size?: number;
  academic_year?: string;
  quota?: string;
  is_active?: boolean;
}

// ---------------------------------------------------------------------------
// List hook
// ---------------------------------------------------------------------------

export function useFeeStructures(
  params?: FeeStructureListParams,
  options?: { enabled?: boolean }
): UseQueryResult<PaginatedResponse<FeeStructureResponse>> {
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
  const path = qs ? `/fees/structures?${qs}` : '/fees/structures';

  return useQuery({
    queryKey: ['admin', 'fees', 'structures', params ?? {}],
    queryFn: () => fetcher<PaginatedResponse<FeeStructureResponse>>(path),
    ...options,
  });
}

// ---------------------------------------------------------------------------
// Create mutation
// ---------------------------------------------------------------------------

export function useCreateFeeStructure(): UseMutationResult<
  FeeStructureResponse,
  Error,
  FeeStructureCreate
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: FeeStructureCreate) =>
      fetcher<FeeStructureResponse>('/fees/structures', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'fees', 'structures'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Update mutation (PATCH)
// ---------------------------------------------------------------------------

export function useUpdateFeeStructure(): UseMutationResult<
  FeeStructureResponse,
  Error,
  { id: string; data: FeeStructureUpdate }
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: FeeStructureUpdate }) =>
      fetcher<FeeStructureResponse>(`/fees/structures/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'fees', 'structures'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Regulatory check
// ---------------------------------------------------------------------------

export interface RegulatoryCheckResult {
  compliant: boolean;
  total_fee: number;
  regulatory_cap: number | null;
  excess_amount: number;
}

export function useFeeRegulatoryCheck(
  structureId: string | undefined,
  options?: { enabled?: boolean }
): UseQueryResult<RegulatoryCheckResult> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);

  return useQuery({
    queryKey: ['admin', 'fees', 'structures', structureId, 'regulatory-check'],
    queryFn: () =>
      fetcher<RegulatoryCheckResult>(
        `/fees/structures/${structureId}/regulatory-check`
      ),
    enabled: !!structureId && (options?.enabled !== false),
  });
}

// ---------------------------------------------------------------------------
// Installment schedule
// ---------------------------------------------------------------------------

export interface InstallmentScheduleItem {
  installment_no: number;
  due_date: string;
  percentage: number;
  amount: number;
  late_fee_per_day: number;
  grace_period_days: number;
}

export function useFeeInstallments(
  structureId: string | undefined,
  options?: { enabled?: boolean }
): UseQueryResult<InstallmentScheduleItem[]> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);

  return useQuery({
    queryKey: ['admin', 'fees', 'structures', structureId, 'installments'],
    queryFn: () =>
      fetcher<InstallmentScheduleItem[]>(
        `/fees/structures/${structureId}/installments`
      ),
    enabled: !!structureId && (options?.enabled !== false),
  });
}
