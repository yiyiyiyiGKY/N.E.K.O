/**
 * Model Manager Page
 *
 * Migrated from templates/model_manager.html
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { ChangeEvent } from "react";
import "./ModelManager.css";

interface Model {
  id: string;
  name: string;
  type: "live2d" | "vrm";
  size: string;
  uploadDate: string;
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

  useEffect(() => {
    loadModels();
  }, [modelType]);

  const loadModels = async () => {
    setLoading(true);
    try {
      // TODO: Implement API call
      // const response = await fetch(`/api/models/${modelType}`);
      // const data = await response.json();
      // setModels(data);

      // Mock data
      await new Promise((resolve) => setTimeout(resolve, 500));
      setModels([
        {
          id: "1",
          name: "Yui",
          type: modelType,
          size: "15 MB",
          uploadDate: "2026-02-19",
        },
        {
          id: "2",
          name: "Miku",
          type: modelType,
          size: "18 MB",
          uploadDate: "2026-02-18",
        },
      ]);
    } catch (error) {
      console.error("Failed to load models:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadStatus("上传中...");

    try {
      // TODO: Implement API call
      console.log("Uploading files:", files);

      // Mock upload
      await new Promise((resolve) => setTimeout(resolve, 2000));

      setUploadStatus("上传成功！");
      loadModels();

      setTimeout(() => setUploadStatus(""), 3000);
    } catch (error) {
      console.error("Failed to upload:", error);
      setUploadStatus("上传失败：" + (error as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDeleteModel = async (modelId: string) => {
    if (!confirm("确定要删除这个模型吗？此操作不可恢复！")) return;

    try {
      // TODO: Implement API call
      console.log("Deleting model:", modelId);
      setModels(models.filter((m) => m.id !== modelId));
      if (selectedModel?.id === modelId) {
        setSelectedModel(null);
      }
      alert("模型已删除");
    } catch (error) {
      console.error("Failed to delete model:", error);
      alert("删除失败：" + (error as Error).message);
    }
  };

  const handleDeleteAllModels = async () => {
    if (!confirm("确定要删除所有导入的模型吗？此操作不可恢复！")) return;

    try {
      // TODO: Implement API call
      console.log("Deleting all models");
      setModels([]);
      setSelectedModel(null);
      alert("所有模型已删除");
    } catch (error) {
      console.error("Failed to delete all models:", error);
      alert("删除失败：" + (error as Error).message);
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
                导入模型
              </button>
              <button
                className="neko-btn neko-btn-danger"
                onClick={handleDeleteAllModels}
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
                    <div className="model-name">{model.name}</div>
                    <button
                      className="delete-btn"
                      onClick={(e) => {
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
              <div className="info-row">
                <span className="info-label">大小:</span>
                <span className="info-value">{selectedModel.size}</span>
              </div>
              <div className="info-row">
                <span className="info-label">上传:</span>
                <span className="info-value">{selectedModel.uploadDate}</span>
              </div>
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
