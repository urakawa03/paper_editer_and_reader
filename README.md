# Stacks. — 論文フィードリーダー

GitHubリポジトリのMarkdownを唯一のデータソースにする、個人用の論文管理PWA。
PCブラウザでは**編集・俯瞰ビュー**、スマホでは**フィード閲覧ビュー**として動く単一のレスポンシブアプリです。
詳細仕様は [paper-feed-spec.md](./paper-feed-spec.md) を参照。

```
[RIS/BIB/DOI] ──追加──▶ [PWA] ──read/write──▶ [GitHub repo: paper_data/papers/*.md]
                          ├─ PC幅 : 追加フォーム＋編集・俯瞰ビュー
                          └─ スマホ幅 : フィード閲覧ビュー
```

## リポジトリ構成

| パス | 内容 |
|------|------|
| `app/` | PWA本体（React + Vite + TypeScript） |
| `ingest/` | （任意）大量一括投入用CLI。PWAと同じ取り込みロジックを再利用 |
| `paper-feed-spec.md` | 実装仕様書 |
| `PaperDeskEditor.jsx` / `PaperFeed.jsx` | デザインモック（参照用） |

論文データ本体は別リポジトリ **`paper_data`**（非公開推奨）の `papers/*.md` に置きます（1論文=1ファイル）。

## セットアップ（開発）

```bash
cd app
npm install
npm run dev            # http://localhost:5173/paper_editer_and_reader/
```

- 初回起動時に設定画面が開きます。データリポジトリ（owner / repo / branch / dir）と
  **fine-grained PAT**（対象リポジトリのみ・Contents Read and write のみ）を入力してください。
  トークンは端末のIndexedDBにのみ保存されます。
- GitHubなしでUIだけ確認する場合: `VITE_FIXTURES=1 npm run dev`（同梱サンプルを表示）。

```bash
npm test               # vitest（パーサ・同期エンジンの単体テスト）
npm run build          # 型チェック + 本番ビルド（PWA/Service Worker生成）
npm run preview        # ビルド結果の確認
npm run icons          # public/icons/ のPNGを再生成
```

## デプロイ（GitHub Pages）

mainブランチへのpushで `.github/workflows/deploy.yml` が `app/` をビルドし、GitHub Pagesへ自動デプロイします。

**初回のみ**: リポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** に設定してください。
公開URLは `https://<owner>.github.io/paper_editer_and_reader/` になります。

- スマホ（iOS Safari / Android Chrome）でこのURLを開き「ホーム画面に追加」すると、スタンドアロンのPWAとして起動します。
- 別の場所（Vercel等）にホストする場合は `VITE_BASE=/ npm run build` のようにベースパスを上書きしてください。

## PAT（Personal Access Token）の作り方

1. GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token
2. Repository access: **Only select repositories** → `paper_data` だけを選択
3. Permissions: **Contents → Read and write**（それ以外は不要）
4. 生成されたトークンをアプリの設定画面に貼り付け

## 一括投入CLI（任意）

```bash
GITHUB_TOKEN=github_pat_xxx npx tsx ingest/cli.ts add refs.bib 10.1103/PhysRev.47.777 1706.03762 \
  --owner <owner> --repo paper_data
```

RIS/BIBファイル・DOI・arXiv IDを混在で渡せます。メタデータ・abstract原文は Crossref → Semantic Scholar の順で補完し、`papers/{citekey}.md` を1コミットでpushします（既存citekey/DOIはスキップ）。

## 実装メモ（仕様からの意図的な差分）

- frontmatterは `gray-matter` ではなく `yaml` + 自作スプリッタ（Buffer非依存・キー順固定の決定的シリアライズでGit差分を最小化）。
- GitHubアクセスは `@octokit/rest` ではなく素のfetchラッパー（必要エンドポイントが少なくCLIと共用のため）。
- 書き込みはContents APIではなくGit Data API（blob→tree→commit→ref）に一本化し、複数ファイル変更を常に1コミットで送る。
- arXiv APIはCORSが不安定なため使わず、arXiv論文はSemantic Scholar / Crossref(arXiv DOI)経由で取得。
