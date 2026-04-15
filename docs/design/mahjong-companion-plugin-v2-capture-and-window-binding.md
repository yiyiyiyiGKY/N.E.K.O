# 雀魂陪伴插件第二版文档：真实抓帧与窗口绑定

> 前置文档：
> - `docs/design/mahjong-companion-plugin-plan.md`
> - `docs/design/mahjong-companion-plugin-detailed-design.md`
>
> 本文对应第一版骨架之后的下一阶段，只解决两件事：
> - 让插件真正绑定目标窗口
> - 让插件真正产出可用截图，而不是占位文件
>
> 实施同步说明：
> - 当前仓库已经完成第二阶段第一版落地，不再只是设计草案。
> - 已落地内容包括：窗口绑定、窗口区域截图、多后端截图回退、`bind_window` / `unbind_window`、静态 UI 绑定与抓图状态展示。
> - 已在真实雀魂窗口上完成手工测试，成功绑定窗口标题与区域，并成功生成 `pyautogui-region` 的窗口区域截图。
> - 第二阶段当前可以视为已完成，后续如果继续调整，重点会是多屏支持、平台兼容和异常场景优化，而不是基础链路补齐。

---

## 1. 本阶段目标

第二版不追求麻将识别、决策、讲解全部完成，只追求把“视觉输入”这条链路真正打通。

完成后，插件应该具备：

- 能尝试定位雀魂窗口
- 能区分“未找到窗口”和“已绑定窗口”
- 能抓取真实屏幕图像
- 能把截图保存到 `data/debug_samples/`
- 能把最近一次绑定状态和抓帧结果显示在插件 UI 中

一句话理解：

- 第一版解决“插件存在”
- 第二版解决“插件真的能看见东西”

---

## 2. 本阶段范围

### 2.1 必做

- 增加窗口绑定状态
- 增加真实抓帧实现
- 增加窗口标题关键字配置读取
- 增加 `bind_window` / `unbind_window` 入口
- 增强 `get_session_status`
- 增强静态 UI，让用户看见绑定状态和最近截图路径

### 2.2 不做

- ROI 切片识别
- OCR
- 牌面分类
- 局面结构化
- 出牌建议
- 自动点击

---

## 3. 交付标准

这版完成后，至少要满足：

- 插件能返回“当前是否已绑定窗口”
- 插件能显示命中的窗口标题或窗口信息
- 点击“抓取调试帧”时优先保存真实截图
- 如果没找到窗口，返回明确错误而不是静默失败
- UI 能直观看到：
  - 当前绑定状态
  - 最近截图文件路径
  - 最近错误信息

---

## 4. 设计原则

### 4.1 先做稳定，再做聪明

第二版只做稳定抓图，不做复杂视觉智能。

### 4.2 先做宽松绑定，再做精细绑定

先用窗口标题关键字、活动窗口信息、整屏截图这些简单方式跑通。

不要在第二版就引入：

- `dxcam`
- `opencv`
- `onnxruntime`
- 复杂窗口句柄管理

截图实现也建议按“多后端回退”思路做：

- 优先 `pyautogui`
- 其次 `PIL.ImageGrab`
- 再其次系统命令，例如 macOS 的 `screencapture`

目标不是一开始就追求最优，而是让第二版尽可能在更多实际环境中“先能抓到图”。

### 4.3 失败要可解释

如果抓不到图，必须让用户知道是：

- 没找到目标窗口
- 截图依赖不可用
- 截图失败

而不是只返回一个空结果。

### 4.4 连续失败要能降级

第二版还不必上完整的 Heartbeat / Watchdog 机制，但建议至少增加“连续失败降级”策略：

- 连续绑定失败或抓帧失败达到阈值时，状态切到 `warning`
- 如果失败持续更久，可以从 `warning` 回退到 `idle`
- 这样可以避免游戏窗口已经关闭时，插件还长期停留在看起来正常的 `scanning`

当前实现约定可直接写死为：

- 连续失败达到 3 次时切到 `warning`
- 连续失败达到 6 次时回退到 `idle`
- 回退到 `idle` 时同时停止后台扫描循环
- 新一轮 `start_session` 或 `stop_session` 会清空失败计数，避免旧失败状态污染下一次会话

---

## 5. 代码改动范围

