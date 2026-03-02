# N.E.K.O React 前端完整迁移执行计划

> 创建时间：2026-02-19
> 目标：将旧版 HTML/JS 前端完全迁移到 React + TypeScript，支持 Web 和 React Native 双端
> 分支：`feature/react-frontend-unified`

---

## 📊 项目概况

### 当前状态

```
✅ 已完成：
- React 前端基础架构 (frontend/)
- 共享包系统 (packages/)
- Live2D 渲染组件
- 实时聊天界面 (ChatContainer)
- WebSocket 客户端 (@project_neko/realtime)
- 音频服务 (@project_neko/audio-service)
- Live2D 右侧工具栏 (Live2DRightToolbar)
- 基础 UI 组件 (Button, StatusToast, Modal)

⏳ 待迁移：
- 旧版 HTML 模板页面 (12 个页面)
- 管理后台功能
- 配置界面
- 模型管理
- 表情管理
- 语音克隆
- Steam Workshop 集成
```

### 目标架构

```
N.E.K.O.TONG (后端 + Web 前端)
├── Python 后端 (FastAPI + WebSocket)
│   └── 提供统一 API 服务
│
└── React 前端 (frontend/)
    ├── 主应用 (src/web/App.tsx) ✅
    │   ├── Live2D 渲染
    │   ├── 实时聊天
    │   └── 语音对话
    │
    └── 管理页面 (src/web/pages/) ⏳
        ├── Live2D 设置页
        ├── API 密钥管理
        ├── 角色管理
        ├── 语音克隆
        ├── 记忆浏览器
        ├── Steam Workshop
        └── 模型管理

N.E.K.O.-RN (React Native 移动端)
└── 通过同步脚本使用共享包
    ├── @project_neko/common
    ├── @project_neko/request
    ├── @project_neko/realtime
    ├── @project_neko/audio-service
    └── @project_neko/live2d-service
```

---

## 🎯 Phase 1: 管理页面迁移 (优先级：高)

### 1.1 创建管理页面路由系统

**目标**: 建立统一的页面路由架构

**任务清单**:
- [ ] 安装 React Router (`react-router-dom`)
- [ ] 创建路由配置文件
- [ ] 实现页面布局组件 (Layout)
- [ ] 创建导航菜单组件

**文件结构**:
```
frontend/src/web/
├── router.tsx               # 路由配置
├── Layout.tsx               # 页面布局
├── components/
│   └── Navigation.tsx       # 导航菜单
└── pages/
    ├── Live2DSettings.tsx   # /l2d
    ├── ApiKeySettings.tsx   # /api_key
    ├── CharacterManager.tsx # /chara_manager
    ├── VoiceClone.tsx       # /voice_clone
    ├── MemoryBrowser.tsx    # /memory_browser
    ├── SteamWorkshop.tsx    # /steam_workshop_manager
    ├── ModelManager.tsx     # /model_manager
    └── Live2DParameterEditor.tsx # /live2d_parameter_editor
```

**完成标准**:
- ✅ 路由系统正常工作
- ✅ 可以通过 URL 访问不同页面
- ✅ 页面切换无刷新

**预计时间**: 1-2 天

---

### 1.2 API 密钥管理页面 (api_key_settings.html)

**源文件**: `templates/api_key_settings.html` (202 行)

**功能分析**:
```javascript
主要功能：
- API Key 管理界面
- 支持 5 种服务：OpenAI, Anthropic, Google, Azure, Bilibili
- 添加/删除/更新 API Key
- 本地加密存储
- 密钥显示/隐藏切换
- 密钥验证状态指示
```

**迁移任务**:
- [ ] 创建 `pages/ApiKeySettings.tsx`
- [ ] 实现表单组件
  - [ ] ApiKeyInput 组件
  - [ ] ServiceProviderSelector 组件
- [ ] 实现状态管理 (useState / useReducer)
- [ ] 集成 API 请求 (`@project_neko/request`)
- [ ] 添加国际化支持 (i18n)
- [ ] 样式迁移 (CSS → React)

**共享包更新**:
- [ ] 添加 API Key 相关类型定义到 `@project_neko/common`

