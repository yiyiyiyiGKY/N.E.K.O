const container = document.getElementById('air-neko-avatar');
const live2dElement = document.getElementById('air-neko-live2d');
const vrmElement = document.getElementById('air-neko-vrm');

function showRenderer(type) {
  for (const element of [live2dElement, vrmElement]) {
    if (element) element.hidden = element !== (type === 'live2d' ? live2dElement : vrmElement);
  }
  if (container) container.dataset.renderer = type;
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw new DOMException('Avatar mount was cancelled', 'AbortError');
}

async function waitForLive2DModel(manager, signal, timeoutMs = 15000) {
  const started = Date.now();
  while (!manager.currentModel?.width || !manager.currentModel?.height) {
    throwIfAborted(signal);
    if (Date.now() - started > timeoutMs) throw new Error('Live2D model timeout');
    await new Promise(resolve => setTimeout(resolve, 120));
  }
  return manager.currentModel;
}

function waitForVrmModules(signal, timeoutMs = 15000) {
  throwIfAborted(signal);
  if (window.vrmModuleLoaded && window.VRMManager) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let timer = 0;
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener('vrm-modules-ready', onReady);
      window.removeEventListener('vrm-modules-failed', onFailed);
      signal?.removeEventListener('abort', onAbort);
    };
    const onReady = () => { cleanup(); resolve(); };
    const onFailed = event => {
      cleanup();
      reject(new Error(`VRM modules failed: ${(event.detail?.failedModules || []).join(', ')}`));
    };
    const onAbort = () => {
      cleanup();
      reject(new DOMException('Avatar mount was cancelled', 'AbortError'));
    };
    timer = setTimeout(() => {
      cleanup();
      reject(new Error('VRM module timeout'));
    }, timeoutMs);
    window.addEventListener('vrm-modules-ready', onReady, { once:true });
    window.addEventListener('vrm-modules-failed', onFailed, { once:true });
    signal?.addEventListener('abort', onAbort, { once:true });
  });
}

function createRawController({ signal, fitLive2DModel }) {
  let manager = null;
  let modelType = '';
  let modelPath = '';
  let disposed = false;

  async function disposeCurrent() {
    if (!manager) return;
    const current = manager;
    manager = null;
    if (modelType === 'vrm') await current.dispose?.();
    else if (typeof current.destroy === 'function') current.destroy();
    else current.pauseRendering?.();
  }

  async function loadLive2D(path) {
    const next = window.live2dManager;
    if (!next) throw new Error('Live2D renderer is unavailable');
    showRenderer('live2d');
    // `fixed` keeps live2d-core from resizing to the host window on resize or
    // display changes, which fights the SDK's resize(viewport, fit).
    await next.initPIXI('air-neko-live2d-canvas', 'air-neko-live2d', { resizeMode:'fixed', width:320, height:440 });
    manager = next;
    for (const name of ['setupFloatingButtons', 'setupHTMLLockIcon', 'setupReturnButtonContainerDrag']) {
      if (typeof next[name] !== 'function') next[name] = () => {};
    }
    throwIfAborted(signal);
    await next.loadModel(path);
    await waitForLive2DModel(next, signal);
    void Promise.resolve(next.setEmotion?.('neutral')).catch(() => undefined);
  }

  async function loadVRM(path) {
    showRenderer('vrm');
    await waitForVrmModules(signal);
    throwIfAborted(signal);
    if (!window.VRMManager || !window.UnityVRMManager) throw new Error('Unity VRM renderer is unavailable');
    const next = new window.VRMManager();
    if (!(next instanceof window.UnityVRMManager)) throw new Error('Unity VRM renderer is required');
    await next.initRenderer('air-neko-vrm-canvas', 'air-neko-vrm');
    manager = next;
    await next.loadModel(path, { embed: true, restorePreferences: false });
    throwIfAborted(signal);
    if (next.canvas) next.canvas.style.opacity = '1';
  }

  return {
    async setModel(model) {
      if (disposed) throw new Error('Avatar controller is disposed');
      throwIfAborted(signal);
      await disposeCurrent();
      modelType = model.type;
      modelPath = model.path;
      if (model.type === 'live2d') await loadLive2D(model.path);
      else if (model.type === 'vrm') await loadVRM(model.path);
      else throw new Error(`Unsupported Avatar type: ${model.type}`);
    },
    focus(point) {
      if (modelType === 'live2d') manager?.currentModel?.focus?.(point.x, point.y);
    },
    setEmotion(name) {
      if (modelType === 'live2d') return manager?.setEmotion?.(name);
      return manager?.setEmotion?.(name);
    },
    pause() { return manager?.pauseRendering?.(); },
    resume() { return manager?.resumeRendering?.(); },
    getState() { return { modelType, modelPath, ready:Boolean(manager) }; },
    resize(viewport, fit) {
      if (modelType === 'live2d' && manager?.currentModel) {
        manager.pixi_app?.renderer?.resize?.(viewport.width, viewport.height);
        fitLive2DModel(manager.currentModel, viewport, fit);
      } else if (modelType === 'vrm' && manager?.currentModel) {
        manager.resizeSurface?.(viewport.width, viewport.height, false);
        manager.fitModel?.(viewport, fit);
      }
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      await disposeCurrent();
    }
  };
}

export function createAirBasketballAvatarHost() {
  if (!window.NekoMiniGameAvatarHost?.create) throw new Error('NekoMiniGame Avatar host is unavailable');
  return window.NekoMiniGameAvatarHost.create({
    rendererLimit:1,
    slots:{ opponent:{ container, createController:createRawController } }
  });
}
