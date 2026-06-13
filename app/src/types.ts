export type PaperStatus = 'unread' | 'reading' | 'read';

/** 引用エントリの種別(BibTeX相当)。pnumでの書誌レンダリングに使う。省略時はarticle扱い */
export type PaperType = 'article' | 'book' | 'inproceedings' | 'misc';

/** 1論文 = papers/{id}.md。frontmatter(§3.2) + ## Abstract / ## Notes */
export interface Paper {
  id: string;
  /** 個人管理番号(5桁ゼロ詰め推奨)。Notion由来のインポートではファイル名先頭にも付く */
  pip?: string;
  /** 引用種別。省略時はarticle */
  type?: PaperType;
  title: string;
  authors: string[];
  year: number;
  /** コンテナ名(誌名/会議名)。pnumがtypeに応じてjournal/booktitle/howpublishedへ変換 */
  venue?: string;
  /** inproceedingsで会議の正式名がvenueと異なる場合の上書き */
  booktitle?: string;
  volume?: string;
  number?: string;
  pages?: string;
  publisher?: string;
  address?: string;
  edition?: string;
  howpublished?: string;
  /** 書誌の注記(## Notes 本文とは別物) */
  note?: string;
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

/**
 * IndexedDBに置く形。
 * sha = 最後に確認したリモートblobのsha(差分pull判定用)。
 * base = リモートと最後に合意した内容(3-wayマージの共通祖先)。null = 未同期(全体LWWにフォールバック)。
 */
export interface StoredPaper extends Paper {
  sha: string | null;
  base: Paper | null;
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
  /** 詳細を開いたら未読→読書中に自動変更(SP)。既定ON */
  autoReading?: boolean;
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
  type?: PaperType;
  title?: string;
  authors: string[];
  year?: number;
  venue?: string;
  volume?: string;
  number?: string;
  pages?: string;
  publisher?: string;
  doi?: string;
  url?: string;
  abstract?: string;
  arxivId?: string;
}

export type SyncStatusKind = 'synced' | 'saving' | 'pending';

export type SortKey = 'added' | 'updated' | 'year' | 'title' | 'pip';

/** 既読フィルタ: unread = status≠read(読書中含む), read = status=read */
export type ReadFilter = 'all' | 'unread' | 'read';

export interface Filter {
  query: string;
  mode: 'AND' | 'OR';
  tags: string[];
  liked: boolean;
  read: ReadFilter;
  sort: SortKey;
  dir: 'asc' | 'desc';
}

export const DEFAULT_UI: UiSettings = { viewOverride: 'auto', theme: 'auto', autoReading: true };
export const DEFAULT_FILTER: Filter = {
  query: '',
  mode: 'AND',
  tags: [],
  liked: false,
  read: 'all',
  sort: 'added',
  dir: 'desc',
};
