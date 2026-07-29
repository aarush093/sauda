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
import { observe } from './observe';
import { kirayaFor } from './sets';
import { payableCards } from './payment';
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

describe('banked actions are money forever (rule audit #1)', () => {
  it('banks NAHI CHALEGA for its ₹ value; once banked it can never be played for its effect', () => {
    // NAHI CHALEGA (value ₹4) banked from hand → it leaves the hand for the bank.
    let state = makeState({ players: [{ hand: ['action_nahiChalega_0'] }, {}], phase: 'playing', playsRemaining: 3 });
    state = step(state, { type: 'BANK_CARD', cardId: 'action_nahiChalega_0' });
    expect(state.players[0]!.bank).toContain('action_nahiChalega_0');
    expect(state.players[0]!.hand).toHaveLength(0); // no longer in hand
    expect(state.playsRemaining).toBe(2); // banking cost one play
    expect(observe(state, 0).myBankTotal).toBe(4); // banked at its ₹ value

    // A banked NAHI is money: it can NEVER respond to a charge again. Charge a player
    // whose only NAHI CHALEGA sits in the bank, not the hand.
    let charged = makeState({
      players: [
        { hand: ['action_vasooli_0'] },
        { bank: ['action_nahiChalega_0', 'money_1_0'] }, // NAHI banked + a ₹1 note
      ],
      currentPlayerIndex: 0,
      playsRemaining: 3,
    });
    charged = step(charged, { type: 'PLAY_ACTION', cardId: 'action_vasooli_0', params: { action: 'vasooli', target: 1 } });

    // No RESPOND_NAHI_CHALEGA is offered — the effect is unreachable once banked
    // (legalActions reads NAHI from the hand only). Comply is the only response.
    const responses = legalActions(charged, 1);
    expect(responses.some((a) => a.type === 'RESPOND_NAHI_CHALEGA')).toBe(false);
    expect(responses.some((a) => a.type === 'RESPOND_ALLOW')).toBe(true);

    // It survives ONLY as payment material: after complying, the banked NAHI is a
    // payable card (money), never an effect.
    charged = step(charged, { type: 'RESPOND_ALLOW' });
    expect(payableCards(charged, 1)).toContain('action_nahiChalega_0');
    expect(checkInvariants(charged).ok).toBe(true);
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

describe('discard to the hand limit (#15) — overflow recycles under the draw pile', () => {
  it('forces discards down to 7, buries them face-down under the draw pile, and passes the turn', () => {
    const nineCards = [
      'money_1_0', 'money_1_1', 'money_1_2', 'money_1_3', 'money_1_4',
      'money_2_0', 'money_2_1', 'money_2_2', 'money_2_3',
    ];
    let state = makeState({ players: [{ hand: nineCards }, {}], phase: 'playing' });
    const drawBefore = state.drawPile.length;
    state = step(state, { type: 'END_TURN' });
    expect(state.phase).toBe('awaitingDiscard'); // hand > 7 blocks the turn from ending

    state = step(state, { type: 'DISCARD', cardId: 'money_1_0' });
    expect(state.phase).toBe('awaitingDiscard'); // still 8 in hand
    state = step(state, { type: 'DISCARD', cardId: 'money_1_1' });

    expect(state.players[0]!.hand).toHaveLength(7);
    expect(state.phase).toBe('awaitingDraw');
    expect(state.currentPlayerIndex).toBe(1); // turn passed

    // Owner house rule: overflow goes FACE-DOWN to the BOTTOM of the draw pile (front),
    // in discard order — NOT to the discard pile.
    expect(state.discardPile).not.toContain('money_1_0');
    expect(state.discardPile).not.toContain('money_1_1');
    expect(state.drawPile).toHaveLength(drawBefore + 2);
    expect(state.drawPile.slice(0, 2)).toEqual(['money_1_1', 'money_1_0']); // last discarded at the very bottom

    // Hidden info: an opponent's view never exposes the buried cards' identity or
    // order — only the draw-pile COUNT reflects them.
    const opponentView = observe(state, 1);
    const asJson = JSON.stringify(opponentView);
    expect(asJson).not.toContain('money_1_0');
    expect(asJson).not.toContain('money_1_1');
    expect(opponentView.drawPileCount).toBe(state.drawPile.length);
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

  // B14 (VERIFY-ledger): LAGAAN target scope. A wild (ANY, targeted) LAGAAN charges ONE
  // chosen opponent; a colour-pair (targeted:false) charges ALL opponents. The engine
  // rejects the wrong target shape for each with BAD_TARGET (reduce.ts:513–526).
  it('wild LAGAAN charges ONE chosen opponent; rejects a null/self target (B14)', () => {
    const state = makeState({
      players: [
        { hand: ['kiraya_any_0'], properties: { jaipur: { cards: ['prop_jaipur_0'] } } },
        {},
        {},
      ],
      currentPlayerIndex: 0,
      playsRemaining: 3,
    });
    // A wild LAGAAN must name exactly one opponent — null and self are rejected.
    const noTarget = reduce(state, { type: 'PLAY_KIRAYA', cardId: 'kiraya_any_0', color: 'jaipur', target: null, dugnaCardIds: [] });
    expect(noTarget.ok).toBe(false);
    if (!noTarget.ok) {
      expect(noTarget.error.code).toBe('BAD_TARGET');
    }
    const selfTarget = reduce(state, { type: 'PLAY_KIRAYA', cardId: 'kiraya_any_0', color: 'jaipur', target: 0, dugnaCardIds: [] });
    expect(selfTarget.ok).toBe(false);
    if (!selfTarget.ok) {
      expect(selfTarget.error.code).toBe('BAD_TARGET');
    }
    // A valid opponent target opens exactly ONE charge, on that opponent.
    const good = reduce(state, { type: 'PLAY_KIRAYA', cardId: 'kiraya_any_0', color: 'jaipur', target: 1, dugnaCardIds: [] });
    expect(good.ok).toBe(true);
    if (good.ok) {
      expect(good.value.state.pendingInterrupts).toHaveLength(1);
      expect(good.value.state.pendingInterrupts[0]!.target).toBe(1);
    }
  });

  it('paired LAGAAN charges ALL opponents; rejects a named target (B14)', () => {
    const state = makeState({
      players: [
        { hand: ['kiraya_jaipur_kolkata_0'], properties: { jaipur: { cards: ['prop_jaipur_0'] } } },
        {},
        {},
      ],
      currentPlayerIndex: 0,
      playsRemaining: 3,
    });
    // A colour-pair LAGAAN may not single out a target.
    const named = reduce(state, { type: 'PLAY_KIRAYA', cardId: 'kiraya_jaipur_kolkata_0', color: 'jaipur', target: 1, dugnaCardIds: [] });
    expect(named.ok).toBe(false);
    if (!named.ok) {
      expect(named.error.code).toBe('BAD_TARGET');
    }
    // target:null opens one charge PER opponent — both P1 and P2 here.
    const all = reduce(state, { type: 'PLAY_KIRAYA', cardId: 'kiraya_jaipur_kolkata_0', color: 'jaipur', target: null, dugnaCardIds: [] });
    expect(all.ok).toBe(true);
    if (all.ok) {
      expect(all.value.state.pendingInterrupts.map((frame) => frame.target)).toEqual([1, 2]);
    }
  });
});

// B19 (VERIFY-ledger): building-placement prerequisites, exercised through reduce (NOT
// pre-placed state). MAKAAN needs a COMPLETE set and never Junctions/Utilities; HAVELI
// needs that complete set to ALREADY hold a MAKAAN (reduce.ts:337–367).
describe('building placement (§5, B19)', () => {
  it('MAKAAN is rejected on an incomplete set (NO_MAKAAN_SPOT)', () => {
    const state = makeState({
      players: [{ hand: ['action_makaan_0'], properties: { mumbai: { cards: ['prop_mumbai_0'] } } }, {}],
      currentPlayerIndex: 0,
      playsRemaining: 3,
    });
    const result = reduce(state, { type: 'PLAY_ACTION', cardId: 'action_makaan_0', params: { action: 'makaan', set: 'mumbai' } });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NO_MAKAAN_SPOT');
    }
  });

  it('MAKAAN cannot go on Junctions even when complete (NO_BUILDING_HERE)', () => {
    const state = makeState({
      players: [
        {
          hand: ['action_makaan_0'],
          properties: { junction: { cards: ['prop_junction_0', 'prop_junction_1', 'prop_junction_2', 'prop_junction_3'] } },
        },
        {},
      ],
      currentPlayerIndex: 0,
      playsRemaining: 3,
    });
    const result = reduce(state, { type: 'PLAY_ACTION', cardId: 'action_makaan_0', params: { action: 'makaan', set: 'junction' } });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NO_BUILDING_HERE');
    }
  });

  it('HAVELI needs a MAKAAN on the set first (NO_HAVELI_SPOT)', () => {
    const state = makeState({
      players: [{ hand: ['action_haveli_0'], properties: { mumbai: { cards: ['prop_mumbai_0', 'prop_mumbai_1'] } } }, {}],
      currentPlayerIndex: 0,
      playsRemaining: 3,
    });
    const result = reduce(state, { type: 'PLAY_ACTION', cardId: 'action_haveli_0', params: { action: 'haveli', set: 'mumbai' } });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NO_HAVELI_SPOT');
    }
  });

  it('MAKAAN then HAVELI both attach to a complete set via reduce', () => {
    let state = makeState({
      players: [
        { hand: ['action_makaan_0', 'action_haveli_0'], properties: { mumbai: { cards: ['prop_mumbai_0', 'prop_mumbai_1'] } } },
        {},
      ],
      currentPlayerIndex: 0,
      playsRemaining: 3,
    });
    state = step(state, { type: 'PLAY_ACTION', cardId: 'action_makaan_0', params: { action: 'makaan', set: 'mumbai' } });
    state = step(state, { type: 'PLAY_ACTION', cardId: 'action_haveli_0', params: { action: 'haveli', set: 'mumbai' } });
    expect(state.players[0]!.properties.mumbai[0]!.buildings).toEqual(['action_makaan_0', 'action_haveli_0']);
    expect(checkInvariants(state).ok).toBe(true);
  });
});
