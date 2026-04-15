# 雀魂陪伴插件第一版骨架落地文档

> 关联文档：`docs/design/mahjong-companion-plugin-plan.md`
>
> 本文不再继续展开抽象设计，而是直接收敛到“现在就在仓库里建目录、建文件、填最小骨架”。
>
> 实施同步说明：
> - 本文聚焦第一版最小骨架目标。
> - 当前仓库实际实现已经继续推进到第三版，因此会额外存在 `bind_window` / `unbind_window`、真实截图、窗口绑定状态、`perception/` 子目录和基础感知入口等内容。
> - 凡是会影响第一版文档正确性的地方，本文已按当前代码修正，例如 `set_mode` 改为异步加锁调用、`shutdown` 最终状态回到 `idle`。
> - 第一版目标当前已经完成，可以视为已验收通过。
> - 当前这份文档保留的价值，主要是作为“第一版为什么这样收敛”的骨架说明，而不是待办清单。

---

## 1. 文档目标

这份文档只做三件事：

- 定义 `plugin/plugins/mahjong_companion/` 第一版应该长什么样。
- 给出首批文件的职责和最小代码骨架。
- 约束第一版只打通“插件接入 + 会话空骨架 + 调试 UI + 抓帧入口”，不一次做完全部雀魂能力。

第一版骨架的验收标准：

- 插件能在 `/ui/plugins` 中出现。
- 插件能正常启动、停止、重载。
- 插件能注册 `/plugin/mahjong_companion/ui/` 静态页面。
- UI 能触发 `start_session`、`stop_session`、`get_session_status`、`capture_debug_frame`。
- 宿主页能看到比单纯 `running` 更有信息量的 `report_status()` 状态。

---

## 2. 第一版范围

### 2.1 这一版必须有

- 标准 `Plugin` 目录和 `plugin.toml`
- 插件主类 `MahjongCompanionPlugin`
- 最小 `SessionOrchestrator`
- 最小 `SessionState`
- 默认配置模块
- 基础契约类型
- 插件静态 UI 三件套：`index.html` / `main.js` / `style.css`
- 最小数据目录约定

### 2.2 这一版先不做

- 真正可用的麻将识别算法
- 真正可用的出牌决策
- 自动辅助点击
- 复杂前端框架内嵌
- 训练模型和大规模样本流程

结论：

- 第一版是“插件骨架可跑起来”
- 不是“雀魂功能完整可用”

---

## 3. 推荐目录

第一版先建到这个粒度即可：

```text
plugin/plugins/mahjong_companion/
├── __init__.py
├── plugin.toml
├── README.md
├── contracts.py
├── config_defaults.py
├── orchestrator.py
├── session_state.py
├── static/
│   ├── index.html
│   ├── main.js
│   └── style.css
└── data/
    ├── .gitkeep
    ├── debug_samples/
    │   └── .gitkeep
    └── session_cache/
        └── .gitkeep
```

第一版不要急着把 `capture/`、`perception/`、`decision/`、`narration/`、`action/`、`review/` 全拆出来。

原因：

- 当前阶段先验证插件宿主接入和会话骨架。
- 过早拆太多文件只会让空模块变多。
- 等真正开始填抓帧、识别、建议逻辑时再拆子目录更自然。

---

## 4. 每个文件的职责

### 4.1 `plugin.toml`

职责：

- 让宿主识别这个插件
- 提供基础元信息
- 配置插件运行方式

建议骨架：

```toml
[plugin]
id = "mahjong_companion"
name = "雀魂陪伴"
description = "雀魂陪伴、讲解与复盘插件"
short_description = "Screen-driven Mahjong Soul companion plugin for guidance and review."
version = "0.1.0"
entry = "plugin.plugins.mahjong_companion:MahjongCompanionPlugin"

[plugin.author]
name = "N.E.K.O Team"

[plugin.sdk]
recommended = ">=0.1.0,<0.2.0"
supported = ">=0.1.0,<0.3.0"

[plugin_runtime]
enabled = true
auto_start = true

[plugin.store]
enabled = true

[mahjong_companion]
default_mode = "teaching"
sample_interval_ms = 1200
```

说明：

- `auto_start = true` 指插件进程随宿主启动，但会话仍默认保持 `idle`。
- 第一版就开 `plugin.store.enabled = true`，方便后续放小体量状态。

### 4.2 `__init__.py`

职责：

- 提供插件主类
- 注册生命周期
- 注册插件入口
- 持有 orchestrator

建议骨架：

