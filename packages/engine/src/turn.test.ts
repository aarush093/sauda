/**
 * Turn-flow rules and the non-interrupt named edge cases (§4.1–§4.6, §8.2).
 * Edge cases covered here: #12 kiraya ownership, #13 building rent bonus,
 * #14 empty-hand draw 5, #15 discard-to-7, #16 reshuffle, #17 rearrange,
 * #18 win declared own-turn only.
 */
import { describe, it, expect } from 'vitest';
import { createGame } from './setup';
import { reduce } from './reduce';
import { legalActions } from './legal';
import { checkInvariants } from './invariants';
import { kirayaFor } from './sets';
import { makeState, step } from './testkit';
import type { Action } from './actions';

function hasType(actions: Action[], type: Action['type']): boolean {
  return actions.some((a) => a.type === type);
}

describe('setup (§4.2)', () => {
  it('deals 5 to each player and keeps all 106 cards accounted for', () => {
    const { state } = createGame({ players: 3, seed: 7 });
    expect(state.players).toHaveLength(3);
    for (const player of state.players) {
      expect(player.hand).toHaveLength(5);
    }
    expect(state.drawPile).toHaveLength(106 - 3 * 5);
    expect(state.phase).toBe('awaitingDraw');
    expect(checkInvariants(state).ok).toBe(true);
  });
});

describe('draw (§4.4 step 2)', () => {
  it('draws 2 normally and moves to the playing phase', () => {
    const { state } = createGame({ players: 2, seed: 1 });
    const next = step(state, { type: 'DRAW' });
    expect(next.players[0]!.hand).toHaveLength(7);
    expect(next.phase).toBe('playing');
  });

  it('draws 5 when the hand is empty at turn start (#14)', () => {
    const state = makeState({ players: [{ hand: [] }, {}], phase: 'awaitingDraw' });
    const next = step(state, { type: 'DRAW' });
    expect(next.players[0]!.hand).toHaveLength(5);
  });

  it('refuses a second draw in the same turn', () => {
    const state = makeState({ players: [{ hand: ['money_1_0'] }, {}], phase: 'playing' });
    const result = reduce(state, { type: 'DRAW' });
    expect(result.ok).toBe(false);
  });

  it('reshuffles the discard pile when the draw pile is empty (#16)', () => {
    const base = makeState({ players: [{ hand: ['money_1_0'] }, {}], phase: 'awaitingDraw' });
    // Force the draw pile empty and push everything into the discard pile.
    const state = { ...base, discardPile: base.drawPile, drawPile: [] };
    const result = reduce(state, { type: 'DRAW' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.events.some((e) => e.type === 'DrawPileReshuffled')).toBe(true);
      expect(result.value.state.players[0]!.hand).toHaveLength(3); // 1 + drew 2
      expect(checkInvariants(result.value.state).ok).toBe(true);
    }
  });
});

