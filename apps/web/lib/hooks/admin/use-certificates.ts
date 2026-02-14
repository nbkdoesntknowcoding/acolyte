'use client';

/**
 * Admin Certificates — Data-fetching hooks.
 *
 * Wired to /api/v1/admin/certificates/* endpoints.
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
  CertificateResponse,
  CertificateCreate,
  CertificateRevokeRequest,
  CertificateVerifyResponse,
  PaginatedResponse,
} from '@/types/admin-api';

// ---------------------------------------------------------------------------
// Certificates List
// ---------------------------------------------------------------------------

export interface CertificateListParams {
  page?: number;
  page_size?: number;
  search?: string;
  student_id?: string;
  certificate_type?: string;
  status?: string;
}

export function useCertificates(
  params?: CertificateListParams,
  options?: { enabled?: boolean },
): UseQueryResult<PaginatedResponse<CertificateResponse>> {
  return useAdminList<CertificateResponse>(
    'certificates',
    params as Record<string, string | number | boolean | undefined>,
    options,
  );
}

// ---------------------------------------------------------------------------
// Verify Certificate (Public Endpoint)
// ---------------------------------------------------------------------------

export function useVerifyCertificate(
  certificateNumber: string,
  options?: { enabled?: boolean },
): UseQueryResult<CertificateVerifyResponse> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);

  return useQuery({
    queryKey: ['admin', 'certificates', 'verify', certificateNumber],
    queryFn: () =>
      fetcher<CertificateVerifyResponse>(
        `/certificates/verify/${certificateNumber}`,
      ),
    ...options,
  });
}

// ---------------------------------------------------------------------------
// Generate Certificate Mutation
// ---------------------------------------------------------------------------

export function useGenerateCertificate(): UseMutationResult<
  CertificateResponse,
  Error,
  CertificateCreate
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: CertificateCreate) =>
      fetcher<CertificateResponse>('/certificates/generate', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'certificates'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Revoke Certificate Mutation
// ---------------------------------------------------------------------------

export function useRevokeCertificate(): UseMutationResult<
  CertificateResponse,
  Error,
  { id: string; data: CertificateRevokeRequest }
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CertificateRevokeRequest }) =>
      fetcher<CertificateResponse>(`/certificates/${id}/revoke`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'certificates'] });
    },
  });
}
