# 雀魂陪伴插件 V6-V9 最终形态实现文档

> 前置文档：
> - `docs/design/mahjong-companion-plugin-plan.md`
> - `docs/design/mahjong-companion-plugin-v6-tile-efficiency-and-review-summary.md`
> - `docs/design/mahjong-companion-plugin-v7-assisted-actions-and-safe-execution.md`
> - `docs/design/mahjong-companion-plugin-v8-complete-mahjong-analysis-and-calibrated-perception.md`
> - `docs/design/mahjong-companion-plugin-v9-host-memory-sync-and-cross-session-coaching.md`
> - `docs/design/mahjong-companion-plugin-v10-generalized-game-companion-framework.md`
>
> 本文不是新增阶段文档，而是“V6 到 V9 的收口实现文档”。
>
> 它只解决一件事：
> - 把当前已经落地的 V6-V9 第一版，推进到真正可长期维护、可继续通往 V10 的最终形态

> 实施同步说明：
> - 截至当前仓库状态，V6-V9 都已经有“可运行第一版”，并且 smoke test 与对应单元测试已经能覆盖主链路。
> - 已补齐“游戏运行时协作骨架”第一版：`runtime/game_agent_runtime.py`、`runtime/inbox.py`、`runtime/outbox.py`、`runtime_mode=active/standby/off`、`set_runtime_mode/send_runtime_message/get_runtime_mailbox`，以及“入站可打断、出站先排队”的最小语义。
> - 已在 `contracts.py` 固化运行时动作契约和三条硬规则，作为 P0 验收口径基线。
> - 当前真正缺的，不是“有没有入口”，而是“质量、边界、依赖注入、真实宿主能力、真实识别精度、真实按钮定位”等最终形态能力。
> - 因此这份文档的目标不是再扩展概念，而是定义一套明确的收口标准、模块清单、接口草案和实施顺序。

---

## 1. 文档目标

本文只做六件事：

- 定义 V6-V9 各自的“最终形态”到底意味着什么
- 把“当前第一版”和“最终形态”之间的缺口写清楚
- 明确当前实现与“通用游戏插件框架”要求的一致性与差距
- 给出模块级拆分、接口草案和数据流边界
- 明确推荐的落地顺序，避免并行推进时互相打架
- 给出验收标准，确保完成后可以自然进入 V10

一句话理解：

- 这份文档不是再往前画新饼
- 而是把 V6-V9 从“能跑”推进到“可长期依赖”

---

## 2. 当前基线

当前仓库已经具备：

- V6 第一版：
  - `decision/tile_efficiency.py`
  - `review/summarizer.py`
  - `generate_review_summary`
- V7 第一版：
  - `action/input_adapter.py`
  - `action/action_registry.py`
  - `action/action_log.py`
  - `HumanOverrideGuard` 接入执行闭环
- V8 第一版：
  - `perception/calibration.py`
  - `perception/hand_layout.py`
  - `perception/tile_parser.py`
  - `decision/mahjong_analysis.py`
  - `decision/risk_estimator.py`
- V9 第一版：
  - `review/host_memory_sync.py`
  - `review/trend_aggregator.py`
  - `review/coaching_topics.py`
  - `sync_memory_bridge / get_coaching_trend / get_last_coaching_topics`
- 运行时协作框架第一版：
  - `runtime/game_agent_runtime.py` 独立运行时主类
  - `runtime/inbox.py` 入站邮箱（支持 interrupt）
  - `runtime/outbox.py` 出站队列（优先级/去重/节流）
  - `runtime/mailbox.py` 兼容层（保留）
  - `runtime_mode=active/standby/off` 三态运行模式
  - `set_runtime_mode / send_runtime_message / get_runtime_mailbox` 插件入口
  - `SessionState.runtime_*` 状态字段与调试 UI 展示
  - 入站 `interrupt=true` 时清空旧命令，出站消息先排队再按 tick flush
- 记忆分层第一版：
  - `review/game_private_memory.py` 游戏侧私有流水（本地留存）
  - `review/memory_bridge.py` 与 `review/host_memory_sync.py` 默认只投影 `summary_tags + coach_note` 给上游

当前仓库仍然缺少：

