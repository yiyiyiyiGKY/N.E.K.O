# 雀魂陪伴插件第五版文档：增强规则建议与复盘桥接

> 前置文档：
> - `docs/design/mahjong-companion-plugin-plan.md`
> - `docs/design/mahjong-companion-plugin-v3-minimum-perception-loop.md`
> - `docs/design/mahjong-companion-plugin-v4-narration-and-companion-output.md`
>
> 本文对应第四版“最小决策层、讲解策略与陪伴输出”之后的下一阶段，解决两件事：
> - 把第四版的最小规则判断升级成更像真正陪打的“增强规则建议”
> - 为赛后复盘增加第一版“关键节点沉淀桥”，让局内提示和赛后回看能接起来
>
> 实施同步说明：
> - 当前仓库已经落地第五阶段第一版起点，不再只是下一步设想。
> - 当前已落地内容包括：`DecisionResult` 的 `suggestion / recommended_focus / review_tags` 字段、`rule_based_v2` 决策规则、和牌/立直/杠/吃碰/确认弹窗等更细的规则焦点、`review/bridge.py`、`review/memory_bridge.py`、常驻的 `data/session_cache/review_candidates.json`，以及在满足条件时按需生成的 `data/session_cache/memory_bridge_queue.json`。
> - 当前第五阶段仍处于“规则桥接版”，还没有进入牌效率、向听、打点和完整复盘摘要阶段。

---

## 1. 本阶段目标

第五版不追求完整麻将算法，而是先把第四版“只会看按钮和说话”的能力，推进到“能给出更像陪打的建议重点，并为复盘留材料”。

完成后，插件应该具备：

- 能把高价值操作窗口拆成更细的规则焦点
- 能区分和牌窗口、立直决策点、杠牌决策点、吃碰决策点、确认弹窗
- 能输出比第四版更有操作感的 `suggestion`
- 能把关键节点沉淀到可复用的复盘候选缓存
- 能保持和第四版讲解 / 播报链路兼容，而不是推倒重来

一句话理解：

- 第四版解决“插件会形成最小判断并陪你说话”
- 第五版解决“插件会更像一个知道什么时候该提醒什么的陪打助手，并开始记下值得复盘的节点”

---

## 2. 本阶段范围

### 2.1 必做

- 扩展 `DecisionResult`，增加规则建议字段
- 把高价值按钮拆成更细的规则焦点
- 增加低置信度降级保护，减少误报开口
- 增加第一版复盘桥接模块
- 把关键节点写入 `review_candidates.json`
- 保持第四版 UI、讲解与播报入口兼容

### 2.2 先不做

- 向听数计算
- 牌效率排序
- 打点计算
- 危险牌真实估计
- 赛后长篇复盘摘要
- 基于完整局谱的节点串联

结论：

- 第五版是“增强规则建议 + 复盘桥接起点”
- 不是“完整麻将 AI 教练”

---

## 3. 当前落地内容

当前仓库已经具备：

- `DecisionResult.suggestion`
- `DecisionResult.recommended_focus`
- `DecisionResult.review_tags`
- `rule_based_v2` 决策引擎元信息
- 更细的按钮族拆分：
  - `ron / tsumo` -> `win_confirmation`
  - `riichi` -> `riichi_decision`
  - `kan` -> `kan_decision`
  - `chi / pon / kan` -> `call_decision`
  - `confirm / cancel / skip` -> `dialog_confirmation` / `confirm_or_skip`
- 低置信度保护：非和牌类事件在低置信度下会降级 `speakable`
- `review/bridge.py`
- `review/memory_bridge.py`
- `data/session_cache/review_candidates.json`
- `data/session_cache/memory_bridge_queue.json`（按条件生成）
- `SessionState.last_memory_bridge_at / status / summary`

当前已经不只是“把按钮翻译成一条讲解”，而是开始做：

- 这是什么类型的决策点
- 用户此刻该看什么
- 这件事值不值得以后复盘
- 这类高价值节点是否值得提炼成跨局摘要

---

## 4. 设计原则

### 4.1 不跳过“规则焦点”层，直接上完整算法

第五版先解决的是“提醒重点”，不是“最优牌计算”。

优先回答：

- 这是和牌窗口吗
- 这是立直窗口吗
- 这是杠牌决策吗
- 这是吃碰路线选择吗
- 这是确认弹窗吗

这些问题一旦被结构化，后续接更强算法会自然很多。

### 4.2 先沉淀“复盘候选”，再做长篇复盘

第五版不急着生成完整复盘稿，而是先把高价值节点保存下来。

这样后面做复盘时就有：

- 哪一帧值得回看
- 当时按钮是什么
- 当时系统建议关注什么
- 这属于哪一类节点

### 4.3 规则增强不能破坏第四版通道协议

第五版应该继续兼容第四版：

- `DecisionResult`
- `NarrationEvent`
- `CompanionViewModel`
- `SpeechPolicy`

也就是说：

- 可以把建议语义做得更细
- 但不要让第四版 UI 和播报入口失效

### 4.4 低置信度时先收声，再提醒

第五版比第四版更容易出现“看起来很像高价值按钮”的误判。

所以规则增强必须搭配：

- 低置信度降级
- 非和牌事件减少主动发声
- 更保守的 `speakable` 策略

---

## 5. 数据模型建议

### 5.1 `DecisionResult` 第五版增强字段

建议在第四版基础上新增：

