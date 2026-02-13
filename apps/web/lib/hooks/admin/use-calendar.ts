'use client';

/**
 * Admin Academic Calendar — Data-fetching hooks.
 *
 * Wired to /api/v1/admin/calendar/* endpoints.
 */

import { useAuth } from '@clerk/nextjs';
import {
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import { createAdminFetcher } from '@/lib/api/admin-client-browser';
import { useAdminList } from '@/lib/hooks/use-admin-query';
import type {
  AcademicCalendarEventResponse,
  AcademicCalendarEventCreate,
  AcademicCalendarEventUpdate,
  PaginatedResponse,
} from '@/types/admin-api';

// ---------------------------------------------------------------------------
// List params
// ---------------------------------------------------------------------------

export interface CalendarEventListParams {
  page?: number;
  page_size?: number;
  event_type?: string;
  academic_year?: string;
  department_id?: string;
  affects_phases?: string;
  start_after?: string;
  start_before?: string;
}

// ---------------------------------------------------------------------------
// List hook
// ---------------------------------------------------------------------------

export function useCalendarEvents(
  params?: CalendarEventListParams,
  options?: { enabled?: boolean }
): UseQueryResult<PaginatedResponse<AcademicCalendarEventResponse>> {
  return useAdminList<AcademicCalendarEventResponse>(
    'calendar',
    params as Record<string, string | number | boolean | undefined>,
    options,
  );
}

// ---------------------------------------------------------------------------
// Create mutation
// ---------------------------------------------------------------------------

export function useCreateCalendarEvent(): UseMutationResult<
  AcademicCalendarEventResponse,
  Error,
  AcademicCalendarEventCreate
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: AcademicCalendarEventCreate) =>
      fetcher<AcademicCalendarEventResponse>('/calendar/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'calendar'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Update mutation (PATCH)
// ---------------------------------------------------------------------------

export function useUpdateCalendarEvent(): UseMutationResult<
  AcademicCalendarEventResponse,
  Error,
  { id: string; data: AcademicCalendarEventUpdate }
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AcademicCalendarEventUpdate }) =>
      fetcher<AcademicCalendarEventResponse>(`/calendar/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'calendar'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Delete mutation
// ---------------------------------------------------------------------------

export function useDeleteCalendarEvent(): UseMutationResult<void, Error, string> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      fetcher<void>(`/calendar/${id}/`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'calendar'] });
    },
  });
}
