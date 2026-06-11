import type { Paper, PaperStatus } from '../types';
import { splitFrontmatter, parseYamlObject } from './frontmatter';

const EPOCH = '1970-01-01T00:00:00Z';
const STATUSES: PaperStatus[] = ['unread', 'reading', 'read'];

export class ParseError extends Error {}

function asString(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString().replace(/\.000Z$/, 'Z');
  return undefined;
}

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => asString(x) ?? '').filter(Boolean);
  const s = asString(v);
  return s ? [s] : [];
}

function asOptional(v: unknown): string | undefined {
  const s = asString(v)?.trim();
  return s ? s : undefined;
}

/** 本文を `## 見出し` でセクション分割する。固定見出し Abstract / Notes を想定(§3.2) */
function splitSections(body: string): Map<string, string> {
  const sections = new Map<string, string>();
  const lines = body.split('\n');
  let current = '';
  let buf: string[] = [];
  const flush = () => {
    if (current) sections.set(current, buf.join('\n').trim());
    buf = [];
  };
  for (const line of lines) {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m) {
      flush();
      current = m[1].toLowerCase();
    } else if (current) {
      buf.push(line);
    } else if (line.trim()) {
      // 見出しより前の地の文は Abstract 扱いに溜める(寛容)
      current = '__preamble';
      buf.push(line);
    }
  }
  flush();
  return sections;
}

/**
 * .md全文 → Paper。寛容パース: 必須フィールド欠落は fallbackId / デフォルト値で補修する。
 * id がどこからも得られない場合のみ ParseError。
 */
export function parsePaperMarkdown(md: string, fallbackId?: string): Paper {
  const { yamlText, body } = splitFrontmatter(md);
  const fm = parseYamlObject(yamlText);

  const id = asOptional(fm.id) ?? fallbackId;
  if (!id) throw new ParseError('id がfrontmatterにもファイル名にもありません');

  const sections = splitSections(body);
  const abstract = sections.get('abstract') ?? sections.get('__preamble') ?? '';
  const notes = sections.get('notes') ?? '';

  const yearNum = Number(asString(fm.year));
  const statusRaw = asString(fm.status);
  const added = asOptional(fm.added_at) ?? asOptional(fm.updated_at) ?? EPOCH;

  return {
    id,
    title: asOptional(fm.title) ?? '',
    authors: asStringArray(fm.authors),
    year: Number.isFinite(yearNum) ? Math.trunc(yearNum) : 0,
    venue: asOptional(fm.venue),
    doi: asOptional(fm.doi),
    url: asOptional(fm.url),
    tags: asStringArray(fm.tags),
    liked: fm.liked === true || fm.liked === 'true',
    status: STATUSES.includes(statusRaw as PaperStatus) ? (statusRaw as PaperStatus) : 'unread',
    added_at: added,
    updated_at: asOptional(fm.updated_at) ?? added,
    abstract,
    notes,
  };
}

// YAMLのダブルクォートスカラとしてJSON文字列リテラルは常に妥当
const q = (s: string) => JSON.stringify(s.replace(/[\r\n]+/g, ' '));
const arr = (xs: string[]) => `[${xs.map(q).join(', ')}]`;

/**
 * Paper → .md全文。§3.2のキー順・引用スタイルで決定的に出力する(Git差分を最小にする)。
 * 不変条件: parse(serialize(p)) ≡ p(abstract/notesはtrim済み前提) / serializeは冪等。
 */
export function serializePaperMarkdown(p: Paper): string {
  const lines: string[] = ['---'];
  lines.push(`id: ${p.id}`);
  lines.push(`title: ${q(p.title)}`);
  lines.push(`authors: ${arr(p.authors)}`);
  lines.push(`year: ${p.year}`);
  if (p.venue) lines.push(`venue: ${q(p.venue)}`);
  if (p.doi) lines.push(`doi: ${q(p.doi)}`);
  if (p.url) lines.push(`url: ${q(p.url)}`);
  lines.push(`tags: ${arr(p.tags)}`);
  lines.push(`liked: ${p.liked}`);
  lines.push(`status: ${p.status}`);
  lines.push(`added_at: ${p.added_at}`);
  lines.push(`updated_at: ${p.updated_at}`);
  lines.push('---');

  const abstract = p.abstract.replace(/\r\n/g, '\n').trim();
  const notes = p.notes.replace(/\r\n/g, '\n').trim();
  let out = lines.join('\n') + '\n\n## Abstract\n';
  if (abstract) out += abstract + '\n';
  out += '\n## Notes\n';
  if (notes) out += notes + '\n';
  return out;
}