- V6：
  - 更完整、可解释、可扩展的复盘摘要结构
  - 更稳定的牌理分析基础
- V7：
  - 基于真实按钮/控件的动作定位
  - 更完整的授权与风险展示
- V8：
  - 稳定牌级识别
  - 校准样本闭环
  - 更可信的麻将算法计算
- V9：
  - 真实宿主长期记忆写入
  - 基于宿主记忆的跨会话引用闭环
- 运行时框架：
  - 面向猫娘侧的宿主级统一调度协议仍未抽到平台层（当前为插件级契约）
  - 游戏记忆到猫娘提示的策略模板还可继续标准化（当前已完成最小边界投影）

结论：

- V6-V9 现在不是“没做”
- 而是“都有第一版，但还没有达到最终形态”

### 2.1 与通用游戏插件框架的一致性核对

按当前代码实况，对齐结果如下：

- 要求 1：后台持续运行的游戏 LLM/代理，只在特定节点和猫娘同步  
  当前状态：已满足第一版。`SessionOrchestrator` 长循环独立运行，猫娘侧通过 runtime 入站动作低频触发同步。
- 要求 2：双向消息，猫娘消息可打断，游戏消息只入猫娘队列  
  当前状态：已满足第一版。入站 `interrupt=true` 会清空旧命令队列；出站统一进 runtime outbox，再由 flush 投递。
- 要求 3：游戏代理可复杂、有记忆，但不承载复杂人格  
  当前状态：已满足方向。当前人格表达主要在 `narration/`，游戏侧聚焦感知/决策/复盘。
- 要求 4：不是所有消息都发给猫娘  
  当前状态：已满足第一版。当前由讲解策略和出站 flush 节流控制，默认只推送关键节点。
- 要求 5：猫娘对话不因游戏中断，游戏不因猫娘静默中断  
  当前状态：已满足第一版。游戏循环与猫娘对话链路解耦，消息通过队列异步投递。
- 要求 6：`standby` 不操作游戏，但仍可整理信息  
  当前状态：已满足第一版。`standby` 会跳过 live cycle 与辅助动作，但可处理 `summarize_review/sync_memory` 等命令。
- 要求 7：游戏记忆不直接暴露，先由游戏侧整理再提醒猫娘  
  当前状态：部分满足。已有 `memory_bridge` 与复盘摘要分流，但筛选策略仍需进一步标准化。

---

## 3. 收口原则

### 3.1 先把现有分层补稳，再追更强能力

V6-V9 的收口，不应通过把逻辑重新堆回 `orchestrator.py` 完成。

应坚持：

- `perception/` 继续负责“看见什么”
- `decision/` 继续负责“建议什么”
- `narration/` 继续负责“怎么说”
- `action/` 继续负责“怎么安全执行”
- `review/` 继续负责“怎么沉淀、总结、跨局引用”

### 3.2 每一版的最终形态都必须满足“真实可替换”

这里的“最终形态”不是功能更多，而是：

- 有明确输入输出
- 有真实状态字段
- 有调试产物
- 有测试替身
- 有宿主约束下的降级路径

### 3.3 不以假精度冒充成熟能力

特别是 V8 和 V9：

- V8 不能把启发式估算包装成“完整麻将引擎”
- V9 不能把本地暂存包装成“已经写入宿主长期记忆”

---

## 4. 最终形态定义

### 4.1 V6 最终形态：稳定牌理建议与可读复盘摘要

V6 的最终形态，应满足：

- 局内能输出结构化轻量牌理建议
- 局后能生成可读、可解释、可扩展的摘要
- 复盘摘要可以稳定为 V9 提供跨局素材
- 失败时有清晰降级，不影响主链路

必须具备的最终能力：

- `MahjongAnalysis` 至少稳定包含：
  - `analysis_version`
  - `tile_level_available`
  - `tile_level_state`
  - `analysis_confidence`
  - `shanten_estimate`
  - `ukeire_estimate`
  - `candidate_discards`
  - `defense_alerts`
  - `teaching_points`
- `ReviewSummary` 至少稳定包含：
  - `highlights`
  - `risk_points`
  - `mistake_patterns`
  - `coach_note`
  - `memory_bridge_candidates`
  - `summary_text`
  - `source_candidate_count`
  - `source_session_id`

