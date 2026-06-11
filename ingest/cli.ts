// 大量一括投入用の補助CLI(§4.4・任意)。PWAと同じ取り込みロジック(app/src)を再利用する。
//
// 使い方:
//   GITHUB_TOKEN=github_pat_xxx npx tsx ingest/cli.ts add refs.bib refs.ris 10.1103/PhysRev.47.777 1706.03762 \
//     --owner urakawa03 --repo paper_data [--branch main] [--dir papers] [--mailto you@example.com]
//
// トークンは環境変数 GITHUB_TOKEN で渡す(引数に書かない)。Anthropic等のAI APIには依存しない。
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { GitHubClient } from '../app/src/lib/github';
import { serializePaperMarkdown } from '../app/src/lib/markdown';
import { detectIdentifier } from '../app/src/lib/identifiers';
import { ingest, type IngestInput } from '../app/src/ingest/pipeline';

interface Args {
  files: string[];
  ids: string[];
  owner?: string;
  repo?: string;
  branch: string;
  dir: string;
  mailto?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { files: [], ids: [], branch: 'main', dir: 'papers' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--owner') args.owner = argv[++i];
    else if (a === '--repo') args.repo = argv[++i];
    else if (a === '--branch') args.branch = argv[++i];
    else if (a === '--dir') args.dir = argv[++i];
    else if (a === '--mailto') args.mailto = argv[++i];
    else if (/\.(bib|bibtex|ris|txt)$/i.test(a)) args.files.push(a);
    else args.ids.push(a);
  }
  return args;
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd !== 'add' || rest.length === 0) {
    console.error('使い方: ingest add <file.bib|file.ris|DOI|arXivID>... --owner <owner> --repo <repo>');
    process.exit(2);
  }
  const args = parseArgs(rest);
  const token = process.env.GITHUB_TOKEN;
  if (!token || !args.owner || !args.repo) {
    console.error('GITHUB_TOKEN 環境変数と --owner / --repo が必要です');
    process.exit(2);
  }

  const client = new GitHubClient({
    owner: args.owner,
    repo: args.repo,
    branch: args.branch,
    dir: args.dir,
    token,
  });

  // 既存IDはツリー(ファイル名)から取得(blobは読まない)
  const head = await client.getHeadCommitSha();
  const tree = await client.getTreePapers(head);
  const existingIds = new Set(tree.map((e) => e.path.slice(e.path.lastIndexOf('/') + 1).replace(/\.md$/, '')));

  const inputs: IngestInput[] = [];
  for (const f of args.files) {
    const text = readFileSync(f, 'utf-8');
    inputs.push({ kind: f.toLowerCase().endsWith('.ris') ? 'ris' : 'bib', text, label: basename(f) });
  }
  for (const raw of args.ids) {
    const id = detectIdentifier(raw);
    if (id) inputs.push({ kind: 'id', value: id });
    else console.error(`! 識別子として解釈できずスキップ: ${raw}`);
  }

  const result = await ingest(inputs, {
    existingIds,
    mailto: args.mailto ?? process.env.VITE_CROSSREF_MAILTO,
    onProgress: (done, total, label) => console.log(`[${done}/${total}] ${label}`),
  });

  if (result.added.length > 0) {
    const changes = result.added.map((p) => ({
      path: `${args.dir}/${p.id}.md`,
      text: serializePaperMarkdown(p),
    }));
    const { commitSha } = await client.commitFiles(
      changes,
      `ingest: add ${result.added.length} paper${result.added.length > 1 ? 's' : ''}`,
    );
    console.log(`pushed ${result.added.length}件 (commit ${commitSha.slice(0, 7)})`);
  }

  console.log(`\n追加 ${result.added.length} / スキップ ${result.skipped.length} / 失敗 ${result.failed.length}`);
  for (const s of result.skipped) console.log(`  - skip ${s.key}: ${s.reason}`);
  for (const f of result.failed) console.log(`  - fail ${f.input}: ${f.reason}`);
  if (result.added.length === 0 && result.failed.length > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
