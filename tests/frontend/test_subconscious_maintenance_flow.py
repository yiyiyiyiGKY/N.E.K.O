import time

import pytest
from pathlib import Path
from playwright.sync_api import BrowserContext, Page, expect

from tests.frontend.test_memory_browser import _install_ready_memory_browser_routes
from utils.file_utils import atomic_write_json
from utils.storage_policy import save_storage_policy


@pytest.fixture
def seed_subconscious_memory_file(clean_user_data_dir, running_server):
    app_root = Path(clean_user_data_dir) / "N.E.K.O"
    save_storage_policy(
        None,
        selected_root=app_root,
        anchor_root=app_root,
        selection_source="test",
    )
    memory_dir = app_root / "memory" / "测试猫娘"
    memory_dir.mkdir(parents=True, exist_ok=True)
    memory_file = memory_dir / "recent.json"
    atomic_write_json(
        memory_file,
        [
            {
                "type": "human",
                "data": {"content": "测试潜意识维护态入口"},
            },
            {
                "type": "ai",
                "data": {"content": "[2026-01-01 12:00:00] 好呀，开始清理小窝。"},
            },
        ],
        ensure_ascii=False,
        indent=2,
    )
    return memory_file


def _install_subconscious_route_mocks(
    target: Page | BrowserContext,
    *,
    chat_events: list[dict] | None = None,
    chat_status: int = 200,
    chat_line: str = "Keep the core safe.",
    chat_control: dict | None = None,
    chat_delay_ms: int = 0,
    chat_delay_by_kind: dict[str, int] | None = None,
    drain_outputs: list[dict] | None = None,
    route_end_delay_ms: int = 0,
) -> list[dict]:
    events: list[dict] = []
    chat_events = chat_events if chat_events is not None else []

    def handle_route_event(route):
        payload = route.request.post_data_json
        body = payload() if callable(payload) else payload
        kind = route.request.url.rstrip("/").rsplit("/", 1)[-1]
        events.append({"kind": kind, "body": body})
        if kind == "end" and route_end_delay_ms > 0:
            time.sleep(route_end_delay_ms / 1000.0)
        if kind == "voice-transcript":
            try:
                route.request.frame.page.evaluate("window.__subconsciousVoiceTranscriptSeen = true")
            except Exception:
                pass
        if kind == "start":
            try:
                route.request.frame.page.evaluate("window.__subconsciousRouteStartSeen = true")
            except Exception:
                pass
        if kind == "end" and body.get("reason") == "manual_exit":
            try:
                route.request.frame.page.evaluate("window.opener && (window.opener.__subconsciousExitObserved = true)")
            except Exception:
                pass
        if kind == "end":
            try:
                route.request.frame.page.evaluate(
                    "(reason) => { window.__subconsciousRouteEndReasons = window.__subconsciousRouteEndReasons || []; window.__subconsciousRouteEndReasons.push(reason || ''); }",
                    body.get("reason", "")
                )
            except Exception:
                pass
        route.fulfill(
            status=200,
            content_type="application/json",
            json={
                "ok": True,
                "active": kind != "end",
                "heartbeat_interval_seconds": 0.2,
                "heartbeat_timeout_seconds": 10,
                "state": {"game_route_active": kind != "end"},
            },
        )
        if kind == "end":
            try:
                route.request.frame.page.evaluate(
                    """
                    () => {
                        window.__subconsciousRouteEnds = (window.__subconsciousRouteEnds || 0) + 1;
                    }
                    """
                )
            except Exception:
                pass

    target.route("**/api/game/subconscious_maintenance/route/start", handle_route_event)
    target.route("**/api/game/subconscious_maintenance/route/heartbeat", handle_route_event)
    target.route("**/api/game/subconscious_maintenance/route/end", handle_route_event)
    target.route("**/api/game/subconscious_maintenance/route/voice-transcript", handle_route_event)

    def handle_chat_event(route):
        payload = route.request.post_data_json
        body = payload() if callable(payload) else payload
        chat_events.append({
            "kind": "chat",
            "body": body,
        })
        try:
            route.request.frame.page.evaluate(
                "(kind) => { window.__subconsciousChatKinds = window.__subconsciousChatKinds || []; window.__subconsciousChatKinds.push(kind); }",
                body.get("event", {}).get("kind", "chat")
            )
        except Exception:
            pass
        event_kind = body.get("event", {}).get("kind", "chat")
        delay_ms = (chat_delay_by_kind or {}).get(event_kind, chat_delay_ms)
        if delay_ms > 0:
            time.sleep(delay_ms / 1000.0)
        route.fulfill(
            status=chat_status,
            content_type="application/json",
            json={
                "line": chat_line if chat_status < 400 else "",
                "control": chat_control if chat_control is not None else {
                    "displaySeconds": 2.5,
                    "priority": 5,
                },
            },
        )

    def handle_drain_event(route):
        payload = route.request.post_data_json
        body = payload() if callable(payload) else payload
        chat_events.append({
            "kind": "drain",
            "body": body,
        })
        route.fulfill(
            status=200,
            content_type="application/json",
            json={"ok": True, "outputs": drain_outputs or []},
        )

    target.route("**/api/game/subconscious_maintenance/chat", handle_chat_event)
    target.route("**/api/game/subconscious_maintenance/route/drain", handle_drain_event)

    def handle_mirror_event(route):
        payload = route.request.post_data_json
        body = payload() if callable(payload) else payload
        chat_events.append({
            "kind": "mirror",
            "body": body,
        })
        try:
            route.request.frame.page.evaluate("window.__subconsciousMirrorSeen = true")
            route.request.frame.page.evaluate(
                "(kind) => { window.__subconsciousMirrorKinds = window.__subconsciousMirrorKinds || []; window.__subconsciousMirrorKinds.push(kind); }",
                body.get("event", {}).get("kind", "mirror")
            )
        except Exception:
            pass
        route.fulfill(
            status=200,
            content_type="application/json",
            json={"ok": True, "mirrored": True, "method": "project_text_mirror"},
        )

    def handle_speak_event(route):
        payload = route.request.post_data_json
        body = payload() if callable(payload) else payload
        chat_events.append({
            "kind": "speak",
            "body": body,
        })
        try:
            route.request.frame.page.evaluate("window.__subconsciousSpeakSeen = true")
            route.request.frame.page.evaluate(
                "(kind) => { window.__subconsciousSpeakKinds = window.__subconsciousSpeakKinds || []; window.__subconsciousSpeakKinds.push(kind); }",
                body.get("event", {}).get("kind", "speak")
            )
        except Exception:
            pass
        route.fulfill(
            status=200,
            content_type="application/json",
            json={"ok": True, "audio_sent": True, "method": "project_tts"},
        )

    def handle_realtime_context_event(route):
        payload = route.request.post_data_json
        body = payload() if callable(payload) else payload
        chat_events.append({
            "kind": "realtime-context",
            "body": body,
        })
        try:
            route.request.frame.page.evaluate("window.__subconsciousRealtimeContextSeen = true")
        except Exception:
            pass
        route.fulfill(
            status=200,
            content_type="application/json",
            json={"ok": True, "bytes": 32, "items": len(body.get("pendingItems") or [])},
        )

    target.route("**/api/game/subconscious_maintenance/mirror-assistant", handle_mirror_event)
    target.route("**/api/game/subconscious_maintenance/speak", handle_speak_event)
    target.route("**/api/game/subconscious_maintenance/realtime-context", handle_realtime_context_event)
    return events


