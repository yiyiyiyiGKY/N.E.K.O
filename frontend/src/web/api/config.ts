/**
 * Config API Service
 *
 * Handles configuration-related API calls for ApiKeySettings page.
 * Backend router: main_routers/config_router.py
 */

import apiClient from "./client";

// ==================== Types ====================

export type ApiProvider = "free" | "ali" | "glm" | "step" | "silicon" | "openai" | "gemini";

export interface CoreConfig {
  api_key: string;
  coreApi: string;
  assistApi: string;
  assistApiKeyQwen: string;
  assistApiKeyOpenai: string;
  assistApiKeyGlm: string;
  assistApiKeyStep: string;
  assistApiKeySilicon: string;
  assistApiKeyGemini: string;
  mcpToken: string;
  enableCustomApi: boolean;
  // Custom API configurations
  summaryModelProvider: string;
  summaryModelUrl: string;
  summaryModelId: string;
  summaryModelApiKey: string;
  correctionModelProvider: string;
  correctionModelUrl: string;
  correctionModelId: string;
  correctionModelApiKey: string;
  emotionModelProvider: string;
  emotionModelUrl: string;
  emotionModelId: string;
  emotionModelApiKey: string;
  visionModelProvider: string;
  visionModelUrl: string;
  visionModelId: string;
  visionModelApiKey: string;
  agentModelProvider: string;
  agentModelUrl: string;
  agentModelId: string;
  agentModelApiKey: string;
  omniModelProvider: string;
  omniModelUrl: string;
  omniModelId: string;
  omniModelApiKey: string;
  ttsModelProvider: string;
  ttsModelUrl: string;
  ttsModelId: string;
  ttsModelApiKey: string;
  ttsVoiceId: string;
  success?: boolean;
}

export interface CoreConfigUpdateRequest {
  coreApiKey?: string;
  coreApi?: string;
  assistApi?: string;
  assistApiKeyQwen?: string;
  assistApiKeyOpenai?: string;
  assistApiKeyGlm?: string;
  assistApiKeyStep?: string;
  assistApiKeySilicon?: string;
  assistApiKeyGemini?: string;
  mcpToken?: string;
  enableCustomApi?: boolean;
  // Custom API configurations (optional)
  summaryModelProvider?: string;
  summaryModelUrl?: string;
  summaryModelId?: string;
  summaryModelApiKey?: string;
  correctionModelProvider?: string;
  correctionModelUrl?: string;
  correctionModelId?: string;
  correctionModelApiKey?: string;
  emotionModelProvider?: string;
  emotionModelUrl?: string;
  emotionModelId?: string;
  emotionModelApiKey?: string;
  visionModelProvider?: string;
  visionModelUrl?: string;
  visionModelId?: string;
  visionModelApiKey?: string;
  agentModelProvider?: string;
  agentModelUrl?: string;
  agentModelId?: string;
  agentModelApiKey?: string;
  omniModelProvider?: string;
  omniModelUrl?: string;
  omniModelId?: string;
  omniModelApiKey?: string;
  ttsModelProvider?: string;
  ttsModelUrl?: string;
  ttsModelId?: string;
  ttsModelApiKey?: string;
  ttsVoiceId?: string;
}

export interface ApiProviderInfo {
  id: string;
  name: string;
  description?: string;
}

export interface ApiProvidersResponse {
  success: boolean;
  core_api_providers: ApiProviderInfo[];
  assist_api_providers: ApiProviderInfo[];
  error?: string;
}

export interface SaveConfigResponse {
  success: boolean;
  message?: string;
  error?: string;
  sessions_ended?: number;
}

// ==================== API Functions ====================

/**
 * Get core API configuration
 * GET /api/config/core_api
 */
export async function getCoreConfig(): Promise<CoreConfig> {
  return apiClient.get("/config/core_api");
}

/**
 * Update core API configuration
 * POST /api/config/core_api
 */
export async function updateCoreConfig(data: CoreConfigUpdateRequest): Promise<SaveConfigResponse> {
  return apiClient.post("/config/core_api", data);
}

/**
 * Get available API providers
 * GET /api/config/api_providers
 */
export async function getApiProviders(): Promise<ApiProvidersResponse> {
  return apiClient.get("/config/api_providers");
}

/**
 * Get user preferences
 * GET /api/config/preferences
 */
export async function getPreferences(): Promise<Record<string, unknown>> {
  return apiClient.get("/config/preferences");
}

/**
 * Save user preferences
 * POST /api/config/preferences
 */
export async function savePreferences(preferences: Record<string, unknown>): Promise<{ success: boolean; message?: string; error?: string }> {
  return apiClient.post("/config/preferences", preferences);
}
