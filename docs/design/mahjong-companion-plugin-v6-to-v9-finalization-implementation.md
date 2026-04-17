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
> - 当前真正缺的，不是“有没有入口”，而是“质量、边界、依赖注入、真实宿主能力、真实识别精度、真实按钮定位”等最终形态能力。
> - 因此这份文档的目标不是再扩展概念，而是定义一套明确的收口标准、模块清单、接口草案和实施顺序。

---

## 1. 文档目标

本文只做五件事：

- 定义 V6-V9 各自的“最终形态”到底意味着什么
- 把“当前第一版”和“最终形态”之间的缺口写清楚
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

结论：

- V6-V9 现在不是“没做”
- 而是“都有第一版，但还没有达到最终形态”

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

1. 先补统一接口收口：
   - `PerceptionAdapter`
   - `ReviewSummarizer`
   - `ActionLocator`
   - `HostMemoryWriter`
2. 再补 V8：
   - 因为它决定 V6 和 V9 的上游质量
3. 再补 V6：
   - 把复盘摘要升到更稳定结构
4. 再补 V7：
   - 把动作定位从锚点提升到更可靠策略
5. 最后补 V9：
   - 接真实宿主写入
   - 接跨会话引用闭环

原因：

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

---

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
