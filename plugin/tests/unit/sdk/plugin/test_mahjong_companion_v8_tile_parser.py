from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

from plugin.plugins.mahjong_companion.contracts import PerceivedGameState
from plugin.plugins.mahjong_companion.decision.generator import build_decision
from plugin.plugins.mahjong_companion.perception.calibration import resolve_calibration_profile
from plugin.plugins.mahjong_companion.perception.tile_parser import enrich_perceived_state_with_tiles, parse_tiles_from_image


def test_resolve_calibration_profile_returns_builtin_fallback_when_missing() -> None:
    profile = resolve_calibration_profile(1280, 720)

    assert profile.profile_id == "default-1280x720"
    assert profile.enabled is False
    assert profile.confidence == 0.18


def test_parse_tiles_from_image_uses_fixture_and_marks_reliable(tmp_path: Path) -> None:
    image_path = tmp_path / "fixture-frame.png"
    Image.new("RGB", (1280, 720), color=(40, 80, 140)).save(image_path)
    (tmp_path / "fixture-frame-tiles.json").write_text(
        json.dumps(
            {
                "hand_tiles": ["1m", "2m", "3m", "4p", "5p", "6p", "7s", "8s", "9s", "1z", "1z", "9m", "5z"],
                "dora_indicators": ["4p"],
                "analysis_confidence": 0.83,
                "tile_level_state": "tile_level_reliable",
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    with Image.open(image_path) as image:
        parsed = parse_tiles_from_image(
            image_path,
            image.convert("RGB"),
            scene="in_match",
            metrics={"bottom_hand_area": {"colorful_ratio": 0.58}},
        )

    assert parsed.hand_tiles[:3] == ["1m", "2m", "3m"]
    assert parsed.analysis_hints["tile_level_available"] is True
    assert parsed.analysis_hints["tile_level_state"] == "tile_level_reliable"
    assert parsed.analysis_hints["analysis_confidence"] == 0.83


def test_enrich_perceived_state_with_tiles_emits_partial_hints_without_fixture(tmp_path: Path) -> None:
    image_path = tmp_path / "partial-frame.png"
    image = Image.new("RGB", (1280, 720), color=(80, 120, 180))
    image.save(image_path)
    perceived = PerceivedGameState(
        scene="in_match",
        confidence=0.84,
        is_user_turn=True,
    )

    enriched = enrich_perceived_state_with_tiles(
        perceived,
        image_path,
        image,
        metrics={"bottom_hand_area": {"colorful_ratio": 0.51}},
    )

    assert enriched.analysis_hints["tile_level_state"] == "tile_level_partial"
    assert enriched.analysis_hints["tile_level_available"] is False
    assert enriched.analysis_hints["analysis_version"] == "mahjong-core-v1"
    assert enriched.raw_detections


def test_build_decision_propagates_v8_analysis_confidence_and_tile_level_state() -> None:
    state = PerceivedGameState(
        scene="in_match",
        confidence=0.88,
        is_user_turn=True,
        hand_tiles=["1m", "2m", "3m", "4p", "5p", "6p", "7s", "8s", "9s", "1z", "1z", "9m", "5z"],
        dora_indicators=["4p"],
        analysis_hints={
            "analysis_confidence": 0.85,
            "tile_level_state": "tile_level_reliable",
        },
    )

    decision = build_decision(state)

    assert decision.mahjong_analysis["analysis_confidence"] == 0.85
    assert decision.mahjong_analysis["tile_level_state"] == "tile_level_reliable"
    assert decision.engine_meta["analysis_confidence"] == 0.85
    assert decision.engine_meta["tile_level_state"] == "tile_level_reliable"


def test_build_decision_exposes_v8_defense_alerts_under_riichi_pressure() -> None:
    state = PerceivedGameState(
        scene="in_match",
        confidence=0.86,
        is_user_turn=True,
        hand_tiles=["1m", "2m", "3m", "4p", "5p", "6p", "7s", "8s", "9s", "1z", "1z", "9m", "5z"],
        dora_indicators=["4p"],
        riichi_players=["right_opponent"],
        analysis_hints={
            "analysis_confidence": 0.82,
            "tile_level_state": "tile_level_reliable",
        },
    )

    decision = build_decision(state)

    assert decision.mahjong_analysis["defense_alerts"]
    assert "立直" in decision.mahjong_analysis["defense_alerts"][0]
    assert decision.engine_meta["defense_alert_count"] >= 1
