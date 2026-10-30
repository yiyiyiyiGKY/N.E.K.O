# Unity VRM 渲染迁移交接

> **实施交接快照**：记录 `codex/rust-unity-migration` 分支在 2026-10-30 的状态。总体目标与后续 Rust/Python 边界见 [N.E.K.O Rust 与 Unity 迁移总体路线](./rust-unity-migration-roadmap)。当前运行合同以 [VRM 模型](/zh-CN/frontend/vrm)和代码、测试为准；Unity 工程的版本、构建命令和通信协议以 `unity/NekoAvatarRenderer/README.md` 为准。

## 当前结论

提交 `b8777f99df58cb2bcb4539add7e2d154985a5904` 已完成 VRM 渲染链的源码迁移：Unity WebGL 和 UniVRM 接管 VRM 模型的载入、渲染、动画、表情、口型、视线、SpringBone、相机与帧同步，浏览器继续负责产品状态、canvas 图像导出和宿主集成。

这还不是可交付的 3D 运行结果。分支中没有 `static/unity/avatar/build-manifest.json` 及其 WebGL 文件，当前机器也没有可用的 Unity Editor，因此尚未完成 C# 编译、WebGL/IL2CPP 构建和真实模型渲染验收。JavaScript 适配器存在不等于 Unity 已可运行。

本阶段不启动 Rust 重写，不重构聊天、记忆、Agent、插件或音频等业务逻辑。Python 插件环境保持现状。`N.E.K.O-PC` 仍是 Electron 窗口和桌面能力宿主，本次提交没有在 PC 仓库中再实现一套 Unity。

## 唯一渲染路径与职责

主桌宠通过以下链路进入 Unity 工程：

```text
主页面
  -> static/vrm/vrm-init.js
  -> static/unity/unity-vrm-loader.js
  -> static/unity/unity-avatar-manager.js
  -> static/unity/avatar/build-manifest.json
  -> unity/NekoAvatarRenderer 中构建出的 Unity WebGL Player
```

专用预览页和多角色小游戏可以跳过 `vrm-init.js`，但仍必须通过同一个 `unity-vrm-loader.js` 和 `UnityVRMManager` 进入上述 WebGL 构建。

Unity 通过 `SendMessage` 接收版本化命令，通过 `window.NekoUnityAvatar.onUnityEvent` 回传结果。`window.VRMManager` 只是 `UnityVRMManager` 的兼容名称，两者是同一个类，不是两套管理器。`currentModel.vrm` 只保留 expression、humanoid、meta 和空 `update()` 等旧调用方需要的最小兼容代理，不包含 Three.js 的 scene、camera 或 renderer。

| 边界 | 当前责任 |
| --- | --- |
| Unity `unity/NekoAvatarRenderer/` | VRM 0.x/1.0 导入、VRMA、姿态、表情、口型、视线、SpringBone、灯光、相机、模型边界、附件和渲染 |
| 浏览器适配层 `static/unity/` | WebGL Player 启动、canvas 生命周期、输入转换、命令与事件桥接、旧调用方兼容 |
| N.E.K.O 页面与后端 | 角色选择、配置、偏好、聊天、Agent、插件、音频、模型 API、VMC 传输及各页面接入 |
| N.E.K.O-PC | 加载 N.E.K.O 主页面，提供原生窗口、IPC、多屏和桌面交互能力 |
| MMD | 继续使用 Three.js；这是 PMX/PMD/VMD 的现有实现，不是第二条 VRM 路径 |
| Live2D 与 PNGTuber | 保持各自现有渲染器，与 Unity VRM 并列为不同角色格式 |

多角色小游戏可以创建多个 `UnityVRMManager` 实例，但所有实例仍加载同一份 WebGL 构建和同一套协议；这是同一实现的多实例使用，不是重复工程。

## 已完成范围

- 新增唯一 Unity 源工程 `unity/NekoAvatarRenderer/`，固定 Unity `2022.3.73f1`、Built-in Render Pipeline 和 UniVRM `v0.131.4`。
- 新增统一浏览器入口 `static/unity/unity-vrm-loader.js` 和适配器 `static/unity/unity-avatar-manager.js`。
- 删除旧 Three-VRM 核心、动画、交互、视线和方向控制实现，以及 `@pixiv/three-vrm`、VRM animation 库和已无调用方的 `GLTFLoader`。
- 将主桌宠、模型管理、角色卡预览与制卡、串门取帧、性能读取，以及篮球、羽毛球、足球、你画我猜和一起看等 VRM 使用面迁到 Unity 接口。
- 保留旧调用方需要的类名和最小数据代理，但不保留旧渲染器。
- 修复 Unity 启动失败时的角色切换回退：原角色是 Live2D 时，失败后恢复切换前的 Live2D，而不是留下空白桌宠。
- 更新 VRM、VMC、小游戏及多语言相关文档和回归测试。

## 已有验证证据

提交前完成的自动检查为：

- 受影响的 Pytest 113 项通过；
- Unity 与桌面交互相关 Node 回归 28 项通过；
- 关键 JavaScript 文件语法检查通过；
- `git diff --check` 通过。

当次完整测试命令和日志未作为仓库产物保存，只有提交记录保留了结果数量；后续不能把这些数量当作 Unity 真机验收。

