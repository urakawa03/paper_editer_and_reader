import { describe, expect, it } from 'vitest';
import type { Paper } from '../src/types';
import { dailyPicks } from '../src/lib/pick';

const paper = (id: string, status: Paper['status'] = 'unread'): Paper => ({
  id,
  title: id,
  authors: [],
  year: 2020,
  tags: [],
  liked: false,
  status,
  added_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  abstract: '',
  notes: '',
});

describe('dailyPicks', () => {
  const pool = [...Array.from({ length: 20 }, (_, i) => paper(`p${i}`)), paper('done', 'read')];

  it('同じ日付キーなら何度呼んでも同じ3本(安定)', () => {
    const a = dailyPicks(pool, '2026-06-12').map((p) => p.id);
    const b = dailyPicks(pool, '2026-06-12').map((p) => p.id);
    expect(a).toEqual(b);
    expect(a).toHaveLength(3);
  });

  it('既読は選ばれない', () => {
    for (let d = 1; d <= 28; d++) {
      const ids = dailyPicks(pool, `2026-02-${String(d).padStart(2, '0')}`).map((p) => p.id);
      expect(ids).not.toContain('done');
    }
  });

  it('日付が変われば(ほぼ確実に)顔ぶれが変わり、母数が少なければ全員返す', () => {
    const days = ['2026-06-12', '2026-06-13', '2026-06-14', '2026-06-15'];
    const sets = days.map((d) => dailyPicks(pool, d).map((p) => p.id).join(','));
    expect(new Set(sets).size).toBeGreaterThan(1);
    expect(dailyPicks([paper('only')], '2026-06-12')).toHaveLength(1);
  });
});