def _wait_for_ready(page: Page) -> None:
    page.wait_for_function(
        "() => window.appSubconsciousMaintenance"
        " && window.appSubconsciousMaintenance.getState().phase === 'ready'"
        " && window.appSubconsciousMaintenance.getState().spriteReady === true",
        timeout=10_000,
    )


def _canvas_has_visible_pixels(page: Page) -> bool:
    return bool(
        page.evaluate(
            """
            () => {
                const canvas = document.getElementById('subconscious-maintenance-canvas');
                const ctx = canvas && canvas.getContext('2d');
                if (!canvas || !ctx || canvas.width <= 1 || canvas.height <= 1) return false;
                const sample = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                for (let i = 3; i < sample.length; i += 4) {
                    if (sample[i] > 0) return true;
                }
                return false;
            }
            """
        )
    )


@pytest.mark.frontend
def test_subconscious_maintenance_opens_from_memory_browser_and_reuses_window_helper(
    mock_page: Page,
    running_server: str,
    seed_subconscious_memory_file,
):
    _install_ready_memory_browser_routes(mock_page, seed_subconscious_memory_file)
    mock_page.add_init_script(
        """
        window.__subconsciousOpenCalls = [];
        window.openOrFocusWindow = function(url, name, features) {
            window.__subconsciousOpenCalls.push({ url, name, features });
        };
        """
    )

    mock_page.goto(f"{running_server}/memory_browser")
    mock_page.wait_for_selector("#memory-file-list button.cat-btn", state="attached", timeout=10_000)
    expect(mock_page.locator("#subconscious-maintenance-open-btn")).to_be_enabled()

    mock_page.locator("#subconscious-maintenance-open-btn").click()
    mock_page.wait_for_function("() => window.__subconsciousOpenCalls.length === 1")
    mock_page.locator("#subconscious-maintenance-open-btn").click()
    mock_page.wait_for_function("() => window.__subconsciousOpenCalls.length === 2")

    calls = mock_page.evaluate("window.__subconsciousOpenCalls")
    assert len(calls) == 2
    assert {call["name"] for call in calls} == {"neko_subconscious_maintenance"}
    assert all(call["url"].startswith("/subconscious_maintenance?") for call in calls)
    assert all("lanlan_name=" in call["url"] and "session_id=subconscious-" in call["url"] for call in calls)
    assert all("source=memory_browser" in call["url"] for call in calls)


