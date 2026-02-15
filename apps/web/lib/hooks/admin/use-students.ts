'use client';

/**
 * Admin Students — Data-fetching hooks.
 *
 * Wired to /api/v1/admin/students/* endpoints.
 * Uses the generic admin CRUD hooks + custom seat-matrix hook.
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
import { useAdminList, useAdminDetail, useAdminCreate, useAdminUpdate, useAdminDelete } from '@/lib/hooks/use-admin-query';
import type {
  StudentResponse,
  StudentCreate,
  StudentUpdate,
  PaginatedResponse,
  SeatMatrixResponse,
  PipelineSummary,
} from '@/types/admin-api';

// ---------------------------------------------------------------------------
// Student list params
// ---------------------------------------------------------------------------

export interface StudentListParams {
  page?: number;
  page_size?: number;
  search?: string;
  status?: string;
  current_phase?: string;
  admission_quota?: string;
  admission_year?: number;
  batch_id?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

// ---------------------------------------------------------------------------
// CRUD hooks
// ---------------------------------------------------------------------------

export function useStudents(
  params?: StudentListParams,
  options?: { enabled?: boolean; refetchInterval?: number }
): UseQueryResult<PaginatedResponse<StudentResponse>> {
  return useAdminList<StudentResponse>('students', params as Record<string, string | number | boolean | undefined>, options);
}

export function useStudent(id: string | undefined): UseQueryResult<StudentResponse> {
  return useAdminDetail<StudentResponse>('students', id);
}

export function useCreateStudent(): UseMutationResult<StudentResponse, Error, StudentCreate> {
  return useAdminCreate<StudentCreate, StudentResponse>('students');
}

export function useUpdateStudent(): UseMutationResult<StudentResponse, Error, { id: string; data: StudentUpdate }> {
  return useAdminUpdate<StudentUpdate, StudentResponse>('students');
}

export function useDeleteStudent(): UseMutationResult<void, Error, string> {
  return useAdminDelete('students');
}

// ---------------------------------------------------------------------------
// Seat matrix
// ---------------------------------------------------------------------------

export function useSeatMatrix(
  academicYear: string = '2025-26'
): UseQueryResult<SeatMatrixResponse> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  return useQuery({
    queryKey: ['admin', 'students', 'seat-matrix', academicYear],
    queryFn: () =>
      fetcher<SeatMatrixResponse>(`/students/seat-matrix?academic_year=${academicYear}`),
    refetchInterval: 120_000,
  });
}

// ---------------------------------------------------------------------------
// Pipeline summary (status counts for tab badges)
// ---------------------------------------------------------------------------

export function usePipelineSummary(
  academicYear: string = '2025-26'
): UseQueryResult<PipelineSummary> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  return useQuery({
    queryKey: ['admin', 'admissions', 'pipeline-summary', academicYear],
    queryFn: () =>
      fetcher<PipelineSummary>(`/admissions/pipeline-summary?academic_year=${academicYear}`),
  });
}

// ---------------------------------------------------------------------------
// Fee summary
// ---------------------------------------------------------------------------

export interface StudentFeeSummary {
  student_id: string;
  total_fee: number;    // paisa
  total_paid: number;   // paisa
  outstanding: number;  // paisa
  overpaid: number;     // paisa
}

export function useStudentFeeSummary(
  studentId: string | undefined
): UseQueryResult<StudentFeeSummary> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  return useQuery({
    queryKey: ['admin', 'students', studentId, 'fee-summary'],
    queryFn: () => fetcher<StudentFeeSummary>(`/students/${studentId}/fee-summary`),
    enabled: !!studentId,
  });
}

// ---------------------------------------------------------------------------
// NMC upload
// ---------------------------------------------------------------------------

export interface NMCUploadResponse {
  updated_count: number;
  student_ids: string[];
}

export function useNMCUpload(): UseMutationResult<NMCUploadResponse, Error, string[]> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (studentIds: string[]) =>
      fetcher<NMCUploadResponse>('/students/nmc-upload', {
        method: 'POST',
        body: JSON.stringify({ student_ids: studentIds }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'students'] });
    },
  });
}
