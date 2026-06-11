import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { StoredPaper } from '../src/types';
import type { FileChange } from '../src/lib/github';
import { GitHubClient, GitHubError } from '../src/lib/github';
import { parsePaperMarkdown, serializePaperMarkdown } from '../src/lib/markdown';
import { dbClearAll, dbGetQueue, dbPutPapers } from '../src/data/db';
import { useAppStore } from '../src/data/store';
import { addPapers, mutatePaper, removePaper } from '../src/data/mutations';
import { __resetSyncForTests, __setTestClient, flushPush, pull } from '../src/data/sync';

// ---- インメモリのGitHubリポジトリ(モック) ----
class FakeHub {
  files = new Map<string, { text: string; sha: string }>();
  head = 'c0';
  commits: { message: string; changes: FileChange[] }[] = [];
  treeCalls = 0;
  blobCalls = 0;
  failNext: Error | null = null;
  private counter = 0;

  seed(path: string, text: string): void {
    this.files.set(path, { text, sha: `b${++this.counter}` });
    this.head = `c${++this.counter}`;
  }
  remove(path: string): void {
    this.files.delete(path);
    this.head = `c${++this.counter}`;
  }

  async getHeadCommitSha(): Promise<string> {
    return this.head;
  }
  async getTreePapers(_commit: string): Promise<{ path: string; sha: string }[]> {
    this.treeCalls++;
    return [...this.files.entries()].map(([path, f]) => ({ path, sha: f.sha }));
  }
  async getBlobText(sha: string): Promise<string> {
    this.blobCalls++;
    for (const f of this.files.values()) if (f.sha === sha) return f.text;
    throw new GitHubError('blob not found', 404, 'notfound');
  }
  async commitFiles(changes: FileChange[], message: string) {
    if (this.failNext) {
      const e = this.failNext;
      this.failNext = null;
      throw e;
    }
    const blobShas = new Map<string, string>();
    for (const ch of changes) {
      if (ch.text === null) this.files.delete(ch.path);
      else {
        const sha = `b${++this.counter}`;
        this.files.set(ch.path, { text: ch.text, sha });
        blobShas.set(ch.path, sha);
      }
    }
    this.head = `c${++this.counter}`;
    this.commits.push({ message, changes });
    return { commitSha: this.head, blobShas };
  }
}

const mk = (id: string, over: Partial<StoredPaper> = {}): StoredPaper => ({
  id,
  title: `Paper ${id}`,
  authors: ['Doe, J.'],
  year: 2020,
  tags: [],
  liked: false,
  status: 'unread',
  added_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  abstract: 'abc',
  notes: '',
  sha: null,
  ...over,
});

let hub: FakeHub;

async function seedLocalFromRemote(): Promise<void> {
  await pull();
}

beforeEach(async () => {
  await dbClearAll();
  __resetSyncForTests();
  hub = new FakeHub();
  __setTestClient(hub as unknown as GitHubClient);
  useAppStore.setState({
    papers: {},
    selectedId: null,
    queueCount: 0,
    syncStatus: 'synced',
    syncError: null,
    settings: null,
    loaded: true,
  });
});

describe('queue', () => {
  it('同一論文への連続編集は1エントリに合体する', async () => {
    const p = mk('p1', { sha: 'remote1' });
    useAppStore.getState().setPapers([p]);
    await dbPutPapers([p]);
    await mutatePaper('p1', { liked: true });
    await mutatePaper('p1', { status: 'read' });
    await mutatePaper('p1', { notes: 'メモ' });
    expect(await dbGetQueue()).toHaveLength(1);
  });
});

