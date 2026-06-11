import { useMemo } from 'react';
import '../../styles/feed.css';
import { useAppStore } from '../../data/store';
import { collectTags, filterPapers } from '../../lib/search';
import { ModeSeg, SearchBar } from '../../components/SearchBar';
import { FilterChips } from '../../components/FilterChips';
import { HeaderActions } from '../../components/HeaderActions';
import { FeedCard } from './FeedCard';
import { FeedDetail } from './FeedDetail';
import type { SortKey } from '../../types';

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'added:desc', label: '追加順' },
  { value: 'updated:desc', label: '更新順' },
  { value: 'year:desc', label: '年(新)' },
];

/** スマホ フィード閲覧ビュー(§5.B): カード縦スクロール(SP-1) */
export function FeedView() {
  const papersMap = useAppStore((s) => s.papers);
  const filter = useAppStore((s) => s.filter);
  const setFilter = useAppStore((s) => s.setFilter);
  const detailOpen = useAppStore((s) => s.detailOpen);
  const selectedId = useAppStore((s) => s.selectedId);

  const papers = useMemo(() => Object.values(papersMap), [papersMap]);
  const filtered = useMemo(() => filterPapers(papers, filter), [papers, filter]);
  const allTags = useMemo(() => collectTags(papers), [papers]);

  const toggleTag = (t: string) =>
    setFilter({ tags: filter.tags.includes(t) ? filter.tags.filter((x) => x !== t) : [...filter.tags, t] });

  const sortValue = `${filter.sort}:${filter.dir}`;
  const detail = detailOpen && selectedId ? papersMap[selectedId] : undefined;

  return (
    <div className="pf-root">
      <div className="pf-phone">
        <div className="pf-header">
          <div className="pf-brand">
            <span className="logo">
              Stacks<span className="dot">.</span>
            </span>
            <HeaderActions compact showAdd={false} />
          </div>
          <SearchBar className="pf-search" placeholder="検索（例: 物理 シミュレーション）" />
          <div className="pf-controls">
            <ModeSeg />
            <FilterChips />
            <select
              value={SORT_OPTIONS.some((o) => o.value === sortValue) ? sortValue : 'added:desc'}
              onChange={(e) => {
                const [sort, dir] = e.target.value.split(':') as [SortKey, 'asc' | 'desc'];
                setFilter({ sort, dir });
              }}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="pf-tagbar">
            {allTags.map((t) => (
              <button key={t} className={'pf-tag' + (filter.tags.includes(t) ? ' on' : '')} onClick={() => toggleTag(t)}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="pf-feed">
          {filtered.length === 0 && (
            <div className="pf-empty">
              {papers.length === 0 ? (
                <>
                  まだ論文がありません。
                  <br />
                  論文の追加はPC表示から行えます。
                </>
              ) : (
                <>
                  該当する論文がありません。
                  <br />
                  タグ・検索・フィルターを見直してみて。
                </>
              )}
            </div>
          )}
          {filtered.map((p) => (
            <FeedCard key={p.id} paper={p} />
          ))}
        </div>
      </div>
      {detail && <FeedDetail key={detail.id} paper={detail} />}
    </div>
  );
}
