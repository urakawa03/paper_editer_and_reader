import { useEffect, useMemo, useRef } from 'react';

/**
 * 編集フィールド用: 連続入力をdebounceしてcommitする(キーストローク毎の書き込みを避ける)。
 * flush()はblur時などに即時確定する。アンマウント時は自動flush。
 */
export function useDebouncedCommit(commit: () => void, ms = 600): { call: () => void; flush: () => void } {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(commit);
  fnRef.current = commit;

  const api = useMemo(
    () => ({
      call() {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          timer.current = null;
          fnRef.current();
        }, ms);
      },
      flush() {
        if (timer.current) {
          clearTimeout(timer.current);
          timer.current = null;
          fnRef.current();
        }
      },
    }),
    [ms],
  );

  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
        fnRef.current();
      }
    };
  }, []);

  return api;
}
