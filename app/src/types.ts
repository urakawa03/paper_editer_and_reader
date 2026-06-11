export type PaperStatus = 'unread' | 'reading' | 'read';

/** 1論文 = papers/{id}.md。frontmatter(§3.2) + ## Abstract / ## Notes */
export interface Paper {
  id: string;
  title: string;
  authors: string[];
  year: number;
  venue?: string;
  doi?: string;
  url?: string;
  tags: string[];
  liked: boolean;
  status: PaperStatus;
  added_at: string;
  updated_at: string;
  abstract: string;
  notes: string;
}

/** IndexedDBに置く形。sha = 最後に確認したリモートblobのsha(差分pull判定用) */
export interface StoredPaper extends Paper {
  sha: string | null;
}

export interface QueueEntry {
  id: string;
  op: 'upsert' | 'delete';
  queuedAt: number;
  /** delete時のみ: enqueue時点のリモートblob sha。nullなら未pushの論文(リモート操作不要) */
  sha?: string | null;
}

export interface GitHubSettings {
  owner: string;
  repo: string;
  branch: string;
  token: string;
  dir: string;
}

export type ViewOverride = 'auto' | 'desk' | 'feed';
export type Theme = 'auto' | 'light' | 'dark';

export interface UiSettings {
  viewOverride: ViewOverride;
  theme: Theme;
}

export interface AppSettings {
  github?: GitHubSettings;
  ui: UiSettings;
  /** Crossref politeプール用の連絡先メール(任意) */
  mailto?: string;
}

/** RIS/BibTeX/外部APIの共通中間表現 */
export interface RefEntry {
  citekey?: string;
  title?: string;
  authors: string[];
  year?: number;
  venue?: string;
  doi?: string;
  url?: string;
  abstract?: string;
  arxivId?: string;
}

export type SyncStatusKind = 'synced' | 'saving' | 'pending';

export type SortKey = 'added' | 'updated' | 'year' | 'title';

export interface Filter {
  query: string;
  mode: 'AND' | 'OR';
  tags: string[];
  sort: SortKey;
  dir: 'asc' | 'desc';
}

export const DEFAULT_UI: UiSettings = { viewOverride: 'auto', theme: 'auto' };
export const DEFAULT_FILTER: Filter = { query: '', mode: 'AND', tags: [], sort: 'added', dir: 'desc' };
