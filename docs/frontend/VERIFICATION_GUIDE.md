# 前端重构任务验证指南

> 本文档描述如何验证前端重构各项任务的完成情况

---

## 一、通用验证步骤

每次完成任务后，建议运行以下检查：

```bash
cd frontend

# 1. TypeScript 类型检查
npm run typecheck

# 2. 单元测试（如有）
npm test

# 3. 构建检查
npm run build:prod

# 4. 启动开发服务器
npm run dev:web
```

---

## 二、页面迁移验证

### 2.1 页面对照表

| 旧版 HTML | React 页面 | 路由 |
|-----------|-----------|------|
| templates/index.html | 首页聊天页 | `/` |
| templates/chara_manager.html | CharacterManager | `/character-manager` |
| templates/api_key_settings.html | ApiKeySettings | `/api-key-settings` |
| templates/memory_browser.html | MemoryBrowser | `/memory-browser` |
| templates/model_manager.html | ModelManager | `/model-manager` |
| templates/live2d_emotion_manager.html | Live2DEmotionManager | `/live2d-emotion-manager` |
| templates/live2d_parameter_editor.html | Live2DParameterEditor | `/live2d-parameter-editor` |
| templates/vrm_emotion_manager.html | VRMEmotionManager | `/vrm-emotion-manager` |
| templates/subtitle.html | Subtitle | `/subtitle` |
| templates/viewer.html | Viewer | `/viewer` |
| templates/voice_clone.html | VoiceClone | `/voice-clone` |
| templates/steam_workshop_manager.html | SteamWorkshop | `/steam-workshop` |

### 2.2 验证清单

每个页面迁移完成后，检查以下项：

| 检查项 | 方法 | ✅ |
|--------|------|---|
| 页面可访问 | 浏览器访问对应路由 | |
| 无控制台报错 | DevTools → Console | |
| API 请求正常 | DevTools → Network | |
| 功能完整 | 对照旧版测试所有功能 | |
| 样式一致 | 视觉对比 | |
| 响应式布局 | 缩放浏览器窗口测试 | |

### 2.3 各页面功能测试点

#### 首页聊天页 (index.html → `/`)
- [ ] 发送文本消息
- [ ] 接收 AI 回复（流式显示）
- [ ] 语音输入（按住说话）
- [ ] 语音播放（AI 语音）
- [ ] Live2D/VRM 模型显示
- [ ] 表情变化
- [ ] WebSocket 连接状态显示
- [ ] 断线重连

#### 角色管理页 (chara_manager.html → `/character-manager`)
- [ ] 查看角色列表
- [ ] 创建新角色
- [ ] 编辑角色信息
- [ ] 删除角色
- [ ] 切换当前角色
- [ ] 上传角色头像

#### API Key 设置页 (api_key_settings.html → `/api-key-settings`)
- [ ] 查看当前 API 提供商
- [ ] 切换 API 提供商
- [ ] 修改 API Key
- [ ] 保存配置

#### 记忆浏览器页 (memory_browser.html → `/memory-browser`)
- [ ] 查看记忆列表
- [ ] 搜索记忆
- [ ] 删除记忆
- [ ] 新建对话（清空记忆）

#### 模型管理页 (model_manager.html → `/model-manager`)
- [ ] 查看模型列表
- [ ] 下载模型
- [ ] 切换模型
- [ ] 删除模型

#### Live2D 表情管理页 (`/live2d-emotion-manager`)
- [ ] 查看表情列表
- [ ] 触发表情
- [ ] 自定义表情参数

#### Live2D 参数编辑页 (`/live2d-parameter-editor`)
- [ ] 调整模型参数
- [ ] 实时预览
- [ ] 保存参数配置

#### VRM 表情管理页 (`/vrm-emotion-manager`)
- [ ] VRM 表情切换
- [ ] 手势控制

#### 字幕设置页 (`/subtitle`)
- [ ] 字幕显示开关
- [ ] 字幕样式设置

#### 预览页 (`/viewer`)
- [ ] 全屏预览模型
- [ ] 模型交互

#### 音色克隆页 (`/voice-clone`)
- [ ] 录制样本
- [ ] 克隆音色
- [ ] 试听效果
- [ ] 保存音色

#### 创意工坊页 (`/steam-workshop`)
- [ ] 浏览作品
- [ ] 下载作品
- [ ] 上传作品

---

## 三、Packages 验证

### 3.1 common 包

```bash
cd frontend

# 类型检查
npm run typecheck

# 验证导出
node -e "console.log(require('./packages/common'))"
```

**检查点**：
- [ ] 类型定义正确
- [ ] 工具函数可用

---

### 3.2 request 包

```bash
cd frontend

# 运行单元测试
npm test -- packages/request

# 查看覆盖率
npm test -- packages/request -- --coverage
```

**检查点**：
- [ ] 单元测试通过
- [ ] 请求能正常发送
- [ ] Token 自动携带
- [ ] 错误处理正确

---

### 3.3 realtime 包

**检查点**：
- [ ] WebSocket 能连接
- [ ] 自动重连正常
- [ ] 心跳保活
- [ ] 消息收发正常

