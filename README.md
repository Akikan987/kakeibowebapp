# 家計簿 Webアプリ

ブラウザだけで使える家計簿アプリ。収入・支出の記録、品目別/日付別グラフ、割り勘の管理ができる。
Androidアプリ（[kakeibo](https://github.com/Akikan987/kakeibo)）と**同じサーバー・同じアカウント**でデータを共有する。

> このWebアプリが家計簿の**メイン**です。Androidアプリ（[kakeibo](https://github.com/Akikan987/kakeibo)）は同じサーバー・同じアカウントで動きますが、新機能はこちらに入れていきます。

## 特徴
- **インストール不要** — URLを開くだけで誰でも使える
- **オフライン対応** — ローカル（IndexedDB）に保存し、オンライン時にサーバーと同期
- **アカウントなしでも使える** — あとから登録すれば、それまでのデータもそのまま同期される
- **ホーム画面に追加**すればアプリのように起動できる（PWA）
- **サーバーが止まっていても起動できる** — Service Workerでアプリ本体を端末に保存

## 技術
- React + TypeScript + Vite
- Tailwind CSS（iOS風デザイン）
- Dexie（IndexedDB）でローカル保存
- nginx で静的配信 + APIを同一オリジンに中継（CORS不要）

## 開発
```bash
npm install
npm run dev     # http://localhost:5173 （APIは localhost:8000 へプロキシ）
npm run build   # dist/ に出力
```
家計簿サーバー（kakeibo リポジトリの `server/`）が `:8000` で動いている必要がある。

## デプロイ
```bash
docker compose up -d --build   # http://localhost:3000
```
Cloudflare Tunnel の Public Hostname を追加して公開する:

| 項目 | 値 |
|---|---|
| Subdomain | `app` |
| Domain | `kakeibodata.com` |
| Service | HTTP → `localhost:3000` |

→ **https://app.kakeibodata.com** で誰でもアクセスできる。
API（`kakeibodata.com`）はそのままなので、既存のAndroidアプリに影響はない。

## 同期のしくみ
Androidアプリと同じプロトコル。
- 各レコードは UUID 主キー + `updated_at` + `deleted`（論理削除）
- 競合は最終更新優先（last-write-wins）でマージ
- `POST /sync` で「自分の変更を送る」と「前回以降のサーバー変更を受け取る」を同時に行う

## データの保存先と持続性
- 記録は端末内の **IndexedDB**（Dexie）に保存される。ブラウザを閉じても端末を再起動しても残る。
- 起動時に `navigator.storage.persist()` を要求し、ブラウザの自動削除を受けにくくする。
- **ホーム画面に追加を推奨**。特に iOS Safari は、未インストールのサイトの保存領域を7日間の未訪問で削除するため。
- 「閲覧データを削除」やプライベートモードでは消える。大事なデータはログインしてサーバーに同期しておく。

## 現時点の制限
- レシートOCRは未対応（Androidアプリのみの機能）
