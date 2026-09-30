# ExploRec 要件整理（v1）

## 1. 背景と目的
- QAの探索的テストで実施したブラウザ操作を自動記録する。
- 任意タイミングのスクリーンショットを取得する。
- 人間が読める日本語ステップ列としてJSONで書き出す。
- 将来的にHTMLレポート出力へ拡張できる設計にする。

## 2. 技術制約
- Chrome拡張機能（Manifest V3）。
- 依存ライブラリなし（Vanilla JavaScript / HTML / CSS）。
- 各ファイル先頭に「役割」を日本語コメントで明記する。

## 3. 対象ファイル構成
- manifest.json
- background.js（service worker）
- content.js（ISOLATED world content script）
- inject_main.js（MAIN world content script）
- popup.html
- popup.js

## 4. 主要設計方針（重要）
- ステップ採番と`steps`配列への追加はbackground.jsのみが行う。
- content.jsはイベント検知とメッセージ送信のみを担当する。
- 状態は`chrome.storage.local`を唯一の正とする（service worker停止対策）。
- content.js / popup.jsは起動時読込 + `chrome.storage.onChanged`で同期する。

### 4.1 タブ運用方針（v1）
- 記録は「拡張全体で1セッション」を採用し、記録中は別タブの操作も許容する。
- 複雑化を避けるため、タブごとの記録ON/OFFは持たない。
- 各ステップに`tabId`（任意）を保持し、後でどのタブ由来か識別できるようにする。
- スクリーンショットはトリガー時のアクティブタブのみ取得する。
- `startUrl`は記録開始時点のアクティブタブURLを保持する（別タブ遷移で上書きしない）。

## 5. 機能要件

### 5.1 自動記録（content.js）
#### クリック記録
- `click`をcapture phaseで捕捉する（伝播停止対策）。
- 対象要素は以下を`closest`で解決する。
  - `button`
  - `a`
  - `[role=button]`
  - `input[type=submit]`
  - `input[type=button]`
  - `input[type=checkbox]`
  - `input[type=radio]`
  - `select`
  - `[onclick]`
- `description`を日本語自然文で生成する。
- 例: 「パスワードのテキストボックスをクリック」「『ログイン』ボタンをクリック」

#### 入力記録
- `change`イベントで確定値のみ記録（キーストローク単位は記録しない）。
- 入力値はマスクしない（dev環境前提）。
- `select`は選択肢テキストを記録する。
- `checkbox`はオン・オフ状態を記録する。
- `radio`はchangeで選択された項目を記録する（非選択化された側の個別オフは記録対象外）。
- 例: 「パスワードのテキストボックスに『xxxx』と入力」

#### 表示メッセージ記録
- MutationObserverでメッセージ表示を検知し、記録する。
- 例: 「『パスワードとメールアドレスの組み合わせが適切ではありません』と表示された」

### 5.2 ラベル決定（最重要）
入力欄の人間可読ラベルは以下の優先順位で解決する。
1. `label[for=id]`
2. 包含する`<label>`
3. `aria-label`
4. `aria-labelledby`（参照先のテキスト）
5. `placeholder`
6. `title`
7. 種類ベースの日本語フォールバック

注意事項:
- `name` / `id` / CSSセレクタは人間向け表示に使用しない。
- これらは構造化データ側（`target.selector`等）でのみ利用する。

フォールバック例:
- `type=password` → 「パスワードのテキストボックス」
- `type=email` → 「メールアドレスのテキストボックス」
- `textarea` → 「テキストエリア」
- `select` → 「セレクトボックス」

### 5.3 メッセージ検知仕様
#### 対象要素
- `[role=alert]`
- `[role=status]`
- `[aria-live=polite]`
- `[aria-live=assertive]`
- class名が以下正規表現に一致する要素
  - `/(alert|error|toast|message|notification|snackbar|invalid-feedback|help-block|form-error|flash)/i`

#### 監視設定
- observe対象: `document.documentElement`
- options:
  - `childList: true`
  - `subtree: true`
  - `characterData: true`
  - `attributes: true`
  - `attributeFilter: ['role', 'aria-live', 'class']`

