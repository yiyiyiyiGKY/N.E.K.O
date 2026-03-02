/**
 * Voice Clone Page
 *
 * Migrated from templates/voice_clone.html
 * Now connected to real backend API
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { ChangeEvent, FormEvent } from "react";
import "./VoiceClone.css";
import { getVoices, cloneVoice, deleteVoice, type VoiceInfo } from "../api/voice";

interface Voice {
  voiceId: string;
  prefix: string;
  createdAt?: string;
  isLocal?: boolean;
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
  const [deletingVoiceId, setDeletingVoiceId] = useState<string | null>(null);

  useEffect(() => {
    loadVoices();
  }, []);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ["audio/wav", "audio/mpeg", "audio/mp3", "audio/m4a", "audio/x-m4a"];
      if (!validTypes.includes(file.type) && !file.name.match(/\.(wav|mp3|m4a)$/i)) {
        setResult({ type: "error", message: "请上传 WAV、MP3 或 M4A 格式的音频文件" });
        return;
      }
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

    // Validate prefix format
    if (!/^[a-zA-Z0-9]+$/.test(prefix)) {
      setResult({ type: "error", message: "前缀只能包含英文字母和数字" });
      return;
    }

    setRegistering(true);
    setResult(null);

    try {
      const response = await cloneVoice(audioFile, prefix, refLanguage);

      if (response.error) {
        setResult({ type: "error", message: response.error });
      } else {
        setResult({
          type: "success",
          message: response.message || `音色注册成功！Voice ID: ${response.voice_id}`,
        });
        setAudioFile(null);
        setPrefix("");
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }

        // Reload voices
        loadVoices();
      }
    } catch (error: any) {
      console.error("Failed to register voice:", error);
      setResult({ type: "error", message: error.message || "注册失败，请重试" });
    } finally {
      setRegistering(false);
    }
  };

  const loadVoices = async () => {
    setLoadingVoices(true);
    try {
      const data = await getVoices();

      // Convert voices object to array
      const voiceList: Voice[] = [];
      if (data.voices) {
        for (const [voiceId, info] of Object.entries(data.voices)) {
          voiceList.push({
            voiceId: voiceId,
            prefix: info.prefix || voiceId,
            createdAt: info.created_at,
            isLocal: info.is_local,
          });
        }
      }

      setVoices(voiceList);
    } catch (error) {
      console.error("Failed to load voices:", error);
      setVoices([]);
    } finally {
      setLoadingVoices(false);
    }
  };

  const handleDeleteVoice = async (voiceId: string) => {
    if (!confirm("确定要删除这个音色吗？")) return;

    setDeletingVoiceId(voiceId);
    try {
      const result = await deleteVoice(voiceId);

      if (result.success) {
        setVoices(voices.filter((v) => v.voiceId !== voiceId));
        setResult({ type: "success", message: result.message || "删除成功" });
      } else {
        setResult({ type: "error", message: result.error || "删除失败" });
      }
    } catch (error: any) {
      console.error("Failed to delete voice:", error);
      setResult({ type: "error", message: error.message || "删除失败" });
    } finally {
      setDeletingVoiceId(null);
    }
  };

  const handleClose = () => {
    navigate("/");
  };

  return (
    <div className="neko-container">
      {/* Header */}
      <div className="neko-header">
        <h2 data-text="语音克隆">语音克隆</h2>
        <button className="neko-close-btn" onClick={handleClose} title="关闭">
          <img src="/static/icons/close_button.png" alt="关闭" />
        </button>
      </div>

      <div className="neko-content">
        {/* Notice */}
        <div className="neko-info-box" style={{ marginBottom: 24 }}>
          此功能需要使用阿里云API或本地TTS服务
        </div>

        {/* File Upload */}
        <div className="neko-field-row">
          <label className="neko-label">
            选择本地音频文件 <em>（15秒最佳，请勿超过30秒，wav/mp3/m4a格式）</em>
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
              {audioFile ? audioFile.name : "选择文件"}
            </label>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleRegister}>
          <div className="neko-field-row">
            <label className="neko-label">参考音频语言</label>
            <p className="neko-tips">选择您上传的参考音频的语言，中文以外的语言需要指定</p>
            <select
              className="neko-select"
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

          <div className="neko-field-row">
            <label className="neko-label">自定义前缀 <em>（阿里云需要）</em></label>
            <input
              className="neko-input"
              type="text"
              value={prefix}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setPrefix(e.target.value)}
              placeholder="Maximum 10 characters, numbers and English letters only"
              maxLength={10}
              pattern="[a-zA-Z0-9]+"
            />
          </div>

          <button type="submit" className="neko-btn neko-btn-primary" disabled={registering}>
            {registering ? "注册中..." : "注册音色"}
          </button>
        </form>

        {/* Result Message */}
        {result && (
          <div className={`result-message result-${result.type}`}>
            {result.message}
          </div>
        )}

        {/* Registered Voices List */}
        <div className="voice-list-section">
          <div className="voice-list-header">
            <label className="neko-label">已注册音色</label>
            <button className="neko-btn neko-btn-secondary neko-btn-sm" onClick={loadVoices} disabled={loadingVoices}>
              {loadingVoices ? "加载中..." : "刷新"}
            </button>
          </div>

          <div className="voice-list-container">
            {loadingVoices ? (
              <div className="voice-list-placeholder">加载中...</div>
            ) : voices.length === 0 ? (
              <div className="voice-list-placeholder">暂无已注册的音色</div>
            ) : (
              <div className="voice-list">
                {voices.map((voice) => (
                  <div key={voice.voiceId} className="voice-item">
                    <div className="voice-info">
                      <div className="voice-id">
                        Voice ID: {voice.voiceId}
                        {voice.isLocal && <span className="local-badge">本地</span>}
                      </div>
                      <div className="voice-meta">前缀: {voice.prefix}</div>
                      {voice.createdAt && (
                        <div className="voice-meta">创建时间: {voice.createdAt}</div>
                      )}
                    </div>
                    <button
                      className="neko-btn neko-btn-danger neko-btn-sm"
                      onClick={() => handleDeleteVoice(voice.voiceId)}
                      disabled={deletingVoiceId === voice.voiceId}
                    >
                      {deletingVoiceId === voice.voiceId ? "删除中..." : "删除"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
