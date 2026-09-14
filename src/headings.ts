import { carveToHtml } from '@markup-carve/carve';

// Carve wraps each heading in a `<section id="...">`; the id is Carve's
// canonical heading anchor (case-preserved, punctuation stripped, spaces to
// hyphens). This reads those ids straight from the engine rather than
// reimplementing the slug algorithm.
const SECTION_ID_RE = /<section id="([^"]+)">/g;

/**
 * Extract the set of heading anchor ids Carve assigns to a document body.
 *
 * @param body Carve source (front matter already removed).
 */
export function headingIds(body: string): string[] {
  const html = carveToHtml(body);
  const ids: string[] = [];
  for (const m of html.matchAll(SECTION_ID_RE)) ids.push(m[1]);
  return ids;
}

/**
 * A bundle-wide index from a lower-cased heading id to the concept slug that
 * defines it. Carve resolves heading references case-insensitively, so the key
 * is lower-cased; the first definer wins on a collision.
 */
export type HeadingIndex = Map<string, { slug: string; id: string }>;

export function buildHeadingIndex(entries: { slug: string; ids: string[] }[]): HeadingIndex {
  const index: HeadingIndex = new Map();
  for (const { slug, ids } of entries) {
    for (const id of ids) {
      const key = id.toLowerCase();
      if (!index.has(key)) index.set(key, { slug, id });
    }
  }
  return index;
}
