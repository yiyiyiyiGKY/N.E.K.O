# 雀魂陪伴插件第四版文档：最小决策层、讲解策略与陪伴输出

> 前置文档：
> - `docs/design/mahjong-companion-plugin-plan.md`
> - `docs/design/mahjong-companion-plugin-detailed-design.md`
> - `docs/design/mahjong-companion-plugin-v2-capture-and-window-binding.md`
> - `docs/design/mahjong-companion-plugin-v3-minimum-perception-loop.md`
>
> 本文对应第三版“最小感知闭环”之后的下一阶段，解决两件事：
> - 先把感知结果收敛成可复用的最小 `DecisionResult`
> - 再把决策结果转成可控、可节流、符合 N.E.K.O. 气质的讲解与陪伴输出
>
> 实施同步说明：
> - 当前仓库已经完成第四阶段第一版骨架落地，不再只是下一阶段设计稿。
> - 第三阶段已经能输出第一版 `PerceivedGameState`，第四阶段的前提条件已经满足。
> - 为了与总方案文档保持一致，第四阶段不再采用“感知结果直接生成播报”的简化路径，而是先补最小决策层，再进入讲解与播报层。
> - 第四阶段的目标不是先做更强识别，而是先把“怎么看待当前局面、什么时候说、说什么、说到什么程度”定义清楚。
> - 本阶段明确包含“猫娘语音说话”能力，但必须是受控发声，不是把麻将过程变成高频闲聊。
> - 当前已落地内容包括：`decision/` 与 `narration/` 子目录、`generate_decision` / `get_last_decision` / `generate_narration` / `get_last_narration` / `preview_companion_view` / `speak_last_narration` / `cycle_voice_mode` / `run_companion_pipeline` 入口、决策与讲解状态字段、第四版静态 UI 展示与主动播报入口。
> - 当前第四阶段还额外补了一条“调试态总链路”：允许从指定图片或最新截图直接跑到 `push_message()` 主动回话，用来优先验证“图片到猫娘回复”是否跑通。
> - 当前第四阶段后续又进一步把“最终消息投递”从编排层拆到 `narration/dispatcher.py`，让 `orchestrator.py` 更接近纯编排层。

---

## 1. 本阶段目标

第四版不追求手牌级完整算法或完整复盘，而是先解决“有了感知之后，怎样先得到可复用的决策语义，再把它变成用户真正能接受的陪伴式输出”。

完成后，插件应该具备：

- 能把 `PerceivedGameState` 转成第一版 `DecisionResult`
- 能把 `DecisionResult` 转成第一版讲解事件
- 能区分“只在 UI 显示”和“需要猫娘播报出来”
- 能做基础节流，避免刷屏
- 能根据风险等级决定提醒强度
- 能输出第一版陪伴态视图模型
- 能支持第一版猫娘语音播报
- 能为接入 `push_message()` / `finish(reply=True)` 留下清晰边界，并避免高频播报污染对话历史与记忆

一句话理解：

- 第三版解决“插件看懂一点”
- 第四版解决“插件先形成判断，再开始像 N.E.K.O. 一样陪你说话”

---

## 2. 本阶段范围

### 2.1 必做

- 定义第一版 `DecisionResult`
- 定义第一版最小 `DecisionAdapter`
- 定义第一版讲解事件模型
- 定义第一版 `SpeechPolicy`
- 定义第一版 `CompanionViewModel`
- 增加基础决策生成器
- 增加基础讲解生成器
- 增加输出通道分流策略
- 增加基础节流与冷却
- 增加第一版猫娘语音触发规则
- 增加讲解调试输出
- 增加一键总链路入口，降低宿主联调成本

### 2.2 先不做

- 完整牌效率推理与最优牌谱算法
- 多轮上下文讲牌链
- 大模型润色改写
- 长篇复盘摘要
- 语音情绪控制细化
- 把麻将全程提示做成自由聊天式陪伴
- 自动操作确认链

结论：

- 第四版是“第一版最小决策 + 讲解与陪伴输出可跑通”
- 不是“完整教学人格与高质量复盘系统”

当前实现补充：

