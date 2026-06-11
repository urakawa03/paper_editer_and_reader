import { describe, expect, it } from 'vitest';
import type { Paper } from '../src/types';
import { collectTags, filterPapers } from '../src/lib/search';
import { DEFAULT_FILTER } from '../src/types';

const paper = (over: Partial<Paper>): Paper => ({
  id: 'x',
  title: '',
  authors: [],
  year: 2000,
  tags: [],
  liked: false,
  status: 'unread',
  added_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  abstract: '',
  notes: '',
  ...over,
});

const papers: Paper[] = [
  paper({ id: 'a', title: 'Quantum Computing Basics', authors: ['Shor, P.'], year: 1997, tags: ['量子計算'], abstract: 'factorization algorithm', added_at: '2026-01-03T00:00:00Z', notes: '実装は週末に読む', liked: true, status: 'read' }),
  paper({ id: 'b', title: 'Deep Learning', authors: ['He, K.'], year: 2015, tags: ['機械学習', '画像認識'], abstract: 'residual networks', added_at: '2026-01-02T00:00:00Z', status: 'reading' }),
  paper({ id: 'c', title: 'Attention Mechanisms', authors: ['Vaswani, A.'], year: 2017, tags: ['機械学習', 'NLP'], abstract: 'transformer architecture', added_at: '2026-01-01T00:00:00Z' }),
];

describe('filterPapers', () => {
  it('AND: 全トークン一致のみ(title/authors/tags/abstract対象)', () => {
    const got = filterPapers(papers, { ...DEFAULT_FILTER, query: 'quantum factorization', mode: 'AND' });
    expect(got.map((p) => p.id)).toEqual(['a']);
    expect(filterPapers(papers, { ...DEFAULT_FILTER, query: 'quantum residual', mode: 'AND' })).toHaveLength(0);
  });

  it('OR: いずれか一致', () => {
    const got = filterPapers(papers, { ...DEFAULT_FILTER, query: 'quantum residual', mode: 'OR', sort: 'year', dir: 'asc' });
    expect(got.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('検索は大文字小文字を無視し、著者・タグにも当たる', () => {
    expect(filterPapers(papers, { ...DEFAULT_FILTER, query: 'VASWANI' })).toHaveLength(1);
    expect(filterPapers(papers, { ...DEFAULT_FILTER, query: '量子計算' })).toHaveLength(1);
  });

  it('タグフィルタは複数選択でAND', () => {
    expect(filterPapers(papers, { ...DEFAULT_FILTER, tags: ['機械学習'] })).toHaveLength(2);
    expect(filterPapers(papers, { ...DEFAULT_FILTER, tags: ['機械学習', 'NLP'] }).map((p) => p.id)).toEqual(['c']);
  });

  it('検索はNotes(自分のメモ)にも当たる', () => {
    expect(filterPapers(papers, { ...DEFAULT_FILTER, query: '週末' }).map((p) => p.id)).toEqual(['a']);
  });

  it('いいねフィルタ: liked=trueの論文のみ', () => {
    expect(filterPapers(papers, { ...DEFAULT_FILTER, liked: true }).map((p) => p.id)).toEqual(['a']);
  });

  it('既読フィルタ: unread=未読+読書中, read=既読のみ', () => {
    expect(filterPapers(papers, { ...DEFAULT_FILTER, read: 'unread' }).map((p) => p.id).sort()).toEqual(['b', 'c']);
    expect(filterPapers(papers, { ...DEFAULT_FILTER, read: 'read' }).map((p) => p.id)).toEqual(['a']);
    expect(filterPapers(papers, { ...DEFAULT_FILTER, read: 'all' })).toHaveLength(3);
  });

  it('ソート: 年/タイトル/追加順 + 昇降', () => {
    expect(filterPapers(papers, { ...DEFAULT_FILTER, sort: 'year', dir: 'desc' }).map((p) => p.id)).toEqual(['c', 'b', 'a']);
    expect(filterPapers(papers, { ...DEFAULT_FILTER, sort: 'title', dir: 'asc' })[0].id).toBe('c');
    expect(filterPapers(papers, { ...DEFAULT_FILTER, sort: 'added', dir: 'desc' }).map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('collectTags', () => {
  it('頻度降順→辞書順', () => {
    expect(collectTags(papers)).toEqual(['機械学習', 'NLP', '画像認識', '量子計算']);
  });
});
