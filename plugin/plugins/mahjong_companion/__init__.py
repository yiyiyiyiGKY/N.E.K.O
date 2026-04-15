from __future__ import annotations

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

        if (self.config_dir / "static").exists():
            self.register_static_ui(
                "static",
                index_file="index.html",
                cache_control="no-cache, no-store, must-revalidate",
            )

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
