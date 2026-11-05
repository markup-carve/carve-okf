import yaml from 'js-yaml';
import * as toml from 'smol-toml';

export type FrontMatterFormat = 'yaml' | 'toml' | 'json' | 'unknown' | 'none';

/** Carve sources take a format token after `---`; OKF Markdown takes a bare `---`. */
export type FrontMatterSource = 'carve' | 'markdown';

export interface SplitFrontMatter {
  /** Parsed front-matter mapping (empty object when there is none). */
  meta: Record<string, unknown>;
  /** Which dialect the block declared; `unknown` is stripped but not parsed. */
  format: FrontMatterFormat;
  /** Document body with the front-matter block removed. */
  body: string;
}

// Carve opens front matter with `---`, one optional space and an optional
// format token (`---yaml`, `--- toml`); `carve fmt` writes `---yaml`. Without a
// closer a Carve block runs to the end of the document (PART 1); in Markdown a
// lone `---` is a thematic break. `+++` TOML is not Carve syntax. The block is
// split here so its mapping reaches the OKF header instead of the body.
const CARVE_OPEN_RE = /^---(?: ?([A-Za-z0-9]+))?[ \t]*$/;
const CLOSE_RE = /^---[ \t]*$/;
const TOML_RE = /^\uFEFF?\+\+\+[ \t]*\r?\n([\s\S]*?)\r?\n\+\+\+[ \t]*(?:\r?\n|$)/;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

interface DashBlock {
  token: string | undefined;
  content: string;
  body: string;
}

function matchDashBlock(source: string, from: FrontMatterSource): DashBlock | null {
  const lines = source.replace(/^\uFEFF/, '').split('\n');
  const open = CARVE_OPEN_RE.exec(lines[0].replace(/\r$/, ''));
  if (!open || (from === 'markdown' && open[1] !== undefined)) return null;
  const close = lines.findIndex((line, i) => i > 0 && CLOSE_RE.test(line.replace(/\r$/, '')));
  if (close === -1 && from === 'markdown') return null;
  const end = close === -1 ? lines.length : close;
  const content = lines.slice(1, end).map((line) => line.replace(/\r$/, '')).join('\n');
  const body = close === -1 ? '' : lines.slice(close + 1).join('\n');
  return { token: open[1], content, body };
}

/** Split a leading Carve (`---`, `---toml`, ...) or TOML (`+++`) front-matter block from the body. */
export function splitFrontMatter(source: string, from: FrontMatterSource = 'carve'): SplitFrontMatter {
  const dash = matchDashBlock(source, from);
  if (dash) {
    const { content, body } = dash;
    const format = (dash.token ?? 'yaml').toLowerCase();
    if (format === 'yaml') return { meta: asRecord(yaml.load(content)), format: 'yaml', body };
    if (format === 'toml') return { meta: asRecord(toml.parse(content)), format: 'toml', body };
    if (format === 'json') return { meta: asRecord(JSON.parse(content)), format: 'json', body };
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
