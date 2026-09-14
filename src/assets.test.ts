import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { copyAssets, createAssetRegistry } from './assets.js';

let base: string;
let outDir: string;

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'carve-okf-assets-'));
  outDir = join(base, 'out');
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

describe('copyAssets', () => {
  it('leaves remote and root-relative images untouched', () => {
    const reg = createAssetRegistry();
    const r = copyAssets('![a](https://x/y.png) ![b](/already.png)', base, outDir, reg);
    expect(r.markdown).toBe('![a](https://x/y.png) ![b](/already.png)');
    expect(r.copied).toEqual([]);
  });

  it('copies a local image and rewrites its path', () => {
    mkdirSync(join(base, 'img'), { recursive: true });
    writeFileSync(join(base, 'img', 'logo.png'), 'PNG-A');
    const reg = createAssetRegistry();
    const r = copyAssets('![logo](img/logo.png)', base, outDir, reg);
    expect(r.markdown).toBe('![logo](/assets/logo.png)');
    expect(readFileSync(join(outDir, 'assets', 'logo.png'), 'utf8')).toBe('PNG-A');
  });

  it('gives same-named images from different directories distinct output names', () => {
    mkdirSync(join(base, 'a'), { recursive: true });
    mkdirSync(join(base, 'b'), { recursive: true });
    writeFileSync(join(base, 'a', 'pic.png'), 'A');
    writeFileSync(join(base, 'b', 'pic.png'), 'B');
    const reg = createAssetRegistry();
    // Two concepts sharing one registry.
    const r1 = copyAssets('![x](a/pic.png)', base, outDir, reg);
    const r2 = copyAssets('![y](b/pic.png)', base, outDir, reg);
    expect(r1.markdown).toBe('![x](/assets/pic.png)');
    expect(r2.markdown).toBe('![y](/assets/pic-1.png)');
    expect(readFileSync(join(outDir, 'assets', 'pic.png'), 'utf8')).toBe('A');
    expect(readFileSync(join(outDir, 'assets', 'pic-1.png'), 'utf8')).toBe('B');
  });

  it('copies a shared image once and reuses its name', () => {
    writeFileSync(join(base, 'shared.png'), 'S');
    const reg = createAssetRegistry();
    const r1 = copyAssets('![x](shared.png)', base, outDir, reg);
    const r2 = copyAssets('![y](shared.png)', base, outDir, reg);
    expect(r1.copied).toEqual(['assets/shared.png']);
    expect(r2.copied).toEqual([]);
    expect(r2.markdown).toBe('![y](/assets/shared.png)');
  });

  it('reports a missing local asset', () => {
    const reg = createAssetRegistry();
    const r = copyAssets('![x](nope.png)', base, outDir, reg);
    expect(r.missing).toEqual(['nope.png']);
    expect(r.markdown).toBe('![x](nope.png)');
  });
});
