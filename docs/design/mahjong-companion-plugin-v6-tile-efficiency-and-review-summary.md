# 雀魂陪伴插件第六版文档：牌效率建议与赛后复盘摘要

> 前置文档：
> - `docs/design/mahjong-companion-plugin-plan.md`
> - `docs/design/mahjong-companion-plugin-v4-narration-and-companion-output.md`
> - `docs/design/mahjong-companion-plugin-v5-enhanced-rules-and-review-bridge.md`
>
> 本文对应第五版“增强规则建议与复盘桥接”之后的下一阶段，解决两件事：
> - 把第五版“按钮焦点级建议”推进到“带一点牌理语义的轻量建议”
> - 把 `review_candidates.json` 组织成可读的赛后复盘摘要，而不只是原始候选缓存
>
> 实施同步说明：
> - 截至当前仓库状态，第六阶段还没有落到代码里，这份文档是下一阶段的正式设计稿。
> - 当前仓库已经具备第六阶段需要复用的前置能力：`DecisionResult.suggestion / recommended_focus / review_tags`、`review/bridge.py`、`review/memory_bridge.py`、`data/session_cache/review_candidates.json`，以及按条件生成的 `data/session_cache/memory_bridge_queue.json`。
> - 当前仓库还没有具备：牌级感知、向听 / 进张 / 打点估算、可读复盘摘要生成器、独立的复盘摘要入口。
> - 因此第六阶段的关键，不是继续扩“有没有按钮”，而是开始补“为什么这巡更值得这样打”以及“这一局结束后该怎么回看”。

---

## 1. 本阶段目标

第六版不追求一上来就做成完整麻将 AI 教练，而是先把第五版“规则焦点提示”推进成“轻量牌理建议 + 可读复盘摘要”。

完成后，插件应该具备：

- 能在有足够局面信息时输出轻量牌效率建议
- 能在建议里表达“更像牌理”的理由，而不只是“这里有按钮”
- 能从 `review_candidates.json` 生成一份可读的赛后复盘摘要
- 能把复盘摘要与第五版的长期记忆桥接保持兼容
- 能在缺少牌级信息时优雅降级回第五版行为，而不是整条链路失效

一句话理解：

- 第五版解决“知道此刻该重点看什么”
- 第六版解决“开始解释为什么这样看，并把整局关键节点整理成能读的总结”

---

## 2. 本阶段范围

### 2.1 必做

- 为决策层增加第六版牌理建议字段
- 引入第一版轻量牌效率 / 防守提示模块
- 增加赛后复盘摘要生成模块
- 增加复盘摘要相关状态字段与插件入口
- 保持第五版讲解、播报、记忆桥接链路兼容

### 2.2 先不做

- 完整牌谱重建
- 全量手牌识别模型
- 高精度危险牌概率模型
- 打点精算
- 跨局训练计划生成
- 自动根据复盘结果反推实时操作

结论：

- 第六版是“轻量牌效率建议 + 赛后复盘摘要”
- 不是“完整麻将分析器”或“全自动复盘引擎”

---

## 3. 当前代码作为第六版前置基线

第六版直接建立在这些已落地能力之上：

- `perception/` 已能提供 `scene / confidence / is_user_turn / buttons / notes`
- `decision/generator.py` 已能输出 `suggestion / recommended_focus / review_tags`
- `narration/` 已能把 `DecisionResult` 转成陪伴式讲解和受控播报
- `review/bridge.py` 已能把高价值节点写入 `review_candidates.json`
- `review/memory_bridge.py` 已能把高价值节点摘要暂存到本地桥接队列
- `run_companion_pipeline` 已能把单帧调试链路从截图跑到猫娘主动回话

第六版真正要补的是：

- 更像麻将建议的结构化分析层
- 一份对人可读的赛后摘要层

---

## 4. 设计原则

### 4.1 先支持“轻量牌理”，不要一口气承诺完整算法

第六版优先支持：

- 当前更偏进攻还是更偏保守
- 哪类弃牌方向更自然
- 当前提醒更像“保留搭子”“别急着碰”“优先确认和牌 / 立直价值”

