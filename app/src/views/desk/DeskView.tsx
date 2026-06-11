import { useEffect, useMemo } from 'react';
import '../../styles/desk.css';
import { useAppStore } from '../../data/store';
import { filterPapers } from '../../lib/search';
import { ModeSeg, SearchBar } from '../../components/SearchBar';
import { HeaderActions } from '../../components/HeaderActions';
import { PaperList } from './PaperList';
import { EditorPane } from './EditorPane';

/** PC編集・俯瞰ビュー(§5.A): 左=リスト(俯瞰)、右=編集ペインの2ペイン(PC-1) */
export function DeskView() {
  const papersMap = useAppStore((s) => s.papers);
  const filter = useAppStore((s) => s.filter);
  const selectedId = useAppStore((s) => s.selectedId);
  const select = useAppStore((s) => s.select);

  const papers = useMemo(() => Object.values(papersMap), [papersMap]);
  const filtered = useMemo(() => filterPapers(papers, filter), [papers, filter]);

  // 未選択(または選択中の論文が消えた)とき先頭を自動選択
  useEffect(() => {
    if ((!selectedId || !papersMap[selectedId]) && filtered.length > 0) {
      select(filtered[0].id);
    }
  }, [selectedId, papersMap, filtered, select]);

  const sel = selectedId ? papersMap[selectedId] : undefined;

  return (
    <div className="desk-root">
      <div className="desk-top">
        <span className="logo">
          Stacks<span className="dot">.</span>
        </span>
        <SearchBar className="desk-search" placeholder="検索（スペース区切りで複数語）" />
        <ModeSeg />
        <HeaderActions />
      </div>
      <div className="desk-body">
        <PaperList papers={filtered} />
        {sel ? (
          <EditorPane key={sel.id} paper={sel} />
        ) : (
          <div className="ed-empty">
            {papers.length === 0
              ? 'まだ論文がありません。右上の「＋ 追加」からRIS/BIBファイルやDOIで取り込めます。'
              : '左のリストから論文を選んでください。'}
          </div>
        )}
      </div>
    </div>
  );
}
