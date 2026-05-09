(function () {
    'use strict';

    var body = document.body;
    var canvas = document.getElementById('subconscious-maintenance-canvas');
    var setupLayer = document.getElementById('subconscious-maintenance-setup');
    var pauseLayer = document.getElementById('subconscious-maintenance-pause-layer');
    var endLayer = document.getElementById('subconscious-maintenance-end-layer');
    var startBtn = document.getElementById('subconscious-maintenance-start-btn');
    var continueBtn = document.getElementById('subconscious-maintenance-continue-btn');
    var restartBtn = document.getElementById('subconscious-maintenance-restart-btn');
    var exitBtn = document.getElementById('subconscious-maintenance-exit-btn');
    var endRestartBtn = document.getElementById('subconscious-maintenance-end-restart-btn');
    var endExitBtn = document.getElementById('subconscious-maintenance-end-exit-btn');
    var resultTitle = document.getElementById('subconscious-maintenance-result-title');
    var resultDetail = document.getElementById('subconscious-maintenance-result-detail');
    var sessionLabel = document.getElementById('subconscious-maintenance-session-label');
    var difficultyButtons = Array.prototype.slice.call(document.querySelectorAll('.sm-difficulty-btn'));
    var stabilityValue = document.getElementById('subconscious-maintenance-stability');
    var fragmentsValue = document.getElementById('subconscious-maintenance-fragments');
    var wormsValue = document.getElementById('subconscious-maintenance-worms');
    var comboValue = document.getElementById('subconscious-maintenance-combo');
    var resizeRaf = 0;
    var state = {
        phase: 'setup',
        difficulty: 'easy',
        stability: 100,
        fragments: 0,
        worms: 0,
        combo: 0
    };

    function readQuery() {
        var params = null;
        try {
            params = new URLSearchParams(window.location.search);
        } catch (_) {
            params = null;
        }
        return {
            lanlanName: params ? String(params.get('lanlan_name') || '') : '',
            sessionId: params ? String(params.get('session_id') || '') : ''
        };
    }

    var query = readQuery();
    window.__nekoSubconsciousMaintenanceQuery = query;

    function setText(el, value) {
        if (el) {
            el.textContent = String(value);
        }
    }

    function setLayerVisible(layer, visible) {
        if (!layer) return;
        layer.hidden = !visible;
    }

    function syncDifficultyButtons() {
        for (var i = 0; i < difficultyButtons.length; i++) {
            var button = difficultyButtons[i];
            button.classList.toggle('is-active', button.getAttribute('data-difficulty') === state.difficulty);
        }
    }

    function syncHud() {
        setText(stabilityValue, state.stability);
        setText(fragmentsValue, state.fragments);
        setText(wormsValue, state.worms);
        setText(comboValue, state.combo);
        if (sessionLabel) {
            var parts = [];
            if (query.lanlanName) parts.push(query.lanlanName);
            if (query.sessionId) parts.push(query.sessionId);
            setText(sessionLabel, parts.length ? parts.join(' · ') : '待命');
        }
    }

    function syncPhase() {
        body.setAttribute('data-phase', state.phase);
        setLayerVisible(setupLayer, state.phase === 'setup');
        setLayerVisible(pauseLayer, state.phase === 'paused');
        setLayerVisible(endLayer, state.phase === 'ended');
    }

    function setPhase(nextPhase) {
        state.phase = nextPhase;
        syncPhase();
    }

    function setDifficulty(nextDifficulty) {
        state.difficulty = nextDifficulty;
        syncDifficultyButtons();
    }

    function resizeCanvas() {
        if (!canvas) return;
        var dpr = Math.max(window.devicePixelRatio || 1, 1);
        var rect = canvas.getBoundingClientRect();
        var width = Math.max(Math.round(rect.width), 1);
        var height = Math.max(Math.round(rect.height), 1);
        var targetWidth = Math.max(Math.round(width * dpr), 1);
        var targetHeight = Math.max(Math.round(height * dpr), 1);
        if (canvas.width !== targetWidth) {
            canvas.width = targetWidth;
        }
        if (canvas.height !== targetHeight) {
            canvas.height = targetHeight;
        }
        var context = canvas.getContext('2d');
        if (context) {
            context.setTransform(dpr, 0, 0, dpr, 0, 0);
            context.clearRect(0, 0, width, height);
        }
    }

    function scheduleResize() {
        if (resizeRaf) return;
        resizeRaf = window.requestAnimationFrame(function () {
            resizeRaf = 0;
            resizeCanvas();
        });
    }

    function showResult(result) {
        if (resultTitle) {
            setText(resultTitle, result === 'success' ? '成功' : '失败');
        }
        if (resultDetail) {
            setText(resultDetail, result === 'success' ? '特殊物品已集齐 5 个' : 'NEKO 稳定值已归零');
        }
        setPhase('ended');
    }

    function restartToSetup() {
        setPhase('setup');
        syncHud();
        resizeCanvas();
    }

    function exitToMemoryBrowser() {
        window.location.assign('/memory_browser');
    }

    function enterPlaying() {
        setPhase('playing');
        syncHud();
        resizeCanvas();
    }

    function enterPaused() {
        if (state.phase === 'playing') {
            setPhase('paused');
        }
    }

    function togglePauseFromKeyboard() {
        if (state.phase === 'playing') {
            setPhase('paused');
        } else if (state.phase === 'paused') {
            setPhase('playing');
        }
    }

    for (var i = 0; i < difficultyButtons.length; i++) {
        (function (button) {
            button.addEventListener('click', function () {
                setDifficulty(button.getAttribute('data-difficulty') || 'easy');
                syncHud();
            });
        })(difficultyButtons[i]);
    }

    if (startBtn) {
        startBtn.addEventListener('click', enterPlaying);
    }
    if (continueBtn) {
        continueBtn.addEventListener('click', function () {
            setPhase('playing');
        });
    }
    if (restartBtn) {
        restartBtn.addEventListener('click', restartToSetup);
    }
    if (exitBtn) {
        exitBtn.addEventListener('click', exitToMemoryBrowser);
    }
    if (endRestartBtn) {
        endRestartBtn.addEventListener('click', restartToSetup);
    }
    if (endExitBtn) {
        endExitBtn.addEventListener('click', exitToMemoryBrowser);
    }

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            togglePauseFromKeyboard();
        }
    });

    window.addEventListener('resize', scheduleResize);

    window.appSubconsciousMaintenance = {
        getState: function () {
            return Object.assign({}, state);
        },
        setDifficulty: setDifficulty,
        setPhase: setPhase,
        showResult: showResult,
        syncHud: syncHud,
        resizeCanvas: resizeCanvas
    };

    syncDifficultyButtons();
    syncHud();
    syncPhase();
    resizeCanvas();
})();