@pytest.mark.frontend
def test_subconscious_maintenance_popup_reaches_ready_canvas_and_input(
    mock_page: Page,
    running_server: str,
    seed_subconscious_memory_file,
):
    context = mock_page.context
    _install_ready_memory_browser_routes(context, seed_subconscious_memory_file)
    route_events = _install_subconscious_route_mocks(context)

    mock_page.goto(f"{running_server}/memory_browser")
    mock_page.wait_for_selector("#memory-file-list button.cat-btn", state="attached", timeout=10_000)

    with context.expect_page() as popup_info:
        mock_page.locator("#subconscious-maintenance-open-btn").click()
    popup = popup_info.value
    popup.wait_for_load_state("domcontentloaded")
    _wait_for_ready(popup)

    expect(popup.locator("#subconscious-maintenance-canvas")).to_be_visible()
    assert popup.evaluate("window.location.pathname") == "/subconscious_maintenance"
    assert route_events and route_events[0]["kind"] == "start"
    assert route_events[0]["body"]["pageVisible"] is True
    assert route_events[0]["body"]["visibilityState"] in {"visible", "prerender"}
    assert route_events[0]["body"]["currentState"]["phase"] == "ready"
    assert route_events[0]["body"]["source"] == "memory_browser"
    assert route_events[0]["body"]["gameMemoryEnabled"] is False
    assert route_events[0]["body"]["game_memory_enabled"] is False
    assert route_events[0]["body"]["voiceOutputEnabled"] is True
    assert route_events[0]["body"]["voice_output_enabled"] is True
    assert route_events[0]["body"]["i18n_language"]

    popup.locator("#subconscious-maintenance-start-btn").click()
    popup.wait_for_function("() => window.appSubconsciousMaintenance.getState().phase === 'playing'")

    canvas = popup.locator("#subconscious-maintenance-canvas")
    canvas_box = canvas.bounding_box()
    assert canvas_box is not None
    canvas.dispatch_event(
        "pointermove",
        {
            "clientX": canvas_box["x"] + 120,
            "clientY": canvas_box["y"] + 120,
            "pointerType": "mouse",
        },
    )
    canvas.dispatch_event(
        "pointerdown",
        {
            "clientX": canvas_box["x"] + 120,
            "clientY": canvas_box["y"] + 120,
            "pointerType": "mouse",
            "button": 0,
        },
    )
    canvas.dispatch_event(
        "pointerup",
        {
            "clientX": canvas_box["x"] + 120,
            "clientY": canvas_box["y"] + 120,
            "pointerType": "mouse",
            "button": 0,
        },
    )
    pointer = popup.evaluate("window.appSubconsciousMaintenance.getPointerState()")
    assert pointer and pointer["active"] is True
    assert pointer["x"] > 0 and pointer["y"] > 0

    canvas_size = popup.evaluate(
        """
        () => {
            const canvas = document.getElementById('subconscious-maintenance-canvas');
            const rect = canvas.getBoundingClientRect();
            return {
                bitmapWidth: canvas.width,
                bitmapHeight: canvas.height,
                cssWidth: rect.width,
                cssHeight: rect.height,
                dpr: window.devicePixelRatio || 1,
            };
        }
        """
    )
    assert canvas_size["bitmapWidth"] >= round(canvas_size["cssWidth"] * canvas_size["dpr"]) - 1
    assert canvas_size["bitmapHeight"] >= round(canvas_size["cssHeight"] * canvas_size["dpr"]) - 1
    assert _canvas_has_visible_pixels(popup)

    popup.keyboard.press("Escape")
    popup.wait_for_function("() => window.appSubconsciousMaintenance.getState().phase === 'paused'")
    popup.evaluate("window.appSubconsciousMaintenance.temporaryHideOverlay(1000)")
    popup.wait_for_function("() => document.body.classList.contains('is-temporarily-hidden')")
    assert not any(event["kind"] == "end" for event in route_events)
    popup.evaluate("window.appSubconsciousMaintenance.finishTemporaryHide()")
    popup.wait_for_function("() => !document.body.classList.contains('is-temporarily-hidden')")
    popup.locator("#subconscious-maintenance-exit-btn").click()
    mock_page.wait_for_function(
        "() => window.__subconsciousExitObserved === true",
        timeout=5_000,
    )
    assert any(event["kind"] == "end" and event["body"]["reason"] == "manual_exit" for event in route_events)


