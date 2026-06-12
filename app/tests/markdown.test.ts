import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ParseError, parsePaperMarkdown, serializePaperMarkdown } from '../src/lib/markdown';

const read = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf-8');
const FIXTURES = [
  'vaswani2017attention.md',
  'devlin2019bert.md',
  'perdew1996generalized.md',
  'tanaka2024untitled.md',
  'shor1997polynomial.md',
];

describe('parsePaperMarkdown', () => {
  it('仕様§3.2の例を完全にパースする', () => {
    const p = parsePaperMarkdown(read('vaswani2017attention.md'));
    expect(p.id).toBe('vaswani2017attention');
    expect(p.title).toBe('Attention Is All You Need');
    expect(p.authors).toEqual(['Vaswani, Ashish', 'Shazeer, Noam']);
    expect(p.year).toBe(2017);
    expect(p.venue).toBe('NeurIPS');
    expect(p.doi).toBe('10.48550/arXiv.1706.03762');
    expect(p.url).toBe('https://arxiv.org/abs/1706.03762');
    expect(p.tags).toEqual(['機械学習', 'Transformer', 'NLP']);
    expect(p.liked).toBe(false);
    expect(p.status).toBe('unread');
    expect(p.added_at).toBe('2026-06-01T12:00:00Z');
    expect(p.updated_at).toBe('2026-06-01T12:00:00Z');
    expect(p.abstract).toMatch(/^The dominant sequence/);
    expect(p.notes).toBe('');
  });

  it('venue/doi/url無し・abstract空・複数段落Notesも読める', () => {
    const t = parsePaperMarkdown(read('tanaka2024untitled.md'));
    expect(t.venue).toBeUndefined();
    expect(t.doi).toBeUndefined();
    expect(t.url).toBeUndefined();
    expect(t.abstract).toBe('');
    expect(t.notes).toMatch(/^研究会で/);

    const s = parsePaperMarkdown(read('shor1997polynomial.md'));
    expect(s.liked).toBe(true);
    expect(s.status).toBe('read');
    expect(s.notes).toContain('\n\n'); // 複数段落
  });

  it('CRLF・## Notes欠落・前置き本文に寛容', () => {
    const md = '---\r\nid: x1\r\ntitle: "T"\r\n---\r\n\r\n## Abstract\r\nhello\r\nworld\r\n';
    const p = parsePaperMarkdown(md);
    expect(p.abstract).toBe('hello\nworld');
    expect(p.notes).toBe('');

    const noHeading = parsePaperMarkdown('---\nid: x2\n---\nplain body text\n');
    expect(noHeading.abstract).toBe('plain body text');
  });

  it('必須フィールド欠落はデフォルトで補修される', () => {
    const p = parsePaperMarkdown('## Abstract\nabc\n', 'fallback2020id');
    expect(p.id).toBe('fallback2020id');
    expect(p.title).toBe('');
    expect(p.authors).toEqual([]);
    expect(p.tags).toEqual([]);
    expect(p.liked).toBe(false);
    expect(p.status).toBe('unread');
    expect(p.added_at).toBe('1970-01-01T00:00:00Z');
  });

  it('idがどこにも無ければParseError', () => {
    expect(() => parsePaperMarkdown('---\ntitle: "x"\n---\n')).toThrow(ParseError);
  });

  it('壊れたYAMLでも落ちない', () => {
    const p = parsePaperMarkdown('---\ntitle: "unclosed\n  bad: [\n---\nbody\n', 'broken1999id');
    expect(p.id).toBe('broken1999id');
  });
});

describe('serializePaperMarkdown', () => {
  it.each(FIXTURES)('%s: parse→serializeで原文を完全再現する(決定的シリアライズ)', (name) => {
    const md = read(name);
    expect(serializePaperMarkdown(parsePaperMarkdown(md))).toBe(md);
  });

  it.each(FIXTURES)('%s: roundtripで値が保存される', (name) => {
    const p = parsePaperMarkdown(read(name));
    expect(parsePaperMarkdown(serializePaperMarkdown(p))).toEqual(p);
  });

  it('serializeは冪等', () => {
    const p = parsePaperMarkdown(read('shor1997polynomial.md'));
    const once = serializePaperMarkdown(p);
    expect(serializePaperMarkdown(parsePaperMarkdown(once))).toBe(once);
  });

  it('タイトル中の引用符・改行は安全にエスケープ/正規化される', () => {
    const p = parsePaperMarkdown(read('vaswani2017attention.md'));
    p.title = 'A "quoted" title\nwith newline';
    const out = serializePaperMarkdown(p);
    expect(parsePaperMarkdown(out).title).toBe('A "quoted" title with newline');
  });

  it('pip(個人管理番号)はゼロ詰めのままroundtripし、無ければ行ごと省略される', () => {
    const p = parsePaperMarkdown(read('vaswani2017attention.md'));
    expect(p.pip).toBeUndefined();
    expect(serializePaperMarkdown(p)).not.toContain('pip:');

    p.pip = '00028';
    const out = serializePaperMarkdown(p);
    expect(out).toContain('pip: "00028"');
    expect(parsePaperMarkdown(out).pip).toBe('00028');
  });
});
