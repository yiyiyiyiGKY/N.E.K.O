/**
 * Model Manager Page
 *
 * Migrated from templates/model_manager.html
 * Now connected to real backend API
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { ChangeEvent } from "react";
import "./ModelManager.css";
import {
  getLive2DModels,
  getVRMModels,
  uploadVRMModel,
  deleteVRMModel,
  type Live2DModel,
  type VRMModel,
} from "../api/models";

interface Model {
  id: string;
  name: string;
  type: "live2d" | "vrm";
  path: string;
  source?: string;
}

type ModelType = "live2d" | "vrm";

export default function ModelManager() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [modelType, setModelType] = useState<ModelType>("live2d");
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadModels();
  }, [modelType]);

  const loadModels = async () => {
    setLoading(true);
    setError(null);
    try {
      if (modelType === "live2d") {
        const data = await getLive2DModels();
        if (data.error) {
          setError(data.error);
          setModels([]);
        } else {
          setModels(
            (data.models || []).map((m: Live2DModel) => ({
              id: m.name,
              name: m.name,
              type: "live2d" as const,
              path: m.path,
              source: m.source,
            }))
          );
        }
      } else {
        const data = await getVRMModels();
        if (data.error) {
          setError(data.error);
          setModels([]);
        } else {
          setModels(
            (data.models || []).map((m: VRMModel) => ({
              id: m.name,
              name: m.name,
              type: "vrm" as const,
              path: m.path,
            }))
          );
        }
      }
    } catch (err: any) {
      console.error("Failed to load models:", err);
      setError(err.message || "加载模型列表失败");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadStatus("上传中...");
    setError(null);

    try {
      if (modelType === "vrm") {
        // VRM upload
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const result = await uploadVRMModel(file);
          if (!result.success) {
            throw new Error(result.error || "上传失败");
          }
        }
        setUploadStatus("上传成功！");
        loadModels();
      } else {
        // Live2D upload (would need backend support)
        setUploadStatus("Live2D 模型上传功能开发中...");
      }

      setTimeout(() => setUploadStatus(""), 3000);
    } catch (err: any) {
      console.error("Failed to upload:", err);
      setError(err.message || "上传失败");
      setUploadStatus("");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDeleteModel = async (modelId: string) => {
    if (!confirm("确定要删除这个模型吗？此操作不可恢复！")) return;

    setError(null);
    try {
      if (modelType === "vrm") {
        const result = await deleteVRMModel(modelId);
        if (!result.success) {
          throw new Error(result.error || "删除失败");
        }
      }
      // Live2D delete would need backend support

      setModels(models.filter((m) => m.id !== modelId));
      if (selectedModel?.id === modelId) {
        setSelectedModel(null);
      }
    } catch (err: any) {
      console.error("Failed to delete model:", err);
      setError(err.message || "删除失败");
    }
  };

  const handleDeleteAllModels = async () => {
    if (!confirm("确定要删除所有导入的模型吗？此操作不可恢复！")) return;

    setError(null);
    try {
      // Delete each model
      for (const model of models) {
        if (modelType === "vrm") {
          await deleteVRMModel(model.id);
        }
      }

      setModels([]);
      setSelectedModel(null);
    } catch (err: any) {
      console.error("Failed to delete all models:", err);
      setError(err.message || "删除失败");
    }
  };

  const handleClose = () => {
    navigate("/");
  };

  return (
    <div className="neko-container">
      {/* Header */}
      <div className="neko-header">
        <h2 data-text="模型管理">模型管理</h2>
        <button className="neko-close-btn" onClick={handleClose} title="关闭">
          <img src="/static/icons/close_button.png" alt="关闭" />
        </button>
      </div>

      <div className="neko-content model-layout">
        <div className="model-sidebar">
          {/* Error Message */}
          {error && (
            <div className="neko-error-box" style={{ marginBottom: 16, padding: 8 }}>
              <p style={{ margin: 0, fontSize: 14 }}>❌ {error}</p>
              <button
                className="neko-btn neko-btn-secondary neko-btn-sm"
                onClick={() => setError(null)}
                style={{ marginTop: 8 }}
              >
                关闭
              </button>
            </div>
          )}

          {/* Back Button */}
          <div className="control-group">
            <button className="neko-btn neko-btn-primary" onClick={handleClose}>
              返回主页
            </button>
          </div>

          {/* Upload Section */}
          <div className="control-group">
            <input
              ref={fileInputRef}
              type="file"
              className="neko-input"
              id="model-upload"
              accept={modelType === "live2d" ? ".zip,.json" : ".vrm"}
              multiple
              style={{ display: "none" }}
              onChange={handleFileUpload}
            />
            <div className="button-row">
              <button
                className="neko-btn neko-btn-primary"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? "上传中..." : "导入模型"}
              </button>
              <button
                className="neko-btn neko-btn-danger"
                onClick={handleDeleteAllModels}
                disabled={models.length === 0}
              >
                全部删除
              </button>
            </div>
            {uploadStatus && (
              <div className="upload-status">{uploadStatus}</div>
            )}
          </div>

          {/* Model Type Select */}
          <div className="control-group">
            <label className="control-label">模型类型</label>
            <select
              className="neko-select"
              value={modelType}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                setModelType(e.target.value as ModelType)
              }
            >
              <option value="live2d">Live2D</option>
              <option value="vrm">VRM</option>
            </select>
          </div>

          {/* Model Select */}
          <div className="control-group">
            <label className="control-label">选择模型</label>
            {loading ? (
              <div className="loading-text">加载中...</div>
            ) : models.length === 0 ? (
              <div className="empty-text">暂无模型</div>
            ) : (
              <div className="model-list">
                {models.map((model) => (
                  <div
                    key={model.id}
                    className={`model-item ${selectedModel?.id === model.id ? "active" : ""}`}
                    onClick={() => setSelectedModel(model)}
                  >
                    <div className="model-name">
                      {model.name}
                      {model.source === "steam_workshop" && (
                        <span className="source-badge">Workshop</span>
                      )}
                    </div>
                    <button
                      className="delete-btn"
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        handleDeleteModel(model.id);
                      }}
                      title="删除"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selected Model Info */}
          {selectedModel && (
            <div className="neko-card model-info">
              <div className="info-title">模型信息</div>
              <div className="info-row">
                <span className="info-label">名称:</span>
                <span className="info-value">{selectedModel.name}</span>
              </div>
              <div className="info-row">
                <span className="info-label">类型:</span>
                <span className="info-value">
                  {selectedModel.type.toUpperCase()}
                </span>
              </div>
              {selectedModel.source && (
                <div className="info-row">
                  <span className="info-label">来源:</span>
                  <span className="info-value">{selectedModel.source}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Main Content - Preview Area */}
        <div className="model-main">
          <div className="preview-area">
            {selectedModel ? (
              <div className="preview-placeholder">
                <p className="preview-text">模型预览</p>
                <p className="preview-model-name">{selectedModel.name}</p>
                <p className="preview-hint">
                  Live2D/VRM 模型渲染需要集成相应的渲染库
                </p>
              </div>
            ) : (
              <div className="no-model-selected">
                <p>请从左侧选择一个模型</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
