/**
 * useWebSocket Hook
 *
 * A React hook for managing WebSocket connections using @project_neko/realtime.
 * Provides connection state management, message handling, and reconnection logic.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createRealtimeClient, type RealtimeClient, type RealtimeConnectionState } from "@project_neko/realtime";
import type { ConnectionStatus, ServerMessage, ClientMessage } from "./useWebSocket.types";

export interface UseWebSocketOptions {
  /**
   * WebSocket path (e.g., "/ws/catgirl_name")
   */
  path: string;

  /**
   * Function to build full WebSocket URL from path
   */
  buildUrl?: (path: string) => string;

  /**
   * Auto-connect on mount (default: true)
   */
  autoConnect?: boolean;

  /**
   * Heartbeat interval in ms (default: 30000)
   */
  heartbeatInterval?: number;

  /**
   * Enable auto-reconnect (default: true)
   */
  reconnect?: boolean;

  /**
   * Called when a JSON message is received
   */
  onMessage?: (message: ServerMessage) => void;

  /**
   * Called when connection opens
   */
  onOpen?: () => void;

  /**
   * Called when connection closes
   */
  onClose?: () => void;

  /**
   * Called on connection error
   */
  onError?: (error: unknown) => void;
}

export interface UseWebSocketReturn {
  /**
   * Current connection status
   */
  status: ConnectionStatus;

  /**
   * Whether the connection is ready to send/receive
   */
  isConnected: boolean;

  /**
   * Connect to the WebSocket server
   */
  connect: () => void;

  /**
   * Disconnect from the WebSocket server
   */
  disconnect: () => void;

  /**
   * Send a message to the server
   */
  send: (message: ClientMessage) => void;

  /**
   * Send raw data to the server
   */
  sendRaw: (data: string | ArrayBuffer | Blob) => void;

  /**
   * The underlying realtime client instance
   */
  client: RealtimeClient | null;
}

/**
 * Convert RealtimeConnectionState to ConnectionStatus
 */
function mapConnectionState(state: RealtimeConnectionState): ConnectionStatus {
  return state;
}

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const {
    path,
    buildUrl,
    autoConnect = true,
    heartbeatInterval = 30000,
    reconnect = true,
    onMessage,
    onOpen,
    onClose,
    onError,
  } = options;

  const clientRef = useRef<RealtimeClient | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("idle");

  // Create client on mount or when path changes
  useEffect(() => {
    if (!path) return;

    const client = createRealtimeClient({
      path,
      buildUrl,
      heartbeat: {
        intervalMs: heartbeatInterval,
        payload: { action: "ping" },
      },
      reconnect: {
        enabled: reconnect,
        minDelayMs: 3000,
        maxDelayMs: 30000,
      },
    });

    // Set up event handlers
    const unsubState = client.on("state", ({ state }) => {
      setStatus(mapConnectionState(state));
    });

    const unsubOpen = client.on("open", () => {
      onOpen?.();
    });

    const unsubClose = client.on("close", () => {
      onClose?.();
    });

    const unsubError = client.on("error", ({ event }) => {
      onError?.(event);
    });

    const unsubJson = client.on("json", ({ json }) => {
      onMessage?.(json as ServerMessage);
    });

    clientRef.current = client;

    // Auto-connect if enabled
    if (autoConnect) {
      client.connect();
    }

    // Cleanup on unmount
    return () => {
      unsubState();
      unsubOpen();
      unsubClose();
      unsubError();
      unsubJson();
      client.disconnect();
      clientRef.current = null;
    };
  }, [path, buildUrl, autoConnect, heartbeatInterval, reconnect, onMessage, onOpen, onClose, onError]);

  const connect = useCallback(() => {
    clientRef.current?.connect();
  }, []);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
  }, []);

  const send = useCallback((message: ClientMessage) => {
    clientRef.current?.sendJson(message);
  }, []);

  const sendRaw = useCallback((data: string | ArrayBuffer | Blob) => {
    clientRef.current?.send(data);
  }, []);

  return {
    status,
    isConnected: status === "open",
    connect,
    disconnect,
    send,
    sendRaw,
    client: clientRef.current,
  };
}

export default useWebSocket;
