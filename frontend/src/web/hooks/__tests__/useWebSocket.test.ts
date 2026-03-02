/**
 * useWebSocket Hook Tests
 *
 * Tests the WebSocket connection management hook.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWebSocket } from "../useWebSocket";

// Mock @project_neko/realtime
vi.mock("@project_neko/realtime", () => ({
  createRealtimeClient: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    send: vi.fn(),
    sendJson: vi.fn(),
    getState: vi.fn(() => "idle"),
    getUrl: vi.fn(() => "ws://localhost:8080/ws/test"),
    getSocket: vi.fn(() => null),
    on: vi.fn(() => vi.fn()), // Returns unsubscribe function
  })),
}));

describe("useWebSocket", () => {
  const defaultProps = {
    path: "/ws/test",
    buildUrl: vi.fn((path: string) => `ws://localhost:8080${path}`),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initialization", () => {
    it("should initialize with idle status", () => {
      const { result } = renderHook(() => useWebSocket(defaultProps));

      expect(result.current.status).toBe("idle");
      expect(result.current.isConnected).toBe(false);
    });

    it("should not auto-connect when autoConnect is false", () => {
      const { result } = renderHook(() =>
        useWebSocket({ ...defaultProps, autoConnect: false })
      );

      expect(result.current.status).toBe("idle");
    });

    it("should provide connect and disconnect methods", () => {
      const { result } = renderHook(() => useWebSocket(defaultProps));

      expect(typeof result.current.connect).toBe("function");
      expect(typeof result.current.disconnect).toBe("function");
    });

    it("should provide send methods", () => {
      const { result } = renderHook(() => useWebSocket(defaultProps));

      expect(typeof result.current.send).toBe("function");
      expect(typeof result.current.sendRaw).toBe("function");
    });
  });

  describe("connection methods", () => {
    it("should have connect method available", () => {
      const { result } = renderHook(() =>
        useWebSocket({ ...defaultProps, autoConnect: false })
      );

      // connect method should exist and be callable
      expect(typeof result.current.connect).toBe("function");

      act(() => {
        result.current.connect();
      });

      // Should not throw
    });

    it("should have disconnect method available", () => {
      const { result } = renderHook(() => useWebSocket(defaultProps));

      // disconnect method should exist and be callable
      expect(typeof result.current.disconnect).toBe("function");

      act(() => {
        result.current.disconnect();
      });

      // Should not throw
    });
  });

  describe("send methods", () => {
    it("should have send method for sending messages", () => {
      const { result } = renderHook(() => useWebSocket(defaultProps));

      const message = { action: "ping" as const };

      // send should not throw when called
      expect(() => {
        result.current.send(message);
      }).not.toThrow();
    });

    it("should have sendRaw method for sending raw data", () => {
      const { result } = renderHook(() => useWebSocket(defaultProps));

      // sendRaw should not throw when called
      expect(() => {
        result.current.sendRaw("test data");
      }).not.toThrow();
    });
  });

  describe("callbacks", () => {
    it("should accept onMessage callback", () => {
      const onMessage = vi.fn();

      renderHook(() =>
        useWebSocket({ ...defaultProps, onMessage })
      );

      // Hook should render without errors
      expect(onMessage).not.toHaveBeenCalled();
    });

    it("should accept onOpen callback", () => {
      const onOpen = vi.fn();

      renderHook(() =>
        useWebSocket({ ...defaultProps, onOpen })
      );

      expect(onOpen).not.toHaveBeenCalled();
    });

    it("should accept onClose callback", () => {
      const onClose = vi.fn();

      renderHook(() =>
        useWebSocket({ ...defaultProps, onClose })
      );

      expect(onClose).not.toHaveBeenCalled();
    });

    it("should accept onError callback", () => {
      const onError = vi.fn();

      renderHook(() =>
        useWebSocket({ ...defaultProps, onError })
      );

      expect(onError).not.toHaveBeenCalled();
    });
  });

  describe("configuration", () => {
    it("should accept custom heartbeat interval", () => {
      const { result } = renderHook(() =>
        useWebSocket({ ...defaultProps, heartbeatInterval: 10000 })
      );

      expect(result.current).toBeDefined();
    });

    it("should accept reconnect option", () => {
      const { result } = renderHook(() =>
        useWebSocket({ ...defaultProps, reconnect: false })
      );

      expect(result.current).toBeDefined();
    });
  });
});
