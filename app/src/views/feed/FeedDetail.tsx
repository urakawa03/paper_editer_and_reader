import { useState } from 'react';
import type { StoredPaper } from '../../types';
import { useAppStore } from '../../data/store';
import { mutatePaper } from '../../data/mutations';
import { useDebouncedCommit } from '../../hooks/useDebouncedCommit';
import { STATUS_LABEL, nextStatus, paperLink } from '../../components/status';

/** 詳細表示(SP-5): Abstract全文・メモ編集・元論文リンク */
export function FeedDetail({ paper }: { paper: StoredPaper }) {
  const setDetailOpen = useAppStore((s) => s.setDetailOpen);
  const [notes, setNotes] = useState(paper.notes);

  const commit = useDebouncedCommit(() => {
    if (notes !== paper.notes) void mutatePaper(paper.id, { notes });
  });

  const close = () => {
    commit.flush();
    setDetailOpen(false);
  };
  const link = paperLink(paper);
  const isRead = paper.status === 'read';

  return (
    <div className="pfd-backdrop" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="pfd-panel">
        <div className="pfd-top">
          <button className="pfd-back" onClick={close}>
            ← 戻る
          </button>
          <span className="pf-spacer" />
          <button
            className={'pf-act' + (paper.liked ? ' liked' : '')}
            onClick={() => void mutatePaper(paper.id, { liked: !paper.liked })}
          >
            {paper.liked ? '♥' : '♡'} いいね
          </button>
          <button
            className={'pf-act' + (isRead ? ' done' : '')}
            onClick={() => void mutatePaper(paper.id, { status: nextStatus(paper.status) })}
          >
            {STATUS_LABEL[paper.status]}
          </button>
        </div>
        <div className="pfd-body">
          <div className="pf-meta">
            {paper.venue && (
              <>
                <span className="pf-venue">{paper.venue}</span>
                <span className="pf-dot" />
              </>
            )}
            <span>{paper.year || '—'}</span>
          </div>
          <h2 className="pfd-title">{paper.title || paper.id}</h2>
          <div className="pf-authors">{paper.authors.join(', ')}</div>
          {paper.tags.length > 0 && (
            <div className="pf-chips">
              {paper.tags.map((t) => (
                <span className="pf-chip" key={t}>
                  #{t}
                </span>
              ))}
            </div>
          )}

          <div className="pfd-section">
            <p className="ed-section-label">Abstract</p>
            {paper.abstract ? (
              <p className="pfd-abstract">{paper.abstract}</p>
            ) : (
              <p className="pfd-abstract" style={{ color: 'var(--ink-soft)' }}>
                （未登録。PC編集ビューで原文を貼り付けられます）
              </p>
            )}
          </div>

          <div className="pfd-section">
            <p className="ed-section-label">Notes（自分のメモ）</p>
            <textarea
              className="pfd-notes"
              value={notes}
              placeholder="読みながら気づいたことを書く…"
              onChange={(e) => {
                setNotes(e.target.value);
                commit.call();
              }}
              onBlur={commit.flush}
            />
          </div>

          {link && (
            <a className="pfd-link" href={link} target="_blank" rel="noreferrer">
              元論文を開く ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
