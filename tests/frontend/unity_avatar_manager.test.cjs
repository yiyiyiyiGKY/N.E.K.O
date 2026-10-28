const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '../..');
const MANAGER_SOURCE = fs.readFileSync(
    path.join(ROOT, 'static/unity/unity-avatar-manager.js'),
    'utf8'
);
const LOADER_SOURCE = fs.readFileSync(
    path.join(ROOT, 'static/unity/unity-vrm-loader.js'),
    'utf8'
);

function createEventTarget(extra = {}) {
    const listeners = new Map();
    return Object.assign({
        addEventListener(name, handler) {
            const handlers = listeners.get(name) || new Set();
            handlers.add(handler);
            listeners.set(name, handlers);
        },
        removeEventListener(name, handler) {
            const handlers = listeners.get(name);
            if (handlers) handlers.delete(handler);
        },
        dispatchEvent(event) {
            const handlers = listeners.get(event.type);
            if (handlers) Array.from(handlers).forEach((handler) => handler(event));
            return true;
        }
    }, extra);
}

function createSandbox() {
    const commands = [];
    const instances = [];
    const preferenceWrites = [];
    const touchInstalls = [];
    const canvas = createEventTarget({
        id: 'vrm-canvas',
        style: {},
        clientWidth: 1280,
        clientHeight: 720,
        setPointerCapture() {},
        getBoundingClientRect() { return { left: 40, top: 25, width: 1280, height: 720 }; }
    });
    const container = createEventTarget({
        id: 'vrm-container',
        style: {},
        clientWidth: 1280,
        clientHeight: 720
    });
    const elements = new Map([[canvas.id, canvas], [container.id, container]]);
    const scripts = [];

    const windowTarget = createEventTarget({
        location: { href: 'http://127.0.0.1:48911/', origin: 'http://127.0.0.1:48911' },
        innerWidth: 1280,
        innerHeight: 720,
        devicePixelRatio: 2,
        renderQuality: 'high',
        targetFrameRate: 45,
        screen: { width: 1920, height: 1080 },
        crypto: { randomUUID: () => `id-${commands.length + 1}` },
        VRM_DEFAULT_LIGHTING: { ambient: 0.8, main: 1.9, fill: 0, rim: 0, top: 0, bottom: 0 },
        requestAnimationFrame(callback) { return setTimeout(() => callback(Date.now()), 0); },
        cancelAnimationFrame(handle) { clearTimeout(handle); },
        setTimeout,
        clearTimeout
    });
    windowTarget.NekoModelTouchGestures = {
        install(targetCanvas, callbacks) {
            const record = { targetCanvas, callbacks, disposed: false };
            touchInstalls.push(record);
            return { dispose() { record.disposed = true; } };
        }
    };

    const document = {
        scripts,
        head: {
            appendChild(script) {
                scripts.push(script);
                setTimeout(() => {
                    windowTarget.createUnityInstance = async (targetCanvas) => {
                        const instance = {
                        canvas: targetCanvas,
                        quit: false,
                        SendMessage(_objectName, _methodName, raw) {
                            const command = JSON.parse(raw);
                            commands.push(command);
                            if (!command.id) return;
                            let body = {};
                            if (command.command === 'model.load') {
                                body = {
                                    expressions: ['neutral', 'happy', 'aa'],
                                    transform: {
                                        position: { x: 0, y: 0, z: 0 },
                                        rotation: { x: 0, y: 0, z: 0 },
                                        scale: { x: 1, y: 1, z: 1 }
                                    },
                                    bounds: {
                                        minX: 320, minY: 100, maxX: 960, maxY: 700,
                                        head: { x: 640, y: 155, minX: 580, minY: 95, maxX: 700, maxY: 215 }
                                    }
                                };
                            } else if (command.command === 'animation.play') {
                                body = { playing: true, duration: 2.4 };
                            } else if (command.command === 'model.snapshot') {
                                body = {
                                    transform: {
                                        position: { x: 1.5, y: -0.2, z: 0 },
                                        rotation: { x: 0, y: 0.25, z: 0 },
                                        scale: { x: 1.2, y: 1.2, z: 1.2 }
                                    }
                                };
                            } else if (command.command === 'vmc.snapshot') {
                                body = {
                                    restPose: [{
                                        name: 'Head',
                                        localPosition: { x: 0, y: 1.25, z: 0 },
                                        localRotation: { x: 0, y: 0, z: 0, w: 1 }
                                    }],
                                    bones: [{
                                        name: 'Head',
                                        localPosition: { x: 0, y: 1.4, z: 0 },
                                        localRotation: { x: 0, y: 0.1, z: 0, w: 0.99 }
                                    }],
                                    expressions: [{ name: 'happy', value: 0.75 }]
                                };
                            } else if (command.command === 'model.profile') {
                                body = {
                                    type: 'vrm', loaded: true, name: 'sister1.0.vrm',
                                    geometry: { meshCount: 3, vertices: 12000, faces: 8000, morphTargetCount: 24 },
                                    materials: { count: 5, textureCount: 7 },
                                    skeleton: { boneCount: 78, humanBoneCount: 54 },
                                    springBones: { springCount: 4, jointCount: 18, colliderGroupCount: 2, colliderCount: 6 },
                                    renderer: {
                                        rendererCount: 3, materialSlotCount: 5, drawCalls: 8,
                                        drawCallsEstimated: true,
                                        drawCallEstimateMethod: 'sum_renderer_material_shader_passes',
                                        triangles: 8000, textures: 7, geometries: 3,
                                        size: { width: 1280, height: 720 }
                                    }
                                };
                            } else if (command.command === 'model.snap') {
                                body = {
                                    moved: true,
                                    transform: {
                                        position: { x: 0.25, y: -0.1, z: 0 },
                                        rotation: { x: 0, y: 0, z: 0 },
                                        scale: { x: 1, y: 1, z: 1 }
                                    },
                                    bounds: { minX: 120, minY: 90, maxX: 520, maxY: 610 }
                                };
                            }
                            setTimeout(() => windowTarget.NekoUnityAvatar.onUnityEvent(JSON.stringify({
                                v: 1,
                                name: 'command.completed',
                                replyTo: command.id,
                                ok: true,
                                generation: command.generation,
                                body
                            })), 0);
                        },
                        async Quit() { this.quit = true; }
                    };
                    instances.push(instance);
                    return instance;
                    };
                    script._emit('load');
                }, 0);
            }
        },
        documentElement: { appendChild() {} },
        getElementById(id) { return elements.get(id) || null; },
        createElement(tagName) {
            assert.equal(tagName, 'script');
            const handlers = new Map();
            return {
                dataset: {},
                async: false,
                _src: '',
                get src() { return this._src; },
                set src(value) { this._src = new URL(value, windowTarget.location.href).href; },
                addEventListener(name, handler) {
                    const set = handlers.get(name) || new Set();
                    set.add(handler);
                    handlers.set(name, set);
                },
                removeEventListener(name, handler) {
                    handlers.get(name)?.delete(handler);
                },
                _emit(name) {
                    const set = handlers.get(name);
                    if (set) Array.from(set).forEach((handler) => handler());
                }
            };
        }
    };

    class CustomEvent {
        constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
    }

    class ResizeObserver {
        constructor(callback) { this.callback = callback; }
        observe() {}
        disconnect() {}
    }

    const sandbox = {
        ...windowTarget,
        window: windowTarget,
        document,
        console,
        CustomEvent,
        ResizeObserver,
        URL,
        Uint8Array,
        Math,
        Date,
        Promise,
        fetch: async (input, options = {}) => {
            const url = new URL(String(input), windowTarget.location.href);
            if (url.pathname === '/api/config/preferences') {
                if (options.method === 'POST') {
                    preferenceWrites.push(JSON.parse(options.body));
                    return { ok: true, json: async () => ({ success: true }) };
                }
                return { ok: true, json: async () => ({ models: [] }) };
            }
            return {
                ok: true,
                json: async () => ({
                version: 1,
                loaderUrl: '/static/unity/avatar/Build/NekoAvatarRenderer.loader.js',
                dataUrl: '/static/unity/avatar/Build/NekoAvatarRenderer.data',
                frameworkUrl: '/static/unity/avatar/Build/NekoAvatarRenderer.framework.js',
                codeUrl: '/static/unity/avatar/Build/NekoAvatarRenderer.wasm'
                })
            };
        },
        setTimeout,
        clearTimeout
    };
    Object.assign(windowTarget, sandbox);
    sandbox.globalThis = sandbox;
    return { sandbox, commands, instances, preferenceWrites, elements, touchInstalls };
}

