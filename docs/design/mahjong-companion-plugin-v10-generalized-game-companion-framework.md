# 雀魂陪伴插件第十版文档：通用游戏陪伴框架与多游戏 Profile 基座

> 前置文档：
> - `docs/design/mahjong-companion-plugin-plan.md`
> - `docs/design/mahjong-companion-plugin-v8-complete-mahjong-analysis-and-calibrated-perception.md`
> - `docs/design/mahjong-companion-plugin-v9-host-memory-sync-and-cross-session-coaching.md`
>
> 本文对应第九版之后的下一阶段，解决两件事：
> - 把当前雀魂特化实现抽成通用游戏陪伴框架
> - 把感知、决策、表达、辅助执行和记忆桥接做成可替换 profile
>
> 实施同步说明：
> - 截至当前仓库状态，第十阶段还没有落到代码里，这份文档是路线收束版设计稿。
> - 当前仓库的多层拆分已经为通用化打下基础，但仍有不少雀魂特化逻辑留在 `perception/`、`decision/` 和调试样本目录里。
> - 因此第十阶段的关键，是“抽象共性层”，而不是简单复制一个新游戏目录。

---

## 1. 本阶段目标

第十版的目标是把现在的麻将陪伴插件推进成“通用游戏陪伴框架的首个成熟 profile”。

完成后，插件框架应该具备：

- 可替换的 `CaptureProfile`
- 可替换的 `PerceptionProfile`
- 可替换的 `DecisionProfile`
- 可替换的 `NarrationProfile`
- 可替换的 `AssistActionProfile`
- 可替换的 `ReviewProfile`

一句话理解：

- 第九版解决“长期陪练”
- 第十版解决“这套东西不只服务雀魂，还能成为别的游戏陪伴基座”

---

## 2. 本阶段范围

### 2.1 必做

- 抽象 profile 接口
- 把雀魂实现迁移成 profile
- 把插件主循环改成基于 profile 装配
- 清理通用层与雀魂特化层边界
- 让 UI 和状态字段支持多 profile 展示

### 2.2 先不做

- 一次性支持很多游戏
- 所有游戏共用一套感知模型
- 为每个游戏都做完整自动化

结论：

- 第十版是“通用游戏陪伴框架基座”
- 不是“多游戏大合集一次完成”

---

## 3. 设计原则

### 3.1 先抽接口，再迁实现

推荐先定义这些接口：

- `CaptureProfile`
- `PerceptionProfile`
- `DecisionProfile`
- `NarrationProfile`
- `AssistActionProfile`
- `ReviewProfile`

然后再把雀魂实现迁进去。

### 3.2 宿主插件仍保持一个清晰产品入口

即使内部抽象成通用框架，对外仍应保持：

- 宿主页可见的清晰插件名称
- 明确的当前 profile
- 可调试的单 profile 状态

### 3.3 抽象层不能吞掉调试能力

通用化以后仍必须保留：

- 调试样本
- 调试 JSON
- profile 级状态快照
- profile 级入口与日志

---

## 4. 推荐目录结构

```text
plugin/plugins/game_companion/
├── __init__.py
├── plugin.toml
├── orchestrator.py
├── profiles/
│   ├── base.py
│   ├── mahjong_soul/
│   │   ├── capture.py
│   │   ├── perception.py
│   │   ├── decision.py
│   │   ├── narration.py
│   │   ├── actions.py
│   │   └── review.py
│   └── ...
├── shared/
│   ├── capture/
│   ├── gates/
│   ├── action/
│   ├── narration/
│   └── review/
└── static/
```

---

## 5. 迁移策略建议

推荐分三步迁移：

1. 保留现有 `mahjong_companion/`，先在内部抽 profile 接口
2. 把雀魂逻辑迁成第一个 profile
3. 评估是否需要改成更通用的插件名和目录

不建议直接大搬家。

---

## 6. 外部参考资料与可复用资源

第十版的重点已经不是某一项雀魂功能，而是“把已经证明可用的层抽成通用基座”。因此这里最值得参考的资料，不是单个模型，而是：

- 已经跑通的多层插件结构
- 可复用算法与复盘模块
- 强 AI / 研究项目的模块边界
- 后续可能扩展到其他游戏时的 profile 组织方式

### 6.1 当前仓库内最重要的本地参考

对第十版来说，第一参考对象其实就是当前仓库已经落地的雀魂插件本身：

- `capture/`
- `gates/`
- `perception/`
- `decision/`
- `narration/`
- `action/`
- `review/`

