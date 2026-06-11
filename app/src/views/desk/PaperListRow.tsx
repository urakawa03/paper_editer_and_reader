import { memo } from 'react';
import type { StoredPaper } from '../../types';
import { useAppStore } from '../../data/store';
import { STATUS_LABEL } from '../../components/status';

/** リスト行(PC-2): タイトル/メタ + Abstract抜粋(3行) + Notes抜粋(あれば) */
export const PaperListRow = memo(function PaperListRow({ paper }: { paper: StoredPaper }) {
  const selected = useAppStore((s) => s.selectedId === paper.id);
  const select = useAppStore((s) => s.select);

  return (
    <div className={'row' + (selected ? ' sel' : '')} onClick={() => select(paper.id)}>
      <div className="row-title">{paper.title || paper.id}</div>
      <div className="row-meta">
        <span className={`status-dot ${paper.status}`} title={STATUS_LABEL[paper.status]} />
        <span>{paper.year || '—'}</span>
        <span>·</span>
        <span>{paper.authors.join(', ') || '著者不明'}</span>
        {paper.liked && <span className="row-heart">♥</span>}
      </div>
      {paper.abstract && <div className="row-summary">{paper.abstract}</div>}
      {paper.notes && (
        <div className="row-notes">
          <span className="pen">✎</span>
          <span className="ntext">{paper.notes}</span>
        </div>
      )}
    </div>
  );
});
