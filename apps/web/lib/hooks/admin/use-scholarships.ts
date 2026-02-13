'use client';

/**
 * Admin Scholarships — Data-fetching hooks.
 *
 * Wired to /api/v1/admin/scholarships/* endpoints.
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
  ScholarshipSchemeResponse,
  StudentScholarshipResponse,
  StudentScholarshipUpdate,
  AutoMatchResponse,
  MatchedSchemeItem,
  DisbursementSummaryResponse,
  PaginatedResponse,
} from '@/types/admin-api';

// ---------------------------------------------------------------------------
// Scholarship schemes (global)
// ---------------------------------------------------------------------------

export interface SchemeListParams {
  page?: number;
  page_size?: number;
}

export function useScholarshipSchemes(
  params?: SchemeListParams
): UseQueryResult<PaginatedResponse<ScholarshipSchemeResponse>> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);

  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  const qs = searchParams.toString();
  const path = qs ? `/scholarships/schemes?${qs}` : '/scholarships/schemes';

  return useQuery({
    queryKey: ['admin', 'scholarships', 'schemes', params ?? {}],
    queryFn: () => fetcher<PaginatedResponse<ScholarshipSchemeResponse>>(path),
  });
}

// ---------------------------------------------------------------------------
// Student scholarships (tenant-scoped)
// ---------------------------------------------------------------------------

export interface StudentScholarshipListParams {
  page?: number;
  page_size?: number;
  student_id?: string;
  scheme_id?: string;
  application_status?: string;
}

export function useStudentScholarships(
  params?: StudentScholarshipListParams,
  options?: { enabled?: boolean }
): UseQueryResult<PaginatedResponse<StudentScholarshipResponse>> {
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
  const path = qs ? `/scholarships/?${qs}` : '/scholarships/';

  return useQuery({
    queryKey: ['admin', 'scholarships', 'student-scholarships', params ?? {}],
    queryFn: () => fetcher<PaginatedResponse<StudentScholarshipResponse>>(path),
    ...options,
  });
}

// ---------------------------------------------------------------------------
// Disbursement summary
// ---------------------------------------------------------------------------

export function useDisbursementSummary(): UseQueryResult<DisbursementSummaryResponse> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  return useQuery({
    queryKey: ['admin', 'scholarships', 'disbursement-summary'],
    queryFn: () =>
      fetcher<DisbursementSummaryResponse>('/scholarships/disbursement-summary'),
  });
}

// ---------------------------------------------------------------------------
// Auto-match mutation
// ---------------------------------------------------------------------------

export function useAutoMatch(): UseMutationResult<AutoMatchResponse, Error, void> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () =>
      fetcher<AutoMatchResponse>('/scholarships/auto-match', {
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'scholarships'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Matched schemes for a student
// ---------------------------------------------------------------------------

export function useMatchedSchemes(
  studentId: string | undefined
): UseQueryResult<MatchedSchemeItem[]> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  return useQuery({
    queryKey: ['admin', 'scholarships', 'matched', studentId],
    queryFn: () =>
      fetcher<MatchedSchemeItem[]>(`/scholarships/matched/${studentId}`),
    enabled: !!studentId,
  });
}

// ---------------------------------------------------------------------------
// Update student scholarship status
// ---------------------------------------------------------------------------

export function useUpdateScholarshipStatus(): UseMutationResult<
  StudentScholarshipResponse,
  Error,
  { id: string; data: StudentScholarshipUpdate }
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: StudentScholarshipUpdate }) =>
      fetcher<StudentScholarshipResponse>(
        `/scholarships/${id}/update-status`,
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'scholarships'] });
    },
  });
}