```python
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
            self.register_static_ui("static", index_file="index.html", cache_control="no-cache, no-store, must-revalidate")

        self.report_status({
            "status": "idle",
            "mode": self.orchestrator.state.mode,
            "session_id": self.orchestrator.state.session_id,
        })
        return Ok({"status": "ready"})

    @lifecycle(id="shutdown")
    async def shutdown(self, **_):
        await self.orchestrator.stop()
        self.report_status({"status": "idle"})
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
```

说明：

- 当前 SDK 的公开目录能力是 `config_dir`，而 `register_static_ui()` 也按 `self.config_dir / directory` 解析路径，所以第一版继续使用 `config_dir` 是与现有插件体系一致的写法。
- 如果未来 SDK 明确暴露稳定的 `plugin_dir` 语义，再考虑调整文档和实现。
- 当前仓库实际已在第二版中新增 `bind_window` / `unbind_window` 两个入口，但这不影响第一版骨架对最小接入链路的定义。

第一版不要在这个文件里直接实现：

- 抓帧细节
- ROI 识别
- 讲解策略
- 复盘逻辑

### 4.3 `config_defaults.py`

职责：

- 放默认配置
- 提供一个简单合并函数

建议骨架：

```python
from __future__ import annotations

from copy import deepcopy
from typing import Any


DEFAULT_CONFIG: dict[str, Any] = {
    "mahjong_companion": {
        "default_mode": "teaching",
        "sample_interval_ms": 1200,
        "target_window_title_keywords": ["雀魂", "Mahjong Soul"],
        "speech_policy": {
            "normal_channel": "silent_ui",
            "normal_voice_cooldown_sec": 18,
        },
        "action_policy": {
            "mode": "off",
            "allowed_contexts": ["menu", "replay", "custom_room"],
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
```

### 4.4 `contracts.py`

职责：

- 放第一版最小契约类型
- 先服务骨架，不追求大而全

建议骨架：

```python
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class FramePacket:
    timestamp_ms: int
    image_path: str = ""
    window_title: str = ""
    width: int = 0
    height: int = 0
    source: str = "pyautogui"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class PerceivedGameState:
    scene: str = "unknown"
    confidence: float = 0.0
    buttons: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class DecisionResult:
    summary: str = ""
    risk_level: str = "unknown"
    recommendations: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
```

### 4.5 `session_state.py`

职责：

- 保存当前会话的最小状态
- 供 orchestrator 和 UI 查询

建议骨架：

```python
from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class SessionState:
    session_id: str
    running: bool = False
    mode: str = "teaching"
    status: str = "idle"
    scene: str = "unknown"
    last_frame_path: str = ""
    last_error: str = ""
    last_frame_at: str = ""
    last_decision_at: str = ""
    started_at: str = ""

    @classmethod
    def create(cls, mode: str = "teaching") -> "SessionState":
        return cls(session_id=f"mahjong-{uuid4().hex[:8]}", mode=mode)

    def snapshot(self) -> dict[str, Any]:
        return asdict(self)
```

### 4.6 `orchestrator.py`

职责：

- 管理会话启动停止
- 提供状态查询
- 先放一个“能跑的空主循环”
- 提供调试抓帧入口

第一版建议不要真的启动复杂的常驻分析，而是先打通：

- `start()`
- `stop()`
- `get_status()`
- `capture_debug_frame()`

建议骨架：

```python
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any, Optional

from plugin.sdk.plugin import Ok

from .session_state import SessionState


class SessionOrchestrator:
    def __init__(self, plugin: Any):
        self.plugin = plugin
        self.logger = plugin.logger
        self.state = SessionState.create()
        self._task: Optional[asyncio.Task] = None
        self._config: dict[str, Any] = {}
        self._lock = asyncio.Lock()

    def apply_config(self, config: dict[str, Any]) -> None:
        self._config = config
        companion_cfg = config.get("mahjong_companion", {})
        default_mode = companion_cfg.get("default_mode")
        if isinstance(default_mode, str) and not self.state.running:
            self.state.mode = default_mode

    async def start(self):
        async with self._lock:
            if self.state.running:
                return Ok({"already_running": True, **self.get_status()})

            self.state.running = True
            self.state.status = "starting"
            self.state.started_at = self.state.started_at or datetime.now(timezone.utc).isoformat()
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
            self._emit_status()
            return Ok(self.get_status())

    async def set_mode(self, mode: str) -> None:
        async with self._lock:
            self.state.mode = mode
            self._emit_status()

    def get_status(self) -> dict[str, Any]:
        return self.state.snapshot()

    async def capture_debug_frame(self):
        samples_dir = self.plugin.data_path("debug_samples")
        samples_dir.mkdir(parents=True, exist_ok=True)
        file_path = samples_dir / "placeholder.txt"
        file_path.write_text("debug frame placeholder", encoding="utf-8")
        self.state.last_frame_path = str(file_path)
        self.state.last_frame_at = "placeholder"
        self._emit_status()
        return Ok({"saved": True, "path": str(file_path)})

    async def _run_loop(self) -> None:
        self.state.status = "scanning"
        self._emit_status()
        try:
            while self.state.running:
                await asyncio.sleep(1.0)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            self.logger.exception("mahjong companion loop failed")
            self.state.last_error = str(exc)
            self.state.status = "error"
            self._emit_status()

    def _emit_status(self) -> None:
        self.plugin.report_status({
            "status": self.state.status,
            "mode": self.state.mode,
            "session_id": self.state.session_id,
            "last_frame_path": self.state.last_frame_path,
            "last_error": self.state.last_error,
        })
```

