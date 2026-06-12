import { useEffect } from 'react';
import { useAppStore } from './data/store';
import { dbGetAllPapers, dbGetSettings } from './data/db';
import { initSyncEngine, pull, restoreSyncState } from './data/sync';
import { DEFAULT_UI } from './types';
import { useViewMode } from './hooks/useViewMode';
import { fixturesEnabled, loadFixtures } from './fixtures';
import { DeskView } from './views/desk/DeskView';
import { FeedView } from './views/feed/FeedView';
import { SettingsView } from './views/settings/SettingsView';
import { AddPaperModal } from './views/add/AddPaperModal';

let booted = false;

/** 起動シーケンス(§5.C): キャッシュ即表示 → バックグラウンドで差分pull */
async function bootstrap(): Promise<void> {
  if (booted) return; // StrictModeの二重実行ガード
  booted = true;
  const st = useAppStore.getState();
  const settings = await dbGetSettings();
  st.setSettings(settings ?? { ui: DEFAULT_UI });
  const papers = await dbGetAllPapers();
  st.setPapers(papers);
  st.setLoaded(true);
  if (settings?.github) {
    initSyncEngine();
    await restoreSyncState();
    void pull().catch(() => {});
  } else if (fixturesEnabled()) {
    loadFixtures();
  }
}

function applyTheme(theme: string) {
  const dark =
    theme === 'dark' ||
    (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export default function App() {
  const loaded = useAppStore((s) => s.loaded);
  const settings = useAppStore((s) => s.settings);
  const addModalOpen = useAppStore((s) => s.addModalOpen);
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const applyUpdate = useAppStore((s) => s.applyUpdate);
  const mode = useViewMode();

  useEffect(() => {
    void bootstrap();
  }, []);

  const theme = settings?.ui.theme ?? 'auto';
  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('auto');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  if (!loaded) {
    return (
      <div className="splash">
        Stacks<span className="dot">.</span>
      </div>
    );
  }

  if (!settings?.github && !fixturesEnabled()) {
    return <SettingsView onboarding />;
  }

  return (
    <>
      {mode === 'desk' ? <DeskView /> : <FeedView />}
      {addModalOpen && <AddPaperModal />}
      {settingsOpen && <SettingsView />}
      {applyUpdate && (
        <div className="update-toast" role="status">
          新しいバージョンがあります
          <button onClick={applyUpdate}>更新</button>
        </div>
      )}
    </>
  );
}
