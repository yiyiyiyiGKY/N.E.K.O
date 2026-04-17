from __future__ import annotations

import logging
from pathlib import Path

import pytest

from plugin.plugins.mahjong_companion.action.action_log import (
    ActionLogEntry,
    append_action_log,
    clear_action_log,
    load_action_log,
)
from plugin.plugins.mahjong_companion.action.action_registry import ActionRegistry
from plugin.plugins.mahjong_companion.action.input_adapter import InputAdapter, InputCommand
from plugin.plugins.mahjong_companion.orchestrator import SessionOrchestrator


class _FakePlugin:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.logger = logging.getLogger("mahjong-companion-v7-test")
        self.statuses: list[dict[str, object]] = []
        self.messages: list[dict[str, object]] = []

    def data_path(self, *parts: str) -> Path:
        path = self.root / "data"
        if parts:
            path = path.joinpath(*parts)
        return path

    def report_status(self, payload: dict[str, object]) -> None:
        self.statuses.append(dict(payload))

    def push_message(self, **kwargs: object) -> dict[str, object]:
        self.messages.append(dict(kwargs))
        return {"ok": True}


# ---------------------------------------------------------------------------
# ActionRegistry tests
# ---------------------------------------------------------------------------


def test_action_registry_lists_builtin_actions() -> None:
    registry = ActionRegistry()
    actions = registry.list_actions()

    assert len(actions) >= 6
    action_ids = [a.action_id for a in actions]
    assert "replay_next" in action_ids
    assert "dialog_confirm" in action_ids
    assert "menu_back" in action_ids


def test_action_registry_validate_rejects_when_mode_off() -> None:
    registry = ActionRegistry()
    ok, reason = registry.validate(
        "replay_next",
        current_scene="replay",
        action_mode="off",
        session_running=True,
    )
    assert ok is False
    assert "off" in reason


def test_action_registry_validate_rejects_unknown_action() -> None:
    registry = ActionRegistry()
    ok, reason = registry.validate(
        "nonexistent_action",
        current_scene="replay",
        action_mode="assist",
        session_running=True,
    )
    assert ok is False
    assert "unknown" in reason


def test_action_registry_validate_rejects_wrong_scene() -> None:
    registry = ActionRegistry()
    ok, reason = registry.validate(
        "replay_next",
        current_scene="in_match",
        action_mode="assist",
        session_running=True,
    )
    assert ok is False
    assert "not in allowed_contexts" in reason


def test_action_registry_validate_rejects_missing_confirmation() -> None:
    registry = ActionRegistry()
    ok, reason = registry.validate(
        "dialog_confirm",
        current_scene="dialog",
        action_mode="assist",
        session_running=False,
    )
    assert ok is False
    assert "confirmation" in reason


def test_action_registry_validate_allows_replay_action_in_replay_scene() -> None:
    registry = ActionRegistry()
    ok, reason = registry.validate(
        "replay_next",
        current_scene="replay",
        action_mode="assist",
        session_running=True,
    )
    assert ok is True
    assert reason == "allowed"


# ---------------------------------------------------------------------------
# ActionLog tests
# ---------------------------------------------------------------------------


def test_action_log_append_and_load(tmp_path: Path) -> None:
    cache_dir = tmp_path / "cache"
    entry = ActionLogEntry(
        action_id="replay_next",
        executed_at="2026-04-17T10:00:00+00:00",
        ok=True,
        window_title="Mahjong Soul",
    )
    log_path = append_action_log(cache_dir, entry)
    assert log_path.exists()

    entries = load_action_log(cache_dir)
    assert len(entries) == 1
    assert entries[0]["action_id"] == "replay_next"
    assert entries[0]["ok"] is True


def test_action_log_clear(tmp_path: Path) -> None:
    cache_dir = tmp_path / "cache"
    entry = ActionLogEntry(
        action_id="dialog_confirm",
        executed_at="2026-04-17T10:00:00+00:00",
        ok=True,
    )
    append_action_log(cache_dir, entry)

    removed = clear_action_log(cache_dir)
    assert removed is True

    entries = load_action_log(cache_dir)
    assert len(entries) == 0


def test_action_log_respects_max_entries(tmp_path: Path) -> None:
    cache_dir = tmp_path / "cache"
    for i in range(5):
        append_action_log(
            cache_dir,
            ActionLogEntry(
                action_id="replay_next",
                executed_at=f"2026-04-17T10:00:{i:02d}+00:00",
                ok=True,
            ),
            max_entries=3,
        )

    entries = load_action_log(cache_dir)
    assert len(entries) == 3


# ---------------------------------------------------------------------------
# InputAdapter tests
# ---------------------------------------------------------------------------


def test_input_adapter_execute_success() -> None:
    clicks: list[tuple[int, int]] = []
    moves: list[tuple[int, int, float]] = []

    adapter = InputAdapter(
        click_executor=lambda x, y: clicks.append((x, y)),
        move_executor=lambda x, y, d: moves.append((x, y, d)),
    )

    command = InputCommand(target_x=100, target_y=200, move_duration_sec=0.1)
    result = adapter.execute(command)

    assert result["ok"] is True
    assert result["aborted"] is False
    assert len(clicks) == 1
    assert clicks[0] == (100, 200)


def test_input_adapter_aborts_on_guard_check() -> None:
    adapter = InputAdapter(
        click_executor=lambda x, y: None,
        move_executor=lambda x, y, d: None,
    )

    def guard_aborts() -> tuple[bool, str]:
        return True, "human_override_detected"

    command = InputCommand(target_x=100, target_y=200)
    result = adapter.execute(command, guard_check=guard_aborts)

    assert result["ok"] is False
    assert result["aborted"] is True
    assert "human_override" in result["abort_reason"]


