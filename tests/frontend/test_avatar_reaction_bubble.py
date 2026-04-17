import pytest
from playwright.sync_api import Page, expect


@pytest.mark.frontend
def test_turn_end_does_not_clear_completion_before_late_speech_start(mock_page: Page, running_server: str):
    """Regression test for late TTS start after turn end."""
    mock_page.goto(f"{running_server}/", wait_until="domcontentloaded")
    mock_page.wait_for_function(
        "() => !!(window.appState && window.avatarReactionBubble)",
        timeout=10000,
    )

    mock_page.evaluate(
        """
        () => {
            window.dispatchEvent(new CustomEvent('neko-assistant-turn-start', {
                detail: { turnId: 'turn-late-audio', timestamp: Date.now() }
            }));
            window.dispatchEvent(new CustomEvent('neko-assistant-turn-end', {
                detail: { turnId: 'turn-late-audio', source: 'test', timestamp: Date.now() }
            }));
        }
        """
    )

    mock_page.wait_for_timeout(900)

    completion_turn_id = mock_page.evaluate("() => window.appState.assistantTurnCompletedId")
    expect(mock_page.locator("#avatar-reaction-bubble")).to_have_attribute("aria-hidden", "false")
    assert completion_turn_id == "turn-late-audio"


@pytest.mark.frontend
def test_turn_end_keeps_bubble_visible_and_falls_back_to_neutral_on_weak_network(mock_page: Page, running_server: str):
    """Regression test for slow emotion/audio paths under degraded network conditions."""
    mock_page.goto(f"{running_server}/", wait_until="domcontentloaded")
    mock_page.wait_for_function(
        "() => !!(window.appState && window.avatarReactionBubble)",
        timeout=10000,
    )

    mock_page.evaluate(
        """
        () => {
            window.dispatchEvent(new CustomEvent('neko-assistant-turn-start', {
                detail: { turnId: 'turn-weak-network', timestamp: Date.now() }
            }));
            window.dispatchEvent(new CustomEvent('neko-assistant-turn-end', {
                detail: { turnId: 'turn-weak-network', source: 'test', timestamp: Date.now() }
            }));
        }
        """
    )

    mock_page.wait_for_timeout(1800)

    bubble_state = mock_page.evaluate(
        """
        () => {
            const bubble = document.getElementById('avatar-reaction-bubble');
            return {
                ariaHidden: bubble.getAttribute('aria-hidden'),
                theme: bubble.dataset.theme,
                phase: bubble.dataset.phase
            };
        }
        """
    )

    assert bubble_state["ariaHidden"] == "false"
    assert bubble_state["theme"] == "neutral"
    assert bubble_state["phase"] == "emotion-ready"


@pytest.mark.frontend
def test_speech_start_replaces_thinking_ellipsis_with_neutral_until_emotion_ready(mock_page: Page, running_server: str):
    """Regression test for speech that starts before the separate emotion request finishes."""
    mock_page.goto(f"{running_server}/", wait_until="domcontentloaded")
    mock_page.wait_for_function(
        "() => !!(window.appState && window.avatarReactionBubble)",
        timeout=10000,
    )

    mock_page.evaluate(
        """
        () => {
            window.dispatchEvent(new CustomEvent('neko-assistant-turn-start', {
                detail: { turnId: 'turn-delayed-emotion', timestamp: Date.now() }
            }));
            window.dispatchEvent(new CustomEvent('neko-assistant-speech-start', {
                detail: { turnId: 'turn-delayed-emotion', source: 'test', timestamp: Date.now() }
            }));
        }
        """
    )

    mock_page.wait_for_timeout(1400)

    neutral_state = mock_page.evaluate(
        """
        () => {
            const bubble = document.getElementById('avatar-reaction-bubble');
            return {
                theme: bubble.dataset.theme,
                phase: bubble.dataset.phase,
                ariaHidden: bubble.getAttribute('aria-hidden')
            };
        }
        """
    )

    assert neutral_state["ariaHidden"] == "false"
    assert neutral_state["theme"] == "neutral"
    assert neutral_state["phase"] == "emotion-ready"

    mock_page.evaluate(
        """
        () => {
            window.dispatchEvent(new CustomEvent('neko-assistant-emotion-ready', {
                detail: {
                    turnId: 'turn-delayed-emotion',
                    emotion: 'happy',
                    source: 'test',
                    timestamp: Date.now()
                }
            }));
        }
        """
    )

    happy_theme = mock_page.evaluate(
        "() => document.getElementById('avatar-reaction-bubble').dataset.theme"
    )

    assert happy_theme == "happy"


@pytest.mark.frontend
def test_speech_start_does_not_flash_neutral_when_emotion_arrives_quickly(mock_page: Page, running_server: str):
    """A quick emotion-ready should replace thinking directly instead of flashing the neutral fallback first."""
    mock_page.goto(f"{running_server}/", wait_until="domcontentloaded")
    mock_page.wait_for_function(
        "() => !!(window.appState && window.avatarReactionBubble)",
        timeout=10000,
    )

    metrics = mock_page.evaluate(
        """
        () => new Promise((resolve) => {
            window.dispatchEvent(new CustomEvent('neko-assistant-turn-start', {
                detail: { turnId: 'turn-fast-emotion', timestamp: Date.now() }
            }));
            window.dispatchEvent(new CustomEvent('neko-assistant-speech-start', {
                detail: { turnId: 'turn-fast-emotion', source: 'test', timestamp: Date.now() }
            }));

            setTimeout(() => {
                const bubble = document.getElementById('avatar-reaction-bubble');
                const beforeEmotion = {
                    theme: bubble.dataset.theme,
                    phase: bubble.dataset.phase,
                    ariaHidden: bubble.getAttribute('aria-hidden')
                };

                window.dispatchEvent(new CustomEvent('neko-assistant-emotion-ready', {
                    detail: {
                        turnId: 'turn-fast-emotion',
                        emotion: 'happy',
                        source: 'test',
                        timestamp: Date.now()
                    }
                }));

                setTimeout(() => {
                    resolve({
                        beforeEmotion,
                        afterEmotion: {
                            theme: bubble.dataset.theme,
                            phase: bubble.dataset.phase,
                            ariaHidden: bubble.getAttribute('aria-hidden')
                        }
                    });
                }, 260);
            }, 120);
        })
        """
    )

    assert metrics["beforeEmotion"]["ariaHidden"] == "false"
    assert metrics["beforeEmotion"]["theme"] == "thinking"
    assert metrics["beforeEmotion"]["phase"] == "thinking"
    assert metrics["afterEmotion"]["ariaHidden"] == "false"
    assert metrics["afterEmotion"]["theme"] == "happy"
    assert metrics["afterEmotion"]["phase"] == "emotion-ready"


@pytest.mark.frontend
def test_user_activity_waits_briefly_before_cancelling_late_assistant_turn(mock_page: Page, running_server: str):
    """Regression test for false-positive user_activity arriving before weak-network TTS actually starts."""
    mock_page.goto(f"{running_server}/", wait_until="domcontentloaded")
    mock_page.wait_for_function(
        "() => !!(window.appState && window.appState.socket && window.avatarReactionBubble)",
        timeout=10000,
    )

    mock_page.evaluate(
        """
        () => {
            const originalSocket = window.appState.socket;
            const originalOnMessage = originalSocket.onmessage.bind(originalSocket);
            originalSocket.onclose = null;
            originalSocket.onerror = null;
            try { originalSocket.close(); } catch (_) {}

            window.appState.socket = {
                readyState: 1,
                send() {},
                onmessage: originalOnMessage
            };

            window.avatarReactionBubble.forceHide();
            window.currentGeminiMessage = null;
            window.currentTurnGeminiBubbles = [];
            window.currentTurnGeminiAttachments = [];
            window._geminiTurnFullText = '';
            window._realisticGeminiBuffer = '';
            window._realisticGeminiQueue = [];
            window._pendingMusicCommand = '';
            window.analyzeEmotion = () => new Promise(() => {});

            window.appState.assistantTurnId = null;
            window.appState.assistantPendingTurnServerId = null;
            window.appState.assistantTurnAwaitingBubble = false;
            window.appState.assistantTurnCompletedId = null;
            window.appState.assistantTurnCompletionSource = null;
            window.appState.assistantSpeechActiveTurnId = null;
            window.appState.assistantSpeechStartedTurnId = null;
            window.appState.pendingAudioChunkMetaQueue = [];
            window.appState.incomingAudioBlobQueue = [];
            window.appState.audioBufferQueue = [];
            window.appState.scheduledSources = [];
            window.appState.isPlaying = false;

            const feed = (msg) => window.appState.socket.onmessage({ data: JSON.stringify(msg) });

            feed({ type: 'gemini_response', isNewMessage: true, text: '弱网打断测试。', turn_id: 'turn-user-activity-grace' });
            feed({ type: 'system', data: 'turn end' });
            feed({ type: 'user_activity', interrupted_speech_id: null });
        }
        """
    )

    mock_page.wait_for_timeout(250)

    early_state = mock_page.evaluate(
        """
        () => {
            const bubble = document.getElementById('avatar-reaction-bubble');
            return {
                ariaHidden: bubble.getAttribute('aria-hidden'),
                turnId: window.avatarReactionBubble.getState().turnId
            };
        }
        """
    )

    assert early_state["ariaHidden"] == "false"
    assert early_state["turnId"] == "turn-user-activity-grace"

    mock_page.wait_for_timeout(700)

    late_state = mock_page.evaluate(
        """
        () => {
            const bubble = document.getElementById('avatar-reaction-bubble');
            return {
                ariaHidden: bubble.getAttribute('aria-hidden'),
                turnId: window.avatarReactionBubble.getState().turnId
            };
        }
        """
    )

    assert late_state["ariaHidden"] == "true"
    assert late_state["turnId"] is None


@pytest.mark.frontend
def test_orphan_audio_header_is_reaped_without_sticking_assistant_completion(mock_page: Page, running_server: str):
    """Regression test for audio_chunk headers that arrive without matching audio blobs."""
    mock_page.goto(f"{running_server}/", wait_until="domcontentloaded")
    mock_page.wait_for_function(
        "() => !!(window.appState && window.appState.socket && window.avatarReactionBubble)",
        timeout=10000,
    )

    mock_page.evaluate(
        """
        () => {
            const originalSocket = window.appState.socket;
            const originalOnMessage = originalSocket.onmessage.bind(originalSocket);
            originalSocket.onclose = null;
            originalSocket.onerror = null;
            try { originalSocket.close(); } catch (_) {}

            window.appState.socket = {
                readyState: 1,
                send() {},
                onmessage: originalOnMessage
            };

            window.avatarReactionBubble.forceHide();
            window.currentGeminiMessage = null;
            window.currentTurnGeminiBubbles = [];
            window.currentTurnGeminiAttachments = [];
            window._geminiTurnFullText = '';
            window._realisticGeminiBuffer = '';
            window._realisticGeminiQueue = [];
            window._pendingMusicCommand = '';
            window.analyzeEmotion = () => new Promise(() => {});

            window.appState.assistantTurnId = null;
            window.appState.assistantPendingTurnServerId = null;
            window.appState.assistantTurnAwaitingBubble = false;
            window.appState.assistantTurnCompletedId = null;
            window.appState.assistantTurnCompletionSource = null;
            window.appState.assistantSpeechActiveTurnId = null;
            window.appState.assistantSpeechStartedTurnId = null;
            window.appState.currentPlayingSpeechId = null;
            window.appState.pendingAudioChunkMetaQueue = [];
            window.appState.incomingAudioBlobQueue = [];
            window.appState.audioBufferQueue = [];
            window.appState.scheduledSources = [];
            window.appState.isPlaying = false;

            const feed = (msg) => window.appState.socket.onmessage({ data: JSON.stringify(msg) });

            feed({ type: 'gemini_response', isNewMessage: true, text: '音频头卡住测试。', turn_id: 'turn-audio-header-stall' });
            feed({ type: 'system', data: 'turn end' });
            feed({ type: 'audio_chunk', speech_id: 'speech-header-stall' });
        }
        """
    )

    mock_page.wait_for_timeout(2300)

    playback_state = mock_page.evaluate(
        """
        () => {
            const bubble = document.getElementById('avatar-reaction-bubble');
            return {
                ariaHidden: bubble.getAttribute('aria-hidden'),
                theme: bubble.dataset.theme,
                phase: bubble.dataset.phase,
                pendingMeta: window.appState.pendingAudioChunkMetaQueue.length,
                completedId: window.appState.assistantTurnCompletedId,
                currentPlayingSpeechId: window.appState.currentPlayingSpeechId,
                speechStartedAt: window.avatarReactionBubble.getState().speechStartedAt
            };
        }
        """
    )

    assert playback_state["ariaHidden"] == "false"
    assert playback_state["theme"] == "neutral"
    assert playback_state["phase"] == "emotion-ready"
    assert playback_state["pendingMeta"] == 0
    assert playback_state["completedId"] is None
    assert playback_state["currentPlayingSpeechId"] is None
    assert playback_state["speechStartedAt"] == 0


@pytest.mark.frontend
def test_command_only_response_still_starts_avatar_turn_without_visible_chat_bubble(mock_page: Page, running_server: str):
    """Regression test for assistant turns whose visible chat content is stripped as commands only."""
    mock_page.goto(f"{running_server}/", wait_until="domcontentloaded")
    mock_page.wait_for_function(
        "() => !!(window.appState && window.appState.socket && window.avatarReactionBubble)",
        timeout=10000,
    )

    mock_page.evaluate(
        """
        () => {
            const originalSocket = window.appState.socket;
            const originalOnMessage = originalSocket.onmessage.bind(originalSocket);
            originalSocket.onclose = null;
            originalSocket.onerror = null;
            try { originalSocket.close(); } catch (_) {}

            window.appState.socket = {
                readyState: 1,
                send() {},
                onmessage: originalOnMessage
            };

            window.avatarReactionBubble.forceHide();
            window.currentGeminiMessage = null;
            window.currentTurnGeminiBubbles = [];
            window.currentTurnGeminiAttachments = [];
            window._geminiTurnFullText = '';
            window._realisticGeminiBuffer = '';
            window._realisticGeminiQueue = [];
            window._pendingMusicCommand = '';
            window.analyzeEmotion = () => new Promise(() => {});

            window.appState.assistantTurnId = null;
            window.appState.assistantPendingTurnServerId = null;
            window.appState.assistantTurnAwaitingBubble = false;
            window.appState.assistantTurnCompletedId = null;
            window.appState.assistantTurnCompletionSource = null;
            window.appState.assistantSpeechActiveTurnId = null;
            window.appState.assistantSpeechStartedTurnId = null;
            window.appState.pendingAudioChunkMetaQueue = [];
            window.appState.incomingAudioBlobQueue = [];
            window.appState.audioBufferQueue = [];
            window.appState.scheduledSources = [];
            window.appState.isPlaying = false;

            const feed = (msg) => window.appState.socket.onmessage({ data: JSON.stringify(msg) });

            feed({ type: 'gemini_response', isNewMessage: true, text: '[play_music:rainy jazz]', turn_id: 'turn-command-only' });
            feed({ type: 'system', data: 'turn end' });
        }
        """
    )

    mock_page.wait_for_timeout(250)

    early_state = mock_page.evaluate(
        """
        () => {
            const bubble = document.getElementById('avatar-reaction-bubble');
            return {
                ariaHidden: bubble.getAttribute('aria-hidden'),
                turnId: window.avatarReactionBubble.getState().turnId,
                phase: bubble.dataset.phase,
                chatBubbleCount: (window.currentTurnGeminiBubbles || []).length
            };
        }
        """
    )

    assert early_state["ariaHidden"] == "false"
    assert early_state["turnId"] == "turn-command-only"
    assert early_state["chatBubbleCount"] == 0

    mock_page.wait_for_timeout(1600)

    fallback_state = mock_page.evaluate(
        """
        () => {
            const bubble = document.getElementById('avatar-reaction-bubble');
            return {
                ariaHidden: bubble.getAttribute('aria-hidden'),
                theme: bubble.dataset.theme,
                phase: bubble.dataset.phase
            };
        }
        """
    )

    assert fallback_state["ariaHidden"] == "false"
    assert fallback_state["theme"] == "neutral"
    assert fallback_state["phase"] == "emotion-ready"


