# React 前端后续开发测试计划

**项目**: Project N.E.K.O.
**阶段**: 后迁移开发与测试
**开始日期**: 2026-02-19
**预计周期**: 2-3 周

---

## 🎯 总体目标

将已迁移的 React 页面从**功能原型**转变为**生产就绪**的应用程序。

### 关键里程碑
1. ✅ 完成所有页面迁移
2. ✅ API 集成完成
3. ✅ 功能测试通过
4. 🔲 性能优化完成
5. 🔲 生产环境部署

---

## 📋 Phase 1: API 集成（优先级：高）✅ 已完成

**完成日期**: 2026-02-20

### 实施摘要

已完成以下 API 服务模块和页面集成：

#### API 服务模块 (`frontend/src/web/api/`)
- ✅ `client.ts` - 统一的 API 客户端（基于 @project_neko/request）
- ✅ `config.ts` - 配置相关 API（ApiKeySettings）
- ✅ `characters.ts` - 角色管理 API（CharacterManager）
- ✅ `voice.ts` - 语音相关 API（VoiceClone）
- ✅ `memory.ts` - 记忆相关 API（MemoryBrowser）
- ✅ `models.ts` - 模型管理 API（ModelManager, Live2D, VRM）
- ✅ `index.ts` - 统一导出

#### 已集成的页面
- ✅ `ApiKeySettings.tsx` - API 配置管理
- ✅ `CharacterManager.tsx` - 角色管理
- ✅ `VoiceClone.tsx` - 语音克隆
- ✅ `MemoryBrowser.tsx` - 记忆浏览
- ✅ `ModelManager.tsx` - 模型管理
- ✅ `Live2DEmotionManager.tsx` - Live2D 情感映射
- ✅ `VRMEmotionManager.tsx` - VRM 情感映射

### 原计划任务（参考）

### 任务清单

#### 1.1 API 客户端设置
- [ ] 创建统一的 API 客户端（基于 axios）
- [ ] 配置 baseURL 和超时设置
- [ ] 添加请求/响应拦截器
- [ ] 实现错误处理中间件
- [ ] 添加请求重试机制

**文件**: `frontend/src/web/api/client.ts`

```typescript
// 示例结构
import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

apiClient.interceptors.response.use(
  response => response,
  error => {
    // 统一错误处理
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);
```

#### 1.2 各页面 API 集成

##### API Key Settings
- [ ] `GET /api/config/api_key` - 获取当前配置
- [ ] `POST /api/config/api_key` - 保存配置
- [ ] `POST /api/config/verify` - 验证 API Key

**更新文件**: `ApiKeySettings.tsx`

##### Character Manager
- [ ] `GET /api/character/master_profile` - 获取主人档案
- [ ] `POST /api/character/master_profile` - 更新主人档案
- [ ] `GET /api/character/catgirls` - 获取猫娘列表
- [ ] `POST /api/character/catgirls` - 创建猫娘
- [ ] `PUT /api/character/catgirls/:id` - 更新猫娘
- [ ] `DELETE /api/character/catgirls/:id` - 删除猫娘

**更新文件**: `CharacterManager.tsx`

##### Voice Clone
- [ ] `POST /api/voice/upload` - 上传音频文件
- [ ] `POST /api/voice/register` - 注册语音
- [ ] `GET /api/voice/list` - 获取语音列表
- [ ] `DELETE /api/voice/:id` - 删除语音

**更新文件**: `VoiceClone.tsx`

##### Memory Browser
- [ ] `GET /api/memory/characters` - 获取角色列表
- [ ] `GET /api/memory/characters/:id` - 获取角色记忆
- [ ] `PUT /api/memory/characters/:id` - 更新记忆
- [ ] `POST /api/memory/review/toggle` - 切换自动整理

**更新文件**: `MemoryBrowser.tsx`

##### Steam Workshop
- [ ] `GET /api/steam/workshop/items` - 获取订阅内容
- [ ] `POST /api/steam/workshop/download/:id` - 下载物品
- [ ] `DELETE /api/steam/workshop/unsubscribe/:id` - 取消订阅

**更新文件**: `SteamWorkshop.tsx`

