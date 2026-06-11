import { useAppStore } from '../data/store';

/** AND/OR検索(PC-3 / SP-3)。入力とモード切替は両ビュー共用 */
export function SearchBar({ className, placeholder }: { className: string; placeholder: string }) {
  const query = useAppStore((s) => s.filter.query);
  const setFilter = useAppStore((s) => s.setFilter);
  return (
    <input
      className={className}
      type="search"
      placeholder={placeholder}
      value={query}
      onChange={(e) => setFilter({ query: e.target.value })}
    />
  );
}

export function ModeSeg() {
  const mode = useAppStore((s) => s.filter.mode);
  const setFilter = useAppStore((s) => s.setFilter);
  return (
    <div className="seg">
      {(['AND', 'OR'] as const).map((m) => (
        <button key={m} className={mode === m ? 'on' : ''} onClick={() => setFilter({ mode: m })}>
          {m}
        </button>
      ))}
    </div>
  );
}
