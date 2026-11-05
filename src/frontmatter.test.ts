import { describe, it, expect } from 'vitest';
import { splitFrontMatter } from './frontmatter.js';

describe('splitFrontMatter', () => {
  it('parses YAML front matter and strips it from the body', () => {
    const r = splitFrontMatter('---\ntitle: Hi\ntype: guide\n---\n\n# Body\n');
    expect(r.format).toBe('yaml');
    expect(r.meta).toEqual({ title: 'Hi', type: 'guide' });
    expect(r.body).toBe('\n# Body\n');
  });

  it('parses TOML front matter (which Carve itself does not recognize)', () => {
    const r = splitFrontMatter('+++\ntitle = "Hi"\ntags = ["a", "b"]\n+++\n\n# Body\n');
    expect(r.format).toBe('toml');
    expect(r.meta).toEqual({ title: 'Hi', tags: ['a', 'b'] });
    expect(r.body).toBe('\n# Body\n');
  });

  it.each([
    ['---yaml\ntype: guide\n---\n\nbody\n', 'yaml'],
    ['--- yaml\ntype: guide\n---\n\nbody\n', 'yaml'],
    ['---toml\ntype = "guide"\n---\n\nbody\n', 'toml'],
    ['--- toml\ntype = "guide"\n---\n\nbody\n', 'toml'],
    ['---json\n{"type": "guide"}\n---\n\nbody\n', 'json'],
  ])('reads the Carve format token in %j', (src, format) => {
    const r = splitFrontMatter(src);
    expect(r.format).toBe(format);
    expect(r.meta).toEqual({ type: 'guide' });
    expect(r.body).toBe('\nbody\n');
  });

  it('strips a dialect it cannot parse without guessing a mapping', () => {
    const r = splitFrontMatter('---ini\ntype=guide\n---\nbody\n');
    expect(r.format).toBe('unknown');
    expect(r.meta).toEqual({});
    expect(r.body).toBe('body\n');
  });

  it('leaves a token after two spaces in the body, as Carve does', () => {
    const src = '---  toml\ntype = "guide"\n---\nbody\n';
    expect(splitFrontMatter(src)).toEqual({ meta: {}, format: 'none', body: src });
  });

  it('keeps a format-token line in OKF Markdown, which has no such opener', () => {
    const src = '---toml\ntype = "guide"\n---\n\nbody\n';
    expect(splitFrontMatter(src, 'markdown')).toEqual({ meta: {}, format: 'none', body: src });
    expect(splitFrontMatter('---\ntype: guide\n---\nbody\n', 'markdown').meta).toEqual({ type: 'guide' });
  });

  it('returns none when there is no front matter', () => {
    const r = splitFrontMatter('# Just a body\n');
    expect(r.format).toBe('none');
    expect(r.meta).toEqual({});
    expect(r.body).toBe('# Just a body\n');
  });

  it('tolerates a leading BOM', () => {
    const r = splitFrontMatter('\uFEFF---\ntype: doc\n---\nbody');
    expect(r.format).toBe('yaml');
    expect(r.meta).toEqual({ type: 'doc' });
  });
});
