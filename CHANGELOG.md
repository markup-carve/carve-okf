# Changelog

All notable changes to this project are documented here.

## [0.1.0]

- Initial release: export a directory of Carve `.crv` documents to an Open
  Knowledge Format bundle (concept `.md` files with YAML front matter,
  `index.md`, git-derived `log.md`).
- Reverse import: `carve-okf import` converts an OKF bundle back to Carve
  `.crv` documents, migrating each Markdown body through the engine's own
  Markdown importer and reporting import fidelity.
- Bundle validation: `carve-okf validate` checks an OKF bundle for a required
  `type` on every concept, dangling internal links, and missing reserved files.
- CLI subcommands `export`, `import`, and `validate` (the bare form remains an
  alias for `export`).
- Profile-based portability: non-portable constructs are reported from Carve's
  own feature profile combined with the Markdown renderer's raw-format loss
  report, with `gfm` and `commonmark` target modes.
- Lenient (HTML fallbacks) and `--strict` (degrade to text) rendering.
- YAML and TOML front-matter input, required `type` injection, cross-document
  link rewriting (dot-relative and titled forms), and collision-safe local
  asset copying.
