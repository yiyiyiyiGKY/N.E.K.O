from __future__ import annotations

import logging
from pathlib import Path

import pytest

from plugin.plugins.mahjong_companion.narration.events import NarrationEvent
from plugin.plugins.mahjong_companion.orchestrator import SessionOrchestrator


class _FakePlugin:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.logger = logging.getLogger("mahjong-companion-runtime-mailbox-test")
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


@pytest.mark.asyncio
async def test_send_runtime_message_interrupt_keeps_latest_command(tmp_path: Path) -> None:
    plugin = _FakePlugin(tmp_path)
    orchestrator = SessionOrchestrator(plugin)

    first = await orchestrator.send_runtime_message(
        action="set_mode",
        payload={"mode": "replay"},
        interrupt=False,
        source="catgirl",
    )
    second = await orchestrator.send_runtime_message(
        action="set_mode",
        payload={"mode": "teaching"},
        interrupt=True,
        source="catgirl",
    )

    assert first.value["ok"] is True
    assert second.value["ok"] is True
    assert second.value["runtime_interrupt_seq"] == 1
    assert second.value["mailbox"]["inbound_pending"] == 1


@pytest.mark.asyncio
async def test_runtime_cycle_processes_inbound_set_mode_command(tmp_path: Path) -> None:
    plugin = _FakePlugin(tmp_path)
    orchestrator = SessionOrchestrator(plugin)
    orchestrator.state.running = True
    orchestrator.state.runtime_mode = "active"

    await orchestrator.send_runtime_message(
        action="set_mode",
        payload={"mode": "replay"},
        interrupt=True,
        source="catgirl",
    )

    orchestrator._run_runtime_cycle_locked()

    assert orchestrator.state.mode == "replay"
    assert orchestrator.state.last_runtime_command_ok is True
    assert orchestrator.state.runtime_inbound_pending == 0


def test_runtime_cycle_in_standby_skips_live_game_loop(tmp_path: Path) -> None:
    plugin = _FakePlugin(tmp_path)
    orchestrator = SessionOrchestrator(plugin)
    orchestrator.state.running = True
    orchestrator.state.runtime_mode = "standby"

    calls = {"count": 0}

    def _fake_live_cycle() -> None:
        calls["count"] += 1

    orchestrator._run_live_cycle_locked = _fake_live_cycle  # type: ignore[assignment]
    orchestrator._run_runtime_cycle_locked()

    assert calls["count"] == 0
    assert orchestrator.state.status == "standby"


@pytest.mark.asyncio
async def test_standby_mode_blocks_assist_action(tmp_path: Path) -> None:
    plugin = _FakePlugin(tmp_path)
    orchestrator = SessionOrchestrator(plugin)
    orchestrator.state.runtime_mode = "standby"
    orchestrator.state.action_mode = "assist"
    orchestrator.state.scene = "replay"

    result = await orchestrator.execute_assist_action("replay_next", dry_run=True)

    assert result.value["ok"] is False
    assert "runtime_mode=standby" in result.value["blocked_reason"]


def test_dispatch_narration_queues_then_flushes_outbound(tmp_path: Path) -> None:
    plugin = _FakePlugin(tmp_path)
    orchestrator = SessionOrchestrator(plugin)
    orchestrator.state.running = True
    orchestrator.state.window_bound = True
    orchestrator.state.last_decision = {"priority": 80}
    orchestrator.state.last_decision_type = "scene_update"

    event = NarrationEvent(
        event_type="scene_update",
        channel="companion",
        delivery="proactive_notification",
        priority=60,
        summary="局面更新",
        detail="这是一个运行时出站队列测试。",
        risk_level="low",
        scene="in_match",
        buttons=[],
        text="我先记录这条消息，再按队列发给猫娘。",
        speakable=False,
        dedupe_key="runtime-mailbox-test",
    )

    payload = orchestrator._dispatch_narration_locked(event)

    assert payload["ok"] is True
    assert "queued_message_id" in payload
    assert orchestrator.state.runtime_outbound_pending == 0
    assert plugin.messages


def test_runtime_outbox_priority_and_dedupe(tmp_path: Path) -> None:
    plugin = _FakePlugin(tmp_path)
    orchestrator = SessionOrchestrator(plugin)

    low = orchestrator._game_runtime.enqueue_outbound(
        event_type="narration_event",
        payload={"event": {"text": "low"}},
        priority=10,
        dedupe_key="k-low",
    )
    high = orchestrator._game_runtime.enqueue_outbound(
        event_type="narration_event",
        payload={"event": {"text": "high"}},
        priority=90,
        dedupe_key="k-high",
    )
    duplicate = orchestrator._game_runtime.enqueue_outbound(
        event_type="narration_event",
        payload={"event": {"text": "dup-high"}},
        priority=95,
        dedupe_key="k-high",
    )

    assert low is not None
    assert high is not None
    assert duplicate is None

    messages = orchestrator._game_runtime.pop_outbound_batch(limit=2)
    assert len(messages) == 2
    assert messages[0].priority >= messages[1].priority
    assert messages[0].dedupe_key == "k-high"
