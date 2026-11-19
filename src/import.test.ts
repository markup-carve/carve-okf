import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { importBundle } from './import.js';

let base: string;
let okfDir: string;
let outDir: string;

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'carve-okf-import-'));
  okfDir = join(base, 'okf');
  outDir = join(base, 'crv');
  mkdirSync(okfDir, { recursive: true });
  writeFileSync(
    join(okfDir, 'guide.md'),
    '---\ntype: guide\ntitle: Guide\n---\n\n# Guide\n\nText with *italic* and see [terms](/glossary.md).\n',
    'utf8',
  );
  writeFileSync(join(okfDir, 'glossary.md'), '---\ntype: document\n---\n\n# Glossary\n', 'utf8');
  writeFileSync(join(okfDir, 'index.md'), '---\ntype: index\n---\n\n# Index\n', 'utf8');
  writeFileSync(join(okfDir, 'log.md'), '---\ntype: log\n---\n\n# Log\n', 'utf8');
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

describe('importBundle', () => {
  it('skips reserved index.md and log.md by default', () => {
    const report = importBundle(okfDir, outDir);
    const written = readdirSync(outDir).sort();
    expect(written).toEqual(['glossary.crv', 'guide.crv']);
    expect(report.concepts.map((c) => c.slug).sort()).toEqual(['glossary', 'guide']);
  });

  it('includes reserved files when asked', () => {
    importBundle(okfDir, outDir, { includeReserved: true });
    expect(readdirSync(outDir).sort()).toEqual(['glossary.crv', 'guide.crv', 'index.crv', 'log.crv']);
  });

  it('migrates the Markdown body to Carve and preserves front matter', () => {
    importBundle(okfDir, outDir);
    const out = readFileSync(join(outDir, 'guide.crv'), 'utf8');
    expect(out).toContain('type: guide');
    // Markdown *italic* (emphasis) becomes Carve /italic/.
    expect(out).toContain('/italic/');
  });

  // The 0.2 writer spells YAML frontmatter with a bare `---` (C2-W-052); 0.1 wrote `---yaml`.
  it('writes the front matter opener the Carve formatter writes', () => {
    importBundle(okfDir, outDir);
    const out = readFileSync(join(outDir, 'guide.crv'), 'utf8');
    expect(out.startsWith('---\ntype: guide\n')).toBe(true);
  });

  it('rewrites an OKF .md link back to a .crv link', () => {
    importBundle(okfDir, outDir);
    const out = readFileSync(join(outDir, 'guide.crv'), 'utf8');
    expect(out).toContain('[terms](glossary.crv)');
  });
});

describe('importBundle Markdown migration', () => {
  // The 0.2 Markdown importer keeps raw HTML of Markdown, an HTML comment included, as a raw node
  // (carve-js docs/import.md), where 0.1 turned the comment into a Carve comment.
  it('turns a GitHub alert into an admonition and keeps an HTML comment as raw HTML', () => {
    writeFileSync(
      join(okfDir, 'notes.md'),
      '---\ntype: guide\n---\n\n> [!NOTE]\n> Check the keys.\n\n<!-- draft -->\n\nDone.\n',
      'utf8',
    );
    importBundle(okfDir, outDir);
    const out = readFileSync(join(outDir, 'notes.crv'), 'utf8');
    expect(out).toBe('---\ntype: guide\n---\n\n::: note\nCheck the keys.\n:::\n\n```=html\n<!-- draft -->\n```\n\nDone.\n');
  });
});
