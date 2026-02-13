'use client';

/**
 * Admin Leave — Data-fetching hooks.
 *
 * Wired to /api/v1/admin/leave/* endpoints.
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
  LeaveBalanceResponse,
  LeaveRequestResponse,
  LeavePolicyResponse,
  PaginatedResponse,
} from '@/types/admin-api';

// ---------------------------------------------------------------------------
// Leave requests list (filterable)
// ---------------------------------------------------------------------------

export interface LeaveRequestListParams {
  page?: number;
  page_size?: number;
  employee_id?: string;
  status?: string;
  leave_type?: string;
  from_date?: string;
  to_date?: string;
}

export function useLeaveRequests(
  params?: LeaveRequestListParams,
  options?: { enabled?: boolean }
): UseQueryResult<PaginatedResponse<LeaveRequestResponse>> {
  return useAdminList<LeaveRequestResponse>(
    'leave',
    params as Record<string, string | number | boolean | undefined>,
    options
  );
}

// ---------------------------------------------------------------------------
// Leave balances for a specific employee
// ---------------------------------------------------------------------------

export function useLeaveBalances(
  employeeId: string | undefined
): UseQueryResult<PaginatedResponse<LeaveBalanceResponse>> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  return useQuery({
    queryKey: ['admin', 'leave', 'balance', employeeId],
    queryFn: () =>
      fetcher<PaginatedResponse<LeaveBalanceResponse>>(
        `/leave/balance/${employeeId}`
      ),
    enabled: !!employeeId,
  });
}

// ---------------------------------------------------------------------------
// Leave policies
// ---------------------------------------------------------------------------

export function useLeavePolicies(
  options?: { enabled?: boolean }
): UseQueryResult<PaginatedResponse<LeavePolicyResponse>> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  return useQuery({
    queryKey: ['admin', 'leave', 'policies'],
    queryFn: () =>
      fetcher<PaginatedResponse<LeavePolicyResponse>>(
        '/leave/policies?page_size=100'
      ),
    ...options,
  });
}

// ---------------------------------------------------------------------------
// Approve leave mutation
// ---------------------------------------------------------------------------

export function useApproveLeave(): UseMutationResult<
  LeaveRequestResponse,
  Error,
  string
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (leaveId: string) =>
      fetcher<LeaveRequestResponse>(`/leave/${leaveId}/approve`, {
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'leave'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Reject leave mutation
// ---------------------------------------------------------------------------

export function useRejectLeave(): UseMutationResult<
  LeaveRequestResponse,
  Error,
  { id: string; rejection_reason: string }
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, rejection_reason }: { id: string; rejection_reason: string }) =>
      fetcher<LeaveRequestResponse>(`/leave/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ rejection_reason }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'leave'] });
    },
  });
}
