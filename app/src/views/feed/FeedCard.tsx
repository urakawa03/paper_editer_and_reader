import { memo, useRef, useState } from 'react';
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

/**
 * フィードカード(SP-2) + いいね・メモ・既読(SP-4: 即時反映+遅延同期)。
 * スワイプ: 右=既読トグル / 左=いいねトグル(縦スクロールが優勢な間は発動しない)
 */
export const FeedCard = memo(function FeedCard({ paper }: { paper: StoredPaper }) {
  const [open, setOpen] = useState(false);
  const [dx, setDx] = useState(0);
  const drag = useRef<{ x: number; y: number; mode: 'pending' | 'h' | 'cancel' } | null>(null);
  const select = useAppStore((s) => s.select);
  const setDetailOpen = useAppStore((s) => s.setDetailOpen);
  const setFilter = useAppStore((s) => s.setFilter);
  const filterTags = useAppStore((s) => s.filter.tags);

  const openDetail = () => {
    select(paper.id);
    setDetailOpen(true);
  };
  const isRead = paper.status === 'read';

  const SWIPE_FIRE = 76;
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    drag.current = { x: t.clientX, y: t.clientY, mode: 'pending' };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const d = drag.current;
    if (!d || d.mode === 'cancel') return;
    const t = e.touches[0];
    const mx = t.clientX - d.x;
    const my = t.clientY - d.y;
    if (d.mode === 'pending') {
      if (Math.abs(my) > 12 && Math.abs(my) > Math.abs(mx)) {
        d.mode = 'cancel'; // 縦スクロールが先に始まったら譲る
        return;
      }
      if (Math.abs(mx) > 16 && Math.abs(mx) > Math.abs(my) * 1.4) d.mode = 'h';
      else return;
    }
    setDx(Math.max(-110, Math.min(110, mx)));
  };
  const onTouchEnd = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.mode === 'h') {
      if (dx >= SWIPE_FIRE) {
        void mutatePaper(paper.id, { status: isRead ? 'unread' : 'read' });
        navigator.vibrate?.(12);
      } else if (dx <= -SWIPE_FIRE) {
        void mutatePaper(paper.id, { liked: !paper.liked });
        navigator.vibrate?.(12);
      }
    }
    setDx(0);
  };

  const cls =
    'pf-card' +
    (isRead ? ' read' : '') +
    (dx !== 0 ? ' dragging' : '') +
    (dx >= SWIPE_FIRE ? ' will-read' : dx <= -SWIPE_FIRE ? ' will-like' : '');

  return (
    <article
      className={cls}
      style={dx !== 0 ? { transform: `translateX(${dx}px)` } : undefined}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <div className="pf-meta">
        {paper.pip && (
          <>
            <span className="pf-pip">PIP {paper.pip}</span>
            <span className="pf-dot" />
          </>
        )}
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
