'use client';

/**
 * Admin Batches — Data-fetching hooks.
 *
 * Wired to /api/v1/admin/batches/* endpoints.
 */

import { useAdminList } from '@/lib/hooks/use-admin-query';
import type {
  BatchResponse,
  PaginatedResponse,
} from '@/types/admin-api';
import type { UseQueryResult } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// List params
// ---------------------------------------------------------------------------

export interface BatchListParams {
  page?: number;
  page_size?: number;
  phase?: string;
  is_active?: boolean;
}

// ---------------------------------------------------------------------------
// List hook
// ---------------------------------------------------------------------------

export function useBatches(
  params?: BatchListParams,
  options?: { enabled?: boolean }
): UseQueryResult<PaginatedResponse<BatchResponse>> {
  return useAdminList<BatchResponse>(
    'batches',
    params as Record<string, string | number | boolean | undefined>,
    options,
  );
}
