'use client';

/**
 * Admin Dashboard — Data-fetching hooks.
 *
 * Wired to the actual backend endpoints at /api/v1/admin/dashboard/*.
 * Uses createAdminFetcher for Clerk auth + admin API prefix.
 */

import { useAuth } from '@clerk/nextjs';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { createAdminFetcher } from '@/lib/api/admin-client-browser';

// ---------------------------------------------------------------------------
// Response types (match actual backend shapes)
// ---------------------------------------------------------------------------

export interface DashboardStatsResponse {
  students: {
    total: number;
    active: number;
    admission_pipeline: number;
    graduated: number;
  };
  faculty: {
    total: number;
    active: number;
    on_leave: number;
  };
  departments: number;
  fee_collection: {
    academic_year: string;
    total_collected: number; // paisa
    payment_count: number;
  };
  pending_approvals: number;
  pending_leaves: number;
  active_grievances: number;
}

export interface FeeTrendItem {
  month: number;
  year: number;
  amount: number; // paisa
  count: number;
}

export interface PendingApprovalItem {
  id: string;
  workflow_type: string;
  title: string | null;
  description: string | null;
  requested_by_name: string | null;
  current_step: number;
  priority: string;
  due_date: string | null;
  created_at: string | null;
  status: string;
}

export interface RecentActivityItem {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  user_name: string | null;
  user_role: string | null;
  changes: Record<string, unknown> | null;
  timestamp: string | null;
}

export interface StudentDistribution {
  by_phase: Record<string, number>;
  by_quota: Record<string, number>;
  by_gender: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useDashboardStats(): UseQueryResult<DashboardStatsResponse> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  return useQuery({
    queryKey: ['admin', 'dashboard', 'stats'],
    queryFn: () => fetcher<DashboardStatsResponse>('/dashboard/stats'),
    refetchInterval: 60_000,
  });
}

export function useFeeCollectionTrend(
  academicYear?: string
): UseQueryResult<FeeTrendItem[]> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const params = new URLSearchParams();
  if (academicYear) params.set('academic_year', academicYear);
  const qs = params.toString();
  return useQuery({
    queryKey: ['admin', 'dashboard', 'fee-trend', academicYear],
    queryFn: () =>
      fetcher<FeeTrendItem[]>(`/dashboard/fee-trend${qs ? `?${qs}` : ''}`),
    refetchInterval: 120_000,
  });
}

export function usePendingApprovals(
  limit = 5
): UseQueryResult<PendingApprovalItem[]> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  return useQuery({
    queryKey: ['admin', 'dashboard', 'pending-approvals', limit],
    queryFn: () =>
      fetcher<PendingApprovalItem[]>(
        `/dashboard/pending-approvals?limit=${limit}`
      ),
    refetchInterval: 30_000,
  });
}

export function useRecentActivity(
  limit = 5
): UseQueryResult<RecentActivityItem[]> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  return useQuery({
    queryKey: ['admin', 'dashboard', 'recent-activity', limit],
    queryFn: () =>
      fetcher<RecentActivityItem[]>(
        `/dashboard/recent-activity?limit=${limit}`
      ),
    refetchInterval: 60_000,
  });
}

export function useStudentDistribution(): UseQueryResult<StudentDistribution> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  return useQuery({
    queryKey: ['admin', 'dashboard', 'student-distribution'],
    queryFn: () =>
      fetcher<StudentDistribution>('/dashboard/student-distribution'),
    refetchInterval: 120_000,
  });
}
