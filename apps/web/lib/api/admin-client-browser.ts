'use client';

/**
 * Admin API client — browser-side.
 *
 * For use in Client Components with React hooks.
 * Uses the same createFetcher pattern as platform-api.ts.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Create a typed fetch wrapper bound to a Clerk getToken function.
 * Call this inside a hook body where useAuth() is available.
 *
 * Usage:
 *   const { getToken } = useAuth();
 *   const fetcher = createAdminFetcher(getToken);
 *   const data = await fetcher<StudentResponse[]>('/students/');
 */
export function createAdminFetcher(
  getToken: (opts?: { template?: string }) => Promise<string | null>
) {
  return async function adminFetch<T>(
    path: string,
    options?: RequestInit
  ): Promise<T> {
    let token = await getToken({ template: 'acolyte-session' });
    if (!token) {
      token = await getToken();
    }
    if (!token) {
      throw new Error('Not authenticated');
    }

    const res = await fetch(`${API_BASE}/api/v1/admin${path}`, {
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
