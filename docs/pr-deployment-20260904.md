# PR公開反映（2026-09-04）

ユーザーの公開反映依頼を受け、https://app.kakeibodata.com/pr/ を更新。
`pr-refresh-20260904.md` の「未公開」は制作完了時点の記録で、本記録時点では公開済み。

- 公開中のイメージを `kakeibowebapp-web:before-pr-20260904` に保持。
- 通常のDockerビルドと15件のテスト、PR専用検証は成功。ただし公開中のアプリと再ビルドのアセットに差があったため、通常ビルドは公開しなかった。
- `scripts/Dockerfile.pr-release` を使い、保持した公開中イメージに `public/pr/` と `public/og.png` のみ重ねたイメージを作成。
- `docker compose up -d --no-build --no-deps web` でWeb配信のみ更新。API・DB・トンネルは変更していない。
- 公開PRページのHTTP 200、最新見出し、日付付き画像参照を確認。
- アプリindex.htmlのSHA256は更新前後とも `d8ce252fd747971a6fabee5fdfb3ad711ecf09da571f93c529269cedaf3b3be2`。
- sw.jsのSHA256は更新前後とも `d3b3a2f09262fff3a80f6059cca3f5435c5bd7375a45aa861c41aa984c407d88`。
- PR index.htmlはソースと公開コンテナでSHA256 `15701285e301f6837fd4c31fb7bcf4e45ce7822ab9c91c0425f8a7e9557c6715` が一致。

復旧が必要な場合は保持した旧イメージをlatestへタグ付けし、同じno-build手順でWebサービスを再作成できる。通常の全体再ビルドは別途アプリ差分を確認してから行う。
