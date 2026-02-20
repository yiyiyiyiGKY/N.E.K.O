/**
 * Character Manager Page
 *
 * Migrated from templates/chara_manager.html
 * Now connected to real backend API
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { ChangeEvent, MouseEvent } from "react";
import { useT, tOrDefault } from "@project_neko/components";
import "./CharacterManager.css";
import {
  getCharacters,
  updateMaster,
  addCatgirl,
  updateCatgirl,
  deleteCatgirl,
  type CharactersData,
  type MasterProfile,
  type CatgirlProfile,
} from "../api/characters";

// Frontend character interface (for UI state)
interface Character {
  id: string;
  name: string;
  nickname?: string;
  gender?: string;
  age?: string;
  personality?: string;
  backstory?: string;
  systemPrompt?: string;
  avatar?: string;
  live2dModel?: string;
  voiceId?: string;
}

// Convert backend CatgirlProfile to frontend Character
function catgirlToCharacter(name: string, profile: CatgirlProfile): Character {
  return {
    id: name,
    name: name,
    nickname: profile.昵称,
    gender: profile.性别,
    age: profile.年龄,
    personality: profile.性格,
    backstory: profile.背景故事,
    systemPrompt: profile.system_prompt,
    live2dModel: profile.live2d,
    voiceId: profile.voice_id,
  };
}

// Convert frontend Character to backend CatgirlProfile
function characterToCatgirl(character: Character): CatgirlProfile {
  const profile: CatgirlProfile = {
    档案名: character.name,
  };
  if (character.nickname) profile.昵称 = character.nickname;
  if (character.gender) profile.性别 = character.gender;
  if (character.age) profile.年龄 = character.age;
  if (character.personality) profile.性格 = character.personality;
  if (character.backstory) profile.背景故事 = character.backstory;
  if (character.systemPrompt) profile.system_prompt = character.systemPrompt;
  if (character.live2dModel) profile.live2d = character.live2dModel;
  if (character.voiceId) profile.voice_id = character.voiceId;
  return profile;
}

// Convert backend MasterProfile to frontend state
function masterToState(profile: MasterProfile): { name: string; nickname?: string; gender?: string } {
  return {
    name: profile.档案名 || "",
    nickname: profile.昵称,
    gender: profile.性别,
  };
}

export default function CharacterManager() {
  const navigate = useNavigate();
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [masterProfile, setMasterProfile] = useState<{ name: string; nickname?: string; gender?: string }>({
    name: "",
  });
  const [catgirls, setCatgirls] = useState<Character[]>([]);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);

  useEffect(() => {
    loadCharacters();
  }, []);

  const loadCharacters = async () => {
    try {
      setLoading(true);
      setError(null);

      const data: CharactersData = await getCharacters();

      // Convert master profile
      setMasterProfile(masterToState(data.主人 || { 档案名: "" }));

      // Convert catgirls
      const catgirlList: Character[] = [];
      if (data.猫娘) {
        for (const [name, profile] of Object.entries(data.猫娘)) {
          catgirlList.push(catgirlToCharacter(name, profile));
        }
      }
      setCatgirls(catgirlList);
    } catch (err) {
      console.error("Failed to load characters:", err);
      setError(tOrDefault(t, "webapp.characterManager.loadFailed", "加载角色数据失败，请刷新页面重试"));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMaster = async () => {
    try {
      setSaving(true);
      setError(null);

      const profile: MasterProfile = {
        档案名: masterProfile.name,
      };
      if (masterProfile.nickname) profile.昵称 = masterProfile.nickname;
      if (masterProfile.gender) profile.性别 = masterProfile.gender;

      const result = await updateMaster(profile);

      if (result.success) {
        alert(tOrDefault(t, "webapp.characterManager.saveSuccess", "保存成功！"));
      } else {
        setError(result.error || tOrDefault(t, "common.error", "保存失败"));
      }
    } catch (err: any) {
      console.error("Failed to save master profile:", err);
      setError(err.message || tOrDefault(t, "common.error", "保存失败"));
    } finally {
      setSaving(false);
    }
  };

  const handleAddCatgirl = () => {
    const newCatgirl: Character = {
      id: "", // Will be set when saving
      name: "",
    };
    setEditingCharacter(newCatgirl);
  };

  const handleSaveCharacter = async (character: Character) => {
    try {
      setSaving(true);
      setError(null);

      // Validate name
      if (!character.name.trim()) {
        setError(tOrDefault(t, "webapp.characterManager.nameRequired", "名称为必填项"));
        return;
      }

      const profile = characterToCatgirl(character);

      let result;
      if (catgirls.find((c) => c.id === character.id && character.id)) {
        // Update existing
        result = await updateCatgirl(character.id, profile);
      } else {
        // Add new
        result = await addCatgirl(profile);
      }

      if (result.success) {
        // Reload to get fresh data
        await loadCharacters();
        setEditingCharacter(null);
        alert(tOrDefault(t, "webapp.characterManager.saveSuccess", "保存成功！"));
      } else {
        setError(result.error || tOrDefault(t, "common.error", "保存失败"));
      }
    } catch (err: any) {
      console.error("Failed to save character:", err);
      setError(err.message || tOrDefault(t, "common.error", "保存失败"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCharacter = async (id: string) => {
    if (!confirm(tOrDefault(t, "webapp.characterManager.confirmDelete", "确定要删除这个角色吗？"))) return;

    try {
      setSaving(true);
      setError(null);

      const result = await deleteCatgirl(id);

      if (result.success) {
        setCatgirls(catgirls.filter((c) => c.id !== id));
        alert(tOrDefault(t, "webapp.characterManager.deleteSuccess", "删除成功！"));
      } else {
        setError(result.error || tOrDefault(t, "common.error", "删除失败"));
      }
    } catch (err: any) {
      console.error("Failed to delete character:", err);
      setError(err.message || tOrDefault(t, "common.error", "删除失败"));
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    navigate("/");
  };

  const handleOpenApiKeySettings = () => {
    navigate("/api_key");
  };

  if (loading) {
    return (
      <div className="neko-container">
        <div className="neko-loading">
          <div className="neko-loading-spinner"></div>
          <p className="neko-loading-text">{tOrDefault(t, "webapp.characterManager.loadingProfile", "正在加载角色数据...")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="neko-container">
      {/* Header */}
      <div className="neko-header">
        <h2 data-text={tOrDefault(t, "webapp.characterManager.title", "角色管理")}>{tOrDefault(t, "webapp.characterManager.title", "角色管理")}</h2>
        <button className="neko-close-btn" onClick={handleClose} title={tOrDefault(t, "common.close", "关闭")}>
          <img src="/static/icons/close_button.png" alt={tOrDefault(t, "common.close", "关闭")} />
        </button>
      </div>

      <div className="neko-content">
        {/* Error Message */}
        {error && (
          <div className="neko-card neko-error-box">
            <p>❌ {error}</p>
            <button className="neko-btn neko-btn-secondary" onClick={() => setError(null)}>
              {tOrDefault(t, "common.close", "关闭")}
            </button>
          </div>
        )}

        {/* Master Profile Section */}
        <section className="neko-section master-section">
          <div className="section-header">
            <div className="neko-tips">
              <span className="icon">⚠️</span>
              {tOrDefault(t, "settings.masterProfile", "主人档案(唯一): 档案名为必填项，其他均为可选项。")}
            </div>
            <button className="neko-btn neko-btn-secondary api-key-btn" onClick={handleOpenApiKeySettings}>
              🔑 {tOrDefault(t, "webapp.apiKeySettings.title", "API Key 设置")}
            </button>
          </div>

          <div className="neko-card master-card">
            <div className="card-body">
              <div className="neko-field-row">
                <label className="neko-label">
                  {tOrDefault(t, "webapp.characterManager.profileName", "档案名")} <span className="required">*</span>
                </label>
                <input
                  className="neko-input"
                  type="text"
                  value={masterProfile.name}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setMasterProfile({ ...masterProfile, name: e.target.value })}
                  maxLength={20}
                  placeholder={tOrDefault(t, "common.required", "必填")}
                />
              </div>

              <div className="form-row">
                <div className="neko-field-row">
                  <label className="neko-label">{tOrDefault(t, "webapp.characterManager.nickname", "昵称")}</label>
                  <input
                    className="neko-input"
                    type="text"
                    value={masterProfile.nickname || ""}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setMasterProfile({ ...masterProfile, nickname: e.target.value })}
                  />
                </div>

                <div className="neko-field-row">
                  <label className="neko-label">{tOrDefault(t, "webapp.characterManager.gender", "性别")}</label>
                  <select
                    className="neko-select"
                    value={masterProfile.gender || ""}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setMasterProfile({ ...masterProfile, gender: e.target.value })}
                  >
                    <option value="">{tOrDefault(t, "common.unset", "未设置")}</option>
                    <option value="男">{tOrDefault(t, "characterProfile.values.male", "男")}</option>
                    <option value="女">{tOrDefault(t, "characterProfile.values.female", "女")}</option>
                    <option value="其他">{tOrDefault(t, "common.other", "其他")}</option>
                  </select>
                </div>
              </div>

              <button className="neko-btn neko-btn-primary save-master-btn" onClick={handleSaveMaster} disabled={saving}>
                {saving ? tOrDefault(t, "common.saving", "保存中...") : `💾 ${tOrDefault(t, "settings.saveMaster", "保存主人档案")}`}
              </button>
            </div>
          </div>
        </section>

        {/* Catgirl Profiles Section */}
        <section className="neko-section catgirl-section">
          <div className="section-header">
            <div className="neko-tips">
              <span className="icon">⚠️</span>
              {tOrDefault(t, "settings.catgirlProfile", "猫娘档案: 进阶设定包含Live2D形象、语音ID等。")}
            </div>
          </div>

          <div className="catgirl-list">
            {catgirls.map((catgirl) => (
              <div key={catgirl.id} className="neko-card catgirl-card">
                <div className="catgirl-header">
                  <h3>{catgirl.name}</h3>
                  <div className="catgirl-actions">
                    <button
                      className="neko-btn neko-btn-secondary neko-btn-sm"
                      onClick={() => setEditingCharacter(catgirl)}
                      title={tOrDefault(t, "common.edit", "编辑")}
                    >
                      ✏️
                    </button>
                    <button
                      className="neko-btn neko-btn-danger neko-btn-sm"
                      onClick={() => handleDeleteCharacter(catgirl.id)}
                      title={tOrDefault(t, "common.delete", "删除")}
                      disabled={saving}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                <div className="catgirl-info">
                  {catgirl.nickname && <p>{tOrDefault(t, "webapp.characterManager.nickname", "昵称")}: {catgirl.nickname}</p>}
                  {catgirl.gender && <p>{tOrDefault(t, "webapp.characterManager.gender", "性别")}: {catgirl.gender}</p>}
                  {catgirl.personality && <p>{tOrDefault(t, "webapp.characterManager.personality", "性格")}: {catgirl.personality}</p>}
                  {catgirl.live2dModel && <p>Live2D: {catgirl.live2dModel}</p>}
                </div>
              </div>
            ))}
          </div>

          <button className="neko-btn neko-btn-primary add-button" onClick={handleAddCatgirl}>
            ➕ {tOrDefault(t, "settings.addCatgirl", "新增猫娘")}
          </button>
        </section>

        {/* Character Editor Modal */}
        {editingCharacter && (
          <div className="neko-modal-overlay" onClick={() => setEditingCharacter(null)}>
            <div className="neko-modal" onClick={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}>
              <div className="neko-modal-header">
                <h3>{editingCharacter.id ? tOrDefault(t, "settings.editCatgirl", "编辑猫娘") : tOrDefault(t, "settings.addCatgirl", "新增猫娘")}</h3>
                <button className="neko-close-btn" onClick={() => setEditingCharacter(null)}>
                  <img src="/static/icons/close_button.png" alt={tOrDefault(t, "common.close", "关闭")} />
                </button>
              </div>

              <div className="neko-modal-body">
                <div className="neko-field-row">
                  <label className="neko-label">
                    {tOrDefault(t, "common.name", "名称")} <span className="required">*</span>
                  </label>
                  <input
                    className="neko-input"
                    type="text"
                    value={editingCharacter.name}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setEditingCharacter({ ...editingCharacter, name: e.target.value })
                    }
                    disabled={!!editingCharacter.id} // Can't rename via this modal
                  />
                </div>

                <div className="form-row">
                  <div className="neko-field-row">
                    <label className="neko-label">{tOrDefault(t, "webapp.characterManager.nickname", "昵称")}</label>
                    <input
                      className="neko-input"
                      type="text"
                      value={editingCharacter.nickname || ""}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setEditingCharacter({ ...editingCharacter, nickname: e.target.value })
                      }
                    />
                  </div>

                  <div className="neko-field-row">
                    <label className="neko-label">{tOrDefault(t, "webapp.characterManager.gender", "性别")}</label>
                    <select
                      className="neko-select"
                      value={editingCharacter.gender || ""}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                        setEditingCharacter({ ...editingCharacter, gender: e.target.value })
                      }
                    >
                      <option value="">{tOrDefault(t, "common.unset", "未设置")}</option>
                      <option value="女">{tOrDefault(t, "characterProfile.values.female", "女")}</option>
                      <option value="男">{tOrDefault(t, "characterProfile.values.male", "男")}</option>
                      <option value="其他">{tOrDefault(t, "common.other", "其他")}</option>
                    </select>
                  </div>
                </div>

                <div className="neko-field-row">
                  <label className="neko-label">{tOrDefault(t, "webapp.characterManager.personality", "性格")}</label>
                  <textarea
                    className="neko-textarea"
                    value={editingCharacter.personality || ""}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                      setEditingCharacter({ ...editingCharacter, personality: e.target.value })
                    }
                    rows={2}
                  />
                </div>

                <div className="neko-field-row">
                  <label className="neko-label">{tOrDefault(t, "webapp.characterManager.backstory", "背景故事")}</label>
                  <textarea
                    className="neko-textarea"
                    value={editingCharacter.backstory || ""}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                      setEditingCharacter({ ...editingCharacter, backstory: e.target.value })
                    }
                    rows={3}
                  />
                </div>

                <div className="neko-field-row">
                  <label className="neko-label">{tOrDefault(t, "settings.systemPrompt", "系统提示词")}</label>
                  <textarea
                    className="neko-textarea"
                    value={editingCharacter.systemPrompt || ""}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                      setEditingCharacter({ ...editingCharacter, systemPrompt: e.target.value })
                    }
                    rows={4}
                    placeholder={tOrDefault(t, "settings.systemPromptPlaceholder", "定义角色的行为和性格...")}
                  />
                </div>

                <div className="form-row">
                  <div className="neko-field-row">
                    <label className="neko-label">Live2D {tOrDefault(t, "settings.modelSettings", "模型")}</label>
                    <select
                      className="neko-select"
                      value={editingCharacter.live2dModel || ""}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                        setEditingCharacter({ ...editingCharacter, live2dModel: e.target.value })
                      }
                    >
                      <option value="">{tOrDefault(t, "common.unset", "未设置")}</option>
                      <option value="yui">Yui</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="neko-field-row">
                    <label className="neko-label">{tOrDefault(t, "webapp.voiceClone.voiceId", "语音 ID")}</label>
                    <input
                      className="neko-input"
                      type="text"
                      value={editingCharacter.voiceId || ""}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setEditingCharacter({ ...editingCharacter, voiceId: e.target.value })
                      }
                      placeholder="Optional"
                    />
                  </div>
                </div>
              </div>

              <div className="neko-modal-footer">
                <button className="neko-btn neko-btn-secondary" onClick={() => setEditingCharacter(null)}>
                  {tOrDefault(t, "common.cancel", "取消")}
                </button>
                <button
                  className="neko-btn neko-btn-primary"
                  onClick={() => handleSaveCharacter(editingCharacter)}
                  disabled={saving}
                >
                  {saving ? tOrDefault(t, "common.saving", "保存中...") : tOrDefault(t, "common.save", "保存")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
