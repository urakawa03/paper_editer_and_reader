import type { GitHubSettings } from '../types';
import { decodeBase64Utf8 } from './base64';

export type GitHubErrorKind = 'auth' | 'notfound' | 'conflict' | 'ratelimit' | 'network' | 'other';

export class GitHubError extends Error {
  constructor(
    message: string,
    public status: number,
    public kind: GitHubErrorKind,
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

export interface FileChange {
  path: string;
  /** null = 削除 */
  text: string | null;
}

export interface TreeEntry {
  path: string;
  sha: string;
}

const API = 'https://api.github.com';

/**
 * 素のfetchによる薄いGitHubクライアント。
 * 読み: ref → commit → tree(recursive) → blob。
 * 書き: Git Data API(blob→tree→commit→ref更新)に一本化し、複数ファイルを1コミットにまとめる(§5.D/§5.E)。
 */
export class GitHubClient {
  /** 直近レスポンスの X-RateLimit-Remaining */
  rateRemaining: number | null = null;

  constructor(private cfg: GitHubSettings) {}

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${API}${path}`, {
        method,
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${this.cfg.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      throw new GitHubError(`ネットワークエラー: ${(e as Error).message}`, 0, 'network');
    }
    const remaining = res.headers.get('x-ratelimit-remaining');
    if (remaining !== null) this.rateRemaining = Number(remaining);

    if (!res.ok) {
      let detail = '';
      try {
        detail = ((await res.json()) as { message?: string }).message ?? '';
      } catch {
        /* ignore */
      }
      const kind: GitHubErrorKind =
        res.status === 401 ? 'auth'
        : res.status === 403 ? (this.rateRemaining === 0 ? 'ratelimit' : 'auth')
        : res.status === 404 ? 'notfound'
        : res.status === 409 || res.status === 422 ? 'conflict'
        : 'other';
      throw new GitHubError(`GitHub API ${res.status}: ${detail}`, res.status, kind);
    }
    return (await res.json()) as T;
  }

  private get repoPath(): string {
    return `/repos/${this.cfg.owner}/${this.cfg.repo}`;
  }

  async getHeadCommitSha(): Promise<string> {
    const r = await this.request<{ object: { sha: string } }>(
      'GET',
      `${this.repoPath}/git/ref/${encodeURIComponent(`heads/${this.cfg.branch}`)}`,
    );
    return r.object.sha;
  }

  /** commit配下の {dir}/*.md 一覧(path, blob sha) */
  async getTreePapers(commitSha: string): Promise<TreeEntry[]> {
    const commit = await this.request<{ tree: { sha: string } }>('GET', `${this.repoPath}/git/commits/${commitSha}`);
    const tree = await this.request<{ tree: { path: string; type: string; sha: string }[]; truncated: boolean }>(
      'GET',
      `${this.repoPath}/git/trees/${commit.tree.sha}?recursive=1`,
    );
    const prefix = `${this.cfg.dir}/`;
    return tree.tree
      .filter((e) => e.type === 'blob' && e.path.startsWith(prefix) && e.path.endsWith('.md'))
      .map((e) => ({ path: e.path, sha: e.sha }));
  }

  async getBlobText(blobSha: string): Promise<string> {
    const r = await this.request<{ content: string; encoding: string }>(
      'GET',
      `${this.repoPath}/git/blobs/${blobSha}`,
    );
    if (r.encoding !== 'base64') throw new GitHubError(`未対応のblobエンコーディング: ${r.encoding}`, 0, 'other');
    return decodeBase64Utf8(r.content);
  }

  /**
   * 複数ファイルの作成・更新・削除を1コミットでpushする。
   * refの更新がnon-fast-forwardで失敗した場合は kind:'conflict' を投げる(呼び出し側がpull後に再試行)。
   */
  async commitFiles(
    changes: FileChange[],
    message: string,
  ): Promise<{ commitSha: string; blobShas: Map<string, string> }> {
    const headSha = await this.getHeadCommitSha();
    const headCommit = await this.request<{ tree: { sha: string } }>(
      'GET',
      `${this.repoPath}/git/commits/${headSha}`,
    );

    const blobShas = new Map<string, string>();
    const treeItems: { path: string; mode: '100644'; type: 'blob'; sha: string | null }[] = [];
    for (const ch of changes) {
      if (ch.text === null) {
        treeItems.push({ path: ch.path, mode: '100644', type: 'blob', sha: null });
      } else {
        const blob = await this.request<{ sha: string }>('POST', `${this.repoPath}/git/blobs`, {
          content: ch.text,
          encoding: 'utf-8',
        });
        blobShas.set(ch.path, blob.sha);
        treeItems.push({ path: ch.path, mode: '100644', type: 'blob', sha: blob.sha });
      }
    }

    const newTree = await this.request<{ sha: string }>('POST', `${this.repoPath}/git/trees`, {
      base_tree: headCommit.tree.sha,
      tree: treeItems,
    });
    const newCommit = await this.request<{ sha: string }>('POST', `${this.repoPath}/git/commits`, {
      message,
      tree: newTree.sha,
      parents: [headSha],
    });
    await this.request('PATCH', `${this.repoPath}/git/refs/${encodeURIComponent(`heads/${this.cfg.branch}`)}`, {
      sha: newCommit.sha,
      force: false,
    });
    return { commitSha: newCommit.sha, blobShas };
  }

  /** 設定画面の接続テスト */
  async checkAccess(): Promise<{ ok: boolean; canPush: boolean; reason?: string }> {
    try {
      const repo = await this.request<{ permissions?: { push?: boolean } }>('GET', this.repoPath);
      const canPush = repo.permissions?.push ?? false;
      return { ok: true, canPush, reason: canPush ? undefined : 'トークンに書き込み権限がありません' };
    } catch (e) {
      const err = e as GitHubError;
      const reason =
        err.kind === 'auth' ? 'トークンが無効か権限不足です'
        : err.kind === 'notfound' ? 'リポジトリが見つかりません(owner/repo、またはトークンの対象リポジトリを確認)'
        : err.message;
      return { ok: false, canPush: false, reason };
    }
  }
}
