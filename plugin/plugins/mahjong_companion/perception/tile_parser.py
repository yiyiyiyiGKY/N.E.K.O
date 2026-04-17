from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from PIL import Image

from ..contracts import PerceivedGameState
from .calibration import CalibrationProfile, resolve_calibration_profile
from .hand_layout import TileSlot, build_hand_layout
from .roi import collect_region_metrics


@dataclass
class TileParseResult:
    hand_tiles: list[str] = field(default_factory=list)
    melds: list[list[str]] = field(default_factory=list)
    dora_indicators: list[str] = field(default_factory=list)
    riichi_players: list[str] = field(default_factory=list)
    raw_detections: list[dict[str, Any]] = field(default_factory=list)
    analysis_hints: dict[str, Any] = field(default_factory=dict)

    def to_state_updates(self) -> dict[str, Any]:
        return {
            "hand_tiles": list(self.hand_tiles),
            "melds": [list(group) for group in self.melds],
            "dora_indicators": list(self.dora_indicators),
            "riichi_players": list(self.riichi_players),
            "raw_detections": list(self.raw_detections),
            "analysis_hints": dict(self.analysis_hints),
        }


def parse_tiles_from_image(
    image_path: Path,
    image: Image.Image,
    *,
    scene: str,
    metrics: dict[str, dict[str, Any]],
    calibration_dir: Path | None = None,
) -> TileParseResult:
    width, height = image.size
    calibration = resolve_calibration_profile(width, height, calibration_dir=calibration_dir)
    layout = build_hand_layout(width, height, calibration=calibration)
    fixture = _load_fixture(image_path)
    base_state = _classify_tile_level_state(scene=scene, metrics=metrics, calibration=calibration)

    if fixture is not None:
        return _from_fixture(fixture, calibration=calibration, layout=layout, base_state=base_state)

    slot_metrics = _collect_slot_metrics(image, layout["hand"][:14])
    confidence = 0.42 if base_state == "tile_level_partial" else 0.0
    raw_detections = [
        {
            "slot_id": item["slot_id"],
            "group": "hand",
            "candidate_tile": "",
            "confidence": 0.0,
            "box": item["box"],
            "slot_mean_luma": item["slot_mean_luma"],
            "slot_colorful_ratio": item["slot_colorful_ratio"],
        }
        for item in slot_metrics[:6]
    ]
    return TileParseResult(
        hand_tiles=[],
        melds=[],
        dora_indicators=[],
        riichi_players=[],
        raw_detections=raw_detections,
        analysis_hints={
            "analysis_version": "mahjong-core-v1",
            "tile_level_state": base_state,
            "tile_level_available": False,
            "analysis_confidence": confidence,
            "calibration_profile": calibration.profile_id,
            "calibration_enabled": calibration.enabled,
            "tile_parser_source": "heuristic_layout_only",
            "hand_slot_count": len(layout["hand"]),
        },
    )


def enrich_perceived_state_with_tiles(
    perceived: PerceivedGameState,
    image_path: Path,
    image: Image.Image,
    *,
    metrics: dict[str, dict[str, Any]],
    calibration_dir: Path | None = None,
) -> PerceivedGameState:
    parsed = parse_tiles_from_image(
        image_path,
        image,
        scene=perceived.scene,
        metrics=metrics,
        calibration_dir=calibration_dir,
    )
    payload = perceived.to_dict()
    payload.update(parsed.to_state_updates())
    return PerceivedGameState(**payload)


def _from_fixture(
    fixture: dict[str, Any],
    *,
    calibration: CalibrationProfile,
    layout: dict[str, list[TileSlot]],
    base_state: str,
) -> TileParseResult:
    hand_tiles = _normalize_tile_list(fixture.get("hand_tiles"))
    melds = _normalize_group_list(fixture.get("melds"))
    dora_indicators = _normalize_tile_list(fixture.get("dora_indicators"))
    riichi_players = _normalize_tile_list(fixture.get("riichi_players"))
    analysis_confidence = float(fixture.get("analysis_confidence", 0.86) or 0.86)
    tile_level_state = str(fixture.get("tile_level_state", "")).strip() or (
        "tile_level_reliable" if hand_tiles else base_state
    )
    raw_detections = fixture.get("raw_detections")
    if not isinstance(raw_detections, list):
        raw_detections = [
            {
                "slot_id": slot.slot_id,
                "group": slot.group,
                "candidate_tile": hand_tiles[index] if index < len(hand_tiles) else "",
                "confidence": analysis_confidence,
                "box": slot.box.to_dict(),
            }
            for index, slot in enumerate(layout["hand"][: len(hand_tiles)])
        ]

    return TileParseResult(
        hand_tiles=hand_tiles,
        melds=melds,
        dora_indicators=dora_indicators,
        riichi_players=riichi_players,
        raw_detections=[item for item in raw_detections if isinstance(item, dict)],
        analysis_hints={
            "analysis_version": "mahjong-core-v1",
            "tile_level_state": tile_level_state,
            "tile_level_available": bool(hand_tiles),
            "analysis_confidence": analysis_confidence,
            "calibration_profile": calibration.profile_id,
            "calibration_enabled": calibration.enabled,
            "tile_parser_source": "fixture",
        },
    )


def _classify_tile_level_state(
    *,
    scene: str,
    metrics: dict[str, dict[str, Any]],
    calibration: CalibrationProfile,
) -> str:
    hand_metrics = metrics.get("bottom_hand_area", {})
    if scene not in {"in_match", "replay"}:
        return "tile_level_unavailable"
    if not calibration.enabled:
        return "tile_level_partial"
    if float(hand_metrics.get("colorful_ratio", 0.0) or 0.0) >= 0.42:
        return "tile_level_partial"
    return "tile_level_unavailable"


def _collect_slot_metrics(image: Image.Image, slots: list[TileSlot]) -> list[dict[str, Any]]:
    metrics: list[dict[str, Any]] = []
    for slot in slots:
        slot_metrics = collect_region_metrics(image, slot.box, sample_step=4)
        metrics.append(
            {
                "slot_id": slot.slot_id,
                "box": slot.box.to_dict(),
                "slot_mean_luma": slot_metrics.get("mean_luma"),
                "slot_colorful_ratio": slot_metrics.get("colorful_ratio"),
            }
        )
    return metrics


def _load_fixture(image_path: Path) -> dict[str, Any] | None:
    candidates = [
        image_path.with_name(f"{image_path.stem}-tiles.json"),
        image_path.with_suffix(".tiles.json"),
    ]
    for candidate in candidates:
        if not candidate.exists():
            continue
        payload = json.loads(candidate.read_text(encoding="utf-8"))
        if isinstance(payload, dict):
            return payload
    return None


def _normalize_tile_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def _normalize_group_list(value: Any) -> list[list[str]]:
    if not isinstance(value, list):
        return []
    groups: list[list[str]] = []
    for item in value:
        if not isinstance(item, list):
            continue
        group = _normalize_tile_list(item)
        if group:
            groups.append(group)
    return groups