@pytest.mark.frontend
def test_subconscious_maintenance_exit_does_not_wait_for_route_finalize(
    mock_page: Page,
    running_server: str,
):
    _install_subconscious_route_mocks(mock_page, route_end_delay_ms=1500)

    mock_page.goto(f"{running_server}/subconscious_maintenance?lanlan_name=Lan&session_id=exit-test")
    _wait_for_ready(mock_page)
    mock_page.locator("#subconscious-maintenance-start-btn").click()
    mock_page.wait_for_function("() => window.appSubconsciousMaintenance.getState().phase === 'playing'")

    mock_page.evaluate(
        """
        () => {
            window.close = () => {};
        }
        """
    )
    mock_page.evaluate(
        """
        () => {
            const original = navigator.sendBeacon;
            Object.defineProperty(navigator, 'sendBeacon', {
                configurable: true,
                value: () => false,
            });
            window.__subconsciousOriginalSendBeacon = original;
        }
        """
    )

    mock_page.keyboard.press("Escape")
    mock_page.wait_for_function("() => window.appSubconsciousMaintenance.getState().phase === 'paused'")
    mock_page.locator("#subconscious-maintenance-exit-btn").click()
    mock_page.wait_for_function("() => window.location.pathname === '/memory_browser'", timeout=5_000)


