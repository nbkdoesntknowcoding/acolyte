'use client';

/**
 * Admin Notices — Data-fetching hooks.
 *
 * Wired to /api/v1/admin/notices/* endpoints.
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
  NoticeResponse,
  NoticeCreate,
  NoticeAnalyticsResponse,
  PaginatedResponse,
} from '@/types/admin-api';

// ---------------------------------------------------------------------------
// Notices
// ---------------------------------------------------------------------------

export interface NoticeListParams {
  page?: number;
  page_size?: number;
  status?: string;
  notice_type?: string;
  priority?: string;
}

export function useNotices(
  params?: NoticeListParams,
  options?: { enabled?: boolean },
): UseQueryResult<PaginatedResponse<NoticeResponse>> {
  return useAdminList<NoticeResponse>(
    'notices',
    params as Record<string, string | number | boolean | undefined>,
    options,
  );
}

// ---------------------------------------------------------------------------
// Notice Analytics
// ---------------------------------------------------------------------------

export function useNoticeAnalytics(
  noticeId: string,
  options?: { enabled?: boolean },
): UseQueryResult<NoticeAnalyticsResponse> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);

  return useQuery({
    queryKey: ['admin', 'notices', noticeId, 'analytics'],
    queryFn: () =>
      fetcher<NoticeAnalyticsResponse>(`/notices/${noticeId}/analytics`),
    ...options,
  });
}

// ---------------------------------------------------------------------------
// Create Notice Mutation
// ---------------------------------------------------------------------------

export function useCreateNotice(): UseMutationResult<
  NoticeResponse,
  Error,
  NoticeCreate
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: NoticeCreate) =>
      fetcher<NoticeResponse>('/notices', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'notices'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Publish Notice Mutation
// ---------------------------------------------------------------------------

export function usePublishNotice(): UseMutationResult<
  NoticeResponse,
  Error,
  string
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (noticeId: string) =>
      fetcher<NoticeResponse>(`/notices/${noticeId}/publish`, {
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'notices'] });
    },
  });
}
