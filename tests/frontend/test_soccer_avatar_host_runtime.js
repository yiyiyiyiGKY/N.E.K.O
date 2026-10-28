const fs = require('fs');
const path = require('path');
const vm = require('vm');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const activeTimers = new Set();
  let loadCalls = 0;
  let destroyCalls = 0;
  const container = { clientWidth: 200, clientHeight: 300 };
  const documentMock = {
    getElementById(id) {
      return id === 'ai-l2d-container' ? container : null;
    },
  };
  const windowMock = {
    AbortController,
    document: documentMock,
    innerWidth: 1280,
    innerHeight: 720,
    console: { log() {}, warn() {}, error() {} },
    setTimeout(callback, delay) {
      const id = setTimeout(() => {
        activeTimers.delete(id);
        callback();
      }, delay);
      activeTimers.add(id);
      return id;
    },
    clearTimeout(id) {
      activeTimers.delete(id);
      clearTimeout(id);
    },
    live2dManager: {
      currentModel: null,
      async initPIXI() {},
      loadModel() {
        loadCalls += 1;
        return new Promise(() => {});
      },
      pauseRendering() {},
      resumeRendering() {},
      destroy() { destroyCalls += 1; },
    },
  };
  global.window = windowMock;
  global.document = documentMock;

  const genericHostPath = path.resolve(
    __dirname,
    '../../static/game/sdk/neko-minigame-avatar-host.js',
  );
  const soccerHostPath = path.resolve(
    __dirname,
    '../../static/game/games/soccer/soccer-avatar-host.js',
  );
  vm.runInThisContext(fs.readFileSync(genericHostPath, 'utf8'), { filename: genericHostPath });
  const soccerSource = fs.readFileSync(soccerHostPath, 'utf8');
  vm.runInThisContext(soccerSource, { filename: soccerHostPath });

  const host = windowMock.createSoccerAvatarHost();
  for (const failure of ['network', 'factory', 'cancelled', 'timeout', 'disposed', 'aborted']) {
    const owner = new AbortController();
    const error = Object.assign(new Error(failure), { code: failure });
    const base = { name: 'Fallback Neko', rendererAvailable: true,
      model: { type: 'mmd', path: '/neko.pmx' },
      fallbackModels: [{ type: 'vrm', path: '/neko.vrm' }, { type: 'live2d', path: '/neko.model3.json' }],
      languagePreference: { resolved: true, locale: 'ja' } };
    let released = 0;
    windowMock.NekoMiniGameDrawingAvatarHost = { create() {
      if (failure === 'factory') throw error;
      return { mount() {}, dispose() { released++; }, async getCharacter() {
        if (failure === 'aborted') owner.abort();
        throw error;
      } };
    } };
    const fallbackHost = windowMock.createSoccerAvatarHost({
      characterSource: { getCharacter: async () => base },
    });
    try {
      if (['network', 'factory'].includes(failure)) {
        const result = await fallbackHost.getCharacter(base.name, { signal: owner.signal });
        assert(result.name === base.name && result.model === null, 'failed metadata advertised the extended model');
        assert(JSON.stringify(result.fallbackModels) === JSON.stringify(base.fallbackModels), 'standard fallbacks were lost');
        assert(result.languagePreference.locale === 'ja', 'fallback lost the trusted language');
      } else {
        const caught = await fallbackHost.getCharacter(base.name, { signal: owner.signal }).catch(cause => cause);
        assert(caught === error, `${failure}: cancellation became a fallback success`);
      }
    } finally { fallbackHost.dispose(); }
    assert(released === (failure === 'factory' ? 0 : 1), 'supplemental host was not released');
  }
  const pendingMount = host.mount({
    slot: 'ai',
    model: { type: 'live2d', path: '/models/stuck.model3.json' },
    viewport: { mode: 'fixed', width: 200, height: 300 },
    fit: { mode: 'contain', align: 'bottom-center', padding: 0, scaleMultiplier: 1 },
    resize: { mode: 'fixed' },
  }).then(() => null, (error) => error);

  for (let index = 0; index < 10 && loadCalls === 0; index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert(loadCalls === 1, 'Live2D model load did not reach the readiness wait');
  assert(activeTimers.size === 1, 'Live2D readiness polling did not own one tracked timer');

  host.dispose();
  const disposeError = await pendingMount;
  assert(disposeError?.code === 'cancelled',
    'disposing a pending soccer Live2D mount did not cancel its readiness wait');
  assert(activeTimers.size === 0, 'soccer Live2D readiness timer survived host disposal');
  assert(destroyCalls === 1, 'pending soccer Live2D manager was not disposed exactly once');

  const flush = async () => {
    for (let index = 0; index < 10; index += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  };
  // Execute the real manager load/fallback/token implementation. Only network,
  // PIXI setup and model configuration are replaced with deterministic gates.
  const live2dPath = path.resolve(__dirname, '../../static/live2d/live2d-model.js');
  const live2dSource = fs.readFileSync(live2dPath, 'utf8');
  const loadStart = live2dSource.indexOf('Live2DManager.prototype.loadModel =');
  const loadEnd = live2dSource.indexOf('// 获取当前已加载的模型实例', loadStart);
  assert(loadStart !== -1 && loadEnd > loadStart, 'Live2D load implementation anchors missing');
  const originalFactory = windowMock.createSoccerAvatarHost;
  const originalSetTimeout = windowMock.setTimeout;
  const originalClearTimeout = windowMock.clearTimeout;
  for (const action of ['dispose', 'timeout', 'success']) {
    for (const stage of ['primary', 'fallback', 'fallback-after-cancel', 'configuration', 'rejection']) {
      if (action === 'success' && !['primary', 'configuration'].includes(stage)) continue;
      let now = 1000;
      const timers = new Map();
      const downloads = [];
      let finishConfiguration;
      let configured = 0;
      let published = 0;
      const configGate = new Promise(resolve => { finishConfiguration = resolve; });
      const model = {
        width: 200, height: 300, destroyed: false, releases: 0,
        internalModel: { settings: { url: '/models/late.model3.json' } },
        scale: { x: 1, y: 1, set() {} },
        destroy() { this.releases++; this.destroyed = true; },
      };
      class Live2DManager {
        constructor() { this._activeLoadToken = 0; this.currentModel = null; }
        async initPIXI() { this.pixi_app = {}; }
        _invalidateParameterReloadTickets() {}
        _resetDerivedModelMetadata() {}
        async removeModel() { this.currentModel = null; }
        async _configureLoadedModel(_model, _path, _options, token) {
          if (!this._isLoadTokenActive(token)) return;
          if (stage === 'configuration') await configGate;
          if (this._isLoadTokenActive(token)) configured++;
        }
        pauseRendering() {}
        resumeRendering() {}
        destroy() {
          if (this.currentModel) this.currentModel.destroy();
          this.currentModel = null;
          this.pixi_app = null;
        }
      }
      windowMock.location = { pathname: '/soccer' };
      windowMock.setTimeout = callback => { const id = {}; timers.set(id, callback); return id; };
      windowMock.clearTimeout = id => timers.delete(id);
      const context = {
        window: windowMock, document: documentMock, console: windowMock.console,
        Date: { now: () => now }, clearTimeout: windowMock.clearTimeout,
        Live2DManager,
        Live2DModel: { from: requestedPath => new Promise((resolve, reject) => downloads.push({
          resolve(value) { value.internalModel.settings.url = requestedPath; resolve(value); }, reject,
        })) },
      };
      vm.runInNewContext(live2dSource.slice(loadStart, loadEnd), context, { filename: live2dPath });
      vm.runInNewContext(soccerSource, context, { filename: soccerHostPath });
      const manager = windowMock.live2dManager = new Live2DManager();
      const modelPath = stage === 'rejection'
        ? '/static/yui-lolita/yui-lolita.model3.json' : '/models/late.model3.json';
      const lateHost = windowMock.createSoccerAvatarHost({ onAvatarChanged() { published++; } });
      let settled = false;
      const mounting = lateHost.mount({
        slot: 'ai', model: { type: 'live2d', path: modelPath },
        viewport: { mode: 'fixed', width: 200, height: 300 },
        fit: { mode: 'contain' }, resize: { mode: 'fixed' },
      }).then(value => { settled = true; return value; }, error => { settled = true; return error; });
      await flush();
      if (downloads.length !== 1) {
        const early = settled ? await mounting : null;
        throw new Error(`${action}/${stage}: primary download not started: ${early?.stack || early || 'pending'}`);
      }
      if (stage === 'fallback') {
        downloads[0].reject(new Error('primary failed'));
        await flush();
        assert(downloads.length === 2, 'fallback download not started');
      }
      if (stage === 'configuration') {
        downloads[0].resolve(model);
        await flush();
      }
      const tick = () => {
        for (const [id, callback] of [...timers]) { timers.delete(id); callback(); }
      };
      if (action === 'dispose') lateHost.dispose();
      if (action === 'timeout') { now += 20001; tick(); }
      await flush();
      if (action !== 'success') assert(settled, `${action}/${stage}: mount did not settle promptly`);
      const successor = { releases: 0, destroy() { this.releases++; } };
      if (stage === 'rejection') {
        // An abandoned error handler must not clear a newer load's state.
        manager._activeLoadToken++;
        manager.currentModel = successor;
      } else if (action === 'dispose') {
        windowMock.live2dManager = { currentModel: successor, destroy() { successor.destroy(); } };
      }
      if (stage === 'fallback-after-cancel') {
        downloads[0].reject(new Error('late primary failure'));
        await flush();
        assert(downloads.length === 2, 'late fallback path was not exercised');
      }
      if (stage === 'rejection') downloads[0].reject(new Error('late default model failure'));
      else if (stage === 'configuration') finishConfiguration();
      else downloads.at(-1).resolve(model);
      await flush();
      tick();
      await flush();
      const result = await mounting;
      if (action === 'success') {
        assert(!result.code && published === 1 && configured === 1, `${stage}: healthy load failed`);
        lateHost.dispose();
      } else {
        assert(published === 0 && configured === 0, `${action}/${stage}: cancelled model configured or published`);
        assert(manager.currentModel === (stage === 'rejection' ? successor : null),
          `${action}/${stage}: late model retained or successor removed`);
      }
      assert(successor.releases === 0, `${action}/${stage}: late cleanup destroyed successor`);
      if (action === 'dispose' && stage !== 'rejection') {
        assert(windowMock.live2dManager.currentModel === successor, `${stage}: replacement manager changed`);
      }
      assert(model.releases === (stage === 'rejection' ? 0 : 1),
        `${action}/${stage}: model not released exactly once (${model.releases})`);
      assert(timers.size === 0, `${action}/${stage}: readiness timer leaked`);
      lateHost.dispose();
    }
  }
  windowMock.createSoccerAvatarHost = originalFactory;
  windowMock.setTimeout = originalSetTimeout;
  windowMock.clearTimeout = originalClearTimeout;
  for (const slot of ['player', 'ai']) {
    for (const stage of ['init', 'load', 'mood', 'success']) {
      let release;
      let reached = false;
      const wait = () => {
        reached = true;
        return new Promise((resolve) => { release = resolve; });
      };
      const calls = { fit: 0, changed: 0, disposed: 0, released: 0 };
      let manager;
      class Manager {
        constructor() {
          manager = this;
          this.animation = {
            startLipSync(analyser) {
              calls.lipStarts = (calls.lipStarts || 0) + 1;
              calls.analyser = analyser;
            },
            stopLipSync() { calls.lipStops = (calls.lipStops || 0) + 1; calls.analyser = null; },
          };
          this.expression = { loadMoodMap: async (modelName) => {
            calls.moodName = modelName;
            if (stage === 'mood') await wait();
          } };
          this.interaction = { enableMouseTracking() {} };
          this._cursorFollow = { setEnabled() {} };
        }
        async initRenderer(canvasId) {
          if (stage === 'init') await wait();
          this.canvas = { id: canvasId, style: {} };
          this.initialized = true;
          return this;
        }
        isInitialized() { return this.initialized === true; }
        getSurfaceCanvas() { return this.canvas; }
        resizeSurface() {}
        async loadModel(path) {
          if (stage === 'load') await wait();
          if (this.currentModel) calls.released += 1;
          this.currentModel = { url: path, transform: {} };
          return this.currentModel;
        }
        fitModel() { calls.fit += 1; }
        getModelScreenBounds() { return { x: 50, y: 0, width: 100, height: 300 }; }
        pauseRendering() { this.paused = true; }
        resumeRendering() { this.paused = false; }
        dispose() {
          calls.disposed += 1;
          this.animation.stopLipSync();
          if (this.currentModel) {
            calls.released += 1;
            this.currentModel = null;
          }
        }
      }
      windowMock.VRMManager = Manager;
      windowMock.UnityVRMManager = Manager;
      const vrmHost = windowMock.createSoccerAvatarHost({ onAvatarChanged() { calls.changed += 1; } });
      const mount = vrmHost.mount({
        slot, model: { type: 'vrm', path: '/models/%E7%8C%AB%E5%A8%98%20%23%2520.VRM' },
        viewport: { mode: 'fixed', width: 200, height: 300 },
        fit: { mode: 'contain', align: 'bottom-center', padding: 0, scaleMultiplier: 1 },
        resize: { mode: 'fixed' },
      }).then((value) => value, (error) => error);
      await flush();
      if (stage === 'success') {
        const controller = await mount;
        assert(!controller.code && controller.getState().ready, `${slot}: healthy VRM mount failed`);
        assert(calls.moodName === '猫娘 #%20', 'mood mapping must decode URL basename exactly once');
        assert(calls.changed === 1 && calls.fit >= 1, `${slot}: healthy Unity VRM was not fitted/published`);
        const frame = { active: true, mouthFrame: { bins: Array(16).fill(100), rms: 0.2, sampleRate: 12000 } };
        await controller.setSpeechPlayback(frame);
        if (slot === 'player') {
          assert(!calls.lipStarts, 'the human player accepted assistant speech');
          vrmHost.dispose();
          assert(calls.released === 1, 'player VRM was not released');
          continue;
        }
        assert(calls.lipStarts === 1, `${slot}: automatic speech did not reach this VRM manager`);
        await controller.setSpeechPlayback(frame);
        assert(calls.lipStarts === 1, `${slot}: each frame restarted lip sync`);
        controller.pause(); await flush();
        assert(calls.analyser === null, `${slot}: pause retained lip sync`);
        await controller.setSpeechPlayback(frame);
        assert(calls.analyser === null, `${slot}: paused renderer accepted speech`);
        await controller.setModel({ type: 'vrm', path: '/models/paused-replacement.vrm' });
        assert(manager.paused && calls.analyser === null, `${slot}: model replacement lost pause`);
        controller.resume(); await flush();
        await controller.setSpeechPlayback(frame);
        assert(calls.lipStarts === 2, `${slot}: resume did not accept fresh speech`);
        await controller.setModel({ type: 'vrm', path: '/models/replacement.vrm' });
        assert(calls.analyser === null, `${slot}: model change retained old speech`);
        await controller.setSpeechPlayback(frame);
        await controller.setSpeechPlayback({ active: false });
        assert(calls.analyser === null, `${slot}: stop retained speech`);
        await controller.setSpeechPlayback(frame);
        vrmHost.dispose();
        assert(calls.analyser === null, `${slot}: disposal retained speech`);
        assert(calls.released === 3, `${slot}: healthy VRM was not released`);
        continue;
      }
      assert(reached, `${slot}: did not reach ${stage} wait`);
      vrmHost.dispose();
      const error = await mount;
      assert(['cancelled', 'disposed'].includes(error.code),
        `${slot}/${stage}: mount did not cancel promptly: ${error.stack || error}`);
      release();
      await flush();
      assert(calls.changed === 0, `${slot}/${stage}: disposed avatar was published`);
      if (stage === 'init' || stage === 'load') {
        assert(calls.fit === 0, `${slot}/${stage}: disposed manager fitted a stale model`);
      }
      if (stage === 'init') assert(calls.disposed === 2, `${slot}: late init resources survived`);
      else assert(calls.released === 1, `${slot}/${stage}: Unity VRM model was not released exactly once`);
      assert(!manager.currentModel, `${slot}/${stage}: disposed manager retained a model`);
      assert(windowMock[slot === 'player' ? 'vrmManager' : 'aiVrmManager'] === null,
        `${slot}/${stage}: disposed manager was restored globally`);
    }
  }
  const mouthFrames = new Map();
  let mouthValue = 0;
  const core = {
    getParameterIndex: id => id === 'ParamMouthOpenY' ? 0 : -1,
    setParameterValueById(_id, value) { mouthValue = value; },
  };
  const liveModel = { width: 200, height: 300,
    internalModel: { settings: { url: '/model.json' }, coreModel: core },
    scale: { x: 1, y: 1, set() {} }, position: { set() {} }, anchor: { set() {} } };
  windowMock.live2dManager = { currentModel: liveModel, async initPIXI() {},
    async loadModel() { return liveModel; }, pauseRendering() { this.paused = true; },
    resumeRendering() { this.paused = false; }, destroy() {} };
  windowMock.requestAnimationFrame = callback => { const id = {}; mouthFrames.set(id, callback); return id; };
  windowMock.cancelAnimationFrame = id => mouthFrames.delete(id);
  const liveHost = windowMock.createSoccerAvatarHost();
  const live = await liveHost.mount({ slot: 'ai', model: { type: 'live2d', path: '/model.json' },
    viewport: { mode: 'fixed', width: 200, height: 300 }, resize: { mode: 'fixed' } });
  const speechFrame = { active: true, mouthFrame: { bins: Array(16).fill(100), rms: 0.2, sampleRate: 12000 } };
  await live.setSpeechPlayback(speechFrame);
  assert(mouthValue > 0 && mouthFrames.size === 1, 'Live2D automatic mouth did not start one RAF');
  for (let index = 0; index < 30; index++) await live.setSpeechPlayback(speechFrame);
  assert(mouthFrames.size === 1, 'Live2D playback updates accumulated RAFs');
  live.pause(); await flush();
  assert(mouthValue === 0 && mouthFrames.size === 0, 'Live2D pause did not release mouth');
  class FailedUnityManager {
    async initRenderer() { throw new Error('VRM init failed'); }
    isInitialized() { return false; }
    getSurfaceCanvas() { return null; }
    dispose() {}
  }
  windowMock.VRMManager = FailedUnityManager;
  windowMock.UnityVRMManager = FailedUnityManager;
  for (const paused of [true, false]) {
    if (!paused) { live.resume(); await flush(); }
    const error = await live.setModel({ type: 'vrm', path: '/missing.vrm' }).then(
      () => null, failure => failure);
    assert(error && live.getState().ready && live.getState().model.type === 'live2d',
      'failed VRM did not restore Live2D');
    assert(windowMock.live2dManager.paused === paused,
      'failed VRM replacement changed Live2D pause state');
  }
  live.resume(); await flush();
  await live.setSpeechPlayback(speechFrame);
  assert(mouthValue > 0, 'Live2D resume did not accept fresh speech');
  await live.setSpeechPlayback({ active: true, mouthFrame: { ...speechFrame.mouthFrame, bins: Array(512).fill(1) } });
  assert(mouthValue === 0 && mouthFrames.size === 0, 'invalid frames retained Live2D mouth');
  await live.setSpeechPlayback(speechFrame);
  await live.setModel({ type: 'live2d', path: '/model.json' });
  assert(mouthValue === 0 && mouthFrames.size === 0, 'Live2D model change retained mouth');
  await live.setSpeechPlayback(speechFrame);
  liveHost.dispose();
  assert(mouthValue === 0 && mouthFrames.size === 0, 'Live2D disposal retained mouth');
  assert(activeTimers.size === 0, 'provider left readiness timers');
  // Both soccer slots must use the Unity manager's native load/fit contract.
  for (const slot of ['player', 'ai']) for (const paused of [false, true]) {
    let manager;
    let disposed = 0;
    let focusPoint = null;
    const fits = [];
    class SoccerUnityManager {
      constructor() {
        manager = this;
        this.animation = { startLipSync() {}, stopLipSync() {} };
        this.expression = { async loadMoodMap() {} };
        this.interaction = { enableMouseTracking() {} };
        this._cursorFollow = {
          setEnabled() {},
          isEnabled() { return true; },
          _onPointerMove(event) { focusPoint = { x: event.clientX, y: event.clientY }; },
        };
      }
      async initRenderer(canvasId) {
        this.canvas = { id: canvasId, style: {} };
        this.initialized = true;
      }
      isInitialized() { return this.initialized === true; }
      getSurfaceCanvas() { return this.canvas; }
      resizeSurface() {}
      async loadModel(path) {
        if (path === '/failed.vrm') throw new Error('Unity import failed');
        this.currentModel = { url: path, transform: {} };
        return this.currentModel;
      }
      fitModel(size, fit) {
        fits.push({ size: { ...size }, fit: { ...fit } });
        const padding = Number(fit?.padding || 0);
        this.bounds = { x: padding, y: padding, width: size.width - padding * 2,
          height: size.height - padding * 2 };
      }
      getModelScreenBounds() { return this.bounds; }
      pauseRendering() { this.paused = true; }
      resumeRendering() { this.paused = false; }
      dispose() { disposed += 1; this.currentModel = null; }
    }
    windowMock.VRMManager = SoccerUnityManager;
    windowMock.UnityVRMManager = SoccerUnityManager;
    windowMock[slot === 'player' ? 'vrmManager' : 'aiVrmManager'] = null;
    const unityHost = windowMock.createSoccerAvatarHost();
    const controller = await unityHost.mount({ slot, model: { type: 'vrm', path: '/old.vrm' },
      viewport: { mode: 'fixed', width: 200, height: 300 }, resize: { mode: 'fixed' },
      fit: { mode: 'contain', align: 'bottom-center', padding: 6 } });
    assert(fits.some(entry => entry.size.width === 200 && entry.fit.padding === 6),
      `${slot}: initial Unity fit contract was not called`);
    assert(controller.getState().layout === manager.bounds,
      `${slot}: Unity bounds were not published as layout`);
    if (slot === 'ai') {
      const focused = await controller.focus({ x: 91, y: 73 });
      assert(focused && focusPoint?.x === 91 && focusPoint?.y === 73,
        `AI Unity focus did not reach the cursor-follow adapter: ${JSON.stringify({ focused, focusPoint,
          sameManager: windowMock.aiVrmManager === manager, model: controller.getState().model })}`);
    }
    if (paused) { controller.pause(); await flush(); }
    await controller.resize({ width: 300, height: 160 }, { mode: 'height', padding: 8 });
    assert(fits.at(-1).size.height === 160 && fits.at(-1).fit.mode === 'height',
      `${slot}: resize did not reach Unity fitModel`);
    const oldModel = manager.currentModel;
    const failure = await controller.setModel({ type: 'vrm', path: '/failed.vrm' }).then(
      () => null, error => error);
    assert(failure?.message === 'Unity import failed' && manager.currentModel === oldModel,
      `${slot}: failed Unity import replaced the live model`);
    assert(controller.getState().ready && controller.getState().model.path === '/old.vrm'
      && Boolean(manager.paused) === paused, `${slot}: failed Unity import changed readiness or pause: `
        + `${JSON.stringify(controller.getState())}, managerPaused=${manager.paused}, expected=${paused}`);
    unityHost.dispose();
    assert(disposed === 1, `${slot}: Unity manager was not disposed exactly once`);
  }
  // A hidden, paused legacy renderer cannot remain ready after an extended
  // replacement fails. Exercise the actual soccer and generic host controllers.
  for (const previousType of ['live2d', 'vrm']) for (const nextType of ['mmd', 'pngtuber']) {
    for (const paused of [false, true]) for (const failureStage of ['create', 'mount']) {
      const label = `${previousType}->${nextType}/${paused}/${failureStage}`;
      const canvas = { style: {} };
      documentMock.getElementById = id => id === 'ai-l2d-canvas' ? canvas
        : id === 'ai-l2d-container' ? container : null;
      let manager, hostReleases = 0, managerReleases = 0, published = 0;
      if (previousType === 'live2d') {
        manager = windowMock.live2dManager = {
          currentModel: liveModel, async initPIXI() {},
          async loadModel() { return liveModel; },
          pauseRendering() { this.paused = true; },
          resumeRendering() { this.paused = false; },
          destroy() { managerReleases += 1; this.currentModel = null; },
        };
      } else {
        class ExtendedUnityManager {
          constructor() {
            manager = this;
            this.animation = { startLipSync() {}, stopLipSync() {} };
            this.expression = { async loadMoodMap() {} };
            this.interaction = { enableMouseTracking() {} };
            this._cursorFollow = { setEnabled() {} };
          }
          async initRenderer(canvasId) {
            this.canvas = { ...canvas, id: canvasId };
            this.initialized = true;
          }
          isInitialized() { return this.initialized === true; }
          getSurfaceCanvas() { return this.canvas; }
          resizeSurface() {}
          async loadModel(path) {
            this.currentModel = { url: path, transform: {} };
            return this.currentModel;
          }
          fitModel(size) { this.bounds = { x: 0, y: 0, width: size.width, height: size.height }; }
          getModelScreenBounds() { return this.bounds; }
          pauseRendering() { this.paused = true; }
          resumeRendering() { this.paused = false; }
          dispose() { managerReleases += 1; this.currentModel = null; }
        }
        windowMock.VRMManager = ExtendedUnityManager;
        windowMock.UnityVRMManager = ExtendedUnityManager;
      }
      let rejectMount;
      const loadError = new Error('extended renderer failed');
      windowMock.NekoMiniGameDrawingAvatarHost = { create() {
        if (failureStage === 'create') throw loadError;
        return {
          mount: () => new Promise((_resolve, reject) => { rejectMount = reject; }),
          dispose() { hostReleases += 1; },
        };
      } };
      const switchingHost = windowMock.createSoccerAvatarHost({ onAvatarChanged() { published += 1; } });
      const original = { type: previousType, path: previousType === 'live2d' ? '/model.json' : '/old.vrm' };
      const avatar = await switchingHost.mount({ slot: 'ai', model: original,
        viewport: { mode: 'fixed', width: 200, height: 300 }, resize: { mode: 'fixed' } });
      assert(avatar.getState().ready && avatar.getState().layout, `${label}: original not ready`);
      if (paused) { avatar.pause(); await flush(); }
      const replacing = avatar.setModel({ type: nextType, path: '/replacement' }).then(
        () => null, error => error);
      await flush();
      if (failureStage === 'mount') {
        assert(rejectMount, `${label}: did not reach extended mount`);
        assert(!avatar.getState().ready && !windowMock.__SoccerAiAvatar.ready,
          `${label}: hidden legacy model remained ready while loading`);
        rejectMount(loadError);
      }
      const failed = await replacing;
      assert(failed, `${label}: failed switch resolved successfully`);
      const state = avatar.getState();
      assert(!state.ready && state.model === null && state.layout === null,
        `${label}: hidden legacy model remained ready`);
      assert(!windowMock.__SoccerAiAvatar.ready && windowMock.__SoccerAiAvatar.type === 'none',
        `${label}: global avatar remained ready`);
      assert(canvas.style.display === 'none' && manager.paused, `${label}: fixture did not retire legacy rendering`);
      assert(published === 1 && !state.speaking && state.paused === paused, `${label}: failure published or changed pause`);
      assert(hostReleases === (failureStage === 'mount' ? 1 : 0), `${label}: failed extension leaked`);
      await avatar.setModel(original);
      assert(avatar.getState().ready && avatar.getState().model.type === previousType
        && windowMock.__SoccerAiAvatar.ready && canvas.style.display === 'block', `${label}: recovery failed`);
      assert(manager.paused === paused && published === 2, `${label}: recovery changed pause/publication`);
      switchingHost.dispose();
      assert(managerReleases === 1 && switchingHost.activeCount === 0
        && switchingHost.pendingCount === 0, `${label}: legacy manager retained after exit`);
      assert(activeTimers.size === 0 && mouthFrames.size === 0, `${label}: timers/animation frames leaked`);
    }
  }
  process.stdout.write('soccer Avatar host cancellation and automatic speech tests passed\n');
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
