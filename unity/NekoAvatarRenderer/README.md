# N.E.K.O Unity Avatar Renderer

这是 N.E.K.O 桌面 Pet 页的 Unity WebGL 3D 渲染工程。它只拥有 3D 画面：VRM 载入、相机、光照、表情、口型、视线、弹簧骨与 VRMA 动画；角色选择、聊天、记忆、Agent、插件、音频播放和窗口生命周期仍由现有 N.E.K.O / N.E.K.O-PC 负责。

## 固定版本

- Unity `2022.3.73f1`（Built-in Render Pipeline）
- UniVRM `v0.131.4`
- WebGL（透明 framebuffer、未压缩构建文件，直接由 FastAPI 静态资源服务提供）

UniVRM 同时把 VRM 0.x 迁移到 VRM 1.0 runtime，因此同一个载入入口处理 `.vrm` 0.x 与 1.0。Built-in Render Pipeline 是有意选择：仓库内置模型是 VRM 1.0，同时仍需正确显示用户导入的 VRM 0.x；UniVRM 对 VRM 0.x MToon 在 Built-in 下支持完整，URP 会退化为 Unlit。

## 构建

在已激活许可证、装有 WebGL Build Support 的 Unity Editor 上执行：

```bash
/Applications/Unity/Hub/Editor/2022.3.73f1/Unity.app/Contents/MacOS/Unity \
  -batchmode -quit \
  -projectPath "$PWD/unity/NekoAvatarRenderer" \
  -executeMethod Neko.Avatar.Editor.NekoAvatarWebGLBuild.Build
```

默认输出到：

```text
static/unity/avatar/
├── Build/<build-name>.loader.js
├── Build/<build-name>.framework.js
├── Build/<build-name>.data
├── Build/<build-name>.wasm
└── build-manifest.json
```

可用 `NEKO_UNITY_WEBGL_OUTPUT` 指定绝对输出目录，`NEKO_UNITY_WEBGL_PUBLIC_BASE` 指定清单中的公开 URL 前缀。构建器会创建仅含 `NekoAvatarController` 的临时场景，构建完成后删除临时场景，不修改业务配置。

构建先写入正式目录旁的唯一 staging 目录，确认 loader、data、framework、wasm 均存在且非空并生成 manifest 后，才替换正式目录；构建或发布失败会保留/恢复上一份完整产物。生成文件使用 Unity 内容哈希命名，manifest 每次启动重新校验，避免浏览器或 Unity data cache 复用旧 player。已有的非空输出目录必须包含 `build-manifest.json`，构建器不会覆盖无法识别的普通目录。临时场景以 additive 模式创建且使用唯一资产路径，构建完成后恢复原活动场景；构建期间临时调整的 Player、Graphics Tier 与 always-included shader 设置也会恢复。

## 页面通信

页面通过 Unity WebGL `SendMessage("NekoAvatarRuntime", "HandleCommand", json)` 下发统一信封，Unity 通过 `window.NekoUnityAvatar.onUnityEvent(json)` 返回结果。命令形状为 `{v:1,id,generation,command,body}`，事件形状为 `{v:1,name,replyTo,ok,generation,body,error}`。模型和动画异步结果使用 `replyTo` 对应原始命令 `id`，并用 `generation` 丢弃旧模型的迟到结果；动画载入也会拒绝已失效的模型代次。

主要方法：