describe('plays (§4.4 step 3)', () => {
  it('banks a money card and consumes one play', () => {
    const state = makeState({ players: [{ hand: ['money_5_0'] }, {}], playsRemaining: 3 });
    const next = step(state, { type: 'BANK_CARD', cardId: 'money_5_0' });
    expect(next.players[0]!.bank).toContain('money_5_0');
    expect(next.playsRemaining).toBe(2);
  });

  it('refuses to bank a property card', () => {
    const state = makeState({ players: [{ hand: ['prop_mumbai_0'] }, {}] });
    const result = reduce(state, { type: 'BANK_CARD', cardId: 'prop_mumbai_0' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('CANNOT_BANK');
    }
  });

  it('places a property into its colour group', () => {
    const state = makeState({ players: [{ hand: ['prop_mumbai_0'] }, {}] });
    const next = step(state, { type: 'PLACE_PROPERTY', cardId: 'prop_mumbai_0', set: 'mumbai' });
    expect(next.players[0]!.properties.mumbai[0]!.cards).toContain('prop_mumbai_0');
    expect(next.playsRemaining).toBe(2);
  });
});

describe('rearrange wildcards (#17)', () => {
  it('is free (no play consumed) and stays on your own turn', () => {
    const state = makeState({
      players: [{ properties: { jaipur: { cards: ['wild_jaipur_kolkata_0'] } } }, {}],
      playsRemaining: 3,
    });
    const next = step(state, {
      type: 'REARRANGE_WILDCARD',
      cardId: 'wild_jaipur_kolkata_0',
      toSet: 'kolkata',
    });
    expect(next.players[0]!.properties.kolkata[0]!.cards).toContain('wild_jaipur_kolkata_0');
    expect(next.players[0]!.properties.jaipur).toHaveLength(0); // emptied group is pruned
    expect(next.playsRemaining).toBe(3); // free, not a play
  });

  it('is not offered to a player whose turn it is not', () => {
    const state = makeState({
      players: [{}, { properties: { jaipur: { cards: ['wild_jaipur_kolkata_0'] } } }],
      currentPlayerIndex: 0,
    });
    expect(legalActions(state, 1)).toHaveLength(0);
  });
});

describe('discard to the hand limit (#15)', () => {
  it('forces discards down to 7 before the turn passes', () => {
    const nineCards = [
      'money_1_0', 'money_1_1', 'money_1_2', 'money_1_3', 'money_1_4',
      'money_2_0', 'money_2_1', 'money_2_2', 'money_2_3',
    ];
    let state = makeState({ players: [{ hand: nineCards }, {}], phase: 'playing' });
    state = step(state, { type: 'END_TURN' });
    expect(state.phase).toBe('awaitingDiscard');

    state = step(state, { type: 'DISCARD', cardId: 'money_1_0' });
    expect(state.phase).toBe('awaitingDiscard'); // still 8 in hand
    state = step(state, { type: 'DISCARD', cardId: 'money_1_1' });

    expect(state.players[0]!.hand).toHaveLength(7);
    expect(state.phase).toBe('awaitingDraw');
    expect(state.currentPlayerIndex).toBe(1); // turn passed
  });
});

describe('winning (§4.1, #18)', () => {
  const threeSets = {
    mumbai: { cards: ['prop_mumbai_0', 'prop_mumbai_1'] },
    puraniDilli: { cards: ['prop_puraniDilli_0', 'prop_puraniDilli_1'] },
    utility: { cards: ['prop_utility_0', 'prop_utility_1'] },
  };

  it('cannot be declared off-turn even with 3 sets', () => {
    const state = makeState({
      players: [{}, { properties: threeSets }],
      currentPlayerIndex: 0,
      phase: 'playing',
    });
    // Player 1 holds the winning board but it is not their turn.
    expect(legalActions(state, 1)).toHaveLength(0);
  });

  it('is offered and works on the winner’s own turn', () => {
    const state = makeState({
      players: [{}, { properties: threeSets }],
      currentPlayerIndex: 1,
      phase: 'awaitingDraw',
    });
    expect(hasType(legalActions(state, 1), 'DECLARE_WIN')).toBe(true);
    const next = step(state, { type: 'DECLARE_WIN' });
    expect(next.winnerIndex).toBe(1);
    expect(next.phase).toBe('gameOver');
  });
});

describe('kiraya rules (§5)', () => {
  it('requires ownership of the chosen colour (#12)', () => {
    const state = makeState({
      players: [{ hand: ['kiraya_jaipur_kolkata_0'], properties: { jaipur: { cards: ['prop_jaipur_0'] } } }, {}],
      playsRemaining: 3,
    });
    // Owns jaipur → allowed.
    expect(reduce(state, { type: 'PLAY_KIRAYA', cardId: 'kiraya_jaipur_kolkata_0', color: 'jaipur', target: null, dugnaCardIds: [] }).ok).toBe(true);
    // Does not own kolkata → rejected.
    const bad = reduce(state, { type: 'PLAY_KIRAYA', cardId: 'kiraya_jaipur_kolkata_0', color: 'kolkata', target: null, dugnaCardIds: [] });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.error.code).toBe('COLOR_NOT_OWNED');
    }
  });

  it('adds a building bonus only when the set is complete (#13)', () => {
    // mumbai is size 2; a complete set with a makaan earns rent[1]=8 plus ₹3.
    const complete = makeState({
      players: [
        { properties: { mumbai: { cards: ['prop_mumbai_0', 'prop_mumbai_1'], buildings: ['action_makaan_0'] } } },
        {},
      ],
    });
    expect(kirayaFor(complete, 0, 'mumbai', 0)).toBe(8 + 3);

    // The same makaan on an incomplete set (1 property) earns rent[0]=3 and NO bonus.
    const incomplete = makeState({
      players: [
        { properties: { mumbai: { cards: ['prop_mumbai_0'], buildings: ['action_makaan_0'] } } },
        {},
      ],
    });
    expect(kirayaFor(incomplete, 0, 'mumbai', 0)).toBe(3);
  });
});
