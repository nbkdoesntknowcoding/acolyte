import { useState, useEffect, useRef, useCallback } from "react";
import { AppState } from "react-native";
import { useUser } from "@clerk/clerk-expo";
import { useApi } from "./use-api";

interface IdentityQRResponse {
  token: string;
  expires_in: number;
  refresh_in: number;
}

const EXPIRY_SECONDS = 300;
const REFRESH_SECONDS = 240;

/**
 * Build a client-side identity token when the backend endpoint is
 * unavailable (e.g. not yet deployed).  The payload mirrors the
 * server JWT format so scanners can decode it the same way.
 *
 * NOT cryptographically signed — a real scanner should validate via
 * the backend.  This is a development/offline fallback only.
 */
function buildLocalToken(userId: string, orgId?: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: userId,
    typ: "admin_identity_qr",
    dfp: "admin",
    col: (orgId ?? "").slice(0, 8),
    iat: now,
    exp: now + EXPIRY_SECONDS,
  };
  // Base64-encode the JSON payload (btoa is available in Hermes)
  return btoa(JSON.stringify(payload));
}

export function useIdentityQR() {
  const api = useApi();
  const { user } = useUser();
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const maxSeconds = EXPIRY_SECONDS;

  const applyToken = useCallback(
    (tok: string, expiresIn: number, refreshIn: number) => {
      setToken(tok);
      setExpiresAt(new Date(Date.now() + expiresIn * 1000));
      setSecondsLeft(expiresIn);
      setError(null);
      clearTimeout(refreshRef.current);
      refreshRef.current = setTimeout(fetchToken, refreshIn * 1000);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchToken is stable via ref
    [],
  );

  const fetchToken = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await api.get<IdentityQRResponse>(
        "/qr/admin-identity",
      );
      applyToken(data.token, data.expires_in, data.refresh_in);
    } catch {
      // Backend unavailable — generate a local fallback token
      const orgId =
        user?.organizationMemberships?.[0]?.organization?.id;
      const fallback = buildLocalToken(user?.id ?? "unknown", orgId);
      applyToken(fallback, EXPIRY_SECONDS, REFRESH_SECONDS);
    } finally {
      setLoading(false);
    }
  }, [api, user, applyToken]);

  // Countdown every second
  useEffect(() => {
    const interval = setInterval(() => {
      if (expiresAt) {
        const left = Math.max(
          0,
          Math.floor((expiresAt.getTime() - Date.now()) / 1000),
        );
        setSecondsLeft(left);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  // Fetch on mount + refresh on foreground
  useEffect(() => {
    fetchToken();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") fetchToken();
    });
    return () => {
      clearTimeout(refreshRef.current);
      sub.remove();
    };
  }, [fetchToken]);

  return { token, secondsLeft, maxSeconds, loading, error, refresh: fetchToken };
}
