# 雀魂陪伴与讲解插件实施方案（基于当前 N.E.K.O 架构的安全版）

> 目标：把“雀魂相关能力”落成一个贴合当前仓库的长期插件方案，优先复用现有 `plugin/`、`agent_server.py`、`main_logic/`、TTS 与 Avatar 基座。
>
> 这份文档不以“伪装外挂”或“规避检测”为目标，而是收敛为屏幕感知、局内讲解、情绪陪伴、赛后复盘，以及在用户显式开启后的有限辅助操作。
>
> 参考基线以当前宿主插件管理页 `http://127.0.0.1:48916/ui/plugins`、`frontend/plugin-manager/` 前端实现，以及 `plugin/plugins/` 中已经落地的长生命周期插件为准，而不是假设存在一个名为 `48916/ui/plugins` 的仓库目录。

## 阶段文档索引

- 第一版：`docs/design/mahjong-companion-plugin-detailed-design.md`
- 第二版：`docs/design/mahjong-companion-plugin-v2-capture-and-window-binding.md`
- 第三版：`docs/design/mahjong-companion-plugin-v3-minimum-perception-loop.md`
- 第四版：`docs/design/mahjong-companion-plugin-v4-narration-and-companion-output.md`
- 第五版：`docs/design/mahjong-companion-plugin-v5-enhanced-rules-and-review-bridge.md`
- 第六版：`docs/design/mahjong-companion-plugin-v6-tile-efficiency-and-review-summary.md`
- 第七版：`docs/design/mahjong-companion-plugin-v7-assisted-actions-and-safe-execution.md`
- 第八版：`docs/design/mahjong-companion-plugin-v8-complete-mahjong-analysis-and-calibrated-perception.md`
- 第九版：`docs/design/mahjong-companion-plugin-v9-host-memory-sync-and-cross-session-coaching.md`
- 第十版：`docs/design/mahjong-companion-plugin-v10-generalized-game-companion-framework.md`

## 收口实现文档

- `docs/design/mahjong-companion-plugin-v6-to-v9-finalization-implementation.md`
- `docs/design/mahjong-companion-plugin-runtime-release-checklist.md`
- `docs/design/mahjong-companion-plugin-next-phase-continuation-guide.md`

## 当前实现快照

以下内容基于当前仓库 `plugin/plugins/mahjong_companion/` 的实际实现，而不是阶段文档的原始设想：

- 第一版到第五版主线已经都落到代码里，不再只是方案草图。
- 当前已经具备：
  - 窗口绑定与真实截图
  - `capture/` 截图 provider 层
  - `gates/` 帧变化门控层
  - `perception/` 感知管线
  - `decision/` 最小决策层 + `decision/tile_efficiency.py` 牌效率建议模块
  - `perception/calibration.py`、`perception/hand_layout.py`、`perception/tile_parser.py` 组成的第八版第一版骨架
  - `decision/risk_estimator.py`、`decision/mahjong_analysis.py` 提供的结构化分析与防守告警元数据
  - `narration/` 讲解、陪伴视图、播报策略与消息投递 adapter
  - `action/human_override_guard.py`、`action/input_adapter.py`、`action/action_registry.py`、`action/action_log.py` 组成的第七版第一版执行闭环
  - `review/bridge.py` 复盘候选沉淀
  - `review/summarizer.py` 赛后复盘摘要生成
  - `review/memory_bridge.py` 长期记忆桥分流层
  - `review/game_private_memory.py` 游戏侧私有记忆层（不直接上送猫娘）
  - `review/host_memory_sync.py`、`review/trend_aggregator.py`、`review/coaching_topics.py` 组成的第九版第一版本地跨局陪练链路
  - `contracts.py` 中已补 runtime 协议契约与三条硬规则常量
  - `runtime/game_agent_runtime.py` 独立运行时主类
  - `runtime/inbox.py` 猫娘 -> 游戏入站邮箱
  - `runtime/outbox.py` 游戏 -> 猫娘出站队列（优先级/去重/节流）
  - `runtime/mailbox.py` 运行时双队列兼容层（保留旧调用路径）
  - `runtime_mode = active / standby / off` 三态运行模式
  - `set_runtime_mode`、`send_runtime_message`、`get_runtime_mailbox` 三个运行时入口
  - “猫娘消息可打断、游戏消息先排队再投递”的最小协作语义
  - 调试 UI
  - `run_companion_pipeline` 一键总链路入口，可从图片或当前截图直接跑到猫娘主动回话
- 第六版、第七版、第八版、第九版都已经有“可运行第一版”落地，其中第九版仍对宿主记忆写入能力做了本地降级。
- 当前还没有具备：
  - 面向 `perception / narration / review` 的完整依赖注入与可热替换 adapter 收口
  - 稳定的牌级识别、完整向听 / 进张 / 危险度分析与校准 UI
  - 真实宿主长期记忆写入接口，以及基于宿主记忆的跨会话引用闭环
  - 面向“猫娘侧调度器”的跨插件统一协议标准（当前已在插件内冻结契约，但尚未抽成宿主级统一规范）

这个快照的意义是：

- 后面所有“是否符合设计”的判断，都以当前实际代码为准。
- 文档里的“建议拆分”要和现状分开写，避免把“已经分离”和“仍在 `orchestrator.py` 内”混成一件事。
- 当前已经达到“目录级分层”，但还不应误写成“所有层都已达到实例级可插拔”；这两者在本文里需要明确区分。
- 当前已补齐“运行时协作骨架”，但仍需把更多能力继续从 `orchestrator.py` 收口到稳定 adapter。
- 下一阶段推进请按“继续指导文件”执行，避免无序并行导致语义漂移。

---

## 1. 文档目标

本文只做六件事：

- 明确当前仓库里已经存在、可以直接复用的能力边界。
- 把原始方案里不贴合现有项目的部分，改写成真实可落地的模块拆分。
- 明确产品红线：不做内存读取、注入、抓包、反检测；允许在用户显式开启后提供有限脚本辅助，但不把它设计成规避封禁的能力。
- 保持多游戏适配与模块分离，把新增优化也设计成可复用的通用策略层，而不是雀魂专属硬编码。
- 定义一套可替换的感知 / 决策 / 表达契约，保证后续能扩展到其他游戏陪伴插件。
- 给出符合当前仓库演进节奏的分阶段实施路径。

