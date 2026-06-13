import type { Paper, RefEntry } from '../types';
import { detectIdentifier } from '../lib/identifiers';
import { enrichEntry } from '../lib/enrich';
import { useAppStore } from './store';
import { mutatePaper } from './mutations';

// 既存論文の「書誌情報を再取得」: Crossref/Semantic Scholarで不足フィールドだけ埋める。
// ユーザーが編集済みの値は一切上書きしない(空欄のみ補完)。

const FIELD_LABEL: Record<string, string> = {
  title: 'タイトル',
  authors: '著者',
  year: '年',
  venue: '誌名',
  volume: '巻',
  number: '号',
  pages: 'ページ',
  publisher: '出版社',
  type: '種別',
  doi: 'DOI',
  url: 'URL',
  abstract: 'Abstract',
};

/** 再取得に使える識別子(DOI/arXiv)を論文から見つける */
export function refetchIdentifier(p: Paper): { doi?: string; arxivId?: string } | null {
  if (p.doi) {
    const d = detectIdentifier(p.doi);
    if (d) return d.kind === 'doi' ? { doi: d.value } : { arxivId: d.value };
    return { doi: p.doi };
  }
  if (p.url) {
    const d = detectIdentifier(p.url);
    if (d) return d.kind === 'doi' ? { doi: d.value } : { arxivId: d.value };
    const m = /10\.\d{4,9}\/[^\s?#]+/.exec(decodeURIComponent(p.url));
    if (m) return { doi: m[0].replace(/[.,;)]+$/, '') };
  }
  return null;
}

/** 取得結果から「空欄のみ埋める」patchを作る(純粋関数・テスト対象) */
export function buildRefetchPatch(p: Paper, found: RefEntry): Partial<Paper> {
  const patch: Partial<Paper> = {};
  if (!p.title && found.title) patch.title = found.title;
  if (p.authors.length === 0 && found.authors.length > 0) patch.authors = found.authors;
  if (!p.year && found.year) patch.year = found.year;
  if (!p.venue && found.venue) patch.venue = found.venue;
  if (!p.volume && found.volume) patch.volume = found.volume;
  if (!p.number && found.number) patch.number = found.number;
  if (!p.pages && found.pages) patch.pages = found.pages;
  if (!p.publisher && found.publisher) patch.publisher = found.publisher;
  if (!p.type && found.type) patch.type = found.type;
  if (!p.doi && found.doi) patch.doi = found.doi;
  if (!p.url && found.url) patch.url = found.url;
  if (!p.abstract.trim() && found.abstract) patch.abstract = found.abstract;
  return patch;
}

export type RefetchResult =
  | { ok: true; filled: string[] }
  | { ok: false; reason: 'no-id' | 'error'; message: string };

export async function refetchMetadata(p: Paper): Promise<RefetchResult> {
  const id = refetchIdentifier(p);
  if (!id) return { ok: false, reason: 'no-id', message: 'DOIまたはarXiv URLが必要です' };
  const mailto = useAppStore.getState().settings?.mailto;
  try {
    const base: RefEntry = {
      type: p.type,
      title: p.title || undefined,
      authors: p.authors,
      year: p.year || undefined,
      venue: p.venue,
      volume: p.volume,
      number: p.number,
      pages: p.pages,
      publisher: p.publisher,
      doi: id.doi,
      arxivId: id.arxivId,
      url: p.url,
      abstract: p.abstract.trim() || undefined,
    };
    const found = await enrichEntry(base, { mailto });
    const patch = buildRefetchPatch(p, found);
    const filled = Object.keys(patch).map((k) => FIELD_LABEL[k] ?? k);
    if (filled.length > 0) await mutatePaper(p.id, patch);
    return { ok: true, filled };
  } catch (e) {
    return { ok: false, reason: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}
