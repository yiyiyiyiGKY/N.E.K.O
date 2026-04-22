from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Literal


RuntimeMode = Literal["active", "standby", "off"]
RuntimeCommandAction = Literal[
    "refresh_status",
    "set_mode",
    "set_runtime_mode",
    "summarize_review",
    "sync_memory",
    "dispatch_current_narration",
    "explain_current_hand",
]

# D1 固化协议：猫娘->游戏可打断；游戏->猫娘只排队；standby 不操作但可整理。
RUNTIME_HARD_RULES: dict[str, str] = {
    "catgirl_to_game_interruptible": "catgirl->game inbound command MAY interrupt queued game command(s).",
    "game_to_catgirl_queue_only": "game->catgirl outbound event MUST be enqueued before dispatch.",
    "standby_no_game_actions": "standby MUST block game actions but still allow status/review/memory housekeeping.",
}


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
    hand_tiles: list[str] = field(default_factory=list)
    melds: list[list[str]] = field(default_factory=list)
    dora_indicators: list[str] = field(default_factory=list)
    riichi_players: list[str] = field(default_factory=list)
    raw_detections: list[dict[str, Any]] = field(default_factory=list)
    analysis_hints: dict[str, Any] = field(default_factory=dict)

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
    review_summary_snippet: str = ""
    mahjong_analysis: dict[str, Any] = field(default_factory=dict)
    engine_meta: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class MahjongAnalysis:
    analysis_version: str = "mahjong-lite-v1"
    tile_level_available: bool = False
    tile_level_state: str = "tile_level_unavailable"
    analysis_confidence: float = 0.0
    hand_shape_confidence: float = 0.0
    shanten_estimate: int | None = None
    ukeire_estimate: int | None = None
    candidate_discards: list[dict[str, Any]] = field(default_factory=list)
    attack_defense_bias: str = "neutral"
    defense_alerts: list[str] = field(default_factory=list)
    teaching_points: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class AssistAction:
    action_id: str
    category: str
    label: str
    allowed_contexts: list[str] = field(default_factory=list)
    requires_confirmation: bool = True
    requires_running_session: bool = False

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class ActionExecutionResult:
    ok: bool = False
    action_id: str = ""
    executed_at: str = ""
    blocked_reason: str = ""
    guard_aborted: bool = False
    window_title: str = ""
    log_path: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class RuntimeInboundContract:
    source: str
    action: RuntimeCommandAction
    payload: dict[str, Any] = field(default_factory=dict)
    interrupt: bool = True

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class RuntimeOutboundContract:
    event_type: str
    payload: dict[str, Any] = field(default_factory=dict)
    priority: int = 0
    dedupe_key: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class RuntimeContractSnapshot:
    mode: RuntimeMode
    status: str
    inbound_pending: int
    outbound_pending: int
    dropped_inbound: int
    dropped_outbound: int
    deduped_outbound: int = 0

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
