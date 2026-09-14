// Diagram fences Carve renders to graphics in HTML but that survive into OKF
// Markdown as plain code fences: a plain-Markdown consumer will show the source,
// not the rendered diagram. They are reported, not copied - the content is
// inline, there is no external asset to move.
// Carve's bundled diagram fence presets - it renders these to graphics in HTML,
// but they survive into OKF Markdown as plain code fences, so a plain-Markdown
// consumer shows the source. Kept in sync with the engine's fenced-render set.
const DIAGRAM_LANGS = new Set([
  'mermaid', 'graphviz', 'dot', 'd2', 'plantuml', 'puml',
  'chart', 'vega-lite', 'wavedrom', 'abc',
]);

// A container prefix in rendered Markdown: block-quote markers and list-item
// indentation that can sit in front of a fence (`> ```mermaid`, `  - ` then an
// indented fence). Stripped before measuring the fence's own indent.
const CONTAINER_PREFIX = /^(?:[ \t]*>[ \t]?|[ \t]*(?:[-*+]|\d+[.)])[ \t]+)*/;

export interface DiagramFence {
  lang: string;
  line: number;
}

/**
 * Find diagram fences in rendered Markdown, including fences nested in block
 * quotes and list items. Only opener lines are matched, and a fence is closed
 * within the same container prefix, so a language token inside a block body is
 * not double-counted.
 */
export function findDiagramFences(markdown: string): DiagramFence[] {
  const found: DiagramFence[] = [];
  const lines = markdown.split('\n');
  let open: { char: string; len: number; prefix: string } | null = null;
  lines.forEach((line, i) => {
    const prefix = CONTAINER_PREFIX.exec(line)?.[0] ?? '';
    const rest = line.slice(prefix.length);
    const m = /^ {0,3}(`{3,}|~{3,})[ \t]*([^\s`]*)/.exec(rest);
    if (!m) return;
    const char = m[1][0];
    const len = m[1].length;
    if (open) {
      // A closing fence: same char, at least as long, no info, same container.
      if (char === open.char && len >= open.len && m[2] === '' && prefix === open.prefix) open = null;
      return;
    }
    open = { char, len, prefix };
    const lang = m[2].toLowerCase();
    if (DIAGRAM_LANGS.has(lang)) found.push({ lang, line: i + 1 });
  });
  return found;
}
