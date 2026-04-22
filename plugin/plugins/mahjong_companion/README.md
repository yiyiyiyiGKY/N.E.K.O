# Mahjong Companion

雀魂陪伴插件，当前已完成 V1-V9 第一版主链路，并补齐了“游戏运行时协作骨架”（runtime mailbox + 三态运行模式）。

当前已实现：

- 标准插件接入、启动、停止、配置热更新
- 最小会话状态机与状态缓存写入
- 静态调试 UI
- `start_session` / `stop_session` / `get_session_status` / `set_mode`
- `set_runtime_mode` / `send_runtime_message` / `get_runtime_mailbox`
- `bind_window` / `unbind_window`
- `capture_debug_frame` 真实截图
- `analyze_debug_frame` / `analyze_frame_path` / `get_last_perception`
- `generate_decision` / `get_last_decision`
- `generate_narration` / `get_last_narration` / `preview_companion_view`
- `run_companion_pipeline`
- `speak_last_narration` / `cycle_voice_mode`
- `generate_review_summary` / `get_last_review_summary`
- `sync_memory_bridge` / `get_coaching_trend` / `get_last_coaching_topics`
- `list_assist_actions` / `execute_assist_action` / `get_action_log`
- 多后端截图回退
- 帧变化门控
- 连续失败降级
- 基础场景识别、按钮候选识别、是否轮到用户的粗粒度判断
- 最小规则决策、陪伴文案生成、语音播报候选判断
- 更细的规则建议焦点、关键决策标签与复盘候选沉淀
- `action/human_override_guard.py` 输入安全守卫层
- `review/memory_bridge.py` 长期记忆桥分流层
- `review/game_private_memory.py` 游戏侧私有记忆层
- `runtime/game_agent_runtime.py` 独立运行时主类
- `runtime/inbox.py` 入站邮箱与打断语义
- `runtime/outbox.py` 出站队列（优先级/去重/节流）
- `runtime/mailbox.py` 兼容双队列实现
- `runtime_mode=active/standby/off` 三态运行模式（`standby` 下停游戏操作但可整理信息）
- 感知调试产物输出

当前还未实现：

- 更稳定的真实牌级识别与校准样本闭环
- 更完整的向听/进张/危险度分析后端
- 更可靠的动作定位策略（按钮级定位、多策略回退）
- 真实宿主长期记忆写入（当前仍以本地记忆桥暂存与聚合为主）
- 面向猫娘侧的标准化调度协议（当前主要通过 runtime action 约定）

当前可怎么用：

1. 在 `/ui/plugins` 打开“雀魂陪伴”。
2. 进入插件调试页后先点“尝试绑定窗口”。
3. 看到窗口标题或绑定状态后，点“抓取调试帧”。
4. 再点“分析最近截图”。
5. 之后可以继续点“生成决策”“生成讲解”，需要时再点“播报当前讲解”。
6. 如果你只是想验证总链路，可以直接点“一键跑到猫娘回话”。
7. 运行时控制区可直接切换 `active/standby/off`，并发送 runtime 动作（例如 `refresh_status`、`summarize_review`、`sync_memory`）。
8. 截图会保存到 `data/debug_samples/`，感知、决策、讲解结果也会生成配套 JSON；关键节点还会沉淀到 `data/session_cache/review_candidates.json`。
9. 页面会展示最近截图路径、场景、按钮候选、决策类型、讲解文本、语音模式、运行时队列与最近错误。

快速自检：

- 可以直接运行 `.venv/bin/python -m plugin.plugins.mahjong_companion.smoke_test --pretty`
- 这个 smoke test 会同时验证：
  - 真实调试样本下的 `感知 -> 决策 -> 讲解 -> 强制调试回话`
  - 可控高价值窗口下的 `review candidate -> memory bridge -> review summary -> coaching trend`
  - 可控牌效率场景下的 `tile_efficiency_hint`
  - `assist` 模式下的辅助动作 `dry_run` 与动作日志
- 如果返回 JSON 里的 `ok` 为 `true`，说明当前 V1-V9 的第一版主链路仍然可运行。

当前实现说明：

- 绑定是“软绑定优先，区域抓图尽量，失败时回退全屏”的策略。
- 如果能拿到活动窗口几何信息，会优先按窗口区域截图。
- 如果区域截图失败，会继续尝试全屏截图，而不是直接失败。
- 当前截图层已经独立抽到 `capture/`，不再由 `orchestrator.py` 直接管理各截图后端。
- 当前帧变化门控已经独立抽到 `gates/`，主循环里会优先跳过连续不变的画面。
- 连续失败达到阈值后，状态会先进入 `warning`，再回退到 `idle`。
- 当前感知是规则型第一版，重点解决“场景、按钮、轮到谁”的基础闭环，不追求牌级识别精度。
- 决策与讲解同样是规则型第一版，重点先把“值得不值得提醒、怎么提醒、能不能播报”这条链路打通。
- 当前消息投递已经通过 `narration/dispatcher.py` 独立收口，`orchestrator.py` 主要负责主链路编排。
- 当前第五阶段起点已经开始把“和牌窗口 / 立直窗口 / 吃碰杠决策点 / 确认弹窗”拆成更细的规则焦点，并把高价值节点写入复盘候选缓存。
- 当前 `HumanOverrideGuard` 已经独立成安全层，先负责动作窗口的“武装 / 检测 / 中断”逻辑，为后续自动辅助操作接入做准备。
- 当前 `MemoryBridge` 已经独立成摘要桥接层，会把高价值节点写入本地记忆桥队列；由于宿主 SDK 现在只有 memory 查询能力、还没有插件侧写入接口，所以暂时采用本地暂存而不是直接写入宿主长期记忆。
- 当前 runtime 协作语义是：猫娘入站命令可以打断旧命令，游戏侧出站消息先排队再按 tick flush，不会直接抢占猫娘对话线程。
- 当前 runtime 协作语义已在 `contracts.py` 固化三条硬规则，避免后续实现漂移。
- 当前 `standby` 模式会暂停游戏操作主循环与辅助动作执行，但仍可处理状态刷新、复盘摘要和记忆同步类命令。
- 当前记忆边界是：原始游戏流水写入 `game_private_memory.json`，上送宿主/猫娘侧默认只投影 `summary_tags + coach_note`。
- 感知、决策、讲解调试文件会和截图一起落到 `data/debug_samples/`，便于后续离线调规则。

后续开发顺序建议：

1. 先稳定 runtime 协议与依赖注入边界
2. 提升牌级感知与牌理分析可信度（V8/V6 质量收口）
3. 提升动作定位与授权审计能力（V7 收口）
4. 接真实宿主记忆写入闭环（V9 收口）