V6 当前缺口：

- `tile_efficiency.py` 里的向听/进张仍是轻量估算
- `summarizer.py` 还是规则模板为主
- 尚未形成可区分“事实 / 风险 / 建议 / 训练重点”的明确摘要层

V6 最终模块建议：

```text
decision/
├── mahjong_analysis.py
├── tile_efficiency.py
├── analysis_backend.py
└── analysis_models.py

review/
├── bridge.py
├── summarizer.py
├── summary_models.py
└── summary_renderer.py
```

建议新增接口：

```python
class MahjongAnalysisBackend(Protocol):
    def analyze_hand(self, state: PerceivedGameState) -> MahjongAnalysis: ...

class ReviewSummarizer(Protocol):
    def summarize(self, session_id: str, candidates: list[dict[str, Any]]) -> dict[str, Any]: ...
```

V6 完成标志：

- 无结构化手牌输入时，稳定降级到 `mahjong-lite-v1`
- 有结构化手牌输入时，稳定进入 `tile_efficiency_hint`
- 复盘摘要能从同一局的多个候选中输出高光、风险点和训练结论
- 输出结构稳定到足以供 V9 聚合使用

### 4.2 V7 最终形态：安全、可解释、可恢复的辅助执行层

V7 的最终形态，应满足：

- 动作执行与讲解层完全分离
- 所有动作都可追踪、可审计、可立即关闭
- 动作定位不再依赖单一锚点，而要有更可靠的定位策略
- 执行失败、用户抢鼠标、场景不符时能清晰中止

必须具备的最终能力：

- 动作分级：
  - `off`
  - `assist`
  - `semi_auto`
- 动作来源与执行日志：
  - 动作 id
  - 来源
  - 当前场景
  - 是否 dry run
  - 是否用户确认
  - 是否被 guard 中止
  - 定位方式
  - 失败原因
- 定位策略至少支持：
  - 窗口相对锚点
  - 调试标定坐标
  - 按钮级候选定位

V7 当前缺口：

- `InputAdapter.build_command_from_action()` 仍是固定相对坐标
- 缺少场景级动作定位 profile
- 缺少更清晰的风险确认与 UI 展示

V7 最终模块建议：

```text
action/
├── action_registry.py
├── input_adapter.py
├── action_log.py
├── locator.py
├── execution_policy.py
└── safety_prompt.py
```

建议新增接口：

```python
class ActionLocator(Protocol):
    def locate(self, action_id: str, state: SessionState) -> InputCommand | None: ...

class ActionExecutionPolicy(Protocol):
    def allow(self, action_id: str, state: SessionState, user_confirmed: bool) -> tuple[bool, str]: ...
```

V7 完成标志：

- 每个动作都有明确定位来源
- 每个动作都有清晰审计记录
- `HumanOverrideGuard` 能稳定中断动作
- 不同场景下能选择不同定位策略
- UI 能明确展示当前动作模式、最近动作和失败原因

### 4.3 V8 最终形态：可信的校准化牌级感知与完整麻将分析基础

V8 的最终形态，应满足：

- 牌级感知不再主要依赖 fixture
- 校准 profile 能真实影响 ROI 和解析质量
- 向听/进张/候选弃牌/防守提示有更可信的算法后端
- 低置信、无校准、无样本时有清晰降级

必须具备的最终能力：

- 感知层：
  - 真实牌图解析
  - 手牌区 / 副露区 / 宝牌区布局校准
  - 校准 profile 存储与加载
  - 样本回归与误差对比
- 决策层：
  - 更可靠的向听估算
  - 更可靠的进张估算
  - 更明确的防守提示来源
  - 置信度分层

V8 当前缺口：

- `tile_parser.py` 目前优先依赖 fixture
- 默认 calibration 仍是 fallback
- 分析部分仍以启发式估算为主

V8 最终模块建议：

```text
perception/
├── calibration.py
├── hand_layout.py
├── tile_parser.py
├── tile_detector.py
├── tile_classifier.py
└── calibration_dataset.py

decision/
├── analysis_backend.py
├── risk_estimator.py
├── tile_efficiency.py
└── mahjong_repository_adapter.py
```

