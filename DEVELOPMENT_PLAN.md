# GamerLingo — ゲーマー向けAI翻訳Chrome拡張

> ゲームスラングを理解するAI翻訳。Discord・Steam・Twitch対応。

---

## コンセプト

Google翻訳では「GG EZ noob, get rekt lol」が意味不明になる。
GamerLingoは、ゲーム文脈を理解するAI翻訳Chrome拡張。

---

## ターゲットユーザー

- 海外ゲーマーとプレイする日本人
- 日本のゲームコミュニティに参加したい海外勢
- Twitch/YouTube Gamingで海外配信を見る人
- Steamで海外レビューを読みたい人

---

## 機能一覧

### 無料版
- [x] テキスト選択 → 右クリック → AI翻訳（ポップアップ表示）
- [x] ゲームスラング辞書内蔵（200語以上）
- [x] Discord / Steam / Twitch チャット自動翻訳
- [x] 1日50回の翻訳制限
- [x] 日本語 ↔ 英語

### Pro版（$5/月）
- [x] 翻訳回数無制限
- [x] ワンクリック返信生成（相手の言語で）
- [x] 翻訳履歴 & 単語帳
- [x] 追加言語（韓国語、中国語、スペイン語、ポルトガル語）
- [x] カスタムスラング辞書（自分で追加可能）

---

## 技術スタック

| 項目 | 技術 | 理由 |
|------|------|------|
| Chrome拡張 | Manifest V3 | 現行の必須仕様 |
| UI | Preact + Tailwind CSS | 軽量（バンドルサイズ最小化） |
| AI翻訳 | Claude API (Haiku) | 高品質 + 低コスト（$0.25/1M input tokens） |
| バックエンド | Supabase | 認証 + DB + Edge Functions |
| 決済 | Stripe | 月額課金のデファクト |
| ビルド | Vite + CRXJS | Chrome拡張の高速ビルド |

---

## アーキテクチャ

```
[Chrome拡張]
  ├── Content Script（各サイトのDOM操作）
  │   ├── discord.com 用
  │   ├── store.steampowered.com 用
  │   └── twitch.tv 用
  ├── Background Service Worker（API通信）
  ├── Popup（設定画面・使用状況）
  └── Context Menu（右クリック翻訳）

[バックエンド (Supabase)]
  ├── Auth（Google/Emailログイン）
  ├── Database
  │   ├── users（プラン管理）
  │   ├── usage（日次翻訳カウント）
  │   └── history（翻訳履歴・単語帳）
  └── Edge Functions
      └── /translate（Claude API呼び出し + 使用量チェック）

[外部サービス]
  ├── Claude API（翻訳エンジン）
  └── Stripe（決済）
```

---

## ゲームスラング辞書（コア機能）

翻訳プロンプトにスラング辞書を含めることで、文脈を理解した翻訳を実現。

例:
| スラング | Google翻訳 | GamerLingo |
|----------|-----------|------------|
| GG EZ | ？？ | お疲れ、楽勝だったな |
| nerf | 発泡スチロール銃 | 弱体化 |
| buff | 磨く | 強化 |
| OP | 作品 | 強すぎ / ぶっ壊れ |
| AFK | ？？ | 離席中 |
| noob | ？？ | 初心者 / 下手くそ |
| clutch | クラッチ | 逆転プレイ / 神プレイ |
| toxic | 有毒 | 害悪 / 煽り |
| smurf | スマーフ | サブ垢で初心者狩り |
| meta | メタ | 最強の戦略・構成 |
| int / inting | ？？ | わざと負ける |
| tilted | 傾いた | イライラしてプレイが雑になってる |
| carry | 運ぶ | チームを勝たせる |
| feed | 餌をやる | 敵にキルを与え続ける |
| gank | ？？ | 奇襲・挟み撃ち |

---

## 開発スケジュール（14日間）

### Phase 1: コア機能（Day 1-4）
- [ ] Day 1: プロジェクト初期化（Vite + CRXJS + Manifest V3）
- [ ] Day 1: 右クリック翻訳の基本実装
- [ ] Day 2: AI翻訳プロンプト設計（スラング辞書込み）
- [ ] Day 2: Background Service Worker → Claude API通信
- [ ] Day 3: 翻訳結果のポップアップUI（Preact + Tailwind）
- [ ] Day 4: Discord Content Script（チャット自動翻訳）

### Phase 2: サイト対応 + UX（Day 5-8）
- [ ] Day 5: Steam Content Script（レビュー・フォーラム翻訳）
- [ ] Day 6: Twitch Content Script（チャット翻訳）
- [ ] Day 7: 翻訳ポップアップのUI磨き込み
- [ ] Day 8: ワンクリック返信生成機能

### Phase 3: 課金 + バックエンド（Day 9-11）
- [ ] Day 9: Supabase設定（Auth + Database）
- [ ] Day 10: 使用回数制限の実装（無料50回/日）
- [ ] Day 10: Stripe連携（Pro版サブスクリプション）
- [ ] Day 11: 翻訳履歴 + 単語帳機能

### Phase 4: 公開準備（Day 12-14）
- [ ] Day 12: Chrome Web Store用アセット作成（スクリーンショット、説明文）
- [ ] Day 13: テスト + バグ修正
- [ ] Day 14: Chrome Web Storeに公開申請
- [ ] Day 14: Product Huntに投稿準備

---

## コスト試算

### 開発・運営コスト
| 項目 | 月額 |
|------|------|
| Claude API (Haiku) | ~$5-30（利用量次第） |
| Supabase Free Tier | $0 |
| Stripe手数料 | 3.6% |
| Chrome Web Store登録 | $5（初回のみ） |
| ドメイン（LP用） | ~$10/年 |

### 収益シミュレーション（正直ベース）

**Month 1**: 公開 + 初期流入
- インストール: 50-200
- Pro転換: 0-5人
- 収益: $0-25

**Month 2-3**: SEOが効き始める
- インストール累計: 300-1,000
- Pro転換: 15-50人
- 収益: $75-250/月

**Month 4-6**: 安定成長
- インストール累計: 1,000-5,000
- Pro転換: 50-250人
- 収益: $250-1,250/月（¥37,500-187,500）

**月10万円到達: 4-6ヶ月目（Pro 130人 ≒ $650/月）**

### 最悪ケース
- 3ヶ月でインストール100未満、Pro 5人以下
- 損失: 3ヶ月の時間 + ~$30のAPI費用
- 撤退基準: 3ヶ月で累計インストール200未満なら方向転換

---

## Chrome Web Store最適化（ASO）

### タイトル
```
GamerLingo - AI Game Translator for Discord, Steam & Twitch
```

### 短い説明（132文字以内）
```
AI-powered translation built for gamers. Understands gaming slang, works on Discord, Steam, and Twitch. Translate chats instantly.
```

### カテゴリ
Productivity（または Communication）

### 検索キーワード（タイトル・説明文に自然に含める）
- game translator
- Discord translator
- Steam translator
- Twitch chat translation
- gaming slang translator
- ゲーム 翻訳

---

## 競合との差別化まとめ

| 差別化ポイント | 詳細 |
|--------------|------|
| ゲームスラング理解 | 200語以上のスラング辞書 + AI文脈理解 |
| サイト専用対応 | Discord/Steam/Twitchの各UIに最適化 |
| 返信生成 | 翻訳するだけでなく、相手の言語で返信を書ける |
| ゲーマー向けUI | ダーク基調、ゲーミング感のあるデザイン |
| 低価格 | $5/月（既存翻訳ツールより安い） |
