# Cloudflareアクセス解析とCSP（C13）

2026-11-11確認。公開ページのHTMLには `static.cloudflareinsights.com` のスクリプト挿入があり、配信CSPの `script-src` は自サイトと既存ハッシュだけを許可している。挿入の有無は配信条件で異なることがある。リポジトリ内に解析スクリプトの直接呼び出しはない。

改善計画の指定どおり、外部サービスの設定と本番CSPは変更していない。ブラウザーのエラーを隠す処理も追加していない。次のいずれかを運営者が選べる。

## 解析を利用する場合

`security-headers.conf` の既存ディレクティブに次のホストだけを追加する。既存のハッシュや他の制限は残す。

```diff
-script-src 'self' 'sha256-17/GS9xmnwNIuypSPLWZ5nEJSy0Y9sfpZVZFzzk4bQ0=';
+script-src 'self' 'sha256-17/GS9xmnwNIuypSPLWZ5nEJSy0Y9sfpZVZFzzk4bQ0=' https://static.cloudflareinsights.com;
-connect-src 'self';
+connect-src 'self' https://cloudflareinsights.com;
```

これは同じ `add_header Content-Security-Policy` 行の部分差分。複数のCSPヘッダーに分けて追加しない。採用時は公開中のプライバシー説明との整合を確認し、イメージを再ビルドして `nginx -t`、公開ヘッダー、ブラウザーのConsole/Networkを確認する。`unsafe-inline` やワイルドカードでscript制限を緩めない。

## 解析を利用しない場合

CloudflareダッシュボードのWeb Analyticsから対象のサイトを開き、自動セットアップ／JavaScriptスニペットの自動挿入を無効にする（画面上の名称は変更される場合がある）。既存のCSPは維持する。設定後、公開HTMLへの挿入とConsoleのCSPエラーがなくなったことを確認する。解析サービス自体やDNS・Tunnelは削除しない。

## 別件の調査結果

`src`・`public/pr`・`scripts` に `navigator.clipboard` / `execCommand('copy')` の利用は見つからなかった。ユーザー操作なしのクリップボード書き込みに該当する実装は確認できず、以前の通知の発生元は特定していない。