test('VRM bootstrap routes the production manager to Unity without loading the Three VRM runtime', () => {
    const source = fs.readFileSync(path.join(ROOT, 'static/vrm/vrm-init.js'), 'utf8');
    assert.equal(fs.existsSync(path.join(ROOT, 'static/libs/three/addons/loaders/GLTFLoader.js')), false);
    assert.match(source, /\/static\/unity\/unity-vrm-loader\.js/);
    assert.match(LOADER_SOURCE, /\/static\/unity\/unity-avatar-manager\.js/);
    assert.match(LOADER_SOURCE, /\/static\/vrm\/vrm-expression\.js/);
    assert.match(LOADER_SOURCE, /\/static\/vrm\/vrm-ui-buttons\.js/);
    assert.doesNotMatch(LOADER_SOURCE, /\/static\/vrm\/vrm-(?:core|manager|animation|interaction|cursor-follow)\.js/);
    assert.doesNotMatch(LOADER_SOURCE, /unity-vrm-ui-compat\.js/);

    const managerPage = fs.readFileSync(
        path.join(ROOT, 'static/js/model_manager/runtime-loaders.js'),
        'utf8'
    );
    const cardPreview = fs.readFileSync(
        path.join(ROOT, 'static/js/character_card_manager/model-previews.js'),
        'utf8'
    );
    assert.match(managerPage, /\/static\/vrm\/vrm-init\.js/);
    assert.match(cardPreview, /\/static\/unity\/unity-vrm-loader\.js/);
    for (const chain of [managerPage, cardPreview]) {
        assert.doesNotMatch(chain, /\/static\/vrm\/vrm-(?:core|manager|animation|interaction)\.js/);
    }
});

