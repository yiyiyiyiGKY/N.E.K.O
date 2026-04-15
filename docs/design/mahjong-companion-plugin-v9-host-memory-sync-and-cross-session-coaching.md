# 雀魂陪伴插件第九版文档：宿主记忆同步与跨局训练陪伴

> 前置文档：
> - `docs/design/mahjong-companion-plugin-plan.md`
> - `docs/design/mahjong-companion-plugin-v6-tile-efficiency-and-review-summary.md`
> - `docs/design/mahjong-companion-plugin-v8-complete-mahjong-analysis-and-calibrated-perception.md`
>
> 本文对应第八版之后的下一阶段，解决两件事：
> - 把本地 `MemoryBridge` 队列推进到真正的宿主长期记忆同步
> - 把“单局复盘”推进到“跨局训练陪伴”
>
> 实施同步说明：
> - 截至当前仓库状态，第九阶段还没有落到代码里，这份文档是后续正式设计稿。
> - 当前仓库已经有 `review/memory_bridge.py`，但仍是本地暂存，原因是宿主 SDK 目前缺少插件侧记忆写入接口。
> - 因此第九阶段的关键，是在宿主能力到位后，把“摘要筛选 -> 写入长期记忆 -> 跨局引用”这条链路补齐。

---

## 1. 本阶段目标

第九版的目标是让插件开始具备“长期陪练”特征。

完成后，插件应该具备：

- 能把低频高价值摘要写入宿主长期记忆
- 能避免把麻将流水噪声塞进宿主记忆
- 能在新一局或闲聊中自然引用近期打法模式
- 能把单局复盘提升成跨局趋势观察
- 能区分“可聊的长期标签”和“仅本地保留的原始细节”

一句话理解：

- 第八版解决“更懂牌”
- 第九版解决“会记住你最近是怎么打牌的”

---

## 2. 本阶段范围

### 2.1 必做

- 宿主记忆写入接口适配
- `MemoryBridge` 正式同步器
- 跨局趋势聚合
- 训练标签和教练话题生成
- 记忆写入频控与质量过滤

### 2.2 先不做

- 把完整牌谱写进宿主记忆
- 所有复盘细节长期保存
- 无约束自动训练计划生成
- 与外部教练服务双向同步

结论：

- 第九版是“宿主记忆同步 + 跨局训练陪伴”
- 不是“麻将数据仓库”

---

## 3. 设计原则

### 3.1 只写摘要，不写流水

推荐上送宿主记忆的内容：

- 最近更偏进攻还是保守
- 常见犹豫点
- 高价值窗口反应模式
- 最近两三局最值得练的点

不应上送：

- 每一帧按钮
- 每一巡原始候选
- 全量调试 JSON

### 3.2 本地缓存和宿主记忆分层保存

继续区分：

- `review_candidates.json`
- `memory_bridge_queue.json`
- 宿主长期记忆

三层职责不同，不能混。

### 3.3 记忆写入必须可解释

每一条上送记忆都要能回答：

- 为什么写
- 写了什么
- 来自哪些局内证据
- 什么时候过期或降权

---

## 4. 推荐数据模型

### 4.1 建议新增 `CoachingMemory`

```json
{
  "memory_type": "mahjong_style_summary",
  "generated_at": "2026-04-20T10:00:00+00:00",
  "summary": "最近三局里，主人在高价值确认窗口的反应整体偏稳，但中盘鸣牌决策还有点犹豫。",
  "tags": [
    "mahjong_high_value_timing",
    "mahjong_route_choice"
  ],
  "evidence_count": 4,
  "confidence": 0.72
}
```

### 4.2 建议新增 `TrendSummary`

```json
{
  "window": "last_3_sessions",
  "style_bias": "slightly_aggressive",
  "common_hesitations": [
    "call_decision",
    "riichi_decision"
  ],
  "coach_focus": "先减少中盘路线摇摆"
}
```

---

## 5. 推荐模块变化

第九版建议增加：

```text
plugin/plugins/mahjong_companion/
├── review/
│   ├── memory_bridge.py
│   ├── host_memory_sync.py
│   ├── trend_aggregator.py
│   └── coaching_topics.py
```

建议职责：

- `host_memory_sync.py`
  - 与宿主记忆写入接口对接
- `trend_aggregator.py`
  - 从多局摘要中生成趋势
- `coaching_topics.py`
  - 生成可聊的训练焦点和教练话题

---

## 6. 外部参考资料与可复用资源

第九版的重点不再是“看清这一帧”，而是“怎么把多局信息组织成长期有价值的陪练记忆”。因此参考资源也应该从视觉和规则，逐步转向：

- 牌谱聚合
- 复盘输出结构
- 跨局趋势总结
- 宿主记忆边界

