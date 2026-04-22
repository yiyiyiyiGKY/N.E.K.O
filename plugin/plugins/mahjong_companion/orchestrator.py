from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any, Optional

from plugin.sdk.plugin import Ok

from .action import HumanOverrideGuard
from .action.action_log import ActionLogEntry, append_action_log, clear_action_log, load_action_log
from .action.action_registry import ActionRegistry
from .action.input_adapter import InputAdapter
from .capture import DefaultCaptureProvider
from .contracts import ActionExecutionResult, DecisionResult, PerceivedGameState
from .decision.adapter import DefaultDecisionAdapter
from .decision.debug_dump import write_debug_artifacts as write_decision_debug_artifacts
from .gates import DefaultFrameChangeGate
from .narration import NarrationEvent, apply_speech_policy, generate_narration
from .narration.debug_dump import write_debug_artifacts as write_narration_debug_artifacts
from .narration.dispatcher import NarrationDispatcher
from .perception import analyze_image_path
from .perception.debug_dump import write_debug_artifacts as write_perception_debug_artifacts
from .review import (
    append_game_private_memory,
    append_review_candidate,
    append_review_summary_history,
    build_game_private_record,
    build_memory_summary,
    build_review_candidate,
    build_review_summary,
    generate_coaching_topics,
    generate_coaching_trend,
    generate_review_summary as generate_review_summary_artifact,
    load_review_candidates,
    stage_memory_summary,
    sync_memory_bridge_queue,
)
from .runtime import GameAgentRuntime, GameAgentRuntimeConfig
from .session_state import SessionState, now_iso
from .window_binding import WindowBindingResult


