# 論文フィードリーダー 実装仕様書

> GitHubを共有データベースとし、PC(ブラウザ)では編集・俯瞰、スマホではSNS感覚で読む、個人用の論文管理PWA。
> データは1論文1Markdownファイル。PC編集ビューとスマホ閲覧ビューは、同じPWAの画面幅に応じた2つのレイアウト。

---

## 1. 目的とコンセプト

- 読んだ・読みたい論文を「資料」ではなく「フィードのコンテンツ」として消費できるようにする。
- bib/RIS/DOIから論文情報を取り込み、abstract原文を入れてカード化する（AI要約は使わない）。
- **PCブラウザでは編集・俯瞰**（abstract原文・メモを見ながら一覧・編集）、**スマホではフィードで読む**（いいね・メモ・既読）。
- データはプレーンなMarkdownなので、将来ツールを乗り換えても資産が死なない。

### 設計上の大前提（重要）
- **データの唯一の源 (single source of truth) は、GitHubリポジトリ内のMarkdownファイル群。**
- 表示・編集はすべて**自作PWA一本**で行う。PCではブラウザ、スマホではホーム画面起動のPWAとして同じアプリを使う。Obsidian等の外部ツールには依存しない。
- iOS SafariはローカルフォルダのファイルAPIを持たないため、データ同期は**必ずGitHub API経由**で行う（iCloud/Driveのローカルフォルダ同期は使わない）。
- （任意）データはただのMarkdownなので、ユーザーが望めばObsidian等で同じリポジトリを開くことも可能。ただし仕様上の前提にはしない。

---

## 2. システム構成

| # | 名称 | 動作環境 | 役割 |
|---|------|----------|------|
| B | PWA (`app`) | ブラウザ（PC・スマホ） | 中心となる単一アプリ。`.md`をGitHub API経由で読み書き。**論文の新規追加（RIS/BIBアップロード・DOI入力）／PC幅では編集・俯瞰ビュー／スマホ幅ではフィード閲覧ビュー** |
| A（任意） | 取り込みCLI (`ingest`) | PC (Node.js or Python) | 大量のRIS/BIBを一括投入したい場合の**補助ツール**。通常の追加はPWAで完結するため必須ではない |
| - | データストア | GitHubリポジトリ (`paper-data`) | `.md`ファイル群。AとBが共有する |

AI要約は使わない。取り込みはabstract原文をそのまま本文に入れ、ユーザーが必要に応じて編集する。

### データフロー
```
[RIS/BIB/DOI] ──追加──▶ [PWA] ──read/write──▶ [GitHub repo: paper-data/papers/*.md]
                          ├─ PC幅 : 追加フォーム＋編集・俯瞰ビュー
                          └─ スマホ幅 : フィード閲覧ビュー
（任意）大量一括投入時のみ CLI で push することも可
```

---

## 3. データモデル

### 3.1 ファイル配置
- 1論文 = 1ファイル。`papers/{citekey}.md`。
- `citekey` はbibのキー、なければ `{first_author_lastname}{year}{slug}`（例: `vaswani2017attention`）。
- 添付PDFはリポジトリに含めない。外部URL(arXiv/DOI)へのリンクのみ持つ。

### 3.2 Markdownスキーマ
```markdown
---
id: vaswani2017attention
title: "Attention Is All You Need"
authors: ["Vaswani, Ashish", "Shazeer, Noam"]
year: 2017
venue: "NeurIPS"
doi: "10.48550/arXiv.1706.03762"
url: "https://arxiv.org/abs/1706.03762"
tags: ["機械学習", "Transformer", "NLP"]
liked: false
status: unread                  # unread | reading | read
added_at: 2026-06-01T12:00:00Z
updated_at: 2026-06-01T12:00:00Z
---

## Abstract
（論文のabstract原文。取り込み時に挿入。空ならユーザーが編集で補う）

## Notes
（ユーザーのメモ。PC・スマホ両方から追記・編集可）
```

### 3.3 フィールド定義
| フィールド | 型 | 必須 | 説明 |
|-----------|----|----|------|
| `id` | string | ✓ | citekey。ファイル名と一致 |
| `title` | string | ✓ | タイトル |
| `authors` | string[] | ✓ | 著者名 |
| `year` | int | ✓ | 出版年 |
| `venue` | string | | 学会/雑誌名 |
| `doi` | string | | DOI |
| `url` | string | | 本文/abstractリンク |
| `tags` | string[] | ✓ | 分類タグ（空配列可） |
| `liked` | bool | ✓ | いいね状態 |
| `status` | enum | ✓ | `unread`/`reading`/`read` |
| `added_at` | ISO8601 | ✓ | 追加日時 |
| `updated_at` | ISO8601 | ✓ | 最終更新日時。書き戻し時に必ず更新 |

