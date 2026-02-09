import { apiClient } from '@acolyte/api-client';
import { useAuth } from '@clerk/nextjs';

/**
 * Initialize the API client with Clerk token provider.
 * Call this in a client component or layout that has access to Clerk.
 */
export function useApiClient() {
  const { getToken } = useAuth();

  apiClient.setTokenProvider(async () => {
    return getToken();
  });

  return apiClient;
}

export { apiClient };
