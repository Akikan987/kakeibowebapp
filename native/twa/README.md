# インストール用Androidアプリ

`native/android` のWebView試験版とは別の、Chrome Trusted Web Activity（TWA）版。パッケージは `com.kakeibodata.kakeibo.app`。Web版の画面とAPIをそのまま使い、Google／LINE・Gmail認証を独自のWebViewへ閉じ込めない。

全画面をKotlin/Composeで再実装したものではない。Androidアプリとして署名・インストールできるが、表示・Cookie・端末内記録・ファイルの読み書き・認証画面は対応ブラウザーが管理する。TWAを検証できない環境ではURLバー付きCustom Tabへフォールバックする。

## ビルド

JDK17・Android SDK36（Build Tools35.0.0）・Gradle8.13・AGP8.13.2を使用。Android Browser HelperはGoogle Mavenの2.7.4に固定。GradleのダウンロードSHA256を固定し、既存の公式Gradle wrapperを再利用している。

```powershell
# 最初の1回だけ -InitializeSigning を付ける。次回は同じ鍵を再利用する。
.\scripts\Build-Release.ps1 -JavaHome 'C:\Program Files\Eclipse Adoptium\jdk-17.0.18.8-hotspot' -AndroidHome "$env:LOCALAPPDATA\Android\Sdk" -InitializeSigning -PublishFiles
```

スクリプトは `testReleaseUnitTest lintRelease assembleRelease bundleRelease` と署名検証に成功した場合だけ `releases/` にAPK/AABを出力する。`-PublishFiles` は `public/pr/downloads/` と `public/.well-known/assetlinks.json` に公開用ファイルを準備するだけで、サーバー反映は別操作。

配布先は既存Service WorkerでもHTMLフォールバックから除外済みの `/pr/downloads/` を使う。古いPWAの更新を適用する前でもAPKをindex.htmlへ置き換えないための措置。APK本体をPWAのキャッシュへ追加しない。

バージョンは `release.json` で管理する。配布済みAPKを変更するときはversionCode/versionNameを増やし、案内ページのダウンロード名も更新する。APK/AABはGitに入れない。新しいチェックアウトで公開ビルドする前には、同じ署名鍵で再ビルドするか、検証済み配布物を復元する。鍵がない環境で別の鍵を作って置き換えてはいけない。

Web用Dockerfileも公開ファイルだけでAPKのハッシュ・関連付け・ダウンロード名を検査する。配布物がない新しいチェックアウトでは、APKを復元するまで公開ビルドを失敗させ、壊れたダウンロードリンクを配信しない。通常の `npm run build` と単体テストにはAPK本体は不要。

## 署名鍵

- `.signing/kakeibo-release.p12` はランダムなパスワードで暗号化し、パスワードはWindows CurrentUser DPAPIで `.signing/password.dpapi` に保存する。フォルダーのACLを現在のWindowsユーザーとSYSTEMだけに限定する。
- パスワードはコマンド引数・ログ・Gitへ渡さず、ビルド中だけプロセス環境変数に設定して元に戻す。秘密鍵はAPKやWebイメージへコピーしない。公開するのはAPKのハッシュと署名証明書の指紋だけ。
- **同じ鍵が今後の上書き更新に必要。** 現段階ではこの新しい署名鍵のPC外バックアップは作成していない。DPAPIファイルは別PCへコピーするだけでは復号できないため、USB等への可搬バックアップは別途安全なパスワードで保護して準備する必要がある。
- 旧WebView試験版とはパッケージIDが違うため、既存アプリを削除せず併用できる。ブラウザーやプロフィールが違う場合、元の記録は消さず、同じアカウントで同期／JSONバックアップを使う。

## セキュリティと未対応

サイトの関連付けは正確なパッケージIDとrelease証明書のSHA256のみ。デバッグ証明書・ワイルドカード・Cookie共有権限は追加しない。起動URLはHTTPSの `app.kakeibodata.com` のルートだけを許可し、外部オリジン・ファイルURI・OAuth/APIパスへの起動Intentはホームへ戻す。アプリのIntentフィルターもホームだけで、OAuth callbackの受け取りを奪わない。

このAPKは銀行通知の直接読み取り・ホーム画面ウィジェット・iOS版を含まない。既存の同意・通知の許可は自動で変更しない。Web Pushは対応ブラウザーとOSの許可に依存し、TWAの通知委譲サービスは公式ライブラリのオリジン検証を使用する。Google Play審査や実機のOAuth・通知到達を保証するものではない。

Android13以降に必要な `POST_NOTIFICATIONS` と、ブラウザーからのPendingIntent専用（exported=false）の公式通知権限Activityを宣言する。MainActivityから許可を自動要求するコードは追加せず、ブラウザー側の通知設定・本人の許可操作に従う。

## 2026-10-27の検証

- releaseビルド・AAB生成・AndroidのURL検証テスト3件が成功。lintはエラー0件、警告6件（Gradleの新バージョン案内、アイコン資産の配置／形状・monochrome、minSdkと同じv26フォルダー）。これらを解消したことやPlay公開準備完了は意味しない。
- APK署名をAndroid SDKのapksignerで検証。デバッグ証明書ではないこと、パッケージID・versionCode=1・versionName=1.0.0・minSdk26・targetSdk36をaaptで確認した。
- Webの全181件のテストと公開文書・PR検査が成功。配布APKのSHA256・サイズと関連付けJSONの証明書指紋が一致することを `node scripts/verify-android-release.mjs` で確認した。
- APK内に秘密鍵・DPAPIパスワード・.envがないことを検査。署名用ファイルとAPK/AABのGit除外、native/のDocker除外を維持する。
- 実機でのインストール・起動、Google／LINE/Gmailの実認証、通知到達、戻る操作・セーフエリアは未検証。検証のためにユーザーのGoogle Cloud設定・メール・家計簿データを操作していない。
- 本番のAPKを再ダウンロードし、556,613 bytes・SHA256 `1803f4fc3c4c93f8505ca1440c64add3a9945261eead946327901cf01a4326fd` がローカル配布物と一致した。APKのContent-Type、関連付けJSON、存在しないAPKの404、Service WorkerのAPK非キャッシュも確認した。
- GoogleのDigital Asset Links検証APIがサイト・パッケージ・署名証明書の組み合わせを `linked=true` と判定した。これは実機での起動・認証・通知の検証とは別。
- 公開はWebコンテナだけを再作成し、API・DB・OCRの起動時刻が変わらないことを確認した。旧Webイメージは `kakeibowebapp-web:before-android-apk-20261027` として保存した。

参考: [Chrome公式TWA概要](https://developer.chrome.com/docs/android/trusted-web-activity)、[Android公式アプリ署名](https://developer.android.com/studio/publish/app-signing)、[Android公式Digital Asset Links](https://developer.android.com/training/app-links/configure-assetlinks) 。
