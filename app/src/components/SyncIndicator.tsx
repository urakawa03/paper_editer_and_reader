import { useAppStore } from '../data/store';
import { syncNow } from '../data/sync';

/** 同期状態の常時表示(PC-8) + クリックで手動「今すぐ同期」(§5.D) */
export function SyncIndicator({ compact = false }: { compact?: boolean }) {
  const status = useAppStore((s) => s.syncStatus);
  const queueCount = useAppStore((s) => s.queueCount);
  const error = useAppStore((s) => s.syncError);

  const label =
    status === 'synced' ? 'GitHubと同期済み'
    : status === 'saving' ? '保存中…'
    : `未同期 ${queueCount}件`;
  const title = (error ? `エラー: ${error}\n` : '') + 'クリックで今すぐ同期';

  return (
    <button className={`sync-ind ${status}`} title={title} onClick={() => void syncNow()}>
      <span className="pulse" />
      {!compact && label}
    </button>
  );
}
