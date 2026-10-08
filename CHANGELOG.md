# Changelog

All notable changes to this project are documented here.

## [Unreleased]

## [0.1.0] - 2026-09-20

- Initial release: export a directory of Carve `.crv` documents to an Open
  Knowledge Format bundle (concept `.md` files with YAML front matter,
  `index.md`, git-derived `log.md`).
- Nested input directories are walked recursively and their structure is
  preserved in the bundle (and on import back to Carve) (#3).
- A heading cross-reference resolves to the bundle file that defines the
  heading (`[id](/other.md#id)`), falling back to a same-document anchor (#3).
- A heading reference is compared against the id exactly, so a case-only
  difference no longer resolves to another file's anchor (#9).
- Diagram fences (`mermaid`, `graphviz`, `d2`, ...) are detected and reported
  as source that a plain-Markdown consumer will not render (#3).
- `carve-okf export --report json` emits the full export report as JSON (#3).
- Reverse import: `carve-okf import` converts an OKF bundle back to Carve
  `.crv` documents, migrating each Markdown body through the engine's own
  Markdown importer and reporting import fidelity (#2).
- Bundle validation: `carve-okf validate` checks an OKF bundle for a required
  `type` on every concept, dangling internal links, and missing reserved files
  (#2).
- CLI subcommands `export`, `import`, and `validate` (the bare form remains an
  alias for `export`) (#2).
- Profile-based portability: non-portable constructs are reported from Carve's
  own feature profile combined with the Markdown renderer's raw-format loss
  report, with `gfm` and `commonmark` target modes.
- Lenient (HTML fallbacks) and `--strict` (degrade to text) rendering.
- YAML and TOML front-matter input, required `type` injection, cross-document
  link rewriting (dot-relative and titled forms), and collision-safe local
  asset copying.
