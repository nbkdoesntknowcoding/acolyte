import { useRef } from "react";
import { useAuth } from "@clerk/clerk-expo";
import { createAuthClient } from "@/lib/api/client";

/**
 * Hook that returns a stable, Clerk-authenticated Axios instance.
 *
 * Token is fetched on every request via the interceptor so it's
 * always fresh. The client ref is stable across re-renders.
 */
export function useApi() {
  const { getToken } = useAuth();
  const apiRef = useRef(createAuthClient(getToken));
  return apiRef.current;
}
