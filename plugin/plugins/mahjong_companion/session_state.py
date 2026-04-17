from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class SessionState:
    session_id: str
    running: bool = False
    mode: str = "teaching"
    status: str = "idle"
    scene: str = "unknown"
    window_bound: bool = False
    window_title: str = ""
    window_match_keyword: str = ""
    window_left: Optional[int] = None
    window_top: Optional[int] = None
    window_width: Optional[int] = None
    window_height: Optional[int] = None
    last_frame_path: str = ""
    last_error: str = ""
    last_frame_at: str = ""
    last_capture_source: str = ""
    last_capture_ok: bool = False
    last_scene: str = "unknown"
    last_scene_confidence: float = 0.0
    last_is_user_turn: bool = False
    last_buttons: list[str] = field(default_factory=list)
    last_perception_at: str = ""
    last_perception_ok: bool = False
    last_perception: dict[str, Any] = field(default_factory=dict)
    last_decision_at: str = ""
    last_decision_ok: bool = False
    last_decision_type: str = ""
    last_decision_risk_level: str = ""
    last_tile_analysis_available: bool = False
    last_shanten_estimate: int | None = None
    last_ukeire_estimate: int | None = None
    last_decision: dict[str, Any] = field(default_factory=dict)
    last_narration_at: str = ""
    last_narration_ok: bool = False
    last_narration_type: str = ""
    last_narration_channel: str = ""
    last_narration_delivery: str = ""
    last_narration_text: str = ""
    last_narration: dict[str, Any] = field(default_factory=dict)
    last_companion_mood: str = "calm"
    last_companion_view: dict[str, Any] = field(default_factory=dict)
    voice_enabled: bool = True
    voice_mode: str = "key_events_only"
    last_notification_at: str = ""
    last_notification_text: str = ""
    last_notification_key: str = ""
    last_notification_channel: str = ""
    last_notification_delivery: str = ""
    last_notification_ok: bool = False
    last_spoken_at: str = ""
    last_spoken_text: str = ""
    last_speak_ok: bool = False
    last_human_override_armed: bool = False
    last_human_override_reason: str = "guard_inactive"
    last_human_override_at: str = ""
    last_memory_bridge_at: str = ""
    last_memory_bridge_status: str = ""
    last_memory_bridge_summary: str = ""
    last_host_memory_sync_at: str = ""
    last_host_memory_sync_status: str = ""
    last_host_memory_sync_note: str = ""
    last_host_memory_sync_pending: int = 0
    last_review_summary_at: str = ""
    last_review_summary_ok: bool = False
    last_review_summary: dict[str, Any] = field(default_factory=dict)
    last_review_summary_text: str = ""
    last_coaching_trend_at: str = ""
    last_coaching_trend: dict[str, Any] = field(default_factory=dict)
    last_coaching_summary_text: str = ""
    last_coaching_focus: str = ""
    last_coaching_topics: list[dict[str, Any]] = field(default_factory=list)
    last_action_id: str = ""
    last_action_at: str = ""
    last_action_ok: bool = False
    last_action_blocked_reason: str = ""
    last_action_guard_aborted: bool = False
    action_mode: str = "off"
    started_at: str = ""

    @classmethod
    def create(cls, mode: str = "teaching") -> "SessionState":
        return cls(session_id=f"mahjong-{uuid4().hex[:8]}", mode=mode)

    def snapshot(self) -> dict[str, Any]:
        return asdict(self)
