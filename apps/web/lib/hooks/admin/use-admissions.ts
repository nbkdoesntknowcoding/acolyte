'use client';

/**
 * Admin Admissions — Data-fetching hooks.
 *
 * Wired to /api/v1/admin/admissions/* analytics endpoints.
 * Student CRUD for admissions uses useStudents/useCreateStudent from use-students.ts.
 */

import { useAuth } from '@clerk/nextjs';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { createAdminFetcher } from '@/lib/api/admin-client-browser';
import type {
  PipelineResponse,
  CounselingRoundsResponse,
  QuotaAnalysisResponse,
} from '@/types/admin-api';

// ---------------------------------------------------------------------------
// Pipeline analytics
// ---------------------------------------------------------------------------

export function useAdmissionsPipeline(
  admissionYear?: number
): UseQueryResult<PipelineResponse> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const params = admissionYear ? `?admission_year=${admissionYear}` : '';
  return useQuery({
    queryKey: ['admin', 'admissions', 'pipeline', admissionYear],
    queryFn: () => fetcher<PipelineResponse>(`/admissions/pipeline${params}`),
  });
}

// ---------------------------------------------------------------------------
// Counseling rounds
// ---------------------------------------------------------------------------

export function useCounselingRounds(
  admissionYear?: number
): UseQueryResult<CounselingRoundsResponse> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const params = admissionYear ? `?admission_year=${admissionYear}` : '';
  return useQuery({
    queryKey: ['admin', 'admissions', 'counseling-rounds', admissionYear],
    queryFn: () =>
      fetcher<CounselingRoundsResponse>(`/admissions/counseling-rounds${params}`),
  });
}

// ---------------------------------------------------------------------------
// Quota analysis
// ---------------------------------------------------------------------------

export function useQuotaAnalysis(
  admissionYear?: number
): UseQueryResult<QuotaAnalysisResponse> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const params = admissionYear ? `?admission_year=${admissionYear}` : '';
  return useQuery({
    queryKey: ['admin', 'admissions', 'quota-analysis', admissionYear],
    queryFn: () =>
      fetcher<QuotaAnalysisResponse>(`/admissions/quota-analysis${params}`),
  });
}