第二版建议只改这些文件：

- `plugin/plugins/mahjong_companion/orchestrator.py`
- `plugin/plugins/mahjong_companion/session_state.py`
- `plugin/plugins/mahjong_companion/config_defaults.py`
- `plugin/plugins/mahjong_companion/__init__.py`
- `plugin/plugins/mahjong_companion/window_binding.py`
- `plugin/plugins/mahjong_companion/capture/provider.py`
- `plugin/plugins/mahjong_companion/static/index.html`
- `plugin/plugins/mahjong_companion/static/main.js`
- `plugin/plugins/mahjong_companion/static/style.css`

按当前仓库实际代码补充说明：

- 第二阶段最终没有把截图后端长期留在 `orchestrator.py`，而是已经独立抽到 `capture/provider.py`。
- 窗口绑定逻辑也已经稳定抽到 `window_binding.py`，不是临时内联实现。
- 连续失败降级和状态回退仍主要保留在 `orchestrator.py`，因为它属于会话编排职责。

---

## 6. 状态模型增强

### 6.1 `SessionState` 新增字段

建议新增这些字段：

```json
{
  "window_bound": false,
  "window_title": "",
  "window_match_keyword": "",
  "window_left": null,
  "window_top": null,
  "window_width": null,
  "window_height": null,
  "last_capture_source": "",
  "last_capture_ok": false
}
```

含义：

- `window_bound`：当前是否有可用目标窗口
- `window_title`：最近一次命中的窗口标题
- `window_match_keyword`：命中时使用的关键字
- `window_left/top/width/height`：最近一次窗口几何信息，用于区域截图
- `last_capture_source`：截图来源，例如 `pyautogui`
- `last_capture_ok`：最近一次抓图是否成功

### 6.2 `report_status()` 输出增强

建议宿主状态至少输出：

```json
{
  "status": "idle",
  "mode": "teaching",
  "window_bound": true,
  "window_title": "雀魂麻将",
  "last_capture_ok": true,
  "last_frame_path": "...",
  "last_error": ""
}
```

---

## 7. 配置增强

### 7.1 默认配置

建议在 `config_defaults.py` 里补充：

```json
{
  "mahjong_companion": {
    "target_window_title_keywords": ["雀魂", "Mahjong Soul"],
    "capture": {
      "prefer_active_window": true,
      "save_format": "png"
    }
  }
}
```

### 7.2 第二版允许热更新的配置

- `target_window_title_keywords`
- `sample_interval_ms`

理由：

- 这两个参数调整后，重新绑定或下一次抓帧就能生效

---

## 8. 入口点增强

第二版建议新增两个入口：

| 入口 | 作用 |
| --- | --- |
| `bind_window` | 尝试绑定目标窗口 |
| `unbind_window` | 清空当前窗口绑定 |

保留原有入口：

- `start_session`
- `stop_session`
- `get_session_status`
- `set_mode`
- `capture_debug_frame`

### 8.1 `bind_window`

建议返回：

```json
{
  "bound": true,
  "window_title": "雀魂麻将",
  "match_keyword": "雀魂"
}
```

### 8.2 `unbind_window`

建议返回：

```json
{
  "bound": false
}
```

---

## 9. 窗口绑定策略

第二版建议按这个优先级：

1. 如果当前活动窗口标题命中关键字，优先绑定当前活动窗口
2. 如果能拿到窗口几何信息，优先按窗口区域抓图
3. 如果区域抓图失败，退回整屏抓图
4. 如果拿不到窗口信息，允许直接退化到整屏抓图
5. 如果连整屏抓图都失败，则返回明确错误

### 9.1 为什么第二版不做复杂窗口句柄绑定

因为当前目标是把截图链路跑通，而不是做平台级窗口控制系统。

第二版只需要回答：

- 现在能不能抓到一张图
- 这张图大概率是不是雀魂窗口相关

### 9.2 平台现实

当前仓库最现实的截图方式优先级建议是：

- `pyautogui.screenshot()`
- `PIL.ImageGrab.grab()`
- 平台系统命令回退

窗口定位如果平台库不稳定，就先保持宽松策略：

- 记录活动窗口标题
- 能拿到边界就做区域抓图
- 拿不到边界就截整屏
- 把绑定状态作为“软绑定”

