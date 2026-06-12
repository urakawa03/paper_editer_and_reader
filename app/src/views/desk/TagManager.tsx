import { useMemo, useState } from 'react';
import { Modal } from '../../components/Modal';
import { useAppStore } from '../../data/store';
import { mutatePaper } from '../../data/mutations';

/** タグ整理(PC): リネーム・統合(既存名へのリネーム)・一括削除 */
export function TagManager({ onClose }: { onClose: () => void }) {
  const papersMap = useAppStore((s) => s.papers);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [name, setName] = useState('');

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of Object.values(papersMap)) for (const t of p.tags) m.set(t, (m.get(t) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'));
  }, [papersMap]);

  /** 絞り込み中のタグ名も追従させる */
  const remapFilter = (from: string, to: string | null) => {
    const st = useAppStore.getState();
    const tags = st.filter.tags;
    if (!tags.includes(from)) return;
    const next = tags.map((t) => (t === from ? to : t)).filter((t): t is string => t !== null);
    st.setFilter({ tags: [...new Set(next)] });
  };

  const applyRename = async (from: string) => {
    const to = name.trim();
    setRenaming(null);
    if (!to || to === from) return;
    const targets = Object.values(papersMap).filter((p) => p.tags.includes(from));
    const merging = counts.some(([t]) => t === to);
    if (
      merging &&
      !window.confirm(`「${from}」を既存タグ「${to}」に統合します（対象 ${targets.length}件）。よろしいですか？`)
    ) {
      return;
    }
    for (const p of targets) {
      const next = [...new Set(p.tags.map((t) => (t === from ? to : t)))];
      await mutatePaper(p.id, { tags: next });
    }
    remapFilter(from, to);
  };

  const removeTag = async (tag: string, count: number) => {
    if (!window.confirm(`タグ「${tag}」を${count}件の論文から外します。よろしいですか？`)) return;
    const targets = Object.values(papersMap).filter((p) => p.tags.includes(tag));
    for (const p of targets) {
      await mutatePaper(p.id, { tags: p.tags.filter((t) => t !== tag) });
    }
    remapFilter(tag, null);
  };

  return (
    <Modal title="タグ整理" onClose={onClose}>
      <p className="hint" style={{ marginTop: 0 }}>
        リネームで既存のタグ名を入力すると統合されます。変更は全対象論文に一括反映され、自動で同期されます。
      </p>
      <div className="tagman-list">
        {counts.length === 0 && <div className="hint">タグはまだありません。</div>}
        {counts.map(([tag, count]) => (
          <div className="tagman-row" key={tag}>
            {renaming === tag ?
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void applyRename(tag);
                  if (e.key === 'Escape') setRenaming(null);
                }}
                onBlur={() => void applyRename(tag)}
              />
            : <span className="grow">#{tag}</span>}
            <span className="count">{count}件</span>
            <button
              className="ed-btn"
              onClick={() => {
                setRenaming(tag);
                setName(tag);
              }}
            >
              リネーム
            </button>
            <button className="ed-btn danger" onClick={() => void removeTag(tag, count)}>
              削除
            </button>
          </div>
        ))}
      </div>
      <div className="settings-actions">
        <button className="btn" onClick={onClose}>
          閉じる
        </button>
      </div>
    </Modal>
  );
}
