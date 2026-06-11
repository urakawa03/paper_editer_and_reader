import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AppSettings, QueueEntry, StoredPaper } from '../types';
import { DEFAULT_UI } from '../types';

interface PaperFeedDB extends DBSchema {
  papers: { key: string; value: StoredPaper };
  queue: { key: string; value: QueueEntry };
  meta: { key: string; value: unknown };
  settings: { key: string; value: AppSettings };
}

let dbPromise: Promise<IDBPDatabase<PaperFeedDB>> | null = null;

function getDb(): Promise<IDBPDatabase<PaperFeedDB>> {
  dbPromise ??= openDB<PaperFeedDB>('paperfeed', 1, {
    upgrade(db) {
      db.createObjectStore('papers', { keyPath: 'id' });
      db.createObjectStore('queue', { keyPath: 'id' });
      db.createObjectStore('meta');
      db.createObjectStore('settings');
    },
  });
  return dbPromise;
}

export async function dbGetAllPapers(): Promise<StoredPaper[]> {
  return (await getDb()).getAll('papers');
}

export async function dbPutPapers(papers: StoredPaper[]): Promise<void> {
  const tx = (await getDb()).transaction('papers', 'readwrite');
  for (const p of papers) void tx.store.put(p);
  await tx.done;
}

export async function dbDeletePapers(ids: string[]): Promise<void> {
  const tx = (await getDb()).transaction('papers', 'readwrite');
  for (const id of ids) void tx.store.delete(id);
  await tx.done;
}

/** 同一論文への連続操作は1エントリに自然合体する(queuedAtのみ更新) */
export async function dbEnqueue(id: string, op: QueueEntry['op'], sha?: string | null): Promise<void> {
  await (await getDb()).put('queue', { id, op, queuedAt: Date.now(), ...(op === 'delete' ? { sha } : {}) });
}

export async function dbDequeue(id: string): Promise<void> {
  await (await getDb()).delete('queue', id);
}

export async function dbGetQueue(): Promise<QueueEntry[]> {
  return (await getDb()).getAll('queue');
}

export async function dbQueueCount(): Promise<number> {
  return (await getDb()).count('queue');
}

/** push成功後にsnapshot分のみ削除。フライト中に再編集された(queuedAtが進んだ)行は残す */
export async function dbClearQueueEntries(snapshot: QueueEntry[]): Promise<void> {
  const tx = (await getDb()).transaction('queue', 'readwrite');
  for (const entry of snapshot) {
    const cur = await tx.store.get(entry.id);
    if (cur && cur.queuedAt <= entry.queuedAt) void tx.store.delete(entry.id);
  }
  await tx.done;
}

export async function dbGetMeta<T>(key: string): Promise<T | undefined> {
  return (await (await getDb()).get('meta', key)) as T | undefined;
}

export async function dbSetMeta(key: string, value: unknown): Promise<void> {
  await (await getDb()).put('meta', value, key);
}

export async function dbGetSettings(): Promise<AppSettings | undefined> {
  return (await getDb()).get('settings', 'app');
}

export async function dbSetSettings(s: AppSettings): Promise<void> {
  await (await getDb()).put('settings', s, 'app');
}

/** ログアウト: 全ストアをクリア(設定・キャッシュ・キュー・メタ) */
export async function dbClearAll(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['papers', 'queue', 'meta', 'settings'], 'readwrite');
  void tx.objectStore('papers').clear();
  void tx.objectStore('queue').clear();
  void tx.objectStore('meta').clear();
  void tx.objectStore('settings').clear();
  await tx.done;
}

export { DEFAULT_UI };
