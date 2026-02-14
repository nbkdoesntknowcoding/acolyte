import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "./use-api";
import { adminApi } from "@/lib/api/admin-api";
import { qrApi } from "@/lib/api/qr-api";
import { deviceApi } from "@/lib/api/device-api";
import { sharedApi } from "@/lib/api/shared-api";

export function useMe() {
  const api = useApi();
  return useQuery({
    queryKey: ["me"],
    queryFn: () => sharedApi.getMe(api),
    staleTime: 300_000,
  });
}

export function useDashboardStats() {
  const api = useApi();
  return useQuery({
    queryKey: ["admin", "dashboard", "stats"],
    queryFn: () => adminApi.getDashboardStats(api),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export function usePendingApprovals(limit = 10) {
  const api = useApi();
  return useQuery({
    queryKey: ["admin", "dashboard", "approvals", limit],
    queryFn: () => adminApi.getPendingApprovals(api, limit),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useRecentActivity(limit = 10) {
  const api = useApi();
  return useQuery({
    queryKey: ["admin", "dashboard", "activity", limit],
    queryFn: () => adminApi.getRecentActivity(api, limit),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useApproveWorkflow() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.approveWorkflow(api, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      qc.invalidateQueries({ queryKey: ["admin", "approvals"] });
      qc.invalidateQueries({ queryKey: ["admin", "alerts"] });
    },
  });
}

export function useRejectWorkflow() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      adminApi.rejectWorkflow(api, id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      qc.invalidateQueries({ queryKey: ["admin", "approvals"] });
      qc.invalidateQueries({ queryKey: ["admin", "alerts"] });
    },
  });
}

export function useFlaggedDevices() {
  const api = useApi();
  return useQuery({
    queryKey: ["admin", "devices", "flagged"],
    queryFn: () => deviceApi.getFlagged(api),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export function useExpiringRoles(days = 7) {
  const api = useApi();
  return useQuery({
    queryKey: ["admin", "roles", "expiring", days],
    queryFn: () => adminApi.getExpiringRoles(api, days),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export function useHourlyScanVolume() {
  const api = useApi();
  return useQuery({
    queryKey: ["admin", "qr", "hourly-volume"],
    queryFn: () => qrApi.getHourlyVolume(api),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}