@pytest.mark.frontend
def test_subconscious_maintenance_difficulties_and_result_routes(
    mock_page: Page,
    running_server: str,
):
    route_events = _install_subconscious_route_mocks(mock_page)
    mock_page.goto(f"{running_server}/subconscious_maintenance?lanlan_name=测试猫娘&session_id=flow-test")
    _wait_for_ready(mock_page)
    assert mock_page.evaluate("window.__nekoSubconsciousMaintenanceQuery.source") == "direct"

    for difficulty in ("easy", "normal", "hard"):
        mock_page.locator(f".sm-difficulty-btn[data-difficulty='{difficulty}']").click()
        assert mock_page.evaluate("window.appSubconsciousMaintenance.getState().difficulty") == difficulty
        mock_page.locator("#subconscious-maintenance-start-btn").click()
        mock_page.wait_for_function("() => window.appSubconsciousMaintenance.getState().phase === 'playing'")
        mock_page.keyboard.press("Escape")
        mock_page.wait_for_function("() => window.appSubconsciousMaintenance.getState().phase === 'paused'")
        mock_page.locator("#subconscious-maintenance-restart-btn").click()
        _wait_for_ready(mock_page)

    mock_page.locator(".sm-difficulty-btn[data-difficulty='easy']").click()
    mock_page.locator("#subconscious-maintenance-start-btn").click()
    mock_page.wait_for_function("() => window.appSubconsciousMaintenance.getState().phase === 'playing'")
    mock_page.evaluate("window.appSubconsciousMaintenance.showResult('success')")
    mock_page.wait_for_function("() => window.appSubconsciousMaintenance.getState().phase === 'success'")
    mock_page.wait_for_function("() => (window.__subconsciousRouteEndReasons || []).includes('success')")
    assert any(event["kind"] == "end" and event["body"]["reason"] == "success" for event in route_events)
    assert route_events[0]["body"]["source"] == "direct"
    assert route_events[0]["body"]["gameMemoryEnabled"] is False
    assert route_events[0]["body"]["game_memory_enabled"] is False

    mock_page.locator("#subconscious-maintenance-end-restart-btn").click()
    _wait_for_ready(mock_page)
    mock_page.locator("#subconscious-maintenance-start-btn").click()
    mock_page.wait_for_function("() => window.appSubconsciousMaintenance.getState().phase === 'playing'")
    mock_page.evaluate("window.appSubconsciousMaintenance.showResult('failed')")
    mock_page.wait_for_function("() => window.appSubconsciousMaintenance.getState().phase === 'failed'")
    mock_page.wait_for_function("() => (window.__subconsciousRouteEndReasons || []).includes('failed')")
    assert any(event["kind"] == "end" and event["body"]["reason"] == "failed" for event in route_events)


@pytest.mark.frontend
def test_subconscious_maintenance_game_event_calls_chat_and_updates_bubble(
    mock_page: Page,
    running_server: str,
):
    chat_events: list[dict] = []
    _install_subconscious_route_mocks(
        mock_page,
        chat_events=chat_events,
        chat_line="Hold the core line.",
    )

    mock_page.goto(f"{running_server}/subconscious_maintenance?lanlan_name=Lan&session_id=chat-test")
    _wait_for_ready(mock_page)
    mock_page.locator("#subconscious-maintenance-start-btn").click()
    mock_page.wait_for_function("() => window.appSubconsciousMaintenance.getState().phase === 'playing'")
    mock_page.evaluate(
        "() => window.appSubconsciousMaintenance.emitGameEvent('neko_hit', { label: 'test hit', gameMemoryEnabled: true, game_memory_enabled: true }, { force: true })"
    )
    mock_page.wait_for_function("() => window.appSubconsciousMaintenance.getState().nekoHint === 'Hold the core line.'")
    mock_page.wait_for_function("() => window.__subconsciousMirrorSeen === true", timeout=5_000)
    mock_page.wait_for_function("() => window.__subconsciousSpeakSeen === true", timeout=5_000)

    chat_calls = [event for event in chat_events if event["kind"] == "chat"]
    assert chat_calls
    hit_call = next(event for event in chat_calls if event["body"]["event"]["kind"] == "neko_hit")
    assert hit_call["body"]["source"] == "direct"
    assert hit_call["body"]["gameMemoryEnabled"] is False
    assert hit_call["body"]["game_memory_enabled"] is False
    assert hit_call["body"]["voiceOutputEnabled"] is True
    assert hit_call["body"]["voice_output_enabled"] is True
    assert hit_call["body"]["event"]["gameMemoryEnabled"] is False
    assert hit_call["body"]["event"]["game_memory_enabled"] is False
    assert hit_call["body"]["event"]["currentState"]["phase"] == "playing"
    assert hit_call["body"]["event"]["currentState"]["weapon"] == "sword"
    assert hit_call["body"]["i18n_language"]
    mirror_calls = [event for event in chat_events if event["kind"] == "mirror"]
    assert mirror_calls
    assert mirror_calls[-1]["body"]["line"] == "Hold the core line."
    assert mirror_calls[-1]["body"]["event"]["kind"] == "neko_hit"
    assert mirror_calls[-1]["body"]["gameMemoryEnabled"] is False
    assert mirror_calls[-1]["body"]["game_memory_enabled"] is False
    assert mirror_calls[-1]["body"]["finalize_turn"] is False
    speak_calls = [event for event in chat_events if event["kind"] == "speak"]
    assert speak_calls
    assert speak_calls[-1]["body"]["line"] == "Hold the core line."
    assert speak_calls[-1]["body"]["event"]["kind"] == "neko_hit"