@pytest.mark.frontend
def test_live2d_face_rect_keeps_bubble_near_head(mock_page: Page, running_server: str):
    """Regression test for Live2D models with large blank space above the visible face."""
    mock_page.goto(f"{running_server}/", wait_until="domcontentloaded")
    mock_page.wait_for_function(
        "() => !!(window.appState && window.avatarReactionBubble)",
        timeout=10000,
    )

    metrics = mock_page.evaluate(
        """
        () => {
            const live2dContainer = document.getElementById('live2d-container');
            const vrmContainer = document.getElementById('vrm-container');
            const mmdContainer = document.getElementById('mmd-container');
            const bubble = document.getElementById('avatar-reaction-bubble');

            live2dContainer.style.display = 'block';
            live2dContainer.style.visibility = 'visible';
            vrmContainer.style.display = 'none';
            mmdContainer.style.display = 'none';

            const bounds = {
                left: 96,
                top: -280,
                right: 416,
                bottom: 1120,
                width: 320,
                height: 1400,
                centerX: 256,
                centerY: 420
            };
            const headRect = {
                left: 186,
                top: 198,
                right: 326,
                bottom: 364,
                width: 140,
                height: 166,
                centerX: 256,
                centerY: 281
            };
            const headAnchor = { x: 256, y: 266 };

            window.vrmManager = null;
            window.mmdManager = null;
            window.live2dManager = {
                getModelScreenBounds() {
                    return bounds;
                },
                getHeadScreenAnchor() {
                    return headAnchor;
                },
                getHeadScreenRectInfo() {
                    return {
                        rect: headRect,
                        mode: 'face'
                    };
                },
                getBodyScreenRectInfo() {
                    return null;
                }
            };

            window.dispatchEvent(new CustomEvent('neko-assistant-turn-start', {
                detail: { turnId: 'turn-live2d-face-lock', timestamp: Date.now() }
            }));

            const top = parseFloat(bubble.style.top || '0');
            const bubbleHeight = parseFloat(getComputedStyle(bubble).getPropertyValue('--bubble-height') || '0');

            return {
                top,
                bubbleHeight,
                headTop: headRect.top
            };
        }
        """
    )

    expect(mock_page.locator("#avatar-reaction-bubble")).to_have_attribute("aria-hidden", "false")
    assert metrics["bubbleHeight"] > 0
    assert metrics["top"] >= metrics["headTop"] - metrics["bubbleHeight"] * 0.34 - 2
    assert metrics["top"] <= metrics["headTop"] - metrics["bubbleHeight"] * 0.18 + 2


@pytest.mark.frontend
def test_live2d_manager_prefers_display_info_over_coarse_autonamed_hitarea(mock_page: Page, running_server: str):
    """Regression test for models whose repaired HitArea is much coarser than DisplayInfo."""
    mock_page.goto(f"{running_server}/", wait_until="domcontentloaded")
    mock_page.wait_for_function(
        "() => !!(window.live2dManager && window.live2dManager.getHeadScreenRectInfo)",
        timeout=10000,
    )

    selected = mock_page.evaluate(
        """
        () => {
            const manager = window.live2dManager;
            const originalGetModelScreenBounds = manager.getModelScreenBounds.bind(manager);
            const originalGetHeadHitAreaScreenRectInfo = manager._getHeadHitAreaScreenRectInfo.bind(manager);
            const originalGetDisplayInfoPartScreenRectInfo = manager._getDisplayInfoPartScreenRectInfo.bind(manager);

            const bounds = {
                left: 96,
                top: -280,
                right: 416,
                bottom: 1120,
                width: 320,
                height: 1400,
                centerX: 256,
                centerY: 420
            };
            const coarseHitArea = {
                rect: {
                    left: 146,
                    top: 80,
                    right: 364,
                    bottom: 456,
                    width: 218,
                    height: 376,
                    centerX: 255,
                    centerY: 268
                },
                mode: 'face',
                source: 'hitArea',
                hitAreaId: 'HitAreaHead',
                hitAreaName: 'HitAreaHead',
                autoNamed: true
            };
            const displayInfo = {
                rect: {
                    left: 192,
                    top: 212,
                    right: 320,
                    bottom: 392,
                    width: 128,
                    height: 180,
                    centerX: 256,
                    centerY: 302
                },
                mode: 'face',
                source: 'displayInfo'
            };

            try {
                manager.getModelScreenBounds = () => bounds;
                manager._getHeadHitAreaScreenRectInfo = () => coarseHitArea;
                manager._getDisplayInfoPartScreenRectInfo = (kind) => kind === 'head' ? displayInfo : null;

                const selectedInfo = manager.getHeadScreenRectInfo();
                return {
                    source: selectedInfo?.source || null,
                    top: selectedInfo?.rect?.top || null,
                    width: selectedInfo?.rect?.width || null
                };
            } finally {
                manager.getModelScreenBounds = originalGetModelScreenBounds;
                manager._getHeadHitAreaScreenRectInfo = originalGetHeadHitAreaScreenRectInfo;
                manager._getDisplayInfoPartScreenRectInfo = originalGetDisplayInfoPartScreenRectInfo;
            }
        }
        """
    )

    assert selected["source"] == "displayInfo"
    assert selected["top"] == 212
    assert selected["width"] == 128


@pytest.mark.frontend
def test_live2d_manager_prefers_drawable_inference_over_tiny_touch_hotspots(mock_page: Page, running_server: str):
    """Regression test for workshop models whose TouchHead/TouchBody are only tiny tap hotspots."""
    mock_page.goto(f"{running_server}/", wait_until="domcontentloaded")
    mock_page.wait_for_function(
        "() => !!(window.live2dManager && window.live2dManager.getHeadScreenRectInfo)",
        timeout=10000,
    )

    selected = mock_page.evaluate(
        """
        () => {
            const manager = window.live2dManager;
            const originalGetModelScreenBounds = manager.getModelScreenBounds.bind(manager);
            const originalGetModelLogicalRect = manager._getModelLogicalRect.bind(manager);
            const originalGetHeadHitAreaScreenRectInfo = manager._getHeadHitAreaScreenRectInfo.bind(manager);
            const originalGetBodyHitAreaScreenRectInfo = manager._getBodyHitAreaScreenRectInfo.bind(manager);
            const originalGetDisplayInfoPartScreenRectInfo = manager._getDisplayInfoPartScreenRectInfo.bind(manager);
            const originalInferDrawableRegionScreenRectInfo = manager._inferDrawableRegionScreenRectInfo.bind(manager);

            const bounds = {
                left: 860,
                top: 320,
                right: 1140,
                bottom: 1100,
                width: 280,
                height: 780,
                centerX: 1000,
                centerY: 710
            };
            const tinyHeadHotspot = {
                rect: {
                    left: 1012,
                    top: 704,
                    right: 1028,
                    bottom: 720,
                    width: 16,
                    height: 16,
                    centerX: 1020,
                    centerY: 712
                },
                mode: 'face',
                source: 'hitArea',
                hitAreaId: 'TouchHead',
                hitAreaName: 'touch_head',
                autoNamed: false
            };
            const tinyBodyHotspot = {
                rect: {
                    left: 994,
                    top: 738,
                    right: 1028,
                    bottom: 808,
                    width: 34,
                    height: 70,
                    centerX: 1011,
                    centerY: 773
                },
                mode: 'body',
                source: 'hitArea',
                hitAreaId: 'TouchBody',
                hitAreaName: 'touch_body',
                autoNamed: false
            };
            const inferredHead = {
                rect: {
                    left: 938,
                    top: 542,
                    right: 1084,
                    bottom: 688,
                    width: 146,
                    height: 146,
                    centerX: 1011,
                    centerY: 615
                },
                mode: 'face',
                source: 'drawableHeuristic'
            };
            const inferredBody = {
                rect: {
                    left: 918,
                    top: 654,
                    right: 1092,
                    bottom: 980,
                    width: 174,
                    height: 326,
                    centerX: 1005,
                    centerY: 817
                },
                mode: 'body',
                source: 'drawableHeuristic'
            };

            try {
                manager.getModelScreenBounds = () => bounds;
                manager._getModelLogicalRect = () => ({
                    x: 0,
                    y: 0,
                    width: 280,
                    height: 780
                });
                manager._getHeadHitAreaScreenRectInfo = () => tinyHeadHotspot;
                manager._getBodyHitAreaScreenRectInfo = () => tinyBodyHotspot;
                manager._getDisplayInfoPartScreenRectInfo = () => null;
                manager._inferDrawableRegionScreenRectInfo = (kind) => (
                    kind === 'head' ? inferredHead : inferredBody
                );

                const selectedHead = manager.getHeadScreenRectInfo();
                const selectedBody = manager.getBodyScreenRectInfo();
                return {
                    headSource: selectedHead?.source || null,
                    headTop: selectedHead?.rect?.top || null,
                    headWidth: selectedHead?.rect?.width || null,
                    bodySource: selectedBody?.source || null,
                    bodyTop: selectedBody?.rect?.top || null,
                    bodyHeight: selectedBody?.rect?.height || null
                };
            } finally {
                manager.getModelScreenBounds = originalGetModelScreenBounds;
                manager._getModelLogicalRect = originalGetModelLogicalRect;
                manager._getHeadHitAreaScreenRectInfo = originalGetHeadHitAreaScreenRectInfo;
                manager._getBodyHitAreaScreenRectInfo = originalGetBodyHitAreaScreenRectInfo;
                manager._getDisplayInfoPartScreenRectInfo = originalGetDisplayInfoPartScreenRectInfo;
                manager._inferDrawableRegionScreenRectInfo = originalInferDrawableRegionScreenRectInfo;
            }
        }
        """
    )

    assert selected["headSource"] == "drawableHeuristic"
    assert selected["headTop"] == 542
    assert selected["headWidth"] == 146
    assert selected["bodySource"] == "drawableHeuristic"
    assert selected["bodyTop"] == 654
    assert selected["bodyHeight"] == 326


@pytest.mark.frontend
def test_live2d_manager_prefers_inferred_body_over_tiny_display_info_body(mock_page: Page, running_server: str):
    """Regression test for models whose display-info body part is only a tiny chest patch while the head is correct."""
    mock_page.goto(f"{running_server}/", wait_until="domcontentloaded")
    mock_page.wait_for_function(
        "() => !!(window.live2dManager && window.live2dManager.getBodyScreenRectInfo)",
        timeout=10000,
    )

    selected = mock_page.evaluate(
        """
        () => {
            const manager = window.live2dManager;
            const originalGetModelScreenBounds = manager.getModelScreenBounds.bind(manager);
            const originalGetModelLogicalRect = manager._getModelLogicalRect.bind(manager);
            const originalGetHeadHitAreaScreenRectInfo = manager._getHeadHitAreaScreenRectInfo.bind(manager);
            const originalGetBodyHitAreaScreenRectInfo = manager._getBodyHitAreaScreenRectInfo.bind(manager);
            const originalGetDisplayInfoPartScreenRectInfo = manager._getDisplayInfoPartScreenRectInfo.bind(manager);
            const originalInferDrawableRegionScreenRectInfo = manager._inferDrawableRegionScreenRectInfo.bind(manager);

            const bounds = {
                left: 2002.9,
                top: 700,
                right: 2860,
                bottom: 1900,
                width: 857.1,
                height: 1200,
                centerX: 2431.4,
                centerY: 1300
            };
            const displayHead = {
                rect: {
                    left: 2355.3,
                    top: 809.7,
                    right: 2509.4,
                    bottom: 964.1,
                    width: 154.2,
                    height: 154.4,
                    centerX: 2432.4,
                    centerY: 886.9
                },
                mode: 'face',
                source: 'displayInfo'
            };
            const tinyDisplayBody = {
                rect: {
                    left: 2382.0,
                    top: 1027.1,
                    right: 2495.2,
                    bottom: 1096.4,
                    width: 113.2,
                    height: 69.3,
                    centerX: 2438.6,
                    centerY: 1061.7
                },
                mode: 'body',
                source: 'displayInfo'
            };
            const inferredBody = {
                rect: {
                    left: 2175.3,
                    top: 919.8,
                    right: 2772.4,
                    bottom: 1854.2,
                    width: 597.1,
                    height: 934.4,
                    centerX: 2473.9,
                    centerY: 1387.0
                },
                mode: 'body',
                source: 'drawableHeuristic'
            };

            try {
                manager.getModelScreenBounds = () => bounds;
                manager._getModelLogicalRect = () => ({
                    x: 0,
                    y: 0,
                    width: 857.1,
                    height: 1200
                });
                manager._getHeadHitAreaScreenRectInfo = () => null;
                manager._getBodyHitAreaScreenRectInfo = () => null;
                manager._getDisplayInfoPartScreenRectInfo = (kind) => (
                    kind === 'head' ? displayHead : kind === 'body' ? tinyDisplayBody : null
                );
                manager._inferDrawableRegionScreenRectInfo = (kind) => (
                    kind === 'body' ? inferredBody : null
                );

                const selectedBody = manager.getBodyScreenRectInfo();
                return {
                    source: selectedBody?.source || null,
                    top: selectedBody?.rect?.top || null,
                    width: selectedBody?.rect?.width || null,
                    height: selectedBody?.rect?.height || null
                };
            } finally {
                manager.getModelScreenBounds = originalGetModelScreenBounds;
                manager._getModelLogicalRect = originalGetModelLogicalRect;
                manager._getHeadHitAreaScreenRectInfo = originalGetHeadHitAreaScreenRectInfo;
                manager._getBodyHitAreaScreenRectInfo = originalGetBodyHitAreaScreenRectInfo;
                manager._getDisplayInfoPartScreenRectInfo = originalGetDisplayInfoPartScreenRectInfo;
                manager._inferDrawableRegionScreenRectInfo = originalInferDrawableRegionScreenRectInfo;
            }
        }
        """
    )

    assert selected["source"] == "drawableHeuristic"
    assert selected["top"] == 919.8
    assert selected["width"] == 597.1
    assert selected["height"] == 934.4


@pytest.mark.frontend
def test_live2d_precise_head_with_inferred_body_keeps_bubble_sized_to_head(mock_page: Page, running_server: str):
    """Regression test for precise display-info heads whose inferred body should not inflate the bubble to full-body size."""
    mock_page.goto(f"{running_server}/", wait_until="domcontentloaded")
    mock_page.wait_for_function(
        "() => !!(window.appState && window.avatarReactionBubble)",
        timeout=10000,
    )

    metrics = mock_page.evaluate(
        """
        () => new Promise((resolve) => {
            const live2dContainer = document.getElementById('live2d-container');
            const vrmContainer = document.getElementById('vrm-container');
            const mmdContainer = document.getElementById('mmd-container');
            const bubble = document.getElementById('avatar-reaction-bubble');

            live2dContainer.style.display = 'block';
            live2dContainer.style.visibility = 'visible';
            vrmContainer.style.display = 'none';
            mmdContainer.style.display = 'none';

            const bounds = {
                left: 2002.9,
                top: 700,
                right: 2860,
                bottom: 1900,
                width: 857.1,
                height: 1200,
                centerX: 2431.4,
                centerY: 1300
            };
            const headRect = {
                left: 2355.3,
                top: 809.7,
                right: 2509.4,
                bottom: 964.1,
                width: 154.2,
                height: 154.4,
                centerX: 2432.4,
                centerY: 886.9
            };
            const bodyRect = {
                left: 2175.3,
                top: 919.8,
                right: 2772.4,
                bottom: 1854.2,
                width: 597.1,
                height: 934.4,
                centerX: 2473.9,
                centerY: 1387.0
            };

            window.avatarReactionBubbleEnabled = true;
            window.vrmManager = null;
            window.mmdManager = null;
            window.live2dManager = {
                getModelScreenBounds() {
                    return bounds;
                },
                getHeadScreenAnchor() {
                    return {
                        x: headRect.centerX,
                        y: headRect.top + headRect.height * 0.36
                    };
                },
                getHeadScreenRectInfo() {
                    return {
                        rect: headRect,
                        mode: 'face',
                        source: 'displayInfo'
                    };
                },
                getBodyScreenRectInfo() {
                    return {
                        rect: bodyRect,
                        mode: 'body',
                        source: 'drawableHeuristic'
                    };
                },
                getBubbleAnchorDebugInfo() {
                    return null;
                }
            };

            window.dispatchEvent(new CustomEvent('neko-assistant-turn-start', {
                detail: { turnId: 'turn-live2d-precise-head-inferred-body-cap', timestamp: Date.now() }
            }));

            setTimeout(() => {
                const state = window.avatarReactionBubble.getState();
                resolve({
                    top: parseFloat(bubble.style.top || '0'),
                    width: parseFloat(getComputedStyle(bubble).getPropertyValue('--bubble-width') || '0'),
                    height: parseFloat(getComputedStyle(bubble).getPropertyValue('--bubble-height') || '0'),
                    headTop: headRect.top,
                    headSource: state.lastDebugSnapshot ? state.lastDebugSnapshot.headSource : null
                });
            }, 700);
        })
        """
    )

    assert metrics["headSource"] == "displayInfo"
    assert metrics["width"] < 420
    assert metrics["height"] < 320
    assert metrics["top"] < metrics["headTop"]


