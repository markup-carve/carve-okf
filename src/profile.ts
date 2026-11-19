import type { DocumentNode } from '@markup-carve/carve';

/**
 * Target Markdown dialect the bundle must survive in.
 *
 * - `gfm` (default, recommended for OKF): CommonMark plus the widely-supported
 *   GitHub extensions OKF consumers understand - tables, task lists,
 *   strikethrough, footnotes. Denies only the Carve constructs that have no
 *   portable Markdown form.
 * - `commonmark`: strict CommonMark. Also denies the GFM extras above.
 */
export type OkfProfileMode = 'gfm' | 'commonmark';

/**
 * What to do with a disallowed node when the profile is used to transform:
 * `to_text` degrades it to its text content, `strip` removes it.
 */
export type DisallowedAction = 'to_text' | 'strip';

// Carve block node types with no portable Markdown form. `raw_block` is kept: it
// may carry an HTML/format payload the writer reports separately as a loss.
const NON_PORTABLE_BLOCK = [
  'admonition',
  'definition_list',
  'definition_term',
  'definition_description',
  'figure_group',
  'caption',
  'line_block',
  'citation_definition',
  'abbreviation_def',
];

// Carve inline node types with no portable Markdown form. The Markdown writer
// writes each as inline HTML (`<mark>`, `<u>`, `<sup>`, ...) rather than a
// Markdown token, so they do not survive an HTML-sanitizing consumer.
const NON_PORTABLE_INLINE = [
  'underline',
  'highlight',
  'insert',
  'delete',
  'superscript',
  'subscript',
  'small_caps',
  'ruby',
  'span',
  'math',
  'symbol',
  'abbreviation',
  'citation',
  'citation_group',
  'critic_comment',
  'caption_number',
  'xref',
  'mention',
];

// GFM extensions that CommonMark itself lacks.
const GFM_ONLY_BLOCK = ['table', 'table_head', 'table_body', 'table_foot', 'table_row', 'table_cell'];
const GFM_ONLY_INLINE = ['strike', 'footnote_ref', 'inline_footnote'];

export interface OkfProfile {
  readonly mode: OkfProfileMode;
  readonly action: DisallowedAction;
  isTypeAllowed(type: string, block: boolean): boolean;
}

/** A node type the target dialect cannot carry, at its RFC 6901 path in the tree. */
export interface PortabilityViolation {
  nodeType: string;
  reason: 'element_not_allowed';
  reasonDescription: string;
  path?: string;
}

/**
 * Build the portability profile for a target Markdown dialect.
 *
 * Carve 0.2 has no custom profiles (its `profile` option names the four HTML
 * profiles), so the deny lists live here and are checked against the tree.
 */
export function okfProfile(mode: OkfProfileMode = 'gfm', action: DisallowedAction = 'to_text'): OkfProfile {
  const block = new Set(NON_PORTABLE_BLOCK);
  const inline = new Set(NON_PORTABLE_INLINE);
  if (mode === 'commonmark') {
    GFM_ONLY_BLOCK.forEach((t) => block.add(t));
    GFM_ONLY_INLINE.forEach((t) => inline.add(t));
  }
  return {
    mode,
    action,
    isTypeAllowed: (type, isBlock) => !(isBlock ? block : inline).has(type),
  };
}

type Tree = { type: string; [key: string]: unknown };

const INLINE_TYPES = new Set([...NON_PORTABLE_INLINE, ...GFM_ONLY_INLINE]);

function isAllowed(profile: OkfProfile, type: string): boolean {
  return profile.isTypeAllowed(type, !INLINE_TYPES.has(type));
}

function childLists(node: Tree): [string, Tree[]][] {
  const lists: [string, Tree[]][] = [];
  for (const [key, value] of Object.entries(node)) {
    if (key === 'pos' || key === 'attrs' || key === 'data' || key === 'metadata') continue;
    if (Array.isArray(value) && value.every((v) => v && typeof v === 'object' && 'type' in v)) {
      lists.push([key, value as Tree[]]);
    } else if (value && typeof value === 'object' && 'type' in (value as object)) {
      lists.push([key, [value as Tree]]);
    }
  }
  return lists;
}

/** Every node outside the profile, outermost first; nodes inside a denied node are not listed again. */
export function portabilityViolations(tree: DocumentNode, profile: OkfProfile): PortabilityViolation[] {
  const out: PortabilityViolation[] = [];
  const walk = (node: Tree, path: string): void => {
    if (node.type !== 'document' && !isAllowed(profile, node.type)) {
      out.push({
        nodeType: node.type,
        reason: 'element_not_allowed',
        reasonDescription: `${node.type} has no portable ${profile.mode === 'gfm' ? 'GFM' : 'CommonMark'} form`,
        path,
      });
      return;
    }
    for (const [key, list] of childLists(node)) {
      const single = !Array.isArray(node[key]);
      list.forEach((child, i) => walk(child, single ? `${path}/${key}` : `${path}/${key}/${i}`));
    }
  };
  walk(tree as unknown as Tree, '');
  return out;
}

function plainText(node: Tree): string {
  if (typeof node.value === 'string' && node.type !== 'comment') return node.value;
  if (node.type === 'soft_break' || node.type === 'hard_break') return ' ';
  if (typeof node.glyph === 'string') return node.glyph;
  return childLists(node)
    .map(([, list]) => list.map(plainText).join(''))
    .join(' ')
    .replace(/\s+/g, ' ');
}

/**
 * A copy of the tree with every node outside the profile degraded: to its text
 * (an inline node to a `text` node, a block to a paragraph) or removed.
 */
export function degradeTree(tree: DocumentNode, profile: OkfProfile): DocumentNode {
  const rewrite = (list: Tree[], inline: boolean): Tree[] =>
    list.flatMap((node): Tree[] => {
      if (isAllowed(profile, node.type)) return [rewriteNode(node)];
      if (profile.action === 'strip') return [];
      const text = plainText(node).trim();
      if (!text) return [];
      const leaf: Tree = { type: 'text', value: text };
      return [inline ? leaf : { type: 'paragraph', children: [leaf] }];
    });
  const rewriteNode = (node: Tree): Tree => {
    const copy: Tree = { ...node };
    for (const [key, list] of childLists(node)) {
      const inline = list.length > 0 && INLINE_OR_TEXT.has(list[0].type);
      const next = rewrite(list, inline);
      if (Array.isArray(node[key])) copy[key] = next;
      else if (next.length) copy[key] = next[0];
      else delete copy[key];
    }
    return copy;
  };
  return rewriteNode(tree as unknown as Tree) as unknown as DocumentNode;
}

const INLINE_OR_TEXT = new Set([
  ...INLINE_TYPES,
  'text',
  'strong',
  'emphasis',
  'link',
  'image',
  'code',
  'soft_break',
  'hard_break',
  'smart_punctuation',
  'autolink',
  'literal_inline',
  'raw_inline',
  'non_breaking_space',
  'inline_extension',
  'tag',
  'comment',
]);
