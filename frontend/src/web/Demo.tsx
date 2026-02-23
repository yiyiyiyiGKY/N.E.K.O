import "./styles.css";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Button, StatusToast, Modal, Live2DRightToolbar, useT, tOrDefault, QrMessageBox} from "@project_neko/components";
import type {
  StatusToastHandle,
  ModalHandle,
  Live2DSettingsToggleId,
  Live2DSettingsState,
  Live2DRightToolbarPanel,
  Live2DSettingsMenuId,
} from "@project_neko/components";
import { createRequestClient, WebTokenStorage } from "@project_neko/request";
import { ChatContainer } from "@project_neko/components";
import { buildWebSocketUrlFromBase, createRealtimeClient } from "@project_neko/realtime";
import type { RealtimeClient, RealtimeConnectionState } from "@project_neko/realtime";
import { createWebAudioService } from "@project_neko/audio-service/web";
import type { AudioServiceState } from "@project_neko/audio-service/web";
import { useLive2DAgentBackend } from "./useLive2DAgentBackend";

const trimTrailingSlash = (url?: string) => (url ? url.replace(/\/+$/, "") : "");

const API_BASE = trimTrailingSlash(
  (import.meta as any).env?.VITE_API_BASE_URL ||
  (typeof window !== "undefined" ? (window as any).API_BASE_URL : "") ||
  "http://localhost:48911"
);
const STATIC_BASE = trimTrailingSlash(
  (import.meta as any).env?.VITE_STATIC_SERVER_URL ||
  (typeof window !== "undefined" ? (window as any).STATIC_SERVER_URL : "") ||
  API_BASE
);
const WEBSOCKET_BASE = trimTrailingSlash(
  (import.meta as any).env?.VITE_WEBSOCKET_URL ||
  (typeof window !== "undefined" ? (window as any).WEBSOCKET_URL : "") ||
  API_BASE
);

// 创建一个简单的请求客户端；若无需鉴权，可忽略 token，默认存储在 localStorage
const request = createRequestClient({
  baseURL: API_BASE,
  storage: new WebTokenStorage(),
  refreshApi: async () => {
    // 示例中不做刷新，实际可按需实现
    throw new Error("refreshApi not implemented");
  },
  returnDataOnly: true
});

/**
 * Root React component demonstrating API requests and interactive UI controls.
 *
 * 展示了请求示例、StatusToast 以及 Modal 交互入口。
 */
export interface DemoProps {
  language: "zh-CN" | "en";
  onChangeLanguage: (lng: "zh-CN" | "en") => void;
}

