import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateBundle } from './validate.js';

let dir: string;

function write(name: string, content: string): void {
  writeFileSync(join(dir, name), content, 'utf8');
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'carve-okf-validate-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('validateBundle', () => {
  it('passes a well-formed bundle', () => {
    write('index.md', '---\ntype: index\n---\n# Index\n');
    write('log.md', '---\ntype: log\n---\n# Log\n');
    write('a.md', '---\ntype: doc\n---\nSee [b](/b.md).\n');
    write('b.md', '---\ntype: doc\n---\nBody.\n');
    const r = validateBundle(dir);
    expect(r.ok).toBe(true);
    expect(r.issues).toEqual([]);
  });

  it('errors on a concept file missing the required type', () => {
    write('index.md', '---\ntype: index\n---\n');
    write('log.md', '---\ntype: log\n---\n');
    write('a.md', '---\ntitle: No Type\n---\nBody.\n');
    const r = validateBundle(dir);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'missing-type' && i.file === 'a.md')).toBe(true);
  });

  it('errors on a dangling internal link', () => {
    write('index.md', '---\ntype: index\n---\n');
    write('log.md', '---\ntype: log\n---\n');
    write('a.md', '---\ntype: doc\n---\nSee [gone](/gone.md).\n');
    const r = validateBundle(dir);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'dangling-link' && i.message.includes('gone.md'))).toBe(true);
  });

  it('warns when a reserved file is missing', () => {
    write('a.md', '---\ntype: doc\n---\nBody.\n');
    const r = validateBundle(dir);
    expect(r.issues.some((i) => i.code === 'missing-reserved' && i.message.includes('index.md'))).toBe(true);
    expect(r.issues.some((i) => i.code === 'missing-reserved' && i.message.includes('log.md'))).toBe(true);
    // Missing reserved files are warnings, not errors.
    expect(r.ok).toBe(true);
  });

  it('does not require a type on reserved files', () => {
    write('index.md', '# Index\n');
    write('log.md', '# Log\n');
    write('a.md', '---\ntype: doc\n---\nBody.\n');
    const r = validateBundle(dir);
    expect(r.issues.some((i) => i.code === 'missing-type')).toBe(false);
  });
});