@pytest.mark.frontend
def test_live2d_tiny_display_body_falls_back_to_bubble_body_proxy_when_inference_is_missing(mock_page: Page, running_server: str):
    """Regression test for YUI-like display-info models whose body metadata collapses to a tiny chest fragment."""
    mock_page.goto(f"{running_server}/", wait_until="domcontentloaded")
    mock_page.wait_for_function(
        "() => !!(window.live2dManager && window.live2dManager.getBubbleAnchorGeometryInfo)",
        timeout=10000,
    )

    selected = mock_page.evaluate(
        """
        () => {
            const manager = window.live2dManager;
            const originalGetModelScreenBounds = manager.getModelScreenBounds.bind(manager);
            const originalGetModelLogicalRect = manager._getModelLogicalRect.bind(manager);
            const originalGetHeadHitAreaScreenRectInfo = manager._getHeadHitAreaScreenRectInfo.bind(manager);
            const originalGetBodyHitAreaScreenRectInfo = manager._getBodyHitAreaScreenRectInfo.bind(manager);
            const originalGetDisplayInfoPartScreenRectInfo = manager._getDisplayInfoPartScreenRectInfo.bind(manager);
            const originalInferDrawableRegionScreenRectInfo = manager._inferDrawableRegionScreenRectInfo.bind(manager);

            const bounds = {
                left: 2002.9,
                top: 700,
                right: 2860,
                bottom: 1900,
                width: 857.1,
                height: 1200,
                centerX: 2431.4,
                centerY: 1300
            };
            const displayHead = {
                rect: {
                    left: 2355.3,
                    top: 809.7,
                    right: 2509.4,
                    bottom: 964.1,
                    width: 154.2,
                    height: 154.4,
                    centerX: 2432.4,
                    centerY: 886.9
                },
                mode: 'face',
                source: 'displayInfo'
            };
            const tinyDisplayBody = {
                rect: {
                    left: 2382.0,
                    top: 1027.1,
                    right: 2495.2,
                    bottom: 1096.4,
                    width: 113.2,
                    height: 69.3,
                    centerX: 2438.6,
                    centerY: 1061.7
                },
                mode: 'body',
                source: 'displayInfo'
            };

            try {
                manager.getModelScreenBounds = () => bounds;
                manager._getModelLogicalRect = () => ({
                    x: 0,
                    y: 0,
                    width: 857.1,
                    height: 1200
                });
                manager._getHeadHitAreaScreenRectInfo = () => null;
                manager._getBodyHitAreaScreenRectInfo = () => null;
                manager._getDisplayInfoPartScreenRectInfo = (kind) => (
                    kind === 'head' ? displayHead : kind === 'body' ? tinyDisplayBody : null
                );
                manager._inferDrawableRegionScreenRectInfo = () => null;

                const geometry = manager.getBubbleAnchorGeometryInfo();
                return {
                    bodySource: geometry?.bodySource || null,
                    reliableHeadRect: geometry?.reliableHeadRect === true,
                    preciseDisplayInfoRect: geometry?.preciseDisplayInfoRect === true,
                    bodyWidth: geometry?.bodyRect?.width || 0,
                    bodyHeight: geometry?.bodyRect?.height || 0
                };
            } finally {
                manager.getModelScreenBounds = originalGetModelScreenBounds;
                manager._getModelLogicalRect = originalGetModelLogicalRect;
                manager._getHeadHitAreaScreenRectInfo = originalGetHeadHitAreaScreenRectInfo;
                manager._getBodyHitAreaScreenRectInfo = originalGetBodyHitAreaScreenRectInfo;
                manager._getDisplayInfoPartScreenRectInfo = originalGetDisplayInfoPartScreenRectInfo;
                manager._inferDrawableRegionScreenRectInfo = originalInferDrawableRegionScreenRectInfo;
            }
        }
        """
    )

    assert selected["bodySource"] == "bubbleBodyProxy"
    assert selected["reliableHeadRect"] is True
    assert selected["preciseDisplayInfoRect"] is True
    assert selected["bodyWidth"] > 180
    assert selected["bodyHeight"] > 220


@pytest.mark.frontend
def test_live2d_precise_display_info_body_aware_layout_does_not_expand_bubble_to_body_size(mock_page: Page, running_server: str):
    """Regression test for precise display-info heads whose oversized torso metadata used to dominate bubble sizing."""
    mock_page.goto(f"{running_server}/", wait_until="domcontentloaded")
    mock_page.wait_for_function(
        "() => !!(window.appState && window.avatarReactionBubble)",
        timeout=10000,
    )

    metrics = mock_page.evaluate(
        """
        () => new Promise((resolve) => {
            const live2dContainer = document.getElementById('live2d-container');
            const vrmContainer = document.getElementById('vrm-container');
            const mmdContainer = document.getElementById('mmd-container');
            const bubble = document.getElementById('avatar-reaction-bubble');

            live2dContainer.style.display = 'block';
            live2dContainer.style.visibility = 'visible';
            vrmContainer.style.display = 'none';
            mmdContainer.style.display = 'none';

            const bounds = {
                left: 2153.5,
                top: 686.4,
                right: 2778.9,
                bottom: 1904.5,
                width: 625.4,
                height: 1218.2,
                centerX: 2466.2,
                centerY: 1295.5
            };
            const headRect = {
                left: 2428.6,
                top: 824.7,
                right: 2520.1,
                bottom: 945.0,
                width: 91.5,
                height: 120.3,
                centerX: 2474.3,
                centerY: 884.9
            };
            const bodyRect = {
                left: 2230.7,
                top: 810.8,
                right: 2720.0,
                bottom: 1843.9,
                width: 489.3,
                height: 1033.1,
                centerX: 2475.3,
                centerY: 1327.3
            };

            window.avatarReactionBubbleEnabled = true;
            window.vrmManager = null;
            window.mmdManager = null;
            window.live2dManager = {
                getModelScreenBounds() {
                    return bounds;
                },
                getBubbleAnchorGeometryInfo() {
                    return {
                        bounds,
                        rawHeadAnchor: {
                            x: headRect.centerX,
                            y: headRect.top + headRect.height * 0.36
                        },
                        headAnchor: {
                            x: headRect.centerX,
                            y: headRect.top + headRect.height * 0.36
                        },
                        headRect,
                        headMode: 'face',
                        headSource: 'displayInfo',
                        bodyRect,
                        bodySource: 'displayInfo',
                        reliableHeadRect: true,
                        preciseDisplayInfoRect: true,
                        coarseHitAreaHeadRect: false
                    };
                },
                getBubbleAnchorDebugInfo() {
                    return null;
                }
            };

            window.dispatchEvent(new CustomEvent('neko-assistant-turn-start', {
                detail: { turnId: 'turn-live2d-displayinfo-body-aware-cap', timestamp: Date.now() }
            }));

            setTimeout(() => {
                const state = window.avatarReactionBubble.getState();
                resolve({
                    top: parseFloat(bubble.style.top || '0'),
                    width: parseFloat(getComputedStyle(bubble).getPropertyValue('--bubble-width') || '0'),
                    height: parseFloat(getComputedStyle(bubble).getPropertyValue('--bubble-height') || '0'),
                    headTop: headRect.top,
                    headCenterX: headRect.centerX,
                    bodyCenterX: bodyRect.centerX,
                    anchorX: state.lastDebugSnapshot ? state.lastDebugSnapshot.anchor.x : null
                });
            }, 700);
        })
        """
    )

    assert metrics["width"] < 360
    assert metrics["height"] < 280
    assert metrics["top"] < metrics["headTop"]
    assert abs(metrics["anchorX"] - metrics["headCenterX"]) < abs(metrics["anchorX"] - metrics["bodyCenterX"])


@pytest.mark.frontend
def test_live2d_bubble_size_ignores_body_scale_when_head_rect_is_stable(mock_page: Page, running_server: str):
    """Regression test that a stable head rect keeps the bubble size stable even if torso geometry changes a lot."""
    mock_page.goto(f"{running_server}/", wait_until="domcontentloaded")
    mock_page.wait_for_function(
        "() => !!(window.appState && window.avatarReactionBubble)",
        timeout=10000,
    )

    metrics = mock_page.evaluate(
        """
        () => new Promise((resolve) => {
            const live2dContainer = document.getElementById('live2d-container');
            const vrmContainer = document.getElementById('vrm-container');
            const mmdContainer = document.getElementById('mmd-container');
            const bubble = document.getElementById('avatar-reaction-bubble');

            live2dContainer.style.display = 'block';
            live2dContainer.style.visibility = 'visible';
            vrmContainer.style.display = 'none';
            mmdContainer.style.display = 'none';

            const bounds = {
                left: 120,
                top: 60,
                right: 920,
                bottom: 980,
                width: 800,
                height: 920,
                centerX: 520,
                centerY: 520
            };
            const headRect = {
                left: 622,
                top: 212,
                right: 772,
                bottom: 382,
                width: 150,
                height: 170,
                centerX: 697,
                centerY: 297
            };
            let bodyRect = {
                left: 566,
                top: 336,
                right: 822,
                bottom: 736,
                width: 256,
                height: 400,
                centerX: 694,
                centerY: 536
            };

            const measure = () => ({
                width: parseFloat(getComputedStyle(bubble).getPropertyValue('--bubble-width') || '0'),
                height: parseFloat(getComputedStyle(bubble).getPropertyValue('--bubble-height') || '0'),
                top: parseFloat(bubble.style.top || '0')
            });

            window.avatarReactionBubbleEnabled = true;
            window.vrmManager = null;
            window.mmdManager = null;
            window.live2dManager = {
                getModelScreenBounds() {
                    return bounds;
                },
                getBubbleAnchorGeometryInfo() {
                    return {
                        bounds,
                        rawHeadAnchor: {
                            x: headRect.centerX,
                            y: headRect.top + headRect.height * 0.36
                        },
                        headAnchor: {
                            x: headRect.centerX,
                            y: headRect.top + headRect.height * 0.36
                        },
                        headRect,
                        headMode: 'face',
                        headSource: 'displayInfo',
                        bodyRect,
                        bodySource: 'displayInfo',
                        reliableHeadRect: true,
                        preciseDisplayInfoRect: true,
                        coarseHitAreaHeadRect: false
                    };
                },
                getBubbleAnchorDebugInfo() {
                    return null;
                }
            };

            window.dispatchEvent(new CustomEvent('neko-assistant-turn-start', {
                detail: { turnId: 'turn-live2d-head-size-stable', timestamp: Date.now() }
            }));

            setTimeout(() => {
                const before = measure();
                bodyRect = {
                    left: 420,
                    top: 180,
                    right: 890,
                    bottom: 900,
                    width: 470,
                    height: 720,
                    centerX: 655,
                    centerY: 540
                };

                setTimeout(() => {
                    resolve({
                        before,
                        after: measure()
                    });
                }, 320);
            }, 700);
        })
        """
    )

    assert metrics["before"]["width"] > 0
    assert metrics["before"]["height"] > 0
    assert abs(metrics["after"]["width"] - metrics["before"]["width"]) <= 1
    assert abs(metrics["after"]["height"] - metrics["before"]["height"]) <= 1


@pytest.mark.frontend
def test_live2d_small_head_rect_jitter_does_not_resize_or_reposition_bubble(mock_page: Page, running_server: str):
    """Regression test that tiny head-box jitter does not make the bubble constantly resize or wobble."""
    mock_page.goto(f"{running_server}/", wait_until="domcontentloaded")
    mock_page.wait_for_function(
        "() => !!(window.appState && window.avatarReactionBubble)",
        timeout=10000,
    )

    metrics = mock_page.evaluate(
        """
        () => new Promise((resolve) => {
            const live2dContainer = document.getElementById('live2d-container');
            const vrmContainer = document.getElementById('vrm-container');
            const mmdContainer = document.getElementById('mmd-container');
            const bubble = document.getElementById('avatar-reaction-bubble');

            live2dContainer.style.display = 'block';
            live2dContainer.style.visibility = 'visible';
            vrmContainer.style.display = 'none';
            mmdContainer.style.display = 'none';

            const bounds = {
                left: 180,
                top: 40,
                right: 960,
                bottom: 980,
                width: 780,
                height: 940,
                centerX: 570,
                centerY: 510
            };
            let headRect = {
                left: 632,
                top: 216,
                right: 796,
                bottom: 398,
                width: 164,
                height: 182,
                centerX: 714,
                centerY: 307
            };
            const bodyRect = {
                left: 562,
                top: 346,
                right: 854,
                bottom: 812,
                width: 292,
                height: 466,
                centerX: 708,
                centerY: 579
            };

            const measure = () => ({
                width: parseFloat(getComputedStyle(bubble).getPropertyValue('--bubble-width') || '0'),
                height: parseFloat(getComputedStyle(bubble).getPropertyValue('--bubble-height') || '0'),
                left: parseFloat(bubble.style.left || '0'),
                top: parseFloat(bubble.style.top || '0')
            });

            window.avatarReactionBubbleEnabled = true;
            window.vrmManager = null;
            window.mmdManager = null;
            window.live2dManager = {
                getModelScreenBounds() {
                    return bounds;
                },
                getBubbleAnchorGeometryInfo() {
                    return {
                        bounds,
                        rawHeadAnchor: {
                            x: headRect.centerX,
                            y: headRect.top + headRect.height * 0.36
                        },
                        headAnchor: {
                            x: headRect.centerX,
                            y: headRect.top + headRect.height * 0.36
                        },
                        headRect,
                        headMode: 'face',
                        headSource: 'displayInfo',
                        bodyRect,
                        bodySource: 'displayInfo',
                        reliableHeadRect: true,
                        preciseDisplayInfoRect: true,
                        coarseHitAreaHeadRect: false
                    };
                },
                getBubbleAnchorDebugInfo() {
                    return null;
                }
            };

            window.dispatchEvent(new CustomEvent('neko-assistant-turn-start', {
                detail: { turnId: 'turn-live2d-head-jitter-deadzone', timestamp: Date.now() }
            }));

            setTimeout(() => {
                const before = measure();
                headRect = {
                    left: 635,
                    top: 219,
                    right: 801,
                    bottom: 401,
                    width: 166,
                    height: 182,
                    centerX: 718,
                    centerY: 310
                };

                setTimeout(() => {
                    resolve({
                        before,
                        after: measure()
                    });
                }, 320);
            }, 700);
        })
        """
    )

    assert abs(metrics["after"]["width"] - metrics["before"]["width"]) <= 1
    assert abs(metrics["after"]["height"] - metrics["before"]["height"]) <= 1
    assert abs(metrics["after"]["left"] - metrics["before"]["left"]) <= 1
    assert abs(metrics["after"]["top"] - metrics["before"]["top"]) <= 1


