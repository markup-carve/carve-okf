/**
 * Every install command the documentation tells a reader to run must be one
 * that works today.
 *
 * `README.md` advertised `npm install -g @markup-carve/carve-okf` while npm had
 * never served the name, and nothing here could see it: no suite reads the
 * documentation, and an unused release workflow cannot report that it never ran
 * (markup-carve/carve-okf#6). The gate keys off PUBLISHED_TO_NPM rather than off
 * the registry, so it holds in CI with no egress; the release that first
 * publishes flips it in the same change.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

// Flip to true in the change that first publishes this package to npm.
const PUBLISHED_TO_NPM = false;

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const MANIFEST = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
  name: string;
  scripts?: Record<string, string>;
};

/** Read from the manifest so a rename moves the gate instead of silencing it. */
const packageName = (): string => MANIFEST.name;

/**
 * A git spec only yields a usable package when npm builds it on install, which
 * takes a `prepare` script. Without one, `npm install github:owner/repo` lands
 * the source with no `dist` and no bin.
 */
const gitSpecBuilds = (): boolean => typeof MANIFEST.scripts?.prepare === 'string';

const INSTALL = /(?:npm|pnpm|yarn)\s+(?:install|add|i)\b(?<args>[^\n`]*)/g;

const namesThisPackage = (target: string, name: string): boolean => {
  const bare = target.replace(/^(git\+ssh:\/\/|git\+https:\/\/|git\+|git:|github:)/, '').replace(/\.git$/, '');
  const withoutVersion = bare.replace(/(?<=.)@[^@/]*$/, '');
  const shortName = name.split('/').slice(-1)[0];
  return withoutVersion === name || withoutVersion.split('/').slice(-1)[0] === shortName;
};

/** Install commands that cannot give a reader a working `carve-okf` today. */
export const brokenInstalls = (text: string, name: string, gitBuilds: boolean): string[] => {
  const hits: string[] = [];
  for (const match of text.matchAll(INSTALL)) {
    const command = match[0].trim();
    const targets = (match.groups?.args ?? '')
      .split(/\s+/)
      .filter((arg) => arg.length > 0 && !arg.startsWith('-'))
      .map((arg) => arg.replace(/^['"]|['"]$/g, ''));
    for (const target of targets) {
      // A path builds from the checkout, so it always works.
      if (target.startsWith('.') || target.startsWith('/')) continue;
      const isGitSpec =
        /^(git\+|git:|github:|https?:)/.test(target) || /^[^@/\s]+\/[^@/\s]+$/.test(target);
      if (!namesThisPackage(target, name)) continue;
      if (isGitSpec && gitBuilds) continue;
      hits.push(command);
    }
  }
  return hits;
};

const markdownIn = (dir: string): string[] => {
  const absolute = join(ROOT, dir);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => join(absolute, entry.name));
};

const SCANNED = [...markdownIn('.'), ...markdownIn('docs'), join(ROOT, 'package.json')].sort();

describe('every advertised install works today', () => {
  for (const path of SCANNED) {
    const label = relative(ROOT, path);
    it.skipIf(PUBLISHED_TO_NPM)(`${label} advertises no install this repo cannot deliver`, () => {
      const hits = brokenInstalls(readFileSync(path, 'utf8'), packageName(), gitSpecBuilds());
      expect(
        hits,
        `${label} tells a reader to install ${packageName()} in a way that does not work`,
      ).toEqual([]);
    });
  }

  // The controls. A zero above is a measurement only because a positive exists.
  it('reports the registry install that shipped in the README', () => {
    expect(brokenInstalls('npm install -g @markup-carve/carve-okf\n', '@markup-carve/carve-okf', false)).toEqual([
      'npm install -g @markup-carve/carve-okf',
    ]);
  });

  it('reports a git spec while no prepare script builds it', () => {
    // Measured 2026-09-30: that install lands the source with no dist and no bin.
    const command = 'npm install github:markup-carve/carve-okf\n';
    expect(brokenInstalls(command, '@markup-carve/carve-okf', false)).toEqual([command.trim()]);
    expect(brokenInstalls(command, '@markup-carve/carve-okf', true)).toEqual([]);
  });

  it('accepts the install paths that work from a checkout', () => {
    expect(brokenInstalls('npm ci\nnpm install\nnpm install .\nnpm link\n', '@markup-carve/carve-okf', false)).toEqual(
      [],
    );
  });

  it('reads the package name from the manifest', () => {
    expect(packageName()).toBe('@markup-carve/carve-okf');
  });
});