第六版暂不要求：

- 每一巡都给出最优弃牌
- 对所有分辨率和 UI 皮肤都能稳定识别 13 张手牌

### 4.2 分离“牌理分析结果”和“陪伴说法”

不要让 `narration/` 直接读取底层牌效率细节。

建议保持三层：

- `MahjongAnalysis` 或等价结构：第六版新增的牌理分析结果
- `DecisionResult`：面向业务决策的统一输出
- `NarrationEvent` / `CompanionViewModel`：面向用户的陪伴式表达

这样后续不管规则增强、换算法库还是补模型，都不会把讲解层一起拖乱。

### 4.3 复盘摘要先来自“关键节点集合”，不依赖完整牌谱

第六版先基于：

- `review_candidates.json`
- 调试产物里的 `perception / decision / narration` 信息
- 会话状态里已有的模式、场景、风险等级、焦点标签

先做“能读”的摘要，而不是一开始就要求完整牌谱重建。

### 4.4 无牌级信息时必须能降级

如果当前还拿不到可靠的手牌结构，就应该：

- 继续输出第五版规则焦点建议
- 在 `engine_meta` 或调试信息里明确标记“tile_level_unavailable”
- 避免编造向听、进张、打点等看似专业但并不可信的结果

---

## 5. 推荐数据模型增强

### 5.1 第六版建议新增 `MahjongAnalysis`

建议新增一个独立分析结构，再由 `DecisionResult` 挂引用或摘要字段：

```json
{
  "analysis_version": "mahjong-lite-v1",
  "tile_level_available": false,
  "hand_shape_confidence": 0.0,
  "shanten_estimate": null,
  "ukeire_estimate": null,
  "candidate_discards": [],
  "attack_defense_bias": "neutral",
  "teaching_points": [
    "当前先按按钮焦点做提醒，牌级建议尚未启用。"
  ]
}
```

当后续开始支持轻量牌级输入时，再逐步允许：

```json
{
  "analysis_version": "mahjong-lite-v1",
  "tile_level_available": true,
  "hand_shape_confidence": 0.66,
  "shanten_estimate": 1,
  "ukeire_estimate": 18,
  "candidate_discards": [
    {
      "tile": "9m",
      "score": 0.77,
      "ukeire_estimate": 18,
      "safety_hint": "medium",
      "reason": "孤张幺九且对当前主线改善较弱"
    }
  ],
  "attack_defense_bias": "slightly_defensive",
  "teaching_points": [
    "这手先保留两面形更自然。"
  ]
}
```

### 5.2 `DecisionResult` 第六版建议扩展字段

建议在第五版基础上新增：

```json
{
  "decision_type": "tile_efficiency_hint",
  "summary": "这一巡更适合先走稳一点的牌效率路线。",
  "detail": "当前手里有孤张边张，先别急着拆更完整的搭子。",
  "suggestion": "优先考虑处理 9m 这类改善较弱的孤张。",
  "recommended_focus": "tile_efficiency",
  "review_tags": ["tile_efficiency", "mid_round_choice"],
  "mahjong_analysis": {
    "tile_level_available": true,
    "shanten_estimate": 1,
    "ukeire_estimate": 18
  }
}
```

建议新增字段但保持兼容：

- `mahjong_analysis`
- `review_summary_snippet`
- `engine_meta.analysis_version`

### 5.3 `ReviewSummary` 第一版建议结构

建议新增赛后复盘摘要结构：

```json
{
  "session_id": "mahjong-1234abcd",
  "generated_at": "2026-04-15T08:00:00+00:00",
  "source_candidate_count": 6,
  "highlights": [
    "你有一次高价值和牌确认窗口，反应是跟上的。"
  ],
  "risk_points": [
    "有两次决策点都偏向先确认按钮语义，再决定是否继续进攻。"
  ],
  "mistake_patterns": [
    "当前样本更像是按钮决策犹豫，而不是明确的牌效率问题。"
  ],
  "coach_note": "这局最值得继续练的是关键窗口出现时的确认节奏。",
  "memory_bridge_candidates": [
    "mahjong_high_value_timing",
    "mahjong_risk_focus"
  ]
}
```

