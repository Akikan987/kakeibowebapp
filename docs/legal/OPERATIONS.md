# ポリシー公開・運用記録

更新日：2026-10-15。本人から文書の公開とGit push、続いてGmail有効化と審査提出の依頼を受けた。本番環境への切り替えは影響を説明して行為時の承認を取得。サーバー設定・本人のOAuth許可・ブランド検証・データアクセス審査の提出／承認を区別する。本記録は運営用で、公開HTMLに未確定欄や編集メモを載せない。

## 本人が確認した方針

- [x] 表示名「あきかん」、問い合わせ先 `naitotsubota12@gmail.com` の掲載と、文書の公開・pushを本人が承認。
- [x] 氏名・住所は本人からの問い合わせに遅滞なく回答する運用を本人が選択。本名・住所を取得・推測・Gitに保存しない。無料だから個人情報保護法の対象外とは説明しない。
- [x] 本人確認済み：現在無料で提供し、本サービス内のAI入力補助のAPI利用料は運営者が負担する。利用者へ請求しない。
- 将来の有料化自体は未承認。事前の条件提示・必要な同意を行い、現在の無料利用を無断で課金プランへ移行しない。
- 法令上必要な未成年者の同意と利用者の権利を尊重する。独自の年齢確認、賠償額の一律上限、専属管轄は未設定なので、導入済みと記載しない。
- 問い合わせは運営者が受け付け、登録メールアドレス等で必要な範囲の本人確認後に個別回答。パスワード・コードをメールで収集しない。専用の自動開示システムは未実装。
- 重要変更・提供終了は可能な限り事前に公開ページやアプリ内で案内する。自動告知機構や特定日数の猶予を保証しない。

## 継続する運用課題

- [ ] ログの定期削除・ローテーションと、バックアップの実際の保持・復元時の削除反映を整備。今回確認したWebのDockerログはjson-file・追加設定なし。固定の自動削除期限は未設定と開示。通常のバックアップスクリプトは30日を標準とするが、手動バックアップ等は対象外。
- [ ] 外部提供先の契約主体・処理国・契約条件と、国外取り扱いに必要な説明・同意を継続確認。国内処理限定・保持ゼロ・法令適合の完了を保証しない。

## 実装と運用の再確認

- [ ] Google取得データは派生明細も含む。Gmail候補の暗号化だけでなく、通常明細・端末・DB・バックアップの保存時保護と鍵管理を点検。審査要件を満たすと未確認のまま宣言しない。
- [ ] OpenAIの実プロジェクトで学習用データ共有を有効にしていないこと、実契約の保持設定を確認。`store=false`を保持ゼロと説明しない。Gmail由来情報の汎用学習は同意があっても目的外利用にしない。
- [x] 通常OCRはサーバー処理、レシートAIは画像全体、Gmail AIは限定4項目と説明を分けた。店名の完全匿名化は保証しない。
- [ ] 連携解除、AI同意撤回、候補期限切れ、Push解除、アカウント削除を架空データで再検証。実連携は本人のOAuth同意後に別途検証する。
- [x] アカウント削除・Google権限取消・オフライン端末・バックアップ・相手の割り勘記録の制約を説明。READMEの「全データを完全削除」も修正。
- [ ] Limited Useの宣言と実際の運用を一致させる。人によるメール閲覧の例外を限定し、問い合わせを理由に無断閲覧しない。
- [x] Gmail接続機能は試験提供中、Googleデータアクセス検証は未完了と公開文書に記載。一般向け正式提供の前に安全管理・契約設定・必要な審査の確認を行い、設定保存だけを実メール読取成功・審査承認と扱わない。

## 公開方式

- 正本は `docs/legal/PRIVACY_POLICY.md` と `TERMS_OF_SERVICE.md`。`npm run legal:build` で `public/pr/privacy.html`・`terms.html` を生成し、`npm run legal:check` で生成物・リンク・未確定欄の混入を確認。通常の `npm run build` でも生成する。
- 公開URLは `https://app.kakeibodata.com/pr/privacy.html` と `https://app.kakeibodata.com/pr/terms.html`。既存 `/pr/` のService Worker除外と静的配信に含まれるため、アプリのJS・Service Workerを変更しない。紹介ページのフッターから到達できる。
- `scripts/Dockerfile.legal-release` は保存した稼働中Webイメージに、上記2ページ・CSS・紹介ページHTMLの4ファイルだけを重ねる。API・DB・OCR・トンネル・環境変数・家計簿データは変更しない。
- 文書公開後、GoogleのブランディングへのURL登録が可能。一般公開への切り替え、審査提出、Gmail有効化、本人のOAuth同意は別作業。Googleログインの設定を変更しない。

