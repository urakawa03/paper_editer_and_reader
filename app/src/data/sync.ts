import type { QueueEntry, StoredPaper } from '../types';
import { GitHubClient, GitHubError } from '../lib/github';
import { parsePaperMarkdown, serializePaperMarkdown } from '../lib/markdown';
import {
  dbClearQueueEntries,
  dbDeletePapers,
  dbDequeue,
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
//  コンフリクトは last-write-wins(§5.E): push失敗(non-fast-forward)→pull→1回だけ再push。

const DEBOUNCE_MS = 3000;
const MAX_WAIT_MS = 30000;
const PULL_CONCURRENCY = 6;
const META_HEAD = 'lastRemoteCommitSha';

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let firstQueuedAt: number | null = null;
let pushing = false;
let rerunAfterPush = false;
let conflictRetry = false;
let pullInFlight: Promise<void> | null = null;
let testClient: GitHubClient | null = null;

/** テスト用: GitHubClientを差し替える */
export function __setTestClient(c: GitHubClient | null): void {
  testClient = c;
}

/** テスト用: タイマー・フラグを初期状態に戻す */
export function __resetSyncForTests(): void {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = null;
  firstQueuedAt = null;
  pushing = false;
  rerunAfterPush = false;
  conflictRetry = false;
  pullInFlight = null;
}

function getClient(): GitHubClient | null {
  if (testClient) return testClient;
  const gh = useAppStore.getState().settings?.github;
  return gh ? new GitHubClient(gh) : null;
}

async function refreshSyncStatus(scheduled: boolean): Promise<void> {
  const queueCount = await dbQueueCount();
  const status = queueCount === 0 ? 'synced' : scheduled || pushing ? 'saving' : 'pending';
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

/** 未同期キューをまとめてGitHubへpushする。失敗時はキューを保持し次のトリガで再送(§5.D-4) */
export async function flushPush(): Promise<void> {
  if (pushing) {
    rerunAfterPush = true;
    return;
  }
  const client = getClient();
  if (!client) return;
  // このflushが予約分を引き取る(手動同期と予約の二重実行を防ぐ)
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  const state = useAppStore.getState();
  const dir = state.settings?.github?.dir ?? 'papers';

  const snapshot = await dbGetQueue();
  if (snapshot.length === 0) {
    firstQueuedAt = null;
    await refreshSyncStatus(false);
    return;
  }

  pushing = true;
  useAppStore.getState().setSync({ syncStatus: 'saving' });
  try {
    const papers = useAppStore.getState().papers;
    const changes = [];
    const stale: QueueEntry[] = [];
    for (const q of snapshot) {
      if (q.op === 'upsert') {
        const p = papers[q.id];
        if (!p) {
          stale.push(q); // すでにローカル削除済みなどの行は掃除
          continue;
        }
        changes.push({ path: `${dir}/${q.id}.md`, text: serializePaperMarkdown(p) });
      } else {
        // 未pushの論文(sha無し)はリモート操作不要
        if (q.sha) changes.push({ path: `${dir}/${q.id}.md`, text: null });
        else stale.push(q);
      }
    }
    if (stale.length) await dbClearQueueEntries(stale);
    if (changes.length === 0) {
      await dbClearQueueEntries(snapshot);
      firstQueuedAt = null;
      return;
    }

    const message = buildCommitMessage(snapshot, papers);
    const { commitSha, blobShas } = await client.commitFiles(changes, message);

    await dbClearQueueEntries(snapshot);
    // pushしたファイルのblob shaを反映(次回pullの差分判定に使う)
    const updated: StoredPaper[] = [];
    for (const q of snapshot) {
      if (q.op !== 'upsert') continue;
      const sha = blobShas.get(`${dir}/${q.id}.md`);
      const p = useAppStore.getState().papers[q.id];
      if (sha && p) updated.push({ ...p, sha });
    }
    if (updated.length) {
      useAppStore.getState().upsertPapers(updated);
      await dbPutPapers(updated);
    }
    await dbSetMeta(META_HEAD, commitSha);
    const now = new Date().toISOString();
    await dbSetMeta('lastSyncAt', now);
    firstQueuedAt = null;
    useAppStore.getState().setSync({ lastSyncAt: now, syncError: null });
  } catch (e) {
    if (e instanceof GitHubError && e.kind === 'conflict' && !conflictRetry) {
      // 他端末が先にpushした: pull(ローカルのdirtyはupdated_at比較で保持) → 1回だけ再push
      conflictRetry = true;
      pushing = false;
      try {
        await pull();
        await flushPush();
        return;
      } catch {
        /* 失敗はキュー保持のまま */
      } finally {
        conflictRetry = false;
      }
    }
    useAppStore.getState().setSync({ syncError: e instanceof Error ? e.message : String(e) });
  } finally {
    pushing = false;
    await refreshSyncStatus(pushTimer !== null);
    if (rerunAfterPush) {
      rerunAfterPush = false;
      schedulePush();
    }
  }
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

/** リモートの差分を取り込む(§5.C)。dirtyな論文はupdated_at比較のlast-write-wins */
export async function pull(): Promise<void> {
  if (pullInFlight) return pullInFlight;
  const client = getClient();
  if (!client) return;
  pullInFlight = (async () => {
    const head = await client.getHeadCommitSha();
    const known = await dbGetMeta<string>(META_HEAD);
    if (head === known) return;

    const entries = await client.getTreePapers(head);
    const st = useAppStore.getState();
    const local = st.papers;
    const dirty = new Set((await dbGetQueue()).map((q) => q.id));

    const remoteIds = new Set<string>();
    const toFetch: { id: string; sha: string }[] = [];
    for (const e of entries) {
      const id = e.path.slice(e.path.lastIndexOf('/') + 1).replace(/\.md$/, '');
      remoteIds.add(id);
      const loc = local[id];
      if (!loc || loc.sha !== e.sha) toFetch.push({ id, sha: e.sha });
    }

    const upserts: StoredPaper[] = [];
    const dequeues: string[] = [];
    await runPool(toFetch, PULL_CONCURRENCY, async ({ id, sha }) => {
      const text = await client.getBlobText(sha);
      let parsed;
      try {
        parsed = parsePaperMarkdown(text, id);
      } catch {
        return; // 壊れたファイルはスキップ
      }
      const loc = useAppStore.getState().papers[id];
      if (loc && dirty.has(id)) {
        if (parsed.updated_at > loc.updated_at) {
          upserts.push({ ...parsed, sha }); // リモートが新しい: 採用しキューを破棄
          dequeues.push(id);
        } else {
          upserts.push({ ...loc, sha }); // ローカルが新しい: 内容は保持、shaのみ追従(後のpushが上書き)
        }
      } else {
        upserts.push({ ...parsed, sha });
      }
    });

    // リモートに無い論文: ローカルにdirtyが無ければ削除に追従
    const removed = Object.keys(local).filter((id) => !remoteIds.has(id) && !dirty.has(id));

    if (upserts.length) {
      useAppStore.getState().upsertPapers(upserts);
      await dbPutPapers(upserts);
    }
    for (const id of dequeues) await dbDequeue(id);
    if (removed.length) {
      useAppStore.getState().removePapers(removed);
      await dbDeletePapers(removed);
    }

    await dbSetMeta(META_HEAD, head);
    const now = new Date().toISOString();
    await dbSetMeta('lastSyncAt', now);
    useAppStore.getState().setSync({ lastSyncAt: now, syncError: null });
  })();
  try {
    await pullInFlight;
  } catch (e) {
    useAppStore.getState().setSync({ syncError: e instanceof Error ? e.message : String(e) });
    throw e;
  } finally {
    pullInFlight = null;
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
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
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
        void pull();
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