说明：

- 第一版 `capture_debug_frame()` 甚至可以先用占位文件，后续再替换成真实截图实现。
- 第一版 `_run_loop()` 只保活和上报扫描状态即可。
- 即使第一版主循环很轻，也建议在非取消类异常里使用 `logger.exception(...)` 打印堆栈，否则插件独立进程里的问题会很难定位。
- 当前仓库实际实现已经进一步把 `start` / `stop` / `set_mode` / `bind_window` / `unbind_window` / `capture_debug_frame` 纳入同一把锁，避免 UI 并发点击时的状态竞争。

### 4.7 `README.md`

职责：

- 给未来自己和团队说明这个目录当前已经做到什么
- 避免半年后回来只看到一堆骨架文件

建议至少写：

- 插件目标
- 当前阶段状态
- 已实现入口
- 后续开发顺序

### 4.8 `static/index.html`

职责：

- 提供一个非常简单但可用的调试台

建议只做：

- 标题
- 当前状态展示
- 四个按钮

建议骨架：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mahjong Companion</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <main class="app">
    <h1>雀魂陪伴插件</h1>
    <p id="status">状态加载中...</p>
    <div class="actions">
      <button id="refresh-btn">刷新状态</button>
      <button id="start-btn">启动会话</button>
      <button id="stop-btn">停止会话</button>
      <button id="capture-btn">抓取调试帧</button>
    </div>
    <label>
      <input id="auto-refresh-toggle" type="checkbox" />
      自动刷新
    </label>
    <pre id="output"></pre>
  </main>
  <script src="main.js"></script>
</body>
</html>
```

### 4.9 `static/main.js`

职责：

- 调用插件入口
- 渲染基本状态

当前仓库可以直接调用 `/plugin/trigger`，第一版就用这个最简单的方式。

建议骨架：

```javascript
const pluginId = "mahjong_companion";

async function callEntry(entryId, args = {}) {
  const res = await fetch("/plugin/trigger", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      plugin_id: pluginId,
      entry_id: entryId,
      args,
    }),
  });
  return await res.json();
}

function renderOutput(data) {
  document.getElementById("output").textContent = JSON.stringify(data, null, 2);
}

async function refreshStatus() {
  const data = await callEntry("get_session_status");
  const statusText = JSON.stringify(data?.data || data, null, 2);
  document.getElementById("status").textContent = statusText;
  renderOutput(data);
}

let autoRefreshTimer = null;

function syncAutoRefresh(enabled) {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
  if (!enabled) return;
  autoRefreshTimer = setInterval(() => {
    refreshStatus().catch(console.error);
  }, 3000);
}

document.getElementById("refresh-btn").addEventListener("click", refreshStatus);
document.getElementById("start-btn").addEventListener("click", async () => renderOutput(await callEntry("start_session")));
document.getElementById("stop-btn").addEventListener("click", async () => renderOutput(await callEntry("stop_session")));
document.getElementById("capture-btn").addEventListener("click", async () => renderOutput(await callEntry("capture_debug_frame")));
document.getElementById("auto-refresh-toggle").addEventListener("change", (event) => {
  syncAutoRefresh(Boolean(event.target?.checked));
});

refreshStatus().catch(console.error);
```

说明：

- 自动刷新开关适合调试状态变化，但建议默认关闭，避免在第一版就持续高频触发插件入口。

### 4.10 `static/style.css`

职责：

- 只保证可读，不追求复杂视觉

建议骨架：

```css
body {
  margin: 0;
  font-family: "SF Mono", "Menlo", monospace;
  background: #f5f1e8;
  color: #2b241c;
}

