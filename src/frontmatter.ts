import yaml from 'js-yaml';
import * as toml from 'smol-toml';

export type FrontMatterFormat = 'yaml' | 'toml' | 'none';

export interface SplitFrontMatter {
  /** Parsed front-matter mapping (empty object when there is none). */
  meta: Record<string, unknown>;
  /** Which delimiter the source used. */
  format: FrontMatterFormat;
  /** Document body with the front-matter block removed. */
  body: string;
}

// Carve itself does NOT parse front matter: it tags every `--- ... ---` block as
// `yaml` regardless of content and does not recognize a `+++ ... +++` TOML block
// at all. So the exporter splits and parses front matter here, before handing the
// body to the Carve parser.
const YAML_RE = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
const TOML_RE = /^\uFEFF?\+\+\+[ \t]*\r?\n([\s\S]*?)\r?\n\+\+\+[ \t]*(?:\r?\n|$)/;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Split a leading YAML (`---`) or TOML (`+++`) front-matter block from the body. */
export function splitFrontMatter(source: string): SplitFrontMatter {
  const yamlMatch = source.match(YAML_RE);
  if (yamlMatch) {
    return {
      meta: asRecord(yaml.load(yamlMatch[1])),
      format: 'yaml',
      body: source.slice(yamlMatch[0].length),
    };
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