**完成标准**:
- ✅ 功能与原 HTML 版本一致
- ✅ 所有 API 操作正常
- ✅ 表单验证正常
- ✅ 响应式布局

**预计时间**: 1 天

---

### 1.3 角色管理页面 (chara_manager.html)

**源文件**: `templates/chara_manager.html` (319 行)

**功能分析**:
```javascript
主要功能：
- 角色列表展示
- 角色创建/编辑/删除
- 角色头像上传
- 角色配置 (名称、描述、系统提示词)
- Live2D 模型绑定
- 表情配置管理
- 预览功能
```

**迁移任务**:
- [ ] 创建 `pages/CharacterManager.tsx`
- [ ] 实现组件
  - [ ] CharacterList 组件
  - [ ] CharacterEditor 组件
  - [ ] AvatarUploader 组件
  - [ ] ModelSelector 组件
  - [ ] EmotionConfigurator 组件
- [ ] 集成 Live2D 预览 (`@project_neko/live2d-service`)
- [ ] 实现拖拽排序 (react-beautiful-dnd)
- [ ] 图片上传和裁剪

**共享包更新**:
- [ ] 添加角色相关类型到 `@project_neko/common`
- [ ] 扩展 `@project_neko/components` 添加上传组件

**完成标准**:
- ✅ 角色增删改查正常
- ✅ 图片上传正常
- ✅ Live2D 预览正常
- ✅ 表单验证完整

**预计时间**: 2-3 天

---

### 1.4 语音克隆页面 (voice_clone.html)

**源文件**: `templates/voice_clone.html` (254 行)

**功能分析**:
```javascript
主要功能：
- 语音模型列表
- 上传音频文件
- 录制音频
- 训练语音模型
- 预览语音效果
- 模型管理 (删除/下载)
```

**迁移任务**:
- [ ] 创建 `pages/VoiceClone.tsx`
- [ ] 实现组件
  - [ ] AudioRecorder 组件 (MediaRecorder API)
  - [ ] AudioUploader 组件
  - [ ] VoiceModelList 组件
  - [ ] AudioPlayer 组件
  - [ ] TrainingProgress 组件
- [ ] 集成音频服务 (`@project_neko/audio-service`)
- [ ] 实现波形可视化

**共享包更新**:
- [ ] 添加音频录制相关工具到 `@project_neko/audio-service`

**完成标准**:
- ✅ 音频录制正常
- ✅ 文件上传正常
- ✅ 训练进度显示
- ✅ 预览播放正常

**预计时间**: 2 天

---

### 1.5 记忆浏览器页面 (memory_browser.html)

**源文件**: `templates/memory_browser.html` (253 行)

**功能分析**:
```javascript
主要功能：
- 对话记忆列表
- 按日期/角色筛选
- 搜索功能
- 记忆详情查看
- 导出功能
- 删除/编辑记忆
```

**迁移任务**:
- [ ] 创建 `pages/MemoryBrowser.tsx`
- [ ] 实现组件
  - [ ] MemoryList 组件
  - [ ] MemoryFilter 组件
  - [ ] MemorySearch 组件
  - [ ] MemoryDetail 组件
  - [ ] ExportDialog 组件
- [ ] 实现虚拟滚动 (react-window)
- [ ] 实现全文搜索

**完成标准**:
- ✅ 记忆列表加载正常
- ✅ 搜索/筛选正常
- ✅ 导出功能正常
- ✅ 分页性能良好

**预计时间**: 1-2 天

---

### 1.6 Steam Workshop 页面 (steam_workshop_manager.html)

**源文件**: `templates/steam_workshop_manager.html` (283 行)

**功能分析**:
```javascript
主要功能：
- Steam Workshop 物品列表
- 订阅/取消订阅
- 下载进度显示
- 物品详情
- 搜索和筛选
- 本地物品管理
```

**迁移任务**:
- [ ] 创建 `pages/SteamWorkshop.tsx`
- [ ] 实现组件
  - [ ] WorkshopItemList 组件
  - [ ] WorkshopItemCard 组件
  - [ ] DownloadProgress 组件
  - [ ] ItemDetailModal 组件
  - [ ] FilterPanel 组件
