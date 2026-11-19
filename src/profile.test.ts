import { describe, it, expect } from 'vitest';
import { parse } from '@markup-carve/carve';
import { toMarkdown } from '@markup-carve/carve/export';
import { okfProfile, portabilityViolations, degradeTree } from './profile.js';
import { formatViolation } from './render.js';

describe('okfProfile', () => {
  it('denies Carve-only constructs in gfm mode but allows GFM tables/strike/footnotes', () => {
    const p = okfProfile('gfm');
    expect(p.isTypeAllowed('admonition', true)).toBe(false);
    expect(p.isTypeAllowed('highlight', false)).toBe(false);
    expect(p.isTypeAllowed('table', true)).toBe(true);
    expect(p.isTypeAllowed('strike', false)).toBe(true);
    expect(p.isTypeAllowed('footnote_ref', false)).toBe(true);
    // CommonMark-native stays allowed.
    expect(p.isTypeAllowed('emphasis', false)).toBe(true);
    expect(p.isTypeAllowed('link', false)).toBe(true);
  });

  it('additionally denies GFM extras in commonmark mode', () => {
    const p = okfProfile('commonmark');
    expect(p.isTypeAllowed('table', true)).toBe(false);
    expect(p.isTypeAllowed('strike', false)).toBe(false);
    expect(p.isTypeAllowed('footnote_ref', false)).toBe(false);
  });
});

describe('portabilityViolations and degradeTree', () => {
  const tree = parse('A {=mark=} and H{,2,}O.\n\n::: note\nBody.\n:::\n');

  it('lists each non-portable node with its tree path', () => {
    const violations = portabilityViolations(tree, okfProfile('gfm'));
    expect(violations.map((v) => [v.nodeType, v.path])).toEqual([
      ['highlight', '/children/0/children/1'],
      ['subscript', '/children/0/children/3'],
      ['admonition', '/children/1'],
    ]);
    expect(formatViolation(violations[0])).toBe('highlight at /children/0/children/1: highlight has no portable GFM form');
  });

  it('degrades non-portable nodes to their text and leaves the input tree unchanged', () => {
    const degraded = degradeTree(tree, okfProfile('gfm'));
    expect(toMarkdown(degraded).output).toBe('A mark and H2O.\n\nBody.\n');
    expect(portabilityViolations(degraded, okfProfile('gfm'))).toEqual([]);
    expect(portabilityViolations(tree, okfProfile('gfm'))).toHaveLength(3);
  });

  it('removes non-portable nodes with the strip action', () => {
    expect(toMarkdown(degradeTree(tree, okfProfile('gfm', 'strip'))).output).toBe('A  and HO.\n');
  });
});
