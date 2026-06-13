import type { PaperType, RefEntry } from '../types';

// メタデータ・abstract取得の多段フォールバック(§4.3)。
// Crossref / Semantic Scholar はCORS対応でブラウザから直接呼べる。
// arXiv API はCORSが不安定なため使わず、arXiv論文は Semantic Scholar(arXiv:ID)経由で取得する。

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** JATS XML混じりのCrossref abstractをプレーンテキスト化 */
export function jatsToPlain(xml: string): string {
  return xml
    .replace(/<jats:title[^>]*>[\s\S]*?<\/jats:title>/gi, '')
    .replace(/<\/?(?:jats:)?[a-z][^>]*>/gi, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

interface CrossrefWork {
  title?: string[];
  author?: { family?: string; given?: string; name?: string }[];
  issued?: { 'date-parts'?: number[][] };
  'published-print'?: { 'date-parts'?: number[][] };
  'published-online'?: { 'date-parts'?: number[][] };
  'container-title'?: string[];
  'short-container-title'?: string[];
  volume?: string;
  issue?: string;
  page?: string;
  publisher?: string;
  type?: string;
  DOI?: string;
  URL?: string;
  abstract?: string;
}

/** Crossref work type → 内部PaperType。判定できないものはundefined(=article既定に委ねる) */
export function crossrefTypeToPaperType(t?: string): PaperType | undefined {
  switch (t) {
    case 'journal-article':
      return 'article';
    case 'proceedings-article':
      return 'inproceedings';
    case 'book':
    case 'monograph':
    case 'edited-book':
    case 'reference-book':
      return 'book';
    default:
      return undefined;
  }
}

export async function fetchCrossref(doi: string, mailto?: string): Promise<Partial<RefEntry>> {
  const qs = mailto ? `?mailto=${encodeURIComponent(mailto)}` : '';
  const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}${qs}`);
  if (!res.ok) throw new Error(`Crossref ${res.status}`);
  const msg = ((await res.json()) as { message: CrossrefWork }).message;

  const year =
    msg.issued?.['date-parts']?.[0]?.[0] ??
    msg['published-print']?.['date-parts']?.[0]?.[0] ??
    msg['published-online']?.['date-parts']?.[0]?.[0];
  const authors = (msg.author ?? [])
    .map((a) => (a.family ? (a.given ? `${a.family}, ${a.given}` : a.family) : (a.name ?? '')))
    .filter(Boolean);

  return {
    title: msg.title?.[0],
    authors,
    year,
    venue: msg['container-title']?.[0] ?? msg['short-container-title']?.[0],
    volume: msg.volume,
    number: msg.issue,
    pages: msg.page,
    publisher: msg.publisher,
    type: crossrefTypeToPaperType(msg.type),
    doi: msg.DOI ?? doi,
    url: msg.URL,
    abstract: msg.abstract ? jatsToPlain(msg.abstract) : undefined,
  };
}

interface S2Paper {
  title?: string;
  authors?: { name?: string }[];
  year?: number;
  venue?: string;
  abstract?: string;
  externalIds?: { DOI?: string; ArXiv?: string };
}

export async function fetchSemanticScholar(id: { doi?: string; arxivId?: string }): Promise<Partial<RefEntry>> {
  const pid = id.doi ? `DOI:${id.doi}` : `arXiv:${id.arxivId}`;
  const url = `https://api.semanticscholar.org/graph/v1/paper/${encodeURIComponent(pid)}?fields=title,authors,year,venue,abstract,externalIds`;
  let res = await fetch(url);
  if (res.status === 429) {
    await sleep(1500); // 無認証共有レートに当たったら1回だけバックオフ再試行
    res = await fetch(url);
  }
  if (!res.ok) throw new Error(`Semantic Scholar ${res.status}`);
  const p = (await res.json()) as S2Paper;
  return {
    title: p.title ?? undefined,
    authors: (p.authors ?? []).map((a) => a.name ?? '').filter(Boolean),
    year: p.year ?? undefined,
    venue: p.venue || undefined,
    abstract: p.abstract ?? undefined,
    doi: p.externalIds?.DOI,
    arxivId: p.externalIds?.ArXiv,
  };
}

function mergeMissing(base: RefEntry, found: Partial<RefEntry>): RefEntry {
  return {
    ...base,
    title: base.title || found.title,
    authors: base.authors.length ? base.authors : (found.authors ?? []),
    year: base.year ?? found.year,
    venue: base.venue || found.venue,
    volume: base.volume || found.volume,
    number: base.number || found.number,
    pages: base.pages || found.pages,
    publisher: base.publisher || found.publisher,
    type: base.type ?? found.type,
    doi: base.doi || found.doi,
    url: base.url || found.url,
    abstract: base.abstract || found.abstract,
    arxivId: base.arxivId || found.arxivId,
  };
}

function isComplete(e: RefEntry): boolean {
  return Boolean(e.title && e.authors.length && e.year && e.abstract);
}

/**
 * 不足フィールド(タイトル/著者/年/venue/abstract)を外部APIで補完する。
 * DOIあり: Crossref → Semantic Scholar。arXivのみ: Semantic Scholar → Crossref(arXiv DOI)。
 * 各API失敗は握りつぶし、取れたぶんだけ返す(最終的にabstract空でも保存可、§4.2)。
 */
export async function enrichEntry(e: RefEntry, opts?: { mailto?: string }): Promise<RefEntry> {
  let cur = { ...e };
  if (isComplete(cur)) return finalizeUrl(cur);

  const tries: (() => Promise<Partial<RefEntry>>)[] = [];
  if (cur.doi) {
    tries.push(() => fetchCrossref(cur.doi!, opts?.mailto));
    tries.push(() => fetchSemanticScholar({ doi: cur.doi }));
  } else if (cur.arxivId) {
    tries.push(() => fetchSemanticScholar({ arxivId: cur.arxivId }));
    tries.push(() => fetchCrossref(`10.48550/arXiv.${cur.arxivId}`, opts?.mailto));
  }
  for (const t of tries) {
    try {
      cur = mergeMissing(cur, await t());
    } catch {
      /* 次のAPIへフォールバック */
    }
    if (isComplete(cur)) break;
  }
  return finalizeUrl(cur);
}

function finalizeUrl(e: RefEntry): RefEntry {
  if (!e.url) {
    if (e.arxivId) e.url = `https://arxiv.org/abs/${e.arxivId}`;
    else if (e.doi) e.url = `https://doi.org/${e.doi}`;
  }
  if (!e.doi && e.arxivId) e.doi = `10.48550/arXiv.${e.arxivId}`;
  return e;
}
