/**
 * VRM Emotion Manager Page
 *
 * Migrated from templates/vrm_emotion_manager.html
 * Manages emotion-to-expression mappings for VRM models
 * Now connected to real backend API
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { ChangeEvent } from "react";
import "./VRMEmotionManager.css";
import {
  getVRMModels,
  getVRMExpressions,
  getVRMEmotionMapping,
  saveVRMEmotionMapping,
  type VRMModel,
  type VRMExpression,
  type EmotionMapping,
} from "../api/models";

interface ModelInfo {
  name: string;
  path: string;
}

interface EmotionConfig {
  [emotion: string]: string[]; // Array of expression candidates
}

const EMOTIONS = [
  { key: "neutral", label: "平静 (Neutral)" },
  { key: "happy", label: "开心 (Happy)" },
  { key: "relaxed", label: "放松 (Relaxed)" },
  { key: "sad", label: "悲伤 (Sad)" },
  { key: "angry", label: "生气 (Angry)" },
  { key: "surprised", label: "惊讶 (Surprised)" },
];

export default function VRMEmotionManager() {
  const navigate = useNavigate();
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelInfo | null>(null);
  const [availableExpressions, setAvailableExpressions] = useState<string[]>([]);
  const [emotionConfig, setEmotionConfig] = useState<EmotionConfig>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  useEffect(() => {
    loadModels();
  }, []);

  const showStatus = (message: string, type: "success" | "error" | "info" = "info") => {
    setStatusMessage({ message, type });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const loadModels = async () => {
    try {
      setLoading(true);
      const data = await getVRMModels();

      if (data.error) {
        showStatus(data.error, "error");
        setModels([]);
      } else {
        setModels(
          (data.models || []).map((m: VRMModel) => ({
            name: m.name,
            path: m.path,
          }))
        );
      }
    } catch (err: any) {
      console.error("Failed to load models:", err);
      showStatus(err.message || "加载模型列表失败", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadModelExpressions = async (model: ModelInfo) => {
    try {
      setLoading(true);
      const data = await getVRMExpressions(model.name);

      if (data.error) {
        showStatus(data.error, "error");
        setAvailableExpressions([]);
      } else {
        setAvailableExpressions((data.expressions || []).map((e: VRMExpression) => e.name));
        showStatus("表情列表加载成功", "success");
      }
    } catch (err: any) {
      console.error("Failed to load expressions:", err);
      showStatus(err.message || "加载表情列表失败", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadEmotionMapping = async (modelName: string) => {
    try {
      const data = await getVRMEmotionMapping(modelName);

      if (data.error) {
        console.error("Failed to load emotion mapping:", data.error);
        setEmotionConfig({});
      } else {
        // For VRM, mapping is a simple emotion -> expressions map
        const mapping = data.mapping as EmotionConfig || {};
        setEmotionConfig(mapping);
      }
    } catch (err: any) {
      console.error("Failed to load emotion mapping:", err);
    }
  };

  const handleModelSelect = (e: ChangeEvent<HTMLSelectElement>) => {
    const modelName = e.target.value;
    const model = models.find((m) => m.name === modelName);
    if (model) {
      setSelectedModel(model);
      loadModelExpressions(model);
      loadEmotionMapping(model.name);
    }
  };

  const handleExpressionToggle = (emotion: string, expression: string) => {
    setEmotionConfig((prev) => {
      const current = prev[emotion] || [];
      const exists = current.includes(expression);
      return {
        ...prev,
        [emotion]: exists
          ? current.filter((e) => e !== expression)
          : [...current, expression],
      };
    });
  };

  const handlePreviewExpression = (expression: string) => {
    if (!selectedModel) return;
    // Preview would need WebSocket connection to live model
    console.log("Preview expression:", expression);
    showStatus(`预览表情: ${expression}`, "info");
  };

  const handleSave = async () => {
    if (!selectedModel) {
      showStatus("请先选择模型", "error");
      return;
    }

    try {
      setSaving(true);
      const result = await saveVRMEmotionMapping(selectedModel.name, emotionConfig as EmotionMapping);

      if (result.success) {
        showStatus(result.message || "配置保存成功", "success");
      } else {
        showStatus(result.error || "保存失败", "error");
      }
    } catch (err: any) {
      console.error("Failed to save emotion mapping:", err);
      showStatus(err.message || "保存失败", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setEmotionConfig({});
    showStatus("配置已重置", "info");
  };

  const handleClose = () => {
    navigate(-1);
  };

  return (
    <div className="neko-container">
      {/* Header */}
      <div className="neko-header">
        <h2 data-text="VRM 情感映射管理器">VRM 情感映射管理器</h2>
        <button className="neko-close-btn" onClick={handleClose} title="关闭">
          <img src="/static/icons/close_button.png" alt="关闭" />
        </button>
      </div>

      {/* Content */}
      <div className="neko-content">
        {/* Info Box */}
        <div className="info-box">
          <strong>提示：</strong>
          <span>
            VRM模型的表情名称可能因版本不同而异（VRM 0.x使用joy，VRM 1.0使用happy）。
            请为每种情绪选择多个候选表情，系统会自动匹配模型支持的表情。
          </span>
        </div>

        {/* Model Select */}
        <div className="neko-field-row">
          <label className="neko-label">选择 VRM 模型</label>
          <select
            className="neko-select"
            value={selectedModel?.name || ""}
            onChange={handleModelSelect}
            disabled={loading}
          >
            <option value="">{loading ? "加载中..." : "请选择模型"}</option>
            {models.map((model) => (
              <option key={model.name} value={model.name}>
                {model.name}
              </option>
            ))}
          </select>
        </div>

        {/* Emotion Config */}
        {selectedModel && (
          <>
            {/* Preview Section */}
            <div className="preview-section">
              <div className="preview-header">表情预览</div>
              <div className="preview-buttons">
                {loading ? (
                  <span className="loading-text">加载表情列表...</span>
                ) : availableExpressions.length === 0 ? (
                  <span className="loading-text">无可用表情</span>
                ) : (
                  availableExpressions.map((expression) => (
                    <button
                      key={expression}
                      className="preview-btn"
                      onClick={() => handlePreviewExpression(expression)}
                    >
                      {expression}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Emotion Sections */}
            {EMOTIONS.map((emotion) => (
              <div key={emotion.key} className="emotion-section">
                <div className="emotion-header">{emotion.label}</div>

                <div className="select-group">
                  <label>表情候选</label>
                  <div className="multiselect-box">
                    <div className="multiselect-tags">
                      {(emotionConfig[emotion.key] || []).map((expression) => (
                        <span key={expression} className="tag">
                          {expression}
                          <button
                            className="tag-remove"
                            onClick={() => handleExpressionToggle(emotion.key, expression)}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      {(emotionConfig[emotion.key] || []).length === 0 && (
                        <span className="placeholder">选择表情</span>
                      )}
                    </div>
                    <div className="multiselect-options">
                      {availableExpressions.length === 0 ? (
                        <span className="empty-option">无可用表情</span>
                      ) : (
                        availableExpressions.map((expression) => (
                          <label key={expression} className="option-item">
                            <input
                              type="checkbox"
                              checked={(emotionConfig[emotion.key] || []).includes(expression)}
                              onChange={() => handleExpressionToggle(emotion.key, expression)}
                            />
                            <span>{expression}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Buttons */}
            <div className="button-group">
              <button
                className="neko-btn neko-btn-primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "保存中..." : "保存配置"}
              </button>
              <button className="neko-btn neko-btn-secondary" onClick={handleReset}>
                重置
              </button>
            </div>

            {/* Status Message */}
            {statusMessage && (
              <div className={`status-message status-${statusMessage.type}`}>
                {statusMessage.message}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
