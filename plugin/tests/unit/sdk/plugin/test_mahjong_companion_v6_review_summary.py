from __future__ import annotations

import json
import logging
from pathlib import Path

import pytest

from plugin.plugins.mahjong_companion.contracts import PerceivedGameState
from plugin.plugins.mahjong_companion.decision.generator import build_decision
from plugin.plugins.mahjong_companion.orchestrator import SessionOrchestrator
from plugin.plugins.mahjong_companion.review.summarizer import generate_review_summary


class _FakePlugin:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.logger = logging.getLogger("mahjong-companion-v6-test")
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


def test_build_decision_attaches_v6_fallback_analysis() -> None:
    state = PerceivedGameState(
        scene="in_match",
        confidence=0.81,
        is_user_turn=True,
        buttons=["ron", "skip"],
        notes=["bottom action bar detected"],
    )

    decision = build_decision(state)

    assert decision.mahjong_analysis["analysis_version"] == "mahjong-lite-v1"
    assert decision.mahjong_analysis["tile_level_available"] is False
    assert decision.mahjong_analysis["teaching_points"]
    assert decision.review_summary_snippet
    assert decision.engine_meta["analysis_version"] == "mahjong-lite-v1"
    assert decision.engine_meta["tile_level_available"] is False


def test_build_decision_upgrades_to_tile_efficiency_hint_with_structured_tiles() -> None:
    state = PerceivedGameState(
        scene="in_match",
        confidence=0.84,
        is_user_turn=True,
        buttons=[],
        notes=["structured hand sample injected"],
        hand_tiles=["1m", "2m", "3m", "4p", "5p", "6p", "7s", "8s", "9s", "1z", "1z", "9m", "5z"],
        dora_indicators=["4p"],
    )

    decision = build_decision(state)

    assert decision.decision_type == "tile_efficiency_hint"
    assert decision.recommended_focus == "tile_efficiency"
    assert "tile_efficiency" in decision.review_tags
    assert decision.mahjong_analysis["tile_level_available"] is True
    assert decision.mahjong_analysis["candidate_discards"]
    assert decision.mahjong_analysis["shanten_estimate"] is not None


def test_build_decision_uses_analysis_hints_when_provided() -> None:
    state = PerceivedGameState(
        scene="in_match",
        confidence=0.8,
        is_user_turn=True,
        buttons=[],
        analysis_hints={
            "tile_level_available": True,
            "shanten_estimate": 1,
            "ukeire_estimate": 18,
            "candidate_discards": [
                {
                    "tile": "9m",
                    "score": 0.77,
                    "ukeire_estimate": 18,
                    "safety_hint": "medium",
                    "reason": "孤张幺九且对当前主线改善较弱",
                }
            ],
            "attack_defense_bias": "slightly_defensive",
        },
    )

    decision = build_decision(state)

    assert decision.decision_type == "tile_efficiency_hint"
    assert decision.mahjong_analysis["shanten_estimate"] == 1
    assert decision.mahjong_analysis["ukeire_estimate"] == 18
    assert decision.mahjong_analysis["candidate_discards"][0]["tile"] == "9m"
    assert decision.suggestion.startswith("优先考虑处理 9m")


def test_generate_review_summary_builds_readable_summary(tmp_path: Path) -> None:
    cache_dir = tmp_path / "session_cache"
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

    summary, summary_path = generate_review_summary(cache_dir, session_id="mahjong-test")

    assert summary["session_id"] == "mahjong-test"
    assert summary["source_candidate_count"] == 2
    assert summary["highlights"]
    assert summary["risk_points"]
    assert summary["coach_note"]
    assert "mahjong_high_value_timing" in summary["memory_bridge_candidates"]
    assert "mahjong_tile_efficiency" in summary["memory_bridge_candidates"]
    assert summary_path.exists()


@pytest.mark.asyncio
async def test_orchestrator_generate_review_summary_updates_state(tmp_path: Path) -> None:
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
                    }
                ]
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    orchestrator = SessionOrchestrator(plugin)

    result = await orchestrator.generate_review_summary()
    latest = await orchestrator.get_last_review_summary()

    assert result.value["ok"] is True
    assert result.value["source_candidate_count"] == 1
    assert latest.value["ok"] is True
    assert latest.value["data"]["highlights"]
    assert orchestrator.state.last_review_summary_ok is True
    assert orchestrator.state.last_review_summary_text
    assert plugin.statuses[-1]["last_review_summary_ok"] is True


@pytest.mark.asyncio
async def test_orchestrator_generate_review_summary_returns_clear_error_without_candidates(tmp_path: Path) -> None:
    plugin = _FakePlugin(tmp_path)
    orchestrator = SessionOrchestrator(plugin)

    result = await orchestrator.generate_review_summary()

    assert result.value["ok"] is False
    assert "review candidates file not found" in result.value["error"]
    assert orchestrator.state.last_review_summary_ok is False


@pytest.mark.asyncio
async def test_orchestrator_generate_review_summary_from_file_accepts_custom_path(tmp_path: Path) -> None:
    plugin = _FakePlugin(tmp_path)
    custom_path = tmp_path / "custom-review-candidates.json"
    custom_path.write_text(
        json.dumps(
            {
                "items": [
                    {
                        "captured_at": "2026-04-15T00:00:00+00:00",
                        "scene": "in_match",
                        "decision_type": "tile_efficiency_hint",
                        "priority": 66,
                        "risk_level": "low",
                        "summary": "这一巡更适合先走稳一点的牌效率路线。",
                        "recommended_focus": "tile_efficiency",
                        "review_tags": ["tile_efficiency", "mid_round_choice"],
                    }
                ]
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    orchestrator = SessionOrchestrator(plugin)

    result = await orchestrator.generate_review_summary_from_file(str(custom_path))

    assert result.value["ok"] is True
    assert result.value["source_path"] == str(custom_path)
    assert result.value["coach_note"]
    assert orchestrator.state.last_review_summary_ok is True
