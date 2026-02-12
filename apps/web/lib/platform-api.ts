'use client';

import { useAuth } from '@clerk/nextjs';
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ---------------------------------------------------------------------------
// Types — mirrors backend platform schemas
// ---------------------------------------------------------------------------

export interface LicenseResponse {
  id: string;
  college_id: string;
  plan_tier: string;
  plan_name: string;
  enabled_engines: Record<string, boolean>;
  enabled_features: Record<string, boolean>;
  max_students: number;
  max_faculty: number;
  max_storage_gb: number;
  monthly_ai_token_budget: number;
  billing_cycle: string;
  price_inr: number | null;
  billing_email: string | null;
  razorpay_subscription_id: string | null;
  status: string;
  activated_at: string | null;
  expires_at: string | null;
  suspended_at: string | null;
  suspension_reason: string | null;
  sales_contact: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // Enriched fields from list endpoint
  college_name?: string;
  current_students?: number;
  current_faculty?: number;
  ai_tokens_month_to_date?: number;
  storage_used_gb_current?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface UsageLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
  pct: number;
  message: string | null;
}

export interface UsageSummary {
  students: UsageLimitResult;
  faculty: UsageLimitResult;
  ai_budget: UsageLimitResult;
  storage: UsageLimitResult;
  features: { enabled: string[]; disabled: string[] };
}

export interface LicenseDetail {
  license: LicenseResponse;
  usage: UsageSummary;
  snapshots: UsageSnapshot[];
  active_alerts: PlatformAlert[];
}

export interface UsageSnapshot {
  id: string;
  license_id: string;
  snapshot_date: string;
  active_students: number;
  active_faculty: number;
  total_users: number;
  ai_tokens_used: number;
  ai_tokens_month_to_date: number;
  ai_requests_count: number;
  storage_used_gb: number;
  api_requests_count: number;
  feature_usage: Record<string, number> | null;
  created_at: string;
}

export interface ComponentHealth {
  status: string;
  details: Record<string, unknown>;
}

export interface HealthOverview {
  system_status: string;
  components: Record<string, ComponentHealth>;
  active_alerts: number;
  total_active_licenses: number;
  total_active_users_today: number;
}

export interface MetricPoint {
  timestamp: string;
  value: number;
}

export interface AICostByCollege {
  college_id: string;
  college_name: string;
  cost_usd: number;
  budget_usd: number;
  pct_used: number;
}

export interface AICostByModel {
  model: string;
  cost_usd: number;
  token_count: number;
}

export interface AICostByAgent {
  agent_id: string;
  cost_usd: number;
  call_count: number;
}

export interface AICostBreakdown {
  total_cost_today_usd: number;
  total_cost_this_month_usd: number;
  by_college: AICostByCollege[];
  by_model: AICostByModel[];
  by_agent: AICostByAgent[];
  cache_savings_usd: number;
  projected_monthly_cost_usd: number;
}

export interface AnalyticsOverview {
  total_licenses: number;
  active_licenses: number;
  total_students: number;
  total_faculty: number;
  total_ai_calls_today: number;
  mrr_inr: number;
  licenses_expiring_30_days: number;
  churn_risk_colleges: { college_id: string; name: string; reason: string }[];
  top_engaged_colleges: { college_id: string; name: string; dau: number }[];
  least_engaged_colleges: {
    college_id: string;
    name: string;
    last_active: string | null;
  }[];
}

export interface FeatureAdoptionItem {
  feature: string;
  enabled_count: number;
  active_users: number;
  calls_per_day: number;
}

export interface PlatformAlert {
  id: string;
  severity: string;
  category: string;
  title: string;
  details: string;
  college_id: string | null;
  license_id: string | null;
  source_component: string | null;
  trigger_data: Record<string, unknown> | null;
  status: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
}

export interface OnboardingStatusEntry {
  college_id: string;
  college_name: string;
  plan_tier: string;
  status: string;
  created_at: string;
  days_since_created: number;
  is_stalled: boolean;
}

