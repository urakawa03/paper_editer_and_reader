import { useAppStore } from '../data/store';
import type { ReadFilter } from '../types';

const READ_OPTIONS: { value: ReadFilter; label: string }[] = [
  { value: 'all', label: 'すべて' },
  { value: 'unread', label: '未読' },
  { value: 'read', label: '既読' },
];

/** いいね絞り込み + 未読/既読フィルタ。両ビューのツールバーで共用 */
export function FilterChips() {
  const liked = useAppStore((s) => s.filter.liked);
  const read = useAppStore((s) => s.filter.read);
  const setFilter = useAppStore((s) => s.setFilter);

  return (
    <>
      <button
        className={'chip-like' + (liked ? ' on' : '')}
        title="いいねした論文だけ表示"
        onClick={() => setFilter({ liked: !liked })}
      >
        {liked ? '♥' : '♡'} いいね
      </button>
      <div className="seg seg-read">
        {READ_OPTIONS.map((o) => (
          <button key={o.value} className={read === o.value ? 'on' : ''} onClick={() => setFilter({ read: o.value })}>
            {o.label}
          </button>
        ))}
      </div>
    </>
  );
}
