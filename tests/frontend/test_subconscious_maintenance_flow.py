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


def _install_subconscious_route_mocks(target: Page | BrowserContext) -> list[dict]:
    events: list[dict] = []

    def handle_route_event(route):
        payload = route.request.post_data_json
        body = payload() if callable(payload) else payload
        kind = route.request.url.rstrip("/").rsplit("/", 1)[-1]
        events.append({"kind": kind, "body": body})
        if kind == "end" and body.get("reason") == "manual_exit":
            try:
                route.request.frame.page.evaluate("window.opener && (window.opener.__subconsciousExitObserved = true)")
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

    target.route("**/api/game/subconscious_maintenance/route/start", handle_route_event)
    target.route("**/api/game/subconscious_maintenance/route/heartbeat", handle_route_event)
    target.route("**/api/game/subconscious_maintenance/route/end", handle_route_event)
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
    popup.locator("#subconscious-maintenance-exit-btn").click()
    mock_page.wait_for_function(
        "() => window.__subconsciousExitObserved === true",
        timeout=5_000,
    )
    assert any(event["kind"] == "end" and event["body"]["reason"] == "manual_exit" for event in route_events)


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
    assert any(event["kind"] == "end" and event["body"]["reason"] == "failed" for event in route_events)
