'use client';

/**
 * Admin Documents — Data-fetching hooks.
 *
 * Wired to /api/v1/admin/documents/* endpoints.
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
  DocumentResponse,
  DocumentCreate,
  DocumentUpdate,
  PaginatedResponse,
} from '@/types/admin-api';

// ---------------------------------------------------------------------------
// Documents List
// ---------------------------------------------------------------------------

export interface DocumentListParams {
  page?: number;
  page_size?: number;
  search?: string;
  category?: string;
  sub_category?: string;
  access_level?: string;
  academic_year?: string;
  is_archived?: boolean;
}

export function useDocuments(
  params?: DocumentListParams,
  options?: { enabled?: boolean },
): UseQueryResult<PaginatedResponse<DocumentResponse>> {
  return useAdminList<DocumentResponse>(
    'documents',
    params as Record<string, string | number | boolean | undefined>,
    options,
  );
}

// ---------------------------------------------------------------------------
// Single Document
// ---------------------------------------------------------------------------

export function useDocument(
  documentId: string,
  options?: { enabled?: boolean },
): UseQueryResult<DocumentResponse> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);

  return useQuery({
    queryKey: ['admin', 'documents', documentId],
    queryFn: () => fetcher<DocumentResponse>(`/documents/${documentId}`),
    ...options,
  });
}

// ---------------------------------------------------------------------------
// Create Document Mutation
// ---------------------------------------------------------------------------

export function useCreateDocument(): UseMutationResult<
  DocumentResponse,
  Error,
  DocumentCreate
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: DocumentCreate) =>
      fetcher<DocumentResponse>('/documents', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'documents'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Update Document Mutation
// ---------------------------------------------------------------------------

export function useUpdateDocument(): UseMutationResult<
  DocumentResponse,
  Error,
  { id: string; data: DocumentUpdate }
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: DocumentUpdate }) =>
      fetcher<DocumentResponse>(`/documents/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'documents'] });
    },
  });
}