export interface AuditLogEntry {
  id: string;
  actor_id: string;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  changes: Record<string, unknown> | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Fetcher factory (not a hook — creates a fetch function from a token getter)
// ---------------------------------------------------------------------------

function createFetcher(
  getToken: (opts?: { template?: string }) => Promise<string | null>
) {
  return async function <T>(
    path: string,
    options?: RequestInit
  ): Promise<T> {
    // Use the acolyte-session JWT template which includes public_metadata.
    // Falls back to default session token if template doesn't exist.
    let token = await getToken({ template: 'acolyte-session' });
    if (!token) {
      token = await getToken();
    }
    const res = await fetch(`${API_BASE}/api/v1/platform${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      ...options,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Request failed: ${res.status}`);
    }
    return res.json();
  };
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useAnalyticsOverview(): UseQueryResult<AnalyticsOverview> {
  const { getToken } = useAuth();
  const fetcher = createFetcher(getToken);
  return useQuery({
    queryKey: ['platform', 'analytics', 'overview'],
    queryFn: () => fetcher<AnalyticsOverview>('/analytics/overview'),
    refetchInterval: 60_000,
  });
}

export function useHealthOverview(): UseQueryResult<HealthOverview> {
  const { getToken } = useAuth();
  const fetcher = createFetcher(getToken);
  return useQuery({
    queryKey: ['platform', 'health', 'overview'],
    queryFn: () => fetcher<HealthOverview>('/health/overview'),
    refetchInterval: 30_000,
  });
}

export function useHealthMetrics(
  component: string,
  metricName?: string
): UseQueryResult<MetricPoint[]> {
  const { getToken } = useAuth();
  const fetcher = createFetcher(getToken);
  const params = new URLSearchParams({ component });
  if (metricName) params.set('metric_name', metricName);
  return useQuery({
    queryKey: ['platform', 'health', 'metrics', component, metricName],
    queryFn: () => fetcher<MetricPoint[]>(`/health/metrics?${params}`),
    refetchInterval: 60_000,
  });
}

export function useAICosts(): UseQueryResult<AICostBreakdown> {
  const { getToken } = useAuth();
  const fetcher = createFetcher(getToken);
  return useQuery({
    queryKey: ['platform', 'health', 'ai-costs'],
    queryFn: () => fetcher<AICostBreakdown>('/health/ai-costs'),
    refetchInterval: 60_000,
  });
}

export function useLicenses(filters: {
  status?: string;
  plan_tier?: string;
  search?: string;
  page?: number;
  per_page?: number;
  expiring_within_days?: number;
}): UseQueryResult<PaginatedResponse<LicenseResponse>> {
  const { getToken } = useAuth();
  const fetcher = createFetcher(getToken);
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.plan_tier) params.set('plan_tier', filters.plan_tier);
  if (filters.search) params.set('search', filters.search);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.per_page) params.set('per_page', String(filters.per_page));
  if (filters.expiring_within_days)
    params.set('expiring_within_days', String(filters.expiring_within_days));
  return useQuery({
    queryKey: ['platform', 'licenses', filters],
    queryFn: () =>
      fetcher<PaginatedResponse<LicenseResponse>>(`/licenses?${params}`),
  });
}

export function useLicenseDetail(
  id: string
): UseQueryResult<LicenseDetail> {
  const { getToken } = useAuth();
  const fetcher = createFetcher(getToken);
  return useQuery({
    queryKey: ['platform', 'licenses', id],
    queryFn: () => fetcher<LicenseDetail>(`/licenses/${id}`),
    enabled: !!id,
  });
}

export function useAlerts(filters: {
  severity?: string;
  category?: string;
  status?: string;
  page?: number;
  per_page?: number;
}): UseQueryResult<PaginatedResponse<PlatformAlert>> {
  const { getToken } = useAuth();
  const fetcher = createFetcher(getToken);
  const params = new URLSearchParams();
  if (filters.severity) params.set('severity', filters.severity);
  if (filters.category) params.set('category', filters.category);
  if (filters.status) params.set('status', filters.status);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.per_page) params.set('per_page', String(filters.per_page));
  return useQuery({
    queryKey: ['platform', 'alerts', filters],
    queryFn: () =>
      fetcher<PaginatedResponse<PlatformAlert>>(`/alerts?${params}`),
  });
}

