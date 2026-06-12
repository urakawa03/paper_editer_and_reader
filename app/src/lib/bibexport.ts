import type { Paper } from '../types';

// BibTeXエクスポート(PC): 絞り込み結果をそのまま.bibにする。
// citekeyは論文id(PIP接頭辞付きでもBibTeX/biberのキーとして有効)。

const esc = (s: string) => s.replace(/[{}\\]/g, '').replace(/\s+/g, ' ').trim();

function entry(p: Paper): string {
  const type = p.venue ? 'article' : 'misc';
  const fields: [string, string][] = [];
  if (p.title) fields.push(['title', `{{${esc(p.title)}}}`]); // 二重中括弧で大文字小文字を保持
  if (p.authors.length) fields.push(['author', `{${p.authors.map(esc).join(' and ')}}`]);
  if (p.year) fields.push(['year', `{${p.year}}`]);
  if (p.venue) fields.push(['journal', `{${esc(p.venue)}}`]);
  if (p.doi) fields.push(['doi', `{${esc(p.doi)}}`]);
  if (p.url) fields.push(['url', `{${esc(p.url)}}`]);
  const body = fields.map(([k, v]) => `  ${k} = ${v}`).join(',\n');
  return `@${type}{${p.id},\n${body}\n}`;
}

export function toBibtex(papers: Paper[]): string {
  return papers.map(entry).join('\n\n') + (papers.length ? '\n' : '');
}
