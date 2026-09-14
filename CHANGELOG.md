# Changelog

All notable changes to this project are documented here.

## [Unreleased]

- Initial release: export a directory of Carve `.crv` documents to an Open
  Knowledge Format bundle (concept `.md` files with YAML front matter,
  `index.md`, git-derived `log.md`).
- Profile-based portability: non-portable constructs are reported from Carve's
  own feature profile, with `gfm` and `commonmark` target modes.
- Lenient (HTML fallbacks) and `--strict` (degrade to text) rendering.
- YAML and TOML front-matter input, required `type` injection, cross-document
  link rewriting, and local asset copying.
