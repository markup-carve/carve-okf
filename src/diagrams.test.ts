import { describe, it, expect } from 'vitest';
import { findDiagramFences } from './diagrams.js';

describe('findDiagramFences', () => {
  it('finds a mermaid fence and reports its language and line', () => {
    const md = '# T\n\n```mermaid\ngraph TD\nA-->B\n```\n\ntext\n';
    const found = findDiagramFences(md);
    expect(found).toEqual([{ lang: 'mermaid', line: 3 }]);
  });

  it('ignores a plain code fence and a language token inside a block body', () => {
    const md = '```js\nconst mermaid = 1;\n```\n';
    expect(findDiagramFences(md)).toEqual([]);
  });

  it('finds multiple diagram languages', () => {
    const md = '```graphviz\nx\n```\n\n```d2\ny\n```\n';
    expect(findDiagramFences(md).map((d) => d.lang)).toEqual(['graphviz', 'd2']);
  });

  it('matches tilde fences too', () => {
    const md = '~~~mermaid\nx\n~~~\n';
    expect(findDiagramFences(md)).toEqual([{ lang: 'mermaid', line: 1 }]);
  });

  it('recognizes the full bundled language set', () => {
    for (const lang of ['wavedrom', 'abc', 'puml', 'plantuml', 'vega-lite', 'chart', 'dot']) {
      expect(findDiagramFences('```' + lang + '\nx\n```\n')).toEqual([{ lang, line: 1 }]);
    }
  });

  it('finds a diagram fence inside a block quote', () => {
    const md = '> text\n>\n> ```mermaid\n> graph TD\n> ```\n';
    expect(findDiagramFences(md)).toEqual([{ lang: 'mermaid', line: 3 }]);
  });

  it('finds a diagram fence inside a list item', () => {
    const md = '- item\n\n  ```d2\n  x\n  ```\n';
    expect(findDiagramFences(md)).toEqual([{ lang: 'd2', line: 3 }]);
  });
});