### 6.1 官方与社区资料

- 官方入门页：
  - `Mahjong Soul Start Guide`
  - https://mahjongsoul.com/startguide/
  - 适合参考：官方术语、模式分类、系统界面命名
- 社区百科：
  - `Mahjong Soul Wiki`
  - https://mahjongsoul.wiki.gg/wiki/Mahjong_Soul_Wiki
  - 适合参考：模式、活动、角色、系统词表与社区整理资料

这些资料对第九版的价值主要不是训练，而是：

- 统一长期记忆中的名词
- 统一 UI 展示和闲聊引用中的术语
- 避免记忆摘要里出现和玩家习惯不一致的表达

### 6.2 牌谱聚合与统计参考

- `Amae-Koromo`
  - https://github.com/SAPikachu/amae-koromo
  - 适合参考：牌谱聚合、跨局统计、趋势信息组织方式

对第九版来说，`Amae-Koromo` 的最大价值不是直接接入，而是帮助回答：

- 多局摘要应该按什么粒度聚合
- 哪些统计适合给玩家看
- 哪些趋势能自然转换成“训练焦点”

推荐借鉴的不是整站功能，而是它的数据组织思路：

- 局级
- 段位/模式级
- 趋势级

### 6.3 复盘与教练输出结构参考

- `mjai-reviewer`
  - https://github.com/Equim-chan/mjai-reviewer
  - 适合参考：局后点评、分析摘要、可读输出结构

第九版尤其值得参考它的地方在于：

- 怎么把原始事件变成可读建议
- 怎么把技术判断写成玩家能接受的话
- 怎么区分“事实”“风险”“建议”

这对第九版里的这些模块很有帮助：

- `trend_aggregator.py`
- `coaching_topics.py`
- 宿主闲聊引用内容

### 6.4 更强训练与 AI 项目参考

- `kanachan`
  - https://github.com/Cryolite/kanachan
  - 适合参考：基于雀魂牌谱的训练思路与数据表示
- `Mortal`
  - https://github.com/Equim-chan/Mortal
  - 适合参考：决策结构、复盘分析视角、强 AI 工程组织

这些项目对第九版更适合借鉴：

- 如何定义长期“打法特征”
- 如何从大量样本中提炼趋势
- 如何区分短期波动和稳定习惯

但不建议当前阶段直接做：

- 复制其训练流程
- 用其全部结论直接写入宿主长期记忆
- 把强 AI 判断不加筛选地转成陪伴话术

### 6.5 对本项目第九版最推荐的参考组合

如果只选最有价值的一组，建议优先顺序是：

1. `Amae-Koromo`
2. `mjai-reviewer`
3. `kanachan`
4. `Mortal`
5. 官方资料与社区 wiki 作为术语对齐层

对应到第九版实现：

- `host_memory_sync.py`
  - 重点参考：摘要筛选边界，而不是某个现成外部项目
- `trend_aggregator.py`
  - 重点参考：`Amae-Koromo`
- `coaching_topics.py`
  - 重点参考：`mjai-reviewer` + `kanachan`

### 6.6 使用这些资源时的边界提醒

- 第九版的长期记忆目标是“低频、高价值、可解释”，不是做麻将流水数据库。
- 任何外部项目里直接面向研究或高强度训练的数据表示，都不应原样写进宿主长期记忆。
- 第九版应坚持三层边界：
  - 原始事件留在本地
  - 摘要候选留在桥接队列
  - 只有训练价值高、玩家可理解的内容才写进宿主长期记忆

---

## 7. 插件入口建议

第九版建议新增：

- `sync_memory_bridge`
- `get_coaching_trend`
- `get_last_coaching_topics`

---

## 8. UI 建议

第九版面板建议新增：

- 最近同步到宿主记忆的摘要
- 最近三局趋势卡片
- 当前训练焦点
- 记忆同步状态与失败原因

---

## 9. 实现顺序

建议按这个顺序落：

1. 等宿主提供插件侧记忆写入接口
2. 实现 `host_memory_sync.py`
3. 实现 `trend_aggregator.py`
4. 实现 `coaching_topics.py`
5. 最后接 UI 和闲聊链路

---

## 10. 验收方式

至少要验证：

1. 只有高价值摘要才会上送宿主记忆
2. 重复摘要不会重复写入
3. 记忆同步失败时本地队列不会丢失
4. 新会话能引用最近训练趋势
5. 闲聊中提到的内容和真实摘要一致

---

## 11. 本阶段完成后的意义

第九版完成后，插件会开始更像“长期陪练猫娘”而不是“单局内插件”：

- 她知道你最近哪里容易犹豫
- 她会在合适的时候提起你前几局的习惯
- 她的复盘不再是一局一忘