本文の `## Abstract` `## Notes` は固定見出し。パーサはこの見出しでセクションを分割する。

---

## 4. 論文の取り込み（PWA機能 / 任意のCLI）

新規論文の追加は**PWA内の機能として完結**させる（ターミナル不要）。大量の一括投入をしたい場合のみ、同じロジックを持つ任意のCLI(`ingest`)を補助的に使える。**AI要約は行わず、abstract原文をそのまま本文に入れる。**

### 4.1 入力
- `.ris` ファイル（Zotero/Mendeley/EndNote/Google Scholar等のエクスポート。複数エントリ可）
- `.bib` ファイル（複数エントリ可）
- DOI 文字列
- arXiv ID（例: `1706.03762`）

PWAでは「ファイルをドロップ／選択」または「DOI・arXiv IDを貼り付け」のフォームから追加する。

### 4.2 処理ステップ
1. 入力をパースし識別子リストを得る（RIS/BIBの各エントリ、または単一のDOI/arXiv ID）。RIS/BIBのパースはブラウザ内で実行可能。
2. メタデータ取得（タイトル・著者・年・venue）:
   - RIS/BIBファイルからはファイル内の値を使う。
   - DOI/arXiv ID指定時、または不足フィールドの補完に外部APIを使う（§4.3）。
3. **abstract取得（多段フォールバック）**:
   1. RIS(`AB`/`N2`)・BibTeX(`abstract`)フィールドにあればそれを使う。
   2. 無ければ DOI/arXiv ID で外部APIから取得。
   3. それでも取れなければ空のまま保存し、ユーザーが編集ビューで原文を貼り付ける。
4. `## Abstract` にabstract原文を、`## Notes` を空で生成。タグは初期空、または指定値。
5. `paper-data/papers/{citekey}.md` を生成し、GitHubへ保存（PWAの通常の書き込み経路。CLIの場合は commit & push）。既存はスキップ（上書きは明示時のみ）。

### 4.3 メタデータ・abstract取得API（ブラウザからの利用可否）
- **Crossref API** (`https://api.crossref.org/works/{doi}`): CORS対応。ブラウザから直接呼べる。DOIベースの第一候補。
- **Semantic Scholar API**: CORS対応。DOI・arXiv IDの両方で引け、abstractを持つことが多い。補完に有効。
- **arXiv API** (`http://export.arxiv.org/api/query`): CORSヘッダーを返さない可能性があり、ブラウザ直叩きは不安定。arXiv論文は arXiv DOI(`10.48550/arXiv.xxxx`)経由でCrossref、またはSemantic Scholar経由で取得して回避する。どうしても必要なら薄いプロキシを検討。
- いずれも実装時に実際のCORS挙動を確認し、ブラウザで取れないものはRIS/BIBアップロードまたは手動入力にフォールバックする。

### 4.4 任意のCLI (`ingest`)
- 上記と同じ取り込みロジックをコマンドでも実行できる補助ツール（大量一括投入用）。
- 例: `ingest add refs.bib` / `ingest add 10.1103/PhysRev...`。
- `paper-data` リポジトリへ直接 commit & push する。Anthropic APIには依存しない（AI要約廃止のため）。

### 4.5 エラー処理
- 1件ずつcatchし、他論文の処理を止めない。外部API呼び出しに小ウェイトを入れる。失敗・スキップ・成功の件数を表示する。

---

## 5. コンポーネントB: PWA (`app`)

**1つのコードベース・1つのURLからなる単一のレスポンシブPWA**（デバイス別に別アプリを作らない）。同じアプリが2つのビュー(モード)を持ち、画面幅で出し分ける。

- **PC幅（広）→ 編集・俯瞰ビュー**（§5.A）
- **スマホ幅（狭）→ フィード閲覧ビュー**（§5.B）

ビューの選択:
- **デフォルトは画面幅による自動判定**（例: 幅 ≥ 900px で編集ビュー、未満でフィードビュー）。
- **ヘッダーに手動切り替えトグルも用意**し、PCでフィードを見たい／スマホで編集したい場合に切り替えられる。
- 2つのビューは同一データ（GitHub上の`.md` / IndexedDBキャッシュ）を共有する。
- ※ モック `PaperDeskEditor.jsx` / `PaperFeed.jsx` は提示用に分けているだけで、実装では1アプリに統合する。

データの取得・書き戻し・認証・同期（§5.C〜）は両ビュー共通。

### 5.1 技術スタック
- React + Vite（または Next.js）。レスポンシブ。
- PWA化: Web App Manifest + Service Worker（`vite-plugin-pwa` 等）。
- GitHubアクセス: GitHub REST API（`@octokit/rest` か `fetch`）。複数ファイルを1コミットにまとめるなら Git Data API。
- Markdown: `gray-matter`（frontmatter）+ `marked`/`markdown-it`（本文）。
- ローカル保存: IndexedDB（`idb`）。localStorageは使わない。

