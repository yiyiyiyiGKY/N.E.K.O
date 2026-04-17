# 雀魂陪伴插件第八版文档：完整麻将分析与校准化牌级感知

> 前置文档：
> - `docs/design/mahjong-companion-plugin-plan.md`
> - `docs/design/mahjong-companion-plugin-v6-tile-efficiency-and-review-summary.md`
> - `docs/design/mahjong-companion-plugin-v7-assisted-actions-and-safe-execution.md`
>
> 本文对应第七版之后的下一阶段，解决两件事：
> - 把“轻量牌理建议”推进到“更完整的牌级分析能力”
> - 把牌级感知做成可校准、可回归、可替换的模块，而不是临时规则堆叠
>
> 实施同步说明：
> - 截至当前仓库状态，第八阶段第一版已经落到代码里，但还远未到“稳定牌识别”。
> - 当前仓库已具备：`perception/calibration.py`、`perception/hand_layout.py`、`perception/tile_parser.py` 的第一版骨架，`analysis_confidence / tile_level_state` 这类置信分层元数据，`decision/tile_efficiency.py` 的结构化候选弃牌输出，以及 `decision/risk_estimator.py` 提供的第一版防守告警。
> - 当前仓库还没有具备：稳定的手牌识别、完整向听估算、进张估算、危险度估计、校准样本闭环和 UI 校准页。
> - 因此第八阶段现在可以视为“完整麻将分析与校准化牌级感知第一版已落地”，后续重点不再是搭骨架，而是继续提高牌识别质量、校准闭环和分析深度。

---

## 1. 本阶段目标

第八版的目标是把插件推进到“开始像真正的麻将分析助手”，但仍保持渐进式架构。

完成后，插件应该具备：

- 能识别基础手牌结构和关键副露信息
- 能给出向听、进张、候选弃牌等轻中度分析
- 能对不同布局或分辨率做校准
- 能明确区分“高置信牌级分析”和“降级回规则建议”
- 能继续兼容第六版和第七版的讲解、复盘、辅助执行链路

一句话理解：

- 第七版解决“能安全执行有限辅助”
- 第八版解决“开始真正懂牌，而不是只懂按钮”

---

## 2. 本阶段范围

### 2.1 必做

- 增加牌级感知模块
- 增加向听 / 进张 / 候选弃牌第一版
- 增加感知校准配置与样本闭环
- 增加置信度分层策略
- 增加牌级分析调试产物

### 2.2 先不做

- 职业级精度的整局牌谱还原
- 所有 UI 皮肤全覆盖
- 极高精度危险牌概率模型
- 复杂鸣牌分支穷举
- 云端训练和自动标注平台

结论：

- 第八版是“完整麻将分析起点 + 校准化牌级感知”
- 不是“职业牌谱引擎”

---

## 3. 设计原则

### 3.1 感知和分析必须继续分层

仍保持：

- `perception/` 负责“看见什么”
- `decision/` 负责“建议什么”
- `narration/` 负责“怎么说”

不要让手牌识别细节直接泄漏进讲解模板。

### 3.2 校准优先于一味加模型

第八版建议先把这些做好：

- 牌区 ROI 校准
- 常见分辨率校准
- 多套 debug 样本回归
- 低置信降级路径

而不是一开始就把复杂模型塞进主循环。

### 3.3 分析结果必须显式携带置信度

推荐至少区分：

- `tile_level_unavailable`
- `tile_level_partial`
- `tile_level_reliable`

只有 `reliable` 才允许进入更强的弃牌建议。

---

## 4. 推荐数据模型

### 4.1 建议正式引入 `MahjongAnalysis`

```json
{
  "analysis_version": "mahjong-core-v1",
  "tile_level_available": true,
  "analysis_confidence": 0.74,
  "shanten_estimate": 1,
  "ukeire_estimate": 18,
  "candidate_discards": [
    {
      "tile": "9m",
      "score": 0.77,
      "safety_hint": "medium",
      "reason": "孤张幺九且改善较弱"
    }
  ],
  "defense_alerts": [],
  "teaching_points": [
    "这手先保留两面形更自然。"
  ]
}
```

### 4.2 `DecisionResult` 建议增强

```json
{
  "decision_type": "tile_efficiency_hint",
  "recommended_focus": "tile_efficiency",
  "mahjong_analysis": {
    "analysis_confidence": 0.74,
    "shanten_estimate": 1
  }
}
```

---

## 5. 推荐模块变化

第八版建议增加：

```text
plugin/plugins/mahjong_companion/
├── perception/
│   ├── tile_parser.py
│   ├── hand_layout.py
│   └── calibration.py
├── decision/
│   ├── tile_efficiency.py
│   ├── risk_estimator.py
│   └── mahjong_analysis.py
└── data/
    ├── calibration/
    └── fixtures/
```

建议职责：

- `tile_parser.py`
  - 手牌、河牌、关键区域的牌级结构化
- `hand_layout.py`
  - 分辨率、座位、UI 变体适配
- `calibration.py`
  - 手工校准与加载校准参数
- `tile_efficiency.py`
  - 向听、进张、候选弃牌第一版
- `risk_estimator.py`
  - 轻量危险度和防守提示

---

## 6. 外部参考资料与可复用资源

第八版不建议闭门造车。围绕“雀魂牌级感知 + 牌理分析”这一阶段，已经有几类很值得参考的现成资料。

### 6.1 官方与社区资料

