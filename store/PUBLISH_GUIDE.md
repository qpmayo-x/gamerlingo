# Chrome Web Store 公開手順

## 事前準備（あなたがやること）

### 1. アイコン画像を作成（3分）
1. ブラウザで `store/icon.html` を開く
2. スクリーンショットを撮って 128x128 に切り抜く
3. `icon128.png` として保存
4. 同じものを 48x48、16x16 にリサイズして `icon48.png`、`icon16.png` を作成
5. `public/` フォルダに上書きコピー
6. `npm run build` でリビルド

### 2. スクリーンショットを作成（3分）
1. ブラウザで `store/screenshot.html` を開く
2. ブラウザのウィンドウサイズを 1280x800 にする
3. スクリーンショットを撮る（Command+Shift+4 → ドラッグ選択）
4. `store/screenshot1.png` として保存

### 3. 開発者アカウント登録（5分）
1. https://chrome.google.com/webstore/devconsole にアクセス
2. Googleアカウントでログイン
3. 初回は $5 の登録料を支払う（1回のみ）
4. 開発者名を設定

### 4. プライバシーポリシーを公開する
`store/privacy-policy.html` をどこかに公開する。方法:
- **GitHub Pages**（無料・簡単）:
  1. このプロジェクトをGitHubにpush
  2. Settings → Pages → mainブランチを選択
  3. URLは `https://yourusername.github.io/game-translator-extension/store/privacy-policy.html`

## 公開手順

### 5. 拡張機能をZIPに固める
```
cd dist && zip -r ../gamerlingo.zip . && cd ..
```

### 6. Chrome Web Storeに申請
1. https://chrome.google.com/webstore/devconsole を開く
2. 「新しいアイテム」→ `gamerlingo.zip` をアップロード
3. 以下を入力:

| 項目 | 値 |
|------|---|
| 名前 | GamerLingo - AI Game Translator |
| 説明 | `store/description.md` の Description 部分をコピペ |
| カテゴリ | Productivity |
| 言語 | English |
| アイコン | 128x128 PNG |
| スクリーンショット | 1280x800 PNG（最低1枚） |
| プライバシーポリシーURL | 上で公開したURL |

4. 「プライバシー」タブ:
   - 「単一目的の説明」: "Translates gaming chat and text using AI, with gaming slang support"
   - 「データ使用」:
     - 個人情報の収集: なし
     - ウェブ閲覧アクティビティの収集: なし
   - リモートコードの使用: なし

5. 「審査のために提出」をクリック

### 7. 審査
- 通常 1〜3 営業日で審査完了
- 問題がなければ自動公開される
- 拒否された場合は理由が通知される → 修正して再申請

## 申請後にやること
- [ ] Product Hunt に投稿準備
- [ ] Reddit r/gaming, r/leagueoflegends 等に紹介投稿
- [ ] Discord のゲーミングサーバーで紹介
