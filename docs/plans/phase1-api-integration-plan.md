# Phase 1: API 集成实施计划

## 概述

将 React 前端页面的 mock 数据替换为真实的后端 API 调用，使用现有的 `@project_neko/request` 库。

## 现状分析

### 已有资源
- **Request 库**: `@project_neko/request` (packages/request/) - 基于 axios，支持 token 刷新、拦截器
- **后端 API**: FastAPI 后端，所有端点已定义并可用
- **前端页面**: 10+ 页面组件，目前使用 mock 数据

### 需要修改的页面
1. `ApiKeySettings.tsx` - API 配置
2. `CharacterManager.tsx` - 角色管理
3. `VoiceClone.tsx` - 语音克隆
4. `MemoryBrowser.tsx` - 记忆浏览
5. `SteamWorkshop.tsx` - Steam 工坊
6. `ModelManager.tsx` - 模型管理
7. `Live2DParameterEditor.tsx` - Live2D 参数编辑
8. `Live2DEmotionManager.tsx` - Live2D 情感管理
9. `VRMEmotionManager.tsx` - VRM 情感管理

---

## 实施方案

### 方案选择：服务层模式

创建独立的 API 服务模块，每个模块对应一个页面或一组相关功能。

**优势**:
- 关注点分离，易于维护
- 便于测试和 mock
- 类型安全
- 可复用

**目录结构**:
```
frontend/src/web/api/
├── client.ts          # 统一的 API 客户端配置
├── config.ts          # 配置相关 API (ApiKeySettings)
├── characters.ts      # 角色管理 API (CharacterManager)
├── voice.ts           # 语音相关 API (VoiceClone)
├── memory.ts          # 记忆相关 API (MemoryBrowser)
├── workshop.ts        # Steam 工坊 API
├── models.ts          # 模型管理 API
├── live2d.ts          # Live2D 相关 API
└── vrm.ts             # VRM 相关 API
```

---

## 分步实施

### Step 1: 创建 API 客户端 (client.ts)
- 配置 request 客户端实例
- 设置 baseURL、超时
- 配置错误处理

### Step 2: 创建 API 服务模块
按优先级顺序：

1. **config.ts** - 配置 API (ApiKeySettings)
   - `getCoreConfig()` - GET /api/config/core_api
   - `updateCoreConfig(data)` - POST /api/config/core_api
   - `getApiProviders()` - GET /api/config/api_providers

2. **characters.ts** - 角色 API (CharacterManager)
   - `getCharacters()` - GET /api/characters/
   - `updateMaster(data)` - POST /api/characters/master
   - `addCatgirl(data)` - POST /api/characters/catgirl
   - `updateCatgirl(name, data)` - PUT /api/characters/catgirl/:name
   - `deleteCatgirl(name)` - DELETE /api/characters/catgirl/:name

3. **voice.ts** - 语音 API (VoiceClone)
   - `getVoices()` - GET /api/characters/voices
   - `voiceClone(formData)` - POST /api/characters/voice_clone
   - `deleteVoice(voiceId)` - DELETE /api/characters/voices/:id

4. **memory.ts** - 记忆 API (MemoryBrowser)
   - `getRecentFiles()` - GET /api/memory/recent_files
   - `getRecentFile(name)` - GET /api/memory/recent_file
   - `saveRecentFile(data)` - POST /api/memory/recent_file/save

5. **models.ts** - 模型 API (ModelManager)
   - `getModels()` - GET /api/live2d/models

6. **workshop.ts** - 工坊 API (SteamWorkshop)
   - 后续探索

7. **live2d.ts** - Live2D API
   - 后续探索

8. **vrm.ts** - VRM API
   - 后续探索

### Step 3: 更新页面组件
逐个页面替换 mock 数据为 API 调用

### Step 4: 添加错误处理
- Toast 通知组件
- 错误边界
- 加载状态

---

## API 端点映射

### ApiKeySettings
| 功能 | 方法 | 端点 |
|------|------|------|
| 获取配置 | GET | /api/config/core_api |
| 保存配置 | POST | /api/config/core_api |
| 获取服务商列表 | GET | /api/config/api_providers |

### CharacterManager
| 功能 | 方法 | 端点 |
|------|------|------|
| 获取所有角色 | GET | /api/characters/ |
| 保存主人档案 | POST | /api/characters/master |
| 创建猫娘 | POST | /api/characters/catgirl |
| 更新猫娘 | PUT | /api/characters/catgirl/:name |
| 删除猫娘 | DELETE | /api/characters/catgirl/:name |
| 获取 Live2D 模型 | GET | /api/characters/current_live2d_model |

### VoiceClone
| 功能 | 方法 | 端点 |
|------|------|------|
| 获取语音列表 | GET | /api/characters/voices |
| 克隆语音 | POST | /api/characters/voice_clone |
| 删除语音 | DELETE | /api/characters/voices/:voice_id |
| 预览语音 | GET | /api/characters/voice_preview |

### MemoryBrowser
| 功能 | 方法 | 端点 |
|------|------|------|
| 获取记忆文件列表 | GET | /api/memory/recent_files |
| 获取单个记忆文件 | GET | /api/memory/recent_file |
| 保存记忆文件 | POST | /api/memory/recent_file/save |
| 获取整理配置 | GET | /api/memory/review_config |
| 保存整理配置 | POST | /api/memory/review_config |

---

## 类型定义

所有 API 响应需要定义 TypeScript 类型，放在各服务模块中。

---

## 实施顺序

1. ✅ 分析现有代码和 API
2. 🔲 创建 `client.ts` - API 客户端配置
3. 🔲 创建 `config.ts` - 配置 API 服务
4. 🔲 更新 `ApiKeySettings.tsx`
5. 🔲 创建 `characters.ts` - 角色 API 服务
6. 🔲 更新 `CharacterManager.tsx`
7. 🔲 创建 `voice.ts` - 语音 API 服务
8. 🔲 更新 `VoiceClone.tsx`
9. 🔲 创建 `memory.ts` - 记忆 API 服务
10. 🔲 更新 `MemoryBrowser.tsx`
11. 🔲 依次完成其他页面...

---

## 风险和注意事项

1. **Token 刷新**: 后端可能没有 `/api/auth/refresh` 端点，需要确认
2. **CORS**: 确保后端配置了正确的 CORS 头
3. **错误处理**: 统一错误格式，提供友好的用户提示
4. **加载状态**: 所有 API 调用都需要显示加载状态
5. **数据验证**: 前端验证 + 后端验证双重保障
