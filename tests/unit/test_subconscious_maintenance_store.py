import json
import sqlite3
from pathlib import Path

import pytest

from utils.subconscious_maintenance_store import (
    SCHEMA_VERSION,
    SubconsciousMaintenanceStore,
)


class _FakeConfigManager:
    def __init__(self, root: Path):
        self.app_docs_dir = root / "N.E.K.O"

    @property
    def game_saves_dir(self) -> Path:
        return self.app_docs_dir / "game_saves"

    @property
    def subconscious_maintenance_save_dir(self) -> Path:
        return self.game_saves_dir / "subconscious_maintenance"

    def ensure_subconscious_maintenance_save_directory(self) -> bool:
        self.subconscious_maintenance_save_dir.mkdir(parents=True, exist_ok=True)
        return True


@pytest.mark.unit
@pytest.mark.asyncio
async def test_subconscious_maintenance_store_creates_selected_root_db_and_is_idempotent(tmp_path):
    store = SubconsciousMaintenanceStore(_FakeConfigManager(tmp_path))

    db_path = await store.ensure_initialized()
    db_path_again = await store.ensure_initialized()

    assert db_path == tmp_path / "N.E.K.O" / "game_saves" / "subconscious_maintenance" / "subconscious_maintenance.db"
    assert db_path_again == db_path
    assert db_path.exists()

    with sqlite3.connect(str(db_path)) as conn:
        schema_version = conn.execute(
            "SELECT value FROM sm_meta WHERE key = 'schema_version'"
        ).fetchone()
        assert schema_version == (str(SCHEMA_VERSION),)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_subconscious_maintenance_store_persists_minimal_structured_run_history(tmp_path):
    store = SubconsciousMaintenanceStore(_FakeConfigManager(tmp_path))

    await store.record_run_started({
        "run_id": "run-1",
        "session_id": "run-1",
        "lanlan_name": "Lan",
        "game_type": "subconscious_maintenance",
        "source": "memory_browser",
        "difficulty": "hard",
        "weapon": "bow",
        "started_at": 1_700_000_000,
        "stats": {
            "difficulty": "hard",
            "weapon": "bow",
            "stability": 77,
            "textRaw": "不要保存我",
            "userVoiceText": "这也是全文",
        },
    })
    await store.record_run_ended({
        "run_id": "run-1",
        "session_id": "run-1",
        "lanlan_name": "Lan",
        "game_type": "subconscious_maintenance",
        "source": "memory_browser",
        "difficulty": "hard",
        "weapon": "bow",
        "started_at": 1_700_000_000,
        "ended_at": 1_700_000_042,
        "result": "success",
        "exit_reason": "success",
        "duration_ms": 42_000,
        "stats": {
            "difficulty": "hard",
            "weapon": "bow",
            "stability": 63,
            "specialItems": 5,
            "combo": 9,
            "line": "NEKO 原话也不该进存档",
            "userText": "玩家文本也不该进存档",
        },
    })

    with sqlite3.connect(str(store.db_path)) as conn:
        row = conn.execute(
            """
            SELECT run_id, source, difficulty, weapon, result, exit_reason, duration_ms, stats_json
            FROM sm_runs
            WHERE run_id = 'run-1'
            """
        ).fetchone()

    assert row[:7] == ("run-1", "memory_browser", "hard", "bow", "success", "success", 42_000)
    stats = json.loads(row[7])
    assert stats == {
        "difficulty": "hard",
        "weapon": "bow",
        "stability": 63,
        "specialItems": 5,
        "combo": 9,
    }
    serialized = json.dumps(stats, ensure_ascii=False)
    assert "不要保存我" not in serialized
    assert "全文" not in serialized
    assert "原话" not in serialized
    assert "玩家文本" not in serialized
