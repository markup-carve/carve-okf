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

describe('degradeTree keeps boundaries and leaf text', () => {
  const md = (src: string, mode: 'gfm' | 'commonmark' = 'gfm') => toMarkdown(degradeTree(parse(src), okfProfile(mode))).output;

  it('unwraps a container into its blocks', () => {
    expect(md('::: note\nFirst.\n\nSecond.\n:::\n')).toBe('First.\n\nSecond.\n');
    expect(md(':: Term\n: Desc one.\n\n  Desc two.\n')).toBe('Term\n\nDesc one.\n\nDesc two.\n');
  });

  it('writes a table as one paragraph per row in commonmark mode', () => {
    expect(md('|= Name |= Value |\n| a | b |\n', 'commonmark')).toBe('Name | Value\n\na | b\n');
  });

  it('keeps the text of symbols, mentions and portable formatting inside a denied span', () => {
    expect(md('A :smile: B and @foo and {=*bold* mark=}.\n')).toBe('A :smile: B and @foo and **bold** mark.\n');
  });
});