@pytest.mark.frontend
def test_live2d_bubble_prefers_core_normalized_geometry_info(mock_page: Page, running_server: str):
    """Regression test that bubble layout consumes normalized Live2D geometry from the core manager when available."""
    mock_page.goto(f"{running_server}/", wait_until="domcontentloaded")
    mock_page.wait_for_function(
        "() => !!(window.appState && window.avatarReactionBubble)",
        timeout=10000,
    )

    metrics = mock_page.evaluate(
        """
        () => new Promise((resolve) => {
            const live2dContainer = document.getElementById('live2d-container');
            const vrmContainer = document.getElementById('vrm-container');
            const mmdContainer = document.getElementById('mmd-container');
            const bubble = document.getElementById('avatar-reaction-bubble');

            live2dContainer.style.display = 'block';
            live2dContainer.style.visibility = 'visible';
            vrmContainer.style.display = 'none';
            mmdContainer.style.display = 'none';

            const bounds = {
                left: 2169.1,
                top: 962.2,
                right: 2770.5,
                bottom: 1812.6,
                width: 601.4,
                height: 850.5,
                centerX: 2469.8,
                centerY: 1387.4
            };
            const rawHeadRect = {
                left: 2369.9,
                top: 1087.5,
                right: 2628.7,
                bottom: 1338.9,
                width: 258.8,
                height: 251.4,
                centerX: 2499.3,
                centerY: 1213.2
            };
            const normalizedHeadRect = {
                left: 2435.0,
                top: 1086.0,
                right: 2563.0,
                bottom: 1234.0,
                width: 128.0,
                height: 148.0,
                centerX: 2499.0,
                centerY: 1160.0
            };
            const bodyRect = {
                left: 2275.8,
                top: 1128.6,
                right: 2702.6,
                bottom: 1713.0,
                width: 426.8,
                height: 584.4,
                centerX: 2489.2,
                centerY: 1420.8
            };

            window.avatarReactionBubbleEnabled = true;
            window.vrmManager = null;
            window.mmdManager = null;
            window.live2dManager = {
                getModelScreenBounds() {
                    return bounds;
                },
                getHeadScreenAnchor() {
                    return {
                        x: rawHeadRect.centerX,
                        y: rawHeadRect.top + rawHeadRect.height * 0.42
                    };
                },
                getHeadScreenRectInfo() {
                    return {
                        rect: rawHeadRect,
                        mode: 'face',
                        source: 'drawableHeuristic'
                    };
                },
                getBodyScreenRectInfo() {
                    return {
                        rect: bodyRect,
                        mode: 'body',
                        source: 'drawableHeuristic'
                    };
                },
                getBubbleAnchorGeometryInfo() {
                    return {
                        bounds,
                        rawHeadAnchor: {
                            x: rawHeadRect.centerX,
                            y: rawHeadRect.top + rawHeadRect.height * 0.42
                        },
                        headAnchor: {
                            x: normalizedHeadRect.centerX,
                            y: normalizedHeadRect.top + normalizedHeadRect.height * 0.42
                        },
                        headRect: normalizedHeadRect,
                        headMode: 'face',
                        headSource: 'drawableHeuristic',
                        bodyRect,
                        bodySource: 'drawableHeuristic',
                        reliableHeadRect: true,
                        preciseDisplayInfoRect: false,
                        coarseHitAreaHeadRect: false
                    };
                },
                getBubbleAnchorDebugInfo() {
                    return null;
                }
            };

            window.dispatchEvent(new CustomEvent('neko-assistant-turn-start', {
                detail: { turnId: 'turn-live2d-core-geometry-info', timestamp: Date.now() }
            }));

            setTimeout(() => {
                const state = window.avatarReactionBubble.getState();
                resolve({
                    top: parseFloat(bubble.style.top || '0'),
                    width: parseFloat(getComputedStyle(bubble).getPropertyValue('--bubble-width') || '0'),
                    snapshotHeadWidth: state.lastDebugSnapshot?.headRect?.width || null,
                    normalizedHeadAnchorX: state.lastLive2dHeadAnchor?.x || null,
                    rawHeadWidth: rawHeadRect.width,
                    normalizedHeadWidth: normalizedHeadRect.width,
                    normalizedAnchorX: normalizedHeadRect.centerX,
                    normalizedHeadTop: normalizedHeadRect.top
                });
            }, 700);
        })
        """
    )

    assert metrics["snapshotHeadWidth"] == metrics["normalizedHeadWidth"]
    assert metrics["normalizedHeadAnchorX"] == metrics["normalizedAnchorX"]
    assert metrics["snapshotHeadWidth"] < metrics["rawHeadWidth"]
    assert metrics["width"] < 340
    assert metrics["top"] < metrics["normalizedHeadTop"]


@pytest.mark.frontend
def test_live2d_drawable_head_inference_rejects_wide_shallow_body_like_band(mock_page: Page, running_server: str):
    """Regression test for workshop models whose upper-body decorations form a wide shallow band."""
    mock_page.goto(f"{running_server}/", wait_until="domcontentloaded")
    mock_page.wait_for_function(
        "() => !!(window.live2dManager && window.live2dManager._inferDrawableRegionScreenRectInfo)",
        timeout=10000,
    )

    selected = mock_page.evaluate(
        """
        () => {
            const manager = window.live2dManager;
            const originalGetRenderableDrawableScreenRects = manager._getRenderableDrawableScreenRects.bind(manager);

            const bounds = {
                left: 860,
                top: 320,
                right: 1140,
                bottom: 1100,
                width: 280,
                height: 780,
                centerX: 1000,
                centerY: 710
            };
            const wideBand = {
                left: 906,
                top: 566,
                right: 1088,
                bottom: 636,
                width: 182,
                height: 70,
                centerX: 997,
                centerY: 601
            };
            const compactHead = {
                left: 972,
                top: 454,
                right: 1060,
                bottom: 582,
                width: 88,
                height: 128,
                centerX: 1016,
                centerY: 518
            };
            const bodyRectHint = {
                left: 928,
                top: 546,
                right: 1084,
                bottom: 946,
                width: 156,
                height: 400,
                centerX: 1006,
                centerY: 746
            };

            try {
                manager._getRenderableDrawableScreenRects = () => [wideBand, compactHead];
                const selectedInfo = manager._inferDrawableRegionScreenRectInfo(
                    'head',
                    bounds,
                    { x: 0, y: 0, width: 280, height: 780 },
                    bodyRectHint
                );
                return {
                    source: selectedInfo?.source || null,
                    left: selectedInfo?.rect?.left || null,
                    top: selectedInfo?.rect?.top || null,
                    width: selectedInfo?.rect?.width || null,
                    height: selectedInfo?.rect?.height || null
                };
            } finally {
                manager._getRenderableDrawableScreenRects = originalGetRenderableDrawableScreenRects;
            }
        }
        """
    )

    assert selected["source"] == "drawableHeuristic"
    assert selected["left"] == 972
    assert selected["top"] == 454
    assert selected["width"] == 88
    assert selected["height"] == 128


@pytest.mark.frontend
def test_live2d_drawable_head_inference_uses_touch_hint_for_trimmed_wide_band(mock_page: Page, running_server: str):
    """Regression test for workshop models whose tiny touch hotspot still indicates which side the head is on."""
    mock_page.goto(f"{running_server}/", wait_until="domcontentloaded")
    mock_page.wait_for_function(
        "() => !!(window.live2dManager && window.live2dManager._inferDrawableRegionScreenRectInfo)",
        timeout=10000,
    )

    selected = mock_page.evaluate(
        """
        () => {
            const manager = window.live2dManager;
            const originalGetRenderableDrawableScreenRects = manager._getRenderableDrawableScreenRects.bind(manager);

            const bounds = {
                left: 880,
                top: 320,
                right: 1748,
                bottom: 1092,
                width: 868,
                height: 772,
                centerX: 1314,
                centerY: 706
            };
            const tallUpperCluster = {
                left: 1100,
                top: 438,
                right: 1600,
                bottom: 760,
                width: 500,
                height: 322,
                centerX: 1350,
                centerY: 599
            };
            const bodyRectHint = {
                left: 1116,
                top: 398,
                right: 1627,
                bottom: 988,
                width: 511,
                height: 590,
                centerX: 1372,
                centerY: 693
            };
            const headRectHint = {
                left: 1246,
                top: 688,
                right: 1270,
                bottom: 710,
                width: 24,
                height: 22,
                centerX: 1258,
                centerY: 699
            };

            try {
                manager._getRenderableDrawableScreenRects = () => [tallUpperCluster];
                const selectedInfo = manager._inferDrawableRegionScreenRectInfo(
                    'head',
                    bounds,
                    { x: 0, y: 0, width: 868, height: 772 },
                    bodyRectHint,
                    headRectHint
                );
                return {
                    source: selectedInfo?.source || null,
                    left: selectedInfo?.rect?.left || null,
                    top: selectedInfo?.rect?.top || null,
                    width: selectedInfo?.rect?.width || null,
                    height: selectedInfo?.rect?.height || null,
                    centerX: selectedInfo?.rect?.centerX || null
                };
            } finally {
                manager._getRenderableDrawableScreenRects = originalGetRenderableDrawableScreenRects;
            }
        }
        """
    )

    assert selected["source"] == "drawableHeuristic"
    assert selected["width"] < 220
    assert selected["height"] >= 120
    assert selected["centerX"] < 1360
    assert selected["centerX"] > 1210
    assert selected["top"] <= 466


@pytest.mark.frontend
def test_live2d_drawable_head_inference_expands_tiny_fragment_toward_touch_hint(mock_page: Page, running_server: str):
    """Regression test for models whose top-scoring head drawable is only a tiny ornament above the actual head."""
    mock_page.goto(f"{running_server}/", wait_until="domcontentloaded")
    mock_page.wait_for_function(
        "() => !!(window.live2dManager && window.live2dManager._inferDrawableRegionScreenRectInfo)",
        timeout=10000,
    )

    selected = mock_page.evaluate(
        """
        () => {
            const manager = window.live2dManager;
            const originalGetRenderableDrawableScreenRects = manager._getRenderableDrawableScreenRects.bind(manager);

            const bounds = {
                left: 1668.6,
                top: 571.4,
                right: 3040,
                bottom: 1942.9,
                width: 1371.4,
                height: 1371.5,
                centerX: 2354.3,
                centerY: 1257.2
            };
            const tinyRoofFragment = {
                left: 2339.0,
                top: 795.1,
                right: 2394.4,
                bottom: 850.5,
                width: 55.4,
                height: 55.4,
                centerX: 2366.7,
                centerY: 822.8
            };
            const bodyRectHint = {
                left: 2122.2,
                top: 967.7,
                right: 3091.3,
                bottom: 1842.1,
                width: 969.1,
                height: 874.4,
                centerX: 2606.7,
                centerY: 1404.9
            };
            const headRectHint = {
                left: 2373.7,
                top: 1249.6,
                right: 2383.0,
                bottom: 1261.2,
                width: 9.3,
                height: 11.6,
                centerX: 2378.3,
                centerY: 1255.4
            };

            try {
                manager._getRenderableDrawableScreenRects = () => [tinyRoofFragment];
                const selectedInfo = manager._inferDrawableRegionScreenRectInfo(
                    'head',
                    bounds,
                    { x: 0, y: 0, width: 1371.4, height: 1371.5 },
                    bodyRectHint,
                    headRectHint
                );
                return {
                    source: selectedInfo?.source || null,
                    left: selectedInfo?.rect?.left || null,
                    top: selectedInfo?.rect?.top || null,
                    right: selectedInfo?.rect?.right || null,
                    bottom: selectedInfo?.rect?.bottom || null,
                    width: selectedInfo?.rect?.width || null,
                    height: selectedInfo?.rect?.height || null,
                    centerX: selectedInfo?.rect?.centerX || null
                };
            } finally {
                manager._getRenderableDrawableScreenRects = originalGetRenderableDrawableScreenRects;
            }
        }
        """
    )

    assert selected["source"] == "drawableHeuristic"
    assert selected["width"] >= 140
    assert selected["height"] >= 140
    assert 2300 < selected["centerX"] < 2450
    assert 1050 < selected["top"] < 1200
    assert selected["bottom"] > 1255


@pytest.mark.frontend
def test_live2d_drawable_head_inference_normalizes_wide_body_slice(mock_page: Page, running_server: str):
    """Regression test for wide workshop models whose inferred head swallows the upper body band/background."""
    mock_page.goto(f"{running_server}/", wait_until="domcontentloaded")
    mock_page.wait_for_function(
        "() => !!(window.live2dManager && window.live2dManager._inferDrawableRegionScreenRectInfo)",
        timeout=10000,
    )

    selected = mock_page.evaluate(
        """
        () => {
            const manager = window.live2dManager;
            const originalGetRenderableDrawableScreenRects = manager._getRenderableDrawableScreenRects.bind(manager);

            const bounds = {
                left: 2203.6,
                top: 1332.9,
                right: 2555.0,
                bottom: 1595.0,
                width: 351.4,
                height: 262.1,
                centerX: 2379.3,
                centerY: 1463.9
            };
            const wideUpperSlice = {
                left: 2287.9,
                top: 1338.5,
                right: 2505.4,
                bottom: 1442.1,
                width: 217.5,
                height: 103.6,
                centerX: 2396.7,
                centerY: 1390.3
            };
            const bodyRectHint = {
                left: 2257.2,
                top: 1368.0,
                right: 2533.3,
                bottom: 1573.7,
                width: 276.1,
                height: 205.7,
                centerX: 2395.3,
                centerY: 1470.9
            };

            try {
                manager._getRenderableDrawableScreenRects = () => [wideUpperSlice];
                const selectedInfo = manager._inferDrawableRegionScreenRectInfo(
                    'head',
                    bounds,
                    { x: 0, y: 0, width: 351.4, height: 262.1 },
                    bodyRectHint
                );
                return {
                    source: selectedInfo?.source || null,
                    top: selectedInfo?.rect?.top || null,
                    bottom: selectedInfo?.rect?.bottom || null,
                    width: selectedInfo?.rect?.width || null,
                    height: selectedInfo?.rect?.height || null,
                    centerX: selectedInfo?.rect?.centerX || null
                };
            } finally {
                manager._getRenderableDrawableScreenRects = originalGetRenderableDrawableScreenRects;
            }
        }
        """
    )

    assert selected["source"] == "drawableHeuristic"
    assert selected["width"] < 130
    assert selected["height"] <= 90
    assert selected["top"] <= 1344
    assert selected["bottom"] < 1428
    assert 2350 < selected["centerX"] < 2445


