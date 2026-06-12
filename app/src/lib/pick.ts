import type { Paper } from '../types';

/** FNV-1a 32bit。日替わりシャッフルの安定シードに使う */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/**
 * 「今日の3本」(SP): 未読・読書中からその日固定のn本を選ぶ。
 * 同じdateKey(例: '2026-06-12')なら何度開いても同じ顔ぶれになる。
 */
export function dailyPicks<T extends Paper>(papers: T[], dateKey: string, n = 3): T[] {
  const pool = papers.filter((p) => p.status !== 'read');
  return [...pool].sort((a, b) => fnv1a(dateKey + a.id) - fnv1a(dateKey + b.id)).slice(0, n);
}
