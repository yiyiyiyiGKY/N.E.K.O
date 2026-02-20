/**
 * Models API Service
 *
 * Handles model-related API calls for ModelManager, Live2D, and VRM pages.
 * Backend routers: main_routers/live2d_router.py, main_routers/vrm_router.py
 */

import apiClient from "./client";

// ==================== Types ====================

export interface Live2DModel {
  name: string;
  path: string;
  item_id?: string;
  source?: "local" | "steam_workshop";
}

export interface Live2DModelsResponse {
  models: Live2DModel[];
  error?: string;
}

export interface VRMModel {
  name: string;
  path: string;
  url?: string;
}

export interface VRMModelsResponse {
  models: VRMModel[];
  error?: string;
}

export interface VRMExpression {
  name: string;
  preset?: string;
}

export interface VRMExpressionsResponse {
  expressions: VRMExpression[];
  error?: string;
}

export interface EmotionMapping {
  [emotion: string]: string[]; // emotion -> array of expression/motion names
}

// Live2D specific mapping with separate motions and expressions
export interface Live2DEmotionMapping {
  motions: { [emotion: string]: string[] };
  expressions: { [emotion: string]: string[] };
}

export interface EmotionMappingResponse {
  mapping: EmotionMapping | Live2DEmotionMapping;
  error?: string;
}

export interface SaveEmotionMappingRequest {
  mapping: EmotionMapping | Live2DEmotionMapping;
}

export interface SaveEmotionMappingResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface MotionFile {
  name: string;
  path: string;
  group?: string;
}

export interface ExpressionFile {
  name: string;
  path: string;
}

export interface ModelFilesResponse {
  motions: MotionFile[];
  expressions: ExpressionFile[];
  error?: string;
}

export interface Live2DParameter {
  id: string;
  group?: string;
  min?: number;
  max?: number;
  default?: number;
}

export interface Live2DParametersResponse {
  parameters: Live2DParameter[];
  error?: string;
}

export interface SaveParametersRequest {
  parameters: Record<string, number>;
}

export interface SaveParametersResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// ==================== Live2D API Functions ====================

/**
 * Get list of Live2D models
 * GET /api/live2d/models
 */
export async function getLive2DModels(simple: boolean = true): Promise<Live2DModelsResponse> {
  return apiClient.get("/live2d/models", {
    params: { simple },
  });
}

/**
 * Get model files (motions and expressions)
 * GET /api/live2d/model_files/:name
 */
export async function getLive2DModelFiles(modelName: string): Promise<ModelFilesResponse> {
  return apiClient.get(`/live2d/model_files/${encodeURIComponent(modelName)}`);
}

/**
 * Get emotion mapping for a model
 * GET /api/live2d/emotion_mapping/:name
 */
export async function getLive2DEmotionMapping(modelName: string): Promise<EmotionMappingResponse> {
  return apiClient.get(`/live2d/emotion_mapping/${encodeURIComponent(modelName)}`);
}

/**
 * Save emotion mapping for a model
 * POST /api/live2d/emotion_mapping/:name
 */
export async function saveLive2DEmotionMapping(
  modelName: string,
  mapping: EmotionMapping | Live2DEmotionMapping
): Promise<SaveEmotionMappingResponse> {
  return apiClient.post(`/live2d/emotion_mapping/${encodeURIComponent(modelName)}`, { mapping });
}

/**
 * Get Live2D model parameters
 * GET /api/live2d/models/:id/parameters
 */
export async function getLive2DParameters(modelName: string): Promise<Live2DParametersResponse> {
  return apiClient.get(`/live2d/models/${encodeURIComponent(modelName)}/parameters`);
}

/**
 * Save Live2D model parameters
 * POST /api/live2d/models/:id/parameters
 */
export async function saveLive2DParameters(
  modelName: string,
  parameters: Record<string, number>
): Promise<SaveParametersResponse> {
  return apiClient.post(`/live2d/models/${encodeURIComponent(modelName)}/parameters`, { parameters });
}

// ==================== VRM API Functions ====================

/**
 * Get list of VRM models
 * GET /api/model/vrm/
 */
export async function getVRMModels(): Promise<VRMModelsResponse> {
  return apiClient.get("/model/vrm/");
}

/**
 * Get VRM expressions
 * GET /api/model/vrm/expressions/:name
 */
export async function getVRMExpressions(modelName: string): Promise<VRMExpressionsResponse> {
  return apiClient.get(`/model/vrm/expressions/${encodeURIComponent(modelName)}`);
}

/**
 * Get VRM emotion mapping
 * GET /api/model/vrm/emotion_mapping/:name
 */
export async function getVRMEmotionMapping(modelName: string): Promise<EmotionMappingResponse> {
  return apiClient.get(`/model/vrm/emotion_mapping/${encodeURIComponent(modelName)}`);
}

/**
 * Save VRM emotion mapping
 * POST /api/model/vrm/emotion_mapping/:name
 */
export async function saveVRMEmotionMapping(
  modelName: string,
  mapping: EmotionMapping
): Promise<SaveEmotionMappingResponse> {
  return apiClient.post(`/model/vrm/emotion_mapping/${encodeURIComponent(modelName)}`, { mapping });
}

/**
 * Upload VRM model
 * POST /api/model/vrm/upload
 */
export async function uploadVRMModel(file: File): Promise<{ success: boolean; name?: string; error?: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/model/vrm/upload", {
    method: "POST",
    body: formData,
  });

  return response.json();
}

/**
 * Delete VRM model
 * DELETE /api/model/vrm/:name
 */
export async function deleteVRMModel(modelName: string): Promise<{ success: boolean; error?: string }> {
  return apiClient.delete(`/model/vrm/${encodeURIComponent(modelName)}`);
}