| command | body | 作用 |
| --- | --- | --- |
| `model.load` | `{url,awaitInitialAnimation}` | 原子载入 VRM 0.x / 1.0；调用方明确是否等待首动画 |
| `model.unload` | `{}` | 释放模型与动画 |
| `model.transform` | `{position,rotation,scale}` | 设置模型变换，`rotation` 按 Three.js 约定使用弧度 |
| `model.dragPixels` | `{dx,dy,width,height,clamp,minVisiblePixels?}` | 桌面拖动；`clamp` 缺省 true，在 Unity 内原子约束横、纵可见范围，默认各至少 200 CSS 像素；goodbye/return 显式 false 时保留自由偏移 |
| `model.zoom` | `{delta,factor?}` | `factor>0` 按 0.2–5 的相邻双指比例乘当前 scale，否则保留滚轮 `delta` 语义 |
| `model.orbit` | `{phase,interactionId,x,y}` | 右键绕当前模型 bounds 中心旋转；start 缓存起点，update 按累计指针位移 × 0.005 弧度幂等计算，end/cancel 保留结果；迟到 phase 必须匹配 interactionId 与 generation |
| `model.moveToScreen` / `model.moveCancel` | `{x,y,maxSpeed,acceleration,deceleration,arrival,minVisiblePixels,actionId}` / `{actionId}` | 把 canvas 左上原点 CSS 坐标投影到模型所在的相机平面，在边界内加减速移动并面向行进方向；到达后平滑恢复出发 yaw，取消只接受匹配 actionId |
| `model.fit` | `{width,height,mode,align,padding,scaleMultiplier,autoScale,minWidth,minHeight,viewScale,viewX,viewY}` | 只调整正交相机；支持 contain/cover/native/width/height、bottom-center 等对齐及 Drawing 百分比 view，不改模型 transform |
| `model.snap` | `{minVisiblePixels?,animate}` | 以 Unity 当前未裁剪 bounds 把越界模型拉回；返回 `{moved,transform,bounds}`，`animate:true` 使用既有 260ms 回弹曲线 |
| `model.snapshot` | `{}` | 读取当前 `position/rotation/scale` 供现有偏好持久化 |
| `model.profile` | `{}` | 返回 Unity 场景可验证的几何、材质/纹理、骨骼、SpringBone 与静态 draw-call 估算；不伪造 Three/GPU 信息 |
| `model.visibility` | `{visible}` | 显示/隐藏 avatar 与其手持附件，并与初始动画防 T-pose 隐藏状态合并 |
| `expression.set` / `expression.reset` | `{name,value,resetOthers}` | 设置或重置表情 |
| `expression.setWeights` | `{weights:[{name,value}]}` | 一次批量写入多个表情权重 |
| `viseme.set` | `{name,value}` | 保留单元音口型接口（`aa` 平滑驱动） |
| `viseme.setWeights` | `{aa,ih,ou,ee,oh}` | 一次更新并覆盖五元音口型权重 |
| `lookAt.pointer` / `lookAt.enable` | `{x,y}` / `{enabled}` | 视线跟随 |
| `animation.play` | `{url,loop,timeScale,fadeDuration,immediate,movement,actionId}` | 载入并播放 VRMA / VRMA.GZ；`movement` 保留旋转但滤掉 authored hips 位移；接受 HTTP(S)、同源路径与 HTTP(S) `blob:` URL |
| `animation.seek` / `animation.stop` | `{seconds,paused}` / `{actionId,preservePending}` | 跳转或停止 VRMA；采样目标帧后 `paused:true` 冻结、`paused:false` 恢复该动画，保护式 stop 只停止匹配 action，且不取消在途新动作 |
| `animation.setPaused` | `{actionId,paused}` | 只暂停/恢复匹配的当前 action，不重置播放进度或全局相机 |
| `pose.set` / `pose.reset` | `{poseId,reset,rootOffset,bones:[{name,eulerRadians,weight}]}` / `{poseId}` | 在 UniVRM runtime 之后的 LateUpdate，以 raw rest rotation × delta 驱动通用 humanoid 姿态；不写偏好 |
| `accessory.attach` | `{id,preset,bone,position,eulerRadians,scale:{x,y,z},anchors:[{name,localPosition}]}` | 把内置 `badmintonRacket` / `badmintonShuttle` 程序化附件挂到 raw humanoid 骨骼；骨骼或 preset 缺失时明确失败 |
| `accessory.setVisible` / `accessory.detach` | `{id,visible}` / `{id}` | 控制附件可见或释放附件资源 |
| `anchor.track` | `{tracks:[{name,bone?,accessoryId?,anchor?,localPosition?}]}` | 跟踪骨骼或附件锚点；每帧发送 `anchor.screen`，坐标为 canvas 左上原点 CSS 逻辑像素，并带 `width/height/visible/behindCamera` |
| `render.settings` / `render.quality` | `{lighting}` / `{quality,targetFrameRate,antiAliasing,shadows}` | 独立 key/fill/rim/top/bottom 定向灯、环境光与 low/medium/high 渲染质量；帧率 `0` 取消限帧，15–120 限帧，负值或未提供时保持现状 |
| `render.pause` / `render.resume` | `{}` | 暂停或恢复 Unity 渲染 |
| `surface.resize` | `{width,height}` | 只同步 CSS 逻辑尺寸、相机 aspect 与模型边界，不重新 fit、不覆盖用户 position/scale |
| `surface.sync` | `{}` | 等到当前 Unity 帧的 `WaitForEndOfFrame` 后才回执并返回最新 `{width,height,bounds}`；截图与切屏调用方在 `surface.resize` 后等待它 |
| `vmc.snapshot` | `{}` | 返回 `bones`、静态原始 `restPose` 与当前 `expressions`；拇指关节按 VRM/VMC metacarpal/proximal 命名 |

