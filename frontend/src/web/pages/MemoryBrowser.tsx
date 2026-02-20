/**
 * Memory Browser Page
 *
 * Migrated from templates/memory_browser.html
 * Now connected to real backend API
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { ChangeEvent } from "react";
import "./MemoryBrowser.css";
import {
  getRecentFiles,
  getRecentFile,
  saveRecentFile,
  getReviewConfig,
  updateReviewConfig,
  type MemoryFile,
  type MemoryContent,
} from "../api/memory";

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

// Parse memory file name to extract character info
function parseMemoryFileName(fileName: string): { characterName: string; timestamp: string } {
  // Expected format: recent_{character_name}.json or similar
  const match = fileName.match(/recent_(.+)\.json$/i);
  if (match) {
    return {
      characterName: match[1],
      timestamp: "",
    };
  }
  return {
    characterName: fileName.replace(/\.json$/i, ""),
    timestamp: "",
  };
}

export default function MemoryBrowser() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [characterMemories, setCharacterMemories] = useState<CharacterMemory[]>([]);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [memoryContent, setMemoryContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [autoReview, setAutoReview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCharacterMemories();
    loadReviewConfig();
  }, []);

  const loadCharacterMemories = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getRecentFiles();

      if (data.error) {
        setError(data.error);
        setCharacterMemories([]);
        return;
      }

      // Convert files to CharacterMemory format
      const memories: CharacterMemory[] = (data.files || []).map((file: MemoryFile) => {
        const parsed = parseMemoryFileName(file.name);
        return {
          characterId: file.name,
          characterName: parsed.characterName,
          memoryCount: 1, // We don't have count from API
          lastUpdated: file.modified || "",
        };
      });

      setCharacterMemories(memories);
    } catch (err: any) {
      console.error("Failed to load memories:", err);
      setError(err.message || "加载记忆列表失败");
    } finally {
      setLoading(false);
    }
  };

  const loadReviewConfig = async () => {
    try {
      const data = await getReviewConfig();
      if (data.config) {
        setAutoReview(data.config.auto_review || false);
      }
    } catch (err) {
      console.error("Failed to load review config:", err);
    }
  };

  const loadMemoryContent = async (characterId: string) => {
    setError(null);
    try {
      const data = await getRecentFile(characterId);

      if (data.error) {
        setError(data.error);
        return;
      }

      const parsed = parseMemoryFileName(characterId);
      const contentStr = JSON.stringify(data.content, null, 2);

      const memory: Memory = {
        id: characterId,
        characterName: data.name || parsed.characterName,
        content: contentStr,
        timestamp: new Date().toISOString(),
      };

      setSelectedMemory(memory);
      setMemoryContent(contentStr);
      setOriginalContent(contentStr);
    } catch (err: any) {
      console.error("Failed to load memory content:", err);
      setError(err.message || "加载记忆内容失败");
    }
  };

  const handleSave = async () => {
    if (!selectedMemory) return;

    setSaving(true);
    setError(null);
    try {
      // Parse the content back to JSON
      let content: MemoryContent;
      try {
        content = JSON.parse(memoryContent);
      } catch {
        setError("JSON 格式错误，请检查内容");
        setSaving(false);
        return;
      }

      const result = await saveRecentFile(selectedMemory.id, content);

      if (result.success) {
        setOriginalContent(memoryContent);
        alert("保存成功！");
      } else {
        setError(result.error || "保存失败");
      }
    } catch (err: any) {
      console.error("Failed to save memory:", err);
      setError(err.message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!selectedMemory) return;
    if (!confirm("确定要清空这个角色的记忆吗？此操作不可恢复！")) return;

    try {
      // Save empty content
      const result = await saveRecentFile(selectedMemory.id, {});

      if (result.success) {
        setMemoryContent("{}");
        setOriginalContent("{}");
        alert("记忆已清空！");
      } else {
        setError(result.error || "清空失败");
      }
    } catch (err: any) {
      console.error("Failed to clear memory:", err);
      setError(err.message || "清空失败");
    }
  };

  const handleAutoReviewToggle = async (enabled: boolean) => {
    try {
      const result = await updateReviewConfig({ auto_review: enabled });

      if (result.success) {
        setAutoReview(enabled);
      } else {
        setError(result.error || "设置失败");
      }
    } catch (err: any) {
      console.error("Failed to toggle auto review:", err);
      setError(err.message || "设置失败");
    }
  };

  const handleClose = () => {
    navigate("/");
  };

  const hasChanges = memoryContent !== originalContent;

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
        {/* Error Message */}
        {error && (
          <div className="neko-card neko-error-box" style={{ marginBottom: 16 }}>
            <p>❌ {error}</p>
            <button className="neko-btn neko-btn-secondary neko-btn-sm" onClick={() => setError(null)}>
              关闭
            </button>
          </div>
        )}

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
                        selectedMemory?.id === memory.characterId ? "active" : ""
                      }`}
                      onClick={() => loadMemoryContent(memory.characterId)}
                    >
                      <div className="character-name">{memory.characterName}</div>
                      <div className="character-meta">
                        <span className="memory-count">{memory.memoryCount} 条记忆</span>
                        {memory.lastUpdated && (
                          <span className="last-updated">{memory.lastUpdated}</span>
                        )}
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
                    {hasChanges && <span className="unsaved-badge">未保存</span>}
                  </div>

                  <textarea
                    className="neko-textarea memory-editor"
                    value={memoryContent}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setMemoryContent(e.target.value)}
                    placeholder="记忆内容..."
                    spellCheck={false}
                  />

                  <div className="editor-actions">
                    <button
                      className="neko-btn neko-btn-primary"
                      onClick={handleSave}
                      disabled={saving || !hasChanges}
                    >
                      {saving ? "保存中..." : "保存"}
                    </button>
                    <button className="neko-btn neko-btn-danger" onClick={handleClear}>
                      清空
                    </button>
                    <button
                      className="neko-btn neko-btn-secondary"
                      onClick={() => setMemoryContent(originalContent)}
                      disabled={!hasChanges}
                    >
                      撤销
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