test('Unity manager loads a model through the versioned bridge and exposes only the Unity surface API', async () => {
    const { sandbox, commands, instances, preferenceWrites, touchInstalls } = createSandbox();
    vm.runInNewContext(MANAGER_SOURCE, sandbox, { filename: 'unity-avatar-manager.js' });

    assert.equal(sandbox.window.VRMManager, sandbox.window.UnityVRMManager);
    assert.equal(sandbox.window.VRMCore, undefined);

    const loadedEvents = [];
    sandbox.window.addEventListener('vrm-model-loaded', (event) => loadedEvents.push(event.detail));
    const manager = new sandbox.window.VRMManager();
    assert.equal(manager.renderer, undefined);
    assert.equal(manager.scene, undefined);
    assert.equal(manager.camera, undefined);
    assert.equal(manager.core, undefined);
    assert.equal(manager._lighting.exposure, 1.1);
    assert.equal(manager._lighting.toneMapping, 7);
    await manager.initRenderer('vrm-canvas', 'vrm-container', { ambient: 0.7, exposure: 1.1 });
    manager.setSurfacePixelRatio(3);
    manager.resizeSurface(600, 800, false);
    assert.equal(manager.canvas.width, 1800);
    assert.equal(manager.canvas.height, 2400);
    const model = await manager.loadModel('/static/vrm/sister1.0.vrm');
    assert.equal(touchInstalls.length, 1);

    assert.equal(model.url, '/static/vrm/sister1.0.vrm');
    assert.equal(manager.getModelProfile().geometry.vertices, 12000);
    assert.deepEqual(Array.from(manager.expression.getExpressionList()), ['neutral', 'happy', 'aa']);
    assert.deepEqual({ ...manager.interaction._cachedScreenBounds }, {
        minX: 360,
        minY: 125,
        maxX: 1000,
        maxY: 725
    });
    assert.equal(loadedEvents.length, 1);
    assert.equal(loadedEvents[0].renderer, 'unity');

    const loadCommand = commands.find((command) => command.command === 'model.load');
    assert.ok(loadCommand);
    assert.equal(loadCommand.v, 1);
    assert.ok(loadCommand.generation > 0);
    assert.equal(loadCommand.body.url, 'http://127.0.0.1:48911/static/vrm/sister1.0.vrm');
    assert.equal(loadCommand.body.awaitInitialAnimation, true);

    assert.deepEqual({ ...manager.getHeadScreenAnchor() }, { x: 680, y: 180 });
    model.transform.visible = false;
    const visibilityCommand = commands.filter((command) => command.command === 'model.visibility').at(-1);
    assert.deepEqual({ ...visibilityCommand.body }, { visible: false });
    model.transform.visible = true;
    sandbox.window.NekoUnityAvatar.onUnityEvent(JSON.stringify({
        v: 1,
        name: 'model.bounds',
        replyTo: '',
        ok: true,
        generation: manager.currentModel.generation,
        body: { bounds: { minX: 100, minY: 80, maxX: 500, maxY: 600 } }
    }));
    assert.deepEqual({ ...manager.interaction._cachedScreenBounds }, {
        minX: 140, minY: 105, maxX: 540, maxY: 625
    });
    assert.deepEqual({ ...manager.interaction._getProjectedModelCenterInWindow() }, { x: 340, y: 365 });
    assert.equal(manager.interaction._moveModelCenterToWindowPoint(365, 380), true);
    assert.deepEqual(
        { ...commands.filter((command) => command.command === 'model.dragPixels').at(-1).body },
        { dx: 25, dy: 15, width: 1280, height: 720, clamp: true }
    );
    manager.applyScreenDelta(5, -7, { clamp: false });
    assert.deepEqual(
        { ...commands.filter((command) => command.command === 'model.dragPixels').at(-1).body },
        { dx: 5, dy: -7, width: 1280, height: 720, clamp: false }
    );
    assert.equal(await manager.interaction._snapModelIntoScreen({ animate: false }), true);
    const snapCommand = commands.filter((command) => command.command === 'model.snap').at(-1);
    assert.deepEqual({ ...snapCommand.body }, { minVisiblePixels: 200, animate: false });
    assert.deepEqual(
        { x: model.transform.position.x, y: model.transform.position.y, z: model.transform.position.z },
        { x: 0.25, y: -0.1, z: 0 }
    );

    let startedAction = null;
    const played = await manager.playVRMAAnimation('/static/vrm/animation/wait01.vrma.gz', {
        loop: false,
        immediate: false,
        movement: true,
        timeScale: 0.75,
        fadeDuration: 0.2,
        shouldApply: () => true,
        shouldStart: () => true,
        onStarted: (action) => { startedAction = action; }
    });
    assert.equal(played, true);
    const animationCommand = commands.filter((command) => command.command === 'animation.play').at(-1);
    assert.equal(animationCommand.body.timeScale, 0.75);
    assert.equal(animationCommand.body.fadeDuration, 0.2);
    assert.equal(animationCommand.body.movement, true);
    assert.equal(typeof animationCommand.body.actionId, 'string');
    assert.equal(startedAction, manager.animation.currentAction);
    startedAction.paused = true;
    const pauseCommand = commands.filter((command) => command.command === 'animation.setPaused').at(-1);
    assert.deepEqual({ ...pauseCommand.body }, { actionId: startedAction.id, paused: true });
    startedAction.paused = false;
    const resumeCommand = commands.filter((command) => command.command === 'animation.setPaused').at(-1);
    assert.deepEqual({ ...resumeCommand.body }, { actionId: startedAction.id, paused: false });
    assert.equal(manager.stopVRMAAnimation({ expectedAction: {}, preservePending: true }), false);
    assert.equal(manager.stopVRMAAnimation({ expectedAction: startedAction, preservePending: true }), true);
    const stopCommand = commands.filter((command) => command.command === 'animation.stop').at(-1);
    assert.equal(stopCommand.body.actionId, startedAction.id);
    assert.equal(stopCommand.body.preservePending, true);
    assert.equal(manager.stopVRMAAnimation(), true);
    const emptyStopCommand = commands.filter((command) => command.command === 'animation.stop').at(-1);
    assert.equal(emptyStopCommand.body.actionId, '');
    assert.equal(typeof emptyStopCommand.body.actionId, 'string');
    const realCall = manager._call.bind(manager);
    let rejectSuperseded;
    let raceCalls = 0;
    manager._call = (command) => {
        if (command !== 'animation.play') return realCall(command);
        raceCalls += 1;
        if (raceCalls === 1) {
            return new Promise((_resolve, reject) => { rejectSuperseded = reject; });
        }
        return Promise.resolve({ duration: 1.25 });
    };
    const supersededPlayback = manager.playVRMAAnimation('/static/vrm/animation/old.vrma.gz');
    const winningPlayback = manager.playVRMAAnimation('/static/vrm/animation/new.vrma.gz');
    const supersededError = new Error('Animation load was superseded');
    supersededError.code = 'superseded';
    rejectSuperseded(supersededError);
    assert.equal(await supersededPlayback, false);
    assert.equal(await winningPlayback, true);
    manager._call = realCall;
    assert.equal(manager.seekVRMAAnimation(0, { paused: true }), true);
    const seekCommand = commands.filter((command) => command.command === 'animation.seek').at(-1);
    assert.deepEqual({ ...seekCommand.body }, { seconds: 0, paused: true });
    assert.equal(manager.animation.currentAction.paused, true);
    assert.equal(manager.animation.isPaused, true);
    assert.equal(manager.seekVRMAAnimation(1.5, { paused: false }), true);
    assert.equal(manager.animation.currentAction.paused, false);
    assert.equal(manager.animation.isPaused, false);

    let rejectOldModel;
    let modelRaceCalls = 0;
    manager._call = (command) => {
        if (command !== 'model.load') return realCall(command);
        modelRaceCalls += 1;
        if (modelRaceCalls === 1) {
            return new Promise((_resolve, reject) => { rejectOldModel = reject; });
        }
        return Promise.resolve({ expressions: ['neutral'], transform: {}, bounds: null });
    };
    const staleModelLoad = manager.loadModel('/static/vrm/old.vrm', {
        autoPlay: false, restorePreferences: false
    });
    const currentModelLoad = manager.loadModel('/static/vrm/new.vrm', {
        autoPlay: false, restorePreferences: false
    });
    const supersededModelError = new Error('Model load was superseded');
    supersededModelError.code = 'superseded';
    rejectOldModel(supersededModelError);
    assert.equal(await staleModelLoad, null);
    assert.equal((await currentModelLoad).url, '/static/vrm/new.vrm');
    manager._call = realCall;
    const commandCountBeforeFaceCamera = commands.length;
    manager.interaction.enableFaceCamera = false;
    assert.equal(manager.interaction.enableFaceCamera, false);
    assert.equal(commands.length, commandCountBeforeFaceCamera);
    assert.equal(
        commands.some((command) => command.command === 'lookAt.faceCamera'),
        false,
        'body-facing compatibility state must not disable independent head/eye tracking'
    );
    manager.setMouseTrackingEnabled(false);
    assert.deepEqual(
        { ...commands.filter((command) => command.command === 'lookAt.enable').at(-1).body },
        { enabled: false }
    );
    manager.setMouseTrackingEnabled(true);

    manager.applyQualitySettings('low');
    const qualityCommand = commands.filter((command) => command.command === 'render.quality').at(-1);
    assert.deepEqual({ ...qualityCommand.body }, {
        quality: 'low', targetFrameRate: 45, antiAliasing: 0, shadows: false
    });
    manager.setOutlineWidthScale(0.35);
    assert.equal(manager._lighting.outlineWidthScale, 0.35);
    manager.applyQualitySettings('high');
    assert.equal(manager._lighting.outlineWidthScale, 0.35);
    assert.equal(manager._qualityOutlineEnabled, true);
    manager.applyQualitySettings('low');
    assert.equal(manager._lighting.outlineWidthScale, 0.35);
    assert.equal(manager._qualityOutlineEnabled, false);
    sandbox.window.renderQuality = 'medium';
    sandbox.window.dispatchEvent(new CustomEvent('neko-render-quality-changed', {
        detail: { quality: 'medium' }
    }));
    assert.deepEqual({ ...commands.filter((command) => command.command === 'render.quality').at(-1).body }, {
        quality: 'medium', targetFrameRate: 45, antiAliasing: 2, shadows: false
    });
    sandbox.window.targetFrameRate = 0;
    sandbox.window.dispatchEvent(new CustomEvent('neko-frame-rate-changed', { detail: { fps: 0 } }));
    assert.deepEqual({ ...commands.filter((command) => command.command === 'render.quality').at(-1).body }, {
        quality: 'medium', targetFrameRate: 0, antiAliasing: 2, shadows: false
    });
    manager.fitModel({ width: 200, height: 300 }, {
        mode: 'height', align: 'bottom-center', padding: 6
    }, { scale: 125, x: 2, y: -3 });
    const fitCommand = commands.filter((command) => command.command === 'model.fit').at(-1);
    assert.equal(fitCommand.body.mode, 'height');
    assert.equal(fitCommand.body.align, 'bottom-center');
    assert.equal(fitCommand.body.viewScale, 125);
    assert.equal(fitCommand.body.viewX, 2);
    assert.equal(fitCommand.body.viewY, -3);
    assert.equal(await manager.waitForRenderedFrame(), true);
    assert.ok(commands.some((command) => command.command === 'surface.sync'));

    assert.equal(manager.setPose({
        poseId: 'badminton-swing',
        rootOffset: { y: 0.1 },
        bones: [{ name: 'RightUpperArm', eulerRadians: { z: -0.5 }, weight: 0.75 }]
    }), true);
    const poseCommand = commands.filter((command) => command.command === 'pose.set').at(-1);
    assert.equal(poseCommand.body.poseId, 'badminton-swing');
    assert.deepEqual({ ...poseCommand.body.rootOffset }, { x: 0, y: 0.1, z: 0 });
    assert.deepEqual({ ...poseCommand.body.bones[0].eulerRadians }, { x: 0, y: 0, z: -0.5 });
    assert.equal(poseCommand.body.bones[0].weight, 0.75);
    assert.equal(manager.resetPose('badminton-swing'), true);
    assert.equal(commands.filter((command) => command.command === 'pose.reset').at(-1).body.poseId, 'badminton-swing');

    await manager.attachAccessory({
        id: 'racket',
        preset: 'badmintonRacket',
        bone: 'RightHand',
        scale: 1.25,
        anchors: [{ name: 'tip', localPosition: { y: 0.5 } }]
    });
    const attachCommand = commands.filter((command) => command.command === 'accessory.attach').at(-1);
    assert.deepEqual({ ...attachCommand.body.scale }, { x: 1.25, y: 1.25, z: 1.25 });
    assert.deepEqual({ ...attachCommand.body.anchors[0].localPosition }, { x: 0, y: 0.5, z: 0 });
    await manager.setAccessoryVisible('racket', false);
    assert.deepEqual({ ...commands.filter((command) => command.command === 'accessory.setVisible').at(-1).body }, {
        id: 'racket', visible: false
    });
    await manager.trackScreenAnchors([
        { name: 'hand', bone: 'RightHand' },
        { name: 'racket-tip', accessoryId: 'racket', anchor: 'tip' }
    ]);
    const trackCommand = commands.filter((command) => command.command === 'anchor.track').at(-1);
    assert.equal(trackCommand.body.tracks.length, 2);
    assert.equal(trackCommand.body.tracks[1].accessoryId, 'racket');
    sandbox.window.NekoUnityAvatar.onUnityEvent(JSON.stringify({
        v: 1,
        name: 'anchor.screen',
        replyTo: '',
        ok: true,
        generation: manager.currentModel.generation,
        body: {
            width: 640,
            height: 360,
            anchors: [{ name: 'racket-tip', x: 320, y: 180, visible: true, behindCamera: false }]
        }
    }));
    assert.deepEqual({ ...manager.getScreenAnchor('racket-tip') }, {
        name: 'racket-tip', x: 680, y: 385, visible: true, behindCamera: false
    });
    await manager.detachAccessory('racket');
    assert.equal(commands.filter((command) => command.command === 'accessory.detach').at(-1).body.id, 'racket');

    const touch = touchInstalls[0].callbacks;
    touch.begin([{ clientX: 500, clientY: 350 }], { pinched: false });
    touch.move([{ clientX: 525, clientY: 365 }], {});
    assert.deepEqual({ ...commands.filter((command) => command.command === 'model.dragPixels').at(-1).body }, {
        dx: 25, dy: 15, width: 1280, height: 720, clamp: true
    });
    touch.begin([
        { clientX: 450, clientY: 350 }, { clientX: 550, clientY: 350 }
    ], { pinched: true });
    touch.move([
        { clientX: 440, clientY: 350 }, { clientX: 560, clientY: 350 }
    ], { ratio: 1.2 });
    assert.equal(commands.filter((command) => command.command === 'model.zoom').at(-1).body.factor, 1.2);
    touch.end({ clientX: 560, clientY: 350 }, { moved: false });

    sandbox.window.dispatchEvent({ type: 'pointermove', clientX: 240, clientY: 125 });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const lookAtCommand = commands.filter((command) => command.command === 'lookAt.pointer').at(-1);
    assert.deepEqual({ ...lookAtCommand.body }, { x: 200, y: 100 });
    const lookAtEnableCount = commands.filter((command) => command.command === 'lookAt.enable').length;
    const pointerCountBeforeLocal = commands.filter((command) => command.command === 'lookAt.pointer').length;
    manager._cursorFollow.setLocalTrackingEnabled(true);
    assert.equal(sandbox.window.humanoidLocalTrackingEnabled, true);
    assert.equal(manager._cursorFollow.isLocalTrackingEnabled(), true);
    manager._cursorFollow._onPointerMove({ clientX: 0, clientY: 0 });
    assert.equal(commands.filter((command) => command.command === 'lookAt.pointer').length, pointerCountBeforeLocal);
    manager._cursorFollow._onPointerMove({ clientX: 240, clientY: 125 });
    assert.equal(commands.filter((command) => command.command === 'lookAt.pointer').length, pointerCountBeforeLocal + 1);
    manager._cursorFollow.setLocalTrackingEnabled(false);
    manager._cursorFollow._onPointerMove({ clientX: 0, clientY: 0 });
    assert.equal(commands.filter((command) => command.command === 'lookAt.pointer').length, pointerCountBeforeLocal + 2);
    assert.equal(commands.filter((command) => command.command === 'lookAt.enable').length, lookAtEnableCount);

    assert.equal(await manager._snapshotAndSavePreferences(), true);
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(preferenceWrites.length, 1);
    assert.deepEqual(preferenceWrites[0].position, { x: 1.5, y: -0.2, z: 0 });
    assert.deepEqual(preferenceWrites[0].scale, { x: 1.2, y: 1.2, z: 1.2 });

    await manager.dispose();
    assert.equal(instances.length, 1);
    assert.equal(instances[0].quit, true);
    assert.equal(manager._runtimeHost, null);
    assert.equal(touchInstalls[0].disposed, true);
    const qualityCommandsAfterDispose = commands.filter((command) => command.command === 'render.quality').length;
    sandbox.window.dispatchEvent(new CustomEvent('neko-render-quality-changed', {
        detail: { quality: 'high' }
    }));
    assert.equal(commands.filter((command) => command.command === 'render.quality').length, qualityCommandsAfterDispose);
});

