import { useMemo, useState } from 'react';
import type { SortKey, StoredPaper } from '../../types';
import { useAppStore } from '../../data/store';
import { collectTags } from '../../lib/search';
import { FilterChips } from '../../components/FilterChips';
import { PaperListRow } from './PaperListRow';

/** 折りたたみ時に表示するタグ数(頻度順の上位)。超過分は「+N」で展開 */
const TAG_COLLAPSE_LIMIT = 12;

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'year:desc', label: '年(新しい順)' },
  { value: 'year:asc', label: '年(古い順)' },
  { value: 'title:asc', label: 'タイトル' },
  { value: 'added:desc', label: '追加が新しい順' },
  { value: 'updated:desc', label: '更新が新しい順' },
];

/** 左ペイン: タグフィルタ(折りたたみ式)・いいね/既読フィルタ・ソート(PC-4) + 本文プレビュー付きリスト(PC-2) */
export function PaperList({ papers }: { papers: StoredPaper[] }) {
  const allPapers = useAppStore((s) => s.papers);
  const filter = useAppStore((s) => s.filter);
  const setFilter = useAppStore((s) => s.setFilter);
  const [tagsExpanded, setTagsExpanded] = useState(false);

  const allTags = useMemo(() => collectTags(Object.values(allPapers)), [allPapers]);
  const hiddenCount = allTags.length - TAG_COLLAPSE_LIMIT;
  const visibleTags = useMemo(() => {
    if (tagsExpanded || hiddenCount <= 0) return allTags;
    const head = allTags.slice(0, TAG_COLLAPSE_LIMIT);
    for (const t of filter.tags) if (!head.includes(t)) head.push(t); // 選択中のタグは常に見せる
    return head;
  }, [allTags, tagsExpanded, hiddenCount, filter.tags]);

  const toggleTag = (t: string) =>
    setFilter({ tags: filter.tags.includes(t) ? filter.tags.filter((x) => x !== t) : [...filter.tags, t] });

  const sortValue = `${filter.sort}:${filter.dir}`;
  const onSort = (v: string) => {
    const [sort, dir] = v.split(':') as [SortKey, 'asc' | 'desc'];
    setFilter({ sort, dir });
  };

  return (
    <div className="desk-list">
      <div className="desk-tagbar">
        {visibleTags.map((t) => (
          <button key={t} className={'desk-tag' + (filter.tags.includes(t) ? ' on' : '')} onClick={() => toggleTag(t)}>
            {t}
          </button>
        ))}
        {hiddenCount > 0 && (
          <button
            className="desk-tag more"
            title={tagsExpanded ? 'タグをたたむ' : `残り${hiddenCount}件のタグを表示`}
            onClick={() => setTagsExpanded(!tagsExpanded)}
          >
            {tagsExpanded ? '− たたむ' : `+${hiddenCount}`}
          </button>
        )}
        <span className="desk-sort">
          並び
          <select value={sortValue} onChange={(e) => onSort(e.target.value)}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </span>
      </div>
      <div className="desk-filterbar">
        <FilterChips />
      </div>
      {papers.map((p) => (
        <PaperListRow key={p.id} paper={p} />
      ))}
      {papers.length === 0 && <div className="desk-list-empty">該当なし。検索やタグを見直してください。</div>}
    </div>
  );
}