#### ノイズ抑制
- 同一テキストが1500ms以内に連続発火した場合は重複として無視。
- 1500ms超で再表示された場合は再記録する。
- セレクタとclass正規表現は後調整しやすいよう定数として切り出す。
- 重複判定キーは`text + url`を基本とする（同一文言でもURLが異なれば別イベント）。
- 空文字・空白のみのテキストは記録しない。
- 非表示要素（`display:none` / `visibility:hidden` / `aria-hidden=true`）のみから得られるテキストは記録しない。

### 5.4 スクリーンショット（background.js）
- ユーザー任意タイミングで取得する。
- トリガー:
  - popupボタン
  - ショートカットコマンド
- API: `chrome.tabs.captureVisibleTab(windowId, { format: 'png' })`
- 戻り値のbase64 data URLをステップの`screenshot`フィールドに格納する。
- 画像の別ファイル保存は行わない。
- `description`は「スクリーンショットを取得」。

### 5.5 ナビゲーション検知
#### inject_main.js（MAIN world）
- `history.pushState` / `history.replaceState`をフックする。
- 実際に`location.href`が変化したときのみ以下イベントを発火する。
  - `window.dispatchEvent(new CustomEvent('etr:navigate', { detail: { url: location.href } }))`

#### content.js（ISOLATED world）
- `etr:navigate`と`popstate`を購読する。
- URL変化時に「ページ遷移: {url}」を記録する。
- 直前と同一URLは記録しない。
- フルリロード再注入時:
  - 記録中かつ「当該タブの最後に記録したURL」と現在URLが異なれば遷移を記録する。

### 5.6 popup（popup.html / popup.js）
- 記録開始/停止トグル
- スクリーンショット撮影ボタン
- JSON書き出しボタン
- クリアボタン
- 記録中インジケーター
- 現在のステップ数表示
- ステップ一覧表示（スクショはサムネイル表示）
- JSON書き出しはBlob + `<a download>`で実行（downloads権限は使わない）
- `chrome.storage.onChanged`でライブ更新

### 5.7 ショートカット（manifest commands）
- `toggle-recording`: `Ctrl+Shift+E`
- `take-screenshot`: `Ctrl+Shift+Y`

## 6. JSON出力スキーマ
```json
{
  "startedAt": "ISO8601",
  "startUrl": "string",
  "steps": [
    {
      "step": 1,
      "action": "click|input|message|screenshot|navigate",
      "description": "日本語の自然文",
      "value": "（inputのみ）",
      "text": "（messageのみ）",
      "url": "（navigateのみ）",
      "screenshot": "（screenshotのみ, base64 data URL）",
      "tabId": "（任意, 由来タブ識別）",
      "target": { "tag": "", "type": "", "selector": "" },
      "timestamp": "ISO8601"
    }
  ]
}
```

## 7. 必要権限
- `storage`
- `tabs`
- `scripting`
- `host_permissions: ["<all_urls>"]`

## 8. v1で実装しない範囲（明確化）
- iframe内の操作記録
- Shadow DOM貫通
- フルページキャプチャ（表示領域のみ対応）
- アサーション挿入
- 入力値マスク
- アイコン作成

## 9. 実装ステップ（作業順）
1. `manifest.json`と全ファイル骨格作成
2. background.jsの状態管理とメッセージハンドラ実装
3. content.jsのラベル解決とイベント捕捉実装
4. メッセージ検知とナビゲーション検知実装
5. popup実装
6. 各ステップで簡潔な実装報告

## 10. 将来拡張（HTML出力）
v1はJSON出力を正とし、将来的に以下を追加可能とする。
- JSONからHTMLレポートを生成
- ステップのタイムライン表示
- action別色分け（click/input/message/screenshot/navigate）
- タブ単位のフィルタ表示（`tabId`）
- スクリーンショットサムネイル表示
- 元JSON表示（折りたたみ）
- 印刷向けスタイル