成功载入会回复 `model.loaded` 并发送 `model.bounds`；失败回复 `command.error`。模型边界使用 CSS 像素 `{minX,minY,maxX,maxY}`，并在可取得 Animator Head 骨骼时附带 `head:{x,y,minX,minY,maxX,maxY}`，可交给 Electron Pet 输入区域、字幕和点击几何。

每次 `model.load` 意图都会在 URL 校验前采用信封中的新 `generation`，并终止上一条在途载入。URL、下载或导入失败时保留先前已显示的 avatar 与当前动画，但它们随失败回执一起迁移到这个新 epoch；浏览器因此可继续用新 generation 调用 snapshot、交互与动画，而不会卡在旧代次。

`model.bounds` 保留模型超出 canvas 时的负数或超过 viewport 的未裁剪坐标，由现有 host 继续判定 clipped。`model.fit` 在调整相机后立即回复并发送一次新 bounds，随后仍在稳定帧复核。

拖动与 `model.snap` 复用同一可见性规则：只在模型已越界且横向或纵向实际可见长度小于阈值时修正对应维度；阈值默认 200 CSS 逻辑像素，并在 viewport 小于 200 时收敛为该维度的 viewport 尺寸。普通拖动命令在返回前同步完成位移和修正，不依赖浏览器缓存 bounds；goodbye/return 流程可显式传 `clamp:false`，待最终 `model.snap` 再回屏。`model.snap` 完成后立即回复最终 transform/bounds、发送 `model.bounds`，再保留稳定帧复核。新的拖动、transform、zoom、fit、resize 或模型代次会终止尚未完成的回弹，旧 snap 以 `moved:false` 收尾，不会覆盖新位置。

`model.orbit` 使用 start 时的 bounds center、position 与 rotation，每个 update 都从该快照重算，避免增量旋转漂移。新模型、transform、drag、zoom、fit、snap、锁定或新的 orbit 会让旧 interactionId 失效。`model.moveToScreen` 缺省使用旧交互的 0.9 world-unit/s 上限、2.8 加速度、4.2 减速度、0.012 到达阈值与 200px 最小可见范围，并接受同名正数 body 字段覆盖；新移动会以新 actionId 接管旧请求但沿用本次连续行程的原始 yaw，直接拖动、orbit、fit、snap、transform、锁定与换模型会取消它。`render.pause` 只暂停 Update，恢复后继续同一目标；滚轮缩放也按旧行为与引导移动并存。位置到达时先发送 `model.moveArrived {actionId,moved,transform,bounds}`，让浏览器立即停止 world-walk；C# 同时开始 360ms yaw 恢复，最终 command response 再返回同形状结果供偏好保存。途中按约 20 Hz 更新 `model.bounds`；快捷键、world-walk 动作与偏好保存仍由浏览器层负责。

`restorePreferences` 是浏览器 `loadModel` facade 的本地 option，不属于 Unity command body。Unity 工程本身不读写 N.E.K.O preferences；小游戏传 `false` 后由 host 跳过读取偏好，也不再向 Unity 下发桌宠 transform。

WebGL 启动配置固定 `devicePixelRatio:1` 并设置 `matchWebGLToCanvasSize:false`。浏览器 host 全权把 backing store 设为“逻辑尺寸 × `_pixelRatio`”（当前约束为 0.5–8），`surface.resize` 只把 CSS 逻辑宽高传给 C#，不调用没有可靠 WebGL 合同的 `Screen.SetResolution`。`surface.sync` 用于等待这次尺寸变更后的 Unity 帧完成，并把该帧对应的新 bounds 原子带回，避免切屏后继续使用旧 viewport 的缓存；3–8 倍制卡输出的最终清晰度仍需在真实 Unity WebGL 构建中验证。

新模型载入完成后先以 `Renderer.forceRenderingOff` 隐藏，首个 `animation.play` 成功启动才显示，避免 idle 就绪前短暂出现 T-pose。若页面一秒内没有请求首个动画，或首个动画校验、下载、导入失败，Unity 会安全显示静态模型；即使动画请求已发出但卡住，初始隐藏总时长也不超过两秒。`animation.started`、`animation.loop`、`animation.finished` 都携带 `actionId`。

