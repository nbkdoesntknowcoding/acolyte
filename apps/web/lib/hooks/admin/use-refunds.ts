'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { createAdminFetcher } from '@/lib/api/admin-client-browser';
import type {
  FeeRefundResponse,
  FeeRefundCreate,
  FeeRefundUpdate,
  PaginatedResponse,
} from '@/types/admin-api';

// ---------------------------------------------------------------------------
// Fee Refunds
// ---------------------------------------------------------------------------

interface RefundParams {
  page?: number;
  page_size?: number;
  status?: string;
  reason?: string;
}

export function useFeeRefunds(params?: RefundParams, options?: { enabled?: boolean }) {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);

  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.set('page', params.page.toString());
  if (params?.page_size) queryParams.set('page_size', params.page_size.toString());
  if (params?.status) queryParams.set('status', params.status);
  if (params?.reason) queryParams.set('reason', params.reason);

  const queryString = queryParams.toString();
  const endpoint = queryString ? `/fees/refunds?${queryString}` : '/fees/refunds';

  return useQuery({
    queryKey: ['admin', 'fees', 'refunds', params],
    queryFn: () => fetcher<PaginatedResponse<FeeRefundResponse>>(endpoint),
    ...options,
  });
}

export function useFeeRefund(refundId: string, options?: { enabled?: boolean }) {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);

  return useQuery({
    queryKey: ['admin', 'fees', 'refunds', refundId],
    queryFn: () => fetcher<FeeRefundResponse>(`/fees/refunds/${refundId}`),
    ...options,
  });
}

export function useCreateFeeRefund() {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: FeeRefundCreate) =>
      fetcher<FeeRefundResponse>('/fees/refunds', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'fees', 'refunds'] });
    },
  });
}

export function useUpdateFeeRefund(refundId: string) {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: FeeRefundUpdate) =>
      fetcher<FeeRefundResponse>(`/fees/refunds/${refundId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'fees', 'refunds'] });
    },
  });
}
