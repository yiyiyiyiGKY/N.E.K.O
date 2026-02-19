/**
 * Memory Browser Page
 *
 * Migrated from templates/memory_browser.html
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { ChangeEvent } from "react";
import "./MemoryBrowser.css";

interface Memory {
  id: string;
  characterName: string;
  content: string;
  timestamp: string;
}

interface CharacterMemory {
  characterId: string;
  characterName: string;
  memoryCount: number;
  lastUpdated: string;
}

export default function MemoryBrowser() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [characterMemories, setCharacterMemories] = useState<CharacterMemory[]>([]);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [memoryContent, setMemoryContent] = useState("");
  const [autoReview, setAutoReview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadCharacterMemories();
  }, []);

  const loadCharacterMemories = async () => {
    setLoading(true);
    try {
      // TODO: Implement API call
      // const response = await fetch("/api/memories/");
      // const data = await response.json();
      // setCharacterMemories(data);

      // Mock data
      await new Promise((resolve) => setTimeout(resolve, 500));
      setCharacterMemories([
        {
          characterId: "yui",
          characterName: "Yui",
          memoryCount: 42,
          lastUpdated: "2026-02-19",
        },
        {
          characterId: "miku",
          characterName: "Miku",
          memoryCount: 28,
          lastUpdated: "2026-02-18",
        },
      ]);
    } catch (error) {
      console.error("Failed to load memories:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMemoryContent = async (characterId: string) => {
    try {
      // TODO: Implement API call
      // const response = await fetch(`/api/memories/${characterId}`);
      // const data = await response.json();
      // setSelectedMemory(data);
      // setMemoryContent(data.content);

      // Mock data
      await new Promise((resolve) => setTimeout(resolve, 300));
      const mockMemory: Memory = {
        id: `${characterId}-memory`,
        characterName: characterId,
        content: `这是 ${characterId} 的记忆内容...\n\n用户: 你好\n${characterId}: 你好！有什么可以帮你的吗？\n\n用户: 今天天气怎么样？\n${characterId}: 今天天气很晴朗！`,
        timestamp: "2026-02-19 18:30:00",
      };
      setSelectedMemory(mockMemory);
      setMemoryContent(mockMemory.content);
    } catch (error) {
      console.error("Failed to load memory content:", error);
    }
  };

  const handleSave = async () => {
    if (!selectedMemory) return;

    setSaving(true);
    try {
      // TODO: Implement API call
      console.log("Saving memory:", selectedMemory.id, memoryContent);
      await new Promise((resolve) => setTimeout(resolve, 500));
      alert("保存成功！");
    } catch (error) {
      console.error("Failed to save memory:", error);
      alert("保存失败：" + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!selectedMemory) return;
    if (!confirm("确定要清空这个角色的记忆吗？此操作不可恢复！")) return;

    try {
      // TODO: Implement API call
      console.log("Clearing memory for:", selectedMemory.characterName);
      setMemoryContent("");
      alert("记忆已清空！");
    } catch (error) {
      console.error("Failed to clear memory:", error);
      alert("清空失败：" + (error as Error).message);
    }
  };

  const handleAutoReviewToggle = async (enabled: boolean) => {
    try {
      // TODO: Implement API call
      console.log("Setting auto review:", enabled);
      setAutoReview(enabled);
    } catch (error) {
      console.error("Failed to toggle auto review:", error);
    }
  };

  const handleClose = () => {
    navigate("/");
  };

  const filteredMemories = characterMemories.filter((m) =>
    m.characterName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="neko-container">
      {/* Header */}
      <div className="neko-header">
        <h2 data-text="记忆浏览器">记忆浏览器</h2>
        <button className="neko-close-btn" onClick={handleClose} title="关闭">
          <img src="/static/icons/close_button.png" alt="关闭" />
        </button>
      </div>

      <div className="neko-content">
        {/* Tips */}
        <div className="neko-info-box tips-container">
          <span className="tip-text">刚刚结束的对话内容要稍等片刻才会载入，可以重新点击猫娘名称刷新。</span>
        </div>

        <div className="main-layout">
          {/* Left Column - Character List */}
          <div className="left-column">
            <div className="neko-card character-list-panel">
              <div className="panel-title">猫娘记忆库</div>

              {/* Search */}
              <div className="search-box">
                <input
                  className="neko-input"
                  type="text"
                  placeholder="搜索角色..."
                  value={searchTerm}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Character List */}
              <div className="character-list">
                {loading ? (
                  <div className="loading-text">加载中...</div>
                ) : filteredMemories.length === 0 ? (
                  <div className="empty-text">暂无记忆</div>
                ) : (
                  filteredMemories.map((memory) => (
                    <div
                      key={memory.characterId}
                      className={`character-item ${
                        selectedMemory?.id.startsWith(memory.characterId) ? "active" : ""
                      }`}
                      onClick={() => loadMemoryContent(memory.characterId)}
                    >
                      <div className="character-name">{memory.characterName}</div>
                      <div className="character-meta">
                        <span className="memory-count">{memory.memoryCount} 条记忆</span>
                        <span className="last-updated">{memory.lastUpdated}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Auto Review Toggle */}
              <div className="auto-review-section">
                <div className="section-title">自动记忆整理</div>
                <label className="toggle-label">
                  <label className="neko-switch">
                    <input
                      type="checkbox"
                      checked={autoReview}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => handleAutoReviewToggle(e.target.checked)}
                    />
                    <span className="neko-switch-slider"></span>
                  </label>
                  <span className="toggle-text">{autoReview ? "已开启" : "已关闭"}</span>
                </label>
                <p className="toggle-note">
                  开启后系统将自动整理和优化记忆内容，提高对话质量
                </p>
              </div>
            </div>
          </div>

          {/* Right Column - Memory Editor */}
          <div className="right-column">
            <div className="neko-card editor-panel">
              <div className="panel-title">聊天记录</div>

              {selectedMemory ? (
                <>
                  <div className="editor-meta">
                    <span className="character-label">角色: {selectedMemory.characterName}</span>
                    <span className="timestamp">时间: {selectedMemory.timestamp}</span>
                  </div>

                  <textarea
                    className="neko-textarea memory-editor"
                    value={memoryContent}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setMemoryContent(e.target.value)}
                    placeholder="记忆内容..."
                  />

                  <div className="editor-actions">
                    <button
                      className="neko-btn neko-btn-primary"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      {saving ? "保存中..." : "保存"}
                    </button>
                    <button className="neko-btn neko-btn-danger" onClick={handleClear}>
                      清空
                    </button>
                  </div>
                </>
              ) : (
                <div className="empty-editor">
                  <p>请从左侧选择一个角色查看记忆</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
