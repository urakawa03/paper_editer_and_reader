export interface DetectedId {
  kind: 'doi' | 'arxiv';
  value: string;
}

const DOI_RE = /^10\.\d{4,9}\/\S+$/;
// 新形式 2103.14030(v2) / 旧形式 cond-mat/9912345, math.GT/0309136
const ARXIV_NEW_RE = /^(\d{4}\.\d{4,5})(v\d+)?$/;
const ARXIV_OLD_RE = /^([a-z-]+(?:\.[A-Z]{2})?\/\d{7})(v\d+)?$/;

/** DOI / arXiv ID をURL・プレフィックス込みの入力から判定・正規化する */
export function detectIdentifier(raw: string): DetectedId | null {
  let s = raw.trim();
  if (!s) return null;

  const arxivUrl = /^https?:\/\/(?:www\.)?arxiv\.org\/(?:abs|pdf)\/(.+?)(?:\.pdf)?\/?$/i.exec(s);
  if (arxivUrl) s = arxivUrl[1];
  s = s.replace(/^arxiv:/i, '');
  s = s.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '');
  s = s.replace(/^doi:/i, '');
  s = s.trim();

  const mNew = ARXIV_NEW_RE.exec(s);
  if (mNew) return { kind: 'arxiv', value: mNew[1] };
  const mOld = ARXIV_OLD_RE.exec(s);
  if (mOld) return { kind: 'arxiv', value: mOld[1] };
  // arXiv DOI は arXiv として扱う(Semantic Scholar優先で引くため)
  const mArxivDoi = /^10\.48550\/arxiv\.(.+)$/i.exec(s);
  if (mArxivDoi) {
    const inner = detectIdentifier(mArxivDoi[1]);
    if (inner?.kind === 'arxiv') return inner;
  }
  if (DOI_RE.test(s)) return { kind: 'doi', value: s };
  return null;
}

/** 複数行テキスト(DOI/arXiv ID貼り付け欄)を識別子リストへ */
export function parseIdentifierLines(text: string): { ids: DetectedId[]; invalid: string[] } {
  const ids: DetectedId[] = [];
  const invalid: string[] = [];
  for (const line of text.split(/[\n,;]+/)) {
    const s = line.trim();
    if (!s) continue;
    const d = detectIdentifier(s);
    if (d) ids.push(d);
    else invalid.push(s);
  }
  return { ids, invalid };
}
