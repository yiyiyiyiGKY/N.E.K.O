import React, { useEffect, useRef, useState } from "react";
import { useT, tOrDefault } from "../i18n";
import { BaseModal } from "../Modal/BaseModal";
import { Button } from "../Button";
import "./QrMessageBox.css";

interface ManualInputSectionProps {
  apiBase: string;
}

function ManualInputSection({ apiBase }: ManualInputSectionProps) {
  const [host, setHost] = useState("");
  const [port, setPort] = useState("48911");
  const [copied, setCopied] = useState(false);
  const t = useT();

  // Try to extract current host from apiBase
  useEffect(() => {
    try {
      const url = new URL(apiBase);
      setHost(url.hostname);
      if (url.port) setPort(url.port);
    } catch {
      // fallback: use apiBase as host if it's just a host:port string
      const parts = apiBase.replace(/^https?:\/\//, "").split(":");
      if (parts[0]) setHost(parts[0]);
      if (parts[1]) setPort(parts[1]);
    }
  }, [apiBase]);

  const fullAddress = `${host}:${port}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text for manual copy
      const input = document.getElementById("server-address-input") as HTMLInputElement;
      if (input) {
        input.select();
      }
    }
  };

  return (
    <div className="manual-input-section">
      <div className="manual-input-title">
        {tOrDefault(t, "webapp.qrDrawer.manualInput", "手动输入地址")}
      </div>
      <div className="manual-input-row">
        <input
          id="server-address-input"
          type="text"
          className="manual-input-host"
          value={host}
          onChange={(e) => setHost(e.target.value)}
          placeholder="192.168.1.100"
        />
        <span className="manual-input-separator">:</span>
        <input
          type="text"
          className="manual-input-port"
          value={port}
          onChange={(e) => setPort(e.target.value)}
          placeholder="48911"
        />
      </div>
      <div className="manual-input-result">
        <code className="manual-input-address">{fullAddress}</code>
        <Button variant="secondary" size="sm" onClick={handleCopy}>
          {copied
            ? tOrDefault(t, "common.copied", "已复制")
            : tOrDefault(t, "common.copy", "复制")}
        </Button>
      </div>
      <div className="manual-input-hint">
        {tOrDefault(t, "webapp.qrDrawer.manualInputHint", "在 App 中手动输入以上地址")}
      </div>
    </div>
  );
}

export interface QrMessageBoxProps {
  apiBase: string;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  endpoint?: string;
}

export function QrMessageBox({
  apiBase,
  isOpen,
  onClose,
  title,
  endpoint = "/getipqrcode",
}: QrMessageBoxProps) {
  const t = useT();
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [accessUrl, setAccessUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const qrObjectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setQrLoading(false);
      setQrError(null);
      setAccessUrl(null);
      if (qrObjectUrlRef.current) {
        try {
          URL.revokeObjectURL(qrObjectUrlRef.current);
        } catch (_e) {
          // ignore
        }
        qrObjectUrlRef.current = null;
      }
      setQrImageUrl(null);
      return;
    }

    const abortController = new AbortController();
    let activeObjectUrl: string | null = null;

    const run = async () => {
      setQrLoading(true);
      setQrError(null);
      setAccessUrl(null);

      try {
        const res = await fetch(`${apiBase}${endpoint}`, {
          method: "GET",
          signal: abortController.signal,
          headers: {
            Accept: "image/*,application/json",
          },
        });

        const ct = res.headers.get("content-type") || "";

        // Backend now returns HTTP 200 + JSON on failure, so we must branch by content-type.
        if (ct.includes("application/json")) {
          const data = (await res.json()) as any;
          const msg =
            (typeof data?.message === "string" && data.message) ||
            (typeof data?.error === "string" && data.error) ||
            tOrDefault(t, "webapp.qrDrawer.unknownError", "未知錯誤");
          throw new Error(msg);
        }

        if (!res.ok) {
          // Non-JSON errors (proxy/server), keep the status for debugging.
          throw new Error(tOrDefault(t, "webapp.qrDrawer.fetchError", `獲取失敗: ${res.status}`));
        }

        const blob = await res.blob();
        activeObjectUrl = URL.createObjectURL(blob);
        qrObjectUrlRef.current = activeObjectUrl;
        setQrImageUrl(activeObjectUrl);
        setAccessUrl(res.headers.get("X-Neko-Access-Url"));
        return;
      } catch (e: any) {
        if (abortController.signal.aborted) return;
        setQrError(e?.message || tOrDefault(t, "webapp.qrDrawer.unknownError", "未知錯誤"));
      } finally {
        if (!abortController.signal.aborted) setQrLoading(false);
      }
    };

    run();

    return () => {
      abortController.abort();
      if (activeObjectUrl) {
        try {
          URL.revokeObjectURL(activeObjectUrl);
        } catch (_e) {
          // ignore
        }
        if (qrObjectUrlRef.current === activeObjectUrl) {
          qrObjectUrlRef.current = null;
        }
      }
    };
  }, [apiBase, endpoint, isOpen, t]);

  const modalTitle = title || tOrDefault(t, "webapp.qrDrawer.title", "二维码");

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title={modalTitle}>
      <div className="modal-body" aria-live="polite" aria-atomic="true">
        {qrLoading && tOrDefault(t, "webapp.qrDrawer.loading", "加载中…")}
        {!qrLoading && qrError && (
          <div className="qr-error">
            {tOrDefault(t, "webapp.qrDrawer.error", "二维码加载失败")}
            <div className="qr-error-detail">{qrError}</div>
          </div>
        )}
        {!qrLoading && !qrError && !qrImageUrl &&
          tOrDefault(t, "webapp.qrDrawer.placeholder", "二维码区域（待接入）")}
        {!qrLoading && !qrError && qrImageUrl && (
          <>
            <img className="qr-image" src={qrImageUrl} alt={modalTitle} />
            {accessUrl && <div className="qr-url">{accessUrl}</div>}
            <div className="qr-divider" />
            <ManualInputSection apiBase={apiBase} />
          </>
        )}
      </div>
      <div className="modal-footer">
        <Button variant="secondary" onClick={onClose}>
          {tOrDefault(t, "common.close", "关闭")}
        </Button>
      </div>
    </BaseModal>
  );
}

export default QrMessageBox;
