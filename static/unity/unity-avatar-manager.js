/**
 * Unity WebGL VRM renderer adapter.
 *
 * The page keeps the existing window.vrmManager contract so chat, character
 * switching, audio, desktop input regions and the model manager do not need to
 * own Unity details. Rendering and model state live in Unity; this file only
 * translates the established browser calls into versioned commands.
 */
(function installUnityAvatarManager(global) {
    'use strict';

    if (global.UnityVRMManager) return;

    const MANIFEST_URL = '/static/unity/avatar/build-manifest.json';
    const RUNTIME_OBJECT = 'NekoAvatarRuntime';
    const COMMAND_METHOD = 'HandleCommand';
    const DEFAULT_TIMEOUT_MS = 60000;
    const runtimeHosts = new Set();
    let nextModelGeneration = 0;
    const DEFAULT_EXPRESSIONS = Object.freeze([
        'neutral', 'happy', 'angry', 'sad', 'relaxed', 'surprised',
        'aa', 'ih', 'ou', 'ee', 'oh', 'blink', 'blinkLeft', 'blinkRight'
    ]);
    const COMPRESSED_BUNDLED_VRMA_NAMES = new Set([
        'liked', 'wait01', 'wait02', 'wait03', 'wait04', 'wait05',
        '全身展示', '射击姿态', '屈伸运动', '旋转', '模特姿势', '比 V 手势', '致意问候'
    ]);

    function finite(value, fallback) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, finite(value, min)));
    }

    function vector3(value, fallback, allowScalar) {
        const defaults = fallback || { x: 0, y: 0, z: 0 };
        if (allowScalar && Number.isFinite(Number(value))) {
            const scalar = Number(value);
            return { x: scalar, y: scalar, z: scalar };
        }
        const source = value && typeof value === 'object' ? value : {};
        return {
            x: finite(source.x, defaults.x),
            y: finite(source.y, defaults.y),
            z: finite(source.z, defaults.z)
        };
    }

    function absoluteUrl(value) {
        return new URL(String(value || ''), global.location.href).href;
    }

    function normalizeBundledAnimationUrl(value) {
        const path = String(value || '');
        const match = path.match(/^\/static\/vrm\/animation\/([^/?#]+)\.vrma(?:[?#]|$)/i);
        if (!match) return path;
        let name = match[1];
        try { name = decodeURIComponent(name); } catch (_) {}
        return COMPRESSED_BUNDLED_VRMA_NAMES.has(name)
            ? path.replace(/\.vrma(?=[?#]|$)/i, '.vrma.gz')
            : path;
    }

    function createId(prefix) {
        const random = global.crypto && typeof global.crypto.randomUUID === 'function'
            ? global.crypto.randomUUID()
            : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
        return `${prefix}-${random}`;
    }

    function allocateGeneration() {
        nextModelGeneration += 1;
        return nextModelGeneration;
    }

    function resolveWithTimeout(value, timeoutMs, fallback) {
        return new Promise((resolve) => {
            let settled = false;
            let timer = null;
            const finish = (result) => {
                if (settled) return;
                settled = true;
                if (timer !== null) global.clearTimeout(timer);
                resolve(result);
            };
            timer = global.setTimeout(() => finish(fallback), timeoutMs);
            Promise.resolve(value).then(finish, () => finish(fallback));
        });
    }

    function preferencePathFromUrl(modelUrl) {
        let path = String(modelUrl || '');
        if (/^https?:\/\//i.test(path)) {
            try {
                const url = new URL(path, global.location.href);
                if (url.origin !== global.location.origin) return path;
                path = url.pathname;
            } catch (_) {
                return path;
            }
        }
        if (!/^\/(?:user_vrm|static\/vrm|workshop)\//.test(path)) return path;
        try { return decodeURIComponent(path); } catch (_) { return path; }
    }

    function normalizePreferencePath(path) {
        if (!path || typeof path !== 'string') return '';
        let normalized = path.replace(/^https?:\/\/[^/]+/i, '');
        const userPrefix = String(global.VRM_PATHS && global.VRM_PATHS.user_vrm || '/user_vrm').replace(/\/+$/, '');
        const staticPrefix = String(global.VRM_PATHS && global.VRM_PATHS.static_vrm || '/static/vrm').replace(/\/+$/, '');
        const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        normalized = normalized
            .replace(new RegExp(`^${escapeRegex(userPrefix)}/`), '/')
            .replace(new RegExp(`^${escapeRegex(staticPrefix)}/`), '/');
        return normalized.toLowerCase();
    }

    function preferenceFilename(path) {
        const parts = String(path || '').split('/').filter(Boolean);
        return parts.length ? parts[parts.length - 1].toLowerCase() : '';
    }

    class UnityPreferenceStore {
        constructor() {
            this._saveQueue = Promise.resolve();
        }

        async load(modelUrl) {
            if (global.__NEKO_CARD_MAKER_EMBED__ === true || global._cardExportPage === true) return null;
            const controller = typeof AbortController === 'function' ? new AbortController() : null;
            const timer = global.setTimeout(() => controller && controller.abort(), 5000);
            try {
                const response = await fetch('/api/config/preferences', controller ? { signal: controller.signal } : {});
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const payload = await response.json();
                const models = Array.isArray(payload) ? payload : payload && Array.isArray(payload.models) ? payload.models : [];
                const targetPath = preferencePathFromUrl(modelUrl);
                const normalizedTarget = normalizePreferencePath(targetPath);
                const targetFilename = preferenceFilename(targetPath);
                return models.find((item) => {
                    if (!item || typeof item.model_path !== 'string') return false;
                    if (item.model_path === targetPath) return true;
                    const normalizedItem = normalizePreferencePath(item.model_path);
                    if (normalizedItem && normalizedItem === normalizedTarget) return true;
                    const filename = preferenceFilename(item.model_path);
                    return !!(targetFilename && filename && filename === targetFilename);
                }) || null;
            } catch (error) {
                if (!error || error.name !== 'AbortError') {
                    console.warn('[Unity VRM] 获取模型偏好失败:', error);
                }
                return null;
            } finally {
                global.clearTimeout(timer);
            }
        }

        saveUserPreferences(modelPath, position, scale, rotation, display, viewport) {
            if (global.isViewerMode) return Promise.resolve(false);
            const vectorsAreFinite = (value) => value && ['x', 'y', 'z'].every((key) => Number.isFinite(value[key]));
            if (!vectorsAreFinite(position) || !vectorsAreFinite(scale) || scale.x <= 0 || scale.y <= 0 || scale.z <= 0) {
                return Promise.resolve(false);
            }
            const preferences = {
                model_path: preferencePathFromUrl(modelPath),
                position: { x: position.x, y: position.y, z: position.z },
                scale: { x: scale.x, y: scale.y, z: scale.z }
            };
            if (vectorsAreFinite(rotation)) {
                preferences.rotation = { x: rotation.x, y: rotation.y, z: rotation.z };
            }
            if (viewport && Number.isFinite(viewport.width) && Number.isFinite(viewport.height) &&
                viewport.width > 0 && viewport.height > 0) {
                preferences.viewport = { width: viewport.width, height: viewport.height };
            }

            const write = async () => {
                const displayInfo = await Promise.resolve(display).catch(() => null);
                if (displayInfo && Number.isFinite(displayInfo.screenX) && Number.isFinite(displayInfo.screenY)) {
                    preferences.display = { screenX: displayInfo.screenX, screenY: displayInfo.screenY };
                }
                const controller = typeof AbortController === 'function' ? new AbortController() : null;
                const timer = global.setTimeout(() => controller && controller.abort(), 5000);
                try {
                    const response = await fetch('/api/config/preferences', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(preferences),
                        ...(controller ? { signal: controller.signal } : {})
                    });
                    if (!response.ok) return false;
                    const result = await response.json().catch(() => null);
                    return !result || result.success !== false;
                } catch (error) {
                    console.warn('[Unity VRM] 保存模型偏好失败:', error);
                    return false;
                } finally {
                    global.clearTimeout(timer);
                }
            };
            const request = this._saveQueue.then(write, write);
            this._saveQueue = request.catch(() => false);
            return request;
        }
    }

    function loadScriptOnce(src) {
        const existing = Array.from(document.scripts).find((script) => script.src === absoluteUrl(src));
        if (existing) {
            if (existing.dataset.nekoUnityLoaded === 'true' || typeof global.createUnityInstance === 'function') {
                return Promise.resolve();
            }
            return new Promise((resolve, reject) => {
                let settled = false;
                const finish = (callback, value) => {
                    if (settled) return;
                    settled = true;
                    global.clearTimeout(timer);
                    existing.removeEventListener('load', onLoad);
                    existing.removeEventListener('error', onError);
                    callback(value);
                };
                const onLoad = () => finish(resolve);
                const onError = () => finish(reject, new Error(`Unity loader failed: ${src}`));
                const timer = global.setTimeout(() => {
                    if (typeof global.createUnityInstance === 'function') finish(resolve);
                    else finish(reject, new Error(`Unity loader timed out: ${src}`));
                }, 15000);
                existing.addEventListener('load', onLoad, { once: true });
                existing.addEventListener('error', onError, { once: true });
                global.setTimeout(() => {
                    if (typeof global.createUnityInstance === 'function') finish(resolve);
                }, 0);
            });
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.dataset.nekoUnityLoader = 'true';
            let settled = false;
            const finish = (callback, value) => {
                if (settled) return;
                settled = true;
                global.clearTimeout(timer);
                callback(value);
            };
            const timer = global.setTimeout(() => {
                finish(reject, new Error(`Unity loader timed out: ${src}`));
            }, 15000);
            script.addEventListener('load', () => {
                script.dataset.nekoUnityLoaded = 'true';
                finish(resolve);
            }, { once: true });
            script.addEventListener('error', () => finish(reject, new Error(`Unity loader failed: ${src}`)), { once: true });
            (document.head || document.documentElement).appendChild(script);
        });
    }

    class RuntimeHost {
        constructor(manager) {
            this.instance = null;
            this.canvas = null;
            this.manager = manager || null;
            this.manifest = null;
            this._loadPromise = null;
            this._pending = new Map();
            this._ready = false;
            this._shutdown = false;
        }

        async ensure(canvas, progress) {
            if (this._shutdown) throw new Error('Unity renderer host is disposed');
            if (!canvas) throw new Error('Unity VRM canvas is missing');
            if (this.instance) {
                if (this.canvas !== canvas) throw new Error('Unity renderer is already bound to another canvas');
                return this.instance;
            }
            if (this._loadPromise) return this._loadPromise;

            this.canvas = canvas;
            // Only active Unity players participate in global event routing.
            // Constructing a manager for a non-VRM page must not leave a ghost
            // runtime that can claim another player's generation-0 events.
            runtimeHosts.add(this);
            this._loadPromise = this._boot(canvas, progress).catch((error) => {
                runtimeHosts.delete(this);
                this._loadPromise = null;
                this.instance = null;
                this._ready = false;
                throw error;
            });
            return this._loadPromise;
        }

        async _boot(canvas, progress) {
            const response = await fetch(MANIFEST_URL, { cache: 'no-cache' });
            if (!response.ok) {
                throw new Error(`Unity build manifest unavailable (${response.status})`);
            }
            const manifest = await response.json();
            const required = ['loaderUrl', 'dataUrl', 'frameworkUrl', 'codeUrl'];
            const missing = required.filter((key) => typeof manifest[key] !== 'string' || !manifest[key]);
            if (manifest.version !== 1 || missing.length) {
                throw new Error(`Invalid Unity build manifest: ${missing.join(', ') || 'version'}`);
            }
            this.manifest = manifest;

            await loadScriptOnce(manifest.loaderUrl);
            if (typeof global.createUnityInstance !== 'function') {
                throw new Error('Unity loader did not expose createUnityInstance');
            }

            canvas.style.background = 'transparent';
            const initialPixelRatio = clamp(
                this.manager && this.manager._pixelRatio,
                0.5,
                8
            );
            canvas.width = Math.max(1, Math.round((canvas.clientWidth || 1) * initialPixelRatio));
            canvas.height = Math.max(1, Math.round((canvas.clientHeight || 1) * initialPixelRatio));
            const config = {
                dataUrl: manifest.dataUrl,
                frameworkUrl: manifest.frameworkUrl,
                codeUrl: manifest.codeUrl,
                streamingAssetsUrl: manifest.streamingAssetsUrl || '/static/unity/avatar/StreamingAssets',
                companyName: manifest.companyName || 'Project N.E.K.O.',
                productName: manifest.productName || 'NekoAvatarRenderer',
                productVersion: manifest.productVersion || '1.0.0',
                webglContextAttributes: {
                    alpha: true,
                    antialias: true,
                    premultipliedAlpha: true,
                    preserveDrawingBuffer: true
                },
                // Runtime preview/export quality changes require the documented
                // manual canvas-size mode; this adapter owns the backing store.
                matchWebGLToCanvasSize: false,
                devicePixelRatio: 1
            };
            const instance = await global.createUnityInstance(canvas, config, (value) => {
                if (typeof progress === 'function') progress(clamp(value, 0, 1));
            });
            if (this._shutdown) {
                if (instance && typeof instance.Quit === 'function') await instance.Quit();
                throw new Error('Unity renderer host was disposed during startup');
            }
            this.instance = instance;
            this._ready = true;
            return this.instance;
        }

        attach(manager) {
            this.manager = manager;
        }

        async call(command, body, generation, timeoutMs) {
            await this.ensure(this.canvas);
            if (!this.instance || !this._ready) throw new Error('Unity renderer is not ready');

            const id = createId('unity');
            const payload = {
                v: 1,
                id,
                generation: Number.isInteger(generation) ? generation : 0,
                command,
                body: body || {}
            };

            return new Promise((resolve, reject) => {
                const effectiveTimeout = timeoutMs === Infinity ? null : (timeoutMs || DEFAULT_TIMEOUT_MS);
                const timer = effectiveTimeout === null ? null : global.setTimeout(() => {
                    this._pending.delete(id);
                    reject(new Error(`Unity command timed out: ${command}`));
                }, effectiveTimeout);
                this._pending.set(id, { resolve, reject, timer, command });
                try {
                    this.instance.SendMessage(RUNTIME_OBJECT, COMMAND_METHOD, JSON.stringify(payload));
                } catch (error) {
                    if (timer !== null) global.clearTimeout(timer);
                    this._pending.delete(id);
                    if (error && !error.code) error.code = 'bridge_send_failed';
                    reject(error);
                }
            });
        }

        notify(command, body, generation) {
            if (!this.instance || !this._ready) return false;
            const payload = {
                v: 1,
                id: '',
                generation: Number.isInteger(generation) ? generation : 0,
                command,
                body: body || {}
            };
            try {
                this.instance.SendMessage(RUNTIME_OBJECT, COMMAND_METHOD, JSON.stringify(payload));
                return true;
            } catch (_) {
                return false;
            }
        }

        async shutdown() {
            if (this._shutdown) return;
            this._shutdown = true;
            runtimeHosts.delete(this);
            const error = new Error('Unity renderer host was disposed');
            this._pending.forEach((pending) => {
                if (pending.timer !== null) global.clearTimeout(pending.timer);
                pending.reject(error);
            });
            this._pending.clear();
            const instance = this.instance;
            this.instance = null;
            this._ready = false;
            this.manager = null;
            this.canvas = null;
            this.manifest = null;
            if (instance && typeof instance.Quit === 'function') {
                try { await instance.Quit(); } catch (quitError) {
                    console.warn('[Unity VRM] Unity runtime 退出失败:', quitError);
                }
            }
            this._loadPromise = null;
        }

        handleEvent(raw) {
            let message = raw;
            if (typeof raw === 'string') {
                try { message = JSON.parse(raw); } catch (_) { return; }
            }
            if (!message || message.v !== 1 || typeof message.name !== 'string') return;

            if (message.replyTo) {
                const pending = this._pending.get(message.replyTo);
                if (pending) {
                    if (pending.timer !== null) global.clearTimeout(pending.timer);
                    this._pending.delete(message.replyTo);
                    if (message.ok === false) {
                        const detail = message.error && (message.error.message || message.error.code);
                        const error = new Error(detail || `Unity command failed: ${pending.command}`);
                        if (message.error && message.error.code) error.code = message.error.code;
                        pending.reject(error);
                    } else {
                        pending.resolve(message.body || {});
                    }
                }
            }

            if (this.manager && typeof this.manager._handleUnityEvent === 'function') {
                this.manager._handleUnityEvent(message);
            }
        }

        accepts(message) {
            if (!message || typeof message !== 'object') return false;
            if (message.replyTo && this._pending.has(message.replyTo)) return true;
            return Number.isInteger(message.generation) &&
                this.manager && message.generation === this.manager._modelGeneration;
        }
    }

    global.NekoUnityAvatar = global.NekoUnityAvatar || {};
    global.NekoUnityAvatar.onUnityEvent = (raw) => {
        let message = raw;
        if (typeof raw === 'string') {
            try { message = JSON.parse(raw); } catch (_) { return; }
        }
        if (!message || message.v !== 1 || typeof message.name !== 'string') return;
        const host = Array.from(runtimeHosts).find((candidate) => candidate.accepts(message));
        if (host) host.handleEvent(message);
    };
    global.NekoUnityAvatar.getRuntime = (manager) => manager && manager._runtimeHost
        ? manager._runtimeHost
        : (Array.from(runtimeHosts)[0] || null);

    class EventEmitter {
        constructor() { this._listeners = new Map(); }
        addEventListener(name, handler) {
            if (typeof handler !== 'function') return;
            const set = this._listeners.get(name) || new Set();
            set.add(handler);
            this._listeners.set(name, set);
        }
        removeEventListener(name, handler) {
            const set = this._listeners.get(name);
            if (set) set.delete(handler);
        }
        emit(name, detail) {
            const set = this._listeners.get(name);
            if (!set) return;
            const event = { type: name, detail };
            if (detail && typeof detail === 'object') Object.assign(event, detail);
            Array.from(set).forEach((handler) => {
                try { handler(event); } catch (error) { console.error(error); }
            });
        }
    }

    class MutableVector3 {
        constructor(x, y, z, onChange) {
            this.x = finite(x, 0);
            this.y = finite(y, 0);
            this.z = finite(z, 0);
            this.isVector3 = true;
            this._onChange = onChange;
        }
        _changed() { if (this._onChange) this._onChange(this); return this; }
        set(x, y, z) { this.x = finite(x, this.x); this.y = finite(y, this.y); this.z = finite(z, this.z); return this._changed(); }
        copy(value) { return this.set(value && value.x, value && value.y, value && value.z); }
        clone() { return new MutableVector3(this.x, this.y, this.z, null); }
        add(value) { return this.set(this.x + finite(value && value.x, 0), this.y + finite(value && value.y, 0), this.z + finite(value && value.z, 0)); }
        multiplyScalar(value) { const scalar = finite(value, 1); return this.set(this.x * scalar, this.y * scalar, this.z * scalar); }
        distanceTo(value) {
            const dx = this.x - finite(value && value.x, 0);
            const dy = this.y - finite(value && value.y, 0);
            const dz = this.z - finite(value && value.z, 0);
            return Math.hypot(dx, dy, dz);
        }
    }

    function createTransformState(manager) {
        const sync = () => manager._scheduleTransformSync();
        let visible = true;
        const node = {
            position: new MutableVector3(0, 0, 0, sync),
            rotation: new MutableVector3(0, 0, 0, sync),
            scale: new MutableVector3(1, 1, 1, sync),
            parent: true,
            traverse() {},
            updateMatrixWorld() {},
            getWorldPosition(target) { return target && typeof target.copy === 'function' ? target.copy(this.position) : this.position.clone(); }
        };
        Object.defineProperty(node, 'visible', {
            enumerable: true,
            configurable: false,
            get: () => visible,
            set: (value) => {
                visible = value !== false;
                manager._notify('model.visibility', { visible });
            }
        });
        return node;
    }

    class UnityExpressionAdapter {
        constructor(manager) {
            this.manager = manager;
            this.names = DEFAULT_EXPRESSIONS.slice();
            this.baseExpression = 'neutral';
            this.autoReturnToNeutral = true;
        }
        getExpressionList() { return this.names.slice(); }
        loadMoodMap() { return Promise.resolve(true); }
        setBaseExpression(name, value) {
            this.baseExpression = String(name || 'neutral');
            return this.manager._setExpression(this.baseExpression, value === undefined ? 1 : value, true);
        }
        resetBaseExpression() {
            this.baseExpression = 'neutral';
            return this.manager._setExpression('neutral', 1, true);
        }
        setMood(name, value) { return this.setBaseExpression(name, value); }
        setEmotion(name, value) { return this.setBaseExpression(name, value); }
        reset() { return this.resetBaseExpression(); }
    }

    class UnityAnimationAdapter {
        constructor(manager) {
            this.manager = manager;
            this.vrmaMixer = new EventEmitter();
            this._lipSyncFrame = 0;
            this._lipSyncAnalyser = null;
            this._lipSyncSamples = null;
            this._lastLipSyncSentAt = 0;
            this._lastLipSyncFrameAt = 0;
            this._formantAnalyzer = null;
            this.vrmaIsPlaying = false;
            this.isPlaying = false;
            this.isPaused = false;
            this.isIdleAnimation = false;
            this.currentAction = null;
            this.lipSyncActive = false;
        }
        startLipSync(analyser) {
            if (!analyser || (
                typeof analyser.getByteTimeDomainData !== 'function' &&
                typeof analyser.getByteFrequencyData !== 'function'
            )) return false;
            this.stopLipSync();
            this._lipSyncAnalyser = analyser;
            this.lipSyncActive = true;
            if (typeof global.FormantLipSyncAnalyzer === 'function' &&
                typeof analyser.getByteFrequencyData === 'function') {
                try { this._formantAnalyzer = new global.FormantLipSyncAnalyzer(analyser); }
                catch (error) {
                    this._formantAnalyzer = null;
                    console.warn('[Unity VRM] 五元音口型分析器初始化失败，使用音量口型:', error);
                }
            }
            const size = Math.max(32, analyser.fftSize || 2048);
            this._lipSyncSamples = new Uint8Array(size);
            const tick = (timestamp) => {
                if (!this._lipSyncAnalyser) return;
                if (!this._lastLipSyncSentAt || timestamp - this._lastLipSyncSentAt >= 33) {
                    if (this._formantAnalyzer) {
                        const previous = this._lastLipSyncFrameAt || timestamp - 16;
                        const weights = this._formantAnalyzer.update(Math.max(0, (timestamp - previous) / 1000));
                        this.manager._notify('viseme.setWeights', {
                            aa: clamp(weights.aa, 0, 1),
                            ih: clamp(weights.ih, 0, 1),
                            ou: clamp(weights.ou, 0, 1),
                            ee: clamp(weights.ee, 0, 1),
                            oh: clamp(weights.oh, 0, 1)
                        });
                    } else {
                        this._lipSyncAnalyser.getByteTimeDomainData(this._lipSyncSamples);
                        let sum = 0;
                        for (let i = 0; i < this._lipSyncSamples.length; i += 1) {
                            const centered = (this._lipSyncSamples[i] - 128) / 128;
                            sum += centered * centered;
                        }
                        const mouth = clamp(Math.sqrt(sum / this._lipSyncSamples.length) * 5.5, 0, 1);
                        this.manager._notify('viseme.set', { name: 'aa', value: mouth });
                    }
                    this._lastLipSyncSentAt = timestamp;
                    this._lastLipSyncFrameAt = timestamp;
                }
                this._lipSyncFrame = global.requestAnimationFrame(tick);
            };
            this._lipSyncFrame = global.requestAnimationFrame(tick);
            return true;
        }
        stopLipSync() {
            if (this._lipSyncFrame) global.cancelAnimationFrame(this._lipSyncFrame);
            this._lipSyncFrame = 0;
            this._lipSyncAnalyser = null;
            this._lipSyncSamples = null;
            this._lastLipSyncFrameAt = 0;
            this.lipSyncActive = false;
            if (this._formantAnalyzer && typeof this._formantAnalyzer.reset === 'function') {
                this._formantAnalyzer.reset();
            }
            this._formantAnalyzer = null;
            this.manager._notify('viseme.setWeights', { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 });
        }
        playVRMAAnimation(url, options) { return this.manager.playVRMAAnimation(url, options); }
        seekTo(seconds, options) { return this.manager.seekVRMAAnimation(seconds, options); }
        stopVRMAAnimation(options) { return this.manager.stopVRMAAnimation(options); }
        reset() { this.stopLipSync(); return this.manager.stopVRMAAnimation(); }
        update() {}
        updateMouthExpressionMapping() {}
        dispose() { this.reset(); }
    }

    class UnityInteractionAdapter {
        constructor(manager) {
            this.manager = manager;
            this.isLocked = false;
            this.isDragging = false;
            this.dragMode = null;
            this.isMoving = false;
            this.targetMode = false;
            this._faceCameraEnabled = true;
            this._movementArmed = false;
            this.movementToken = 0;
            this.movementMaxSpeed = 0.9;
            this.movementAcceleration = 2.8;
            this.movementDeceleration = 4.2;
            this.movementArrivalThreshold = 0.012;
            this._movementActionId = '';
            this._movementPlaybackAction = null;
            this._movementOwnerToken = null;
            this._movementHeldCode = null;
            this._movementHeldModifiers = null;
            this._movementKeyDownHandler = null;
            this._movementKeyUpHandler = null;
            this._movementBlurHandler = null;
            this._movementShortcutChangedHandler = null;
            this._cachedScreenBounds = null;
            this._boundCanvas = null;
            this._handlers = null;
            this._touchGestures = null;
            this._savePositionDebounceTimer = null;
            this._dragSession = 0;
            this._lastPanDragPointerScreen = null;
            this._panDragModelCenterOffset = null;
            this._dragHintPanStartPointer = null;
            this._dragHintPanLastPointer = null;
            this._dragHintApproachShown = false;
            this._isSnappingModel = false;
            this._orbitInteractionId = '';
            Object.defineProperty(this, 'enableFaceCamera', {
                enumerable: true,
                configurable: false,
                get: () => this._faceCameraEnabled,
                set: (value) => {
                    this._faceCameraEnabled = value !== false;
                }
            });
        }
        checkLocked() { return this.isLocked; }
        setLocked(value) {
            const wasDragging = this.isDragging;
            const mode = this.dragMode || 'pan';
            const session = this._dragSession;
            const model = this.manager.currentModel;
            this.isLocked = !!value;
            this.manager.isLocked = this.isLocked;
            this.manager._notify('interaction.lock', { locked: this.isLocked });
            if (this.isLocked) {
                this._exitMovementTargetMode();
                const interrupted = this._cancelGuidedMovement();
                if (wasDragging) {
                    this.isDragging = false;
                    this.dragMode = null;
                    if (this.manager.canvas) this.manager.canvas.style.cursor = 'default';
                    if (global.DragHelpers && typeof global.DragHelpers.restoreButtonPointerEvents === 'function') {
                        global.DragHelpers.restoreButtonPointerEvents();
                    }
                    this.manager._notify('interaction.drag', { phase: 'end', mode });
                    if (mode === 'orbit') {
                        const interactionId = this._orbitInteractionId;
                        this._orbitInteractionId = '';
                        this.manager._notify('model.orbit', { phase: 'end', interactionId });
                        void this._savePositionAfterInteraction({
                            isCurrent: () => session === this._dragSession &&
                                this.manager.currentModel === model && !this.isDragging
                        });
                    } else {
                        void this._finishPanDrag(session, model);
                    }
                } else if (interrupted) {
                    void this._savePositionAfterInteraction();
                }
            }
            return this.isLocked;
        }
        enableMouseTracking(value) { this.manager.setMouseTrackingEnabled(value); }
        updateModelBoundsCache() { return this.manager._refreshClientBoundsFromLocal(); }
        updateScreenBounds() { return this.manager.getModelScreenBounds(); }
        hitTestBounds(x, y) { return this._hitTestModel(x, y); }
        update() {}
        clampModelPosition(value) { return value; }
        _isYuiGuideDragLocked() {
            const body = document.body;
            return !!(body && body.classList && (
                body.classList.contains('yui-guide-home-ui-suppressed') ||
                body.classList.contains('yui-taking-over')
            ));
        }
        _isEditableTarget(target) {
            if (target && target.isContentEditable) return true;
            if (!target || typeof target.closest !== 'function') return false;
            if (target.closest('textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) {
                return true;
            }
            const input = target.closest('input');
            return !!input && !['button', 'checkbox', 'color', 'file', 'hidden', 'image',
                'radio', 'range', 'reset', 'submit'].includes(input.type);
        }
        _isKeyboardInteractiveTarget(target) {
            if (this._isEditableTarget(target)) return true;
            if (!target || typeof target.closest !== 'function') return false;
            return !!target.closest('input, button, a[href], summary, audio[controls], video[controls], '
                + '[role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="switch"], '
                + '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="option"], '
                + '[role="tab"], [role="slider"], [role="spinbutton"], [tabindex]:not([tabindex="-1"]):not(canvas)');
        }
        _exitMovementTargetMode() {
            this._movementHeldCode = null;
            this._movementHeldModifiers = null;
            this.targetMode = false;
            if (!this.isDragging && this.manager.canvas) this.manager.canvas.style.cursor = 'default';
        }
        _installGuidedMovementKeyboard() {
            if (this._movementKeyDownHandler || typeof global.addEventListener !== 'function') return;
            this._movementKeyDownHandler = (event) => {
                if (event.defaultPrevented || event.repeat || event.isComposing || event.keyCode === 229) return;
                if (this._isEditableTarget(event.target)) return;
                const hasCommandModifier = event.ctrlKey || event.altKey || event.metaKey;
                if (event.code === 'Tab' && !hasCommandModifier) return;
                if (!hasCommandModifier && ['Enter', 'NumpadEnter', 'Space', 'Escape', 'ArrowUp',
                    'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.code) &&
                    this._isKeyboardInteractiveTarget(event.target)) return;
                const shortcut = global.nekoVrmGuidedMovementShortcut;
                if (shortcut === undefined) {
                    if (event.code !== 'KeyF' || event.ctrlKey || event.metaKey || event.altKey) return;
                } else {
                    if (!shortcut || event.code !== shortcut.code) return;
                    if (['ctrlKey', 'altKey', 'shiftKey', 'metaKey'].some((key) =>
                        !!event[key] !== !!shortcut[key])) return;
                }
                if (this.checkLocked() || this._isYuiGuideDragLocked()) return;
                this._movementHeldCode = event.code;
                this._movementHeldModifiers = shortcut === undefined ? null : { ...shortcut };
                this.targetMode = true;
                if (this.manager.canvas) this.manager.canvas.style.cursor = 'crosshair';
                if (typeof event.preventDefault === 'function') event.preventDefault();
            };
            this._movementKeyUpHandler = (event) => {
                if (!this._movementHeldCode) return;
                const modifiers = this._movementHeldModifiers;
                const modifierReleased = modifiers && [
                    ['ctrlKey', 'Control'], ['altKey', 'Alt'], ['shiftKey', 'Shift'], ['metaKey', 'Meta']
                ].some(([key, code]) => modifiers[key] &&
                    (event.code === `${code}Left` || event.code === `${code}Right`) && !event[key]);
                if (event.code !== this._movementHeldCode && !modifierReleased) return;
                this._exitMovementTargetMode();
            };
            this._movementBlurHandler = () => this._exitMovementTargetMode();
            this._movementShortcutChangedHandler = () => this._exitMovementTargetMode();
            global.addEventListener('keydown', this._movementKeyDownHandler);
            global.addEventListener('keyup', this._movementKeyUpHandler);
            global.addEventListener('blur', this._movementBlurHandler);
            global.addEventListener('neko:vrm-guided-movement-shortcut-changed', this._movementShortcutChangedHandler);
        }
        _removeGuidedMovementKeyboard() {
            if (this._movementKeyDownHandler) global.removeEventListener('keydown', this._movementKeyDownHandler);
            if (this._movementKeyUpHandler) global.removeEventListener('keyup', this._movementKeyUpHandler);
            if (this._movementBlurHandler) global.removeEventListener('blur', this._movementBlurHandler);
            if (this._movementShortcutChangedHandler) {
                global.removeEventListener('neko:vrm-guided-movement-shortcut-changed', this._movementShortcutChangedHandler);
            }
            this._movementKeyDownHandler = null;
            this._movementKeyUpHandler = null;
            this._movementBlurHandler = null;
            this._movementShortcutChangedHandler = null;
            this._exitMovementTargetMode();
        }
        setMovementSpeed(speed) {
            const parsed = Number(speed);
            if (!Number.isFinite(parsed)) return this.movementMaxSpeed;
            this.movementMaxSpeed = clamp(parsed, 0, 0.9);
            if (this.movementMaxSpeed === 0) this._cancelGuidedMovement();
            return this.movementMaxSpeed;
        }
        async _beginMovementPlayback(ownerToken) {
            const motion = global.NekoMotion;
            if (!motion || typeof motion.holdExternalPlayback !== 'function' ||
                typeof motion.releaseExternalPlayback !== 'function' || typeof motion.rest !== 'function') return;
            if (motion.hasOtherExternalPlayback && motion.hasOtherExternalPlayback('guided-movement')) return;
            try {
                await motion.holdExternalPlayback('guided-movement', { token: ownerToken });
                if (!this.isMoving || this._movementOwnerToken !== ownerToken) {
                    await motion.releaseExternalPlayback('guided-movement', { token: ownerToken, resume: false });
                    return;
                }
                let playbackAction = null;
                const played = await this.manager.playVRMAAnimation('/static/vrm/animation/world-walk.vrma.gz', {
                    loop: true,
                    fadeDuration: 0.2,
                    immediate: true,
                    isIdle: false,
                    movement: true,
                    onStarted: (action) => { playbackAction = action; },
                    shouldApply: () => this.isMoving && this._movementOwnerToken === ownerToken &&
                        !(motion.hasOtherExternalPlayback && motion.hasOtherExternalPlayback('guided-movement'))
                });
                if (!this.isMoving || this._movementOwnerToken !== ownerToken) {
                    if (played && playbackAction) {
                        this.manager.stopVRMAAnimation({ expectedAction: playbackAction, preservePending: true });
                    }
                    await motion.releaseExternalPlayback('guided-movement', { token: ownerToken, resume: false });
                    return;
                }
                if (played) this._movementPlaybackAction = playbackAction;
            } catch (error) {
                console.warn('[Unity VRM] 引导移动动作不可用，继续纯位移:', error);
            }
        }
        async _releaseMovementPlayback(ownerToken, playbackAction, resume) {
            if (playbackAction) {
                this.manager.stopVRMAAnimation({ expectedAction: playbackAction, preservePending: true });
            }
            const motion = global.NekoMotion;
            if (ownerToken && motion && typeof motion.releaseExternalPlayback === 'function') {
                try {
                    await motion.releaseExternalPlayback('guided-movement', {
                        token: ownerToken,
                        resume: resume !== false
                    });
                } catch (error) {
                    console.warn('[Unity VRM] 引导移动结束时恢复待机失败:', error);
                }
            }
        }
        _cancelGuidedMovement({ resume = true } = {}) {
            if (!this.isMoving && !this._movementOwnerToken && !this._movementActionId) return false;
            this.movementToken += 1;
            const actionId = this._movementActionId;
            const ownerToken = this._movementOwnerToken;
            const playbackAction = this._movementPlaybackAction;
            this.isMoving = false;
            this._movementActionId = '';
            this._movementOwnerToken = null;
            this._movementPlaybackAction = null;
            if (actionId) this.manager._notify('model.moveCancel', { actionId });
            void this._releaseMovementPlayback(ownerToken, playbackAction, resume);
            return true;
        }
        _selectMovementTarget(clientX, clientY) {
            const model = this.manager.currentModel;
            if (!model || this.movementMaxSpeed <= 0) return false;
            const point = this.manager._toCanvasPoint(clientX, clientY);
            const wasMoving = this.isMoving;
            const wasRestoring = !wasMoving && !!this._movementActionId;
            const token = ++this.movementToken;
            const actionId = createId('move');
            if (!wasMoving && !wasRestoring) {
                void this._savePositionAfterInteraction();
            }
            const motion = global.NekoMotion;
            if (!this._movementOwnerToken && motion && typeof motion.holdExternalPlayback === 'function' &&
                typeof motion.releaseExternalPlayback === 'function' && typeof motion.rest === 'function' &&
                !(motion.hasOtherExternalPlayback && motion.hasOtherExternalPlayback('guided-movement'))) {
                this._movementOwnerToken = actionId;
                void this._beginMovementPlayback(actionId);
            }
            this.isMoving = true;
            this._movementActionId = actionId;
            void this.manager._call('model.moveToScreen', {
                x: point.x,
                y: point.y,
                width: Math.max(1, this.manager.canvas && this.manager.canvas.clientWidth || global.innerWidth),
                height: Math.max(1, this.manager.canvas && this.manager.canvas.clientHeight || global.innerHeight),
                maxSpeed: this.movementMaxSpeed,
                acceleration: this.movementAcceleration,
                deceleration: this.movementDeceleration,
                arrival: this.movementArrivalThreshold,
                minVisiblePixels: 200,
                actionId
            }, model.generation, Infinity).then(async (result) => {
                if (token !== this.movementToken || this._movementActionId !== actionId ||
                    this.manager.currentModel !== model) return;
                if (result && result.transform) this.manager._applyTransformSnapshot(result.transform);
                if (result && result.bounds) this.manager._applyBounds(result.bounds);
                const ownerToken = this._movementOwnerToken;
                const playbackAction = this._movementPlaybackAction;
                this.isMoving = false;
                this._movementActionId = '';
                this._movementOwnerToken = null;
                this._movementPlaybackAction = null;
                await this._releaseMovementPlayback(ownerToken, playbackAction, true);
                if (token === this.movementToken && !this.isMoving && this.manager.currentModel === model) {
                    await this._savePositionAfterInteraction();
                }
            }).catch(async (error) => {
                if (token !== this.movementToken || this._movementActionId !== actionId ||
                    this.manager.currentModel !== model) return;
                if (!error || !['superseded', 'cancelled', 'stale_generation'].includes(error.code)) {
                    console.warn('[Unity VRM] 引导移动失败:', error);
                }
                const ownerToken = this._movementOwnerToken;
                const playbackAction = this._movementPlaybackAction;
                this.isMoving = false;
                this._movementActionId = '';
                this._movementOwnerToken = null;
                this._movementPlaybackAction = null;
                await this._releaseMovementPlayback(ownerToken, playbackAction, true);
            });
            return true;
        }
        _getProjectedModelCenterInWindow() {
            const bounds = this.manager.getModelScreenBounds();
            if (!bounds || !Number.isFinite(bounds.centerX) || !Number.isFinite(bounds.centerY)) return null;
            return { x: bounds.centerX, y: bounds.centerY };
        }
        _rememberPanDragPointer(event, { captureOffset = false } = {}) {
            const screenX = event ? Number(event.screenX) : NaN;
            const screenY = event ? Number(event.screenY) : NaN;
            if (Number.isFinite(screenX) && Number.isFinite(screenY)) {
                this._lastPanDragPointerScreen = { x: screenX, y: screenY };
            }
            if (!captureOffset) return;
            const clientX = event ? Number(event.clientX) : NaN;
            const clientY = event ? Number(event.clientY) : NaN;
            const center = this._getProjectedModelCenterInWindow();
            this._panDragModelCenterOffset = center && Number.isFinite(clientX) && Number.isFinite(clientY)
                ? { x: center.x - clientX, y: center.y - clientY }
                : { x: 0, y: 0 };
        }
        _rememberDragHintPanPointer(event, { start = false } = {}) {
            const screenX = event ? Number(event.screenX) : NaN;
            const screenY = event ? Number(event.screenY) : NaN;
            if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) return;
            const pointer = { screenX, screenY };
            if (start) {
                pointer.startedAt = Date.now();
                this._dragHintPanStartPointer = pointer;
                this._dragHintApproachShown = false;
            }
            this._dragHintPanLastPointer = pointer;
        }
        async _recordDragHintPointerEdgeRelease() {
            const helper = global.NekoAvatarMultiScreenDragHint;
            const start = this._dragHintPanStartPointer;
            const release = this._dragHintPanLastPointer;
            if (!helper || typeof helper.recordPointerEdgeRelease !== 'function' || !start || !release) return false;
            return helper.recordPointerEdgeRelease('vrm', {
                startedAt: start.startedAt,
                startScreenX: start.screenX,
                startScreenY: start.screenY,
                screenX: release.screenX,
                screenY: release.screenY
            });
        }
        async _recordDragHintPointerEdgeApproach() {
            const helper = global.NekoAvatarMultiScreenDragHint;
            const start = this._dragHintPanStartPointer;
            const pointer = this._dragHintPanLastPointer;
            if (!helper || typeof helper.recordPointerEdgeApproach !== 'function' ||
                this._dragHintApproachShown || !start || !pointer) return false;
            const shown = await helper.recordPointerEdgeApproach('vrm', {
                startedAt: start.startedAt,
                startScreenX: start.screenX,
                startScreenY: start.screenY,
                screenX: pointer.screenX,
                screenY: pointer.screenY
            });
            if (shown) this._dragHintApproachShown = true;
            return shown;
        }
        _moveModelCenterToWindowPoint(targetX, targetY) {
            if (!this.manager.currentModel || !Number.isFinite(targetX) || !Number.isFinite(targetY)) return false;
            const center = this._getProjectedModelCenterInWindow();
            if (!center) return false;
            const dx = targetX - center.x;
            const dy = targetY - center.y;
            if (!Number.isFinite(dx) || !Number.isFinite(dy)) return false;
            if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
                this.manager.applyScreenDelta(dx, dy, { clamp: true });
            }
            return true;
        }
        async _snapModelIntoScreen({ animate = true } = {}) {
            if (this._isSnappingModel || !this.manager.currentModel) return false;
            const model = this.manager.currentModel;
            this._isSnappingModel = true;
            try {
                const result = await this.manager._call('model.snap', {
                    minVisiblePixels: 200,
                    animate: animate !== false
                }, model.generation, 10000);
                if (this.manager.currentModel !== model) return false;
                if (result && result.transform) this.manager._applyTransformSnapshot(result.transform);
                if (result && result.bounds) this.manager._applyBounds(result.bounds);
                return !!(result && result.moved);
            } catch (error) {
                if (!error || !['stale_generation', 'superseded'].includes(error.code)) {
                    console.warn('[Unity VRM] 模型回屏失败:', error);
                }
                return false;
            } finally {
                this._isSnappingModel = false;
            }
        }
        async _checkAndSwitchDisplay({ session = this._dragSession, model = this.manager.currentModel } = {}) {
            const screenApi = global.electronScreen;
            if (!screenApi || typeof screenApi.getAllDisplays !== 'function' ||
                typeof screenApi.getCurrentDisplay !== 'function' ||
                typeof screenApi.moveWindowToDisplay !== 'function' || !model) return false;
            const generation = model.generation;
            const stillOwnsInteraction = () => this.manager.currentModel === model &&
                model.generation === generation && session === this._dragSession && !this.isDragging;
            const recordDisplaySwitchMiss = () => {
                const helper = global.NekoAvatarMultiScreenDragHint;
                if (helper && typeof helper.recordDisplaySwitchMiss === 'function') {
                    helper.recordDisplaySwitchMiss('vrm');
                }
            };
            let displaySwitchAttempted = false;
            let displaySwitched = false;
            try {
                const center = this._getProjectedModelCenterInWindow();
                if (!center) return false;
                const dragPointer = this._lastPanDragPointerScreen;
                const hasDragPointer = dragPointer && Number.isFinite(dragPointer.x) && Number.isFinite(dragPointer.y);
                const pointerOffset = this._panDragModelCenterOffset || { x: 0, y: 0 };
                this._lastPanDragPointerScreen = null;
                this._panDragModelCenterOffset = null;

                const windowWidth = Math.max(1, finite(global.innerWidth, 1));
                const windowHeight = Math.max(1, finite(global.innerHeight, 1));
                const centerInsideWindow = center.x >= 0 && center.x < windowWidth &&
                    center.y >= 0 && center.y < windowHeight;
                if (!hasDragPointer && centerInsideWindow) return false;

                displaySwitchAttempted = true;
                const displays = await screenApi.getAllDisplays();
                if (!stillOwnsInteraction()) return false;
                if (!Array.isArray(displays) || displays.length <= 1) {
                    recordDisplaySwitchMiss();
                    return false;
                }
                const currentDisplay = await screenApi.getCurrentDisplay();
                if (!stillOwnsInteraction()) return false;
                if (!currentDisplay) {
                    recordDisplaySwitchMiss();
                    return false;
                }
                const currentScreenX = Number.isFinite(currentDisplay.screenX)
                    ? currentDisplay.screenX : finite(currentDisplay.bounds && currentDisplay.bounds.x, NaN);
                const currentScreenY = Number.isFinite(currentDisplay.screenY)
                    ? currentDisplay.screenY : finite(currentDisplay.bounds && currentDisplay.bounds.y, NaN);
                if (!Number.isFinite(currentScreenX) || !Number.isFinite(currentScreenY)) {
                    recordDisplaySwitchMiss();
                    return false;
                }

                const modelScreenX = currentScreenX + center.x;
                const modelScreenY = currentScreenY + center.y;
                const pointerWindowX = hasDragPointer ? dragPointer.x - currentScreenX : NaN;
                const pointerWindowY = hasDragPointer ? dragPointer.y - currentScreenY : NaN;
                const pointerOutsideCurrentWindow = hasDragPointer && !(
                    pointerWindowX >= 0 && pointerWindowX < windowWidth &&
                    pointerWindowY >= 0 && pointerWindowY < windowHeight
                );
                if (hasDragPointer && !pointerOutsideCurrentWindow && centerInsideWindow) return false;
                const useDragPointer = hasDragPointer && pointerOutsideCurrentWindow;
                const switchScreenX = useDragPointer ? dragPointer.x : modelScreenX;
                const switchScreenY = useDragPointer ? dragPointer.y : modelScreenY;
                let targetDisplay = null;
                for (const display of displays) {
                    const x = Number.isFinite(display.screenX) ? display.screenX
                        : finite(display.bounds && display.bounds.x, NaN);
                    const y = Number.isFinite(display.screenY) ? display.screenY
                        : finite(display.bounds && display.bounds.y, NaN);
                    const width = Number.isFinite(display.width) ? display.width
                        : finite(display.bounds && display.bounds.width, NaN);
                    const height = Number.isFinite(display.height) ? display.height
                        : finite(display.bounds && display.bounds.height, NaN);
                    if (![x, y, width, height].every(Number.isFinite)) continue;
                    if (switchScreenX >= x && switchScreenX < x + width &&
                        switchScreenY >= y && switchScreenY < y + height) {
                        targetDisplay = { ...display, screenX: x, screenY: y, width, height };
                        break;
                    }
                }
                if (!targetDisplay) return false;

                const result = await screenApi.moveWindowToDisplay(switchScreenX, switchScreenY);
                if (!(result && result.success && !result.sameDisplay)) {
                    if (stillOwnsInteraction()) recordDisplaySwitchMiss();
                    return false;
                }
                displaySwitched = true;
                const hint = global.NekoAvatarMultiScreenDragHint;
                if (hint && typeof hint.markDisplaySwitchSuccess === 'function') {
                    hint.markDisplaySwitchSuccess('vrm');
                }
                if (!stillOwnsInteraction()) return true;

                const resultBounds = result.windowBounds || {};
                const targetOriginX = Number.isFinite(resultBounds.x) ? resultBounds.x : targetDisplay.screenX;
                const targetOriginY = Number.isFinite(resultBounds.y) ? resultBounds.y : targetDisplay.screenY;
                const desiredX = useDragPointer
                    ? switchScreenX - targetOriginX + finite(pointerOffset.x, 0)
                    : modelScreenX - targetOriginX;
                const desiredY = useDragPointer
                    ? switchScreenY - targetOriginY + finite(pointerOffset.y, 0)
                    : modelScreenY - targetOriginY;
                await new Promise((resolve) => global.requestAnimationFrame(resolve));
                await new Promise((resolve) => global.requestAnimationFrame(resolve));
                if (!stillOwnsInteraction()) return true;
                this.manager.onWindowResize();
                if (typeof this.manager.waitForRenderedFrame === 'function') {
                    await this.manager.waitForRenderedFrame();
                    if (!stillOwnsInteraction()) return true;
                }
                this._moveModelCenterToWindowPoint(desiredX, desiredY);
                if (!useDragPointer) {
                    await this._snapModelIntoScreen({ animate: true });
                    if (!stillOwnsInteraction()) return true;
                }
                await this._savePositionAfterInteraction();
                return true;
            } catch (error) {
                console.error('[Unity VRM] 检测或切换屏幕失败:', error);
                if (displaySwitchAttempted && !displaySwitched) recordDisplaySwitchMiss();
                return displaySwitched;
            }
        }
        async _finishPanDrag(session, model) {
            try { await this._recordDragHintPointerEdgeRelease(); } catch (_) {}
            if (session !== this._dragSession || this.manager.currentModel !== model || this.isDragging) return;
            const switched = await this._checkAndSwitchDisplay({ session, model });
            if (switched || session !== this._dragSession || this.manager.currentModel !== model || this.isDragging) return;
            await this._snapModelIntoScreen({ animate: true });
            if (session === this._dragSession && this.manager.currentModel === model && !this.isDragging) {
                await this._savePositionAfterInteraction();
            }
        }
        _hitTestModel(x, y) {
            const bounds = this.manager.getModelScreenBounds();
            if (!bounds) return false;
            const cx = bounds.centerX;
            const cy = bounds.centerY;
            const rx = Math.max(1, bounds.width * 0.34);
            const ry = Math.max(1, bounds.height * 0.49);
            const nx = (finite(x, -1) - cx) / rx;
            const ny = (finite(y, -1) - cy) / ry;
            return nx * nx + ny * ny <= 1;
        }
        initDragAndZoom() {
            const canvas = this.manager.canvas;
            if (!canvas || this._boundCanvas === canvas) return;
            this.cleanupDragAndZoom();
            this._boundCanvas = canvas;
            this._installGuidedMovementKeyboard();
            let lastX = 0;
            let lastY = 0;
            let gazeFrame = 0;
            let gazePoint = null;

            const pointerDown = (event) => {
                if (event.pointerType === 'touch' && this._touchGestures) return;
                if (this.isLocked || this._isYuiGuideDragLocked() || !this.manager.currentModel ||
                    this.manager._isModelReadyForInteraction === false) return;
                const button = Number.isInteger(event.button) ? event.button : 0;
                if (button === 0 && this.targetMode) {
                    if (typeof event.preventDefault === 'function') event.preventDefault();
                    if (typeof event.stopPropagation === 'function') event.stopPropagation();
                    this._selectMovementTarget(event.clientX, event.clientY);
                    canvas.style.cursor = 'crosshair';
                    return;
                }
                if (![0, 1, 2].includes(button)) return;
                if (button !== 2 && !this._hitTestModel(event.clientX, event.clientY)) return;
                this._cancelGuidedMovement();
                this._dragSession += 1;
                this.isDragging = true;
                this.dragMode = button === 2 ? 'orbit' : 'pan';
                lastX = event.clientX;
                lastY = event.clientY;
                if (this.dragMode === 'pan') {
                    this._rememberPanDragPointer(event, { captureOffset: true });
                    this._rememberDragHintPanPointer(event, { start: true });
                    canvas.style.cursor = 'move';
                } else {
                    this._orbitInteractionId = createId('orbit');
                    this.manager._notify('model.orbit', {
                        phase: 'start', interactionId: this._orbitInteractionId,
                        x: event.clientX, y: event.clientY
                    });
                    canvas.style.cursor = 'crosshair';
                }
                if (canvas.setPointerCapture && event.pointerId !== undefined) {
                    try { canvas.setPointerCapture(event.pointerId); } catch (_) {}
                }
                if (global.DragHelpers && typeof global.DragHelpers.disableButtonPointerEvents === 'function') {
                    global.DragHelpers.disableButtonPointerEvents();
                }
                this.manager._notify('interaction.drag', {
                    phase: 'start', mode: this.dragMode, x: event.clientX, y: event.clientY
                });
                if (typeof event.preventDefault === 'function') event.preventDefault();
                if (typeof event.stopPropagation === 'function') event.stopPropagation();
            };
            const pointerMove = (event) => {
                if (event.pointerType === 'touch' && this._touchGestures) return;
                gazePoint = { clientX: event.clientX, clientY: event.clientY };
                if (!gazeFrame) {
                    gazeFrame = global.requestAnimationFrame(() => {
                        gazeFrame = 0;
                        if (!gazePoint) return;
                        this.manager._handlePointerLookAt(gazePoint);
                    });
                }
                if (this.isDragging && (this.isLocked || this._isYuiGuideDragLocked())) {
                    const mode = this.dragMode || 'pan';
                    const session = this._dragSession;
                    const model = this.manager.currentModel;
                    this.isDragging = false;
                    this.dragMode = null;
                    canvas.style.cursor = 'default';
                    if (global.DragHelpers && typeof global.DragHelpers.restoreButtonPointerEvents === 'function') {
                        global.DragHelpers.restoreButtonPointerEvents();
                    }
                    if (mode === 'orbit') {
                        const interactionId = this._orbitInteractionId;
                        this._orbitInteractionId = '';
                        this.manager._notify('model.orbit', { phase: 'end', interactionId });
                        void this._savePositionAfterInteraction({
                            isCurrent: () => session === this._dragSession &&
                                this.manager.currentModel === model && !this.isDragging
                        });
                    } else {
                        void this._finishPanDrag(session, model);
                    }
                    return;
                }
                if (!this.isDragging) return;
                const dx = event.clientX - lastX;
                const dy = event.clientY - lastY;
                lastX = event.clientX;
                lastY = event.clientY;
                if (this.dragMode === 'orbit') {
                    this.manager._notify('model.orbit', {
                        phase: 'update', interactionId: this._orbitInteractionId,
                        x: event.clientX, y: event.clientY
                    });
                } else {
                    this._rememberPanDragPointer(event);
                    this._rememberDragHintPanPointer(event);
                    void this._recordDragHintPointerEdgeApproach().catch(() => false);
                    this.manager.applyScreenDelta(dx, dy, { clamp: true });
                }
            };
            const pointerUp = (event, cancelled = false) => {
                if (event && event.pointerType === 'touch' && this._touchGestures) return;
                if (!this.isDragging) return;
                const mode = this.dragMode || 'pan';
                if (mode === 'pan') {
                    this._rememberPanDragPointer(event);
                    this._rememberDragHintPanPointer(event);
                }
                const session = this._dragSession;
                const model = this.manager.currentModel;
                this.isDragging = false;
                this.dragMode = null;
                canvas.style.cursor = this.targetMode ? 'crosshair' : 'default';
                if (global.DragHelpers && typeof global.DragHelpers.restoreButtonPointerEvents === 'function') {
                    global.DragHelpers.restoreButtonPointerEvents();
                }
                this.manager._notify('interaction.drag', {
                    phase: 'end', mode,
                    x: finite(event && event.clientX, 0),
                    y: finite(event && event.clientY, 0)
                });
                if (mode === 'orbit') {
                    const interactionId = this._orbitInteractionId;
                    this._orbitInteractionId = '';
                    this.manager._notify('model.orbit', {
                        phase: cancelled ? 'cancel' : 'end',
                        interactionId
                    });
                    void this._savePositionAfterInteraction({
                        isCurrent: () => session === this._dragSession &&
                            this.manager.currentModel === model && !this.isDragging
                    });
                } else {
                    void this._finishPanDrag(session, model);
                }
            };
            const pointerCancel = (event) => pointerUp(event, true);
            const contextMenu = (event) => {
                if (typeof event.preventDefault === 'function') event.preventDefault();
            };
            const auxClick = (event) => {
                if (event.button !== 1) return;
                if (typeof event.preventDefault === 'function') event.preventDefault();
                if (typeof event.stopPropagation === 'function') event.stopPropagation();
            };
            const wheel = (event) => {
                if (this.isLocked || this._isYuiGuideDragLocked() ||
                    this.manager._isModelReadyForInteraction === false ||
                    !this._hitTestModel(event.clientX, event.clientY)) return;
                event.preventDefault();
                this.manager._notify('model.zoom', { delta: clamp(event.deltaY, -1000, 1000) });
                this._debouncedSavePosition();
            };
            this._handlers = {
                pointerDown, pointerMove, pointerUp, pointerCancel, wheel, contextMenu, auxClick,
                gazeFrame: () => gazeFrame
            };
            canvas.addEventListener('pointerdown', pointerDown, true);
            global.addEventListener('pointermove', pointerMove, true);
            global.addEventListener('pointerup', pointerUp, true);
            global.addEventListener('pointercancel', pointerCancel, true);
            canvas.addEventListener('wheel', wheel, { passive: false });
            canvas.addEventListener('auxclick', auxClick);
            canvas.addEventListener('contextmenu', contextMenu);

            const touchApi = global.NekoModelTouchGestures;
            if (touchApi && typeof touchApi.install === 'function') {
                let lastTouchPoint = null;
                let lastPinchRatio = 1;
                this._touchGestures = touchApi.install(canvas, {
                    enabled: () => !this.isLocked && !this._isYuiGuideDragLocked() &&
                        this.manager._isModelReadyForInteraction !== false && !!this.manager.currentModel,
                    hitTest: (event) => this._hitTestModel(event.clientX, event.clientY),
                    begin: (points) => {
                        this._dragSession += 1;
                        this._cancelGuidedMovement();
                        if (points.length === 1) {
                            lastTouchPoint = { x: points[0].clientX, y: points[0].clientY };
                            lastPinchRatio = 1;
                            this.isDragging = true;
                            this.dragMode = 'pan';
                            this._rememberPanDragPointer(points[0], { captureOffset: true });
                            this._rememberDragHintPanPointer(points[0], { start: true });
                            this.manager._notify('interaction.drag', {
                                phase: 'start', x: lastTouchPoint.x, y: lastTouchPoint.y
                            });
                        } else {
                            lastTouchPoint = null;
                            lastPinchRatio = 1;
                            this.isDragging = false;
                            this.dragMode = null;
                        }
                    },
                    move: (points, gesture) => {
                        if (points.length === 1 && lastTouchPoint) {
                            const next = { x: points[0].clientX, y: points[0].clientY };
                            this.manager.applyScreenDelta(next.x - lastTouchPoint.x, next.y - lastTouchPoint.y);
                            lastTouchPoint = next;
                            this._rememberPanDragPointer(points[0]);
                            this._rememberDragHintPanPointer(points[0]);
                            return;
                        }
                        if (points.length !== 2) return;
                        const ratio = Math.max(0.01, finite(gesture && gesture.ratio, 1));
                        const factor = ratio / Math.max(0.01, lastPinchRatio);
                        lastPinchRatio = ratio;
                        if (Math.abs(factor - 1) > 0.002) {
                            this.manager._notify('model.zoom', { factor: clamp(factor, 0.2, 5) });
                        }
                    },
                    end: (event, state) => {
                        const wasDragging = this.isDragging;
                        const session = this._dragSession;
                        const model = this.manager.currentModel;
                        if (wasDragging) {
                            this._rememberPanDragPointer(event);
                            this._rememberDragHintPanPointer(event);
                        }
                        this.isDragging = false;
                        this.dragMode = null;
                        lastTouchPoint = null;
                        lastPinchRatio = 1;
                        if (wasDragging) {
                            this.manager._notify('interaction.drag', {
                                phase: 'end',
                                x: finite(event && event.clientX, 0),
                                y: finite(event && event.clientY, 0)
                            });
                        }
                        if (state && !state.cancelled && state.moved) {
                            void this._finishPanDrag(session, model);
                        }
                    }
                });
            }
        }
        cleanupDragAndZoom() {
            this._cancelGuidedMovement({ resume: true });
            this._removeGuidedMovementKeyboard();
            if (this.dragMode === 'orbit' && this._orbitInteractionId) {
                this.manager._notify('model.orbit', {
                    phase: 'cancel', interactionId: this._orbitInteractionId
                });
            }
            this._orbitInteractionId = '';
            if (!this._handlers || !this._boundCanvas) {
                this.isDragging = false;
                this.dragMode = null;
                this._dragSession += 1;
                return;
            }
            const h = this._handlers;
            this._boundCanvas.removeEventListener('pointerdown', h.pointerDown, true);
            global.removeEventListener('pointermove', h.pointerMove, true);
            global.removeEventListener('pointerup', h.pointerUp, true);
            global.removeEventListener('pointercancel', h.pointerCancel, true);
            this._boundCanvas.removeEventListener('wheel', h.wheel);
            this._boundCanvas.removeEventListener('auxclick', h.auxClick);
            this._boundCanvas.removeEventListener('contextmenu', h.contextMenu);
            const frame = h.gazeFrame();
            if (frame) global.cancelAnimationFrame(frame);
            if (this._touchGestures && typeof this._touchGestures.dispose === 'function') {
                this._touchGestures.dispose();
            }
            this._touchGestures = null;
            this._handlers = null;
            this._boundCanvas = null;
            this.isDragging = false;
            this.dragMode = null;
            this._dragSession += 1;
            this._lastPanDragPointerScreen = null;
            this._panDragModelCenterOffset = null;
            this._dragHintPanStartPointer = null;
            this._dragHintPanLastPointer = null;
            if (global.DragHelpers && typeof global.DragHelpers.restoreButtonPointerEvents === 'function') {
                global.DragHelpers.restoreButtonPointerEvents();
            }
            if (this._savePositionDebounceTimer) {
                global.clearTimeout(this._savePositionDebounceTimer);
                this._savePositionDebounceTimer = null;
            }
        }
        _savePositionAfterInteraction(options) { return this.manager._snapshotAndSavePreferences(options); }
        _debouncedSavePosition() {
            if (this._savePositionDebounceTimer) global.clearTimeout(this._savePositionDebounceTimer);
            this._savePositionDebounceTimer = global.setTimeout(() => {
                this._savePositionDebounceTimer = null;
                void this._savePositionAfterInteraction();
            }, 500);
        }
        cleanupFloatingButtonsMouseTracking() {}
        dispose() {
            this.cleanupDragAndZoom();
            this._cachedScreenBounds = null;
        }
    }

    class UnityVRMManager {
        constructor() {
            this.canvas = null;
            this.container = null;
            this.currentModel = null;
            this.model = null;
            this.animationMixer = null;
            this.vrmaAction = null;
            this._animationFrameId = null;
            this._lastExpressionFrameTime = 0;
            this._expressionLoopErrorShown = false;
            this._uiUpdateLoopId = null;
            this._isInitialized = false;
            this._isDisposed = false;
            this._disposeRequested = false;
            this._isLoadingModel = false;
            this._loadState = 'idle';
            this._activeLoadToken = 0;
            this._modelGeneration = allocateGeneration();
            this._goodbyeClicked = false;
            this._uiWindowHandlers = [];
            this._coreWindowHandlers = [];
            this._resizeObserver = null;
            this._transformSyncFrame = 0;
            this._stateSyncFrame = 0;
            this._expressionSyncFrame = 0;
            this._pendingExpressionWeights = new Map();
            this._animationRequestToken = 0;
            this._vmcTimer = 0;
            this._vmcSamplingToken = 0;
            this._vmcWarningShown = false;
            this._headBounds = null;
            this._modelProfile = null;
            this._screenAnchors = new Map();
            this._anchorSurface = null;
            this._expressions = DEFAULT_EXPRESSIONS.slice();
            this._pixelRatio = Math.min(2, Math.max(1, finite(global.devicePixelRatio, 1)));
            this.isLocked = false;
            this._mouseTrackingEnabled = global.mouseTrackingEnabled !== false;
            this._localTrackingEnabled = global.humanoidLocalTrackingEnabled === true;
            this._runtimeHost = new RuntimeHost(this);
            this._preferenceStore = new UnityPreferenceStore();

            this.expression = typeof global.VRMExpression === 'function'
                ? new global.VRMExpression(this)
                : new UnityExpressionAdapter(this);
            this.animation = new UnityAnimationAdapter(this);
            this.animationModule = this.animation;
            this.interaction = new UnityInteractionAdapter(this);
            this._cursorFollow = {
                _completeDisable: false,
                setLocalTrackingEnabled: (value) => {
                    this._localTrackingEnabled = value === true;
                    global.humanoidLocalTrackingEnabled = this._localTrackingEnabled;
                    return this._localTrackingEnabled;
                },
                isLocalTrackingEnabled: () => this._localTrackingEnabled,
                setEnabled: (value) => this.setMouseTrackingEnabled(value),
                isEnabled: () => this._mouseTrackingEnabled,
                _onPointerMove: (event) => this._handlePointerLookAt(event)
            };
            this.cursorFollow = this._cursorFollow;

            this._lighting = {
                ambient: finite(global.VRM_DEFAULT_LIGHTING && global.VRM_DEFAULT_LIGHTING.ambient, 0.83),
                main: finite(global.VRM_DEFAULT_LIGHTING && global.VRM_DEFAULT_LIGHTING.main, 1.91),
                fill: finite(global.VRM_DEFAULT_LIGHTING && global.VRM_DEFAULT_LIGHTING.fill, 0),
                rim: finite(global.VRM_DEFAULT_LIGHTING && global.VRM_DEFAULT_LIGHTING.rim, 0),
                top: finite(global.VRM_DEFAULT_LIGHTING && global.VRM_DEFAULT_LIGHTING.top, 0),
                bottom: finite(global.VRM_DEFAULT_LIGHTING && global.VRM_DEFAULT_LIGHTING.bottom, 0),
                exposure: finite(global.VRM_DEFAULT_LIGHTING && global.VRM_DEFAULT_LIGHTING.exposure, 1.1),
                toneMapping: finite(global.VRM_DEFAULT_LIGHTING && global.VRM_DEFAULT_LIGHTING.toneMapping, 7),
                outlineWidthScale: finite(
                    global.VRM_DEFAULT_LIGHTING && global.VRM_DEFAULT_LIGHTING.outlineWidthScale,
                    1
                )
            };
            this._qualityOutlineEnabled = true;
        }

        async initRenderer(canvasId, containerId, lighting) {
            if (this._disposeRequested) throw new Error('Unity VRM manager is being disposed');
            if (this._isDisposed) this._isDisposed = false;
            if (!this._runtimeHost || this._runtimeHost._shutdown) {
                this._runtimeHost = new RuntimeHost(this);
            }
            const canvas = document.getElementById(canvasId || 'vrm-canvas');
            const container = document.getElementById(containerId || 'vrm-container');
            if (!canvas || !container) throw new Error('Unity VRM host elements are missing');

            this.canvas = canvas;
            this.container = container;
            this.container.style.display = 'block';
            this.canvas.style.display = 'block';
            this.canvas.style.visibility = 'visible';
            this.canvas.style.background = 'transparent';

            this._runtimeHost.canvas = canvas;
            this._runtimeHost.attach(this);
            await this._runtimeHost.ensure(canvas, (progress) => {
                global.dispatchEvent(new CustomEvent('unity-vrm-loading-progress', { detail: { progress } }));
            });

            this._isInitialized = true;
            this._installRenderSettingsListeners();
            this.interaction.initDragAndZoom();
            this._installResizeObserver();
            this.applyLighting(lighting || {});
            this.applyQualitySettings({
                quality: global.renderQuality || 'medium',
                targetFrameRate: global.targetFrameRate
            });
            this.onWindowResize();
            this.startAnimateLoop();
            return this;
        }

        _settleInteractionBeforeModelChange() {
            const interaction = this.interaction;
            const model = this.currentModel;
            const hadActiveInteraction = !!(interaction && (
                interaction.isDragging || interaction.isMoving || interaction._movementActionId ||
                interaction._movementOwnerToken || interaction._movementPlaybackAction
            ));
            if (!interaction) return null;
            interaction._cancelGuidedMovement({ resume: true });
            if (interaction.dragMode === 'orbit' && interaction._orbitInteractionId) {
                this._notify('model.orbit', {
                    phase: 'cancel', interactionId: interaction._orbitInteractionId
                });
            }
            if (interaction.isDragging) {
                this._notify('interaction.drag', { phase: 'end', mode: interaction.dragMode || 'pan' });
            }
            interaction._orbitInteractionId = '';
            interaction.isDragging = false;
            interaction.dragMode = null;
            interaction._dragSession += 1;
            if (hadActiveInteraction && model && this.currentModel === model) {
                return this._snapshotAndSavePreferences({
                    isCurrent: () => this.currentModel === model
                });
            }
            return null;
        }

        async loadModel(modelUrl, options) {
            if (this._disposeRequested) return null;
            // Register intent before any await so a later load/unload/dispose always wins.
            const loadToken = ++this._activeLoadToken;
            if (!this._isInitialized) await this.initRenderer('vrm-canvas', 'vrm-container');
            if (this._disposeRequested || loadToken !== this._activeLoadToken) return null;
            this._isModelReadyForInteraction = false;
            const interactionSettle = this._settleInteractionBeforeModelChange();
            if (interactionSettle) await interactionSettle;
            if (this._disposeRequested || loadToken !== this._activeLoadToken) return null;
            const opts = options || {};
            const url = absoluteUrl(modelUrl);
            const previousGeneration = this.currentModel && this.currentModel.generation;
            const generation = allocateGeneration();
            this._modelGeneration = generation;
            this._animationRequestToken += 1;
            this._screenAnchors.clear();
            this._anchorSurface = null;
            this._modelProfile = null;
            this._isLoadingModel = true;
            this._loadState = 'loading';
            try {
                const restorePreferences = opts.restorePreferences !== false && opts.embed !== true;
                const preferencesPromise = restorePreferences
                    ? this._preferenceStore.load(modelUrl)
                    : Promise.resolve(null);
                const body = await this._call('model.load', {
                    url,
                    awaitInitialAnimation: opts.autoPlay !== false
                }, generation, 120000);
                if (loadToken !== this._activeLoadToken || generation !== this._modelGeneration) return null;
                this._resetAnimationFacade();
                const profilePromise = this._call('model.profile', {}, generation, 10000).catch((error) => {
                    console.warn('[Unity VRM] 读取模型性能数据失败:', error);
                    return null;
                });
                const transformState = createTransformState(this);
                if (body && body.transform) {
                    const transform = body.transform;
                    if (transform.position) transformState.position.copy(transform.position);
                    if (transform.rotation) transformState.rotation.copy(transform.rotation);
                    if (transform.scale) transformState.scale.copy(transform.scale);
                }
                this._expressions = Array.isArray(body && body.expressions) && body.expressions.length
                    ? body.expressions.map(String)
                    : DEFAULT_EXPRESSIONS.slice();
                this.expression.names = this._expressions.slice();
                const expressionEntries = this._expressions.map((name) => ({ expressionName: name, weight: 0 }));
                const expressionEntriesByName = new Map(expressionEntries.map((entry) => [entry.expressionName, entry]));
                const vrm = {
                    expressionManager: {
                        expressions: expressionEntries,
                        setValue: (name, value) => {
                            const entry = expressionEntriesByName.get(String(name));
                            if (entry) entry.weight = clamp(value, 0, 1);
                            return this._queueExpressionWeight(name, value);
                        },
                        resetValues: () => {
                            expressionEntries.forEach((entry) => { entry.weight = 0; });
                            this._pendingExpressionWeights.clear();
                            return this._notify('expression.reset', {});
                        }
                    },
                    humanoid: this._createHumanoidProxy(),
                    meta: { name: preferenceFilename(modelUrl) },
                    update() {}
                };
                this.currentModel = { url: modelUrl, transform: transformState, vrm, generation };
                this.model = this.currentModel;
                this._loadState = 'settling';
                if (body && body.bounds) this._applyBounds(body.bounds);
                if (this.expression && typeof this.expression.setMood === 'function') {
                    this.expression.setMood('neutral');
                }
                if (global.__NEKO_VMC_ACTIVE__ === true) this.setVmcSamplingEnabled(true);
                let idlePlayback = Promise.resolve(false);
                if (opts.autoPlay !== false) {
                    const idleUrl = normalizeBundledAnimationUrl(
                        opts.idleAnimation ||
                        (global.lanlan_config && global.lanlan_config.vrmIdleAnimation) ||
                        '/static/vrm/animation/wait03.vrma.gz'
                    );
                    idlePlayback = this.playVRMAAnimation(idleUrl, {
                            loop: true,
                            immediate: true,
                            isIdle: true
                        }).catch((animationError) => {
                        console.warn('[Unity VRM] 待机动画加载失败，模型继续显示:', animationError);
                        return false;
                    });
                }
                const preferences = await preferencesPromise;
                if (loadToken !== this._activeLoadToken || generation !== this._modelGeneration) return null;
                if (preferences && preferences.position &&
                    ['x', 'y', 'z'].every((key) => Number.isFinite(preferences.position[key]))) {
                    transformState.position.copy(preferences.position);
                }
                if (preferences && preferences.rotation &&
                    ['x', 'y', 'z'].every((key) => Number.isFinite(preferences.rotation[key]))) {
                    transformState.rotation.copy(preferences.rotation);
                }
                if (preferences && preferences.scale &&
                    ['x', 'y', 'z'].every((key) => Number.isFinite(preferences.scale[key]) && preferences.scale[key] > 0)) {
                    let ratio = 1;
                    const savedHeight = finite(preferences.viewport && preferences.viewport.height, 0);
                    const currentHeight = finite(global.screen && global.screen.height, 0);
                    if (savedHeight > 0 && currentHeight > 0) {
                        const candidate = currentHeight / savedHeight;
                        if (candidate > 1.8 || candidate < 0.56) ratio = candidate;
                    }
                    transformState.scale.set(
                        preferences.scale.x * ratio,
                        preferences.scale.y * ratio,
                        preferences.scale.z * ratio
                    );
                }
                this._syncTransformNow();
                this._loadState = 'ready';
                this._isModelReadyForInteraction = true;
                const [profile] = await Promise.all([profilePromise, idlePlayback]);
                if (loadToken !== this._activeLoadToken || generation !== this._modelGeneration) return null;
                this._modelProfile = profile && typeof profile === 'object' ? profile : null;
                if (typeof this.setupFloatingButtons === 'function' && !global._cardExportPage) {
                    this.setupFloatingButtons();
                }
                global.dispatchEvent(new CustomEvent('vrm-model-loaded', {
                    detail: { modelInfo: this.currentModel, modelPath: modelUrl, renderer: 'unity' }
                }));
                return this.currentModel;
            } catch (error) {
                if (loadToken !== this._activeLoadToken || generation !== this._modelGeneration ||
                    error && error.code === 'superseded') {
                    return null;
                }
                if (loadToken === this._activeLoadToken) {
                    if (this.currentModel) {
                        if (error && error.code === 'bridge_send_failed' && Number.isInteger(previousGeneration)) {
                            this._modelGeneration = previousGeneration;
                        } else {
                            this.currentModel.generation = generation;
                        }
                    }
                    this._loadState = this.currentModel ? 'ready' : 'failed';
                    this._isModelReadyForInteraction = !!this.currentModel;
                }
                global.dispatchEvent(new CustomEvent('vrm-model-load-failed', {
                    detail: { modelPath: modelUrl, error: error.message, renderer: 'unity' }
                }));
                throw error;
            } finally {
                if (loadToken === this._activeLoadToken) this._isLoadingModel = false;
            }
        }

        async playVRMAAnimation(animationUrl, options) {
            if (!this.currentModel) return false;
            const opts = options || {};
            const requestToken = ++this._animationRequestToken;
            const actionId = String(requestToken);
            const requestIsCurrent = () => requestToken === this._animationRequestToken &&
                (typeof opts.shouldApply !== 'function' || opts.shouldApply()) &&
                (typeof opts.shouldStart !== 'function' || opts.shouldStart());
            if (!requestIsCurrent()) return false;
            let result;
            try {
                result = await this._call('animation.play', {
                    url: absoluteUrl(animationUrl),
                    loop: opts.loop === true,
                    immediate: opts.immediate === true,
                    isIdle: opts.isIdle === true,
                    movement: opts.movement === true,
                    actionId,
                    timeScale: Math.max(0.01, finite(opts.timeScale, 1)),
                    fadeDuration: Math.max(0, finite(opts.fadeDuration, 0.4))
                }, this._modelGeneration, 120000);
            } catch (error) {
                if (!requestIsCurrent() || error && error.code === 'superseded') return false;
                throw error;
            }
            if (!requestIsCurrent()) {
                if (requestToken === this._animationRequestToken) this._notify('animation.stop', {});
                return false;
            }
            let actionPaused = false;
            const action = {
                id: actionId,
                url: animationUrl,
                loop: opts.loop === true
            };
            Object.defineProperty(action, 'paused', {
                enumerable: true,
                configurable: false,
                get: () => actionPaused,
                set: (value) => {
                    actionPaused = value === true;
                    if (this.animation.currentAction !== action) return;
                    this.animation.isPaused = actionPaused;
                    this._notify('animation.setPaused', { actionId, paused: actionPaused });
                }
            });
            Object.defineProperty(action, '_setPausedFromRuntime', {
                enumerable: false,
                configurable: false,
                value: (value) => { actionPaused = value === true; }
            });
            this.vrmaAction = action;
            this.animation.currentAction = action;
            this.animation.vrmaIsPlaying = result.playing !== false;
            this.animation.isPlaying = result.playing !== false;
            this.animation.isPaused = false;
            this.animation.isIdleAnimation = opts.isIdle === true;
            if (typeof opts.onStarted === 'function') opts.onStarted(action);
            return result.playing !== false;
        }

        _resetAnimationFacade() {
            this.vrmaAction = null;
            this.animation.currentAction = null;
            this.animation.vrmaIsPlaying = false;
            this.animation.isPlaying = false;
            this.animation.isPaused = false;
            this.animation.isIdleAnimation = false;
        }

        stopVRMAAnimation(options) {
            const opts = options && typeof options === 'object' ? options : {};
            const expectedAction = opts.expectedAction || null;
            const currentAction = this.animation.currentAction;
            if (expectedAction && currentAction !== expectedAction) return false;
            if (!opts.preservePending || !expectedAction) this._animationRequestToken += 1;
            this._notify('animation.stop', {
                actionId: currentAction ? String(currentAction.id || '') : '',
                preservePending: opts.preservePending === true
            });
            this._resetAnimationFacade();
            return true;
        }

        seekVRMAAnimation(seconds, options) {
            const opts = options && typeof options === 'object' ? options : {};
            const action = this.animation.currentAction;
            if (!action) return false;
            const paused = typeof opts.paused === 'boolean' ? opts.paused : action.paused === true;
            const sent = this._notify('animation.seek', {
                seconds: Math.max(0, finite(seconds, 0)),
                paused
            });
            if (!sent) return false;
            if (typeof action._setPausedFromRuntime === 'function') {
                action._setPausedFromRuntime(paused);
            }
            this.animation.isPaused = paused;
            return true;
        }

        setEmotion(name, options) {
            const opts = options && typeof options === 'object' ? options : {};
            if (typeof opts.isCurrent === 'function' && !opts.isCurrent()) return false;
            if (this.expression && typeof this.expression.setEmotion === 'function') {
                this.expression.setEmotion(name);
            } else if (this.expression && typeof this.expression.setMood === 'function') {
                this.expression.setMood(name);
            } else if (this.expression && typeof this.expression.setBaseExpression === 'function') {
                this.expression.setBaseExpression(name);
            } else {
                return false;
            }
            return typeof opts.isCurrent !== 'function' || opts.isCurrent();
        }
        setMouseTrackingEnabled(value) {
            this._mouseTrackingEnabled = value !== false;
            this._notify('lookAt.enable', { enabled: this._mouseTrackingEnabled });
            return this._mouseTrackingEnabled;
        }
        isMouseTrackingEnabled() { return this._mouseTrackingEnabled; }
        setCursorFollowPerformance(settings) { this._notify('lookAt.quality', settings || {}); }

        applyLighting(lighting) {
            if (!lighting || typeof lighting !== 'object') return;
            for (const key of ['ambient', 'main', 'fill', 'rim', 'top', 'bottom']) {
                if (lighting[key] !== undefined) {
                    this._lighting[key] = finite(lighting[key], this._lighting[key]);
                }
            }
            for (const key of ['exposure', 'toneMapping', 'outlineWidthScale']) {
                if (lighting[key] !== undefined) {
                    this._lighting[key] = finite(lighting[key], this._lighting[key]);
                }
            }
            this._scheduleStateSync();
        }

        applyQualitySettings(settings) {
            const quality = String(
                typeof settings === 'string' ? settings : settings && settings.quality || 'medium'
            ).toLowerCase();
            const normalized = ['low', 'medium', 'high'].includes(quality) ? quality : 'medium';
            const requestedFrameRate = Number(
                settings && typeof settings === 'object' && settings.targetFrameRate !== undefined
                    ? settings.targetFrameRate
                    : global.targetFrameRate
            );
            const targetFrameRate = Number.isFinite(requestedFrameRate) && requestedFrameRate >= 0
                ? Math.round(clamp(requestedFrameRate, 0, 120))
                : 60;
            this._renderQuality = normalized;
            this._syncPixelRatioForDisplay();
            this._qualityOutlineEnabled = normalized === 'high';
            this._scheduleStateSync();
            this._notify('render.quality', {
                quality: normalized,
                targetFrameRate,
                antiAliasing: normalized === 'low' ? 0 : (normalized === 'high' ? 4 : 2),
                shadows: normalized === 'high'
            });
            return normalized;
        }

        _installRenderSettingsListeners() {
            if (typeof global.addEventListener !== 'function') return;
            const install = (event, handler) => {
                if (this._coreWindowHandlers.some((entry) => entry.event === event)) return;
                global.addEventListener(event, handler);
                this._coreWindowHandlers.push({ event, handler, target: global });
            };
            install('neko-render-quality-changed', (event) => {
                this.applyQualitySettings({
                    quality: event && event.detail && event.detail.quality || global.renderQuality,
                    targetFrameRate: global.targetFrameRate
                });
            });
            install('neko-frame-rate-changed', (event) => {
                this.applyQualitySettings({
                    quality: global.renderQuality || 'medium',
                    targetFrameRate: event && event.detail && event.detail.fps
                });
            });
            install('electron-display-changed', () => {
                this._syncPixelRatioForDisplay();
                this.onWindowResize();
            });
        }

        _syncPixelRatioForDisplay() {
            const quality = this._renderQuality || String(global.renderQuality || 'medium').toLowerCase();
            const ratio = quality === 'low'
                ? 0.8
                : quality === 'high'
                    ? Math.max(1, finite(global.devicePixelRatio, 1))
                    : 1;
            this._pixelRatio = clamp(ratio, 0.5, 8);
            if (this.canvas) {
                this._resizeCanvasBackingStore(this.canvas.clientWidth, this.canvas.clientHeight);
            }
            return this._pixelRatio;
        }

        _removeCoreWindowHandlers() {
            this._coreWindowHandlers.forEach(({ event, handler, target }) => {
                const eventTarget = target || global;
                if (eventTarget && typeof eventTarget.removeEventListener === 'function') {
                    eventTarget.removeEventListener(event, handler);
                }
            });
            this._coreWindowHandlers = [];
        }

        setOutlineWidthScale(value) {
            this._lighting.outlineWidthScale = Math.max(0, finite(value, 1));
            this._scheduleStateSync();
        }

        applyScreenDelta(screenDx, screenDy, options = {}) {
            return this._notify('model.dragPixels', {
                dx: finite(screenDx, 0),
                dy: finite(screenDy, 0),
                width: Math.max(1, this.canvas && this.canvas.clientWidth || global.innerWidth),
                height: Math.max(1, this.canvas && this.canvas.clientHeight || global.innerHeight),
                clamp: options.clamp !== false
            });
        }

        _toCanvasPoint(clientX, clientY) {
            const rect = this.canvas && typeof this.canvas.getBoundingClientRect === 'function'
                ? this.canvas.getBoundingClientRect()
                : { left: 0, top: 0 };
            return {
                x: finite(clientX, 0) - finite(rect.left, 0),
                y: finite(clientY, 0) - finite(rect.top, 0)
            };
        }

        _handlePointerLookAt(event) {
            if (!this._mouseTrackingEnabled) return false;
            const clientX = finite(event && event.clientX, NaN);
            const clientY = finite(event && event.clientY, NaN);
            if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;
            if (this._localTrackingEnabled) {
                const bounds = this.getModelScreenBounds();
                if (bounds) {
                    const margin = 50;
                    const inside = clientX >= bounds.left - margin && clientX <= bounds.right + margin &&
                        clientY >= bounds.top - margin && clientY <= bounds.bottom + margin;
                    if (!inside) return false;
                }
            }
            return this._notify('lookAt.pointer', this._toCanvasPoint(clientX, clientY));
        }

        startAnimateLoop() {
            if (this._isDisposed || !this._isInitialized) return false;
            if (this._animationFrameId) global.cancelAnimationFrame(this._animationFrameId);
            this._lastExpressionFrameTime = 0;
            const tick = (frameTime) => {
                if (this._isDisposed || !this._isInitialized) {
                    this._animationFrameId = null;
                    return;
                }
                const now = finite(frameTime, Date.now());
                const delta = this._lastExpressionFrameTime > 0
                    ? clamp((now - this._lastExpressionFrameTime) / 1000, 0, 0.05)
                    : 1 / 60;
                this._lastExpressionFrameTime = now;
                if (this.currentModel && this.expression && typeof this.expression.update === 'function') {
                    try {
                        this.expression.update(delta);
                        this._expressionLoopErrorShown = false;
                    } catch (error) {
                        if (!this._expressionLoopErrorShown) {
                            this._expressionLoopErrorShown = true;
                            console.warn('[Unity VRM] 表情更新失败:', error);
                        }
                    }
                }
                if (this.currentModel) {
                    try { global.nekoVisitParentBridge?.onExternalRender?.(); } catch (_) { /* optional capture */ }
                }
                this._animationFrameId = global.requestAnimationFrame(tick);
            };
            this._animationFrameId = global.requestAnimationFrame(tick);
            return true;
        }

        pauseRendering() {
            if (this._animationFrameId) global.cancelAnimationFrame(this._animationFrameId);
            this._animationFrameId = null;
            this._lastExpressionFrameTime = 0;
            this._notify('render.pause', {});
        }
        resumeRendering() {
            this.startAnimateLoop();
            this._notify('render.resume', {});
        }
        startAnimation() { return this.resumeRendering(); }
        isInitialized() { return this._isInitialized && !this._isDisposed; }
        isRendering() { return Boolean(this._animationFrameId); }
        getSurfaceCanvas() { return this.canvas; }
        setLocked(value) { return this.interaction.setLocked(value); }
        onWindowResize() {
            if (!this.canvas) return;
            const width = Math.max(1, this.canvas.clientWidth);
            const height = Math.max(1, this.canvas.clientHeight);
            this._resizeCanvasBackingStore(width, height);
            this._notify('surface.resize', {
                width,
                height,
                devicePixelRatio: this._pixelRatio
            });
        }

        resizeSurface(width, height, updateStyle = true) {
            if (!this.canvas) return false;
            const w = Math.max(1, Math.round(finite(width, this.canvas.clientWidth || 1)));
            const h = Math.max(1, Math.round(finite(height, this.canvas.clientHeight || 1)));
            if (updateStyle !== false) {
                this.canvas.style.width = `${w}px`;
                this.canvas.style.height = `${h}px`;
            }
            this._resizeCanvasBackingStore(w, h);
            this._notify('surface.resize', { width: w, height: h, devicePixelRatio: this._pixelRatio });
            return true;
        }

        setSurfacePixelRatio(value) {
            this._pixelRatio = clamp(value, 0.5, 8);
            this.onWindowResize();
            return this._pixelRatio;
        }

        getSurfacePixelRatio() {
            return this._pixelRatio;
        }

        setSurfaceVisible(visible) {
            if (!this.canvas || !this.container) return false;
            const display = visible === false ? 'none' : 'block';
            this.canvas.style.display = display;
            this.container.style.display = display;
            if (visible !== false) this.canvas.style.visibility = 'visible';
            this._notify('model.visibility', { visible: visible !== false });
            return true;
        }

        clearSurface() {
            return this._notify('surface.clear', {});
        }

        _resizeCanvasBackingStore(width, height) {
            if (!this.canvas) return false;
            const logicalWidth = Math.max(1, Math.round(finite(width, this.canvas.clientWidth || 1)));
            const logicalHeight = Math.max(1, Math.round(finite(height, this.canvas.clientHeight || 1)));
            const ratio = clamp(this._pixelRatio, 0.5, 8);
            const backingWidth = Math.max(1, Math.round(logicalWidth * ratio));
            const backingHeight = Math.max(1, Math.round(logicalHeight * ratio));
            if (this.canvas.width !== backingWidth) this.canvas.width = backingWidth;
            if (this.canvas.height !== backingHeight) this.canvas.height = backingHeight;
            return true;
        }

        resetAllButtons() {
            if (typeof this.resetAllButtonStates === 'function') this.resetAllButtonStates();
        }

        getCurrentModel() { return this.currentModel; }
        setModelPosition(x, y, z) {
            const transform = this.currentModel && this.currentModel.transform;
            if (!transform) return;
            this.interaction?._cancelGuidedMovement({ resume: true });
            transform.position.set(x, y, z);
        }
        setModelScale(x, y, z) {
            const transform = this.currentModel && this.currentModel.transform;
            if (transform) transform.scale.set(x, y, z);
        }
        setModelScaleScalar(value) {
            const scale = Math.max(0.01, finite(value, 1));
            this.setModelScale(scale, scale, scale);
        }
        resetModelPosition() {
            const transform = this.currentModel && this.currentModel.transform;
            if (!transform) return;
            this.interaction?._cancelGuidedMovement({ resume: true });
            transform.position.set(0, 0, 0);
            transform.rotation.set(0, 0, 0);
            transform.scale.set(1, 1, 1);
        }

        async detectOrientation() {
            if (!this.currentModel) throw new Error('Unity VRM model is not loaded');
            return this._call('model.orientation', {}, this._modelGeneration, 10000);
        }

        async setModelRotation(rotation) {
            const model = this.currentModel;
            const transform = model && model.transform;
            if (!transform || !rotation || !['x', 'y', 'z'].every((key) => Number.isFinite(rotation[key]))) {
                return false;
            }
            const next = { x: rotation.x, y: rotation.y, z: rotation.z };
            await this._call('model.transform', {
                position: { x: transform.position.x, y: transform.position.y, z: transform.position.z },
                rotation: next,
                scale: { x: transform.scale.x, y: transform.scale.y, z: transform.scale.z }
            }, model.generation, 10000);
            if (this.currentModel !== model) return false;
            transform.rotation.copy(next);
            return true;
        }

        savePreferences(options) {
            return this._snapshotAndSavePreferences(options || {});
        }

        fitModel(viewport, fit, view) {
            if (!this.currentModel) return false;
            const width = Math.max(1, finite(viewport && viewport.width, this.canvas && this.canvas.clientWidth || 1));
            const height = Math.max(1, finite(viewport && viewport.height, this.canvas && this.canvas.clientHeight || 1));
            const options = fit && typeof fit === 'object' ? fit : {};
            const viewOptions = view && typeof view === 'object' ? view : {};
            return this._notify('model.fit', {
                width,
                height,
                mode: String(options.mode || 'contain'),
                align: String(options.align || 'center'),
                padding: Math.max(0, finite(options.padding, 0)),
                scaleMultiplier: Math.max(0.0001, finite(options.scaleMultiplier, 1)),
                autoScale: options.autoScale !== false,
                minWidth: Math.max(0, finite(options.minWidth, 0)),
                minHeight: Math.max(0, finite(options.minHeight, 0)),
                viewScale: Math.max(0.0001, finite(viewOptions.scale, 100)),
                viewX: finite(viewOptions.x, 0),
                viewY: finite(viewOptions.y, 0)
            });
        }

        async waitForRenderedFrame() {
            if (!this.currentModel) return false;
            const result = await this._call('surface.sync', {}, this._modelGeneration, 10000);
            if (result && result.bounds) this._applyBounds(result.bounds);
            return true;
        }

        setPose(pose) {
            if (!this.currentModel || !pose || typeof pose !== 'object') return false;
            const poseId = String(pose.poseId || '').trim();
            if (!poseId) return false;
            const bones = Array.isArray(pose.bones) ? pose.bones.map((bone) => ({
                name: String(bone && bone.name || ''),
                eulerRadians: vector3(bone && bone.eulerRadians),
                weight: clamp(bone && bone.weight === undefined ? 1 : bone.weight, 0, 1)
            })) : [];
            return this._notify('pose.set', {
                poseId,
                reset: pose.reset === true,
                rootOffset: vector3(pose.rootOffset),
                bones
            });
        }

        resetPose(poseId) {
            const id = String(poseId || '').trim();
            if (!this.currentModel || !id) return false;
            return this._notify('pose.reset', { poseId: id });
        }

        attachAccessory(config) {
            if (!this.currentModel) return Promise.reject(new Error('Unity VRM model is not loaded'));
            const options = config && typeof config === 'object' ? config : {};
            const anchors = Array.isArray(options.anchors) ? options.anchors.map((anchor) => ({
                name: String(anchor && anchor.name || ''),
                localPosition: vector3(anchor && anchor.localPosition)
            })) : [];
            return this._call('accessory.attach', {
                id: String(options.id || '').trim(),
                preset: String(options.preset || '').trim(),
                bone: String(options.bone || '').trim(),
                position: vector3(options.position),
                eulerRadians: vector3(options.eulerRadians),
                scale: vector3(options.scale, { x: 1, y: 1, z: 1 }, true),
                anchors
            });
        }

        setAccessoryVisible(id, visible) {
            if (!this.currentModel) return Promise.reject(new Error('Unity VRM model is not loaded'));
            return this._call('accessory.setVisible', {
                id: String(id || '').trim(),
                visible: visible !== false
            });
        }

        detachAccessory(id) {
            if (!this.currentModel) return Promise.reject(new Error('Unity VRM model is not loaded'));
            return this._call('accessory.detach', { id: String(id || '').trim() });
        }

        trackScreenAnchors(tracks) {
            if (!this.currentModel) return Promise.reject(new Error('Unity VRM model is not loaded'));
            const normalized = Array.isArray(tracks) ? tracks.map((track) => ({
                name: String(track && track.name || '').trim(),
                bone: String(track && track.bone || '').trim(),
                accessoryId: String(track && track.accessoryId || '').trim(),
                anchor: String(track && track.anchor || '').trim(),
                localPosition: vector3(track && track.localPosition)
            })) : [];
            this._screenAnchors.clear();
            this._anchorSurface = null;
            return this._call('anchor.track', { tracks: normalized });
        }

        getScreenAnchor(name) {
            const anchor = this._screenAnchors.get(String(name || ''));
            if (!anchor) return null;
            const rect = this.canvas && typeof this.canvas.getBoundingClientRect === 'function'
                ? this.canvas.getBoundingClientRect()
                : { left: 0, top: 0, width: this.canvas && this.canvas.clientWidth, height: this.canvas && this.canvas.clientHeight };
            const surface = this._anchorSurface || {};
            const logicalWidth = Math.max(1, finite(surface.width, this.canvas && this.canvas.clientWidth || 1));
            const logicalHeight = Math.max(1, finite(surface.height, this.canvas && this.canvas.clientHeight || 1));
            const clientWidth = Math.max(1, finite(rect.width, this.canvas && this.canvas.clientWidth || logicalWidth));
            const clientHeight = Math.max(1, finite(rect.height, this.canvas && this.canvas.clientHeight || logicalHeight));
            return {
                name: anchor.name,
                x: finite(rect.left, 0) + anchor.x * clientWidth / logicalWidth,
                y: finite(rect.top, 0) + anchor.y * clientHeight / logicalHeight,
                visible: anchor.visible === true,
                behindCamera: anchor.behindCamera === true
            };
        }

        async unloadModel() {
            if (this._disposeRequested) return false;
            const unloadToken = ++this._activeLoadToken;
            this._isModelReadyForInteraction = false;
            const interactionSettle = this._settleInteractionBeforeModelChange();
            if (interactionSettle) await interactionSettle;
            if (unloadToken !== this._activeLoadToken) return false;
            this._modelGeneration = allocateGeneration();
            const model = this.currentModel;
            if (model && model.vrm && global.vrmVmcSender &&
                typeof global.vrmVmcSender.releaseVrm === 'function') {
                try { global.vrmVmcSender.releaseVrm(model.vrm); } catch (_) {}
            }
            this.setVmcSamplingEnabled(false);
            this._animationRequestToken += 1;
            this._resetAnimationFacade();
            this.animation.stopLipSync();
            this.currentModel = null;
            this.model = null;
            this._isLoadingModel = false;
            this._isModelReadyForInteraction = false;
            this._loadState = 'idle';
            this.interaction._cachedScreenBounds = null;
            this._unityLocalBounds = null;
            this._headBounds = null;
            this._modelProfile = null;
            this._screenAnchors.clear();
            this._anchorSurface = null;
            if (!this._runtimeHost.instance) return true;
            try {
                await this._call('model.unload', {}, this._modelGeneration, 10000);
                return true;
            } catch (error) {
                console.warn('[Unity VRM] 卸载模型失败:', error);
                return false;
            }
        }

        getModelScreenBounds() {
            const cached = this._refreshClientBoundsFromLocal();
            if (!cached) return null;
            const left = cached.minX;
            const top = cached.minY;
            const right = cached.maxX;
            const bottom = cached.maxY;
            const width = Math.max(0, right - left);
            const height = Math.max(0, bottom - top);
            return {
                left, top, right, bottom, width, height,
                centerX: left + width / 2,
                centerY: top + height / 2
            };
        }

        getModelProfile() {
            return this.currentModel ? this._modelProfile : null;
        }

        getHeadScreenAnchor() {
            const canvasRect = this.canvas && typeof this.canvas.getBoundingClientRect === 'function'
                ? this.canvas.getBoundingClientRect()
                : { left: 0, top: 0 };
            if (this._headBounds && Number.isFinite(this._headBounds.x) && Number.isFinite(this._headBounds.y)) {
                return {
                    x: finite(canvasRect.left, 0) + this._headBounds.x,
                    y: finite(canvasRect.top, 0) + this._headBounds.y
                };
            }
            const bounds = this.getModelScreenBounds();
            if (!bounds) return null;
            return { x: bounds.centerX, y: bounds.top + bounds.height * 0.16 };
        }

        getHeadDetectionGeometryInfo() {
            const bounds = this.getModelScreenBounds();
            if (!bounds) return null;
            const canvasRect = this.canvas && typeof this.canvas.getBoundingClientRect === 'function'
                ? this.canvas.getBoundingClientRect()
                : { left: 0, top: 0 };
            if (this._headBounds && ['minX', 'minY', 'maxX', 'maxY'].every((key) => Number.isFinite(this._headBounds[key]))) {
                const left = finite(canvasRect.left, 0) + this._headBounds.minX;
                const top = finite(canvasRect.top, 0) + this._headBounds.minY;
                const right = finite(canvasRect.left, 0) + this._headBounds.maxX;
                const bottom = finite(canvasRect.top, 0) + this._headBounds.maxY;
                const headRect = {
                    left, top, right, bottom,
                    width: Math.max(0, right - left),
                    height: Math.max(0, bottom - top),
                    centerX: (left + right) / 2,
                    centerY: (top + bottom) / 2
                };
                const headAnchor = this.getHeadScreenAnchor();
                return { type: 'vrm', bounds, headRect, headAnchor, rawHeadAnchor: headAnchor };
            }
            const headWidth = bounds.width * 0.42;
            const headHeight = bounds.height * 0.24;
            const left = bounds.centerX - headWidth / 2;
            const top = bounds.top;
            const headRect = {
                left,
                top,
                right: left + headWidth,
                bottom: top + headHeight,
                width: headWidth,
                height: headHeight,
                centerX: bounds.centerX,
                centerY: top + headHeight / 2
            };
            const headAnchor = { x: bounds.centerX, y: top + headHeight * 0.62 };
            return { type: 'vrm', bounds, headRect, headAnchor, rawHeadAnchor: headAnchor };
        }

        cleanupUI() {
            if (typeof this.cleanupFloatingButtons === 'function') this.cleanupFloatingButtons();
        }

        async dispose() {
            if (this._disposeRequested) return false;
            this._disposeRequested = true;
            this._isDisposed = true;
            this._activeLoadToken += 1;
            this._isModelReadyForInteraction = false;
            try {
                const interactionSettle = this._settleInteractionBeforeModelChange();
                if (interactionSettle) await interactionSettle;
                // dispose is terminal for this in-flight lifecycle; a late load cannot cancel cleanup.
                this._modelGeneration = allocateGeneration();
                this._animationRequestToken += 1;
                this._resetAnimationFacade();
                this.animation.stopLipSync();
                const vmcVrm = this.currentModel && this.currentModel.vrm;
                if (vmcVrm && global.vrmVmcSender && typeof global.vrmVmcSender.releaseVrm === 'function') {
                    try { global.vrmVmcSender.releaseVrm(vmcVrm); } catch (_) {}
                }
                this.setVmcSamplingEnabled(false);
                this.interaction.cleanupDragAndZoom();
                this.cleanupUI();
                this._removeCoreWindowHandlers();
                if (this._resizeObserver) this._resizeObserver.disconnect();
                this._resizeObserver = null;
                if (this._animationFrameId) global.cancelAnimationFrame(this._animationFrameId);
                this._animationFrameId = null;
                this._lastExpressionFrameTime = 0;
                if (this._expressionSyncFrame) global.cancelAnimationFrame(this._expressionSyncFrame);
                this._expressionSyncFrame = 0;
                this._pendingExpressionWeights.clear();
                this.currentModel = null;
                this.model = null;
                this._isLoadingModel = false;
                this._unityLocalBounds = null;
                this._headBounds = null;
                this._modelProfile = null;
                this._screenAnchors.clear();
                this._anchorSurface = null;
                this._isModelReadyForInteraction = false;
                this._loadState = 'idle';
                this._notify('model.unload', {});
                const runtimeHost = this._runtimeHost;
                this._runtimeHost = null;
                if (runtimeHost) await runtimeHost.shutdown();
                this.canvas = null;
                this.container = null;
                this._isInitialized = false;
                return true;
            } finally {
                this._disposeRequested = false;
            }
        }

        _createHumanoidProxy() {
            const nodes = new Map();
            const humanBones = {};
            const getNode = (name) => {
                const rawName = String(name || '');
                const normalized = rawName ? rawName.charAt(0).toLowerCase() + rawName.slice(1) : '';
                return nodes.get(rawName) || nodes.get(normalized) || null;
            };
            return {
                rawRestPose: {},
                humanBones,
                getRawBoneNode: getNode,
                getNormalizedBoneNode: getNode,
                _nodes: nodes
            };
        }

        _syncTransformNow() {
            const transform = this.currentModel && this.currentModel.transform;
            if (!transform) return false;
            return this._notify('model.transform', {
                position: { x: transform.position.x, y: transform.position.y, z: transform.position.z },
                rotation: { x: transform.rotation.x, y: transform.rotation.y, z: transform.rotation.z },
                scale: { x: transform.scale.x, y: transform.scale.y, z: transform.scale.z }
            });
        }

        _applyTransformSnapshot(transform) {
            const modelTransform = this.currentModel && this.currentModel.transform;
            if (!modelTransform || !transform) return;
            const assign = (target, source) => {
                if (!source || !['x', 'y', 'z'].every((key) => Number.isFinite(source[key]))) return;
                target.x = source.x;
                target.y = source.y;
                target.z = source.z;
            };
            assign(modelTransform.position, transform.position);
            assign(modelTransform.rotation, transform.rotation);
            assign(modelTransform.scale, transform.scale);
        }

        async _snapshotAndSavePreferences(options = {}) {
            const model = this.currentModel;
            if (!model || !model.transform || global.isViewerMode) return false;
            const isCurrent = typeof options.isCurrent === 'function' ? options.isCurrent : () => true;
            if (!isCurrent()) return false;
            try {
                const body = await this._call('model.snapshot', {}, model.generation, 5000);
                if (this.currentModel !== model || !isCurrent()) return false;
                if (body && body.transform) this._applyTransformSnapshot(body.transform);
                if (body && body.bounds) this._applyBounds(body.bounds);
            } catch (error) {
                console.warn('[Unity VRM] 读取交互后模型状态失败:', error);
                return false;
            }
            const transform = model.transform;
            let display = null;
            if (global.electronScreen && typeof global.electronScreen.getCurrentDisplay === 'function') {
                try {
                    const displayRequest = Promise.resolve(global.electronScreen.getCurrentDisplay()).then((value) => {
                    if (!value) return null;
                    const screenX = Number.isFinite(value.screenX) ? value.screenX : value.bounds && value.bounds.x;
                    const screenY = Number.isFinite(value.screenY) ? value.screenY : value.bounds && value.bounds.y;
                    return Number.isFinite(screenX) && Number.isFinite(screenY) ? { screenX, screenY } : null;
                    });
                    display = resolveWithTimeout(displayRequest, 1000, null);
                } catch (_) {
                    display = null;
                }
            }
            const viewport = global.screen && Number.isFinite(global.screen.width) && Number.isFinite(global.screen.height)
                ? { width: global.screen.width, height: global.screen.height }
                : null;
            if (!isCurrent()) return false;
            const persistence = this._preferenceStore.saveUserPreferences(
                model.url,
                { x: transform.position.x, y: transform.position.y, z: transform.position.z },
                { x: transform.scale.x, y: transform.scale.y, z: transform.scale.z },
                { x: transform.rotation.x, y: transform.rotation.y, z: transform.rotation.z },
                display,
                viewport
            );
            if (options.awaitPersistence === true) {
                try { return (await persistence) === true; }
                catch (error) {
                    console.warn('[Unity VRM] 保存模型偏好失败:', error);
                    return false;
                }
            }
            void Promise.resolve(persistence).then((saved) => {
                if (!saved) console.warn('[Unity VRM] 自动保存位置失败');
            }).catch((error) => {
                console.warn('[Unity VRM] 自动保存位置失败:', error);
            });
            return true;
        }

        _applyVmcSnapshot(body) {
            const vrm = this.currentModel && this.currentModel.vrm;
            if (!vrm || !body) return;
            const humanoid = vrm.humanoid;
            const restPose = Array.isArray(body.restPose) ? body.restPose : [];
            restPose.forEach((bone) => {
                if (!bone || typeof bone.name !== 'string' || !bone.name) return;
                const name = bone.name.charAt(0).toLowerCase() + bone.name.slice(1);
                const position = bone.localPosition || bone.position || {};
                const rotation = bone.localRotation || bone.rotation || {};
                humanoid.rawRestPose[name] = {
                    position: {
                        x: finite(position.x !== undefined ? position.x : position.px, 0),
                        y: finite(position.y !== undefined ? position.y : position.py, 0),
                        z: finite(position.z !== undefined ? position.z : position.pz, 0)
                    },
                    rotation: {
                        x: finite(rotation.x !== undefined ? rotation.x : rotation.qx, 0),
                        y: finite(rotation.y !== undefined ? rotation.y : rotation.qy, 0),
                        z: finite(rotation.z !== undefined ? rotation.z : rotation.qz, 0),
                        w: finite(rotation.w !== undefined ? rotation.w : rotation.qw, 1)
                    }
                };
            });
            const bones = Array.isArray(body.bones) ? body.bones : [];
            bones.forEach((bone) => {
                if (!bone || typeof bone.name !== 'string' || !bone.name) return;
                const name = bone.name.charAt(0).toLowerCase() + bone.name.slice(1);
                let node = humanoid._nodes.get(name);
                if (!node) {
                    node = {
                        position: { x: 0, y: 0, z: 0 },
                        quaternion: { x: 0, y: 0, z: 0, w: 1 }
                    };
                    humanoid._nodes.set(name, node);
                    humanoid.humanBones[name] = { node };
                }
                const position = bone.localPosition || bone.position || bone;
                const rotation = bone.localRotation || bone.rotation || bone;
                node.position.x = finite(position.x !== undefined ? position.x : position.px, node.position.x);
                node.position.y = finite(position.y !== undefined ? position.y : position.py, node.position.y);
                node.position.z = finite(position.z !== undefined ? position.z : position.pz, node.position.z);
                node.quaternion.x = finite(rotation.x !== undefined ? rotation.x : rotation.qx, node.quaternion.x);
                node.quaternion.y = finite(rotation.y !== undefined ? rotation.y : rotation.qy, node.quaternion.y);
                node.quaternion.z = finite(rotation.z !== undefined ? rotation.z : rotation.qz, node.quaternion.z);
                node.quaternion.w = finite(rotation.w !== undefined ? rotation.w : rotation.qw, node.quaternion.w);
            });
            const expressions = Array.isArray(body.expressions) ? body.expressions : [];
            const byName = new Map(vrm.expressionManager.expressions.map((entry) => [entry.expressionName, entry]));
            expressions.forEach((expression) => {
                if (!expression || typeof expression.name !== 'string') return;
                let entry = byName.get(expression.name);
                if (!entry) {
                    entry = { expressionName: expression.name, weight: 0 };
                    vrm.expressionManager.expressions.push(entry);
                    byName.set(expression.name, entry);
                }
                entry.weight = clamp(expression.value !== undefined ? expression.value : expression.weight, 0, 1);
            });
        }

        setVmcSamplingEnabled(enabled) {
            this._vmcSamplingToken += 1;
            const token = this._vmcSamplingToken;
            if (this._vmcTimer) global.clearTimeout(this._vmcTimer);
            this._vmcTimer = 0;
            if (!enabled || !this.currentModel) return false;
            const pump = async () => {
                if (token !== this._vmcSamplingToken || global.__NEKO_VMC_ACTIVE__ !== true || !this.currentModel) return;
                try {
                    const model = this.currentModel;
                    const body = await this._call('vmc.snapshot', {}, model.generation, 3000);
                    if (token !== this._vmcSamplingToken || this.currentModel !== model) return;
                    this._applyVmcSnapshot(body);
                    if (global.vrmVmcSender && typeof global.vrmVmcSender.sample === 'function') {
                        global.vrmVmcSender.sample(model.vrm);
                    }
                    this._vmcWarningShown = false;
                } catch (error) {
                    if (!this._vmcWarningShown) {
                        this._vmcWarningShown = true;
                        console.warn('[Unity VRM] VMC 姿态采样失败:', error);
                    }
                }
                if (token !== this._vmcSamplingToken || global.__NEKO_VMC_ACTIVE__ !== true) return;
                const senderRate = global.vrmVmcSender && typeof global.vrmVmcSender.getSendRateHz === 'function'
                    ? finite(global.vrmVmcSender.getSendRateHz(), 30)
                    : 30;
                this._vmcTimer = global.setTimeout(pump, Math.max(16, Math.round(1000 / clamp(senderRate, 1, 60))));
            };
            void pump();
            return true;
        }

        _installResizeObserver() {
            if (this._resizeObserver || typeof ResizeObserver === 'undefined' || !this.container) return;
            this._resizeObserver = new ResizeObserver(() => this.onWindowResize());
            this._resizeObserver.observe(this.container);
        }

        _scheduleStateSync() {
            if (this._stateSyncFrame) return;
            this._stateSyncFrame = global.requestAnimationFrame(() => {
                this._stateSyncFrame = 0;
                this._notify('render.settings', {
                    lighting: {
                        ...this._lighting,
                        outlineWidthScale: this._qualityOutlineEnabled
                            ? this._lighting.outlineWidthScale
                            : 0
                    }
                });
            });
        }

        _scheduleTransformSync() {
            if (this._transformSyncFrame || !this.currentModel) return;
            this._transformSyncFrame = global.requestAnimationFrame(() => {
                this._transformSyncFrame = 0;
                this._syncTransformNow();
            });
        }

        _setExpression(name, value, resetOthers) {
            const expressionName = String(name || 'neutral');
            this._notify('expression.set', {
                name: expressionName,
                value: clamp(value === undefined ? 1 : value, 0, 1),
                resetOthers: resetOthers === true
            });
            return true;
        }

        _queueExpressionWeight(name, value) {
            const expressionName = String(name || '');
            if (!expressionName) return false;
            this._pendingExpressionWeights.set(expressionName, clamp(value, 0, 1));
            if (!this._expressionSyncFrame) {
                this._expressionSyncFrame = global.requestAnimationFrame(() => {
                    this._expressionSyncFrame = 0;
                    if (!this._pendingExpressionWeights.size) return;
                    const weights = Array.from(this._pendingExpressionWeights, ([entryName, entryValue]) => ({
                        name: entryName,
                        value: entryValue
                    }));
                    this._pendingExpressionWeights.clear();
                    this._notify('expression.setWeights', { weights });
                });
            }
            return true;
        }

        _call(command, body, generation, timeout) {
            if (!this._runtimeHost) return Promise.reject(new Error('Unity renderer is not initialized'));
            return this._runtimeHost.call(
                command,
                body,
                generation === undefined ? this._modelGeneration : generation,
                timeout
            );
        }

        _notify(command, body) {
            return this._runtimeHost
                ? this._runtimeHost.notify(command, body, this._modelGeneration)
                : false;
        }

        _applyBounds(bounds) {
            if (!bounds || typeof bounds !== 'object') return;
            const minX = finite(bounds.minX, NaN);
            const minY = finite(bounds.minY, NaN);
            const maxX = finite(bounds.maxX, NaN);
            const maxY = finite(bounds.maxY, NaN);
            if (![minX, minY, maxX, maxY].every(Number.isFinite) || maxX <= minX || maxY <= minY) return;
            this._unityLocalBounds = { minX, minY, maxX, maxY };
            this._refreshClientBoundsFromLocal();
            this._vrmModelScreenHeight = maxY - minY;
            this._headBounds = bounds.head && typeof bounds.head === 'object' ? { ...bounds.head } : null;
            global.dispatchEvent(new CustomEvent('neko-avatar-bounds-changed', {
                detail: { modelType: 'vrm', bounds: this.getModelScreenBounds(), renderer: 'unity' }
            }));
        }

        _refreshClientBoundsFromLocal() {
            const local = this._unityLocalBounds;
            if (!local || !this.interaction) return null;
            const canvasRect = this.canvas && typeof this.canvas.getBoundingClientRect === 'function'
                ? this.canvas.getBoundingClientRect()
                : { left: 0, top: 0 };
            const bounds = {
                minX: finite(canvasRect.left, 0) + local.minX,
                minY: finite(canvasRect.top, 0) + local.minY,
                maxX: finite(canvasRect.left, 0) + local.maxX,
                maxY: finite(canvasRect.top, 0) + local.maxY
            };
            this.interaction._cachedScreenBounds = bounds;
            this._vrmModelCenterX = (bounds.minX + bounds.maxX) / 2;
            this._vrmModelCenterY = (bounds.minY + bounds.maxY) / 2;
            return bounds;
        }

        _handleUnityEvent(message) {
            if (Number.isInteger(message.generation) && message.generation !== this._modelGeneration) return;
            const body = message.body || {};
            if (message.name === 'model.bounds') {
                this._applyBounds(body.bounds || body);
            } else if (message.name === 'anchor.screen') {
                const anchors = Array.isArray(body.anchors) ? body.anchors : [];
                this._anchorSurface = {
                    width: Math.max(1, finite(body.width, this.canvas && this.canvas.clientWidth || 1)),
                    height: Math.max(1, finite(body.height, this.canvas && this.canvas.clientHeight || 1))
                };
                this._screenAnchors.clear();
                anchors.forEach((anchor) => {
                    if (!anchor || typeof anchor.name !== 'string' || !anchor.name) return;
                    const x = finite(anchor.x, NaN);
                    const y = finite(anchor.y, NaN);
                    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
                    this._screenAnchors.set(anchor.name, {
                        name: anchor.name,
                        x,
                        y,
                        visible: anchor.visible === true,
                        behindCamera: anchor.behindCamera === true
                    });
                });
            } else if (message.name === 'model.moveArrived') {
                const interaction = this.interaction;
                if (!interaction || !body.actionId || body.actionId !== interaction._movementActionId) return;
                if (body.transform) this._applyTransformSnapshot(body.transform);
                if (body.bounds) this._applyBounds(body.bounds);
                interaction.isMoving = false;
                const ownerToken = interaction._movementOwnerToken;
                const playbackAction = interaction._movementPlaybackAction;
                interaction._movementOwnerToken = null;
                interaction._movementPlaybackAction = null;
                void interaction._releaseMovementPlayback(ownerToken, playbackAction, true);
            } else if (message.name === 'animation.loop') {
                const action = this.animation.currentAction;
                if (body.actionId && (!action || body.actionId !== action.id)) return;
                this.animation.vrmaIsPlaying = true;
                this.animation.isPlaying = true;
                this.animation.vrmaMixer.emit('loop', { ...body, action });
            } else if (message.name === 'animation.finished') {
                const action = this.animation.currentAction;
                if (body.actionId && (!action || body.actionId !== action.id)) return;
                this.animation.vrmaIsPlaying = false;
                this.animation.isPlaying = false;
                this.vrmaAction = null;
                this.animation.currentAction = null;
                this.animation.vrmaMixer.emit('finished', { ...body, action });
            } else if (message.name === 'renderer.fatal') {
                global.dispatchEvent(new CustomEvent('unity-vrm-fatal', { detail: body }));
            }
        }
    }

    global.UnityVRMManager = UnityVRMManager;
    global.VRMManager = UnityVRMManager;
})(window);