```json
{
  "decision_type": "danger_action",
  "summary": "当前像是出现了和牌窗口。",
  "detail": "检测到 ron 或 tsumo 一类高价值按钮，这通常值得立刻确认。",
  "suggestion": "先确认和牌条件与按钮语义，优先别错过这一手。",
  "recommended_focus": "win_confirmation",
  "review_tags": ["win_window", "high_value_timing"]
}
```

字段含义：

- `suggestion`：更面向“现在该看什么”的建议句
- `recommended_focus`：规则焦点
- `review_tags`：赛后复盘时可复用的标签

### 5.2 `review_candidate` 第一版建议结构

建议写入：

```json
{
  "captured_at": "...",
  "frame_path": ".../20260415-xxxx-frame.png",
  "scene": "in_match",
  "decision_type": "danger_action",
  "priority": 96,
  "risk_level": "high",
  "summary": "当前像是出现了和牌窗口。",
  "suggestion": "先确认和牌条件与按钮语义，优先别错过这一手。",
  "recommended_focus": "win_confirmation",
  "buttons": ["ron", "skip"],
  "reason_codes": ["button.ron_visible", "turn.user_likely"],
  "review_tags": ["win_window", "high_value_timing"],
  "perception_confidence": 0.82,
  "perception_notes": ["bottom action bar detected"],
  "dedupe_key": "danger_action|in_match|ron|win_window"
}
```

这层的目标不是“直接生成复盘文案”，而是：

- 为后续复盘生成器提供原材料
- 为调试规则提供历史样本

---

## 6. 规则增强建议

第五版第一版建议至少支持这些焦点：

- `win_confirmation`
- `riichi_decision`
- `kan_decision`
- `call_decision`
- `dialog_confirmation`
- `confirm_or_skip`
- `turn_observe`
- `replay_observe`

### 6.1 按钮与焦点映射

- `ron / tsumo`
  - `decision_type = danger_action`
  - `recommended_focus = win_confirmation`
- `riichi`
  - `decision_type = danger_action`
  - `recommended_focus = riichi_decision`
- `kan`
  - `decision_type = danger_action`
  - `recommended_focus = kan_decision`
- `chi / pon`
  - `decision_type = action_available`
  - `recommended_focus = call_decision`
- `confirm / cancel`
  - `decision_type = action_available`
  - `recommended_focus = dialog_confirmation`
- 只剩 `skip / confirm`
  - `decision_type = action_available`
  - `recommended_focus = confirm_or_skip`

### 6.2 低置信度保护

建议：

- `confidence < 0.45` 时增加 `perception.low_confidence`
- 非和牌类事件默认降级 `speakable = false`
- `detail` 中明确提示“最好再看一眼确认”

这样可以降低“讲得很像真相，但其实只是误判”的风险。

---

## 7. 复盘桥接建议

### 7.1 写入时机

建议只在这些情况下写入 `review_candidates.json`：

- `priority >= 60`
- 或者显式带有 `review_tags`

不要把所有平淡帧都写进去。

### 7.2 去重策略

建议用 `dedupe_key` 去重，避免连续多帧把同一个窗口重复写入。

### 7.3 第一版缓存位置

建议继续放在：

- `plugin/plugins/mahjong_companion/data/session_cache/review_candidates.json`
- `plugin/plugins/mahjong_companion/data/session_cache/memory_bridge_queue.json`（达到桥接条件后生成）

这样既方便插件内读写，也方便手工调试和离线分析。

---

## 8. 与第四版链路的关系

第五版不需要替换第四版，只需要在它前面和后面各加一层：

1. 感知层输出 `PerceivedGameState`
2. 第五版规则层生成更细的 `DecisionResult`
3. 第四版讲解层继续把 `DecisionResult` 翻译成 `NarrationEvent`
4. 第四版 `SpeechPolicy` 决定是否播报
5. 第五版复盘桥把高价值节点沉淀下来

一句话：

- 第五版是增强第四版，不是推翻第四版

---

## 9. UI 建议

第五版第一版不强制大改 UI，但建议至少逐步补这些展示项：

- 当前 `recommended_focus`
- 当前 `suggestion`
- 当前 `review_tags`
- 最近一次复盘候选写入时间

第一版可以先不做独立“复盘候选列表页”，只要状态和 JSON 文件可见即可。

---

## 10. 实现顺序

建议按这个顺序落：

1. 扩展 `DecisionResult`
2. 升级 `decision/generator.py`
3. 给讲解层接入 `suggestion`
4. 增加 `review/bridge.py`
5. 在 orchestrator 中写入复盘候选
6. 最后再补测试与文档

---

## 11. 验收方式

至少要验证：

1. `ron / tsumo` 能被判成和牌窗口
2. `riichi` 能被判成立直决策点
3. `chi / pon / kan` 能给出更细建议
4. `dialog + confirm/cancel` 不再被当成普通等待态
5. 低置信度动作不会乱升级发声
6. 高价值节点会写入 `review_candidates.json`
7. 重复节点不会无限追加

---

## 12. 本阶段完成后的意义

第五版完成后，插件开始拥有两种新的产品价值：

- 局内：提醒不再只是“有按钮”，而是“你现在该重点看什么”
- 局后：关键节点不会随帧丢失，而是开始沉淀成可复盘材料

这会直接为后续阶段铺路：

- 更细的牌效率建议
- 更像教学助手的解释链
- 赛后复盘摘要
- 从即时陪打到长期训练的桥接

---

## 13. 下一版建议

第五版完成后，建议下一份文档进入：

- `docs/design/mahjong-companion-plugin-v6-tile-efficiency-and-review-summary.md`

主题聚焦：

- 引入更细的规则建议
- 连接牌效率与危险度判断
- 把 `review_candidates.json` 组织成可读复盘摘要