@pytest.mark.frontend
def test_live2d_drawable_head_inference_normalizes_tall_upper_body_slice(mock_page: Page, running_server: str):
    """Regression test for portraits whose inferred head extends from the chest up to the face."""
    mock_page.goto(f"{running_server}/", wait_until="domcontentloaded")
    mock_page.wait_for_function(
        "() => !!(window.live2dManager && window.live2dManager._inferDrawableRegionScreenRectInfo)",
        timeout=10000,
    )

    selected = mock_page.evaluate(
        """
        () => {
            const manager = window.live2dManager;
            const originalGetRenderableDrawableScreenRects = manager._getRenderableDrawableScreenRects.bind(manager);

            const bounds = {
                left: 2169.1,
                top: 962.2,
                right: 2770.5,
                bottom: 1812.6,
                width: 601.4,
                height: 850.5,
                centerX: 2469.8,
                centerY: 1387.4
            };
            const tallUpperSlice = {
                left: 2369.9,
                top: 1087.5,
                right: 2628.7,
                bottom: 1338.9,
                width: 258.8,
                height: 251.4,
                centerX: 2499.3,
                centerY: 1213.2
            };
            const bodyRectHint = {
                left: 2275.8,
                top: 1128.6,
                right: 2702.6,
                bottom: 1713.0,
                width: 426.8,
                height: 584.4,
                centerX: 2489.2,
                centerY: 1420.8
            };

            try {
                manager._getRenderableDrawableScreenRects = () => [tallUpperSlice];
                const selectedInfo = manager._inferDrawableRegionScreenRectInfo(
                    'head',
                    bounds,
                    { x: 0, y: 0, width: 601.4, height: 850.5 },
                    bodyRectHint
                );
                return {
                    source: selectedInfo?.source || null,
                    top: selectedInfo?.rect?.top || null,
                    bottom: selectedInfo?.rect?.bottom || null,
                    width: selectedInfo?.rect?.width || null,
                    height: selectedInfo?.rect?.height || null,
                    centerX: selectedInfo?.rect?.centerX || null
                };
            } finally {
                manager._getRenderableDrawableScreenRects = originalGetRenderableDrawableScreenRects;
            }
        }
        """
    )

    assert selected["source"] == "drawableHeuristic"
    assert 100 < selected["width"] < 170
    assert 120 < selected["height"] < 180
    assert selected["top"] <= 1096
    assert selected["bottom"] < 1300
    assert 2440 < selected["centerX"] < 2560


@pytest.mark.frontend
def test_live2d_bubble_geometry_re_normalizes_wide_drawable_head_rect(mock_page: Page, running_server: str):
    """Bubble geometry should tighten drawable-based wide head bands before layout consumes them."""
    mock_page.goto(f"{running_server}/", wait_until="domcontentloaded")
    mock_page.wait_for_function(
        "() => !!(window.live2dManager && window.live2dManager.getBubbleAnchorGeometryInfo)",
        timeout=10000,
    )

    selected = mock_page.evaluate(
        """
        () => {
            const manager = window.live2dManager;
            const originalGetModelScreenBounds = manager.getModelScreenBounds.bind(manager);
            const originalGetHeadScreenRectInfo = manager.getHeadScreenRectInfo.bind(manager);
            const originalGetBodyScreenRectInfo = manager.getBodyScreenRectInfo.bind(manager);
            const originalGetHeadScreenAnchor = manager.getHeadScreenAnchor.bind(manager);

            const bounds = {
                left: 2203.6,
                top: 1332.9,
                right: 2555.0,
                bottom: 1595.0,
                width: 351.4,
                height: 262.1,
                centerX: 2379.3,
                centerY: 1463.9
            };
            const wideUpperSlice = {
                left: 2287.9,
                top: 1338.5,
                right: 2505.4,
                bottom: 1442.1,
                width: 217.5,
                height: 103.6,
                centerX: 2396.7,
                centerY: 1390.3
            };
            const bodyRect = {
                left: 2257.2,
                top: 1368.0,
                right: 2533.3,
                bottom: 1573.7,
                width: 276.1,
                height: 205.7,
                centerX: 2395.3,
                centerY: 1470.9
            };

            try {
                manager.getModelScreenBounds = () => bounds;
                manager.getHeadScreenRectInfo = () => ({
                    rect: wideUpperSlice,
                    mode: 'face',
                    source: 'drawableHeuristic'
                });
                manager.getBodyScreenRectInfo = () => ({
                    rect: bodyRect,
                    mode: 'body',
                    source: 'drawableHeuristic'
                });
                manager.getHeadScreenAnchor = () => ({
                    x: wideUpperSlice.centerX,
                    y: wideUpperSlice.top + wideUpperSlice.height * 0.42
                });

                const geometryInfo = manager.getBubbleAnchorGeometryInfo();
                return {
                    width: geometryInfo?.headRect?.width || null,
                    height: geometryInfo?.headRect?.height || null,
                    top: geometryInfo?.headRect?.top || null,
                    bottom: geometryInfo?.headRect?.bottom || null,
                    centerX: geometryInfo?.headRect?.centerX || null,
                    anchorX: geometryInfo?.headAnchor?.x || null,
                    reliable: geometryInfo?.reliableHeadRect === true
                };
            } finally {
                manager.getModelScreenBounds = originalGetModelScreenBounds;
                manager.getHeadScreenRectInfo = originalGetHeadScreenRectInfo;
                manager.getBodyScreenRectInfo = originalGetBodyScreenRectInfo;
                manager.getHeadScreenAnchor = originalGetHeadScreenAnchor;
            }
        }
        """
    )

    assert selected["reliable"] is True
    assert selected["width"] < 130
    assert selected["height"] <= 90
    assert selected["top"] <= 1344
    assert selected["bottom"] < 1428
    assert 2350 < selected["centerX"] < 2445
    assert selected["anchorX"] == pytest.approx(selected["centerX"], abs=0.5)


@pytest.mark.frontend
def test_live2d_bubble_geometry_re_normalizes_tall_drawable_head_rect(mock_page: Page, running_server: str):
    """Bubble geometry should crop drawable-based chest-to-head slices down to a head-sized region."""
    mock_page.goto(f"{running_server}/", wait_until="domcontentloaded")
    mock_page.wait_for_function(
        "() => !!(window.live2dManager && window.live2dManager.getBubbleAnchorGeometryInfo)",
        timeout=10000,
    )

    selected = mock_page.evaluate(
        """
        () => {
            const manager = window.live2dManager;
            const originalGetModelScreenBounds = manager.getModelScreenBounds.bind(manager);
            const originalGetHeadScreenRectInfo = manager.getHeadScreenRectInfo.bind(manager);
            const originalGetBodyScreenRectInfo = manager.getBodyScreenRectInfo.bind(manager);
            const originalGetHeadScreenAnchor = manager.getHeadScreenAnchor.bind(manager);

            const bounds = {
                left: 2169.1,
                top: 962.2,
                right: 2770.5,
                bottom: 1812.6,
                width: 601.4,
                height: 850.5,
                centerX: 2469.8,
                centerY: 1387.4
            };
            const tallUpperSlice = {
                left: 2369.9,
                top: 1087.5,
                right: 2628.7,
                bottom: 1338.9,
                width: 258.8,
                height: 251.4,
                centerX: 2499.3,
                centerY: 1213.2
            };
            const bodyRect = {
                left: 2275.8,
                top: 1128.6,
                right: 2702.6,
                bottom: 1713.0,
                width: 426.8,
                height: 584.4,
                centerX: 2489.2,
                centerY: 1420.8
            };

            try {
                manager.getModelScreenBounds = () => bounds;
                manager.getHeadScreenRectInfo = () => ({
                    rect: tallUpperSlice,
                    mode: 'face',
                    source: 'drawableHeuristic'
                });
                manager.getBodyScreenRectInfo = () => ({
                    rect: bodyRect,
                    mode: 'body',
                    source: 'drawableHeuristic'
                });
                manager.getHeadScreenAnchor = () => ({
                    x: tallUpperSlice.centerX,
                    y: tallUpperSlice.top + tallUpperSlice.height * 0.42
                });

                const geometryInfo = manager.getBubbleAnchorGeometryInfo();
                return {
                    width: geometryInfo?.headRect?.width || null,
                    height: geometryInfo?.headRect?.height || null,
                    top: geometryInfo?.headRect?.top || null,
                    bottom: geometryInfo?.headRect?.bottom || null,
                    centerX: geometryInfo?.headRect?.centerX || null,
                    anchorX: geometryInfo?.headAnchor?.x || null,
                    reliable: geometryInfo?.reliableHeadRect === true
                };
            } finally {
                manager.getModelScreenBounds = originalGetModelScreenBounds;
                manager.getHeadScreenRectInfo = originalGetHeadScreenRectInfo;
                manager.getBodyScreenRectInfo = originalGetBodyScreenRectInfo;
                manager.getHeadScreenAnchor = originalGetHeadScreenAnchor;
            }
        }
        """
    )

    assert selected["reliable"] is True
    assert 100 < selected["width"] < 170
    assert 120 < selected["height"] < 180
    assert selected["top"] <= 1096
    assert selected["bottom"] < 1300
    assert 2440 < selected["centerX"] < 2560
    assert selected["anchorX"] == pytest.approx(selected["centerX"], abs=0.5)


@pytest.mark.frontend
def test_live2d_bubble_geometry_replaces_tiny_body_rect_with_proxy(mock_page: Page, running_server: str):
    """A tiny body rect should not invalidate an otherwise good head rect for bubble layout."""
    mock_page.goto(f"{running_server}/", wait_until="domcontentloaded")
    mock_page.wait_for_function(
        "() => !!(window.live2dManager && window.live2dManager.getBubbleAnchorGeometryInfo)",
        timeout=10000,
    )

    selected = mock_page.evaluate(
        """
        () => {
            const manager = window.live2dManager;
            const originalGetModelScreenBounds = manager.getModelScreenBounds.bind(manager);
            const originalGetHeadScreenRectInfo = manager.getHeadScreenRectInfo.bind(manager);
            const originalGetBodyScreenRectInfo = manager.getBodyScreenRectInfo.bind(manager);
            const originalGetHeadScreenAnchor = manager.getHeadScreenAnchor.bind(manager);

            const bounds = {
                left: 2002.9,
                top: 700.0,
                right: 2860.0,
                bottom: 1900.0,
                width: 857.1,
                height: 1200.0,
                centerX: 2431.4,
                centerY: 1300.0
            };
            const headRect = {
                left: 2355.6,
                top: 809.7,
                right: 2509.4,
                bottom: 964.2,
                width: 153.8,
                height: 154.5,
                centerX: 2432.5,
                centerY: 886.9
            };
            const tinyBodyRect = {
                left: 2382.0,
                top: 1027.2,
                right: 2495.2,
                bottom: 1096.4,
                width: 113.2,
                height: 69.2,
                centerX: 2438.6,
                centerY: 1061.8
            };

            try {
                manager.getModelScreenBounds = () => bounds;
                manager.getHeadScreenRectInfo = () => ({
                    rect: headRect,
                    mode: 'face',
                    source: 'displayInfo'
                });
                manager.getBodyScreenRectInfo = () => ({
                    rect: tinyBodyRect,
                    mode: 'body',
                    source: 'displayInfo'
                });
                manager.getHeadScreenAnchor = () => ({
                    x: headRect.centerX,
                    y: headRect.top + headRect.height * 0.36
                });

                const geometryInfo = manager.getBubbleAnchorGeometryInfo();
                return {
                    reliable: geometryInfo?.reliableHeadRect === true,
                    bodySource: geometryInfo?.bodySource || null,
                    bodyWidth: geometryInfo?.bodyRect?.width || null,
                    bodyHeight: geometryInfo?.bodyRect?.height || null,
                    bodyTop: geometryInfo?.bodyRect?.top || null,
                    headBottom: geometryInfo?.headRect?.bottom || null
                };
            } finally {
                manager.getModelScreenBounds = originalGetModelScreenBounds;
                manager.getHeadScreenRectInfo = originalGetHeadScreenRectInfo;
                manager.getBodyScreenRectInfo = originalGetBodyScreenRectInfo;
                manager.getHeadScreenAnchor = originalGetHeadScreenAnchor;
            }
        }
        """
    )

    assert selected["reliable"] is True
    assert selected["bodySource"] == "bubbleBodyProxy"
    assert selected["bodyWidth"] > 140
    assert selected["bodyHeight"] > 180
    assert selected["bodyTop"] <= selected["headBottom"] + 4


@pytest.mark.frontend
def test_live2d_bubble_geometry_replaces_huge_offset_body_rect_with_proxy(mock_page: Page, running_server: str):
    """A huge off-center body rect should not stretch layout when the head rect is already reliable."""
    mock_page.goto(f"{running_server}/", wait_until="domcontentloaded")
    mock_page.wait_for_function(
        "() => !!(window.live2dManager && window.live2dManager.getBubbleAnchorGeometryInfo)",
        timeout=10000,
    )

    selected = mock_page.evaluate(
        """
        () => {
            const manager = window.live2dManager;
            const originalGetModelScreenBounds = manager.getModelScreenBounds.bind(manager);
            const originalGetHeadScreenRectInfo = manager.getHeadScreenRectInfo.bind(manager);
            const originalGetBodyScreenRectInfo = manager.getBodyScreenRectInfo.bind(manager);
            const originalGetHeadScreenAnchor = manager.getHeadScreenAnchor.bind(manager);

            const bounds = {
                left: 2046.8,
                top: 814.4,
                right: 3098.7,
                bottom: 1887.6,
                width: 1051.9,
                height: 1073.2,
                centerX: 2572.7,
                centerY: 1351.0
            };
            const headRect = {
                left: 2296.0,
                top: 1148.4,
                right: 2460.6,
                bottom: 1305.8,
                width: 164.6,
                height: 157.4,
                centerX: 2378.3,
                centerY: 1227.1
            };
            const hugeBodyRect = {
                left: 2122.2,
                top: 967.7,
                right: 3091.3,
                bottom: 1842.1,
                width: 969.2,
                height: 874.5,
                centerX: 2606.7,
                centerY: 1404.9
            };

            try {
                manager.getModelScreenBounds = () => bounds;
                manager.getHeadScreenRectInfo = () => ({
                    rect: headRect,
                    mode: 'face',
                    source: 'drawableHeuristic'
                });
                manager.getBodyScreenRectInfo = () => ({
                    rect: hugeBodyRect,
                    mode: 'body',
                    source: 'drawableHeuristic'
                });
                manager.getHeadScreenAnchor = () => ({
                    x: headRect.centerX,
                    y: headRect.top + headRect.height * 0.42
                });

                const geometryInfo = manager.getBubbleAnchorGeometryInfo();
                return {
                    reliable: geometryInfo?.reliableHeadRect === true,
                    bodySource: geometryInfo?.bodySource || null,
                    bodyWidth: geometryInfo?.bodyRect?.width || null,
                    bodyHeight: geometryInfo?.bodyRect?.height || null,
                    bodyCenterX: geometryInfo?.bodyRect?.centerX || null,
                    headCenterX: geometryInfo?.headRect?.centerX || null,
                    rawBodyWidth: hugeBodyRect.width
                };
            } finally {
                manager.getModelScreenBounds = originalGetModelScreenBounds;
                manager.getHeadScreenRectInfo = originalGetHeadScreenRectInfo;
                manager.getBodyScreenRectInfo = originalGetBodyScreenRectInfo;
                manager.getHeadScreenAnchor = originalGetHeadScreenAnchor;
            }
        }
        """
    )

    assert selected["reliable"] is True
    assert selected["bodySource"] == "bubbleBodyProxy"
    assert selected["bodyWidth"] < selected["rawBodyWidth"] * 0.45
    assert selected["bodyHeight"] < 420
    assert abs(selected["bodyCenterX"] - selected["headCenterX"]) < 8


