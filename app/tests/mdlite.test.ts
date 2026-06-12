import { describe, expect, it } from 'vitest';
import { isValidElement, type ReactElement } from 'react';
import { renderInline, renderMarkdownLite } from '../src/lib/mdlite';

const el = (n: unknown): ReactElement => {
  expect(isValidElement(n)).toBe(true);
  return n as ReactElement;
};
type Props = { children?: unknown; href?: string };
const propsOf = (n: unknown): Props => el(n).props as Props;

describe('renderInline', () => {
  it('太字・斜体・コード・リンクをReact要素にする(HTMLは解釈しない)', () => {
    const out = renderInline('a **b** *i* `c` [t](https://x.example/) <script>');
    const types = out.map((n) => (isValidElement(n) ? (n as ReactElement).type : typeof n));
    expect(types).toEqual(['string', 'strong', 'string', 'em', 'string', 'code', 'string', 'a', 'string']);
    const link = out[7];
    expect(propsOf(link).href).toBe('https://x.example/');
    expect(out[8]).toContain('<script>'); // ただの文字列のまま(エスケープはReactが行う)
  });

  it('httpでないリンクはリンク化しない', () => {
    const out = renderInline('[t](javascript:alert(1))');
    expect(out.every((n) => !isValidElement(n))).toBe(true);
  });
});

describe('renderMarkdownLite', () => {
  it('見出し・箇条書き・段落(改行は<br>)をブロック分割する', () => {
    const out = renderMarkdownLite('# 結論\n\n- 速い\n- 安い\n\n本文1行目\n2行目');
    expect(out.map((n) => el(n).type)).toEqual(['h3', 'ul', 'p']);
    const ul = propsOf(out[1]).children as unknown[];
    expect(ul).toHaveLength(2);
    const p = propsOf(out[2]).children as unknown[];
    expect(p.some((n) => isValidElement(n) && (n as ReactElement).type === 'br')).toBe(true);
  });

  it('空文字は空配列', () => {
    expect(renderMarkdownLite('')).toEqual([]);
    expect(renderMarkdownLite('  \n ')).toEqual([]);
  });
});
