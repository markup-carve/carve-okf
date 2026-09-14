import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * Recursively list every `.crv` file under `dir`, returning bundle-relative
 * POSIX paths (forward slashes) sorted for deterministic output. Structure is
 * preserved: `guide/intro.crv` stays `guide/intro.crv`.
 */
export function listCrvFiles(dir: string): string[] {
  return listByExt(dir, '.crv');
}

/** Recursively list every `.md` file under `dir` as bundle-relative POSIX paths. */
export function listMdFiles(dir: string): string[] {
  return listByExt(dir, '.md');
}

function listByExt(root: string, ext: string): string[] {
  const out: string[] = [];
  const walk = (abs: string): void => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const child = join(abs, entry.name);
      if (entry.isDirectory()) {
        walk(child);
      } else if (entry.isFile() && entry.name.endsWith(ext)) {
        out.push(toPosix(relative(root, child)));
      }
    }
  };
  walk(root);
  return out.sort();
}

/** Convert an OS path to a POSIX path (forward slashes) for bundle addressing. */
export function toPosix(p: string): string {
  return sep === '/' ? p : p.split(sep).join('/');
}
