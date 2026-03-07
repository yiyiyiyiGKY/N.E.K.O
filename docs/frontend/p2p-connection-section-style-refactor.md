# `#p2p-connection-section` 样式重构指南

## 背景

`templates/api_key_settings.html` 中的 P2P 连接区块（`#p2p-connection-section`，位于第 688 行）当前所有样式均通过 `style=""` 内联属性写死，使用的是中性灰色体系，与页面其他模块（如 `.api-key-info`、`#advanced-options`）的蓝色设计系统不一致：

| 属性 | 当前值（inline） | 页面规范值 |
|------|----------------|------------|
| 背景色 | `#f8f9fa` | `#e8f4f8` / `#f0f9ff` |
| 边框色 | `#e0e0e0` | `#b3e5fc` |
| 圆角 | `12px` | `24px` |
| 标题色 | `#333` | `#40C5F1` |
| 标签色 | `#888` | `#40C5F1` |

**目标：保持 HTML 结构完全不变，仅将 inline style 提取为 CSS 类，并对齐设计规范。**

---

## 第一步：在 `static/css/api_key_settings.css` 末尾追加以下样式

```css
/* ─── P2P 连接区块 ─── */

#p2p-connection-section {
    margin: 20px 0;
    padding: 20px;
    background: #e8f4f8;
    border-radius: 24px;
    border: 1px solid #b3e5fc;
}

#p2p-connection-section h3 {
    margin: 0 0 16px 0;
    color: #40C5F1;
    font-size: 1.1rem;
    display: flex;
    align-items: center;
    gap: 8px;
}

#p2p-connection-section h3 svg {
    color: #40C5F1;
    flex-shrink: 0;
}

#p2p-connection-section > p {
    margin: 0 0 16px 0;
    color: rgba(64, 197, 241, 0.75);
    font-size: 0.9rem;
}

/* 内容行：QR码 + 连接信息左右排列 */
.p2p-content-row {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    align-items: flex-start;
}

/* 二维码列 */
.p2p-qr-col {
    flex: 0 0 auto;
    text-align: center;
}

#p2p-qr-container {
    background: white;
    padding: 12px;
    border-radius: 16px;
    box-shadow: 0 2px 8px rgba(64, 197, 241, 0.12);
    display: inline-block;
    border: 1px solid #e3f4ff;
}

#p2p-qr-image {
    width: 180px;
    height: 180px;
    display: block;
}

#p2p-qr-error {
    display: none;
    width: 180px;
    height: 180px;
    align-items: center;
    justify-content: center;
    color: rgba(64, 197, 241, 0.5);
    font-size: 14px;
    text-align: center;
    padding: 20px;
    box-sizing: border-box;
}

/* 刷新二维码按钮 - 复用 .btn 基础，加主色背景 */
.p2p-refresh-btn {
    margin-top: 12px;
    padding: 8px 16px;
    background: #40C5F1;
    color: white;
    border: none;
    border-radius: 50px;
    cursor: pointer;
    font-size: 0.85rem;
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
    margin-right: auto;
    transition: all 0.2s ease;
}

.p2p-refresh-btn:hover {
    background: #22b3ff;
    transform: translateY(-1px);
    box-shadow: 0 2px 6px rgba(64, 197, 241, 0.3);
}

.p2p-refresh-btn:active {
    transform: translateY(1px) scale(0.98);
    opacity: 0.95;
}

/* 连接信息列 */
.p2p-info-col {
    flex: 1;
    min-width: 200px;
}

.p2p-info-card {
    background: white;
    border-radius: 16px;
    padding: 16px;
    border: 1px solid #b3e5fc;
}

.p2p-info-field {
    margin-bottom: 12px;
}

.p2p-info-field:last-of-type {
    margin-bottom: 16px;
}

.p2p-info-label {
    color: #40C5F1;
    font-size: 0.85rem;
    display: block;
    margin-bottom: 4px;
    font-weight: bold;
}

/* code 标签复用页面 monospace 风格 */
.p2p-info-card code {
    background: #f0f9ff;
    border: 1px solid #e3f4ff;
    padding: 6px 10px;
    border-radius: 8px;
    font-size: 0.9rem;
    display: block;
    word-break: break-all;
    color: #40C5F1;
    font-family: 'Courier New', monospace;
}

/* 复制按钮 - 使用 .btn.secondary 风格 */
.p2p-copy-btn {
    width: 100%;
    padding: 10px;
    background: #e8f4f8;
    color: #40C5F1;
    border: 1px solid #b3e5fc;
    border-radius: 50px;
    cursor: pointer;
    font-size: 0.85rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: all 0.2s ease;
    font-weight: 600;
}

.p2p-copy-btn:hover {
    background: #40C5F1;
    color: white;
    border-color: #40C5F1;
    transform: translateY(-1px);
    box-shadow: 0 2px 6px rgba(64, 197, 241, 0.25);
}

.p2p-copy-btn:active {
    transform: translateY(1px) scale(0.98);
    opacity: 0.95;
}

.p2p-manual-hint {
    margin: 12px 0 0 0;
    color: rgba(64, 197, 241, 0.6);
    font-size: 0.8rem;
    line-height: 1.4;
}
```

