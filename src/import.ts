import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import yaml from 'js-yaml';
import { migrateMarkdown, type MigrationDiagnostic } from '@markup-carve/carve';
import { splitFrontMatter } from './frontmatter.js';
import { rewriteLinksToCarve } from './links.js';
import { listMdFiles } from './files.js';

/** OKF-reserved bundle files that are generated, not authored. */
export const RESERVED_FILES = new Set(['index.md', 'log.md']);

export interface ImportOptions {
  /** Also import the reserved `index.md` / `log.md` files. Default false. */
  includeReserved?: boolean;
}

export interface ImportedConcept {
  file: string;
  slug: string;
  /** Import fidelity diagnostics from the Markdown-to-Carve migration. */
  diagnostics: MigrationDiagnostic[];
  /** `.md` link targets not present in the bundle. */
  unresolvedLinks: string[];
}

export interface ImportReport {
  concepts: ImportedConcept[];
}

function carveFrontMatter(meta: Record<string, unknown>): string {
  if (Object.keys(meta).length === 0) return '';
  return `---\n${yaml.dump(meta, { lineWidth: -1 }).trimEnd()}\n---\n\n`;
}

/**
 * Import an OKF bundle back into Carve `.crv` documents (the inverse of
 * {@link exportBundle}), preserving the bundle's directory structure.
 *
 * Each concept's Markdown body is migrated to Carve via the engine's own
 * Markdown importer (CommonMark + GFM), its front matter is re-emitted as a
 * Carve front-matter block, and `.md` links are rewritten to `.crv`. The
 * reserved `index.md` and `log.md` are skipped unless `includeReserved`.
 */
export function importBundle(okfDir: string, outDir: string, opts: ImportOptions = {}): ImportReport {
  mkdirSync(outDir, { recursive: true });
  const all = listMdFiles(okfDir);
  const files = opts.includeReserved ? all : all.filter((f) => !RESERVED_FILES.has(f));
  const mdPaths = new Set(files);

  const concepts: ImportedConcept[] = [];
  for (const file of files) {
    const slug = file.slice(0, -'.md'.length);
    const dir = posix.dirname(file) === '.' ? '' : posix.dirname(file);
    const src = readFileSync(join(okfDir, file), 'utf8');
    const { meta, body } = splitFrontMatter(src);

    const migrated = migrateMarkdown(body);
    const linked = rewriteLinksToCarve(migrated.value, mdPaths, dir);
    const out = `${carveFrontMatter(meta)}${linked.markdown.trim()}\n`;
    const outPath = join(outDir, `${slug}.crv`);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, out, 'utf8');

    concepts.push({
      file,
      slug,
      diagnostics: migrated.report.diagnostics,
      unresolvedLinks: linked.unresolved,
    });
  }
  return { concepts };
}
