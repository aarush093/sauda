/**
 * Folds each curated fixture through `reduce`, asserts it stays legal and invariant,
 * and writes the golden JSON to `packages/engine/fixtures/`. These files are the M6
 * Python parity gate: the Gymnasium port must replay each one bit-for-bit.
 */
import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reduce } from './reduce';
import { checkInvariants } from './invariants';
import { FIXTURES } from './fixtures';
import type { GameEvent, GameState } from './state';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

describe('fixtures export (§8.2, M6 parity gate)', () => {
  mkdirSync(FIXTURES_DIR, { recursive: true });

  for (const fixture of FIXTURES) {
    it(`${fixture.name}: replays cleanly and is exported`, () => {
      const initialState = fixture.build();
      let state: GameState = initialState;
      const events: GameEvent[] = [];

      for (const action of fixture.actions) {
        const result = reduce(state, action);
        expect(result.ok, `action ${action.type} in ${fixture.name}`).toBe(true);
        if (!result.ok) {
          return;
        }
        state = result.value.state;
        events.push(...result.value.events);
        expect(checkInvariants(state).ok).toBe(true);
      }

      const golden = {
        name: fixture.name,
        description: fixture.description,
        initialState,
        actions: fixture.actions,
        finalState: state,
        events,
      };
      writeFileSync(join(FIXTURES_DIR, `${fixture.name}.json`), JSON.stringify(golden, null, 2));
    });
  }
});
