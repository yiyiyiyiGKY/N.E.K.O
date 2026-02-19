# React 开发服务器快速启动指南

## 🚀 快速开始

### 1. 启动开发服务器

在 `frontend` 目录下运行：

```bash
cd frontend
npm run dev
```

服务器将在 `http://localhost:5173` 启动。

### 2. 可访问的页面

开发服务器启动后，你可以通过以下 URL 访问各个页面：

| 页面 | URL | 说明 |
|------|-----|------|
| 主页 | http://localhost:5173/ | 主应用页面 |
| API 密钥 | http://localhost:5173/api_key | API 配置 |
| 角色管理 | http://localhost:5173/chara_manager | 角色管理 |
| 语音克隆 | http://localhost:5173/voice_clone | 语音克隆 |
| 记忆浏览 | http://localhost:5173/memory_browser | 记忆浏览 |
| Steam Workshop | http://localhost:5173/steam_workshop_manager | 创意工坊 |
| 模型管理 | http://localhost:5173/model_manager | 模型管理 |
| Live2D 情感 | http://localhost:5173/l2d | Live2D 情感映射 |
| Live2D 情感 (全路径) | http://localhost:5173/live2d_emotion_manager | 同上 |
| Live2D 参数 | http://localhost:5173/live2d_parameter_editor | 参数编辑器 |
| VRM 情感 | http://localhost:5173/vrm_emotion_manager | VRM 情感映射 |
| 字幕 | http://localhost:5173/subtitle | 字幕显示 |
| 查看器 | http://localhost:5173/viewer | 模型查看器 |

### 3. 使用侧边栏导航

访问任意管理页面（如 http://localhost:5173/api_key）将看到左侧侧边栏，可以通过点击导航项切换页面。

---

## ⚙️ 配置说明

### 开发服务器配置

配置文件：`frontend/vite.dev.config.ts`

主要配置：
- **端口**: 5173
- **热更新**: 已启用
- **API 代理**: `/api` → `http://localhost:48911`
- **静态资源代理**: `/static` → `http://localhost:48911`

### 环境变量

创建 `.env.local` 文件自定义配置：

```env
# API 基础 URL（后端服务器地址）
VITE_API_BASE_URL=http://localhost:48911

# 静态资源服务器 URL
VITE_STATIC_SERVER_URL=http://localhost:48911
```

---

## 🔧 开发工作流

### 1. 启动后端服务器

确保后端服务器在运行：

```bash
# 在项目根目录
python main.py
# 或
uvicorn main:app --reload --port 48911
```

### 2. 启动前端开发服务器

```bash
cd frontend
npm run dev
```

### 3. 开始开发

- 修改 `frontend/src/web/pages/` 下的文件
- 浏览器自动热更新
- 查看 TypeScript 错误在终端或浏览器控制台

---

## 📁 目录结构

```
frontend/
├── src/web/
│   ├── index.html          # 开发服务器入口
│   ├── main.tsx            # React 入口
│   ├── router.tsx          # 路由配置
│   ├── Layout.tsx          # 侧边栏布局
│   └── pages/              # 页面组件
│       ├── ApiKeySettings.tsx
│       ├── CharacterManager.tsx
│       ├── ...
├── vite.dev.config.ts      # 开发配置
└── package.json
```

---

## 🐛 调试技巧

### 1. 查看控制台
- 打开浏览器开发者工具（F12）
- 查看 Console 标签页的错误信息

### 2. 查看 Network 请求
- Network 标签页查看 API 请求
- 检查请求状态码和响应

### 3. React DevTools
- 安装 React Developer Tools 浏览器扩展
- 查看组件树和状态

### 4. TypeScript 错误
```bash
# 检查 TypeScript 错误
npx tsc --noEmit
```

---

## 🔄 热更新

开发服务器支持热更新（HMR）：

- ✅ **CSS 更改**: 立即生效，无需刷新
- ✅ **组件更改**: 保留状态，热替换
- ✅ **路由更改**: 自动刷新

