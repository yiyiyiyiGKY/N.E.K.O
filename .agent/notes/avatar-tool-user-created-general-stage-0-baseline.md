# Avatar 用户自定义通用道具：阶段 0 基线

> 日期：2026-09-02  
> 目标基线：[avatar-tool-user-created-general-design.md](./avatar-tool-user-created-general-design.md)  
> 实施安排：[avatar-tool-user-created-general-implementation.md](./avatar-tool-user-created-general-implementation.md)

## 结论

当前 v2 自定义道具链、目标 v3 落点和两仓库边界已经确认。没有发现需要改动锁定设计的业务分歧，也没有发现阻止阶段 1 开始的结构性技术问题。

阶段 0 只确认起点和可实施性。具体编辑器体验、图运行结果和 Web/Full/Compact/PC 一致性按阶段 1～7 的人工验收逐步证明，不在这里提前重复验收。

## 1. 工作区和版本

| 仓库 | 分支 / HEAD | 阶段 0 开始时状态 | 相关环境 |
|---|---|---|---|
| `/Users/tonnodoubt/N.E.K.O` | `full_tool` / `9b1f4745d9bd99de317b08f3030ec07e7c32c0fd` | `?? .agent/notes/` | Python 3.11.14；前端 React 18.3.1、TypeScript 5.9.3、Vite 5.4.21 |
| `/Users/tonnodoubt/N.E.K.O.-PC` | `full_tool` / `6b7131b69fc63a0b69161755c36320f741dda80d` | `?? .agent/`、`?? vendor/` | 产品 0.9.0；Node 24.13.0、npm 11.6.2、Electron 41.2.0、Forge 7.8.1 |

上述未跟踪内容均按用户已有内容保留。阶段 0 没有修改功能代码或安装依赖。`@xyflow/react` 当前未安装。

锁定设计 SHA-256：`3ac4466e5369958f4f1bb9cdfe27f158ebbbb2a61d4b348f7baa51b7be51220a`。

## 2. 当前实际主链

```text
AvatarToolItemManager
  → AvatarToolCreatePage（默认图、变化图、press-swap / click-advance）
  → localTools.ts（严格 v2 DTO、multipart 创建/更新/删除）
  → avatar_tool_router.py（loopback、CSRF、限量上传、错误映射）
  → AvatarToolStore（recordVersion 2、digest、资源闭包、revision、原子恢复）
  → Web definition v2 / press-release runtime
  → desktop contract（wireVersion 1 + definitionVersion 2）
  → N.E.K.O.-PC contract / runtime / interaction output / surface lifecycle
  → Host 白名单归一化 toolRevision + changeIndex
  → Python 按权威 revision 和 changeIndex 取描述，再进入既有反馈与模型调用链
```

主要事实落点：

| 链路 | 当前代码入口 |
|---|---|
| 管理与创建 | `frontend/react-neko-chat/src/AvatarToolItemManager.tsx:395`；`AvatarToolCreatePage.tsx:79` |
| Web API 与 v2 definition | `avatar-tools/localTools.ts:313-507` |
| Router | `main_routers/avatar_tool_router.py:68-345` |
| Store | `utils/avatar_tool_store.py:382`、`:642`、`:958`、`:1400`、`:1467` |
| Web pointer/runtime | `avatar-tools/runtime.ts:226` |
| Desktop 投影 | `avatar-tools/desktopContract.ts:946`、`:974` |
| PC 解码与运行 | `N.E.K.O.-PC/src/desktop-avatar-tools/contract.js:885`、`:993`；`runtime.js:709`、`:1089`；`interaction-output.js:284`、`:600` |
| Host / Python 反馈 | `static/app/app-buttons.js:1637-1762`；`config/prompts/avatar_interaction_contract.py:127`；`main_logic/core/greeting.py:151` |

当前 v2 脱敏形状：

```json
{
  "recordVersion": 2,
  "id": "local-<uuid>",
  "name": "示例道具",
  "defaultImage": "default.png",
  "imageChange": {
    "mode": "click-advance",
    "items": [
      { "image": "change-000.png", "meaning": "第一张描述" },
      { "image": "change-001.png", "meaning": "第二张描述" }
    ]
  },
  "interaction": {},
  "resourceDigests": { "<resource>": "<sha256>" }
}
```

当前运行反馈载荷使用 `toolId + toolRevision + changeIndex`；`changeIndex` 必填且从 0 开始。描述正文不经过 PC contract，而由 Python 使用权威记录解析。

## 3. 当前与目标的差异及实施归属

| 锁定目标 | 当前 v2 | 主要落点 | 人工阶段 |
|---|---|---|---|
| Compact 入口进入足够大的编辑工作区 | 创建/修改嵌在 Compact 管理弹窗 | Manager、App/Full portal、PC window bridge | 1 |
| 同级图片、稳定 ID、唯一初始图、描述可空 | 默认图与变化图分级，变化描述必填 | CreatePage、localTools、Router、Store | 2 |
| 完整鼠标点击、按下/松开图片动作、延时、连接、entry、循环和竞争 | 两种固定切图模式 | 编辑模型、v3 schema、Web/PC 图解释器 | 3 |
| 保存、重开、定位错误和 revision 冲突 | v2 平行 multipart 和既有冲突刷新 | localTools、Router、Store、Manager | 4 |
| 装备后按图运行且各 surface 生命周期一致 | frame index + 固定 profile | catalog、runtime、desktop contract、PC runtime/lifecycle | 5 |
| 点击反馈由按下前图片决定；空描述不调用模型；彩蛋替代普通反馈 | 反馈按变化图 `changeIndex` 解析 | protocol、Host、Python normalizer/greeting | 6 |
| 修改、删除、旧 v2 直读与显式保存转换 | 仅 v2 | Manager/API/Store、跨仓库兼容顺序 | 7 |

