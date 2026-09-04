# ホーム画面追加ガイド

公開URL: https://app.kakeibodata.com/pr/install.html

## 変更範囲

- `public/pr/install.html` と `install.css` を追加。Android Chrome / iPhone Safariそれぞれ4ステップ、計8点の操作模式図をHTML/CSS・共有アイコンのSVGで構成。図はスクリーンショットではない旨を明記し、読み上げ用ラベルを付与。実際のアプリアイコンは `public/icon.svg` を参照。
- PRのヘッダー、ヒーロー、利用開始の注意書きに「ホーム画面に追加」のリンクを追加。既存のアプリ直リンク3件は維持。
- 説明ページではなくアプリ本体URLをChrome/Safariで開くよう案内。SNS内ブラウザ、インストールとショートカット、Safariの共有ボタンのレイアウト差、Webアプリ設定、記録が見えない場合の安全な確認を記載。
- JavaScript・アプリ本体・設定・依存パッケージは変更していない。

## 参考にした公式手順（2026-09-04確認）

- https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=ja
- https://support.google.com/chrome/answer/15085120?co=GENIE.Platform%3DAndroid&hl=ja
- https://support.apple.com/ja-jp/guide/iphone/iphea86e5236/ios

## 検証・公開結果

- PR検証スクリプトを拡張。全4ページのタグ構造・アンカー・参照先、案内ページの8図・8ステップ・注意書き、3か所の入口、CSS構文を確認し成功。
- 既存テスト15件成功。通常ビルド成功、PWA事前キャッシュ26件・755.57 KiBでPRガイドは除外されたまま。
- localhostで案内URLのHTTP 200を確認してプレビューを開いた。ブラウザ実操作・スクリーンショット・実機インストールのテストは行っていない。
- 既存公開イメージを `kakeibowebapp-web:before-install-guide-20260904` として保存し、`scripts/Dockerfile.pr-release` でPRのみ重ねて公開。通常ビルドのアプリは配信していない。
- 公開ガイド・PR・CSS・アプリ本体がHTTP 200、API healthは `{"status":"ok"}`。公開ページにも8点の図と3か所の入口があることを確認。
- アプリindex.htmlとsw.jsのSHA256は公開前後で一致。本体機能・データは変更なし。
- ガイドHTMLのSHA256: `60942496466fde0a4ff6570f67a92d08523fd1fac797b6f721a30353a5e1ccf3`。
