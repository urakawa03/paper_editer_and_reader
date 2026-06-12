import type { Filter, Paper } from '../types';

function haystack(p: Paper): string {
  return `${p.title} ${p.authors.join(' ')} ${p.tags.join(' ')} ${p.abstract} ${p.notes} ${p.pip ?? ''}`.toLowerCase();
}

/**
 * AND/OR検索(§PC-3: title/authors/tags/Abstract/Notes対象) + タグ絞り込み(複数=AND)
 * + いいね/既読フィルタ + ソート
 */
export function filterPapers<T extends Paper>(papers: T[], f: Filter): T[] {
  const terms = f.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let list = papers.filter((p) => {
    if (f.liked && !p.liked) return false;
    if (f.read === 'read' && p.status !== 'read') return false;
    if (f.read === 'unread' && p.status === 'read') return false;
    if (!f.tags.every((t) => p.tags.includes(t))) return false;
    if (terms.length === 0) return true;
    const hay = haystack(p);
    return f.mode === 'AND' ? terms.every((t) => hay.includes(t)) : terms.some((t) => hay.includes(t));
  });

  const cmp: Record<Filter['sort'], (a: Paper, b: Paper) => number> = {
    year: (a, b) => a.year - b.year,
    title: (a, b) => a.title.localeCompare(b.title, 'ja'),
    added: (a, b) => a.added_at.localeCompare(b.added_at),
    updated: (a, b) => a.updated_at.localeCompare(b.updated_at),
    // PIP未設定は末尾(昇順時)に寄せる
    pip: (a, b) => (a.pip ?? '￿').localeCompare(b.pip ?? '￿'),
  };
  list = [...list].sort(cmp[f.sort]);
  if (f.dir === 'desc') list.reverse();
  return list;
}

/** タグ入力の補完候補: 使用頻度順のallTagsを部分一致で絞り込み、付与済みタグは除外 */
export function suggestTags(allTags: string[], exclude: string[], query: string, limit = 8): string[] {
  const q = query.trim().toLowerCase();
  const ex = new Set(exclude);
  const out: string[] = [];
  for (const t of allTags) {
    if (ex.has(t)) continue;
    if (q && !t.toLowerCase().includes(q)) continue;
    out.push(t);
    if (out.length >= limit) break;
  }
  return out;
}

/** 全論文からタグ一覧(使用頻度降順 → 同数は辞書順) */
export function collectTags(papers: Paper[]): string[] {
  const counts = new Map<string, number>();
  for (const p of papers) for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'))
    .map(([t]) => t);
}
