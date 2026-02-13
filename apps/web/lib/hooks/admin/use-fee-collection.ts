'use client';

/**
 * Admin Fee Collection — Data-fetching hooks.
 *
 * Wired to /api/v1/admin/fees/* and /api/v1/admin/dashboard/fee-trend endpoints.
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
  CollectionSummaryResponse,
  FeeTrendPoint,
  FeePaymentResponse,
  FeePaymentCreate,
  PaginatedResponse,
} from '@/types/admin-api';

// ---------------------------------------------------------------------------
// Collection summary
// ---------------------------------------------------------------------------

export function useCollectionSummary(
  academicYear: string
): UseQueryResult<CollectionSummaryResponse> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  return useQuery({
    queryKey: ['admin', 'fees', 'collection-summary', academicYear],
    queryFn: () =>
      fetcher<CollectionSummaryResponse>(
        `/fees/collection-summary?academic_year=${academicYear}`
      ),
  });
}

// ---------------------------------------------------------------------------
// Fee collection trend (monthly chart)
// ---------------------------------------------------------------------------

export function useFeeTrend(
  academicYear?: string
): UseQueryResult<FeeTrendPoint[]> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qs = academicYear ? `?academic_year=${academicYear}` : '';
  return useQuery({
    queryKey: ['admin', 'dashboard', 'fee-trend', academicYear],
    queryFn: () => fetcher<FeeTrendPoint[]>(`/dashboard/fee-trend${qs}`),
  });
}

// ---------------------------------------------------------------------------
// Fee payments list
// ---------------------------------------------------------------------------

export interface FeePaymentListParams {
  page?: number;
  page_size?: number;
  student_id?: string;
  academic_year?: string;
  status?: string;
}

export function useFeePayments(
  params?: FeePaymentListParams,
  options?: { enabled?: boolean }
): UseQueryResult<PaginatedResponse<FeePaymentResponse>> {
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
  const path = qs ? `/fees/payments?${qs}` : '/fees/payments';

  return useQuery({
    queryKey: ['admin', 'fees', 'payments', params ?? {}],
    queryFn: () => fetcher<PaginatedResponse<FeePaymentResponse>>(path),
    ...options,
  });
}

// ---------------------------------------------------------------------------
// Defaulters list
// ---------------------------------------------------------------------------

export interface DefaulterEntry {
  student_id: string;
  student_name: string;
  enrollment_number: string;
  quota: string;
  overdue_amount: number;
  late_fee: number;
  days_overdue: number;
}

export function useFeeDefaulters(
  academicYear: string,
  params?: { page?: number; page_size?: number },
  options?: { enabled?: boolean }
): UseQueryResult<PaginatedResponse<DefaulterEntry>> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);

  const searchParams = new URLSearchParams();
  searchParams.set('academic_year', academicYear);
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  const qs = searchParams.toString();

  return useQuery({
    queryKey: ['admin', 'fees', 'defaulters', academicYear, params ?? {}],
    queryFn: () =>
      fetcher<PaginatedResponse<DefaulterEntry>>(`/fees/defaulters?${qs}`),
    ...options,
  });
}

// ---------------------------------------------------------------------------
// Record payment mutation
// ---------------------------------------------------------------------------

export function useRecordPayment(): UseMutationResult<
  FeePaymentResponse,
  Error,
  FeePaymentCreate
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: FeePaymentCreate) =>
      fetcher<FeePaymentResponse>('/fees/record-payment', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'fees'] });
    },
  });
}
