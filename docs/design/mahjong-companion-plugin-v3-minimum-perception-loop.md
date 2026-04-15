# 雀魂陪伴插件第三版文档：最小感知闭环

> 前置文档：
> - `docs/design/mahjong-companion-plugin-plan.md`
> - `docs/design/mahjong-companion-plugin-detailed-design.md`
> - `docs/design/mahjong-companion-plugin-v2-capture-and-window-binding.md`
>
> 本文对应第二版“真实抓帧 + 窗口绑定”之后的下一阶段，只解决一件事：
> - 让插件从截图里产出第一版 `PerceivedGameState`
>
> 实施同步说明：
> - 当前仓库已经完成第三阶段第一版落地，不再只是设计草案。
> - 已落地内容包括：`perception/` 子目录、`analyze_debug_frame` / `analyze_frame_path` / `get_last_perception` 入口、感知状态字段、调试产物输出、静态 UI 感知展示。
> - 已在真实雀魂窗口上完成手工测试，成功走通“窗口绑定 -> 区域截图 -> 感知分析”链路，并输出 `in_match`、按钮候选和 `is_user_turn`。
> - 当前第三阶段应理解为“第一版最小闭环已经完成”，但规则阈值与识别精度仍处于样本校准阶段，尚未进入成熟版。

---

## 1. 本阶段目标

第三版不追求完整麻将识别、牌效率算法或讲解人格化输出，只追求把“看见图”推进到“看懂最基础的局面状态”。

完成后，插件应该具备：

- 能从最近一次截图中判断当前大场景
- 能识别若干高价值按钮或操作候选
- 能给出“是否大概率轮到用户操作”的判断
- 能把感知结果写入 `SessionState` 和调试输出
- 能在插件 UI 中展示第一版感知结果

一句话理解：

- 第二版解决“插件能抓到图”
- 第三版解决“插件能从图里提炼最基础状态”

---

## 2. 本阶段范围

### 2.1 必做

- 定义第一版 `PerceivedGameState` 最小字段
- 增加最小感知管线
- 增加基础场景分类
- 增加基础按钮区识别
- 增加“是否轮到用户操作”的粗粒度判断
- 增加感知结果调试输出
- 增加 `analyze_debug_frame` 入口

### 2.2 先不做

- 逐张手牌识别
- 向听数、牌效率、打点算法
- OCR 全量覆盖
- 复杂模板系统
- 模型推理服务
- 讲解文案生成
- 自动点击决策

结论：

- 第三版是“最小感知闭环可跑通”
- 不是“雀魂局面识别完整可用”

当前状态补充：

- 就文档目标而言，第三阶段第一版已经完成。
- 就产品成熟度而言，第三阶段还没有完成“高准确率、广覆盖”的精调版本。

---

## 3. 交付标准

这版完成后，至少要满足：

- 插件能对一张真实截图返回结构化 `PerceivedGameState`
- 至少能区分 `unknown / menu / lobby / in_match / replay / result`
- 至少能返回一组基础操作候选，例如 `chi / pon / kan / riichi / ron / tsumo / skip / confirm`
- 能返回 `is_user_turn` 的初版判断
- 能保存一份感知调试结果到 `data/debug_samples/` 或 `data/session_cache/`
- UI 能直观看到感知结果，而不是只看到原始截图路径

当前落地情况：

- 上述链路已经全部打通。
- 当前仓库已经能在真实雀魂窗口上：
  - 成功绑定窗口标题和区域
  - 成功保存窗口区域截图
  - 成功输出 `PerceivedGameState`
  - 成功把感知结果写回状态与调试文件
- 当前仍需继续优化的是真实样本下的规则稳定性，而不是基础链路缺失。

---

## 4. 设计原则

### 4.1 先做可解释，再做高精度

第三版优先做规则型、可调试、可回放的感知链路。

优先接受：

- 基于 ROI 的颜色 / 亮度 / 相似度判断
- 少量模板匹配
- 少量关键字 OCR

暂不优先：

