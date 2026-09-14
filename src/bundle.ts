import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import yaml from 'js-yaml';
import type { ProfileViolation, RenderLoss } from '@markup-carve/carve';
import { splitFrontMatter, type FrontMatterFormat } from './frontmatter.js';
import { renderBody } from './render.js';
import { rewriteLinks } from './links.js';
import { copyAssets, createAssetRegistry } from './assets.js';
import { gitLog } from './log.js';
import { listCrvFiles } from './files.js';
import { headingIds, buildHeadingIndex } from './headings.js';
import { findDiagramFences, type DiagramFence } from './diagrams.js';
import type { OkfProfileMode } from './profile.js';

export interface ExportOptions {
  /** Target Markdown dialect. Default `gfm`. */
  mode?: OkfProfileMode;
  /** Degrade non-portable constructs to text instead of keeping HTML fallbacks. */
  strict?: boolean;
  /** OKF `type` to inject when a source has none. Default `document`. */
  defaultType?: string;
  /** Copy referenced local images into the bundle. Default true. */
  assets?: boolean;
}

export interface ConceptReport {
  file: string;
  slug: string;
  type: string;
  typeInjected: boolean;
  frontMatterFormat: FrontMatterFormat;
  violations: ProfileViolation[];
  /** Raw-format fences the renderer could not emit and dropped. */
  losses: RenderLoss[];
  unresolvedLinks: string[];
  assetsCopied: string[];
  assetsMissing: string[];
  /** Diagram fences that survive as source in plain-Markdown consumers. */
  diagrams: DiagramFence[];
}

export interface ExportReport {
  concepts: ConceptReport[];
  /** True when `log.md` is a generated stub (no git history for the input dir). */
  logIsStub: boolean;
}

const OKF_PASSTHROUGH_KEYS = ['lang', 'author'];

function conceptFrontMatter(meta: Record<string, unknown>, defaultType: string): { fm: Record<string, unknown>; injected: boolean } {
  const injected = meta.type == null;
  const fm: Record<string, unknown> = { type: injected ? defaultType : meta.type };
  if (meta.title != null) fm.title = meta.title;
  if (meta.description != null) fm.description = meta.description;
  if (meta.tags != null) fm.tags = meta.tags;
  for (const k of OKF_PASSTHROUGH_KEYS) if (meta[k] != null) fm[k] = meta[k];
  return { fm, injected };
}

function renderFrontMatter(fm: Record<string, unknown>): string {
  return `---\n${yaml.dump(fm, { lineWidth: -1 }).trimEnd()}\n---\n`;
}

interface Parsed {
  file: string;
  slug: string;
  dir: string;
  meta: Record<string, unknown>;
  format: FrontMatterFormat;
  body: string;
}

/** Export a directory tree of `.crv` files into an OKF bundle at `outDir`. */
export function exportBundle(inDir: string, outDir: string, opts: ExportOptions = {}): ExportReport {
  const defaultType = opts.defaultType ?? 'document';
  const withAssets = opts.assets ?? true;
  mkdirSync(outDir, { recursive: true });

  // Pass 1: parse every file and index slugs + heading anchors bundle-wide.
  const files = listCrvFiles(inDir);
  const parsed: Parsed[] = files.map((file) => {
    const slug = file.slice(0, -'.crv'.length);
    const src = readFileSync(join(inDir, file), 'utf8');
    const { meta, format, body } = splitFrontMatter(src);
    return { file, slug, dir: posix.dirname(file) === '.' ? '' : posix.dirname(file), meta, format, body };
  });
  const crvToSlug = new Map(parsed.map((p) => [p.file, p.slug]));
  const headingIndex = buildHeadingIndex(parsed.map((p) => ({ slug: p.slug, ids: headingIds(p.body) })));
  const assetRegistry = createAssetRegistry();

  // Pass 2: render, rewrite links, copy assets, write output preserving structure.
  const concepts: ConceptReport[] = [];
  for (const p of parsed) {
    const rendered = renderBody(p.body, { mode: opts.mode, strict: opts.strict });
    const linked = rewriteLinks(rendered.markdown, { dir: p.dir, crvToSlug, headingIndex, slug: p.slug });
    const asset = withAssets
      ? copyAssets(linked.markdown, join(inDir, p.dir), outDir, assetRegistry)
      : { markdown: linked.markdown, copied: [], missing: [] };

    const { fm, injected } = conceptFrontMatter(p.meta, defaultType);
    const out = `${renderFrontMatter(fm)}\n${asset.markdown.trimEnd()}\n`;
    const outPath = join(outDir, `${p.slug}.md`);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, out, 'utf8');

    concepts.push({
      file: p.file,
      slug: p.slug,
      type: String(fm.type),
      typeInjected: injected,
      frontMatterFormat: p.format,
      violations: rendered.violations,
      losses: rendered.losses,
      unresolvedLinks: linked.unresolved,
      assetsCopied: asset.copied,
      assetsMissing: asset.missing,
      diagrams: findDiagramFences(asset.markdown),
    });
  }

  writeIndex(outDir, concepts);
  const logIsStub = writeLog(outDir, inDir, concepts.length);
  return { concepts, logIsStub };
}

function writeIndex(outDir: string, concepts: ConceptReport[]): void {
  const rows = concepts
    .map((c) => `- [${c.slug}](/${c.slug}.md)`)
    .join('\n');
  const doc = `${renderFrontMatter({ type: 'index', title: 'Bundle Index' })}\n# Index\n\n${rows}\n`;
  writeFileSync(join(outDir, 'index.md'), doc, 'utf8');
}

function writeLog(outDir: string, inDir: string, count: number): boolean {
  const entries = gitLog(inDir);
  let body: string;
  let stub: boolean;
  if (entries.length) {
    body = entries.map((e) => `- ${e.date} \`${e.hash}\` ${e.subject}`).join('\n');
    stub = false;
  } else {
    body = `- ${new Date().toISOString()} generated bundle from ${count} Carve source file(s) (no VCS history available)`;
    stub = true;
  }
  const doc = `${renderFrontMatter({ type: 'log', title: 'Update Log' })}\n# Log\n\n${body}\n`;
  writeFileSync(join(outDir, 'log.md'), doc, 'utf8');
  return stub;
}
