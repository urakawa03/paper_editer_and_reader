import { useAppStore } from '../data/store';
import { updateUiSettings } from '../data/settings';
import type { ViewOverride } from '../types';
import { SyncIndicator } from './SyncIndicator';

const NEXT: Record<ViewOverride, ViewOverride> = { auto: 'desk', desk: 'feed', feed: 'auto' };
const LABEL: Record<ViewOverride, string> = { auto: '表示: 自動', desk: '表示: PC', feed: '表示: フィード' };

/** 追加(PC-9)・ビュー手動切替・設定・同期。両ビューのヘッダーで共用(追加はPCビューのみ) */
export function HeaderActions({ compact = false, showAdd = true }: { compact?: boolean; showAdd?: boolean }) {
  const override = useAppStore((s) => s.settings?.ui.viewOverride ?? 'auto');
  const setAddModalOpen = useAppStore((s) => s.setAddModalOpen);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);

  return (
    <div className="hdr-actions">
      <SyncIndicator compact={compact} />
      {showAdd && (
        <button className="icon-btn primary" onClick={() => setAddModalOpen(true)} title="論文を追加(RIS/BIB/DOI/arXiv ID)">
          ＋{!compact && ' 追加'}
        </button>
      )}
      <button
        className="icon-btn"
        onClick={() => void updateUiSettings({ viewOverride: NEXT[override] })}
        title="PC編集ビュー / フィードビューの手動切り替え"
      >
        {compact ? LABEL[override].replace('表示: ', '⇄ ') : LABEL[override]}
      </button>
      <button className="icon-btn" onClick={() => setSettingsOpen(true)} title="設定">
        ⚙
      </button>
    </div>
  );
}
