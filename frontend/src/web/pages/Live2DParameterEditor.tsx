/**
 * Live2D Parameter Editor Page
 *
 * Migrated from templates/live2d_parameter_editor.html
 * Provides Live2D model parameter editing ("捏脸系统")
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { ChangeEvent } from "react";
import "./Live2DParameterEditor.css";

interface ModelInfo {
  id: string;
  name: string;
  path: string;
}

interface ParameterInfo {
  id: string;
  name: string;
  value: number;
  min: number;
  max: number;
  defaultValue: number;
  group: string;
}

type ParameterGroup = {
  [key: string]: ParameterInfo[];
};

export default function Live2DParameterEditor() {
  const navigate = useNavigate();
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [parameters, setParameters] = useState<ParameterInfo[]>([]);
  const [parameterGroups, setParameterGroups] = useState<ParameterGroup>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("选择模型");
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      // TODO: Implement API call
      // const response = await fetch("/api/live2d/models");
      // const data = await response.json();
      // setModels(data);

      // Mock data
      await new Promise((resolve) => setTimeout(resolve, 500));
      setModels([
        { id: "model1", name: "Yui", path: "/models/yui.model3.json" },
        { id: "model2", name: "Miku", path: "/models/miku.model3.json" },
      ]);
    } catch (error) {
      console.error("Failed to load models:", error);
      setStatus("加载模型列表失败");
    } finally {
      setLoading(false);
    }
  };

  const loadModelParameters = async (modelId: string) => {
    try {
      setLoading(true);
      setStatus("加载参数中...");

      // TODO: Implement API call to load model and get parameters
      // const response = await fetch(`/api/live2d/models/${modelId}/parameters`);
      // const data = await response.json();

      // Mock data - parameter groups
      await new Promise((resolve) => setTimeout(resolve, 500));
      const mockParams: ParameterInfo[] = [
        { id: "Angle_X", name: "头部左右旋转", value: 0, min: -30, max: 30, defaultValue: 0, group: "面部" },
        { id: "Angle_Y", name: "头部上下旋转", value: 0, min: -30, max: 30, defaultValue: 0, group: "面部" },
        { id: "Eye_L_Open", name: "左眼开合", value: 1, min: 0, max: 1, defaultValue: 1, group: "眼睛" },
        { id: "Eye_R_Open", name: "右眼开合", value: 1, min: 0, max: 1, defaultValue: 1, group: "眼睛" },
        { id: "Mouth_Open_Y", name: "嘴巴开合", value: 0, min: 0, max: 1, defaultValue: 0, group: "嘴巴" },
        { id: "Mouth_Smile", name: "嘴巴微笑", value: 0, min: -1, max: 1, defaultValue: 0, group: "嘴巴" },
      ];

      // Group parameters
      const groups: ParameterGroup = {};
      mockParams.forEach((param) => {
        if (!groups[param.group]) {
          groups[param.group] = [];
        }
        groups[param.group].push(param);
      });

      setParameters(mockParams);
      setParameterGroups(groups);
      setStatus(`已加载 ${mockParams.length} 个参数`);
    } catch (error) {
      console.error("Failed to load parameters:", error);
      setStatus("加载参数失败");
    } finally {
      setLoading(false);
    }
  };

  const handleModelSelect = (modelId: string) => {
    setSelectedModel(modelId);
    setModelDropdownOpen(false);
    loadModelParameters(modelId);
  };

  const handleParameterChange = (paramId: string, value: number) => {
    setParameters((prev) =>
      prev.map((p) => (p.id === paramId ? { ...p, value } : p))
    );

    // Update groups as well
    setParameterGroups((prev) => {
      const updated = { ...prev };
      for (const group in updated) {
        updated[group] = updated[group].map((p) =>
          p.id === paramId ? { ...p, value } : p
        );
      }
      return updated;
    });
  };

  const handleResetAll = () => {
    if (!confirm("确定要重置所有参数吗？")) return;

    const resetParams = parameters.map((p) => ({
      ...p,
      value: p.defaultValue,
    }));
    setParameters(resetParams);

    const resetGroups: ParameterGroup = {};
    resetParams.forEach((param) => {
      if (!resetGroups[param.group]) {
        resetGroups[param.group] = [];
      }
      resetGroups[param.group].push(param);
    });
    setParameterGroups(resetGroups);

    setStatus("已重置所有参数");
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setStatus("保存中...");

      // TODO: Implement API call
      // const response = await fetch(`/api/live2d/models/${selectedModel}/parameters`, {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ parameters }),
      // });

      await new Promise((resolve) => setTimeout(resolve, 500));
      setStatus("保存成功！");
    } catch (error) {
      console.error("Failed to save parameters:", error);
      setStatus("保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    navigate("/model_manager");
  };

  const selectedModelName = models.find((m) => m.id === selectedModel)?.name || "选择模型";

  return (
    <div className="live2d-parameter-editor">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="control-group">
          <button className="btn btn-primary back-button" onClick={handleBack}>
            <img src="/static/icons/back_to_main_button.png" alt="" className="btn-icon" />
            <span className="btn-text">返回模型管理</span>
            <img src="/static/icons/paw_ui.png" alt="" className="btn-icon-right" />
          </button>
        </div>

        <div className="control-group">
          <div className="model-select-wrapper">
            <button
              className="btn btn-primary model-select-button"
              onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
            >
              <img src="/static/icons/live2d_model_select_icon.png" alt="" className="btn-icon" />
              <span className="btn-text">{selectedModelName}</span>
            </button>

            {modelDropdownOpen && (
              <div className="model-dropdown">
                {loading ? (
                  <div className="dropdown-item">加载中...</div>
                ) : (
                  models.map((model) => (
                    <div
                      key={model.id}
                      className={`dropdown-item ${selectedModel === model.id ? "active" : ""}`}
                      onClick={() => handleModelSelect(model.id)}
                    >
                      {model.name}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className="control-group">
          <div className="button-row">
            <button
              className="btn btn-secondary"
              disabled={parameters.length === 0}
              onClick={handleResetAll}
            >
              重置全部
            </button>
            <button
              className="btn btn-success"
              disabled={parameters.length === 0 || saving}
              onClick={handleSave}
            >
              {saving ? "保存中..." : "保存参数"}
            </button>
          </div>
        </div>

        <div className="control-group parameters-list-container">
          <div className="parameters-list-wrapper">
            <div className="parameters-list-header">参数列表</div>
            <div className="parameters-list">
              {parameters.length === 0 ? (
                <div className="parameters-list-empty">请先选择并加载模型</div>
              ) : (
                Object.entries(parameterGroups).map(([group, params]) => (
                  <div key={group} className="parameter-group">
                    <div className="parameter-group-title">{group}</div>
                    {params.map((param) => (
                      <div key={param.id} className="parameter-item">
                        <label className="parameter-label">{param.name}</label>
                        <div className="parameter-control">
                          <input
                            type="range"
                            min={param.min}
                            max={param.max}
                            step={(param.max - param.min) / 100}
                            value={param.value}
                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                              handleParameterChange(param.id, parseFloat(e.target.value))
                            }
                          />
                          <span className="parameter-value">{param.value.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="status-bar">
          <img src="/static/icons/reminder_icon.png" alt="" className="status-icon" />
          <span>{status}</span>
        </div>
      </div>

      {/* Live2D Canvas Container */}
      <div className="live2d-container">
        <canvas ref={canvasRef} id="live2d-canvas" />
        <div className="canvas-placeholder">
          <p>Live2D 模型预览区域</p>
          <p className="hint">选择模型后将在此显示</p>
        </div>
      </div>
    </div>
  );
}
