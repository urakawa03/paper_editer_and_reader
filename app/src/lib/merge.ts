import type { Paper, StoredPaper } from '../types';

// 同期コンフリクトの解決(§5.E改): フィールド単位の3-wayマージ。
// 「スマホでいいね・PCでメモ編集」のように別フィールドを触った変更は両方生かし、
// 同一フィールドの衝突のみ updated_at の新しい方を採る(LWW)。
// base(共通祖先)が無い旧データはファイル全体のLWWにフォールバックする。

function eq(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** タグは集合として3-wayマージ: どちらかが消したものは消え、どちらかが足したものは残る */
function mergeTags(base: string[], local: string[], remote: string[]): string[] {
  const b = new Set(base);
  const l = new Set(local);
  const r = new Set(remote);
  const out: string[] = [];
  for (const t of [...local, ...remote]) {
    if (out.includes(t)) continue;
    const deleted = b.has(t) && (!l.has(t) || !r.has(t));
    if (!deleted) out.push(t);
  }
  return out;
}

export function toPaper(p: StoredPaper | Paper): Paper {
  return {
    id: p.id,
    pip: p.pip,
    type: p.type,
    title: p.title,
    authors: p.authors,
    year: p.year,
    venue: p.venue,
    booktitle: p.booktitle,
    volume: p.volume,
    number: p.number,
    pages: p.pages,
    publisher: p.publisher,
    address: p.address,
    edition: p.edition,
    howpublished: p.howpublished,
    note: p.note,
    doi: p.doi,
    url: p.url,
    tags: p.tags,
    liked: p.liked,
    status: p.status,
    added_at: p.added_at,
    updated_at: p.updated_at,
    abstract: p.abstract,
    notes: p.notes,
  };
}

export function mergePaper(base: Paper | null, local: Paper, remote: Paper): Paper {
  if (!base) return remote.updated_at > local.updated_at ? toPaper(remote) : toPaper(local);

  const newer = remote.updated_at > local.updated_at ? remote : local;
  const pick = <K extends keyof Paper>(k: K): Paper[K] => {
    if (eq(local[k], base[k])) return remote[k]; // ローカル未変更 → リモート採用
    if (eq(remote[k], base[k])) return local[k]; // リモート未変更 → ローカル採用
    return newer[k]; // 両方変更 → フィールド単位LWW
  };

  return {
    id: local.id,
    pip: pick('pip'),
    type: pick('type'),
    title: pick('title'),
    authors: pick('authors'),
    year: pick('year'),
    venue: pick('venue'),
    booktitle: pick('booktitle'),
    volume: pick('volume'),
    number: pick('number'),
    pages: pick('pages'),
    publisher: pick('publisher'),
    address: pick('address'),
    edition: pick('edition'),
    howpublished: pick('howpublished'),
    note: pick('note'),
    doi: pick('doi'),
    url: pick('url'),
    tags: mergeTags(base.tags, local.tags, remote.tags),
    liked: pick('liked'),
    status: pick('status'),
    added_at: pick('added_at'),
    updated_at: local.updated_at > remote.updated_at ? local.updated_at : remote.updated_at,
    abstract: pick('abstract'),
    notes: pick('notes'),
  };
}
