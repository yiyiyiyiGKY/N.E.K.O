# -*- coding: utf-8 -*-
from __future__ import annotations

import asyncio
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from utils.config_manager import get_config_manager


SCHEMA_VERSION = 1
DB_FILENAME = "subconscious_maintenance.db"
_RUN_ALLOWED_STATS_KEYS = {
    "difficulty",
    "phase",
    "stability",
    "specialItems",
    "wormsCleared",
    "fragmentsCollected",
    "combo",
    "activeBuff",
    "buffSecondsRemaining",
    "fragmentBuffProgress",
    "weapon",
    "nekoMode",
    "nekoIntent",
    "enemies",
    "fragments",
    "droppedSpecialItems",
    "voiceOutputEnabled",
}


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _timestamp_to_iso(value: Any) -> str:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return _utc_now_iso()
    return datetime.fromtimestamp(max(0.0, number), tz=timezone.utc).isoformat(timespec="seconds")


def _normalize_text(value: Any, *, default: str = "", max_chars: int = 120) -> str:
    text = str(value or "").strip()
    if not text:
        return default
    return text[:max_chars]


def _normalize_int(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _normalize_stats(value: Any) -> dict[str, Any]:
    raw = value if isinstance(value, dict) else {}
    safe: dict[str, Any] = {}
    for key in _RUN_ALLOWED_STATS_KEYS:
        if key not in raw:
            continue
        item = raw.get(key)
        if isinstance(item, bool):
            safe[key] = item
        elif isinstance(item, (int, float)):
            safe[key] = item
        elif isinstance(item, str):
            safe[key] = item[:120]
        elif item is None:
            safe[key] = None
    return safe


class SubconsciousMaintenanceStore:
    def __init__(self, config_manager=None):
        self._config_manager = config_manager or get_config_manager()

    @property
    def save_dir(self) -> Path:
        return Path(self._config_manager.subconscious_maintenance_save_dir)

    @property
    def db_path(self) -> Path:
        return self.save_dir / DB_FILENAME

    async def ensure_initialized(self) -> Path:
        return await asyncio.to_thread(self._ensure_initialized_sync)

    async def record_run_started(self, payload: dict[str, Any]) -> dict[str, Any]:
        return await asyncio.to_thread(self._record_run_started_sync, dict(payload or {}))

    async def record_run_ended(self, payload: dict[str, Any]) -> dict[str, Any]:
        return await asyncio.to_thread(self._record_run_ended_sync, dict(payload or {}))

    def _ensure_initialized_sync(self) -> Path:
        if not self._config_manager.ensure_subconscious_maintenance_save_directory():
            raise RuntimeError("subconscious_maintenance_save_directory_unavailable")
        db_path = self.db_path
        with sqlite3.connect(str(db_path), timeout=5.0) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS sm_meta (
                  key TEXT PRIMARY KEY,
                  value TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS sm_runs (
                  run_id TEXT PRIMARY KEY,
                  game_type TEXT NOT NULL,
                  lanlan_name TEXT NOT NULL,
                  session_id TEXT NOT NULL,
                  source TEXT NOT NULL,
                  difficulty TEXT NOT NULL,
                  weapon TEXT NOT NULL,
                  started_at TEXT NOT NULL,
                  ended_at TEXT,
                  result TEXT NOT NULL,
                  exit_reason TEXT NOT NULL,
                  duration_ms INTEGER,
                  stats_json TEXT NOT NULL,
                  created_at TEXT NOT NULL,
                  updated_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                INSERT INTO sm_meta(key, value)
                VALUES('schema_version', ?)
                ON CONFLICT(key) DO UPDATE SET value=excluded.value
                """,
                (str(SCHEMA_VERSION),),
            )
            conn.commit()
        return db_path

    def _record_run_started_sync(self, payload: dict[str, Any]) -> dict[str, Any]:
        self._ensure_initialized_sync()
        now_iso = _utc_now_iso()
        run_id = _normalize_text(payload.get("run_id") or payload.get("session_id"), max_chars=120)
        if not run_id:
            raise ValueError("missing_run_id")
        session_id = _normalize_text(payload.get("session_id") or run_id, max_chars=120)
        lanlan_name = _normalize_text(payload.get("lanlan_name"), max_chars=120)
        game_type = _normalize_text(payload.get("game_type"), default="subconscious_maintenance", max_chars=64)
        source = _normalize_text(payload.get("source"), default="direct", max_chars=64)
        difficulty = _normalize_text(payload.get("difficulty"), default="easy", max_chars=32)
        weapon = _normalize_text(payload.get("weapon"), default="sword", max_chars=32)
        started_at = _timestamp_to_iso(payload.get("started_at"))
        stats_json = json.dumps(_normalize_stats(payload.get("stats")), ensure_ascii=False, separators=(",", ":"))

        with sqlite3.connect(str(self.db_path), timeout=5.0) as conn:
            conn.execute(
                """
                INSERT INTO sm_runs(
                  run_id, game_type, lanlan_name, session_id, source, difficulty, weapon,
                  started_at, ended_at, result, exit_reason, duration_ms, stats_json, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, '', '', NULL, ?, ?, ?)
                ON CONFLICT(run_id) DO UPDATE SET
                  game_type=excluded.game_type,
                  lanlan_name=excluded.lanlan_name,
                  session_id=excluded.session_id,
                  source=excluded.source,
                  difficulty=excluded.difficulty,
                  weapon=excluded.weapon,
                  stats_json=excluded.stats_json,
                  updated_at=excluded.updated_at
                """,
                (
                    run_id,
                    game_type,
                    lanlan_name,
                    session_id,
                    source,
                    difficulty,
                    weapon,
                    started_at,
                    stats_json,
                    now_iso,
                    now_iso,
                ),
            )
            conn.commit()
        return {"ok": True, "run_id": run_id, "db_path": str(self.db_path), "action": "run_started"}

    def _record_run_ended_sync(self, payload: dict[str, Any]) -> dict[str, Any]:
        self._ensure_initialized_sync()
        now_iso = _utc_now_iso()
        run_id = _normalize_text(payload.get("run_id") or payload.get("session_id"), max_chars=120)
        if not run_id:
            raise ValueError("missing_run_id")
        session_id = _normalize_text(payload.get("session_id") or run_id, max_chars=120)
        lanlan_name = _normalize_text(payload.get("lanlan_name"), max_chars=120)
        game_type = _normalize_text(payload.get("game_type"), default="subconscious_maintenance", max_chars=64)
        source = _normalize_text(payload.get("source"), default="direct", max_chars=64)
        difficulty = _normalize_text(payload.get("difficulty"), default="easy", max_chars=32)
        weapon = _normalize_text(payload.get("weapon"), default="sword", max_chars=32)
        started_at = _timestamp_to_iso(payload.get("started_at"))
        ended_at = _timestamp_to_iso(payload.get("ended_at"))
        result = _normalize_text(payload.get("result"), default="ended", max_chars=32)
        exit_reason = _normalize_text(payload.get("exit_reason"), default=result, max_chars=64)
        duration_ms = _normalize_int(payload.get("duration_ms"))
        stats_json = json.dumps(_normalize_stats(payload.get("stats")), ensure_ascii=False, separators=(",", ":"))

        with sqlite3.connect(str(self.db_path), timeout=5.0) as conn:
            conn.execute(
                """
                INSERT INTO sm_runs(
                  run_id, game_type, lanlan_name, session_id, source, difficulty, weapon,
                  started_at, ended_at, result, exit_reason, duration_ms, stats_json, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(run_id) DO UPDATE SET
                  game_type=excluded.game_type,
                  lanlan_name=excluded.lanlan_name,
                  session_id=excluded.session_id,
                  source=excluded.source,
                  difficulty=excluded.difficulty,
                  weapon=excluded.weapon,
                  ended_at=excluded.ended_at,
                  result=excluded.result,
                  exit_reason=excluded.exit_reason,
                  duration_ms=excluded.duration_ms,
                  stats_json=excluded.stats_json,
                  updated_at=excluded.updated_at
                """,
                (
                    run_id,
                    game_type,
                    lanlan_name,
                    session_id,
                    source,
                    difficulty,
                    weapon,
                    started_at,
                    ended_at,
                    result,
                    exit_reason,
                    duration_ms,
                    stats_json,
                    now_iso,
                    now_iso,
                ),
            )
            conn.commit()
        return {"ok": True, "run_id": run_id, "db_path": str(self.db_path), "action": "run_ended"}


_store_singleton: SubconsciousMaintenanceStore | None = None


def get_subconscious_maintenance_store(config_manager=None) -> SubconsciousMaintenanceStore:
    global _store_singleton
    if config_manager is not None:
        return SubconsciousMaintenanceStore(config_manager)
    if _store_singleton is None:
        _store_singleton = SubconsciousMaintenanceStore()
    return _store_singleton


def reset_subconscious_maintenance_store_cache() -> None:
    global _store_singleton
    _store_singleton = None
