import { describe, it, expect } from 'vitest';
import { SETS } from '@sauda/engine';
import type { Action, Observation, PropertyGroup, SetId } from '@sauda/engine';
import {
  availableMechanics,
  coachFor,
  MECHANIC_PRIORITY,
  BOOK_CHAPTER_COUNT,
} from './onboarding';
import type { Mechanic } from './onboarding';

// W2 — the trigger predicates. The onboarding may only ever point at a move the engine already offered,
// so every predicate is a pure read of (Observation, legalActions). We build minimal observations by hand
// (the predicates read only myProperties / interrupt / myBankTotal) and hand the checker exactly the
// actions a real legalActions would return for that moment.

const ALL_SETS = Object.keys(SETS) as SetId[];

function emptyProps(): Record<SetId, PropertyGroup[]> {
  const record = {} as Record<SetId, PropertyGroup[]>;
  for (const set of ALL_SETS) {
    record[set] = [];
  }
  return record;
}

function obs(overrides: Partial<Observation> = {}): Observation {
  return {
    me: 0,
    phase: 'playing',
    currentPlayer: 0,
    playsRemaining: 3,
    turnCount: 1,
    myHand: [],
    myBank: [],
    myBankTotal: 0,
    myProperties: emptyProps(),
    myKiraya: {} as Record<SetId, number[]>,
    opponents: [],
    drawPileCount: 50,
    discardPile: [],
    interrupt: null,
    winnerIndex: null,
    ...overrides,
  };
}

