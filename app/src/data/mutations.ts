import type { Paper, StoredPaper } from '../types';
import { dbDequeue, dbEnqueue, dbDeletePapers, dbPutPapers } from './db';
import { useAppStore } from './store';
import { schedulePush } from './sync';

// 両ビューからの全データ変更の単一窓口(§5.D 楽観的更新):
//  1) updated_at更新でUI即時反映 2) IndexedDB更新 3) 未同期キューへ 4) バッチpush予約

export async function mutatePaper(id: string, patch: Partial<Paper>): Promise<void> {
  const st = useAppStore.getState();
  const cur = st.papers[id];
  if (!cur) return;
  // 端末間の時計ズレがあっても「自分の最新編集が自分の過去に負ける」ことはないよう単調増加にする
  const prevMs = Date.parse(cur.updated_at);
  const ts = new Date(
    Number.isFinite(prevMs) ? Math.max(Date.now(), prevMs + 1) : Date.now(),
  ).toISOString();
  const next: StoredPaper = { ...cur, ...patch, id, updated_at: ts };
  st.upsertPapers([next]);
  await dbPutPapers([next]);
  await dbEnqueue(id, 'upsert');
  schedulePush();
}

/** 取り込みパイプラインからの新規追加。リモート未pushなので sha: null, base: null */
export async function addPapers(papers: Paper[]): Promise<void> {
  if (papers.length === 0) return;
  const stored: StoredPaper[] = papers.map((p) => ({ ...p, sha: null, base: null }));
  useAppStore.getState().upsertPapers(stored);
  await dbPutPapers(stored);
  for (const p of stored) await dbEnqueue(p.id, 'upsert');
  schedulePush();
}

/** 論文の削除(PC-10)。未pushの論文はローカル掃除のみでリモート操作なし */
export async function removePaper(id: string): Promise<void> {
  const st = useAppStore.getState();
  const cur = st.papers[id];
  if (!cur) return;
  st.removePapers([id]);
  await dbDeletePapers([id]);
  if (cur.sha) {
    await dbEnqueue(id, 'delete', cur.sha);
  } else {
    await dbDequeue(id);
  }
  schedulePush(); // 未push論文の場合もキュー件数表示を更新するため(空ならflushが即同期済みに戻す)
}
