import { posix } from 'node:path';
import type { HeadingIndex } from './headings.js';

export interface LinkRewriteResult {
  markdown: string;
  /** Internal `.crv` link targets that no source file in the bundle provides. */
  unresolved: string[];
}

export interface LinkContext {
  /** Bundle-relative POSIX path of the referring file's directory (e.g. `guide`). */
  dir: string;
  /** Map from bundle-relative `.crv` path to output slug. */
  crvToSlug: Map<string, string>;
  /** Bundle-wide heading id -> defining slug index, for cross-file anchors. */
  headingIndex?: HeadingIndex;
  /** The referring concept's own slug, to tell same-file from cross-file anchors. */
  slug?: string;
}

// A Markdown inline link or image destination pointing at a `.crv` file, with an
// optional `#fragment` and an optional `"title"`. The target may be nested
// (`sub/foo.crv`) or dot-relative (`../foo.crv`).
const CRV_LINK_RE = /(!?)\]\(([^)\s]+?\.crv)(#[^)\s"]*)?(\s+"[^"]*")?\)/g;
// A literal heading cross-reference the Markdown renderer left in the text
// because it could not resolve it within this document, e.g. `</#section-id>`.
const HEADING_REF_RE = /<\/#([^>\s]+)>/g;

/** Resolve a link target relative to a bundle directory, as a POSIX bundle path. */
function resolveTarget(dir: string, href: string): string {
  const joined = dir ? posix.join(dir, href) : href;
  return posix.normalize(joined);
}

/**
 * Rewrite internal links for the OKF bundle.
 *
 * `.crv` links (nested, dot-relative, and titled forms) become root-relative
 * `/path.md` links via the bundle's path-to-slug map, resolved relative to the
 * referring file. A `</#id>` heading reference that names a heading in another
 * bundle file becomes a cross-file `[id](/other.md#id)` link; one that resolves
 * nowhere is downgraded to a same-document `#id` anchor. Targets not in the map
 * are left untouched and reported.
 */
export function rewriteLinks(markdown: string, ctx: LinkContext): LinkRewriteResult {
  const unresolved: string[] = [];
  let out = markdown.replace(CRV_LINK_RE, (whole, bang: string, href: string, frag = '', title = '') => {
    const target = resolveTarget(ctx.dir, href);
    const slug = ctx.crvToSlug.get(target);
    if (slug) return `${bang}](/${slug}.md${frag}${title})`;
    unresolved.push(href);
    return whole;
  });
  out = out.replace(HEADING_REF_RE, (_whole, id: string) => {
    const hit = ctx.headingIndex?.get(id.toLowerCase());
    if (hit && hit.slug !== ctx.slug) return `[${hit.id}](/${hit.slug}.md#${hit.id})`;
    return `[${id}](#${id})`;
  });
  return { markdown: out, unresolved };
}

// An OKF-bundle link or image destination pointing at a `.md` file: root-relative
// `/path.md`, bare `path.md`, or dot-relative, nested allowed, with optional
// `#fragment` and `"title"`.
const MD_LINK_RE = /(!?)\]\((\/?)([^)\s"#]+?\.md)(#[^)\s"]*)?(\s+"[^"]*")?\)/g;

/**
 * Rewrite OKF `.md` links back to Carve `.crv` links (the inverse of
 * {@link rewriteLinks}). Root-relative, bare, dot-relative and nested forms map
 * to a `.crv` reference; fragment and title are preserved. Targets not in the
 * bundle are left untouched and reported.
 *
 * @param mdPaths Set of bundle-relative `.md` paths present (e.g. `guide/x.md`).
 * @param dir     The referring file's bundle directory, for relative targets.
 */
export function rewriteLinksToCarve(markdown: string, mdPaths: Set<string>, dir = ''): LinkRewriteResult {
  const unresolved: string[] = [];
  const out = markdown.replace(MD_LINK_RE, (whole, bang: string, rooted: string, file: string, frag = '', title = '') => {
    const target = rooted ? posix.normalize(file) : resolveTarget(dir, file);
    if (!mdPaths.has(target)) {
      unresolved.push(file);
      return whole;
    }
    const carve = `${target.slice(0, -'.md'.length)}.crv`;
    // Carve cross-references are relative to the referring file, so a link
    // round-trips to a bare `foo.crv` at the root and a relative `../foo.crv`
    // across directories, regardless of the OKF link's rooted or relative form.
    const ref = posix.relative(dir, carve) || carve;
    return `${bang}](${ref}${frag}${title})`;
  });
  return { markdown: out, unresolved };
}