export function useFeatureAdoption(): UseQueryResult<{
  features: FeatureAdoptionItem[];
}> {
  const { getToken } = useAuth();
  const fetcher = createFetcher(getToken);
  return useQuery({
    queryKey: ['platform', 'analytics', 'feature-adoption'],
    queryFn: () =>
      fetcher<{ features: FeatureAdoptionItem[] }>(
        '/analytics/feature-adoption'
      ),
  });
}

export function useOnboardingStatus(): UseQueryResult<
  OnboardingStatusEntry[]
> {
  const { getToken } = useAuth();
  const fetcher = createFetcher(getToken);
  return useQuery({
    queryKey: ['platform', 'onboarding-status'],
    queryFn: () => fetcher<OnboardingStatusEntry[]>('/onboarding-status'),
  });
}

export function useAuditLog(filters: {
  action?: string;
  entity_type?: string;
  page?: number;
  per_page?: number;
}): UseQueryResult<PaginatedResponse<AuditLogEntry>> {
  const { getToken } = useAuth();
  const fetcher = createFetcher(getToken);
  const params = new URLSearchParams();
  if (filters.action) params.set('action', filters.action);
  if (filters.entity_type) params.set('entity_type', filters.entity_type);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.per_page) params.set('per_page', String(filters.per_page));
  return useQuery({
    queryKey: ['platform', 'audit-log', filters],
    queryFn: () =>
      fetcher<PaginatedResponse<AuditLogEntry>>(`/audit-log?${params}`),
  });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function useCreateLicense() {
  const { getToken } = useAuth();
  const fetcher = createFetcher(getToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetcher<LicenseResponse>('/licenses', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform', 'licenses'] }),
  });
}

export function useOnboardCollege() {
  const { getToken } = useAuth();
  const fetcher = createFetcher(getToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetcher('/onboard-college', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform', 'licenses'] });
      qc.invalidateQueries({ queryKey: ['platform', 'onboarding-status'] });
    },
  });
}

export function useUpdateLicense() {
  const { getToken } = useAuth();
  const fetcher = createFetcher(getToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      fetcher<LicenseResponse>(`/licenses/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['platform', 'licenses'] });
      qc.invalidateQueries({ queryKey: ['platform', 'licenses', vars.id] });
    },
  });
}

export function useLicenseAction() {
  const { getToken } = useAuth();
  const fetcher = createFetcher(getToken);
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
      fetcher<LicenseResponse>(`/licenses/${id}/${action}`, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform', 'licenses'] }),
  });
}

// ---------------------------------------------------------------------------
// Test runner hooks
// ---------------------------------------------------------------------------

export interface TestSuite {
  file: string;
  path: string;
  label: string;
}

export interface TestRunResult {
  status: 'passed' | 'failed' | 'timeout';
  exit_code: number;
  summary: string;
  output: string;
  stderr?: string;
  passed: number;
  failed: number;
  errors: number;
  total: number;
  duration_seconds: number;
  suite: string | null;
  keyword: string | null;
  ran_at: string;
}

export function useTestSuites(): UseQueryResult<TestSuite[]> {
  const { getToken } = useAuth();
  const fetcher = createFetcher(getToken);
  return useQuery({
    queryKey: ['platform', 'tests', 'suites'],
    queryFn: () => fetcher<TestSuite[]>('/tests/suites'),
  });
}

export function useRunTests() {
  const { getToken } = useAuth();
  const fetcher = createFetcher(getToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ suite, keyword }: { suite?: string; keyword?: string }) => {
      const params = new URLSearchParams();
      if (suite) params.set('suite', suite);
      if (keyword) params.set('keyword', keyword);
      return fetcher<TestRunResult>(`/tests/run?${params}`, {
        method: 'POST',
      });
    },
  });
}

export function useAlertAction() {
  const { getToken } = useAuth();
  const fetcher = createFetcher(getToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      action,
      body,
    }: {
      id: string;
      action: 'acknowledge' | 'resolve';
      body?: Record<string, unknown>;
    }) =>
      fetcher(`/alerts/${id}/${action}`, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform', 'alerts'] }),
  });
}
