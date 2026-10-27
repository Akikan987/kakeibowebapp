# 家計簿 Native（開発版）

Web版の家計簿・API・データ形式を使いながら、通知読み取り・ホーム画面ウィジェット・端末通知を追加するCapacitorアプリです。画面と支払計算をネイティブで作り直す構成ではありません。既存Web版、TWA、旧通知試験版とは別アプリとして並行します。このREADMEは現状と制約を記録したもので、ストア配布や実機対応の完了を示すものではありません。

## 方式の選択

| 観点 | Capacitorによる共通画面＋端末機能 | Kotlin／Swiftの全面ネイティブUI |
| --- | --- | --- |
| 現行機能・支払計算 | React・既存TypeScriptをそのまま同梱 | 両OSで移植・一致確認が必要 |
| 権限・ウィジェット | Java／Swiftの専用実装へ橋渡し | 各OSの実装を直接利用 |
| 認証・同期 | ブラウザーPKCE＋共通API。端末Cookieは別 | 同じAPIを使えるが画面・状態管理も別実装 |
| 両OSの保守 | 画面と業務ロジックを共用し、OS部分を分離 | OSごとのUI・業務ロジックの追従が必要 |

今回の目的は端末APIを実際に使いつつ現行機能を維持することであるため、前者を採用しました。単に公開URLを開くTWAと異なり、Web資産をAPKへ同梱し、専用のネイティブプラグイン・サービス・ウィジェットを持ちます。

## アプリの違い

| 種類 | パッケージ | 表示・認証 | 端末機能 |
| --- | --- | --- | --- |
| Web / PWA | なし | 既存Webアプリ | ブラウザーの機能・許可に従う |
| Android TWA | `com.kakeibodata.kakeibo.app` | ChromeのTWAで既存Web版を表示 | 銀行通知読取・このNativeウィジェットは含まない |
| 旧Android通知試験版 | `com.kakeibodata.kakeibo` | 独自WebView。TWA・Nativeとは認証Cookieを共有しない | 三井住友銀行・Vpass通知を読む限定ブリッジ |
| 家計簿 Native | `com.kakeibodata.kakeibo.nativeapp`（debugは`.debug`付き） | Capacitor WebViewで共通Web UIを表示 | Android通知リスナー、端末ウィジェット、ローカル通知。iOSは一部ソースのみ |

TWAは引き続き既存Web版を配布する別アプリです。Nativeの更新・署名鍵・パッケージIDをTWAと混ぜず、Androidでは2つを併用できます。

## 認証とアカウント

ログインは既存Web認証と同じHTTPSオリジン・API・アカウントを使います。Native側はCapacitorのネイティブHTTPで同一オリジンのHttpOnlyセッションCookieを扱い、WebViewのCookieやTWAのログイン状態とは共有しません。画面は共通でも、Native・Chrome/TWA・旧WebViewで最初に別々のログインが必要です。APIを反映する環境では、バックエンドの`SOCIAL_AUTH_ORIGIN`をWebの`APP_ORIGIN`と完全一致させます。

Nativeでログインを始めると、認証要求IDを含むWebページをブラウザーで開きます。ブラウザーに表示されたアカウント名・UIDを本人が確認し、「このアカウントでアプリへのログインを許可」を押した場合だけ、PKCE verifierを使ってNativeへセッションを交換します。要求の期限は5分で、URLには認証トークンを載せません。戻り先は `kakeibo-native://auth?id=...` というカスタムURLスキームです。これはOSがドメイン所有を検証するAndroid App Linkではありません。他のアプリがスキームを横取りしてもPKCE verifierなしではログインを交換できませんが、戻りを妨げるDoSや画面を紛らわせる攻撃はあり得ます。自分がNativeから開始した要求だけを許可してください。

Google／LINEやGmailなど外部ブラウザーが必要な操作は、Nativeの「ブラウザーでアカウント・Gmailを管理」から同じアカウントでブラウザーを開いて行います。接続後はNativeへ戻り、画面を再表示・更新して状態を確認します。実機での各プロバイダー認証とGmail往復は未検証です。

