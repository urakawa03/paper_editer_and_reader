import type { RefEntry } from '../types';
import { detectIdentifier } from './identifiers';

// 制約付きBibTeXパーサ(§4):
//  - @type{key, field = {…} | "…" | 123 | macro # "…"} に対応
//  - @comment / @preamble はスキップ、@string はマクロとして解決
//  - 値の波括弧ネスト・引用符内波括弧に対応
//  - よく使うLaTeXアクセントの変換と波括弧除去
// 壊れたエントリはスキップして続行する(§4.5)

const ACCENTS: Record<string, string> = {
  "\\'a": 'á', "\\'e": 'é', "\\'i": 'í', "\\'o": 'ó', "\\'u": 'ú', "\\'y": 'ý', "\\'c": 'ć', "\\'n": 'ń', "\\'s": 'ś', "\\'z": 'ź',
  "\\'A": 'Á', "\\'E": 'É', "\\'I": 'Í', "\\'O": 'Ó', "\\'U": 'Ú',
  '\\`a': 'à', '\\`e': 'è', '\\`i': 'ì', '\\`o': 'ò', '\\`u': 'ù',
  '\\"a': 'ä', '\\"e': 'ë', '\\"i': 'ï', '\\"o': 'ö', '\\"u': 'ü', '\\"y': 'ÿ',
  '\\"A': 'Ä', '\\"O': 'Ö', '\\"U': 'Ü',
  '\\^a': 'â', '\\^e': 'ê', '\\^i': 'î', '\\^o': 'ô', '\\^u': 'û',
  '\\~a': 'ã', '\\~n': 'ñ', '\\~o': 'õ',
  '\\c c': 'ç', '\\c{c}': 'ç', '\\v s': 'š', '\\v{s}': 'š', '\\v c': 'č', '\\v{c}': 'č', '\\v z': 'ž', '\\v{z}': 'ž',
  '\\o': 'ø', '\\O': 'Ø', '\\l': 'ł', '\\L': 'Ł', '\\ss': 'ß', '\\ae': 'æ', '\\AE': 'Æ', '\\aa': 'å', '\\AA': 'Å',
  '\\&': '&', '\\%': '%', '\\_': '_', '\\$': '$', '\\#': '#',
  '---': '—', '--': '–', '~': ' ',
};