---

## 2. 当前项目基线

这一节只写当前仓库里已经存在的事实。

### 2.1 插件基线

- 项目已经有完整的插件系统，插件运行在独立进程中，通过 `plugin/server/` 管理。
- 项目当前是 SDK v2 形态，标准独立插件应放在 `plugin/plugins/<plugin_id>/` 下，走 `plugin.sdk.plugin` 范式，而不是 Adapter 或 Extension。
- 插件可以通过 `@plugin_entry` 暴露入口，通过 `@lifecycle` 启停，通过 `register_static_ui()` 提供独立控制面板。
- 插件可以用 `push_message(message_type="proactive_notification")` 主动把内容注入 N.E.K.O. 的主交互链路。
- 插件可以通过 `finish(reply=True)` 让宿主走正常说话链路，也可以 `reply=False` 做静默更新。
- 插件已经可以直接使用 `self.config`、`PluginStore`、`report_status()`、动态入口、生命周期事件和文件日志，不需要为会话态、配置态、状态上报另起一套基础设施。

### 2.2 Agent 与电脑控制基线

- 当前 `agent_server.py` 已有 `computer_use_enabled`、`browser_use_enabled`、`user_plugin_enabled` 等总开关。
- 当前 `brain/computer_use.py` 已实现通用的截图 + VLM + `pyautogui` 执行链路。
- `ComputerUseAdapter` 已经有平滑鼠标移动包装，但它本质上仍是面向“低频 GUI 任务”的通用 Agent，不适合直接承担长时、持续、高频的游戏状态循环。
- 当前 `pyautogui.screenshot()` 与 `pyautogui` 依赖已在项目中存在；`dxcam`、`mss`、`opencv`、`onnxruntime`、`ultralytics`、麻将算法库等并未成为当前仓库的既有基础。

### 2.3 语音、角色与陪伴表达基线

- `main_logic/core.py`、`main_logic/omni_realtime_client.py`、`main_logic/tts_client.py` 已经承担角色说话、TTS、打断与主动消息投递。
- 项目已经具备 Live2D / VRM / MMD 三种 Avatar 形态，适合承接“陪伴感”和“情绪表达”。
- 仓库内已经有“人格化 / 人味”评测框架，可用于后续评估讲解文案是否像 N.E.K.O. 在说话，而不是像冷冰冰的报牌器。

### 2.4 前端基线

- 当前项目不是纯 Vue 3 单体前端。
- 实际结构是：主站页面以 `templates/` 为主，另有 `frontend/plugin-manager/` 的 Vue 面板和 `frontend/react-neko-chat/` 的 React 聊天组件。
- `frontend/plugin-manager/` 以 `/ui/` 为 base 挂载，`/ui/plugins` 是当前插件管理页，按 `plugin / adapter / extension` 分组展示插件卡片。
- 当前插件详情页已经有 `基础信息 / 入口 / 性能 / 配置 / 日志` 这些宿主级面板；Adapter 还可以通过 `PluginUIFrame` 在 `/ui/adapter/:id/ui` 内嵌插件 UI。
- 插件静态 UI 的真实访问契约是 `/plugin/{plugin_id}/ui/` 与 `/plugin/{plugin_id}/ui-info`，而不是新增一个独立 BFF。
- 因此本插件的 v1 面板更适合走“插件静态 UI”或宿主已有页面能力，而不是预设成必须新起一个 Vue 3 BFF 子系统。

### 2.5 现有插件参考样式

当前最值得参考的不是抽象接口，而是已经跑在插件管理页里的几类真实插件：

- `mijia`：标准独立插件，`startup` 时初始化客户端、注册 `static/` UI，并实现 `config_change` 响应配置变化。
- `bilibili_danmaku`：标准长生命周期插件，内部维护监听任务、队列、推送冷却和主动消息上行，最接近“长期后台运行的会话型插件”。
- `memo_reminder`：使用 `PluginStore`、后台线程、文件日志、配置读取的持久型插件，适合参考“低频事件驱动 + 长状态保持”的运行方式。
- `mcp_adapter`：展示了 `register_static_ui()`、动态入口注册和复杂状态管理，但它的插件类型是 Adapter，不能直接拿来当雀魂插件的目录或类型模板。

对雀魂方案最有价值的借鉴不是照搬功能，而是照搬这些实践：

- 把长生命周期状态留在插件进程内管理。
- 让插件在 `/ui/plugins` 中有清晰的名称、描述、版本、状态和入口预览。
- 优先复用宿主已有的配置、日志、状态、静态 UI 和生命周期能力。

### 2.6 对本方案最重要的现实约束

- `TaskExecutor` 和现有 Agent 评估链路偏“按用户请求触发”，并不适合承担一局麻将期间持续运行的主循环。
- 真正适合这个插件的运行模型，不是“把它塞进一次次 Agent task”，而是“做成一个可启停的长生命周期插件会话”。

---

## 3. 产品边界与红线

这一节是方案的硬约束。

### 3.1 明确不做的事

- 不读取游戏内存。
- 不注入 DLL、脚本或 Hook。
- 不拦截网络包。
- 不以“模拟人类操作”“反检测”“防封”为卖点或设计目标。
- 不承诺“绝对不会被封”；文档中只能写“低风险”或“尽量降低风险”。
- 不把插件包装成规避规则的工具。

### 3.2 v1 的安全定位

v1 应定位为：

- 屏幕感知驱动的雀魂陪伴与讲解插件。
- 局内建议、牌理解释、风险提醒、情绪陪伴。
- 赛后复盘、教学模式、回放模式。
- 用户显式触发或显式开启后的有限辅助操作，例如打开回放、切换讲解模式、菜单导航，以及受限场景下的半自动点击协助。

### 3.3 关于“主动操作”

- 可以保留“辅助操作层”，但必须默认关闭，并要求用户在设置中显式开启。
- 文档建议把输入辅助拆成三级能力：
  - `off`：只讲解，不操作。
  - `assist`：菜单导航、回放控制、确认弹窗、非对局关键操作。
  - `semi_auto`：用户已授权前提下，对局内的有限协助操作，例如代点已明确建议的按钮或执行用户刚确认过的动作。
