/**
 * Interrupt stack, NAHI CHALEGA chains, and the action cards that open response
 * windows (§5, §8.2). Edge cases here: #6 steal/swap blocked on complete sets,
 * #7 KABZA transfers buildings, #8 NAHI chain depth 3, #9 NAHI never consumes a
 * play and works off-turn, #10 SHAGUN with mixed responses, #11 DUGNA stacking.
 */
import { describe, it, expect } from 'vitest';
import { reduce } from './reduce';
import { legalActions } from './legal';
import { checkInvariants } from './invariants';
import { chargeStandsByLifo, chargeStandsByParity } from './interrupts';
import { makeState, step } from './testkit';
import type { GameState } from './state';

function topResponder(state: GameState): number {
  return state.pendingInterrupts[state.pendingInterrupts.length - 1]!.responder;
}

describe('NAHI CHALEGA parity model (§5)', () => {
  it('parity matches the literal LIFO stack for chain depths 0–4 (DECISIONS.md)', () => {
    for (let depth = 0; depth <= 4; depth++) {
      expect(chargeStandsByParity(depth)).toBe(chargeStandsByLifo(depth));
    }
  });
});

describe('VASOOLI charge (§5)', () => {
  it('a depth-3 NAHI chain cancels the charge and consumes no plays (#8, #9)', () => {
    let state = makeState({
      players: [
        { hand: ['action_vasooli_0', 'action_nahiChalega_2'] }, // origin also holds one NAHI
        { hand: ['action_nahiChalega_0', 'action_nahiChalega_1'], bank: ['money_5_0'] },
      ],
      currentPlayerIndex: 0,
      playsRemaining: 3,
    });

    state = step(state, { type: 'PLAY_ACTION', cardId: 'action_vasooli_0', params: { action: 'vasooli', target: 1 } });
    expect(state.playsRemaining).toBe(2); // VASOOLI cost one play

    // Off-turn: the target (player 1) responds even though it is player 0's turn (#9).
    expect(legalActions(state, 0)).toHaveLength(0);
    expect(legalActions(state, 1).length).toBeGreaterThan(0);

    // Chain: target, origin, target — three NAHIs.
    expect(topResponder(state)).toBe(1);
    state = step(state, { type: 'RESPOND_NAHI_CHALEGA', cardId: 'action_nahiChalega_0' });
    expect(topResponder(state)).toBe(0);
    state = step(state, { type: 'RESPOND_NAHI_CHALEGA', cardId: 'action_nahiChalega_2' });
    expect(topResponder(state)).toBe(1);
    state = step(state, { type: 'RESPOND_NAHI_CHALEGA', cardId: 'action_nahiChalega_1' });
    expect(topResponder(state)).toBe(0);

    // Origin has no NAHI left → allows. Odd chain ⇒ cancelled, no payment.
    state = step(state, { type: 'RESPOND_ALLOW' });
    expect(state.pendingInterrupts).toHaveLength(0);
    expect(state.playsRemaining).toBe(2); // NAHIs consumed no plays
    expect(state.players[0]!.bank).not.toContain('money_5_0'); // never paid
    expect(checkInvariants(state).ok).toBe(true);
  });

  it('stands and is paid when no one cancels', () => {
    let state = makeState({
      players: [{ hand: ['action_vasooli_0'] }, { bank: ['money_5_0'] }],
      currentPlayerIndex: 0,
      playsRemaining: 3,
    });
    state = step(state, { type: 'PLAY_ACTION', cardId: 'action_vasooli_0', params: { action: 'vasooli', target: 1 } });
    state = step(state, { type: 'RESPOND_ALLOW' }); // target complies
    // Only one payable card worth exactly ₹5 → pay it.
    state = step(state, { type: 'RESPOND_PAY', cardIds: ['money_5_0'] });
    expect(state.players[0]!.bank).toContain('money_5_0');
    expect(state.pendingInterrupts).toHaveLength(0);
    expect(checkInvariants(state).ok).toBe(true);
  });
});

describe('SHAGUN — every opponent, independent responses (#10)', () => {
  it('one opponent cancels while the others pay', () => {
    let state = makeState({
      players: [
        { hand: ['action_shagun_0'] },
        { hand: ['action_nahiChalega_0'] }, // player 1 will cancel
        { bank: ['money_2_0'] }, // player 2 pays
        { bank: ['money_2_1'] }, // player 3 pays
      ],
      currentPlayerIndex: 0,
      playsRemaining: 3,
    });

    state = step(state, { type: 'PLAY_ACTION', cardId: 'action_shagun_0', params: { action: 'shagun' } });
    expect(state.pendingInterrupts).toHaveLength(3);

    // Frames resolve top-first: player 3, then 2, then 1.
    expect(topResponder(state)).toBe(3);
    state = step(state, { type: 'RESPOND_ALLOW' });
    state = step(state, { type: 'RESPOND_PAY', cardIds: ['money_2_1'] });

    expect(topResponder(state)).toBe(2);
    state = step(state, { type: 'RESPOND_ALLOW' });
    state = step(state, { type: 'RESPOND_PAY', cardIds: ['money_2_0'] });

    expect(topResponder(state)).toBe(1);
    state = step(state, { type: 'RESPOND_NAHI_CHALEGA', cardId: 'action_nahiChalega_0' });
    state = step(state, { type: 'RESPOND_ALLOW' }); // origin allows; odd chain ⇒ cancelled

    expect(state.pendingInterrupts).toHaveLength(0);
    expect(state.players[0]!.bank).toEqual(expect.arrayContaining(['money_2_0', 'money_2_1']));
    expect(state.players[0]!.bank).toHaveLength(2); // player 1 paid nothing
    expect(checkInvariants(state).ok).toBe(true);
  });
});

