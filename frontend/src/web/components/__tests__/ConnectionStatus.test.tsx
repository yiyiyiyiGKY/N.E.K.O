/**
 * ConnectionStatus Component Tests
 *
 * Tests the connection status indicator component.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConnectionStatusIndicator } from "../ConnectionStatus";
import type { ConnectionStatus } from "../../hooks/useWebSocket.types";

describe("ConnectionStatusIndicator", () => {
  describe("rendering", () => {
    it("should render with default props", () => {
      render(<ConnectionStatusIndicator status="open" />);

      expect(screen.getByText("已连接")).toBeInTheDocument();
    });

    it("should render status dot", () => {
      const { container } = render(<ConnectionStatusIndicator status="open" />);

      const dot = container.querySelector(".status-dot");
      expect(dot).toBeInTheDocument();
    });

    it("should hide label when showLabel is false", () => {
      const { container } = render(
        <ConnectionStatusIndicator status="open" showLabel={false} />
      );

      expect(screen.queryByText("已连接")).not.toBeInTheDocument();
      expect(container.querySelector(".status-dot")).toBeInTheDocument();
    });
  });

  describe("status states", () => {
    const statusCases: { status: ConnectionStatus; label: string; className: string }[] = [
      { status: "idle", label: "未连接", className: "status-idle" },
      { status: "connecting", label: "连接中...", className: "status-connecting" },
      { status: "open", label: "已连接", className: "status-connected" },
      { status: "closing", label: "断开中...", className: "status-closing" },
      { status: "closed", label: "已断开", className: "status-closed" },
      { status: "reconnecting", label: "重连中...", className: "status-reconnecting" },
    ];

    statusCases.forEach(({ status, label, className }) => {
      it(`should render correct label and class for ${status} status`, () => {
        const { container } = render(
          <ConnectionStatusIndicator status={status} />
        );

        expect(screen.getByText(label)).toBeInTheDocument();
        expect(container.querySelector(`.${className}`)).toBeInTheDocument();
      });
    });
  });

  describe("sizes", () => {
    it("should render small size", () => {
      const { container } = render(
        <ConnectionStatusIndicator status="open" size="small" />
      );

      expect(container.querySelector(".size-small")).toBeInTheDocument();
    });

    it("should render medium size (default) without size class", () => {
      const { container } = render(
        <ConnectionStatusIndicator status="open" />
      );

      // Medium is default, no size class is added
      expect(container.querySelector(".size-small")).not.toBeInTheDocument();
      expect(container.querySelector(".size-large")).not.toBeInTheDocument();
    });

    it("should render large size", () => {
      const { container } = render(
        <ConnectionStatusIndicator status="open" size="large" />
      );

      expect(container.querySelector(".size-large")).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("should be visible and readable", () => {
      render(<ConnectionStatusIndicator status="open" />);

      const label = screen.getByText("已连接");
      expect(label).toBeVisible();
    });
  });
});
