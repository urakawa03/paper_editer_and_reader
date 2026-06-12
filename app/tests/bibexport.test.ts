import { describe, expect, it } from 'vitest';
import type { Paper } from '../src/types';
import { toBibtex } from '../src/lib/bibexport';

const paper = (over: Partial<Paper>): Paper => ({
  id: 'x',
  title: '',
  authors: [],
  year: 0,
  tags: [],
  liked: false,
  status: 'unread',
  added_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  abstract: '',
  notes: '',
  ...over,
});

describe('toBibtex', () => {
  it('venueありは@article、無しは@misc。キーは論文id', () => {
    const out = toBibtex([
      paper({
        id: '00050_otani2022three',
        title: 'Three {Tribolayers}',
        authors: ['Otani, Taro', 'Suzuki, Hanako'],
        year: 2022,
        venue: 'J. Phys. Chem. C',
        doi: '10.1021/acs.jpcc.1c07668',
      }),
      paper({ id: 'memo2024', title: 'Untitled note', year: 2024 }),
    ]);
    expect(out).toContain('@article{00050_otani2022three,');
    expect(out).toContain('title = {{Three Tribolayers}}'); // 中括弧は除去しつつ大文字保持
    expect(out).toContain('author = {Otani, Taro and Suzuki, Hanako}');
    expect(out).toContain('journal = {J. Phys. Chem. C}');
    expect(out).toContain('doi = {10.1021/acs.jpcc.1c07668}');
    expect(out).toContain('@misc{memo2024,');
  });

  it('空フィールドは出力しない・空リストは空文字', () => {
    const out = toBibtex([paper({ id: 'a', title: 'T' })]);
    expect(out).not.toContain('author =');
    expect(out).not.toContain('year =');
    expect(toBibtex([])).toBe('');
  });
});