## Android銀行通知の読み取り

- 初期状態はOFFです。設定で機能を明示して有効化し、アプリ内の説明に同意した後、Android設定で通知アクセスを許可します。起動時に権限を自動要求しません。
- 収集元は `jp.co.smbc.direct` と `com.smbc_card.vpass` の2アプリに限定します。金額と取引語があり、ログイン・認証コード・ワンタイムパスワード等の語がない通知だけを候補にするローカルフィルターです。銀行公認の明細解析ではありません。
- URL・メールアドレス・一部の氏名／住所／電話・番号らしい文字列を加工し、Android KeystoreのAES-GCM鍵で端末内暗号化します。加工漏れや個人情報の完全除去は保証できません。最大50件、7日間保持し、バックアップと端末移行から除外します。本文を記録・送信するサーバー処理はありません。
- 同じ送信元・加工本文は短時間の再掲をまとめます。完全一致の指紋を最大200件保持し、2分以内の同一内容も重複候補として抑止するため、内容が同じ別の買い物まで抑止することがあります。
- 候補を取り込むには画面で「通知を読み込む」を明示し、内容を確認して本人が支出として保存します。通知本文そのものをACKで消すのは保存後です。停止、ログアウト、アカウント切替、通知アクセス喪失で通知キューと暗号鍵を消します。
- Androidだけの機能です。iOSは他アプリが出した通知を読むAPIを提供しないため、この機能は使えません。

## ウィジェット・端末通知

ウィジェットの金額・日付は、Web側の既存TypeScript支払予定計算からNativeへ渡すローカルスナップショットです。ネイティブコードは請求額を再計算せず、ネットワーク取得・同期も行いません。通信がない場合は最後にアプリが計算した端末データを示し、`offline`・`error`・古い表示を区別します。

AndroidのWorkManagerは約30分以上の間隔で期限切れ通知の掃除とウィジェット再描画だけを行います。OSの都合で実行が遅れることがあります。最新の家計簿データを取り込むにはアプリを開いて同期してください。ウィジェットの金額表示は初期OFFで、本人が設定で有効にした場合だけ表示します。Androidは画面ロック中・別月・24時間以上古い表示で金額を隠します。iOSソースはWidgetKitのプライバシー表示を要求しますが、OS・ウィジェットが描画済み表示をいつ更新・消去するかは制御できません。ランチャーが描画済み画面を一時保持する場合もあるため、どちらのOSでも即時消去を保証できません。秘密にしたい場合はOFFのままにしてください。

次回引落日の朝9時に端末内ローカル通知を任意で予約できます。通知権限は本人が操作したときだけ要求し、正確な時刻を保証するアラームではありません。「この端末で通知をテスト」は本人操作後、金額を含まない固定文面を約3秒後に表示します。サーバーからのFCM/APNs Pushは未接続で、iOSでも他アプリ通知は読めません。

CSV・JSONエクスポートは共有シート用にアプリのCacheへ書き出します。受け取りアプリが共有シートを閉じた後に読み取れるよう、共有完了直後には消しません。次回のエクスポート、アプリ起動、ログアウト時に、共有中でない`exports/`を削除します。強制終了や共有中のログアウトでは次の起動までCacheに残る場合があります。Cacheはバックアップ先ではありません。

## Androidビルドと署名

構成はCapacitor 7.6.9、JDK 21、Android SDK 36、Gradle 8.13、Android Gradle Plugin 8.13.2です。APK署名確認にはSDK Build Tools 35.0.0が必要です。ビルドスクリプトはWeb資産を生成し、Capacitor同期、release単体テスト・lint・APK生成、署名検証を行います。

```powershell
$env:JAVA_HOME = 'C:\path\to\jdk-21'
.\native\mobile\Build-Android.ps1 -JavaHome $env:JAVA_HOME -AndroidHome "$env:LOCALAPPDATA\Android\Sdk"
```

