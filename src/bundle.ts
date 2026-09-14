import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import yaml from 'js-yaml';
import type { ProfileViolation, RenderLoss } from '@markup-carve/carve';
import { splitFrontMatter, type FrontMatterFormat } from './frontmatter.js';
import { renderBody } from './render.js';
import { rewriteLinks } from './links.js';
import { copyAssets, createAssetRegistry } from './assets.js';
import { gitLog } from './log.js';
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

/** Export a directory of `.crv` files into an OKF bundle at `outDir`. */
export function exportBundle(inDir: string, outDir: string, opts: ExportOptions = {}): ExportReport {
  const defaultType = opts.defaultType ?? 'document';
  const withAssets = opts.assets ?? true;
  mkdirSync(outDir, { recursive: true });

  const files = readdirSync(inDir)
    .filter((f) => f.endsWith('.crv'))
    .sort();
  const crvToSlug = new Map(files.map((f) => [f, basename(f, '.crv')]));
  const assetRegistry = createAssetRegistry();

  const concepts: ConceptReport[] = [];
  for (const file of files) {
    const slug = basename(file, '.crv');
    const src = readFileSync(join(inDir, file), 'utf8');
    const { meta, format, body } = splitFrontMatter(src);

    const rendered = renderBody(body, { mode: opts.mode, strict: opts.strict });
    const linked = rewriteLinks(rendered.markdown, crvToSlug);
    const asset = withAssets
      ? copyAssets(linked.markdown, inDir, outDir, assetRegistry)
      : { markdown: linked.markdown, copied: [], missing: [] };

    const { fm, injected } = conceptFrontMatter(meta, defaultType);
    const out = `${renderFrontMatter(fm)}\n${asset.markdown.trimEnd()}\n`;
    writeFileSync(join(outDir, `${slug}.md`), out, 'utf8');

    concepts.push({
      file,
      slug,
      type: String(fm.type),
      typeInjected: injected,
      frontMatterFormat: format,
      violations: rendered.violations,
      losses: rendered.losses,
      unresolvedLinks: linked.unresolved,
      assetsCopied: asset.copied,
      assetsMissing: asset.missing,
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
