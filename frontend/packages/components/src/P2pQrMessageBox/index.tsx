import React, { useEffect, useRef, useState } from "react";
import { useT, tOrDefault } from "../i18n";
import { BaseModal } from "../Modal/BaseModal";
import { Button } from "../Button";
import "./P2pQrMessageBox.css";

export interface P2pQrMessageBoxProps {
  apiBase: string;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

export function P2pQrMessageBox({
  apiBase,
  isOpen,
  onClose,
  title,
}: P2pQrMessageBoxProps) {
  const t = useT();
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [connectionInfo, setConnectionInfo] = useState<{
    lan_ip: string;
    port: number;
    token: string;
  } | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const qrObjectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setQrLoading(false);
      setQrError(null);
      setConnectionInfo(null);
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
      setConnectionInfo(null);

      try {
        const res = await fetch(`${apiBase}/lanproxyqrcode`, {
          method: "GET",
          signal: abortController.signal,
          headers: {
            Accept: "image/*,application/json",
          },
        });

        const ct = res.headers.get("content-type") || "";

        // Check if JSON error response
        if (ct.includes("application/json")) {
          const data = (await res.json()) as any;
          const msg =
            (typeof data?.message === "string" && data.message) ||
            tOrDefault(t, "p2pQr.unknownError", "未知错误");
          throw new Error(msg);
        }

        if (!res.ok) {
          throw new Error(tOrDefault(t, "p2pQr.fetchError", `获取失败: ${res.status}`));
        }

        // Extract headers
        const lanIp = res.headers.get("X-Lan-Ip") || "";
        const portStr = res.headers.get("X-Port") || "";
        const token = res.headers.get("X-Token") || "";

        if (lanIp && token) {
          setConnectionInfo({
            lan_ip: lanIp,
            port: parseInt(portStr, 10) || 48920,
            token,
          });
        }

        const blob = await res.blob();
        activeObjectUrl = URL.createObjectURL(blob);
        qrObjectUrlRef.current = activeObjectUrl;
        setQrImageUrl(activeObjectUrl);
      } catch (e: any) {
        if (abortController.signal.aborted) return;
        setQrError(e?.message || tOrDefault(t, "p2pQr.unknownError", "未知错误"));
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
  }, [apiBase, isOpen, t]);

  const handleCopyToken = async () => {
    if (!connectionInfo) return;
    try {
      const data = JSON.stringify({
        lan_ip: connectionInfo.lan_ip,
        port: connectionInfo.port,
        token: connectionInfo.token,
      });
      await navigator.clipboard.writeText(data);
    } catch {
      // ignore copy error
    }
  };

  const modalTitle = title || tOrDefault(t, "p2pQr.title", "P2P 连接二维码");

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title={modalTitle}>
      <div className="modal-body p2p-qr-body" aria-live="polite" aria-atomic="true">
        <div className="p2p-qr-description">
          {tOrDefault(t, "p2pQr.description", "使用手机 App 扫码，同 WiFi 下直接连接")}
        </div>

        {qrLoading && (
          <div className="p2p-qr-loading">
            {tOrDefault(t, "p2pQr.loading", "加载中…")}
          </div>
        )}

        {!qrLoading && qrError && (
          <div className="p2p-qr-error">
            <div className="p2p-qr-error-title">
              {tOrDefault(t, "p2pQr.error", "二维码加载失败")}
            </div>
            <div className="p2p-qr-error-detail">{qrError}</div>
          </div>
        )}

        {!qrLoading && !qrError && !qrImageUrl && (
          <div className="p2p-qr-placeholder">
            {tOrDefault(t, "p2pQr.placeholder", "二维码区域")}
          </div>
        )}

        {!qrLoading && !qrError && qrImageUrl && (
          <>
            <div className="p2p-qr-image-wrapper">
              <img className="p2p-qr-image" src={qrImageUrl} alt={modalTitle} />
            </div>

            {connectionInfo && (
              <>
                <div className="p2p-qr-info">
                  <div className="p2p-qr-info-row">
                    <span className="p2p-qr-info-label">IP:</span>
                    <code className="p2p-qr-info-value">{connectionInfo.lan_ip}</code>
                  </div>
                  <div className="p2p-qr-info-row">
                    <span className="p2p-qr-info-label">{tOrDefault(t, "p2pQr.port", "端口")}:</span>
                    <code className="p2p-qr-info-value">{connectionInfo.port}</code>
                  </div>
                  <div className="p2p-qr-info-row">
                    <span className="p2p-qr-info-label">Token:</span>
                    <code className="p2p-qr-info-value p2p-qr-token">
                      {connectionInfo.token.slice(0, 8)}...{connectionInfo.token.slice(-8)}
                    </code>
                  </div>
                </div>

                <div className="p2p-qr-actions">
                  <Button variant="secondary" size="sm" onClick={handleCopyToken}>
                    {tOrDefault(t, "p2pQr.copyConnectionInfo", "复制连接信息")}
                  </Button>
                </div>

                <div className="p2p-qr-divider" />

                <div className="p2p-qr-manual">
                  <div className="p2p-qr-manual-title">
                    {tOrDefault(t, "p2pQr.manualInput", "手动输入")}
                  </div>
                  <p className="p2p-qr-manual-hint">
                    {tOrDefault(
                      t,
                      "p2pQr.manualHint",
                      "如果扫码失败，请在手机端手动输入以上 IP、端口和 Token"
                    )}
                  </p>
                </div>
              </>
            )}
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

export default P2pQrMessageBox;
