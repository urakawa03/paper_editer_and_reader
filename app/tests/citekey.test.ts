import { describe, expect, it } from 'vitest';
import { generateCitekey } from '../src/lib/citekey';

const none = new Set<string>();

describe('generateCitekey', () => {
  it('bibのキーがあればサニタイズして使う', () => {
    expect(generateCitekey({ citekey: 'Vaswani:2017_NIPS', authors: [] }, none)).toBe('vaswani2017_nips');
  });

  it('無ければ {lastname}{year}{slug}(§3.1の例)', () => {
    expect(
      generateCitekey(
        { authors: ['Vaswani, Ashish', 'Shazeer, Noam'], year: 2017, title: 'Attention Is All You Need' },
        none,
      ),
    ).toBe('vaswani2017attention');
  });

  it('ストップワードを飛ばし、"First Last"形式の姓も取れる', () => {
    expect(
      generateCitekey({ authors: ['Kaiming He'], year: 2015, title: 'The Deep Residual Learning' }, none),
    ).toBe('he2015deep');
  });

  it('アクセント折り畳み・非ASCII著者/タイトルのフォールバック', () => {
    expect(generateCitekey({ authors: ['Müller, Hans'], year: 2019, title: 'Quantum Sensing' }, none)).toBe(
      'muller2019quantum',
    );
    expect(generateCitekey({ authors: ['田中, 太郎'], year: 2024, title: '深層学習の論文' }, none)).toBe(
      'anon2024untitled',
    );
  });

  it('衝突したら b, c, … を付ける', () => {
    const existing = new Set(['he2015deep', 'he2015deepb']);
    expect(
      generateCitekey({ authors: ['He, K.'], year: 2015, title: 'Deep Something Else' }, existing),
    ).toBe('he2015deepc');
  });

  it('著者なし→anon、年なしは省略', () => {
    expect(generateCitekey({ authors: [], title: 'Editorial Note' }, none)).toBe('anoneditorial');
  });
});
