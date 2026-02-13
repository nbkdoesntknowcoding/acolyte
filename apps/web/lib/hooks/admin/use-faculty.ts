'use client';

/**
 * Admin Faculty — Data-fetching hooks.
 *
 * Wired to /api/v1/admin/faculty/* endpoints.
 * Uses the generic admin CRUD hooks + custom MSR/retirement hooks.
 */

import { useAuth } from '@clerk/nextjs';
import {
  useQuery,
  useMutation,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import { createAdminFetcher } from '@/lib/api/admin-client-browser';
import { useAdminList, useAdminDetail, useAdminCreate, useAdminUpdate, useAdminDelete } from '@/lib/hooks/use-admin-query';
import type {
  FacultyResponse,
  FacultyCreate,
  FacultyUpdate,
  FacultyPortfolioResponse,
  NMCValidationResponse,
  PaginatedResponse,
  MSRComplianceResponse,
  RetirementForecastResponse,
} from '@/types/admin-api';

// ---------------------------------------------------------------------------
// Faculty list params
// ---------------------------------------------------------------------------

export interface FacultyListParams {
  page?: number;
  page_size?: number;
  search?: string;
  department_id?: string;
  designation?: string;
  employment_type?: string;
  status?: string;
}

// ---------------------------------------------------------------------------
// CRUD hooks
// ---------------------------------------------------------------------------

export function useFaculty(
  params?: FacultyListParams,
  options?: { enabled?: boolean; refetchInterval?: number }
): UseQueryResult<PaginatedResponse<FacultyResponse>> {
  return useAdminList<FacultyResponse>('faculty', params as Record<string, string | number | boolean | undefined>, options);
}

export function useFacultyDetail(id: string | undefined): UseQueryResult<FacultyResponse> {
  return useAdminDetail<FacultyResponse>('faculty', id);
}

export function useCreateFaculty(): UseMutationResult<FacultyResponse, Error, FacultyCreate> {
  return useAdminCreate<FacultyCreate, FacultyResponse>('faculty');
}

export function useUpdateFaculty(): UseMutationResult<FacultyResponse, Error, { id: string; data: FacultyUpdate }> {
  return useAdminUpdate<FacultyUpdate, FacultyResponse>('faculty');
}

export function useDeleteFaculty(): UseMutationResult<void, Error, string> {
  return useAdminDelete('faculty');
}

// ---------------------------------------------------------------------------
// Portfolio (qualifications, publications, teaching load)
// ---------------------------------------------------------------------------

export function useFacultyPortfolio(
  facultyId: string | undefined
): UseQueryResult<FacultyPortfolioResponse> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  return useQuery({
    queryKey: ['admin', 'faculty', facultyId, 'portfolio'],
    queryFn: () => fetcher<FacultyPortfolioResponse>(`/faculty/${facultyId}/portfolio`),
    enabled: !!facultyId,
  });
}

// ---------------------------------------------------------------------------
// NMC Validation
// ---------------------------------------------------------------------------

export function useValidateNMC(): UseMutationResult<
  NMCValidationResponse,
  Error,
  string
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  return useMutation({
    mutationFn: (facultyId: string) =>
      fetcher<NMCValidationResponse>(`/faculty/${facultyId}/validate-nmc`, {
        method: 'POST',
      }),
  });
}

// ---------------------------------------------------------------------------
// MSR compliance
// ---------------------------------------------------------------------------

export function useMSRCompliance(): UseQueryResult<MSRComplianceResponse> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  return useQuery({
    queryKey: ['admin', 'faculty', 'msr-compliance'],
    queryFn: () => fetcher<MSRComplianceResponse>('/faculty/msr-compliance'),
    refetchInterval: 120_000,
  });
}

// ---------------------------------------------------------------------------
// Retirement forecast
// ---------------------------------------------------------------------------

export function useRetirementForecast(
  years: number = 3
): UseQueryResult<RetirementForecastResponse> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  return useQuery({
    queryKey: ['admin', 'faculty', 'retirement-forecast', years],
    queryFn: () =>
      fetcher<RetirementForecastResponse>(`/faculty/retirement-forecast?years=${years}`),
  });
}
