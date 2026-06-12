import { describe, expect, it } from 'vitest';
import { detectIdentifier, normalizePip, parseIdentifierLines } from '../src/lib/identifiers';

describe('detectIdentifier', () => {
  it('素のDOI / doi.org URL / doi:プレフィックス', () => {
    expect(detectIdentifier('10.1103/PhysRevLett.116.061102')).toEqual({
      kind: 'doi',
      value: '10.1103/PhysRevLett.116.061102',
    });
    expect(detectIdentifier('https://doi.org/10.1038/nphys1170')).toEqual({ kind: 'doi', value: '10.1038/nphys1170' });
    expect(detectIdentifier('doi:10.1000/xyz123')).toEqual({ kind: 'doi', value: '10.1000/xyz123' });
  });

  it('arXiv 新形式/旧形式/URL/バージョン付き/arXiv:プレフィックス', () => {
    expect(detectIdentifier('1706.03762')).toEqual({ kind: 'arxiv', value: '1706.03762' });
    expect(detectIdentifier('2103.14030v2')).toEqual({ kind: 'arxiv', value: '2103.14030' });
    expect(detectIdentifier('cond-mat/9912345')).toEqual({ kind: 'arxiv', value: 'cond-mat/9912345' });
    expect(detectIdentifier('math.GT/0309136')).toEqual({ kind: 'arxiv', value: 'math.GT/0309136' });
    expect(detectIdentifier('https://arxiv.org/abs/1512.03385')).toEqual({ kind: 'arxiv', value: '1512.03385' });
    expect(detectIdentifier('https://arxiv.org/pdf/1512.03385.pdf')).toEqual({ kind: 'arxiv', value: '1512.03385' });
    expect(detectIdentifier('arXiv:1706.03762')).toEqual({ kind: 'arxiv', value: '1706.03762' });
  });

  it('arXiv DOIはarXivとして扱う(S2優先で引くため)', () => {
    expect(detectIdentifier('10.48550/arXiv.1706.03762')).toEqual({ kind: 'arxiv', value: '1706.03762' });
  });

  it('解釈できないものはnull', () => {
    expect(detectIdentifier('')).toBeNull();
    expect(detectIdentifier('hello world')).toBeNull();
    expect(detectIdentifier('12345')).toBeNull();
  });
});

describe('parseIdentifierLines', () => {
  it('改行・カンマ区切りの混在を分解し、不正行を報告する', () => {
    const { ids, invalid } = parseIdentifierLines('10.1000/a\n1706.03762, garbage\n\n');
    expect(ids).toHaveLength(2);
    expect(invalid).toEqual(['garbage']);
  });
});

describe('normalizePip', () => {
  it('数字のみは5桁ゼロ詰め、空はundefined、その他はそのまま', () => {
    expect(normalizePip('28')).toBe('00028');
    expect(normalizePip('00028')).toBe('00028');
    expect(normalizePip('  407 ')).toBe('00407');
    expect(normalizePip('')).toBeUndefined();
    expect(normalizePip('  ')).toBeUndefined();
    expect(normalizePip('A-12')).toBe('A-12');
    expect(normalizePip('123456')).toBe('123456'); // 6桁以上はそのまま
  });
});