@pytest.mark.frontend
def test_live2d_bubble_geometry_keeps_slightly_lower_real_head_and_proxies_bad_body(mock_page: Page, running_server: str):
    """A real-world lower head rect should still drive bubble layout when the body slice is clearly wrong."""
    mock_page.goto(f"{running_server}/", wait_until="domcontentloaded")
    mock_page.wait_for_function(
        "() => !!(window.live2dManager && window.live2dManager.getBubbleAnchorGeometryInfo)",
        timeout=10000,
    )

    selected = mock_page.evaluate(
        """
        () => {
            const manager = window.live2dManager;
            const originalGetModelScreenBounds = manager.getModelScreenBounds.bind(manager);
            const originalGetHeadScreenRectInfo = manager.getHeadScreenRectInfo.bind(manager);
            const originalGetBodyScreenRectInfo = manager.getBodyScreenRectInfo.bind(manager);
            const originalGetHeadScreenAnchor = manager.getHeadScreenAnchor.bind(manager);

            const bounds = {
                left: 1042.857142857143,
                top: 357.1428571428572,
                right: 1900.0,
                bottom: 1214.2857142857142,
                width: 857.1428571428571,
                height: 857.142857142857,
                centerX: 1471.4285714285716,
                centerY: 785.7142857142858
            };
            const headRect = {
                left: 1434.62986807982,
                top: 717.8628092869067,
                right: 1537.4870109369626,
                bottom: 801.5508768136161,
                width: 102.85714285714266,
                height: 83.68806752670946,
                centerX: 1486.0584395083913,
                centerY: 759.7068430502613
            };
            const hugeBodyRect = {
                left: 1326.3441685267858,
                top: 604.7981044224331,
                right: 1932.0770438058034,
                bottom: 1151.3335832868304,
                width: 605.7328752790177,
                height: 546.5354788643973,
                centerX: 1629.2106061662946,
                centerY: 878.0658438546318
            };

            try {
                manager.getModelScreenBounds = () => bounds;
                manager.getHeadScreenRectInfo = () => ({
                    rect: headRect,
                    mode: 'face',
                    source: 'drawableHeuristic'
                });
                manager.getBodyScreenRectInfo = () => ({
                    rect: hugeBodyRect,
                    mode: 'body',
                    source: 'drawableHeuristic'
                });
                manager.getHeadScreenAnchor = () => ({
                    x: headRect.centerX,
                    y: headRect.top + headRect.height * 0.42
                });

                const geometryInfo = manager.getBubbleAnchorGeometryInfo();
                return {
                    reliable: geometryInfo?.reliableHeadRect === true,
                    bodySource: geometryInfo?.bodySource || null,
                    bodyWidth: geometryInfo?.bodyRect?.width || null,
                    bodyHeight: geometryInfo?.bodyRect?.height || null,
                    bodyCenterX: geometryInfo?.bodyRect?.centerX || null,
                    headCenterX: geometryInfo?.headRect?.centerX || null,
                    rawBodyWidth: hugeBodyRect.width
                };
            } finally {
                manager.getModelScreenBounds = originalGetModelScreenBounds;
                manager.getHeadScreenRectInfo = originalGetHeadScreenRectInfo;
                manager.getBodyScreenRectInfo = originalGetBodyScreenRectInfo;
                manager.getHeadScreenAnchor = originalGetHeadScreenAnchor;
            }
        }
        """
    )

    assert selected["reliable"] is True
    assert selected["bodySource"] == "bubbleBodyProxy"
    assert selected["bodyWidth"] < selected["rawBodyWidth"] * 0.45
    assert selected["bodyHeight"] < 260
    assert abs(selected["bodyCenterX"] - selected["headCenterX"]) < 8


@pytest.mark.frontend
def test_live2d_body_top_fallback_ignores_blank_space(mock_page: Page, running_server: str):
    """Regression test for Live2D models without usable head data."""
    mock_page.goto(f"{running_server}/", wait_until="domcontentloaded")
    mock_page.wait_for_function(
        "() => !!(window.appState && window.avatarReactionBubble)",
        timeout=10000,
    )

    metrics = mock_page.evaluate(
        """
        () => {
            const live2dContainer = document.getElementById('live2d-container');
            const vrmContainer = document.getElementById('vrm-container');
            const mmdContainer = document.getElementById('mmd-container');
            const bubble = document.getElementById('avatar-reaction-bubble');

            live2dContainer.style.display = 'block';
            live2dContainer.style.visibility = 'visible';
            vrmContainer.style.display = 'none';
            mmdContainer.style.display = 'none';

            const bounds = {
                left: 96,
                top: -280,
                right: 416,
                bottom: 1120,
                width: 320,
                height: 1400,
                centerX: 256,
                centerY: 420
            };
            const bodyRect = {
                left: 162,
                top: 320,
                right: 350,
                bottom: 676,
                width: 188,
                height: 356,
                centerX: 256,
                centerY: 498
            };

            window.vrmManager = null;
            window.mmdManager = null;
            window.live2dManager = {
                getModelScreenBounds() {
                    return bounds;
                },
                getHeadScreenAnchor() {
                    return null;
                },
                getHeadScreenRectInfo() {
                    return null;
                },
                getBodyScreenRectInfo() {
                    return {
                        rect: bodyRect,
                        mode: 'body'
                    };
                }
            };

            window.dispatchEvent(new CustomEvent('neko-assistant-turn-start', {
                detail: { turnId: 'turn-live2d-body-top', timestamp: Date.now() }
            }));

            const top = parseFloat(bubble.style.top || '0');
            const bubbleHeight = parseFloat(getComputedStyle(bubble).getPropertyValue('--bubble-height') || '0');

            return {
                top,
                bubbleHeight,
                bodyTop: bodyRect.top,
                bodyHeight: bodyRect.height
            };
        }
        """
    )

    expect(mock_page.locator("#avatar-reaction-bubble")).to_have_attribute("aria-hidden", "false")
    assert metrics["bubbleHeight"] > 0
    assert metrics["top"] <= metrics["bodyTop"] - metrics["bodyHeight"] * 0.25
    assert metrics["top"] >= metrics["bodyTop"] - metrics["bodyHeight"] * 0.8


@pytest.mark.frontend
def test_live2d_display_info_eye_parts_expand_into_face_rect_for_bubble_geometry(mock_page: Page, running_server: str):
    """Models with only eye parts in DisplayInfo should still produce a face/head rect instead of falling back to ornaments."""
    mock_page.goto(f"{running_server}/", wait_until="domcontentloaded")
    mock_page.wait_for_function(
        "() => !!(window.live2dManager && window.live2dManager.getBubbleAnchorGeometryInfo)",
        timeout=10000,
    )

    selected = mock_page.evaluate(
        """
        () => {
            const manager = window.live2dManager;
            const originalGetModelScreenBounds = manager.getModelScreenBounds.bind(manager);
            const originalGetBodyScreenRectInfo = manager.getBodyScreenRectInfo.bind(manager);
            const originalGetHeadScreenAnchor = manager.getHeadScreenAnchor.bind(manager);
            const originalCollectDisplayInfoPartScreenRectInfo = manager._collectDisplayInfoPartScreenRectInfo.bind(manager);
            const originalGetHeadHitAreaScreenRectInfo = manager._getHeadHitAreaScreenRectInfo.bind(manager);
            const originalInferDrawableRegionScreenRectInfo = manager._inferDrawableRegionScreenRectInfo.bind(manager);
            const originalDisplayInfo = manager._displayInfo;

            const bounds = {
                left: 546.1,
                top: 379.8,
                right: 868.3,
                bottom: 702.1,
                width: 322.2,
                height: 322.3,
                centerX: 707.2,
                centerY: 541.0
            };
            const eyeRect = {
                left: 713.4,
                top: 490.8,
                right: 776.3,
                bottom: 522.7,
                width: 62.9,
                height: 31.9,
                centerX: 744.9,
                centerY: 506.8
            };
            const ornamentHitArea = {
                left: 706.2,
                top: 454.9,
                right: 782.2,
                bottom: 518.9,
                width: 76.0,
                height: 64.0,
                centerX: 744.2,
                centerY: 486.9
            };

            try {
                manager.getModelScreenBounds = () => bounds;
                manager.getBodyScreenRectInfo = () => null;
                manager.getHeadScreenAnchor = () => ({
                    x: eyeRect.centerX,
                    y: eyeRect.top + eyeRect.height * 0.36
                });
                manager._displayInfo = {
                    Parts: [
                        { Id: 'eye-right', Name: '右眼' },
                        { Id: 'eye-left', Name: '左眼' }
                    ]
                };
                manager._collectDisplayInfoPartScreenRectInfo = (targetPartIds, mode) => {
                    if (Array.isArray(targetPartIds) &&
                        targetPartIds.includes('eye-right') &&
                        targetPartIds.includes('eye-left')) {
                        return {
                            rect: eyeRect,
                            mode: mode || 'face',
                            source: 'displayInfo'
                        };
                    }
                    return null;
                };
                manager._getHeadHitAreaScreenRectInfo = () => ({
                    rect: ornamentHitArea,
                    mode: 'face',
                    source: 'hitArea',
                    hitAreaId: 'ornament',
                    hitAreaName: '左头饰',
                    autoNamed: false
                });
                manager._inferDrawableRegionScreenRectInfo = () => null;

                const headInfo = manager.getHeadScreenRectInfo();
                const geometryInfo = manager.getBubbleAnchorGeometryInfo();
                return {
                    source: headInfo?.source || null,
                    mode: headInfo?.mode || null,
                    left: headInfo?.rect?.left || null,
                    top: headInfo?.rect?.top || null,
                    bottom: headInfo?.rect?.bottom || null,
                    width: headInfo?.rect?.width || null,
                    height: headInfo?.rect?.height || null,
                    centerX: headInfo?.rect?.centerX || null,
                    reliable: geometryInfo?.reliableHeadRect === true,
                    bodySource: geometryInfo?.bodySource || null
                };
            } finally {
                manager.getModelScreenBounds = originalGetModelScreenBounds;
                manager.getBodyScreenRectInfo = originalGetBodyScreenRectInfo;
                manager.getHeadScreenAnchor = originalGetHeadScreenAnchor;
                manager._collectDisplayInfoPartScreenRectInfo = originalCollectDisplayInfoPartScreenRectInfo;
                manager._getHeadHitAreaScreenRectInfo = originalGetHeadHitAreaScreenRectInfo;
                manager._inferDrawableRegionScreenRectInfo = originalInferDrawableRegionScreenRectInfo;
                manager._displayInfo = originalDisplayInfo;
            }
        }
        """
    )

    assert selected["source"] == "displayInfo"
    assert selected["mode"] == "face"
    assert 110 < selected["width"] < 180
    assert 100 < selected["height"] < 150
    assert selected["top"] < 455
    assert selected["bottom"] > 545
    assert selected["centerX"] == pytest.approx(744.9, abs=1.5)
    assert selected["reliable"] is True
    assert selected["bodySource"] == "bubbleBodyProxy"


@pytest.mark.frontend
def test_live2d_display_info_rect_uses_relaxed_head_reliability(mock_page: Page, running_server: str):
    """Regression test for stylized DisplayInfo head rects that are valid but taller than HitArea heuristics."""
    mock_page.goto(f"{running_server}/", wait_until="domcontentloaded")
    mock_page.wait_for_function(
        "() => !!(window.appState && window.avatarReactionBubble)",
        timeout=10000,
    )

    metrics = mock_page.evaluate(
        """
        () => {
            const live2dContainer = document.getElementById('live2d-container');
            const vrmContainer = document.getElementById('vrm-container');
            const mmdContainer = document.getElementById('mmd-container');
            const bubble = document.getElementById('avatar-reaction-bubble');

            live2dContainer.style.display = 'block';
            live2dContainer.style.visibility = 'visible';
            vrmContainer.style.display = 'none';
            mmdContainer.style.display = 'none';

            const bounds = {
                left: 96,
                top: -280,
                right: 416,
                bottom: 1120,
                width: 320,
                height: 1400,
                centerX: 256,
                centerY: 420
            };
            const headRect = {
                left: 190,
                top: 220,
                right: 322,
                bottom: 430,
                width: 132,
                height: 210,
                centerX: 256,
                centerY: 325
            };
            const bodyRect = {
                left: 154,
                top: 352,
                right: 358,
                bottom: 552,
                width: 204,
                height: 200,
                centerX: 256,
                centerY: 452
            };

            window.vrmManager = null;
            window.mmdManager = null;
            window.NEKO_DEBUG_BUBBLE_POSITION = false;
            window.NEKO_DEBUG_BUBBLE_LIFECYCLE = false;
            window.live2dManager = {
                getModelScreenBounds() {
                    return bounds;
                },
                getHeadScreenAnchor() {
                    return {
                        x: headRect.centerX,
                        y: headRect.top + headRect.height * 0.32
                    };
                },
                getHeadScreenRectInfo() {
                    return {
                        rect: headRect,
                        mode: 'face',
                        source: 'displayInfo'
                    };
                },
                getBodyScreenRectInfo() {
                    return {
                        rect: bodyRect,
                        mode: 'body',
                        source: 'displayInfo'
                    };
                },
                getBubbleAnchorDebugInfo() {
                    return null;
                }
            };

            window.dispatchEvent(new CustomEvent('neko-assistant-turn-start', {
                detail: { turnId: 'turn-live2d-displayinfo-relaxed', timestamp: Date.now() }
            }));

            const top = parseFloat(bubble.style.top || '0');
            const bubbleHeight = parseFloat(getComputedStyle(bubble).getPropertyValue('--bubble-height') || '0');

            return {
                top,
                bubbleHeight,
                headTop: headRect.top,
                bodyTop: bodyRect.top
            };
        }
        """
    )

    assert metrics["bubbleHeight"] > 0
    assert metrics["top"] <= metrics["headTop"] - metrics["bubbleHeight"] * 0.08 + 2
    assert metrics["top"] >= metrics["headTop"] - metrics["bubbleHeight"] * 0.4 - 2
    assert metrics["top"] < metrics["bodyTop"] - metrics["bubbleHeight"] * 0.35


@pytest.mark.frontend
def test_live2d_display_info_top_offset_does_not_float_too_high(mock_page: Page, running_server: str):
    """Regression test for precise DisplayInfo models whose bubble used to float too high above the head."""
    mock_page.goto(f"{running_server}/", wait_until="domcontentloaded")
    mock_page.wait_for_function(
        "() => !!(window.appState && window.avatarReactionBubble)",
        timeout=10000,
    )

    metrics = mock_page.evaluate(
        """
        () => {
            const live2dContainer = document.getElementById('live2d-container');
            const vrmContainer = document.getElementById('vrm-container');
            const mmdContainer = document.getElementById('mmd-container');
            const bubble = document.getElementById('avatar-reaction-bubble');

            live2dContainer.style.display = 'block';
            live2dContainer.style.visibility = 'visible';
            vrmContainer.style.display = 'none';
            mmdContainer.style.display = 'none';

            const bounds = {
                left: 124,
                top: 64,
                right: 388,
                bottom: 724,
                width: 264,
                height: 660,
                centerX: 256,
                centerY: 394
            };
            const headRect = {
                left: 188,
                top: 158,
                right: 324,
                bottom: 334,
                width: 136,
                height: 176,
                centerX: 256,
                centerY: 246
            };
            const bodyRect = {
                left: 166,
                top: 292,
                right: 346,
                bottom: 586,
                width: 180,
                height: 294,
                centerX: 256,
                centerY: 439
            };

            window.vrmManager = null;
            window.mmdManager = null;
            window.NEKO_DEBUG_BUBBLE_POSITION = false;
            window.NEKO_DEBUG_BUBBLE_LIFECYCLE = false;
            window.live2dManager = {
                getModelScreenBounds() {
                    return bounds;
                },
                getHeadScreenAnchor() {
                    return {
                        x: headRect.centerX,
                        y: headRect.top + headRect.height * 0.36
                    };
                },
                getHeadScreenRectInfo() {
                    return {
                        rect: headRect,
                        mode: 'face',
                        source: 'displayInfo'
                    };
                },
                getBodyScreenRectInfo() {
                    return {
                        rect: bodyRect,
                        mode: 'body',
                        source: 'displayInfo'
                    };
                },
                getBubbleAnchorDebugInfo() {
                    return null;
                }
            };

            window.dispatchEvent(new CustomEvent('neko-assistant-turn-start', {
                detail: { turnId: 'turn-live2d-displayinfo-head-close', timestamp: Date.now() }
            }));

            const top = parseFloat(bubble.style.top || '0');
            const bubbleHeight = parseFloat(getComputedStyle(bubble).getPropertyValue('--bubble-height') || '0');

            return {
                top,
                bubbleHeight,
                headTop: headRect.top
            };
        }
        """
    )

    assert metrics["bubbleHeight"] > 0
    assert metrics["top"] <= metrics["headTop"] - metrics["bubbleHeight"] * 0.08 + 2
    assert metrics["top"] >= metrics["headTop"] - metrics["bubbleHeight"] * 0.32 - 2


