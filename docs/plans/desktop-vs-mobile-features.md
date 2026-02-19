# 桌面端 vs 移动端功能差异分析

> 生成日期: 2026-02-19
> 状态: 待处理（记录供后续 UI 设计参考）

## 背景

N.E.K.O 同时支持桌面端（Electron/CEF）和移动端（React Native / 移动浏览器）。
许多功能依赖桌面环境（pyautogui、Steamworks SDK、getDisplayMedia 等），移动端完全无法使用。
当前的隐藏逻辑比较粗暴，需要后续按功能逐个优化。

---

## 功能分类总表

### 两端都能用

| 功能 | 组件/端点 | 说明 |
|------|-----------|------|
| 文字聊天 | `ChatContainer` | 核心功能 |
| 语音聊天 | `WebAudio API` | 采样率不同：桌面 48kHz，移动 16kHz |
| 麦克风 | toolbar `mic` 按钮 | 两端都支持 |
| Live2D/VRM 模型显示 | `Live2DStage` | 3D 渲染两端都行 |
| API Key 设置 | `/api_key` 页面 | 纯表单配置 |
| 声音克隆 | `/voice_clone` 页面 | 文件上传两端可用 |
| 字幕/翻译 | `/api/translate` | 纯 API |
| 表情分析 | `/api/emotion/analysis` | 纯 API |
| 设置面板 4 个开关 | `Live2DRightToolbar` settings panel | 合并消息/允许打断/主动搭话/自主视觉 |
| MCP 工具 | `/api/agent/mcp/availability` | 取决于 tool server 是否可用 |
| 用户插件 | `/api/agent/user_plugin/availability` | 平台无关 |

### 桌面端专属（移动端完全不可用）

| 功能 | 依赖 | 为什么不能用 |
|------|------|-------------|
| 键鼠控制 (Agent keyboard) | `pyautogui` (`brain/computer_use.py`) | 需要操作系统级鼠标键盘控制 |
| 屏幕分享/截图 | `getDisplayMedia` | 移动浏览器不支持此 API |
| 窗口检测（主动搭话） | 获取活跃窗口标题 | 移动端无此能力 |
| Steam 创意工坊 | Steamworks SDK | 仅桌面平台有 SDK |
| Steam 成就/游戏时长 | Steamworks SDK | 同上 |
| 本地文件系统操作 | `/api/file-exists`, `/api/find-first-image` | 服务端 API，移动端无本地后端 |
| 请她离开/回来 (goodbye) | 桌面窗口行为 | 移动端无对应语义 |
| 浏览器自动化 (browser_use) | Agent server | 需要完整浏览器控制 |

### 移动端有替代实现的

| 功能 | 桌面端实现 | 移动端替代 |
|------|-----------|-----------|
| 视觉输入 | `getDisplayMedia` 截屏 | `getUserMedia` 摄像头拍照 |
| 主动搭话 | 3 种模式（截屏/窗口搜索/热搜） | 仅热搜模式（B站/微博） |
| 截图按钮文案 | "📸 截图" | "📸 拍照" |

---

## 当前隐藏逻辑审查

### Live2DRightToolbar 按钮

| 按钮 | 当前移动端隐藏？ | 是否合理？ | 建议 |
|------|-----------------|-----------|------|
| 麦克风 | 显示 | ✅ 合理 | 保持 |
| 屏幕分享 | **显示** | ❌ 不合理 | **应隐藏**（移动端用拍照，已在 ChatInput 处理） |
| Agent 工具 | 隐藏 | ⚠️ 部分合理 | 键鼠控制该隐藏，但 MCP/插件可以保留 |
| 设置 | 显示 | ✅ 合理 | 保持 |
| 请她离开 | 隐藏 | ✅ 合理 | 保持 |

### 设置面板菜单项（移动端全部隐藏）

| 菜单项 | 当前移动端隐藏？ | 是否合理？ | 建议 |
|--------|-----------------|-----------|------|
| Live2D 设置 | 隐藏 | ⚠️ 可讨论 | 模型显示两端都有，理论上可以开放 |
| API 密钥 | 隐藏 | ❌ 不合理 | **应该显示**，移动端也需要配置 API Key |
| 角色管理 | 隐藏 | ⚠️ 可讨论 | 依赖本地文件系统，但查看功能可开放 |
| 声音克隆 | 隐藏 | ❌ 不合理 | **应该显示**，文件上传移动端可用 |
| 记忆浏览 | 隐藏 | ⚠️ 可讨论 | 查看功能可以开放 |
| Steam 创意工坊 | 隐藏 | ✅ 合理 | 保持隐藏 |

### Agent 面板开关

| 开关 | 当前移动端隐藏？ | 是否合理？ | 建议 |
|------|-----------------|-----------|------|
| Agent 总开关 | 隐藏（整个面板） | ⚠️ 部分合理 | 可以显示，作为 MCP/插件的入口 |
| 键鼠控制 | 隐藏 | ✅ 合理 | 保持隐藏 |
| MCP 工具 | 隐藏 | ❌ 不合理 | 可以开放 |
| 用户插件 | 隐藏 | ❌ 不合理 | 可以开放 |

---

## 待办事项

- [ ] 屏幕分享按钮：移动端隐藏
- [ ] Agent 面板：移动端显示，但禁用键鼠控制开关
- [ ] 设置菜单：API 密钥、声音克隆在移动端显示
- [ ] 管理页面 UI：移动端响应式适配（当前页面未做移动端优化）
- [ ] 主动搭话/自主视觉：移动端自动降级为拍照+热搜模式
- [ ] 考虑是否需要移动端专属功能（如摄像头按钮独立出来）

---

## 关键文件索引

| 文件 | 内容 |
|------|------|
| `frontend/packages/components/src/Live2DRightToolbar/Live2DRightToolbar.tsx` | 工具栏按钮隐藏逻辑 |
| `frontend/src/web/App.tsx` | isMobile 检测 + 功能调度 |
| `frontend/packages/components/src/chat/ChatContainer.tsx` | 截图/拍照切换逻辑 |
| `main_routers/agent_router.py` | Agent API 端点 |
| `main_routers/system_router.py` | 系统 API（Steam、文件、主动搭话） |
| `brain/computer_use.py` | 键鼠控制实现 |
| `utils/screenshot_utils.py` | 截图处理 |
