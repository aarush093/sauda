/**
 * Whole-repo intellectual-property guard (§2).
 *
 * WHY THIS EXISTS: SAUDA is an original expression of a public card-game genre.
 * Certain third-party names and street names must NEVER appear anywhere in the
 * repo — code, comments, tests, assets, or (later) the app/ and store/ listing
 * copy. This test walks the entire repository and fails if any banned term is
 * found, so new packages added in later milestones are covered automatically.
 *
 * TWO SUBTLETIES:
 *  - CONTRIBUTING.md and docs/BUILD_SPEC.md legitimately quote the banned words (they
 *    ARE the guardrail spec), so exactly those two files are allowlisted.
 *  - This guard file must itself scan clean, so the banned terms are assembled
 *    from fragments at runtime — no banned literal appears in this source.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// Walk up from this file until we find the workspace root (the folder that holds
// pnpm-workspace.yaml). This keeps the scan rooted at the repo regardless of
// which directory the test runner is invoked from.
function findRepoRoot(startDir: string): string {
  let current = startDir;
  for (;;) {
    try {
      statSync(join(current, 'pnpm-workspace.yaml'));
      return current;
    } catch {
      // not here — keep walking up
    }
    const parent = dirname(current);
    if (parent === current) {
      throw new Error('Could not locate repo root (pnpm-workspace.yaml not found)');
    }
    current = parent;
  }
}

const REPO_ROOT = findRepoRoot(dirname(fileURLToPath(import.meta.url)));

// The only files allowed to contain banned terms: the spec itself.
const ALLOWLIST = new Set([join('docs', 'BUILD_SPEC.md'), 'CONTRIBUTING.md']);

// Directories we never scan (build output, deps, VCS, native platform folders).
const SKIP_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.turbo',
  '.next',
  'android',
  'ios',
]);

// Only scan human-readable text files; skip lockfiles and binaries.
const SCANNED_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.md', '.html', '.css', '.svg', '.txt', '.yml', '.yaml',
]);
const SKIP_FILES = new Set(['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock']);

// Assemble each banned term from fragments so this file contains no banned
// literal (and therefore scans clean itself). Terms are the §2 names plus the
// classic property/railroad names from the source genre.
const fragment = (...parts: string[]): string => parts.join('');
const BANNED_TERMS: string[] = [
  fragment('Mono', 'poly'),
  fragment('Has', 'bro'),
  fragment('Parker ', 'Brothers'),
  fragment('Mr. ', 'Mono', 'poly'),
  fragment('Board', 'walk'),
  fragment('Park ', 'Place'),
  fragment('Marvin ', 'Gardens'),
  fragment('Rich Uncle ', 'Pennybags'),
  fragment('Mediterranean ', 'Avenue'),
  fragment('Baltic ', 'Avenue'),
  fragment('Oriental ', 'Avenue'),
  fragment('Vermont ', 'Avenue'),
  fragment('Connecticut ', 'Avenue'),
  fragment('St. Charles ', 'Place'),
  fragment('States ', 'Avenue'),
  fragment('Virginia ', 'Avenue'),
  fragment('St. James ', 'Place'),
  fragment('Tennessee ', 'Avenue'),
  fragment('New York ', 'Avenue'),
  fragment('Kentucky ', 'Avenue'),
  fragment('Indiana ', 'Avenue'),
  fragment('Illinois ', 'Avenue'),
  fragment('Atlantic ', 'Avenue'),
  fragment('Ventnor ', 'Avenue'),
  fragment('Pacific ', 'Avenue'),
  fragment('North Carolina ', 'Avenue'),
  fragment('Pennsylvania ', 'Avenue'),
  fragment('Reading ', 'Railroad'),
  fragment('Pennsylvania ', 'Railroad'),
  fragment('Short ', 'Line'),
  fragment('Community ', 'Chest'),
].map((term) => term.toLowerCase());

// Recursively collect every scannable text file under `dir`.
function collectTextFiles(dir: string, found: string[]): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRECTORIES.has(entry.name)) {
        collectTextFiles(fullPath, found);
      }
      continue;
    }
    if (!entry.isFile() || SKIP_FILES.has(entry.name)) {
      continue;
    }
    const dotIndex = entry.name.lastIndexOf('.');
    const extension = dotIndex >= 0 ? entry.name.slice(dotIndex) : '';
    if (SCANNED_EXTENSIONS.has(extension)) {
      found.push(fullPath);
    }
  }
  return found;
}

describe('IP guard: no third-party names anywhere in the repo (§2)', () => {
  const files = collectTextFiles(REPO_ROOT, []);

  it('actually scans a meaningful number of files', () => {
    // A sanity check: if the walk silently found nothing, the guard is useless.
    expect(files.length).toBeGreaterThan(5);
  });

  it('contains no banned IP strings outside the two allowlisted spec files', () => {
    const violations: string[] = [];
    for (const file of files) {
      const relativePath = relative(REPO_ROOT, file);
      if (ALLOWLIST.has(relativePath)) {
        continue;
      }
      const contents = readFileSync(file, 'utf8').toLowerCase();
      for (const term of BANNED_TERMS) {
        if (contents.includes(term)) {
          violations.push(`${relativePath}: contains banned term "${term}"`);
        }
      }
    }
    expect(violations, `Banned IP strings found:\n${violations.join('\n')}`).toEqual([]);
  });
});