.app {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px;
}

.actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin: 16px 0;
}

button {
  border: 1px solid #2b241c;
  background: #fff8eb;
  padding: 10px 14px;
  cursor: pointer;
}

pre {
  background: #1f1b18;
  color: #f8f3ea;
  padding: 16px;
  border-radius: 8px;
  overflow: auto;
}
```

---

## 5. 第一版状态和入口约定

### 5.1 状态枚举

第一版只需要这些：

- `idle`
- `starting`
- `scanning`
- `stopping`
- `error`

### 5.2 模式枚举

第一版只需要这些：

- `spectate`
- `replay`
- `teaching`
- `silent`

### 5.3 第一版入口清单

| 入口 | 必须 | 说明 |
| --- | --- | --- |
| `start_session` | 是 | 启动空会话 |
| `stop_session` | 是 | 停止空会话 |
| `get_session_status` | 是 | UI 刷新依赖 |
| `set_mode` | 是 | 基础模式切换 |
| `capture_debug_frame` | 是 | 调试链路最小闭环 |
| `analyze_debug_frame` | 否 | 第二步再加 |
| `run_companion_pipeline` | 否 | 第四版再加的调试总链路 |

按当前仓库状态补充说明：

- 第二步之后实际先落地的是 `bind_window` / `unbind_window`、`analyze_frame_path`、`get_last_perception`。
- 当前还没有独立的 `run_replay_review` 入口，因此这里不再把它写成已规划但近期待补的固定项。

---

## 6. 数据目录约定

第一版先约定，不一定全部立刻写入：

```text
data/
├── debug_samples/
├── session_cache/
└── .gitkeep
```

说明：

- `debug_samples/` 用于保存手动抓帧样本。
- `session_cache/` 用于保存最近一次状态快照。
- 第一版暂时不强制加入 `reviews/`，等复盘链路开始做时再建。

---

## 7. 第一版开发顺序

严格建议按下面顺序做，不要跳：

1. 先建目录和 `plugin.toml`
2. 再写 `__init__.py`，确保插件能被宿主识别
3. 再写 `SessionState` 和 `SessionOrchestrator`
4. 再注册静态 UI
5. 再让 `main.js` 可以调用 `plugin/trigger`
6. 再做 `capture_debug_frame` 的真实抓帧替换

如果顺序打乱，最容易发生的问题是：

- 插件都还没出现在 `/ui/plugins`，就开始写识别逻辑
- UI 都还没能调起入口，就开始设计复杂状态结构
- 结果看起来写了很多，但其实没有一条可验证闭环

---

## 8. 第一版之后的拆分点

当第一版骨架稳定后，再按这个顺序拆子目录：

1. `capture/`
2. `gates/`
3. `perception/`
4. `decision/`
5. `narration/`
6. `review/`
7. `action/`

判断标准：

- 某个模块开始超过一个文件的复杂度
- 某个概念已经有清晰输入输出
- 某个逻辑已经需要单元测试独立覆盖

---

## 9. 不要在第一版做的事

- 不要把所有未来模块都建成空目录
- 不要先写 200 行配置 schema
- 不要先引入 `dxcam`、`opencv`、`onnxruntime`
- 不要先做 Vue / React 子项目
- 不要先做麻将算法接入

第一版唯一目标是：

- 让插件像现有 `mijia`、`memo_reminder` 一样，先成为“宿主里一个真实存在、可启动、可观察、可调试的插件”

---

## 10. 完成标志

当下面这些都成立时，说明第一版骨架完成：

- `plugin/plugins/mahjong_companion/` 目录已建立
- `/ui/plugins` 能看到“雀魂陪伴”
- `/plugin/mahjong_companion/ui/` 能打开页面
- `start_session` 后状态会变成 `scanning`
- `stop_session` 后状态回到 `idle`
- `capture_debug_frame` 至少能产出一个调试文件
- 文档和骨架代码能互相对得上

---

## 11. 下一步文档

这份骨架文档落地后，下一份最值得写的不是更大的总设计，而是：

- “第二版：真实抓帧接入文档”
- “第三版：最小感知闭环文档”
- “第四版：讲解策略与陪伴输出文档”

当前对应文件建议为：

- `docs/design/mahjong-companion-plugin-v2-capture-and-window-binding.md`
- `docs/design/mahjong-companion-plugin-v3-minimum-perception-loop.md`

这样文档和代码会同步演进，而不是先堆一份过大的全景设计。
