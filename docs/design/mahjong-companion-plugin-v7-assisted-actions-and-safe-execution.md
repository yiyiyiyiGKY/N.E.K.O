# 雀魂陪伴插件第七版文档：有限辅助操作与安全执行闭环

> 前置文档：
> - `docs/design/mahjong-companion-plugin-plan.md`
> - `docs/design/mahjong-companion-plugin-v4-narration-and-companion-output.md`
> - `docs/design/mahjong-companion-plugin-v6-tile-efficiency-and-review-summary.md`
>
> 本文对应第六版“轻量牌理建议与赛后复盘摘要”之后的下一阶段，解决两件事：
> - 把“会提醒”推进到“在允许场景下能安全执行有限辅助操作”
> - 把现有 `HumanOverrideGuard` 从独立安全层推进到真正参与输入执行闭环
>
> 实施同步说明：
> - 截至当前仓库状态，第七阶段基础闭环已经落到代码里。
> - 当前仓库已具备：`action/input_adapter.py`、`action/action_registry.py`、`action/action_log.py`、`HumanOverrideGuard` 接入执行窗口、`list_assist_actions / execute_assist_action / get_action_log / clear_action_log` 入口，以及动作状态字段与审计日志。
> - 当前仓库仍然保持保守边界：动作默认关闭，`assist` 模式只允许白名单场景和有限动作；屏幕点击仍基于窗口相对锚点，而不是稳定的按钮级定位。
> - 因此第七阶段现在可以视为“有限辅助操作与安全执行闭环第一版已落地”，后续增强重点不再是入口和日志，而是更可靠的按钮定位与动作 UI。

---

## 1. 本阶段目标

第七版的目标不是做全自动代打，而是把插件推进到“有限辅助操作可用且可控”。

完成后，插件应该具备：

- 能在 `menu / replay / custom_room` 等白名单场景执行有限辅助操作
- 能把执行层和讲解层分离，避免“会说话”和“会点按钮”耦合
- 能在执行窗口内接入 `HumanOverrideGuard`
- 能留下清晰的操作日志和状态字段
- 能在用户未授权、场景不合法或窗口异常时稳定拒绝执行

一句话理解：

- 第六版解决“更会讲”
- 第七版解决“在用户允许时，能安全地帮一点点忙”

---

## 2. 本阶段范围

### 2.1 必做

- 增加输入执行 adapter
- 增加辅助动作契约和动作白名单
- 接入 `HumanOverrideGuard`
- 增加操作确认与操作日志
- 增加辅助执行状态字段和插件入口

### 2.2 先不做

- 正式对局全自动代打
- 长时间连续操作脚本
- 绕过游戏机制的自动化
- 多窗口并发自动控制
- 隐藏、伪装或反检测输入策略

结论：

- 第七版是“有限辅助操作与安全执行闭环”
- 不是“自动雀魂助手”

---

## 3. 当前代码作为第七版前置基线

第七版直接建立在这些已落地能力之上：

- `window_binding.py` 已能提供活动窗口绑定信息
- `capture/provider.py` 已能拿到当前帧并校验上下文
- `orchestrator.py` 已有可持续运行的主循环与状态上报
- `action/human_override_guard.py` 已经独立成可复用安全层
- `narration/dispatcher.py` 已能把“插件主动说话”独立于编排层

第七版真正要补的是：

- 真正的动作执行层
- 安全确认和日志层

---

## 4. 设计原则

### 4.1 执行层必须独立于讲解层

讲解可以提示“建议点哪里”，但执行层必须独立判断：

- 当前是否授权
- 当前场景是否允许
- 当前窗口是否还匹配
- 当前动作是否在白名单

不要让 `NarrationEvent` 直接驱动点击。

### 4.2 默认关闭，先做 `assist`

动作能力分级仍保持：

- `off`
- `assist`
- `semi_auto`

第七版只真正落 `assist`：

- 菜单导航
- 回放控制
- 确认弹窗
- 用户刚刚确认过的受限操作

### 4.3 `HumanOverrideGuard` 必须放在执行窗口前后

推荐执行顺序：

1. 校验动作和场景
2. `HumanOverrideGuard.arm()`
3. 执行平滑移动或点击
4. 在关键节点轮询 `evaluate()`
5. 一旦用户物理输入触发中断，立刻停止动作并写日志

### 4.4 所有动作都必须可审计

每次动作至少记录：

- 动作类型
- 触发来源
- 允许原因
- 执行结果
- 是否被 `HumanOverrideGuard` 中断

---

## 5. 推荐数据模型

### 5.1 建议新增 `AssistAction`

```json
{
  "action_id": "replay_next",
  "category": "replay_control",
  "label": "下一手",
  "allowed_contexts": ["replay"],
  "requires_confirmation": true,
  "requires_running_session": false
}
```

### 5.2 建议新增 `ActionExecutionResult`

```json
{
  "ok": true,
  "action_id": "replay_next",
  "executed_at": "2026-04-15T10:00:00+00:00",
  "blocked_reason": "",
  "guard_aborted": false,
  "window_title": "Mahjong Soul",
  "log_path": ".../session_cache/action_log.json"
}
```

### 5.3 `SessionState` 建议扩展字段

```json
{
  "last_action_id": "",
  "last_action_at": "",
  "last_action_ok": false,
  "last_action_blocked_reason": "",
  "last_action_guard_aborted": false
}
```

---

## 6. 推荐模块变化

第七版建议最少增加：

```text
plugin/plugins/mahjong_companion/
├── action/
│   ├── __init__.py
│   ├── human_override_guard.py
│   ├── input_adapter.py
│   ├── action_registry.py
│   └── action_log.py
```

建议职责：

- `input_adapter.py`
  - 平滑移动、点击、快捷动作执行
- `action_registry.py`
  - 定义允许动作、场景白名单、确认策略
- `action_log.py`
  - 记录和查询辅助操作日志

---

## 7. 插件入口建议

第七版建议新增：

- `list_assist_actions`
- `execute_assist_action`
- `get_action_log`
- `clear_action_log`

其中：

- `execute_assist_action`
  - 必须支持 `dry_run`
  - 必须返回阻塞原因

---

## 8. UI 建议

第七版面板建议新增四块：

- 辅助操作总开关
- 场景白名单说明
- 最近一次动作执行状态
- 动作日志列表

推荐交互顺序：

1. 用户先开启 `assist`
2. 面板展示风险提示
3. 用户点击“执行回放下一手”一类动作
4. 面板显示动作结果与是否被用户抢鼠标中断

---

## 9. 实现顺序

建议按这个顺序落：

1. 增加 `action_registry.py`
2. 增加 `input_adapter.py`
3. 把 `HumanOverrideGuard` 接进执行窗口
4. 增加 `action_log.py`
5. 最后补 UI 和入口

---

## 10. 验收方式

至少要验证：

1. 未授权时动作会被拒绝
2. 非白名单场景时动作会被拒绝
3. `dry_run` 能给出明确结果
4. 用户抢鼠标时动作会被中断
5. 中断和成功动作都会写日志
6. 失败动作不会污染主会话状态

---

## 11. 本阶段完成后的意义

第七版完成后，插件会开始拥有真正的“有限辅助能力”：

- 她不只是提醒你
- 她也能在你允许时帮你做有限、可控、可中断的操作

这会为后续两条路线打基础：

- 更完整的宿主记忆与训练闭环
- 更强的回放和教学辅助能力
