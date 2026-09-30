# ExploRec 受け入れ基準チェックリスト（v1）

このチェックリストは [requirements.md](requirements.md) を実装・検証可能な形に分解したもの。

## 0. 完了判定
- [ ] すべての必須項目（MUST）が満たされている。
- [ ] 重大不具合（記録不能、JSON出力不能、popup操作不能）がない。
- [ ] 手動E2Eシナリオを最低1本通過している。

## 1. プロジェクト骨格
### 1.1 ファイル存在
- [ ] `manifest.json` が存在する。
- [ ] `background.js` が存在する。
- [ ] `content.js` が存在する。
- [ ] `inject_main.js` が存在する。
- [ ] `popup.html` が存在する。
- [ ] `popup.js` が存在する。

### 1.2 先頭コメント
- [ ] 各ファイル先頭に役割を示す日本語コメントがある。

## 2. Manifest V3 設定
### 2.1 基本
- [ ] `manifest_version` が `3`。
- [ ] service worker に `background.js` が設定されている。
- [ ] popup が `popup.html` に設定されている。

### 2.2 権限
- [ ] `permissions` に `storage` がある。
- [ ] `permissions` に `tabs` がある。
- [ ] `permissions` に `scripting` がある。
- [ ] `host_permissions` に `<all_urls>` がある。

### 2.3 content scripts
- [ ] `content.js` が ISOLATED world で実行される設定になっている。
- [ ] `inject_main.js` が MAIN world で実行される設定になっている。
- [ ] all_frames は `false` 相当（iframe非対応）になっている。

### 2.4 commands
- [ ] `toggle-recording` が定義され、`Ctrl+Shift+E` が割り当てられている。
- [ ] `take-screenshot` が定義され、`Ctrl+Shift+Y` が割り当てられている。

## 3. 状態管理（background一元）
### 3.1 単一路線
- [ ] step採番は `background.js` でのみ行っている。
- [ ] `steps` 追加は `background.js` でのみ行っている。
- [ ] `content.js` は採番せずイベント送信のみ行っている。

### 3.1.1 タブ運用（v1）
- [ ] 記録中は別タブの操作も記録できる（全体1セッション）。
- [ ] タブごとの記録ON/OFFを持たない実装になっている。
- [ ] 各ステップに`tabId`（任意）を保持している。
- [ ] `startUrl`は記録開始時のURLで固定される（別タブ遷移で上書きしない）。

### 3.2 永続化
- [ ] 記録状態（recording, steps, startedAt, startUrl 等）を `chrome.storage.local` に保持している。
- [ ] service worker再起動後も状態復元できる。

### 3.3 同期
- [ ] `content.js` は起動時に storage を読んで recording 状態を初期化している。
- [ ] `content.js` は `chrome.storage.onChanged` で recording 状態を追従する。
- [ ] `popup.js` は `chrome.storage.onChanged` で表示をライブ更新する。

## 4. クリック記録（content.js）
### 4.1 捕捉
- [ ] `click` を capture phase で監視している。
- [ ] サイト側がバブリング停止しても取得できる。

### 4.2 対象要素解決
- [ ] `closest` で対象を解決している。
- [ ] 対象セレクタに以下が含まれる。
- [ ] `button`
- [ ] `a`
- [ ] `[role=button]`
- [ ] `input[type=submit]`
- [ ] `input[type=button]`
- [ ] `input[type=checkbox]`
- [ ] `input[type=radio]`
- [ ] `select`
- [ ] `[onclick]`

### 4.3 文言
- [ ] `description` が日本語自然文になっている。
- [ ] 例: 「『ログイン』ボタンをクリック」に相当する出力ができる。

## 5. 入力記録（content.js）
### 5.1 発火条件
- [ ] `change` イベントでのみ記録する。
- [ ] キーストロークごとの記録はしない。

### 5.2 値の扱い
- [ ] 入力値をマスクしない。
- [ ] `value` フィールドに確定値を格納する。

### 5.3 型別挙動
- [ ] `select` は選択肢テキストを記録する。
- [ ] `checkbox` はオン/オフを記録する。
- [ ] `radio` はchangeで選択された項目を記録する。
- [ ] 非選択化されたradio側の個別オフは記録対象外である。

## 6. ラベル解決（最重要）
### 6.1 優先順位
- [ ] `label[for=id]` を最優先で解決できる。
- [ ] 包含 `<label>` を解決できる。
- [ ] `aria-label` を解決できる。
- [ ] `aria-labelledby` 参照先テキストを解決できる。
- [ ] `placeholder` を解決できる。
- [ ] `title` を解決できる。
- [ ] すべて不在時、型ベース日本語フォールバックを使う。

### 6.2 表示文言ルール
- [ ] `name` / `id` / CSSセレクタを人間向け文言に使っていない。
- [ ] 構造化データ側（`target.selector` 等）には利用できる。

### 6.3 フォールバック例
- [ ] password → 「パスワードのテキストボックス」
- [ ] email → 「メールアドレスのテキストボックス」
- [ ] textarea → 「テキストエリア」
- [ ] select → 「セレクトボックス」

## 7. メッセージ検知（MutationObserver）
### 7.1 監視対象
- [ ] `document.documentElement` を observe している。
- [ ] `childList: true` を設定している。
- [ ] `subtree: true` を設定している。
- [ ] `characterData: true` を設定している。
- [ ] `attributes: true` を設定している。
- [ ] `attributeFilter: ['role','aria-live','class']` を設定している。

