/**
 * Set-overflow model and the distinct-colour win condition.
 *
 * - A colour can hold more than one set; surplus cards form a SECOND set of that
 *   colour rather than overfilling the first.
 * - Each group is its own set: two complete same-colour sets count as 2 sets but
 *   only 1 colour, and rent is charged per group (not summed across the colour).
 * - The win needs 3 complete sets of 3 DIFFERENT colours (§4.1).
 */
import { describe, it, expect } from 'vitest';
import {
  completeSetCount,
  distinctCompleteColorCount,
  hasThreeCompleteSets,
  kirayaFor,
  makeState,
  step,
} from './index';

describe('win condition — distinct colours (§4.1)', () => {
  it('does NOT win with two same-colour sets + one other (only 2 colours)', () => {
    const state = makeState({
      players: [
        {
          properties: {
            // two complete jaipur sets (size 3 each)
            jaipur: [
              { cards: ['prop_jaipur_0', 'prop_jaipur_1', 'prop_jaipur_2'] },
              { cards: ['wild_jaipur_kolkata_0', 'wild_jaipur_kolkata_1', 'wild_any_0'] },
            ],
            // one complete mumbai set (size 2)
            mumbai: { cards: ['prop_mumbai_0', 'prop_mumbai_1'] },
          },
        },
        {},
      ],
    });
    expect(completeSetCount(state, 0)).toBe(3); // three complete sets…
    expect(distinctCompleteColorCount(state, 0)).toBe(2); // …but only two colours
    expect(hasThreeCompleteSets(state, 0)).toBe(false); // so NOT a win
  });

  it('wins with three complete sets of three different colours', () => {
    const state = makeState({
      players: [
        {
          properties: {
            mumbai: { cards: ['prop_mumbai_0', 'prop_mumbai_1'] },
            puraniDilli: { cards: ['prop_puraniDilli_0', 'prop_puraniDilli_1'] },
            utility: { cards: ['prop_utility_0', 'prop_utility_1'] },
          },
        },
        {},
      ],
    });
    expect(hasThreeCompleteSets(state, 0)).toBe(true);
  });
});

describe('set overflow', () => {
  it('routes surplus into a SECOND set instead of overfilling the first', () => {
    let state = makeState({
      players: [
        {
          hand: ['wild_jaipur_kolkata_0'],
          properties: { jaipur: { cards: ['prop_jaipur_0', 'prop_jaipur_1', 'prop_jaipur_2'] } },
        },
        {},
      ],
      playsRemaining: 3,
    });
    state = step(state, { type: 'PLACE_PROPERTY', cardId: 'wild_jaipur_kolkata_0', set: 'jaipur' });

    const groups = state.players[0]!.properties.jaipur;
    expect(groups).toHaveLength(2); // a second jaipur set formed
    expect(groups[0]!.cards).toHaveLength(3); // the first set was NOT overfilled
    expect(groups[1]!.cards).toEqual(['wild_jaipur_kolkata_0']); // surplus went to the new set
  });

  it('counts a second complete same-colour set as a set but not a new colour', () => {
    const state = makeState({
      players: [
        {
          properties: {
            jaipur: [
              { cards: ['prop_jaipur_0', 'prop_jaipur_1', 'prop_jaipur_2'] },
              { cards: ['wild_jaipur_kolkata_0', 'wild_jaipur_kolkata_1', 'wild_any_0'] },
            ],
          },
        },
        {},
      ],
    });
    expect(completeSetCount(state, 0)).toBe(2); // two sets
    expect(distinctCompleteColorCount(state, 0)).toBe(1); // one colour
  });

  it('charges rent per group — the best set, not summed across the colour', () => {
    const state = makeState({
      players: [
        {
          properties: {
            jaipur: [
              { cards: ['prop_jaipur_0', 'prop_jaipur_1', 'prop_jaipur_2'] }, // rent[2] = 4
              { cards: ['wild_jaipur_kolkata_0', 'wild_jaipur_kolkata_1', 'wild_any_0'] }, // rent[2] = 4
            ],
          },
        },
        {},
      ],
    });
    // Best single set's rent is ₹4 — NOT ₹8 summed across the two sets.
    expect(kirayaFor(state, 0, 'jaipur', 0)).toBe(4);
  });
});
