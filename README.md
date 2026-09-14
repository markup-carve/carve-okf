# carve-okf

Export [Carve](https://github.com/markup-carve/carve) documents to an Open
Knowledge Format (OKF) bundle: a directory of standard-Markdown concept files
with YAML front matter, a generated `index.md`, and a git-derived `log.md`.

Carve is a rich document markup with constructs Markdown has no portable form for
(admonitions, highlight, underline, sup/sub, definition lists, citations, math).
`carve-okf` renders each document to portable Markdown and reports - from Carve's
own feature profile, not a guess - exactly which constructs do not survive the
trip.

## Install

```bash
npm install -g @markup-carve/carve-okf
```

## CLI

```bash
carve-okf export <input-dir> <output-dir> [options]   # Carve .crv -> OKF bundle
carve-okf import <okf-dir>  <output-dir> [options]     # OKF bundle -> Carve .crv
carve-okf validate <okf-dir>                           # check an OKF bundle
```

The bare form `carve-okf <input-dir> <output-dir>` is an alias for `export`.

Export options:

| Option | Meaning |
| --- | --- |
| `--mode <gfm\|commonmark>` | Target Markdown dialect (default `gfm`). |
| `--strict` | Degrade non-portable constructs to text. Default keeps HTML fallbacks and still reports them. |
| `--default-type <type>` | OKF `type` injected when a source has none (default `document`). |
| `--no-assets` | Do not copy referenced local images into the bundle. |
| `--report json` | Emit the full export report as JSON on stdout. |
| `--quiet` | Suppress the per-file portability report. |

`import` takes `--include-reserved` to also import the generated `index.md` and
`log.md`. Every `.crv` under the input directory becomes `<slug>.md` in the
output, preserving subdirectory structure, alongside a generated `index.md` and
`log.md`.

## Library

```javascript
import { exportBundle, renderBody } from '@markup-carve/carve-okf';

const report = exportBundle('docs', 'okf-out', { mode: 'gfm' });
for (const c of report.concepts) {
  if (c.violations.length) console.warn(c.slug, 'is not fully portable');
}
```

`renderBody(body, opts)` returns `{ markdown, violations }` for a single body,
where `violations` is the engine-backed list of non-portable constructs.

## How portability is decided

Portability is reported from two complementary, engine-backed sources:

1. A Carve **`Profile`** - the same feature-restriction mechanism the engine
   ships - built to deny the node types that have no form in the target dialect.
   Running it over a resolved document yields the structural violation list
   (admonition, highlight, sup/sub, definition list, ...), so the report tracks
   the engine's own vocabulary rather than a heuristic that drifts.
2. The Markdown renderer's own **raw-format loss report**
   (`raw-format-dropped`). The profile deliberately allows raw nodes - a raw
   HTML block passes through Markdown fine - so a raw fence the renderer cannot
   emit (e.g. `{=latex}`) would otherwise be dropped silently. Folding in the
   loss report surfaces exactly those drops.

> [!NOTE]
> `carveToMarkdownWithReport(...).losses` alone is not a full portability
> signal - its only code is `raw-format-dropped`, so it catches raw-fence drops
> but not lossy conversions like an admonition flattened to a paragraph. The
> profile covers those. `carve-okf` uses both.

## Modes

- **`gfm`** (default): CommonMark plus the GitHub extensions OKF consumers
  understand - tables, task lists, strikethrough, footnotes.
- **`commonmark`**: strict CommonMark; the GFM extras above are also treated as
  non-portable.

## What it handles

- YAML (`---`) and TOML (`+++`) front matter, mapped to OKF YAML front matter
  with the required `type` injected when absent. (Carve itself does not parse
  front matter, so `carve-okf` does.)
- Cross-document `foo.crv` links rewritten to root-relative `/foo.md`, with
  unresolved targets reported.
- Local images copied into `assets/` and their paths rewritten.
- A git-derived `log.md` (a generated stub when the input is not under version
  control).

## Limitations

- **Admonition** (`::: note`) has no Markdown form: its callout wrapper is
  dropped (flattened to a paragraph in lenient mode, to text in strict mode). It
  is always reported, never preserved.
- Lenient mode's HTML fallbacks (`<mark>`, `<u>`, `<sup>`) are valid HTML in
  Markdown but will not survive an HTML-sanitizing consumer. Use `--strict` for a
  guaranteed-portable bundle.
- A heading cross-reference resolves to the bundle file that defines the heading
  (`[id](/other.md#id)`), falling back to a same-document anchor when no file
  defines it. Carve's heading anchors preserve case (`#Widget-Basics`), which a
  consumer that auto-slugs to lower case may not match; a `</label>` reference by
  heading text (rather than id) is not resolved.
- Diagram fences (`mermaid`, `graphviz`, `d2`, ...) pass through as code fences
  and are reported: a plain-Markdown OKF consumer shows their source rather than
  a rendered diagram.

## License

MIT