- [ ] 集成 Steam API
- [ ] 实现下载管理

**完成标准**:
- ✅ 列表显示正常
- ✅ 订阅功能正常
- ✅ 下载进度显示
- ✅ 搜索筛选正常

**预计时间**: 2 天

---

### 1.7 模型管理页面 (model_manager.html)

**源文件**: `templates/model_manager.html` (289 行)

**功能分析**:
```javascript
主要功能：
- Live2D/VRM 模型列表
- 模型上传
- 模型预览
- 模型配置
- 缩略图管理
- 模型删除
```

**迁移任务**:
- [ ] 创建 `pages/ModelManager.tsx`
- [ ] 实现组件
  - [ ] ModelList 组件
  - [ ] ModelUploader 组件
  - [ ] ModelPreview 组件 (集成 Live2D)
  - [ ] ModelConfigEditor 组件
  - [ ] ThumbnailManager 组件
- [ ] 文件上传和处理
- [ ] 3D 模型预览

**完成标准**:
- ✅ 模型上传正常
- ✅ 预览显示正常
- ✅ 配置保存正常
- ✅ 缩略图生成正常

**预计时间**: 2-3 天

---

### 1.8 Live2D 设置页面 (l2d 相关)

**源文件**: `templates/live2d_parameter_editor.html`, `templates/live2d_emotion_manager.html`

**功能分析**:
```javascript
主要功能：
- Live2D 参数调整
- 表情配置
- 动作管理
- 预设管理
- 实时预览
```

**迁移任务**:
- [ ] 创建 `pages/Live2DSettings.tsx`
- [ ] 创建 `pages/Live2DParameterEditor.tsx`
- [ ] 实现组件
  - [ ] ParameterSlider 组件
  - [ ] EmotionEditor 组件
  - [ ] MotionList 组件
  - [ ] PresetManager 组件
- [ ] 集成 Live2D 实时预览

**完成标准**:
- ✅ 参数调整正常
- ✅ 表情配置保存
- ✅ 实时预览正常

**预计时间**: 2 天

---

## 🎨 Phase 2: UI 组件库完善

### 2.1 扩展现有组件

**当前组件**:
- ✅ Button
- ✅ StatusToast
- ✅ Modal (AlertDialog, ConfirmDialog, PromptDialog)
- ✅ Live2DRightToolbar
- ✅ ChatContainer

**需要新增的组件**:

#### 表单组件
- [ ] Input (文本输入框)
- [ ] TextArea (多行文本)
- [ ] Select (下拉选择)
- [ ] Checkbox (复选框)
- [ ] Radio (单选按钮)
- [ ] Switch (开关)
- [ ] Slider (滑块)
- [ ] FileUpload (文件上传)
- [ ] ImageUploader (图片上传)

#### 数据展示组件
- [ ] Table (表格)
- [ ] Card (卡片)
- [ ] List (列表)
- [ ] Tree (树形结构)
- [ ] Badge (徽章)
- [ ] Tag (标签)
- [ ] Avatar (头像)
- [ ] Progress (进度条)
- [ ] Skeleton (骨架屏)

#### 反馈组件
- [ ] Loading (加载中)
- [ ] Empty (空状态)
- [ ] Error (错误状态)
- [ ] Drawer (抽屉)
- [ ] Popover (气泡卡片)
- [ ] Tooltip (工具提示)

#### 导航组件
- [ ] Menu (菜单)
- [ ] Tabs (标签页)
- [ ] Breadcrumb (面包屑)
- [ ] Pagination (分页)

**完成标准**:
- ✅ 所有组件支持 TypeScript
- ✅ 所有组件支持 i18n
- ✅ 所有组件支持主题
- ✅ 所有组件有单元测试
- ✅ 所有组件有 Storybook 文档

**预计时间**: 1-2 周

---

## 🔧 Phase 3: 共享包功能增强

### 3.1 @project_neko/request

**当前功能**: ✅ 基础 HTTP 请求、Token 管理

**需要添加**:
- [ ] 文件上传进度
- [ ] 请求重试机制
- [ ] 请求缓存
- [ ] 批量请求
- [ ] 取消请求

