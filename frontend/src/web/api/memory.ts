/**
 * Memory API Service
 *
 * Handles memory-related API calls for MemoryBrowser page.
 * Backend router: main_routers/memory_router.py
 */

import apiClient from "./client";

// ==================== Types ====================

export interface MemoryFile {
  name: string;
  path: string;
  size?: number;
  modified?: string;
}

export interface RecentFilesResponse {
  files: MemoryFile[];
  error?: string;
}

export interface MemoryContent {
  [key: string]: any;
}

export interface RecentFileResponse {
  content: MemoryContent;
  name: string;
  error?: string;
}

export interface SaveMemoryRequest {
  name: string;
  content: MemoryContent;
}

export interface SaveMemoryResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface ReviewConfig {
  auto_review: boolean;
  interval?: number;
  [key: string]: any;
}

export interface ReviewConfigResponse {
  config: ReviewConfig;
  error?: string;
}

export interface UpdateCatgirlNameRequest {
  old_name: string;
  new_name: string;
}

// ==================== API Functions ====================

/**
 * Get list of recent memory files
 * GET /api/memory/recent_files
 */
export async function getRecentFiles(): Promise<RecentFilesResponse> {
  return apiClient.get("/memory/recent_files");
}

/**
 * Get specific memory file content
 * GET /api/memory/recent_file?name=:name
 */
export async function getRecentFile(name: string): Promise<RecentFileResponse> {
  return apiClient.get("/memory/recent_file", {
    params: { name },
  });
}

/**
 * Save memory file content
 * POST /api/memory/recent_file/save
 */
export async function saveRecentFile(name: string, content: MemoryContent): Promise<SaveMemoryResponse> {
  return apiClient.post("/memory/recent_file/save", {
    name,
    content,
  });
}

/**
 * Get review configuration
 * GET /api/memory/review_config
 */
export async function getReviewConfig(): Promise<ReviewConfigResponse> {
  return apiClient.get("/memory/review_config");
}

/**
 * Update review configuration
 * POST /api/memory/review_config
 */
export async function updateReviewConfig(config: Partial<ReviewConfig>): Promise<SaveMemoryResponse> {
  return apiClient.post("/memory/review_config", config);
}

/**
 * Update catgirl name in memories
 * POST /api/memory/update_catgirl_name
 */
export async function updateCatgirlNameInMemories(oldName: string, newName: string): Promise<SaveMemoryResponse> {
  return apiClient.post("/memory/update_catgirl_name", {
    old_name: oldName,
    new_name: newName,
  });
}