- v1 不建议直接做“全自动代打”；如果要做，也应明确列为后续实验能力，而不是默认产品能力。
- 如需输入层，应优先限定在回放模式、练习模式、自定义房间，再逐步评估正式对局中的有限协助。
- 现有 `computer_use` 的平滑移动能力可以作为输入层复用件，但不能被定义为反检测方案。

### 3.4 授权与风险表达

- 所有辅助操作都必须有总开关，且默认关闭。
- 涉及局内点击的能力，至少需要：
  - 首次风险提示
  - 模式说明
  - 一键关闭
  - 操作日志
- 对外文案不应写“不会封号”，只能写：
  - 基于屏幕读取
  - 不读内存、不注入
  - 由用户主动开启
  - 风险需用户自行判断

---

## 4. 推荐产品定位

建议把这个方向正式命名为：

`N.E.K.O. 通用游戏陪伴框架：雀魂讲解与复盘特化版`

对外卖点应聚焦：

- 她会看局。
- 她会讲牌。
- 她会安抚、吐槽、鼓励。
- 她会记住你的讲解偏好和练习阶段。
- 她能在回放里陪你复盘，而不是帮你偷偷打牌。

这样既贴合 N.E.K.O. 的核心产品气质，也更符合当前仓库已经成熟的语音、Avatar、主动对话能力。

---

## 5. 面向当前仓库的推荐架构

### 5.1 总体原则

- 核心实现应优先作为一个独立插件落在 `plugin/plugins/` 下。
- 插件类型应明确为标准 `Plugin`，让它自然出现在当前的 `/ui/plugins` 列表与详情页里；不要为了“更像前端应用”误做成 Adapter。
- 感知、决策、表达做契约解耦，但 v1 不必先拆成多个 FastAPI 微服务。
- 新增优化应优先做成通用策略模块，例如 `FrameChangeGate`、`SpeechPolicy`、`HumanOverrideGuard`、`CompanionViewModel`、`MemoryBridge`，避免写死成雀魂专属逻辑。
- 只有当性能或依赖隔离真的成为瓶颈时，再把某些重模块拆为本地 sidecar worker。

### 5.1.1 仓库组织建议：先整合在主项目内

基于当前项目的既有插件形态，雀魂插件更适合：

- 代码继续放在主仓库内，目录落在 `plugin/plugins/mahjong_companion/`。
- 运行时继续享受“插件独立进程”带来的隔离性，而不是额外拆成一个独立 Git 项目。
- UI、配置、日志、生命周期、插件管理页接入都直接复用现有宿主能力。

这样做的主要原因：

- 当前仓库里的现有插件本身就是“同仓库维护、运行时独立进程”的模式。
- 雀魂插件会强依赖当前宿主的 `push_message()`、`finish()`、`report_status()`、配置系统、静态 UI 路由和插件管理页。
- 如果过早拆成独立项目，会立刻增加版本同步、SDK 兼容、调试联调、文档同步和发布流程成本。
- v1 的主要难点在识别正确率和讲解体验，不在仓库边界管理。

只有在以下情况同时变强时，才值得再评估拆独立项目：

- 插件已经演进成跨多个宿主复用的通用产品。
- 需要独立发布节奏和独立依赖树。
- 视觉 / 算法依赖已经明显拖累主仓库开发体验。
- 团队希望把插件作为单独产品线维护。

### 5.2 先对齐当前插件管理页的宿主能力

这个插件的 v1 设计，建议直接对齐当前宿主已经提供的展示与运维面：

- `/ui/plugins` 列表页负责展示名称、描述、版本、运行状态、入口数量与可选性能指标。
- `/ui/plugins/:id` 详情页负责展示入口、配置、日志和宿主侧状态，不必把这些能力重新做一遍。
- `/plugin/{plugin_id}/ui/` 只承担雀魂专属的控制台，例如截图调试、局面预览、标注和会话控制。
- 插件运行态应通过 `report_status()` 输出，例如 `idle / scanning / in_match / replay / error`，这样宿主页能直接看到高价值状态，而不是只有“running”。
- 配置优先走现有配置系统与 profile 叠加能力，必要时再在静态 UI 上包一层更友好的交互。

### 5.3 推荐分层

```text
Mahjong Companion Plugin
├── Session Orchestrator        # 插件主循环 / 会话状态机
├── Capture Provider            # 截图与窗口定位
├── Frame Change Gate           # 画面哈希变动检测 / 节流降耗
├── Perception Pipeline         # ROI / 识别 / 状态结构化
├── Decision Engine Adapter     # 算法库 / 本地模型 / 规则引擎
├── Companion ViewModel         # 陪伴态 UI 视图模型
├── Narration Adapter           # 把结果变成 N.E.K.O. 口吻
├── Input Safety Guard          # 用户抢鼠标中断 / 安全刹车
├── Review & Memory Bridge      # 牌谱片段、关键节点、复盘摘要、长期记忆桥
└── Plugin UI                   # 控制面板、调试页、标注页
```

### 5.3.1 当前实现与推荐分层核对

基于当前代码，模块分离达成情况如下：

| 设计层 | 当前状态 | 实际落点 | 结论 |
| --- | --- | --- | --- |
| `Session Orchestrator` | 已实现 | `orchestrator.py` | 符合设计 |
| `Capture Provider` | 已实现 | `capture/provider.py` + `window_binding.py` | 符合设计 |
| `FrameChangeGate` | 已实现 | `gates/frame_change.py` | 符合设计 |
| `Perception Pipeline` | 已实现 | `perception/` | 目录级符合设计；后续仍建议补 `PerceptionAdapter` 一类契约 |
| `Decision Engine Adapter` | 已实现 | `decision/adapter.py` + `decision/generator.py` | 基本符合设计 |
| `Companion ViewModel` | 已实现 | `narration/view_model.py` | 符合设计 |
| `Narration Adapter` | 已实现 | `narration/generator.py` + `narration/speech_policy.py` + `narration/dispatcher.py` | 目录级符合设计；后续仍建议补对象化 adapter 与注入点 |
| `Input Safety Guard` | 已实现 | `action/human_override_guard.py` | 已独立成安全层，等待后续输入执行层接入 |
| `Review & Memory Bridge` | 已实现 | `review/bridge.py` + `review/memory_bridge.py` | 已完成 review candidate 和记忆摘要分流；宿主写入仍受 SDK 能力限制，复盘摘要 adapter 仍待补 |
| `Plugin UI` | 已实现 | `static/` | 符合设计 |

