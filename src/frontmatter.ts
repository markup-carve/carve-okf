import yaml from 'js-yaml';
import * as toml from 'smol-toml';

export type FrontMatterFormat = 'yaml' | 'toml' | 'json' | 'unknown' | 'none';

export interface SplitFrontMatter {
  /** Parsed front-matter mapping (empty object when there is none). */
  meta: Record<string, unknown>;
  /** Which dialect the block declared; `unknown` is stripped but not parsed. */
  format: FrontMatterFormat;
  /** Document body with the front-matter block removed. */
  body: string;
}

// Carve opens front matter with `---`, one optional space and an optional
// format token (`---yaml`, `--- toml`); `carve fmt` writes `---yaml`. `+++` TOML
// is not Carve syntax. The block is split here so its mapping reaches the OKF
// header instead of being written into the Markdown body.
const CARVE_RE = /^\uFEFF?---(?: ?([A-Za-z0-9]+))?[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
const TOML_RE = /^\uFEFF?\+\+\+[ \t]*\r?\n([\s\S]*?)\r?\n\+\+\+[ \t]*(?:\r?\n|$)/;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Split a leading Carve (`---`, `---toml`, ...) or TOML (`+++`) front-matter block from the body. */
export function splitFrontMatter(source: string): SplitFrontMatter {
  const carveMatch = source.match(CARVE_RE);
  if (carveMatch) {
    const body = source.slice(carveMatch[0].length);
    const format = (carveMatch[1] ?? 'yaml').toLowerCase();
    if (format === 'yaml') return { meta: asRecord(yaml.load(carveMatch[2])), format: 'yaml', body };
    if (format === 'toml') return { meta: asRecord(toml.parse(carveMatch[2])), format: 'toml', body };
    if (format === 'json') return { meta: asRecord(JSON.parse(carveMatch[2])), format: 'json', body };
    return { meta: {}, format: 'unknown', body };
  }
  const tomlMatch = source.match(TOML_RE);
  if (tomlMatch) {
    return {
      meta: asRecord(toml.parse(tomlMatch[1])),
      format: 'toml',
      body: source.slice(tomlMatch[0].length),
    };
  }
  return { meta: {}, format: 'none', body: source };
}