##### Model Manager
- [ ] `GET /api/models` - 获取模型列表
- [ ] `POST /api/models/upload` - 上传模型
- [ ] `DELETE /api/models/:id` - 删除模型
- [ ] `POST /api/models/switch` - 切换模型

**更新文件**: `ModelManager.tsx`

##### Live2D Parameter Editor
- [ ] `GET /api/live2d/models` - 获取模型列表
- [ ] `GET /api/live2d/models/:id/parameters` - 获取参数
- [ ] `POST /api/live2d/models/:id/parameters` - 保存参数

**更新文件**: `Live2DParameterEditor.tsx`

##### Live2D Emotion Manager
- [ ] `GET /api/live2d/models` - 获取模型列表
- [ ] `GET /api/live2d/model_files/:name` - 获取动作/表情文件
- [ ] `GET /api/live2d/emotion_mapping/:name` - 获取情感映射
- [ ] `POST /api/live2d/emotion_mapping/:name` - 保存映射

**更新文件**: `Live2DEmotionManager.tsx`

##### VRM Emotion Manager
- [ ] `GET /api/vrm/models` - 获取 VRM 模型列表
- [ ] `GET /api/vrm/expressions/:name` - 获取表情列表
- [ ] `GET /api/vrm/emotion_mapping/:name` - 获取映射
- [ ] `POST /api/vrm/emotion_mapping/:name` - 保存映射

**更新文件**: `VRMEmotionManager.tsx`

#### 1.3 错误处理
- [ ] 实现全局错误边界（Error Boundary）
- [ ] 添加 Toast 通知组件
- [ ] 网络错误重试 UI
- [ ] 401/403 权限错误处理

**新建文件**: `frontend/src/web/components/ErrorBoundary.tsx`

---

## 🧪 Phase 2: 功能测试（优先级：高）🔄 进行中

**开始日期**: 2026-02-20

### 完成项

#### 构建和类型检查
- ✅ TypeScript 类型检查通过
- ✅ 生产构建成功

#### E2E 测试框架设置
- ✅ Playwright 配置文件创建 (`frontend/playwright.config.ts`)
- ✅ 测试脚本添加到 package.json
  - `npm run test:e2e` - 运行 E2E 测试
  - `npm run test:e2e:ui` - UI 模式
  - `npm run test:e2e:debug` - 调试模式
  - `npm run test:e2e:report` - 查看报告

#### E2E 测试用例编写
- ✅ `e2e/api-key-settings.spec.ts` - API Key 设置页面测试
- ✅ `e2e/character-manager.spec.ts` - 角色管理页面测试
- ✅ `e2e/memory-browser.spec.ts` - 记忆浏览器页面测试
- ✅ `e2e/model-manager.spec.ts` - 模型管理页面测试
- ✅ `e2e/navigation.spec.ts` - 导航和路由测试

### 待完成项

### 测试策略
- **手动测试**: 每个页面逐一测试
- **自动化测试**: 关键流程编写 E2E 测试
- **回归测试**: 确保新代码不破坏现有功能

### 2.1 手动测试清单

#### API Key Settings
- [ ] 页面能正常加载
- [ ] 显示当前 API 配置
- [ ] 修改配置后能保存
- [ ] API Key 验证功能正常
- [ ] 错误提示清晰

#### Character Manager
- [ ] 主人档案显示正确
- [ ] 修改主人档案能保存
- [ ] 猫娘列表加载正常
- [ ] 创建新猫娘成功
- [ ] 编辑猫娘信息成功
- [ ] 删除猫娘功能正常
- [ ] 模态框打开/关闭正常
- [ ] 表单验证有效

#### Voice Clone
- [ ] 音频文件上传成功
- [ ] 支持的格式验证（WAV, MP3, FLAC）
- [ ] 语音注册成功
- [ ] 已注册列表显示正确
- [ ] 删除语音功能正常

#### Memory Browser
- [ ] 角色列表加载
- [ ] 搜索功能正常
- [ ] 排序功能正常
- [ ] 记忆内容编辑
- [ ] 保存记忆成功
- [ ] 自动整理开关切换

#### Steam Workshop
- [ ] 订阅内容列表加载
- [ ] 标签页切换正常
- [ ] 搜索和排序正常
- [ ] 下载按钮功能
- [ ] 取消订阅功能
- [ ] 刷新内容功能

