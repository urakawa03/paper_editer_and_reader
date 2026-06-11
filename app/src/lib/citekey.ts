import type { RefEntry } from '../types';

const STOPWORDS = new Set([
  'a', 'an', 'the', 'on', 'of', 'in', 'for', 'with', 'and', 'or', 'to', 'at',
  'by', 'from', 'is', 'are', 'be', 'as', 'into', 'via', 'toward', 'towards',
]);

/** アクセント折り畳み + 非英数字除去 + 小文字化 */
function foldAscii(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function sanitizeCitekey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

function firstAuthorLastname(authors: string[]): string {
  const a = authors[0];
  if (!a) return 'anon';
  // "Last, First" 形式ならカンマ前、"First Last" 形式なら末尾の語
  const last = a.includes(',') ? a.split(',')[0] : (a.trim().split(/\s+/).pop() ?? '');
  return foldAscii(last) || 'anon';
}

function titleSlug(title?: string): string {
  if (!title) return 'untitled';
  for (const word of title.split(/\s+/)) {
    const w = foldAscii(word);
    if (w.length >= 2 && !STOPWORDS.has(w)) return w;
  }
  return 'untitled';
}

/**
 * citekey生成(§3.1)。bibのキーがあればサニタイズして使用、
 * なければ {first_author_lastname}{year}{slug}。既存IDと衝突したら b,c,... を付ける。
 */
export function generateCitekey(e: RefEntry, existing: Set<string>): string {
  let base = e.citekey ? sanitizeCitekey(e.citekey) : '';
  if (!base) {
    base = `${firstAuthorLastname(e.authors)}${e.year ?? ''}${titleSlug(e.title)}`;
  }
  if (!existing.has(base)) return base;
  for (let i = 0; i < 25; i++) {
    const cand = base + String.fromCharCode(98 + i); // b, c, d, ...
    if (!existing.has(cand)) return cand;
  }
  let n = 2;
  while (existing.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
