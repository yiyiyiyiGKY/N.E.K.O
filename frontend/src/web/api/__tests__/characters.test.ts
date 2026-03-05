/**
 * Characters API Tests
 *
 * Tests for character management API functions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import apiClient from "../client";

// Mock the apiClient
vi.mock("../client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// Import after mocking
import {
  getCharacters,
  updateMaster,
  addCatgirl,
  updateCatgirl,
  deleteCatgirl,
  renameCatgirl,
  getCurrentCatgirl,
  setCurrentCatgirl,
  getLive2DModel,
  updateCatgirlModel,
  updateCatgirlVoiceId,
  unregisterCatgirlVoice,
  getCatgirlVoiceModeStatus,
  reloadCharacters,
  setMicrophone,
  getMicrophone,
  clearAllVoiceIds,
} from "../characters";

describe("Characters API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getCharacters", () => {
    it("should call GET /characters/", async () => {
      const mockData = {
        主人: { 档案名: "Test" },
        猫娘: { yui: { 昵称: "Yui" } },
      };
      vi.mocked(apiClient.get).mockResolvedValue(mockData);

      const result = await getCharacters();

      expect(apiClient.get).toHaveBeenCalledWith("/characters/", { params: {} });
      expect(result).toEqual(mockData);
    });

    it("should pass language parameter", async () => {
      vi.mocked(apiClient.get).mockResolvedValue({});

      await getCharacters("en");

      expect(apiClient.get).toHaveBeenCalledWith("/characters/", { params: { language: "en" } });
    });
  });

  describe("updateMaster", () => {
    it("should call POST /characters/master", async () => {
      const profile = { 档案名: "Master" };
      vi.mocked(apiClient.post).mockResolvedValue({ success: true });

      const result = await updateMaster(profile);

      expect(apiClient.post).toHaveBeenCalledWith("/characters/master", profile);
      expect(result).toEqual({ success: true });
    });
  });

  describe("addCatgirl", () => {
    it("should call POST /characters/catgirl", async () => {
      const profile = { 档案名: "NewCatgirl", 昵称: "NC" };
      vi.mocked(apiClient.post).mockResolvedValue({ success: true });

      const result = await addCatgirl(profile);

      expect(apiClient.post).toHaveBeenCalledWith("/characters/catgirl", profile);
      expect(result).toEqual({ success: true });
    });
  });

  describe("updateCatgirl", () => {
    it("should call PUT /characters/catgirl/:name with encoded name", async () => {
      const profile = { 昵称: "Updated" };
      vi.mocked(apiClient.put).mockResolvedValue({ success: true });

      const result = await updateCatgirl("test catgirl", profile);

      expect(apiClient.put).toHaveBeenCalledWith("/characters/catgirl/test%20catgirl", profile);
      expect(result).toEqual({ success: true });
    });
  });

  describe("deleteCatgirl", () => {
    it("should call DELETE /characters/catgirl/:name", async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({ success: true });

      const result = await deleteCatgirl("yui");

      expect(apiClient.delete).toHaveBeenCalledWith("/characters/catgirl/yui");
      expect(result).toEqual({ success: true });
    });

    it("should encode special characters in name", async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({ success: true });

      await deleteCatgirl("test name");

      expect(apiClient.delete).toHaveBeenCalledWith("/characters/catgirl/test%20name");
    });
  });

  describe("renameCatgirl", () => {
    it("should call POST /characters/catgirl/:old_name/rename", async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ success: true });

      const result = await renameCatgirl("old name", "new name");

      expect(apiClient.post).toHaveBeenCalledWith("/characters/catgirl/old%20name/rename", {
        new_name: "new name",
      });
      expect(result).toEqual({ success: true });
    });
  });

  describe("getCurrentCatgirl", () => {
    it("should call GET /characters/current_catgirl", async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ current_catgirl: "yui" });

      const result = await getCurrentCatgirl();

      expect(apiClient.get).toHaveBeenCalledWith("/characters/current_catgirl");
      expect(result).toEqual({ current_catgirl: "yui" });
    });
  });

  describe("setCurrentCatgirl", () => {
    it("should call POST /characters/current_catgirl", async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ success: true });

      const result = await setCurrentCatgirl("miku");

      expect(apiClient.post).toHaveBeenCalledWith("/characters/current_catgirl", {
        catgirl_name: "miku",
      });
      expect(result).toEqual({ success: true });
    });
  });

  describe("getLive2DModel", () => {
    it("should call GET /characters/current_live2d_model without params", async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ success: true, catgirl_name: "yui", model_name: "yui", model_info: null });

      const result = await getLive2DModel();

      expect(apiClient.get).toHaveBeenCalledWith("/characters/current_live2d_model", { params: {} });
      expect(result.catgirl_name).toBe("yui");
    });

    it("should pass catgirl_name and item_id params", async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ success: true, catgirl_name: "yui", model_name: "yui", model_info: null });

      await getLive2DModel("yui", "item-123");

      expect(apiClient.get).toHaveBeenCalledWith("/characters/current_live2d_model", {
        params: { catgirl_name: "yui", item_id: "item-123" },
      });
    });
  });

  describe("updateCatgirlModel", () => {
    it("should call PUT /characters/catgirl/l2d/:name", async () => {
      vi.mocked(apiClient.put).mockResolvedValue({ success: true });

      const data = { live2d: "new_model", model_type: "live2d" as const };
      const result = await updateCatgirlModel("yui", data);

      expect(apiClient.put).toHaveBeenCalledWith("/characters/catgirl/l2d/yui", data);
      expect(result).toEqual({ success: true });
    });
  });

  describe("updateCatgirlVoiceId", () => {
    it("should call PUT /characters/catgirl/voice_id/:name", async () => {
      vi.mocked(apiClient.put).mockResolvedValue({ success: true });

      const result = await updateCatgirlVoiceId("yui", "voice-123");

      expect(apiClient.put).toHaveBeenCalledWith("/characters/catgirl/voice_id/yui", {
        voice_id: "voice-123",
      });
      expect(result).toEqual({ success: true });
    });
  });

  describe("unregisterCatgirlVoice", () => {
    it("should call POST /characters/catgirl/:name/unregister_voice", async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ success: true });

      const result = await unregisterCatgirlVoice("yui");

      expect(apiClient.post).toHaveBeenCalledWith("/characters/catgirl/yui/unregister_voice");
      expect(result).toEqual({ success: true });
    });
  });

  describe("getCatgirlVoiceModeStatus", () => {
    it("should call GET /characters/catgirl/:name/voice_mode_status", async () => {
      const mockStatus = { is_voice_mode: true, is_current: true, is_active: false };
      vi.mocked(apiClient.get).mockResolvedValue(mockStatus);

      const result = await getCatgirlVoiceModeStatus("yui");

      expect(apiClient.get).toHaveBeenCalledWith("/characters/catgirl/yui/voice_mode_status");
      expect(result).toEqual(mockStatus);
    });
  });

  describe("reloadCharacters", () => {
    it("should call POST /characters/reload", async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ success: true });

      const result = await reloadCharacters();

      expect(apiClient.post).toHaveBeenCalledWith("/characters/reload");
      expect(result).toEqual({ success: true });
    });
  });

  describe("setMicrophone", () => {
    it("should call POST /characters/set_microphone", async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ success: true });

      const result = await setMicrophone("mic-123");

      expect(apiClient.post).toHaveBeenCalledWith("/characters/set_microphone", {
        microphone_id: "mic-123",
      });
      expect(result).toEqual({ success: true });
    });
  });

  describe("getMicrophone", () => {
    it("should call GET /characters/get_microphone", async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ microphone_id: "mic-123" });

      const result = await getMicrophone();

      expect(apiClient.get).toHaveBeenCalledWith("/characters/get_microphone");
      expect(result).toEqual({ microphone_id: "mic-123" });
    });
  });

  describe("clearAllVoiceIds", () => {
    it("should call POST /characters/clear_voice_ids", async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ success: true, cleared_count: 5 });

      const result = await clearAllVoiceIds();

      expect(apiClient.post).toHaveBeenCalledWith("/characters/clear_voice_ids");
      expect(result).toEqual({ success: true, cleared_count: 5 });
    });
  });
});
