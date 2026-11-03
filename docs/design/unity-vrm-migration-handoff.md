# Unity VRM 渲染迁移交接

> **实施交接快照**：记录 `codex/rust-unity-migration` 分支截至 2026-11-03 的状态。总体目标与后续 Rust/Python 边界见 [N.E.K.O Rust 与 Unity 迁移总体路线](./rust-unity-migration-roadmap)。当前运行合同以 [VRM 模型](/zh-CN/frontend/vrm)和代码、测试为准；Unity 工程的版本、构建命令和通信协议以 `unity/NekoAvatarRenderer/README.md` 为准。

## 当前结论

提交 `b8777f99df58cb2bcb4539add7e2d154985a5904` 已完成 VRM 渲染链的源码迁移：Unity WebGL 和 UniVRM 接管 VRM 模型的载入、渲染、动画、表情、口型、视线、SpringBone、相机与帧同步，浏览器继续负责产品状态、canvas 图像导出和宿主集成。

Unity 构建与正常桌面启动链已经打通：当前机器用 Unity `2022.3.62f3` Personal、WebGL Build Support 和 UniVRM `v0.131.4` 完成了依赖解析、C# 编译、EditMode tests 与 WebGL/IL2CPP 构建，`static/unity/avatar/` 中已有 manifest 和四个运行文件。模型管理页和真实 N.E.K.O-PC Electron Pet 均已实际加载 `sister1.0.vrm`、`sensei.vrm` 和 `wait03.vrma.gz`；Electron 透明层无黑底，拖动、缩放、旋转、引导移动、输入穿透和重复换模已有可见行为证据。单显示器上的主链已可用，但多显示器物理行为、长时间动态效果、GPU 显存释放和最终冻结发行包仍不能外推为已通过。

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

- 新增唯一 Unity 源工程 `unity/NekoAvatarRenderer/`，固定 Unity `2022.3.62f3`、Built-in Render Pipeline 和 UniVRM `v0.131.4`。该版本已实测可用 Unity Personal 启动；不要改回 `2022.3.73f1`，后者属于 Extended LTS，会在 Personal 授权下拒绝启动。
- 新增统一浏览器入口 `static/unity/unity-vrm-loader.js` 和适配器 `static/unity/unity-avatar-manager.js`。
- 删除旧 Three-VRM 核心、动画、交互、视线和方向控制实现，以及 `@pixiv/three-vrm`、VRM animation 库和已无调用方的 `GLTFLoader`。
- 将主桌宠、模型管理、角色卡预览与制卡、串门取帧、性能读取，以及篮球、羽毛球、足球、你画我猜和一起看等 VRM 使用面迁到 Unity 接口。
- 保留旧调用方需要的类名和最小数据代理，但不保留旧渲染器。
- 修复 Unity 启动失败时的角色切换回退：原角色是 Live2D 时，失败后恢复切换前的 Live2D，而不是留下空白桌宠。
- 修复 WebGL shader stripping 导致 VRMA 导入默认材质为空的问题：动画辅助骨架改用构建中已保留的 `UniGLTF/UniUnlit`，不为隐藏网格引入 `Standard` 的大量 shader variants。
- 兼容 UniVRM `v0.131.4` 的 VRMA 节点删除缺陷：导入前将 expression 节点稳定移动到末尾并同步重映射 scene、层级、动画、skin、humanoid、expression 与 look-at 引用；仓库内 `wait03.vrma.gz` 已纳入真实导入回归测试。
- 修复模型平移使用世界轴造成的左右反向：屏幕位移按 Unity 相机的 `right`/`up` 轴转换，并在真实 Electron Pet 中分别向左、向右拖动核对。
- 修复历史偏好在窗口尺寸或模型边界变化后把模型恢复到屏幕外的问题：首个渲染帧后复用 Unity `model.snap` 的 200px 最小可见合同，只有实际发生修正时才保存新偏好，并用 load token 与 model generation 阻止过期加载覆盖当前模型。
- 修复透明 WebGL framebuffer，并移除羽毛球附件原语隐式创建的 Collider，避免 WebGL stripping 后的 `CapsuleCollider`/`TemplateAsset` 运行错误。
- 羽毛球和空气投篮改用通用轻量嵌入标记，不再错误加载桌宠浮动按钮模块；一起看恢复 Unity 待机动画自动播放。
- 冻结发行物检查现在会解析 `static/unity/avatar/build-manifest.json`，并确认 manifest 引用的 loader、framework、data 和 wasm 在冻结目录中均存在且非空。
- 更新 VRM、VMC、小游戏及多语言相关文档和回归测试。

