/**
 * Voice API Service
 *
 * Handles voice-related API calls for VoiceClone page.
 * Backend router: main_routers/characters_router.py (voice endpoints)
 */

import apiClient from "./client";

// ==================== Types ====================

export interface VoiceInfo {
  voice_id: string;
  prefix?: string;
  file_url?: string;
  created_at?: string;
  is_local?: boolean;
}

export interface VoicesResponse {
  voices: Record<string, VoiceInfo>;
  free_voices?: Record<string, VoiceInfo>;
}

export interface VoiceCloneResponse {
  voice_id: string;
  message?: string;
  request_id?: string;
  file_url?: string;
  is_local?: boolean;
  error?: string;
}

export interface VoicePreviewResponse {
  success: boolean;
  audio?: string; // Base64 encoded audio
  mime_type?: string;
  error?: string;
}

export interface DeleteVoiceResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// ==================== API Functions ====================

/**
 * Get all registered voices for current API
 * GET /api/characters/voices
 */
export async function getVoices(): Promise<VoicesResponse> {
  return apiClient.get("/characters/voices");
}

/**
 * Clone voice from audio file
 * POST /api/characters/voice_clone
 *
 * Note: This uses FormData for file upload
 */
export async function cloneVoice(
  file: File,
  prefix: string,
  refLanguage: string = "ch"
): Promise<VoiceCloneResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("prefix", prefix);
  formData.append("ref_language", refLanguage);

  // Use fetch directly for multipart/form-data
  const response = await fetch("/api/characters/voice_clone", {
    method: "POST",
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Voice clone failed with status ${response.status}`);
  }

  return data;
}

/**
 * Delete a registered voice
 * DELETE /api/characters/voices/:voice_id
 */
export async function deleteVoice(voiceId: string): Promise<DeleteVoiceResponse> {
  return apiClient.delete(`/characters/voices/${encodeURIComponent(voiceId)}`);
}

/**
 * Get voice preview audio
 * GET /api/characters/voice_preview?voice_id=:voice_id
 */
export async function getVoicePreview(voiceId: string): Promise<VoicePreviewResponse> {
  return apiClient.get("/characters/voice_preview", {
    params: { voice_id: voiceId },
  });
}

/**
 * Register a voice (save voice data after external registration)
 * POST /api/characters/voices
 */
export async function registerVoice(voiceId: string, voiceData: Partial<VoiceInfo>): Promise<{ success: boolean; message?: string; error?: string }> {
  return apiClient.post("/characters/voices", {
    voice_id: voiceId,
    voice_data: voiceData,
  });
}
