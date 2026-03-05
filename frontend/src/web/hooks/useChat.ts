/**
 * useChat Hook
 *
 * A hook for managing chat state with real-time updates.
 * Works with useWebSocket to handle chat messages.
 */

import { useCallback, useState } from "react";
import type { ChatMessage, ServerMessage, ClientMessage, AgentState, AgentNotification, AgentTask } from "./useWebSocket.types";

export interface UseChatOptions {
  /**
   * Callback to send a message through WebSocket
   */
  sendMessage: (message: ClientMessage) => void;
}

export interface UseChatReturn {
  /**
   * List of chat messages
   */
  messages: ChatMessage[];

  /**
   * Agent state
   */
  agentState: AgentState;

  /**
   * Whether the AI is currently responding
   */
  isStreaming: boolean;

  /**
   * Current session input mode
   */
  inputMode: "idle" | "text" | "audio" | "screen" | "camera";

  /**
   * Handle a server message
   */
  handleServerMessage: (message: ServerMessage) => void;

  /**
   * Send a text message
   */
  sendTextMessage: (text: string) => void;

  /**
   * Start a text session
   */
  startTextSession: () => void;

  /**
   * End the current session
   */
  endSession: () => void;

  /**
   * Clear all messages
   */
  clearMessages: () => void;
}

// Generate a unique ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function useChat(options: UseChatOptions): UseChatReturn {
  const { sendMessage } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [inputMode, setInputMode] = useState<"idle" | "text" | "audio" | "screen" | "camera">("idle");
  const [agentState, setAgentState] = useState<AgentState>({
    status: "idle",
    notifications: [],
    tasks: [],
  });

  // Handle incoming server messages
  const handleServerMessage = useCallback((message: ServerMessage) => {
    switch (message.type) {
      case "gemini_response": {
        const { text, isNewMessage } = message;

        if (isNewMessage) {
          // Start a new assistant message
          setMessages((prev) => [
            ...prev,
            {
              id: generateId(),
              role: "assistant",
              content: text,
              timestamp: Date.now(),
              isStreaming: true,
            },
          ]);
        } else {
          // Append to the last assistant message
          setMessages((prev) => {
            const lastMessage = prev[prev.length - 1];
            if (lastMessage?.role === "assistant" && lastMessage.isStreaming) {
              return [
                ...prev.slice(0, -1),
                { ...lastMessage, content: lastMessage.content + text },
              ];
            }
            return prev;
          });
        }
        break;
      }

      case "user_transcript": {
        // Add user message
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: "user",
            content: message.text,
            timestamp: Date.now(),
          },
        ]);
        break;
      }

      case "system": {
        if (message.data === "turn end") {
          // Mark streaming as complete
          setIsStreaming(false);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.isStreaming ? { ...msg, isStreaming: false } : msg
            )
          );
        }
        break;
      }

      case "session_started": {
        setInputMode(message.input_mode as any);
        break;
      }

      case "session_ended_by_server":
      case "session_failed": {
        setInputMode("idle");
        setIsStreaming(false);
        break;
      }

      case "session_preparing": {
        setIsStreaming(true);
        break;
      }

      case "agent_status_update": {
        setAgentState((prev) => ({
          ...prev,
          status: message.snapshot.status as any,
          currentTask: message.snapshot.current_task,
        }));
        break;
      }

      case "agent_notification": {
        const notification: AgentNotification = {
          id: generateId(),
          text: message.text,
          source: message.source,
          timestamp: Date.now(),
        };
        setAgentState((prev) => ({
          ...prev,
          notifications: [...prev.notifications.slice(-50), notification],
        }));
        break;
      }

      case "agent_task_update": {
        setAgentState((prev) => {
          const taskIndex = prev.tasks.findIndex((t) => t.id === message.task.id);
          const updatedTask: AgentTask = {
            ...message.task,
            status: message.task.status as any,
          };

          if (taskIndex >= 0) {
            const newTasks = [...prev.tasks];
            newTasks[taskIndex] = updatedTask;
            return { ...prev, tasks: newTasks };
          }

          return {
            ...prev,
            tasks: [...prev.tasks, updatedTask],
          };
        });
        break;
      }

      case "catgirl_switched": {
        // Clear messages when character changes
        setMessages([]);
        break;
      }

      case "response_discarded": {
        // Remove the last assistant message if it was discarded
        setMessages((prev) => {
          const lastMessage = prev[prev.length - 1];
          if (lastMessage?.role === "assistant" && lastMessage.isStreaming) {
            return prev.slice(0, -1);
          }
          return prev;
        });
        break;
      }

      default:
        // Ignore other message types
        break;
    }
  }, []);

  // Send a text message
  const sendTextMessage = useCallback((text: string) => {
    if (!text.trim()) return;

    // Add user message optimistically
    setMessages((prev) => [
      ...prev,
      {
        id: generateId(),
        role: "user",
        content: text,
        timestamp: Date.now(),
      },
    ]);

    // Send to server
    sendMessage({
      action: "stream_data",
      input_type: "text",
      data: text,
    });

    setIsStreaming(true);
  }, [sendMessage]);

  // Start a text session
  const startTextSession = useCallback(() => {
    sendMessage({
      action: "start_session",
      input_type: "text",
      new_session: true,
    });
  }, [sendMessage]);

  // End the current session
  const endSession = useCallback(() => {
    sendMessage({
      action: "end_session",
    });
    setInputMode("idle");
    setIsStreaming(false);
  }, [sendMessage]);

  // Clear all messages
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    agentState,
    isStreaming,
    inputMode,
    handleServerMessage,
    sendTextMessage,
    startTextSession,
    endSession,
    clearMessages,
  };
}

export default useChat;