当前实现已经落地的后端策略：

- Windows 优先尝试 `pygetwindow` 读取活动窗口标题和几何
- macOS 优先尝试 `osascript` 读取前台应用、窗口标题和位置尺寸
- Linux 优先尝试 `xdotool` 读取活动窗口和几何

实现注意：

- 窗口左上角坐标可能合法地等于 `0,0`，不能把它误判成“无效边界”
- 只有宽高需要严格大于 `0`

---

## 10. `capture_debug_frame` 第二版行为

第二版建议行为：

1. 先尝试绑定窗口
2. 再执行真实截图
3. 存到 `data/debug_samples/`
4. 更新 `SessionState`
5. 更新 `session_cache/latest_session.json`
6. 返回截图路径和绑定信息

建议返回结构：

```json
{
  "saved": true,
  "path": ".../20260415-120001-frame.png",
  "source": "pyautogui-region",
  "window_bound": true,
  "window_title": "雀魂麻将"
}
```

补充说明：

- 第二版允许出现“`window_bound = false`，但 `saved = true`”的结果。
- 这表示窗口关键字没有命中，但整屏抓图成功了。
- 这是当前阶段可接受的“软绑定 + 成功抓图”结果，不视为失败。
- 第二版也允许“窗口已绑定，但区域截图失败，最终以全屏回退成功”的结果。
- 因此 `source` 可能是：
  - `pyautogui-region`
  - `pyautogui-fullscreen-fallback`
  - `imagegrab-region`
  - `imagegrab-fullscreen-fallback`
  - `screencapture-region`
  - `screencapture-fullscreen-fallback`
  - `grim-region`
  - `grim-fullscreen-fallback`
  - `gnome-screenshot`

如果失败，建议返回：

```json
{
  "saved": false,
  "error": "No matching window found"
}
```

不要再回落成默认占位文件，除非是为了调试兼容保底，并且要明确标注 `source = "placeholder"`。

实现一致性要求：

- `bind_window`
- `unbind_window`
- `capture_debug_frame`
- `start_session`
- `stop_session`
- `set_mode`

这几类入口都应通过同一把锁串行更新状态，避免 UI 快速连续点击时出现竞态状态。

---

## 11. UI 第二版改动

### 11.1 需要新增显示项

- 当前窗口绑定状态
- 当前窗口标题
- 最近抓图是否成功
- 最近截图路径
- 最近错误
- 自动刷新是否开启

### 11.2 需要新增按钮

- `尝试绑定窗口`
- `解除窗口绑定`
- `自动刷新开关`

### 11.3 UI 行为

用户最自然的操作顺序应该是：

1. 打开插件页面
2. 点“尝试绑定窗口”
3. 看状态栏是否显示已绑定
4. 点“抓取调试帧”
5. 看返回的截图路径

自动刷新建议：

- 保留一个显式开关
- 默认关闭
- 开启后每 `2-3s` 刷新一次状态即可

---

## 12. 实现顺序

严格建议按这个顺序落：

1. 先扩展 `SessionState`
2. 再扩展 `get_session_status`
3. 再做 `bind_window`
4. 再做真实 `capture_debug_frame`
5. 再改 UI
6. 最后再考虑把窗口绑定逻辑抽出到单独文件

---

## 13. 验收方式

### 13.1 最小手工验收

至少要手工验证：

1. 启动插件
2. 打开 `/plugin/mahjong_companion/ui/`
3. 点“尝试绑定窗口”
4. 点“抓取调试帧”
5. 确认 `data/debug_samples/` 下生成真实图片或明确失败结果

### 13.2 通过标准

- 能看见绑定状态变化
- 能看见真实截图路径
- 报错是明确的
- 状态缓存文件能更新

---

## 14. 本阶段完成后的意义

第二版完成后，插件就不再只是“宿主里一个空骨架”，而是进入：

- 它已经真正拥有视觉输入

这会直接为第三版铺路：

- ROI
- 场景识别
- 最小感知闭环

---

## 15. 下一版建议

第二版完成后，建议下一份文档直接进入：

- `docs/design/mahjong-companion-plugin-v3-minimum-perception-loop.md`

主题聚焦：

- 场景识别
- 按钮区识别
- 是否轮到用户
- 输出第一版 `PerceivedGameState`