describe('flushPush', () => {
  it('複数論文の変更を1コミットにまとめ、キューを消化しshaを更新する(§5.D)', async () => {
    hub.seed('papers/a.md', serializePaperMarkdown(mk('a')));
    hub.seed('papers/b.md', serializePaperMarkdown(mk('b')));
    hub.seed('papers/c.md', serializePaperMarkdown(mk('c')));
    await seedLocalFromRemote();

    await mutatePaper('a', { liked: true });
    await mutatePaper('b', { status: 'read' });
    await mutatePaper('c', { notes: 'm' });
    await flushPush();

    expect(hub.commits).toHaveLength(1);
    expect(hub.commits[0].changes).toHaveLength(3);
    expect(hub.commits[0].message).toBe('app: update 3 papers');
    expect(await dbGetQueue()).toHaveLength(0);
    expect(useAppStore.getState().syncStatus).toBe('synced');
    // リモートに反映された内容がパース可能でliked=trueになっている
    const remoteA = parsePaperMarkdown(hub.files.get('papers/a.md')!.text);
    expect(remoteA.liked).toBe(true);
    // shaがpush後のblob shaに追従
    expect(useAppStore.getState().papers['a'].sha).toBe(hub.files.get('papers/a.md')!.sha);
  });

  it('新規追加は "app: add N papers"、削除はtext:nullで送られる', async () => {
    hub.seed('papers/old.md', serializePaperMarkdown(mk('old')));
    await seedLocalFromRemote();

    await addPapers([mk('new1'), mk('new2')]);
    await flushPush();
    expect(hub.commits[0].message).toBe('app: add 2 papers');
    expect(hub.files.has('papers/new1.md')).toBe(true);

    await removePaper('old');
    await flushPush();
    expect(hub.commits[1].message).toBe('app: delete 1 paper');
    expect(hub.files.has('papers/old.md')).toBe(false);
  });

  it('未pushの論文の削除はリモート操作なしで片付く', async () => {
    await addPapers([mk('tmp')]);
    await removePaper('tmp');
    await flushPush();
    expect(hub.commits).toHaveLength(0);
    expect(await dbGetQueue()).toHaveLength(0);
  });

  it('push失敗時はキューを保持し、次のflushで再送する(§5.D-4)', async () => {
    hub.seed('papers/a.md', serializePaperMarkdown(mk('a')));
    await seedLocalFromRemote();
    await mutatePaper('a', { liked: true });

    hub.failNext = new GitHubError('boom', 500, 'other');
    await flushPush();
    expect(hub.commits).toHaveLength(0);
    expect(await dbGetQueue()).toHaveLength(1);
    expect(useAppStore.getState().syncStatus).toBe('pending');
    expect(useAppStore.getState().syncError).toContain('boom');

    await flushPush();
    expect(hub.commits).toHaveLength(1);
    expect(await dbGetQueue()).toHaveLength(0);
  });

  it('non-fast-forwardはpullしてから1回だけ再試行する(last-write-wins)', async () => {
    hub.seed('papers/a.md', serializePaperMarkdown(mk('a')));
    await seedLocalFromRemote();
    await mutatePaper('a', { liked: true });

    hub.failNext = new GitHubError('not a fast forward', 422, 'conflict');
    await flushPush();
    expect(hub.commits).toHaveLength(1);
    expect(parsePaperMarkdown(hub.files.get('papers/a.md')!.text).liked).toBe(true);
    expect(await dbGetQueue()).toHaveLength(0);
  });
});

describe('pull', () => {
  it('リモートの新規・更新を取り込み、HEAD一致時はショートサーキットする(§5.C)', async () => {
    hub.seed('papers/a.md', serializePaperMarkdown(mk('a')));
    hub.seed('papers/b.md', serializePaperMarkdown(mk('b')));
    await pull();
    expect(Object.keys(useAppStore.getState().papers).sort()).toEqual(['a', 'b']);

    const trees = hub.treeCalls;
    await pull(); // HEAD変わらず
    expect(hub.treeCalls).toBe(trees);

    // 既知shaのファイルはblobを取り直さない
    hub.seed('papers/c.md', serializePaperMarkdown(mk('c')));
    const blobs = hub.blobCalls;
    await pull();
    expect(hub.blobCalls).toBe(blobs + 1);
    expect(useAppStore.getState().papers['c']).toBeDefined();
  });

  it('リモートで消えた論文はローカルからも消える(dirtyは保持)', async () => {
    hub.seed('papers/a.md', serializePaperMarkdown(mk('a')));
    hub.seed('papers/b.md', serializePaperMarkdown(mk('b')));
    await pull();

    await mutatePaper('b', { notes: 'ローカルで編集中' }); // bをdirtyに
    hub.remove('papers/a.md');
    hub.remove('papers/b.md');
    await pull();

    const papers = useAppStore.getState().papers;
    expect(papers['a']).toBeUndefined();
    expect(papers['b']).toBeDefined(); // dirtyなので残る
  });

  it('dirty論文のリモート変更はupdated_atで新しい方が勝つ(LWW)', async () => {
    hub.seed('papers/a.md', serializePaperMarkdown(mk('a', { updated_at: '2026-01-01T00:00:00Z' })));
    hub.seed('papers/b.md', serializePaperMarkdown(mk('b', { updated_at: '2026-01-01T00:00:00Z' })));
    await pull();

    // ローカル編集(updated_at = now で必ず新しい)
    await mutatePaper('a', { notes: 'local wins' });
    // リモートはaを古い時刻のまま別内容に、bを未来時刻に変更
    hub.seed('papers/a.md', serializePaperMarkdown(mk('a', { notes: 'remote old', updated_at: '2026-01-02T00:00:00Z' })));
    hub.seed('papers/b.md', serializePaperMarkdown(mk('b', { notes: 'remote new', updated_at: '2099-01-01T00:00:00Z' })));
    await mutatePaper('b', { notes: 'local stale' }); // bもdirtyに(ただしリモートの方が未来)

    await pull();
    const st = useAppStore.getState().papers;
    expect(st['a'].notes).toBe('local wins'); // ローカルが新しい → 保持
    expect(st['b'].notes).toBe('remote new'); // リモートが新しい → 採用
    const queueIds = (await dbGetQueue()).map((q) => q.id);
    expect(queueIds).toContain('a'); // aは後でpushされる
    expect(queueIds).not.toContain('b'); // bのキューは破棄
  });
});
