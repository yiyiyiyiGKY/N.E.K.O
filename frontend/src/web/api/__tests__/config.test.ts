/**
 * Config API Tests
 *
 * Tests for configuration API functions.
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
  getCoreConfig,
  updateCoreConfig,
  getApiProviders,
  getPreferences,
  savePreferences,
} from "../config";

describe("Config API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCoreConfig", () => {
    it("should call GET /config/core_api", async () => {
      const mockConfig = {
        api_key: "test-key",
        coreApi: "ali",
        assistApi: "free",
        assistApiKeyQwen: "",
        assistApiKeyOpenai: "",
        assistApiKeyGlm: "",
        assistApiKeyStep: "",
        assistApiKeySilicon: "",
        assistApiKeyGemini: "",
        mcpToken: "",
        enableCustomApi: false,
        summaryModelProvider: "",
        summaryModelUrl: "",
        summaryModelId: "",
        summaryModelApiKey: "",
        correctionModelProvider: "",
        correctionModelUrl: "",
        correctionModelId: "",
        correctionModelApiKey: "",
        emotionModelProvider: "",
        emotionModelUrl: "",
        emotionModelId: "",
        emotionModelApiKey: "",
        visionModelProvider: "",
        visionModelUrl: "",
        visionModelId: "",
        visionModelApiKey: "",
        agentModelProvider: "",
        agentModelUrl: "",
        agentModelId: "",
        agentModelApiKey: "",
        omniModelProvider: "",
        omniModelUrl: "",
        omniModelId: "",
        omniModelApiKey: "",
        ttsModelProvider: "",
        ttsModelUrl: "",
        ttsModelId: "",
        ttsModelApiKey: "",
        ttsVoiceId: "",
      };
      vi.mocked(apiClient.get).mockResolvedValue(mockConfig);

      const result = await getCoreConfig();

      expect(apiClient.get).toHaveBeenCalledWith("/config/core_api");
      expect(result.api_key).toBe("test-key");
      expect(result.coreApi).toBe("ali");
    });
  });

  describe("updateCoreConfig", () => {
    it("should call POST /config/core_api", async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ success: true, message: "Saved" });

      const data = {
        coreApiKey: "new-key",
        coreApi: "openai",
      };
      const result = await updateCoreConfig(data);

      expect(apiClient.post).toHaveBeenCalledWith("/config/core_api", data);
      expect(result.success).toBe(true);
    });

    it("should handle error response", async () => {
      vi.mocked(apiClient.post).mockResolvedValue({
        success: false,
        error: "Invalid API key",
      });

      const result = await updateCoreConfig({ coreApiKey: "invalid" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid API key");
    });
  });

  describe("getApiProviders", () => {
    it("should call GET /config/api_providers", async () => {
      const mockProviders = {
        success: true,
        core_api_providers: [
          { id: "free", name: "Free" },
          { id: "ali", name: "Alibaba" },
        ],
        assist_api_providers: [
          { id: "free", name: "Free" },
          { id: "glm", name: "GLM" },
        ],
      };
      vi.mocked(apiClient.get).mockResolvedValue(mockProviders);

      const result = await getApiProviders();

      expect(apiClient.get).toHaveBeenCalledWith("/config/api_providers");
      expect(result.core_api_providers).toHaveLength(2);
      expect(result.assist_api_providers).toHaveLength(2);
    });
  });

  describe("getPreferences", () => {
    it("should call GET /config/preferences", async () => {
      const mockPrefs = {
        theme: "dark",
        language: "zh-CN",
      };
      vi.mocked(apiClient.get).mockResolvedValue(mockPrefs);

      const result = await getPreferences();

      expect(apiClient.get).toHaveBeenCalledWith("/config/preferences");
      expect(result.theme).toBe("dark");
    });
  });

  describe("savePreferences", () => {
    it("should call POST /config/preferences", async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ success: true });

      const prefs = { theme: "light", language: "en" };
      const result = await savePreferences(prefs);

      expect(apiClient.post).toHaveBeenCalledWith("/config/preferences", prefs);
      expect(result.success).toBe(true);
    });
  });
});
