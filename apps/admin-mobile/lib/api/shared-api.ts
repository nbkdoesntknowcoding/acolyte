import type { AxiosInstance } from "axios";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MeResponse {
  user_id: string;
  college_id: string;
  role: string;
  email: string;
  full_name: string;
  org_slug?: string;
  permissions: string[];
}

export interface Committee {
  id: string;
  name: string;
  committee_type: string;
  status: string;
  chairperson_name?: string;
  is_nmc_mandated: boolean;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export const sharedApi = {
  getMe: (api: AxiosInstance) =>
    api.get<MeResponse>("/me").then((r) => r.data),

  getCommittees: (api: AxiosInstance) =>
    api.get<{ data: Committee[] }>("/admin/committees").then((r) => r.data),
};
