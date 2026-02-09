import { apiClient } from '@acolyte/api-client';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

// Mobile-specific API client configuration
// Token provider is set in the root layout after Clerk auth
export { apiClient };
