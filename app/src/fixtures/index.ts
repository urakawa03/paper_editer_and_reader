import type { StoredPaper } from '../types';
import { parsePaperMarkdown } from '../lib/markdown';
import { useAppStore } from '../data/store';

// devフィクスチャ(VITE_FIXTURES=1): PAT/GitHubなしでUI開発・確認するためのモードで、
// paper_data のサンプルと同内容の .md を同梱し読み込む。書き込みはローカルに留まる。

const raw = import.meta.glob('./*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export function fixturesEnabled(): boolean {
  return import.meta.env.VITE_FIXTURES === '1';
}

export function loadFixtures(): void {
  const papers: StoredPaper[] = Object.entries(raw).map(([path, text]) => {
    const id = path.split('/').pop()!.replace(/\.md$/, '');
    return { ...parsePaperMarkdown(text, id), sha: 'fixture', base: null };
  });
  useAppStore.getState().setPapers(papers);
}
