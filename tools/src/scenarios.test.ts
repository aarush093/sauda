/**
 * The scenario fixture is only useful if its recorded logs still reach their states. This
 * test replays every committed entry from a fresh seeded game and asserts (a) every logged
 * action is still legal and (b) the state's own predicate holds at the end — the guarantee
 * that "any future session can jump straight to a state" actually holds.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyScenario, SCENARIO_IDS } from './scenarios';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(resolve(here, '../fixtures/scenarios.json'), 'utf8')) as {
  states: Record<string, { found: boolean; seed?: number; turn?: number; actions?: unknown[]; searched?: number }>;
};

describe('Phase-B scenario fixtures replay deterministically to their states', () => {
  for (const id of SCENARIO_IDS) {
    it(`${id}: recorded log lands on the state`, () => {
      const entry = fixture.states[id];
      expect(entry, `missing fixture entry for ${id}`).toBeDefined();
      if (!entry!.found) {
        // NOT FOUND is an allowed, honest outcome — but it must record the search size.
        expect(entry!.searched).toBeGreaterThan(0);
        return;
      }
      const { replayed, matches } = verifyScenario(id, entry!.seed!, entry!.actions as never);
      expect(replayed, `${id}: a logged action was rejected on replay`).toBe(true);
      expect(matches, `${id}: the state predicate did not hold after replay`).toBe(true);
    });
  }
});
