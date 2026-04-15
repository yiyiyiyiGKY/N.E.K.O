from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class FramePacket:
    timestamp_ms: int
    image_path: str = ""
    window_title: str = ""
    width: int = 0
    height: int = 0
    source: str = "pyautogui"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class PerceivedGameState:
    scene: str = "unknown"
    confidence: float = 0.0
    is_user_turn: bool = False
    buttons: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    roi_hits: dict[str, bool] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class DecisionResult:
    decision_type: str = "uncertain_state"
    priority: int = 0
    risk_level: str = "unknown"
    action_required: bool = False
    speakable: bool = False
    summary: str = ""
    detail: str = ""
    suggestion: str = ""
    recommended_focus: str = ""
    scene: str = "unknown"
    buttons: list[str] = field(default_factory=list)
    reason_codes: list[str] = field(default_factory=list)
    review_tags: list[str] = field(default_factory=list)
    engine_meta: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