---

## 第二步：修改 HTML（`templates/api_key_settings.html`，第 688–746 行）

**只替换 `style=""` 属性为对应的 CSS 类，DOM 结构保持不变。**

### 修改对照表

| 元素 | 删除的 inline style | 替换为 class |
|------|---------------------|--------------|
| `#p2p-connection-section` | `style="margin: 20px 0; padding: 20px; background: #f8f9fa; border-radius: 12px; border: 1px solid #e0e0e0;"` | （ID 本身即选择器，无需加 class） |
| `<h3>` | `style="margin: 0 0 16px 0; color: #333; ..."` | （用 `#p2p-connection-section h3` 覆盖） |
| `<svg>`（标题图标）| `style="color: #44b7fe;"` | 删除 |
| `<p>`（描述文字） | `style="margin: 0 0 16px 0; color: #666; font-size: 0.9rem;"` | 删除 |
| 内容行 `<div>` | `style="display: flex; flex-wrap: wrap; gap: 20px; align-items: flex-start;"` | `class="p2p-content-row"` |
| QR码列 `<div>` | `style="flex: 0 0 auto; text-align: center;"` | `class="p2p-qr-col"` |
| `#p2p-qr-container` | `style="background: white; padding: 12px; border-radius: 12px; box-shadow: ...; display: inline-block;"` | 删除（ID 覆盖） |
| `#p2p-qr-image` | `style="width: 180px; height: 180px; display: block;"` | 删除（ID 覆盖） |
| `#p2p-qr-error` | `style="display: none; width: 180px; height: 180px; ..."` | 删除（ID 覆盖）|
| 刷新按钮 | `style="margin-top: 12px; padding: 8px 16px; background: #44b7fe; ..."` | `class="p2p-refresh-btn"` |
| 信息列 `<div>` | `style="flex: 1; min-width: 200px;"` | `class="p2p-info-col"` |
| 信息卡片 `<div>` | `style="background: white; border-radius: 8px; padding: 16px; border: 1px solid #e8e8e8;"` | `class="p2p-info-card"` |
| 每个信息字段 `<div>` | `style="margin-bottom: 12px;"` | `class="p2p-info-field"` |
| 每个标签 `<span>` | `style="color: #888; font-size: 0.85rem; display: block; margin-bottom: 4px;"` | `class="p2p-info-label"` |
| `<code>` 元素 | `style="background: #f4f4f4; padding: 6px 10px; border-radius: 4px; ..."` | 删除（`.p2p-info-card code` 覆盖） |
| 复制按钮 | `style="width: 100%; padding: 10px; background: #f0f0f0; ..."` | `class="p2p-copy-btn"` |
| 手动输入提示 `<p>` | `style="margin: 12px 0 0 0; color: #999; font-size: 0.8rem; line-height: 1.4;"` | `class="p2p-manual-hint"` |

### 修改后的完整 HTML 片段

