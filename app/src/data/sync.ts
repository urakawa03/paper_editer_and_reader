import type { Paper, QueueEntry, StoredPaper } from '../types';
import type { FileChange } from '../lib/github';
import { GitHubClient, GitHubError } from '../lib/github';
import { mergePaper, toPaper } from '../lib/merge';
import { parsePaperMarkdown, serializePaperMarkdown } from '../lib/markdown';
import {
  dbClearQueueEntries,
  dbDeletePapers,
  dbGetMeta,
  dbGetQueue,
  dbPutPapers,
  dbQueueCount,
  dbSetMeta,
} from './db';
import { useAppStore } from './store';

// 同期エンジン(§5.D):
//  push = 楽観的更新済みの未同期キューを debounce 3秒 / 最大待ち30秒 でまとめて1コミット。
//  pull = 起動時・フォアグラウンド復帰時・手動。HEADが前回と同じならリクエスト1つで終了。
//  多端末同時利用の整合性(§5.E改):
//   - pullとpushは単一のミューテックスで直列化する(交錯による消失・巻き戻りを防ぐ)。
//   - pushは「リモートが自分の知るHEADから進んでいないか」を必ず確認し、進んでいたら
//     先にpull(3-wayマージ)してから送る。コミット自体もHEAD固定の楽観ロックで積む。
//   - コンフリクトはフィールド単位の3-wayマージ(lib/merge.ts)。別フィールドの変更は両立し、
//     同一フィールドの衝突のみ updated_at LWW。

const DEBOUNCE_MS = 3000;
const MAX_WAIT_MS = 30000;
const PULL_CONCURRENCY = 6;
/** 表示中の定期pull間隔。HEAD未変更なら1リクエストで終わるためレート消費は軽い */
const PULL_INTERVAL_MS = 75000;
const META_HEAD = 'lastRemoteCommitSha';

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let firstQueuedAt: number | null = null;
let testClient: GitHubClient | null = null;

/** pull/pushを直列化するミューテックス(チェーン) */
let chain: Promise<unknown> = Promise.resolve();
/** 直近pullで見たリモートのid集合。pushでの「既に無いファイルの削除」回避に使う */
let lastRemoteIds: Set<string> | null = null;

function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = () => fn();
  const next = chain.then(run, run);
  chain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

/** テスト用: GitHubClientを差し替える */
export function __setTestClient(c: GitHubClient | null): void {
  testClient = c;
}

/** テスト用: タイマー・フラグを初期状態に戻す */
export function __resetSyncForTests(): void {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = null;
  firstQueuedAt = null;
  chain = Promise.resolve();
  lastRemoteIds = null;
}

function getClient(): GitHubClient | null {
  if (testClient) return testClient;
  const gh = useAppStore.getState().settings?.github;
  return gh ? new GitHubClient(gh) : null;
}

async function refreshSyncStatus(scheduled: boolean): Promise<void> {
  const queueCount = await dbQueueCount();
  const status = queueCount === 0 ? 'synced' : scheduled ? 'saving' : 'pending';
  useAppStore.getState().setSync({ queueCount, syncStatus: status });
}

/** 操作直後に呼ぶ。debounce+maxWaitでflushPushを予約する */
export function schedulePush(): void {
  const now = Date.now();
  firstQueuedAt ??= now;
  if (pushTimer) clearTimeout(pushTimer);
  const delay = Math.max(0, Math.min(DEBOUNCE_MS, firstQueuedAt + MAX_WAIT_MS - now));
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void flushPush();
  }, delay);
  void refreshSyncStatus(true);
}

function buildCommitMessage(snapshot: QueueEntry[], papers: Record<string, StoredPaper>): string {
  let adds = 0;
  let dels = 0;
  let updates = 0;
  for (const q of snapshot) {
    if (q.op === 'delete') dels++;
    else if (papers[q.id]?.sha === null) adds++;
    else updates++;
  }
  const parts: string[] = [];
  if (adds) parts.push(`add ${adds}`);
  if (updates) parts.push(`update ${updates}`);
  if (dels) parts.push(`delete ${dels}`);
  const total = adds + updates + dels;
  return `app: ${parts.join(', ')} paper${total > 1 ? 's' : ''}`;
}

async function runPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++];
      await fn(item);
    }
  });
  await Promise.all(workers);
}

