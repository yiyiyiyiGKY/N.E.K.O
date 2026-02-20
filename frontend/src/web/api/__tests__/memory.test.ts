/**
 * Memory API Tests
 *
 * Tests for memory management API functions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import apiClient from "../client";

// Mock the apiClient
vi.mock("../client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Import after mocking
import {
  getRecentFiles,
  getRecentFile,
  saveRecentFile,
  getReviewConfig,
  updateReviewConfig,
  updateCatgirlNameInMemories,
} from "../memory";

describe("Memory API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getRecentFiles", () => {
    it("should call GET /memory/recent_files", async () => {
      const mockFiles = {
        files: [
          { name: "memory1.json", path: "/path/to/memory1.json", size: 1024 },
          { name: "memory2.json", path: "/path/to/memory2.json", size: 2048 },
        ],
      };
      vi.mocked(apiClient.get).mockResolvedValue(mockFiles);

      const result = await getRecentFiles();

      expect(apiClient.get).toHaveBeenCalledWith("/memory/recent_files");
      expect(result.files).toHaveLength(2);
      expect(result.files[0].name).toBe("memory1.json");
    });

    it("should return error on failure", async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ files: [], error: "Not found" });

      const result = await getRecentFiles();

      expect(result.error).toBe("Not found");
    });
  });

  describe("getRecentFile", () => {
    it("should call GET /memory/recent_file with name param", async () => {
      const mockContent = {
        content: { memories: ["test memory"] },
        name: "memory1.json",
      };
      vi.mocked(apiClient.get).mockResolvedValue(mockContent);

      const result = await getRecentFile("memory1.json");

      expect(apiClient.get).toHaveBeenCalledWith("/memory/recent_file", {
        params: { name: "memory1.json" },
      });
      expect(result.name).toBe("memory1.json");
    });
  });

  describe("saveRecentFile", () => {
    it("should call POST /memory/recent_file/save", async () => {
      const content = { memories: ["new memory"] };
      vi.mocked(apiClient.post).mockResolvedValue({ success: true, message: "Saved" });

      const result = await saveRecentFile("memory1.json", content);

      expect(apiClient.post).toHaveBeenCalledWith("/memory/recent_file/save", {
        name: "memory1.json",
        content,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("getReviewConfig", () => {
    it("should call GET /memory/review_config", async () => {
      const mockConfig = { config: { auto_review: true, interval: 3600 } };
      vi.mocked(apiClient.get).mockResolvedValue(mockConfig);

      const result = await getReviewConfig();

      expect(apiClient.get).toHaveBeenCalledWith("/memory/review_config");
      expect(result.config.auto_review).toBe(true);
    });
  });

  describe("updateReviewConfig", () => {
    it("should call POST /memory/review_config", async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ success: true });

      const config = { auto_review: false };
      const result = await updateReviewConfig(config);

      expect(apiClient.post).toHaveBeenCalledWith("/memory/review_config", config);
      expect(result.success).toBe(true);
    });
  });

  describe("updateCatgirlNameInMemories", () => {
    it("should call POST /memory/update_catgirl_name", async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ success: true, message: "Updated" });

      const result = await updateCatgirlNameInMemories("old_name", "new_name");

      expect(apiClient.post).toHaveBeenCalledWith("/memory/update_catgirl_name", {
        old_name: "old_name",
        new_name: "new_name",
      });
      expect(result.success).toBe(true);
    });
  });
});
