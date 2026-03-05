/**
 * Characters API Service
 *
 * Handles character management API calls for CharacterManager page.
 * Backend router: main_routers/characters_router.py
 */

import apiClient from "./client";

// ==================== Types ====================

export interface MasterProfile {
  档案名: string;
  昵称?: string;
  性别?: string;
  年龄?: string;
  性格?: string;
}

export interface CatgirlProfile {
  档案名?: string;
  昵称?: string;
  性别?: string;
  年龄?: string;
  性格?: string;
  背景故事?: string;
  system_prompt?: string;
  live2d?: string;
  live2d_item_id?: string;
  model_type?: "live2d" | "vrm";
  vrm?: string;
  vrm_animation?: string;
  voice_id?: string;
}

export interface CharactersData {
  主人: MasterProfile;
  猫娘: Record<string, CatgirlProfile>;
  当前猫娘?: string;
  当前麦克风?: string;
}

export interface Live2DModelInfo {
  name: string;
  path: string;
  item_id?: string;
  source?: string;
  is_fallback?: boolean;
}

export interface Live2DModelResponse {
  success: boolean;
  catgirl_name: string;
  model_name: string;
  model_info: Live2DModelInfo | null;
  error?: string;
}

export interface ApiResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface CatgirlUpdateResponse extends ApiResponse {
  voice_id_changed?: boolean;
  session_restarted?: boolean;
}

export interface CatgirlRenameRequest {
  new_name: string;
}

// ==================== API Functions ====================

/**
 * Get all characters data (master + catgirls)
 * GET /api/characters/
 */
export async function getCharacters(language?: string): Promise<CharactersData> {
  const params = language ? { language } : {};
  return apiClient.get("/characters/", { params });
}

/**
 * Update master profile
 * POST /api/characters/master
 */
export async function updateMaster(profile: MasterProfile): Promise<ApiResponse> {
  return apiClient.post("/characters/master", profile);
}

/**
 * Add new catgirl
 * POST /api/characters/catgirl
 */
export async function addCatgirl(profile: CatgirlProfile): Promise<ApiResponse> {
  return apiClient.post("/characters/catgirl", profile);
}

/**
 * Update catgirl profile
 * PUT /api/characters/catgirl/:name
 */
export async function updateCatgirl(name: string, profile: Partial<CatgirlProfile>): Promise<CatgirlUpdateResponse> {
  return apiClient.put(`/characters/catgirl/${encodeURIComponent(name)}`, profile);
}

/**
 * Delete catgirl
 * DELETE /api/characters/catgirl/:name
 */
export async function deleteCatgirl(name: string): Promise<ApiResponse> {
  return apiClient.delete(`/characters/catgirl/${encodeURIComponent(name)}`);
}

/**
 * Rename catgirl
 * POST /api/characters/catgirl/:old_name/rename
 */
export async function renameCatgirl(oldName: string, newName: string): Promise<ApiResponse> {
  return apiClient.post(`/characters/catgirl/${encodeURIComponent(oldName)}/rename`, {
    new_name: newName,
  });
}

/**
 * Get current catgirl name
 * GET /api/characters/current_catgirl
 */
export async function getCurrentCatgirl(): Promise<{ current_catgirl: string }> {
  return apiClient.get("/characters/current_catgirl");
}

/**
 * Set current catgirl
 * POST /api/characters/current_catgirl
 */
export async function setCurrentCatgirl(catgirlName: string): Promise<ApiResponse> {
  return apiClient.post("/characters/current_catgirl", { catgirl_name: catgirlName });
}

/**
 * Get current Live2D model for a catgirl
 * GET /api/characters/current_live2d_model
 */
export async function getLive2DModel(catgirlName?: string, itemId?: string): Promise<Live2DModelResponse> {
  const params: Record<string, string> = {};
  if (catgirlName) params.catgirl_name = catgirlName;
  if (itemId) params.item_id = itemId;
  return apiClient.get("/characters/current_live2d_model", { params });
}

/**
 * Update catgirl's Live2D/VRM model
 * PUT /api/characters/catgirl/l2d/:name
 */
export async function updateCatgirlModel(
  name: string,
  data: {
    live2d?: string;
    vrm?: string;
    model_type?: "live2d" | "vrm";
    item_id?: string;
    vrm_animation?: string;
  }
): Promise<ApiResponse> {
  return apiClient.put(`/characters/catgirl/l2d/${encodeURIComponent(name)}`, data);
}

/**
 * Update catgirl's voice ID
 * PUT /api/characters/catgirl/voice_id/:name
 */
export async function updateCatgirlVoiceId(name: string, voiceId: string): Promise<ApiResponse> {
  return apiClient.put(`/characters/catgirl/voice_id/${encodeURIComponent(name)}`, { voice_id: voiceId });
}

/**
 * Unregister catgirl's voice
 * POST /api/characters/catgirl/:name/unregister_voice
 */
export async function unregisterCatgirlVoice(name: string): Promise<ApiResponse> {
  return apiClient.post(`/characters/catgirl/${encodeURIComponent(name)}/unregister_voice`);
}

/**
 * Get catgirl voice mode status
 * GET /api/characters/catgirl/:name/voice_mode_status
 */
export async function getCatgirlVoiceModeStatus(name: string): Promise<{
  is_voice_mode: boolean;
  is_current: boolean;
  is_active: boolean;
}> {
  return apiClient.get(`/characters/catgirl/${encodeURIComponent(name)}/voice_mode_status`);
}

/**
 * Reload character configuration
 * POST /api/characters/reload
 */
export async function reloadCharacters(): Promise<ApiResponse> {
  return apiClient.post("/characters/reload");
}

/**
 * Set microphone
 * POST /api/characters/set_microphone
 */
export async function setMicrophone(microphoneId: string): Promise<ApiResponse> {
  return apiClient.post("/characters/set_microphone", { microphone_id: microphoneId });
}

/**
 * Get microphone
 * GET /api/characters/get_microphone
 */
export async function getMicrophone(): Promise<{ microphone_id: string | null }> {
  return apiClient.get("/characters/get_microphone");
}

/**
 * Clear all voice IDs
 * POST /api/characters/clear_voice_ids
 */
export async function clearAllVoiceIds(): Promise<ApiResponse & { cleared_count?: number }> {
  return apiClient.post("/characters/clear_voice_ids");
}