### 3.2 @project_neko/common

**当前功能**: ✅ 基础类型定义

**需要添加**:
- [ ] 完整的 API 类型定义
- [ ] 通用工具函数
  - [ ] 日期格式化
  - [ ] 文件处理
  - [ ] 数据验证
  - [ ] 加密/解密

### 3.3 @project_neko/audio-service

**当前功能**: ✅ 音频播放、录音

**需要添加**:
- [ ] 音频波形可视化
- [ ] 音频剪辑
- [ ] 音频格式转换
- [ ] 音量 normalization

### 3.4 @project_neko/live2d-service

**当前功能**: ✅ 基础 Live2D 控制

**需要添加**:
- [ ] 表情预设管理
- [ ] 动作队列
- [ ] 自动眨眼
- [ ] 鼠标跟随
- [ ] 碰撞检测

### 3.5 @project_neko/realtime

**当前功能**: ✅ WebSocket 连接

**需要添加**:
- [ ] 消息队列
- [ ] 离线消息
- [ ] 消息确认机制
- [ ] 心跳优化

**完成标准**:
- ✅ 所有功能有单元测试
- ✅ 所有功能有文档
- ✅ Web 和 RN 双端兼容

**预计时间**: 1 周

---

## 🌐 Phase 4: 后端集成优化

### 4.1 API 接口规范化

**任务**:
- [ ] 创建 OpenAPI 文档
- [ ] 统一错误响应格式
- [ ] 添加请求验证
- [ ] 优化 CORS 配置

### 4.2 WebSocket 协议优化

**任务**:
- [ ] 统一消息格式
- [ ] 添加消息类型定义
- [ ] 优化心跳机制
- [ ] 添加连接状态管理

### 4.3 静态资源优化

**任务**:
- [ ] 配置 CDN
- [ ] 启用 Gzip 压缩
- [ ] 添加缓存策略
- [ ] 图片优化

**完成标准**:
- ✅ API 文档完整
- ✅ 错误处理统一
- ✅ 性能优化完成

**预计时间**: 3-4 天

---

## 📱 Phase 5: React Native 集成

### 5.1 共享包同步测试

**任务**:
- [ ] 测试所有共享包在 RN 中的兼容性
- [ ] 修复平台特定问题
- [ ] 添加平台特定实现 (.native.ts)

### 5.2 RN 特有功能开发

**任务**:
- [ ] 集成 react-native-live2d
- [ ] 集成 react-native-pcm-stream
- [ ] 实现推送通知
- [ ] 实现后台音频播放
- [ ] 实现本地存储

### 5.3 RN UI 适配

**任务**:
- [ ] 响应式布局优化
- [ ] 手势交互优化
- [ ] 导航栏适配
- [ ] 键盘处理

**完成标准**:
- ✅ 共享包在 RN 中正常工作
- ✅ Live2D 在 RN 中正常渲染
- ✅ 音频在 RN 中正常播放
- ✅ 网络连接正常

**预计时间**: 1-2 周

---

## 🧪 Phase 6: 测试和文档

### 6.1 单元测试

**任务**:
- [ ] 所有组件单元测试 (目标: 80% 覆盖率)
- [ ] 所有共享包单元测试 (目标: 90% 覆盖率)
- [ ] 集成测试
- [ ] E2E 测试

### 6.2 文档

**任务**:
- [ ] API 文档
- [ ] 组件文档 (Storybook)
- [ ] 开发指南
- [ ] 部署指南
- [ ] 用户手册

### 6.3 性能优化

**任务**:
- [ ] 代码分割
- [ ] 懒加载
- [ ] 缓存优化
- [ ] Bundle 体积优化

**完成标准**:
- ✅ 测试覆盖率达标
- ✅ 文档完整
- ✅ 性能指标达标

**预计时间**: 1 周

---

## 🚀 Phase 7: 部署和发布

### 7.1 构建优化

**任务**:
- [ ] 配置生产构建
- [ ] 配置环境变量
- [ ] 配置 CDN
- [ ] 配置监控

### 7.2 部署流程

