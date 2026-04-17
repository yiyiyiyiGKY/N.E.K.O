"""Action log: record and query assist-action audit entries."""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


@dataclass
class ActionLogEntry:
    action_id: str
    executed_at: str
    ok: bool
    blocked_reason: str = ""
    guard_aborted: bool = False
    window_title: str = ""
    trigger_source: str = "manual"
    allow_reason: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def append_action_log(
    cache_dir: Path,
    entry: ActionLogEntry,
    *,
    max_entries: int = 200,
) -> Path:
    """Append an action log entry to action_log.json, capped at max_entries."""
    cache_dir.mkdir(parents=True, exist_ok=True)
    log_path = cache_dir / "action_log.json"

    entries: list[dict[str, Any]] = []
    if log_path.exists():
        try:
            raw = json.loads(log_path.read_text(encoding="utf-8"))
            if isinstance(raw, list):
                entries = raw
        except (json.JSONDecodeError, OSError):
            entries = []

    entries.append(entry.to_dict())
    if len(entries) > max_entries:
        entries = entries[-max_entries:]

    log_path.write_text(
        json.dumps(entries, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return log_path


def load_action_log(cache_dir: Path) -> list[dict[str, Any]]:
    """Load all action log entries from cache_dir/action_log.json."""
    log_path = cache_dir / "action_log.json"
    if not log_path.exists():
        return []
    try:
        raw = json.loads(log_path.read_text(encoding="utf-8"))
        if isinstance(raw, list):
            return raw
    except (json.JSONDecodeError, OSError):
        pass
    return []


def clear_action_log(cache_dir: Path) -> bool:
    """Delete the action log file. Returns True if the file existed and was removed."""
    log_path = cache_dir / "action_log.json"
    if log_path.exists():
        log_path.unlink()
        return True
    return False
