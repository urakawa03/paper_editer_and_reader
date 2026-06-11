import { create } from 'zustand';
import type { AppSettings, Filter, StoredPaper, SyncStatusKind, ViewOverride } from '../types';
import { DEFAULT_FILTER } from '../types';

export interface AppState {
  papers: Record<string, StoredPaper>;
  loaded: boolean;
  selectedId: string | null;
  filter: Filter;
  syncStatus: SyncStatusKind;
  queueCount: number;
  lastSyncAt: string | null;
  syncError: string | null;
  settings: AppSettings | null;
  addModalOpen: boolean;
  settingsOpen: boolean;
  detailOpen: boolean;

  setPapers: (papers: StoredPaper[]) => void;
  upsertPapers: (papers: StoredPaper[]) => void;
  removePapers: (ids: string[]) => void;
  select: (id: string | null) => void;
  setFilter: (patch: Partial<Filter>) => void;
  setSync: (patch: Partial<Pick<AppState, 'syncStatus' | 'queueCount' | 'lastSyncAt' | 'syncError'>>) => void;
  setSettings: (s: AppSettings | null) => void;
  setViewOverride: (v: ViewOverride) => void;
  setAddModalOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setDetailOpen: (open: boolean) => void;
  setLoaded: (loaded: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  papers: {},
  loaded: false,
  selectedId: null,
  filter: DEFAULT_FILTER,
  syncStatus: 'synced',
  queueCount: 0,
  lastSyncAt: null,
  syncError: null,
  settings: null,
  addModalOpen: false,
  settingsOpen: false,
  detailOpen: false,

  setPapers: (papers) =>
    set({ papers: Object.fromEntries(papers.map((p) => [p.id, p])) }),
  upsertPapers: (papers) =>
    set((st) => {
      const next = { ...st.papers };
      for (const p of papers) next[p.id] = p;
      return { papers: next };
    }),
  removePapers: (ids) =>
    set((st) => {
      const next = { ...st.papers };
      for (const id of ids) delete next[id];
      return {
        papers: next,
        selectedId: st.selectedId && ids.includes(st.selectedId) ? null : st.selectedId,
      };
    }),
  select: (id) => set({ selectedId: id }),
  setFilter: (patch) => set((st) => ({ filter: { ...st.filter, ...patch } })),
  setSync: (patch) => set(patch),
  setSettings: (settings) => set({ settings }),
  setViewOverride: (v) =>
    set((st) =>
      st.settings ? { settings: { ...st.settings, ui: { ...st.settings.ui, viewOverride: v } } } : {},
    ),
  setAddModalOpen: (addModalOpen) => set({ addModalOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setDetailOpen: (detailOpen) => set({ detailOpen }),
  setLoaded: (loaded) => set({ loaded }),
}));
