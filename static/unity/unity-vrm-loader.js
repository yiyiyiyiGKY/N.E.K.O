/**
 * Canonical Unity VRM browser bootstrap.
 *
 * Every page that needs a VRM renderer goes through this loader.  It owns the
 * dependency order and exposes one idempotent promise instead of duplicating
 * module lists in the main page, model manager, previews and mini games.
 */
(function installUnityVRMLoader(global) {
    'use strict';

    if (global.NekoUnityVRMLoader) return;

    const scriptPromises = new Map();
    const SCRIPT_TIMEOUT_MS = 15000;
    let corePromise = null;
    let uiPromise = null;
    let vmcPromise = null;

    const CORE_PREREQUISITES = Object.freeze([
        {
            src: '/static/vrm/vrm-lipsync-formant.js',
            ready: () => typeof global.FormantLipSyncAnalyzer === 'function'
        },
        {
            src: '/static/avatar/avatar-touch-gestures.js',
            ready: () => Boolean(global.NekoModelTouchGestures)
        },
        {
            src: '/static/vrm/vrm-expression.js',
            ready: () => typeof global.VRMExpression === 'function'
        }
    ]);
    const UNITY_RENDERER = Object.freeze({
        src: '/static/unity/unity-avatar-manager.js',
        ready: () => typeof global.UnityVRMManager === 'function'
    });
    const UI_MODULES = Object.freeze([
        {
            src: '/static/vrm/vrm-ui-buttons.js',
            ready: () => Boolean(global.UnityVRMManager?.prototype?.setupFloatingButtons)
        }
    ]);
    const VMC_MODULE = Object.freeze({
        src: '/static/vrm/vrm-vmc-loader.js',
        ready: () => Boolean(global.vrmVmcSender)
    });

    function versionedUrl(src, version) {
        if (!version) return src;
        const url = new URL(src, global.location?.href || 'http://localhost/');
        url.searchParams.set('v', String(version));
        return `${url.pathname}${url.search}${url.hash}`;
    }

    function appendScript(script) {
        const attach = () => {
            const parent = document.head || document.body || document.documentElement;
            parent.appendChild(script);
        };
        if (!document.head && !document.body) {
            document.addEventListener('DOMContentLoaded', attach, { once: true });
        } else {
            attach();
        }
    }

    function loadScript(module, version) {
        if (module.ready()) return Promise.resolve();
        if (scriptPromises.has(module.src)) return scriptPromises.get(module.src);

        const promise = new Promise((resolve, reject) => {
            let script = document.querySelector(`script[src^="${module.src}"]`);
            let settled = false;
            let timer = null;
            const cleanup = () => {
                if (timer !== null) global.clearTimeout(timer);
                script?.removeEventListener('load', finish);
                script?.removeEventListener('error', fail);
            };
            const settle = (callback, value) => {
                if (settled) return;
                settled = true;
                cleanup();
                callback(value);
            };
            const finish = () => {
                if (!module.ready()) {
                    settle(reject, new Error(`Unity VRM module loaded without installing its API: ${module.src}`));
                    return;
                }
                settle(resolve);
            };
            const fail = () => settle(reject, new Error(`Failed to load Unity VRM module: ${module.src}`));

            timer = global.setTimeout(() => {
                if (module.ready()) {
                    settle(resolve);
                    return;
                }
                settle(reject, new Error(`Timed out loading Unity VRM module: ${module.src}`));
            }, SCRIPT_TIMEOUT_MS);

            if (script) {
                script.addEventListener('load', finish, { once: true });
                script.addEventListener('error', fail, { once: true });
                // A classic script that already finished will not emit another
                // load event.  Re-check after the current task before waiting.
                global.setTimeout(() => {
                    if (module.ready()) settle(resolve);
                }, 0);
                return;
            }

            script = document.createElement('script');
            script.src = versionedUrl(module.src, version);
            script.dataset.nekoUnityVrmModule = module.src;
            script.addEventListener('load', finish, { once: true });
            script.addEventListener('error', fail, { once: true });
            appendScript(script);
        }).catch((error) => {
            scriptPromises.delete(module.src);
            throw error;
        });

        scriptPromises.set(module.src, promise);
        return promise;
    }

    async function ensure(options) {
        const opts = options || {};
        const version = opts.version || '';

        if (!corePromise) {
            corePromise = (async () => {
                await Promise.all(CORE_PREREQUISITES.map((module) => loadScript(module, version)));
                await loadScript(UNITY_RENDERER, version);
                return global.UnityVRMManager;
            })().catch((error) => {
                corePromise = null;
                throw error;
            });
        }
        const Manager = await corePromise;

        if (opts.vmc !== false && !vmcPromise) {
            vmcPromise = loadScript(VMC_MODULE, version).catch((error) => {
                vmcPromise = null;
                throw error;
            });
        }
        if (opts.vmc !== false) await vmcPromise;

        if (opts.ui === true) {
            if (!uiPromise) {
                uiPromise = (async () => {
                    for (const module of UI_MODULES) await loadScript(module, version);
                })().catch((error) => {
                    uiPromise = null;
                    throw error;
                });
            }
            await uiPromise;
        }

        return Manager;
    }

    global.NekoUnityVRMLoader = Object.freeze({ ensure });
})(window);