この新しいアプリ専用の署名鍵は `native/mobile/.signing/native-release.p12`、DPAPI保護パスワードは同じフォルダーの`password.dpapi`です。初回生成は既存の署名ファイルがどちらもない場合だけ、本人が意図して `-InitializeSigning` を付けます。片方でも存在するときは再生成せず原因を調べます。既存TWA鍵とは別の鍵です。DPAPIファイルを別PCへコピーするだけでは復号できません。同じアプリの将来の更新には同じ秘密鍵が必要なので、PC移行前に別途安全な可搬バックアップと復旧方法を準備してください。鍵・パスワードをコマンド引数、Git、APKに入れません。

現在のバージョンは `versionCode=1`、`versionName=0.1.0` です。生成APKと`release.json`は`native/mobile/releases/`へ出力され、Gitには含めません。実配布前の更新ではversionCodeを増やし、署名鍵と配布経路を確認します。

## iOSの状態

Capacitorアプリ、`KakeiboDevice`プラグイン、WidgetKit用ソースとApp Group設定の一部がありますが、Windows上ではSwiftビルド、Simulator、端末起動、署名を実施できていません。XcodeプロジェクトにWidget Extensionターゲットを作り、Apple Team署名とApp Group capabilityをアプリ・ウィジェット双方に設定する作業が残っています。既存ソースはスナップショット表示を前提とし、他アプリ通知読み取りは明示的に非対応です。APNs登録・送信もありません。

## 現在の検証状況

- Webテスト187件、APIテスト265件、Android純粋JVMテスト8件が成功しています。APIテストは隔離PostgreSQLを使用します。
- Android release APKの署名・秘密ファイル混入検査、SDKツールでのパッケージ／バージョン／minSdk26・targetSdk36確認が成功しました。最終APKをAndroid16エミュレーターへ上書きインストールし、起動・UI階層・起動クラッシュなしを確認しました。
- エミュレーターでログイン開始ボタンから本番へ匿名リクエストし、ネイティブHTTP経由の接続と「アプリ用認証APIがまだ公開されていません」という明示案内を確認しました。実アカウント認証は行っていません。
- エミュレーターの別`.debug`パッケージでinstrumentation test4件（Keystore保存と消去、所有者切替、許可前収集拒否、Android AppWidgetHostへの結合とRemoteViewsの実描画・初期金額非表示）が成功しました。ウィジェット試験だけ一時的なshell権限を使い、終了時に返しています。実機の通知アクセス権限や銀行アプリは操作していません。
- release lintはエラー0件・警告35件。主にテンプレート資産、新しい依存バージョン案内、設定確定のための同期`commit()`等です。Gradle9互換ではない非推奨API警告もあり、現在は8.13へ固定しています。`npm audit`は0件です。
- 実機での通知許可・銀行通知・Google／LINE認証・Gmail・ウィジェット・OSロック中のプライバシー・ローカル通知・書き出しと復元は未確認です。テスト数やエミュレーター起動を実機検証・配布準備完了と読み替えないでください。

## 本番反映の状態と復旧

2026-10-27: 認証用Web/APIのDockerイメージをビルドしましたが、APIコンテナ置換が自動承認レビューで拒否されたため、**本番反映は未実施・承認待ち**です。稼働中のWeb/API/DB/OCRのイメージと起動時刻は不変で、新テーブルも本番へ作成していません。現時点の新APKではメール・パスワードによる既存APIログインを使えますが、Google／LINEのブラウザーからのNativeログイン引き継ぎには以下の反映が必要です。実アカウントのログイン・同期は未検証です。

- 反映候補: `kakeibo-api:native-candidate-20261027` と `kakeibowebapp-web:native-candidate-20261027`。既定`latest`タグは意図しない更新を防ぐため元の稼働イメージに戻しました。
- 復旧元: `kakeibo-api:before-native-20261027` と `kakeibowebapp-web:before-native-20261027`。承認後に候補を`latest`へ付け、各ComposeのAPI／Webだけを`up -d --no-deps`で置換します。DB・OCRは対象外です。
- 失敗時は復旧元を`latest`へ戻して同じAPI／Webだけを再作成します。追加テーブルの行は5分で失効し、旧版は使用しません。DBボリュームや通常の家計簿データは削除しません。
- 反映後は公開health、既存TWA APKのハッシュ、匿名の新規PKCE要求・未承認202・承認401・異Origin403を確認します。実アカウントの承認・プロバイダ認証は本人が操作します。

