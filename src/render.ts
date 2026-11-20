import { parse, type Diagnostic, type DocumentNode } from '@markup-carve/carve';
import { toMarkdown } from '@markup-carve/carve/export';
import {
  okfProfile,
  portabilityViolations,
  degradeTree,
  type OkfProfileMode,
  type PortabilityViolation,
} from './profile.js';

export interface RenderOptions {
  /** Target Markdown dialect. Default `gfm`. */
  mode?: OkfProfileMode;
  /**
   * When true, non-portable constructs are degraded to text so the output is
   * guaranteed to fit the target dialect. When false (default), the document is
   * rendered at full fidelity - Carve emits HTML fallbacks for its own
   * constructs - and the non-portable ones are still reported as violations.
   */
  strict?: boolean;
}

export interface RenderedBody {
  markdown: string;
  /** Non-portable node types, from the OKF portability profile. */
  violations: PortabilityViolation[];
  /**
   * Losses the Markdown writer reported (`render-loss` diagnostics), including
   * dropped raw formats and refused destinations. The profile reports
   * structural portability separately.
   */
  losses: Diagnostic[];
}

type Tree = { type: string; [key: string]: unknown };

// A task-list item is state on `list_item` (`task`), not a distinct node type,
// so the profile cannot catch it. `commonmark` mode excludes GFM, so task lists
// are detected and dropped here instead.
function stripTasks(node: Tree, found: { count: number }, strip: boolean): Tree {
  const copy: Tree = { ...node };
  if (node.type === 'list_item' && node.task) {
    found.count += 1;
    if (strip) delete copy.task;
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === 'pos') continue;
    if (Array.isArray(value)) {
      copy[key] = value.map((v) => (v && typeof v === 'object' && 'type' in v ? stripTasks(v as Tree, found, strip) : v));
    } else if (value && typeof value === 'object' && 'type' in (value as object)) {
      copy[key] = stripTasks(value as Tree, found, strip);
    }
  }
  return copy;
}

/**
 * Render a Carve body to Markdown and report its portability.
 *
 * Portability is reported from two independent, complementary sources: the
 * portability profile (structural constructs with no Markdown form) and the
 * writer's own loss report (content it drops or refuses). A lenient render keeps
 * full fidelity while still carrying both signals.
 */
export function renderBody(body: string, opts: RenderOptions = {}): RenderedBody {
  const mode = opts.mode ?? 'gfm';
  const profile = okfProfile(mode, 'to_text');

  let tree: DocumentNode = parse(body);
  const violations = portabilityViolations(tree, profile);

  const tasks = { count: 0 };
  const stripped = stripTasks(tree as unknown as Tree, tasks, mode === 'commonmark' && !!opts.strict);
  if (mode === 'commonmark' && tasks.count > 0) {
    violations.push({
      nodeType: 'list_item',
      reason: 'element_not_allowed',
      reasonDescription: 'task list (GFM extension) is not portable in commonmark mode',
    });
  }
  if (opts.strict) tree = degradeTree(stripped as unknown as DocumentNode, profile);

  const result = toMarkdown(tree);
  return { markdown: result.output, violations, losses: result.diagnostics };
}

/** One violation as a line of text, for reports. */
export function formatViolation(v: PortabilityViolation): string {
  return v.path === undefined ? `${v.nodeType}: ${v.reasonDescription}` : `${v.nodeType} at ${v.path || '/'}: ${v.reasonDescription}`;
}
