import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exportBundle } from './bundle.js';

let inDir: string;
let outDir: string;

beforeAll(() => {
  const base = mkdtempSync(join(tmpdir(), 'carve-okf-test-'));
  inDir = join(base, 'in');
  outDir = join(base, 'out');
  mkdirSync(inDir, { recursive: true });
  writeFileSync(
    join(inDir, 'guide.crv'),
    '---\ntitle: Guide\ntype: guide\n---\n\n# Guide\n\nSee [terms](glossary.crv).\n',
    'utf8',
  );
  writeFileSync(
    join(inDir, 'glossary.crv'),
    '+++\ntitle = "Glossary"\n+++\n\n# Glossary\n\nA =term= here.\n',
    'utf8',
  );
});

afterAll(() => {
  rmSync(join(inDir, '..'), { recursive: true, force: true });
});

describe('exportBundle', () => {
  it('emits a concept file, index.md and log.md per bundle', () => {
    const report = exportBundle(inDir, outDir);
    expect(report.concepts.map((c) => c.slug).sort()).toEqual(['glossary', 'guide']);
    expect(readFileSync(join(outDir, 'index.md'), 'utf8')).toContain('# Index');
    expect(readFileSync(join(outDir, 'log.md'), 'utf8')).toContain('# Log');
  });

  it('injects the required type when a source has none and keeps an explicit one', () => {
    const report = exportBundle(inDir, outDir, { defaultType: 'document' });
    const guide = report.concepts.find((c) => c.slug === 'guide')!;
    const glossary = report.concepts.find((c) => c.slug === 'glossary')!;
    expect(guide.type).toBe('guide');
    expect(guide.typeInjected).toBe(false);
    expect(glossary.type).toBe('document');
    expect(glossary.typeInjected).toBe(true);
  });

  it('converts TOML front matter to YAML in the output', () => {
    exportBundle(inDir, outDir);
    const out = readFileSync(join(outDir, 'glossary.md'), 'utf8');
    expect(out.startsWith('---\n')).toBe(true);
    expect(out).toContain('title: Glossary');
    expect(out).toContain('type: document');
    expect(out).not.toContain('+++');
  });

  it('rewrites a cross-document link to the sibling .md file', () => {
    exportBundle(inDir, outDir);
    const out = readFileSync(join(outDir, 'guide.md'), 'utf8');
    expect(out).toContain('[terms](/glossary.md)');
  });

  it('reports the =highlight= construct as non-portable', () => {
    const report = exportBundle(inDir, outDir);
    const glossary = report.concepts.find((c) => c.slug === 'glossary')!;
    expect(glossary.violations.some((v) => v.nodeType === 'highlight')).toBe(true);
  });
});

describe('exportBundle with Carve format-token front matter', () => {
  it('maps a ---toml block into the OKF header and keeps it out of the body', () => {
    const base = mkdtempSync(join(tmpdir(), 'carve-okf-token-'));
    const src = join(base, 'in');
    const dest = join(base, 'out');
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, 'widget.crv'), '---toml\ntitle = "Widget"\ntype = "guide"\n---\n\n# Widget\n', 'utf8');
    try {
      const report = exportBundle(src, dest);
      expect(report.concepts[0].type).toBe('guide');
      expect(report.concepts[0].frontMatterFormat).toBe('toml');
      const out = readFileSync(join(dest, 'widget.md'), 'utf8');
      expect(out).toBe('---\ntype: guide\ntitle: Widget\n---\n\n# Widget\n');
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});
