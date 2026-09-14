import { describe, it, expect } from 'vitest';
import { okfProfile } from './profile.js';

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
