// Trusted SDK avatar provider backed by the production Unity VRM runtime.
let nextCanvasId = 0;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

export function create(container) {
  const canvas = document.createElement('canvas');
  canvas.id = `watch-together-vrm-canvas-${++nextCanvasId}`;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  canvas.style.background = 'transparent';
  container.append(canvas);

  let manager = null;
  let initialized = false;
  let disposed = false;
  let paused = false;
  let viewport = {
    width: Math.max(1, Number(container.clientWidth) || 280),
    height: Math.max(1, Number(container.clientHeight) || 320),
  };

  function applyViewport() {
    manager?.resizeSurface?.(viewport.width, viewport.height, false);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    if (manager.currentModel) {
      manager.fitModel?.(viewport, { mode: 'contain', align: 'bottom-center', padding: 0 });
    }
  }

  return {
    async setModel(config) {
      if (disposed) throw new Error('Unity VRM renderer is disposed');
      if (!initialized) {
        const UnityVRMManager = await window.NekoUnityVRMLoader.ensure({ ui: false, vmc: false });
        if (typeof UnityVRMManager !== 'function') throw new Error('Unity VRM renderer is unavailable');
        manager = new UnityVRMManager();
        await manager.initRenderer(canvas.id, container.id);
        initialized = true;
        applyViewport();
      }
      await manager.loadModel(config.path, {
        embed: true,
        restorePreferences: false,
        autoPlay: false,
      });
      if (disposed) return;
      applyViewport();
      if (paused) manager?.pauseRendering?.();
    },
    resize({ width, height }) {
      viewport = {
        width: Math.max(1, Number(width) || 1),
        height: Math.max(1, Number(height) || 1),
      };
      if (initialized) applyViewport();
    },
    focus({ x, y }) {
      if (!manager?.currentModel) return false;
      const rect = canvas.getBoundingClientRect();
      const clientX = rect.left + (clamp(x, -1, 1) + 1) * rect.width / 2;
      const clientY = rect.top + (1 - (clamp(y, -1, 1) + 1) / 2) * rect.height;
      manager._cursorFollow?._onPointerMove?.({ clientX, clientY });
      return true;
    },
    setEmotion(name) {
      const expressions = manager?.currentModel?.vrm?.expressionManager;
      if (!expressions) return false;
      expressions.resetValues?.();
      if (name === 'happy') expressions.setValue?.('happy', 0.6);
      return true;
    },
    mouth(level) {
      return manager?.currentModel?.vrm?.expressionManager?.setValue?.('aa', clamp(level, 0, 1));
    },
    pause() { paused = true; manager?.pauseRendering?.(); },
    resume() { paused = false; manager?.resumeRendering?.(); },
    getState() { return { ready: Boolean(manager?.currentModel) }; },
    async dispose() {
      if (disposed) return;
      disposed = true;
      await manager?.dispose?.();
      canvas.remove();
    },
  };
}