## 已有验证证据

实现基线提交前完成的自动检查为：

- 受影响的 Pytest 113 项通过；
- Unity 与桌面交互相关 Node 回归 28 项通过；
- 关键 JavaScript 文件语法检查通过；
- `git diff --check` 通过。

2026-11-02 的接手验证新增以下证据：

- Unity EditMode tests 118/118 通过，0 失败、0 跳过；其中包含仓库内 `wait03.vrma.gz` 经 gzip 解压、节点归一化和 UniVRM 实际导入，以及羽毛球附件不创建 Collider 的回归测试；
- Unity WebGL/IL2CPP 构建成功，当前 manifest 指向 `7a2dbded24d57e056180125b1583e7c4.loader.js`、`7fa3d14f9a5ab4cd626e5285aa5a8071.framework.js`、`6bf0a1629296dd0aff3ede49bcfdc300.data` 和 `c5c4f19178cd8c4a71962d6565105665.wasm`；四个文件均存在且非空；
- N.E.K.O 受影响 Node 回归 147/147 通过、Pytest 629/629 通过，39 个变更 JavaScript 文件语法检查通过；
- N.E.K.O-PC 合同测试 634/634 通过（另有 41 项按条件跳过）；全量单测为 1777 通过、15 跳过、2 个环境型失败：Windows symlink 权限 `EPERM`，以及并发测试的 `PSModulePath` 污染；后者隔离运行通过。
- 后端实际提供 manifest、loader、framework、data 和 wasm；模型管理页冷加载 `sister1.0.vrm` 后自动播放 `wait03.vrma.gz`，再热切换 `sensei.vrm`，两次均有可见模型；
- N.E.K.O-PC 正常启动并复用同一后端后，Electron Pet 进入 `vrm-*` 控件分支；最新 WebGL 构建在透明桌面层实际显示 `sensei.vrm`，无黑底，待机动画持续播放；
- Electron Pet 已实测鼠标左右拖动方向与模型移动一致、滚轮缩放、右键旋转和引导移动；模型移动与缩放后的偏好可以重新加载并恢复；
- 2026-11-03 用真实 Electron 重启复现了一份把模型大半恢复到屏幕外的历史偏好；首帧修正后偏好 `position.x` 从 `1.5469953640508436` 更新并持久化为 `1.4373314380645752`，模型边界变为 `left=-167.77, right=238.56`。Unity 命中测试在模型可见点 `(25,270)`、`(42,300)` 均为 `true`，DOM 命中为 `#vrm-canvas`；实际先悬停激活透明窗口输入区，再向右拖 140px、向左拖 100px，模型均与鼠标同向移动。随后再次完整重启 Electron，缓存后启动直接恢复出可见模型，且仍能继续同向拖动；
- 透明空白点会落到后方窗口，而模型点由 Electron Unity canvas 接收，证明当前单屏下输入区域不是整屏吞事件；Windows 125% DPI 下 Electron 报告逻辑桌面 `1536×960`、`scaleFactor=1.25`，输入坐标快照已稳定；
- 角色肖像实际从 `1536×960` Unity 源画布导出 `1200×1600`，制卡页实际显示 `sensei.vrm`；空气投篮、羽毛球、足球、你画我猜和一起看均完成至少一次真实 Unity 页面冒烟，其中羽毛球开始游戏后不再出现 Collider/TemplateAsset 或 `AvatarButtonMixin` 错误；
- Electron Pet 交替加载两个 VRM 四轮后仍是同一个 RuntimeHost、同一个 Unity Player、一个 `#vrm-canvas`，待处理命令数为 0，最终成功回到 `sensei.vrm`；JS heap 有回收波动，不能据此声称 GPU 显存已完全释放；
- N.E.K.O 冻结配置和 CI 均递归包含 `static=static`；新增发行检查的 3 个测试通过，并用当前源码目录验证 manifest 的四个引用均可解析。
- 最终受影响 Node 回归补跑 24/24 通过，Python 语法检查和 `git diff --check` 通过；浏览器集成测试在消除重复并发启动后独立重跑 14/14 通过。先前组合运行的 setup 端口错误属于测试执行并发干扰，不计为代码断言失败。启动越界修复加入后，`unity_avatar_manager.test.cjs` 独立重跑 19/19 通过。

