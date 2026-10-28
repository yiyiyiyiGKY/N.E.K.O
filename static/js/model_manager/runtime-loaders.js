(function loadCanonicalUnityVRMEntry() {
    if (window.vrmModuleLoaded || document.querySelector('script[src^="/static/vrm/vrm-init.js"]')) return;
    const source = document.currentScript && document.currentScript.src;
    const version = source
        ? (new URL(source, window.location.href).searchParams.get('v') || Date.now())
        : Date.now();
    const script = document.createElement('script');
    script.src = `/static/vrm/vrm-init.js?v=${encodeURIComponent(version)}`;
    script.dataset.nekoUnityVrmEntry = 'true';
    script.onerror = () => {
        const error = new Error('Failed to load the canonical Unity VRM entry');
        window.vrmModuleLoaded = false;
        window.dispatchEvent(new CustomEvent('vrm-modules-failed', { detail: { error } }));
    };
    (document.head || document.body || document.documentElement).appendChild(script);
})();
// ====================== MMD 模块动态加载 ======================
(async function initMMDModules() {
    const loadModules = async () => {
        console.log('[MMD] 开始加载依赖模块');
        window._mmdModulesLoading = true;

        // avatar-popup-common, avatar-ui-popup, avatar-ui-popup-config, avatar-ui-buttons
        // 已由 model_manager.html 静态 <script> 加载，此处不再重复加载
        const mmdModules = [
            '/static/mmd/mmd-init.js',
            // 同上：MMD 与 VRM 复用同一个分析器实现。
            '/static/vrm/vrm-lipsync-formant.js',
            '/static/mmd/mmd-core.js',
            '/static/mmd/mmd-animation.js',
            '/static/mmd/mmd-expression.js',
            '/static/avatar/avatar-touch-gestures.js',
            '/static/mmd/mmd-interaction.js',
            '/static/mmd/mmd-cursor-follow.js',
            '/static/mmd/mmd-manager.js',
            '/static/mmd/mmd-ui-buttons.js'
        ];

        const failedModules = [];
        for (const moduleSrc of mmdModules) {
            // vrm-lipsync-formant.js 同时挂在 VRM 与 MMD 两条并行链上；已在 DOM 里
            // 就跳过，省掉一次被 ?v=Date.now() 绕过缓存的重复请求。模块本身也做了
            // 幂等短路，这里只是不做无用功。
            if (document.querySelector(`script[src^="${moduleSrc}"]`)) continue;
            const script = document.createElement('script');
            const baseSrc = moduleSrc.split('?')[0];
            script.src = `${baseSrc}?v=${Date.now()}`;
            await new Promise((resolve) => {
                script.onload = resolve;
                script.onerror = () => {
                    console.error(`[MMD] 模块加载失败: ${moduleSrc}`);
                    failedModules.push(moduleSrc);
                    resolve();
                };
                document.body.appendChild(script);
            });
        }

        if (failedModules.length > 0) {
            window.mmdModuleLoaded = false;
            window._mmdModulesLoading = false;
            window._mmdModulesFailed = failedModules.slice();
            console.error('[MMD] 以下模块加载失败:', failedModules);
            window.dispatchEvent(new CustomEvent('mmd-modules-failed', {
                detail: { failedModules }
            }));
        } else {
            window.mmdModuleLoaded = true;
            window._mmdModulesLoading = false;
            window._mmdModulesFailed = null;
            window.dispatchEvent(new CustomEvent('mmd-modules-ready'));
        }
    };

    if (typeof window.THREE === 'undefined') {
        window.addEventListener('three-ready', loadModules, { once: true });
    } else {
        loadModules();
    }
})();
