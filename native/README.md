# モバイルアプリ

| 対象 | 場所 | 用途 |
| --- | --- | --- |
| Androidのインストール用APK/AAB | [twa](twa/README.md) | 現行Web版を対応ブラウザーで表示する署名済みTWA。Google／LINE・Gmailは通常のWeb認証経路を使う |
| Androidの銀行通知読み取り試験版 | [android](android/README.md) | WebViewと限定的な端末通知ブリッジ。独立した旧試験版。Google／LINE・Gmail認証やダウンロードに制約あり |
| iPhone | 未ビルド | APKはインストール不可。iOSのネイティブ配布にはMac/Xcode・署名・配布方法の準備と別実装／検証が必要 |

Android APKはPWAの「ホーム画面に追加」と別物だが、TWAの中身は同じWebアプリ。表示・機能の更新はWeb側と共通で、ネイティブの権限・アイコン等の更新はAPKのversionCodeを増やして配布する。どちらもアカウント・同期先サーバーは既存のものを維持する。
