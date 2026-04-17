from __future__ import annotations

import argparse
import asyncio
import json
import logging
import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .config_defaults import DEFAULT_CONFIG, merge_runtime_config
from .orchestrator import SessionOrchestrator


@dataclass
class SmokeResult:
    name: str
    ok: bool
    details: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "ok": self.ok,
            "details": self.details,
        }


class _FakePlugin:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.logger = logging.getLogger("mahjong-companion-smoke")
        self.statuses: list[dict[str, object]] = []
        self.messages: list[dict[str, object]] = []

    def data_path(self, *parts: str) -> Path:
        path = self.root / "data"
        if parts:
            path = path.joinpath(*parts)
        return path

    def report_status(self, payload: dict[str, object]) -> None:
        self.statuses.append(dict(payload))

    def push_message(self, **kwargs: object) -> dict[str, object]:
        self.messages.append(dict(kwargs))
        return {"ok": True}


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _sample_frame(name: str) -> Path:
    return _repo_root() / "plugin" / "plugins" / "mahjong_companion" / "data" / "debug_samples" / name


async def run_v1_to_v9_smoke() -> dict[str, Any]:
    with tempfile.TemporaryDirectory(prefix="mahjong-companion-smoke-") as temp_dir:
        root = Path(temp_dir)
        plugin = _FakePlugin(root)
        orchestrator = SessionOrchestrator(plugin)
        orchestrator.apply_config(merge_runtime_config(DEFAULT_CONFIG, {}))

        results = [
            await _run_real_sample_sanity(orchestrator, plugin),
            await _run_action_window_case(orchestrator, plugin),
            await _run_tile_efficiency_case(orchestrator, plugin),
            await _run_assist_dry_run_case(orchestrator),
        ]

        ok = all(result.ok for result in results)
        session_cache = plugin.data_path("session_cache")
        cache_files = sorted(path.name for path in session_cache.glob("*")) if session_cache.exists() else []
        return {
            "ok": ok,
            "results": [result.to_dict() for result in results],
            "message_count": len(plugin.messages),
            "status_count": len(plugin.statuses),
            "session_cache_files": cache_files,
            "last_status": plugin.statuses[-1] if plugin.statuses else {},
        }


async def _run_real_sample_sanity(orchestrator: SessionOrchestrator, plugin: _FakePlugin) -> SmokeResult:
    source_frame = _sample_frame("20260415-071314-863534-frame.png")
    debug_dir = plugin.data_path("debug_samples")
    debug_dir.mkdir(parents=True, exist_ok=True)
    copied_frame = debug_dir / source_frame.name
    shutil.copy2(source_frame, copied_frame)

    perception = await orchestrator.analyze_frame_path(str(copied_frame))
    decision = await orchestrator.generate_decision()
    narration = await orchestrator.generate_narration()
    pipeline = await orchestrator.run_companion_pipeline(
        frame_path=str(copied_frame),
        dispatch=True,
        force_reply=True,
    )

    perception_value = perception.value
    decision_value = decision.value
    narration_value = narration.value
    pipeline_value = pipeline.value
    ok = all([
        perception_value.get("ok"),
        decision_value.get("ok"),
        narration_value.get("ok"),
        pipeline_value.get("ok"),
        pipeline_value.get("dispatch", {}).get("ok"),
    ])
    return SmokeResult(
        name="v1_to_v4_real_sample",
        ok=ok,
        details={
            "frame": copied_frame.name,
            "scene": perception_value.get("scene"),
            "decision_type": decision_value.get("decision_type"),
            "narration_type": narration_value.get("event_type"),
            "dispatch_delivery": pipeline_value.get("dispatch", {}).get("delivery"),
        },
    )