结论可以直接写成三句话：

- 当前插件已经完成了“截图 / 门控 / 感知 / 决策 / 讲解 / 消息投递 / 复盘桥接 / UI”这些主线的目录级分离。
- 当前插件已经完成“输入安全守卫”“长期记忆桥”这两条横切安全与记忆层分离。
- 因此它现在已经达到总方案文档里要求的目录级多层拆分；但如果目标是“真正可热替换、可注入的实例级可插拔”，则还需要继续把若干默认实现从 `orchestrator.py` 中收口成独立 adapter。

进一步说，当前实现状态更适合这样描述：

- `capture / gates / decision` 三层已经接近实例级可插拔，因为它们已经有比较明确的 provider / gate / adapter 入口。
- `perception / narration / review` 三层当前更像“模块已拆开，但编排层仍直接串接默认实现”。
- 所以下一轮文档与实现优化重点，不是继续把目录拆得更碎，而是补齐依赖注入、adapter 契约和针对替换能力的测试。

### 5.4 为什么不建议一开始就做“三个网络微服务”

- 当前仓库已经有插件进程隔离，先天就是一个比较好的边界。
- 这个功能的第一阶段主要难点是识别正确率、讲解时机、文案体验，不是服务编排。
- 过早拆成多个 HTTP 服务，会引入更多部署、日志、状态同步与恢复复杂度。
- 更适合的做法是先在一个插件里把契约稳定下来，再决定是否拆 worker。

---

## 6. 核心模块设计

### 6.1 会话编排层 `Session Orchestrator`

职责：

- 启停游戏陪伴会话。
- 管理当前模式：观战 / 回放 / 教学 / 静默建议。
- 维护局内状态机：大厅、配桌、对局中、结算、回放。
- 做节流、去重和触发时机判断。
- 维护“开口阈值”和“情绪冷却时间”。

建议：

- 这个主循环应由插件自己管理，不要复用 `TaskExecutor` 的一次性任务模型。
- 控制入口通过插件 UI 和 `plugin_entry` 暴露，例如：
  - `start_session`
  - `stop_session`
  - `set_mode`
  - `set_runtime_mode`
  - `send_runtime_message`
  - `get_runtime_mailbox`
  - `capture_debug_frame`
  - `analyze_debug_frame`
  - `generate_decision`
  - `generate_narration`
  - `run_companion_pipeline`
- 额外建议保留一个 `get_session_status` 或 `get_debug_snapshot` 入口，方便宿主页、脚本调用和后续测试。
- 每次模式切换、会话启动、错误恢复后都建议同步 `report_status()`，让 `/ui/plugins` 和 `/ui/plugins/:id` 能看到更细粒度的宿主状态。
- 当前实际还新增了 `analyze_frame_path`、`get_last_perception`、`get_last_decision`、`get_last_narration`、`preview_companion_view`、`speak_last_narration`、`cycle_voice_mode` 等调试与状态入口。
- 当前已经有 `runtime_mode=active/standby/off` 与双队列 runtime mailbox，支持“猫娘入站消息可打断旧命令、游戏出站消息先排队再投递”的协作语义。
- 当前 `standby` 模式下会停止游戏操作主循环，也会阻断辅助动作执行；但运行时命令仍可用于状态刷新、复盘整理和记忆同步。
- 当前还没有独立的 `run_replay_review` 入口；赛后复盘摘要仍属于下一阶段要补的能力。
- 当前实际的 `run_companion_pipeline` 总入口，用来把“选帧 / 截图 -> 感知 -> 决策 -> 讲解 -> 主动回话”收敛成单次可测试链路。这一入口对调试和宿主联调很有帮助，但它也说明当前 `orchestrator.py` 仍承担了一部分原本可继续拆出的调试编排职责。
- 当前还建议在这一层补一个“依赖注入边界”说明：`SessionOrchestrator` 应优先依赖抽象契约，而不是在构造函数里固定 new 出所有默认实现；默认实现可以保留，但应作为缺省参数而不是硬编码依赖。

建议在这一层内置通用 `SpeechPolicy`：

- 常规牌：默认走 `silent_ui`，只更新面板，不播报。
- 关键牌：当向听前进、进张显著改善、出现高价值路线时，按概率触发鼓励型 `voice`。
- 高危牌：当系统明确判断“用户即将做出高风险操作”时，无视普通冷却时间，直接触发警告型 `voice`。
- 连续两次普通语音之间应有冷却时间，建议默认 `15-20s`，并允许按游戏 profile 调整。

建议把这套策略抽成独立配置，而不是写死在雀魂逻辑里：

```json
{
  "speech_policy": {
    "normal_channel": "silent_ui",
    "key_play_voice_probability": 0.3,
    "normal_voice_cooldown_sec": 18,
    "danger_override_cooldown": true
  }
}
```

### 6.2 截图层 `Capture Provider`

建议先定义接口，而不是先绑定 `dxcam`：

```python
class CaptureProvider(Protocol):
    def locate_window(self) -> WindowInfo: ...
    def capture_frame(self) -> FramePacket: ...
```

`FramePacket` 建议至少包含：

```json
{
  "timestamp_ms": 0,
  "window_title": "",
  "width": 0,
  "height": 0,
  "image_path": "",
  "source": "pyautogui"
}
```

实现策略建议：

- v0 / v1 调试阶段：优先复用现有依赖，用 `pyautogui.screenshot()` + 活跃窗口裁切跑通链路。
- Windows 性能优化阶段：再按可选依赖接入 `dxcam`。
- 如果未来需要跨平台更稳的窗口截图，再补 `mss` 或平台专用 provider。

关键判断：

- 雀魂是回合制，不需要 30 FPS 的重型实时视觉栈。
- v1 完全可以做成低频采样或“状态变化触发”采样，先以稳定和简单为主。

