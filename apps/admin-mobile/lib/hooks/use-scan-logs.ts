import { useQuery } from "@tanstack/react-query";
import { useApi } from "./use-api";
import { qrApi } from "@/lib/api/qr-api";

export function useScanLogs(
  params?: Parameters<typeof qrApi.getScanLogs>[1],
  options?: { refetchInterval?: number },
) {
  const api = useApi();
  return useQuery({
    queryKey: ["admin", "qr", "scan-logs", params],
    queryFn: () => qrApi.getScanLogs(api, params),
    staleTime: 15_000,
    refetchInterval: options?.refetchInterval,
  });
}

export function useScanLogSummary(days = 30) {
  const api = useApi();
  return useQuery({
    queryKey: ["admin", "qr", "scan-summary", days],
    queryFn: () => qrApi.getSummary(api, days),
    staleTime: 60_000,
  });
}

export function useScanLogAnomalies(days = 30) {
  const api = useApi();
  return useQuery({
    queryKey: ["admin", "qr", "anomalies", days],
    queryFn: () => qrApi.getAnomalies(api, days),
    staleTime: 60_000,
  });
}

export function useActionPoints() {
  const api = useApi();
  return useQuery({
    queryKey: ["admin", "qr", "action-points"],
    queryFn: () => qrApi.getActionPoints(api, { is_active: true }),
    staleTime: 120_000,
  });
}

export function useActionPointStats(id: string, days = 30) {
  const api = useApi();
  return useQuery({
    queryKey: ["admin", "qr", "action-point-stats", id, days],
    queryFn: () => qrApi.getActionPointStats(api, id, days),
    enabled: !!id,
    staleTime: 60_000,
  });
}
