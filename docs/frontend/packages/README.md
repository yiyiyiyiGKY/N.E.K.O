### packages 文档索引

本目录聚焦 `frontend/packages/*` 的跨端（Web / React Native）兼容设计文档。

---

## 阅读顺序

1. [common.md](./common.md) - 通用工具库
2. [request.md](./request.md) - HTTP 请求库
3. [realtime.md](./realtime.md) - WebSocket 客户端
4. [audio-service.md](./audio-service.md) - 音频服务
5. [live2d-service.md](./live2d-service.md) - Live2D 服务
6. [components.md](./components.md) - UI 组件库
7. [web-only-boundaries.md](./web-only-boundaries.md) - Web 专用边界

---

## 架构文档

| 文档 | 说明 |
|------|------|
| [packages-multi-platform.md](../packages-multi-platform.md) | packages 分层原则与入口规范 |
| [packages-sync-to-neko-rn.md](../packages-sync-to-neko-rn.md) | 同步到 N.E.K.O.-RN 的策略 |

---

## 修复记录

| 文档 | 说明 |
|------|------|
| [engines-node-version-constraint.md](./engines-node-version-constraint.md) | Node.js 版本约束 |

---

## Spec 模板

详见 [spec/](../spec/) 目录：
- Feature 模板: `template-feature-spec.md`
- Package 模板: `template-package-spec.md`
