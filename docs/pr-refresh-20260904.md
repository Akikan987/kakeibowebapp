# PR更新 / 2026-09-04

アプリ本体・API・同期・公開設定は変更せず、既存の public/pr と public/og.png を更新。
既存の自宅サーバー配信を維持し、別のSitesサービスへの移行や本番公開は実施していない。

## 確認した実装とPRへの反映

| 実装 | PRで伝える内容 |
| --- | --- |
| src/App.tsx | 収支・予算・履歴・決済・割り勘の5タブ。設定は右上 |
| src/theme.tsx | ライト背景 #F7F9FC、白カード、プライマリ #1565C0、14pxボタン角丸 |
| src/screens/PlanningScreen.tsx / src/components/PlanningSections.tsx | 月間・品目別予算、使用額・残額・進捗、確認して登録する定期項目 |
| src/screens/PaymentsScreen.tsx | 引き落としカレンダー、手入力の確定請求額との照合、確定・支払済み、プリペイド残高 |
| src/cardPresets.ts | 100件のカード候補。金融機関との自動連携ではない |
| src/screens/HomeScreen.tsx / src/components/Charts.tsx | 月間サマリー、日付別棒グラフ、品目別円グラフ |
| src/screens/ListScreen.tsx | 月送り、詳細な検索・絞り込み、現在日時で明細複製 |
| src/screens/SettingsScreen.tsx / src/store.tsx | 明細CSV、全データJSON、OCRのログイン要件、オフライン記録・同期 |
| README.md / src/screens/SplitScreen.tsx | メンバー別負担額、相手連携、清算・残額管理 |

ページ内UIは実画面のスクリーンショットではなく、機能を説明するサンプル。金額はすべて架空。
月全体は予算180,000円−使用124,000円＝残56,000円。食費は40,000円−24,000円＝残16,000円。
9月カレンダーは2026年9月1日（火）始まり。27日（日）は計算例であり、休日調整を行わない旨を明記。
「1タップで記録」「ログインなしで同期」「自動引落・自動記帳」等の誤解を招く表現を使用しない。

## 納品物

- public/pr/index.html / styles.css：紹介サイト
- public/pr/assets/social-og-20260904.png：1200×630
- public/pr/assets/social-square-20260904.png：1080×1080（横長の切り抜きではなく独立構図）
- 同名WebP：紹介ページ表示用
- public/og.png と従来の social-og.png / social-square.png：互換エイリアス
- social-og.html / social-square.html：最新版の表示・保存ページ

旧hero画像・旧サイトのプレビュー画像は削除せず保管したが、最新版のページからは参照しない。
アプリ本体のPWA事前キャッシュからPR画像を除外する既存設定も変更しない。

## 画像生成

Built-in ImageGenを横長・正方形各1回使用。PNGへのサイズ調整とWebP化のみSharpで実施。

共通プロンプト：

```text
Use case: ads-marketing
Primary request: Finished polished Japanese PR social image for a personal budgeting web app named 家計簿.
Style/medium: Crisp premium raster marketing design inspired by practical Material UI, clean flat schematic UI illustrations, light background #F7F9FC, white cards, primary #1565C0, secondary #625B71, green #2E7D32, dark navy text, subtle shadows, 16–24px rounded card corners, bold highly legible Japanese sans-serif typography.
Subject: A purposeful schematic assembly of THREE simple cards: budget progress bars; a monthly withdrawal calendar with selected dates highlighted; an income/expense donut chart. Illustrate function concepts only. No phone frame and no invented app screen or app navigation. Charts use abstract visual bars and calendar cells without additional labels or made-up statistics.
Text (verbatim, render exactly once each, no quotation marks): brand "家計簿"; headline "使ったお金も、これからのお金も。"; supporting line "収支・予算・引き落とし・割り勘"; URL "app.kakeibodata.com"; small legible disclaimer "機能イメージ".
Constraints: The headline is the main focal point; exact Japanese characters, punctuation and URL are critical. Only the five specified text strings, no extra invented copy, no other letters or numbers. Roomy safe margins. Functional restrained hierarchy, no clutter.
Avoid: people, bank logos, bank auto-sync claims, automatic recurring registration or charge claims, investment imagery, coin piles, dark theme, device mockups, browser chrome, menus, navigation, photography, watermarks.
```

横長の追加プロンプト：

```text
Asset type: Landscape OG / social share card, wide 1200:630 composition (approximately 1.905:1).
Composition/framing: Entire canvas is a finished single landscape image. Left 52 percent is a carefully aligned typography column: brand near upper left, main headline large in two lines with line break after "使ったお金も、", supporting line below, URL near bottom left. Right 43 percent holds the three schematic cards in a beautifully balanced compact arrangement with budget bar card above and calendar and donut cards below, no overlap obscuring content. Small disclaimer below the schematic group. Keep at least 60px equivalent outer safe margin and generous negative space. All text and cards fully within canvas.
```

正方形の追加プロンプト：

```text
Asset type: Square 1:1 social share card, target 1080 by 1080, independently art-directed square composition.
Composition/framing: Entire canvas is a finished single square image, not a crop of a landscape. Balanced stacked layout with brand at upper left inside a 72px equivalent safe margin; large headline in two lines near the top with line break after "使ったお金も、"; supporting line directly underneath. Across the central and lower area arrange three generously spaced schematic cards: a wide budget progress card at the top of the card group, then a calendar card and donut card side by side beneath. URL centered near bottom; small disclaimer aligned under the cards but above the URL. Spacious, bold, legible at social thumbnail size. All content within safe margins.
```

## 検証方法

- node scripts/verify-pr.mjs：HTMLタグ構造、アンカー、ローカル参照、CTA、機能コピー、候補件数、CSS、画像サイズ・形式
- npm test：既存アプリの回帰テスト
- npm run build：既存アプリとPRの配信物を生成
- 画像2点は目視確認。ブラウザの操作・レスポンシブの目視テストは今回未実施。

実行結果：PR専用検証成功、既存テスト15件成功、配信ビルド成功。PWAの事前キャッシュは26件・755.57 KiBで、PR画像は引き続き含まれない。
Git差分でも src/・server/・公開設定・依存関係の変更がないことを確認済み。
