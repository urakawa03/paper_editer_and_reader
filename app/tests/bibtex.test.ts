import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { latexToText, parseBibtex } from '../src/lib/bibtex';

const text = readFileSync(new URL('./fixtures/sample.bib', import.meta.url), 'utf-8');

describe('parseBibtex', () => {
  const entries = parseBibtex(text);

  it('@string/@comment/壊れたエントリを処理しつつ3エントリを読む', () => {
    expect(entries.map((e) => e.citekey)).toEqual(['einstein1935epr', 'vaswani2017attention', 'muller2019quantum']);
  });

  it('@stringマクロ解決・" and "著者分割・braced値', () => {
    const e = entries[0];
    expect(e.venue).toBe('Physical Review Letters');
    expect(e.authors).toEqual(['Einstein, A.', 'Podolsky, B.', 'Rosen, N.']);
    expect(e.year).toBe(1935);
    expect(e.doi).toBe('10.1103/PhysRev.47.777');
    expect(e.title).toMatch(/^Can Quantum-Mechanical/);
  });

  it('eprint+archivePrefix→arxivId、othersの除去、ネスト波括弧', () => {
    const e = entries[1];
    expect(e.arxivId).toBe('1706.03762');
    expect(e.authors).toEqual(['Vaswani, Ashish', 'Shazeer, Noam']);
    expect(e.year).toBe(2017);
    expect(e.venue).toBe('Advances in Neural Information Processing Systems');
    expect(e.abstract).toContain('the Transformer, based "solely" on attention');
  });

  it('LaTeXアクセント変換と引用符値', () => {
    const e = entries[2];
    expect(e.authors).toEqual(['Müller, Hans-Jürgen']);
    expect(e.title).toBe('Quantum Sensing with Césium Atoms');
    expect(e.year).toBe(2019);
    expect(e.venue).toBe('Nature Physics');
  });
});

describe('latexToText', () => {
  it('アクセント・コマンド・波括弧を落とす', () => {
    expect(latexToText('Schr{\\"o}dinger')).toBe('Schrödinger');
    expect(latexToText('\\emph{Deep} Learning --- a survey')).toBe('Deep Learning — a survey');
    expect(latexToText('100\\% \\& more')).toBe('100% & more');
  });
});
