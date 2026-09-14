import {
  parse,
  resolve,
  applyProfile,
  carveToMarkdownWithReport,
  type ProfileViolation,
  type RenderLoss,
  type AnyNode,
} from '@markup-carve/carve';
import { okfProfile, type OkfProfileMode } from './profile.js';

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
  /** Non-portable node types, from Carve's feature profile. */
  violations: ProfileViolation[];
  /**
   * Raw-format drops the Markdown renderer reported (e.g. a `{=latex}` raw
   * fence that has no Markdown form). The profile allows raw nodes - a raw HTML
   * block passes through fine - so this is the signal for the ones the renderer
   * cannot emit and silently deletes.
   */
  losses: RenderLoss[];
}

// A GFM task-list item is state on `list_item` (`checked`), not a distinct node
// type, so a profile deny list cannot catch it. `commonmark` mode excludes GFM,
// so task lists are detected and degraded here instead.
const TASK_MARKER_RE = /^(\s*[-*+]\s+)\[[ xX]\]\s+/gm;

function countTaskItems(node: AnyNode | AnyNode[]): number {
  if (Array.isArray(node)) return node.reduce((n, c) => n + countTaskItems(c), 0);
  if (!node || typeof node !== 'object') return 0;
  let count = 0;
  const rec = node as unknown as Record<string, unknown>;
  if (rec.type === 'list_item' && typeof rec.checked === 'boolean') count += 1;
  for (const [k, v] of Object.entries(rec)) {
    if (k === 'type' || k === 'pos') continue;
    if (v && typeof v === 'object') count += countTaskItems(v as AnyNode);
  }
  return count;
}

/**
 * Render a Carve body to Markdown and report its portability.
 *
 * Portability is reported from two independent, complementary sources: the
 * feature profile (structural constructs with no Markdown form) and the
 * renderer's own raw-format loss report (raw fences it cannot emit). Detection
 * and rendering are separate passes so a lenient render keeps full fidelity
 * while still carrying both signals.
 */
export function renderBody(body: string, opts: RenderOptions = {}): RenderedBody {
  const mode = opts.mode ?? 'gfm';
  const profile = okfProfile(mode, 'to_text');

  const detDoc = resolve(parse(body));
  const taskItems = countTaskItems(detDoc);
  const { violations } = applyProfile(detDoc, profile);

  const result = opts.strict
    ? carveToMarkdownWithReport(body, { profile })
    : carveToMarkdownWithReport(body);
  let markdown = result.value;

  if (mode === 'commonmark' && taskItems > 0) {
    violations.push({
      nodeType: 'list_item',
      reason: 'element_not_allowed',
      reasonDescription: 'task list (GFM extension) is not portable in commonmark mode',
    });
    if (opts.strict) markdown = markdown.replace(TASK_MARKER_RE, '$1');
  }

  return { markdown, violations, losses: result.losses };
}
