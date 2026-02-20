/**
 * useChat Hook Tests
 *
 * Tests the chat state management hook.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useChat } from "../useChat";
import type { ServerMessage } from "../useWebSocket.types";

describe("useChat", () => {
  const mockSendMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("should initialize with empty messages", () => {
      const { result } = renderHook(() =>
        useChat({ sendMessage: mockSendMessage })
      );

      expect(result.current.messages).toEqual([]);
    });

    it("should initialize with idle input mode", () => {
      const { result } = renderHook(() =>
        useChat({ sendMessage: mockSendMessage })
      );

      expect(result.current.inputMode).toBe("idle");
    });

    it("should initialize with not streaming", () => {
      const { result } = renderHook(() =>
        useChat({ sendMessage: mockSendMessage })
      );

      expect(result.current.isStreaming).toBe(false);
    });

    it("should initialize with default agent state", () => {
      const { result } = renderHook(() =>
        useChat({ sendMessage: mockSendMessage })
      );

      expect(result.current.agentState.status).toBe("idle");
      expect(result.current.agentState.notifications).toEqual([]);
      expect(result.current.agentState.tasks).toEqual([]);
    });
  });

  describe("handleServerMessage", () => {
    it("should handle gemini_response with new message", () => {
      const { result } = renderHook(() =>
        useChat({ sendMessage: mockSendMessage })
      );

      act(() => {
        result.current.handleServerMessage({
          type: "gemini_response",
          text: "Hello",
          isNewMessage: true,
        } as ServerMessage);
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].role).toBe("assistant");
      expect(result.current.messages[0].content).toBe("Hello");
      expect(result.current.messages[0].isStreaming).toBe(true);
    });

    it("should handle gemini_response appending to existing message", () => {
      const { result } = renderHook(() =>
        useChat({ sendMessage: mockSendMessage })
      );

      // First message
      act(() => {
        result.current.handleServerMessage({
          type: "gemini_response",
          text: "Hello",
          isNewMessage: true,
        } as ServerMessage);
      });

      // Append to existing
      act(() => {
        result.current.handleServerMessage({
          type: "gemini_response",
          text: " World",
          isNewMessage: false,
        } as ServerMessage);
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].content).toBe("Hello World");
    });

    it("should handle user_transcript", () => {
      const { result } = renderHook(() =>
        useChat({ sendMessage: mockSendMessage })
      );

      act(() => {
        result.current.handleServerMessage({
          type: "user_transcript",
          text: "Hi there",
        } as ServerMessage);
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].role).toBe("user");
      expect(result.current.messages[0].content).toBe("Hi there");
    });

    it("should handle system turn end", () => {
      const { result } = renderHook(() =>
        useChat({ sendMessage: mockSendMessage })
      );

      // Start streaming
      act(() => {
        result.current.handleServerMessage({
          type: "gemini_response",
          text: "Hello",
          isNewMessage: true,
        } as ServerMessage);
      });

      expect(result.current.messages[0].isStreaming).toBe(true);

      // Turn end
      act(() => {
        result.current.handleServerMessage({
          type: "system",
          data: "turn end",
        } as ServerMessage);
      });

      expect(result.current.messages[0].isStreaming).toBe(false);
      expect(result.current.isStreaming).toBe(false);
    });

    it("should handle session_started", () => {
      const { result } = renderHook(() =>
        useChat({ sendMessage: mockSendMessage })
      );

      act(() => {
        result.current.handleServerMessage({
          type: "session_started",
          input_mode: "text",
        } as ServerMessage);
      });

      expect(result.current.inputMode).toBe("text");
    });

    it("should handle session_ended_by_server", () => {
      const { result } = renderHook(() =>
        useChat({ sendMessage: mockSendMessage })
      );

      // Set input mode first
      act(() => {
        result.current.handleServerMessage({
          type: "session_started",
          input_mode: "text",
        } as ServerMessage);
      });

      expect(result.current.inputMode).toBe("text");

      // End session
      act(() => {
        result.current.handleServerMessage({
          type: "session_ended_by_server",
          input_mode: "text",
        } as ServerMessage);
      });

      expect(result.current.inputMode).toBe("idle");
    });

    it("should handle agent_status_update", () => {
      const { result } = renderHook(() =>
        useChat({ sendMessage: mockSendMessage })
      );

      act(() => {
        result.current.handleServerMessage({
          type: "agent_status_update",
          snapshot: {
            status: "thinking",
            current_task: "Analyzing request",
          },
        } as ServerMessage);
      });

      expect(result.current.agentState.status).toBe("thinking");
      expect(result.current.agentState.currentTask).toBe("Analyzing request");
    });

    it("should handle agent_notification", () => {
      const { result } = renderHook(() =>
        useChat({ sendMessage: mockSendMessage })
      );

      act(() => {
        result.current.handleServerMessage({
          type: "agent_notification",
          text: "Task started",
          source: "agent",
        } as ServerMessage);
      });

      expect(result.current.agentState.notifications).toHaveLength(1);
      expect(result.current.agentState.notifications[0].text).toBe("Task started");
    });

    it("should handle agent_task_update", () => {
      const { result } = renderHook(() =>
        useChat({ sendMessage: mockSendMessage })
      );

      act(() => {
        result.current.handleServerMessage({
          type: "agent_task_update",
          task: {
            id: "task-1",
            status: "running",
            progress: 50,
          },
        } as ServerMessage);
      });

      expect(result.current.agentState.tasks).toHaveLength(1);
      expect(result.current.agentState.tasks[0].id).toBe("task-1");
      expect(result.current.agentState.tasks[0].progress).toBe(50);
    });

    it("should handle catgirl_switched by clearing messages", () => {
      const { result } = renderHook(() =>
        useChat({ sendMessage: mockSendMessage })
      );

      // Add a message first
      act(() => {
        result.current.handleServerMessage({
          type: "user_transcript",
          text: "Hello",
        } as ServerMessage);
      });

      expect(result.current.messages).toHaveLength(1);

      // Switch character
      act(() => {
        result.current.handleServerMessage({
          type: "catgirl_switched",
          new_catgirl: "miku",
          old_catgirl: "yui",
        } as ServerMessage);
      });

      expect(result.current.messages).toHaveLength(0);
    });
  });

  describe("sendTextMessage", () => {
    it("should add user message and send to server", () => {
      const { result } = renderHook(() =>
        useChat({ sendMessage: mockSendMessage })
      );

      act(() => {
        result.current.sendTextMessage("Hello AI");
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].role).toBe("user");
      expect(result.current.messages[0].content).toBe("Hello AI");

      expect(mockSendMessage).toHaveBeenCalledWith({
        action: "stream_data",
        input_type: "text",
        data: "Hello AI",
      });
    });

    it("should not send empty messages", () => {
      const { result } = renderHook(() =>
        useChat({ sendMessage: mockSendMessage })
      );

      act(() => {
        result.current.sendTextMessage("");
      });

      expect(result.current.messages).toHaveLength(0);
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it("should set isStreaming to true", () => {
      const { result } = renderHook(() =>
        useChat({ sendMessage: mockSendMessage })
      );

      expect(result.current.isStreaming).toBe(false);

      act(() => {
        result.current.sendTextMessage("Hello");
      });

      expect(result.current.isStreaming).toBe(true);
    });
  });

  describe("startTextSession", () => {
    it("should send start_session message", () => {
      const { result } = renderHook(() =>
        useChat({ sendMessage: mockSendMessage })
      );

      act(() => {
        result.current.startTextSession();
      });

      expect(mockSendMessage).toHaveBeenCalledWith({
        action: "start_session",
        input_type: "text",
        new_session: true,
      });
    });
  });

  describe("endSession", () => {
    it("should send end_session message and reset state", () => {
      const { result } = renderHook(() =>
        useChat({ sendMessage: mockSendMessage })
      );

      // Start streaming
      act(() => {
        result.current.sendTextMessage("Hello");
      });

      expect(result.current.isStreaming).toBe(true);

      // End session
      act(() => {
        result.current.endSession();
      });

      expect(mockSendMessage).toHaveBeenCalledWith({
        action: "end_session",
      });
      expect(result.current.inputMode).toBe("idle");
      expect(result.current.isStreaming).toBe(false);
    });
  });

  describe("clearMessages", () => {
    it("should clear all messages", () => {
      const { result } = renderHook(() =>
        useChat({ sendMessage: mockSendMessage })
      );

      // Add messages
      act(() => {
        result.current.handleServerMessage({
          type: "user_transcript",
          text: "Hello",
        } as ServerMessage);
      });

      expect(result.current.messages).toHaveLength(1);

      // Clear
      act(() => {
        result.current.clearMessages();
      });

      expect(result.current.messages).toHaveLength(0);
    });
  });
});