- 大而全的端到端模型
- 一开始就覆盖所有 UI 皮肤和分辨率

### 4.2 先做场景级判断，再做牌级判断

第三版的重点不是“这张牌是什么”，而是先回答下面这些更基础的问题：

- 当前是不是在对局中
- 当前是不是回放
- 当前有没有可点击按钮
- 当前是不是轮到用户

这些问题先答出来，后面第四版讲解和第五版复盘才有稳定入口。

### 4.3 感知结果必须带置信度和证据

不要只返回一个字符串场景名。

至少要同时输出：

- `scene`
- `confidence`
- `buttons`
- `notes`

如果判断来自某个 ROI、模板或 OCR，也应在 `notes` 里留下简短证据，方便调试。

### 4.4 每一步都要可调试

第三版必须允许开发者回答这些问题：

- 这张图最后被判成什么场景
- 哪些按钮被命中
- 哪个 ROI 命中了什么特征
- 为什么判断成“轮到用户”或“不轮到用户”

否则后续只会变成黑盒猜测。

---

## 5. 推荐目录变化

从第三版开始，建议正式拆出 `perception/` 子目录：

```text
plugin/plugins/mahjong_companion/
├── __init__.py
├── contracts.py
├── orchestrator.py
├── session_state.py
├── window_binding.py
├── perception/
│   ├── __init__.py
│   ├── pipeline.py
│   ├── roi.py
│   ├── scene_classifier.py
│   ├── action_detector.py
│   └── debug_dump.py
└── data/
    ├── debug_samples/
    └── session_cache/
```

拆分原因：

- 第二版已经把“抓图”稳定下来。
- 第三版开始会出现真正独立的输入输出契约。
- 继续把感知逻辑塞在 `orchestrator.py` 里，会很快失控。

当前已落地：

- 当前仓库已实际建立 `plugin/plugins/mahjong_companion/perception/`
- 当前第三阶段前置依赖也已经稳定独立出来：
  - `capture/provider.py`
  - `gates/frame_change.py`
- 已有文件包括：
  - `pipeline.py`
  - `roi.py`
  - `scene_classifier.py`
  - `action_detector.py`
  - `debug_dump.py`

---

## 6. 数据模型增强

### 6.1 `PerceivedGameState` 第一版建议字段

建议把 `contracts.py` 里的 `PerceivedGameState` 扩成下面这种最小结构：

```json
{
  "scene": "in_match",
  "confidence": 0.82,
  "is_user_turn": true,
  "buttons": ["riichi", "skip"],
  "notes": [
    "bottom action bar detected",
    "riichi button matched by template"
  ],
  "roi_hits": {
    "bottom_action_bar": true,
    "center_dialog": false
  }
}
```

字段含义：

- `scene`：当前场景枚举
- `confidence`：主判断置信度
- `is_user_turn`：是否大概率轮到用户
- `buttons`：当前可见的高价值按钮语义
- `notes`：调试说明
- `roi_hits`：可选的 ROI 命中摘要

### 6.2 `SessionState` 建议新增字段

建议增加：

```json
{
  "last_scene": "unknown",
  "last_scene_confidence": 0.0,
  "last_buttons": [],
  "last_perception_at": "",
  "last_perception_ok": false
}
```

含义：

- `last_scene`：最近一次感知场景
- `last_scene_confidence`：最近一次场景判断置信度
- `last_buttons`：最近一次按钮候选
- `last_perception_at`：最近一次感知时间
- `last_perception_ok`：最近一次感知是否成功

### 6.3 场景枚举

第三版只建议支持这些：

- `unknown`
- `menu`
- `lobby`
- `matching`
- `in_match`
- `replay`
- `result`
- `dialog`

不要在第三版就拆太细，例如：

- `east_1_3_draw_phase`
- `riichi_confirm_dialog_with_dora_preview`

这种粒度太早，会让规则变脆。

---

## 7. 感知管线建议

第三版建议按下面顺序处理：