/** LaTeX混じりのBibTeX値をプレーンテキスト化 */
export function latexToText(s: string): string {
  let t = s;
  // \'{e} → \'e に揃えてからテーブル変換
  t = t.replace(/\\(['"`^~])\{(\w)\}/g, '\\$1$2');
  for (const [k, v] of Object.entries(ACCENTS)) t = t.split(k).join(v);
  t = t.replace(/\\(?:emph|textbf|textit|texttt|textsc|mathrm|mbox|text)\b/g, '');
  t = t.replace(/\\[a-zA-Z]+\s*/g, ' '); // 未知コマンドは除去
  t = t.replace(/[{}]/g, '');
  return t.replace(/[ \t]+/g, ' ').trim();
}

interface RawField {
  [name: string]: string;
}

class Scanner {
  pos = 0;
  constructor(public src: string) {}
  eof(): boolean {
    return this.pos >= this.src.length;
  }
  peek(): string {
    return this.src[this.pos] ?? '';
  }
  skipWs(): void {
    while (!this.eof() && /\s/.test(this.peek())) this.pos++;
  }
  /** 波括弧のバランスを取りつつ読む。開始 { の次から呼び、対応する } の後で止まる */
  readBraced(): string {
    let depth = 1;
    const start = this.pos;
    while (!this.eof()) {
      const c = this.src[this.pos];
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) return this.src.slice(start, this.pos++);
      }
      this.pos++;
    }
    throw new Error('unbalanced braces');
  }
  readQuoted(): string {
    const start = this.pos;
    let depth = 0;
    while (!this.eof()) {
      const c = this.src[this.pos];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '"' && depth === 0) return this.src.slice(start, this.pos++);
      this.pos++;
    }
    throw new Error('unterminated quote');
  }
  readBareWord(): string {
    const start = this.pos;
    while (!this.eof() && /[^\s,#}={"]/.test(this.peek())) this.pos++;
    return this.src.slice(start, this.pos);
  }
}

function readValue(sc: Scanner, macros: Map<string, string>): string {
  const parts: string[] = [];
  for (;;) {
    sc.skipWs();
    const c = sc.peek();
    if (c === '{') {
      sc.pos++;
      parts.push(sc.readBraced());
    } else if (c === '"') {
      sc.pos++;
      parts.push(sc.readQuoted());
    } else {
      const word = sc.readBareWord();
      if (!word) break;
      parts.push(macros.get(word.toLowerCase()) ?? word);
    }
    sc.skipWs();
    if (sc.peek() === '#') {
      sc.pos++;
      continue; // 連結
    }
    break;
  }
  return parts.join('');
}

function parseFields(sc: Scanner, macros: Map<string, string>): RawField {
  const fields: RawField = {};
  for (;;) {
    sc.skipWs();
    if (sc.peek() === '}' || sc.eof()) {
      if (sc.peek() === '}') sc.pos++;
      break;
    }
    if (sc.peek() === ',') {
      sc.pos++;
      continue;
    }
    const name = sc.readBareWord().toLowerCase();
    sc.skipWs();
    if (sc.peek() !== '=') {
      if (!name) break;
      continue;
    }
    sc.pos++; // '='
    fields[name] = readValue(sc, macros);
  }
  return fields;
}

function parseEntryBody(sc: Scanner, macros: Map<string, string>): { key: string; fields: RawField } {
  sc.skipWs();
  const key = sc.readBareWord().replace(/,$/, '');
  sc.skipWs();
  if (sc.peek() === ',') sc.pos++;
  return { key, fields: parseFields(sc, macros) };
}

function splitAuthors(authorField: string): string[] {
  return authorField
    .split(/\s+and\s+/i)
    .map((a) => latexToText(a))
    .filter((a) => a && a.toLowerCase() !== 'others');
}

function toRefEntry(key: string, type: string, f: RawField): RefEntry | null {
  if (!f.title && !f.doi) return null;
  const doiRaw = f.doi?.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').trim();
  let arxivId: string | undefined;
  const eprintType = (f.archiveprefix ?? f.eprinttype ?? '').toLowerCase();
  if (f.eprint && (eprintType === 'arxiv' || !eprintType)) {
    const d = detectIdentifier(f.eprint);
    if (d?.kind === 'arxiv') arxivId = d.value;
  }
  if (!arxivId && f.url) {
    const d = detectIdentifier(f.url);
    if (d?.kind === 'arxiv') arxivId = d.value;
  }
  const yearNum = f.year ? Number(/\d{4}/.exec(f.year)?.[0]) : undefined;
  return {
    citekey: key || undefined,
    title: f.title ? latexToText(f.title) : undefined,
    authors: f.author ? splitAuthors(f.author) : [],
    year: Number.isFinite(yearNum) ? yearNum : undefined,
    venue: latexToText(f.journal ?? f.booktitle ?? (type === 'phdthesis' || type === 'mastersthesis' ? (f.school ?? '') : '')) || undefined,
    doi: doiRaw || undefined,
    url: f.url?.trim() || undefined,
    abstract: f.abstract ? latexToText(f.abstract) : undefined,
    arxivId,
  };
}

/** BibTeXテキスト(複数エントリ可)をパース。壊れたエントリはスキップして続行する */
export function parseBibtex(text: string): RefEntry[] {
  // 行頭%コメント除去(URL中の%は保持)
  const src = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((l) => !/^\s*%/.test(l))
    .join('\n');

  const out: RefEntry[] = [];
  const macros = new Map<string, string>();
  let i = 0;
  while ((i = src.indexOf('@', i)) !== -1) {
    const sc = new Scanner(src);
    sc.pos = i + 1;
    const typeMatch = /^([a-zA-Z]+)\s*([{(])/.exec(src.slice(sc.pos));
    if (!typeMatch) {
      i++;
      continue;
    }
    const type = typeMatch[1].toLowerCase();
    sc.pos += typeMatch[0].length;
    try {
      if (type === 'comment' || type === 'preamble') {
        sc.readBraced(); // 中身を読み飛ばす
      } else if (type === 'string') {
        // @string{name = "value", ...} は citekey を持たないフィールド列
        const fields = parseFields(sc, macros);
        for (const [k, v] of Object.entries(fields)) macros.set(k.toLowerCase(), v);
      } else {
        const { key, fields } = parseEntryBody(sc, macros);
        const entry = toRefEntry(key, type, fields);
        if (entry) {
          out.push(entry);
        } else {
          // 使えるフィールドが無い=壊れている可能性: 次のエントリを飲み込まないよう直後から再走査
          i++;
          continue;
        }
      }
      i = sc.pos;
    } catch {
      i++; // 壊れたエントリ: 次の @ から再開
    }
  }
  return out;
}
