'use client';

/**
 * Admin Departments — Data-fetching hooks.
 *
 * Wired to /api/v1/admin/departments/* endpoints.
 * Uses the generic admin CRUD hooks.
 */

import { useAdminList } from '@/lib/hooks/use-admin-query';
import type {
  DepartmentResponse,
  PaginatedResponse,
} from '@/types/admin-api';
import type { UseQueryResult } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Department list params
// ---------------------------------------------------------------------------

export interface DepartmentListParams {
  page?: number;
  page_size?: number;
  search?: string;
  nmc_type?: string;
  active_only?: boolean;
}

// ---------------------------------------------------------------------------
// List hook
// ---------------------------------------------------------------------------

export function useDepartments(
  params?: DepartmentListParams,
  options?: { enabled?: boolean }
): UseQueryResult<PaginatedResponse<DepartmentResponse>> {
  return useAdminList<DepartmentResponse>(
    'departments',
    params as Record<string, string | number | boolean | undefined>,
    options,
  );
}