建议在 `Capture Provider` 和 `Perception Pipeline` 之间增加一个通用 `FrameChangeGate`。

职责：

- 对一小块或几小块关键 ROI 做极轻量图像哈希。
- 如果哈希未变化，直接丢弃当前帧，不进入 OCR、模板匹配或分类器。
- 只在检测到实质变化时，才触发状态更新。

为什么要单独抽象：

- 它本质上是“感知前门控层”，不属于雀魂专属逻辑。
- 换到别的回合制或半静态 UI 游戏时，只需替换 ROI 配置与 hash 策略。

建议契约：

```python
class FrameChangeGate(Protocol):
    def should_process(self, frame: FramePacket) -> bool: ...
```

建议配置：

```json
{
  "frame_change_gate": {
    "enabled": true,
    "watch_regions": ["action_buttons", "center_table"],
    "hash_method": "dhash",
    "min_change_distance": 3,
    "stable_skip_limit": 300
  }
}
```

对雀魂的直接收益：

- 静默待机时几乎不耗额外算力。
- 非用户回合和无按钮变化阶段不必反复跑识别。
- 更适合长期后台陪伴。

### 6.3 感知层 `Perception Pipeline`

这里要和原方案做一个重要收敛：

- 不建议一上来就把 v1 前提写成“必须训练 YOLOv10 专属模型”。
- 当前仓库没有现成 CV 训练 / 推理基座，也没有相关依赖链。
- 雀魂 UI 相对规则，MVP 更适合先走“固定 ROI + 模板匹配 / OCR / 小分类器”的路线。
- 在进入 OCR / 分类前，应优先经过 `FrameChangeGate` 节流，避免静态画面重复分析。

推荐分三档：

1. `P0`：固定分辨率或校准后 ROI 截取，先识别局面阶段、自己的手牌区、按钮区。
2. `P1`：针对牌面做轻量分类器或模板库，解决常见牌识别。
3. `P2`：当布局鲁棒性不足时，再引入 YOLO / ONNX 推理模块。

感知输出必须是纯结构化状态，不夹带策略：

```json
{
  "scene": "match_turn",
  "confidence": 0.94,
  "round_wind": "east",
  "seat_wind": "south",
  "hand_tiles": ["1m", "2m", "3m"],
  "melds": [],
  "dora_indicators": ["5p"],
  "buttons": ["discard", "chi", "pon", "riichi"],
  "riichi_players": ["west"],
  "raw_detections": []
}
```

从“可插拔”的角度看，建议继续补一个显式契约：

```python
class PerceptionAdapter(Protocol):
    def analyze(self, frame: FramePacket | Path) -> tuple[PerceivedGameState, dict[str, Any]]: ...
```

这样做的原因不是为了抽象而抽象，而是为了让后续三类实现能够共享同一编排入口：

- 当前已经存在的规则型 `ROI + scene classifier + action detector`
- 第六版之后可能加入的校准化牌级感知
- 第八版之后可能加入的 YOLO / ONNX / 本地模型感知后端

当前代码已经完成了目录级拆分，但 `orchestrator.py` 仍直接调用默认感知函数；因此这里应明确把“补 perception adapter”视为后续接口收口任务，而不是额外的架构花活。

### 6.4 决策层 `Decision Engine`

这一层必须是可热替换接口，且与表达层彻底分开。

建议契约：

```python
class DecisionEngine(Protocol):
    def suggest(self, state: PerceivedGameState) -> DecisionResult: ...
```

`DecisionResult` 建议至少包含：

```json
{
  "version": "engine-v1",
  "recommendations": [
    {
      "type": "discard",
      "tile": "5p",
      "confidence": 0.81,
      "reason_codes": ["ukeire_best", "riichi_defense_ok"]
    }
  ],
  "risk_level": "medium",
  "teaching_points": [
    "这手优先保留两面搭子"
  ],
  "engine_meta": {
    "engine": "rule_based",
    "latency_ms": 22
  }
}
```

结合当前实现，再补一条收口建议：

- 当前 `decision/adapter.py` 已经是一个正确方向。
- 后续不应让讲解层、复盘层或输入执行层直接依赖底层规则函数的私有返回值。
- 如果未来引入牌效率、向听、打点或本地模型候选，优先扩展 `DecisionResult` 契约，而不是绕过 adapter 直接让其他层读新引擎对象。

实现顺序建议：

- v1：先接规则 / 算法引擎，不依赖外部在线模型。
- v2：允许接本地模型服务。
- v3：再评估是否切自研模型。

这能满足“未来换成自研模型或麻将算法、且不依赖别人”的方向，但不会让 v1 被训练成本卡死。

### 6.5 表达层 `Narration Adapter` 与 `Companion ViewModel`

这里也建议收掉 `DSPy` 前置。

原因：

- 当前仓库已有成熟 prompt 体系和角色说话链路。
- v1 需要的是“稳定口吻 + 可配置讲解深度 + 合适介入时机”，不是先引入新的提示词编排框架。

推荐做法：

- 在插件内部维护少量可版本化模板：
  - 简短提示
  - 教学解释
  - 情绪安抚
  - 复盘总结
- 再把 `DecisionResult` 映射到 N.E.K.O. 风格的话术。
- 真正发声时复用宿主的主动消息 / TTS / Avatar 动作能力。

建议输出层区分三种通道：

- `voice`: 允许猫娘出声。
- `subtitle`: 只显示简短提示。
- `silent_ui`: 只更新插件面板，不打断用户。

同时建议把“原始决策结果”和“用户实际看到的陪伴界面”明确拆开。

- `DecisionResult` 是硬逻辑输出，供日志、调试、策略层消费。
- `CompanionViewModel` 是陪伴式 UI 输出，强调猫娘怎么看待局面，而不是把冷冰冰指标全部直接拍给用户。

建议 `CompanionViewModel` 只默认展示：

- 当前心情态
- 一两句核心提示
- 是否建议保守 / 进攻
- 是否需要主人留意风险

而把向听、进张、胜率、危险度等硬核数据折叠到 `调试 / 详情` 面板。

建议契约：

