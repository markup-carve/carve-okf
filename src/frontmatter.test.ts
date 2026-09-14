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
