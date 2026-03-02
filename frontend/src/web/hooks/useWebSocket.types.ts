/**
 * WebSocket Types
 *
 * Type definitions for WebSocket messages and events.
 */

// ==================== Connection Types ====================

export type ConnectionStatus = "idle" | "connecting" | "open" | "closing" | "closed" | "reconnecting";

// ==================== Client-to-Server Messages ====================

export interface StartSessionMessage {
  action: "start_session";
  input_type: "audio" | "screen" | "camera" | "text";
  new_session?: boolean;
}

export interface StreamDataMessage {
  action: "stream_data";
  input_type: "text" | "screen" | "camera";
  data: string;
}

export interface EndSessionMessage {
  action: "end_session";
}

export interface PauseSessionMessage {
  action: "pause_session";
}

export interface PingMessage {
  action: "ping";
}

export interface LanguageMessage {
  language: string;
}

export type ClientMessage =
  | StartSessionMessage
  | StreamDataMessage
  | EndSessionMessage
  | PauseSessionMessage
  | PingMessage
  | LanguageMessage;

// ==================== Server-to-Client Messages ====================

export interface PongMessage {
  type: "pong";
}

export interface CatgirlSwitchedMessage {
  type: "catgirl_switched";
  new_catgirl: string;
  old_catgirl: string;
}

export interface StatusMessage {
  type: "status";
  message: string;
}

export interface SessionPreparingMessage {
  type: "session_preparing";
  input_mode: string;
}

export interface SessionStartedMessage {
  type: "session_started";
  input_mode: string;
}

export interface SessionFailedMessage {
  type: "session_failed";
  input_mode: string;
  message: string;
}

export interface SessionEndedMessage {
  type: "session_ended_by_server";
  input_mode: string;
}

export interface GeminiResponseMessage {
  type: "gemini_response";
  text: string;
  isNewMessage: boolean;
}

export interface UserTranscriptMessage {
  type: "user_transcript";
  text: string;
}

export interface UserActivityMessage {
  type: "user_activity";
  interrupted_speech_id?: string;
}

export interface AudioChunkMessage {
  type: "audio_chunk";
  speech_id: string;
}

export interface CozyAudioMessage {
  type: "cozy_audio";
  format: string;
  audioData: string;
  isNewMessage: boolean;
}

export interface ExpressionMessage {
  type: "expression";
  message: string;
}

export interface SystemMessage {
  type: "system";
  data: string;
}

export interface ResponseDiscardedMessage {
  type: "response_discarded";
  reason: string;
  attempt: number;
  max_attempts: number;
  will_retry: boolean;
  message: string;
}

export interface AutoCloseMicMessage {
  type: "auto_close_mic";
  message: string;
}

export interface RepetitionWarningMessage {
  type: "repetition_warning";
  name: string;
}

export interface ScreenShareErrorMessage {
  type: "screen_share_error";
  message: string;
}

export interface ReloadPageMessage {
  type: "reload_page";
  message: string;
}

export interface AgentStatusUpdateMessage {
  type: "agent_status_update";
  snapshot: {
    status: string;
    current_task?: string;
    [key: string]: unknown;
  };
}

export interface AgentNotificationMessage {
  type: "agent_notification";
  text: string;
  source: string;
}

export interface AgentTaskUpdateMessage {
  type: "agent_task_update";
  task: {
    id: string;
    status: string;
    progress?: number;
    [key: string]: unknown;
  };
}

export interface HeartbeatMessage {
  type: "heartbeat";
  timestamp: number;
}

export type ServerMessage =
  | PongMessage
  | CatgirlSwitchedMessage
  | StatusMessage
  | SessionPreparingMessage
  | SessionStartedMessage
  | SessionFailedMessage
  | SessionEndedMessage
  | GeminiResponseMessage
  | UserTranscriptMessage
  | UserActivityMessage
  | AudioChunkMessage
  | CozyAudioMessage
  | ExpressionMessage
  | SystemMessage
  | ResponseDiscardedMessage
  | AutoCloseMicMessage
  | RepetitionWarningMessage
  | ScreenShareErrorMessage
  | ReloadPageMessage
  | AgentStatusUpdateMessage
  | AgentNotificationMessage
  | AgentTaskUpdateMessage
  | HeartbeatMessage;

// ==================== Chat Types ====================

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

// ==================== Agent Types ====================

export interface AgentState {
  status: "idle" | "thinking" | "acting" | "waiting" | "error";
  currentTask?: string;
  notifications: AgentNotification[];
  tasks: AgentTask[];
}

export interface AgentNotification {
  id: string;
  text: string;
  source: string;
  timestamp: number;
}

export interface AgentTask {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  progress?: number;
  [key: string]: unknown;
}
