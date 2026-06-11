import type { RefEntry } from '../types';
import { detectIdentifier } from './identifiers';

// RISは行ベース: "TY  - JOUR" 〜 "ER  -"。タグ無し行は直前フィールドへの継続行。
const TAG_RE = /^([A-Z][A-Z0-9])\s+-\s?(.*)$/;

interface RawEntry {
  fields: Map<string, string[]>;
}

function get(e: RawEntry, ...tags: string[]): string | undefined {
  for (const t of tags) {
    const v = e.fields.get(t);
    if (v?.length && v[0].trim()) return v[0].trim();
  }
  return undefined;
}

function toRefEntry(e: RawEntry): RefEntry | null {
  const authors = [...(e.fields.get('AU') ?? []), ...(e.fields.get('A1') ?? [])]
    .map((a) => a.trim())
    .filter(Boolean);
  const yearRaw = get(e, 'PY', 'Y1', 'DA');
  const year = yearRaw ? Number(/\d{4}/.exec(yearRaw)?.[0]) : undefined;
  const doiRaw = get(e, 'DO', 'DI');
  const doi = doiRaw ? (detectIdentifier(doiRaw)?.kind === 'doi' ? detectIdentifier(doiRaw)?.value : doiRaw) : undefined;
  const url = get(e, 'UR', 'L1', 'L2');
  const arxiv = url ? detectIdentifier(url) : null;

  const entry: RefEntry = {
    citekey: get(e, 'ID'),
    title: get(e, 'TI', 'T1'),
    authors,
    year: Number.isFinite(year) ? year : undefined,
    venue: get(e, 'JO', 'JF', 'T2', 'JA'),
    doi,
    url,
    abstract: get(e, 'AB', 'N2'),
    arxivId: arxiv?.kind === 'arxiv' ? arxiv.value : undefined,
  };
  if (!entry.title && !entry.doi) return null;
  return entry;
}

/** RISテキスト(複数エントリ可)をパース。壊れたエントリはスキップして続行する(§4.5) */
export function parseRis(text: string): RefEntry[] {
  const out: RefEntry[] = [];
  let cur: RawEntry | null = null;
  let lastTag: string | null = null;

  for (const rawLine of text.replace(/\r\n/g, '\n').split('\n')) {
    const m = TAG_RE.exec(rawLine);
    if (!m) {
      // 継続行: 直前フィールドの末尾に連結
      if (cur && lastTag) {
        const arr = cur.fields.get(lastTag);
        if (arr?.length) arr[arr.length - 1] += '\n' + rawLine.trim();
      }
      continue;
    }
    const [, tag, value] = m;
    if (tag === 'TY') {
      cur = { fields: new Map() };
      lastTag = null;
      continue;
    }
    if (tag === 'ER') {
      if (cur) {
        const entry = toRefEntry(cur);
        if (entry) out.push(entry);
      }
      cur = null;
      lastTag = null;
      continue;
    }
    if (!cur) continue;
    const arr = cur.fields.get(tag) ?? [];
    arr.push(value);
    cur.fields.set(tag, arr);
    lastTag = tag;
  }
  // ER欠落で終わったエントリも拾う
  if (cur) {
    const entry = toRefEntry(cur);
    if (entry) out.push(entry);
  }
  return out;
}
