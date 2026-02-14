'use client';

/**
 * Admin Timetable — Data-fetching hooks.
 *
 * Wired to /api/v1/admin/timetable/* endpoints.
 */

import { useAuth } from '@clerk/nextjs';
import {
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import { createAdminFetcher } from '@/lib/api/admin-client-browser';
import { useAdminList, useAdminDelete } from '@/lib/hooks/use-admin-query';
import type {
  TimetableSlotResponse,
  TimetableSlotCreate,
  TimetableSlotUpdate,
  PaginatedResponse,
} from '@/types/admin-api';

// ---------------------------------------------------------------------------
// List params
// ---------------------------------------------------------------------------

export interface TimetableSlotListParams {
  page?: number;
  page_size?: number;
  academic_year?: string;
  phase?: string;
  batch_id?: string;
  day_of_week?: number;
  department_id?: string;
  faculty_id?: string;
  session_type?: string;
}

// ---------------------------------------------------------------------------
// List hook
// ---------------------------------------------------------------------------

export function useTimetableSlots(
  params?: TimetableSlotListParams,
  options?: { enabled?: boolean }
): UseQueryResult<PaginatedResponse<TimetableSlotResponse>> {
  return useAdminList<TimetableSlotResponse>(
    'timetable',
    params as Record<string, string | number | boolean | undefined>,
    options,
  );
}

// ---------------------------------------------------------------------------
// Create mutation
// ---------------------------------------------------------------------------

export function useCreateTimetableSlot(): UseMutationResult<
  TimetableSlotResponse,
  Error,
  TimetableSlotCreate
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: TimetableSlotCreate) =>
      fetcher<TimetableSlotResponse>('/timetable/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'timetable'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Update mutation (PATCH — sparse update)
// ---------------------------------------------------------------------------

export function useUpdateTimetableSlot(): UseMutationResult<
  TimetableSlotResponse,
  Error,
  { id: string; data: TimetableSlotUpdate }
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TimetableSlotUpdate }) =>
      fetcher<TimetableSlotResponse>(`/timetable/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'timetable'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Delete mutation
// ---------------------------------------------------------------------------

export function useDeleteTimetableSlot(): UseMutationResult<void, Error, string> {
  return useAdminDelete('timetable');
}
