from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_iso(value: str) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)
    except Exception:
        return None


@dataclass
class RuntimeOutboxMessage:
    message_id: str
    event_type: str
    payload: dict[str, Any] = field(default_factory=dict)
    priority: int = 0
    dedupe_key: str = ""
    created_at: str = field(default_factory=_now_iso)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class RuntimeOutbox:
    """Game -> catgirl queue with priority, throttle and dedupe semantics."""

    def __init__(
        self,
        *,
        max_pending: int = 128,
        dedupe_window_sec: int = 8,
        throttle_per_tick: int = 1,
    ) -> None:
        self._max_pending = max(1, int(max_pending))
        self._dedupe_window_sec = max(0, int(dedupe_window_sec))
        self._throttle_per_tick = max(1, int(throttle_per_tick))
        self._queue: list[RuntimeOutboxMessage] = []
        self._dropped = 0
        self._deduped = 0
        self._last_message_id = ""
        self._last_sent_at_by_key: dict[str, str] = {}

    @property
    def throttle_per_tick(self) -> int:
        return self._throttle_per_tick

    def enqueue(
        self,
        *,
        event_type: str,
        payload: dict[str, Any] | None = None,
        priority: int = 0,
        dedupe_key: str = "",
    ) -> RuntimeOutboxMessage | None:
        normalized_key = str(dedupe_key).strip()
        now = datetime.now(timezone.utc)

        if normalized_key:
            for item in self._queue:
                if item.dedupe_key == normalized_key:
                    self._deduped += 1
                    return None

        if normalized_key and self._dedupe_window_sec > 0:
            sent_at = _parse_iso(self._last_sent_at_by_key.get(normalized_key, ""))
            if sent_at is not None:
                delta = (now - sent_at).total_seconds()
                if delta < self._dedupe_window_sec:
                    self._deduped += 1
                    return None

        message = RuntimeOutboxMessage(
            message_id=f"outbound-{uuid4().hex[:12]}",
            event_type=str(event_type).strip() or "runtime_event",
            payload=dict(payload or {}),
            priority=int(priority),
            dedupe_key=normalized_key,
            created_at=now.isoformat(),
        )

        if len(self._queue) >= self._max_pending:
            self._queue.pop(0)
            self._dropped += 1

        self._queue.append(message)
        self._last_message_id = message.message_id
        return message

    def pop_batch(self, *, limit: int | None = None) -> list[RuntimeOutboxMessage]:
        if not self._queue:
            return []
        max_items = self._throttle_per_tick if limit is None else max(1, int(limit))
        max_items = min(max_items, len(self._queue))
        selected: list[RuntimeOutboxMessage] = []

        for _ in range(max_items):
            best_index = 0
            best_message = self._queue[0]
            best_created = _parse_iso(best_message.created_at) or datetime.min.replace(tzinfo=timezone.utc)

            for index, item in enumerate(self._queue[1:], start=1):
                item_created = _parse_iso(item.created_at) or datetime.min.replace(tzinfo=timezone.utc)
                if item.priority > best_message.priority:
                    best_index = index
                    best_message = item
                    best_created = item_created
                    continue
                if item.priority == best_message.priority and item_created < best_created:
                    best_index = index
                    best_message = item
                    best_created = item_created

            selected.append(self._queue.pop(best_index))

        for item in selected:
            if item.dedupe_key:
                self._last_sent_at_by_key[item.dedupe_key] = _now_iso()

        return selected

    def clear(self) -> None:
        self._queue.clear()

    def snapshot(self) -> dict[str, Any]:
        return {
            "pending": len(self._queue),
            "dropped": self._dropped,
            "deduped": self._deduped,
            "last_message_id": self._last_message_id,
            "max_pending": self._max_pending,
            "throttle_per_tick": self._throttle_per_tick,
            "dedupe_window_sec": self._dedupe_window_sec,
        }
