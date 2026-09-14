# Changelog

All notable changes to this project are documented here.

## [0.1.0]

- Initial release: export a directory of Carve `.crv` documents to an Open
  Knowledge Format bundle (concept `.md` files with YAML front matter,
  `index.md`, git-derived `log.md`).
- Profile-based portability: non-portable constructs are reported from Carve's
  own feature profile combined with the Markdown renderer's raw-format loss
  report, with `gfm` and `commonmark` target modes.
- Lenient (HTML fallbacks) and `--strict` (degrade to text) rendering.
- YAML and TOML front-matter input, required `type` injection, cross-document
  link rewriting (dot-relative and titled forms), and collision-safe local
  asset copying.
