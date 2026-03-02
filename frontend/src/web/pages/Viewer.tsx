/**
 * Viewer Page
 *
 * Migrated from templates/viewer.html
 * Live2D/VRM model viewer overlay
 */

import { useEffect, useRef } from "react";
import "./Viewer.css";

export default function Viewer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // TODO: Initialize Live2D viewer
    // This would load the model and set up rendering
    console.log("Viewer initialized");
  }, []);

  return (
    <div className="viewer-page">
      <div id="live2d-container">
        <canvas ref={canvasRef} id="live2d-canvas" />
        <div className="viewer-placeholder">
          <p>模型查看器</p>
          <p className="hint">Live2D/VRM 模型将在此显示</p>
        </div>
      </div>
    </div>
  );
}
