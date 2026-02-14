import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { useApi } from "./use-api";
import { adminApi } from "@/lib/api/admin-api";

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Workflows (generic approvals)
// ---------------------------------------------------------------------------

export function useWorkflows(type?: string) {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: ["admin", "workflows", "pending", type],
    queryFn: ({ pageParam = 1 }) =>
      adminApi.getWorkflows(api, {
        status: "pending",
        type,
        page: pageParam,
        page_size: PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const fetched = allPages.reduce((sum, p) => sum + p.data.length, 0);
      return fetched < lastPage.total ? allPages.length + 1 : undefined;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useWorkflowDetail(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["admin", "workflow", id],
    queryFn: () => adminApi.getWorkflow(api, id),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useApproveWorkflow() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.approveWorkflow(api, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "workflows"] });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      qc.invalidateQueries({ queryKey: ["admin", "alerts"] });
      qc.invalidateQueries({ queryKey: ["admin", "leave"] });
    },
  });
}

export function useRejectWorkflow() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      adminApi.rejectWorkflow(api, id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "workflows"] });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      qc.invalidateQueries({ queryKey: ["admin", "alerts"] });
      qc.invalidateQueries({ queryKey: ["admin", "leave"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Leave requests
// ---------------------------------------------------------------------------

export function useLeaveRequests() {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: ["admin", "leave", "pending"],
    queryFn: ({ pageParam = 1 }) =>
      adminApi.getLeaveRequests(api, {
        status: "pending",
        page: pageParam,
        page_size: PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const fetched = allPages.reduce((sum, p) => sum + p.data.length, 0);
      return fetched < lastPage.total ? allPages.length + 1 : undefined;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useLeaveDetail(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["admin", "leave", id],
    queryFn: () => adminApi.getLeaveRequest(api, id),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useApproveLeave() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.approveLeave(api, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "leave"] });
      qc.invalidateQueries({ queryKey: ["admin", "workflows"] });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      qc.invalidateQueries({ queryKey: ["admin", "alerts"] });
    },
  });
}

export function useRejectLeave() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      adminApi.rejectLeave(api, id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "leave"] });
      qc.invalidateQueries({ queryKey: ["admin", "workflows"] });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      qc.invalidateQueries({ queryKey: ["admin", "alerts"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Certificate requests
// ---------------------------------------------------------------------------

export function useCertificateRequests() {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: ["admin", "certificates", "pending"],
    queryFn: ({ pageParam = 1 }) =>
      adminApi.getCertificateRequests(api, {
        status: "pending",
        page: pageParam,
        page_size: PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const fetched = allPages.reduce((sum, p) => sum + p.data.length, 0);
      return fetched < lastPage.total ? allPages.length + 1 : undefined;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Legacy hook (backward compat for dashboard)
// ---------------------------------------------------------------------------

export function useApprovals(limit = 50) {
  const api = useApi();
  return useQuery({
    queryKey: ["admin", "approvals", limit],
    queryFn: () => adminApi.getPendingApprovals(api, limit),
    staleTime: 30_000,
  });
}

export function useUpdateGrievanceStatus() {
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
      qc.invalidateQueries({ queryKey: ["admin", "approvals"] });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
  });
}
