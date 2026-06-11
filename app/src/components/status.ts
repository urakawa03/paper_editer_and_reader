import type { PaperStatus } from '../types';

export const STATUS_LABEL: Record<PaperStatus, string> = {
  unread: '未読',
  reading: '読書中',
  read: '既読',
};

const ORDER: PaperStatus[] = ['unread', 'reading', 'read'];

/** PC-7: unread → reading → read のサイクル */
export function nextStatus(s: PaperStatus): PaperStatus {
  return ORDER[(ORDER.indexOf(s) + 1) % ORDER.length];
}

/** 元論文リンク(url優先、なければDOIリンク) */
export function paperLink(p: { url?: string; doi?: string }): string | null {
  if (p.url) return p.url;
  if (p.doi) return `https://doi.org/${p.doi}`;
  return null;
}
