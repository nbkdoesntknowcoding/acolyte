'use client';

/**
 * Admin Payroll — Data-fetching hooks.
 *
 * Wired to /api/v1/admin/payroll/* endpoints.
 * All monetary values from backend are in paisa (1 rupee = 100 paisa).
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
  PayrollRecordResponse,
  SalaryStructureResponse,
  StatutorySummaryResponse,
  PayrollCalculateResponse,
  PayrollApproveResponse,
  BankFileResponse,
  PaginatedResponse,
} from '@/types/admin-api';

// ---------------------------------------------------------------------------
// Payroll records list
// ---------------------------------------------------------------------------

export interface PayrollListParams {
  page?: number;
  page_size?: number;
  faculty_id?: string;
  month?: number;
  year?: number;
  status?: string;
}

export function usePayrollRecords(
  params?: PayrollListParams,
  options?: { enabled?: boolean }
): UseQueryResult<PaginatedResponse<PayrollRecordResponse>> {
  return useAdminList<PayrollRecordResponse>(
    'payroll',
    params as Record<string, string | number | boolean | undefined>,
    options
  );
}

// ---------------------------------------------------------------------------
// Salary structures
// ---------------------------------------------------------------------------

export interface SalaryStructureListParams {
  page?: number;
  page_size?: number;
}

export function useSalaryStructures(
  params?: SalaryStructureListParams
): UseQueryResult<PaginatedResponse<SalaryStructureResponse>> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);

  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  const qs = searchParams.toString();
  const path = qs ? `/payroll/salary-structures?${qs}` : '/payroll/salary-structures';

  return useQuery({
    queryKey: ['admin', 'payroll', 'salary-structures', params ?? {}],
    queryFn: () => fetcher<PaginatedResponse<SalaryStructureResponse>>(path),
  });
}

// ---------------------------------------------------------------------------
// Statutory summary
// ---------------------------------------------------------------------------

export function useStatutorySummary(
  month: number,
  year: number,
  options?: { enabled?: boolean }
): UseQueryResult<StatutorySummaryResponse> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);

  return useQuery({
    queryKey: ['admin', 'payroll', 'statutory-summary', month, year],
    queryFn: () =>
      fetcher<StatutorySummaryResponse>(
        `/payroll/statutory-summary?month=${month}&year=${year}`
      ),
    ...options,
  });
}

// ---------------------------------------------------------------------------
// Calculate payroll mutation
// ---------------------------------------------------------------------------

export function useCalculatePayroll(): UseMutationResult<
  PayrollCalculateResponse,
  Error,
  { month: number; year: number }
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ month, year }: { month: number; year: number }) =>
      fetcher<PayrollCalculateResponse>(
        `/payroll/calculate?month=${month}&year=${year}`,
        { method: 'POST' }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'payroll'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Approve payroll mutation
// ---------------------------------------------------------------------------

export function useApprovePayroll(): UseMutationResult<
  PayrollApproveResponse,
  Error,
  { month: number; year: number }
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ month, year }: { month: number; year: number }) =>
      fetcher<PayrollApproveResponse>(
        `/payroll/approve?month=${month}&year=${year}`,
        { method: 'POST' }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'payroll'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Generate bank file mutation
// ---------------------------------------------------------------------------

export function useGenerateBankFile(): UseMutationResult<
  BankFileResponse,
  Error,
  { month: number; year: number }
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ month, year }: { month: number; year: number }) =>
      fetcher<BankFileResponse>(
        `/payroll/generate-bank-file?month=${month}&year=${year}`,
        { method: 'POST' }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'payroll'] });
    },
  });
}