```json
{
  "mood_state": "nervous",
  "headline": "这巡先别贪，外面有点危险哦。",
  "posture": "defense",
  "detail_collapsed": true
}
```

如果希望这一层真正达到“实例级可插拔”，建议显式保留一个对象化接口：

```python
class NarrationAdapter(Protocol):
    def render(self, decision: DecisionResult) -> tuple[NarrationEvent, CompanionViewModel, dict[str, Any]]: ...
```

以及一个独立的投递边界：

```python
class NarrationDispatcher(Protocol):
    def dispatch(self, event: NarrationEvent, ...) -> dict[str, Any]: ...
```

当前代码已经把 `generator / speech_policy / dispatcher / view_model` 分目录拆开，这是对的；但编排层仍直接调用默认生成函数并套用默认策略，因此这里仍应保留“后续通过注入替换不同讲解风格或不同输出后端”的文档约束。

### 6.6 行动层 `Input Action Adapter`

这一层在本方案里是受限模块，但可以作为高阶卖点预留。

建议边界：

- 默认只开启 `assist` 级能力：菜单导航、回放控制、面板快捷操作。
- `semi_auto` 级能力可以预留接口，但必须受总开关、场景白名单和确认策略控制。
- 如需复用现有能力，可封装 `brain/computer_use.py` 里的平滑输入包装。
- 不把任何输入模拟描述为“防封策略”。

在此基础上，建议增加物理级安全刹车 `HumanOverrideGuard`：

- 当插件执行平滑鼠标移动或短时自动点击时，临时开启全局鼠标监听。
- 如果在这 `1-2s` 的执行窗口内检测到真实用户的物理鼠标位移，立刻中断当前自动化动作。
- 中断后可触发轻量反馈，例如字幕或语音：“啊，主人要自己点吗？那本猫让给你~”。

这层的价值不只是安全：

- 它是最后一道误操作防线。
- 它能显著减少“脚本抢鼠标”的体验问题。
- 它同样是通用游戏陪伴基座里可复用的安全策略模块。

建议增加输入策略配置：

```json
{
  "action_mode": "assist",
  "require_user_opt_in": true,
  "require_first_run_warning": true,
  "allowed_contexts": ["menu", "replay", "custom_room"],
  "allow_ranked_match_actions": false,
  "operation_log_enabled": true,
  "human_override_abort": true
}
```

推荐接口：

```json
{
  "action": "open_replay_next",
  "requires_user_confirmation": true,
  "allowed_contexts": ["replay", "menu"]
}
```

### 6.7 复盘层 `Review & Memory Bridge`

复盘层不应只把结果留在插件日志里。

建议拆成两层：

- `Review Logger`：保存局内关键节点、建议、用户实际操作与结果。
- `MemoryBridge`：把跨局有价值的摘要标签注入 N.E.K.O. 主记忆系统。
- 局内样本、校准参数、回放摘要和最近一次会话快照建议优先落在插件自己的 `data/` 与 `PluginStore` 中，只有真正高价值的摘要才上送宿主长期记忆。

适合注入长期记忆的内容：

- 用户是否长期偏进攻或偏保守
- 是否经常在高危险局面贪大牌
- 是否对某类讲解更有反应
- 最近几局的典型失误或高光

建议只注入“低频、高价值、可概括”的标签化摘要，而不是整局流水。

示例：

```json
{
  "memory_bridge": {
    "enabled": true,
    "max_memories_per_day": 3,
    "summary_tags": ["mahjong_style", "risk_preference", "recent_mistake_pattern"]
  }
}
```

这样做的直接收益是：

- N.E.K.O 可以跨局记住用户的麻将习惯。
- 第二天闲聊时，她可以自然提到前一晚的打法问题或亮眼表现。
- 产品形态从“报牌工具”进一步靠近“长期陪伴者”。

从接口设计上，建议把这一层继续收口成三个相对稳定的职责：

- `ReviewLogger`：负责关键节点沉淀、去重、样本缓存。
- `ReviewSummarizer`：负责把单局或多节点素材整理成可读复盘摘要。
- `MemoryBridge`：负责把低频高价值摘要筛入宿主长期记忆桥。

当前代码里 `review/bridge.py` 与 `review/memory_bridge.py` 已经把前后两端拆开，这是一个好的起点；但后续一旦开始做 `v6` 的复盘摘要，最好先补 `review/summarizer.py` 或等价 adapter，避免把摘要拼装逻辑重新堆回 `orchestrator.py`。

---

## 7. 与现有 N.E.K.O. 模块的映射关系

| 需求 | 当前可复用模块 | 建议做法 | 注意点 |
| --- | --- | --- | --- |
| 插件生命周期 | `plugin/` | 直接做独立插件 | 不要走一次性 Agent task |
| 插件管理页接入 | `/ui/plugins`、`/ui/plugins/:id` | 复用宿主列表、详情、日志、性能、配置页面 | 雀魂插件应以标准 `Plugin` 形态出现 |
| 控制面板 | `register_static_ui()` | 插件自带静态 UI | 不必预设 Vue 3 |
| 插件 UI 路由 | `/plugin/{plugin_id}/ui/`、`/ui-info` | 雀魂专属调试台走静态 UI | 当前宿主默认不是所有普通插件都内嵌 iframe |
| 配置管理 | `self.config`、`/plugin/{id}/config`、profiles、hot-update | 参数、模式、校准、讲解策略统一接入现有配置系统 | 需要明确哪些配置支持热更新，哪些需要重启会话 |
| 配置变更通知 | `@lifecycle(id="config_change")` | 配置落地后刷新会话参数或重载局部资源 | 不要把所有改动都做成整插件重启 |
| 持久化与样本 | `PluginStore`、`data/` 目录 | 存局部状态、样本索引、最近会话摘要 | 长期记忆不要和原始流水混放 |
| 运行态可观测性 | `report_status()`、日志面板、性能页 | 上报会话模式、扫描状态、最近错误、帧分析计数 | 避免只显示笼统的 `running` |
| 感知前节流 | 插件内轻量模块 | 新增 `FrameChangeGate` | 应做成 profile 驱动，不绑雀魂 |
| 主动讲话 | `push_message()` / `finish(reply=True)` | 用现有说话链路 | 需要节流，避免刷屏 |
| 说话策略 | 插件内策略层 | 新增 `SpeechPolicy` | 要和业务决策解耦 |
| Avatar 表达 | 宿主现有 Live2D / VRM / MMD | 作为最终输出容器 | 插件不重复造角色层 |
| 陪伴式面板视图 | 插件 UI + 宿主 Avatar | 新增 `CompanionViewModel` | 默认少数据、多情绪态 |
| 辅助操作输入层 | `brain/computer_use.py` 的现有输入包装 | 先做 `assist`，后留 `semi_auto` 接口 | 默认关闭，必须用户显式开启 |
| 物理安全刹车 | 插件内输入保护层 | 新增 `HumanOverrideGuard` | 用户抢鼠标应立刻中断 |
| 人设语气 | `config/prompts_*` 体系 | 插件局部模板 + 宿主口吻 | v1 不强依赖 DSPy |
| 跨局记忆 | 宿主记忆系统 | 新增 `MemoryBridge` | 只写摘要，不写流水噪声 |
| 人味评估 | `tests/utils/human_like_judger.py` 等 | 评测讲解文案 | 可直接复用测试思路 |

