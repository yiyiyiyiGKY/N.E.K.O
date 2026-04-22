from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ..contracts import DecisionResult, PerceivedGameState
from ..session_state import now_iso


def build_game_private_record(
    candidate: dict[str, Any] | None,
    decision: DecisionResult,
    perceived: PerceivedGameState,
) -> dict[str, Any]:
    """Build raw game-side memory record that should stay private to game runtime."""
    return {
        "captured_at": str((candidate or {}).get("captured_at") or now_iso()),
        "session_id": str((candidate or {}).get("session_id", "")),
        "scene": decision.scene,
        "decision_type": decision.decision_type,
        "priority": decision.priority,
        "risk_level": decision.risk_level,
        "recommended_focus": decision.recommended_focus,
        "summary": decision.summary,
        "detail": decision.detail,
        "suggestion": decision.suggestion,
        "reason_codes": list(decision.reason_codes),
        "review_tags": list(decision.review_tags),
        "analysis_hints": dict(perceived.analysis_hints),
        "raw_detections": list(perceived.raw_detections),
        "hand_tiles": list(perceived.hand_tiles),
        "melds": list(perceived.melds),
        "riichi_players": list(perceived.riichi_players),
        "source_frame_path": str((candidate or {}).get("frame_path", "")),
        "source_review_dedupe_key": str((candidate or {}).get("dedupe_key", "")),
    }


def append_game_private_memory(
    cache_dir: Path,
    record: dict[str, Any],
    *,
    limit: int = 400,
) -> Path:
    path = cache_dir / "game_private_memory.json"
    payload = _load_json_payload(path, default={"updated_at": "", "items": []})
    items = payload.get("items", [])
    if not isinstance(items, list):
        items = []
        payload["items"] = items

    items.append(record)
    if len(items) > max(1, int(limit)):
        payload["items"] = items[-max(1, int(limit)):]

    payload["updated_at"] = now_iso()
    cache_dir.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def build_public_memory_projection(summary: dict[str, Any]) -> dict[str, Any]:
    """Project memory payload down to host-safe fields by default."""
    tags_raw = summary.get("summary_tags")
    tags = []
    if isinstance(tags_raw, list):
        for item in tags_raw:
            tag = str(item).strip()
            if tag and tag not in tags:
                tags.append(tag)

    coach_note = str(summary.get("coach_note", "")).strip()
    if not coach_note:
        summary_text = str(summary.get("summary_text", "")).strip()
        coach_note = summary_text[:120].strip()

    return {
        "summary_tags": tags,
        "coach_note": coach_note,
    }


def _load_json_payload(path: Path, *, default: dict[str, Any]) -> dict[str, Any]:
    if not path.exists():
        return dict(default)
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return dict(default)
    if not isinstance(payload, dict):
        return dict(default)
    return payload