```html
<!-- P2P 连接二维码区块 -->
<div class="section" id="p2p-connection-section">
    <h3>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
            <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
            <line x1="6" y1="6" x2="6.01" y2="6"></line>
            <line x1="6" y1="18" x2="6.01" y2="18"></line>
        </svg>
        <span data-i18n="P2P 手机连接">P2P 手机连接</span>
    </h3>
    <p data-i18n="使用手机 App 扫码，同 WiFi 下直接连接桌面端">使用手机 App 扫码，同 WiFi 下直接连接桌面端</p>

    <div class="p2p-content-row">
        <!-- 二维码区域 -->
        <div class="p2p-qr-col">
            <div id="p2p-qr-container">
                <img id="p2p-qr-image" src="/lanproxyqrcode" alt="P2P QR Code"
                    onerror="this.style.display='none'; document.getElementById('p2p-qr-error').style.display='flex';">
                <div id="p2p-qr-error">
                    <span data-i18n="二维码加载失败">二维码加载失败<br>请确保服务已启动</span>
                </div>
            </div>
            <button type="button" class="p2p-refresh-btn" onclick="refreshP2pQrCode()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                </svg>
                <span data-i18n="刷新二维码">刷新二维码</span>
            </button>
        </div>

        <!-- 连接信息区域 -->
        <div class="p2p-info-col">
            <div class="p2p-info-card">
                <div class="p2p-info-field">
                    <span class="p2p-info-label" data-i18n="局域网 IP">局域网 IP</span>
                    <code id="p2p-lan-ip">--</code>
                </div>
                <div class="p2p-info-field">
                    <span class="p2p-info-label" data-i18n="端口">端口</span>
                    <code id="p2p-port">--</code>
                </div>
                <div class="p2p-info-field">
                    <span class="p2p-info-label" data-i18n="连接 Token">连接 Token</span>
                    <code id="p2p-token">--</code>
                </div>
                <button type="button" class="p2p-copy-btn" onclick="copyP2pConnectionInfo()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    <span data-i18n="复制连接信息">复制连接信息</span>
                </button>
            </div>
            <p class="p2p-manual-hint" data-i18n="如果扫码失败，请在手机端手动输入以上信息">
                如果扫码失败，请在手机端手动输入以上信息
            </p>
        </div>
    </div>
</div>
```

> **注意：** `#p2p-qr-error` 的 JS 控制改为 `display='flex'`（原为 `'block'`），以使 `align-items: center` 生效。需同步修改 `refreshP2pQrCode()` 函数中对应的 `errorDiv.style.display = 'none'`（保持不变）。

---

## 第三步：在所有 locale 文件中添加 P2P 翻译键

### i18n 键命名规范

本页面 P2P 区块采用**中文原文作为 key** 的扁平化方案（非命名空间路径），原因如下：

- `api.p2pXxx` 路径形式的键**从未写入任何 locale 文件**，在非中文环境下翻译失败后会直接显示 key 名（即 `api.p2pConnectionTitle`）而不是原文，视觉上完全错误
- 以中文原文为 key，i18next 找不到对应 locale 时会回退显示 key 本身（即中文原文），保证中文环境下始终可读
- 不含 `.`，不触发 i18next 的 key 路径分割逻辑

### 需添加的键值对（追加到每个 locale JSON 的根对象末尾，逗号前置于上一个顶级键）

| key（中文原文）| zh-CN | zh-TW | en | ja |
|---|---|---|---|---|
| `P2P 手机连接` | P2P 手机连接 | P2P 手機連接 | P2P Mobile Connection | P2P スマートフォン接続 |
| `使用手机 App 扫码，同 WiFi 下直接连接桌面端` | *(同 key)* | 使用手機 App 掃碼… | Scan QR code with the mobile app… | アプリでQRコードをスキャン… |
| `二维码加载失败` | 二维码加载失败`<br>`请确保服务已启动 | 二維碼載入失敗`<br>`請確保服務已啟動 | Failed to load QR code`<br>`Please ensure the service is running | QRコードの読み込みに失敗`<br>`サービスが起動しているか確認… |
| `刷新二维码` | 刷新二维码 | 重新整理二維碼 | Refresh QR Code | QRコードを更新 |
| `局域网 IP` | 局域网 IP | 區域網路 IP | LAN IP | LAN IP |
| `端口` | 端口 | 連接埠 | Port | ポート |
| `连接 Token` | 连接 Token | 連接 Token | Connection Token | 接続トークン |
| `复制连接信息` | 复制连接信息 | 複製連接資訊 | Copy Connection Info | 接続情報をコピー |
| `如果扫码失败，请在手机端手动输入以上信息` | *(同 key)* | 如果掃碼失敗… | If scanning fails, enter the info above manually on your phone | スキャンに失敗した場合は… |
| `已复制` | 已复制 | 已複製 | Copied | コピーしました |

> ko / ru 同理，参见各 locale 文件末尾已追加内容。

### 注意：`二维码加载失败` 的值含 HTML

