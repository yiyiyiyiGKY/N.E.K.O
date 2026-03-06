# Branch Comparison: feature/react_native vs react-rewrite

> Document generated on: 2026-03-06
> Base comparison: `nekorepo/react-rewrite` vs `feature/react_native` (HEAD)

## Overview

This document compares the differences between the `feature/react_native` branch (current development branch) and the `react-rewrite` branch from the upstream repository.

| Metric | Value |
|--------|-------|
| Commits ahead (feature/react_native) | 246 |
| Commits behind (react-rewrite) | 29 |
| Files changed | 811 |
| Lines added | ~186,926 |
| Lines removed | ~37,015 |

---

## Key Differences Summary

### feature/react_native Branch Focus

The `feature/react_native` branch is primarily focused on:

1. **Backend Feature Enhancements** - Significant improvements to backend services
2. **P2P LAN Proxy** - New peer-to-peer LAN connectivity solution (replaced FRP)
3. **Multi-platform CI/CD** - Cross-platform build pipeline
4. **Audio System Improvements** - Enhanced TTS and audio processing
5. **Live2D/VRM Enhancements** - Better model interaction and rendering

### react-rewrite Branch Focus

The `react-rewrite` branch is primarily focused on:

1. **React Frontend Migration** - Complete rewrite of frontend using React
2. **WebSocket Real-time Communication** - New real-time WebSocket package
3. **Audio Service Package** - Dedicated audio service architecture
4. **Chat System Migration** - New MessageList and ChatInput components
5. **Cross-platform Frontend** - Unified frontend for web and mobile

---

## Major Features in feature/react_native (Not in react-rewrite)

### 1. P2P LAN Proxy System

Complete P2P LAN proxy implementation for mobile frontend connectivity without requiring internet.

- **Backend**: `lan_proxy.py` - P2P signaling and connection management
- **Frontend UI**: QR code generation and connection status display
- **Fix**: macOS LAN IP detection issue resolved

```
Related commits:
- feat: 添加 P2P LAN Proxy 前端 UI
- feat: 添加 P2P LAN Proxy 后端支持
- fix(lan_proxy): 修复 macOS 上无法获取 LAN IP 导致二维码生成 127.0.0.1 的问题
```

### ~~2. FRP Reverse Proxy Integration~~ (已移除)

> ⚠️ **注意**: FRP 功能已被移除，由 P2P LAN Proxy 方案替代。

FRP (Fast Reverse Proxy) 曾用于远程访问能力，但已被更轻量的 P2P LAN Proxy 方案取代。

- ~~FRP binary packaging via PyInstaller~~
- ~~Lifecycle management module~~
- ~~Port and token configuration~~

```
Related commits (历史记录):
- feat: launcher 集成 FRP 反向代理
- feat: 新增 FRP 反向代理端口和 token 配置项
- feat: 新增 FRP 反向代理生命周期管理模块
- chore: PyInstaller 打包 FRP 二进制

移除状态:
- frp_manager.py 已从工作目录删除
```

### 2. Cross-Platform CI/CD Pipeline

Comprehensive build pipeline for multiple platforms (Windows, macOS, Linux).

```
Related commits:
- Feat/ci cross platform build (#364, #362, #357, #355, #354, #353)
```

### 3. Browser Use Integration

New browser automation adapter and enhanced browser session management.

- `brain/browser_use_adapter.py` - Browser automation integration
- System Chrome path detection
- GeoIP awareness for BrowserUse
- Enhanced error handling

```
Related commits:
- feat(browser): add system Chrome path detection and improve browser selection logic
- Added GeoIP awareness for BrowserUse
```

### 4. Audio System Improvements

Major enhancements to the TTS and audio processing pipeline.

- Audio silence remover with unit tests
- Improved audio chunk handling
- TTS interrupt handling fixes
- Server-side audio format negotiation (PCM for React Native)

```
Related commits:
- feat: add audio silence remover with unit tests (#367)
- feat(tts): improve audio chunk handling and speech id management (#389)
- feat: 服务端音频格式协商，支持 RN 端 PCM 输出
- Fix TTS interrupt handling to prevent stale audio leakage (#388)
```

### 5. Live2D & VRM Enhancements

Improved model interaction, rendering, and expression handling.

- Enhanced expression handling in Live2DManager
- Unified avatar popup behavior
- Model loading optimizations
- Smooth recovery for expressions and actions

```
Related commits:
- feat: enhance expression handling in Live2DManager
- feat: unify avatar popup behavior across Live2D and VRM
- feat: enhance Live2D and VRM model interaction and rendering
- 优化动作预览功能，清除在途的恢复定时器
```

### 6. Cookies Login System

New web-based cookies login functionality with i18n support.

- `main_routers/cookies_login_router.py`
- Memory leak fixes
- Mobile adaptation

```
Related commits:
- feat(cookies_login): add i18n, optimize UI, fix memory leak and adapt mobile (#366)
```

### 7. Steam Workshop Support

Enhanced Steam Workshop model scanning and path management.

- Workshop directory scanning
- Steam workshop path persistence
- Workshop model identification in UI

```
Related commits:
- 添加对steam创意工坊目录的扫描防止模型管理页面找不到模型 (#384)
- Persist Steam workshop path as startup fallback (#387)
- (可选)为模型管理界面中的steam创意工坊模型添加标识 (#393)
```

### 8. Web Scraper Enhancements

Expanded web scraping capabilities for proactive chat.

- Bilibili personal dynamics support
- Weibo personal dynamics support

```
Related commits:
- feat(web_scraper): 新增自主搭话中B站和微博个人动态内容支持 (#333)
```