### 5.A PC編集・俯瞰ビュー（モック: `PaperDeskEditor.jsx`）
| ID | 機能 | 内容 |
|----|------|------|
| PC-1 | 2ペインレイアウト | 左=論文リスト（俯瞰）、右=選択論文の編集ペイン |
| PC-2 | リスト（本文プレビュー付き） | タイトル/著者/年/状態ドット/いいねに加え、**Abstractの抜粋(3行程度)とNotesの抜粋(あれば)を各行に表示**し、複数論文の中身を一覧でざっくり眺められる。クリックで右に全文表示 |
| PC-3 | 検索（AND/OR） | title/authors/tags/Abstract対象。スペース区切り複数語。AND/OR切替 |
| PC-4 | タグフィルタ・ソート | タグで絞り込み（複数=AND）、年/タイトルで並び替え |
| PC-5 | 本文編集 | **Abstract(原文)・Notesをその場で編集**（複数行テキスト） |
| PC-6 | メタデータ編集 | タイトル・著者・年・venue・タグ（追加/削除）を編集 |
| PC-7 | いいね/状態 | いいねトグル、status(unread→reading→read)切替 |
| PC-8 | 同期状態表示 | 「同期済み/保存中」を常時表示 |
| PC-9 | 論文の追加 | RIS/BIBファイルのドロップ・選択、またはDOI/arXiv ID入力で新規`.md`を生成（§4）。ターミナル不要 |
| PC-10 | 論文の削除 | 不要な論文を削除（GitHubから該当`.md`を削除） |

### 5.B スマホ フィード閲覧ビュー（モック: `PaperFeed.jsx`）
| ID | 機能 | 内容 |
|----|------|------|
| SP-1 | フィード | カードを縦スクロール表示（追加順/更新順） |
| SP-2 | カード | タイトル/著者・年・venue/タグchips/Abstract(3行クランプ+続きを読む)/アクション行 |
| SP-3 | 検索・タグフィルタ | AND/OR検索、タグタップで絞り込み |
| SP-4 | いいね・メモ・既読 | カードから操作。即時反映＋遅延同期 |
| SP-5 | 詳細表示 | タップでAbstract全文・メモ・元論文リンク |

### 5.C データ取得（読み込み）
- 起動時: GitHub API で `papers/` のファイル一覧→各`.md`取得（多い場合は Git Trees API）。
- 2回目以降: IndexedDBキャッシュから即表示→バックグラウンドで差分同期（`updated_at`比較）。
- オフライン時: キャッシュで全機能動作、書き戻しは保留キューへ。

### 5.D データ同期（自動が基本・手動ボタン併設）
**毎回のPush/Pullをユーザーが明示する必要はない。** 自動同期を基本とし、安心用に手動同期ボタンも置く。

書き込み(Push)は楽観的更新で自動化する:
1. 操作した瞬間にUI反映＋IndexedDB更新、`updated_at`を現在時刻に。
2. 変更を「未同期キュー」に積む。
3. debounce/バッチして（操作停止から数秒後、またはバックグラウンド移行時）まとめてGitHubへpush。1操作1コミットにしない。複数ファイル変更を1コミットに。
4. push成功でキュークリア。失敗時は保持して次回再送。

読み込み(Pull)は自動取得とする:
- アプリ起動時、およびフォアグラウンド復帰時に自動でpull（`updated_at`比較で差分反映）。
- GitHubにリアルタイム通知はないため常時同期はしない。手動の「今すぐ同期」ボタンで任意のタイミングでpull/push可能にする（複数端末を行き来した直後などに使用）。
- 同期状態（同期済み／保存中／未同期あり）を常時インジケータ表示する。

### 5.E GitHub同期の詳細
- 読み込み: `GET /repos/{owner}/{repo}/contents/papers` および各ファイル。
- 書き込み: `PUT .../contents/papers/{file}`（要 `sha`）。複数まとめは Git Data API（blob→tree→commit→update ref）。
- コミットメッセージ例: `app: update 3 papers`。
- コンフリクト方針（個人利用前提）: 書き戻し前に最新`sha`取得、last-write-wins。

### 5.F 認証
- GitHub Personal Access Token (fine-grained, 対象リポジトリのcontents read/writeのみ)。
- 初回設定画面で入力→IndexedDBに保存（端末内のみ）。設定から削除（ログアウト）可能。
- トークンはコードに含めない。クライアントのみ構成のため端末にトークンが存在する点に注意。

### 5.G PWA要件
- `manifest.json`（standalone, アイコン, テーマカラー）。
- Service Workerでアプリシェル＋`.md`をキャッシュ、オフライン起動可能に。
- iOSの「ホーム画面に追加」で全画面起動。

