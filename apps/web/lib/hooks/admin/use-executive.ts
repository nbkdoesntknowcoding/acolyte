'use client';

/**
 * Admin Executive Dashboard — Data-fetching hooks.
 *
 * Wired to /api/v1/admin/executive/* endpoints.
 */

import { useAuth } from '@clerk/nextjs';
import {
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query';
import { createAdminFetcher } from '@/lib/api/admin-client-browser';
import type {
  FinancialOverviewResponse,
  ComplianceHeatmapResponse,
  ActionItemsResponse,
} from '@/types/admin-api';

// ---------------------------------------------------------------------------
// Financial Overview
// ---------------------------------------------------------------------------

export function useFinancialOverview(
  options?: { enabled?: boolean },
): UseQueryResult<FinancialOverviewResponse> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);

  return useQuery({
    queryKey: ['admin', 'executive', 'financial-overview'],
    queryFn: () => fetcher<FinancialOverviewResponse>('/executive/financial-overview'),
    ...options,
  });
}

// ---------------------------------------------------------------------------
// Compliance Heatmap
// ---------------------------------------------------------------------------

export function useComplianceHeatmap(
  options?: { enabled?: boolean },
): UseQueryResult<ComplianceHeatmapResponse> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);

  return useQuery({
    queryKey: ['admin', 'executive', 'compliance-heatmap'],
    queryFn: () => fetcher<ComplianceHeatmapResponse>('/executive/compliance-heatmap'),
    ...options,
  });
}

// ---------------------------------------------------------------------------
// Action Items
// ---------------------------------------------------------------------------

export function useActionItems(
  options?: { enabled?: boolean },
): UseQueryResult<ActionItemsResponse> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);

  return useQuery({
    queryKey: ['admin', 'executive', 'action-items'],
    queryFn: () => fetcher<ActionItemsResponse>('/executive/action-items'),
    ...options,
  });
}
