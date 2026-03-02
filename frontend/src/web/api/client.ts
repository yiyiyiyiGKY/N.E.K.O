/**
 * API Client Configuration
 *
 * Unified API client for the React web frontend.
 * Uses @project_neko/request library with pre-configured settings.
 */

import { createRequestClient, WebTokenStorage } from "@project_neko/request";
import type { AxiosInstance } from "axios";

// Token refresh is not currently used in this app, but we provide a stub
const refreshApi = async (refreshToken: string) => {
  // If refresh is needed in the future, implement the actual API call here
  throw new Error("Token refresh not implemented");
};

// Check if in development mode
const isDev = typeof import.meta !== "undefined" && (import.meta as any).env?.DEV;

/**
 * Create the main API client instance
 *
 * Configuration:
 * - baseURL: "/api" (relative to current domain)
 * - timeout: 30 seconds
 * - Automatic Bearer token injection
 * - Response data extraction (returns response.data directly)
 */
const apiClient: AxiosInstance = createRequestClient({
  baseURL: "/api",
  storage: new WebTokenStorage(),
  refreshApi,
  timeout: 30000,
  returnDataOnly: true,
  logEnabled: isDev ?? false,
});

export default apiClient;

// Re-export commonly used types
export type { AxiosInstance, AxiosError } from "axios";
