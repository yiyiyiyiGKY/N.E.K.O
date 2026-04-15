from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any, Optional

from plugin.sdk.plugin import Ok

from .action import HumanOverrideGuard
from .capture import DefaultCaptureProvider
from .contracts import DecisionResult, PerceivedGameState
from .decision.adapter import DefaultDecisionAdapter
from .decision.debug_dump import write_debug_artifacts as write_decision_debug_artifacts
from .gates import DefaultFrameChangeGate
from .narration import NarrationEvent, apply_speech_policy, generate_narration
from .narration.debug_dump import write_debug_artifacts as write_narration_debug_artifacts
from .narration.dispatcher import NarrationDispatcher
from .perception import analyze_image_path
from .perception.debug_dump import write_debug_artifacts as write_perception_debug_artifacts
from .review import (
    append_review_candidate,
    build_memory_summary,
    build_review_candidate,
    stage_memory_summary,
)
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

    async def start(self):
        async with self._lock:
            if self.state.running:
                return Ok({"already_running": True, **self.get_status()})

            self.state.running = True
            self.state.status = "starting"
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
            self.state.started_at = self.state.started_at or now_iso()
            self._frame_change_gate.reset()
            self._human_override_guard.reset()
            self._emit_status()
            self._task = asyncio.create_task(self._run_loop(), name="mahjong-companion-loop")
            return Ok(self.get_status())

    async def stop(self):
        async with self._lock:
            self.state.running = False
            self.state.status = "stopping"
            self._emit_status()

            if self._task:
                self._task.cancel()
                try:
                    await self._task
                except asyncio.CancelledError:
                    pass
                self._task = None

            self.state.status = "idle"
            self._consecutive_capture_failures = 0
            self._frame_change_gate.reset()
            self._human_override_guard.reset()
            self._emit_status()
            return Ok(self.get_status())

    async def set_mode(self, mode: str) -> None:
        async with self._lock:
            self.state.mode = mode
            self._emit_status()

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
        self._emit_status()
        interval_ms = self._get_sample_interval_ms()
        try:
            while self.state.running:
                async with self._lock:
                    self._run_live_cycle_locked()
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
            self._emit_status()

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
                review_path = append_review_candidate(self.plugin.data_path("session_cache"), review_candidate)
                artifacts["review_candidates_path"] = str(review_path)
                bridge_cfg = self._get_memory_bridge_cfg()
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

    def _get_memory_bridge_cfg(self) -> dict[str, Any]:
        companion_cfg = self._config.get("mahjong_companion", {})
        bridge_cfg = companion_cfg.get("memory_bridge", {})
        if not isinstance(bridge_cfg, dict):
            bridge_cfg = {}
        return bridge_cfg

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
        self.state.last_decision_at = now_iso()
        self.state.last_decision_ok = True
        self.state.last_decision_type = decision.decision_type
        self.state.last_decision_risk_level = decision.risk_level
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

    def _dispatch_narration_locked(self, event: NarrationEvent) -> dict[str, Any]:
        return self._narration_dispatcher.dispatch(
            event,
            state=self.state,
            emit_status=self._emit_status,
            target_lanlan=self._get_voice_target_lanlan(),
            require_running=True,
            require_window_bound=True,
        )

    def _dispatch_debug_narration_locked(self, event: NarrationEvent) -> dict[str, Any]:
        self._narration_dispatcher.apply_debug_reply_event(event, state=self.state)
        return self._narration_dispatcher.dispatch(
            event,
            state=self.state,
            emit_status=self._emit_status,
            target_lanlan=self._get_voice_target_lanlan(),
            require_running=False,
            require_window_bound=False,
        )

    def _build_debug_reply_event(self, event: NarrationEvent) -> NarrationEvent:
        return self._narration_dispatcher.build_debug_reply_event(event)

    def _apply_debug_reply_event(self, event: NarrationEvent) -> None:
        self._narration_dispatcher.apply_debug_reply_event(event, state=self.state)

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
            "last_error": self.state.last_error,
        }

    def _emit_status(self) -> None:
        self._sync_human_override_status()
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
