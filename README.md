# ExploRec

QAの探索的テストにおけるブラウザ操作を自動記録し、任意タイミングのスクリーンショットとあわせて、
人間が読める日本語のステップ列としてJSONに書き出すChrome拡張機能（Manifest V3）です。

<img width="1800" height="1078" alt="ExploRecの説明" src="https://github.com/user-attachments/assets/03b09113-17b9-4240-ac1c-30a1c009acb3" />


## 概要

- ページ上のクリック・入力・表示メッセージ・画面遷移を自動で記録します。
- ボタン操作やショートカットで任意のタイミングのスクリーンショットを取得できます。
- 記録した内容はJSONファイルとして書き出せます（Blobダウンロード、`downloads`権限不使用）。
- 依存ライブラリなし（Vanilla JavaScript / HTML / CSS）で実装されています。
- 将来的にJSONからHTMLレポートを生成する拡張も想定した設計です。

詳細な仕様は [`requirements.md`](./requirements.md) を、動作確認手順は
[`acceptance-checklist.md`](./acceptance-checklist.md) を参照してください。

## ファイル構成

| ファイル | 役割 |
| --- | --- |
| `manifest.json` | Chrome拡張のマニフェスト（Manifest V3） |
| `background.js` | service worker。セッション状態とステップの唯一の書き込み元 |
| `content.js` | ISOLATED worldのcontent script。イベント検知とメッセージ送信を担当 |
| `inject_main.js` | MAIN worldのcontent script。`history.pushState`/`replaceState`をフックしてナビゲーションを検知 |
| `popup.html` / `popup.js` | サイドパネルUI。記録開始/停止、スクリーンショット、JSON書き出し、クリア |
| `src/lib/` | ラベル解決・状態管理・記録処理などの共通ロジック（テスト対象） |
| `tests/` | Node標準テストランナーによるユニットテスト |

## 主な設計方針

- 記録は「拡張全体で1セッション」とし、記録中は別タブの操作も許容します（各ステップに`tabId`を保持）。
- 状態は`chrome.storage.local`を唯一の正とし、service worker再起動時も復元できます。
- `content.js`と`popup.js`は起動時の読み込みと`chrome.storage.onChanged`で状態を同期します。
- 入力欄のラベルは以下の優先順位で解決します。
  `label[for=id]` → 包含する`<label>` → `aria-label` → `aria-labelledby` → `placeholder` → `title` → 種類ベースの日本語フォールバック
- `name`／`id`／CSSセレクタは人間向け説明文には使用せず、構造化データ（`target.selector`等）にのみ使用します。
- 表示メッセージの検知は`text + url`をキーに1500ms以内の重複を無視します。

## セットアップ（Chromeへの読み込み）

1. Chromeで `chrome://extensions` を開く。
2. 右上の「デベロッパーモード」を有効にする。
3. 「パッケージ化されていない拡張機能を読み込む」を選択し、本リポジトリのルートディレクトリを指定する。
4. ツールバー（またはサイドパネル）からExploRecを開いて操作を開始する。

## ショートカット

| コマンド | デフォルトキー | 内容 |
| --- | --- | --- |
| `toggle-recording` | `Ctrl+Shift+E` | 記録開始/停止の切り替え |
| `take-screenshot` | `Ctrl+Shift+Y` | スクリーンショットの取得 |

## 開発

### テストの実行

```bash
npm test              # 全テストを実行
npm run test:single   # tests/state.test.js のみ実行
```

- Lint/ビルドコマンドは現時点ではありません。
- 実装はTDD（RED → GREEN → REFACTOR）サイクルに従って進めます。

### 手動受け入れ確認

`acceptance-checklist.md` のセクション0〜14（セクション13のシナリオを含む）に沿って動作確認を行ってください。

## JSON出力スキーマ（概要）

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

詳細なフィールド仕様は `requirements.md` の「6. JSON出力スキーマ」を参照してください。

## 必要権限

- `storage`
- `tabs`
- `scripting`
- `host_permissions: ["<all_urls>"]`

## v1で実装しない範囲

- iframe内の操作記録
- Shadow DOM貫通
- フルページキャプチャ（表示領域のみ対応）
- アサーション挿入
- 入力値マスク
- アイコン作成
