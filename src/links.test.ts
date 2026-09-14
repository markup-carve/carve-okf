import { describe, it, expect } from 'vitest';
import { rewriteLinks } from './links.js';

describe('rewriteLinks', () => {
  const map = new Map([
    ['architecture.crv', 'architecture'],
    ['getting-started.crv', 'getting-started'],
  ]);

  it('rewrites internal .crv links to root-relative .md links', () => {
    const r = rewriteLinks('See [arch](architecture.crv).', map);
    expect(r.markdown).toBe('See [arch](/architecture.md).');
    expect(r.unresolved).toEqual([]);
  });

  it('preserves a fragment on an internal link', () => {
    const r = rewriteLinks('[x](architecture.crv#layers)', map);
    expect(r.markdown).toBe('[x](/architecture.md#layers)');
  });

  it('rewrites an internal image destination', () => {
    const r = rewriteLinks('![d](architecture.crv)', map);
    expect(r.markdown).toBe('![d](/architecture.md)');
  });

  it('reports a link to a missing .crv and leaves it untouched', () => {
    const r = rewriteLinks('[gone](missing.crv)', map);
    expect(r.markdown).toBe('[gone](missing.crv)');
    expect(r.unresolved).toEqual(['missing.crv']);
  });

  it('downgrades an unresolved heading reference to an anchor', () => {
    const r = rewriteLinks('see </#section-two>', map);
    expect(r.markdown).toBe('see [section-two](#section-two)');
  });

  it('resolves a dot-relative internal link', () => {
    const r = rewriteLinks('[x](./architecture.crv)', map);
    expect(r.markdown).toBe('[x](/architecture.md)');
    expect(r.unresolved).toEqual([]);
  });

  it('preserves a title on an internal link', () => {
    const r = rewriteLinks('[x](architecture.crv "The Arch")', map);
    expect(r.markdown).toBe('[x](/architecture.md "The Arch")');
  });
});
