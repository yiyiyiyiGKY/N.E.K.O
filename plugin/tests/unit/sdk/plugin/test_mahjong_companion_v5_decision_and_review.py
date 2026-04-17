from __future__ import annotations

import json
from pathlib import Path

from plugin.plugins.mahjong_companion.contracts import DecisionResult, PerceivedGameState
from plugin.plugins.mahjong_companion.decision.generator import build_decision
from plugin.plugins.mahjong_companion.review.bridge import append_review_candidate, build_review_candidate


def test_build_decision_prioritizes_win_window() -> None:
    state = PerceivedGameState(
        scene="in_match",
        confidence=0.82,
        is_user_turn=True,
        buttons=["ron", "skip"],
        notes=["bottom action bar detected"],
    )

    decision = build_decision(state)

    assert decision.decision_type == "danger_action"
    assert decision.priority >= 96
    assert decision.recommended_focus == "win_confirmation"
    assert "win_window" in decision.review_tags
    assert decision.speakable is True
    assert decision.engine_meta["engine"] == "rule_based_v2"


def test_build_decision_handles_dialog_confirmation() -> None:
    state = PerceivedGameState(
        scene="dialog",
        confidence=0.78,
        is_user_turn=True,
        buttons=["confirm", "cancel"],
        notes=["center dialog detected"],
    )

    decision = build_decision(state)

    assert decision.decision_type == "action_available"
    assert decision.recommended_focus == "dialog_confirmation"
    assert "dialog_confirm" in decision.review_tags
    assert decision.speakable is False


def test_build_decision_handles_riichi_decision() -> None:
    state = PerceivedGameState(
        scene="in_match",
        confidence=0.76,
        is_user_turn=True,
        buttons=["riichi", "skip"],
        notes=["gold accent in bottom action bar"],
    )

    decision = build_decision(state)

    assert decision.decision_type == "danger_action"
    assert decision.recommended_focus == "riichi_decision"
    assert "riichi_window" in decision.review_tags
    assert decision.speakable is True


def test_build_decision_handles_call_route_choice() -> None:
    state = PerceivedGameState(
        scene="in_match",
        confidence=0.73,
        is_user_turn=True,
        buttons=["chi", "skip"],
        notes=["green accent in bottom action bar"],
    )

    decision = build_decision(state)

    assert decision.decision_type == "action_available"
    assert decision.recommended_focus == "call_decision"
    assert "call_window" in decision.review_tags
    assert "route_choice" in decision.review_tags
    assert decision.speakable is True


def test_build_decision_suppresses_voice_when_confidence_is_low() -> None:
    state = PerceivedGameState(
        scene="in_match",
        confidence=0.31,
        is_user_turn=True,
        buttons=["chi"],
        notes=["green accent in bottom action bar"],
    )

    decision = build_decision(state)

    assert decision.decision_type == "action_available"
    assert decision.speakable is False
    assert "perception.low_confidence" in decision.reason_codes
    assert "low_confidence" in decision.review_tags


def test_review_bridge_writes_deduped_candidates(tmp_path: Path) -> None:
    decision = DecisionResult(
        decision_type="danger_action",
        priority=96,
        risk_level="high",
        action_required=True,
        speakable=True,
        summary="当前像是出现了和牌窗口。",
        detail="检测到 ron 或 tsumo 一类高价值按钮。",
        suggestion="先确认和牌条件与按钮语义。",
        recommended_focus="win_confirmation",
        scene="in_match",
        buttons=["ron"],
        reason_codes=["button.ron_visible", "turn.user_likely"],
        review_tags=["win_window", "high_value_timing"],
        engine_meta={"engine": "rule_based_v2"},
    )
    perceived = PerceivedGameState(
        scene="in_match",
        confidence=0.88,
        is_user_turn=True,
        buttons=["ron"],
        notes=["bottom action bar detected"],
    )

    candidate = build_review_candidate(Path("/tmp/frame.png"), decision, perceived)
    assert candidate is not None

    cache_dir = tmp_path / "session_cache"
    review_path = append_review_candidate(cache_dir, candidate)
    append_review_candidate(cache_dir, candidate)

    payload = json.loads(review_path.read_text(encoding="utf-8"))

    assert len(payload["items"]) == 1
    assert payload["items"][0]["recommended_focus"] == "win_confirmation"
    assert payload["items"][0]["review_tags"] == ["win_window", "high_value_timing"]


def test_review_bridge_allows_later_same_kind_event_outside_dedupe_window(tmp_path: Path) -> None:
    base_candidate = {
        "captured_at": "2026-04-15T00:00:00+00:00",
        "frame_path": "/tmp/frame-1.png",
        "scene": "in_match",
        "decision_type": "danger_action",
        "priority": 96,
        "risk_level": "high",
        "summary": "当前像是出现了和牌窗口。",
        "detail": "检测到 ron 按钮。",
        "suggestion": "先确认和牌条件与按钮语义。",
        "recommended_focus": "win_confirmation",
        "buttons": ["ron"],
        "reason_codes": ["button.ron_visible"],
        "review_tags": ["win_window"],
        "perception_confidence": 0.88,
        "perception_notes": ["bottom action bar detected"],
        "dedupe_key": "danger_action|in_match|ron|win_window",
    }

    cache_dir = tmp_path / "session_cache"
    review_path = append_review_candidate(cache_dir, dict(base_candidate))
    later_candidate = dict(base_candidate)
    later_candidate["captured_at"] = "2026-04-15T00:00:30+00:00"
    later_candidate["frame_path"] = "/tmp/frame-2.png"
    append_review_candidate(cache_dir, later_candidate)

    payload = json.loads(review_path.read_text(encoding="utf-8"))

    assert len(payload["items"]) == 2
    assert payload["items"][1]["frame_path"] == "/tmp/frame-2.png"