### 5.H UI/UX
- 配色・タイポはモック2点（`PaperFeed.jsx` / `PaperDeskEditor.jsx`）に準拠。
  - フォント: 見出し `Fraunces`、本文 `Newsreader`、UI `Archivo`（Google Fonts）。
  - 配色: 紙色オフホワイト地 + インク濃色 + 朱色アクセント1色。
- PCとスマホでデザイン言語を統一（同じアプリの2つの顔）。

---

## 6. 非機能要件
- パフォーマンス: 1000件でも滑らか（必要なら仮想スクロール `react-window`）。
- データ量: テキストのみで全件数MB想定。一括メモリ展開で問題なし。
- セキュリティ: APIキー/トークンをコミットしない。`.env`は`.gitignore`。
- 対応ブラウザ: iOS Safari、Android Chrome、デスクトップChrome/Edge。
- 可用性: オフライン閲覧・操作可、復帰時に同期。

---

## 7. リポジトリ構成（推奨: データを別リポジトリに分離）

論文データ(`.md`)は、アプリのソースとは**別のリポジトリ**に置くことを推奨する。理由:
- **デプロイの独立**: アプリを Vercel/Netlify/GitHub Pages 等にデプロイすると、リポジトリ更新で再ビルドが走る。データを同居させると、いいね/メモ等のデータ更新のたびにアプリが再デプロイされてしまう。
- **トークン最小権限**: PWAが書き込むPAT(Personal Access Token)の権限を、データリポジトリのcontents read/writeだけに限定できる。
- **公開/非公開の分離**: アプリは公開、論文メモを含むデータは非公開、と独立に設定できる。

### リポジトリ1: `paper_editer_and_reader`（コード。公開可）
```
paper_editer_and_reader/
├─ ingest/                 # （任意）大量一括投入用の補助CLI
├─ app/                    # コンポーネントB: PWA（PC編集 + スマホ閲覧）
│  ├─ src/
│  └─ public/manifest.json
├─ .env.example
├─ .gitignore
└─ paper-feed-spec.md
```

### リポジトリ2: `paper_data`（データ。非公開推奨）
```
paper_data/
└─ papers/
   └─ vaswani2017attention.md   # 1論文1ファイル
```
- PWA・取り込みCLIともに、データの読み書きは `paper_data` に対して行う。
- PWAの設定で対象リポジトリ(`owner/paper_data`)とPATを指定する。

※ どうしても1リポジトリで始めたい場合も動作はするが、上記の理由から早い段階で分離するのが望ましい。

---

## 8. 実装フェーズ

**フェーズ1: 読み取りと俯瞰**
- PWAでGitHub(`paper_data`)の`.md`を読み込み、PC編集ビューの**俯瞰・本文プレビュー・検索・タグフィルタ**まで（読み取り）。
- サンプル`.md`を数本手置きして動作確認。

**フェーズ2: 編集・追加・同期**
- GitHub認証（PAT）＋書き込み。
- PCビューの本文(Abstract)・Notes・メタデータ編集 → 楽観的更新＋バッチ同期。
- 論文の追加機能（PC-9: RIS/BIBアップロード、DOI入力 → `.md`生成）。
- スマホ フィード閲覧ビュー（いいね・メモ・既読）。

**フェーズ3: 仕上げ**
- PWA化（オフライン、ホーム画面追加）。
- 同期状態UI、ビュー手動切替トグル、論文削除、ダークモード、仮想スクロール、詳細表示。
- （任意）大量一括投入用CLIの整備。

---

## 9. 技術的制約・注意点
- iOS SafariはローカルファイルAPI非対応 → 同期は必ずGitHub API経由（ローカルフォルダ前提の実装をしない）。
- GitHub APIのレート制限 → 起動時一括取得はキャッシュ前提、書き戻しはバッチ化。
- 個人単一ユーザー前提 → 本格的な同時編集コンフリクト解決は実装しない（last-write-wins）。
- クライアントオンリーのトークン管理にはリスク。将来、トークンを秘匿しGitHubへ代理アクセスする薄いバックエンドを挟む拡張余地を残す。

---

## 10. 受け入れ基準（Definition of Done）
- [ ] PWAの追加機能（またはCLI）にDOI/arXiv ID/RIS/BIBを渡すと、abstract原文入りの`.md`が生成されGitHubに反映される。
- [ ] PCブラウザで論文を検索・絞り込み・俯瞰でき、Abstract/Notes/メタデータをその場で編集→GitHubへ書き戻せる。
- [ ] スマホでPWAをホーム画面から起動し、フィードで読み、いいね・メモ・既読を付けられる。
- [ ] いいね等が即時UI反映され、少し後にGitHubの`.md`へバッチ同期される。
- [ ] オフラインでも閲覧・操作でき、オンライン復帰で同期される。
- [ ] PCとスマホで同じデータ（GitHub上の`.md`）を共有している。
