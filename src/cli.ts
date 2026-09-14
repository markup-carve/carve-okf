#!/usr/bin/env node
import { formatProfileViolation } from '@markup-carve/carve';
import { exportBundle, type ExportOptions } from './bundle.js';
import type { OkfProfileMode } from './profile.js';

const USAGE = `carve-okf - export Carve documents to an Open Knowledge Format bundle

Usage:
  carve-okf <input-dir> <output-dir> [options]

Options:
  --mode <gfm|commonmark>   Target Markdown dialect (default: gfm)
  --strict                  Degrade non-portable constructs to text
                            (default: keep HTML fallbacks, still reported)
  --default-type <type>     OKF type injected when a source has none (default: document)
  --no-assets               Do not copy referenced local images
  --quiet                   Suppress the per-file portability report
  -h, --help                Show this help
`;

function parseArgs(argv: string[]): { inDir?: string; outDir?: string; opts: ExportOptions; quiet: boolean; help: boolean } {
  const positional: string[] = [];
  const opts: ExportOptions = {};
  let quiet = false;
  let help = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '-h':
      case '--help':
        help = true;
        break;
      case '--strict':
        opts.strict = true;
        break;
      case '--no-assets':
        opts.assets = false;
        break;
      case '--quiet':
        quiet = true;
        break;
      case '--mode':
        opts.mode = argv[++i] as OkfProfileMode;
        break;
      case '--default-type':
        opts.defaultType = argv[++i];
        break;
      default:
        positional.push(a);
    }
  }
  return { inDir: positional[0], outDir: positional[1], opts, quiet, help };
}

function main(): void {
  const { inDir, outDir, opts, quiet, help } = parseArgs(process.argv.slice(2));
  if (help) {
    process.stdout.write(USAGE);
    return;
  }
  if (!inDir || !outDir) {
    process.stderr.write(USAGE);
    process.exitCode = 1;
    return;
  }
  if (opts.mode && opts.mode !== 'gfm' && opts.mode !== 'commonmark') {
    process.stderr.write(`carve-okf: unknown mode '${opts.mode}' (use gfm or commonmark)\n`);
    process.exitCode = 1;
    return;
  }

  const report = exportBundle(inDir, outDir, opts);
  if (quiet) return;

  const w = (s: string): void => void process.stderr.write(`${s}\n`);
  w('=== carve-okf portability report ===');
  for (const c of report.concepts) {
    const injected = c.typeInjected ? ' [type injected]' : '';
    w(`\n[${c.file}] -> ${c.slug}.md  (front matter: ${c.frontMatterFormat}; type: ${c.type}${injected})`);
    if (!c.violations.length && !c.losses.length && !c.unresolvedLinks.length && !c.assetsMissing.length) {
      w('  portable: no non-portable constructs');
    }
    for (const v of c.violations) w(`  - not portable: ${formatProfileViolation(v)}`);
    for (const l of c.losses) w(`  - dropped: ${l.message}`);
    for (const href of c.unresolvedLinks) w(`  - unresolved internal link: ${href}`);
    for (const m of c.assetsMissing) w(`  - missing asset: ${m}`);
    for (const a of c.assetsCopied) w(`  - copied asset: ${a}`);
  }
  w(`\nWrote ${report.concepts.length} concept file(s) + index.md + log.md${report.logIsStub ? ' (log is a stub)' : ''} to ${outDir}/`);
}

main();
