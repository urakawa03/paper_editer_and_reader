import { useRef, useState } from 'react';
import { Modal } from '../../components/Modal';
import { useAppStore } from '../../data/store';
import { addPapers } from '../../data/mutations';
import { parseIdentifierLines } from '../../lib/identifiers';
import { ingest, type IngestInput, type IngestResult } from '../../ingest/pipeline';

interface PickedFile {
  name: string;
  text: string;
}

/** 論文の追加(PC-9 / §4): RIS/BIBのドロップ・選択、DOI/arXiv ID貼り付け */
export function AddPaperModal() {
  const setOpen = useAppStore((s) => s.setAddModalOpen);
  const papers = useAppStore((s) => s.papers);
  const mailto = useAppStore(
    (s) => s.settings?.mailto ?? (import.meta.env.VITE_CROSSREF_MAILTO as string | undefined),
  );

  const [files, setFiles] = useState<PickedFile[]>([]);
  const [idText, setIdText] = useState('');
  const [over, setOver] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [invalidIds, setInvalidIds] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const pickFiles = async (list: FileList | null) => {
    if (!list) return;
    const picked: PickedFile[] = [];
    for (const f of Array.from(list)) {
      picked.push({ name: f.name, text: await f.text() });
    }
    setFiles((cur) => [...cur, ...picked]);
  };

  const run = async () => {
    const { ids, invalid } = parseIdentifierLines(idText);
    setInvalidIds(invalid);
    const inputs: IngestInput[] = [
      ...files.map((f): IngestInput => {
        const kind = f.name.toLowerCase().endsWith('.ris') ? ('ris' as const) : ('bib' as const);
        return { kind, text: f.text, label: f.name };
      }),
      ...ids.map((value): IngestInput => ({ kind: 'id', value })),
    ];
    if (inputs.length === 0) return;

    setRunning(true);
    setResult(null);
    try {
      const all = Object.values(papers);
      const res = await ingest(inputs, {
        existingIds: new Set(all.map((p) => p.id)),
        existingDois: new Set(all.flatMap((p) => (p.doi ? [p.doi.toLowerCase()] : []))),
        mailto,
        onProgress: (done, total, label) => setProgress({ done, total, label }),
      });
      await addPapers(res.added);
      setResult(res);
      setFiles([]);
      setIdText('');
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  const canRun = !running && (files.length > 0 || idText.trim().length > 0);

  return (
    <Modal title="論文を追加" onClose={() => !running && setOpen(false)}>
      <div
        className={'dropzone' + (over ? ' over' : '')}
        onClick={() => fileInput.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void pickFiles(e.dataTransfer.files);
        }}
      >
        .ris / .bib ファイルをドロップ、またはクリックして選択（複数可）
        {files.length > 0 && <div className="files">{files.map((f) => f.name).join(' / ')}</div>}
        <input
          ref={fileInput}
          type="file"
          accept=".ris,.bib,.bibtex,.txt"
          multiple
          hidden
          onChange={(e) => {
            void pickFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      <div className="field" style={{ marginTop: 14 }}>
        <label>DOI / arXiv ID（1行に1つ、URL可）</label>
        <textarea
          rows={3}
          value={idText}
          placeholder={'10.48550/arXiv.1706.03762\n1512.03385\nhttps://doi.org/10.1103/PhysRevLett.116.061102'}
          onChange={(e) => setIdText(e.target.value)}
        />
        <div className="hint">
          メタデータとabstract原文は Crossref → Semantic Scholar の順で自動取得します（取れない場合は空のまま追加され、編集画面から貼り付けられます）。
        </div>
      </div>

      {invalidIds.length > 0 && (
        <div className="check-result ng">識別子として解釈できません: {invalidIds.join(', ')}</div>
      )}

      {progress && (
        <div className="ingest-progress">
          {progress.done}/{progress.total} 件処理中… {progress.label}
          <div className="ingest-bar">
            <div style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {result && <ResultSummary result={result} />}

      <div className="modal-close-row">
        <button className="btn" onClick={() => setOpen(false)} disabled={running}>
          閉じる
        </button>
        <button className="btn primary" onClick={() => void run()} disabled={!canRun}>
          {running ? '取り込み中…' : '取り込む'}
        </button>
      </div>
    </Modal>
  );
}

/** 成功・スキップ・失敗の件数と内訳(§4.5) */
function ResultSummary({ result }: { result: IngestResult }) {
  return (
    <div>
      <div className="check-result ok" style={{ marginTop: 14 }}>
        追加 {result.added.length}件 / スキップ {result.skipped.length}件 / 失敗 {result.failed.length}件
      </div>
      <ul className="result-list">
        {result.added.map((p) => (
          <li key={p.id} className="ok">
            ✓ {p.id} — {p.title || '(タイトル未取得)'}
          </li>
        ))}
        {result.skipped.map((s, i) => (
          <li key={`s${i}`} className="skip">
            – {s.key}: {s.reason}
          </li>
        ))}
        {result.failed.map((f, i) => (
          <li key={`f${i}`} className="fail">
            ✗ {f.input}: {f.reason}
          </li>
        ))}
      </ul>
    </div>
  );
}