建议新增接口：

```python
class TileParser(Protocol):
    def parse(self, image_path: Path, image: Image.Image, scene: str, metrics: dict[str, Any]) -> TileParseResult: ...

class CalibrationStore(Protocol):
    def resolve(self, width: int, height: int) -> CalibrationProfile: ...
    def save(self, profile: CalibrationProfile) -> None: ...
```

V8 完成标志：

- 无 fixture 也能输出可用的牌级解析
- `tile_level_partial / reliable` 的判断来自真实解析质量，而不是硬编码状态
- 分析后端可以被替换成更强算法实现
- 调试 UI 至少能展示当前 calibration profile 和 tile-level 状态

### 4.4 V9 最终形态：真实宿主记忆同步与跨会话训练陪伴

V9 的最终形态，应满足：

- 本地高价值摘要可以真正写入宿主长期记忆
- 宿主写入失败时不会丢本地队列
- 新会话或闲聊时可以自然引用近期训练趋势
- 趋势与话题的生成边界清晰、可验证

必须具备的最终能力：

- `host_memory_sync.py`
  - 真正的宿主写入 adapter
  - 去重、质量过滤、重试、状态记录
- `trend_aggregator.py`
  - 多局趋势聚合
  - 风格偏向判断
  - 高频训练点聚类
- `coaching_topics.py`
  - 教练话题生成
  - 人类可读的训练焦点
  - 跨局引用摘要

V9 当前缺口：

- 当前 SDK 只有 `query / get`，没有写接口
- 当前趋势和话题仍主要来自本地缓存
- 还没有真正把宿主长期记忆反哺回新会话表达层

V9 最终模块建议：

```text
review/
├── memory_bridge.py
├── host_memory_sync.py
├── trend_aggregator.py
├── coaching_topics.py
├── host_memory_reader.py
└── coaching_context.py
```

建议新增接口：

```python
class HostMemoryWriter(Protocol):
    async def write(self, bucket_id: str, payload: dict[str, Any]) -> dict[str, Any]: ...

class CoachingTrendProvider(Protocol):
    def build_trend(self, cache_dir: Path) -> dict[str, Any]: ...

class CoachingContextProvider(Protocol):
    def build_context(self, cache_dir: Path, conversation_scene: str) -> dict[str, Any]: ...
```

V9 完成标志：

- 成功写入宿主时，状态不是 `host_memory_write_unavailable`
- 写入失败时，本地队列仍保留且带状态
- 新会话能读取近期训练趋势
- 闲聊/陪伴回复能带入真实跨局训练焦点

---

## 5. 跨版本统一收口任务

V6-V9 的最终形态，不是四份独立小修小补。

它们有几项统一前置任务：

### 5.0 固化运行时协作协议（框架优先）

在上线压力高的情况下，先保证“框架正确”，再追求“分析更强”：

- 固化 runtime 命令集合与 payload 契约（`refresh_status/set_mode/set_runtime_mode/explain_current_hand/summarize_review/sync_memory/dispatch_current_narration`）。
- 固化打断语义：猫娘发入站命令可打断旧命令；游戏出站消息不抢占猫娘当前对话。
- 固化 `active/standby/off` 三态行为边界，避免后续功能叠加时语义漂移。
- 把运行时 mailbox 指标纳入状态上报与 UI（队列长度、丢弃计数、最近命令、最近出站消息）。
- 把协议硬规则沉淀到 `contracts.py`，减少实现与文档漂移。

### 5.1 补齐依赖注入边界

当前仍建议继续完成这些注入点：

- `PerceptionAdapter`
- `NarrationAdapter`
- `ReviewSummarizer`
- `MahjongAnalysisBackend`
- `ActionLocator`
- `HostMemoryWriter`

完成标准：

- `SessionOrchestrator` 主要依赖契约而不是默认实现细节
- fake adapter 能独立跑主链路测试

### 5.2 统一状态字段与调试产物

建议把 V6-V9 的状态和调试产物继续收口成稳定规范：