`i18n-i18next.js` 在处理 `data-i18n` 时检测译文是否含 HTML 标签；若含 `<br>` 等则使用 `innerHTML`，否则使用 `textContent`（见 `i18n-i18next.js:708`）。因此 locale 文件中值可以安全地包含 `<br>`。

### 动态注入（JS 中的 `copyP2pConnectionInfo`）

`copyP2pConnectionInfo()` 函数在复制成功后通过 `btn.innerHTML = '...'` 动态注入带 `data-i18n` 的元素，此处同步改为：

```js
btn.innerHTML = '... <span data-i18n="已复制">已复制</span>';
```

> 注意：动态注入的元素**不会**被页面初始化时的 `updatePageTexts()` 扫描到，需在注入后手动调用 `window.t('已复制')` 如需多语言支持；目前以中文原文兜底，行为正确。

---

## 第四步：`save-button-box` 悬浮栏样式补全

> 此改动与 P2P 区块在同一次提交中完成，记录于此。

`templates/api_key_settings.html` 底部固定悬浮栏 `.save-button-box` 存在以下问题：

| 问题 | 现象 |
|------|------|
| 亮色模式无背景 | 完全透明，页面内容滚动时直接透过悬浮栏显示 |
| 暗色模式实色背景 | `#0f0f0f` 硬截断，与页面过渡不自然 |
| 子元素 `pointer-events: none` 泄漏 | `> div` 规则误覆盖 `#status` 的 `padding`、`display` |
| 内联样式残留 | 按钮包装层带 `style="margin-top: 20px;"` |

### `static/css/api_key_settings.css`

```css
/* 修改前 */
.save-button-box {
    position: fixed; bottom: 0; left: 0; right: 0;
    z-index: 999; display: flex; justify-content: center;
    padding: 20px 0; pointer-events: none;
}
.save-button-box > div { pointer-events: auto; padding: 0 24px; }

/* 修改后 */
.save-button-box {
    position: fixed; bottom: 0; left: 0; right: 0;
    z-index: 999; display: flex; flex-direction: column;
    align-items: center; padding: 32px 0 20px; pointer-events: none;
    background: linear-gradient(to bottom, transparent, rgba(255, 255, 255, 0.92) 40%, #fff);
}
.save-button-box > * { pointer-events: auto; }   /* 仅还原交互，不设排版 */

.save-btn-row {                                   /* 替代 style="margin-top:20px" */
    margin-top: 12px; padding: 0 24px;
    display: flex; justify-content: center;
}
#status.status {                                  /* 状态消息宽度受控 */
    width: calc(100% - 48px); max-width: 480px;
    margin-top: 0; box-sizing: border-box;
}
```

> **为何改 `> div` 为 `> *`**：原 `> div` 优先级 (0-1-1) > `.status` (0-1-0)，会覆盖 `#status` 的 `padding: 12px` 并强制其变为 flex 容器，导致状态文字异常。

### `static/css/dark-mode.css`

```css
/* 修改前 */
[data-theme="dark"] .save-button-box { background: #0f0f0f; }
/* 修改后（与 .container-content 的 #1e1e1e 对齐） */
[data-theme="dark"] .save-button-box {
    background: linear-gradient(to bottom, transparent, rgba(30, 30, 30, 0.92) 40%, #1e1e1e);
}
```

### `templates/api_key_settings.html`

```html
<!-- 修改前 -->
<div class="save-button-box" >
    <div id="status" class="status"></div>
    <div style="margin-top: 20px;"><button …></div>
</div>

<!-- 修改后 -->
<div class="save-button-box">
    <div id="status" class="status"></div>
    <div class="save-btn-row"><button …></div>
</div>
```

---

## 设计系统参考

本次改动遵循 `api_key_settings.css` 中已有的设计规范：

- **主色** `#40C5F1` — 用于标题、标签、边框高亮
- **浅蓝背景** `#e8f4f8` — 卡片/区块背景（参考 `.api-key-info`）
- **浅蓝边框** `#b3e5fc` — 卡片边框（参考 `.api-key-info`、`.field-row input`）
- **圆角** `24px`（大卡片）/ `16px`（嵌套内卡）/ `50px`（按钮/pill）
- **白色内卡** `background: white` — 嵌套在蓝色背景内形成层次（参考 `#advanced-options .field-row`）
- **按钮悬停** `translateY(-1px)` + `box-shadow` — 统一交互动效