test('Unity manager forwards rendered frames, display DPR changes, and lock state through direct APIs', async () => {
    const { sandbox, commands } = createSandbox();
    let externalRenderCount = 0;
    sandbox.window.nekoVisitParentBridge = {
        onExternalRender() { externalRenderCount += 1; }
    };
    vm.runInNewContext(MANAGER_SOURCE, sandbox, { filename: 'unity-avatar-manager.js' });
    const manager = new sandbox.window.VRMManager();
    await manager.initRenderer('vrm-canvas', 'vrm-container');
    await manager.loadModel('/static/vrm/sister1.0.vrm', {
        autoPlay: false,
        restorePreferences: false
    });

    await new Promise((resolve) => setTimeout(resolve, 8));
    assert.ok(externalRenderCount > 0);
    assert.equal(manager.getSurfacePixelRatio(), 2);
    sandbox.window.devicePixelRatio = 1.5;
    sandbox.window.dispatchEvent({ type: 'electron-display-changed' });
    assert.equal(manager.getSurfacePixelRatio(), 1.5);
    assert.equal(manager.canvas.width, 1920);
    assert.equal(manager.canvas.height, 1080);

    assert.equal(manager.setLocked(true), true);
    assert.equal(manager.setLocked(false), false);
    assert.deepEqual(
        commands.filter((command) => command.command === 'interaction.lock').map((command) => command.body.locked).slice(-2),
        [true, false]
    );
    await manager.dispose();
});

test('Unity cursor follow restores local tracking without changing the global tracking switch', async () => {
    const { sandbox, commands } = createSandbox();
    sandbox.window.humanoidLocalTrackingEnabled = true;
    vm.runInNewContext(MANAGER_SOURCE, sandbox, { filename: 'unity-avatar-manager.js' });
    const manager = new sandbox.window.VRMManager();
    assert.equal(manager._cursorFollow.isLocalTrackingEnabled(), true);
    manager._cursorFollow.setLocalTrackingEnabled(false);
    assert.equal(manager._cursorFollow.isLocalTrackingEnabled(), false);
    assert.equal(sandbox.window.humanoidLocalTrackingEnabled, false);
    assert.equal(commands.some((command) => command.command === 'lookAt.enable'), false);
    await manager.dispose();
});

