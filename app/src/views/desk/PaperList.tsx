import { useMemo } from 'react';
import type { SortKey, StoredPaper } from '../../types';
import { useAppStore } from '../../data/store';
import { collectTags } from '../../lib/search';
import { PaperListRow } from './PaperListRow';

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'year:desc', label: '年(新しい順)' },
  { value: 'year:asc', label: '年(古い順)' },
  { value: 'title:asc', label: 'タイトル' },
  { value: 'added:desc', label: '追加が新しい順' },
  { value: 'updated:desc', label: '更新が新しい順' },
];

/** 左ペイン: タグフィルタ・ソート(PC-4) + 本文プレビュー付きリスト(PC-2) */
export function PaperList({ papers }: { papers: StoredPaper[] }) {
  const allPapers = useAppStore((s) => s.papers);
  const filter = useAppStore((s) => s.filter);
  const setFilter = useAppStore((s) => s.setFilter);

  const allTags = useMemo(() => collectTags(Object.values(allPapers)), [allPapers]);

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
        {allTags.map((t) => (
          <button key={t} className={'desk-tag' + (filter.tags.includes(t) ? ' on' : '')} onClick={() => toggleTag(t)}>
            {t}
          </button>
        ))}
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
      {papers.map((p) => (
        <PaperListRow key={p.id} paper={p} />
      ))}
      {papers.length === 0 && <div className="desk-list-empty">該当なし。検索やタグを見直してください。</div>}
    </div>
  );
}