@pytest.mark.frontend
def test_subconscious_maintenance_slow_hit_still_speaks(
    mock_page: Page,
    running_server: str,
):
    chat_events: list[dict] = []
    _install_subconscious_route_mocks(
        mock_page,
        chat_events=chat_events,
        chat_line="Slow line ready.",
        chat_delay_by_kind={"neko_hit": 5200},
    )

    mock_page.goto(f"{running_server}/subconscious_maintenance?lanlan_name=Lan&session_id=slow-hit-test")
    _wait_for_ready(mock_page)
    mock_page.locator("#subconscious-maintenance-start-btn").click()
    mock_page.wait_for_function("() => window.appSubconsciousMaintenance.getState().phase === 'playing'")
    mock_page.evaluate(
        "() => window.appSubconsciousMaintenance.emitGameEvent('neko_hit', { label: 'slow hit' }, { force: true })"
    )
    mock_page.wait_for_function(
        "() => (window.__subconsciousSpeakKinds || []).includes('neko_hit')",
        timeout=20_000,
    )

    speak_calls = [event for event in chat_events if event["kind"] == "speak"]
    hit_speaks = [event for event in speak_calls if event["body"]["event"]["kind"] == "neko_hit"]
    assert hit_speaks
    assert hit_speaks[-1]["body"]["line"] == "Slow line ready."
    mirror_calls = [event for event in chat_events if event["kind"] == "mirror"]
    hit_mirrors = [event for event in mirror_calls if event["body"]["event"]["kind"] == "neko_hit"]
    assert hit_mirrors
    assert hit_mirrors[-1]["body"]["line"] == "Slow line ready."


@pytest.mark.frontend
def test_subconscious_maintenance_queues_key_event_while_chat_is_busy(
    mock_page: Page,
    running_server: str,
):
    chat_events: list[dict] = []
    _install_subconscious_route_mocks(
        mock_page,
        chat_events=chat_events,
        chat_line="Queued line.",
        chat_delay_ms=250,
    )

    mock_page.goto(f"{running_server}/subconscious_maintenance?lanlan_name=Lan&session_id=queued-chat-test")
    _wait_for_ready(mock_page)
    mock_page.locator("#subconscious-maintenance-start-btn").click()
    mock_page.wait_for_function(
        "() => (window.__subconsciousChatKinds || []).includes('battle_start')",
        timeout=5_000,
    )
    mock_page.evaluate(
        "() => window.appSubconsciousMaintenance.emitGameEvent('special_drop', { label: 'queued drop' })"
    )
    mock_page.wait_for_function(
        "() => (window.__subconsciousChatKinds || []).includes('special_drop')",
        timeout=5_000,
    )

    chat_kinds = [event["body"]["event"]["kind"] for event in chat_events if event["kind"] == "chat"]
    assert "battle_start" in chat_kinds
    assert "special_drop" in chat_kinds


@pytest.mark.frontend
def test_subconscious_maintenance_hit_preempts_slow_start_event(
    mock_page: Page,
    running_server: str,
):
    chat_events: list[dict] = []
    _install_subconscious_route_mocks(
        mock_page,
        chat_events=chat_events,
        chat_line="Priority line.",
        chat_delay_by_kind={"battle_start": 5200, "neko_hit": 0},
    )

    mock_page.goto(f"{running_server}/subconscious_maintenance?lanlan_name=Lan&session_id=priority-test")
    _wait_for_ready(mock_page)
    mock_page.locator("#subconscious-maintenance-start-btn").click()
    mock_page.wait_for_function("() => window.appSubconsciousMaintenance.getState().phase === 'playing'")
    mock_page.wait_for_function(
        "() => (window.__subconsciousChatKinds || []).includes('battle_start')",
        timeout=5_000,
    )
    mock_page.evaluate(
        "() => window.appSubconsciousMaintenance.emitGameEvent('neko_hit', { label: 'priority hit' })"
    )
    mock_page.wait_for_function(
        "() => (window.__subconsciousChatKinds || []).includes('neko_hit')",
        timeout=8_000,
    )
    mock_page.wait_for_function("() => window.__subconsciousSpeakSeen === true", timeout=8_000)

    chat_kinds = [event["body"]["event"]["kind"] for event in chat_events if event["kind"] == "chat"]
    assert "neko_hit" in chat_kinds
    assert chat_kinds.index("neko_hit") >= 0
    assert any(event["kind"] == "speak" and event["body"]["event"]["kind"] == "neko_hit" for event in chat_events)


