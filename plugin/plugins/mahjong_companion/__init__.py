from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any

from plugin.sdk.plugin import (
    NekoPluginBase,
    neko_plugin,
    plugin_entry,
    lifecycle,
    Ok,
    Err,
    SdkError,
    get_plugin_logger,
)

from .config_defaults import DEFAULT_CONFIG, merge_runtime_config
from .orchestrator import SessionOrchestrator


@neko_plugin
class MahjongCompanionPlugin(NekoPluginBase):
    def __init__(self, ctx: Any):
        super().__init__(ctx)
        self.logger = get_plugin_logger(__name__)
        self.orchestrator = SessionOrchestrator(self)

    @lifecycle(id="startup")
    async def startup(self, **_):
        cfg = await self.config.dump(timeout=5.0)
        merged = merge_runtime_config(DEFAULT_CONFIG, cfg if isinstance(cfg, dict) else {})
        self.orchestrator.apply_config(merged)
        self.orchestrator.load_cached_outputs()

        if self._ensure_static_ui_assets():
            ok = self.register_static_ui(
                "static",
                index_file="index.html",
                cache_control="no-cache, no-store, must-revalidate",
            )
            if ok:
                self.logger.info("mahjong companion static ui registered at /plugin/{}/ui/", self.plugin_id)
            else:
                self.logger.warning("mahjong companion static ui registration failed")
        else:
            self.logger.warning("mahjong companion bundled static ui not found")

        self.report_status(self.orchestrator.get_status())
        return Ok({"status": "ready"})

    @lifecycle(id="shutdown")
    async def shutdown(self, **_):
        await self.orchestrator.stop()
        self.report_status(self.orchestrator.get_status())
        return Ok({"status": "stopped"})

    @lifecycle(id="config_change")
    async def on_config_change(self, **_):
        cfg = await self.config.dump(timeout=5.0)
        merged = merge_runtime_config(DEFAULT_CONFIG, cfg if isinstance(cfg, dict) else {})
        self.orchestrator.apply_config(merged)
        return Ok({"reloaded": True, "mode": self.orchestrator.state.mode})

    @plugin_entry(id="start_session", name="启动会话", kind="action")
    async def start_session(self, **_):
        return await self.orchestrator.start()

    @plugin_entry(id="stop_session", name="停止会话", kind="action")
    async def stop_session(self, **_):
        return await self.orchestrator.stop()

    @plugin_entry(id="get_session_status", name="获取会话状态", kind="action")
    async def get_session_status(self, **_):
        return Ok(self.orchestrator.get_status())

    @plugin_entry(id="set_mode", name="设置模式", kind="action")
    async def set_mode(self, mode: str, **_):
        if mode not in {"spectate", "replay", "teaching", "silent"}:
            return Err(SdkError(f"invalid mode: {mode}"))
        await self.orchestrator.set_mode(mode)
        return Ok(self.orchestrator.get_status())

    @plugin_entry(id="set_runtime_mode", name="设置运行时模式", kind="action")
    async def set_runtime_mode(self, mode: str, **_):
        return await self.orchestrator.set_runtime_mode(mode)

    @plugin_entry(id="send_runtime_message", name="发送运行时消息", kind="action")
    async def send_runtime_message(
        self,
        action: str,
        payload: dict[str, Any] | None = None,
        interrupt: bool = True,
        source: str = "catgirl",
        **_,
    ):
        return await self.orchestrator.send_runtime_message(
            action=action,
            payload=payload or {},
            interrupt=bool(interrupt),
            source=source,
        )

    @plugin_entry(id="get_runtime_mailbox", name="获取运行时邮箱状态", kind="action")
    async def get_runtime_mailbox(self, **_):
        return await self.orchestrator.get_runtime_mailbox()

    @plugin_entry(id="capture_debug_frame", name="抓取调试帧", kind="action")
    async def capture_debug_frame(self, **_):
        return await self.orchestrator.capture_debug_frame()

    @plugin_entry(id="analyze_debug_frame", name="分析最近截图", kind="action")
    async def analyze_debug_frame(self, **_):
        return await self.orchestrator.analyze_debug_frame()

    @plugin_entry(id="analyze_frame_path", name="分析指定截图", kind="action")
    async def analyze_frame_path(self, frame_path: str, **_):
        return await self.orchestrator.analyze_frame_path(frame_path)

    @plugin_entry(id="get_last_perception", name="获取最近感知结果", kind="action")
    async def get_last_perception(self, **_):
        return await self.orchestrator.get_last_perception()

    @plugin_entry(id="generate_decision", name="生成决策结果", kind="action")
    async def generate_decision(self, **_):
        return await self.orchestrator.generate_decision()

    @plugin_entry(id="get_last_decision", name="获取最近决策结果", kind="action")
    async def get_last_decision(self, **_):
        return await self.orchestrator.get_last_decision()

    @plugin_entry(id="generate_narration", name="生成讲解结果", kind="action")
    async def generate_narration(self, **_):
        return await self.orchestrator.generate_narration()

    @plugin_entry(id="get_last_narration", name="获取最近讲解结果", kind="action")
    async def get_last_narration(self, **_):
        return await self.orchestrator.get_last_narration()

    @plugin_entry(id="generate_review_summary", name="生成复盘摘要", kind="action")
    async def generate_review_summary(self, **_):
        return await self.orchestrator.generate_review_summary()

    @plugin_entry(id="get_last_review_summary", name="获取最近复盘摘要", kind="action")
    async def get_last_review_summary(self, **_):
        return await self.orchestrator.get_last_review_summary()

    @plugin_entry(id="sync_memory_bridge", name="同步记忆桥", kind="action")
    async def sync_memory_bridge(self, **_):
        return await self.orchestrator.sync_memory_bridge()

    @plugin_entry(id="get_coaching_trend", name="获取跨局趋势", kind="action")
    async def get_coaching_trend(self, **_):
        return await self.orchestrator.get_coaching_trend()

    @plugin_entry(id="get_last_coaching_topics", name="获取训练话题", kind="action")
    async def get_last_coaching_topics(self, **_):
        return await self.orchestrator.get_last_coaching_topics()

    @plugin_entry(id="generate_review_summary_from_file", name="从文件生成复盘摘要", kind="action")
    async def generate_review_summary_from_file(self, review_candidates_path: str, **_):
        return await self.orchestrator.generate_review_summary_from_file(review_candidates_path)

    @plugin_entry(id="preview_companion_view", name="预览陪伴视图", kind="action")
    async def preview_companion_view(self, **_):
        return await self.orchestrator.preview_companion_view()

    @plugin_entry(id="run_companion_pipeline", name="跑完整陪伴链路", kind="action")
    async def run_companion_pipeline(
        self,
        frame_path: str = "",
        capture: bool = False,
        dispatch: bool = True,
        force_reply: bool = True,
        **_,
    ):
        return await self.orchestrator.run_companion_pipeline(
            frame_path=frame_path,
            capture=bool(capture),
            dispatch=bool(dispatch),
            force_reply=bool(force_reply),
        )

    @plugin_entry(id="speak_last_narration", name="播报最近讲解", kind="action")
    async def speak_last_narration(self, **_):
        return await self.orchestrator.speak_last_narration()

    @plugin_entry(id="cycle_voice_mode", name="切换语音模式", kind="action")
    async def cycle_voice_mode(self, **_):
        return await self.orchestrator.cycle_voice_mode()

    @plugin_entry(id="bind_window", name="尝试绑定窗口", kind="action")
    async def bind_window(self, **_):
        return await self.orchestrator.bind_window()

    @plugin_entry(id="unbind_window", name="解除窗口绑定", kind="action")
    async def unbind_window(self, **_):
        return await self.orchestrator.unbind_window()

    @plugin_entry(id="list_assist_actions", name="列出辅助动作", kind="action")
    async def list_assist_actions(self, **_):
        return await self.orchestrator.list_assist_actions()

    @plugin_entry(id="execute_assist_action", name="执行辅助动作", kind="action")
    async def execute_assist_action(self, action_id: str, dry_run: bool = False, user_confirmed: bool = False, **_):
        return await self.orchestrator.execute_assist_action(
            action_id, dry_run=bool(dry_run), user_confirmed=bool(user_confirmed),
        )

    @plugin_entry(id="get_action_log", name="获取动作日志", kind="action")
    async def get_action_log(self, **_):
        return await self.orchestrator.get_action_log()

    @plugin_entry(id="clear_action_log", name="清除动作日志", kind="action")
    async def clear_action_log(self, **_):
        return await self.orchestrator.clear_action_log()

    def _ensure_static_ui_assets(self) -> bool:
        source_dir = Path(__file__).resolve().parent / "static"
        index_path = source_dir / "index.html"
        if not source_dir.is_dir() or not index_path.is_file():
            return False

        target_dir = self.config_dir / "static"
        for source_path in source_dir.rglob("*"):
            relative = source_path.relative_to(source_dir)
            target_path = target_dir / relative
            if source_path.is_dir():
                target_path.mkdir(parents=True, exist_ok=True)
                continue
            target_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source_path, target_path)
        return True
