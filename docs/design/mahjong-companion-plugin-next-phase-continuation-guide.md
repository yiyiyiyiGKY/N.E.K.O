# 雀魂陪伴插件后续推进指导（收口后继续版）

> 适用范围：Runtime 收口（D1-D10）完成后的继续开发。  
> 目标：让后续开发者在不破坏三条框架规则的前提下，按同一节奏推进 P1-P3。

## 0. 当前基线（进入本文件前应已满足）

- 运行时框架已具备：
  - `runtime/game_agent_runtime.py`
  - `runtime/inbox.py`
  - `runtime/outbox.py`
- 三条硬规则已冻结在 `contracts.py`：
  - `catgirl -> game` 可打断
  - `game -> catgirl` 只排队
  - `standby` 不操作但可整理
- 关键门禁可通过：
  - `pytest -q plugin/tests/unit/sdk/plugin/test_mahjong_companion_*`
  - `python -m plugin.plugins.mahjong_companion.smoke_test --pretty`

## 1. 继续原则（必须遵守）

- 不把新逻辑重新堆回 `orchestrator.py` 主循环。
- 不绕开 runtime 队列直接推送猫娘消息。
- 不把游戏私有记忆直接暴露到上游；默认仍走 `summary_tags + coach_note`。
- 每完成一个阶段都要补测试和文档，不接受“代码先跑、文档以后补”。

## 2. 阶段顺序（建议 3 个迭代）

### 迭代 A（P1）：依赖注入边界收口

目标：减少 `orchestrator.py` 对默认实现的硬耦合。

建议任务：

1. 增加并接入以下契约：
   - `PerceptionAdapter`
   - `NarrationAdapter`
   - `ReviewSummarizer`
   - `HostMemoryWriter`
2. 将 runtime 命令处理从硬编码 `if/elif` 迁移到可注册命令表。
3. 给每个契约补 fake 实现测试。

验收：

- `SessionOrchestrator` 主要依赖契约而不是具体默认类。
- fake adapter 可单独跑通主链路测试。

### 迭代 B（P2）：分析质量收口（V8/V6）

目标：先提升“看得准”，再提升“讲得准”。

建议任务：

1. 感知：补 calibration 数据闭环与置信分层。
2. 分析：增强向听/进张/危险度后端接口。
3. 复盘：把摘要继续结构化（事实/风险/建议/训练点）。

验收：

- 无 fixture 时仍能输出可用牌级结果。
- `review summary` 可稳定提供跨局聚合素材。

### 迭代 C（P3）：动作定位与授权收口（V7）

目标：动作层从“可用”升级到“可审计、可恢复”。

建议任务：

1. 增加 `ActionLocator` 多策略定位。
2. 增加更清晰的动作授权与风险提示状态。
3. 扩展动作日志字段（定位来源、失败原因、用户确认链）。

验收：

- 不同场景支持不同定位策略。
- UI 可直接看到最近失败原因与定位来源。

## 3. 每次提交的最小清单

每个 PR 至少包含：

1. 代码改动。
2. 对应测试（新增或更新）。
3. 至少一处设计文档同步。
4. 运行结果摘要（单测 + smoke）。

建议模板：

- `What`: 做了什么。
- `Why`: 为什么先做这个。
- `Risk`: 可能影响什么。
- `Verify`: 如何验证（命令 + 结果）。

## 4. 回归命令（固定）

```bash
.venv/bin/pytest -q plugin/tests/unit/sdk/plugin/test_mahjong_companion_*
.venv/bin/python -m plugin.plugins.mahjong_companion.smoke_test --pretty
```

如果改到 runtime / memory boundary，额外确认：

- `runtime_contract_rules` 为 `ok=true`
- `test_mahjong_companion_runtime_mailbox.py`、`test_mahjong_companion_standby_mode.py`、`test_mahjong_companion_memory_boundary.py` 全绿

## 5. 下一个推荐起手任务

建议直接从以下任务开始（优先级从高到低）：

1. 把 `orchestrator` 的 runtime 命令处理抽成 `RuntimeCommandRegistry`。
2. 给 `HostMemoryWriter` 增加真实宿主写入 adapter（先 mock 再接真接口）。
3. 增加 `ActionLocator`，先支持“按钮候选定位 + 坐标回退”双策略。

这三项完成后，再进入更大规模的 V10 通用化。
