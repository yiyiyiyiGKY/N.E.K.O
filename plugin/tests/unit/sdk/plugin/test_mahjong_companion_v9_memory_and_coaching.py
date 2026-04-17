from __future__ import annotations

import json
import logging
from pathlib import Path

import pytest

from plugin.plugins.mahjong_companion.orchestrator import SessionOrchestrator
from plugin.plugins.mahjong_companion.review.coaching_topics import build_coaching_topics
from plugin.plugins.mahjong_companion.review.host_memory_sync import sync_memory_bridge_queue
from plugin.plugins.mahjong_companion.review.trend_aggregator import build_trend_summary


class _FakePlugin:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.logger = logging.getLogger("mahjong-companion-v9-test")
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


def test_sync_memory_bridge_queue_keeps_queue_when_host_write_is_unavailable(tmp_path: Path) -> None:
    cache_dir = tmp_path / "session_cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    queue_path = cache_dir / "memory_bridge_queue.json"
    queue_path.write_text(
        json.dumps(
            {
                "items": [
                    {
                        "captured_at": "2026-04-17T00:00:00+00:00",
                        "summary_text": "最近这一手更像是中盘副露路线的犹豫点，需要继续观察。",
                        "summary_tags": ["mahjong_route_choice"],
                        "priority": 82,
                        "risk_level": "medium",
                        "review_tags": ["route_choice"],
                        "reason_codes": ["button.chi_visible"],
                        "dedupe_key": "route-choice-1",
                    },
                    {
                        "captured_at": "2026-04-17T00:05:00+00:00",
                        "summary_text": "最近这一手更像是中盘副露路线的犹豫点，需要继续观察。",
                        "summary_tags": ["mahjong_route_choice"],
                        "priority": 82,
                        "risk_level": "medium",
                        "review_tags": ["route_choice"],
                        "reason_codes": ["button.chi_visible"],
                        "dedupe_key": "route-choice-1",
                    },
                    {
                        "captured_at": "2026-04-17T00:08:00+00:00",
                        "summary_text": "太短了",
                        "summary_tags": [],
                        "priority": 55,
                        "risk_level": "low",
                        "dedupe_key": "noise-1",
                    },
                    {
                        "captured_at": "2026-04-17T00:10:00+00:00",
                        "summary_text": "最近已经开始出现中盘牌效率样本，适合固定弃牌优先级。",
                        "summary_tags": ["mahjong_tile_efficiency"],
                        "priority": 78,
                        "risk_level": "low",
                        "review_tags": ["tile_efficiency"],
                        "reason_codes": ["analysis.tile_level_available"],
                        "dedupe_key": "tile-efficiency-1",
                    },
                ]
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    report, report_path = sync_memory_bridge_queue(cache_dir, memory_client=None, batch_size=5)
    payload = json.loads(queue_path.read_text(encoding="utf-8"))

    assert report["status"] == "host_memory_write_unavailable"
    assert report["attempted_count"] == 2
    assert report["pending_count"] == 2
    assert report["skipped_count"] == 2
    assert report_path.exists()
    assert len(payload["items"]) == 4
    assert payload["items"][0]["host_sync_status"] == "pending"
    assert payload["items"][1]["host_sync_status"] == "skipped"
    assert payload["items"][1]["host_sync_note"] == "duplicate_coaching_memory"
    assert payload["items"][2]["host_sync_note"] == "summary_too_short"
    assert payload["items"][3]["host_sync_status"] == "pending"


def test_build_trend_summary_and_topics_from_recent_sessions() -> None:
    trend = build_trend_summary(
        review_summaries=[
            {
                "session_id": "mahjong-a",
                "generated_at": "2026-04-15T00:00:00+00:00",
                "memory_bridge_candidates": ["mahjong_route_choice", "mahjong_riichi_preference"],
            },
            {
                "session_id": "mahjong-b",
                "generated_at": "2026-04-16T00:00:00+00:00",
                "memory_bridge_candidates": ["mahjong_route_choice", "mahjong_tile_efficiency"],
            },
            {
                "session_id": "mahjong-c",
                "generated_at": "2026-04-17T00:00:00+00:00",
                "memory_bridge_candidates": ["mahjong_risk_focus"],
            },
        ],
        pending_memories=[],
        session_window=3,
    )
    topics = build_coaching_topics(trend, topic_limit=3)

    assert trend["style_bias"] == "slightly_aggressive"
    assert trend["common_hesitations"][0] == "call_decision"
    assert trend["focus_counts"]["call_decision"] == 2
    assert trend["coach_focus"] == "call_decision"
    assert topics["topics"][0]["topic_id"] == "call_decision"
    assert "路线摇摆" in topics["topics"][0]["recommendation"]


@pytest.mark.asyncio
async def test_generate_review_summary_refreshes_coaching_state(tmp_path: Path) -> None:
    plugin = _FakePlugin(tmp_path)
    cache_dir = plugin.data_path("session_cache")
    cache_dir.mkdir(parents=True, exist_ok=True)
    (cache_dir / "review_candidates.json").write_text(
        json.dumps(
            {
                "items": [
                    {
                        "captured_at": "2026-04-15T00:00:00+00:00",
                        "scene": "in_match",
                        "decision_type": "danger_action",
                        "priority": 96,
                        "risk_level": "high",
                        "summary": "当前像是出现了和牌窗口。",
                        "recommended_focus": "win_confirmation",
                        "review_tags": ["win_window", "high_value_timing"],
                    },
                    {
                        "captured_at": "2026-04-15T00:00:20+00:00",
                        "scene": "in_match",
                        "decision_type": "tile_efficiency_hint",
                        "priority": 72,
                        "risk_level": "medium",
                        "summary": "这一巡更适合先走稳一点的牌效率路线。",
                        "recommended_focus": "tile_efficiency",
                        "review_tags": ["tile_efficiency", "mid_round_choice"],
                    },
                ]
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    orchestrator = SessionOrchestrator(plugin)

    result = await orchestrator.generate_review_summary()

    assert result.value["ok"] is True
    assert Path(result.value["history_path"]).exists()
    assert Path(result.value["coaching_trend_path"]).exists()
    assert Path(result.value["coaching_topics_path"]).exists()
    assert result.value["coaching_trend"]["common_hesitations"]
    assert result.value["coaching_topics"]["topics"]
    assert orchestrator.state.last_coaching_focus
    assert orchestrator.state.last_coaching_summary_text
    assert plugin.statuses[-1]["last_coaching_focus"] == orchestrator.state.last_coaching_focus


@pytest.mark.asyncio
async def test_orchestrator_sync_memory_bridge_and_get_topics(tmp_path: Path) -> None:
    plugin = _FakePlugin(tmp_path)
    cache_dir = plugin.data_path("session_cache")
    cache_dir.mkdir(parents=True, exist_ok=True)
    (cache_dir / "review_summary_history.json").write_text(
        json.dumps(
            {
                "items": [
                    {
                        "session_id": "mahjong-a",
                        "generated_at": "2026-04-15T00:00:00+00:00",
                        "memory_bridge_candidates": ["mahjong_route_choice", "mahjong_tile_efficiency"],
                    }
                ]
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    (cache_dir / "memory_bridge_queue.json").write_text(
        json.dumps(
            {
                "items": [
                    {
                        "captured_at": "2026-04-17T00:00:00+00:00",
                        "summary_text": "最近已经开始出现中盘牌效率样本，适合固定弃牌优先级。",
                        "summary_tags": ["mahjong_tile_efficiency"],
                        "priority": 78,
                        "risk_level": "low",
                        "review_tags": ["tile_efficiency"],
                        "reason_codes": ["analysis.tile_level_available"],
                        "dedupe_key": "tile-efficiency-1",
                    }
                ]
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    orchestrator = SessionOrchestrator(plugin)

    sync_result = await orchestrator.sync_memory_bridge()
    trend_result = await orchestrator.get_coaching_trend()
    topics_result = await orchestrator.get_last_coaching_topics()

    assert sync_result.value["ok"] is True
    assert sync_result.value["status"] == "host_memory_write_unavailable"
    assert trend_result.value["ok"] is True
    assert trend_result.value["coaching_trend"]["coach_focus"] in {"call_decision", "tile_efficiency"}
    assert topics_result.value["ok"] is True
    assert topics_result.value["topics"]
    assert orchestrator.state.last_host_memory_sync_status == "host_memory_write_unavailable"