describe('availableMechanics — first-availability predicates (W2)', () => {
  it('banking money: a BANK_CARD offer teaches "bank"', () => {
    const mechanics = availableMechanics(obs(), [{ type: 'BANK_CARD', cardId: 'money_5_0' }]);
    expect(mechanics).toContain('bank');
  });

  it('placing a property vs a wildcard is told apart by the card id', () => {
    const real = availableMechanics(obs(), [{ type: 'PLACE_PROPERTY', cardId: 'prop_mumbai_0', set: 'mumbai' }]);
    expect(real).toContain('place');
    expect(real).not.toContain('wildcard');

    const wild = availableMechanics(obs(), [{ type: 'PLACE_PROPERTY', cardId: 'wild_kashi_junction_0', set: 'junction' }]);
    expect(wild).toContain('wildcard');
    expect(wild).not.toContain('place');
  });

  it('completing a set: teaches only when a colour is exactly one property short', () => {
    const set = ALL_SETS.find((candidate) => SETS[candidate].size >= 2)!;
    const need = SETS[set].size;
    // A group one short of full (need - 1 real properties), plus a placement into that same colour.
    const nearComplete: PropertyGroup = {
      set,
      cards: Array.from({ length: need - 1 }, (_unused, index) => `prop_${set}_${index}` as string),
      buildings: [],
    };
    const props = emptyProps();
    props[set] = [nearComplete];
    const placement: Action = { type: 'PLACE_PROPERTY', cardId: `prop_${set}_${need - 1}`, set };

    expect(availableMechanics(obs({ myProperties: props }), [placement])).toContain('complete');
    // The same placement with NO existing group (a brand-new colour) teaches "place" but not "complete".
    expect(availableMechanics(obs(), [placement])).not.toContain('complete');
  });

  it('action-card kinds split into building / targeted / untargeted', () => {
    const building = availableMechanics(obs(), [{ type: 'PLAY_ACTION', cardId: 'action_makaan_0', params: { action: 'makaan', set: 'kashi' } }]);
    expect(building).toContain('building');

    const targeted = availableMechanics(obs(), [{ type: 'PLAY_ACTION', cardId: 'action_vasooli_0', params: { action: 'vasooli', target: 1 } }]);
    expect(targeted).toContain('target');

    const untargeted = availableMechanics(obs(), [{ type: 'PLAY_ACTION', cardId: 'action_shagun_0', params: { action: 'shagun' } }]);
    expect(untargeted).toContain('action');
  });

  it('LAGAAN alone teaches "lagaan"; a chargeable DUGNA attach also teaches "dugna"', () => {
    const plain = availableMechanics(obs(), [{ type: 'PLAY_KIRAYA', cardId: 'kiraya_a_b_0', color: 'kashi', target: null, dugnaCardIds: [] }]);
    expect(plain).toContain('lagaan');
    expect(plain).not.toContain('dugna');

    const doubled = availableMechanics(obs(), [{ type: 'PLAY_KIRAYA', cardId: 'kiraya_a_b_0', color: 'kashi', target: null, dugnaCardIds: ['action_dugna_0'] }]);
    expect(doubled).toContain('lagaan');
    expect(doubled).toContain('dugna');
  });

  it('the free rearrange, discard, declare and NAHI CHALEGA each teach their own mechanic', () => {
    expect(availableMechanics(obs(), [{ type: 'REARRANGE_WILDCARD', cardId: 'wild_kashi_junction_0', toSet: 'junction' }])).toContain('rearrange');
    expect(availableMechanics(obs(), [{ type: 'DISCARD', cardId: 'money_1_0' }])).toContain('discard');
    expect(availableMechanics(obs(), [{ type: 'DECLARE_WIN' }])).toContain('declare');
    expect(availableMechanics(obs(), [{ type: 'RESPOND_NAHI_CHALEGA', cardId: 'action_nahiChalega_0' }])).toContain('nahi');
  });

  it('being charged: "pay" teaches only with an open charge AND value to pay with', () => {
    const interrupt = { origin: 1, target: 0, status: 'open', effect: {} } as unknown as Observation['interrupt'];
    const pay: Action = { type: 'RESPOND_PAY', cardIds: [] };

    expect(availableMechanics(obs({ interrupt, myBankTotal: 5 }), [pay])).toContain('pay');
    // No open charge → nothing to pay yet.
    expect(availableMechanics(obs({ myBankTotal: 5 }), [pay])).not.toContain('pay');
    // A charge but nothing of value (the C4 case auto-resolves; no move to teach).
    expect(availableMechanics(obs({ interrupt, myBankTotal: 0 }), [pay])).not.toContain('pay');
  });

  it('returns [] when the engine offers nothing to teach (a bot turn passes actions=[])', () => {
    expect(availableMechanics(obs(), [])).toEqual([]);
  });

  it('when several are available at once, they come back in MECHANIC_PRIORITY order (one shows first)', () => {
    const interrupt = { origin: 1, target: 0, status: 'open', effect: {} } as unknown as Observation['interrupt'];
    const actions: Action[] = [
      { type: 'BANK_CARD', cardId: 'money_5_0' },
      { type: 'DECLARE_WIN' },
      { type: 'RESPOND_PAY', cardIds: [] },
    ];
    const mechanics = availableMechanics(obs({ interrupt, myBankTotal: 5 }), actions);
    // pay (response) before declare (win) before bank (a plain turn play).
    expect(mechanics).toEqual(['pay', 'declare', 'bank']);
  });

  it('is pure — it never mutates the actions it is handed', () => {
    const actions: Action[] = [{ type: 'BANK_CARD', cardId: 'money_5_0' }];
    const snapshot = JSON.stringify(actions);
    availableMechanics(obs(), actions);
    expect(JSON.stringify(actions)).toBe(snapshot);
  });
});

describe('coach content (W2)', () => {
  it('every mechanic has copy, a valid gesture, and an in-range Book chapter', () => {
    for (const mechanic of MECHANIC_PRIORITY) {
      const coach = coachFor(mechanic);
      expect(coach.mechanic).toBe(mechanic);
      expect(coach.title.length).toBeGreaterThan(0);
      expect(coach.line.length).toBeGreaterThan(0);
      expect(['drag', 'tap', 'point']).toContain(coach.gesture);
      expect(coach.niyam).toBeGreaterThanOrEqual(1);
      expect(coach.niyam).toBeLessThanOrEqual(BOOK_CHAPTER_COUNT);
    }
  });

  it('MECHANIC_PRIORITY lists every mechanic exactly once', () => {
    const unique = new Set<Mechanic>(MECHANIC_PRIORITY);
    expect(unique.size).toBe(MECHANIC_PRIORITY.length);
    // Every content entry is reachable through the priority list (no orphan mechanic).
    for (const mechanic of MECHANIC_PRIORITY) {
      expect(coachFor(mechanic)).toBeTruthy();
    }
  });
});