---

## 8. 推荐目录结构

```text
plugin/plugins/mahjong_companion/
├── __init__.py
├── plugin.toml
├── README.md
├── contracts.py
├── config_defaults.py
├── orchestrator.py
├── session_state.py
├── window_binding.py
├── capture/
│   └── provider.py
├── gates/
│   └── frame_change.py
├── perception/
│   ├── pipeline.py
│   ├── roi.py
│   ├── scene_classifier.py
│   ├── action_detector.py
│   └── debug_dump.py
├── decision/
│   ├── adapter.py
│   ├── generator.py
│   └── debug_dump.py
├── narration/
│   ├── dispatcher.py
│   ├── events.py
│   ├── generator.py
│   ├── speech_policy.py
│   ├── view_model.py
│   └── debug_dump.py
├── action/
│   └── human_override_guard.py
├── review/
│   ├── bridge.py
│   └── memory_bridge.py
├── static/
│   ├── index.html
│   ├── main.js
│   └── style.css
└── data/
    ├── debug_samples/
    └── session_cache/
```

当前这个目录结构已经是代码实况，而不是纯建议草图。

如果后续继续进入第六版和更后面的实现，再按需要补充：

- `perception/adapter.py` 或等价的感知注入层
- `decision/tile_efficiency.py` 或等价的牌效率模块
- `narration/adapter.py` 或等价的讲解注入层
- `review/summarizer.py` 一类的赛后复盘摘要模块
- `action/input_adapter.py` 一类的有限辅助操作执行层

---

## 9. 分阶段实施建议

### 阶段 0：先定红线与契约

- 先把“不做反检测、不承诺不封”写进产品与技术文档。
- 定义 `FramePacket`、`PerceivedGameState`、`DecisionResult` 三套契约。
- 定义输入辅助分级：`off / assist / semi_auto`。
- 搭插件骨架、`plugin.toml`、基础 `plugin_entry`、状态上报和控制面板。

完成标志：

- 插件能启动。
- `/ui/plugins` 里能正常看到该插件卡片、状态和基础描述。
- UI 能开关会话与模式。
- 能保存基础配置与校准信息。

### 阶段 0.5：先补游戏运行时协作骨架（当前已实现第一版）

- 建立 `catgirl -> game` 入站队列与 `game -> catgirl` 出站队列。
- 建立 `active / standby / off` 三态运行模式。
- 在 `contracts.py` 固化运行时动作契约与三条硬规则。
- 允许猫娘侧低频发送运行时命令，并定义 `interrupt=true` 的打断语义。
- 约束游戏侧消息先入队再投递，避免打断猫娘当前对话链路。
- 把运行时状态和队列指标接入宿主状态上报与调试 UI。

完成标志：

- 有 `set_runtime_mode`、`send_runtime_message`、`get_runtime_mailbox` 入口。
- 入站打断语义可测，且出站排队语义可测。
- `standby` 不操作游戏，但仍可处理整理类命令。
- 游戏循环与猫娘对话链路互不阻塞。

### 阶段 1：打通低频截图与调试闭环

- 用现有 `pyautogui` 依赖跑通窗口定位、截图、裁切和调试保存。
- 同时接入 `FrameChangeGate`，先用最小可行的 ROI 哈希门控降低空转功耗。
- 做“手动抓一帧并分析”的 debug 页面。
- 接通基础 `report_status()` 与调试计数，让宿主页可见当前是否在扫描、最近一次截图是否成功。
- 不急着上高帧率。

完成标志：

- 可以从插件 UI 一键采集当前雀魂窗口截图。
- 可以保存样本供后续标注与单元测试使用。
- 静态局面下大部分帧会被门控层直接跳过。

### 阶段 2：先做规则化感知，不先做 YOLO 大跃进

- 先识别局面阶段、自己手牌区、操作按钮区。
- 优先解决“什么时候该说话”和“识别结果是否稳定”。
- 只在布局鲁棒性不足时再引入目标检测模型。

完成标志：

- 对固定测试样本能稳定输出结构化状态。
- 识别错误可通过日志和样本回放定位。

### 阶段 3：接本地算法决策

- 接入规则 / 算法引擎，先支持最基础的出牌建议与风险提示。
- 输出统一的 `DecisionResult`，不要让讲解模板直接依赖底层库的私有返回值。

完成标志：

- 能对若干标准局面输出稳定建议。
- 决策引擎可以被 mock 替换。

### 阶段 4：把结果变成“像 N.E.K.O. 在陪你”

- 建立简短提示、教学模式、安抚模式三套话术层。
- 建立 `SpeechPolicy`，明确开口阈值、关键牌概率播报与危险牌强提醒。
- 建立 `CompanionViewModel`，让默认面板优先展示情绪态与核心提示，而不是裸数据。
- 通过 `push_message(message_type="proactive_notification")` 或 `finish(reply=True)` 接入现有说话链路。
- 复用现有字幕 / 语音 / Avatar 表达，不单独造一套播报系统。

完成标志：

- 能在不刷屏的前提下说出建议。
- 语气风格接近当前角色设定，而不是工具播报。
- 默认 UI 呈现更像“猫娘陪看局”，而不是调试面板。

