import { useEffect, useState } from 'react';
import { useAppStore } from '../data/store';

const QUERY = '(min-width: 900px)';

/** 画面幅による自動判定(§5: 幅900px) + 手動オーバーライド */
export function useViewMode(): 'desk' | 'feed' {
  const override = useAppStore((s) => s.settings?.ui.viewOverride ?? 'auto');
  const [wide, setWide] = useState(() => window.matchMedia(QUERY).matches);

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = () => setWide(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  if (override === 'desk' || override === 'feed') return override;
  return wide ? 'desk' : 'feed';
}