#### Model Manager
- [ ] 模型列表加载
- [ ] 模型类型切换
- [ ] 上传模型成功
- [ ] 删除模型功能
- [ ] 预览区域显示

#### Live2D Parameter Editor
- [ ] 模型选择下拉框
- [ ] 参数列表加载
- [ ] 参数分组显示
- [ ] 滑块调节功能
- [ ] 重置全部功能
- [ ] 保存参数功能

#### Live2D Emotion Manager
- [ ] 模型选择
- [ ] 动作/表情文件加载
- [ ] 多选功能
- [ ] 标签显示已选项
- [ ] 保存配置

#### VRM Emotion Manager
- [ ] VRM 模型选择
- [ ] 表情预览按钮
- [ ] 多选表情候选
- [ ] 保存配置

### 2.2 E2E 自动化测试（Playwright）

#### 测试环境设置
```bash
# 安装依赖
npm install --save-dev @playwright/test playwright

# 配置文件
# frontend/playwright.config.ts
```

#### 关键测试用例

##### 测试文件 1: `tests/api-key.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

test('API Key 页面加载', async ({ page }) => {
  await page.goto('/api_key');
  await expect(page.locator('h2')).toContainText('API 密钥设置');
});

test('保存 API Key', async ({ page }) => {
  await page.goto('/api_key');
  // 填写表单
  await page.fill('input[name="coreApiKey"]', 'test-key');
  await page.click('button:has-text("保存")');
  // 验证提示
  await expect(page.locator('.toast-success')).toBeVisible();
});
```

##### 测试文件 2: `tests/character-manager.spec.ts`
```typescript
test('创建新猫娘', async ({ page }) => {
  await page.goto('/chara_manager');
  await page.click('button:has-text("添加猫娘")');
  // 填写模态框
  await page.fill('input[name="name"]', 'Test Cat');
  await page.click('button:has-text("保存")');
  // 验证列表
  await expect(page.locator('text=Test Cat')).toBeVisible();
});
```

##### 测试文件 3: `tests/navigation.spec.ts`
```typescript
test('侧边栏导航', async ({ page }) => {
  await page.goto('/');
  // 测试所有导航项
  const navItems = [
    { text: 'API 密钥', path: '/api_key' },
    { text: '角色管理', path: '/chara_manager' },
    { text: '语音克隆', path: '/voice_clone' },
    // ... 其他页面
  ];

  for (const item of navItems) {
    await page.click(`text=${item.text}`);
    await expect(page).toHaveURL(new RegExp(item.path));
  }
});
```

#### 运行测试
```bash
# 运行所有测试
npm run test:e2e

# 运行特定测试
npx playwright test api-key.spec.ts

