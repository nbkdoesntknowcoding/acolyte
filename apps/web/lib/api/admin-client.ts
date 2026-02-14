/**
 * Admin API client — server-side.
 *
 * For use in Next.js Server Components and Route Handlers.
 * Uses Clerk's `auth()` to get the JWT token.
 */
import { auth } from '@clerk/nextjs/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function adminApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const { getToken } = await auth();
  const token = await getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const res = await fetch(`${API_BASE}/api/v1/admin${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { message: `Request failed: ${res.status}` } }));
    throw new Error(body?.error?.message || body?.detail || `API error ${res.status}`);
  }

  return res.json();
}
