import json
import re
import shutil
import textwrap
from pathlib import Path

import pytest

from tests.node_harness import run_node_stdin


PROJECT_ROOT = Path(__file__).resolve().parents[2]
LIVE2D_INTERACTION = PROJECT_ROOT / "static" / "live2d" / "live2d-interaction.js"
UNITY_MANAGER = PROJECT_ROOT / "static" / "unity" / "unity-avatar-manager.js"


def _node_path() -> str:
    node_path = shutil.which("node")
    if not node_path:
        raise AssertionError("node is required to run the wheel guard behaviour tests")
    return node_path


def _run_harness(harness: str) -> list[dict]:
    completed = run_node_stdin(
        _node_path(),
        harness,
        capture_output=True,
        check=False,
        timeout=20,
    )
    assert completed.returncode == 0, (
        f"wheel harness failed:\n{completed.stderr or completed.stdout}"
    )
    return json.loads(completed.stdout)


def _live2d_wheel_zoom_source() -> str:
    source = LIVE2D_INTERACTION.read_text(encoding="utf-8")
    start = source.index("Live2DManager.prototype.setupWheelZoom = function (model)")
    end = source.index("Live2DManager.prototype.setupTouchZoom = function (model)", start)
    return source[start:end]


def _unity_wheel_handler_source() -> str:
    source = UNITY_MANAGER.read_text(encoding="utf-8")
    start = source.index("const wheel = (event) => {")
    end = source.index("this._handlers = {", start)
    return source[start:end]


def _unity_hit_test_source() -> str:
    source = UNITY_MANAGER.read_text(encoding="utf-8")
    start = source.index("_hitTestModel(x, y) {")
    end = source.index("initDragAndZoom()", start)
    method = source[start:end].strip()
    return method.replace(
        "_hitTestModel(x, y) {",
        "function hitTestModel(x, y) {",
        1,
    )


def _run_live2d_wheel_scenarios(scenarios: list[dict]) -> dict[str, dict]:
    """Run the production Live2D wheel listener instead of parsing its syntax."""
    harness = textwrap.dedent("""
        const SCALE_LIMITS = { MIN: 0.1, MAX: 10 };
        function Live2DManager() {}
        __WHEEL_ZOOM_SOURCE__

        const scenarios = __SCENARIOS__;
        const results = [];
        for (const scenario of scenarios) {
            const listeners = [];
            const model = {
                getBounds: () => ({ x: 100, y: 100, width: 200, height: 200,
                                    left: 100, top: 100, right: 300, bottom: 300 }),
                scale: { x: 1, set(next) { this.x = next; } },
            };
            const manager = new Live2DManager();
            manager.isLocked = scenario.locked === true;
            manager.currentModel = model;
            manager.isLive2DPeekActive = () => scenario.peek === true;
            manager._debouncedSnapCheck = () => {};
            manager.pixi_app = {
                renderer: { screen: { width: 400, height: 400 } },
                view: {
                    getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 400 }),
                    addEventListener: (type, handler) => {
                        if (type === 'wheel') listeners.push(handler);
                    },
                    removeEventListener: (type, handler) => {
                        const index = listeners.indexOf(handler);
                        if (index >= 0) listeners.splice(index, 1);
                    },
                },
            };

            Live2DManager.prototype.setupWheelZoom.call(manager, model);
            if (listeners.length === 0) throw new Error('setupWheelZoom registered no listener');
            let prevented = false;
            for (const listener of listeners) {
                listener({
                    clientX: scenario.x,
                    clientY: scenario.y,
                    deltaY: scenario.deltaY,
                    preventDefault: () => { prevented = true; },
                });
            }
            results.push({
                name: scenario.name,
                prevented,
                zoomed: model.scale.x !== 1,
                listeners: listeners.length,
            });
        }
        process.stdout.write(JSON.stringify(results));
    """)
    harness = harness.replace("__WHEEL_ZOOM_SOURCE__", _live2d_wheel_zoom_source())
    harness = harness.replace("__SCENARIOS__", json.dumps(scenarios))
    return {result["name"]: result for result in _run_harness(harness)}


def _run_unity_wheel_scenarios(scenarios: list[dict]) -> dict[str, dict]:
    """Drive the Unity adapter's canvas listener without a legacy Three facade."""
    harness = textwrap.dedent("""
        const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value)));
        const scenarios = __SCENARIOS__;
        const results = [];
        for (const scenario of scenarios) {
            const commands = [];
            const hitPoints = [];
            let saves = 0;
            const context = {
                isLocked: scenario.locked === true,
                _isYuiGuideDragLocked: () => scenario.guideLocked === true,
                _hitTestModel: (x, y) => {
                    hitPoints.push([x, y]);
                    return scenario.hit === true;
                },
                _debouncedSavePosition: () => { saves += 1; },
                manager: {
                    _isModelReadyForInteraction: scenario.ready !== false,
                    _notify: (command, body) => { commands.push({ command, body }); },
                },
            };
            const wheel = (function () {
                __UNITY_WHEEL_SOURCE__
                return wheel;
            }).call(context);
            let prevented = false;
            wheel({
                clientX: scenario.x,
                clientY: scenario.y,
                deltaY: scenario.deltaY,
                preventDefault: () => { prevented = true; },
            });
            results.push({
                name: scenario.name,
                prevented,
                zoomed: commands.some((entry) => entry.command === 'model.zoom'),
                delta: commands[0] && commands[0].body.delta,
                hitPoints,
                saves,
            });
        }
        process.stdout.write(JSON.stringify(results));
    """)
    harness = harness.replace("__UNITY_WHEEL_SOURCE__", _unity_wheel_handler_source())
    harness = harness.replace("__SCENARIOS__", json.dumps(scenarios))
    return {result["name"]: result for result in _run_harness(harness)}