- 这一版当前已经不只是“能生成讲解文本”，还已经可以通过 `run_companion_pipeline` 把讲解结果直接送进宿主主动消息通道。
- 调试态下会允许把原本 `silent_ui` 的讲解临时提升成 `proactive_notification`，目的是优先打通宿主集成，而不是改变正式运行时的默认播报策略。

---

## 3. 交付标准

这版完成后，至少要满足：

- 插件能根据 `PerceivedGameState` 生成结构化 `DecisionResult`
- 插件能根据 `DecisionResult` 生成结构化讲解事件
- 能输出 `silent_ui / proactive_notification / voice_candidate` 三类基础播报决策
- 能对高风险事件触发强提醒，对普通事件触发静默展示或低频播报
- 能在受控场景下触发一次真实猫娘语音播报
- 能从一张图片或最新截图一键跑完整链路，并得到猫娘主动回话
- UI 能展示第一版陪伴式摘要，而不是只展示底层感知字段
- 同一类普通提醒在冷却时间内不会重复刷屏
- 能保存一份讲解调试结果到 `data/session_cache/` 或 `data/debug_samples/`

---

## 4. 设计原则

### 4.1 先做决策语义，再做说话策略和文采

第四版最重要的不是句子写得多漂亮，而是：

- 当前局面应该被归类成什么决策语义
- 什么时候说
- 为什么说
- 说多重
- 走哪个通道

如果没有这层策略，后面再好的文案也会变成噪声。

### 4.2 默认少播报，但关键时刻必须说

第四版建议把输出分成三档：

- `silent_ui`
- `nudge`
- `warning`

对应理解：

- `silent_ui`：只更新插件面板，不主动打扰
- `nudge`：轻提示，可进文字通知，也可以只显示文字
- `warning`：高风险强提醒，需要允许猫娘语音发声，可以突破普通冷却

### 4.3 讲解应该是陪伴式，而不是播音式

第四版输出的目标不是“报牌器”，而是“陪伴式提示”。

同样是识别到风险，理想风格应更接近：

- “这张看起来有点危险，我们先稳一点。”

而不是：

- “危险牌，建议不要打。”

### 4.4 原始结果和面向用户结果必须分层

不要让 UI 直接展示底层规则判断。

至少分成三层：

- `DecisionResult`：业务层最小决策语义
- `NarrationEvent`：把决策结果翻译成讲解事件
- `CompanionViewModel`：给 UI 和宿主展示的陪伴态结果

这样后续不管接文字通知、语音还是 Avatar 表情，都有统一中间层。

### 4.5 要播报，但不能变成“常驻碎碎念”

第四版明确需要猫娘语音播报，但语音必须满足两个约束：

- 语音是“关键提醒”能力，不是每一帧都播报的旁白
- 麻将陪伴播报默认不进入长期记忆，不应污染主人格日常聊天记忆

因此本阶段建议的默认顺序是：

- 先生成 `DecisionResult`
- 再生成 `NarrationEvent`
- 再由 `SpeechPolicy` 判断是否只是 `silent_ui`
- 只有满足发声条件时才升级到 `voice_candidate`
- 真正触发猫娘播报时，必须经过冷却、去重、风险判断和显式开关

换句话说：

- 第四版要有猫娘播报
- 但不能把整个麻将过程塞进普通聊天上下文，变成高频闲聊

---

## 5. 推荐目录变化

从第四版开始，建议正式拆出 `decision/` 与 `narration/` 子目录：

```text
plugin/plugins/mahjong_companion/
├── contracts.py
├── orchestrator.py
├── perception/
├── decision/
│   ├── __init__.py
│   ├── adapter.py
│   ├── generator.py
│   └── debug_dump.py
├── narration/
│   ├── __init__.py
│   ├── dispatcher.py
│   ├── events.py
│   ├── speech_policy.py
│   ├── generator.py
│   ├── view_model.py
│   └── debug_dump.py
└── static/
```

拆分原因：

- 第三版已经有稳定的感知输入。
- 第四版开始会出现独立的“决策层”“解释层”和“输出层”。
- 如果继续把这些逻辑都放进 `orchestrator.py`，很快会和感知逻辑混成一团。

当前实际补充：

