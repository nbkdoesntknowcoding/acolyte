'use client';

/**
 * Platform API client — browser-side.
 *
 * Hits /api/v1/* (non-admin-prefixed) endpoints from Client Components.
 * Same pattern as admin-client-browser.ts.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Create a typed fetch wrapper bound to a Clerk getToken function.
 *
 * Usage:
 *   const { getToken } = useAuth();
 *   const fetcher = createPlatformFetcher(getToken);
 *   const roles = await fetcher<RoleAssignment[]>('/me/roles');
 */
export function createPlatformFetcher(
  getToken: () => Promise<string | null>
) {
  return async function platformFetch<T>(
    path: string,
    options?: RequestInit
  ): Promise<T> {
    const token = await getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const res = await fetch(`${API_BASE}/api/v1${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options?.headers,
      },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: { message: `Request failed: ${res.status}` } }));
      throw new Error(body?.error?.message || body?.detail || `API error ${res.status}`);
    }

    return res.json();
  };
}