@pytest.mark.frontend
def test_subconscious_maintenance_voice_output_realtime_and_transcript_payloads(
    mock_page: Page,
    running_server: str,
):
    chat_events: list[dict] = []
    route_events = _install_subconscious_route_mocks(
        mock_page,
        chat_events=chat_events,
        chat_line="Voice line ready.",
        chat_control={"displaySeconds": 2.5, "priority": 5, "voice": False},
    )

    mock_page.goto(f"{running_server}/subconscious_maintenance?lanlan_name=Lan&session_id=voice-test&voiceOutputEnabled=0")
    _wait_for_ready(mock_page)

    assert route_events[0]["kind"] == "start"
    assert route_events[0]["body"]["voiceOutputEnabled"] is False
    assert route_events[0]["body"]["voice_output_enabled"] is False
    assert route_events[0]["body"]["gameMemoryEnabled"] is False
    assert route_events[0]["body"]["game_memory_enabled"] is False

    mock_page.locator("#subconscious-maintenance-start-btn").click()
    mock_page.wait_for_function("() => window.appSubconsciousMaintenance.getState().phase === 'playing'")
    mock_page.evaluate(
        "() => window.appSubconsciousMaintenance.emitGameEvent('neko_hit', { label: 'quiet hit' }, { force: true })"
    )
    mock_page.wait_for_function(
        "() => window.appSubconsciousMaintenance.getState().nekoHint === 'Voice line ready.'"
    )
    assert not [event for event in chat_events if event["kind"] == "speak"]
    assert [event for event in chat_events if event["kind"] == "mirror"]

    mock_page.locator("#subconscious-maintenance-voice-btn").click()
    mock_page.wait_for_function("() => window.appSubconsciousMaintenance.getVoiceOutputEnabled() === true")
    mock_page.evaluate(
        "() => window.appSubconsciousMaintenance.emitGameEvent('special_drop', { label: 'voice drop' }, { force: true })"
    )
    mock_page.wait_for_function("() => window.__subconsciousSpeakSeen === true", timeout=5_000)

    speak_calls = [event for event in chat_events if event["kind"] == "speak"]
    assert speak_calls
    speak_body = speak_calls[-1]["body"]
    assert speak_body["line"] == "Voice line ready."
    assert speak_body["voiceOutputEnabled"] is True
    assert speak_body["voice_output_enabled"] is True
    assert speak_body["gameMemoryEnabled"] is False
    assert speak_body["game_memory_enabled"] is False
    assert speak_body["event"]["gameMemoryEnabled"] is False
    assert speak_body["event"]["game_memory_enabled"] is False
    assert speak_body["event"]["voiceOutputEnabled"] is True
    assert speak_body["event"]["voice_output_enabled"] is True

    realtime_calls = [event for event in chat_events if event["kind"] == "realtime-context"]
    assert realtime_calls
    realtime_body = realtime_calls[-1]["body"]
    assert realtime_body["session_id"] == "voice-test"
    assert realtime_body["source"] == "direct"
    assert realtime_body["i18n_language"]
    assert realtime_body["gameMemoryEnabled"] is False
    assert realtime_body["game_memory_enabled"] is False
    assert realtime_body["voiceOutputEnabled"] is True
    assert realtime_body["voice_output_enabled"] is True
    assert isinstance(realtime_body["state"], dict)
    assert realtime_body["state"]["sessionId"] == "voice-test"
    assert isinstance(realtime_body["pendingItems"], list)

    mock_page.evaluate("() => window.appSubconsciousMaintenance.submitVoiceTranscript('open a path', 'voice-1')")
    mock_page.wait_for_function("() => window.__subconsciousVoiceTranscriptSeen === true", timeout=5_000)

    voice_route = next(event for event in route_events if event["kind"] == "voice-transcript")
    assert voice_route["body"]["transcript"] == "open a path"
    assert voice_route["body"]["request_id"] == "voice-1"
    assert voice_route["body"]["voiceOutputEnabled"] is True
    assert voice_route["body"]["voice_output_enabled"] is True
    assert voice_route["body"]["gameMemoryEnabled"] is False
    assert voice_route["body"]["game_memory_enabled"] is False