**验证方法**：
```javascript
// 在浏览器控制台测试
import { WebSocketClient } from '@project_neko/realtime';

const client = new WebSocketClient('ws://localhost:48911');
client.connect();
client.onMessage((msg) => console.log('收到消息:', msg));
```

---

### 3.4 audio-service 包

**检查点**：
- [ ] 能播放音频
- [ ] 能录制音频
- [ ] 音量可视化
- [ ] 播放中断

**验证方法**：
```javascript
// 在浏览器控制台测试
import { AudioService } from '@project_neko/audio-service';

const audio = new AudioService();
await audio.play('http://example.com/audio.mp3');
```

---

### 3.5 live2d-service 包

**检查点**：
- [ ] 模型能加载
- [ ] 表情切换
- [ ] 动作播放
- [ ] 唇同步
- [ ] 自动眨眼/呼吸

---

### 3.6 components 包

**检查点**：
- [ ] Button 组件正常
- [ ] Modal 组件正常
- [ ] StatusToast 提示正常

**验证方法**：
启动开发服务器，在页面中测试各组件。

---

### 3.7 web-bridge 包

**检查点**：
- [ ] window 上暴露的 API 可用
- [ ] 与旧版 JS 兼容

---

## 四、API 集成验证

### 4.1 验证方法

1. 打开 DevTools → Network
2. 操作对应功能
3. 检查请求和响应

### 4.2 API 检查清单

| API | 检查项 |
|-----|--------|
| 聊天 API | 流式响应正常、SSE 解析正确 |
| 角色 API | CRUD 操作正常 |
| 记忆 API | 搜索、删除正常 |
| Agent API | 状态获取、控制正常 |
| 模型 API | 列表、下载、切换正常 |
| TTS/STT API | 语音合成、识别正常 |

---

## 五、构建部署验证

### 5.1 开发构建

```bash
cd frontend
npm run build:dev
```

**检查点**：
- [ ] 构建无报错
- [ ] 产物输出到 `dist/` 和 `static/bundles/`
- [ ] sourcemap 生成

### 5.2 生产构建

```bash
cd frontend
npm run build:prod
```

**检查点**：
- [ ] 构建无报错
- [ ] 无 sourcemap（安全）
- [ ] 代码已压缩
- [ ] 体积合理

### 5.3 构建产物检查

```bash
# 检查产物
ls -la static/bundles/
ls -la dist/webapp/

# 应该看到：
# static/bundles/
#   - components.es.js
#   - components.umd.js
#   - request.es.js
#   - request.umd.js
#   - web-bridge.es.js
#   - web-bridge.js
#
# dist/webapp/
#   - react_web.js
#   - assets/
```

---

## 六、测试验证

### 6.1 单元测试

```bash
cd frontend

# 运行所有测试
npm test

# 运行特定包的测试
npm test -- packages/request

# 带覆盖率
npm test -- --coverage
```

### 6.2 E2E 测试

```bash
cd frontend

# 安装 Playwright（首次）
npx playwright install

# 运行 E2E 测试
npm run test:e2e

# 带 UI 运行
npx playwright test --ui
```

**E2E 测试检查点**：
- [ ] 聊天流程测试通过
- [ ] Live2D 交互测试通过
- [ ] 页面导航测试通过

---

## 七、RN 同步验证

### 7.1 同步 packages

```bash
# 在 N.E.K.O.-RN 项目中
cd ../N.E.K.O.-RN
node scripts/sync-neko-packages.js
```

### 7.2 检查同步结果

```bash
# 类型检查
npm run typecheck

# 运行 RN 项目
npx expo start
```

**检查点**：
- [ ] 同步脚本执行成功
- [ ] RN 项目类型检查通过
- [ ] RN 项目能正常启动

---

## 八、常见问题排查

### Q1: 类型检查失败

```bash
# 查看详细错误
npm run typecheck -- --noEmit

# 常见原因：
# - 缺少类型定义
# - 导入路径错误
# - 类型不匹配
```

### Q2: 构建失败

```bash
# 清理后重试
rm -rf node_modules dist static/bundles
npm install
npm run build:prod
```

### Q3: WebSocket 连接失败

```bash
# 检查后端是否启动
curl http://localhost:48911/health

# 检查 WebSocket 地址
# 在 .env 中配置 VITE_WEBSOCKET_URL
```

### Q4: API 请求跨域

```bash
# 开发环境通过 Vite 代理解决
# vite.web.config.ts 中已配置 proxy

# 或者后端配置 CORS
```

---

## 九、验证通过标准

一个任务被认为「完成」需要满足：

1. **代码质量**
   - [ ] TypeScript 类型检查通过
   - [ ] 无 ESLint 警告（如有配置）
   - [ ] 代码已提交

2. **功能正确**
   - [ ] 所有功能点测试通过
   - [ ] 边界情况处理正确
   - [ ] 错误处理完善

3. **构建成功**
   - [ ] 开发构建通过
   - [ ] 生产构建通过

4. **测试通过**（如适用）
   - [ ] 单元测试通过
   - [ ] E2E 测试通过

5. **文档更新**（如适用）
   - [ ] README 更新
   - [ ] API 文档更新

---

**最后更新**: 2026-02-21
