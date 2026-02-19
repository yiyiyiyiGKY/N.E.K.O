import React, { useState, useCallback, useMemo } from "react";
import type { ChatMessage, PendingScreenshot } from "./types";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import { useT, tOrDefault } from "../i18n";

/** 检测是否为移动端 */
function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/** 生成跨环境安全的 id */
function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface ChatContainerProps {
  /** External messages to display (will be merged with internal messages) */
  externalMessages?: ChatMessage[];
  /** Callback when user sends a message via input */
  onSendMessage?: (text: string, images?: string[]) => void;
  /** Connection status for text chat mode */
  connectionStatus?: "idle" | "connecting" | "open" | "closing" | "closed" | "reconnecting";
  /** Whether to disable the input (e.g., when disconnected) */
  disabled?: boolean;
  /** Custom status text to show in the header */
  statusText?: string;
}

export default function ChatContainer({
  externalMessages,
  onSendMessage,
  connectionStatus = "idle",
  disabled = false,
  statusText,
}: ChatContainerProps) {
  const t = useT();

  /** 是否缩小 */
  const [collapsed, setCollapsed] = useState(false);

  const [internalMessages, setInternalMessages] = useState<ChatMessage[]>([
    {
      id: "sys-1",
      role: "system",
      content: tOrDefault(
        t,
        "chat.welcome",
        "欢迎来到 React 聊天系统（迁移 Demo）"
      ),
      createdAt: Date.now(),
    },
  ]);

  // Merge internal and external messages, sorted by createdAt
  const messages = useMemo(() => {
    const all = [...internalMessages, ...(externalMessages || [])];
    all.sort((a, b) => a.createdAt - b.createdAt);
    return all;
  }, [internalMessages, externalMessages]);

  const [pendingScreenshots, setPendingScreenshots] =
    useState<PendingScreenshot[]>([]);

  function handleSendText(text: string) {
    if (!text.trim() && pendingScreenshots.length === 0) return;

    const images: string[] = [];
    const newMessages: ChatMessage[] = [];
    let timestamp = Date.now();

    pendingScreenshots.forEach((p) => {
      images.push(p.base64);
      // Only add to internal messages if no external handler (standalone mode)
      if (!onSendMessage) {
        newMessages.push({
          id: generateId(),
          role: "user",
          image: p.base64,
          createdAt: timestamp++,
        });
      }
    });

    if (text.trim() && !onSendMessage) {
      // Only add to internal messages if no external handler (standalone mode)
      newMessages.push({
        id: generateId(),
        role: "user",
        content: text,
        createdAt: timestamp,
      });
    }

    // Call external handler if provided
    if (onSendMessage) {
      onSendMessage(text.trim(), images.length > 0 ? images : undefined);
    }

    // Update internal messages only in standalone mode
    if (newMessages.length > 0) {
      setInternalMessages((prev) => [...prev, ...newMessages]);
    }
    setPendingScreenshots([]);
  }

  /**
   * 获取移动端摄像头流（优先后置摄像头，fallback 前置/any）
   * 参考 legacy app.js getMobileCameraStream 实现
   */
  const getMobileCameraStream = useCallback(async (): Promise<MediaStream> => {
    const attempts = [
      {
        label: "rear",
        constraints: { video: { facingMode: { ideal: "environment" } } },
      },
      { label: "front", constraints: { video: { facingMode: "user" } } },
      { label: "any", constraints: { video: true } },
    ];

    for (const attempt of attempts) {
      try {
        return await navigator.mediaDevices.getUserMedia(attempt.constraints);
      } catch {
        // fallback to next attempt
      }
    }
    throw new Error(
      tOrDefault(t, "chat.cannot_get_camera", "Unable to access camera")
    );
  }, [t]);

  /**
   * 捕获视频帧到 canvas 并返回 base64
   * 参考 legacy app.js captureCanvasFrame 实现，限制最大尺寸为 1280x720
   */
  const captureCanvasFrame = useCallback(
    (video: HTMLVideoElement, jpegQuality: number = 0.8) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      let targetWidth = video.videoWidth;
      let targetHeight = video.videoHeight;
      const MAX_WIDTH = 1280;
      const MAX_HEIGHT = 720;

      // 等比缩放到最大尺寸内
      if (targetWidth > MAX_WIDTH || targetHeight > MAX_HEIGHT) {
        const widthRatio = MAX_WIDTH / targetWidth;
        const heightRatio = MAX_HEIGHT / targetHeight;
        const ratio = Math.min(widthRatio, heightRatio);
        targetWidth = Math.floor(targetWidth * ratio);
        targetHeight = Math.floor(targetHeight * ratio);
      }

      canvas.width = targetWidth;
      canvas.height = targetHeight;
      ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

      // 使用 JPEG 格式以减小体积
      return canvas.toDataURL("image/jpeg", jpegQuality);
    },
    []
  );

  /**
   * 截图/拍照处理函数
   * - 桌面端：使用 getDisplayMedia 截取屏幕
   * - 移动端：使用 getUserMedia 拍照
   */
  async function handleScreenshot() {
    const mobile = isMobile();

    // 检查 API 支持
    if (mobile) {
      if (!navigator.mediaDevices?.getUserMedia) {
        alert(
          tOrDefault(t, "chat.screenshot.unsupported", "您的浏览器不支持拍照")
        );
        return;
      }
    } else {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        alert(
          tOrDefault(t, "chat.screenshot.unsupported", "您的浏览器不支持截图")
        );
        return;
      }
    }

    let stream: MediaStream | null = null;
    const video = document.createElement("video");

    try {
      // 根据平台获取媒体流
      if (mobile) {
        stream = await getMobileCameraStream();
      } else {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: "always" } as MediaTrackConstraints,
          audio: false,
        });
      }

      video.srcObject = stream;
      video.playsInline = true; // iOS Safari 需要
      video.muted = true;
      await video.play();

      // 等待视频尺寸可用
      await new Promise<void>((resolve) => {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          resolve();
        } else {
          video.onloadedmetadata = () => resolve();
        }
      });

      const base64 = captureCanvasFrame(video);
      if (!base64) {
        alert(tOrDefault(t, "chat.screenshot.failed", "截图失败"));
        return;
      }

      setPendingScreenshots((prev) => [...prev, { id: generateId(), base64 }]);
    } catch (err: any) {
      // 用户取消不报错
      if (err?.name === "NotAllowedError" || err?.name === "AbortError") {
        return;
      }
      console.error("[ChatContainer] Screenshot error:", err);
      alert(
        tOrDefault(
          t,
          "chat.screenshot.failed",
          mobile ? "拍照失败" : "截图失败"
        )
      );
    } finally {
      if (stream) stream.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    }
  }

  /** Get connection status indicator color */
  function getStatusColor(): string {
    switch (connectionStatus) {
      case "open":
        return "#52c41a"; // green
      case "connecting":
      case "reconnecting":
      case "closing":
        return "#faad14"; // yellow
      case "closed":
        return "#ff4d4f"; // red
      default:
        return "#d9d9d9"; // gray
    }
  }

  /** Get connection status text */
  function getStatusText(): string {
    if (statusText) return statusText;
    switch (connectionStatus) {
      case "open":
        return tOrDefault(t, "chat.status.connected", "已连接");
      case "connecting":
        return tOrDefault(t, "chat.status.connecting", "连接中...");
      case "reconnecting":
        return tOrDefault(t, "chat.status.reconnecting", "重连中...");
      case "closing":
        return tOrDefault(t, "chat.status.closing", "断开中...");
      case "closed":
        return tOrDefault(t, "chat.status.disconnected", "已断开");
      default:
        return tOrDefault(t, "chat.status.idle", "待连接");
    }
  }

  /** ================= 缩小态：左下角按钮（button，支持键盘） ================= */
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        aria-label={tOrDefault(t, "chat.expand", "打开聊天")}
        style={{
          position: "fixed",
          left: 16,
          bottom: 16,
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "#44b7fe",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 8px 24px rgba(68,183,254,0.5)",
          zIndex: 9999,
          border: "none",
          padding: 0,
        }}
      >
        <span style={{ color: "#fff", fontSize: 22 }}>💬</span>
      </button>
    );
  }

  /** ================= 展开态：聊天框 ================= */
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        maxWidth: 400,
        height: 450,
        margin: "0 auto",
        background: "rgba(255, 255, 255, 0.65)",
        backdropFilter: "saturate(180%) blur(20px)",
        WebkitBackdropFilter: "saturate(180%) blur(20px)",
        borderRadius: 12,
        border: "1px solid rgba(255, 255, 255, 0.18)",
        boxShadow:
          "0 4px 12px rgba(0,0,0,0.08), 0 16px 32px rgba(0,0,0,0.12)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 48,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px 0 16px",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
          background: "rgba(255,255,255,0.5)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 600 }}>
            {tOrDefault(t, "chat.title", "💬 Chat")}
          </span>
          {/* Connection status indicator */}
          {onSendMessage && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 12,
                color: "#666",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: getStatusColor(),
                  display: "inline-block",
                }}
              />
              <span>{getStatusText()}</span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setCollapsed(true)}
          aria-label={tOrDefault(t, "chat.minimize", "最小化聊天")}
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            border: "none",
            background: "#e6f4ff",
            color: "#44b7fe",
            cursor: "pointer",
            fontSize: 16,
            lineHeight: "28px",
          }}
        >
          —
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        <MessageList messages={messages} />
      </div>

      <ChatInput
        onSend={handleSendText}
        onTakePhoto={handleScreenshot}
        pendingScreenshots={pendingScreenshots}
        setPendingScreenshots={setPendingScreenshots}
        disabled={disabled}
      />
    </div>
  );
}
