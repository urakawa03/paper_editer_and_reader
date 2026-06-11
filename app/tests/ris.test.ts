import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseRis } from '../src/lib/ris';

const text = readFileSync(new URL('./fixtures/sample.ris', import.meta.url), 'utf-8');

describe('parseRis', () => {
  const entries = parseRis(text);

  it('複数エントリを読み、壊れたエントリ(タイトルもDOIも無い)はスキップする', () => {
    expect(entries).toHaveLength(2);
  });

  it('TI/AU/PY/JO/DO/UR/AB(継続行込み)をマップする', () => {
    const e = entries[0];
    expect(e.title).toBe('Observation of Gravitational Waves from a Binary Black Hole Merger');
    expect(e.authors).toEqual(['Abbott, B. P.', 'Abbott, R.']);
    expect(e.year).toBe(2016);
    expect(e.venue).toBe('Physical Review Letters');
    expect(e.doi).toBe('10.1103/PhysRevLett.116.061102');
    expect(e.url).toContain('link.aps.org');
    expect(e.abstract).toContain('first direct observation');
    expect(e.abstract).toContain('produced by the merger'); // 継続行
    expect(e.arxivId).toBeUndefined();
  });

  it('T1/A1/Y1/T2/N2の別名タグとarXiv URLからのID抽出', () => {
    const e = entries[1];
    expect(e.title).toBe('Deep Residual Learning for Image Recognition');
    expect(e.authors).toEqual(['He, Kaiming', 'Zhang, Xiangyu']);
    expect(e.year).toBe(2016);
    expect(e.venue).toBe('CVPR');
    expect(e.abstract).toContain('residual learning framework');
    expect(e.arxivId).toBe('1512.03385');
  });

  it('空テキストは空配列', () => {
    expect(parseRis('')).toEqual([]);
  });
});