---

## ⚠️ 常见问题

### 1. 端口被占用

错误信息：`Port 5173 is already in use`

解决方案：
```bash
# 查找占用端口的进程
lsof -i :5173

# 终止进程
kill -9 <PID>

# 或修改 vite.dev.config.ts 中的端口
server: {
  port: 5174, // 使用其他端口
}
```

### 2. API 请求失败

错误信息：`Network Error` 或 `CORS error`

解决方案：
1. 确认后端服务器在运行
2. 检查 `VITE_API_BASE_URL` 配置
3. 确认后端 CORS 配置允许 `http://localhost:5173`

### 3. 静态资源加载失败

错误信息：`404 Not Found` for `/static/...`

解决方案：
1. 确认后端服务器在运行
2. 检查 `VITE_STATIC_SERVER_URL` 配置
3. 确认 `/static` 目录存在

### 4. TypeScript 类型错误

错误信息：`Cannot find module...` 或类型错误

解决方案：
```bash
# 重新安装依赖
rm -rf node_modules
npm install

# 重启开发服务器
npm run dev
```

### 5. 白屏/页面不显示

检查：
1. 浏览器控制台错误信息
2. Network 标签页资源加载情况
3. 确认路由路径正确

---

## 🧪 测试特定页面

### 测试 API Key 页面
```bash
# 直接访问
open http://localhost:5173/api_key
```

测试步骤：
1. 输入 API Key
2. 点击保存
3. 查看控制台 Network 请求（目前是 mock，不会真的保存）

### 测试角色管理
```bash
open http://localhost:5173/chara_manager
```

测试步骤：
1. 修改主人档案
2. 添加新猫娘
3. 编辑猫娘信息
4. 删除猫娘

### 测试所有页面导航
```bash
open http://localhost:5173/api_key
```

然后使用左侧侧边栏导航到各个页面。

---

## 📊 性能监控

### 查看 Bundle 大小

```bash
# 构建生产版本
npm run build

# 查看 bundle 分析
ls -lh dist/webapp/
```

### 开发模式性能

开发模式下，Vite 会：
- 不压缩代码（便于调试）
- 生成 Source Maps
- 禁用 tree-shaking

**注意**: 开发模式性能不代表生产模式性能

---

## 🎨 样式调试

### 查看应用的 CSS

1. 打开浏览器开发者工具
2. Elements 标签页
3. 选择元素
4. Styles 面板查看 CSS

### 修改 CSS

编辑 `frontend/src/web/pages/*.css` 文件，保存后自动热更新。

---

## 🔌 VSCode 集成

### 推荐扩展

1. **ES7+ React/Redux/React-Native snippets**
   - 快速创建 React 组件

2. **TypeScript Importer**
   - 自动导入 TypeScript 模块

3. **Prettier - Code formatter**
   - 代码格式化

4. **Error Lens**
   - 行内显示错误信息

### launch.json 配置

创建 `.vscode/launch.json` 用于调试：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Launch Chrome against localhost",
      "url": "http://localhost:5173",
      "webRoot": "${workspaceFolder}/frontend/src/web"
    }
  ]
}
```

---

## 📝 开发日志

建议在每个开发会话开始时：

1. 拉取最新代码：`git pull`
2. 安装依赖：`npm install`
3. 启动开发服务器：`npm run dev`
4. 开始开发
5. 提交代码：`git commit`
6. 推送代码：`git push`

---

## 🚀 生产构建

开发完成后，构建生产版本：

```bash
npm run build
```

构建产物在 `dist/webapp/` 目录。

---

## 📚 相关文档

- [迁移完结报告](./react-frontend-migration-complete.md)
- [测试计划](./react-frontend-testing-plan.md)
- [项目总结](./react-frontend-migration-summary.md)

---

**提示**: 首次运行时，所有页面使用 mock 数据。要连接真实 API，请参考[测试计划](./react-frontend-testing-plan.md)中的 Phase 1。

**祝开发顺利！** 🎉