/** pull本体(ミューテックス保持前提)。リモートの差分を取り込み、dirtyな論文は3-wayマージする */
async function pullCore(client: GitHubClient): Promise<void> {
  const head = await client.getHeadCommitSha();
  const known = await dbGetMeta<string>(META_HEAD);
  if (head === known) return;

  const entries = await client.getTreePapers(head);
  const local = useAppStore.getState().papers;
  const queueAtStart = await dbGetQueue();
  const pendingDelete = new Set(queueAtStart.filter((q) => q.op === 'delete').map((q) => q.id));

  const remoteIds = new Set<string>();
  const toFetch: { id: string; sha: string }[] = [];
  for (const e of entries) {
    const id = e.path.slice(e.path.lastIndexOf('/') + 1).replace(/\.md$/, '');
    remoteIds.add(id);
    if (pendingDelete.has(id)) continue; // ローカルの削除予約が勝つ(次のpushで消す)
    const loc = local[id];
    if (!loc || loc.sha !== e.sha) toFetch.push({ id, sha: e.sha });
  }

  const prepared: { id: string; sha: string; remote: Paper }[] = [];
  await runPool(toFetch, PULL_CONCURRENCY, async ({ id, sha }) => {
    const text = await client.getBlobText(sha);
    try {
      prepared.push({ id, sha, remote: parsePaperMarkdown(text, id) });
    } catch {
      /* 壊れたファイルはスキップ */
    }
  });

  // 適用はfetch完了後にまとめて行い、その時点のキュー・store内容で判定する
  // (pull中のローカル編集を取りこぼさないため)
  const queuedNow = new Map((await dbGetQueue()).map((q) => [q.id, q]));
  const upserts: StoredPaper[] = [];
  const settled: QueueEntry[] = [];
  for (const it of prepared) {
    const entry = queuedNow.get(it.id);
    if (entry?.op === 'delete') continue;
    const cur = useAppStore.getState().papers[it.id];
    if (cur && entry) {
      const merged = mergePaper(cur.base, toPaper(cur), it.remote);
      upserts.push({ ...merged, sha: it.sha, base: it.remote });
      // マージ結果がリモートと一致 = 送るべき差分なし → キュー消化
      if (serializePaperMarkdown(merged) === serializePaperMarkdown(it.remote)) settled.push(entry);
    } else {
      upserts.push({ ...it.remote, sha: it.sha, base: it.remote });
    }
  }

  // リモートに無い論文: ローカルに未送信の変更が無く、push済み(sha有り)なら削除に追従
  const localNow = useAppStore.getState().papers;
  const removed = Object.keys(localNow).filter(
    (id) => !remoteIds.has(id) && !queuedNow.has(id) && localNow[id].sha !== null,
  );

  if (upserts.length) {
    useAppStore.getState().upsertPapers(upserts);
    await dbPutPapers(upserts);
  }
  if (settled.length) await dbClearQueueEntries(settled);
  if (removed.length) {
    useAppStore.getState().removePapers(removed);
    await dbDeletePapers(removed);
  }

  lastRemoteIds = remoteIds;
  await dbSetMeta(META_HEAD, head);
  const now = new Date().toISOString();
  await dbSetMeta('lastSyncAt', now);
  useAppStore.getState().setSync({ lastSyncAt: now, syncError: null });
}

