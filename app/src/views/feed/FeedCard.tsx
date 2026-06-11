import { memo, useState } from 'react';
import type { StoredPaper } from '../../types';
import { useAppStore } from '../../data/store';
import { mutatePaper } from '../../data/mutations';

const HeartIcon = ({ filled }: { filled: boolean }) => (
  <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8">
    <path d="M12 21s-7.5-4.6-10-9C.6 9.4 1.6 6 5 5c2.1-.6 3.9.5 5 2 1.1-1.5 2.9-2.6 5-2 3.4 1 4.4 4.4 3 7-2.5 4.4-10 9-10 9z" />
  </svg>
);
const MemoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M4 5h16v11H7l-3 3V5z" strokeLinejoin="round" />
  </svg>
);
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M4 12.5l5 5 11-11" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** フィードカード(SP-2) + いいね・メモ・既読(SP-4: 即時反映+遅延同期) */
export const FeedCard = memo(function FeedCard({ paper }: { paper: StoredPaper }) {
  const [open, setOpen] = useState(false);
  const select = useAppStore((s) => s.select);
  const setDetailOpen = useAppStore((s) => s.setDetailOpen);
  const setFilter = useAppStore((s) => s.setFilter);
  const filterTags = useAppStore((s) => s.filter.tags);

  const openDetail = () => {
    select(paper.id);
    setDetailOpen(true);
  };
  const isRead = paper.status === 'read';

  return (
    <article className="pf-card">
      <div className="pf-meta">
        {paper.venue && (
          <>
            <span className="pf-venue">{paper.venue}</span>
            <span className="pf-dot" />
          </>
        )}
        <span>{paper.year || '—'}</span>
        {paper.status !== 'read' && (
          <span className={'pf-unread' + (paper.status === 'reading' ? ' reading' : '')} title={paper.status === 'reading' ? '読書中' : '未読'} />
        )}
      </div>
      <h2 className="pf-title" onClick={openDetail}>
        {paper.title || paper.id}
      </h2>
      <div className="pf-authors">{paper.authors.join(', ')}</div>
      {paper.abstract ? (
        <>
          <p className={'pf-summary' + (open ? '' : ' clamp')}>{paper.abstract}</p>
          <button className="pf-more" onClick={() => setOpen(!open)}>
            {open ? '閉じる' : '続きを読む'}
          </button>
        </>
      ) : (
        <p className="pf-summary" style={{ color: 'var(--ink-soft)' }}>
          （Abstract未登録 — 詳細から追記できます）
        </p>
      )}

      {paper.tags.length > 0 && (
        <div className="pf-chips">
          {paper.tags.map((t) => (
            <button
              className="pf-chip"
              key={t}
              onClick={() =>
                setFilter({ tags: filterTags.includes(t) ? filterTags.filter((x) => x !== t) : [...filterTags, t] })
              }
            >
              #{t}
            </button>
          ))}
        </div>
      )}

      <div className="pf-actions">
        <button
          className={'pf-act' + (paper.liked ? ' liked' : '')}
          onClick={() => void mutatePaper(paper.id, { liked: !paper.liked })}
        >
          <HeartIcon filled={paper.liked} />
          いいね
        </button>
        <button className="pf-act" onClick={openDetail}>
          <MemoIcon />
          メモ
        </button>
        <span className="pf-spacer" />
        <button
          className={'pf-act' + (isRead ? ' done' : '')}
          onClick={() => void mutatePaper(paper.id, { status: isRead ? 'unread' : 'read' })}
        >
          <CheckIcon />
          {isRead ? '既読' : '未読'}
        </button>
      </div>
    </article>
  );
});
