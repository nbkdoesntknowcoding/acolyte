/**
 * Platform API client — server-side.
 *
 * Hits /api/v1/* (non-admin-prefixed) endpoints:
 *   - /api/v1/device/*
 *   - /api/v1/qr/*
 *   - /api/v1/me/*
 *   - /api/v1/committees/*
 *   - /api/v1/public/*
 *
 * For use in Next.js Server Components and Route Handlers.
 * Uses Clerk's `auth()` to get the JWT token.
 */
import { auth } from '@clerk/nextjs/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function platformApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const { getToken } = await auth();
  const token = await getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const res = await fetch(`${API_BASE}/api/v1${endpoint}`, {
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

/**
 * Platform API client — no auth required.
 *
 * For public endpoints like /api/v1/public/verify/*.
 */
export async function platformPublicApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}/api/v1${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { message: `Request failed: ${res.status}` } }));
    throw new Error(body?.error?.message || body?.detail || `API error ${res.status}`);
  }

  return res.json();
}
