# N.E.K.O 文档中心

> 本目录包含项目的所有技术文档

---

## 快速导航

| 我想... | 请看 |
|---------|------|
| 了解前端架构 | [frontend/](./frontend/) |
| 查看 Packages 文档 | [frontend/packages/](./frontend/packages/) |
| 验证任务完成 | [frontend/VERIFICATION_GUIDE.md](./frontend/VERIFICATION_GUIDE.md) |
| 查看开发进度 | [frontend/progress-tracker.csv](./frontend/progress-tracker.csv) |
| 了解历史规划 | [plans/](./plans/) |

---

## 目录结构

```
docs/
├── frontend/           # 前端相关文档
│   ├── packages/       # 各 Package 文档
│   ├── spec/           # 规范模板
│   ├── VERIFICATION_GUIDE.md  # 任务验证指南
│   └── progress-tracker.csv   # 开发进度表
│
├── plans/              # 历史规划文档
│   └── README.md       # 索引
│
├── README_en.md        # English README
└── README_ja.md        # 日本語 README
```

---

## 前端文档 (frontend/)

### 核心文档

| 文档 | 说明 |
|------|------|
| [README.md](./frontend/README.md) | 前端文档索引 |
| [VERIFICATION_GUIDE.md](./frontend/VERIFICATION_GUIDE.md) | 任务验证指南 |
| [progress-tracker.csv](./frontend/progress-tracker.csv) | 开发进度表 |

### Packages 文档

| Package | 说明 |
|---------|------|
| [common](./frontend/packages/common.md) | 公共类型和工具 |
| [request](./frontend/packages/request.md) | HTTP 请求封装 |
| [realtime](./frontend/packages/realtime.md) | WebSocket 封装 |
| [components](./frontend/packages/components.md) | UI 组件库 |
| [audio-service](./frontend/packages/audio-service.md) | 音频服务 |
| [live2d-service](./frontend/packages/live2d-service.md) | Live2D 服务 |

### 多端同步

| 文档 | 说明 |
|------|------|
| [packages-multi-platform.md](./frontend/packages-multi-platform.md) | 多端兼容设计 |
| [packages-sync-to-neko-rn.md](./frontend/packages-sync-to-neko-rn.md) | 同步到 RN 项目 |

---

## 历史规划 (plans/)

详见 [plans/README.md](./plans/README.md)

---

## 相关项目文档

- **N.E.K.O.-RN 移动端**: `../N.E.K.O.-RN/docs/`

---

**最后更新**: 2026-02-21
