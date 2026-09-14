#!/usr/bin/env node
import { formatProfileViolation } from '@markup-carve/carve';
import { exportBundle, type ExportOptions } from './bundle.js';
import { importBundle, type ImportOptions } from './import.js';
import { validateBundle } from './validate.js';
import type { OkfProfileMode } from './profile.js';

const USAGE = `carve-okf - convert between Carve documents and Open Knowledge Format bundles

Usage:
  carve-okf export <input-dir> <output-dir> [options]   Carve .crv -> OKF bundle
  carve-okf import <okf-dir> <output-dir> [options]      OKF bundle -> Carve .crv
  carve-okf validate <okf-dir>                           Check an OKF bundle
  carve-okf <input-dir> <output-dir> [options]           (alias for export)

Export options:
  --mode <gfm|commonmark>   Target Markdown dialect (default: gfm)
  --strict                  Degrade non-portable constructs to text
  --default-type <type>     OKF type injected when a source has none (default: document)
  --no-assets               Do not copy referenced local images
  --report json             Emit the export report as JSON on stdout

Import options:
  --include-reserved        Also import index.md and log.md

Common:
  --quiet                   Suppress the per-file report
  -h, --help                Show this help
`;

const w = (s: string): void => void process.stderr.write(`${s}\n`);

function runExport(argv: string[]): void {
  const positional: string[] = [];
  const opts: ExportOptions = {};
  let quiet = false;
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--strict') opts.strict = true;
    else if (a === '--no-assets') opts.assets = false;
    else if (a === '--quiet') quiet = true;
    else if (a === '--mode') opts.mode = argv[++i] as OkfProfileMode;
    else if (a === '--default-type') opts.defaultType = argv[++i];
    else if (a === '--report') json = argv[++i] === 'json';
    else positional.push(a);
  }
  if (!positional[0] || !positional[1]) {
    process.stderr.write(USAGE);
    process.exitCode = 1;
    return;
  }
  if (opts.mode && opts.mode !== 'gfm' && opts.mode !== 'commonmark') {
    w(`carve-okf: unknown mode '${opts.mode}' (use gfm or commonmark)`);
    process.exitCode = 1;
    return;
  }

  const report = exportBundle(positional[0], positional[1], opts);
  if (json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  if (quiet) return;
  w('=== carve-okf export report ===');
  for (const c of report.concepts) {
    const injected = c.typeInjected ? ' [type injected]' : '';
    w(`\n[${c.file}] -> ${c.slug}.md  (front matter: ${c.frontMatterFormat}; type: ${c.type}${injected})`);
    if (!c.violations.length && !c.losses.length && !c.unresolvedLinks.length && !c.assetsMissing.length && !c.diagrams.length) {
      w('  portable: no non-portable constructs');
    }
    for (const v of c.violations) w(`  - not portable: ${formatProfileViolation(v)}`);
    for (const l of c.losses) w(`  - dropped: ${l.message}`);
    for (const href of c.unresolvedLinks) w(`  - unresolved internal link: ${href}`);
    for (const m of c.assetsMissing) w(`  - missing asset: ${m}`);
    for (const a of c.assetsCopied) w(`  - copied asset: ${a}`);
    for (const d of c.diagrams) w(`  - diagram fence (${d.lang}, line ${d.line}): a plain-Markdown consumer shows the source`);
  }
  w(`\nWrote ${report.concepts.length} concept file(s) + index.md + log.md${report.logIsStub ? ' (log is a stub)' : ''} to ${positional[1]}/`);
}

function runImport(argv: string[]): void {
  const positional: string[] = [];
  const opts: ImportOptions = {};
  let quiet = false;
  for (const a of argv) {
    if (a === '--include-reserved') opts.includeReserved = true;
    else if (a === '--quiet') quiet = true;
    else positional.push(a);
  }
  if (!positional[0] || !positional[1]) {
    process.stderr.write(USAGE);
    process.exitCode = 1;
    return;
  }
  const report = importBundle(positional[0], positional[1], opts);
  if (quiet) return;
  w('=== carve-okf import report ===');
  for (const c of report.concepts) {
    w(`\n[${c.file}] -> ${c.slug}.crv`);
    if (!c.diagnostics.length && !c.unresolvedLinks.length) w('  imported cleanly');
    for (const d of c.diagnostics) w(`  - ${d.fidelity}: ${d.message}`);
    for (const href of c.unresolvedLinks) w(`  - unresolved link: ${href}`);
  }
  w(`\nWrote ${report.concepts.length} Carve file(s) to ${positional[1]}/`);
}

function runValidate(argv: string[]): void {
  const dir = argv.find((a) => !a.startsWith('-'));
  if (!dir) {
    process.stderr.write(USAGE);
    process.exitCode = 1;
    return;
  }
  const report = validateBundle(dir);
  w('=== carve-okf validate ===');
  if (!report.issues.length) w('bundle is valid; no issues');
  for (const i of report.issues) {
    const where = i.file ? `${i.file}: ` : '';
    w(`  ${i.severity}: ${where}${i.message} (${i.code})`);
  }
  const errors = report.issues.filter((i) => i.severity === 'error').length;
  const warnings = report.issues.length - errors;
  w(`\n${errors} error(s), ${warnings} warning(s)`);
  if (!report.ok) process.exitCode = 1;
}

function main(): void {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(USAGE);
    return;
  }
  switch (argv[0]) {
    case 'export':
      return runExport(argv.slice(1));
    case 'import':
      return runImport(argv.slice(1));
    case 'validate':
      return runValidate(argv.slice(1));
    default:
      // Back-compatible bare form: `carve-okf <input> <output> [options]`.
      return runExport(argv);
  }
}

main();
