from __future__ import annotations

import logging
import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from plugin.plugins.mahjong_companion.config_defaults import DEFAULT_CONFIG, merge_runtime_config
from plugin.plugins.mahjong_companion.narration.events import NarrationEvent
from plugin.plugins.mahjong_companion.narration.speech_policy import apply_speech_policy
from plugin.plugins.mahjong_companion.orchestrator import SessionOrchestrator
from plugin.plugins.mahjong_companion.session_state import now_iso
from plugin.plugins.mahjong_companion.window_binding import WindowBindingResult


class _FakePlugin:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.logger = logging.getLogger("mahjong-companion-test")
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


def _iso_seconds_ago(seconds: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(seconds=seconds)).isoformat()


def _speech_cfg(**overrides: object) -> dict[str, object]:
    cfg = {
        "voice_enabled": True,
        "voice_mode": "key_events_only",
        "normal_voice_cooldown_sec": 18,
        "danger_voice_cooldown_sec": 5,
        "normal_notification_cooldown_sec": 18,
        "danger_notification_cooldown_sec": 5,
        "dedupe_window_sec": 8,
        "auto_dispatch_enabled": True,
    }
    cfg.update(overrides)
    return cfg


def _sample_frame_path(name: str) -> Path:
    return Path(__file__).resolve().parents[4] / "plugins" / "mahjong_companion" / "data" / "debug_samples" / name


def test_apply_speech_policy_suppresses_recent_action_notification() -> None:
    event = NarrationEvent(
        event_type="action_available",
        channel="nudge",
        delivery="silent_ui",
        priority=60,
        summary="有可操作按钮",
        detail="底部有按钮。",
        risk_level="medium",
        scene="in_match",
        buttons=["skip"],
        text="现在像是轮到你操作了。",
        speakable=True,
        dedupe_key="action_available|in_match|medium|skip",
    )

    updated = apply_speech_policy(
        event,
        _speech_cfg(),
        last_notified_at=_iso_seconds_ago(3),
        last_notified_key=event.dedupe_key,
        last_notified_text=event.text,
    )

    assert updated.delivery == "silent_ui"
    assert updated.channel == "nudge"
    assert updated.speakable is False


def test_apply_speech_policy_keeps_uncertain_state_silent() -> None:
    event = NarrationEvent(
        event_type="uncertain_state",
        channel="nudge",
        delivery="silent_ui",
        text="这一帧我还没看太清。",
        speakable=True,
        dedupe_key="uncertain",
    )

    updated = apply_speech_policy(event, _speech_cfg())

    assert updated.delivery == "silent_ui"
    assert updated.channel == "silent_ui"
    assert updated.speakable is False


def test_dispatch_narration_updates_notification_and_voice_state(tmp_path: Path) -> None:
    plugin = _FakePlugin(tmp_path)
    orchestrator = SessionOrchestrator(plugin)
    orchestrator.apply_config(merge_runtime_config(DEFAULT_CONFIG, {}))
    orchestrator.state.running = True
    orchestrator.state.window_bound = True
    orchestrator.state.last_decision = {"priority": 90}
    orchestrator.state.last_decision_type = "danger_action"

    event = NarrationEvent(
        event_type="danger_action",
        channel="warning",
        delivery="voice_candidate",
        priority=90,
        summary="关键操作",
        detail="检测到高优先级按钮。",
        risk_level="high",
        scene="in_match",
        buttons=["ron"],
        text="这里像是有关键操作，我们先看清楚再点。",
        speakable=True,
        dedupe_key="danger_action|in_match|high|ron",
    )

    result = orchestrator._dispatch_narration_locked(event)

    assert result["ok"] is True
    assert plugin.messages
    assert plugin.messages[0]["content"] == event.text
    assert plugin.messages[0]["metadata"]["delivery"] == "voice_candidate"
    assert orchestrator.state.last_notification_ok is True
    assert orchestrator.state.last_spoken_text == event.text
    assert orchestrator.state.last_speak_ok is True


