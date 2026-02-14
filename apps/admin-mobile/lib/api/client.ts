import axios from "axios";
import Constants from "expo-constants";

const API_URL =
  Constants.expoConfig?.extra?.apiUrl ??
  process.env.EXPO_PUBLIC_API_URL ??
  "https://acolyte-api.fly.dev";

/**
 * Shared Axios instance for the admin mobile app.
 *
 * The Clerk JWT is attached per-request by the hook layer
 * (see `lib/hooks/` files) because `useAuth().getToken()` is async
 * and hooks-only. A top-level interceptor can't call hooks, so
 * we export a factory that accepts a token getter.
 */
export const apiClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

/**
 * Create an axios instance with a Clerk JWT getter bound.
 *
 * Usage inside a React component / hook:
 *
 * ```ts
 * const { getToken } = useAuth();
 * const api = useRef(createAuthClient(getToken)).current;
 * ```
 */
export function createAuthClient(getToken: () => Promise<string | null>) {
  const client = axios.create({
    baseURL: `${API_URL}/api/v1`,
    timeout: 15_000,
    headers: { "Content-Type": "application/json" },
  });

  client.interceptors.request.use(async (config) => {
    const token = await getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        // Will be handled by auth gate — Clerk session expired
        console.warn("[API] 401 — session may have expired");
      }
      return Promise.reject(error);
    },
  );

  return client;
}
