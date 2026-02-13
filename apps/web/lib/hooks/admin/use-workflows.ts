'use client';

/**
 * Admin Workflows — Data-fetching hooks.
 *
 * Wired to /api/v1/admin/workflows/* endpoints.
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
  WorkflowInstanceResponse,
  WorkflowApproveRequest,
  WorkflowRejectRequest,
  WorkflowStatsResponse,
  PaginatedResponse,
} from '@/types/admin-api';

// ---------------------------------------------------------------------------
// All Workflows
// ---------------------------------------------------------------------------

export interface WorkflowListParams {
  page?: number;
  page_size?: number;
  workflow_type?: string;
  status?: string;
  priority?: string;
  current_approver_id?: string;
  requested_by?: string;
}

export function useWorkflows(
  params?: WorkflowListParams,
  options?: { enabled?: boolean },
): UseQueryResult<PaginatedResponse<WorkflowInstanceResponse>> {
  return useAdminList<WorkflowInstanceResponse>(
    'workflows',
    params as Record<string, string | number | boolean | undefined>,
    options,
  );
}

// ---------------------------------------------------------------------------
// Pending Workflows (My Approvals Queue)
// ---------------------------------------------------------------------------

export interface PendingWorkflowParams {
  page?: number;
  page_size?: number;
}

export function usePendingWorkflows(
  params?: PendingWorkflowParams,
  options?: { enabled?: boolean },
): UseQueryResult<PaginatedResponse<WorkflowInstanceResponse>> {
  return useAdminList<WorkflowInstanceResponse>(
    'workflows/pending',
    params as Record<string, string | number | boolean | undefined>,
    options,
  );
}

// ---------------------------------------------------------------------------
// Workflow Stats
// ---------------------------------------------------------------------------

export function useWorkflowStats(
  options?: { enabled?: boolean },
): UseQueryResult<WorkflowStatsResponse> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);

  return useQuery({
    queryKey: ['admin', 'workflows', 'stats'],
    queryFn: () => fetcher<WorkflowStatsResponse>('/workflows/stats'),
    ...options,
  });
}

// ---------------------------------------------------------------------------
// Approve Workflow Mutation
// ---------------------------------------------------------------------------

export function useApproveWorkflow(): UseMutationResult<
  WorkflowInstanceResponse,
  Error,
  { id: string; data?: WorkflowApproveRequest }
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: WorkflowApproveRequest }) =>
      fetcher<WorkflowInstanceResponse>(`/workflows/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify(data || {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'workflows'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Reject Workflow Mutation
// ---------------------------------------------------------------------------

export function useRejectWorkflow(): UseMutationResult<
  WorkflowInstanceResponse,
  Error,
  { id: string; data: WorkflowRejectRequest }
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: WorkflowRejectRequest }) =>
      fetcher<WorkflowInstanceResponse>(`/workflows/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'workflows'] });
    },
  });
}
