import type { DetectedId } from '../lib/identifiers';
import type { Paper, RefEntry } from '../types';
import { parseRis } from '../lib/ris';
import { parseBibtex } from '../lib/bibtex';
import { enrichEntry } from '../lib/enrich';
import { generateCitekey } from '../lib/citekey';

// 取り込みオーケストレーション(§4)。UI(AddPaperModal)と任意CLIで共用するためDOM非依存。
// 1件ずつcatchして他を止めず、外部API利用間に小ウェイトを入れる(§4.5)。

export type IngestInput =
  | { kind: 'ris'; text: string; label?: string }
  | { kind: 'bib'; text: string; label?: string }
  | { kind: 'id'; value: DetectedId };

export interface IngestResult {
  added: Paper[];
  skipped: { key: string; reason: string }[];
  failed: { input: string; reason: string }[];
}

export interface IngestDeps {
  existingIds: Set<string>;
  /** 既存論文のDOI(小文字)。一致したら重複としてスキップ */
  existingDois?: Set<string>;
  mailto?: string;
  onProgress?: (done: number, total: number, label: string) => void;
  /** テストでウェイトを飛ばすためのフック */
  wait?: (ms: number) => Promise<void>;
  now?: () => string;
}

const defaultWait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const API_WAIT_MS = 400;

function needsApi(e: RefEntry): boolean {
  return !(e.title && e.authors.length && e.year && e.abstract);
}

function entryLabel(e: RefEntry): string {
  return e.title ?? e.doi ?? e.arxivId ?? e.citekey ?? '(不明なエントリ)';
}

export function buildPaper(e: RefEntry, id: string, now: string): Paper {
  return {
    id,
    title: e.title ?? '',
    authors: e.authors,
    year: e.year ?? 0,
    venue: e.venue,
    doi: e.doi,
    url: e.url,
    tags: [],
    liked: false,
    status: 'unread',
    added_at: now,
    updated_at: now,
    abstract: e.abstract ?? '',
    notes: '',
  };
}

/** 入力(RIS/BIBテキスト・DOI/arXiv ID)をRefEntryリストへ展開する */
export function expandInputs(inputs: IngestInput[]): { entries: RefEntry[]; failed: IngestResult['failed'] } {
  const entries: RefEntry[] = [];
  const failed: IngestResult['failed'] = [];
  for (const input of inputs) {
    if (input.kind === 'id') {
      entries.push(
        input.value.kind === 'doi'
          ? { authors: [], doi: input.value.value }
          : { authors: [], arxivId: input.value.value },
      );
      continue;
    }
    try {
      const parsed = input.kind === 'ris' ? parseRis(input.text) : parseBibtex(input.text);
      if (parsed.length === 0) {
        failed.push({ input: input.label ?? input.kind, reason: 'エントリを1件も読み取れませんでした' });
      }
      entries.push(...parsed);
    } catch (e) {
      failed.push({ input: input.label ?? input.kind, reason: (e as Error).message });
    }
  }
  return { entries, failed };
}

/**
 * 取り込み本体(§4.2)。メタデータ補完→citekey生成→重複スキップ→Paper生成。
 * 戻り値の added を mutations.addPapers() に渡すと通常の同期経路で1コミットになる。
 */
export async function ingest(inputs: IngestInput[], deps: IngestDeps): Promise<IngestResult> {
  const wait = deps.wait ?? defaultWait;
  const now = deps.now ?? (() => new Date().toISOString());
  const { entries, failed } = expandInputs(inputs);
  const result: IngestResult = { added: [], skipped: [], failed };

  const ids = new Set(deps.existingIds);
  let usedApi = false;
  for (let i = 0; i < entries.length; i++) {
    let entry = entries[i];
    deps.onProgress?.(i, entries.length, entryLabel(entry));
    try {
      if (needsApi(entry) && (entry.doi || entry.arxivId)) {
        if (usedApi) await wait(API_WAIT_MS);
        entry = await enrichEntry(entry, { mailto: deps.mailto });
        usedApi = true;
      }
      if (!entry.title && !entry.doi && !entry.arxivId) {
        result.failed.push({ input: entryLabel(entry), reason: 'タイトルも識別子も得られませんでした' });
        continue;
      }
      if (entry.doi && deps.existingDois?.has(entry.doi.toLowerCase())) {
        result.skipped.push({ key: entry.doi, reason: '同じDOIの論文が既に存在します' });
        continue;
      }
      const key = generateCitekey(entry, new Set());
      if (ids.has(key)) {
        // 既存はスキップ(§4.2-5。上書きは明示時のみ)
        result.skipped.push({ key, reason: '同じcitekeyが既に存在します' });
        continue;
      }
      const id = generateCitekey(entry, ids);
      ids.add(id);
      result.added.push(buildPaper(entry, id, now()));
    } catch (e) {
      result.failed.push({ input: entryLabel(entry), reason: (e as Error).message });
    }
  }
  deps.onProgress?.(entries.length, entries.length, '完了');
  return result;
}