### 7.2 対象条件
- [ ] `[role=alert]` を対象に含む。
- [ ] `[role=status]` を対象に含む。
- [ ] `[aria-live=polite]` を対象に含む。
- [ ] `[aria-live=assertive]` を対象に含む。
- [ ] class正規表現 `/(alert|error|toast|message|notification|snackbar|invalid-feedback|help-block|form-error|flash)/i` を対象に含む。

### 7.3 重複抑制
- [ ] 同一テキスト1500ms以内の連続発火を除外する。
- [ ] 1500ms超の再表示は再記録する。
- [ ] 重複判定キーが `text + url` になっている。

### 7.3.1 ノイズ除外
- [ ] 空文字・空白のみテキストを除外している。
- [ ] 非表示要素のみから得られるテキストを除外している。

### 7.4 保守性
- [ ] セレクタ条件を定数化している。
- [ ] class正規表現を定数化している。

## 8. ナビゲーション検知
### 8.1 MAIN world 側
- [ ] `history.pushState` をフックしている。
- [ ] `history.replaceState` をフックしている。
- [ ] `location.href`が実際に変化したときのみ `etr:navigate` を発火している。

### 8.2 ISOLATED world 側
- [ ] `etr:navigate` を購読している。
- [ ] `popstate` を購読している。
- [ ] URL変化時に「ページ遷移: {url}」を記録する。
- [ ] 直前URLと同一なら記録しない。

### 8.3 再注入時
- [ ] フルリロード再注入時、記録中かつ当該タブの最後に記録したURLと異なれば遷移を記録する。

## 9. スクリーンショット
### 9.1 取得経路
- [ ] popupボタンで撮影できる。
- [ ] ショートカットで撮影できる。

### 9.2 API・保存
- [ ] `chrome.tabs.captureVisibleTab(windowId, { format: 'png' })` を使用している。
- [ ] `screenshot` フィールドにbase64 data URLを格納している。
- [ ] 別ファイル保存していない。
- [ ] `description` が「スクリーンショットを取得」になる。

## 10. popup UI
### 10.1 操作
- [ ] 記録開始/停止トグルがある。
- [ ] スクリーンショット撮影ボタンがある。
- [ ] JSON書き出しボタンがある。
- [ ] クリアボタンがある。

### 10.2 表示
- [ ] 記録中インジケーターがある。
- [ ] 現在ステップ数が表示される。
- [ ] ステップ一覧が表示される。
- [ ] スクショステップはサムネイル表示される。

### 10.3 JSON書き出し
- [ ] Blob + `<a download>` で出力している。
- [ ] `downloads` 権限を使っていない。

## 11. JSONスキーマ準拠
### 11.1 ルート
- [ ] `startedAt` がISO8601。
- [ ] `startUrl` が設定される。
- [ ] `steps` が配列。

### 11.2 各ステップ共通
- [ ] `step`（連番）がある。
- [ ] `action` が `click|input|message|screenshot|navigate` のいずれか。
- [ ] `description` が日本語自然文。
- [ ] `target.tag` / `target.type` / `target.selector` を保持。
- [ ] `timestamp` がISO8601。

### 11.3 条件付きフィールド
- [ ] `input` のとき `value` が入る。
- [ ] `message` のとき `text` が入る。
- [ ] `navigate` のとき `url` が入る。
- [ ] `screenshot` のとき `screenshot` が入る。
- [ ] 可能なステップでは `tabId` が入る。

## 12. v1 非対応の確認
- [ ] iframe内操作は記録対象外であることを確認。
- [ ] Shadow DOM内操作は記録対象外であることを確認。
- [ ] フルページキャプチャ非対応であることを確認。
- [ ] アサーション挿入非対応であることを確認。
- [ ] 入力値マスク非対応であることを確認。
- [ ] アイコン未実装であることを確認。

## 13. 推奨手動テストシナリオ（最小）
### 13.1 ログイン失敗シナリオ
- [ ] 記録開始
- [ ] email入力
- [ ] password入力
- [ ] ログインボタンクリック
- [ ] エラーメッセージ表示を自動記録
- [ ] 任意タイミングでスクリーンショット取得
- [ ] JSON書き出し
- [ ] JSON内の step 連番・description・条件付きフィールドを確認

### 13.2 URL遷移シナリオ
- [ ] SPA内で pushState / replaceState を伴う遷移を実施
- [ ] ブラウザ戻る/進むで popstate を発火
- [ ] 重複URLが記録されないことを確認

### 13.3 別タブシナリオ（v1）
- [ ] 記録開始後に別タブを新規作成する。
- [ ] 新規タブで click/input/navigate のいずれかを実施する。
- [ ] 元タブと別タブのステップが時系列で記録される。
- [ ] 各ステップの `tabId` で由来タブを識別できる。
- [ ] スクリーンショットは撮影時のアクティブタブの内容になる。

## 14. 将来拡張（HTML出力）準備観点
- [ ] JSONを単一ソースとしてHTML変換可能なデータ構造になっている。
- [ ] `description` がそのままレポート文言として読める。
- [ ] screenshot data URL を `<img src="...">` に直接利用できる。
- [ ] actionごとの表示分岐がしやすいフィールド設計になっている。
