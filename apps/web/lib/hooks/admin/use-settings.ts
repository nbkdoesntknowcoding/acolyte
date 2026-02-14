'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { createAdminFetcher } from '@/lib/api/admin-client-browser';
import type {
  CollegeProfileResponse,
  CollegeProfileUpdate,
  AuditLogResponse,
  PaginatedResponse,
} from '@/types/admin-api';

// ---------------------------------------------------------------------------
// College Profile
// ---------------------------------------------------------------------------

export function useCollegeProfile(options?: { enabled?: boolean }) {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);

  return useQuery({
    queryKey: ['admin', 'settings', 'college-profile'],
    queryFn: () => fetcher<CollegeProfileResponse>('/settings/college-profile'),
    ...options,
  });
}

export function useUpdateCollegeProfile() {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CollegeProfileUpdate) =>
      fetcher<CollegeProfileResponse>('/settings/college-profile', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings', 'college-profile'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Audit Log
// ---------------------------------------------------------------------------

interface AuditLogParams {
  page?: number;
  page_size?: number;
  user_id?: string;
  action?: string;
  entity_type?: string;
  entity_id?: string;
  start_date?: string; // ISO date string
  end_date?: string; // ISO date string
}

export function useAuditLog(params?: AuditLogParams, options?: { enabled?: boolean }) {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);

  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.set('page', params.page.toString());
  if (params?.page_size) queryParams.set('page_size', params.page_size.toString());
  if (params?.user_id) queryParams.set('user_id', params.user_id);
  if (params?.action) queryParams.set('action', params.action);
  if (params?.entity_type) queryParams.set('entity_type', params.entity_type);
  if (params?.entity_id) queryParams.set('entity_id', params.entity_id);
  if (params?.start_date) queryParams.set('start_date', params.start_date);
  if (params?.end_date) queryParams.set('end_date', params.end_date);

  const queryString = queryParams.toString();
  const endpoint = queryString ? `/settings/audit-log?${queryString}` : '/settings/audit-log';

  return useQuery({
    queryKey: ['admin', 'settings', 'audit-log', params],
    queryFn: () => fetcher<PaginatedResponse<AuditLogResponse>>(endpoint),
    ...options,
  });
}