test('Unity pan completion preserves the existing cross-display drop contract', async () => {
    const { sandbox, commands, preferenceWrites } = createSandbox();
    const moveCalls = [];
    sandbox.window.electronScreen = {
        async getAllDisplays() {
            return [
                { id: 'left', screenX: 0, screenY: 0, width: 1280, height: 720 },
                { id: 'right', bounds: { x: 1280, y: 0, width: 1280, height: 720 } }
            ];
        },
        async getCurrentDisplay() {
            return { id: 'left', bounds: { x: 0, y: 0, width: 1280, height: 720 } };
        },
        async moveWindowToDisplay(x, y) {
            moveCalls.push({ x, y });
            return {
                success: true,
                sameDisplay: false,
                windowBounds: { x: 1280, y: 0, width: 1280, height: 720 }
            };
        }
    };
    vm.runInNewContext(MANAGER_SOURCE, sandbox, { filename: 'unity-avatar-manager.js' });
    const manager = new sandbox.window.VRMManager();
    await manager.initRenderer('vrm-canvas', 'vrm-container');
    const model = await manager.loadModel('/static/vrm/sister1.0.vrm', {
        autoPlay: false,
        restorePreferences: false
    });
    manager.interaction._dragSession = 7;
    manager.interaction._lastPanDragPointerScreen = { x: 1450, y: 300 };
    manager.interaction._panDragModelCenterOffset = { x: 10, y: -5 };
    assert.equal(await manager.interaction._checkAndSwitchDisplay({ session: 7, model }), true);
    assert.deepEqual(moveCalls, [{ x: 1450, y: 300 }]);
    const drag = commands.filter((command) => command.command === 'model.dragPixels').at(-1);
    assert.deepEqual({ ...drag.body }, {
        dx: -500,
        dy: -130,
        width: 1280,
        height: 720,
        clamp: true
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(preferenceWrites.length, 1);
    await manager.dispose();
});

test('Unity right-button orbit is routed separately and saves without pan or snap', async () => {
    const { sandbox, commands, preferenceWrites, elements } = createSandbox();
    vm.runInNewContext(MANAGER_SOURCE, sandbox, { filename: 'unity-avatar-manager.js' });
    const manager = new sandbox.window.VRMManager();
    await manager.initRenderer('vrm-canvas', 'vrm-container');
    await manager.loadModel('/static/vrm/sister1.0.vrm', {
        autoPlay: false,
        restorePreferences: false
    });
    const canvas = elements.get('vrm-canvas');
    const makePointer = (type, x, y) => ({
        type,
        pointerType: 'mouse',
        pointerId: 4,
        button: 2,
        clientX: x,
        clientY: y,
        screenX: x,
        screenY: y,
        preventDefault() { this.prevented = true; },
        stopPropagation() { this.stopped = true; }
    });
    canvas.dispatchEvent(makePointer('pointerdown', 50, 35));
    sandbox.window.dispatchEvent(makePointer('pointermove', 90, 75));
    sandbox.window.dispatchEvent(makePointer('pointerup', 90, 75));
    await new Promise((resolve) => setTimeout(resolve, 12));
    const orbit = commands.filter((command) => command.command === 'model.orbit');
    assert.deepEqual(orbit.map((command) => command.body.phase), ['start', 'update', 'end']);
    assert.equal(new Set(orbit.map((command) => command.body.interactionId)).size, 1);
    assert.equal(commands.some((command) => command.command === 'model.dragPixels'), false);
    assert.equal(commands.some((command) => command.command === 'model.snap'), false);
    assert.equal(preferenceWrites.length, 1);
    const contextMenu = {
        type: 'contextmenu',
        prevented: false,
        preventDefault() { this.prevented = true; }
    };
    canvas.dispatchEvent(contextMenu);
    assert.equal(contextMenu.prevented, true);

    canvas.dispatchEvent(makePointer('pointerdown', 70, 55));
    sandbox.window.dispatchEvent(makePointer('pointermove', 110, 85));
    sandbox.window.dispatchEvent(makePointer('pointercancel', 110, 85));
    await new Promise((resolve) => setTimeout(resolve, 12));
    const cancelledOrbit = commands.filter((command) => command.command === 'model.orbit').slice(-3);
    assert.deepEqual(cancelledOrbit.map((command) => command.body.phase), ['start', 'update', 'cancel']);
    assert.equal(new Set(cancelledOrbit.map((command) => command.body.interactionId)).size, 1);
    assert.equal(preferenceWrites.length, 2);
    await manager.dispose();
});

test('Unity direct position changes cancel guided movement before taking ownership', async () => {
    const { sandbox, commands } = createSandbox();
    vm.runInNewContext(MANAGER_SOURCE, sandbox, { filename: 'unity-avatar-manager.js' });
    const manager = new sandbox.window.VRMManager();
    await manager.initRenderer('vrm-canvas', 'vrm-container');
    await manager.loadModel('/static/vrm/sister1.0.vrm', {
        autoPlay: false,
        restorePreferences: false
    });
    const realCall = manager._call.bind(manager);
    const pendingMovements = [];
    manager._call = (command, body, generation, timeout) => {
        if (command !== 'model.moveToScreen') return realCall(command, body, generation, timeout);
        return new Promise((resolve) => pendingMovements.push({ body, resolve }));
    };

    assert.equal(manager.interaction._selectMovementTarget(200, 180), true);
    assert.equal(manager.interaction.isMoving, true);
    manager.setModelPosition(0.2, 0.3, 0.4);
    assert.equal(manager.interaction.isMoving, false);
    assert.equal(
        commands.filter((command) => command.command === 'model.moveCancel').at(-1).body.actionId,
        pendingMovements[0].body.actionId
    );

    assert.equal(manager.interaction._selectMovementTarget(240, 210), true);
    assert.equal(manager.interaction.isMoving, true);
    manager.resetModelPosition();
    assert.equal(manager.interaction.isMoving, false);
    assert.equal(
        commands.filter((command) => command.command === 'model.moveCancel').at(-1).body.actionId,
        pendingMovements[1].body.actionId
    );
    assert.deepEqual(
        {
            x: manager.currentModel.transform.position.x,
            y: manager.currentModel.transform.position.y,
            z: manager.currentModel.transform.position.z
        },
        { x: 0, y: 0, z: 0 }
    );

    pendingMovements.forEach(({ body, resolve }) => resolve({ moved: false, actionId: body.actionId }));
    await new Promise((resolve) => setTimeout(resolve, 12));
    manager._call = realCall;
    await manager.dispose();
});

test('Unity guided movement releases walk on arrival and reacquires it for an immediate retarget', async () => {
    const { sandbox, commands, preferenceWrites, elements } = createSandbox();
    const motionCalls = [];
    sandbox.window.NekoMotion = {
        hasOtherExternalPlayback() { return false; },
        async holdExternalPlayback(owner, options) { motionCalls.push(['hold', owner, options]); },
        async releaseExternalPlayback(owner, options) { motionCalls.push(['release', owner, options]); },
        async rest() {}
    };
    vm.runInNewContext(MANAGER_SOURCE, sandbox, { filename: 'unity-avatar-manager.js' });
    const manager = new sandbox.window.VRMManager();
    await manager.initRenderer('vrm-canvas', 'vrm-container');
    await manager.loadModel('/static/vrm/sister1.0.vrm', {
        autoPlay: false,
        restorePreferences: false
    });
    const realCall = manager._call.bind(manager);
    const movementRequests = [];
    manager._call = (command, body, generation, timeout) => {
        if (command !== 'model.moveToScreen') return realCall(command, body, generation, timeout);
        return new Promise((resolve) => {
            movementRequests.push({ command, body, generation, timeout, resolve });
        });
    };
    const keyDown = {
        type: 'keydown', code: 'KeyF', shiftKey: true,
        ctrlKey: false, altKey: false, metaKey: false,
        preventDefault() { this.prevented = true; }
    };
    sandbox.window.dispatchEvent(keyDown);
    assert.equal(keyDown.prevented, true);
    assert.equal(manager.interaction.targetMode, true);
    const canvas = elements.get('vrm-canvas');
    canvas.dispatchEvent({
        type: 'pointerdown', pointerType: 'mouse', button: 0,
        clientX: 50, clientY: 35, screenX: 50, screenY: 35,
        preventDefault() {}, stopPropagation() {}
    });
    await new Promise((resolve) => setTimeout(resolve, 12));
    const firstMovement = movementRequests[0];
    assert.ok(firstMovement);
    assert.equal(firstMovement.body.x, 10);
    assert.equal(firstMovement.body.y, 10);
    assert.equal(firstMovement.body.maxSpeed, 0.9);
    assert.equal(firstMovement.timeout, Infinity);
    assert.equal(manager.interaction.isMoving, true);
    assert.equal(motionCalls.filter(([name]) => name === 'hold').length, 1);
    const walk = commands.filter((command) => command.command === 'animation.play').at(-1);
    assert.equal(walk.body.url, 'http://127.0.0.1:48911/static/vrm/animation/world-walk.vrma.gz');
    assert.equal(walk.body.loop, true);
    assert.equal(walk.body.immediate, true);
    assert.equal(walk.body.movement, true);
    sandbox.window.dispatchEvent({
        type: 'keyup', code: 'KeyF', shiftKey: false,
        ctrlKey: false, altKey: false, metaKey: false
    });
    assert.equal(manager.interaction.targetMode, false);
    assert.equal(commands.some((command) => command.command === 'model.moveCancel'), false);

    sandbox.window.NekoUnityAvatar.onUnityEvent(JSON.stringify({
        v: 1,
        name: 'model.moveArrived',
        replyTo: '',
        ok: true,
        generation: manager.currentModel.generation,
        body: {
            moved: true,
            actionId: firstMovement.body.actionId,
            transform: {
                position: { x: 0.35, y: 0.15, z: 0 },
                rotation: { x: 0, y: 0.8, z: 0 },
                scale: { x: 1, y: 1, z: 1 }
            },
            bounds: { minX: 305, minY: 100, maxX: 905, maxY: 700 }
        }
    }));
    await new Promise((resolve) => setTimeout(resolve, 12));
    assert.equal(manager.interaction.isMoving, false);
    assert.equal(manager.interaction._movementActionId, firstMovement.body.actionId);
    assert.equal(manager.currentModel.transform.position.x, 0.35);
    assert.equal(motionCalls.filter(([name]) => name === 'release').length, 1);

    assert.equal(manager.interaction._selectMovementTarget(140, 125), true);
    await new Promise((resolve) => setTimeout(resolve, 12));
    const secondMovement = movementRequests[1];
    assert.ok(secondMovement);
    assert.equal(manager.interaction.isMoving, true);
    assert.equal(motionCalls.filter(([name]) => name === 'hold').length, 2);
    firstMovement.resolve({ moved: true, actionId: firstMovement.body.actionId });

    sandbox.window.NekoUnityAvatar.onUnityEvent(JSON.stringify({
        v: 1,
        name: 'model.moveArrived',
        replyTo: '',
        ok: true,
        generation: manager.currentModel.generation,
        body: {
            moved: true,
            actionId: secondMovement.body.actionId,
            transform: {
                position: { x: 0.45, y: 0.25, z: 0 },
                rotation: { x: 0, y: 0.6, z: 0 },
                scale: { x: 1, y: 1, z: 1 }
            },
            bounds: { minX: 310, minY: 100, maxX: 910, maxY: 700 }
        }
    }));
    secondMovement.resolve({
        moved: true,
        actionId: secondMovement.body.actionId,
        transform: {
            position: { x: 0.4, y: 0.2, z: 0 },
            rotation: { x: 0, y: 0.2, z: 0 },
            scale: { x: 1, y: 1, z: 1 }
        },
        bounds: { minX: 300, minY: 100, maxX: 900, maxY: 700 }
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(manager.interaction.isMoving, false);
    assert.equal(preferenceWrites.length, 2);
    assert.equal(motionCalls.filter(([name]) => name === 'release').length, 2);
    assert.equal(motionCalls.filter(([name]) => name === 'release').every((call) => call[2].resume), true);
    const stop = commands.filter((command) => command.command === 'animation.stop').at(-1);
    assert.equal(typeof stop.body.actionId, 'string');
    assert.equal(stop.body.preservePending, true);
    manager._call = realCall;
    await manager.dispose();
});

test('Unity model requests keep latest-call-wins ordering while an interaction snapshot is pending', async () => {
    const { sandbox, commands } = createSandbox();
    vm.runInNewContext(MANAGER_SOURCE, sandbox, { filename: 'unity-avatar-manager.js' });
    const manager = new sandbox.window.VRMManager();
    await manager.initRenderer('vrm-canvas', 'vrm-container');
    await manager.loadModel('/static/vrm/first.vrm', {
        autoPlay: false,
        restorePreferences: false
    });

    let releaseSnapshot = null;
    const pendingSnapshot = new Promise((resolve) => { releaseSnapshot = resolve; });
    const realSnapshot = manager._snapshotAndSavePreferences.bind(manager);
    let snapshotCalls = 0;
    manager._snapshotAndSavePreferences = () => {
        snapshotCalls += 1;
        return pendingSnapshot;
    };
    manager.interaction.isMoving = true;
    manager.interaction._movementActionId = 'active-move';

    const superseded = manager.loadModel('/static/vrm/superseded.vrm', {
        autoPlay: false,
        restorePreferences: false
    });
    await Promise.resolve();
    const latest = manager.loadModel('/static/vrm/latest.vrm', {
        autoPlay: false,
        restorePreferences: false
    });
    const latestModel = await latest;
    releaseSnapshot(true);

    assert.equal(await superseded, null);
    assert.equal(snapshotCalls, 1);
    assert.equal(latestModel.url, '/static/vrm/latest.vrm');
    assert.equal(manager.currentModel, latestModel);
    const loadedUrls = commands
        .filter((command) => command.command === 'model.load')
        .map((command) => command.body.url);
    assert.equal(loadedUrls.some((url) => url.endsWith('/static/vrm/superseded.vrm')), false);
    assert.equal(loadedUrls.at(-1).endsWith('/static/vrm/latest.vrm'), true);

    manager._snapshotAndSavePreferences = realSnapshot;
    await manager.unloadModel();
    assert.equal(manager._isLoadingModel, false);
    await manager.dispose();
});

test('Unity dispose remains terminal while its interaction snapshot is pending', async () => {
    const { sandbox, commands, instances } = createSandbox();
    vm.runInNewContext(MANAGER_SOURCE, sandbox, { filename: 'unity-avatar-manager.js' });
    const manager = new sandbox.window.VRMManager();
    await manager.initRenderer('vrm-canvas', 'vrm-container');
    await manager.loadModel('/static/vrm/first.vrm', {
        autoPlay: false,
        restorePreferences: false
    });

    let releaseSnapshot = null;
    manager._snapshotAndSavePreferences = () => new Promise((resolve) => { releaseSnapshot = resolve; });
    manager.interaction.isMoving = true;
    manager.interaction._movementActionId = 'active-move';

    const disposal = manager.dispose();
    await Promise.resolve();
    const lateLoad = await manager.loadModel('/static/vrm/late.vrm', {
        autoPlay: false,
        restorePreferences: false
    });
    assert.equal(lateLoad, null);
    assert.equal(commands.some((command) =>
        command.command === 'model.load' && command.body.url.endsWith('/static/vrm/late.vrm')), false);

    releaseSnapshot(true);
    assert.equal(await disposal, true);
    assert.equal(instances[0].quit, true);
    assert.equal(manager.currentModel, null);
    assert.equal(manager.canvas, null);
    assert.equal(manager._isInitialized, false);
});

test('Unity bridge routes two canvases independently and exposes Unity VMC snapshots', async () => {
    const { sandbox, commands, instances, elements } = createSandbox();
    const secondCanvas = createEventTarget({
        id: 'vrm-canvas-two',
        style: {},
        clientWidth: 400,
        clientHeight: 500,
        setPointerCapture() {},
        getBoundingClientRect() { return { left: 500, top: 40, width: 400, height: 500 }; }
    });
    const secondContainer = createEventTarget({
        id: 'vrm-container-two',
        style: {},
        clientWidth: 400,
        clientHeight: 500
    });
    elements.set(secondCanvas.id, secondCanvas);
    elements.set(secondContainer.id, secondContainer);
    vm.runInNewContext(MANAGER_SOURCE, sandbox, { filename: 'unity-avatar-manager.js' });

    const first = new sandbox.window.VRMManager();
    const second = new sandbox.window.VRMManager();
    await Promise.all([
        first.initRenderer('vrm-canvas', 'vrm-container'),
        second.initRenderer('vrm-canvas-two', 'vrm-container-two')
    ]);
    const [firstModel, secondModel] = await Promise.all([
        first.loadModel('/static/vrm/first.vrm', { autoPlay: false }),
        second.loadModel('/static/vrm/second.vrm', { autoPlay: false })
    ]);
    assert.notEqual(firstModel.generation, secondModel.generation);
    assert.equal(first.currentModel.url, '/static/vrm/first.vrm');
    assert.equal(second.currentModel.url, '/static/vrm/second.vrm');
    assert.equal(instances.length, 2);

    const sampled = [];
    sandbox.window.__NEKO_VMC_ACTIVE__ = true;
    sandbox.window.vrmVmcSender = {
        sample(vrm) { sampled.push(vrm); },
        getSendRateHz() { return 30; },
        releaseVrm() {}
    };
    first.setVmcSamplingEnabled(true);
    await new Promise((resolve) => setTimeout(resolve, 15));
    first.setVmcSamplingEnabled(false);
    assert.ok(commands.some((command) => command.command === 'vmc.snapshot'));
    assert.ok(sampled.length >= 1);
    const head = firstModel.vrm.humanoid.getRawBoneNode('head');
    assert.ok(head);
    assert.equal(head.position.y, 1.4);
    assert.equal(head.quaternion.y, 0.1);
    assert.equal(firstModel.vrm.humanoid.rawRestPose.head.position.y, 1.25);
    assert.equal(firstModel.vrm.humanoid.rawRestPose.head.rotation.w, 1);
    const happy = firstModel.vrm.expressionManager.expressions.find((entry) => entry.expressionName === 'happy');
    assert.equal(happy.weight, 0.75);

    await Promise.all([first.dispose(), second.dispose()]);
    assert.equal(instances.every((instance) => instance.quit), true);
});

test('Unity model replacement clears the previous animation facade when autoplay is disabled', async () => {
    const { sandbox } = createSandbox();
    vm.runInNewContext(MANAGER_SOURCE, sandbox, { filename: 'unity-avatar-manager.js' });
    const manager = new sandbox.window.VRMManager();
    await manager.initRenderer('vrm-canvas', 'vrm-container');
    await manager.loadModel('/static/vrm/animated.vrm', { restorePreferences: false });
    assert.ok(manager.animation.currentAction);
    assert.equal(manager.animation.isPlaying, true);
    assert.equal(manager.animation.isIdleAnimation, true);

    await manager.loadModel('/static/vrm/static.vrm', {
        autoPlay: false,
        restorePreferences: false
    });
    assert.equal(manager.animation.currentAction, null);
    assert.equal(manager.vrmaAction, null);
    assert.equal(manager.animation.isPlaying, false);
    assert.equal(manager.animation.vrmaIsPlaying, false);
    assert.equal(manager.animation.isPaused, false);
    assert.equal(manager.animation.isIdleAnimation, false);
    await manager.dispose();
});

test('Unity failed model replacement keeps the previous model on the active protocol generation', async () => {
    const { sandbox, commands, instances } = createSandbox();
    vm.runInNewContext(MANAGER_SOURCE, sandbox, { filename: 'unity-avatar-manager.js' });
    const manager = new sandbox.window.VRMManager();
    await manager.initRenderer('vrm-canvas', 'vrm-container');
    const previous = await manager.loadModel('/static/vrm/animated.vrm', { restorePreferences: false });
    const previousAction = manager.animation.currentAction;
    const instance = instances[0];
    const realSend = instance.SendMessage.bind(instance);
    instance.SendMessage = (objectName, methodName, raw) => {
        const command = JSON.parse(raw);
        if (command.command !== 'model.load' || !command.body.url.endsWith('/static/vrm/invalid.vrm')) {
            return realSend(objectName, methodName, raw);
        }
        commands.push(command);
        setTimeout(() => sandbox.window.NekoUnityAvatar.onUnityEvent(JSON.stringify({
            v: 1,
            name: 'command.error',
            replyTo: command.id,
            ok: false,
            generation: command.generation,
            error: { code: 'invalid_model_url', message: 'invalid model' }
        })), 0);
    };

    await assert.rejects(
        manager.loadModel('/static/vrm/invalid.vrm', { autoPlay: false, restorePreferences: false }),
        /invalid model/
    );
    assert.equal(manager.currentModel, previous);
    assert.equal(previous.generation, manager._modelGeneration);
    assert.equal(manager._isModelReadyForInteraction, true);
    assert.equal(manager.animation.currentAction, previousAction);
    assert.ok(await manager._call('model.snapshot', {}, previous.generation, 1000));

    const retainedGeneration = previous.generation;
    instance.SendMessage = (_objectName, _methodName, raw) => {
        const command = JSON.parse(raw);
        if (command.command === 'model.load') throw new Error('bridge unavailable');
        return realSend(_objectName, _methodName, raw);
    };
    await assert.rejects(
        manager.loadModel('/static/vrm/not-sent.vrm', { autoPlay: false, restorePreferences: false }),
        /bridge unavailable/
    );
    assert.equal(previous.generation, retainedGeneration);
    assert.equal(manager._modelGeneration, retainedGeneration);
    instance.SendMessage = realSend;
    await manager.dispose();
});

test('Unity manager keeps the existing expression update loop and pause contract', async () => {
    const { sandbox, commands } = createSandbox();
    let updates = 0;
    sandbox.window.VRMExpression = class {
        constructor(manager) { this.manager = manager; this.names = []; }
        getExpressionList() { return this.names.slice(); }
        loadMoodMap() { return Promise.resolve(true); }
        setMood() {}
        update() {
            updates += 1;
            if (updates === 1) this.manager._queueExpressionWeight('blink', 0.5);
        }
    };
    vm.runInNewContext(MANAGER_SOURCE, sandbox, { filename: 'unity-avatar-manager.js' });

    const manager = new sandbox.window.VRMManager();
    await manager.initRenderer('vrm-canvas', 'vrm-container');
    await manager.loadModel('/static/vrm/expression-loop.vrm', { autoPlay: false });
    const staticLoad = commands.find((command) => command.command === 'model.load');
    assert.equal(staticLoad.body.awaitInitialAnimation, false);
    assert.equal(commands.some((command) => command.command === 'animation.play'), false);
    await new Promise((resolve) => setTimeout(resolve, 8));
    assert.ok(updates > 0);
    assert.ok(commands.some((command) => command.command === 'expression.setWeights'));

    manager.pauseRendering();
    const pausedAt = updates;
    await new Promise((resolve) => setTimeout(resolve, 8));
    assert.equal(updates, pausedAt);
    manager.resumeRendering();
    await new Promise((resolve) => setTimeout(resolve, 8));
    assert.ok(updates > pausedAt);
    await manager.dispose();
});

test('Unity manager requests the initial idle before a slow preference read settles', async () => {
    const { sandbox, commands, elements } = createSandbox();
    const originalFetch = sandbox.fetch;
    let resolvePreferences;
    sandbox.fetch = (input, options = {}) => {
        const url = new URL(String(input), sandbox.window.location.href);
        if (url.pathname === '/api/config/preferences' && options.method !== 'POST') {
            return new Promise((resolve) => {
                resolvePreferences = () => resolve({ ok: true, json: async () => ({ models: [] }) });
            });
        }
        return originalFetch(input, options);
    };
    vm.runInNewContext(MANAGER_SOURCE, sandbox, { filename: 'unity-avatar-manager.js' });

    const manager = new sandbox.window.VRMManager();
    await manager.initRenderer('vrm-canvas', 'vrm-container');
    let settled = false;
    const loading = manager.loadModel('/static/vrm/slow-preferences.vrm').then((value) => {
        settled = true;
        return value;
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.ok(commands.some((command) => command.command === 'model.load'));
    assert.ok(commands.some((command) => command.command === 'animation.play'));
    assert.equal(settled, false);
    assert.equal(manager._isModelReadyForInteraction, false);
    const canvas = elements.get('vrm-canvas');
    const pointer = (type, x, y) => ({
        type,
        pointerType: 'mouse',
        pointerId: 9,
        button: 0,
        clientX: x,
        clientY: y,
        screenX: x,
        screenY: y,
        preventDefault() {},
        stopPropagation() {}
    });
    const dragCountBefore = commands.filter((command) => command.command === 'model.dragPixels').length;
    canvas.dispatchEvent(pointer('pointerdown', 600, 400));
    sandbox.window.dispatchEvent(pointer('pointermove', 620, 410));
    sandbox.window.dispatchEvent(pointer('pointerup', 620, 410));
    assert.equal(commands.filter((command) => command.command === 'model.dragPixels').length, dragCountBefore);
    resolvePreferences();
    assert.ok(await loading);
    assert.equal(manager._isModelReadyForInteraction, true);
    canvas.dispatchEvent(pointer('pointerdown', 600, 400));
    sandbox.window.dispatchEvent(pointer('pointermove', 620, 410));
    sandbox.window.dispatchEvent(pointer('pointerup', 620, 410));
    assert.equal(commands.filter((command) => command.command === 'model.dragPixels').length, dragCountBefore + 1);
    await new Promise((resolve) => setTimeout(resolve, 15));
    await manager.dispose();
});

test('Unity lock, drag, and model replacement cancel guided movement and fence late owners', async () => {
    const { sandbox, commands, elements } = createSandbox();
    const playback = [];
    sandbox.window.NekoMotion = {
        hasOtherExternalPlayback() { return false; },
        async holdExternalPlayback(owner, options) { playback.push(['hold', owner, options.token]); },
        async releaseExternalPlayback(owner, options) {
            playback.push(['release', owner, options.token, options.resume]);
        },
        async rest() {}
    };
    vm.runInNewContext(MANAGER_SOURCE, sandbox, { filename: 'unity-avatar-manager.js' });

    const manager = new sandbox.window.VRMManager();
    await manager.initRenderer('vrm-canvas', 'vrm-container');
    await manager.loadModel('/static/vrm/first.vrm', {
        autoPlay: false,
        restorePreferences: false
    });
    manager._snapshotAndSavePreferences = async () => true;
    const realCall = manager._call.bind(manager);
    const movements = [];
    manager._call = (command, body, generation, timeout) => {
        if (command !== 'model.moveToScreen') return realCall(command, body, generation, timeout);
        return new Promise((resolve) => movements.push({ body, generation, resolve }));
    };

    assert.equal(manager.interaction._selectMovementTarget(260, 220), true);
    await new Promise((resolve) => setTimeout(resolve, 8));
    const lockedMovement = movements[0];
    const lockedOwner = manager.interaction._movementOwnerToken;
    assert.equal(lockedOwner, lockedMovement.body.actionId);
    assert.equal(manager.setLocked(true), true);
    assert.equal(manager.interaction.isMoving, false);
    assert.equal(manager.interaction._movementOwnerToken, null);
    assert.equal(
        commands.filter((command) => command.command === 'model.moveCancel').at(-1).body.actionId,
        lockedMovement.body.actionId
    );
    lockedMovement.resolve({
        actionId: lockedMovement.body.actionId,
        moved: true,
        transform: {
            position: { x: 99, y: 99, z: 99 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 }
        }
    });
    await new Promise((resolve) => setTimeout(resolve, 8));
    assert.equal(manager.currentModel.transform.position.x, 0);
    assert.ok(playback.some((entry) =>
        entry[0] === 'release' && entry[2] === lockedOwner && entry[3] === true));

    manager.setLocked(false);
    assert.equal(manager.interaction._selectMovementTarget(300, 240), true);
    await new Promise((resolve) => setTimeout(resolve, 8));
    const draggedMovement = movements[1];
    const canvas = elements.get('vrm-canvas');
    canvas.dispatchEvent({
        type: 'pointerdown', pointerType: 'mouse', pointerId: 11, button: 0,
        clientX: 680, clientY: 425, screenX: 680, screenY: 425,
        preventDefault() {}, stopPropagation() {}
    });
    assert.equal(manager.interaction.isMoving, false);
    assert.equal(manager.interaction.isDragging, true);
    assert.equal(
        commands.filter((command) => command.command === 'model.moveCancel').at(-1).body.actionId,
        draggedMovement.body.actionId
    );
    sandbox.window.dispatchEvent({
        type: 'pointerup', pointerType: 'mouse', pointerId: 11, button: 0,
        clientX: 680, clientY: 425, screenX: 680, screenY: 425,
        preventDefault() {}, stopPropagation() {}
    });
    draggedMovement.resolve({
        actionId: draggedMovement.body.actionId,
        moved: true,
        transform: {
            position: { x: 88, y: 88, z: 88 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 }
        }
    });
    await new Promise((resolve) => setTimeout(resolve, 8));
    assert.notEqual(manager.currentModel.transform.position.x, 88);

    assert.equal(manager.interaction._selectMovementTarget(340, 260), true);
    await new Promise((resolve) => setTimeout(resolve, 8));
    const replacedMovement = movements[2];
    const replacement = await manager.loadModel('/static/vrm/replacement.vrm', {
        autoPlay: false,
        restorePreferences: false
    });
    assert.equal(replacement.url, '/static/vrm/replacement.vrm');
    assert.equal(manager.interaction.isMoving, false);
    assert.equal(
        commands.filter((command) => command.command === 'model.moveCancel').at(-1).body.actionId,
        replacedMovement.body.actionId
    );
    replacedMovement.resolve({
        actionId: replacedMovement.body.actionId,
        moved: true,
        transform: {
            position: { x: 77, y: 77, z: 77 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 }
        }
    });
    await new Promise((resolve) => setTimeout(resolve, 8));
    assert.equal(manager.currentModel, replacement);
    assert.notEqual(replacement.transform.position.x, 77);

    manager._call = realCall;
    await manager.dispose();
});

test('Unity preference writes serialize immutable snapshots and report persistence failures', async () => {
    const { sandbox } = createSandbox();
    vm.runInNewContext(MANAGER_SOURCE, sandbox, { filename: 'unity-avatar-manager.js' });

    const manager = new sandbox.window.VRMManager();
    await manager.initRenderer('vrm-canvas', 'vrm-container');
    await manager.loadModel('/static/vrm/preferences.vrm', {
        autoPlay: false,
        restorePreferences: false
    });
    const realCall = manager._call.bind(manager);
    const snapshots = [
        { position: { x: 1, y: 2, z: 3 }, rotation: { x: 0, y: 0.1, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
        { position: { x: 4, y: 5, z: 6 }, rotation: { x: 0, y: 0.2, z: 0 }, scale: { x: 2, y: 2, z: 2 } },
        { position: { x: 7, y: 8, z: 9 }, rotation: { x: 0, y: 0.3, z: 0 }, scale: { x: 3, y: 3, z: 3 } }
    ];
    manager._call = (command, body, generation, timeout) => command === 'model.snapshot'
        ? Promise.resolve({ transform: snapshots.shift() })
        : realCall(command, body, generation, timeout);

    const posts = [];
    sandbox.fetch = (input, options = {}) => {
        const url = new URL(String(input), sandbox.window.location.href);
        assert.equal(url.pathname, '/api/config/preferences');
        assert.equal(options.method, 'POST');
        return new Promise((resolve) => posts.push({
            body: JSON.parse(options.body),
            succeed: () => resolve({ ok: true, json: async () => ({ success: true }) }),
            fail: () => resolve({ ok: false, status: 500, json: async () => ({ success: false }) })
        }));
    };

    const first = manager.savePreferences({ awaitPersistence: true });
    const second = manager.savePreferences({ awaitPersistence: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(posts.length, 1, 'second write must wait for the first POST');
    assert.deepEqual(posts[0].body.position, { x: 1, y: 2, z: 3 });
    posts[0].succeed();
    assert.equal(await first, true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(posts.length, 2);
    assert.deepEqual(posts[1].body.position, { x: 4, y: 5, z: 6 });
    assert.deepEqual(posts[0].body.position, { x: 1, y: 2, z: 3 });
    posts[1].succeed();
    assert.equal(await second, true);

    const failed = manager.savePreferences({ awaitPersistence: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(posts.length, 3);
    posts[2].fail();
    assert.equal(await failed, false);

    manager._call = realCall;
    await manager.dispose();
});

test('Unity preference timeout aborts safely and a replaced model cannot persist a stale snapshot', async () => {
    const { sandbox } = createSandbox();
    vm.runInNewContext(MANAGER_SOURCE, sandbox, { filename: 'unity-avatar-manager.js' });

    const manager = new sandbox.window.VRMManager();
    await manager.initRenderer('vrm-canvas', 'vrm-container');
    await manager.loadModel('/static/vrm/old-preferences.vrm', {
        autoPlay: false,
        restorePreferences: false
    });
    const realCall = manager._call.bind(manager);
    let resolveOldSnapshot;
    manager._call = (command, body, generation, timeout) => command === 'model.snapshot'
        ? new Promise((resolve) => { resolveOldSnapshot = resolve; })
        : realCall(command, body, generation, timeout);
    let postCount = 0;
    const originalFetch = sandbox.fetch;
    sandbox.fetch = (input, options = {}) => {
        const url = new URL(String(input), sandbox.window.location.href);
        if (url.pathname === '/api/config/preferences' && options.method === 'POST') postCount += 1;
        return originalFetch(input, options);
    };

    const staleSave = manager.savePreferences({ awaitPersistence: true });
    await Promise.resolve();
    const replacement = await manager.loadModel('/static/vrm/new-preferences.vrm', {
        autoPlay: false,
        restorePreferences: false
    });
    resolveOldSnapshot({
        transform: {
            position: { x: 91, y: 92, z: 93 },
            rotation: { x: 0, y: 1, z: 0 },
            scale: { x: 4, y: 4, z: 4 }
        }
    });
    assert.equal(await staleSave, false);
    assert.equal(postCount, 0);
    assert.equal(manager.currentModel, replacement);
    assert.equal(replacement.transform.position.x, 0);

    class TestAbortController {
        constructor() { this.signal = { aborted: false, abortHandler: null }; }
        abort() {
            this.signal.aborted = true;
            if (this.signal.abortHandler) this.signal.abortHandler();
        }
    }
    sandbox.AbortController = TestAbortController;
    sandbox.window.AbortController = TestAbortController;
    const realWindowTimeout = sandbox.window.setTimeout;
    sandbox.window.setTimeout = (callback, delay, ...args) =>
        realWindowTimeout(callback, delay === 5000 ? 1 : delay, ...args);
    let abortedSignal = null;
    sandbox.fetch = (input, options = {}) => {
        const url = new URL(String(input), sandbox.window.location.href);
        assert.equal(url.pathname, '/api/config/preferences');
        assert.equal(options.method, 'POST');
        abortedSignal = options.signal;
        return new Promise((_resolve, reject) => {
            options.signal.abortHandler = () => {
                const error = new Error('aborted');
                error.name = 'AbortError';
                reject(error);
            };
        });
    };
    manager._call = (command, body, generation, timeout) => command === 'model.snapshot'
        ? Promise.resolve({
            transform: {
                position: { x: 1, y: 2, z: 3 },
                rotation: { x: 0, y: 0, z: 0 },
                scale: { x: 1, y: 1, z: 1 }
            }
        })
        : realCall(command, body, generation, timeout);
    assert.equal(await manager.savePreferences({ awaitPersistence: true }), false);
    assert.equal(abortedSignal.aborted, true);

    manager._call = realCall;
    await manager.dispose();
});
