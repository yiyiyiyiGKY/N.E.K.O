# VRM モデル

## ランタイムと形式

VRM レンダラーは `unity/NekoAvatarRenderer/` からビルドする Unity WebGL + UniVRM ランタイムです。モデルは `.vrm`、アニメーションは `.vrma` を使います。Three.js は MMD など VRM 以外の機能に残りますが、VRM は描画しません。

ブラウザー側の唯一の入口は `static/unity/unity-vrm-loader.js` です。これは `static/unity/unity-avatar-manager.js` と、`static/vrm/` に残る expression、UI、VMC モジュールを読み込みます。manager は version 付き command を Unity に送り、別の Three.js scene、camera、renderer は公開しません。global avatar page は `vrm-init.js` が `window.vrmManager` を作り、preview と multi-avatar game は実際に mount する instance だけを作ります。

Unity の build command は WebGL artifact を `static/unity/avatar/` に publish します。実行には有効な `build-manifest.json` と、それが参照する loader、data、framework、wasm がすべて必要です。JavaScript adapter だけでは Unity は起動しません。

## モデルとアニメーション

`GET /api/model/vrm/models` は `static/vrm/` 直下の同梱ファイル、`/user_vrm` のユーザーファイル、`/workshop/{item_id}/...` のインストール済み Workshop ファイルを統合します。API は公開 URL を返し、絶対ファイルシステムパスを公開しません。

アニメーションは `static/vrm/animation/` と `/user_vrm/animation/` から列挙されます。アップロードはモデル `.vrm` とアニメーション `.vrma` を受け付け、1 ファイルの上限は 200 MB です。ユーザーモデル削除は設定済み VRM ディレクトリ直下の `.vrm` だけに制限されます。

## ライティング

`config/character_defaults.py` のバックエンド既定値は、レンダラースクリプトより先に `window.VRM_DEFAULT_LIGHTING` としてテンプレートへ注入されます。現在のキーは次のとおりです。

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

キャラクター別ライティングはこれを上書きできます。バックエンド既定値、テンプレートコンテキスト、Unity manager/controller の既定値を一致させてください。

## 感情マッピング

VRM の感情は意味名を順序付きの表情名候補へ割り当てます。

```json
{
  "neutral": ["neutral"],
  "happy": ["happy", "joy", "fun", "smile"],
  "surprised": ["surprised", "surprise", "shock", "e", "o"]
}
```

サーバーはモデル別マップを `static/vrm/configs/` に保存します。`vrm-expression.js` は保存値を既定値へ上書きマージし、表情名を大文字小文字を無視した完全一致で検索します。管理ページは保存前に `/api/model/vrm/expressions/{model_name}` から実際の表情名を取得できます。

VRM が有効なとき、`window.LanLan1.setEmotion(name)` は `window.vrmManager.expression.setMood(name)` に委譲されます。non-neutral の mood は実行時遅延後に neutral へ戻ります。

## VMC モーション出力

`vrm-vmc-sender.js` は animation、look-at、spring-bone、expression 更新後の active VRM を sample し、専用 `/api/vmc/ws` channel へ pose を送信します。backend が座標を変換し、VMC Protocol 対応 receiver へ OSC/UDP で出力します。

既定では無効です。無効時は軽量 facade のみを保持し、status poll、VMC timer、per-frame sampling は行いません。main page から既定の local destination を有効にします。

```js
await window.vrmVmcSender.enable('127.0.0.1', 39539, 60)
```

VMC root は browser layout transform から独立しているため、desktop placement は出力されません。model switch/dispose 時は ACK 付き zero-value frame で古い expression を解除し、disable/release の最後に `/VMC/Ext/OK 0` を送信します。

receiver 設定、control API、security boundary、close code、troubleshooting は [VMC モーション出力](/ja/api/rest/vmc) を参照してください。

## ランタイム保護

animation blend、look-at、spring bone、model fitting、lighting、MToon outline scale は Unity 内で実行します。browser は canvas surface、input translation、lifecycle command だけを担当します。これらは runtime の責務であり、model format の要件ではありません。

## API 概要

| メソッド | エンドポイント | 用途 |
| --- | --- | --- |
| `POST` | `/api/model/vrm/upload` | `.vrm` モデルを 1 ファイルアップロード |
| `POST` | `/api/model/vrm/upload_animation` | `.vrma` アニメーションを 1 ファイルアップロード |
| `GET` | `/api/model/vrm/models` | 同梱、ユーザー、Workshop モデルを一覧 |
| `GET` | `/api/model/vrm/animations` | 同梱とユーザーアニメーションを一覧 |
| `GET` | `/api/model/vrm/config` | 公開 VRM URL プレフィックスを返す |
| `GET`、`POST` | `/api/model/vrm/emotion_mapping/{model_name}` | 表情マップを読み取りまたは保存 |
| `GET` | `/api/model/vrm/expressions/{model_name}` | モデル内の表情名を確認 |
| `DELETE` | `/api/model/vrm/model` | 公開 URL でユーザーモデルを削除 |

## ホスト境界

VRM は Electron ペットウィンドウを含む `index.html` に描画されます。独立したチャットと字幕テンプレートは第二の Unity VRM runtime を作らず、ネイティブウィンドウは共通のクロスウィンドウブリッジでメインページと連携します。
