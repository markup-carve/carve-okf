export interface LinkRewriteResult {
  markdown: string;
  /** Internal `.crv` link targets that no source file in the bundle provides. */
  unresolved: string[];
}

// A Markdown inline link or image destination pointing at a `.crv` file, with an
// optional `#fragment` and an optional `"title"`. Captures the leading `!`
// (image), the target, the fragment, and the title so all are preserved.
const CRV_LINK_RE = /(!?)\]\(([^)\s]+?\.crv)(#[^)\s"]*)?(\s+"[^"]*")?\)/g;
// A literal heading cross-reference the Markdown renderer left in the text
// because it could not resolve it to a link, e.g. `</#section-id>`.
const HEADING_REF_RE = /<\/#([^>\s]+)>/g;

/** Normalize a relative link target for lookup: drop a leading `./`. */
function normalizeTarget(href: string): string {
  return href.replace(/^\.\//, '');
}

/**
 * Rewrite internal links for the OKF bundle.
 *
 * `foo.crv` links (including `./foo.crv` and titled `foo.crv "T"` forms) become
 * root-relative `/foo.md` links using the bundle's source-to-output slug map,
 * and unresolved `</#id>` heading references are downgraded to plain `#id`
 * anchors. Targets not in the map are left untouched and reported.
 *
 * @param crvToSlug Map from source `.crv` basename to output slug (no extension).
 */
export function rewriteLinks(markdown: string, crvToSlug: Map<string, string>): LinkRewriteResult {
  const unresolved: string[] = [];
  let out = markdown.replace(CRV_LINK_RE, (whole, bang: string, href: string, frag = '', title = '') => {
    const slug = crvToSlug.get(normalizeTarget(href));
    if (slug) return `${bang}](/${slug}.md${frag}${title})`;
    unresolved.push(href);
    return whole;
  });
  out = out.replace(HEADING_REF_RE, (_whole, id: string) => `[${id}](#${id})`);
  return { markdown: out, unresolved };
}

// An OKF-bundle link or image destination pointing at a `.md` file: root-relative
// `/foo.md`, bare `foo.md`, or `./foo.md`, with optional `#fragment` and `"title"`.
const MD_LINK_RE = /(!?)\]\((\.?\/)?([^)\s/]+?\.md)(#[^)\s"]*)?(\s+"[^"]*")?\)/g;

/**
 * Rewrite OKF `.md` links back to Carve `.crv` links (the inverse of
 * {@link rewriteLinks}). Root-relative, bare, and dot-relative forms all map to
 * a plain `foo.crv` reference; fragment and title are preserved. Targets not in
 * the bundle are left untouched and reported.
 *
 * @param mdSlugs Set of `.md` basenames present in the bundle (e.g. `foo.md`).
 */
export function rewriteLinksToCarve(markdown: string, mdSlugs: Set<string>): LinkRewriteResult {
  const unresolved: string[] = [];
  const out = markdown.replace(MD_LINK_RE, (whole, bang: string, _prefix = '', file: string, frag = '', title = '') => {
    if (!mdSlugs.has(file)) {
      unresolved.push(file);
      return whole;
    }
    const slug = file.slice(0, -'.md'.length);
    return `${bang}](${slug}.crv${frag}${title})`;
  });
  return { markdown: out, unresolved };
}
