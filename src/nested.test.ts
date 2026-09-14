import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exportBundle } from './bundle.js';
import { importBundle } from './import.js';
import { validateBundle } from './validate.js';

let base: string;
let inDir: string;
let outDir: string;

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), 'carve-okf-nested-'));
  inDir = join(base, 'in');
  outDir = join(base, 'out');
  mkdirSync(join(inDir, 'guide'), { recursive: true });
  // Root doc links down into guide/ and references a heading defined there.
  writeFileSync(
    join(inDir, 'index-doc.crv'),
    '---\ntype: guide\n---\n\n# Overview\n\nSee [the intro](guide/intro.crv) and </#Widget-Basics>.\n',
    'utf8',
  );
  // Nested doc links back up and defines the referenced heading.
  writeFileSync(
    join(inDir, 'guide', 'intro.crv'),
    '---\ntype: reference\n---\n\n# Widget Basics\n\nBack to [overview](../index-doc.crv).\n',
    'utf8',
  );
});

afterAll(() => {
  rmSync(base, { recursive: true, force: true });
});

describe('nested bundle export', () => {
  it('preserves directory structure in the output', () => {
    exportBundle(inDir, outDir);
    expect(existsSync(join(outDir, 'index-doc.md'))).toBe(true);
    expect(existsSync(join(outDir, 'guide', 'intro.md'))).toBe(true);
  });

  it('rewrites a link into a subdirectory to a root-relative nested path', () => {
    exportBundle(inDir, outDir);
    const root = readFileSync(join(outDir, 'index-doc.md'), 'utf8');
    expect(root).toContain('[the intro](/guide/intro.md)');
  });

  it('rewrites an up-directory link', () => {
    exportBundle(inDir, outDir);
    const nested = readFileSync(join(outDir, 'guide', 'intro.md'), 'utf8');
    expect(nested).toContain('[overview](/index-doc.md)');
  });

  it('resolves a cross-file heading reference to the defining file', () => {
    exportBundle(inDir, outDir);
    const root = readFileSync(join(outDir, 'index-doc.md'), 'utf8');
    expect(root).toContain('[Widget-Basics](/guide/intro.md#Widget-Basics)');
  });

  it('validates clean and round-trips the structure back to Carve', () => {
    exportBundle(inDir, outDir);
    expect(validateBundle(outDir).ok).toBe(true);
    const crvDir = join(base, 'crv');
    const report = importBundle(outDir, crvDir);
    expect(report.concepts.map((c) => c.slug).sort()).toEqual(['guide/intro', 'index-doc']);
    expect(existsSync(join(crvDir, 'guide', 'intro.crv'))).toBe(true);
  });
});
