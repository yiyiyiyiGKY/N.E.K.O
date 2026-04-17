from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class CalibrationOffsets:
    x_px: int = 0
    y_px: int = 0
    width_px: int = 0
    height_px: int = 0

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class CalibrationProfile:
    profile_id: str = "default"
    version: str = "v8-preview"
    source: str = "builtin"
    enabled: bool = False
    screen_width: int = 0
    screen_height: int = 0
    confidence: float = 0.0
    hand_offsets: CalibrationOffsets = field(default_factory=CalibrationOffsets)
    meld_offsets: CalibrationOffsets = field(default_factory=CalibrationOffsets)
    dora_offsets: CalibrationOffsets = field(default_factory=CalibrationOffsets)
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["hand_offsets"] = self.hand_offsets.to_dict()
        payload["meld_offsets"] = self.meld_offsets.to_dict()
        payload["dora_offsets"] = self.dora_offsets.to_dict()
        return payload


def build_default_calibration_profile(width: int, height: int) -> CalibrationProfile:
    return CalibrationProfile(
        profile_id=f"default-{width}x{height}",
        version="v8-preview",
        source="builtin",
        enabled=False,
        screen_width=max(0, int(width)),
        screen_height=max(0, int(height)),
        confidence=0.18,
        notes=[
            "using builtin fallback calibration",
            "tile-level parsing should stay in degraded mode until a tuned profile is provided",
        ],
    )


def load_calibration_profile(path: Path) -> CalibrationProfile:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("calibration profile payload is not a JSON object")
    return CalibrationProfile(
        profile_id=str(payload.get("profile_id", path.stem)).strip() or path.stem,
        version=str(payload.get("version", "v8-preview")).strip() or "v8-preview",
        source=str(payload.get("source", str(path))).strip() or str(path),
        enabled=bool(payload.get("enabled", True)),
        screen_width=int(payload.get("screen_width", 0) or 0),
        screen_height=int(payload.get("screen_height", 0) or 0),
        confidence=float(payload.get("confidence", 0.0) or 0.0),
        hand_offsets=_load_offsets(payload.get("hand_offsets")),
        meld_offsets=_load_offsets(payload.get("meld_offsets")),
        dora_offsets=_load_offsets(payload.get("dora_offsets")),
        notes=_load_notes(payload.get("notes")),
    )


def resolve_calibration_profile(
    width: int,
    height: int,
    *,
    calibration_dir: Path | None = None,
) -> CalibrationProfile:
    if calibration_dir is not None and calibration_dir.exists():
        exact = calibration_dir / f"{width}x{height}.json"
        if exact.exists():
            return load_calibration_profile(exact)

        fallback = calibration_dir / "default.json"
        if fallback.exists():
            return load_calibration_profile(fallback)

    return build_default_calibration_profile(width, height)


def _load_offsets(value: Any) -> CalibrationOffsets:
    if not isinstance(value, dict):
        return CalibrationOffsets()
    return CalibrationOffsets(
        x_px=int(value.get("x_px", 0) or 0),
        y_px=int(value.get("y_px", 0) or 0),
        width_px=int(value.get("width_px", 0) or 0),
        height_px=int(value.get("height_px", 0) or 0),
    )


def _load_notes(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]
