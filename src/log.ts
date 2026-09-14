import { execFileSync } from 'node:child_process';

export interface LogEntry {
  hash: string;
  date: string;
  subject: string;
}

/**
 * Derive update-log entries from the git history of the source directory.
 *
 * Returns the commits that touched `srcDir`, newest first. When `srcDir` is not
 * inside a git work tree (or git is unavailable), returns an empty array and the
 * caller emits a generated stub instead.
 *
 * @param limit Maximum number of commits to include.
 */
export function gitLog(srcDir: string, limit = 50): LogEntry[] {
  try {
    const out = execFileSync(
      'git',
      ['-C', srcDir, 'log', `-n${limit}`, '--format=%h\x1f%aI\x1f%s', '--', '.'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    return out
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [hash, date, subject] = line.split('\x1f');
        return { hash, date, subject };
      });
  } catch {
    return [];
  }
}