### 阶段 4.2：补齐接口收口与依赖注入

- 在继续推进 `v6 / v7 / v8` 前，先把当前已拆开的目录层补成更稳定的注入边界。
- 给 `perception` 增加显式 adapter 或等价对象接口，避免 `orchestrator` 直接绑定默认感知函数。
- 给 `narration` 增加对象化 adapter，明确“生成讲解”和“投递消息”是两个可替换层。
- 给 `review` 增加摘要 adapter，避免后续复盘总结继续回流到 `orchestrator`。
- 为这些替换点增加最小 mock / fake 测试，验证“能拆开”不只是目录形态，而是实际可替换能力。

完成标志：

- `SessionOrchestrator` 主要依赖抽象契约而不是默认实现细节。
- `perception / narration / review` 至少各有一个稳定的注入点。
- 单元测试可以通过 fake adapter 跑通主链路。

### 阶段 4.5：接入有限辅助操作

- 先接 `assist` 级能力，不直接上 `semi_auto`。
- 增加设置页总开关、首次风险提示、上下文白名单和操作日志。
- 增加 `HumanOverrideGuard`，确保用户一抢鼠标就能中断插件动作。
- 先在回放 / 自定义房间 / 菜单场景打通“建议 -> 确认 -> 执行”闭环。

完成标志：

- 用户可以显式开启或关闭辅助操作。
- 所有输入动作都有日志可查。
- 受限场景下可以稳定完成有限点击协助。
- 用户物理输入可以稳定触发中断，不会被脚本抢夺控制权。

### 阶段 5：赛后复盘与回放模式

- 沉淀局内关键节点日志。
- 输出复盘摘要、高光时刻、风险回顾。
- 先通过 `MemoryBridge` 在本地筛选和暂存低频高价值摘要；待宿主 SDK 提供插件侧写入接口后，再同步宿主长期记忆。
- 先把回放 / 教学模式做强，再考虑更激进的实时能力。

完成标志：

- 一局结束后可以自动生成一段复盘。
- 关键节点与建议可以回看。
- 跨局闲聊时可以引用用户近期麻将风格与典型失误。

### 阶段 6：抽象成通用游戏陪伴基座

- 把与雀魂无关的部分抽成 `CaptureProfile`、`PerceptionProfile`、`NarrationProfile`。
- 未来拓展到其他游戏时，只替换 profile、识别器和决策引擎。

补充说明：

- 当前 `v6-v10` 版本文档已经把“牌效率建议”“有限辅助操作”“完整麻将分析”“宿主记忆同步”“通用框架化”继续拆成更细的后续阶段。
- 因此这里的“阶段 5 / 阶段 6”应理解为高层路线归并，而不是和 `v6-v10` 一一同粒度对应。

---

## 10. 测试与验收建议

### 10.1 单元测试

- `FrameChangeGate` 的哈希稳定性与误判率测试。
- runtime mailbox 语义测试（入站打断、出站排队与丢弃计数）。
- standby 模式测试（不操作游戏但可整理信息）。
- memory boundary 测试（默认不外泄私有游戏记忆）。
- 固定截图样本测试感知输出。
- 决策契约测试。
- Narration 模板测试，避免输出过硬、过长或风格跑偏。
- `SpeechPolicy` 的开口阈值、冷却时间和危险牌强提醒测试。

### 10.2 插件测试

- 插件入口契约测试。
- 静态 UI 可用性测试。
- 会话启停、配置保存、日志导出测试。
- `/ui/plugins` 列表展示与插件详情页基础可见性测试。
- `active / standby / off` 运行时模式切换测试。
- 输入辅助开关、场景白名单、风险提示与操作日志测试。
- `HumanOverrideGuard` 的物理输入中断测试。
- `MemoryBridge` 的写入频控与摘要质量测试。

### 10.3 人格化评测

- 复用现有 `human_like_judger` 思路，评估：
  - 是否像陪伴式讲解
  - 是否太像“报牌器播音”
  - 是否会过度打扰
  - 是否能在逆风 / 顺风场景下稳定保持角色感

### 10.4 手动验收

优先验收顺序：

1. 回放模式
2. 教学模式
3. 观战模式
4. 菜单辅助

不建议把“实时对战辅助”作为第一验收目标。

上线门禁可直接按：

- `docs/design/mahjong-companion-plugin-runtime-release-checklist.md`

---

## 11. 关键风险

- 最大难点不是“说得像猫娘”，而是“感知结果是否稳定到足以值得说”。
- 如果识别错误率高，陪伴体验会立刻退化成噪声。
- 如果 `FrameChangeGate` 过于激进，可能漏掉关键局面变化，造成状态滞后。
- 如果介入时机不做节流，角色会显得碎嘴和抢话。
- 如果 `SpeechPolicy` 调得太保守，用户会觉得她存在感太弱；调得太激进，又会变回播音员。
- 如果输入辅助边界不清，功能会快速滑向高风险区域。
- 如果长期记忆注入不做摘要筛选，宿主记忆会被麻将流水噪声污染。
- 如果一开始就上 YOLO、模型训练、输入模拟、多服务拆分，项目复杂度会远超当前仓库的增量承受范围。
- 如果把方案继续往“伪装外挂”方向推，产品风险和合规风险都会迅速上升。

---

## 12. 最终建议

基于当前 N.E.K.O 仓库，最合理的落地路径不是：

- 先做高频视觉微服务
- 先做全自动代打
- 先做反检测输入模拟

而是：

1. 先做一个长生命周期插件。
2. 先稳住运行时协作骨架（双队列 mailbox + 三态 runtime + 打断语义）。
3. 再跑通低频截图、`FrameChangeGate`、状态结构化、建议生成、陪伴表达。
4. 再把回放 / 教学 / 复盘、`SpeechPolicy`、`CompanionViewModel` 和 `assist` 级辅助操作做好。
5. 最后按契约逐步替换截图实现、感知模型、决策引擎、更高阶输入层与长期记忆桥。

这样既能保住“雀魂陪伴与讲解”这个亮点，也真正贴合当前项目已有的插件、语音、Avatar 和 Agent 能力。