第十版通用化时，不应跳过这些现成分层，直接重做一个新框架。

更合理的做法是：

- 先抽接口
- 再让现有实现挂接这些接口
- 最后才考虑目录迁移

### 6.2 外部项目中最适合借鉴“模块边界”的参考

- `Mortal`
  - https://github.com/Equim-chan/Mortal
  - 适合参考：强 AI 项目的模块组织、数据流边界、决策层分离方式
- `kanachan`
  - https://github.com/Cryolite/kanachan
  - 适合参考：训练与推理层分离、数据表示与模型接口设计
- `mjai-reviewer`
  - https://github.com/Equim-chan/mjai-reviewer
  - 适合参考：分析输出、复盘模块与用户可读结论之间的中间层

这些项目第十版最值得参考的地方不是“多强”，而是：

- 它们如何分模块
- 它们怎样隔离输入、分析、输出
- 哪些模块可以作为 profile 级能力

### 6.3 可复用规则与分析基础参考

- `MahjongRepository/mahjong`
  - https://github.com/MahjongRepository/mahjong
  - 适合参考：规则计算层可抽成共享分析基础

第十版里，这类库更应该被放在：

- `shared/analysis/`
- 或 profile 可选依赖层

而不是让雀魂 profile 单独私有一套逻辑。

### 6.4 牌谱与趋势聚合参考

- `Amae-Koromo`
  - https://github.com/SAPikachu/amae-koromo
  - 适合参考：聚合层、趋势层、统计展示层的边界

对第十版来说，这类项目的意义在于提醒我们：

- `review profile`
- `coaching profile`
- `memory profile`

这三者未必应该永远绑在一个模块里。

### 6.5 官方与社区资料在第十版的作用

- `Mahjong Soul Start Guide`
  - https://mahjongsoul.com/startguide/
- `Mahjong Soul Wiki`
  - https://mahjongsoul.wiki.gg/wiki/Mahjong_Soul_Wiki

到第十版，这些资料的作用已经不再是“训练数据”，而是：

- 帮助保留雀魂 profile 的术语一致性
- 帮助雀魂特化实现与通用层解耦时不丢产品语义

换句话说：

- 通用层负责框架
- 社区和官方资料帮助雀魂 profile 保持产品感

### 6.6 对第十版最推荐的参考组合

如果只选最有价值的一组，建议优先顺序是：

1. 当前仓库里已落地的 `mahjong_companion` 分层
2. `Mortal`
3. `kanachan`
4. `mjai-reviewer`
5. `MahjongRepository/mahjong`
6. `Amae-Koromo`

对应到第十版实现：

- `profiles/base.py`
  - 重点参考：当前仓库分层 + 外部项目的接口边界
- `shared/`
  - 重点参考：哪些东西真正可跨 profile 复用
- `mahjong_soul` profile
  - 重点参考：保留现有产品能力，而不是重新发明

### 6.7 使用这些资源时的边界提醒

- 第十版不是把所有外部项目拼在一起。
- 第十版的目标是抽“接口”和“边界”，不是复制别人的训练栈或推理栈。
- 如果某个能力只对雀魂有效，就应继续留在 `mahjong_soul` profile，而不是硬塞进通用层。
- 通用化一旦做得太早、太宽，最容易伤到的不是架构，而是当前已经可用的雀魂产品体验。

---

## 7. UI 建议

第十版面板建议新增：

- 当前 profile
- profile 可切换能力说明
- profile 级配置页
- profile 级调试入口

---

## 8. 实现顺序

建议按这个顺序落：

1. 定义 profile 基础接口
2. 让 `orchestrator.py` 面向接口工作
3. 把雀魂实现迁成 `mahjong_soul` profile
4. 清理共享模块
5. 最后再考虑第二个游戏 profile

---

## 9. 验收方式

至少要验证：

1. 雀魂 profile 迁移后现有能力不回退
2. 调试链路仍能正常工作
3. 共享模块不再硬编码雀魂语义
4. 新增 profile 时不用改动大量编排代码

---

## 10. 本阶段完成后的意义

第十版完成后，这个项目会拥有两层价值：

- 产品层：一个成熟的雀魂陪伴插件
- 架构层：一个可复用的通用游戏陪伴框架

这也意味着“剩余版本文档”会在这里形成第一轮收束：

- 再往后如果继续出版本，就不再只是补雀魂功能
- 而会变成针对更强模型、更大规模训练或新游戏扩展的专题版本
