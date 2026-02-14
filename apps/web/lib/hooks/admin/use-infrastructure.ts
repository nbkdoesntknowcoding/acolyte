'use client';

/**
 * Admin Infrastructure — Data-fetching hooks.
 *
 * Wired to /api/v1/admin/infrastructure/* endpoints.
 */

import { useAuth } from '@clerk/nextjs';
import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { createAdminFetcher } from '@/lib/api/admin-client-browser';
import { useAdminList } from '@/lib/hooks/use-admin-query';
import type {
  InfrastructureResponse,
  EquipmentResponse,
  MaintenanceTicketResponse,
  MaintenanceTicketCreate,
  PaginatedResponse,
} from '@/types/admin-api';

// ---------------------------------------------------------------------------
// Infrastructure
// ---------------------------------------------------------------------------

export interface InfrastructureListParams {
  page?: number;
  page_size?: number;
  category?: string;
  department_id?: string;
  condition?: string;
  building?: string;
}

export function useInfrastructure(
  params?: InfrastructureListParams,
  options?: { enabled?: boolean },
): UseQueryResult<PaginatedResponse<InfrastructureResponse>> {
  return useAdminList<InfrastructureResponse>(
    'infrastructure',
    params as Record<string, string | number | boolean | undefined>,
    options,
  );
}

// ---------------------------------------------------------------------------
// Equipment
// ---------------------------------------------------------------------------

export interface EquipmentListParams {
  page?: number;
  page_size?: number;
  department_id?: string;
  condition?: string;
  amc_status?: string;
  is_nmc_required?: boolean;
}

export function useEquipment(
  params?: EquipmentListParams,
  options?: { enabled?: boolean },
): UseQueryResult<PaginatedResponse<EquipmentResponse>> {
  return useAdminList<EquipmentResponse>(
    'infrastructure/equipment',
    params as Record<string, string | number | boolean | undefined>,
    options,
  );
}

// ---------------------------------------------------------------------------
// Maintenance Tickets
// ---------------------------------------------------------------------------

export interface MaintenanceTicketListParams {
  page?: number;
  page_size?: number;
  department_id?: string;
  entity_type?: string;
  priority?: string;
  status?: string;
}

export function useMaintenanceTickets(
  params?: MaintenanceTicketListParams,
  options?: { enabled?: boolean },
): UseQueryResult<PaginatedResponse<MaintenanceTicketResponse>> {
  return useAdminList<MaintenanceTicketResponse>(
    'infrastructure/tickets',
    params as Record<string, string | number | boolean | undefined>,
    options,
  );
}

// ---------------------------------------------------------------------------
// Create Maintenance Ticket Mutation
// ---------------------------------------------------------------------------

export function useCreateMaintenanceTicket(): UseMutationResult<
  MaintenanceTicketResponse,
  Error,
  MaintenanceTicketCreate
> {
  const { getToken } = useAuth();
  const fetcher = createAdminFetcher(getToken);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: MaintenanceTicketCreate) =>
      fetcher<MaintenanceTicketResponse>('/infrastructure/tickets', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'infrastructure'] });
    },
  });
}
