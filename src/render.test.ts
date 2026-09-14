import { describe, it, expect } from 'vitest';
import { renderBody } from './render.js';

const SAMPLE = `# Title

::: note
Config is =case-sensitive=.
:::

H{,2,}O and 10{^th^} and _under_ and *bold*.
`;

describe('renderBody', () => {
  it('reports non-portable constructs as engine-backed violations', () => {
    const { violations } = renderBody(SAMPLE);
    const types = violations.map((v) => v.nodeType).sort();
    expect(types).toContain('admonition');
    expect(types).toContain('superscript');
    expect(types).toContain('subscript');
    expect(types).toContain('underline');
  });

  it('keeps HTML fallbacks in lenient (default) mode', () => {
    const { markdown } = renderBody(SAMPLE);
    expect(markdown).toContain('<sup>th</sup>');
    expect(markdown).toContain('<mark>');
  });

  it('degrades non-portable constructs to text in strict mode', () => {
    const { markdown } = renderBody(SAMPLE, { strict: true });
    expect(markdown).not.toContain('<sup>');
    expect(markdown).not.toContain('<mark>');
    expect(markdown).toContain('10th');
    expect(markdown).toContain('**bold**');
  });

  it('leaves CommonMark-native inline formatting intact', () => {
    const { markdown } = renderBody('Text with /italic/ and *bold*.');
    expect(markdown).toContain('*italic*');
    expect(markdown).toContain('**bold**');
  });

  it('surfaces a dropped non-Markdown raw fence via the renderer loss report', () => {
    const { markdown, losses } = renderBody('Text `foo`{=latex} end.');
    // The renderer drops the latex content...
    expect(markdown).not.toContain('foo');
    // ...but it is no longer silent: reported as a raw-format loss.
    expect(losses.some((l) => l.code === 'raw-format-dropped' && l.format === 'latex')).toBe(true);
  });

  it('reports task lists as non-portable in commonmark mode and degrades them in strict', () => {
    const src = '- [x] done\n- [ ] todo\n';
    const lenient = renderBody(src, { mode: 'commonmark' });
    expect(lenient.violations.some((v) => v.nodeType === 'list_item')).toBe(true);
    const strict = renderBody(src, { mode: 'commonmark', strict: true });
    expect(strict.markdown).not.toContain('[x]');
    expect(strict.markdown).not.toContain('[ ]');
    expect(strict.markdown).toContain('- done');
  });

  it('keeps task lists in gfm mode', () => {
    const { markdown, violations } = renderBody('- [x] done\n', { mode: 'gfm' });
    expect(markdown).toContain('[x]');
    expect(violations.some((v) => v.nodeType === 'list_item')).toBe(false);
  });
});
