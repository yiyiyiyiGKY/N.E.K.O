/**
 * Character Manager Page
 *
 * Migrated from templates/chara_manager.html
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { ChangeEvent, MouseEvent } from "react";
import "./CharacterManager.css";

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

interface MasterProfile {
  name: string;
  nickname?: string;
  gender?: string;
  age?: string;
  personality?: string;
}

export default function CharacterManager() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [masterProfile, setMasterProfile] = useState<MasterProfile>({
    name: "",
  });
  const [catgirls, setCatgirls] = useState<Character[]>([]);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);

  useEffect(() => {
    loadCharacters();
  }, []);

  const loadCharacters = async () => {
    try {
      // TODO: Implement API call
      // const response = await fetch("/api/characters/");
      // const data = await response.json();
      // setMasterProfile(data.master);
      // setCatgirls(data.catgirls);

      // Mock data
      setTimeout(() => {
        setMasterProfile({ name: "主人", nickname: "Master", gender: "男" });
        setCatgirls([
          {
            id: "1",
            name: "小雪",
            nickname: "Yuki",
            gender: "女",
            personality: "温柔体贴",
            live2dModel: "yui",
          },
        ]);
        setLoading(false);
      }, 500);
    } catch (error) {
      console.error("Failed to load characters:", error);
      setLoading(false);
    }
  };

  const handleSaveMaster = async () => {
    try {
      // TODO: Implement API call
      console.log("Saving master profile:", masterProfile);
      alert("保存成功！");
    } catch (error) {
      console.error("Failed to save master profile:", error);
      alert("保存失败：" + (error as Error).message);
    }
  };

  const handleAddCatgirl = () => {
    const newCatgirl: Character = {
      id: Date.now().toString(),
      name: "新猫娘",
    };
    setEditingCharacter(newCatgirl);
  };

  const handleSaveCharacter = async (character: Character) => {
    try {
      // TODO: Implement API call
      console.log("Saving character:", character);

      if (catgirls.find((c) => c.id === character.id)) {
        // Update existing
        setCatgirls(catgirls.map((c) => (c.id === character.id ? character : c)));
      } else {
        // Add new
        setCatgirls([...catgirls, character]);
      }

      setEditingCharacter(null);
      alert("保存成功！");
    } catch (error) {
      console.error("Failed to save character:", error);
      alert("保存失败：" + (error as Error).message);
    }
  };

  const handleDeleteCharacter = async (id: string) => {
    if (!confirm("确定要删除这个角色吗？")) return;

    try {
      // TODO: Implement API call
      setCatgirls(catgirls.filter((c) => c.id !== id));
      alert("删除成功！");
    } catch (error) {
      console.error("Failed to delete character:", error);
      alert("删除失败：" + (error as Error).message);
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
          <p className="neko-loading-text">正在加载角色数据...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="neko-container">
      {/* Header */}
      <div className="neko-header">
        <h2 data-text="角色管理">角色管理</h2>
        <button className="neko-close-btn" onClick={handleClose} title="关闭">
          <img src="/static/icons/close_button.png" alt="关闭" />
        </button>
      </div>

      <div className="neko-content">
        {/* Master Profile Section */}
        <section className="neko-section master-section">
          <div className="section-header">
            <div className="neko-tips">
              <span className="icon">⚠️</span>
              主人档案(唯一): 档案名为必填项，其他均为可选项。
            </div>
            <button className="neko-btn neko-btn-secondary api-key-btn" onClick={handleOpenApiKeySettings}>
              🔑 API Key 设置
            </button>
          </div>

          <div className="neko-card master-card">
            <div className="card-body">
              <div className="neko-field-row">
                <label className="neko-label">
                  档案名 <span className="required">*</span>
                </label>
                <input
                  className="neko-input"
                  type="text"
                  value={masterProfile.name}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setMasterProfile({ ...masterProfile, name: e.target.value })}
                  maxLength={20}
                  placeholder="必填"
                />
              </div>

              <div className="form-row">
                <div className="neko-field-row">
                  <label className="neko-label">昵称</label>
                  <input
                    className="neko-input"
                    type="text"
                    value={masterProfile.nickname || ""}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setMasterProfile({ ...masterProfile, nickname: e.target.value })}
                  />
                </div>

                <div className="neko-field-row">
                  <label className="neko-label">性别</label>
                  <select
                    className="neko-select"
                    value={masterProfile.gender || ""}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setMasterProfile({ ...masterProfile, gender: e.target.value })}
                  >
                    <option value="">未设置</option>
                    <option value="男">男</option>
                    <option value="女">女</option>
                    <option value="其他">其他</option>
                  </select>
                </div>
              </div>

              <button className="neko-btn neko-btn-primary save-master-btn" onClick={handleSaveMaster}>
                💾 保存主人档案
              </button>
            </div>
          </div>
        </section>

        {/* Catgirl Profiles Section */}
        <section className="neko-section catgirl-section">
          <div className="section-header">
            <div className="neko-tips">
              <span className="icon">⚠️</span>
              猫娘档案: 进阶设定包含Live2D形象、语音ID等。
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
                      title="编辑"
                    >
                      ✏️
                    </button>
                    <button
                      className="neko-btn neko-btn-danger neko-btn-sm"
                      onClick={() => handleDeleteCharacter(catgirl.id)}
                      title="删除"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                <div className="catgirl-info">
                  {catgirl.nickname && <p>昵称: {catgirl.nickname}</p>}
                  {catgirl.gender && <p>性别: {catgirl.gender}</p>}
                  {catgirl.personality && <p>性格: {catgirl.personality}</p>}
                  {catgirl.live2dModel && <p>Live2D: {catgirl.live2dModel}</p>}
                </div>
              </div>
            ))}
          </div>

          <button className="neko-btn neko-btn-primary add-button" onClick={handleAddCatgirl}>
            ➕ 新增猫娘
          </button>
        </section>

        {/* Character Editor Modal */}
        {editingCharacter && (
          <div className="neko-modal-overlay" onClick={() => setEditingCharacter(null)}>
            <div className="neko-modal" onClick={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}>
              <div className="neko-modal-header">
                <h3>{editingCharacter.id ? "编辑猫娘" : "新增猫娘"}</h3>
                <button className="neko-close-btn" onClick={() => setEditingCharacter(null)}>
                  <img src="/static/icons/close_button.png" alt="关闭" />
                </button>
              </div>

              <div className="neko-modal-body">
                <div className="neko-field-row">
                  <label className="neko-label">
                    名称 <span className="required">*</span>
                  </label>
                  <input
                    className="neko-input"
                    type="text"
                    value={editingCharacter.name}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setEditingCharacter({ ...editingCharacter, name: e.target.value })
                    }
                  />
                </div>

                <div className="form-row">
                  <div className="neko-field-row">
                    <label className="neko-label">昵称</label>
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
                    <label className="neko-label">性别</label>
                    <select
                      className="neko-select"
                      value={editingCharacter.gender || ""}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                        setEditingCharacter({ ...editingCharacter, gender: e.target.value })
                      }
                    >
                      <option value="">未设置</option>
                      <option value="女">女</option>
                      <option value="男">男</option>
                      <option value="其他">其他</option>
                    </select>
                  </div>
                </div>

                <div className="neko-field-row">
                  <label className="neko-label">性格</label>
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
                  <label className="neko-label">背景故事</label>
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
                  <label className="neko-label">系统提示词</label>
                  <textarea
                    className="neko-textarea"
                    value={editingCharacter.systemPrompt || ""}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                      setEditingCharacter({ ...editingCharacter, systemPrompt: e.target.value })
                    }
                    rows={4}
                    placeholder="定义角色的行为和性格..."
                  />
                </div>

                <div className="form-row">
                  <div className="neko-field-row">
                    <label className="neko-label">Live2D 模型</label>
                    <select
                      className="neko-select"
                      value={editingCharacter.live2dModel || ""}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                        setEditingCharacter({ ...editingCharacter, live2dModel: e.target.value })
                      }
                    >
                      <option value="">未设置</option>
                      <option value="yui">Yui</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="neko-field-row">
                    <label className="neko-label">语音 ID</label>
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
                  取消
                </button>
                <button
                  className="neko-btn neko-btn-primary"
                  onClick={() => handleSaveCharacter(editingCharacter)}
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
