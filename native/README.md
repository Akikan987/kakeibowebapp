# モバイルアプリ

| 対象 | 場所 | 用途 |
| --- | --- | --- |
| Androidのインストール用APK/AAB | [twa](twa/README.md) | 現行Web版を対応ブラウザーで表示する署名済みTWA。Google／LINE・Gmailは通常のWeb認証経路を使う |
| Androidの銀行通知読み取り試験版 | [android](android/README.md) | WebViewと限定的な端末通知ブリッジ。独立した旧試験版。Google／LINE・Gmail認証やダウンロードに制約あり |
| 家計簿 Native（開発版） | [mobile](mobile/README.md) | TWA・旧試験版とは別のCapacitorアプリ。共通Web UI・ブラウザーPKCE認証、Android通知・ウィジェットを開発中 |
| iPhone / iOS | [mobile/ios](mobile/ios/README.md) | Capacitor・WidgetKitソースあり。Mac/Xcodeのビルド・Widget Extensionターゲット・署名・実機検証は未完了。APKはインストール不可 |

TWAはChromeでWeb版を表示し、家計簿 Nativeは通知読み取り・ウィジェット用のネイティブ機能を追加する別アプリです。Web/PWA・TWAの配布と既存サーバーは維持し、Nativeのビルド・署名・検証状況は[mobile README](mobile/README.md)で管理します。