## 公開検証記録

### ドメイン所有権の確認（2026-10-15）

- 本人が承認した `kakeibodata.com` の確認用TXT追加・所有権確認を実施。前回の保存操作は承認処理の停止で未実行だったため、今回の公開DNSとCloudflare一覧で未登録を確認し、Googleの現行TXT値と照合してから1件だけ保存した。
- 15:57 JST記録: Cloudflareの一覧にTXT（apex・TTL Auto・DNS only）が現れ、Search Consoleに「所有権を証明しました」（確認方法：ドメイン名プロバイダ）が表示された。既存apex・appのTunnel CNAME2件はプロキシ・TTLを含めて維持。確認維持のためTXTは削除しない。
- Googleが示した24時間の待機に従い、2026-10-16 15:57 JST以降にブランド検証を再試行する。今日は「修正した」の申告・ブランド公開・データアクセス審査提出は行わない。所有権確認の成功はGmail審査承認を意味しない。
- 今回は運用文書のみ更新。公開HTML・アプリJS・Service Worker・API・DB・OAuth認証情報・Google／LINEログインは変更せず、実メール取得や代理のGoogle許可も行わない。OAuth実演動画・安全管理の証跡・CASA等の適用確認は残る。

### Gmail接続設定の有効化・ブランド検証（同日、文書初回公開の後）

- 22:59 JSTに本番APIのみ再作成。`gmail_configured=True`・`push_configured=True`・`gmail_ai_available=False`。反映直後のGmail接続0件で、代理のOAuth許可やメール取得は行わない。Google APIの有効化は本人の報告に基づく（こちらのAPIライブラリとAPI一覧は読み込みエラー）。
- 未設定のFernet・VAPID鍵だけを既存スクリプトで作成し、`.env`で保管。既存DB・メール配信・OpenAI・Google／LINEログイン等12設定と、Gmail専用クライアントの一致を確認。秘密設定はGit対象外。鍵の別保管は運営者が行う必要がある。
- 反映前バックアップ `D:\kakeibo_db_backup\kakeibo-gmail-activation-20261014-225856.dump` は145364 bytes、SHA256 `e37f3993085cdf2a318105a07258ff4aa078e9063578dea8deb59a198255f633`。既存バックアップは削除せず、DB・OCRの起動日時も維持。公開healthはHTTP 200。
- 本人の行為時承認後、Gmail専用プロジェクトをTestingからProductionへ切り替え。本番環境という表示は審査承認を意味しない。
- Brandingの「情報と概要」→「ブランディングを確認」から自動検証を実行。Googleは `https://app.kakeibodata.com/pr` のサイト所有権が未確認と指摘し、所有権確認後24時間待って再試行するよう表示。未修正のまま「修正した」「検出が誤り」と申告しない。ブランド未公開のため、Data accessの「Prepare for verification」は無効で、審査提出は未完了。
- DNSの公開NSはCloudflare。Search Consoleでサイト所有権を確認し、反映後にブランド検証・ブランド公開・データアクセス審査の順で進める。DNSレコードの変更や新たな所有権の認証は今回未実施。OAuth実演動画、CASA等の第三者評価、安全管理の証跡は別途確認が必要。
- 公開文書・紹介ページも、試験提供・AI OFF・Google検証未完了に合わせて更新済み。文書生成・リンク・既存PR検証が成功し、公開ページとhealthはHTTP 200。アプリJS・Service Worker・Nginx・セキュリティヘッダーのハッシュは初回公開時と同一。
- Webの反映イメージは `kakeibowebapp-web:gmail-activation-20261014`、直前の復旧用は `kakeibowebapp-web:before-gmail-activation-20261014`。公開対象8文書を新規生成鍵を含む実秘密値7件と照合し、混入0件。