没有设计要求落在阶段 1～7 之外，也没有增加锁定设计未定义的产品能力。

## 4. 基线检查

| 检查 | 结果 |
|---|---|
| N.E.K.O 前端 `npm run typecheck` | 通过 |
| N.E.K.O 前端 `npm test` | 通过；存在既有 React `act(...)` 与 jsdom `HTMLMediaElement` 日志 |
| N.E.K.O 前端 `npm run build` | 通过，357 个模块；若干 `/static/...` 资源由运行时解析的既有警告 |
| N.E.K.O 目标 Python 用例 | 312 通过，2 个弃用警告 |
| N.E.K.O.-PC `npm run lint` | 0 error；1 个既有无效 eslint-disable warning（`test/forge-dropper.test.js:2441`） |
| N.E.K.O.-PC `npm run test:contract` | 608 通过、40 跳过、0 失败 |
| N.E.K.O.-PC `npm run test:integration` | 1 通过、20 条可选 smoke/cross-repo 用例因环境开关未启用而跳过 |
| N.E.K.O.-PC `npm run test:unit` | 1191 通过、5 跳过、5 失败 |

PC 单元测试的 5 个实施前失败全部位于 Portable 更新测试，不属于头像道具链：

- macOS 临时目录真实路径 `/private/var/...` 与期望 `/var/...` 不一致；
- 三条 Linux/POSIX helper 在 macOS 执行 GNU `stat -c`；
- macOS archive helper 报 `archive_entries_mismatch`。

它们不阻止阶段 1；后续不把它们误报为本功能回归。

当前服务第一次启动因 tiktoken 编码文件远程读取卡住，Main Server 导入超过 90 秒而超时。线程栈确认阻塞在 `tiktoken.load.read_file_cached`；缓存完成后第二次启动成功，`/api/debug/health` 返回 200。这是可恢复的启动环境基线，不是道具链缺陷。

## 5. 必要界面抽查

当前未修改界面确认了 Compact 的实际限制：管理器和创建页仍被约 494×278 的可用视口裁切，创建页需要在同一小弹窗内滚动完成。该事实与阶段 1 的扩展工作区目标一致。

- [当前管理器截图](./avatar-tool-stage-0-current-manager.png)
- [当前创建页截图](./avatar-tool-stage-0-current-create.png)

阶段 0 曾用现有 UI 创建 `press-swap` 和 `click-advance` 两个专用临时道具，确认 v2 创建、保存、列表与 detail 回读正常；两个临时道具已通过当前 UI 删除，原来的“棒棒糖 / 猫爪 / 锤子”三个快捷槽已恢复。按用户纠正，当前旧功能不再做跨 surface 全量人工验收；对应语义由已通过的 Web/PC runtime 与 contract 用例作为起点，目标行为留在阶段 5～7 验收。

## 6. 关键技术路径

- **编辑工作区**：PC 现有 `window.nekoChatWindow` 已提供 `getBounds`、`getWorkArea`、`setSize`、`setBounds` 和 `setResizable`；Compact 当前也已有折叠/展开及几何恢复链。阶段 1 可在同一 React 根中增加一次有所有权的“进入编辑/恢复”握手，无需新建第二个 BrowserWindow。
- **Portal 与安全边界**：编辑层仍在同一页面和 React 根内，可继续复用目录状态、mutation security、文件选择、focus trap 与返回焦点。无需第二份缓存或 API。
- **节点画布依赖**：候选 `@xyflow/react` 12.11.5，MIT，peer React/ReactDOM `>=17`，与当前 React 18、TypeScript 5.9、Vite 5 的依赖契约兼容。当前页面没有阻止同源打包 CSS/JS 的 CSP；正式加入依赖时仍需由 lockfile 固定 registry 实际版本并跑打包验证。
- **版本并存**：desktop `wireVersion` 继续保持 1；内置 v1、旧自定义 v2、新自定义 v3 由 `definitionVersion` 严格分支。消费者先接受 v3，生产者后输出 v3。
- **稳定图片 ID**：运行投影只携带 `imageId → frame/URL/hasMeaning`，不携带描述正文；PC 输出 `imageId`，Host 白名单归一化，Python 再按 `toolRevision + imageId` 从权威 v3 record 解析真实描述。
- **运行生命周期**：图计时器和进行中点击票据进入现有 disposer、generation、surface ownership 与 handoff 清理，不增加第二套 document pointer 或 surface 生命周期。
- **v2 显式转换**：`press-swap` 转为一个自连接完整点击（按下旧变化图、松开旧默认图）；`click-advance` 转为松开逐项前进的点击链，末项自连接。GET/扫描不写盘，只有用户编辑保存才写 v3，沿用 base revision、资源摘要、闭包和原子发布。

参考仅用于依赖可行性：[React Flow 入门](https://reactflow.dev/learn)、[上游 package.json](https://github.com/xyflow/xyflow/blob/main/packages/react/package.json)、[无障碍说明](https://reactflow.dev/learn/advanced-use/accessibility)。

## 7. 阶段 0 退出检查

- [x] 当前主链、目标差异和必须复用的边界已经明确；
- [x] 本功能相关基线没有未分类失败；
- [x] 目标方案没有已知结构性技术阻断；
- [x] 两仓库已有用户内容已识别并会保留；
- [x] 没有未确认的业务问题。

结论：阶段 0 通过，可以进入阶段 1。