- 官方入门页：
  - `Mahjong Soul Start Guide`
  - https://mahjongsoul.com/startguide/
  - 适合参考：界面术语、模式入口、系统按钮语义、官方表述
- 社区百科：
  - `Mahjong Soul Wiki`
  - https://mahjongsoul.wiki.gg/wiki/Mahjong_Soul_Wiki
  - 适合参考：角色、模式、规则名词、系统页面与社区整理资料

这些资料更适合帮助：

- 对齐 UI 名词和按钮文案
- 建立局内状态机和界面词表
- 校验回放、菜单、房间等非牌级场景

它们不适合直接作为训练集，但很适合做：

- 词表
- 场景标签
- 调试说明文档

### 6.2 可直接参考的数据集与视觉模型

- 雀魂牌面图像数据集：
  - `pjura/mahjong_souls_tiles`
  - https://huggingface.co/datasets/pjura/mahjong_souls_tiles
  - 适合参考：牌面分类、牌图裁切、视觉 baseline
- 对应视觉模型：
  - `pjura/mahjong_vision`
  - https://huggingface.co/pjura/mahjong_vision
  - 适合参考：牌图识别 baseline、推理输入输出格式

对于当前项目，第八版最实际的做法不是直接追求“整局完整视觉模型”，而是先把这些资源用于：

- 单牌分类 baseline
- ROI 裁切后的局部识别
- 自己样本回归时的比较基线

### 6.3 牌理算法库与规则计算基础

- `MahjongRepository/mahjong`
  - https://github.com/MahjongRepository/mahjong
  - 适合参考：向听、和牌、符翻等规则计算

这一类库对第八版尤其重要，因为它能把“牌已经识别出来”后的算法层快速补齐，避免自己从零写：

- 向听估算
- 和牌判定
- 基础打点计算
- 部分牌理验证

建议策略是：

- 视觉层自己做校准和识别
- 规则层优先复用成熟麻将库

### 6.4 牌谱、统计与复盘项目

- `Amae-Koromo`
  - https://github.com/SAPikachu/amae-koromo
  - 适合参考：牌谱聚合、统计视角、复盘数据组织方式
- `mjai-reviewer`
  - https://github.com/Equim-chan/mjai-reviewer
  - 适合参考：复盘、点评、局后分析的输出结构

这些项目对第八版和第九版的共同价值在于：

- 帮助设计复盘数据结构
- 帮助设计“候选节点 -> 人类可读分析”的转换方式
- 帮助区分“原始流水”和“对用户有价值的复盘结论”

### 6.5 更强 AI / 研究项目

- `kanachan`
  - https://github.com/Cryolite/kanachan
  - 适合参考：基于雀魂牌谱的训练思路和模型研究方向
- `Mortal`
  - https://github.com/Equim-chan/Mortal
  - 适合参考：更强麻将 AI 的决策结构与工程组织

这些项目适合借鉴：

- 数据表示方式
- 决策模型接口设计
- 复盘和训练分析的结构

但不建议当前项目直接照搬为实时执行链路，因为它们的目标更偏：

- 强 AI
- 研究训练
- 完整对局分析

而当前插件第八版更适合保持：

- 截图感知
- 可校准 ROI
- 可降级规则路径
- 逐步引入可信牌理

### 6.6 对本项目最推荐的参考组合

如果只选最有价值的一组，建议优先顺序是：

1. 官方入门资料 + 社区 wiki
2. `pjura/mahjong_souls_tiles` + `pjura/mahjong_vision`
3. `MahjongRepository/mahjong`
4. `Amae-Koromo` + `mjai-reviewer`
5. `kanachan` + `Mortal`

对应到本项目阶段：

- 第八版前半程：
  - 官方资料、社区 wiki、牌面数据集、视觉 baseline、规则算法库
- 第八版后半程到第九版：
  - 牌谱统计、复盘输出项目、长期训练趋势项目

### 6.7 参考这些资源时的边界提醒

- 我没有查到雀魂官方公开提供的“官方训练数据集”或“官方视觉模型”。
- 很多 Majsoul 相关项目会涉及协议解析、抓 websocket、浏览器扩展或更激进的实时辅助，这些可以参考思路，但不应直接作为本项目默认实现路径。
- 如果项目继续坚持“截图感知 + 本地分析 + 安全边界”，那么最稳妥的技术路线仍然是：
  - 官方/社区资料对齐 UI
  - 公开牌面数据集做视觉 baseline
  - 成熟麻将算法库做规则分析
  - 复盘项目只借鉴结构，不直接复制运行模式

---

## 7. UI 建议

第八版建议新增：

- ROI 校准页
- 手牌识别调试视图
- 最近一次牌级分析详情
- 向听 / 进张 / 候选弃牌展示

---

## 8. 实现顺序

建议按这个顺序落：

1. 先做 `perception/calibration.py`
2. 再做 `tile_parser.py`
3. 再做 `decision/mahjong_analysis.py`
4. 再做 `tile_efficiency.py`
5. 最后补 UI 与回归样本

---

## 9. 验收方式

至少要验证：

1. 无校准时能明确降级
2. 有校准样本时能稳定输出基础牌级结构
3. 向听 / 进张结果能进入 `DecisionResult`
4. 低置信时不会乱生成专业结论
5. 调试产物能完整复现牌级分析链路

---

## 10. 本阶段完成后的意义

第八版完成后，插件会从“陪你看局的助手”进一步走向“有一定牌理能力的教练”。

这会直接支撑后续：

- 跨局训练总结
- 更可信的复盘记忆
- 更自然的教学模式