### 文書の初回公開（有効化前の記録）

- 2026-10-14：文書2ページ・CSS・紹介ページHTMLの4ファイルを本番配信。`/pr/privacy.html`・`/pr/terms.html`・`/pr/legal.css`・`/pr/` はHTTP 200。紹介ページに両リンクがあり、公開本文に料金・保持期限の説明があること、未確定の編集メモがないことを確認。CSP等の公開ヘッダーを維持。
- Gmail専用プロジェクト `kakeibo-gmail-511611` のブランディングに、公開済みのポリシー・利用規約URLを保存し、保存完了表示を確認。アプリ名・既存ホームページ・ドメイン・サポート先・認証情報は変更しない。審査提出・一般公開切り替え・Gmail有効化・本人のGoogle許可は未実施。
- 復旧用イメージ `kakeibowebapp-web:before-legal-20261014` を保存。反映イメージは `kakeibowebapp-web:legal-20261014`。復旧する場合は、保存したイメージを `kakeibowebapp-web:latest` へタグ付けし、`docker compose up -d --no-build --no-deps web` でWebだけ再作成する。
- アプリの `index.html` SHA256は前後とも `e07bfc1159ba42e1dcdbf464529f032b3d5d8d364a2737ecc44f2d5c55987b88`、`sw.js` は `362d507787583363d71770728c4345257dea7b623fc754ec078fbe3c627ddee9`。Nginx設定・セキュリティヘッダー設定も同一。今回のローカル検証用通常ビルドでできた新しいアプリ資産は本番へ配信していない。
- API・DB・OCRの起動日時が反映前後で一致。家計簿データ・環境変数・OAuth認証情報を変更していない。Gmail・Pushの構成フラグはfalseを確認し、AI/メール/通知の外部呼び出しは行わない。
- 公開文書の生成一致・リンク・未確定欄チェック、既存PR検証、Web106件のテスト、型検査・Viteビルドが成功。プレビューのNginx検査も成功（従来からのMIME型重複警告あり）。390px幅で本文の横はみ出しがなく、表だけ横スクロールできることを確認し、通常幅でも公開ページを確認。
- 公開対象12ファイルを実際の設定ファイルにある秘密値5件と照合し、APIキー・秘密鍵等の混入0件。本人指定の問い合わせ先のみ意図して掲載。本名・住所・受信メール本文・実DB内容は取得・公開していない。

## 確認した根拠

- 実装：バックエンド `main.py`（アカウント削除・割り勘・OCR）、`social_auth.py`、`gmail_import.py`、`gmail_parser.py`、`web_push.py`、`receipt_ai.py`。Webの `SettingsScreen.tsx`、`GmailImport.tsx`、`store.tsx`、下書き・端末DB・Android試験実装。秘密設定・実メール・実DBの内容は参照しない。
- [バックエンドのGmail仕様](https://github.com/Akikan987/kakeibo/blob/main/server/docs/GMAIL_IMPORT.md)
- [Google Workspaceデータ利用・Limited Use・安全管理](https://developers.google.com/workspace/workspace-api-user-data-developer-policy)
- [Googleのブランド・ポリシーページ要件](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification)
- [Googleの制限付きスコープ審査](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification)
- [OpenAIのデータ管理](https://developers.openai.com/api/docs/guides/your-data)：API送信データの学習は通常行われないが、共有設定・保持・画像等の例外がある。実契約の確認は別途必要。
- [個人情報保護委員会・通則ガイドライン](https://www.ppc.go.jp/personalinfo/legal/guidelines_tsusoku/)：2-5の事業者の定義は営利・非営利を問わない。3-8-1は保有個人データに関する運営者の氏名・住所等の本人への周知を説明。
- [消費者庁・通信販売広告の表示](https://www.no-trouble.caa.go.jp/what/mailorder/advertising.htmljp)：有料サービス等で通信販売に該当する場合の氏名・名称等の表示は別途確認。通称だけで足りるとしない。

文案作成・コード確認は、法的助言、Googleの審査承認、外部サービス契約の確認、安全性評価の完了を意味しません。
