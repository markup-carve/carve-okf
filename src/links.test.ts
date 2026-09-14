import { describe, it, expect } from 'vitest';
import { rewriteLinks, rewriteLinksToCarve } from './links.js';
import { buildHeadingIndex } from './headings.js';

const crvToSlug = new Map([
  ['architecture.crv', 'architecture'],
  ['getting-started.crv', 'getting-started'],
  ['guide/intro.crv', 'guide/intro'],
]);

describe('rewriteLinks', () => {
  const ctx = { dir: '', crvToSlug };

  it('rewrites internal .crv links to root-relative .md links', () => {
    const r = rewriteLinks('See [arch](architecture.crv).', ctx);
    expect(r.markdown).toBe('See [arch](/architecture.md).');
    expect(r.unresolved).toEqual([]);
  });

  it('preserves a fragment and title', () => {
    expect(rewriteLinks('[x](architecture.crv#layers)', ctx).markdown).toBe('[x](/architecture.md#layers)');
    expect(rewriteLinks('[x](architecture.crv "T")', ctx).markdown).toBe('[x](/architecture.md "T")');
  });

  it('rewrites an internal image and a dot-relative target', () => {
    expect(rewriteLinks('![d](architecture.crv)', ctx).markdown).toBe('![d](/architecture.md)');
    expect(rewriteLinks('[x](./architecture.crv)', ctx).markdown).toBe('[x](/architecture.md)');
  });

  it('resolves a link relative to the referring file directory', () => {
    const r = rewriteLinks('[up](../architecture.crv) [sib](intro.crv)', { dir: 'guide', crvToSlug });
    expect(r.markdown).toBe('[up](/architecture.md) [sib](/guide/intro.md)');
  });

  it('reports a link to a missing .crv', () => {
    const r = rewriteLinks('[gone](missing.crv)', ctx);
    expect(r.markdown).toBe('[gone](missing.crv)');
    expect(r.unresolved).toEqual(['missing.crv']);
  });

  it('resolves a cross-file heading reference via the heading index', () => {
    const headingIndex = buildHeadingIndex([
      { slug: 'architecture', ids: ['Layers'] },
      { slug: 'getting-started', ids: [] },
    ]);
    const r = rewriteLinks('see </#layers>', { dir: '', crvToSlug, headingIndex, slug: 'getting-started' });
    expect(r.markdown).toBe('see [Layers](/architecture.md#Layers)');
  });

  it('downgrades an unresolved heading reference to a same-document anchor', () => {
    const r = rewriteLinks('see </#section-two>', ctx);
    expect(r.markdown).toBe('see [section-two](#section-two)');
  });
});

describe('rewriteLinksToCarve', () => {
  const mdPaths = new Set(['architecture.md', 'glossary.md', 'guide/intro.md']);

  it('rewrites a root-relative .md link to a bare .crv link', () => {
    expect(rewriteLinksToCarve('[t](/architecture.md)', mdPaths).markdown).toBe('[t](architecture.crv)');
  });

  it('resolves a nested target relative to the referring file', () => {
    const r = rewriteLinksToCarve('[up](../architecture.md) [me](intro.md)', mdPaths, 'guide');
    expect(r.markdown).toBe('[up](../architecture.crv) [me](intro.crv)');
  });

  it('reports a dangling .md link', () => {
    const r = rewriteLinksToCarve('[x](/gone.md)', mdPaths);
    expect(r.unresolved).toEqual(['gone.md']);
  });
});