@pytest.mark.frontend
def test_subconscious_maintenance_route_drain_consumes_llm_outputs_and_voice(
    mock_page: Page,
    running_server: str,
):
    chat_events: list[dict] = []
    _install_subconscious_route_mocks(
        mock_page,
        chat_events=chat_events,
        chat_status=500,
        chat_line="",
        drain_outputs=[
            {
                "type": "game_external_input",
                "event": {"kind": "user-voice"},
            },
            {
                "type": "game_llm_result",
                "event": {"kind": "user-voice"},
                "result": {
                    "line": "Drain line ready.",
                    "control": {"displaySeconds": 2.0},
                },
            },
        ],
    )

    mock_page.goto(
        f"{running_server}/subconscious_maintenance?lanlan_name=Lan&session_id=drain-test&voiceOutputEnabled=1"
    )
    _wait_for_ready(mock_page)
    mock_page.wait_for_function("() => window.appSubconsciousMaintenance.getVoiceOutputEnabled() === true")
    mock_page.locator("#subconscious-maintenance-start-btn").click()
    mock_page.wait_for_function("() => window.appSubconsciousMaintenance.getState().phase === 'playing'")
    mock_page.wait_for_function("() => window.__subconsciousRouteStartSeen === true")

    mock_page.evaluate("() => window.appSubconsciousMaintenance.drainRouteOutputs()")
    mock_page.wait_for_function("() => window.appSubconsciousMaintenance.getState().nekoHint === 'Drain line ready.'")
    mock_page.wait_for_function("() => window.__subconsciousMirrorSeen === true", timeout=5_000)
    mock_page.wait_for_function("() => window.__subconsciousSpeakSeen === true", timeout=5_000)

    drain_calls = [event for event in chat_events if event["kind"] == "drain"]
    assert drain_calls
    assert drain_calls[-1]["body"]["currentState"]["weapon"] == "sword"
    speak_calls = [event for event in chat_events if event["kind"] == "speak"]
    assert speak_calls
    assert speak_calls[-1]["body"]["line"] == "Drain line ready."
    assert speak_calls[-1]["body"]["event"]["kind"] == "user-voice"
    mirror_calls = [event for event in chat_events if event["kind"] == "mirror"]
    assert mirror_calls
    assert mirror_calls[-1]["body"]["line"] == "Drain line ready."
    assert mirror_calls[-1]["body"]["event"]["kind"] == "user-voice"
    assert mirror_calls[-1]["body"]["finalize_turn"] is True


@pytest.mark.frontend
def test_subconscious_maintenance_chat_failure_keeps_gameplay_without_local_dialogue(
    mock_page: Page,
    running_server: str,
):
    chat_events: list[dict] = []
    _install_subconscious_route_mocks(
        mock_page,
        chat_events=chat_events,
        chat_status=500,
        chat_line="",
    )

    mock_page.goto(f"{running_server}/subconscious_maintenance?lanlan_name=Lan&session_id=chat-fail-test")
    _wait_for_ready(mock_page)
    mock_page.locator("#subconscious-maintenance-start-btn").click()
    mock_page.wait_for_function("() => window.appSubconsciousMaintenance.getState().phase === 'playing'")
    mock_page.evaluate(
        "() => window.appSubconsciousMaintenance.emitGameEvent('special_drop', { label: 'test drop' }, { force: true })"
    )
    mock_page.wait_for_function(
        "() => window.appSubconsciousMaintenance.getState().phase === 'playing'"
    )
    mock_page.wait_for_timeout(300)

    assert any(event["kind"] == "chat" and event["body"]["event"]["kind"] == "special_drop" for event in chat_events)
    assert mock_page.evaluate("window.appSubconsciousMaintenance.getState().phase") == "playing"
    assert mock_page.evaluate("window.appSubconsciousMaintenance.getState().nekoHint") == ""
