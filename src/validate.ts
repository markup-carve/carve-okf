import { readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { splitFrontMatter } from './frontmatter.js';
import { RESERVED_FILES } from './import.js';
import { listMdFiles } from './files.js';

export type IssueSeverity = 'error' | 'warning';

export interface ValidationIssue {
  severity: IssueSeverity;
  /** Bundle file the issue is about, or null for a bundle-level issue. */
  file: string | null;
  code: string;
  message: string;
}

export interface ValidationReport {
  issues: ValidationIssue[];
  /** True when there are no error-severity issues. */
  ok: boolean;
}

// A Markdown link/image destination pointing at a bundle `.md` file (rooted,
// bare, dot-relative, or nested).
const MD_LINK_RE = /!?\]\((\/?)([^)\s"#]+?\.md)(#[^)\s"]*)?(\s+"[^"]*")?\)/g;

function isReserved(file: string): boolean {
  return RESERVED_FILES.has(file);
}

/**
 * Validate an OKF bundle directory tree.
 *
 * Errors: a concept file missing the required `type` front-matter key; a `.md`
 * link that resolves to no file in the bundle. Warnings: a missing reserved
 * `index.md` / `log.md`. Reserved files are not required to carry a `type` or
 * to be link targets. Nested directories are supported; a relative link is
 * resolved against the referring file's directory.
 */
export function validateBundle(okfDir: string): ValidationReport {
  const issues: ValidationIssue[] = [];
  const files = listMdFiles(okfDir);
  const present = new Set(files);

  for (const reserved of RESERVED_FILES) {
    if (!present.has(reserved)) {
      issues.push({ severity: 'warning', file: null, code: 'missing-reserved', message: `bundle has no ${reserved}` });
    }
  }

  for (const file of files) {
    const dir = posix.dirname(file) === '.' ? '' : posix.dirname(file);
    const src = readFileSync(join(okfDir, file), 'utf8');
    const { meta, body } = splitFrontMatter(src);

    if (!isReserved(file) && meta.type == null) {
      issues.push({ severity: 'error', file, code: 'missing-type', message: 'front matter is missing the required `type` key' });
    }

    for (const m of body.matchAll(MD_LINK_RE)) {
      const rooted = m[1];
      const raw = m[2];
      const target = rooted ? posix.normalize(raw) : posix.normalize(dir ? posix.join(dir, raw) : raw);
      if (!present.has(target)) {
        issues.push({ severity: 'error', file, code: 'dangling-link', message: `link target ${raw} is not in the bundle` });
      }
    }
  }

  return { issues, ok: !issues.some((i) => i.severity === 'error') };
}