这个结构的目标是：

- 给用户读
- 给调试看
- 给后续记忆桥接筛选

而不是替代底层原始候选文件。

---

## 6. 推荐模块变化

第六版建议在当前目录基础上新增最少两个模块：

```text
plugin/plugins/mahjong_companion/
├── decision/
│   ├── adapter.py
│   ├── generator.py
│   ├── debug_dump.py
│   └── tile_efficiency.py      # 第六版新增
├── review/
│   ├── bridge.py
│   ├── memory_bridge.py
│   └── summarizer.py           # 第六版新增
└── session_state.py
```

职责建议：

- `decision/tile_efficiency.py`
  - 接受轻量结构化手牌信息
  - 生成牌效率 / 防守倾向 / 教学点
  - 在拿不到牌级信息时明确降级
- `review/summarizer.py`
  - 读取 `review_candidates.json`
  - 聚合高价值节点
  - 生成 `ReviewSummary`
  - 决定哪些摘要值得继续进入 `memory_bridge`

---

## 7. 插件入口与状态建议

### 7.1 新增入口建议

建议新增：

- `generate_review_summary`
- `get_last_review_summary`

可选但不强制：

- `generate_review_summary_from_file`

第六版先不要求必须叫 `run_replay_review`。

原因：

- 当前仓库还没有完整回放驱动链路
- 第六版第一步更像“从本地候选缓存生成摘要”
- 等真正把回放模式做强后，再决定是否补一个更大的总入口

### 7.2 `SessionState` 建议新增字段

建议增加：

```json
{
  "last_review_summary_at": "",
  "last_review_summary_ok": false,
  "last_review_summary": {},
  "last_review_summary_text": "",
  "last_tile_analysis_available": false,
  "last_shanten_estimate": null,
  "last_ukeire_estimate": null
}
```

这样宿主状态、插件 UI 和调试文件都能对上。

---

## 8. UI 建议

第六版不需要重做整个面板，但建议至少补四块内容：

- 当前是否已有牌级分析
- 最近一次轻量牌理建议
- 最近一次复盘摘要的核心段落
- 最近一次复盘摘要生成时间

推荐交互顺序：

1. 正常跑完 v5 的局内链路
2. 对局后点击“生成复盘摘要”
3. 面板显示 `highlights / risk_points / coach_note`
4. 用户再决定是否展开查看原始候选 JSON

---

## 9. 实现顺序

建议按这个顺序落：

1. 扩展 `contracts.py` 和 `session_state.py`
2. 先实现 `review/summarizer.py`，让 `review_candidates.json` 能变成可读摘要
3. 再补 `generate_review_summary` / `get_last_review_summary`
4. 再给 UI 加复盘摘要展示
5. 最后才引入 `decision/tile_efficiency.py`

这个顺序的好处是：

- 先把“局后可读”价值做出来
- 不会被牌级感知难度卡住整阶段
- 第六版前半程就能基于第五版现有数据产出用户可见收益

---

## 10. 验收方式

至少要验证：

1. 没有牌级信息时，插件仍能保持第五版行为
2. 提供结构化样本时，能生成一份轻量牌理建议
3. `review_candidates.json` 能生成一份可读摘要
4. 摘要能区分高光、风险点和后续练习建议
5. 复盘摘要生成失败时，错误是明确可解释的
6. 新状态字段、UI 展示和调试文件三者能对上

---

## 11. 本阶段完成后的意义

第六版完成后，插件会开始拥有两条真正的新能力：

- 局内：从“关键窗口提醒”进一步走向“轻量牌理解释”
- 局后：从“原始候选缓存”进一步走向“可读复盘摘要”

这会让产品形态更接近：

- 陪你看牌
- 陪你复盘
- 记得你最近哪里容易犹豫或贪心

而不只是“按钮出现时提醒你一下”。