- 当前实现中，目录级拆分已经成立：
  - `decision/` 负责决策契约与生成
  - `narration/` 负责讲解事件、陪伴视图、播报策略与消息投递 adapter
- 当前第四版已经不只是“决策层和讲解层独立成目录”，而是连最终宿主投递也已经从编排层抽离。
- 当前仍保留在 `orchestrator.py` 的主要是会话编排、状态缓存和各层协调，而不是具体文案生成或消息发送细节。

---

## 6. 数据模型建议

### 6.1 `DecisionResult` 第一版建议字段

建议新增：

```json
{
  "decision_type": "danger_action",
  "priority": 90,
  "risk_level": "high",
  "action_required": true,
  "speakable": true,
  "summary": "当前存在高优先级操作候选",
  "detail": "检测到和牌或立直类高价值按钮，建议先确认局面再操作",
  "scene": "in_match",
  "buttons": ["ron", "skip"],
  "reason_codes": ["button.ron_visible", "turn.user_likely"]
}
```

字段含义：

- `decision_type`：最小决策语义
- `priority`：优先级
- `risk_level`：风险等级
- `action_required`：当前是否值得提醒用户关注
- `speakable`：是否具备主动播报价值
- `summary`：短摘要
- `detail`：详细说明
- `scene`：来源场景
- `buttons`：来源按钮候选
- `reason_codes`：可复用的规则原因码

这层存在的意义不是“替代完整麻将算法”，而是：

- 把感知结果整理成跨游戏更可复用的判断语义
- 避免讲解模板直接耦合底层 ROI、颜色阈值和按钮细节

### 6.2 `NarrationEvent` 第一版建议字段

建议新增：

```json
{
  "event_type": "danger_action",
  "channel": "warning",
  "delivery": "voice_candidate",
  "priority": 90,
  "summary": "当前有高风险操作候选",
  "detail": "当前存在高优先级操作机会，建议先确认局面再操作",
  "risk_level": "high",
  "scene": "in_match",
  "buttons": ["ron", "skip"]
}
```

字段含义：

- `event_type`：事件类型
- `channel`：建议输出通道
- `delivery`：具体投递方式
- `priority`：优先级
- `summary`：短摘要
- `detail`：详细说明
- `risk_level`：风险等级
- `scene`：来源场景
- `buttons`：来源按钮候选

### 6.3 `CompanionViewModel` 第一版建议字段

建议新增：

```json
{
  "headline": "有操作机会",
  "subline": "检测到 ron / skip",
  "mood": "alert",
  "suggestion_level": "warning",
  "speakable": true,
  "delivery": "voice_candidate",
  "text": "现在像是有可操作按钮，我提醒你看一眼。"
}
```

字段含义：

- `headline`：UI 主标题
- `subline`：UI 副标题
- `mood`：当前陪伴情绪
- `suggestion_level`：建议强度
- `speakable`：是否适合主动说
- `delivery`：当前建议的输出方式
- `text`：第一版生成话术

### 6.4 决策类型与讲解事件枚举

第四版第一版只建议支持这些：

- `scene_update`
- `action_available`
- `danger_action`
- `waiting_state`
- `uncertain_state`

不要在第四版就拆成几十种事件，否则调试成本会失控。

---

## 7. 决策与讲解生成建议

第四版建议按下面顺序处理：

1. 读取最近一次 `PerceivedGameState`
2. 先生成 `DecisionResult`
3. 再生成 `NarrationEvent`
4. 交给 `SpeechPolicy` 决定播报方式
5. 生成 `CompanionViewModel`
6. 写入状态和调试结果

### 7.1 基础决策映射

第一版建议先把感知结果映射成最小决策语义：

- `scene = unknown` 且无按钮：
  - `decision_type = uncertain_state`
- `scene = in_match` 且有按钮：
  - `decision_type = action_available`
- `scene = in_match` 且按钮里包含 `ron / tsumo / riichi`：
  - `decision_type = danger_action`
- `scene = replay`：
  - `decision_type = waiting_state`

第一版这里不要直接输出长文案，只先把“值得不值得提醒”“风险高不高”“适不适合说”确定下来。

### 7.2 第一版讲解事件映射

在有了 `DecisionResult` 之后，再做讲解事件映射：