**任务**:
- [ ] 配置 CI/CD
- [ ] 配置自动测试
- [ ] 配置自动部署
- [ ] 配置回滚机制

### 7.3 发布

**任务**:
- [ ] Web 前端发布
- [ ] RN APP 打包
- [ ] 发布到 App Store / Google Play
- [ ] 发布公告

**完成标准**:
- ✅ 构建成功
- ✅ 部署成功
- ✅ 线上测试通过
- ✅ 用户反馈良好

**预计时间**: 3-5 天

---

## 📅 总体时间规划

```
Phase 1: 管理页面迁移      |████████████| 2 周
Phase 2: UI 组件库完善     |████████████████| 2-3 周
Phase 3: 共享包功能增强    |████████| 1 周
Phase 4: 后端集成优化      |████| 3-4 天
Phase 5: RN 集成          |████████████████| 1-2 周
Phase 6: 测试和文档        |████████| 1 周
Phase 7: 部署和发布        |████| 3-5 天
----------------------------------------
总计: 约 6-10 周
```

---

## 🎯 里程碑

### Milestone 1: 基础架构完成 (Week 1-2)
- ✅ 路由系统
- ✅ API 密钥管理
- ✅ 角色管理

### Milestone 2: 核心功能完成 (Week 3-4)
- ✅ 所有管理页面
- ✅ UI 组件库
- ✅ 共享包增强

### Milestone 3: 双端集成完成 (Week 5-6)
- ✅ 后端优化
- ✅ RN 集成
- ✅ 功能测试

### Milestone 4: 发布就绪 (Week 7-10)
- ✅ 测试完成
- ✅ 文档完成
- ✅ 部署发布

---

## 📋 详细任务分配

### 立即开始 (Week 1)

#### Day 1-2: 路由系统和 API Key 页面
- [ ] 安装 react-router-dom
- [ ] 创建路由配置
- [ ] 实现 ApiKeySettings 页面
- [ ] 测试 API Key 功能

#### Day 3-4: 角色管理页面
- [ ] 实现 CharacterManager 页面
- [ ] 实现角色列表和编辑
- [ ] 实现图片上传
- [ ] 测试角色管理功能

#### Day 5-7: 语音克隆和记忆浏览器
- [ ] 实现 VoiceClone 页面
- [ ] 实现 MemoryBrowser 页面
- [ ] 测试语音和记忆功能

---

## ⚠️ 风险和注意事项

### 技术风险
1. **Live2D 在 RN 中的兼容性**
   - 风险: react-native-live2d 可能不稳定
   - 缓解: 准备备用方案 (WebView 或 Lottie)

2. **音频在 RN 中的性能**
   - 风险: 实时音频处理可能有延迟
   - 缓解: 优化音频 buffer 大小

3. **WebSocket 在移动网络中的稳定性**
   - 风险: 移动网络不稳定导致断连
   - 缓解: 实现自动重连和离线消息

### 进度风险
1. **功能范围蔓延**
   - 风险: 不断添加新功能
   - 缓解: 严格遵循 MVP 原则

2. **测试时间不足**
   - 风险: 测试覆盖不完整
   - 缓解: 边开发边测试

---

## 🎉 成功标准

### 功能标准
- ✅ 所有旧版 HTML 页面功能已迁移
- ✅ Web 和 RN 双端功能一致
- ✅ 后端 API 正常工作
- ✅ Live2D 渲染正常
- ✅ 语音对话正常

### 质量标准
- ✅ 代码测试覆盖率 > 80%
- ✅ 无严重 bug
- ✅ 性能指标达标 (首屏加载 < 3s)
- ✅ 无安全漏洞

### 用户体验标准
- ✅ 响应式布局完善
- ✅ 国际化支持完善
- ✅ 错误提示友好
- ✅ 操作流畅

---

## 📞 后续支持

### 维护计划
- 定期更新依赖
- 监控线上错误
- 收集用户反馈
- 持续优化性能

### 迭代计划
- 根据用户反馈添加新功能
- 优化用户体验
- 提升性能
- 扩展平台支持

---

**准备好了吗？让我们开始 Phase 1 的第一步！** 🚀
