'use client';

/**
 * Admin Dynamic Role Assignments — Data-fetching hooks.
 *
 * Wired to /api/v1/admin/role-assignments/* endpoints.
 * Backend returns flat arrays (not paginated wrapper).
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
import type { DynamicRoleAssignment } from '@/types/admin';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface RoleAssignmentCreateInput {
  user_id: string;
  user_type: string;
  user_name: string;
  role_type: string;
  context_type: string;
  context_id: string;
  context_name: string;
  valid_from: string; // ISO date YYYY-MM-DD
  valid_until?: string | null;
  auto_deactivate?: boolean;
  assignment_order_url?: string | null;
  notes?: string | null;
  permissions?: string[] | null;
}

export interface RoleAssignmentUpdateInput {
  valid_until?: string | null;
  is_active?: boolean;
  notes?: string | null;
  assignment_order_url?: string | null;
  permissions?: string[] | null;
}

export interface RoleAssignmentListParams {
  role_type?: string;
  context_type?: string;
  user_id?: string;
  is_active?: boolean;
  page?: number;
  page_size?: number;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** List role assignments. Backend returns a flat array. */
export function useRoleAssignments(
  params?: RoleAssignmentListParams,
  options?: { enabled?: boolean; refetchInterval?: number },
): UseQueryResult<DynamicRoleAssignment[]> {
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
  const path = qs ? `/role-assignments/?${qs}` : '/role-assignments/';

  return useQuery({
    queryKey: ['admin', 'role-assignments', params ?? {}],
    queryFn: () => fetcher<DynamicRoleAssignment[]>(path),
    ...options,
  });
}

/** Create a new role assignment. */
export function useCreateRoleAssignment(): UseMutationResult<
  DynamicRoleAssignment,
  Error,
  RoleAssignmentCreateInput
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data) =>
      fetcher<DynamicRoleAssignment>('/role-assignments/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'role-assignments'] });
    },
  });
}

/** Update a role assignment. */
export function useUpdateRoleAssignment(): UseMutationResult<
  DynamicRoleAssignment,
  Error,
  { id: string; data: RoleAssignmentUpdateInput }
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) =>
      fetcher<DynamicRoleAssignment>(`/role-assignments/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'role-assignments'] });
    },
  });
}

/** Revoke (DELETE) a role assignment. */
export function useRevokeRoleAssignment(): UseMutationResult<
  { status: string; message: string },
  Error,
  { id: string; reason?: string }
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }) =>
      fetcher<{ status: string; message: string }>(
        `/role-assignments/${id}?reason=${encodeURIComponent(reason ?? 'admin_revoked')}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'role-assignments'] });
    },
  });
}

/** List role assignments expiring within N days. */
export function useExpiringRoles(
  days: number = 30,
  options?: { enabled?: boolean },
): UseQueryResult<DynamicRoleAssignment[]> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);

  return useQuery({
    queryKey: ['admin', 'role-assignments', 'expiring', days],
    queryFn: () =>
      fetcher<DynamicRoleAssignment[]>(`/role-assignments/expiring?days=${days}`),
    ...options,
  });
}
