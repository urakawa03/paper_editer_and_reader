import type { ReactNode } from 'react';

// メモ(Notes)の軽量Markdown表示(SP)。
// 対応: # 見出し / - 箇条書き / **太字** / *斜体* / `コード` / [リンク](https://…)。
// HTMLは一切解釈せずReact要素のみを生成する(XSS安全)。

const INLINE_RE = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;

export function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let i = 0;
  for (const part of text.split(INLINE_RE)) {
    if (!part) continue;
    const key = i++;
    if (part.startsWith('**') && part.endsWith('**')) {
      out.push(<strong key={key}>{part.slice(2, -2)}</strong>);
    } else if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      out.push(<em key={key}>{part.slice(1, -1)}</em>);
    } else if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      out.push(<code key={key}>{part.slice(1, -1)}</code>);
    } else {
      const m = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(part);
      if (m) {
        out.push(
          <a key={key} href={m[2]} target="_blank" rel="noreferrer">
            {m[1]}
          </a>,
        );
      } else {
        out.push(part);
      }
    }
  }
  return out;
}

/** 段落内の単一改行は<br>に変換して行構造を保つ */
function paragraph(lines: string[], key: number): ReactNode {
  const nodes: ReactNode[] = [];
  lines.forEach((line, i) => {
    if (i > 0) nodes.push(<br key={`b${i}`} />);
    nodes.push(...renderInline(line));
  });
  return <p key={key}>{nodes}</p>;
}

export function renderMarkdownLite(text: string): ReactNode[] {
  const blocks = text.replace(/\r\n/g, '\n').trim().split(/\n{2,}/);
  const out: ReactNode[] = [];
  let key = 0;
  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim() !== '');
    if (lines.length === 0) continue;
    const h = /^(#{1,3})\s+(.*)$/.exec(lines[0]);
    if (h && lines.length === 1) {
      const level = h[1].length;
      const content = renderInline(h[2]);
      out.push(
        level === 1 ? <h3 key={key++}>{content}</h3>
        : level === 2 ? <h4 key={key++}>{content}</h4>
        : <h5 key={key++}>{content}</h5>,
      );
    } else if (lines.every((l) => /^[-*]\s+/.test(l.trim()))) {
      out.push(
        <ul key={key++}>
          {lines.map((l, i) => (
            <li key={i}>{renderInline(l.trim().replace(/^[-*]\s+/, ''))}</li>
          ))}
        </ul>,
      );
    } else {
      out.push(paragraph(lines, key++));
    }
  }
  return out;
}
