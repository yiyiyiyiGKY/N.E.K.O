/**
 * Voice Clone Page
 *
 * Migrated from templates/voice_clone.html
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { ChangeEvent, FormEvent } from "react";
import "./VoiceClone.css";

interface Voice {
  voiceId: string;
  prefix: string;
  createdAt?: string;
}

export default function VoiceClone() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [refLanguage, setRefLanguage] = useState("ch");
  const [prefix, setPrefix] = useState("");
  const [registering, setRegistering] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(true);

  useEffect(() => {
    loadVoices();
  }, []);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
      setResult(null);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();

    if (!audioFile) {
      setResult({ type: "error", message: "请选择音频文件" });
      return;
    }

    if (!prefix.trim()) {
      setResult({ type: "error", message: "请输入自定义前缀" });
      return;
    }

    setRegistering(true);
    setResult(null);

    try {
      // TODO: Implement API call
      const formData = new FormData();
      formData.append("audio", audioFile);
      formData.append("refLanguage", refLanguage);
      formData.append("prefix", prefix);

      console.log("Registering voice:", { audioFile: audioFile.name, refLanguage, prefix });

      // Mock delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      setResult({ type: "success", message: "音色注册成功！" });
      setAudioFile(null);
      setPrefix("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      // Reload voices
      loadVoices();
    } catch (error) {
      console.error("Failed to register voice:", error);
      setResult({ type: "error", message: "注册失败：" + (error as Error).message });
    } finally {
      setRegistering(false);
    }
  };

  const loadVoices = async () => {
    setLoadingVoices(true);
    try {
      // TODO: Implement API call
      // const response = await fetch("/api/voices/");
      // const data = await response.json();
      // setVoices(data);

      // Mock data
      await new Promise((resolve) => setTimeout(resolve, 500));
      setVoices([
        { voiceId: "voice_001", prefix: "voice1", createdAt: "2026-02-19" },
        { voiceId: "voice_002", prefix: "voice2", createdAt: "2026-02-18" },
      ]);
    } catch (error) {
      console.error("Failed to load voices:", error);
    } finally {
      setLoadingVoices(false);
    }
  };

  const handleDeleteVoice = async (voiceId: string) => {
    if (!confirm("确定要删除这个音色吗？")) return;

    try {
      // TODO: Implement API call
      console.log("Deleting voice:", voiceId);
      setVoices(voices.filter((v) => v.voiceId !== voiceId));
    } catch (error) {
      console.error("Failed to delete voice:", error);
      alert("删除失败：" + (error as Error).message);
    }
  };

  const handleClose = () => {
    navigate("/");
  };

  return (
    <div className="voice-clone-page">
      <div className="page-container">
        {/* Header */}
        <div className="page-header">
          <h2>音色注册</h2>
          <button className="close-button" onClick={handleClose} title="关闭">
            ✕
          </button>
        </div>

        <div className="page-content">
          {/* Notice */}
          <div className="api-notice">
            ⚠️ 此功能需要使用阿里云API
          </div>

          {/* File Upload */}
          <div className="form-section">
            <label className="label-with-icon">
              <span className="icon">⚠️</span>
              <span>选择本地音频文件（15秒最佳，请勿超过30秒，wav/mp3格式）</span>
            </label>

            <div className="file-upload-area">
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                id="audioFile"
                className="file-input"
              />
              <label htmlFor="audioFile" className="file-label">
                📁 {audioFile ? audioFile.name : "选择文件"}
              </label>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label>参考音频语言</label>
              <p className="hint">选择您上传的参考音频的语言，中文以外的语言需要指定</p>
              <select
                value={refLanguage}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setRefLanguage(e.target.value)}
              >
                <option value="ch">中文</option>
                <option value="en">英语</option>
                <option value="fr">法语</option>
                <option value="de">德语</option>
                <option value="ja">日语</option>
                <option value="ko">韩语</option>
                <option value="ru">俄语</option>
              </select>
            </div>

            <div className="form-group">
              <label>自定义前缀（阿里云需要）</label>
              <input
                type="text"
                value={prefix}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPrefix(e.target.value)}
                placeholder="Maximum 10 characters, numbers and English letters only"
                maxLength={10}
                pattern="[a-zA-Z0-9]+"
              />
            </div>

            <button type="submit" className="register-button" disabled={registering}>
              {registering ? "注册中..." : "🎵 注册音色"}
            </button>
          </form>

          {/* Result Message */}
          {result && (
            <div className={`result-message ${result.type}`}>
              {result.message}
            </div>
          )}

          {/* Registered Voices List */}
          <div className="voice-list-section">
            <div className="section-header">
              <label className="label-with-icon">
                <span className="icon">🔑</span>
                <span className="title">已注册音色</span>
              </label>
              <button className="refresh-button" onClick={loadVoices}>
                🔄 刷新
              </button>
            </div>

            <div className="voice-list-container">
              {loadingVoices ? (
                <div className="loading-text">加载中...</div>
              ) : voices.length === 0 ? (
                <div className="empty-text">暂无已注册的音色</div>
              ) : (
                <div className="voice-list">
                  {voices.map((voice) => (
                    <div key={voice.voiceId} className="voice-item">
                      <div className="voice-info">
                        <div className="voice-id">Voice ID: {voice.voiceId}</div>
                        <div className="voice-prefix">前缀: {voice.prefix}</div>
                        {voice.createdAt && (
                          <div className="voice-date">创建时间: {voice.createdAt}</div>
                        )}
                      </div>
                      <button
                        className="delete-button"
                        onClick={() => handleDeleteVoice(voice.voiceId)}
                      >
                        🗑️ 删除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