def _run_unity_hit_test_scenarios(scenarios: list[dict]) -> dict[str, bool]:
    harness = textwrap.dedent("""
        const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
        __UNITY_HIT_TEST_SOURCE__
        const scenarios = __SCENARIOS__;
        const results = scenarios.map((scenario) => ({
            name: scenario.name,
            hit: hitTestModel.call({
                manager: { getModelScreenBounds: () => scenario.bounds || null },
            }, scenario.x, scenario.y),
        }));
        process.stdout.write(JSON.stringify(results));
    """)
    harness = harness.replace("__UNITY_HIT_TEST_SOURCE__", _unity_hit_test_source())
    harness = harness.replace("__SCENARIOS__", json.dumps(scenarios))
    return {result["name"]: result["hit"] for result in _run_harness(harness)}


def _both_directions(base: dict) -> list[dict]:
    return [
        {**base, "name": f"{base['name']}_up", "deltaY": -100},
        {**base, "name": f"{base['name']}_down", "deltaY": 100},
    ]


@pytest.mark.unit
def test_live2d_wheel_zoom_requires_model_hit_before_consuming_event():
    scenarios = (
        _both_directions({"name": "on_model", "x": 200, "y": 200})
        + _both_directions({"name": "off_model", "x": 20, "y": 20})
        + _both_directions({"name": "on_model_peek", "x": 200, "y": 200, "peek": True})
        + _both_directions({"name": "off_model_peek", "x": 20, "y": 20, "peek": True})
        + _both_directions({"name": "locked", "x": 200, "y": 200, "locked": True})
    )
    results = _run_live2d_wheel_scenarios(scenarios)

    for direction in ("up", "down"):
        assert results[f"off_model_{direction}"]["prevented"] is False
        assert results[f"off_model_{direction}"]["zoomed"] is False
        assert results[f"off_model_peek_{direction}"]["prevented"] is False
        assert results[f"off_model_peek_{direction}"]["zoomed"] is False
        assert results[f"on_model_{direction}"]["prevented"] is True
        assert results[f"on_model_{direction}"]["zoomed"] is True
        assert results[f"on_model_peek_{direction}"]["prevented"] is True
        assert results[f"on_model_peek_{direction}"]["zoomed"] is False
        assert results[f"locked_{direction}"]["prevented"] is False
        assert results[f"locked_{direction}"]["zoomed"] is False


@pytest.mark.unit
def test_live2d_wheel_hit_test_uses_canvas_relative_coordinates():
    block = _live2d_wheel_zoom_source()
    assert re.search(r"const\s+isWheelPointOnCurrentModel\s*=\s*\(event\)\s*=>\s*{", block)
    assert re.search(r"getBoundingClientRect\s*\(\)", block)
    assert re.search(r"event\.clientX\s*-\s*canvasRect\.left", block)
    assert re.search(r"event\.clientY\s*-\s*canvasRect\.top", block)


@pytest.mark.unit
def test_unity_wheel_zoom_requires_model_hit_before_consuming_event():
    scenarios = (
        _both_directions({"name": "on_model", "x": 200, "y": 200, "hit": True})
        + _both_directions({"name": "off_model", "x": 20, "y": 20})
        + _both_directions({"name": "locked", "x": 200, "y": 200, "hit": True, "locked": True})
        + _both_directions({"name": "loading", "x": 200, "y": 200, "hit": True, "ready": False})
        + _both_directions({
            "name": "guide_locked", "x": 200, "y": 200, "hit": True, "guideLocked": True
        })
    )
    results = _run_unity_wheel_scenarios(scenarios)

    for direction in ("up", "down"):
        assert results[f"off_model_{direction}"]["prevented"] is False
        assert results[f"off_model_{direction}"]["zoomed"] is False
        assert results[f"locked_{direction}"]["prevented"] is False
        assert results[f"loading_{direction}"]["prevented"] is False
        assert results[f"guide_locked_{direction}"]["prevented"] is False

        on_model = results[f"on_model_{direction}"]
        assert on_model["prevented"] is True
        assert on_model["zoomed"] is True
        assert on_model["delta"] == (-100 if direction == "up" else 100)
        assert on_model["hitPoints"] == [[200, 200]]
        assert on_model["saves"] == 1


@pytest.mark.unit
def test_unity_hit_test_uses_projected_client_bounds_without_three_scene_state():
    bounds = {"centerX": 200, "centerY": 200, "width": 200, "height": 400}
    results = _run_unity_hit_test_scenarios([
        {"name": "center", "bounds": bounds, "x": 200, "y": 200},
        {"name": "inside_horizontal", "bounds": bounds, "x": 267, "y": 200},
        {"name": "outside_horizontal", "bounds": bounds, "x": 270, "y": 200},
        {"name": "inside_vertical", "bounds": bounds, "x": 200, "y": 395},
        {"name": "outside_vertical", "bounds": bounds, "x": 200, "y": 398},
        {"name": "missing_bounds", "x": 200, "y": 200},
    ])
    assert results == {
        "center": True,
        "inside_horizontal": True,
        "outside_horizontal": False,
        "inside_vertical": True,
        "outside_vertical": False,
        "missing_bounds": False,
    }

    wheel = _unity_wheel_handler_source()
    manager = UNITY_MANAGER.read_text(encoding="utf-8")
    assert "this._hitTestModel(event.clientX, event.clientY)" in wheel
    assert "this.manager._notify('model.zoom'" in wheel
    assert "canvas.addEventListener('wheel', wheel, { passive: false });" in manager
    assert "renderer.domElement" not in wheel
    assert "currentModel.scene" not in wheel