describe('KABZA (#7)', () => {
  it('takes a complete set including its buildings', () => {
    let state = makeState({
      players: [
        { hand: ['action_kabza_0'] },
        { properties: { mumbai: { cards: ['prop_mumbai_0', 'prop_mumbai_1'], buildings: ['action_makaan_0'] } } },
      ],
      currentPlayerIndex: 0,
      playsRemaining: 3,
    });
    state = step(state, { type: 'PLAY_ACTION', cardId: 'action_kabza_0', params: { action: 'kabza', target: 1, set: 'mumbai' } });
    state = step(state, { type: 'RESPOND_ALLOW' }); // target has no NAHI

    expect(state.players[0]!.properties.mumbai[0]!.cards).toEqual(['prop_mumbai_0', 'prop_mumbai_1']);
    expect(state.players[0]!.properties.mumbai[0]!.buildings).toEqual(['action_makaan_0']);
    expect(state.players[1]!.properties.mumbai).toHaveLength(0); // stolen group removed
    expect(checkInvariants(state).ok).toBe(true);
  });
});

describe('steal/swap blocked on complete sets (#6)', () => {
  it('HAATH KI SAFAI cannot take from a complete set', () => {
    const state = makeState({
      players: [
        { hand: ['action_haathKiSafai_0'] },
        { properties: { mumbai: { cards: ['prop_mumbai_0', 'prop_mumbai_1'] } } },
      ],
      currentPlayerIndex: 0,
    });
    const result = reduce(state, {
      type: 'PLAY_ACTION',
      cardId: 'action_haathKiSafai_0',
      params: { action: 'haathKiSafai', target: 1, cardId: 'prop_mumbai_0' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('SET_COMPLETE');
    }
  });

  it('ADLA-BADLI cannot swap out of your own complete set', () => {
    const state = makeState({
      players: [
        {
          hand: ['action_adlaBadli_0'],
          properties: { mumbai: { cards: ['prop_mumbai_0', 'prop_mumbai_1'] } },
        },
        { properties: { jaipur: { cards: ['prop_jaipur_0'] } } },
      ],
      currentPlayerIndex: 0,
    });
    const result = reduce(state, {
      type: 'PLAY_ACTION',
      cardId: 'action_adlaBadli_0',
      params: { action: 'adlaBadli', myCardId: 'prop_mumbai_0', target: 1, theirCardId: 'prop_jaipur_0' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('SET_COMPLETE');
    }
  });
});

describe('received wildcard placement (#19)', () => {
  it('lets the receiver choose the group for a wildcard paid to them', () => {
    let state = makeState({
      players: [
        { hand: ['action_vasooli_0'] },
        { properties: { jaipur: { cards: ['wild_jaipur_kolkata_0'] } } },
      ],
      currentPlayerIndex: 0,
      playsRemaining: 3,
    });
    state = step(state, { type: 'PLAY_ACTION', cardId: 'action_vasooli_0', params: { action: 'vasooli', target: 1 } });
    state = step(state, { type: 'RESPOND_ALLOW' });
    // The target's only table card is a ₹2 wildcard; table < debt ⇒ pay all.
    state = step(state, { type: 'RESPOND_PAY', cardIds: ['wild_jaipur_kolkata_0'] });

    const frame = state.pendingInterrupts[state.pendingInterrupts.length - 1]!;
    expect(frame.status).toBe('awaitingReceive');
    expect(frame.responder).toBe(0); // the creditor, not the payer, chooses the group

    state = step(state, { type: 'RESPOND_PLACE_RECEIVED', cardId: 'wild_jaipur_kolkata_0', set: 'kolkata' });
    expect(state.pendingInterrupts).toHaveLength(0);
    expect(state.players[0]!.properties.kolkata[0]!.cards).toContain('wild_jaipur_kolkata_0');
    expect(checkInvariants(state).ok).toBe(true);
  });
});

describe('DUGNA stacking (#11)', () => {
  it('doubles per DUGNA and consumes one play each', () => {
    // jaipur is size 3; a complete set earns rent[2]=4. Two DUGNAs ⇒ 4 × 2² = 16.
    let state = makeState({
      players: [
        {
          hand: ['kiraya_jaipur_kolkata_0', 'action_dugna_0', 'action_dugna_1'],
          properties: { jaipur: { cards: ['prop_jaipur_0', 'prop_jaipur_1', 'prop_jaipur_2'] } },
        },
        {},
      ],
      currentPlayerIndex: 0,
      playsRemaining: 3,
    });
    state = step(state, {
      type: 'PLAY_KIRAYA',
      cardId: 'kiraya_jaipur_kolkata_0',
      color: 'jaipur',
      target: null,
      dugnaCardIds: ['action_dugna_0', 'action_dugna_1'],
    });
    expect(state.playsRemaining).toBe(0); // 1 for kiraya + 2 for dugnas
    const frame = state.pendingInterrupts[0]!;
    expect(frame.effect).toEqual({ kind: 'charge', amount: 16 });
  });

  it('rejects DUGNA when there are not enough plays left', () => {
    const state = makeState({
      players: [
        {
          hand: ['kiraya_jaipur_kolkata_0', 'action_dugna_0', 'action_dugna_1'],
          properties: { jaipur: { cards: ['prop_jaipur_0', 'prop_jaipur_1', 'prop_jaipur_2'] } },
        },
        {},
      ],
      currentPlayerIndex: 0,
      playsRemaining: 2, // needs 3
    });
    const result = reduce(state, {
      type: 'PLAY_KIRAYA',
      cardId: 'kiraya_jaipur_kolkata_0',
      color: 'jaipur',
      target: null,
      dugnaCardIds: ['action_dugna_0', 'action_dugna_1'],
    });
    expect(result.ok).toBe(false);
  });
});