@pytest.mark.frontend
def test_live2d_hitarea_head_rect_does_not_force_bubble_too_high(mock_page: Page, running_server: str):
    """Regression test for coarse head hit areas that start far above the visible face."""
    mock_page.goto(f"{running_server}/", wait_until="domcontentloaded")
    mock_page.wait_for_function(
        "() => !!(window.appState && window.avatarReactionBubble)",
        timeout=10000,
    )

    metrics = mock_page.evaluate(
        """
        () => {
            const live2dContainer = document.getElementById('live2d-container');
            const vrmContainer = document.getElementById('vrm-container');
            const mmdContainer = document.getElementById('mmd-container');
            const bubble = document.getElementById('avatar-reaction-bubble');

            live2dContainer.style.display = 'block';
            live2dContainer.style.visibility = 'visible';
            vrmContainer.style.display = 'none';
            mmdContainer.style.display = 'none';

            const bounds = {
                left: 96,
                top: -280,
                right: 416,
                bottom: 1120,
                width: 320,
                height: 1400,
                centerX: 256,
                centerY: 420
            };
            const coarseHeadRect = {
                left: 160,
                top: 60,
                right: 352,
                bottom: 280,
                width: 192,
                height: 220,
                centerX: 256,
                centerY: 170
            };
            const headAnchor = {
                x: 256,
                y: 278
            };

            window.vrmManager = null;
            window.mmdManager = null;
            window.NEKO_DEBUG_BUBBLE_POSITION = false;
            window.NEKO_DEBUG_BUBBLE_LIFECYCLE = false;
            window.live2dManager = {
                getModelScreenBounds() {
                    return bounds;
                },
                getHeadScreenAnchor() {
                    return headAnchor;
                },
                getHeadScreenRectInfo() {
                    return {
                        rect: coarseHeadRect,
                        mode: 'face',
                        source: 'hitArea'
                    };
                },
                getBodyScreenRectInfo() {
                    return null;
                },
                getBubbleAnchorDebugInfo() {
                    return null;
                }
            };

            window.dispatchEvent(new CustomEvent('neko-assistant-turn-start', {
                detail: { turnId: 'turn-live2d-hitarea-not-too-high', timestamp: Date.now() }
            }));

            const top = parseFloat(bubble.style.top || '0');

            return {
                top,
                headTop: coarseHeadRect.top
            };
        }
        """
    )

    assert metrics["top"] >= metrics["headTop"] + 10


@pytest.mark.frontend
def test_live2d_face_rect_keeps_head_driven_bubble_size_when_bounds_change(mock_page: Page, running_server: str):
    """Regression test that a stable face/head rect keeps the bubble size stable even if overall bounds change."""
    mock_page.goto(f"{running_server}/", wait_until="domcontentloaded")
    mock_page.wait_for_function(
        "() => !!(window.appState && window.avatarReactionBubble)",
        timeout=10000,
    )

    metrics = mock_page.evaluate(
        """
        () => {
            const live2dContainer = document.getElementById('live2d-container');
            const vrmContainer = document.getElementById('vrm-container');
            const mmdContainer = document.getElementById('mmd-container');
            const bubble = document.getElementById('avatar-reaction-bubble');

            live2dContainer.style.display = 'block';
            live2dContainer.style.visibility = 'visible';
            vrmContainer.style.display = 'none';
            mmdContainer.style.display = 'none';

            const headRect = {
                left: 190,
                top: 170,
                right: 322,
                bottom: 332,
                width: 132,
                height: 162,
                centerX: 256,
                centerY: 251
            };
            const headAnchor = {
                x: headRect.centerX,
                y: headRect.top + headRect.height * 0.42
            };

            let currentBounds = {
                left: 136,
                top: 96,
                right: 376,
                bottom: 576,
                width: 240,
                height: 480,
                centerX: 256,
                centerY: 336
            };

            window.vrmManager = null;
            window.mmdManager = null;
            window.live2dManager = {
                getModelScreenBounds() {
                    return currentBounds;
                },
                getHeadScreenAnchor() {
                    return headAnchor;
                },
                getHeadScreenRectInfo() {
                    return {
                        rect: headRect,
                        mode: 'face'
                    };
                },
                getBodyScreenRectInfo() {
                    return null;
                }
            };

            window.dispatchEvent(new CustomEvent('neko-assistant-turn-start', {
                detail: { turnId: 'turn-live2d-small-bounds', timestamp: Date.now() }
            }));

            const smallWidth = parseFloat(getComputedStyle(bubble).getPropertyValue('--bubble-width') || '0');
            const smallHeight = parseFloat(getComputedStyle(bubble).getPropertyValue('--bubble-height') || '0');

            window.avatarReactionBubble.forceHide();

            currentBounds = {
                left: 76,
                top: -120,
                right: 436,
                bottom: 700,
                width: 360,
                height: 820,
                centerX: 256,
                centerY: 290
            };

            window.dispatchEvent(new CustomEvent('neko-assistant-turn-start', {
                detail: { turnId: 'turn-live2d-large-bounds', timestamp: Date.now() }
            }));

            const largeWidth = parseFloat(getComputedStyle(bubble).getPropertyValue('--bubble-width') || '0');
            const largeHeight = parseFloat(getComputedStyle(bubble).getPropertyValue('--bubble-height') || '0');

            return {
                smallWidth,
                smallHeight,
                largeWidth,
                largeHeight
            };
        }
        """
    )

    assert metrics["smallWidth"] > 0
    assert metrics["smallHeight"] > 0
    assert abs(metrics["largeWidth"] - metrics["smallWidth"]) <= 1
    assert abs(metrics["largeHeight"] - metrics["smallHeight"]) <= 1


@pytest.mark.frontend
def test_live2d_precise_displayinfo_head_rect_avoids_undersized_bubble(mock_page: Page, running_server: str):
    """Precise displayInfo head rects should not produce obviously undersized bubbles."""
    mock_page.goto(f"{running_server}/", wait_until="domcontentloaded")
    mock_page.wait_for_function(
        "() => !!(window.appState && window.avatarReactionBubble)",
        timeout=10000,
    )

    metrics = mock_page.evaluate(
        """
        () => new Promise((resolve) => {
            const live2dContainer = document.getElementById('live2d-container');
            const vrmContainer = document.getElementById('vrm-container');
            const mmdContainer = document.getElementById('mmd-container');
            const bubble = document.getElementById('avatar-reaction-bubble');

            live2dContainer.style.display = 'block';
            live2dContainer.style.visibility = 'visible';
            vrmContainer.style.display = 'none';
            mmdContainer.style.display = 'none';

            const geometry = {
                bounds: {
                    left: 132,
                    top: 52,
                    right: 404,
                    bottom: 708,
                    width: 272,
                    height: 656,
                    centerX: 268,
                    centerY: 380
                },
                rawHeadAnchor: { x: 266, y: 196 },
                headAnchor: { x: 266, y: 194 },
                headRect: {
                    left: 212,
                    top: 148,
                    right: 320,
                    bottom: 272,
                    width: 108,
                    height: 124,
                    centerX: 266,
                    centerY: 210
                },
                headMode: 'face',
                headSource: 'displayInfo',
                bodyRect: {
                    left: 188,
                    top: 246,
                    right: 346,
                    bottom: 566,
                    width: 158,
                    height: 320,
                    centerX: 267,
                    centerY: 406
                },
                bodySource: 'displayInfo',
                reliableHeadRect: true,
                preciseDisplayInfoRect: true,
                coarseHitAreaHeadRect: false
            };

            window.avatarReactionBubbleEnabled = true;
            window.vrmManager = null;
            window.mmdManager = null;
            window.live2dManager = {
                getModelScreenBounds() {
                    return geometry.bounds;
                },
                getHeadScreenAnchor() {
                    return geometry.headAnchor;
                },
                getHeadScreenRectInfo() {
                    return {
                        rect: geometry.headRect,
                        mode: geometry.headMode,
                        source: geometry.headSource
                    };
                },
                getBodyScreenRectInfo() {
                    return {
                        rect: geometry.bodyRect,
                        mode: 'body',
                        source: geometry.bodySource
                    };
                },
                getBubbleAnchorGeometryInfo() {
                    return geometry;
                },
                getBubbleAnchorDebugInfo() {
                    return null;
                }
            };

            window.dispatchEvent(new CustomEvent('neko-assistant-turn-start', {
                detail: { turnId: 'turn-live2d-displayinfo-small-head', timestamp: Date.now() }
            }));

            setTimeout(() => {
                resolve({
                    width: parseFloat(getComputedStyle(bubble).getPropertyValue('--bubble-width') || '0'),
                    height: parseFloat(getComputedStyle(bubble).getPropertyValue('--bubble-height') || '0')
                });
            }, 700);
        })
        """
    )

    assert metrics["width"] >= 220
    assert metrics["height"] >= 170


@pytest.mark.frontend
def test_live2d_small_head_rect_jitter_does_not_reposition_or_resize_bubble(mock_page: Page, running_server: str):
    """Tiny head-box jitter should not keep resizing or repositioning the bubble."""
    mock_page.goto(f"{running_server}/", wait_until="domcontentloaded")
    mock_page.wait_for_function(
        "() => !!(window.appState && window.avatarReactionBubble)",
        timeout=10000,
    )

    metrics = mock_page.evaluate(
        """
        () => new Promise((resolve) => {
            const live2dContainer = document.getElementById('live2d-container');
            const vrmContainer = document.getElementById('vrm-container');
            const mmdContainer = document.getElementById('mmd-container');
            const bubble = document.getElementById('avatar-reaction-bubble');

            live2dContainer.style.display = 'block';
            live2dContainer.style.visibility = 'visible';
            vrmContainer.style.display = 'none';
            mmdContainer.style.display = 'none';

            const baseGeometry = {
                bounds: {
                    left: 120,
                    top: 70,
                    right: 408,
                    bottom: 730,
                    width: 288,
                    height: 660,
                    centerX: 264,
                    centerY: 400
                },
                rawHeadAnchor: { x: 266, y: 214 },
                headAnchor: { x: 266, y: 212 },
                headRect: {
                    left: 206,
                    top: 164,
                    right: 326,
                    bottom: 304,
                    width: 120,
                    height: 140,
                    centerX: 266,
                    centerY: 234
                },
                headMode: 'face',
                headSource: 'displayInfo',
                bodyRect: {
                    left: 188,
                    top: 278,
                    right: 344,
                    bottom: 588,
                    width: 156,
                    height: 310,
                    centerX: 266,
                    centerY: 433
                },
                bodySource: 'displayInfo',
                reliableHeadRect: true,
                preciseDisplayInfoRect: true,
                coarseHitAreaHeadRect: false
            };
            const jitterGeometry = {
                bounds: {
                    left: 120,
                    top: 70,
                    right: 408,
                    bottom: 730,
                    width: 288,
                    height: 660,
                    centerX: 264,
                    centerY: 400
                },
                rawHeadAnchor: { x: 269, y: 217 },
                headAnchor: { x: 269, y: 215 },
                headRect: {
                    left: 210,
                    top: 168,
                    right: 334,
                    bottom: 312,
                    width: 124,
                    height: 144,
                    centerX: 272,
                    centerY: 240
                },
                headMode: 'face',
                headSource: 'displayInfo',
                bodyRect: {
                    left: 191,
                    top: 282,
                    right: 351,
                    bottom: 594,
                    width: 160,
                    height: 312,
                    centerX: 271,
                    centerY: 438
                },
                bodySource: 'displayInfo',
                reliableHeadRect: true,
                preciseDisplayInfoRect: true,
                coarseHitAreaHeadRect: false
            };

            let useJitterGeometry = false;
            const currentGeometry = () => useJitterGeometry ? jitterGeometry : baseGeometry;
            const measure = () => {
                const snapshot = window.avatarReactionBubble.getState().lastDebugSnapshot || null;
                return {
                    left: parseFloat(bubble.style.left || '0'),
                    top: parseFloat(bubble.style.top || '0'),
                    width: parseFloat(getComputedStyle(bubble).getPropertyValue('--bubble-width') || '0'),
                    height: parseFloat(getComputedStyle(bubble).getPropertyValue('--bubble-height') || '0'),
                    headRect: snapshot ? snapshot.headRect : null
                };
            };

            window.avatarReactionBubbleEnabled = true;
            window.vrmManager = null;
            window.mmdManager = null;
            window.live2dManager = {
                getModelScreenBounds() {
                    return currentGeometry().bounds;
                },
                getHeadScreenAnchor() {
                    return currentGeometry().headAnchor;
                },
                getHeadScreenRectInfo() {
                    return {
                        rect: currentGeometry().headRect,
                        mode: currentGeometry().headMode,
                        source: currentGeometry().headSource
                    };
                },
                getBodyScreenRectInfo() {
                    return {
                        rect: currentGeometry().bodyRect,
                        mode: 'body',
                        source: currentGeometry().bodySource
                    };
                },
                getBubbleAnchorGeometryInfo() {
                    return currentGeometry();
                },
                getBubbleAnchorDebugInfo() {
                    return null;
                }
            };

            window.dispatchEvent(new CustomEvent('neko-assistant-turn-start', {
                detail: { turnId: 'turn-live2d-displayinfo-jitter', timestamp: Date.now() }
            }));

            setTimeout(() => {
                const before = measure();
                useJitterGeometry = true;

                setTimeout(() => {
                    resolve({
                        before,
                        after: measure()
                    });
                }, 220);
            }, 700);
        })
        """
    )

    assert metrics["after"]["left"] == pytest.approx(metrics["before"]["left"], abs=1)
    assert metrics["after"]["top"] == pytest.approx(metrics["before"]["top"], abs=1)
    assert metrics["after"]["width"] == pytest.approx(metrics["before"]["width"], abs=1)
    assert metrics["after"]["height"] == pytest.approx(metrics["before"]["height"], abs=1)
    assert metrics["after"]["headRect"]["left"] == pytest.approx(metrics["before"]["headRect"]["left"], abs=1)
    assert metrics["after"]["headRect"]["top"] == pytest.approx(metrics["before"]["headRect"]["top"], abs=1)
    assert metrics["after"]["headRect"]["width"] == pytest.approx(metrics["before"]["headRect"]["width"], abs=1)
    assert metrics["after"]["headRect"]["height"] == pytest.approx(metrics["before"]["headRect"]["height"], abs=1)