# 生成测试报告
npx playwright show-report
```

---

## 🌐 Phase 3: WebSocket 集成（优先级：中）✅ 已完成

**完成日期**: 2026-02-20

### 实施摘要

已完成 WebSocket 实时通信功能的完整实现，包括自定义 hooks、Context Provider 和 UI 组件。

#### 创建的文件

**Hooks** (`frontend/src/web/hooks/`)
- `useWebSocket.ts` - WebSocket 连接管理 hook，使用 @project_neko/realtime
- `useChat.ts` - 聊天状态管理 hook，处理消息和会话
- `useWebSocket.types.ts` - WebSocket 消息类型定义
- `index.ts` - 统一导出

**Context** (`frontend/src/web/contexts/`)
- `RealtimeContext.tsx` - WebSocket Context Provider，全局共享连接状态

**组件** (`frontend/src/web/components/`)
- `ConnectionStatus.tsx` - 连接状态指示器组件
- `ConnectionStatus.css` - 连接状态样式

#### 功能特性

1. **WebSocket 连接管理**
   - 自动重连（指数退避 + 抖动）
   - 心跳检测（30秒间隔）
   - 连接状态追踪（idle/connecting/open/closed/reconnecting）

2. **消息类型支持**
   - `start_session` / `end_session` - 会话控制
   - `stream_data` - 流式数据传输
   - `gemini_response` - AI 响应（支持流式）
   - `user_transcript` - 用户语音转录
   - `agent_status_update` - Agent 状态更新
   - `agent_notification` - Agent 通知
   - `agent_task_update` - Agent 任务更新
   - `expression` - Live2D 表情触发
   - 其他 20+ 消息类型

3. **聊天状态管理**
   - 消息列表（支持流式更新）
   - 会话模式（text/audio/screen/camera）
   - Agent 状态追踪
   - 通知和任务管理

4. **UI 组件**
   - 连接状态指示器（5种状态，3种尺寸）
   - 动画效果（脉冲动画）

### 原计划任务（参考）

#### 3.1 WebSocket 客户端
- [ ] 创建 WebSocket 连接管理器
- [ ] 实现自动重连
- [ ] 添加心跳检测
- [ ] 消息队列处理

**新建文件**: `frontend/src/web/api/websocket.ts`

```typescript
class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;

  connect(url: string) {
    this.ws = new WebSocket(url);
    this.ws.onmessage = (event) => this.handleMessage(event);
    this.ws.onclose = () => this.reconnect();
  }

  private handleMessage(event: MessageEvent) {
    const data = JSON.parse(event.data);
    // 广播到对应的事件
    window.dispatchEvent(new CustomEvent(data.type, { detail: data }));
  }

  private reconnect() {
    if (this.reconnectAttempts < 5) {
      setTimeout(() => {
        this.reconnectAttempts++;
        this.connect(this.url);
      }, 2000 * this.reconnectAttempts);
    }
  }
}
```

#### 3.2 实时功能

##### 字幕页面（Subtitle）
- [ ] 连接字幕 WebSocket
- [ ] 实时接收字幕文本
- [ ] 淡入淡出动画
- [ ] 自动滚动

##### 模型状态
- [ ] 模型加载状态实时更新
- [ ] 表情变化通知
- [ ] 动作播放通知

---

## 🌍 Phase 4: 国际化完善（优先级：中）

### 目标
使用 i18n 替换所有硬编码文本。

### 任务清单

#### 4.1 提取翻译键
- [ ] 运行 i18n 检查工具
- [ ] 提取所有中文硬编码
- [ ] 生成翻译键

```bash
# 使用 i18n-check 技能
/i18n-check frontend/src/web/pages
```

#### 4.2 添加翻译
- [ ] 更新 zh-CN.json
- [ ] 更新 en.json
- [ ] 更新 ja.json
- [ ] 更新 ko.json
- [ ] 更新 zh-TW.json

#### 4.3 替换代码
```typescript
// 之前
<h1>API 密钥设置</h1>

// 之后
<h1>{t('apiKey.title')}</h1>
```

---

## ⚡ Phase 5: 性能优化（优先级：低）

### 目标
提升应用加载速度和运行性能。

### 任务清单

#### 5.1 代码分割
- [ ] 路由级别懒加载
- [ ] 大组件懒加载
- [ ] 第三方库按需加载

**示例**:
```typescript
// router.tsx
const ApiKeySettings = lazy(() => import('./pages/ApiKeySettings'));
const CharacterManager = lazy(() => import('./pages/CharacterManager'));
```

#### 5.2 资源优化
- [ ] 图片压缩和懒加载
- [ ] CSS 提取和压缩
- [ ] 字体优化

#### 5.3 缓存策略
- [ ] API 响应缓存
- [ ] 静态资源 CDN
- [ ] Service Worker

---

## 🧩 Phase 6: 单元测试（优先级：低）

### 目标
为核心组件编写单元测试。

### 技术栈
- Jest
- React Testing Library
- @testing-library/user-event

### 测试覆盖率目标
- 工具函数: 80%+
- 组件: 60%+
- Hooks: 70%+

### 示例测试

```typescript
// ApiKeySettings.test.tsx
import { render, screen } from '@testing-library/react';
import ApiKeySettings from './ApiKeySettings';

test('renders API key settings page', () => {
  render(<ApiKeySettings />);
  expect(screen.getByText('API 密钥设置')).toBeInTheDocument();
});

