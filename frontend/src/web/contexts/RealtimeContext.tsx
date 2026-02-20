/**
 * Realtime Context
 *
 * Provides WebSocket connection and chat state to the entire app.
 * Uses the useWebSocket and useChat hooks internally.
 */

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { useChat } from "../hooks/useChat";
import type {
  ConnectionStatus,
  ChatMessage,
  AgentState,
  ClientMessage,
  ServerMessage,
} from "../hooks/useWebSocket.types";

// ==================== Context Types ====================

interface RealtimeContextValue {
  // Connection state
  connectionStatus: ConnectionStatus;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;

  // Chat state
  messages: ChatMessage[];
  isStreaming: boolean;
  inputMode: "idle" | "text" | "audio" | "screen" | "camera";
  sendTextMessage: (text: string) => void;
  startTextSession: () => void;
  endSession: () => void;
  clearMessages: () => void;

  // Agent state
  agentState: AgentState;

  // Raw send
  send: (message: ClientMessage) => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

// ==================== Provider Props ====================

interface RealtimeProviderProps {
  children: ReactNode;

  /**
   * Current character name for WebSocket path
   */
  characterName?: string;

  /**
   * Function to build WebSocket URL
   */
  buildWebSocketUrl?: (path: string) => string;

  /**
   * Auto-connect on mount (default: true)
   */
  autoConnect?: boolean;

  /**
   * Called when connection status changes
   */
  onConnectionChange?: (status: ConnectionStatus) => void;
}

// ==================== Provider Component ====================

export function RealtimeProvider({
  children,
  characterName,
  buildWebSocketUrl,
  autoConnect = true,
  onConnectionChange,
}: RealtimeProviderProps) {
  const [serverMessage, setServerMessage] = useState<ServerMessage | null>(null);

  // WebSocket path based on character name
  const wsPath = useMemo(() => {
    return characterName ? `/ws/${characterName}` : "";
  }, [characterName]);

  // Handle incoming messages
  const handleMessage = useCallback((message: ServerMessage) => {
    setServerMessage(message);
  }, []);

  // WebSocket connection
  const {
    status: connectionStatus,
    isConnected,
    connect,
    disconnect,
    send,
  } = useWebSocket({
    path: wsPath,
    buildUrl: buildWebSocketUrl,
    autoConnect: autoConnect && !!characterName,
    onMessage: handleMessage,
  });

  // Chat state management
  const {
    messages,
    agentState,
    isStreaming,
    inputMode,
    handleServerMessage,
    sendTextMessage,
    startTextSession,
    endSession,
    clearMessages,
  } = useChat({
    sendMessage: send,
  });

  // Process server messages
  useEffect(() => {
    if (serverMessage) {
      handleServerMessage(serverMessage);
      setServerMessage(null);
    }
  }, [serverMessage, handleServerMessage]);

  // Notify on connection change
  useEffect(() => {
    onConnectionChange?.(connectionStatus);
  }, [connectionStatus, onConnectionChange]);

  // Context value
  const value = useMemo<RealtimeContextValue>(
    () => ({
      connectionStatus,
      isConnected,
      connect,
      disconnect,
      messages,
      isStreaming,
      inputMode,
      sendTextMessage,
      startTextSession,
      endSession,
      clearMessages,
      agentState,
      send,
    }),
    [
      connectionStatus,
      isConnected,
      connect,
      disconnect,
      messages,
      isStreaming,
      inputMode,
      sendTextMessage,
      startTextSession,
      endSession,
      clearMessages,
      agentState,
      send,
    ]
  );

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

// ==================== Hook ====================

/**
 * Hook to access the realtime context.
 * Must be used within a RealtimeProvider.
 */
export function useRealtime(): RealtimeContextValue {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error("useRealtime must be used within a RealtimeProvider");
  }
  return context;
}

// ==================== Optional Hook (returns null if not in provider) ====================

/**
 * Hook to access the realtime context, returns null if not in provider.
 * Useful for components that may or may not be wrapped in RealtimeProvider.
 */
export function useRealtimeOptional(): RealtimeContextValue | null {
  return useContext(RealtimeContext);
}

export default RealtimeProvider;