function Demo({ language, onChangeLanguage }: DemoProps) {
  const t = useT();
  const toastRef = useRef<StatusToastHandle | null>(null);
  const modalRef = useRef<ModalHandle | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  const [toolbarGoodbyeMode, setToolbarGoodbyeMode] = useState(false);
  const [toolbarMicEnabled, setToolbarMicEnabled] = useState(false);
  const [toolbarScreenEnabled, setToolbarScreenEnabled] = useState(false);
  const [toolbarOpenPanel, setToolbarOpenPanel] = useState<Live2DRightToolbarPanel>(null);
  const [toolbarSettings, setToolbarSettings] = useState<Live2DSettingsState>({
    mergeMessages: true,
    allowInterrupt: true,
    proactiveChat: false,
    proactiveVision: false,
  });

  const { agent: toolbarAgent, onAgentChange: handleToolbarAgentChange } = useLive2DAgentBackend({
    apiBase: API_BASE,
    t,
    toastRef,
    openPanel: toolbarOpenPanel,
  });

  const handleToolbarSettingsChange = useCallback((id: Live2DSettingsToggleId, next: boolean) => {
    setToolbarSettings((prev: Live2DSettingsState) => ({ ...prev, [id]: next }));
  }, []);

  const handleSettingsMenuClick = useCallback((id: Live2DSettingsMenuId) => {
    const map: Record<Live2DSettingsMenuId, string> = {
      live2dSettings: "/l2d",
      apiKeys: "/api_key",
      characterManage: "/chara_manager",
      voiceClone: "/voice_clone",
      memoryBrowser: "/memory_browser",
      steamWorkshop: "/steam_workshop_manager",
    };
    const url = map[id];
    const newWindow = window.open(url, "_blank");
    if (!newWindow) {
      window.location.href = url;
    }
  }, []);

  const realtimeRef = useRef<RealtimeClient | null>(null);
  const realtimeOffRef = useRef<(() => void)[]>([]);
  const [realtimeState, setRealtimeState] = useState<RealtimeConnectionState>("idle");
  const isChatting = realtimeState === "connecting" || realtimeState === "open" || realtimeState === "reconnecting";

  const audioRef = useRef<ReturnType<typeof createWebAudioService> | null>(null);
  const audioOffRef = useRef<(() => void)[]>([]);
  const [audioState, setAudioState] = useState<AudioServiceState>("idle");
  const [focusModeEnabled, setFocusModeEnabled] = useState(false);
  const [outputAmp, setOutputAmp] = useState(0);
  const [inputAmp, setInputAmp] = useState(0);

  const cleanupRealtime = useCallback((args?: { disconnect?: boolean }) => {
    for (const off of realtimeOffRef.current) {
      try {
        off();
      } catch (_e) {
        // ignore
      }
    }
    realtimeOffRef.current = [];

    const client = realtimeRef.current;
    if (args?.disconnect && client) {
      try {
        client.disconnect({ code: 1000, reason: "user_stop_chat" });
      } catch (_e) {
        // ignore
      }
    }
    if (args?.disconnect) {
      realtimeRef.current = null;
    }
  }, []);

  const cleanupAudio = useCallback(() => {
    for (const off of audioOffRef.current) {
      try {
        off();
      } catch (_e) {
        // ignore
      }
    }
    audioOffRef.current = [];

    const svc = audioRef.current;
    if (svc) {
      try {
        svc.detach();
      } catch (_e) {
        // ignore
      }
    }
    audioRef.current = null;
    setAudioState("idle");
    setOutputAmp(0);
    setInputAmp(0);
  }, []);

  const getLanlanName = useCallback(() => {
    try {
      const w: any = typeof window !== "undefined" ? (window as any) : undefined;
      const name = w?.lanlan_config?.lanlan_name;
      return typeof name === "string" && name.trim() ? name.trim() : "test";
    } catch (_e) {
      return "test";
    }
  }, []);

  const buildWsUrl = useCallback((path: string) => {
    const w: any = typeof window !== "undefined" ? (window as any) : undefined;
    if (w && typeof w.buildWebSocketUrl === "function") {
      return w.buildWebSocketUrl(path);
    }
    return buildWebSocketUrlFromBase(WEBSOCKET_BASE, path);
  }, []);

  const getIsMobile = useCallback(() => {
    try {
      if (typeof navigator === "undefined") return false;
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    } catch (_e) {
      return false;
    }
  }, []);

  const ensureAudioService = useCallback(() => {
    const client = realtimeRef.current;
    if (!client) throw new Error("Realtime client not initialized");

    if (audioRef.current) return audioRef.current;

    const svc = createWebAudioService({
      client: client as any,
      isMobile: getIsMobile(),
      focusModeEnabled,
      decoder: "global",
    });

    audioRef.current = svc;
    setAudioState(svc.getState());
    audioOffRef.current = [
      svc.on("state", ({ state }) => setAudioState(state)),
      svc.on("outputAmplitude", ({ amplitude }) => setOutputAmp(amplitude)),
      svc.on("inputAmplitude", ({ amplitude }) => setInputAmp(amplitude)),
    ];

    // 与 WS 生命周期解耦：只要创建过就 attach（内部只绑定监听一次）
    svc.attach();
    return svc;
  }, [focusModeEnabled, getIsMobile]);

  const handleStartChat = useCallback(() => {
    const lanlanName = getLanlanName();
    const path = `/ws/${encodeURIComponent(lanlanName)}`;

    // 已有 client：直接触发 connect（避免重复绑定监听）
    if (realtimeRef.current) {
      realtimeRef.current.connect();
      return;
    }

    const client = createRealtimeClient({
      path,
      buildUrl: buildWsUrl,
      heartbeat: { intervalMs: 30_000, payload: { action: "ping" } },
      reconnect: { enabled: true },
    });
    realtimeRef.current = client;
    setRealtimeState(client.getState());

    realtimeOffRef.current = [
      client.on("state", ({ state }) => setRealtimeState(state)),
      client.on("open", () => {
        toastRef.current?.show(tOrDefault(t, "webapp.toast.chatConnected", "聊天 WebSocket 已连接"), 2000);
        // WS 打开后就绪 audio service（只创建一次）
        try {
          ensureAudioService();
        } catch (_e) {
          // ignore
        }
      }),
      client.on("close", () => {
        toastRef.current?.show(tOrDefault(t, "webapp.toast.chatDisconnected", "聊天 WebSocket 已断开"), 2000);
      }),
      client.on("error", ({ event }) => {
        console.warn("[webapp] realtime error:", event);
      }),
      client.on("json", ({ json }) => {
        // 这里先做最小接入：把消息打到控制台，后续可把协议对接到 ChatContainer 的数据流
        console.log("[webapp] realtime json:", json);
      }),
    ];

    client.connect();
  }, [buildWsUrl, ensureAudioService, getLanlanName, t]);

  const handleStopChat = useCallback(() => {
    cleanupAudio();
    cleanupRealtime({ disconnect: true });
    setRealtimeState("closed");
  }, [cleanupAudio, cleanupRealtime]);

  useEffect(() => {
    return () => {
      cleanupAudio();
      cleanupRealtime({ disconnect: true });
    };
  }, [cleanupAudio, cleanupRealtime]);

  useEffect(() => {
    // focusMode 状态同步到 audio service（若已创建）
    if (!audioRef.current) return;
    try {
      audioRef.current.setFocusMode(focusModeEnabled);
    } catch (_e) {
      // ignore
    }
  }, [focusModeEnabled]);

  useEffect(() => {
    const getLang = () => {
      try {
        const w: any = typeof window !== "undefined" ? (window as any) : undefined;
        return (
          w?.i18n?.language ||
          (typeof localStorage !== "undefined" ? localStorage.getItem("i18nextLng") : null) ||
          (typeof navigator !== "undefined" ? navigator.language : null) ||
          "unknown"
        );
      } catch (_e) {
        return "unknown";
      }
    };

    console.log("[webapp] 当前 i18n 语言:", getLang());

    const onLocaleChange = () => {
      console.log("[webapp] i18n 语言已更新:", getLang());
    };
    window.addEventListener("localechange", onLocaleChange);
    return () => window.removeEventListener("localechange", onLocaleChange);
  }, []);

  const handleClick = useCallback(async () => {
    try {
      const data = await request.get("/api/config/page_config", {
        params: { lanlan_name: "test" }
      });
      // 将返回结果展示在控制台或弹窗
      console.log("page_config:", data);
    } catch (err: any) {
      console.error(tOrDefault(t, "webapp.errors.requestFailed", "请求失败"), err);
    }
  }, [t]);

  const handleToast = useCallback(() => {
    toastRef.current?.show(
      tOrDefault(t, "webapp.toast.apiSuccess", "接口调用成功（示例 toast）"),
      2500
    );
  }, [t]);

  const handleAlert = useCallback(async () => {
    await modalRef.current?.alert(
      tOrDefault(t, "webapp.modal.alertMessage", "这是一条 Alert 弹窗"),
      tOrDefault(t, "webapp.modal.alertTitle", "提示")
    );
  }, [t]);

  const handleConfirm = useCallback(async () => {
    const ok =
      (await modalRef.current?.confirm(tOrDefault(t, "webapp.modal.confirmMessage", "确认要执行该操作吗？"), tOrDefault(t, "webapp.modal.confirmTitle", "确认"), {
        okText: tOrDefault(t, "webapp.modal.okText", "好的"),
        cancelText: tOrDefault(t, "webapp.modal.cancelText", "再想想"),
        danger: false,
      })) ?? false;
    if (ok) {
      toastRef.current?.show(tOrDefault(t, "webapp.toast.confirmed", "确认已执行"), 2000);
    }
  }, [t]);

  const handlePrompt = useCallback(async () => {
    const name = await modalRef.current?.prompt(tOrDefault(t, "webapp.modal.promptMessage", "请输入昵称："), "Neko");
    if (name) {
      toastRef.current?.show(
        tOrDefault(t, "webapp.toast.hello", `你好，${name}!`, { name }),
        2500
      );
    }
  }, [t]);

  const handleStartVoiceSession = useCallback(async () => {
    try {
      if (!realtimeRef.current) {
        toastRef.current?.show("请先连接聊天 WebSocket", 2500);
        return;
      }
      const svc = ensureAudioService();
      await svc.startVoiceSession({ timeoutMs: 10_000, targetSampleRate: getIsMobile() ? 16000 : 48000 });
      toastRef.current?.show("语音会话已启动", 2000);
    } catch (e: any) {
      console.error("[webapp] startVoiceSession failed:", e);
      toastRef.current?.show(`启动语音失败：${e?.message || e}`, 3500);
    }
  }, [ensureAudioService, getIsMobile]);

  const handleStopVoiceSession = useCallback(async () => {
    try {
      const svc = audioRef.current;
      if (!svc) return;
      await svc.stopVoiceSession();
      toastRef.current?.show("语音会话已停止", 1500);
    } catch (e: any) {
      console.error("[webapp] stopVoiceSession failed:", e);
      toastRef.current?.show(`停止语音失败：${e?.message || e}`, 3500);
    }
  }, []);

  const handleInterruptPlayback = useCallback(() => {
    try {
      audioRef.current?.stopPlayback();
      toastRef.current?.show("已打断播放", 1200);
    } catch (_e) {
      // ignore
    }
  }, []);

  return (
    <>
      <StatusToast ref={toastRef} staticBaseUrl={STATIC_BASE} />
      <Modal ref={modalRef} />
      <Live2DRightToolbar
        visible
        micEnabled={toolbarMicEnabled}
        screenEnabled={toolbarScreenEnabled}
        goodbyeMode={toolbarGoodbyeMode}
        openPanel={toolbarOpenPanel}
        onOpenPanelChange={setToolbarOpenPanel}
        settings={toolbarSettings}
        onSettingsChange={handleToolbarSettingsChange}
        agent={toolbarAgent}
        onAgentChange={handleToolbarAgentChange}
        onToggleMic={(next) => {
          setToolbarMicEnabled(next);
        }}
        onToggleScreen={(next) => {
          setToolbarScreenEnabled(next);
        }}
        onGoodbye={() => {
          setToolbarGoodbyeMode(true);
          setToolbarOpenPanel(null);
        }}
        onReturn={() => {
          setToolbarGoodbyeMode(false);
        }}
        onSettingsMenuClick={handleSettingsMenuClick}
      />
      <main className="app">
        <header className="app__header">
          <div className="app__headerRow">
            <div className="app__headerText">
              <h1>{tOrDefault(t, "webapp.header.title", "N.E.K.O 前端主页")}</h1>
              <p>{tOrDefault(t, "webapp.header.subtitle", "单页应用，无路由 / 无 SSR")}</p>
            </div>
            <div className="langSwitch">
              <label className="langSwitch__label" htmlFor="lang-select">
                {tOrDefault(t, "webapp.language.label", "语言")}
              </label>
              <select
                id="lang-select"
                className="langSwitch__select"
                value={language}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  onChangeLanguage(e.target.value as "zh-CN" | "en")
                }
              >
                <option value="zh-CN">{tOrDefault(t, "webapp.language.zhCN", "中文")}</option>
                <option value="en">{tOrDefault(t, "webapp.language.en", "English")}</option>
              </select>
            </div>
          </div>
        </header>
        <section className="app__content">
          <div className="card">
            <h2>{tOrDefault(t, "webapp.card.title", "开始使用")}</h2>
            <ol>
              <li>{tOrDefault(t, "webapp.card.step1", "在此处挂载你的组件或业务入口。")}</li>
              <li>
                {tOrDefault(t, "webapp.card.step2Prefix", "如需调用接口，可在 ")}
                <code>@project_neko/request</code>
                {tOrDefault(t, "webapp.card.step2Suffix", " 基础上封装请求。")}
              </li>
              <li>
                {tOrDefault(t, "webapp.card.step3Prefix", "构建产物输出到 ")}
                <code>frontend/dist/webapp</code>
                {tOrDefault(t, "webapp.card.step3Suffix", "（用于开发/调试），模板按需引用即可。")}
              </li>
            </ol>
            <div className="card__actions">
              <Button onClick={handleClick}>{tOrDefault(t, "webapp.actions.requestPageConfig", "请求 page_config")}</Button>
              <Button variant="secondary" onClick={handleToast}>
                {tOrDefault(t, "webapp.actions.showToast", "显示 StatusToast")}
              </Button>
              <Button variant="secondary" onClick={() => setIsQrModalOpen(true)}>
                {tOrDefault(t, "webapp.actions.showQrDrawer", "显示二维码")}
              </Button>
              <Button variant="primary" onClick={handleAlert}>
                {tOrDefault(t, "webapp.actions.modalAlert", "Modal Alert")}
              </Button>
              <Button variant="success" onClick={handleConfirm}>
                {tOrDefault(t, "webapp.actions.modalConfirm", "Modal Confirm")}
              </Button>
              <Button variant="danger" onClick={handlePrompt}>
                {tOrDefault(t, "webapp.actions.modalPrompt", "Modal Prompt")}
              </Button>
            </div>
            <div className="card__actions">
              {isChatting ? (
                <Button variant="primary" onClick={handleStopChat}>
                  {tOrDefault(t, "webapp.actions.stopChat", "🎤 停止聊天")}
                </Button>
              ) : (
                <Button variant="primary" onClick={handleStartChat}>
                  {tOrDefault(t, "webapp.actions.startChat", "🎤 开始聊天")}
                </Button>
              )}
            </div>
            <div className="card__actions">
              <Button variant="primary" onClick={handleStartVoiceSession} disabled={realtimeState !== "open"}>
                开始语音会话
              </Button>
              <Button variant="secondary" onClick={handleStopVoiceSession}>
                停止语音会话
              </Button>
              <Button variant="danger" onClick={handleInterruptPlayback}>
                打断播放
              </Button>
            </div>
            <div className="card__actions">
              <label className="langSwitch__label" htmlFor="focus-mode-toggle">
                Focus mode（播放中不回传麦克风）
              </label>
              <input
                id="focus-mode-toggle"
                type="checkbox"
                checked={focusModeEnabled}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setFocusModeEnabled(e.target.checked)}
              />
              <span style={{ marginLeft: 12 }}>
                WS: {realtimeState} / Audio: {audioState} / outAmp: {outputAmp.toFixed(2)} / inAmp: {inputAmp.toFixed(2)}
              </span>
            </div>
          </div>
          {/* 👇 新增：聊天系统 React 迁移 Demo */}
          <div className="chatDemo">
            <ChatContainer />
          </div>
        </section>
      </main>

      <QrMessageBox
        apiBase={API_BASE}
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        title={tOrDefault(t, "webapp.qrDrawer.title", "二维码")}
        endpoint="/getipqrcode?format=deeplink&path=main"
      />
    </>
  );
}

export default Demo;