/** push本体(ミューテックス保持前提)。リモートが進んでいたら先にpull(マージ)してから送る */
async function pushCore(client: GitHubClient): Promise<void> {
  let snapshot = await dbGetQueue();
  if (snapshot.length === 0) {
    firstQueuedAt = null;
    return;
  }
  useAppStore.getState().setSync({ syncStatus: 'saving' });

  // 他端末の変更を黙って上書きしないため、自分の知るHEADから進んでいたら必ず先に取り込む
  const head = await client.getHeadCommitSha();
  if (head !== (await dbGetMeta<string>(META_HEAD))) {
    await pullCore(client);
    snapshot = await dbGetQueue();
    if (snapshot.length === 0) {
      firstQueuedAt = null;
      return;
    }
  }

  for (let attempt = 0; ; attempt++) {
    const dir = useAppStore.getState().settings?.github?.dir ?? 'papers';
    const papers = useAppStore.getState().papers;
    const changes: FileChange[] = [];
    const pushed = new Map<string, Paper>(); // 実際に送った内容(成功後にbaseへ反映)
    const stale: QueueEntry[] = [];
    for (const q of snapshot) {
      if (q.op === 'upsert') {
        const p = papers[q.id];
        if (!p) {
          stale.push(q); // すでにローカル削除済みなどの行は掃除
          continue;
        }
        const plain = toPaper(p);
        changes.push({ path: `${dir}/${q.id}.md`, text: serializePaperMarkdown(plain) });
        pushed.set(q.id, plain);
      } else {
        // 未pushの論文、またはリモートに既に無いファイルの削除はリモート操作不要
        if (q.sha && (lastRemoteIds === null || lastRemoteIds.has(q.id))) {
          changes.push({ path: `${dir}/${q.id}.md`, text: null });
        } else {
          stale.push(q);
        }
      }
    }
    if (stale.length) await dbClearQueueEntries(stale);
    if (changes.length === 0) {
      await dbClearQueueEntries(snapshot);
      firstQueuedAt = null;
      return;
    }

    try {
      // 直近pull時点のHEADを親に固定(楽観ロック)。リモートが進んでいればconflictで落ちる
      const baseHead = await dbGetMeta<string>(META_HEAD);
      const message = buildCommitMessage(snapshot, papers);
      const { commitSha, blobShas } = await client.commitFiles(changes, message, baseHead);

      await dbClearQueueEntries(snapshot);
      const updated: StoredPaper[] = [];
      for (const [id, plain] of pushed) {
        const sha = blobShas.get(`${dir}/${id}.md`);
        const cur = useAppStore.getState().papers[id];
        if (sha && cur) updated.push({ ...cur, sha, base: plain });
      }
      if (updated.length) {
        useAppStore.getState().upsertPapers(updated);
        await dbPutPapers(updated);
      }
      if (lastRemoteIds) {
        for (const ch of changes) {
          const id = ch.path.slice(ch.path.lastIndexOf('/') + 1).replace(/\.md$/, '');
          if (ch.text === null) lastRemoteIds.delete(id);
          else lastRemoteIds.add(id);
        }
      }
      await dbSetMeta(META_HEAD, commitSha);
      const now = new Date().toISOString();
      await dbSetMeta('lastSyncAt', now);
      firstQueuedAt = null;
      useAppStore.getState().setSync({ lastSyncAt: now, syncError: null });
      return;
    } catch (e) {
      if (e instanceof GitHubError && e.kind === 'conflict' && attempt === 0) {
        // 他端末が先にpushした: pull(3-wayマージ) → 1回だけ再送
        await pullCore(client);
        snapshot = await dbGetQueue();
        if (snapshot.length === 0) {
          firstQueuedAt = null;
          return;
        }
        continue;
      }
      throw e;
    }
  }
}

/** 未同期キューをまとめてGitHubへpushする。失敗時はキューを保持し次のトリガで再送(§5.D-4) */
export async function flushPush(): Promise<void> {
  const client = getClient();
  if (!client) return;
  // このflushが予約分を引き取る(手動同期と予約の二重実行を防ぐ)
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  try {
    await runExclusive(() => pushCore(client));
  } catch (e) {
    useAppStore.getState().setSync({ syncError: e instanceof Error ? e.message : String(e) });
  } finally {
    await refreshSyncStatus(pushTimer !== null);
  }
}

/** リモートの差分を取り込む(§5.C)。dirtyな論文はフィールド単位3-wayマージ(§5.E改) */
export async function pull(): Promise<void> {
  const client = getClient();
  if (!client) return;
  try {
    await runExclusive(() => pullCore(client));
  } catch (e) {
    useAppStore.getState().setSync({ syncError: e instanceof Error ? e.message : String(e) });
    throw e;
  } finally {
    await refreshSyncStatus(pushTimer !== null);
  }
}

/** 手動「今すぐ同期」: pull → push(§5.D) */
export async function syncNow(): Promise<void> {
  try {
    await pull();
  } catch {
    /* pull失敗でもpushは試す */
  }
  await flushPush();
}

let engineInitialized = false;

/** 起動時に1回呼ぶ(多重呼び出しは無視)。visibilitychange / online のリスナーを張る(§5.D) */
export function initSyncEngine(): void {
  if (engineInitialized) return;
  engineInitialized = true;
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        // バックグラウンド移行時は即時flush(§5.D-3)
        if (pushTimer) {
          clearTimeout(pushTimer);
          pushTimer = null;
        }
        void flushPush();
      } else {
        void pull().catch(() => {});
      }
    });
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      void syncNow();
    });
    window.addEventListener('offline', () => {
      void refreshSyncStatus(false);
    });
    // 別端末の変更を「ほぼライブ」で反映する定期pull(表示中のみ)
    window.setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine !== false) {
        void pull().catch(() => {});
      }
    }, PULL_INTERVAL_MS);
  }
}

/** 起動時のキュー件数反映 */
export async function restoreSyncState(): Promise<void> {
  const lastSyncAt = (await dbGetMeta<string>('lastSyncAt')) ?? null;
  useAppStore.getState().setSync({ lastSyncAt });
  await refreshSyncStatus(false);
  const count = await dbQueueCount();
  if (count > 0) schedulePush(); // 前回送れなかった分を再送
}