本轮还实际启动了 N.E.K.O 后端和 N.E.K.O-PC 的 Electron Pet 窗口，并用仓库中的 `static/vrm/sister1.0.vrm` 触发 VRM 切换。请求已进入 Unity 管理器，随后因 `/static/unity/avatar/build-manifest.json` 返回 404 而停止。这证明桌面端到 Unity 启动器的接线已生效，也复现并验证了 Live2D 失败回退；它没有证明 Unity 已渲染出 3D 模型。

## 当前阻塞与未验证项

当前直接阻塞是缺少 Unity WebGL 构建产物。构建器应生成：

```text
static/unity/avatar/
├── Build/<内容哈希>.loader.js
├── Build/<内容哈希>.framework.js
├── Build/<内容哈希>.data
├── Build/<内容哈希>.wasm
└── build-manifest.json
```

在完成真实构建前，以下内容均不得标记为通过：

- Unity Editor 导入、依赖解析和 C# 编译；
- WebGL/IL2CPP 构建及产物打包；
- `sister1.0.vrm` 和 `sensei.vrm` 的真实渲染；
- 透明背景、MToon、VRMA、表情、口型、视线和 SpringBone；
- 拖动、缩放、右键旋转、引导移动、截图与卡面高分辨率输出；
- Electron Pet 输入区域、多屏和 DPI 行为；
- 连续换模后的 GPU 内存和 Unity Player 释放。

## 最短接手路径

1. 在 `codex/rust-unity-migration` 分支确认历史包含实现基线 `b8777f99df58cb2bcb4539add7e2d154985a5904`；文档等后续提交可以位于其上，但不要从其他正在开发的分支继续。
2. 安装并激活 Unity `2022.3.73f1`，同时安装 WebGL Build Support。按 `unity/NekoAvatarRenderer/README.md` 运行 EditMode tests；先处理真实的导入或编译错误，不要绕过失败生成假产物。
3. 按同一 README 运行 `Neko.Avatar.Editor.NekoAvatarWebGLBuild.Build`。确认 manifest 引用的 loader、framework、data 和 wasm 均存在、非空且可由 N.E.K.O 静态服务访问。
4. 在 N.E.K.O 仓库执行 `uv sync` 和 `uv run python launcher.py`。服务可用后，在 N.E.K.O-PC 仓库执行 `npm start`，使 Pet 窗口加载该 N.E.K.O 实例。
5. 先用 `static/vrm/sister1.0.vrm` 完成主链验收，再用 `static/vrm/sensei.vrm` 检查换模和兼容性。浏览器开发页只能作为补充，最终结论必须来自真实 Electron Pet。
6. 按下一节逐项验收；发现问题时先判断责任属于 Unity 渲染、浏览器桥、N.E.K.O 业务宿主还是 N.E.K.O-PC，不要重新引入 Three-VRM 作为回退路径。

## 完成门槛

只有同时满足以下条件，才可把“Unity 引入并可良好使用 3D”标记为完成：

- Unity EditMode tests、WebGL 构建和现有相关 Python/Node 回归通过；
- manifest 及其全部构建文件可被后端提供，冷启动和缓存后启动都成功；
- 仓库内两个 VRM 均能在 Electron Pet 中显示，透明背景无黑底或明显透明边缘错误；
- 模型切换失败可恢复原角色，成功切换不会留下旧 Player、旧输入区域或重复事件监听；
- 待机与 VRMA、表情、口型、视线、SpringBone、拖动、缩放、旋转和引导移动可用；
- 制卡、角色卡预览、串门取帧、性能读取和已迁移小游戏至少完成一次真实 Unity 冒烟测试；
- 多屏 DPI、窗口输入穿透和连续换模后的资源释放没有阻断性问题；
- 最终 diff 不包含 Unity `Library/`、`Temp/`、`Logs/`、`obj/` 等本地目录，也不混入 `.agent/` 诊断资料。

## 关键维护入口

- 总体迁移顺序与长期边界：`docs/design/rust-unity-migration-roadmap.md`
- 当前 VRM 运行合同：`docs/zh-CN/frontend/vrm.md`
- Unity 工程构建、完整协议和真机检查表：`unity/NekoAvatarRenderer/README.md`
- 浏览器统一加载入口：`static/unity/unity-vrm-loader.js`
- 浏览器兼容与生命周期适配：`static/unity/unity-avatar-manager.js`
- Unity 命令处理：`unity/NekoAvatarRenderer/Assets/NekoAvatar/Runtime/NekoAvatarController.cs`
- Unity 协议类型：`unity/NekoAvatarRenderer/Assets/NekoAvatar/Runtime/NekoAvatarProtocol.cs`
- 原生 WebGL 回调：`unity/NekoAvatarRenderer/Assets/Plugins/WebGL/NekoAvatarBridge.jslib`
- 可恢复发布构建器：`unity/NekoAvatarRenderer/Assets/NekoAvatar/Editor/NekoAvatarWebGLBuild.cs`

## 不确定点

- C# 和 UniVRM API 只做过源码审查；没有 Unity Editor 编译结果可以确认其实际可用性。
- 自动回归的通过数量可确认，但当次精确命令和完整日志没有保存在仓库内。
- 透明 framebuffer、后处理色调映射和高分辨率截图的实现意图已写入代码，但只能由真实 WebGL Player 和 Electron 合成结果验证。
- WebGL 产物应如何进入最终桌面发行包，仍需结合现有打包流程做一次端到端检查；不能仅凭 `.gitignore` 中允许跟踪该目录就断定发行包已经包含它。
