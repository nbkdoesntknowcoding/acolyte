import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "./use-api";
import { qrApi } from "@/lib/api/qr-api";
import { adminApi } from "@/lib/api/admin-api";
import { deviceApi } from "@/lib/api/device-api";

/**
 * Aggregated alerts count — drives the badge on the Alerts tab.
 */
export function useAlertCounts() {
  const api = useApi();

  const approvals = useQuery({
    queryKey: ["admin", "alerts", "approvals"],
    queryFn: () => adminApi.getPendingApprovals(api, 100),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const anomalies = useQuery({
    queryKey: ["admin", "alerts", "anomalies"],
    queryFn: () => qrApi.getAnomalies(api, 7),
    staleTime: 60_000,
    refetchInterval: 30_000,
  });

  const flagged = useQuery({
    queryKey: ["admin", "alerts", "flagged"],
    queryFn: () => deviceApi.getFlagged(api),
    staleTime: 60_000,
    refetchInterval: 30_000,
  });

  const grievances = useQuery({
    queryKey: ["admin", "alerts", "grievances"],
    queryFn: () =>
      adminApi.getGrievances(api, { status: "open,in_progress", page_size: 50 }),
    staleTime: 60_000,
    refetchInterval: 30_000,
  });

  const pendingCount = approvals.data?.data?.length ?? 0;
  const anomalyCount =
    anomalies.data?.anomalies?.reduce((s, a) => s + a.count, 0) ?? 0;
  const flaggedCount = flagged.data?.count ?? 0;
  const grievanceCount = grievances.data?.data?.length ?? 0;

  return {
    pendingCount,
    anomalyCount,
    flaggedCount,
    grievanceCount,
    totalCount:
      (pendingCount > 0 ? 1 : 0) +
      (anomalyCount > 0 ? 1 : 0) +
      (flaggedCount > 0 ? 1 : 0) +
      (grievanceCount > 0 ? 1 : 0),
    isLoading: approvals.isLoading || anomalies.isLoading,
  };
}

// ---------------------------------------------------------------------------
// Grievances
// ---------------------------------------------------------------------------

export function useGrievances(status = "open,in_progress") {
  const api = useApi();
  return useQuery({
    queryKey: ["admin", "grievances", status],
    queryFn: () => adminApi.getGrievances(api, { status, page_size: 20 }),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export function useGrievance(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["admin", "grievance", id],
    queryFn: () => adminApi.getGrievance(api, id),
    enabled: !!id,
  });
}

export function useUpdateGrievance() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      notes,
    }: {
      id: string;
      status: string;
      notes?: string;
    }) => adminApi.updateGrievanceStatus(api, id, status, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "grievances"] });
      qc.invalidateQueries({ queryKey: ["admin", "grievance"] });
      qc.invalidateQueries({ queryKey: ["admin", "alerts"] });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Notices
// ---------------------------------------------------------------------------

export function useNotices(pageSize = 10) {
  const api = useApi();
  return useQuery({
    queryKey: ["admin", "notices", pageSize],
    queryFn: () =>
      adminApi.getNotices(api, { status: "published", page_size: pageSize }),
    staleTime: 60_000,
  });
}

export function usePublishNotice() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      title: string;
      body: string;
      priority: string;
      target_audience: string;
    }) => adminApi.publishNotice(api, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "notices"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Compliance warnings
// ---------------------------------------------------------------------------

export function useMSRGaps() {
  const api = useApi();
  return useQuery({
    queryKey: ["admin", "msr", "gaps"],
    queryFn: () => adminApi.getMSRGaps(api),
    staleTime: 300_000,
  });
}

export function useFeeDefaulters() {
  const api = useApi();
  return useQuery({
    queryKey: ["admin", "fee-defaulters"],
    queryFn: () => adminApi.getFeeDefaulters(api),
    staleTime: 300_000,
  });
}

export function useAttendanceAlerts() {
  const api = useApi();
  return useQuery({
    queryKey: ["admin", "attendance-alerts"],
    queryFn: () => adminApi.getAttendanceAlerts(api),
    staleTime: 300_000,
  });
}
