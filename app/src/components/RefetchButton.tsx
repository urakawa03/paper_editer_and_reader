import { useState } from 'react';
import type { StoredPaper } from '../types';
import { refetchIdentifier, refetchMetadata } from '../data/refetch';

/** 書誌情報の再取得(両ビュー共用)。空欄のフィールドだけをCrossref/S2で補完する */
export function RefetchButton({ paper, btnClass }: { paper: StoredPaper; btnClass: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const available = refetchIdentifier(paper) !== null;

  const run = async () => {
    setBusy(true);
    setMsg(null);
    const r = await refetchMetadata(paper);
    setMsg(
      r.ok ?
        r.filled.length ?
          `${r.filled.join('・')}を補完しました`
        : '補完できる新しい情報はありませんでした'
      : r.message,
    );
    setBusy(false);
  };

  return (
    <>
      <button
        className={btnClass}
        onClick={() => void run()}
        disabled={!available || busy}
        title={
          available ?
            'Crossref / Semantic Scholar から不足情報(著者・年・誌名・Abstract)を補完します。入力済みの内容は上書きしません'
          : 'DOIまたはarXivのURLがある論文で使えます'
        }
      >
        {busy ? '取得中…' : '⟳ 書誌情報を再取得'}
      </button>
      {msg && <span className="refetch-msg">{msg}</span>}
    </>
  );
}