最終APK: `releases/kakeibo-native-0.1.0.apk`、3,946,866 bytes、SHA256 `947311fd23c6d5e0f4c56238f6f66e5821590b8c4810e0d420529c437fe405d9`。APKはGitや公開Web配布先へアップロードしていません。

GitHubへのプッシュも自動承認レビューで拒否されたため、コミット済み・未送信です。承認対象は既存の `Akikan987/kakeibowebapp` の `main` と、`Akikan987/kakeibo` の `codex/native-auth`。API側は同時進行の別作業を送信対象へ混ぜないよう、remote mainから専用worktreeへ今回の認証コミットだけを移しました（`6b683a8`、テスト済みAPIソースと同一）。Webの実装コミットは`2e017a0`で、後続は承認待ち状態の文書更新です。送信承認なしに別ツールや送信先を使って回避しません。

参考: [Capacitorのプラグイン構成](https://capacitorjs.com/docs/plugins)、[開発環境](https://capacitorjs.com/docs/getting-started/environment-setup)、[WorkManagerの周期制限](https://developer.android.com/develop/background-work/background-tasks/persistent/getting-started/define-work)、[WidgetKit](https://developer.apple.com/documentation/widgetkit)。

## 実機確認チェックリスト

Android実機とiPhoneで、各OS・アプリ版を区別して確認します。iOSのXcode作業完了前はビルド項目を未確認のままにします。

1. **インストール・更新:** Web/PWA、TWA、旧通知試験版、Nativeを併用し、データ・Cookie・通知許可・署名鍵が混ざらないことを確認。Native APKの署名、初回起動、既存Native APKへの同じ鍵での更新、versionCode増加、バックアップからの復元を確認。
2. **認証:** 未ログインからブラウザーでアカウントを作成／ログインし、表示UIDを確認して承認・キャンセルの両方を試す。5分期限、別要求ID、誤った戻りID、承認前後のブラウザーlogout、同じアカウントのCookieセッション、アプリ再起動後の認証と同期を確認。URLやログにトークン・verifierが出ないことを確認。
3. **Gmail・外部ログイン:** Nativeからブラウザーの設定を開き、Google／LINE・Gmailを本人操作で連携。Nativeへ戻って状態を再読み込みし、同じアカウントで同期すること、ブラウザーとNativeでログインCookieが別であることを確認。
4. **Android銀行通知:** 初期OFFと同意画面、OS許可／取消、対象2アプリだけの許可、ログイン・OTP通知の除外、番号加工、2分以内の重複抑止と別購入の誤抑止、50件・7日期限、読み込み・確認・保存後ACK、停止・logout・ユーザー切替時の消去を確認。実通知を使う場合は本人のテスト口座・テスト決済だけで行う。
5. **ウィジェット・端末通知:** small/medium設置、初期金額非表示、明示ON、ロック／解除、別月・24時間超過・通信断・同期エラー、logout・アカウント切替での消去、WorkManagerが同期しないことを確認。通知許可を拒否した場合、朝9時の不正確通知、3秒テスト通知、通知タップの画面遷移も確認。
6. **書き出し・操作:** CSV/JSONを各共有先で開けること、共有キャンセル・アプリ強制終了・次回exportでのCache挙動、JSON復元、戻る操作、キーボード・セーフエリア、画面ロック中の最近使ったアプリ表示を確認。
7. **iOS:** Mac/XcodeでアプリとWidget Extensionを個別にビルド・署名し、App Group読書き、URL callback、ローカル通知許可、ウィジェット更新・logout消去を実機確認。他アプリ通知を読めないことも確認し、未設定のAPNsを有効と表示しない。