class SessionOrchestrator:
    def __init__(self, plugin: Any):
        self.plugin = plugin
        self.logger = plugin.logger
        self.state = SessionState.create()
        self._task: Optional[asyncio.Task] = None
        self._config: dict[str, Any] = {}
        self._lock = asyncio.Lock()
        self._consecutive_capture_failures = 0
        self._capture_provider = DefaultCaptureProvider()
        self._decision_adapter = DefaultDecisionAdapter()
        self._frame_change_gate = DefaultFrameChangeGate()
        self._human_override_guard = HumanOverrideGuard()
        self._narration_dispatcher = NarrationDispatcher(plugin)
        self._action_registry = ActionRegistry()
        self._input_adapter = InputAdapter()
        self._human_override_guard.configure_pointer_provider(self._input_adapter.get_pointer)
        self._runtime_cfg = GameAgentRuntimeConfig()
        self._game_runtime = GameAgentRuntime(self._runtime_cfg)
        self._runtime_mailbox_limits: tuple[int, int] = (
            self._runtime_cfg.inbound_queue_limit,
            self._runtime_cfg.outbound_queue_limit,
        )
        self._runtime_outbox_flush_per_tick = self._runtime_cfg.outbound_flush_per_tick

    def apply_config(self, config: dict[str, Any]) -> None:
        self._config = config
        companion_cfg = config.get("mahjong_companion", {})
        default_mode = companion_cfg.get("default_mode")
        speech_cfg = companion_cfg.get("speech_policy", {})
        if isinstance(default_mode, str) and not self.state.running:
            self.state.mode = default_mode
        if isinstance(speech_cfg, dict):
            self.state.voice_enabled = bool(speech_cfg.get("voice_enabled", True))
            if not self.state.running:
                voice_mode = str(speech_cfg.get("voice_mode", "key_events_only")).strip()
                self.state.voice_mode = voice_mode or "key_events_only"
        action_cfg = companion_cfg.get("action_policy", {})
        if isinstance(action_cfg, dict):
            action_mode = str(action_cfg.get("mode", "off")).strip()
            if action_mode in {"off", "assist", "semi_auto"}:
                self.state.action_mode = action_mode
        runtime_cfg = companion_cfg.get("game_agent_runtime", {})
        if isinstance(runtime_cfg, dict):
            runtime_mode = str(runtime_cfg.get("mode", self.state.runtime_mode)).strip().lower() or "active"
            inbound_limit = max(1, int(runtime_cfg.get("inbound_queue_limit", self._runtime_mailbox_limits[0]) or 1))
            outbound_limit = max(1, int(runtime_cfg.get("outbound_queue_limit", self._runtime_mailbox_limits[1]) or 1))
            flush_per_tick = max(
                1, int(runtime_cfg.get("outbound_flush_per_tick", self._runtime_outbox_flush_per_tick) or 1),
            )
            dedupe_window_sec = max(0, int(runtime_cfg.get("outbound_dedupe_window_sec", 8) or 0))
            self._runtime_cfg = GameAgentRuntimeConfig(
                mode=runtime_mode,
                inbound_queue_limit=inbound_limit,
                outbound_queue_limit=outbound_limit,
                outbound_flush_per_tick=flush_per_tick,
                outbound_dedupe_window_sec=dedupe_window_sec,
            )
            self._game_runtime.configure(self._runtime_cfg)
            self.state.runtime_mode = self._game_runtime.mode
            self._runtime_mailbox_limits = (inbound_limit, outbound_limit)
            self._runtime_outbox_flush_per_tick = flush_per_tick
        self._sync_runtime_mailbox_state_locked()

    async def start(self):
        async with self._lock:
            if self.state.running:
                return Ok({"already_running": True, **self.get_status()})

            self.state.running = True
            self.state.status = "starting"
            self.state.runtime_status = "starting"
            self.state.last_error = ""
            self._consecutive_capture_failures = 0
            self.state.last_notification_at = ""
            self.state.last_notification_text = ""
            self.state.last_notification_key = ""
            self.state.last_notification_channel = ""
            self.state.last_notification_delivery = ""
            self.state.last_notification_ok = False
            self.state.last_spoken_at = ""
            self.state.last_spoken_text = ""
            self.state.last_speak_ok = False
            self.state.last_human_override_armed = False
            self.state.last_human_override_reason = "guard_inactive"
            self.state.last_human_override_at = ""
            self.state.last_memory_bridge_at = ""
            self.state.last_memory_bridge_status = ""
            self.state.last_memory_bridge_summary = ""
            self.state.last_runtime_interrupt_reason = ""
            self.state.last_review_summary_at = ""
            self.state.last_review_summary_ok = False
            self.state.last_review_summary = {}
            self.state.last_review_summary_text = ""
            self.state.started_at = self.state.started_at or now_iso()
            self._frame_change_gate.reset()
            self._human_override_guard.reset()
            self._sync_runtime_mailbox_state_locked()
            self._emit_status()
            self._task = asyncio.create_task(self._run_loop(), name="mahjong-companion-loop")
            return Ok(self.get_status())

    async def stop(self):
        async with self._lock:
            self.state.running = False
            self.state.status = "stopping"
            self.state.runtime_status = "stopping"
            self._emit_status()

            if self._task:
                self._task.cancel()
                try:
                    await self._task
                except asyncio.CancelledError:
                    pass
                self._task = None

            self.state.status = "idle"
            self.state.runtime_status = "idle"
            self._game_runtime.set_status("idle")
            self._consecutive_capture_failures = 0
            self._frame_change_gate.reset()
            self._human_override_guard.reset()
            self._sync_runtime_mailbox_state_locked()
            self._emit_status()
            return Ok(self.get_status())

    async def set_mode(self, mode: str) -> None:
        async with self._lock:
            self.state.mode = mode
            self._emit_status()

    async def set_runtime_mode(self, mode: str):
        async with self._lock:
            normalized = str(mode).strip().lower()
            if normalized not in {"active", "standby", "off"}:
                return Ok({
                    "ok": False,
                    "error": f"invalid runtime mode: {mode}",
                    "allowed": ["active", "standby", "off"],
                })
            self.state.runtime_mode = self._game_runtime.set_mode(normalized)
            if normalized == "off":
                self.state.status = "idle"
            self.state.runtime_status = self.state.runtime_mode
            self._emit_status()
            return Ok({
                "ok": True,
                "runtime_mode": self.state.runtime_mode,
                "runtime_status": self.state.runtime_status,
            })

    async def send_runtime_message(
        self,
        *,
        action: str,
        payload: dict[str, Any] | None = None,
        interrupt: bool = True,
        source: str = "catgirl",
    ):
        async with self._lock:
            message = self._game_runtime.enqueue_inbound(
                action=str(action).strip(),
                payload=dict(payload or {}),
                source=source,
                interrupt=bool(interrupt),
            )
            self.state.last_runtime_command_id = message.message_id
            self.state.last_runtime_command_source = message.source
            self.state.last_runtime_command_action = message.action
            self.state.last_runtime_command_at = now_iso()
            self.state.last_runtime_command_ok = False
            self.state.last_runtime_command_result = {}
            if bool(interrupt):
                self.state.runtime_interrupt_seq += 1
                self.state.last_runtime_interrupt_at = now_iso()
                self.state.last_runtime_interrupt_reason = f"interrupt_by_{source}:{message.action}"
            self._sync_runtime_mailbox_state_locked()
            self._emit_status()
            return Ok({
                "ok": True,
                "queued": True,
                "message": message.to_dict(),
                "runtime_interrupt_seq": self.state.runtime_interrupt_seq,
                "mailbox": self._game_runtime.snapshot(),
            })

    async def get_runtime_mailbox(self):
        async with self._lock:
            self._sync_runtime_mailbox_state_locked()
            return Ok({
                "ok": True,
                "runtime_mode": self.state.runtime_mode,
                "runtime_status": self.state.runtime_status,
                "runtime_interrupt_seq": self.state.runtime_interrupt_seq,
                "last_runtime_command_id": self.state.last_runtime_command_id,
                "last_runtime_command_action": self.state.last_runtime_command_action,
                "last_runtime_command_source": self.state.last_runtime_command_source,
                "last_runtime_command_at": self.state.last_runtime_command_at,
                "last_runtime_command_ok": self.state.last_runtime_command_ok,
                "last_runtime_command_result": self.state.last_runtime_command_result,
                "last_runtime_interrupt_at": self.state.last_runtime_interrupt_at,
                "last_runtime_interrupt_reason": self.state.last_runtime_interrupt_reason,
                "last_runtime_outbound_id": self.state.last_runtime_outbound_id,
                "last_runtime_outbound_at": self.state.last_runtime_outbound_at,
                "mailbox": self._game_runtime.snapshot(),
            })

    def get_status(self) -> dict[str, Any]:
        return self._build_status_snapshot()

    async def bind_window(self):
        async with self._lock:
            result = self._bind_window()
            self._emit_status()
            payload = result.to_dict()
            payload["status"] = self.state.status
            return Ok(payload)

    async def unbind_window(self):
        async with self._lock:
            self._clear_binding()
            self._emit_status()
            return Ok({
                "bound": False,
                "window_title": "",
                "match_keyword": "",
                "status": self.state.status,
            })

    async def capture_debug_frame(self):
        async with self._lock:
            binding_result = self._bind_window()
            try:
                return Ok(self._capture_debug_frame_locked(binding_result))
            except Exception as exc:
                self.logger.exception("capture_debug_frame failed")
                should_cancel = self._handle_capture_failure_locked(exc)
                self._emit_status()
                if should_cancel:
                    await self._cancel_background_loop_locked()
                return Ok({
                    "saved": False,
                    "error": str(exc),
                    "window_bound": self.state.window_bound,
                    "window_title": self.state.window_title,
                    "match_keyword": self.state.window_match_keyword,
                    "binding_error": binding_result.error,
                    "capture_error": str(exc),
                })

    async def analyze_debug_frame(self):
        async with self._lock:
            frame_path = self._resolve_latest_frame_path()
            if frame_path is None:
                self._mark_perception_failure("no captured frame available")
                self._emit_status()
                return Ok({
                    "ok": False,
                    "error": "no captured frame available",
                })

            return Ok(self._analyze_frame_locked(frame_path))

    async def analyze_frame_path(self, frame_path: str):
        async with self._lock:
            candidate = Path(frame_path).expanduser()
            if not candidate.is_absolute():
                candidate = (Path.cwd() / candidate).resolve()
            return Ok(self._analyze_frame_locked(candidate))

    async def get_last_perception(self):
        async with self._lock:
            return Ok({
                "ok": self.state.last_perception_ok,
                "data": self.state.last_perception,
                "last_perception_at": self.state.last_perception_at,
            })

    async def generate_decision(self):
        async with self._lock:
            ready, payload = self._ensure_perception_locked()
            if not ready:
                return Ok(payload)
            return Ok(self._generate_decision_locked())

    async def get_last_decision(self):
        async with self._lock:
            return Ok({
                "ok": self.state.last_decision_ok,
                "data": self.state.last_decision,
                "last_decision_at": self.state.last_decision_at,
            })

    async def generate_narration(self):
        async with self._lock:
            ready, payload = self._ensure_decision_locked()
            if not ready:
                return Ok(payload)
            return Ok(self._generate_narration_locked())

    async def get_last_narration(self):
        async with self._lock:
            return Ok({
                "ok": self.state.last_narration_ok,
                "data": self.state.last_narration,
                "last_narration_at": self.state.last_narration_at,
            })

    async def generate_review_summary(self):
        async with self._lock:
            cache_dir = self.plugin.data_path("session_cache")
            try:
                summary, summary_path = generate_review_summary_artifact(
                    cache_dir,
                    session_id=self.state.session_id,
                )
                history_path = append_review_summary_history(
                    cache_dir,
                    summary,
                    limit=int(self._get_coaching_cfg().get("history_limit", 24)),
                )
                payload = self._apply_review_summary_result(summary)
                payload.update(self._refresh_coaching_state_locked(cache_dir))
                payload["ok"] = True
                payload["path"] = str(summary_path)
                payload["history_path"] = str(history_path)
                self._emit_status()
                return Ok(payload)
            except Exception as exc:
                self.logger.exception("generate_review_summary failed")
                self.state.last_review_summary_at = now_iso()
                self.state.last_review_summary_ok = False
                self.state.last_review_summary = {}
                self.state.last_review_summary_text = ""
                self.state.last_error = str(exc)
                self._emit_status()
                return Ok({
                    "ok": False,
                    "error": str(exc),
                })

    async def get_last_review_summary(self):
        async with self._lock:
            return Ok({
                "ok": self.state.last_review_summary_ok,
                "data": self.state.last_review_summary,
                "last_review_summary_at": self.state.last_review_summary_at,
                "last_review_summary_text": self.state.last_review_summary_text,
            })

    async def generate_review_summary_from_file(self, review_candidates_path: str):
        async with self._lock:
            candidate = Path(review_candidates_path).expanduser()
            if not candidate.is_absolute():
                candidate = (Path.cwd() / candidate).resolve()
            try:
                items = load_review_candidates(candidate)
                summary = build_review_summary(
                    session_id=self.state.session_id,
                    candidates=items,
                )
                history_path = append_review_summary_history(
                    self.plugin.data_path("session_cache"),
                    summary,
                    limit=int(self._get_coaching_cfg().get("history_limit", 24)),
                )
                payload = self._apply_review_summary_result(summary)
                payload.update(self._refresh_coaching_state_locked(self.plugin.data_path("session_cache")))
                payload["ok"] = True
                payload["source_path"] = str(candidate)
                payload["history_path"] = str(history_path)
                self._emit_status()
                return Ok(payload)
            except Exception as exc:
                self.logger.exception("generate_review_summary_from_file failed")
                self.state.last_review_summary_at = now_iso()
                self.state.last_review_summary_ok = False
                self.state.last_review_summary = {}
                self.state.last_review_summary_text = ""
                self.state.last_error = str(exc)
                self._emit_status()
                return Ok({
                    "ok": False,
                    "error": str(exc),
                    "source_path": str(candidate),
                })

    async def sync_memory_bridge(self):
        async with self._lock:
            cache_dir = self.plugin.data_path("session_cache")
            bridge_cfg = self._get_memory_bridge_cfg()
            report, report_path = sync_memory_bridge_queue(
                cache_dir,
                memory_client=getattr(self.plugin, "memory", None),
                bucket_id=str(bridge_cfg.get("host_memory_bucket_id", "mahjong_companion_coaching")),
                batch_size=int(bridge_cfg.get("host_sync_batch_size", 5)),
            )
            self._apply_host_memory_sync_result(report)
            self._emit_status()
            payload = dict(report)
            payload["path"] = str(report_path)
            return Ok(payload)

    async def get_coaching_trend(self):
        async with self._lock:
            cache_dir = self.plugin.data_path("session_cache")
            try:
                payload = self._refresh_coaching_state_locked(cache_dir)
                payload["ok"] = True
                self._emit_status()
                return Ok(payload)
            except Exception as exc:
                self.state.last_error = str(exc)
                self._emit_status()
                return Ok({
                    "ok": False,
                    "error": str(exc),
                })

    async def get_last_coaching_topics(self):
        async with self._lock:
            if not self.state.last_coaching_topics:
                cache_dir = self.plugin.data_path("session_cache")
                try:
                    self._refresh_coaching_state_locked(cache_dir)
                except Exception as exc:
                    self.state.last_error = str(exc)
                    self._emit_status()
                    return Ok({
                        "ok": False,
                        "error": str(exc),
                        "topics": [],
                    })
            return Ok({
                "ok": bool(self.state.last_coaching_topics),
                "coach_focus": self.state.last_coaching_focus,
                "summary_text": self.state.last_coaching_summary_text,
                "topics": list(self.state.last_coaching_topics),
                "last_coaching_trend_at": self.state.last_coaching_trend_at,
            })

    async def list_assist_actions(self):
        async with self._lock:
            actions = self._action_registry.list_actions()
            return Ok({
                "ok": True,
                "action_mode": self.state.action_mode,
                "actions": [a.to_dict() for a in actions],
            })

    async def execute_assist_action(
        self,
        action_id: str,
        *,
        dry_run: bool = False,
        user_confirmed: bool = False,
    ):
        async with self._lock:
            return Ok(self._execute_assist_action_locked(
                action_id, dry_run=dry_run, user_confirmed=user_confirmed,
            ))

    async def get_action_log(self):
        async with self._lock:
            entries = load_action_log(self.plugin.data_path("session_cache"))
            return Ok({
                "ok": True,
                "count": len(entries),
                "entries": entries,
            })

    async def clear_action_log(self):
        async with self._lock:
            removed = clear_action_log(self.plugin.data_path("session_cache"))
            return Ok({
                "ok": True,
                "cleared": removed,
            })

    async def preview_companion_view(self):
        async with self._lock:
            ready, payload = self._ensure_narration_locked()
            if not ready:
                return Ok(payload)
            return Ok({
                "ok": True,
                "data": self.state.last_companion_view,
                "last_narration_at": self.state.last_narration_at,
            })

    async def run_companion_pipeline(
        self,
        frame_path: str = "",
        *,
        capture: bool = False,
        dispatch: bool = True,
        force_reply: bool = True,
    ):
        async with self._lock:
            target_frame = self._resolve_pipeline_frame_path(frame_path, capture)
            if isinstance(target_frame, dict):
                return Ok(target_frame)

            perception = self._analyze_frame_locked(target_frame)
            if not perception.get("ok"):
                return Ok({
                    "ok": False,
                    "stage": "perception",
                    "frame_path": str(target_frame),
                    "perception": perception,
                })

            decision = self._generate_decision_locked()
            if not decision.get("ok"):
                return Ok({
                    "ok": False,
                    "stage": "decision",
                    "frame_path": str(target_frame),
                    "perception": perception,
                    "decision": decision,
                })

            narration = self._generate_narration_locked()
            if not narration.get("ok"):
                return Ok({
                    "ok": False,
                    "stage": "narration",
                    "frame_path": str(target_frame),
                    "perception": perception,
                    "decision": decision,
                    "narration": narration,
                })

            dispatch_payload = {
                "ok": False,
                "skipped": True,
                "reason": "dispatch_disabled",
            }
            dispatch_event = self._current_narration_event()
            if dispatch and dispatch_event is not None:
                if force_reply and dispatch_event.delivery not in {"proactive_notification", "voice_candidate"}:
                    dispatch_event = self._build_debug_reply_event(dispatch_event)
                dispatch_payload = (
                    self._dispatch_debug_narration_locked(dispatch_event)
                    if force_reply
                    else self._dispatch_narration_locked(dispatch_event)
                )

            return Ok({
                "ok": True,
                "frame_path": str(target_frame),
                "perception": perception,
                "decision": decision,
                "narration": narration,
                "dispatch": dispatch_payload,
            })

    async def speak_last_narration(self):
        async with self._lock:
            ready, payload = self._ensure_narration_locked()
            if not ready:
                return Ok(payload)

            if not self.state.last_narration_ok or not self.state.last_narration_text:
                return Ok({
                    "ok": False,
                    "error": "no narration available",
                })

            if not self.state.running:
                return Ok({
                    "ok": False,
                    "error": "session is not running",
                })

            binding_result = self._bind_window()
            if not binding_result.bound:
                self._emit_status()
                return Ok({
                    "ok": False,
                    "error": "mahjong window is not currently bound",
                    "window_title": self.state.window_title,
                    "binding_error": binding_result.error,
                })

            event = self._reapply_current_narration_policy_locked()
            if event is None:
                return Ok({
                    "ok": False,
                    "error": "no narration available",
                })

            if event.delivery != "voice_candidate":
                return Ok({
                    "ok": False,
                    "error": "current narration is not eligible for voice playback",
                    "delivery": event.delivery,
                    "voice_mode": self.state.voice_mode,
                })

            try:
                dispatch = self._dispatch_narration_locked(event)
                if not dispatch.get("ok"):
                    return Ok(dispatch)
                return Ok({
                    "ok": True,
                    "spoken": True,
                    "text": event.text,
                    "voice_mode": self.state.voice_mode,
                    "delivery": event.delivery,
                })
            except Exception as exc:
                self.logger.exception("speak_last_narration failed")
                self.state.last_speak_ok = False
                self.state.last_notification_ok = False
                self.state.last_error = str(exc)
                self._emit_status()
                return Ok({
                    "ok": False,
                    "error": str(exc),
                })

    async def cycle_voice_mode(self):
        async with self._lock:
            modes = ["off", "key_events_only", "companion"]
            try:
                current_index = modes.index(self.state.voice_mode)
            except ValueError:
                current_index = 0
            self.state.voice_mode = modes[(current_index + 1) % len(modes)]
            self._emit_status()
            return Ok({
                "ok": True,
                "voice_mode": self.state.voice_mode,
                "voice_enabled": self.state.voice_enabled,
            })

    async def _run_loop(self) -> None:
        self.state.status = "scanning"
        self.state.runtime_status = "loop_running"
        self._game_runtime.set_status("loop_running")
        self._emit_status()
        interval_ms = self._get_sample_interval_ms()
        try:
            while self.state.running:
                async with self._lock:
                    self._run_runtime_cycle_locked()
                if not self.state.running:
                    break
                await asyncio.sleep(interval_ms / 1000.0)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            self.logger.exception("mahjong companion loop failed")
            self.state.running = False
            self.state.last_error = str(exc)
            self.state.status = "error"
            self.state.runtime_status = "error"
            self._game_runtime.set_status("error")
            self._emit_status()

    def _run_runtime_cycle_locked(self) -> None:
        self._process_runtime_command_locked()

        runtime_mode = self._game_runtime.set_mode(self.state.runtime_mode)
        self.state.runtime_mode = runtime_mode
        if runtime_mode == "off":
            self.state.runtime_status = "off"
            self._game_runtime.set_status("off")
            self.state.status = "idle"
            self._flush_runtime_outbox_locked(limit=self._runtime_outbox_flush_per_tick)
            self._emit_status()
            return

        if runtime_mode == "standby":
            self.state.runtime_status = "standby"
            self._game_runtime.set_status("standby")
            if self.state.running and self.state.status not in {"warning", "error"}:
                self.state.status = "standby"
            self._flush_runtime_outbox_locked(limit=self._runtime_outbox_flush_per_tick)
            self._emit_status()
            return

        self.state.runtime_status = "active"
        self._game_runtime.set_status("active")
        self._run_live_cycle_locked()
        self._flush_runtime_outbox_locked(limit=self._runtime_outbox_flush_per_tick)

    def _process_runtime_command_locked(self) -> None:
        command = self._game_runtime.pop_inbound()
        if command is None:
            self._sync_runtime_mailbox_state_locked()
            return

        self.state.last_runtime_command_id = command.message_id
        self.state.last_runtime_command_source = command.source
        self.state.last_runtime_command_action = command.action
        self.state.last_runtime_command_at = now_iso()
        self.state.runtime_status = "processing_command"
        result: dict[str, Any]

        try:
            result = self._handle_runtime_command_locked(command.action, command.payload)
            ok = bool(result.get("ok", True))
            self.state.last_runtime_command_ok = ok
            self.state.last_runtime_command_result = dict(result)
            if not ok and result.get("error"):
                self.state.last_error = str(result.get("error"))
        except Exception as exc:
            self.logger.exception("runtime command failed")
            self.state.last_runtime_command_ok = False
            self.state.last_runtime_command_result = {
                "ok": False,
                "error": str(exc),
            }
            self.state.last_error = str(exc)
        finally:
            self._sync_runtime_mailbox_state_locked()
            if self.state.runtime_mode != "off":
                self.state.runtime_status = self.state.runtime_mode
            else:
                self.state.runtime_status = "off"

    def _handle_runtime_command_locked(self, action: str, payload: dict[str, Any]) -> dict[str, Any]:
        normalized = str(action).strip().lower()
        if not normalized:
            return {"ok": False, "error": "runtime action is empty"}

        if normalized == "refresh_status":
            return {"ok": True, "status": self.get_status()}

        if normalized == "set_mode":
            mode = str(payload.get("mode", "")).strip()
            if mode not in {"spectate", "replay", "teaching", "silent"}:
                return {"ok": False, "error": f"invalid mode: {mode}"}
            self.state.mode = mode
            self._emit_status()
            return {"ok": True, "mode": mode}

        if normalized == "set_runtime_mode":
            runtime_mode = str(payload.get("runtime_mode", "")).strip().lower()
            if runtime_mode not in {"active", "standby", "off"}:
                return {
                    "ok": False,
                    "error": f"invalid runtime mode: {runtime_mode}",
                }
            self.state.runtime_mode = self._game_runtime.set_mode(runtime_mode)
            if runtime_mode == "off":
                self.state.status = "idle"
            return {"ok": True, "runtime_mode": self.state.runtime_mode}

        if normalized == "summarize_review":
            cache_dir = self.plugin.data_path("session_cache")
            summary, summary_path = generate_review_summary_artifact(
                cache_dir,
                session_id=self.state.session_id,
            )
            history_path = append_review_summary_history(
                cache_dir,
                summary,
                limit=int(self._get_coaching_cfg().get("history_limit", 24)),
            )
            payload_result = self._apply_review_summary_result(summary)
            payload_result.update(self._refresh_coaching_state_locked(cache_dir))
            payload_result["path"] = str(summary_path)
            payload_result["history_path"] = str(history_path)
            self._emit_status()
            return {"ok": True, **payload_result}

        if normalized == "sync_memory":
            cache_dir = self.plugin.data_path("session_cache")
            bridge_cfg = self._get_memory_bridge_cfg()
            report, report_path = sync_memory_bridge_queue(
                cache_dir,
                memory_client=getattr(self.plugin, "memory", None),
                bucket_id=str(bridge_cfg.get("host_memory_bucket_id", "mahjong_companion_coaching")),
                batch_size=int(bridge_cfg.get("host_sync_batch_size", 5)),
            )
            self._apply_host_memory_sync_result(report)
            self._emit_status()
            return {"ok": True, **report, "path": str(report_path)}

        if normalized == "dispatch_current_narration":
            event = self._current_narration_event()
            if event is None:
                return {"ok": False, "error": "no narration available"}
            dispatch = self._dispatch_narration_locked(event)
            return {"ok": bool(dispatch.get("ok")), "dispatch": dispatch}

        if normalized == "explain_current_hand":
            ready, perception_payload = self._ensure_perception_locked()
            if not ready:
                return {"ok": False, "error": perception_payload.get("error", "perception_unavailable")}
            decision_payload = self._generate_decision_locked(persist_review_artifacts=False)
            if not decision_payload.get("ok"):
                return {"ok": False, "error": decision_payload.get("error", "decision_failed")}
            narration_payload = self._generate_narration_locked()
            if not narration_payload.get("ok"):
                return {"ok": False, "error": narration_payload.get("error", "narration_failed")}
            return {
                "ok": True,
                "perception": perception_payload,
                "decision": decision_payload,
                "narration": narration_payload,
            }

        return {"ok": False, "error": f"unsupported runtime action: {action}"}

    def _analyze_frame_locked(self, frame_path: Path) -> dict[str, Any]:
        if not frame_path.exists():
            self._mark_perception_failure("image not found: %s" % frame_path)
            self._emit_status()
            return {
                "ok": False,
                "error": "image not found: %s" % frame_path,
                "frame_path": str(frame_path),
            }

        try:
            perceived, debug_payload = analyze_image_path(frame_path)
            artifacts = {}
            if self._perception_debug_dump_enabled():
                artifacts = write_perception_debug_artifacts(frame_path, perceived, debug_payload)
            payload = self._apply_perception_result(perceived)
            payload.update(artifacts)
            payload["ok"] = True
            payload["frame_path"] = str(frame_path)
            self._emit_status()
            return payload
        except Exception as exc:
            self.logger.exception("analyze_debug_frame failed")
            self._mark_perception_failure(str(exc))
            self._emit_status()
            return {
                "ok": False,
                "error": str(exc),
                "frame_path": str(frame_path),
            }

    def _generate_decision_locked(self, *, persist_review_artifacts: bool | None = None) -> dict[str, Any]:
        perceived = self._current_perceived_state()
        if perceived is None:
            self._mark_decision_failure("no perception available")
            self._emit_status()
            return {
                "ok": False,
                "error": "no perception available",
            }

        try:
            decision = self._decision_adapter.suggest(perceived)
            debug_payload = {
                "source_scene": perceived.scene,
                "source_confidence": perceived.confidence,
                "source_buttons": list(perceived.buttons),
                "source_is_user_turn": perceived.is_user_turn,
                "source_notes": list(perceived.notes),
                "decision_reason_codes": list(decision.reason_codes),
            }
            artifacts = {}
            frame_path = self._resolve_latest_frame_path()
            if frame_path is not None and self._decision_debug_dump_enabled():
                artifacts = write_decision_debug_artifacts(frame_path, decision, debug_payload)
            should_persist_review = self._should_persist_review_artifacts(
                frame_path,
                persist_review_artifacts=persist_review_artifacts,
            )
            review_candidate = build_review_candidate(frame_path, decision, perceived) if should_persist_review else None
            if review_candidate is not None:
                review_candidate["session_id"] = self.state.session_id
                review_path = append_review_candidate(self.plugin.data_path("session_cache"), review_candidate)
                artifacts["review_candidates_path"] = str(review_path)
                bridge_cfg = self._get_memory_bridge_cfg()
                private_record = build_game_private_record(review_candidate, decision, perceived)
                private_path = append_game_private_memory(
                    self.plugin.data_path("session_cache"),
                    private_record,
                    limit=int(bridge_cfg.get("private_memory_limit", 400)),
                )
                artifacts["game_private_memory_path"] = str(private_path)
                if decision.priority >= int(bridge_cfg.get("min_priority", 75)):
                    memory_summary = build_memory_summary(review_candidate, decision, perceived)
                    if memory_summary is not None:
                        memory_payload = stage_memory_summary(
                            self.plugin.data_path("session_cache"),
                            memory_summary,
                            enabled=bool(bridge_cfg.get("enabled", True)),
                            dedupe_window_sec=int(bridge_cfg.get("dedupe_window_sec", 21600)),
                            max_memories_per_day=int(bridge_cfg.get("max_memories_per_day", 3)),
                        )
                        artifacts["memory_bridge"] = memory_payload
                        if memory_payload.get("path"):
                            artifacts["memory_bridge_path"] = str(memory_payload["path"])
                        self.state.last_memory_bridge_at = now_iso()
                        self.state.last_memory_bridge_status = str(memory_payload.get("reason", ""))
                        staged_summary = memory_payload.get("summary")
                        if isinstance(staged_summary, dict):
                            self.state.last_memory_bridge_summary = str(staged_summary.get("summary_text", ""))
            payload = self._apply_decision_result(decision)
            payload.update(artifacts)
            payload["ok"] = True
            self._emit_status()
            return payload
        except Exception as exc:
            self.logger.exception("generate_decision failed")
            self._mark_decision_failure(str(exc))
            self._emit_status()
            return {
                "ok": False,
                "error": str(exc),
            }

    def _generate_narration_locked(self) -> dict[str, Any]:
        decision = self._current_decision_result()
        if decision is None:
            self._mark_narration_failure("no decision available")
            self._emit_status()
            return {
                "ok": False,
                "error": "no decision available",
            }

        try:
            event, view_model, debug_payload = generate_narration(decision)
            event = apply_speech_policy(
                event,
                self._get_speech_policy_cfg(),
                last_spoken_at=self.state.last_spoken_at,
                last_spoken_text=self.state.last_spoken_text,
                last_notified_at=self.state.last_notification_at,
                last_notified_text=self.state.last_notification_text,
                last_notified_key=self.state.last_notification_key,
            )
            view_model.delivery = event.delivery
            view_model.speakable = event.speakable
            artifacts = {}
            frame_path = self._resolve_latest_frame_path()
            if frame_path is not None and self._narration_debug_dump_enabled():
                artifacts = write_narration_debug_artifacts(frame_path, event, view_model, debug_payload)
            payload = self._apply_narration_result(event, view_model)
            payload.update(artifacts)
            payload["ok"] = True
            self._emit_status()
            return payload
        except Exception as exc:
            self.logger.exception("generate_narration failed")
            self._mark_narration_failure(str(exc))
            self._emit_status()
            return {
                "ok": False,
                "error": str(exc),
            }

    def _run_live_cycle_locked(self) -> None:
        binding_result = self._bind_window()
        if not binding_result.bound:
            self.state.status = "warning"
            self.state.last_error = binding_result.error or "mahjong window is not currently bound"
            self._emit_status()
            return

        try:
            self._capture_debug_frame_locked(binding_result)
        except Exception as exc:
            self.logger.exception("automatic capture failed")
            self._handle_capture_failure_locked(exc)
            self._emit_status()
            return

        frame_path = self._resolve_latest_frame_path()
        if frame_path is None:
            self._mark_perception_failure("no captured frame available")
            self._emit_status()
            return

        if not self._should_process_frame_locked(frame_path):
            if self.state.running and self.state.status != "warning":
                self.state.status = "scanning"
                self._emit_status()
            return

        if self._perception_enabled():
            perception = self._analyze_frame_locked(frame_path)
            if not perception.get("ok"):
                return

        if self._decision_enabled():
            decision = self._generate_decision_locked(persist_review_artifacts=True)
            if not decision.get("ok"):
                return

        if self._narration_enabled():
            narration = self._generate_narration_locked()
            if not narration.get("ok"):
                return
            event = self._current_narration_event()
            if event is not None and self._auto_dispatch_enabled():
                self._dispatch_narration_locked(event)

        if self.state.running and self.state.status != "warning":
            self.state.status = "scanning"
            self._emit_status()

    def _handle_capture_failure_locked(self, exc: Exception) -> bool:
        self.state.last_capture_ok = False
        self.state.last_capture_source = ""
        self.state.last_error = str(exc)
        self._consecutive_capture_failures += 1
        return self._apply_failure_degrade()

    def _ensure_perception_locked(self) -> tuple[bool, dict[str, Any]]:
        if self.state.last_perception_ok and self.state.last_perception:
            return True, self.state.last_perception

        frame_path = self._resolve_latest_frame_path()
        if frame_path is None:
            return False, {
                "ok": False,
                "error": "no perception available and no captured frame available",
            }
        payload = self._analyze_frame_locked(frame_path)
        if not payload.get("ok"):
            return False, payload
        return True, payload

    def _ensure_decision_locked(self) -> tuple[bool, dict[str, Any]]:
        if self.state.last_decision_ok and self.state.last_decision:
            return True, self.state.last_decision
        ready, payload = self._ensure_perception_locked()
        if not ready:
            return False, payload
        payload = self._generate_decision_locked()
        if not payload.get("ok"):
            return False, payload
        return True, payload

    def _ensure_narration_locked(self) -> tuple[bool, dict[str, Any]]:
        if self.state.last_narration_ok and self.state.last_narration:
            return True, self.state.last_narration
        ready, payload = self._ensure_decision_locked()
        if not ready:
            return False, payload
        payload = self._generate_narration_locked()
        if not payload.get("ok"):
            return False, payload
        return True, payload

    def _get_sample_interval_ms(self) -> int:
        companion_cfg = self._config.get("mahjong_companion", {})
        value = companion_cfg.get("sample_interval_ms", 1200)
        try:
            parsed = int(value)
        except Exception:
            parsed = 1200
        return max(300, parsed)

    def _get_keywords(self) -> list[str]:
        companion_cfg = self._config.get("mahjong_companion", {})
        raw = companion_cfg.get("target_window_title_keywords", [])
        if not isinstance(raw, list):
            return []
        return [str(item).strip() for item in raw if str(item).strip()]

    def _get_capture_format(self) -> str:
        companion_cfg = self._config.get("mahjong_companion", {})
        capture_cfg = companion_cfg.get("capture", {})
        if not isinstance(capture_cfg, dict):
            return "png"
        value = str(capture_cfg.get("save_format", "png")).strip().lower()
        return value if value in {"png", "jpg", "jpeg"} else "png"

    def _get_frame_gate_cfg(self) -> dict[str, Any]:
        companion_cfg = self._config.get("mahjong_companion", {})
        frame_gate_cfg = companion_cfg.get("frame_change_gate", {})
        if not isinstance(frame_gate_cfg, dict):
            frame_gate_cfg = {}
        return frame_gate_cfg

    def _get_human_override_guard_cfg(self) -> dict[str, Any]:
        companion_cfg = self._config.get("mahjong_companion", {})
        guard_cfg = companion_cfg.get("human_override_guard", {})
        if not isinstance(guard_cfg, dict):
            guard_cfg = {}
        return guard_cfg

    def _get_action_policy_cfg(self) -> dict[str, Any]:
        companion_cfg = self._config.get("mahjong_companion", {})
        action_cfg = companion_cfg.get("action_policy", {})
        if not isinstance(action_cfg, dict):
            action_cfg = {}
        return action_cfg

    def _get_memory_bridge_cfg(self) -> dict[str, Any]:
        companion_cfg = self._config.get("mahjong_companion", {})
        bridge_cfg = companion_cfg.get("memory_bridge", {})
        if not isinstance(bridge_cfg, dict):
            bridge_cfg = {}
        return bridge_cfg

    def _get_coaching_cfg(self) -> dict[str, Any]:
        companion_cfg = self._config.get("mahjong_companion", {})
        coaching_cfg = companion_cfg.get("coaching", {})
        if not isinstance(coaching_cfg, dict):
            coaching_cfg = {}
        return coaching_cfg

    def _perception_debug_dump_enabled(self) -> bool:
        companion_cfg = self._config.get("mahjong_companion", {})
        perception_cfg = companion_cfg.get("perception", {})
        if not isinstance(perception_cfg, dict):
            return True
        return bool(perception_cfg.get("debug_dump", True))

    def _perception_enabled(self) -> bool:
        companion_cfg = self._config.get("mahjong_companion", {})
        perception_cfg = companion_cfg.get("perception", {})
        if not isinstance(perception_cfg, dict):
            return True
        return bool(perception_cfg.get("enabled", True))

    def _decision_debug_dump_enabled(self) -> bool:
        companion_cfg = self._config.get("mahjong_companion", {})
        decision_cfg = companion_cfg.get("decision", {})
        if not isinstance(decision_cfg, dict):
            return True
        return bool(decision_cfg.get("debug_dump", True))

    def _decision_enabled(self) -> bool:
        companion_cfg = self._config.get("mahjong_companion", {})
        decision_cfg = companion_cfg.get("decision", {})
        if not isinstance(decision_cfg, dict):
            return True
        return bool(decision_cfg.get("enabled", True))

    def _narration_debug_dump_enabled(self) -> bool:
        companion_cfg = self._config.get("mahjong_companion", {})
        narration_cfg = companion_cfg.get("narration", {})
        if not isinstance(narration_cfg, dict):
            return True
        return bool(narration_cfg.get("debug_dump", True))

    def _narration_enabled(self) -> bool:
        companion_cfg = self._config.get("mahjong_companion", {})
        narration_cfg = companion_cfg.get("narration", {})
        if not isinstance(narration_cfg, dict):
            return True
        return bool(narration_cfg.get("enabled", True))

    def _auto_dispatch_enabled(self) -> bool:
        speech_cfg = self._get_speech_policy_cfg()
        return bool(speech_cfg.get("auto_dispatch_enabled", True))

    def _get_speech_policy_cfg(self) -> dict[str, Any]:
        companion_cfg = self._config.get("mahjong_companion", {})
        speech_cfg = companion_cfg.get("speech_policy", {})
        if not isinstance(speech_cfg, dict):
            speech_cfg = {}
        merged = dict(speech_cfg)
        merged["voice_enabled"] = self.state.voice_enabled
        merged["voice_mode"] = self.state.voice_mode
        return merged

    def _get_voice_target_lanlan(self) -> str:
        speech_cfg = self._get_speech_policy_cfg()
        return str(speech_cfg.get("target_lanlan", "")).strip()

    def _bind_window(self) -> WindowBindingResult:
        result = self._capture_provider.locate_window(self._get_keywords())
        self.state.window_bound = result.bound
        self.state.window_title = result.window_title or result.app_name
        self.state.window_match_keyword = result.match_keyword
        self.state.window_left = result.left
        self.state.window_top = result.top
        self.state.window_width = result.width
        self.state.window_height = result.height
        if result.bound:
            self.state.last_error = ""
        elif result.error:
            self.state.last_error = result.error
        return result

    def _capture_debug_frame_locked(self, binding_result: WindowBindingResult) -> dict[str, Any]:
        packet = self._capture_provider.capture_frame(
            samples_dir=self.plugin.data_path("debug_samples"),
            binding_result=binding_result,
            save_format=self._get_capture_format(),
        )
        self.state.last_frame_path = packet.image_path
        self.state.last_frame_at = now_iso()
        self.state.last_capture_source = packet.source
        self.state.last_capture_ok = True
        self.state.last_error = ""
        self._consecutive_capture_failures = 0
        self._clear_perception_state()
        self._clear_decision_state()
        self._clear_narration_state()
        if self.state.running and self.state.status == "warning":
            self.state.status = "scanning"
        self._emit_status()
        return {
            "saved": True,
            "path": packet.image_path,
            "source": packet.source,
            "window_bound": binding_result.bound,
            "window_title": self.state.window_title,
            "match_keyword": self.state.window_match_keyword,
            "binding_error": binding_result.error,
        }

    def _apply_failure_degrade(self) -> bool:
        if not self.state.running:
            return False
        if self._consecutive_capture_failures >= 3:
            self.state.status = "warning"
        if self._consecutive_capture_failures >= 6:
            self.state.running = False
            self.state.status = "idle"
            return True
        return False

    def _resolve_latest_frame_path(self) -> Optional[Path]:
        if self.state.last_frame_path:
            candidate = Path(self.state.last_frame_path)
            if candidate.exists():
                return candidate

        samples_dir = self.plugin.data_path("debug_samples")
        if not samples_dir.exists():
            return None

        candidates = [
            path for path in samples_dir.iterdir()
            if path.is_file() and path.suffix.lower() in {".png", ".jpg", ".jpeg"}
        ]
        if not candidates:
            return None
        return max(candidates, key=lambda path: path.stat().st_mtime)

    def _current_perceived_state(self) -> Optional[PerceivedGameState]:
        if not self.state.last_perception_ok or not self.state.last_perception:
            return None
        try:
            return PerceivedGameState(**self.state.last_perception)
        except Exception:
            return None

    def _current_decision_result(self) -> Optional[DecisionResult]:
        if not self.state.last_decision_ok or not self.state.last_decision:
            return None
        try:
            return DecisionResult(**self.state.last_decision)
        except Exception:
            return None

    def _current_narration_event(self) -> Optional[NarrationEvent]:
        if not self.state.last_narration_ok or not self.state.last_narration:
            return None
        try:
            return NarrationEvent(**self.state.last_narration)
        except Exception:
            return None

    def _reapply_current_narration_policy_locked(self) -> Optional[NarrationEvent]:
        event = self._current_narration_event()
        if event is None:
            return None
        updated = apply_speech_policy(
            event,
            self._get_speech_policy_cfg(),
            last_spoken_at=self.state.last_spoken_at,
            last_spoken_text=self.state.last_spoken_text,
            last_notified_at=self.state.last_notification_at,
            last_notified_text=self.state.last_notification_text,
            last_notified_key=self.state.last_notification_key,
        )
        self.state.last_narration = updated.to_dict()
        self.state.last_narration_delivery = updated.delivery
        self.state.last_narration_channel = updated.channel
        self.state.last_narration_text = updated.text
        if self.state.last_companion_view:
            self.state.last_companion_view["delivery"] = updated.delivery
            self.state.last_companion_view["speakable"] = updated.speakable
        self._emit_status()
        return updated

    def _apply_perception_result(self, perceived: PerceivedGameState) -> dict[str, Any]:
        payload = perceived.to_dict()
        self.state.scene = perceived.scene
        self.state.last_scene = perceived.scene
        self.state.last_scene_confidence = perceived.confidence
        self.state.last_is_user_turn = perceived.is_user_turn
        self.state.last_buttons = list(perceived.buttons)
        self.state.last_perception_at = now_iso()
        self.state.last_perception_ok = True
        self.state.last_perception = perceived.to_dict()
        self._clear_decision_state()
        self._clear_narration_state()
        self.state.last_error = ""
        return payload

    def _apply_decision_result(self, decision: DecisionResult) -> dict[str, Any]:
        payload = decision.to_dict()
        analysis = decision.mahjong_analysis if isinstance(decision.mahjong_analysis, dict) else {}
        self.state.last_decision_at = now_iso()
        self.state.last_decision_ok = True
        self.state.last_decision_type = decision.decision_type
        self.state.last_decision_risk_level = decision.risk_level
        self.state.last_tile_analysis_available = bool(analysis.get("tile_level_available", False))
        self.state.last_shanten_estimate = analysis.get("shanten_estimate")
        self.state.last_ukeire_estimate = analysis.get("ukeire_estimate")
        self.state.last_decision = decision.to_dict()
        self._clear_narration_state()
        self.state.last_error = ""
        return payload

    def _apply_narration_result(self, event: Any, view_model: Any) -> dict[str, Any]:
        event_payload = event.to_dict()
        view_payload = view_model.to_dict()
        self.state.last_narration_at = now_iso()
        self.state.last_narration_ok = True
        self.state.last_narration_type = event.event_type
        self.state.last_narration_channel = event.channel
        self.state.last_narration_delivery = event.delivery
        self.state.last_narration_text = event.text
        self.state.last_narration = event.to_dict()
        self.state.last_companion_mood = view_model.mood
        self.state.last_companion_view = view_model.to_dict()
        self.state.last_error = ""
        return {
            **event_payload,
            "companion_view": view_payload,
        }

    def _apply_review_summary_result(self, summary: dict[str, Any]) -> dict[str, Any]:
        self.state.last_review_summary_at = now_iso()
        self.state.last_review_summary_ok = True
        self.state.last_review_summary = dict(summary)
        self.state.last_review_summary_text = str(summary.get("summary_text", ""))
        self.state.last_error = ""
        return dict(summary)

    def _apply_host_memory_sync_result(self, report: dict[str, Any]) -> dict[str, Any]:
        self.state.last_host_memory_sync_at = str(report.get("attempted_at") or now_iso())
        self.state.last_host_memory_sync_status = str(report.get("status", ""))
        self.state.last_host_memory_sync_note = str(report.get("note", ""))
        self.state.last_host_memory_sync_pending = int(report.get("pending_count", 0) or 0)
        self.state.last_error = ""
        return dict(report)

    def _apply_coaching_outputs(self, trend: dict[str, Any], topics_payload: dict[str, Any]) -> dict[str, Any]:
        self.state.last_coaching_trend_at = str(trend.get("generated_at") or now_iso())
        self.state.last_coaching_trend = dict(trend)
        self.state.last_coaching_summary_text = str(trend.get("summary_text", ""))
        self.state.last_coaching_focus = str(trend.get("coach_focus", ""))
        topics = topics_payload.get("topics", [])
        self.state.last_coaching_topics = list(topics) if isinstance(topics, list) else []
        self.state.last_error = ""
        return {
            "coaching_trend": dict(trend),
            "coaching_topics": dict(topics_payload),
        }

    def _refresh_coaching_state_locked(self, cache_dir: Path) -> dict[str, Any]:
        coaching_cfg = self._get_coaching_cfg()
        trend, trend_path = generate_coaching_trend(
            cache_dir,
            session_window=int(coaching_cfg.get("trend_window_sessions", 3)),
        )
        topics_payload, topics_path = generate_coaching_topics(
            cache_dir,
            trend,
            topic_limit=int(coaching_cfg.get("topic_limit", 3)),
        )
        payload = self._apply_coaching_outputs(trend, topics_payload)
        payload["coaching_trend_path"] = str(trend_path)
        payload["coaching_topics_path"] = str(topics_path)
        return payload

    def load_cached_outputs(self) -> None:
        cache_dir = self.plugin.data_path("session_cache")
        sync_payload = self._load_cache_json(cache_dir / "host_memory_sync_report.json")
        if sync_payload:
            self._apply_host_memory_sync_result(sync_payload)

        trend_payload = self._load_cache_json(cache_dir / "coaching_trend.json")
        topics_payload = self._load_cache_json(cache_dir / "coaching_topics.json")
        if trend_payload and topics_payload:
            self._apply_coaching_outputs(trend_payload, topics_payload)

    def _load_cache_json(self, path: Path) -> dict[str, Any]:
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return {}
        return payload if isinstance(payload, dict) else {}

    def _dispatch_narration_locked(self, event: NarrationEvent) -> dict[str, Any]:
        if event.delivery not in {"proactive_notification", "voice_candidate"}:
            return {
                "ok": False,
                "skipped": True,
                "reason": "delivery_suppressed",
                "delivery": event.delivery,
            }
        self._queue_runtime_outbound_event_locked(
            event,
            require_running=True,
            require_window_bound=True,
        )
        flushed = self._flush_runtime_outbox_locked(limit=1)
        if flushed:
            return flushed[-1]
        return {
            "ok": False,
            "skipped": True,
            "reason": "runtime_outbox_empty",
        }

    def _dispatch_debug_narration_locked(self, event: NarrationEvent) -> dict[str, Any]:
        self._narration_dispatcher.apply_debug_reply_event(event, state=self.state)
        self._queue_runtime_outbound_event_locked(
            event,
            require_running=False,
            require_window_bound=False,
        )
        flushed = self._flush_runtime_outbox_locked(limit=1)
        if flushed:
            return flushed[-1]
        return {
            "ok": False,
            "skipped": True,
            "reason": "runtime_outbox_empty",
        }

    def _build_debug_reply_event(self, event: NarrationEvent) -> NarrationEvent:
        return self._narration_dispatcher.build_debug_reply_event(event)

    def _apply_debug_reply_event(self, event: NarrationEvent) -> None:
        self._narration_dispatcher.apply_debug_reply_event(event, state=self.state)

    def _queue_runtime_outbound_event_locked(
        self,
        event: NarrationEvent,
        *,
        require_running: bool,
        require_window_bound: bool,
    ) -> None:
        envelope = self._game_runtime.enqueue_outbound(
            event_type="narration_event",
            payload={
                "event": event.to_dict(),
                "require_running": bool(require_running),
                "require_window_bound": bool(require_window_bound),
                "target_lanlan": self._get_voice_target_lanlan(),
            },
            priority=int(event.priority),
            dedupe_key=str(event.dedupe_key or "").strip(),
        )
        if envelope is None:
            self._sync_runtime_mailbox_state_locked()
            return
        self.state.last_runtime_outbound_id = envelope.message_id
        self.state.last_runtime_outbound_at = now_iso()
        self._sync_runtime_mailbox_state_locked()

    def _flush_runtime_outbox_locked(self, *, limit: int = 1) -> list[dict[str, Any]]:
        responses: list[dict[str, Any]] = []
        messages = self._game_runtime.pop_outbound_batch(limit=limit)
        for message in messages:
            if message.event_type != "narration_event":
                responses.append({
                    "ok": False,
                    "skipped": True,
                    "reason": f"unsupported_outbound_event:{message.event_type}",
                    "queued_message_id": message.message_id,
                })
                continue

            payload = message.payload if isinstance(message.payload, dict) else {}
            event_payload = payload.get("event", {})
            if not isinstance(event_payload, dict):
                responses.append({
                    "ok": False,
                    "skipped": True,
                    "reason": "invalid_narration_payload",
                    "queued_message_id": message.message_id,
                })
                continue

            try:
                event = NarrationEvent(**event_payload)
                response = self._narration_dispatcher.dispatch(
                    event,
                    state=self.state,
                    emit_status=self._emit_status,
                    target_lanlan=str(payload.get("target_lanlan", "")).strip(),
                    require_running=bool(payload.get("require_running", True)),
                    require_window_bound=bool(payload.get("require_window_bound", True)),
                )
            except Exception as exc:
                self.logger.exception("runtime outbox dispatch failed")
                response = {
                    "ok": False,
                    "error": str(exc),
                }

            response["queued_message_id"] = message.message_id
            responses.append(response)

        self._sync_runtime_mailbox_state_locked()
        return responses

    def _resolve_pipeline_frame_path(self, frame_path: str, capture: bool) -> Path | dict[str, Any]:
        if frame_path.strip():
            candidate = Path(frame_path).expanduser()
            if not candidate.is_absolute():
                candidate = (Path.cwd() / candidate).resolve()
            return candidate

        if capture:
            binding_result = self._bind_window()
            try:
                payload = self._capture_debug_frame_locked(binding_result)
                return Path(str(payload["path"]))
            except Exception as exc:
                self.logger.exception("run_companion_pipeline capture failed")
                self._handle_capture_failure_locked(exc)
                self._emit_status()
                return {
                    "ok": False,
                    "stage": "capture",
                    "error": str(exc),
                    "window_bound": self.state.window_bound,
                    "window_title": self.state.window_title,
                    "binding_error": binding_result.error,
                }

        candidate = self._resolve_latest_frame_path()
        if candidate is None:
            return {
                "ok": False,
                "stage": "frame_selection",
                "error": "no frame available; provide frame_path or enable capture",
            }
        return candidate

    def _should_process_frame_locked(self, frame_path: Path) -> bool:
        frame_gate_cfg = self._get_frame_gate_cfg()
        decision = self._frame_change_gate.evaluate(
            frame_path,
            enabled=bool(frame_gate_cfg.get("enabled", True)),
            min_change_distance=int(frame_gate_cfg.get("min_change_distance", 3)),
            stable_skip_limit=int(frame_gate_cfg.get("stable_skip_limit", 300)),
        )
        return decision.should_process

    def _execute_assist_action_locked(
        self,
        action_id: str,
        *,
        dry_run: bool = False,
        user_confirmed: bool = False,
    ) -> dict[str, Any]:
        """Core execution logic for assist actions.

        Steps:
        1. Validate action against registry, scene, mode, and confirmation.
        2. If dry_run, return the validation result without executing.
        3. Build InputCommand from action_id and window geometry.
        4. Arm HumanOverrideGuard.
        5. Execute via InputAdapter with guard check.
        6. Log the result.
        7. Update session state.
        """
        self._human_override_guard.configure_pointer_provider(self._input_adapter.get_pointer)
        current_scene = self.state.scene or "unknown"
        action_policy_cfg = self._get_action_policy_cfg()
        allowed_contexts = action_policy_cfg.get("allowed_contexts", [])
        allowed_contexts = (
            [str(item).strip() for item in allowed_contexts if str(item).strip()]
            if isinstance(allowed_contexts, list) else []
        )

        if self.state.runtime_mode != "active":
            reason = f"runtime_mode={self.state.runtime_mode} blocks game actions"
            blocked = ActionExecutionResult(
                ok=False,
                action_id=action_id,
                executed_at=now_iso(),
                blocked_reason=reason,
                guard_aborted=False,
                window_title=self.state.window_title,
            )
            self._record_action_result(blocked, allow_reason=reason)
            self._emit_status()
            return blocked.to_dict()

        allowed, reason = self._action_registry.validate(
            action_id,
            current_scene=current_scene,
            action_mode=self.state.action_mode,
            session_running=self.state.running,
            user_confirmed=user_confirmed,
        )
        if not allowed:
            blocked = ActionExecutionResult(
                ok=False,
                action_id=action_id,
                executed_at=now_iso(),
                blocked_reason=reason,
                guard_aborted=False,
                window_title=self.state.window_title,
            )
            self._record_action_result(blocked, allow_reason=reason)
            self._emit_status()
            return blocked.to_dict()

        if allowed_contexts and current_scene not in allowed_contexts:
            reason = f"scene '{current_scene}' not in action_policy.allowed_contexts {allowed_contexts}"
            blocked = ActionExecutionResult(
                ok=False,
                action_id=action_id,
                executed_at=now_iso(),
                blocked_reason=reason,
                guard_aborted=False,
                window_title=self.state.window_title,
            )
            self._record_action_result(blocked, allow_reason=reason)
            self._emit_status()
            return blocked.to_dict()

        if dry_run:
            result = ActionExecutionResult(
                ok=True, action_id=action_id,
                executed_at=now_iso(),
                blocked_reason="dry_run",
                window_title=self.state.window_title,
            )
            self._record_action_result(result, allow_reason="dry_run")
            self._emit_status()
            return result.to_dict()

        if self.state.window_bound:
            binding_result = WindowBindingResult(
                bound=True,
                window_title=self.state.window_title,
                match_keyword=self.state.window_match_keyword,
                left=self.state.window_left,
                top=self.state.window_top,
                width=self.state.window_width,
                height=self.state.window_height,
            )
        else:
            binding_result = self._bind_window()
        if not binding_result.bound:
            reason = binding_result.error or "window not bound"
            blocked = ActionExecutionResult(
                ok=False,
                action_id=action_id,
                executed_at=now_iso(),
                blocked_reason=reason,
                guard_aborted=False,
                window_title=self.state.window_title,
            )
            self._record_action_result(blocked, allow_reason=reason)
            self._emit_status()
            return blocked.to_dict()

        if not binding_result.has_bounds():
            reason = "window bounds unavailable"
            blocked = ActionExecutionResult(
                ok=False,
                action_id=action_id,
                executed_at=now_iso(),
                blocked_reason=reason,
                guard_aborted=False,
                window_title=self.state.window_title,
            )
            self._record_action_result(blocked, allow_reason=reason)
            self._emit_status()
            return blocked.to_dict()

        command = InputAdapter.build_command_from_action(
            action_id,
            window_left=binding_result.left or 0,
            window_top=binding_result.top or 0,
            window_width=binding_result.width or 0,
            window_height=binding_result.height or 0,
        )
        if command is None:
            reason = f"no screen mapping for action_id: {action_id}"
            blocked = ActionExecutionResult(
                ok=False,
                action_id=action_id,
                executed_at=now_iso(),
                blocked_reason=reason,
                guard_aborted=False,
                window_title=self.state.window_title,
            )
            self._record_action_result(blocked, allow_reason=reason)
            self._emit_status()
            return blocked.to_dict()

        guard_cfg = self._get_human_override_guard_cfg()
        guard_enabled = bool(guard_cfg.get("enabled", True)) and bool(guard_cfg.get("abort_on_human_input", True))
        active_window_sec = float(guard_cfg.get("active_window_sec", 1.5))
        movement_threshold_px = int(guard_cfg.get("movement_threshold_px", 18))

        self._human_override_guard.arm(
            enabled=guard_enabled,
            active_window_sec=active_window_sec,
            movement_threshold_px=movement_threshold_px,
        )

        def guard_check() -> tuple[bool, str]:
            decision = self._human_override_guard.evaluate()
            if decision.should_abort:
                return True, decision.reason
            return False, ""

        result_payload = self._input_adapter.execute(command, guard_check=guard_check)
        self._human_override_guard.reset()

        guard_aborted = bool(result_payload.get("aborted", False))
        ok = bool(result_payload.get("ok", False))
        result = ActionExecutionResult(
            ok=ok,
            action_id=action_id,
            executed_at=now_iso(),
            blocked_reason="" if ok else result_payload.get("abort_reason", "execution_failed"),
            guard_aborted=guard_aborted,
            window_title=self.state.window_title,
        )

        self._record_action_result(result, allow_reason=reason)
        self._emit_status()
        return result.to_dict()

    def _record_action_result(self, result: ActionExecutionResult, *, allow_reason: str = "") -> None:
        log_entry = ActionLogEntry(
            action_id=result.action_id,
            executed_at=result.executed_at or now_iso(),
            ok=result.ok,
            blocked_reason=result.blocked_reason,
            guard_aborted=result.guard_aborted,
            window_title=result.window_title,
            trigger_source="manual",
            allow_reason=allow_reason,
        )
        log_path = append_action_log(self.plugin.data_path("session_cache"), log_entry)
        result.log_path = str(log_path)
        self._apply_action_result(result)

    def _apply_action_result(self, result: ActionExecutionResult) -> None:
        self.state.last_action_id = result.action_id
        self.state.last_action_at = result.executed_at
        self.state.last_action_ok = result.ok
        self.state.last_action_blocked_reason = result.blocked_reason
        self.state.last_action_guard_aborted = result.guard_aborted
        if not result.ok:
            self.state.last_error = result.blocked_reason
        else:
            self.state.last_error = ""

    def _should_persist_review_artifacts(
        self,
        frame_path: Path | None,
        *,
        persist_review_artifacts: bool | None = None,
    ) -> bool:
        if persist_review_artifacts is not None:
            return bool(persist_review_artifacts)
        if not self.state.running or frame_path is None:
            return False
        try:
            frame_path.resolve().relative_to(self.plugin.data_path("debug_samples").resolve())
        except Exception:
            return False
        return True

    def _mark_perception_failure(self, error: str) -> None:
        self.state.scene = "unknown"
        self.state.last_scene = "unknown"
        self.state.last_scene_confidence = 0.0
        self.state.last_is_user_turn = False
        self.state.last_buttons = []
        self.state.last_perception_at = now_iso()
        self.state.last_perception_ok = False
        self.state.last_perception = {}
        self._clear_decision_state()
        self._clear_narration_state()
        self.state.last_error = error

    def _mark_decision_failure(self, error: str) -> None:
        self._clear_decision_state()
        self._clear_narration_state()
        self.state.last_error = error

    def _mark_narration_failure(self, error: str) -> None:
        self._clear_narration_state()
        self.state.last_error = error

    def _clear_binding(self) -> None:
        self.state.window_bound = False
        self.state.window_title = ""
        self.state.window_match_keyword = ""
        self.state.window_left = None
        self.state.window_top = None
        self.state.window_width = None
        self.state.window_height = None

    def _clear_perception_state(self) -> None:
        self.state.scene = "unknown"
        self.state.last_scene = "unknown"
        self.state.last_scene_confidence = 0.0
        self.state.last_is_user_turn = False
        self.state.last_buttons = []
        self.state.last_perception_at = ""
        self.state.last_perception_ok = False
        self.state.last_perception = {}

    def _clear_decision_state(self) -> None:
        self.state.last_decision_at = ""
        self.state.last_decision_ok = False
        self.state.last_decision_type = ""
        self.state.last_decision_risk_level = ""
        self.state.last_tile_analysis_available = False
        self.state.last_shanten_estimate = None
        self.state.last_ukeire_estimate = None
        self.state.last_decision = {}

    def _clear_narration_state(self) -> None:
        self.state.last_narration_at = ""
        self.state.last_narration_ok = False
        self.state.last_narration_type = ""
        self.state.last_narration_channel = ""
        self.state.last_narration_delivery = ""
        self.state.last_narration_text = ""
        self.state.last_narration = {}
        self.state.last_companion_mood = "calm"
        self.state.last_companion_view = {}
        self.state.last_speak_ok = False

    def _sync_human_override_status(self) -> None:
        guard_cfg = self._get_human_override_guard_cfg()
        window = self._human_override_guard.snapshot()
        self.state.last_human_override_armed = window.armed
        if window.armed:
            self.state.last_human_override_reason = "guard_armed"
            self.state.last_human_override_at = now_iso()
        elif bool(guard_cfg.get("enabled", True)):
            self.state.last_human_override_reason = "guard_ready"
        else:
            self.state.last_human_override_reason = "guard_disabled"

    def _sync_runtime_mailbox_state_locked(self) -> None:
        snapshot = self._game_runtime.snapshot()
        self.state.runtime_inbound_pending = int(snapshot.get("inbound_pending", 0) or 0)
        self.state.runtime_outbound_pending = int(snapshot.get("outbound_pending", 0) or 0)
        self.state.runtime_dropped_inbound = int(snapshot.get("dropped_inbound", 0) or 0)
        self.state.runtime_dropped_outbound = int(snapshot.get("dropped_outbound", 0) or 0)
        self.state.runtime_deduped_outbound = int(snapshot.get("deduped_outbound", 0) or 0)

    async def _cancel_background_loop_locked(self) -> None:
        if self._task is None:
            return
        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass
        finally:
            self._task = None

    def _derive_report_status(self) -> str:
        if self.state.runtime_mode == "standby" and self.state.running:
            return "standby"
        if self.state.runtime_mode == "off":
            return "idle"
        runtime_status = self.state.status
        if runtime_status in {"idle", "starting", "stopping", "warning", "error"}:
            return runtime_status
        if not self.state.running:
            return "idle"
        if self.state.scene and self.state.scene != "unknown":
            return self.state.scene
        return "scanning"

    def _build_status_snapshot(self) -> dict[str, Any]:
        report_status = self._derive_report_status()
        return {
            "status": report_status,
            "runtime_status": self.state.status,
            "mode": self.state.mode,
            "scene": self.state.scene,
            "session_id": self.state.session_id,
            "window_bound": self.state.window_bound,
            "window_title": self.state.window_title,
            "window_match_keyword": self.state.window_match_keyword,
            "window_left": self.state.window_left,
            "window_top": self.state.window_top,
            "window_width": self.state.window_width,
            "window_height": self.state.window_height,
            "last_frame_path": self.state.last_frame_path,
            "last_frame_at": self.state.last_frame_at,
            "last_capture_source": self.state.last_capture_source,
            "last_capture_ok": self.state.last_capture_ok,
            "last_scene": self.state.last_scene,
            "last_scene_confidence": self.state.last_scene_confidence,
            "last_is_user_turn": self.state.last_is_user_turn,
            "last_buttons": self.state.last_buttons,
            "last_perception_at": self.state.last_perception_at,
            "last_perception_ok": self.state.last_perception_ok,
            "last_perception": self.state.last_perception,
            "last_decision_at": self.state.last_decision_at,
            "last_decision_ok": self.state.last_decision_ok,
            "last_decision_type": self.state.last_decision_type,
            "last_decision_risk_level": self.state.last_decision_risk_level,
            "last_tile_analysis_available": self.state.last_tile_analysis_available,
            "last_shanten_estimate": self.state.last_shanten_estimate,
            "last_ukeire_estimate": self.state.last_ukeire_estimate,
            "last_decision": self.state.last_decision,
            "last_narration_at": self.state.last_narration_at,
            "last_narration_ok": self.state.last_narration_ok,
            "last_narration_type": self.state.last_narration_type,
            "last_narration_channel": self.state.last_narration_channel,
            "last_narration_delivery": self.state.last_narration_delivery,
            "last_narration_text": self.state.last_narration_text,
            "last_narration": self.state.last_narration,
            "last_companion_mood": self.state.last_companion_mood,
            "last_companion_view": self.state.last_companion_view,
            "voice_enabled": self.state.voice_enabled,
            "voice_mode": self.state.voice_mode,
            "last_notification_at": self.state.last_notification_at,
            "last_notification_text": self.state.last_notification_text,
            "last_notification_key": self.state.last_notification_key,
            "last_notification_channel": self.state.last_notification_channel,
            "last_notification_delivery": self.state.last_notification_delivery,
            "last_notification_ok": self.state.last_notification_ok,
            "last_spoken_at": self.state.last_spoken_at,
            "last_spoken_text": self.state.last_spoken_text,
            "last_speak_ok": self.state.last_speak_ok,
            "last_human_override_armed": self.state.last_human_override_armed,
            "last_human_override_reason": self.state.last_human_override_reason,
            "last_human_override_at": self.state.last_human_override_at,
            "last_memory_bridge_at": self.state.last_memory_bridge_at,
            "last_memory_bridge_status": self.state.last_memory_bridge_status,
            "last_memory_bridge_summary": self.state.last_memory_bridge_summary,
            "last_host_memory_sync_at": self.state.last_host_memory_sync_at,
            "last_host_memory_sync_status": self.state.last_host_memory_sync_status,
            "last_host_memory_sync_note": self.state.last_host_memory_sync_note,
            "last_host_memory_sync_pending": self.state.last_host_memory_sync_pending,
            "last_review_summary_at": self.state.last_review_summary_at,
            "last_review_summary_ok": self.state.last_review_summary_ok,
            "last_review_summary": self.state.last_review_summary,
            "last_review_summary_text": self.state.last_review_summary_text,
            "last_coaching_trend_at": self.state.last_coaching_trend_at,
            "last_coaching_trend": self.state.last_coaching_trend,
            "last_coaching_summary_text": self.state.last_coaching_summary_text,
            "last_coaching_focus": self.state.last_coaching_focus,
            "last_coaching_topics": self.state.last_coaching_topics,
            "action_mode": self.state.action_mode,
            "runtime_mode": self.state.runtime_mode,
            "game_runtime_status": self.state.runtime_status,
            "runtime_interrupt_seq": self.state.runtime_interrupt_seq,
            "runtime_inbound_pending": self.state.runtime_inbound_pending,
            "runtime_outbound_pending": self.state.runtime_outbound_pending,
            "runtime_dropped_inbound": self.state.runtime_dropped_inbound,
            "runtime_dropped_outbound": self.state.runtime_dropped_outbound,
            "runtime_deduped_outbound": self.state.runtime_deduped_outbound,
            "last_runtime_command_id": self.state.last_runtime_command_id,
            "last_runtime_command_at": self.state.last_runtime_command_at,
            "last_runtime_command_source": self.state.last_runtime_command_source,
            "last_runtime_command_action": self.state.last_runtime_command_action,
            "last_runtime_command_ok": self.state.last_runtime_command_ok,
            "last_runtime_command_result": self.state.last_runtime_command_result,
            "last_runtime_interrupt_at": self.state.last_runtime_interrupt_at,
            "last_runtime_interrupt_reason": self.state.last_runtime_interrupt_reason,
            "last_runtime_outbound_id": self.state.last_runtime_outbound_id,
            "last_runtime_outbound_at": self.state.last_runtime_outbound_at,
            "last_action_id": self.state.last_action_id,
            "last_action_at": self.state.last_action_at,
            "last_action_ok": self.state.last_action_ok,
            "last_action_blocked_reason": self.state.last_action_blocked_reason,
            "last_action_guard_aborted": self.state.last_action_guard_aborted,
            "last_error": self.state.last_error,
        }

    def _emit_status(self) -> None:
        self._sync_human_override_status()
        self._sync_runtime_mailbox_state_locked()
        snapshot = self._build_status_snapshot()
        self.plugin.report_status(snapshot)
        self._write_session_cache(snapshot)

    def _write_session_cache(self, snapshot: dict[str, Any]) -> None:
        cache_dir = self.plugin.data_path("session_cache")
        try:
            cache_dir.mkdir(parents=True, exist_ok=True)
            cache_path = cache_dir / "latest_session.json"
            cache_path.write_text(
                json.dumps(snapshot, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        except Exception:
            self.logger.exception("failed to write mahjong companion session cache")
