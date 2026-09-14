import { existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { basename, extname, isAbsolute, join, resolve as resolvePath } from 'node:path';

/**
 * Bundle-wide asset registry. Shared across every concept so a file referenced
 * from two documents is copied once, and two different files that share a
 * basename get distinct output names instead of overwriting each other.
 */
export interface AssetRegistry {
  /** Absolute source path -> assigned output name (basename within assets/). */
  bySource: Map<string, string>;
  /** Output names already taken, to detect basename collisions. */
  usedNames: Set<string>;
}

export function createAssetRegistry(): AssetRegistry {
  return { bySource: new Map(), usedNames: new Set() };
}

export interface AssetResult {
  markdown: string;
  /** Asset files newly copied by this call, as output-relative paths. */
  copied: string[];
  /** Referenced local assets that could not be found on disk. */
  missing: string[];
}

const IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]+)(\s+"[^"]*")?\)/g;

function isRemote(dest: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(dest) || dest.startsWith('//') || dest.startsWith('#') || dest.startsWith('/');
}

function assignName(abs: string, registry: AssetRegistry): string {
  const existing = registry.bySource.get(abs);
  if (existing) return existing;
  const base = basename(abs);
  let name = base;
  if (registry.usedNames.has(name)) {
    const ext = extname(base);
    const stem = base.slice(0, base.length - ext.length);
    let i = 1;
    do {
      name = `${stem}-${i}${ext}`;
      i += 1;
    } while (registry.usedNames.has(name));
  }
  registry.bySource.set(abs, name);
  registry.usedNames.add(name);
  return name;
}

/**
 * Copy local images referenced by the rendered Markdown into `<outDir>/assets/`
 * and rewrite each destination to `/assets/<name>`. Remote, data:, and
 * already-root-relative destinations are left untouched.
 *
 * @param srcDir   Directory the source `.crv` lived in (relative image paths
 *                 resolve against it).
 * @param outDir   Bundle output directory.
 * @param registry Shared registry so names stay collision-safe across the bundle.
 */
export function copyAssets(markdown: string, srcDir: string, outDir: string, registry: AssetRegistry): AssetResult {
  const copied: string[] = [];
  const missing: string[] = [];
  const out = markdown.replace(IMAGE_RE, (whole, alt: string, dest: string, title = '') => {
    if (isRemote(dest)) return whole;
    const abs = isAbsolute(dest) ? dest : resolvePath(srcDir, dest);
    if (!existsSync(abs)) {
      missing.push(dest);
      return whole;
    }
    const alreadyCopied = registry.bySource.has(abs);
    const name = assignName(abs, registry);
    if (!alreadyCopied) {
      mkdirSync(join(outDir, 'assets'), { recursive: true });
      copyFileSync(abs, join(outDir, 'assets', name));
      copied.push(`assets/${name}`);
    }
    return `![${alt}](/assets/${name}${title})`;
  });
  return { markdown: out, copied, missing };
}
