/**
 * Live2D Emotion Manager Page
 *
 * Migrated from templates/live2d_emotion_manager.html
 * Manages emotion mappings for Live2D models
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { ChangeEvent } from "react";
import "./Live2DEmotionManager.css";

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
      // TODO: Implement API call
      // const response = await fetch("/api/live2d/models");
      // const data = await response.json();
      // setModels(data);

      // Mock data
      await new Promise((resolve) => setTimeout(resolve, 500));
      setModels([
        { name: "Yui", path: "/models/yui.model3.json" },
        { name: "Miku", path: "/models/miku.model3.json" },
      ]);
    } catch (error) {
      console.error("Failed to load models:", error);
      showStatus("加载模型列表失败", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadModelFiles = async (model: ModelInfo) => {
    try {
      setLoading(true);
      // TODO: Implement API call
      // const response = await fetch(`/api/live2d/model_files/${encodeURIComponent(model.name)}`);
      // const data = await response.json();

      // Mock data
      await new Promise((resolve) => setTimeout(resolve, 300));
      setAvailableMotions([
        "motions/idle_01.motion3.json",
        "motions/happy_01.motion3.json",
        "motions/sad_01.motion3.json",
      ]);
      setAvailableExpressions([
        "expressions/happy.exp3.json",
        "expressions/sad.exp3.json",
        "expressions/angry.exp3.json",
      ]);
      showStatus("模型文件加载成功", "success");
    } catch (error) {
      console.error("Failed to load model files:", error);
      showStatus("加载模型文件失败", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadEmotionMapping = async (modelName: string) => {
    try {
      // TODO: Implement API call
      // const response = await fetch(`/api/live2d/emotion_mapping/${encodeURIComponent(modelName)}`);
      // const data = await response.json();

      // Mock data
      await new Promise((resolve) => setTimeout(resolve, 200));
      setEmotionConfig({
        motions: {
          happy: ["motions/happy_01.motion3.json"],
        },
        expressions: {
          happy: ["expressions/happy.exp3.json"],
        },
      });
    } catch (error) {
      console.error("Failed to load emotion mapping:", error);
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
          [emotion]: exists
            ? motions.filter((m) => m !== motion)
            : [...motions, motion],
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
          [emotion]: exists
            ? expressions.filter((e) => e !== expression)
            : [...expressions, expression],
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
      // TODO: Implement API call
      // const response = await fetch(`/api/live2d/emotion_mapping/${encodeURIComponent(selectedModel.name)}`, {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify(emotionConfig),
      // });

      await new Promise((resolve) => setTimeout(resolve, 500));
      showStatus("配置保存成功", "success");
    } catch (error) {
      console.error("Failed to save emotion mapping:", error);
      showStatus("保存失败", "error");
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
    <div className="live2d-emotion-manager">
      <div className="container">
        {/* Header */}
        <div className="header">
          <div className="header-content">
            <h1>Live2D 情感映射管理器</h1>
            <p>配置不同情绪下的动作和表情</p>
          </div>
          <button className="close-btn" onClick={handleClose} title="关闭">
            <img src="/static/icons/close_button.png" alt="关闭" />
          </button>
        </div>

        {/* Content */}
        <div className="container-content">
          {/* Model Select */}
          <div className="field-row">
            <label>选择 Live2D 模型</label>
            <select value={selectedModel?.name || ""} onChange={handleModelSelect} disabled={loading}>
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
                        {availableMotions.map((motion) => (
                          <label key={motion} className="option-item">
                            <input
                              type="checkbox"
                              checked={(emotionConfig.motions[emotion.key] || []).includes(motion)}
                              onChange={() => handleMotionToggle(emotion.key, motion)}
                            />
                            <span>{getCleanFileName(motion)}</span>
                          </label>
                        ))}
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
                        {availableExpressions.map((expression) => (
                          <label key={expression} className="option-item">
                            <input
                              type="checkbox"
                              checked={(emotionConfig.expressions[emotion.key] || []).includes(expression)}
                              onChange={() => handleExpressionToggle(emotion.key, expression)}
                            />
                            <span>{getCleanFileName(expression)}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Buttons */}
              <div className="button-group">
                <button
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "保存中..." : "保存配置"}
                </button>
                <button className="btn btn-secondary" onClick={handleReset}>
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
    </div>
  );
}