@pytest.mark.asyncio
async def test_speak_last_narration_rejects_when_window_unbound(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    plugin = _FakePlugin(tmp_path)
    orchestrator = SessionOrchestrator(plugin)
    orchestrator.apply_config(merge_runtime_config(DEFAULT_CONFIG, {}))
    orchestrator.state.running = True
    orchestrator.state.last_decision = {"priority": 90}
    orchestrator.state.last_decision_ok = True
    orchestrator.state.last_decision_type = "danger_action"
    orchestrator.state.last_narration_ok = True
    orchestrator.state.last_narration = {
        "event_type": "danger_action",
        "channel": "warning",
        "delivery": "voice_candidate",
        "priority": 90,
        "summary": "关键操作",
        "detail": "检测到高优先级按钮。",
        "risk_level": "high",
        "scene": "in_match",
        "buttons": ["ron"],
        "text": "这里像是有关键操作，我们先看清楚再点。",
        "speakable": True,
        "dedupe_key": "danger_action|in_match|high|ron",
    }
    orchestrator.state.last_narration_delivery = "voice_candidate"
    orchestrator.state.last_narration_text = "这里像是有关键操作，我们先看清楚再点。"

    monkeypatch.setattr(
        orchestrator,
        "_bind_window",
        lambda: WindowBindingResult(bound=False, error="active window does not match keywords"),
    )

    result = await orchestrator.speak_last_narration()

    assert result.value["ok"] is False
    assert "not currently bound" in result.value["error"]
    assert plugin.messages == []


@pytest.mark.asyncio
async def test_run_loop_executes_cycle_before_first_sleep(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    plugin = _FakePlugin(tmp_path)
    orchestrator = SessionOrchestrator(plugin)
    orchestrator.apply_config(merge_runtime_config(DEFAULT_CONFIG, {}))
    orchestrator.state.running = True

    calls = {"count": 0}

    def _fake_cycle() -> None:
        calls["count"] += 1
        orchestrator.state.running = False
        orchestrator.state.last_notification_at = now_iso()

    monkeypatch.setattr(orchestrator, "_run_live_cycle_locked", _fake_cycle)
    monkeypatch.setattr(orchestrator, "_get_sample_interval_ms", lambda: 999999)

    await orchestrator._run_loop()

    assert calls["count"] == 1
    assert plugin.statuses


@pytest.mark.asyncio
async def test_public_pipeline_keeps_cached_state_clean_between_steps(tmp_path: Path) -> None:
    plugin = _FakePlugin(tmp_path)
    orchestrator = SessionOrchestrator(plugin)
    orchestrator.apply_config(merge_runtime_config(DEFAULT_CONFIG, {}))

    result = await orchestrator.analyze_frame_path(str(_sample_frame_path("20260415-050905-263947-frame.png")))
    assert result.value["ok"] is True
    assert orchestrator.state.last_perception_ok is True

    decision = await orchestrator.generate_decision()
    assert decision.value["ok"] is True
    assert decision.value["decision_type"] == "waiting_state"
    assert orchestrator.state.last_decision_ok is True

    narration = await orchestrator.generate_narration()
    assert narration.value["ok"] is True
    assert narration.value["event_type"] == "waiting_state"
    assert orchestrator.state.last_narration_ok is True

    preview = await orchestrator.preview_companion_view()
    assert preview.value["ok"] is True
    assert preview.value["data"]["headline"]
    assert preview.value["data"]["delivery"] == "silent_ui"


@pytest.mark.asyncio
async def test_run_companion_pipeline_can_force_debug_reply_from_image(tmp_path: Path) -> None:
    plugin = _FakePlugin(tmp_path)
    orchestrator = SessionOrchestrator(plugin)
    orchestrator.apply_config(merge_runtime_config(DEFAULT_CONFIG, {}))

    result = await orchestrator.run_companion_pipeline(
        frame_path=str(_sample_frame_path("20260415-050905-263947-frame.png")),
        dispatch=True,
        force_reply=True,
    )

    assert result.value["ok"] is True
    assert result.value["perception"]["ok"] is True
    assert result.value["decision"]["ok"] is True
    assert result.value["narration"]["ok"] is True
    assert result.value["dispatch"]["ok"] is True
    assert result.value["dispatch"]["delivery"] == "proactive_notification"
    assert plugin.messages
    assert plugin.messages[0]["content"] == result.value["narration"]["text"]


@pytest.mark.asyncio
async def test_manual_pipeline_does_not_stage_review_or_memory_bridge_when_session_not_running(tmp_path: Path) -> None:
    plugin = _FakePlugin(tmp_path)
    orchestrator = SessionOrchestrator(plugin)
    orchestrator.apply_config(merge_runtime_config(DEFAULT_CONFIG, {}))

    manual_frame = tmp_path / "manual-frame.png"
    shutil.copyfile(_sample_frame_path("20260415-071312-089224-frame.png"), manual_frame)

    result = await orchestrator.run_companion_pipeline(
        frame_path=str(manual_frame),
        dispatch=False,
        force_reply=False,
    )

    assert result.value["ok"] is True
    assert "review_candidates_path" not in result.value["decision"]
    assert "memory_bridge" not in result.value["decision"]
    assert not (plugin.data_path("session_cache") / "review_candidates.json").exists()
    assert not (plugin.data_path("session_cache") / "memory_bridge_queue.json").exists()