`model.fit` 使用每个模型初载时固定的本地参考边界，并在计算时叠加当前 avatar root transform；因此动作姿势改变不会让重复 fit/resize 跳变，而用户保存的 position/rotation/scale 仍会生效。`autoScale:false` 与 `mode:native` 使用同一份初始像素密度基线，重复调用和跨 viewport resize 不会累积放大。

`vmc.snapshot.body.restPose` 的元素形状与 `bones` 相同：`{name,localPosition:{x,y,z},localRotation:{x,y,z,w}}`。它读取 UniVRM runtime import 时保存的 `DefaultTransformStates`，不是当前动画姿态的副本。

`vmc.snapshot` 在 Unity 左手系读取骨骼后，会先转换成浏览器/Three.js 右手系：位置 `z` 取反，四元数 `x/y` 取反，`z/w` 保持。后端现有 VMC sender 再按既有合同转换回 Unity/VMC 左手系，避免 Unity 直出后被二次镜像。

`model.profile` 的响应 body 为 `{type,loaded,name,geometry,materials,skeleton,springBones,renderer}`。其中 `geometry:{meshCount,vertices,faces,morphTargetCount}` 按唯一 Unity `Mesh` 资源统计，`materials:{count,textureCount}` 按唯一 `Material` / `Texture` 统计，`skeleton:{boneCount,humanBoneCount}`、`springBones:{springCount,jointCount,colliderGroupCount,colliderCount}` 来自当前 UniVRM 实例。`renderer.drawCalls` 是静态估算，并始终同时返回 `drawCallsEstimated:true` 与 `drawCallEstimateMethod:"sum_renderer_material_shader_passes"`；它不是 GPU/Unity Profiler 的实测 draw call。`renderer` 另含 `rendererCount/materialSlotCount/triangles/textures/geometries/size`，响应不包含 GPU vendor、显卡型号或 Three.js `renderer.info`。

`lighting.outlineWidthScale` 会以模型导入时每个 MToon 材质的 `_OutlineWidth` 为基线做幂等倍率缩放，同时适用于 UniVRM 0.x/1.0 Built-in MToon shader，不会因滑块重复调用而累乘。`lighting.toneMapping` 使用 Built-in Pipeline 的 `OnRenderImage` 后处理逐式移植 Three.js r180 的 0/1/2/3/4/6/7（None、Linear、Reinhard、Cineon、ACES Filmic、AgX、Neutral）编号及公式；模式 0 不应用 exposure。WebGL 构建期间所有 Graphics Tier 强制使用 FP16/ARGBHalf HDR 中间缓冲并在构建后恢复原设置，确保后处理保留透明 alpha；shader 先还原非预乘 RGB、映射后再预乘，并原样输出 alpha。由于 Three 在材质透明混合前执行 tone mapping、Unity 在相机合成后执行，透明材质叠层只能保证协议和公式等价，不能声称逐像素完全一致，仍需 Electron 真机检查透明边缘与 GPU 性能。

`animation.play.fadeDuration` 由一个 UniVRM `IVrm10Animation` 分层混合器执行：新动作线性渐入，所有尚未归零的旧动作同时渐出；连续快速切换不会提前释放中间层。旋转按权重球面插值，hips 先按固定 reference T-pose 高度重定向再混合；表情按实际 binding 独立累计，在总权重不足 1 时混入动作激活前原值，最后一个 binding 退出后恢复原值。嘴型和眨眼仍只由实时输入控制。`immediate:true` 立即释放旧层；普通 `animation.stop` 保留原逻辑的 0.5 秒全层淡出，暂停或 seek-paused 动作立即停止，并在最终 detach 时恢复 reference pose，避免冻结在最后一帧。真实 Unity WebGL 构建仍需验证连续切换的视觉平滑度与资源回收。

## 验证

Editor tests：

```bash
/Applications/Unity/Hub/Editor/2022.3.73f1/Unity.app/Contents/MacOS/Unity \
  -batchmode -quit \
  -projectPath "$PWD/unity/NekoAvatarRenderer" \
  -runTests -testPlatform EditMode \
  -testResults "$PWD/.agent/unity-editmode-results.xml"
```

构建后还需在 Electron Pet 真机验证：透明背景、两个内置 VRM、模型切换竞态、口型、表情、VRMA、视线、右键 orbit、引导移动的到达/重选/暂停恢复、缩放/多屏 DPI、输入区域以及连续切换后的 GPU 内存回收。
