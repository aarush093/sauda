/**
 * Visual-constancy guard (STATE_MATRIX §1 · v1.2 A5): colours live ONLY in the tokens
 * file. This scans apps/mobile/src for raw colour literals (hex, rgb/rgba, hsl/hsla)
 * and fails on any hit outside design/tokens.ts — so a stray literal is caught the
 * moment tests run. Consistency becomes mechanical, not disciplinary.
 *
 * Scope (M4b Phase 1): .ts/.tsx source only. Excluded: this pattern-bearing test file,
 * every *.test.ts(x) (tests are not rendered UI), and design/tokens.ts (the one allowed
 * home). styles.css is legacy M3-plain styling being superseded by inline token styles;
 * migrating its literals to CSS-variables-from-tokens is a later pass (see DECISIONS.md).
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LAYERS } from './tokens';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..'); // apps/mobile/src
const TOKENS_FILE = join('design', 'tokens.ts'); // the single source of colour

// CSS colour literals: hex (#rgb / #rgba / #rrggbb / #rrggbbaa) and the colour
// functions. Kept narrow so hash routes like "#/dev/card" never match.
const HEX = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;
const COLOUR_FN = /\b(?:rgb|rgba|hsl|hsla)\s*\(/;

function collectSource(dir: string, found: string[]): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSource(full, found);
      continue;
    }
    // .ts/.tsx only; test files are not rendered UI (and this file bears the patterns).
    if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) {
      continue;
    }
    found.push(full);
  }
  return found;
}

describe('visual constancy: colours live only in design/tokens.ts', () => {
  const files = collectSource(SRC, []).filter((file) => relative(SRC, file) !== TOKENS_FILE);

  it('scans a meaningful number of source files', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it('has no raw colour literal outside design/tokens.ts', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const rel = relative(SRC, file).split(sep).join('/');
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          if (HEX.test(line) || COLOUR_FN.test(line)) {
            offenders.push(`${rel}:${index + 1}  ${line.trim()}`);
          }
        });
    }
    expect(
      offenders,
      `raw colour literals found — move them into design/tokens.ts:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});

// P2 (owner phone test 1 Aug): the ONE stacking scale. This locks the ordering the layer audit
// depends on, so a future edit that reshuffles a value can't silently reintroduce a slab-over-card
// or ticker-over-card bug — the relationships are asserted, not eyeballed.
describe('LAYERS: the one stacking scale, low → high', () => {
  it('is strictly increasing in its documented order', () => {
    const order = [
      LAYERS.felt,
      LAYERS.board,
      LAYERS.myArea,
      LAYERS.wheel,
      LAYERS.ticker,
      LAYERS.stage,
      LAYERS.nav,
      LAYERS.inspect,
      LAYERS.dropBand,
      LAYERS.dragGhost,
      LAYERS.surface,
      LAYERS.sheet,
      LAYERS.advice,
      LAYERS.toast,
      LAYERS.end,
      LAYERS.badge,
      LAYERS.hud,
    ];
    for (let i = 1; i < order.length; i++) {
      expect(order[i]!).toBeGreaterThan(order[i - 1]!);
    }
  });

  it('holds the relationships the three owner-shot bugs depend on', () => {
    // A played/received card always beats the ticker (bug: ticker over the card).
    expect(LAYERS.stage).toBeGreaterThan(LAYERS.ticker);
    // The drag ghost rides above the inspect overlay (so you can drag a card out of it)…
    expect(LAYERS.dragGhost).toBeGreaterThan(LAYERS.inspect);
    // …but under the modal response surfaces the game waits on.
    expect(LAYERS.surface).toBeGreaterThan(LAYERS.dragGhost);
    // Response sheets over generic surfaces; the advice card over the sheets it explains.
    expect(LAYERS.sheet).toBeGreaterThan(LAYERS.surface);
    expect(LAYERS.advice).toBeGreaterThan(LAYERS.sheet);
    // The end panel is above every in-play surface; the HUD is above everything.
    expect(LAYERS.end).toBeGreaterThan(LAYERS.sheet);
    expect(LAYERS.hud).toBe(Math.max(...Object.values(LAYERS)));
  });
});