### 9. Internationalization

Added Russian language support across frontend and backend.

```
Related commits:
- feat: add Russian (ru) language support across frontend and backend (#349)
```

---

## Major Features in react-rewrite (Not in feature/react_native)

### 1. React Frontend Architecture

Complete React-based frontend architecture rewrite.

- TinyEmitter consolidation
- Improved package architecture
- Component-based design

```
Related commits:
- [React] refactor(frontend): consolidate TinyEmitter and improve package architecture (#250)
```

### 2. Real-time WebSocket Package

Dedicated real-time communication package for cross-platform support.

- WebSocket-based real-time communication
- Web-bridge binding

```
Related commits:
- feat(frontend): add cross-platform realtime (WebSocket) package + web-bridge binding (#203)
- [React] Feat/webapp realtime ws (#223)
```

### 3. Chat System Components

New React-based chat interface components.

- MessageList component
- ChatInput component
- Collapsible chat panel

```
Related commits:
- [React] Chat System Migration (MessageList & ChatInput Demo) (#207)
- [react] add collapsible chat panel and improve input layout (#246)
```

### 4. Audio Service Package

Dedicated audio service package for frontend.

```
Related commits:
- [React] Feat/audio service package (#225)
```

### 5. Chat Screenshot Feature

Built-in chat screenshot functionality.

```
Related commits:
- [React] add chat screenshot feature (#228)
```

### 6. Demo Route and Fullscreen Layout

New demo route for showcasing and fullscreen chat layout.

```
Related commits:
- feat(web): add demo route and fullscreen chat layout (#236)
```

### 7. QR Code for Mobile Connection

QR code component to show backend IP for mobile frontend connection.

```
Related commits:
- [React] feat(components): add QrMessageBox component (#234)
- [React] feat:add QR code to show backend ip to mobile frontend. (#227)
```

---

## File Structure Changes

### New Major Files in feature/react_native

| File | Description |
|------|-------------|
| `lan_proxy.py` | P2P LAN proxy implementation |
| ~~`frp_manager.py`~~ | ~~FRP reverse proxy management~~ (已移除) |
| `brain/browser_use_adapter.py` | Browser automation adapter |
| `brain/agent_session.py` | Agent session management |
| `main_logic/agent_event_bus.py` | Agent event bus system |
| `main_routers/cookies_login_router.py` | Cookies login endpoint |
| `utils/audio_silence_remover.py` | Audio silence removal utility |
| `utils/port_utils.py` | Port management utilities |
| `utils/ssl_env_diagnostics.py` | SSL diagnostics utility |

### Removed/Refactored in feature/react_native

| Module | Status |
|--------|--------|
| `frp_manager.py` | Removed (replaced by P2P LAN Proxy) |
| `brain/mcp_client.py` | Removed (295 lines) |
| `brain/planner.py` | Removed (200 lines) |
| `brain/processor.py` | Removed (161 lines) |
| `brain/s3/` | Removed entirely |
| `utils/translation_service.py` | Removed (-353 lines) |
| `main_routers/ip_qrcode_router.py` | Removed (moved to lan_proxy) |

### Directory Restructure

- `brain/s2_5/` and `brain/s3/` consolidated into `brain/cua/`
- Enhanced `main_routers/` with new routers
- Expanded `utils/` with new utilities

---

## Architecture Changes

### Agent System Refactoring

The agent system has been significantly refactored:

1. **Removed MCP Client** - No longer using Model Context Protocol client
2. **Browser Use Integration** - New browser automation capabilities
3. **Agent Event Bus** - New event-driven architecture for agent communication
4. **Computer Use Enhancement** - Improved computer use functionality

### TTS Pipeline Improvements

- Enhanced TTS client with better error handling
- Audio format negotiation for different clients
- Improved interrupt handling
- Silence removal for cleaner audio output

### Configuration System

- Expanded `utils/config_manager.py` (+963 lines)
- Enhanced `config/__init__.py` (+524 lines)
- Updated `config/prompts_sys.py` (+1333 lines)

---

## Testing

### New Test Files

- `tests/unit/test_audio_silence_remover.py` - 607 lines
- `tests/unit/test_audio_silence_integration.py` - 341 lines
- `tests/unit/test_text_chat.py` - 380 lines
- `tests/unit/test_voice_session.py` - 189 lines
- `tests/unit/test_video_session.py` - 149 lines
- `tests/unit/test_providers.py` - 80 lines

---

## Merge Considerations

### Potential Conflicts

1. **Frontend Code** - React rewrite changes may conflict with LAN proxy frontend additions
2. **WebSocket Handling** - Both branches modified WebSocket implementations
3. **Audio Pipeline** - Different approaches to audio handling
4. **Configuration** - Both branches expanded configuration management

### Recommended Merge Strategy

1. **Backend Features** - Merge `feature/react_native` backend changes first
2. **Frontend Migration** - Then integrate `react-rewrite` frontend changes
3. **Resolve Conflicts** - Carefully resolve conflicts in:
   - `main_server.py`
   - `main_routers/websocket_router.py`
   - Audio-related files
4. **Testing** - Run full test suite after merge

---

## Conclusion

The two branches have evolved in complementary but different directions:

- **feature/react_native**: Focuses on backend capabilities, connectivity (P2P LAN Proxy), audio processing, and multi-platform deployment
- **react-rewrite**: Focuses on modern frontend architecture using React, real-time communication, and improved UX

A successful merge would combine the robust backend capabilities of `feature/react_native` with the modern frontend architecture of `react-rewrite`.