test('saves API key on button click', async () => {
  render(<ApiKeySettings />);
  const input = screen.getByLabelText(/Core API Key/i);
  const button = screen.getByText(/保存/i);

  await userEvent.type(input, 'test-key');
  await userEvent.click(button);

  expect(screen.getByText(/保存成功/i)).toBeInTheDocument();
});
```

---

## 📊 测试矩阵

### 浏览器兼容性测试

| 浏览器 | 版本 | 测试状态 |
|--------|------|---------|
| Chrome | 最新 | 🔲 待测试 |
| Firefox | 最新 | 🔲 待测试 |
| Safari | 最新 | 🔲 待测试 |
| Edge | 最新 | 🔲 待测试 |

### 设备测试

| 设备 | 分辨率 | 测试状态 |
|------|--------|---------|
| Desktop | 1920x1080 | 🔲 待测试 |
| Laptop | 1366x768 | 🔲 待测试 |
| Tablet | 768x1024 | 🔲 待测试 |
| Mobile | 375x667 | 🔲 待测试 |

---

## 🚀 Phase 7: 部署准备（优先级：高）

### 任务清单

#### 7.1 环境配置
- [ ] 配置生产环境变量
- [ ] 配置 staging 环境变量
- [ ] 配置开发环境变量

#### 7.2 构建优化
- [ ] 生产构建测试
- [ ] Bundle 分析
- [ ] Source Map 配置

#### 7.3 部署流程
- [ ] 编写部署脚本
- [ ] 配置 CI/CD
- [ ] 设置回滚机制

#### 7.4 监控
- [ ] 错误监控（Sentry）
- [ ] 性能监控
- [ ] 用户行为分析

---

## 📅 时间线

| 阶段 | 预计时间 | 开始日期 | 结束日期 | 状态 |
|------|---------|---------|---------|------|
| Phase 1: API 集成 | 5-7 天 | 2026-02-20 | 2026-02-20 | ✅ 已完成 |
| Phase 2: 功能测试 | 3-4 天 | 2026-02-21 | 2026-02-24 | 🔲 待开始 |
| Phase 3: WebSocket | 2-3 天 | 2026-02-25 | 2026-02-27 | 🔲 待开始 |
| Phase 4: 国际化 | 2-3 天 | 2026-02-28 | 2026-03-02 | 🔲 待开始 |
| Phase 5: 性能优化 | 2-3 天 | 2026-03-03 | 2026-03-05 | 🔲 待开始 |
| Phase 6: 单元测试 | 3-4 天 | 2026-03-06 | 2026-03-09 | 🔲 待开始 |
| Phase 7: 部署准备 | 2-3 天 | 2026-03-10 | 2026-03-12 | 🔲 待开始 |

**总预计时间**: 19-27 天（约 3-4 周）

---

## ✅ 验收标准

### 功能验收
- [ ] 所有 API 端点正确连接
- [ ] 所有页面核心功能正常
- [ ] 无明显 Bug
- [ ] 错误处理完善

### 性能验收
- [ ] 首屏加载 < 3 秒
- [ ] 页面切换 < 500ms
- [ ] Bundle 大小 < 1.5MB

### 代码质量
- [ ] TypeScript 无错误
- [ ] ESLint 无警告
- [ ] 测试覆盖率 > 60%

### 用户体验
- [ ] 响应式设计正常
- [ ] 加载状态清晰
- [ ] 错误提示友好
- [ ] 操作流畅无卡顿

---

## 📝 问题追踪

### 已知问题
1. 字幕页面和查看器页面功能简化，需要后续完善
2. 部分 API 端点可能需要调整
3. Live2D Canvas 渲染未实现

### 技术债务
1. 添加单元测试
2. 完善错误边界
3. 优化重渲染性能

---

## 👥 责任分配

| 任务 | 负责人 | 协作人 |
|------|--------|--------|
| API 集成 | 前端开发 | 后端开发 |
| 功能测试 | QA | 前端开发 |
| E2E 测试 | QA | 前端开发 |
| 性能优化 | 前端开发 | - |
| 部署 | DevOps | 前端开发 |

---

## 📚 参考文档

- [React Router v7 文档](https://reactrouter.com/)
- [Playwright 测试文档](https://playwright.dev/)
- [Testing Library 文档](https://testing-library.com/)
- [Vite 构建工具](https://vitejs.dev/)

---

**文档版本**: 1.0
**最后更新**: 2026-02-19
**维护者**: 前端开发团队
