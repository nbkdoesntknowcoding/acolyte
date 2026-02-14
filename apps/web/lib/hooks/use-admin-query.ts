'use client';

/**
 * Admin Engine — Generic CRUD Query Hooks
 *
 * Factory hooks that wrap @tanstack/react-query for the admin API.
 * Every admin page uses these instead of writing raw useQuery/useMutation.
 *
 * Pattern follows platform-api.ts but generalized for any admin resource.
 */

import { useAuth } from '@clerk/nextjs';
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
  type QueryKey,
} from '@tanstack/react-query';
import { createAdminFetcher } from '@/lib/api/admin-client-browser';
import type { PaginatedResponse } from '@/types/admin-api';

// ---------------------------------------------------------------------------
// List hook — paginated
// ---------------------------------------------------------------------------

export function useAdminList<T>(
  resource: string,
  params?: Record<string, string | number | boolean | undefined>,
  options?: { enabled?: boolean; refetchInterval?: number }
): UseQueryResult<PaginatedResponse<T>> {
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
  const path = qs ? `/${resource}/?${qs}` : `/${resource}/`;

  return useQuery({
    queryKey: ['admin', resource, params ?? {}] as QueryKey,
    queryFn: () => fetcher<PaginatedResponse<T>>(path),
    ...options,
  });
}

// ---------------------------------------------------------------------------
// Detail hook — single record
// ---------------------------------------------------------------------------

export function useAdminDetail<T>(
  resource: string,
  id: string | undefined,
  options?: { enabled?: boolean }
): UseQueryResult<T> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);

  return useQuery({
    queryKey: ['admin', resource, id] as QueryKey,
    queryFn: () => fetcher<T>(`/${resource}/${id}/`),
    enabled: !!id && (options?.enabled !== false),
  });
}

// ---------------------------------------------------------------------------
// Create mutation
// ---------------------------------------------------------------------------

export function useAdminCreate<TInput, TOutput = TInput>(
  resource: string
): UseMutationResult<TOutput, Error, TInput> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: TInput) =>
      fetcher<TOutput>(`/${resource}/`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', resource] });
    },
  });
}

// ---------------------------------------------------------------------------
// Update mutation
// ---------------------------------------------------------------------------

export function useAdminUpdate<TInput, TOutput = TInput>(
  resource: string
): UseMutationResult<TOutput, Error, { id: string; data: TInput }> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TInput }) =>
      fetcher<TOutput>(`/${resource}/${id}/`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['admin', resource] });
      qc.invalidateQueries({ queryKey: ['admin', resource, vars.id] });
    },
  });
}

// ---------------------------------------------------------------------------
// Delete mutation
// ---------------------------------------------------------------------------

export function useAdminDelete(
  resource: string
): UseMutationResult<void, Error, string> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      fetcher<void>(`/${resource}/${id}/`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', resource] });
    },
  });
}

// ---------------------------------------------------------------------------
// Action mutation — for status transitions, approvals, etc.
// ---------------------------------------------------------------------------

export function useAdminAction<TResult = unknown>(
  resource: string
): UseMutationResult<
  TResult,
  Error,
  { id: string; action: string; body?: Record<string, unknown> }
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      action,
      body,
    }: {
      id: string;
      action: string;
      body?: Record<string, unknown>;
    }) =>
      fetcher<TResult>(`/${resource}/${id}/${action}/`, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', resource] });
    },
  });
}
