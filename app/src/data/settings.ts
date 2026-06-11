import type { AppSettings, GitHubSettings, UiSettings } from '../types';
import { DEFAULT_UI } from '../types';
import { dbClearAll, dbSetSettings } from './db';
import { useAppStore } from './store';

export async function updateUiSettings(patch: Partial<UiSettings>): Promise<void> {
  const st = useAppStore.getState();
  const cur: AppSettings = st.settings ?? { ui: DEFAULT_UI };
  const next: AppSettings = { ...cur, ui: { ...cur.ui, ...patch } };
  st.setSettings(next);
  await dbSetSettings(next);
}

export async function saveGitHubSettings(gh: GitHubSettings, mailto?: string): Promise<void> {
  const st = useAppStore.getState();
  const cur: AppSettings = st.settings ?? { ui: DEFAULT_UI };
  const next: AppSettings = { ...cur, github: gh, mailto: mailto?.trim() || undefined };
  st.setSettings(next);
  await dbSetSettings(next);
}

/** ログアウト(§5.F): トークン・設定・キャッシュ・キューをすべて端末から消す */
export async function logout(): Promise<void> {
  await dbClearAll();
  location.reload();
}