- `decision_type = uncertain_state`：
  - `event_type = uncertain_state`
- `decision_type = action_available`：
  - `event_type = action_available`
- `decision_type = danger_action`：
  - `event_type = danger_action`
- `decision_type = waiting_state`：
  - `event_type = waiting_state`

### 7.3 第一版风险等级

建议只做三级：

- `low`
- `medium`
- `high`

示例：

- `unknown`：`low`
- `skip / confirm`：`medium`
- `ron / tsumo / riichi`：`high`

### 7.4 第一版文案策略

文案不求花哨，但要求：

- 不机械重复
- 不像命令行报错
- 不用强命令口吻

建议第一版先准备每类 `decision_type / event_type` 2-4 条模板，随机或轮换输出。

例如：

- `danger_action`
  - “这里像是有关键操作，我们先看清楚再点。”
  - “我这边看到高优先级按钮了，先别急。”
- `action_available`
  - “现在像是轮到你操作了。”
  - “底部有可选按钮，我帮你盯到了。”
- `uncertain_state`
  - “这一帧我还没看太清，再给我一张新的。”

---

## 8. `SpeechPolicy` 建议

### 8.1 第一版输出方式

第一版建议支持三种基础播报方式：

- `silent_ui`
- `proactive_notification`
- `voice_candidate`

理解方式：

- `silent_ui`：只更新插件 UI
- `proactive_notification`：往宿主主动消息通道投递一条提示文字
- `voice_candidate`：满足发声条件，进入猫娘语音播报候选

### 8.2 第一版策略规则

建议：

- 普通 `scene_update` 默认 `silent_ui`
- `action_available` 默认 `proactive_notification`
- `danger_action` 默认 `voice_candidate`
- `uncertain_state` 默认 `silent_ui`
- 用户显式打开“语音陪伴模式”后，`action_available` 可以在更严格冷却下升级为 `voice_candidate`

### 8.3 冷却策略

建议至少有：

- 普通提示冷却：`15-20s`
- 高风险提示冷却：`3-5s`
- 完全相同摘要的去重窗口：`5-10s`
- 语音播报单独冷却：`10-20s`

高风险事件允许突破普通冷却，但不应无限重复。

### 8.4 发声总开关与升级条件

第四版建议加入明确的语音控制位，例如：

- `voice_enabled`
- `voice_mode = off | key_events_only | companion`

建议默认值：

- `voice_enabled = true`
- `voice_mode = key_events_only`

解释：

- `off`：只保留 UI 与文字提醒
- `key_events_only`：只有 `danger_action` 和极少数关键 `action_available` 可以发声
- `companion`：允许更积极的陪伴语音，但仍要受冷却和去重限制

第一版升级到真实发声的条件至少应满足：

- 当前事件 `speakable = true`
- `voice_enabled = true`
- 未命中语音冷却
- 不是与最近一次相同摘要
- 当前窗口仍绑定成功，且会话处于 `running`

### 8.5 与当前项目播报实现和记忆边界的关系

第四版必须参考当前项目已有的文字和语音输出实现，但边界要非常明确：

- `silent_ui`：只在插件内部与插件页面展示，不进入普通聊天历史
- `proactive_notification`：可进入宿主主动消息通道，但只能低频使用
- `voice_candidate`：表示“允许触发猫娘语音播报”，不等于把麻将陪伴变成自由聊天

本阶段不建议做的事：

- 不把每次局面变化都送进普通聊天链路
- 不把逐帧讲解直接当成正常聊天历史
- 不主动写入长期记忆

本阶段建议做的事：

- 只对关键事件触发真实发声
- 普通提醒优先留在插件 UI
- 需要触发猫娘播报时，尽量走受控提示，不走连续闲聊

---

## 9. 状态与入口约定

### 9.1 建议新增入口

| 入口 | 作用 |
| --- | --- |
| `generate_decision` | 根据最近感知结果生成决策结果 |
| `get_last_decision` | 返回最近一次决策结果 |
| `generate_narration` | 根据最近决策结果生成讲解 |
| `get_last_narration` | 返回最近一次讲解结果 |
| `preview_companion_view` | 返回最近一次陪伴态视图模型 |
| `speak_last_narration` | 按策略触发最近一次讲解的猫娘语音播报 |