- `last_tile_analysis_available`
- `last_shanten_estimate`
- `last_ukeire_estimate`
- `last_review_summary`
- `last_host_memory_sync_status`
- `last_coaching_trend`
- `last_coaching_topics`
- `last_action_*`
- `runtime_mode`
- `game_runtime_status`
- `runtime_interrupt_seq`
- `runtime_inbound_pending / runtime_outbound_pending`
- `runtime_dropped_inbound / runtime_dropped_outbound`
- `last_runtime_command_* / last_runtime_outbound_*`

### 5.3 统一样本与 smoke test

当前已经有：

- `debug_samples/`
- `session_cache/`
- `smoke_test.py`

最终形态建议继续补：

- 高价值动作窗口样本
- 牌效率样本
- 低置信失败样本
- V9 宿主写入 mock 样本

---

## 6. 推荐实施顺序

不建议按文档编号线性闭眼推进。

更合理的顺序是：

1. P0：先稳住运行时框架（已完成第一版）
   - runtime mailbox、三态模式、入站打断语义、出站排队语义
   - 目标：先保证“猫娘与游戏互不阻塞”
2. P1：补统一接口收口
   - `PerceptionAdapter`
   - `ReviewSummarizer`
   - `ActionLocator`
   - `HostMemoryWriter`
   - 目标：把后续改动从 `orchestrator` 主循环里解耦
3. P2：先补 V8，再补 V6
   - 先提高牌级感知与分析可信度
   - 再把复盘摘要结构升级到可跨局复用
4. P3：补 V7
   - 把动作定位从锚点提升到多策略定位
   - 完成更清晰授权、审计、失败恢复
5. P4：补 V9 宿主闭环
   - 接真实宿主写入
   - 接跨会话引用闭环

原因：

- 上线窗口紧时，框架错误比算法不够强更致命
- V8 质量不稳，V6 和 V9 的内容质量也不会稳
- V9 宿主写入如果先做，很容易把当前低质量摘要放大
- V7 最终形态依赖更稳定的感知和场景定位支持

---

## 7. 验收标准

### 7.1 V6 验收

- 能从同一局多个复盘候选生成稳定摘要
- `summary_text`、`highlights`、`risk_points`、`coach_note` 均非空
- 结构化手牌输入下能输出可解释的牌效率建议

### 7.2 V7 验收

- 动作定位策略不只一种
- 场景不符、未确认、guard 触发时都能正确拒绝
- 日志完整、状态字段完整、UI 可见

### 7.3 V8 验收

- 无 fixture 情况下仍能输出可用牌级解析
- 校准 profile 能被真实加载和使用
- 向听/进张/防守提示结果稳定可回归

### 7.4 V9 验收

- 宿主写入成功与失败都可区分
- 本地队列不会因为失败而丢失
- 新会话能引用近期训练趋势

### 7.5 统一验收

- `smoke_test.py` 继续通过
- 对应单元测试继续通过
- 新增能力都有降级路径和状态字段
- runtime mailbox 相关测试通过（至少覆盖：入站打断、`standby` 跳过 live cycle、`standby` 阻断 assist 动作、出站排队 flush）
- memory boundary 相关测试通过（默认不暴露私有游戏流水）
- 关键测试文件：
  - `plugin/tests/unit/sdk/plugin/test_mahjong_companion_runtime_mailbox.py`
  - `plugin/tests/unit/sdk/plugin/test_mahjong_companion_standby_mode.py`
  - `plugin/tests/unit/sdk/plugin/test_mahjong_companion_memory_boundary.py`

---

## 9. 上线门禁文档

Runtime 收口上线按以下文档执行：

- `docs/design/mahjong-companion-plugin-runtime-release-checklist.md`
- `docs/design/mahjong-companion-plugin-next-phase-continuation-guide.md`

## 8. 完成后对 V10 的意义

V6-V9 最终形态完成后，V10 才真正值得开始大规模通用化。

原因很简单：

- V10 不是把“第一版试验能力”抽成通用层
- 而是把“已经收口、边界清晰、质量稳定的能力”抽成 profile 基座

如果 V6-V9 还停留在：

- 启发式估算
- 固定锚点动作
- 本地降级宿主记忆
- 规则模板复盘

那 V10 的通用化只会把不稳定能力扩散出去。

因此这份文档的真正意义是：

- 先把 V6-V9 做到“值得抽象”
- 再做 V10 的通用框架