1. 读取最近一张截图
2. 做基础预处理
3. 提取固定 ROI
4. 做场景分类
5. 做按钮检测
6. 做 `is_user_turn` 判断
7. 组装 `PerceivedGameState`
8. 写入状态和调试结果

当前已落地：

- 上述 8 步已经在当前实现中具备基本闭环。
- 当前仍未实现的是更高精度的牌级判断，不属于第三阶段第一版阻塞项。

### 7.1 输入来源

优先支持两种输入：

- `capture_debug_frame` 刚生成的真实截图
- 手动指定路径的调试截图

这样便于：

- 线上跑实时链路
- 线下反复调试同一张样本

### 7.2 基础预处理

第三版只建议做非常轻的预处理：

- 统一转成 RGB
- 必要时缩放到标准宽度
- 裁掉明显无关黑边
- 提供灰度副本给简单模板 / OCR 使用

不要在第三版就引入重预处理流水线。

### 7.3 ROI 策略

第三版建议先固定几块 ROI：

- `top_banner`
- `center_dialog`
- `bottom_action_bar`
- `bottom_hand_area`
- `right_replay_panel`

原因：

- 雀魂主要交互按钮相对稳定
- 场景判断大多不需要看整张图每个像素
- 固定 ROI 更便于调试和写阈值

### 7.4 场景分类优先级

建议优先按这个顺序判断：

1. 是否命中结算页特征
2. 是否命中回放控制区
3. 是否命中对局操作条
4. 是否命中大厅 / 菜单特征
5. 都不明显则回退到 `unknown`

理由：

- `result`、`replay`、`in_match` 的视觉特征通常最稳定
- `menu` 和 `lobby` 容易彼此混淆，适合放后面

### 7.5 按钮检测

第三版按钮检测不要追求全量。

先只做一组高价值按钮：

- `chi`
- `pon`
- `kan`
- `riichi`
- `ron`
- `tsumo`
- `skip`
- `confirm`
- `cancel`

实现可选策略：

- 颜色 + 形状粗匹配
- 小模板图匹配
- 局部 OCR 关键字

只要三者里有一种足够稳定，就先用那一种。

### 7.6 `is_user_turn` 判断

第三版不要求绝对准确，但要求有统一规则。

建议规则：

- 如果底部动作条中命中了可操作按钮，则优先判定 `true`
- 如果只有回放控制条、菜单按钮而无对局操作按钮，则倾向判定 `false`
- 如果命中了中心确认弹窗，且弹窗语义属于当前玩家确认，也可判定 `true`
- 如果证据不足，则返回 `false` 并在 `notes` 里说明“insufficient evidence”

---

## 8. 调试与产物约定

### 8.1 调试文件

第三版建议新增这些调试产物：

```text
data/debug_samples/
├── 20260415-120001-frame.png
├── 20260415-120001-perception.json
└── 20260415-120001-overlay.json
```

说明：

- `frame.png`：原始截图
- `perception.json`：本次感知结果
- `overlay.json`：ROI 和命中摘要

第三版先不强制生成真正的可视化图片覆盖层，先保存结构化调试文件即可。

当前已落地：

- 当前实现已经会生成：
  - `*-frame.png`
  - `*-perception.json`
  - `*-overlay.json`
- 这三类文件已经在真实雀魂测试中实际产出。

### 8.2 错误处理

如果感知失败，不要把异常吞掉。

建议返回：

```json
{
  "ok": false,
  "error": "scene classification failed"
}
```

同时：

- 更新 `last_error`
- 更新 `last_perception_ok = false`
- 保留原始截图路径

---

## 9. 入口与状态约定

### 9.1 建议新增入口

| 入口 | 作用 |
| --- | --- |
| `analyze_debug_frame` | 对最近截图执行一次感知分析 |
| `analyze_frame_path` | 对指定截图路径执行感知分析 |
| `get_last_perception` | 返回最近一次感知结果 |

现阶段至少应先落地：

- `analyze_debug_frame`

当前已落地：

- `analyze_debug_frame`
- `analyze_frame_path`
- `get_last_perception`

