from __future__ import annotations

from copy import deepcopy
from typing import Any


DEFAULT_CONFIG: dict[str, Any] = {
    "mahjong_companion": {
        "default_mode": "teaching",
        "sample_interval_ms": 1200,
        "target_window_title_keywords": ["雀魂", "Mahjong Soul"],
        "capture": {
            "prefer_active_window": True,
            "save_format": "png",
        },
        "frame_change_gate": {
            "enabled": True,
            "min_change_distance": 3,
            "stable_skip_limit": 300,
        },
        "perception": {
            "enabled": True,
            "debug_dump": True,
        },
        "decision": {
            "enabled": True,
            "debug_dump": True,
        },
        "narration": {
            "enabled": True,
            "debug_dump": True,
        },
        "speech_policy": {
            "voice_enabled": True,
            "voice_mode": "key_events_only",
            "normal_channel": "silent_ui",
            "normal_voice_cooldown_sec": 18,
            "danger_voice_cooldown_sec": 5,
            "normal_notification_cooldown_sec": 18,
            "danger_notification_cooldown_sec": 5,
            "dedupe_window_sec": 8,
            "auto_dispatch_enabled": True,
            "target_lanlan": "",
        },
        "action_policy": {
            "mode": "off",
            "allowed_contexts": ["menu", "replay", "custom_room"],
        },
        "human_override_guard": {
            "enabled": True,
            "active_window_sec": 1.5,
            "movement_threshold_px": 18,
            "abort_on_human_input": True,
        },
        "memory_bridge": {
            "enabled": True,
            "min_priority": 75,
            "max_memories_per_day": 3,
            "dedupe_window_sec": 21600,
            "host_memory_bucket_id": "mahjong_companion_coaching",
            "host_sync_batch_size": 5,
        },
        "coaching": {
            "history_limit": 24,
            "trend_window_sessions": 3,
            "topic_limit": 3,
        },
    }
}


def merge_runtime_config(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    merged = deepcopy(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = merge_runtime_config(merged[key], value)
        else:
            merged[key] = value
    return merged