现阶段至少应先落地：

- `generate_decision`
- `generate_narration`
- `speak_last_narration`

### 9.2 `generate_decision` 建议返回

```json
{
  "ok": true,
  "decision_type": "danger_action",
  "risk_level": "high",
  "summary": "当前存在高优先级操作候选",
  "speakable": true
}
```

### 9.3 `generate_narration` 建议返回

```json
{
  "ok": true,
  "event_type": "danger_action",
  "channel": "warning",
  "delivery": "voice_candidate",
  "summary": "当前有高风险操作候选",
  "text": "这里像是有关键操作，我们先看清楚再点。"
}
```

### 9.4 `report_status()` 建议增强

宿主状态至少应补上：

```json
{
  "last_decision_type": "danger_action",
  "last_decision_risk_level": "high",
  "last_decision_at": "...",
  "last_narration_type": "danger_action",
  "last_narration_channel": "warning",
  "last_narration_delivery": "voice_candidate",
  "last_narration_at": "...",
  "last_companion_mood": "alert",
  "voice_mode": "key_events_only"
}
```

---

## 10. UI 第四版改动

### 10.1 新增展示项

- 当前决策类型
- 当前风险等级
- 当前讲解事件类型
- 当前建议强度
- 当前陪伴情绪
- 最近一句讲解文本
- 当前输出通道
- 当前语音模式
- 最近一次是否已发声

### 10.2 新增按钮

- `生成决策`
- `生成讲解`
- `刷新陪伴视图`
- `播报当前讲解`
- `切换语音模式`

### 10.3 UI 行为

用户最自然的操作顺序应该是：

1. 先完成绑定、抓图和感知分析
2. 点击“生成决策”
3. 再点击“生成讲解”
4. 查看陪伴式摘要和播报决策
5. 判断是否需要发声或只在 UI 展示
6. 在需要时点击“播报当前讲解”，验证猫娘语音输出

---

## 11. 实现顺序

严格建议按这个顺序落：

1. 先定义 `DecisionResult`
2. 再实现最小 `DecisionAdapter`
3. 再定义 `NarrationEvent`
4. 再定义 `CompanionViewModel`
5. 再实现 `SpeechPolicy`
6. 再实现基础讲解生成器
7. 再把结果挂进 `orchestrator.py`
8. 最后再改 UI

如果顺序打乱，最容易出现的问题是：

- 还没形成稳定决策语义，就先拼文案
- 还没定义冷却规则，就先接播报链路
- 最后会变成“会说，但说得很乱”

---

## 12. 验收方式

### 12.1 最小手工验收

至少要手工验证：

1. 绑定雀魂窗口
2. 抓取真实截图
3. 执行感知分析
4. 执行决策生成
5. 执行讲解生成
6. 触发一次真实猫娘语音播报
7. 确认 UI 能显示决策、陪伴态摘要、输出通道和语音状态

### 12.2 通过标准

- 能生成结构化 `DecisionResult`
- 能生成结构化讲解事件
- 能区分至少三类输出通道
- 普通提示不会连续刷屏
- 高风险提示能触发更强输出
- 关键事件能触发受控猫娘语音
- UI、返回结构、状态字段三者能对上

---

## 13. 本阶段完成后的意义

第四版完成后，插件就不再只是：

- 会抓图
- 会判断一点局面

而是进入：

- 会先形成最小判断
- 会开始“怎么陪你说”

这会直接为第五版铺路：

- 更强规则建议
- 更高质量决策解释
- 主动通知接入
- 复盘摘要与长期陪伴记忆

但第四版本身仍然保持边界：

- 要有猫娘语音
- 不做麻将过程的自由聊天化
- 不默认把陪伴播报沉淀为长期记忆

---

## 14. 下一版建议

第四版完成后，建议下一份文档进入：

- `docs/design/mahjong-companion-plugin-v5-enhanced-rules-and-review-bridge.md`

主题聚焦：

- 把更细的规则建议接入 `DecisionResult`
- 把更完整的 `DecisionResult` 接入讲解事件
- 把对局内关键节点沉淀成复盘素材
- 建立从即时陪伴到赛后复盘的桥