### 9.2 `analyze_debug_frame` 建议返回

```json
{
  "ok": true,
  "scene": "in_match",
  "confidence": 0.82,
  "is_user_turn": true,
  "buttons": ["riichi", "skip"],
  "notes": ["bottom action bar detected"]
}
```

### 9.3 `report_status()` 建议增强

宿主侧状态至少应补上：

```json
{
  "status": "scanning",
  "last_scene": "in_match",
  "last_scene_confidence": 0.82,
  "last_perception_ok": true,
  "last_buttons": ["riichi", "skip"]
}
```

当前已落地：

- `last_scene`
- `last_scene_confidence`
- `last_is_user_turn`
- `last_buttons`
- `last_perception_at`
- `last_perception_ok`
- `last_perception`

---

## 10. UI 第三版改动

### 10.1 新增展示项

- 当前识别场景
- 场景置信度
- 是否轮到用户
- 按钮候选列表
- 最近一次感知时间
- 最近一次感知是否成功

### 10.2 新增按钮

- `分析最近截图`
- `刷新感知状态`

### 10.3 UI 行为

用户最自然的操作顺序应该是：

1. 打开插件页面
2. 先绑定窗口并抓取截图
3. 点击“分析最近截图”
4. 查看场景、按钮和是否轮到用户
5. 如果结果不对，回看截图路径和感知说明

当前已落地：

- 静态 UI 已支持：
  - 绑定窗口
  - 抓取调试帧
  - 分析最近截图
  - 查看场景、按钮候选、是否轮到用户、最近错误

---

## 11. 实现顺序

严格建议按这个顺序落：

1. 先扩展 `contracts.py` 的 `PerceivedGameState`
2. 再扩展 `session_state.py`
3. 再新建 `perception/` 子目录
4. 再实现 `scene_classifier`
5. 再实现 `action_detector`
6. 再在 `orchestrator.py` 接入 `analyze_debug_frame`
7. 最后再改 UI

如果顺序打乱，最容易出现的问题是：

- 还没有固定数据结构，就开始堆识别规则
- 还没有离线调试入口，就开始耦合实时循环
- 结果看起来识别逻辑很多，但没有一条稳定闭环

---

## 12. 验收方式

### 12.1 最小手工验收

至少要手工验证：

1. 启动插件
2. 打开 `/plugin/mahjong_companion/ui/`
3. 绑定窗口并抓取一张真实截图
4. 点击“分析最近截图”
5. 确认页面能显示 `scene / buttons / is_user_turn`
6. 确认 `data/debug_samples/` 下生成感知调试文件

### 12.2 通过标准

- 至少能稳定识别出 3 类以上基础场景
- 至少能识别出一组基础操作按钮
- 感知失败时错误是明确的
- 感知结果会写回状态和缓存
- 文档、UI、返回结构三者能对上

### 12.3 当前验收结论

截至当前仓库状态，可以给出以下结论：

- 第三阶段第一版通过。
- “通过”的含义是：
  - 最小感知闭环已经在真实雀魂窗口上跑通
  - 第二阶段与第三阶段的代码、UI、调试产物能够互相对上
  - 插件已经能从真实截图里输出第一版结构化感知结果
- “尚未完全完成”的部分是：
  - 更高准确率的真实样本校准
  - 更多场景与按钮语义覆盖
  - 进入第四阶段之前所需的规则精调

---

## 13. 本阶段完成后的意义

第三版完成后，插件就不再只是：

- 能抓图

而是进入：

- 能从图里提炼第一版结构化局面

这会直接为第四版铺路：

- 讲解策略
- 陪伴表达
- 风险提醒
- 主动消息输出

---

## 14. 下一版建议

第三版完成后，建议下一份文档直接进入：

- `docs/design/mahjong-companion-plugin-v4-narration-and-companion-output.md`

主题聚焦：

- 哪些信息该说
- 哪些信息只显示不说
- 什么时候打断冷却强提醒
- 如何把结果转成 N.E.K.O. 口吻
