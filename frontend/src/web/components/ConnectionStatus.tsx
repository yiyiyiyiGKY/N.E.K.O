/**
 * Connection Status Indicator
 *
 * Displays the current WebSocket connection status with visual feedback.
 * Memoized to prevent unnecessary re-renders when props haven't changed.
 */

import { memo, type FC } from "react";
import { useT, tOrDefault } from "@project_neko/components";
import type { ConnectionStatus } from "../hooks/useWebSocket.types";
import "./ConnectionStatus.css";

interface ConnectionStatusIndicatorProps {
  status: ConnectionStatus;
  showLabel?: boolean;
  size?: "small" | "medium" | "large";
}

const statusConfig: Record<ConnectionStatus, { labelKey: string; className: string }> = {
  idle: { labelKey: "webapp.connectionStatus.idle", className: "status-idle" },
  connecting: { labelKey: "webapp.connectionStatus.connecting", className: "status-connecting" },
  open: { labelKey: "webapp.connectionStatus.open", className: "status-connected" },
  closing: { labelKey: "webapp.connectionStatus.closing", className: "status-closing" },
  closed: { labelKey: "webapp.connectionStatus.closed", className: "status-closed" },
  reconnecting: { labelKey: "webapp.connectionStatus.reconnecting", className: "status-reconnecting" },
};

// Default fallback labels
const defaultLabels: Record<ConnectionStatus, string> = {
  idle: "未连接",
  connecting: "连接中...",
  open: "已连接",
  closing: "断开中...",
  closed: "已断开",
  reconnecting: "重连中...",
};

const ConnectionStatusIndicatorInner: FC<ConnectionStatusIndicatorProps> = ({
  status,
  showLabel = true,
  size = "medium",
}) => {
  const t = useT();
  const config = statusConfig[status];
  const label = tOrDefault(t, config.labelKey, defaultLabels[status]);

  return (
    <div className={`connection-status ${config.className} size-${size}`}>
      <span className="status-dot" />
      {showLabel && <span className="status-label">{label}</span>}
    </div>
  );
};

// Memoize the component to prevent re-renders when props are the same
export const ConnectionStatusIndicator = memo(ConnectionStatusIndicatorInner);

export default ConnectionStatusIndicator;
