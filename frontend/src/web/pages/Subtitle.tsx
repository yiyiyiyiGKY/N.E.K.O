/**
 * Subtitle Page
 *
 * Migrated from templates/subtitle.html
 * Real-time subtitle display overlay
 */

import { useState, useEffect } from "react";
import "./Subtitle.css";

export default function Subtitle() {
  const [subtitleText, setSubtitleText] = useState("");
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // TODO: Connect to WebSocket for real-time subtitle updates
    // Mock subtitle display
    const timer = setInterval(() => {
      // Simulated subtitle updates
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Listen for subtitle events (to be connected with main app)
  useEffect(() => {
    const handleSubtitle = (e: CustomEvent) => {
      setSubtitleText(e.detail.text);
      setIsVisible(true);

      // Auto-hide after delay
      setTimeout(() => setIsVisible(false), 5000);
    };

    window.addEventListener("subtitle" as any, handleSubtitle);
    return () => window.removeEventListener("subtitle" as any, handleSubtitle);
  }, []);

  return (
    <div className="subtitle-page">
      <div className="subtitle-container">
        <div className={`subtitle-text ${isVisible ? "show" : ""}`}>
          {subtitleText || "等待字幕..."}
        </div>
      </div>
    </div>
  );
}
