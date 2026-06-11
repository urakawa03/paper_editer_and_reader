import { describe, expect, it } from 'vitest';
import type { Paper } from '../src/types';
import { mergePaper } from '../src/lib/merge';

const paper = (over: Partial<Paper> = {}): Paper => ({
  id: 'p',
  title: 'T',
  authors: ['A'],
  year: 2020,
  tags: ['x'],
  liked: false,
  status: 'unread',
  added_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  abstract: 'abs',
  notes: '',
  ...over,
});

describe('mergePaper', () => {
  it('別フィールドの変更は両方生かす', () => {
    const base = paper();
    const local = paper({ notes: 'ローカルのメモ', updated_at: '2026-01-02T00:00:00Z' });
    const remote = paper({ liked: true, status: 'read', updated_at: '2026-01-03T00:00:00Z' });
    const m = mergePaper(base, local, remote);
    expect(m.notes).toBe('ローカルのメモ');
    expect(m.liked).toBe(true);
    expect(m.status).toBe('read');
    expect(m.updated_at).toBe('2026-01-03T00:00:00Z'); // 新しい方
  });

  it('同一フィールドの衝突はupdated_atの新しい方が勝つ', () => {
    const base = paper();
    const local = paper({ notes: 'local', updated_at: '2026-01-05T00:00:00Z' });
    const remote = paper({ notes: 'remote', updated_at: '2026-01-03T00:00:00Z' });
    expect(mergePaper(base, local, remote).notes).toBe('local');
    expect(mergePaper(base, remote, local).notes).toBe('local'); // 引数順に依らない
  });

  it('タグは集合マージ: 双方の追加は残り、片方の削除は反映される', () => {
    const base = paper({ tags: ['a', 'b'] });
    const local = paper({ tags: ['a', 'b', 'l'], updated_at: '2026-01-02T00:00:00Z' }); // lを追加
    const remote = paper({ tags: ['b', 'r'], updated_at: '2026-01-03T00:00:00Z' }); // aを削除しrを追加
    expect(mergePaper(base, local, remote).tags.sort()).toEqual(['b', 'l', 'r']);
  });

  it('base無し(未同期の旧データ)はファイル全体のLWWにフォールバック', () => {
    const local = paper({ notes: 'local', liked: true, updated_at: '2026-01-02T00:00:00Z' });
    const remote = paper({ notes: 'remote', updated_at: '2026-01-03T00:00:00Z' });
    const m = mergePaper(null, local, remote);
    expect(m.notes).toBe('remote');
    expect(m.liked).toBe(false); // 全体採用なのでローカルのlikedは残らない
  });
});
