'use client';

/**
 * Admin Library — Data-fetching hooks.
 *
 * Wired to /api/v1/admin/library/* endpoints.
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
  LibraryBookResponse,
  LibraryJournalResponse,
  LibraryIssuanceResponse,
  IssueBookRequest,
  ReturnBookRequest,
  ReturnBookResponse,
  NMCLibraryComplianceResponse,
  PaginatedResponse,
} from '@/types/admin-api';

// ---------------------------------------------------------------------------
// Books
// ---------------------------------------------------------------------------

export interface LibraryBookListParams {
  page?: number;
  page_size?: number;
  search?: string;
  subject?: string;
  department_id?: string;
  status?: string;
}

export function useLibraryBooks(
  params?: LibraryBookListParams,
  options?: { enabled?: boolean },
): UseQueryResult<PaginatedResponse<LibraryBookResponse>> {
  return useAdminList<LibraryBookResponse>(
    'library/books',
    params as Record<string, string | number | boolean | undefined>,
    options,
  );
}

// ---------------------------------------------------------------------------
// Journals
// ---------------------------------------------------------------------------

export interface LibraryJournalListParams {
  page?: number;
  page_size?: number;
  journal_type?: string;
  subscription_status?: string;
}

export function useLibraryJournals(
  params?: LibraryJournalListParams,
  options?: { enabled?: boolean },
): UseQueryResult<PaginatedResponse<LibraryJournalResponse>> {
  return useAdminList<LibraryJournalResponse>(
    'library/journals',
    params as Record<string, string | number | boolean | undefined>,
    options,
  );
}

// ---------------------------------------------------------------------------
// Issuances
// ---------------------------------------------------------------------------

export interface LibraryIssuanceListParams {
  page?: number;
  page_size?: number;
  book_id?: string;
  borrower_id?: string;
  status?: string;
}

export function useLibraryIssuances(
  params?: LibraryIssuanceListParams,
  options?: { enabled?: boolean },
): UseQueryResult<PaginatedResponse<LibraryIssuanceResponse>> {
  return useAdminList<LibraryIssuanceResponse>(
    'library/issuances',
    params as Record<string, string | number | boolean | undefined>,
    options,
  );
}

// ---------------------------------------------------------------------------
// Overdue Books
// ---------------------------------------------------------------------------

export function useOverdueBooks(): UseQueryResult<LibraryIssuanceResponse[]> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);

  return useQuery({
    queryKey: ['admin', 'library', 'overdue'],
    queryFn: () => fetcher<LibraryIssuanceResponse[]>('/library/overdue'),
  });
}

// ---------------------------------------------------------------------------
// NMC Compliance
// ---------------------------------------------------------------------------

export function useLibraryNMCCompliance(): UseQueryResult<NMCLibraryComplianceResponse> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);

  return useQuery({
    queryKey: ['admin', 'library', 'nmc-compliance'],
    queryFn: () =>
      fetcher<NMCLibraryComplianceResponse>('/library/nmc-compliance'),
  });
}

// ---------------------------------------------------------------------------
// Issue Book Mutation
// ---------------------------------------------------------------------------

export function useIssueBook(): UseMutationResult<
  LibraryIssuanceResponse,
  Error,
  IssueBookRequest
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: IssueBookRequest) =>
      fetcher<LibraryIssuanceResponse>('/library/issue-book', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'library'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Return Book Mutation
// ---------------------------------------------------------------------------

export function useReturnBook(): UseMutationResult<
  ReturnBookResponse,
  Error,
  ReturnBookRequest
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: ReturnBookRequest) =>
      fetcher<ReturnBookResponse>('/library/return-book', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'library'] });
    },
  });
}