async def _run_action_window_case(orchestrator: SessionOrchestrator, plugin: _FakePlugin) -> SmokeResult:
    source_frame = _sample_frame("20260415-071314-863534-frame.png")
    debug_dir = plugin.data_path("debug_samples")
    debug_dir.mkdir(parents=True, exist_ok=True)
    copied_frame = debug_dir / source_frame.name
    if not copied_frame.exists():
        shutil.copy2(source_frame, copied_frame)

    orchestrator.state.running = True
    orchestrator.state.status = "scanning"
    orchestrator.state.scene = "in_match"
    orchestrator.state.last_frame_path = str(copied_frame)
    orchestrator.state.last_capture_ok = True
    orchestrator.state.last_perception_ok = True
    orchestrator.state.last_perception = {
        "scene": "in_match",
        "confidence": 0.91,
        "is_user_turn": True,
        "buttons": ["ron", "skip"],
        "notes": ["bottom action bar detected"],
        "roi_hits": {"bottom_action_bar": True},
        "hand_tiles": [],
        "melds": [],
        "dora_indicators": [],
        "riichi_players": [],
        "raw_detections": [],
        "analysis_hints": {},
    }

    decision = await orchestrator.generate_decision()
    narration = await orchestrator.generate_narration()
    review = await orchestrator.generate_review_summary()
    sync = await orchestrator.sync_memory_bridge()
    trend = await orchestrator.get_coaching_trend()
    topics = await orchestrator.get_last_coaching_topics()

    decision_value = decision.value
    review_value = review.value
    sync_value = sync.value
    trend_value = trend.value
    topics_value = topics.value
    ok = all([
        decision_value.get("ok"),
        decision_value.get("decision_type") == "danger_action",
        bool(decision_value.get("review_candidates_path")),
        decision_value.get("memory_bridge", {}).get("reason") == "staged_locally",
        narration.value.get("ok"),
        review_value.get("ok"),
        sync_value.get("ok"),
        sync_value.get("status") == "host_memory_write_unavailable",
        trend_value.get("ok"),
        topics_value.get("ok"),
    ])
    return SmokeResult(
        name="v5_and_v9_action_window",
        ok=ok,
        details={
            "decision_type": decision_value.get("decision_type"),
            "focus": decision_value.get("recommended_focus"),
            "review_summary_text": review_value.get("summary_text"),
            "sync_status": sync_value.get("status"),
            "trend_focus": trend_value.get("coaching_trend", {}).get("coach_focus"),
            "topic_titles": [item.get("title") for item in topics_value.get("topics", [])],
        },
    )


async def _run_tile_efficiency_case(orchestrator: SessionOrchestrator, _plugin: _FakePlugin) -> SmokeResult:
    orchestrator.state.running = True
    orchestrator.state.status = "scanning"
    orchestrator.state.scene = "in_match"
    orchestrator.state.last_perception_ok = True
    orchestrator.state.last_perception = {
        "scene": "in_match",
        "confidence": 0.84,
        "is_user_turn": True,
        "buttons": [],
        "notes": ["structured hand sample injected"],
        "roi_hits": {"bottom_hand_area": True},
        "hand_tiles": ["1m", "2m", "3m", "4p", "5p", "6p", "7s", "8s", "9s", "1z", "1z", "9m", "5z"],
        "melds": [],
        "dora_indicators": ["4p"],
        "riichi_players": ["right"],
        "raw_detections": [],
        "analysis_hints": {},
    }

    decision = await orchestrator.generate_decision()
    review = await orchestrator.generate_review_summary()
    trend = await orchestrator.get_coaching_trend()
    topics = await orchestrator.get_last_coaching_topics()

    decision_value = decision.value
    analysis = decision_value.get("mahjong_analysis", {})
    ok = all([
        decision_value.get("ok"),
        decision_value.get("decision_type") == "tile_efficiency_hint",
        decision_value.get("recommended_focus") == "tile_efficiency",
        analysis.get("tile_level_available") is True,
        analysis.get("shanten_estimate") is not None,
        isinstance(analysis.get("candidate_discards"), list) and bool(analysis.get("candidate_discards")),
        review.value.get("ok"),
        trend.value.get("ok"),
        topics.value.get("ok"),
    ])
    return SmokeResult(
        name="v6_to_v8_tile_efficiency",
        ok=ok,
        details={
            "decision_type": decision_value.get("decision_type"),
            "analysis_confidence": analysis.get("analysis_confidence"),
            "shanten_estimate": analysis.get("shanten_estimate"),
            "ukeire_estimate": analysis.get("ukeire_estimate"),
            "defense_alerts": analysis.get("defense_alerts", []),
            "topic_titles": [item.get("title") for item in topics.value.get("topics", [])],
        },
    )


async def _run_assist_dry_run_case(orchestrator: SessionOrchestrator) -> SmokeResult:
    orchestrator.state.scene = "menu"
    orchestrator.state.action_mode = "assist"
    actions = await orchestrator.list_assist_actions()
    execution = await orchestrator.execute_assist_action(
        "menu_back",
        dry_run=True,
        user_confirmed=True,
    )
    action_log = await orchestrator.get_action_log()

    actions_value = actions.value
    execution_value = execution.value
    action_log_value = action_log.value
    ok = all([
        actions_value.get("ok"),
        isinstance(actions_value.get("actions"), list) and len(actions_value.get("actions", [])) >= 1,
        execution_value.get("ok"),
        execution_value.get("blocked_reason") == "dry_run",
        action_log_value.get("ok"),
        int(action_log_value.get("count", 0)) >= 1,
    ])
    return SmokeResult(
        name="v7_assist_dry_run",
        ok=ok,
        details={
            "action_count": len(actions_value.get("actions", [])),
            "execution_reason": execution_value.get("blocked_reason"),
            "action_log_count": action_log_value.get("count"),
        },
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Run Mahjong Companion V1-V9 smoke validation.")
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON output.")
    args = parser.parse_args()

    payload = asyncio.run(run_v1_to_v9_smoke())
    print(json.dumps(payload, ensure_ascii=False, indent=2 if args.pretty else None))
    return 0 if payload.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
