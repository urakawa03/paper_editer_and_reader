import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { Paper, RefEntry } from '../src/types';
import { buildRefetchPatch, refetchIdentifier } from '../src/data/refetch';

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

describe('refetchIdentifier', () => {
  it('doiフィールド優先、無ければURLからDOI/arXivを検出', () => {
    expect(refetchIdentifier(paper({ doi: '10.1000/x' }))).toEqual({ doi: '10.1000/x' });
    expect(refetchIdentifier(paper({ url: 'https://doi.org/10.1038/nphys1170' }))).toEqual({
      doi: '10.1038/nphys1170',
    });
    expect(refetchIdentifier(paper({ url: 'https://arxiv.org/abs/1706.03762' }))).toEqual({
      arxivId: '1706.03762',
    });
    // 出版社URLに埋め込まれたDOIも拾う
    expect(refetchIdentifier(paper({ url: 'https://pubs.acs.org/doi/10.1021/acs.jpcc.1c07668?ref=pdf' }))).toEqual({
      doi: '10.1021/acs.jpcc.1c07668',
    });
    expect(refetchIdentifier(paper({ url: 'https://drive.google.com/file/d/abc/view' }))).toBeNull();
    expect(refetchIdentifier(paper({}))).toBeNull();
  });
});

describe('buildRefetchPatch', () => {
  const found: RefEntry = {
    title: 'Found Title',
    authors: ['Found, A.'],
    year: 2021,
    venue: 'Found Journal',
    doi: '10.1/found',
    url: 'https://doi.org/10.1/found',
    abstract: 'found abstract',
  };

  it('空欄のフィールドだけ埋める(編集済みの値は上書きしない)', () => {
    const p = paper({ title: '自分のタイトル', authors: ['Mine, M.'], abstract: '' });
    const patch = buildRefetchPatch(p, found);
    expect(patch.title).toBeUndefined();
    expect(patch.authors).toBeUndefined();
    expect(patch.abstract).toBe('found abstract');
    expect(patch.year).toBe(2021);
    expect(patch.venue).toBe('Found Journal');
  });

  it('全フィールド入力済みなら空patch', () => {
    const p = paper({
      title: 't',
      authors: ['a'],
      year: 1999,
      venue: 'v',
      doi: 'd',
      url: 'u',
      abstract: 'abs',
    });
    expect(buildRefetchPatch(p, found)).toEqual({});
  });

  it('書誌フィールド(巻/号/ページ/出版社/種別)も空欄のみ補完する', () => {
    const p = paper({ volume: '10' }); // volume は入力済み
    const enriched: RefEntry = {
      authors: [],
      type: 'article',
      volume: '99',
      number: '3',
      pages: '1-9',
      publisher: 'ACME',
    };
    const patch = buildRefetchPatch(p, enriched);
    expect(patch.volume).toBeUndefined(); // 入力済みは上書きしない
    expect(patch.number).toBe('3');
    expect(patch.pages).toBe('1-9');
    expect(patch.publisher).toBe('ACME');
    expect(patch.type).toBe('article');
  });
});
