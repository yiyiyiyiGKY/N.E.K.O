# 雀魂陪伴插件 Runtime 收口上线清单

> 目的：作为 D10 上线门禁文档，锁死三条框架规则与回归步骤。

## 0. 三条硬规则

- `catgirl -> game` 入站消息允许打断旧命令。
- `game -> catgirl` 出站消息只能先入队，再按节流策略投递。
- `standby` 模式不执行游戏操作，但允许状态整理与复盘/记忆同步。

## 1. 自动化门禁

按顺序执行：

1. 单测（含 runtime/standby/memory boundary）

```bash
.venv/bin/pytest -q plugin/tests/unit/sdk/plugin/test_mahjong_companion_*
```

2. smoke（含 runtime 合同规则）

```bash
.venv/bin/python -m plugin.plugins.mahjong_companion.smoke_test --pretty
```

通过标准：

- 单测全绿。
- smoke `ok=true`。
- smoke `results` 中 `runtime_contract_rules` 为 `ok=true`。

## 2. 手工门禁

在插件调试页 `/plugin/mahjong_companion/ui/` 手工验证：

1. 切换 `active/standby/off`，确认状态和队列指标实时变化。
2. 发送两条入站命令（第二条勾选打断），确认旧命令被替换。
3. `standby` 下执行任意 assist 动作，确认被拒绝。
4. `standby` 下发送 `summarize_review` 或 `sync_memory`，确认仍可执行。
5. 触发一个高价值讲解，确认先入出站队列再投递（可见 `queued_message_id`）。

## 3. 产物核对

- 运行时协议文档：
  - `docs/design/mahjong-companion-plugin-v6-to-v9-finalization-implementation.md`
  - `docs/design/mahjong-companion-plugin-plan.md`
- 运行时实现：
  - `plugin/plugins/mahjong_companion/runtime/game_agent_runtime.py`
  - `plugin/plugins/mahjong_companion/runtime/inbox.py`
  - `plugin/plugins/mahjong_companion/runtime/outbox.py`
- 记忆分层实现：
  - `plugin/plugins/mahjong_companion/review/game_private_memory.py`
- 关键测试：
  - `plugin/tests/unit/sdk/plugin/test_mahjong_companion_runtime_mailbox.py`
  - `plugin/tests/unit/sdk/plugin/test_mahjong_companion_standby_mode.py`
  - `plugin/tests/unit/sdk/plugin/test_mahjong_companion_memory_boundary.py`

## 4. 发布结论模板

- `runtime_contract`: pass/fail
- `unit_test`: pass/fail
- `smoke_test`: pass/fail
- `manual_check`: pass/fail
- `final_go_no_go`: go/no-go
