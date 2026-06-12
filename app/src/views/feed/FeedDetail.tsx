import { useEffect, useState } from 'react';
import type { StoredPaper } from '../../types';
import { useAppStore } from '../../data/store';
import { mutatePaper } from '../../data/mutations';
import { normalizePip } from '../../lib/identifiers';
import { renderMarkdownLite } from '../../lib/mdlite';
import { useDebouncedCommit } from '../../hooks/useDebouncedCommit';
import { RefetchButton } from '../../components/RefetchButton';
import { STATUS_LABEL, nextStatus, paperLink } from '../../components/status';

/** 詳細表示(SP-5): Abstract全文・メモ編集(Markdown表示)・PIP付与・書誌再取得・元論文リンク */
export function FeedDetail({ paper }: { paper: StoredPaper }) {
  const setDetailOpen = useAppStore((s) => s.setDetailOpen);
  const autoReading = useAppStore((s) => s.settings?.ui.autoReading ?? true);
  const [notes, setNotes] = useState(paper.notes);
  const [pip, setPip] = useState(paper.pip ?? '');
  const [editingNotes, setEditingNotes] = useState(paper.notes.trim() === '');

  // 開いたら未読→読書中(設定でOFF可)。key=paper.idで論文ごとに一度だけ走る
  useEffect(() => {
    if (autoReading && paper.status === 'unread') void mutatePaper(paper.id, { status: 'reading' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = useDebouncedCommit(() => {
    if (notes !== paper.notes) void mutatePaper(paper.id, { notes });
  });
  const pipCommit = useDebouncedCommit(() => {
    const np = normalizePip(pip);
    if ((np ?? '') !== (paper.pip ?? '')) void mutatePaper(paper.id, { pip: np });
  });

  const close = () => {
    commit.flush();
    pipCommit.flush();
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
          <label className="pfd-pip">
            PIP
            <input
              value={pip}
              placeholder="00000"
              inputMode="numeric"
              onChange={(e) => {
                setPip(e.target.value);
                pipCommit.call();
              }}
              onBlur={() => {
                pipCommit.flush();
                setPip(normalizePip(pip) ?? '');
              }}
            />
          </label>
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
            <div className="pfd-notes-head">
              <p className="ed-section-label">Notes（自分のメモ）</p>
              {notes.trim() !== '' && (
                <button
                  className="pfd-notes-toggle"
                  onClick={() => {
                    if (editingNotes) commit.flush();
                    setEditingNotes(!editingNotes);
                  }}
                >
                  {editingNotes ? '✓ 完了' : '✎ 編集'}
                </button>
              )}
            </div>
            {editingNotes ?
              <textarea
                className="pfd-notes"
                value={notes}
                autoFocus={notes.trim() !== ''}
                placeholder="読みながら気づいたことを書く…"
                onChange={(e) => {
                  setNotes(e.target.value);
                  commit.call();
                }}
                onFocus={(e) => {
                  // ソフトキーボード表示後に入力欄を見える位置へ戻す
                  const el = e.currentTarget;
                  setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
                }}
                onBlur={commit.flush}
              />
            : <div className="pfd-notes-view" onClick={() => setEditingNotes(true)}>
                {renderMarkdownLite(notes)}
              </div>
            }
          </div>

          <div className="pfd-tools">
            <RefetchButton paper={paper} btnClass="pf-act" />
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
