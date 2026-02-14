'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { createAdminFetcher } from '@/lib/api/admin-client-browser';
import type {
  RecruitmentPositionResponse,
  RecruitmentPositionCreate,
  RecruitmentPositionUpdate,
  RecruitmentCandidateResponse,
  RecruitmentCandidateCreate,
  RecruitmentCandidateUpdate,
  PaginatedResponse,
} from '@/types/admin-api';

// ---------------------------------------------------------------------------
// Recruitment Positions
// ---------------------------------------------------------------------------

interface PositionParams {
  page?: number;
  page_size?: number;
  search?: string;
  department_id?: string;
  designation?: string;
  status?: string;
  priority?: string;
}

export function useRecruitmentPositions(
  params?: PositionParams,
  options?: { enabled?: boolean }
) {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);

  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.set('page', params.page.toString());
  if (params?.page_size) queryParams.set('page_size', params.page_size.toString());
  if (params?.search) queryParams.set('search', params.search);
  if (params?.department_id) queryParams.set('department_id', params.department_id);
  if (params?.designation) queryParams.set('designation', params.designation);
  if (params?.status) queryParams.set('status', params.status);
  if (params?.priority) queryParams.set('priority', params.priority);

  const queryString = queryParams.toString();
  const endpoint = queryString ? `/recruitment/positions?${queryString}` : '/recruitment/positions';

  return useQuery({
    queryKey: ['admin', 'recruitment', 'positions', params],
    queryFn: () => fetcher<PaginatedResponse<RecruitmentPositionResponse>>(endpoint),
    ...options,
  });
}

export function useRecruitmentPosition(positionId: string, options?: { enabled?: boolean }) {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);

  return useQuery({
    queryKey: ['admin', 'recruitment', 'positions', positionId],
    queryFn: () => fetcher<RecruitmentPositionResponse>(`/recruitment/positions/${positionId}`),
    ...options,
  });
}

export function useCreateRecruitmentPosition() {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RecruitmentPositionCreate) =>
      fetcher<RecruitmentPositionResponse>('/recruitment/positions', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'recruitment', 'positions'] });
    },
  });
}

export function useUpdateRecruitmentPosition(positionId: string) {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RecruitmentPositionUpdate) =>
      fetcher<RecruitmentPositionResponse>(`/recruitment/positions/${positionId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'recruitment', 'positions'] });
    },
  });
}

export function useDeleteRecruitmentPosition(positionId: string) {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      fetcher(`/recruitment/positions/${positionId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'recruitment', 'positions'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Recruitment Candidates
// ---------------------------------------------------------------------------

interface CandidateParams {
  page?: number;
  page_size?: number;
  search?: string;
  position_id?: string;
  pipeline_stage?: string;
}

export function useRecruitmentCandidates(
  params?: CandidateParams,
  options?: { enabled?: boolean }
) {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);

  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.set('page', params.page.toString());
  if (params?.page_size) queryParams.set('page_size', params.page_size.toString());
  if (params?.search) queryParams.set('search', params.search);
  if (params?.position_id) queryParams.set('position_id', params.position_id);
  if (params?.pipeline_stage) queryParams.set('pipeline_stage', params.pipeline_stage);

  const queryString = queryParams.toString();
  const endpoint = queryString ? `/recruitment/candidates?${queryString}` : '/recruitment/candidates';

  return useQuery({
    queryKey: ['admin', 'recruitment', 'candidates', params],
    queryFn: () => fetcher<PaginatedResponse<RecruitmentCandidateResponse>>(endpoint),
    ...options,
  });
}

export function useRecruitmentCandidate(candidateId: string, options?: { enabled?: boolean }) {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);

  return useQuery({
    queryKey: ['admin', 'recruitment', 'candidates', candidateId],
    queryFn: () => fetcher<RecruitmentCandidateResponse>(`/recruitment/candidates/${candidateId}`),
    ...options,
  });
}

export function useCreateRecruitmentCandidate() {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RecruitmentCandidateCreate) =>
      fetcher<RecruitmentCandidateResponse>('/recruitment/candidates', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'recruitment', 'candidates'] });
    },
  });
}

export function useUpdateRecruitmentCandidate(candidateId: string) {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RecruitmentCandidateUpdate) =>
      fetcher<RecruitmentCandidateResponse>(`/recruitment/candidates/${candidateId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'recruitment', 'candidates'] });
    },
  });
}
