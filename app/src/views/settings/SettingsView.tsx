import { useState } from 'react';
import type { Theme } from '../../types';
import { useAppStore } from '../../data/store';
import { logout, saveGitHubSettings, updateUiSettings } from '../../data/settings';
import { initSyncEngine, pull, restoreSyncState } from '../../data/sync';
import { GitHubClient } from '../../lib/github';

/** 認証・接続設定(§5.F): fine-grained PAT(対象リポジトリのcontents read/writeのみ)を端末内に保存 */
export function SettingsView({ onboarding = false }: { onboarding?: boolean }) {
  const settings = useAppStore((s) => s.settings);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const gh = settings?.github;

  const [owner, setOwner] = useState(gh?.owner ?? '');
  const [repo, setRepo] = useState(gh?.repo ?? 'paper_data');
  const [branch, setBranch] = useState(gh?.branch ?? 'main');
  const [dir, setDir] = useState(gh?.dir ?? 'papers');
  const [token, setToken] = useState(gh?.token ?? '');
  const [mailto, setMailto] = useState(settings?.mailto ?? '');
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const theme = settings?.ui.theme ?? 'auto';
  const form = () => ({
    owner: owner.trim(),
    repo: repo.trim(),
    branch: branch.trim() || 'main',
    dir: dir.trim().replace(/\/+$/, '') || 'papers',
    token: token.trim(),
  });
  const formValid = owner.trim() && repo.trim() && token.trim();

  const check = async () => {
    setChecking(true);
    setCheckResult(null);
    const res = await new GitHubClient(form()).checkAccess();
    setCheckResult(
      res.ok && res.canPush
        ? { ok: true, message: '接続OK（読み書き可能）' }
        : { ok: false, message: res.reason ?? '接続できません' },
    );
    setChecking(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveGitHubSettings(form(), mailto);
      initSyncEngine();
      await restoreSyncState();
      void pull().catch(() => {});
      if (!onboarding) setSettingsOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const onLogout = () => {
    if (
      window.confirm(
        'ログアウトしますか？この端末からトークン・設定・キャッシュ・未同期の変更がすべて削除されます（GitHub上のデータは残ります）。',
      )
    ) {
      void logout();
    }
  };

  const body = (
    <>
      <div className="settings-row2">
        <div className="field">
          <label>Owner（ユーザー名）</label>
          <input value={owner} placeholder="urakawa03" onChange={(e) => setOwner(e.target.value)} />
        </div>
        <div className="field">
          <label>データリポジトリ</label>
          <input value={repo} placeholder="paper_data" onChange={(e) => setRepo(e.target.value)} />
        </div>
      </div>
      <div className="settings-row2">
        <div className="field">
          <label>ブランチ</label>
          <input value={branch} placeholder="main" onChange={(e) => setBranch(e.target.value)} />
        </div>
        <div className="field">
          <label>ディレクトリ</label>
          <input value={dir} placeholder="papers" onChange={(e) => setDir(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>Personal Access Token</label>
        <input
          type="password"
          value={token}
          placeholder="github_pat_…"
          autoComplete="off"
          onChange={(e) => setToken(e.target.value)}
        />
        <div className="hint">
          fine-grained PAT を推奨: 対象を上のデータリポジトリのみ・権限は Contents の Read and write
          だけにしてください。トークンはこの端末のブラウザ内（IndexedDB）にのみ保存されます。
        </div>
      </div>
      <div className="field">
        <label>Crossref連絡先メール（任意）</label>
        <input value={mailto} placeholder="you@example.com" onChange={(e) => setMailto(e.target.value)} />
        <div className="hint">設定するとCrossref APIのpoliteプール（安定枠）を利用できます。</div>
      </div>
      <div className="field">
        <label>テーマ</label>
        <select value={theme} onChange={(e) => void updateUiSettings({ theme: e.target.value as Theme })}>
          <option value="auto">自動（OSに合わせる）</option>
          <option value="light">ライト</option>
          <option value="dark">ダーク</option>
        </select>
      </div>
      <div className="field">
        <label>フィードの動作</label>
        <label className="check-line">
          <input
            type="checkbox"
            checked={settings?.ui.autoReading ?? true}
            onChange={(e) => void updateUiSettings({ autoReading: e.target.checked })}
          />
          詳細を開いたら未読を自動で「読書中」にする
        </label>
      </div>

      {checkResult && <div className={'check-result ' + (checkResult.ok ? 'ok' : 'ng')}>{checkResult.message}</div>}

      <div className="settings-actions">
        <button className="btn" onClick={() => void check()} disabled={!formValid || checking}>
          {checking ? '確認中…' : '接続テスト'}
        </button>
        <button className="btn primary" onClick={() => void save()} disabled={!formValid || saving}>
          {saving ? '保存中…' : onboarding ? '保存して開始' : '保存'}
        </button>
        {!onboarding && (
          <button className="btn" onClick={() => setSettingsOpen(false)}>
            閉じる
          </button>
        )}
        {gh && (
          <button className="btn danger" style={{ marginLeft: 'auto' }} onClick={onLogout}>
            ログアウト
          </button>
        )}
      </div>
    </>
  );

  if (onboarding) {
    return (
      <div className="settings-root">
        <div className="settings-card">
          <span className="logo">
            Stacks<span className="dot">.</span>
          </span>
          <p className="settings-sub">
            論文をフィードで読む、あなた専用のリーダー。データはGitHubリポジトリのMarkdownに保存されます。
          </p>
          <div className="note-box">
            はじめに、論文データを置くGitHubリポジトリ（例: 非公開の <code>paper_data</code>）と、そのリポジトリだけに
            Contents read/write 権限を持つ fine-grained PAT を用意してください。
          </div>
          {body}
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setSettingsOpen(false)}>
      <div className="modal-panel" role="dialog" aria-modal="true" aria-label="設定">
        <h2 className="modal-title">設定</h2>
        {body}
      </div>
    </div>
  );
}
