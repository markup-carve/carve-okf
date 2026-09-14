import { Profile, type DisallowedAction } from '@markup-carve/carve';

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

// Carve block node types with no portable Markdown form. `raw_block` is kept: it
// may carry an HTML/format payload the renderer reports separately via its
// raw-format loss report.
const NON_PORTABLE_BLOCK = [
  'admonition',
  'definition_list',
  'definition_term',
  'definition_description',
  'figure',
  'figure_group',
  'caption',
  'line_block',
  'citation_definition',
  'abbreviation_def',
];

// Carve inline node types with no portable Markdown form. Carve renders each of
// these to a raw HTML fallback (`<mark>`, `<u>`, `<sup>`, ...) rather than a
// Markdown token, so they do not survive an HTML-sanitizing consumer.
const NON_PORTABLE_INLINE = [
  'underline',
  'highlight',
  'insert',
  'delete',
  'superscript',
  'subscript',
  'span',
  'math',
  'symbol',
  'abbreviation',
  'citation',
  'citation_group',
  'critic_comment',
  'caption_number',
  'heading_ref',
  'substitution',
  'mention',
];

// GFM extensions that CommonMark itself lacks.
const GFM_ONLY_BLOCK = ['table', 'table_row', 'table_cell'];
const GFM_ONLY_INLINE = ['strike', 'footnote_ref', 'inline_footnote'];

/**
 * Build the portability profile for a target Markdown dialect.
 *
 * Applying it to a resolved document yields a `violations` list - the real,
 * engine-backed contract for "what will not survive as Markdown". This replaces
 * an AST type-walk heuristic: Carve's own `Profile` is the source of truth for
 * which node types are portable.
 *
 * @param mode   Target dialect.
 * @param action What to do with a disallowed node when the profile is used to
 *               transform (not just detect). `to_text` degrades it to its text
 *               content; `strip` removes it; `error` throws.
 */
export function okfProfile(mode: OkfProfileMode = 'gfm', action: DisallowedAction = 'to_text'): Profile {
  const deniedBlock = [...NON_PORTABLE_BLOCK];
  const deniedInline = [...NON_PORTABLE_INLINE];
  if (mode === 'commonmark') {
    deniedBlock.push(...GFM_ONLY_BLOCK);
    deniedInline.push(...GFM_ONLY_INLINE);
  }
  return Profile.full().denyBlock(deniedBlock).denyInline(deniedInline).onDisallowed(action);
}