@pytest.mark.frontend
def test_live2d_visible_bubble_keeps_last_position_when_zoom_geometry_jumps_implausibly(mock_page: Page, running_server: str):
    """If Live2D reports a transient absurd geometry during zoom, keep the last good bubble position instead of jumping away."""
    mock_page.goto(f"{running_server}/", wait_until="domcontentloaded")
    mock_page.wait_for_function(
        "() => !!(window.appState && window.avatarReactionBubble)",
        timeout=10000,
    )

    metrics = mock_page.evaluate(
        """
        () => new Promise((resolve) => {
            const live2dContainer = document.getElementById('live2d-container');
            const vrmContainer = document.getElementById('vrm-container');
            const mmdContainer = document.getElementById('mmd-container');
            const bubble = document.getElementById('avatar-reaction-bubble');

            live2dContainer.style.display = 'block';
            live2dContainer.style.visibility = 'visible';
            vrmContainer.style.display = 'none';
            mmdContainer.style.display = 'none';

            const stableGeometry = {
                bounds: {
                    left: 124,
                    top: 96,
                    right: 388,
                    bottom: 612,
                    width: 264,
                    height: 516,
                    centerX: 256,
                    centerY: 354
                },
                rawHeadAnchor: { x: 258, y: 214 },
                headAnchor: { x: 258, y: 212 },
                headRect: {
                    left: 194,
                    top: 164,
                    right: 322,
                    bottom: 328,
                    width: 128,
                    height: 164,
                    centerX: 258,
                    centerY: 246
                },
                headMode: 'face',
                headSource: 'displayInfo',
                bodyRect: {
                    left: 172,
                    top: 294,
                    right: 346,
                    bottom: 578,
                    width: 174,
                    height: 284,
                    centerX: 259,
                    centerY: 436
                },
                bodySource: 'displayInfo',
                reliableHeadRect: true,
                preciseDisplayInfoRect: true,
                coarseHitAreaHeadRect: false
            };
            const implausibleGeometry = {
                bounds: {
                    left: -2600,
                    top: -2100,
                    right: 2200,
                    bottom: 2500,
                    width: 4800,
                    height: 4600,
                    centerX: -200,
                    centerY: 200
                },
                rawHeadAnchor: { x: -1200, y: -900 },
                headAnchor: { x: -1180, y: -880 },
                headRect: {
                    left: -1600,
                    top: -1400,
                    right: -760,
                    bottom: -620,
                    width: 840,
                    height: 780,
                    centerX: -1180,
                    centerY: -1010
                },
                headMode: 'face',
                headSource: 'drawableHeuristic',
                bodyRect: {
                    left: -1800,
                    top: -900,
                    right: -400,
                    bottom: 400,
                    width: 1400,
                    height: 1300,
                    centerX: -1100,
                    centerY: -250
                },
                bodySource: 'drawableHeuristic',
                reliableHeadRect: true,
                preciseDisplayInfoRect: false,
                coarseHitAreaHeadRect: false
            };

            let useImplausibleGeometry = false;
            const currentGeometry = () => useImplausibleGeometry ? implausibleGeometry : stableGeometry;
            const measure = () => ({
                left: parseFloat(bubble.style.left || '0'),
                top: parseFloat(bubble.style.top || '0'),
                ariaHidden: bubble.getAttribute('aria-hidden')
            });

            window.avatarReactionBubbleEnabled = true;
            window.vrmManager = null;
            window.mmdManager = null;
            window.live2dManager = {
                getModelScreenBounds() {
                    return currentGeometry().bounds;
                },
                getHeadScreenAnchor() {
                    return currentGeometry().headAnchor;
                },
                getHeadScreenRectInfo() {
                    return {
                        rect: currentGeometry().headRect,
                        mode: currentGeometry().headMode,
                        source: currentGeometry().headSource
                    };
                },
                getBodyScreenRectInfo() {
                    return {
                        rect: currentGeometry().bodyRect,
                        mode: 'body',
                        source: currentGeometry().bodySource
                    };
                },
                getBubbleAnchorGeometryInfo() {
                    return currentGeometry();
                },
                getBubbleAnchorDebugInfo() {
                    return null;
                }
            };

            window.dispatchEvent(new CustomEvent('neko-assistant-turn-start', {
                detail: { turnId: 'turn-live2d-implausible-zoom-geometry', timestamp: Date.now() }
            }));

            setTimeout(() => {
                const before = measure();
                useImplausibleGeometry = true;
                live2dContainer.dispatchEvent(new WheelEvent('wheel', {
                    bubbles: true,
                    cancelable: true,
                    deltaY: -240
                }));

                setTimeout(() => {
                    resolve({
                        before,
                        after: measure()
                    });
                }, 160);
            }, 700);
        })
        """
    )

    assert metrics["before"]["ariaHidden"] == "false"
    assert metrics["after"]["ariaHidden"] == "false"
    assert metrics["after"]["left"] == pytest.approx(metrics["before"]["left"], abs=2)
    assert metrics["after"]["top"] == pytest.approx(metrics["before"]["top"], abs=2)


@pytest.mark.frontend
def test_live2d_bubble_tracks_body_aware_shape_change_without_pointer(mock_page: Page, running_server: str):
    """Regression test for models that shrink into q/chibi-like proportions without moving the coarse model bounds."""
    mock_page.goto(f"{running_server}/", wait_until="domcontentloaded")
    mock_page.wait_for_function(
        "() => !!(window.appState && window.avatarReactionBubble)",
        timeout=10000,
    )

    metrics = mock_page.evaluate(
        """
        () => new Promise((resolve) => {
            const live2dContainer = document.getElementById('live2d-container');
            const vrmContainer = document.getElementById('vrm-container');
            const mmdContainer = document.getElementById('mmd-container');
            const bubble = document.getElementById('avatar-reaction-bubble');

            live2dContainer.style.display = 'block';
            live2dContainer.style.visibility = 'visible';
            vrmContainer.style.display = 'none';
            mmdContainer.style.display = 'none';

            const bounds = {
                left: 84,
                top: -220,
                right: 428,
                bottom: 1120,
                width: 344,
                height: 1340,
                centerX: 256,
                centerY: 450
            };
            let headRect = {
                left: 180,
                top: 180,
                right: 332,
                bottom: 364,
                width: 152,
                height: 184,
                centerX: 256,
                centerY: 272
            };
            let bodyRect = {
                left: 148,
                top: 324,
                right: 364,
                bottom: 760,
                width: 216,
                height: 436,
                centerX: 256,
                centerY: 542
            };

            const measure = () => ({
                top: parseFloat(bubble.style.top || '0'),
                width: parseFloat(getComputedStyle(bubble).getPropertyValue('--bubble-width') || '0'),
                height: parseFloat(getComputedStyle(bubble).getPropertyValue('--bubble-height') || '0')
            });

            window.avatarReactionBubbleEnabled = true;
            window.vrmManager = null;
            window.mmdManager = null;
            window.live2dManager = {
                getModelScreenBounds() {
                    return bounds;
                },
                getHeadScreenAnchor() {
                    return {
                        x: headRect.centerX,
                        y: headRect.top + headRect.height * 0.36
                    };
                },
                getHeadScreenRectInfo() {
                    return {
                        rect: headRect,
                        mode: 'face',
                        source: 'displayInfo'
                    };
                },
                getBodyScreenRectInfo() {
                    return {
                        rect: bodyRect,
                        mode: 'body',
                        source: 'displayInfo'
                    };
                },
                getBubbleAnchorDebugInfo() {
                    return null;
                }
            };

            window.dispatchEvent(new CustomEvent('neko-assistant-turn-start', {
                detail: { turnId: 'turn-live2d-qmode-follow', timestamp: Date.now() }
            }));

            setTimeout(() => {
                const before = measure();
                headRect = {
                    left: 206,
                    top: 266,
                    right: 306,
                    bottom: 390,
                    width: 100,
                    height: 124,
                    centerX: 256,
                    centerY: 328
                };
                bodyRect = {
                    left: 190,
                    top: 360,
                    right: 322,
                    bottom: 586,
                    width: 132,
                    height: 226,
                    centerX: 256,
                    centerY: 473
                };

                setTimeout(() => {
                    resolve({
                        before,
                        after: measure()
                    });
                }, 320);
            }, 700);
        })
        """
    )

    assert metrics["before"]["width"] > 0
    assert metrics["before"]["height"] > 0
    assert metrics["after"]["width"] < metrics["before"]["width"]
    assert metrics["after"]["height"] < metrics["before"]["height"]
    assert metrics["after"]["top"] > metrics["before"]["top"] + 20


@pytest.mark.frontend
def test_live2d_drawable_heuristic_head_rect_is_preserved_and_tracks_shape_change(mock_page: Page, running_server: str):
    """Regression test for metadata-less models using drawable-based head/body inference."""
    mock_page.goto(f"{running_server}/", wait_until="domcontentloaded")
    mock_page.wait_for_function(
        "() => !!(window.appState && window.avatarReactionBubble)",
        timeout=10000,
    )

    metrics = mock_page.evaluate(
        """
        () => new Promise((resolve) => {
            const live2dContainer = document.getElementById('live2d-container');
            const vrmContainer = document.getElementById('vrm-container');
            const mmdContainer = document.getElementById('mmd-container');
            const bubble = document.getElementById('avatar-reaction-bubble');

            live2dContainer.style.display = 'block';
            live2dContainer.style.visibility = 'visible';
            vrmContainer.style.display = 'none';
            mmdContainer.style.display = 'none';

            const bounds = {
                left: 120,
                top: 30,
                right: 420,
                bottom: 690,
                width: 300,
                height: 660,
                centerX: 270,
                centerY: 360
            };
            let headRect = {
                left: 196,
                top: 156,
                right: 342,
                bottom: 314,
                width: 146,
                height: 158,
                centerX: 269,
                centerY: 235
            };
            let bodyRect = {
                left: 182,
                top: 282,
                right: 360,
                bottom: 572,
                width: 178,
                height: 290,
                centerX: 271,
                centerY: 427
            };

            const measure = () => {
                const state = window.avatarReactionBubble.getState();
                return {
                    top: parseFloat(bubble.style.top || '0'),
                    width: parseFloat(getComputedStyle(bubble).getPropertyValue('--bubble-width') || '0'),
                    height: parseFloat(getComputedStyle(bubble).getPropertyValue('--bubble-height') || '0'),
                    headSource: state.lastDebugSnapshot ? state.lastDebugSnapshot.headSource : null
                };
            };

            window.avatarReactionBubbleEnabled = true;
            window.vrmManager = null;
            window.mmdManager = null;
            window.live2dManager = {
                getModelScreenBounds() {
                    return bounds;
                },
                getHeadScreenAnchor() {
                    return {
                        x: headRect.centerX,
                        y: headRect.top + headRect.height * 0.42
                    };
                },
                getHeadScreenRectInfo() {
                    return {
                        rect: headRect,
                        mode: 'face',
                        source: 'drawableHeuristic'
                    };
                },
                getBodyScreenRectInfo() {
                    return {
                        rect: bodyRect,
                        mode: 'body',
                        source: 'drawableHeuristic'
                    };
                },
                getBubbleAnchorDebugInfo() {
                    return null;
                }
            };

            window.dispatchEvent(new CustomEvent('neko-assistant-turn-start', {
                detail: { turnId: 'turn-live2d-drawable-heuristic-follow', timestamp: Date.now() }
            }));

            setTimeout(() => {
                const before = measure();
                headRect = {
                    left: 212,
                    top: 232,
                    right: 322,
                    bottom: 352,
                    width: 110,
                    height: 120,
                    centerX: 267,
                    centerY: 292
                };
                bodyRect = {
                    left: 206,
                    top: 332,
                    right: 334,
                    bottom: 520,
                    width: 128,
                    height: 188,
                    centerX: 270,
                    centerY: 426
                };

                setTimeout(() => {
                    resolve({
                        before,
                        after: measure()
                    });
                }, 320);
            }, 700);
        })
        """
    )

    assert metrics["before"]["headSource"] == "drawableHeuristic"
    assert metrics["before"]["width"] > 0
    assert metrics["before"]["height"] > 0
    assert metrics["after"]["width"] < metrics["before"]["width"]
    assert metrics["after"]["height"] < metrics["before"]["height"]
    assert metrics["after"]["top"] > metrics["before"]["top"] + 20


@pytest.mark.frontend
def test_live2d_drawable_heuristic_body_aware_layout_does_not_expand_bubble_to_body_size(mock_page: Page, running_server: str):
    """Regression test for workshop models whose inferred head is valid but body-aware sizing used to inflate the bubble."""
    mock_page.goto(f"{running_server}/", wait_until="domcontentloaded")
    mock_page.wait_for_function(
        "() => !!(window.appState && window.avatarReactionBubble)",
        timeout=10000,
    )

    metrics = mock_page.evaluate(
        """
        () => new Promise((resolve) => {
            const live2dContainer = document.getElementById('live2d-container');
            const vrmContainer = document.getElementById('vrm-container');
            const mmdContainer = document.getElementById('mmd-container');
            const bubble = document.getElementById('avatar-reaction-bubble');

            live2dContainer.style.display = 'block';
            live2dContainer.style.visibility = 'visible';
            vrmContainer.style.display = 'none';
            mmdContainer.style.display = 'none';

            const bounds = {
                left: 80,
                top: 60,
                right: 980,
                bottom: 860,
                width: 900,
                height: 800,
                centerX: 530,
                centerY: 460
            };
            const headRect = {
                left: 690,
                top: 210,
                right: 890,
                bottom: 410,
                width: 200,
                height: 200,
                centerX: 790,
                centerY: 310
            };
            const bodyRect = {
                left: 340,
                top: 120,
                right: 900,
                bottom: 740,
                width: 560,
                height: 620,
                centerX: 620,
                centerY: 430
            };

            window.avatarReactionBubbleEnabled = true;
            window.vrmManager = null;
            window.mmdManager = null;
            window.live2dManager = {
                getModelScreenBounds() {
                    return bounds;
                },
                getHeadScreenAnchor() {
                    return {
                        x: headRect.centerX,
                        y: headRect.top + headRect.height * 0.42
                    };
                },
                getHeadScreenRectInfo() {
                    return {
                        rect: headRect,
                        mode: 'face',
                        source: 'drawableHeuristic'
                    };
                },
                getBodyScreenRectInfo() {
                    return {
                        rect: bodyRect,
                        mode: 'body',
                        source: 'drawableHeuristic'
                    };
                },
                getBubbleAnchorDebugInfo() {
                    return null;
                }
            };

            window.dispatchEvent(new CustomEvent('neko-assistant-turn-start', {
                detail: { turnId: 'turn-live2d-drawable-body-aware-cap', timestamp: Date.now() }
            }));

            setTimeout(() => {
                resolve({
                    top: parseFloat(bubble.style.top || '0'),
                    width: parseFloat(getComputedStyle(bubble).getPropertyValue('--bubble-width') || '0'),
                    height: parseFloat(getComputedStyle(bubble).getPropertyValue('--bubble-height') || '0'),
                    headTop: headRect.top,
                    headCenterX: headRect.centerX,
                    bodyCenterX: bodyRect.centerX,
                    anchorX: window.avatarReactionBubble.getState().lastDebugSnapshot
                        ? window.avatarReactionBubble.getState().lastDebugSnapshot.anchor.x
                        : null
                });
            }, 700);
        })
        """
    )

    assert metrics["width"] < 420
    assert metrics["height"] < 320
    assert metrics["top"] < metrics["headTop"]
    assert abs(metrics["anchorX"] - metrics["headCenterX"]) < abs(metrics["anchorX"] - metrics["bodyCenterX"])


@pytest.mark.frontend
def test_live2d_debug_snapshot_is_lazy_when_debug_disabled(mock_page: Page, running_server: str):
    """Regression test that bubble positioning debug data is not sampled when debug is off."""
    mock_page.goto(f"{running_server}/", wait_until="domcontentloaded")
    mock_page.wait_for_function(
        "() => !!(window.appState && window.avatarReactionBubble)",
        timeout=10000,
    )

    metrics = mock_page.evaluate(
        """
        () => {
            const live2dContainer = document.getElementById('live2d-container');
            const vrmContainer = document.getElementById('vrm-container');
            const mmdContainer = document.getElementById('mmd-container');

            live2dContainer.style.display = 'block';
            live2dContainer.style.visibility = 'visible';
            vrmContainer.style.display = 'none';
            mmdContainer.style.display = 'none';

            const bounds = {
                left: 136,
                top: 96,
                right: 376,
                bottom: 576,
                width: 240,
                height: 480,
                centerX: 256,
                centerY: 336
            };
            const headRect = {
                left: 190,
                top: 170,
                right: 322,
                bottom: 332,
                width: 132,
                height: 162,
                centerX: 256,
                centerY: 251
            };

            let debugCalls = 0;
            window.NEKO_DEBUG_BUBBLE_POSITION = false;
            window.NEKO_DEBUG_BUBBLE_LIFECYCLE = false;
            window.vrmManager = null;
            window.mmdManager = null;
            window.live2dManager = {
                getModelScreenBounds() {
                    return bounds;
                },
                getHeadScreenAnchor() {
                    return {
                        x: headRect.centerX,
                        y: headRect.top + headRect.height * 0.42
                    };
                },
                getHeadScreenRectInfo() {
                    return {
                        rect: headRect,
                        mode: 'face',
                        source: 'displayInfo'
                    };
                },
                getBodyScreenRectInfo() {
                    return null;
                },
                getBubbleAnchorDebugInfo() {
                    debugCalls += 1;
                    return {
                        modelName: 'debug-off'
                    };
                }
            };

            window.dispatchEvent(new CustomEvent('neko-assistant-turn-start', {
                detail: { turnId: 'turn-live2d-debug-disabled', timestamp: Date.now() }
            }));

            return { debugCalls };
        }
        """
    )

    assert metrics["debugCalls"] == 0
