import { parse as parseYaml } from 'yaml';

const FM_RE = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/;

/** 先頭の `---` frontmatterブロックを切り出す。無ければ yamlText: null */
export function splitFrontmatter(md: string): { yamlText: string | null; body: string } {
  const text = md.replace(/\r\n/g, '\n');
  const m = FM_RE.exec(text);
  if (!m) return { yamlText: null, body: text };
  return { yamlText: m[1], body: text.slice(m[0].length) };
}

/** YAMLをオブジェクトとしてパース。壊れていても落とさず {} を返す(寛容パース) */
export function parseYamlObject(yamlText: string | null): Record<string, unknown> {
  if (!yamlText) return {};
  try {
    const v = parseYaml(yamlText);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
