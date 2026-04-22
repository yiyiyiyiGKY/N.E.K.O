from __future__ import annotations

import json
import logging
from pathlib import Path

import pytest

from plugin.plugins.mahjong_companion.orchestrator import SessionOrchestrator


class _FakePlugin:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.logger = logging.getLogger("mahjong-companion-standby-test")
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
async def test_standby_runtime_can_summarize_review_without_game_actions(tmp_path: Path) -> None:
    plugin = _FakePlugin(tmp_path)
    orchestrator = SessionOrchestrator(plugin)
    cache_dir = plugin.data_path("session_cache")
    cache_dir.mkdir(parents=True, exist_ok=True)
    (cache_dir / "review_candidates.json").write_text(
        json.dumps(
            {
                "items": [
                    {
                        "captured_at": "2026-04-20T00:00:00+00:00",
                        "scene": "in_match",
                        "decision_type": "danger_action",
                        "priority": 92,
                        "risk_level": "high",
                        "summary": "当前像是出现了和牌窗口。",
                        "recommended_focus": "win_confirmation",
                        "review_tags": ["win_window", "high_value_timing"],
                    }
                ]
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    orchestrator.state.running = True
    orchestrator.state.runtime_mode = "standby"

    await orchestrator.send_runtime_message(
        action="summarize_review",
        payload={},
        interrupt=True,
        source="catgirl",
    )
    orchestrator._run_runtime_cycle_locked()

    assert orchestrator.state.status == "standby"
    assert orchestrator.state.last_runtime_command_ok is True
    assert orchestrator.state.last_review_summary_ok is True
    assert orchestrator.state.last_review_summary_text


@pytest.mark.asyncio
async def test_standby_runtime_can_sync_memory_without_enabling_actions(tmp_path: Path) -> None:
    plugin = _FakePlugin(tmp_path)
    orchestrator = SessionOrchestrator(plugin)
    cache_dir = plugin.data_path("session_cache")
    cache_dir.mkdir(parents=True, exist_ok=True)
    (cache_dir / "memory_bridge_queue.json").write_text(
        json.dumps(
            {
                "items": [
                    {
                        "captured_at": "2026-04-20T00:00:00+00:00",
                        "summary_text": "最近已经开始出现中盘牌效率样本，适合固定弃牌优先级。",
                        "summary_tags": ["mahjong_tile_efficiency"],
                        "coach_note": "先稳定两面搭子的弃牌优先级。",
                        "priority": 82,
                        "risk_level": "low",
                        "review_tags": ["tile_efficiency"],
                        "reason_codes": ["analysis.tile_level_available"],
                        "dedupe_key": "tile-efficiency-standby-1",
                    }
                ]
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    orchestrator.state.running = True
    orchestrator.state.runtime_mode = "standby"
    orchestrator.state.action_mode = "assist"

    await orchestrator.send_runtime_message(
        action="sync_memory",
        payload={},
        interrupt=True,
        source="catgirl",
    )
    orchestrator._run_runtime_cycle_locked()

    assert orchestrator.state.status == "standby"
    assert orchestrator.state.last_runtime_command_ok is True
    assert orchestrator.state.last_host_memory_sync_status == "host_memory_write_unavailable"

    blocked = await orchestrator.execute_assist_action("replay_next", dry_run=True)
    assert blocked.value["ok"] is False
    assert "runtime_mode=standby" in blocked.value["blocked_reason"]
