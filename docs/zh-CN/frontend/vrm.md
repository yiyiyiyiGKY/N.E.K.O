# VRM 模型

## 运行时与格式

VRM 渲染器是由 `unity/NekoAvatarRenderer/` 构建的 Unity WebGL + UniVRM 运行时。模型使用 `.vrm`，动画使用 `.vrma`。Three.js 仍供 MMD 等非 VRM 功能使用，但不再负责 VRM 渲染。

`static/unity/unity-vrm-loader.js` 是浏览器端唯一入口，负责加载 `static/unity/unity-avatar-manager.js` 以及 `static/vrm/` 下仍需要的表情、UI 与 VMC 模块。管理器向 Unity 发送带版本的命令，不再暴露第二套 Three.js scene、camera 或 renderer。全局角色页面由 `vrm-init.js` 创建 `window.vrmManager`；独立预览和多角色游戏只创建实际挂载的实例。

Unity 构建命令把 WebGL 产物发布到 `static/unity/avatar/`。运行时必须同时存在有效的 `build-manifest.json` 及其引用的 loader、data、framework 和 wasm 文件；只有 JavaScript 适配器不能启动 Unity。

## 模型与动画

`GET /api/model/vrm/models` 会合并 `static/vrm/` 顶层的内置文件、通过 `/user_vrm` 提供的用户文件，以及 `/workshop/{item_id}/...` 下的已安装创意工坊文件。API 返回公共 URL，不会暴露绝对文件系统路径。

动画来自 `static/vrm/animation/` 与 `/user_vrm/animation/`。上传接口接受模型 `.vrm` 和动画 `.vrma`，每个文件上限 200 MB。用户模型删除仅允许操作配置 VRM 目录顶层的 `.vrm` 文件。

## 光照

`config/character_defaults.py` 中的后端默认值会在渲染器脚本之前以 `window.VRM_DEFAULT_LIGHTING` 注入模板。当前键值为：

```json
{
  "ambient": 0.83,
  "main": 1.91,
  "fill": 0.0,
  "rim": 0.0,
  "top": 0.0,
  "bottom": 0.0,
  "exposure": 1.1,
  "toneMapping": 7,
  "outlineWidthScale": 1.0
}
```

角色专用光照可以覆盖这些值。后端默认值、模板上下文与 Unity 管理器/控制器中的默认值必须保持一致。

## 情绪映射

VRM 情绪把语义名称映射到有顺序的候选表情名称：

```json
{
  "neutral": ["neutral"],
  "happy": ["happy", "joy", "fun", "smile"],
  "surprised": ["surprised", "surprise", "shock", "e", "o"]
}
```

服务器把按模型的映射保存在 `static/vrm/configs/`。`vrm-expression.js` 将保存的映射合并到默认值之上，并对表情名称执行不区分大小写的精确匹配。管理页面在保存前可以通过 `/api/model/vrm/expressions/{model_name}` 获取模型实际表情。

VRM 激活时，`window.LanLan1.setEmotion(name)` 委派给 `window.vrmManager.expression.setMood(name)`。非 neutral 情绪会在运行时延时结束后回到 neutral。

## VMC 动作输出

`vrm-vmc-sender.js` 会在动画、视线、弹簧骨和表情更新后采样当前 VRM，并通过独立的 `/api/vmc/ws` 通道发送姿态。后端负责坐标转换，再通过 OSC/UDP 发送给兼容 VMC Protocol 的接收端。

该功能默认关闭。关闭状态只保留轻量代理，不进行状态轮询、VMC 定时任务或逐帧采样。在主页面使用默认本机目标启用：

```js
await window.vrmVmcSender.enable('127.0.0.1', 39539, 60)
```

VMC 根节点独立于浏览器布局变换，因此桌宠摆位不会被导出。切换或销毁模型时，旧表情会通过带确认的清零帧退出；禁用或释放数据源最终会发送 `/VMC/Ext/OK 0`。

接收端配置、控制接口、安全边界、关闭码与排障方法见 [VMC 动作输出](/zh-CN/api/rest/vmc)。

## 运行时保护

动画混合、视线、弹簧骨、模型构图、光照与 MToon 描边缩放均在 Unity 内执行；浏览器只负责画布表面、输入转换和生命周期命令。这些是运行时职责，不是模型格式要求；不要为了复现它们而预先修改上传的 VRM 文件。

## API 摘要

| 方法 | 端点 | 用途 |
| --- | --- | --- |
| `POST` | `/api/model/vrm/upload` | 上传一个 `.vrm` 模型 |
| `POST` | `/api/model/vrm/upload_animation` | 上传一个 `.vrma` 动画 |
| `GET` | `/api/model/vrm/models` | 列出内置、用户与创意工坊模型 |
| `GET` | `/api/model/vrm/animations` | 列出内置与用户动画 |
| `GET` | `/api/model/vrm/config` | 返回公共 VRM URL 前缀 |
| `GET`、`POST` | `/api/model/vrm/emotion_mapping/{model_name}` | 读取或保存表情映射 |
| `GET` | `/api/model/vrm/expressions/{model_name}` | 检查模型中的表情名称 |
| `DELETE` | `/api/model/vrm/model` | 按公共 URL 删除用户模型 |

## 宿主边界

VRM 在 `index.html` 中渲染，也包括 Electron 桌宠窗口。独立聊天与字幕模板有意不创建第二个 Unity VRM 运行时；原生窗口通过共享跨窗口桥接与主页面协调。
