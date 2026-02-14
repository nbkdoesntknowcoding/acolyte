import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "./use-api";
import { deviceApi } from "@/lib/api/device-api";

export function useDeviceStats() {
  const api = useApi();
  return useQuery({
    queryKey: ["admin", "devices", "stats"],
    queryFn: () => deviceApi.getStats(api),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export function useDevices(params?: Parameters<typeof deviceApi.list>[1]) {
  const api = useApi();
  return useQuery({
    queryKey: ["admin", "devices", "list", params],
    queryFn: () => deviceApi.list(api, params),
    staleTime: 30_000,
  });
}

export function useDeviceSearch(search: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["admin", "devices", "search", search],
    queryFn: () => deviceApi.list(api, { search, page_size: 30 }),
    enabled: search.length >= 2,
    staleTime: 15_000,
  });
}

export function useDeviceByUser(userId: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["admin", "devices", "user", userId],
    queryFn: () => deviceApi.getByUser(api, userId),
    enabled: !!userId,
    staleTime: 30_000,
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

export function useResetDevice() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      deviceApi.resetForUser(api, userId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "devices"] });
    },
  });
}