def test_input_adapter_build_command_from_action() -> None:
    cmd = InputAdapter.build_command_from_action(
        "replay_next",
        window_left=100,
        window_top=200,
        window_width=800,
        window_height=600,
    )
    assert cmd is not None
    assert cmd.target_x > 100
    assert cmd.target_y > 200
    assert cmd.click is True


def test_input_adapter_build_command_returns_none_for_unknown() -> None:
    cmd = InputAdapter.build_command_from_action("nonexistent_action")
    assert cmd is None


# ---------------------------------------------------------------------------
# Orchestrator integration tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_orchestrator_list_assist_actions(tmp_path: Path) -> None:
    plugin = _FakePlugin(tmp_path)
    orchestrator = SessionOrchestrator(plugin)

    result = await orchestrator.list_assist_actions()

    assert result.value["ok"] is True
    assert result.value["action_mode"] == "off"
    assert len(result.value["actions"]) >= 6


@pytest.mark.asyncio
async def test_orchestrator_execute_assist_action_rejects_when_mode_off(tmp_path: Path) -> None:
    plugin = _FakePlugin(tmp_path)
    orchestrator = SessionOrchestrator(plugin)
    orchestrator.state.action_mode = "off"
    orchestrator.state.scene = "replay"

    result = await orchestrator.execute_assist_action("replay_next")

    assert result.value["ok"] is False
    assert "off" in result.value["blocked_reason"]


@pytest.mark.asyncio
async def test_orchestrator_execute_assist_action_rejects_wrong_scene(tmp_path: Path) -> None:
    plugin = _FakePlugin(tmp_path)
    orchestrator = SessionOrchestrator(plugin)
    orchestrator.state.action_mode = "assist"
    orchestrator.state.scene = "in_match"

    result = await orchestrator.execute_assist_action("replay_next")

    assert result.value["ok"] is False
    assert "not in allowed_contexts" in result.value["blocked_reason"]


@pytest.mark.asyncio
async def test_orchestrator_execute_assist_action_dry_run(tmp_path: Path) -> None:
    plugin = _FakePlugin(tmp_path)
    orchestrator = SessionOrchestrator(plugin)
    orchestrator.state.action_mode = "assist"
    orchestrator.state.scene = "replay"

    result = await orchestrator.execute_assist_action("replay_next", dry_run=True)

    assert result.value["ok"] is True
    assert result.value["blocked_reason"] == "dry_run"


@pytest.mark.asyncio
async def test_orchestrator_execute_assist_action_rejects_unconfirmed_dialog(tmp_path: Path) -> None:
    plugin = _FakePlugin(tmp_path)
    orchestrator = SessionOrchestrator(plugin)
    orchestrator.state.action_mode = "assist"
    orchestrator.state.scene = "dialog"

    result = await orchestrator.execute_assist_action("dialog_confirm")

    assert result.value["ok"] is False
    assert "confirmation" in result.value["blocked_reason"]


@pytest.mark.asyncio
async def test_orchestrator_execute_assist_action_with_guard_abort(tmp_path: Path) -> None:
    plugin = _FakePlugin(tmp_path)
    orchestrator = SessionOrchestrator(plugin)
    orchestrator.state.action_mode = "assist"
    orchestrator.state.scene = "replay"
    orchestrator.state.window_bound = True
    orchestrator.state.window_left = 0
    orchestrator.state.window_top = 0
    orchestrator.state.window_width = 800
    orchestrator.state.window_height = 600
    orchestrator.state.window_title = "Mahjong Soul"

    # Patch adapter to simulate guard abort during execution
    orchestrator._input_adapter = InputAdapter(
        click_executor=lambda x, y: None,
        move_executor=lambda x, y, d: None,
    )

    def patched_execute(command, *, guard_check=None):
        return {
            "ok": False,
            "aborted": True,
            "abort_reason": "human_override_detected",
            "target_x": command.target_x,
            "target_y": command.target_y,
            "elapsed_ms": 50,
        }
    orchestrator._input_adapter.execute = patched_execute

    result = await orchestrator.execute_assist_action(
        "replay_next", user_confirmed=False,
    )

    assert result.value["ok"] is False
    assert result.value["guard_aborted"] is True
    assert orchestrator.state.last_action_guard_aborted is True


@pytest.mark.asyncio
async def test_orchestrator_get_and_clear_action_log(tmp_path: Path) -> None:
    plugin = _FakePlugin(tmp_path)
    orchestrator = SessionOrchestrator(plugin)

    log_result = await orchestrator.get_action_log()
    assert log_result.value["ok"] is True
    assert log_result.value["count"] == 0

    clear_result = await orchestrator.clear_action_log()
    assert clear_result.value["ok"] is True


@pytest.mark.asyncio
async def test_orchestrator_execute_action_updates_state_on_blocked(tmp_path: Path) -> None:
    plugin = _FakePlugin(tmp_path)
    orchestrator = SessionOrchestrator(plugin)
    orchestrator.state.action_mode = "off"

    result = await orchestrator.execute_assist_action("replay_next")

    assert result.value["ok"] is False
    assert orchestrator.state.last_action_id == "replay_next"
    assert orchestrator.state.last_action_ok is False
    assert orchestrator.state.last_action_blocked_reason
    assert orchestrator.state.last_action_guard_aborted is False


@pytest.mark.asyncio
async def test_orchestrator_action_mode_syncs_from_config(tmp_path: Path) -> None:
    plugin = _FakePlugin(tmp_path)
    orchestrator = SessionOrchestrator(plugin)

    orchestrator.apply_config({
        "mahjong_companion": {
            "action_policy": {
                "mode": "assist",
            }
        }
    })

    assert orchestrator.state.action_mode == "assist"