日志和 XML 位于本机临时目录，没有作为仓库产物保存；这些结果证明构建和基础运行链可用，不等于 Electron 全交互矩阵验收。

2026-10-30 首次真机尝试曾在 `/static/unity/avatar/build-manifest.json` 404 处停止。该历史阻塞现已由构建产物消除，并于 2026-11-02 重新跑通 Electron 3D 显示；不要再把该 404 当成当前阻塞。

## 当前剩余未验证项

缺少 Unity WebGL 构建产物的直接阻塞已经解除，当前产物为：

```text
static/unity/avatar/
├── Build/<内容哈希>.loader.js
├── Build/<内容哈希>.framework.js
├── Build/<内容哈希>.data
├── Build/<内容哈希>.wasm
└── build-manifest.json
```

当前没有阻断单显示器正常启动和核心 Unity VRM 交互的已知问题。以下内容仍不得标记为通过：

- 当前机器只有一块显示器，跨屏拖动、不同缩放显示器之间的 DPI 切换和跨屏输入区域没有物理条件验证；
- MToon 的多模型像素级一致性，以及表情、口型、视线和 SpringBone 的长时间动态效果尚未做录屏或像素级比较；
- 重复换模已证明不会增加 Unity Player 或 canvas，但 Chromium 没有提供可据此下结论的 Unity GPU 显存读数，仍需专用 GPU 工具做长时间压力验证；
- 已确认冻结配置会携带整个 `static/`，且新增 manifest/四文件发行门禁；但本机 `N.E.K.O-PC/bin/projectneko_server.exe` 不存在，离线模型权重也未准备齐，因此尚未生成并启动一个最终 Windows 冻结发行包。

## 最短接手路径

1. 不必重做已通过的正常启动、两个 VRM、拖动/缩放/旋转、截图/制卡、小游戏和单 Player 换模冒烟；回归时仍应使用真实 Electron Pet，而不是只看 Promise。
2. 在有双显示器且缩放比例不同的机器上补跨屏拖动、跨屏输入穿透和 DPI 切换；记录两块屏的逻辑/物理坐标与可见结果。
3. 用录屏或可重复的图像比较补表情、口型、视线、SpringBone 与 MToon 长时间动态矩阵；用 GPU 工具补连续换模压力数据。
4. 准备冻结构建要求的离线模型资产，生成 `projectneko_server.exe`，放入 `N.E.K.O-PC/bin/` 后执行桌面打包；从最终包启动并确认 Unity manifest 和四个哈希文件可访问。
5. 发现问题时先判断责任属于 Unity 渲染、浏览器桥、N.E.K.O 业务宿主还是 N.E.K.O-PC，不要重新引入 Three-VRM 作为回退路径。
6. Unity 源码或依赖变化后，按 README 重跑 EditMode tests 和 `NekoAvatarWebGLBuild.Build`，不要手工修改哈希产物或伪造 manifest。

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

- 两个内置模型、VRMA 和核心桌面交互在 Electron 中均有可见结果；仍不能外推所有第三方模型、所有动画组合和长时间运行都稳定。
- 自动回归和 Unity 测试数量可确认，但精确命令、完整日志与 XML 没有保存在仓库内。
- 透明 framebuffer 和高分辨率导出已在 Electron/制卡链观察到，后处理色调映射和透明边缘仍缺少像素级基准比较。
- WebGL 产物进入发行包的静态包含关系与门禁已经确认；最终冻结后端和 Electron 包仍未在本机生成并启动，不能把“配置正确”替代为“发行包已验收”。
