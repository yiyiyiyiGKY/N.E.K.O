/**
 * Live2D Emotion Manager Page
 *
 * Migrated from templates/live2d_emotion_manager.html
 * Manages emotion mappings for Live2D models
 * Now connected to real backend API
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { ChangeEvent } from "react";
import "./Live2DEmotionManager.css";
import {
  getLive2DModels,
  getLive2DModelFiles,
  getLive2DEmotionMapping,
  saveLive2DEmotionMapping,
  type Live2DModel,
  type MotionFile,
  type ExpressionFile,
  type Live2DEmotionMapping,
} from "../api/models";

interface ModelInfo {
  name: string;
  path: string;
  source?: string;
  item_id?: string;
}

interface EmotionConfig {
  motions: { [emotion: string]: string[] };
  expressions: { [emotion: string]: string[] };
}

const EMOTIONS = [
  { key: "happy", label: "开心 (Happy)" },
  { key: "sad", label: "悲伤 (Sad)" },
  { key: "angry", label: "生气 (Angry)" },
  { key: "neutral", label: "平静 (Neutral)" },
  { key: "surprised", label: "惊讶 (Surprised)" },
  { key: "Idle", label: "待机 (Idle)" },
];

export default function Live2DEmotionManager() {
  const navigate = useNavigate();
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelInfo | null>(null);
  const [availableMotions, setAvailableMotions] = useState<string[]>([]);
  const [availableExpressions, setAvailableExpressions] = useState<string[]>([]);
  const [emotionConfig, setEmotionConfig] = useState<EmotionConfig>({
    motions: {},
    expressions: {},
  });
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
      const data = await getLive2DModels();

      if (data.error) {
        showStatus(data.error, "error");
        setModels([]);
      } else {
        setModels(
          (data.models || []).map((m: Live2DModel) => ({
            name: m.name,
            path: m.path,
            source: m.source,
            item_id: m.item_id,
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

  const loadModelFiles = async (model: ModelInfo) => {
    try {
      setLoading(true);
      const data = await getLive2DModelFiles(model.name);

      if (data.error) {
        showStatus(data.error, "error");
        setAvailableMotions([]);
        setAvailableExpressions([]);
      } else {
        setAvailableMotions((data.motions || []).map((m: MotionFile) => m.path || m.name));
        setAvailableExpressions((data.expressions || []).map((e: ExpressionFile) => e.path || e.name));
        showStatus("模型文件加载成功", "success");
      }
    } catch (err: any) {
      console.error("Failed to load model files:", err);
      showStatus(err.message || "加载模型文件失败", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadEmotionMapping = async (modelName: string) => {
    try {
      const data = await getLive2DEmotionMapping(modelName);

      if (data.error) {
        console.error("Failed to load emotion mapping:", data.error);
        setEmotionConfig({ motions: {}, expressions: {} });
      } else {
        // Convert from backend format to local format
        const mapping = data.mapping as Live2DEmotionMapping || { motions: {}, expressions: {} };
        setEmotionConfig({
          motions: mapping.motions || {},
          expressions: mapping.expressions || {},
        });
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
      loadModelFiles(model);
      loadEmotionMapping(model.name);
    }
  };

  const handleMotionToggle = (emotion: string, motion: string) => {
    setEmotionConfig((prev) => {
      const motions = prev.motions[emotion] || [];
      const exists = motions.includes(motion);
      return {
        ...prev,
        motions: {
          ...prev.motions,
          [emotion]: exists ? motions.filter((m) => m !== motion) : [...motions, motion],
        },
      };
    });
  };

  const handleExpressionToggle = (emotion: string, expression: string) => {
    setEmotionConfig((prev) => {
      const expressions = prev.expressions[emotion] || [];
      const exists = expressions.includes(expression);
      return {
        ...prev,
        expressions: {
          ...prev.expressions,
          [emotion]: exists ? expressions.filter((e) => e !== expression) : [...expressions, expression],
        },
      };
    });
  };

  const handleSave = async () => {
    if (!selectedModel) {
      showStatus("请先选择模型", "error");
      return;
    }
    try {
      setSaving(true);
      const result = await saveLive2DEmotionMapping(selectedModel.name, emotionConfig);

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
    setEmotionConfig({ motions: {}, expressions: {} });
    showStatus("配置已重置", "info");
  };

  const handleClose = () => {
    navigate(-1);
  };

  const getCleanFileName = (fileName: string) => {
    return fileName.split("/").pop()?.replace(/\.(motion3|exp3)\.json$/, "") || fileName;
  };

  return (
    <div className="neko-container">
      {/* Header */}
      <div className="neko-header">
        <h2 data-text="Live2D 情感映射管理器">Live2D 情感映射管理器</h2>
        <button className="neko-close-btn" onClick={handleClose} title="关闭">
          <img src="/static/icons/close_button.png" alt="关闭" />
        </button>
      </div>

      {/* Content */}
      <div className="neko-content">
        {/* Model Select */}
        <div className="neko-field-row">
          <label className="neko-label">选择 Live2D 模型</label>
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
                {model.source === "steam_workshop" ? " (Workshop)" : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Emotion Config */}
        {selectedModel && (
          <>
            {EMOTIONS.map((emotion) => (
              <div key={emotion.key} className="emotion-section">
                <div className="emotion-header">{emotion.label}</div>

                {/* Motions */}
                <div className="select-group">
                  <label>动作</label>
                  <div className="multiselect-box">
                    <div className="multiselect-tags">
                      {(emotionConfig.motions[emotion.key] || []).map((motion) => (
                        <span key={motion} className="tag">
                          {getCleanFileName(motion)}
                          <button
                            className="tag-remove"
                            onClick={() => handleMotionToggle(emotion.key, motion)}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      {(emotionConfig.motions[emotion.key] || []).length === 0 && (
                        <span className="placeholder">选择动作</span>
                      )}
                    </div>
                    <div className="multiselect-options">
                      {availableMotions.length === 0 ? (
                        <span className="empty-option">无可用动作</span>
                      ) : (
                        availableMotions.map((motion) => (
                          <label key={motion} className="option-item">
                            <input
                              type="checkbox"
                              checked={(emotionConfig.motions[emotion.key] || []).includes(motion)}
                              onChange={() => handleMotionToggle(emotion.key, motion)}
                            />
                            <span>{getCleanFileName(motion)}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Expressions */}
                <div className="select-group">
                  <label>表情</label>
                  <div className="multiselect-box">
                    <div className="multiselect-tags">
                      {(emotionConfig.expressions[emotion.key] || []).map((expression) => (
                        <span key={expression} className="tag">
                          {getCleanFileName(expression)}
                          <button
                            className="tag-remove"
                            onClick={() => handleExpressionToggle(emotion.key, expression)}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      {(emotionConfig.expressions[emotion.key] || []).length === 0 && (
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
                              checked={(emotionConfig.expressions[emotion.key] || []).includes(expression)}
                              onChange={() => handleExpressionToggle(emotion.key, expression)}
                            />
                            <span>{getCleanFileName(expression)}</span>
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
