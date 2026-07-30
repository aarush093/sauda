/**
 * Unit tests for the interaction reducer (v1.2 A10). Pure logic over synthetic Action
 * lists — no DOM, no engine state. The load-bearing test is PARITY: for every card
 * category, the set of engine actions reachable by DRAG equals the set reachable by the
 * TAP rail (staging.ts) equals the card's legalActions — so the two input paths can never
 * diverge, and neither can invent an illegal move.
 */
import { describe, it, expect } from 'vitest';
import { SETS } from '@sauda/engine';
import type { Action, CardId, SetId } from '@sauda/engine';
import { actionCardId } from './labels';
import { railForCard } from './staging';
import {
  autoDrawAction,
  dropZonesForCard,
  kirayaPlan,
  reachableActionsForCard,
  rearrangeDestinations,
  shouldAutoEndTurn,
  zeroPayableResponse,
} from './interaction';

const ALL_SETS = Object.keys(SETS) as SetId[];

// Stable serialisation so action SETS can be compared regardless of order.
const keyOf = (action: Action): string => JSON.stringify(action);
const sortedKeys = (actions: Action[]): string[] => actions.map(keyOf).sort();

// The engine plays a hand card offers (what both input paths must exactly cover).
const handPlaysFor = (actions: Action[], cardId: CardId): Action[] =>
  actions.filter(
    (action) =>
      actionCardId(action) === cardId &&
      (action.type === 'BANK_CARD' ||
        action.type === 'PLACE_PROPERTY' ||
        action.type === 'PLAY_ACTION' ||
        action.type === 'PLAY_KIRAYA'),
  );

const flattenRail = (actions: Action[], cardId: CardId): Action[] =>
  railForCard(actions, cardId).flatMap((verb) => verb.options.map((option) => option.action));

describe('interaction reducer — drop zones', () => {
  it('dual-drop: the same action card yields BANK on the bank zone and PLAY on centre', () => {
    const actions: Action[] = [
      { type: 'PLAY_ACTION', cardId: 'act_1', params: { action: 'shagun' } },
      { type: 'BANK_CARD', cardId: 'act_1' },
    ];
    const zones = dropZonesForCard(actions, 'act_1');
    const bank = zones.find((zone) => zone.kind === 'bank');
    const play = zones.find((zone) => zone.kind === 'play');
    expect(bank?.action?.type).toBe('BANK_CARD');
    expect(play?.action?.type).toBe('PLAY_ACTION'); // single candidate → fires on drop
  });

  it('an ANY wildcard yields only set zones — never a bank (or payment) zone', () => {
    const actions: Action[] = ALL_SETS.map((set) => ({ type: 'PLACE_PROPERTY', cardId: 'wild_any', set }));
    const zones = dropZonesForCard(actions, 'wild_any');
    expect(zones.every((zone) => zone.kind === 'set')).toBe(true);
    expect(zones.some((zone) => zone.kind === 'bank')).toBe(false);
    // and nothing reachable is a bank or a payment
    const reachable = reachableActionsForCard(actions, 'wild_any', 0);
    expect(reachable.every((action) => action.type === 'PLACE_PROPERTY')).toBe(true);
  });

  it('a targeted action drops to centre with no concrete action (opens targeting)', () => {
    const actions: Action[] = [
      { type: 'PLAY_ACTION', cardId: 'act_v', params: { action: 'vasooli', target: 1 } },
      { type: 'PLAY_ACTION', cardId: 'act_v', params: { action: 'vasooli', target: 2 } },
    ];
    const play = dropZonesForCard(actions, 'act_v').find((zone) => zone.kind === 'play');
    expect(play).toBeDefined();
    expect(play?.action).toBeNull(); // two targets → TARGETING, not an immediate commit
  });
});

describe('interaction reducer — DUGNA attaches, never stands alone (L6, B15)', () => {
  it('a DUGNA card in hand has no drop zone of its own', () => {
    // The engine enumerates no play for a lone DUGNA, so no move targets it.
    const actions: Action[] = [{ type: 'PLAY_KIRAYA', cardId: 'kir_1', color: 'mumbai', target: null, dugnaCardIds: [] }];
    expect(dropZonesForCard(actions, 'dug_1')).toEqual([]);
  });

  it('the LAGAAN plan exposes ×1/×2/×4 attach chips, capped at two DUGNA', () => {
    const actions: Action[] = [
      { type: 'PLAY_KIRAYA', cardId: 'kir_1', color: 'mumbai', target: null, dugnaCardIds: [] },
      { type: 'PLAY_KIRAYA', cardId: 'kir_1', color: 'mumbai', target: null, dugnaCardIds: ['dug_1'] },
      { type: 'PLAY_KIRAYA', cardId: 'kir_1', color: 'mumbai', target: null, dugnaCardIds: ['dug_1', 'dug_2'] },
    ];
    const plan = kirayaPlan(actions, 'kir_1');
    expect(plan?.dugna.map((option) => option.count)).toEqual([0, 1, 2]);
    expect(plan?.dugna.map((option) => option.label)).toEqual(['×1', '×2', '×4']);
    expect(Math.max(...(plan?.dugna.map((option) => option.count) ?? []))).toBeLessThanOrEqual(2);
  });
});

describe('interaction reducer — rearrange, auto-draw, zero-payable', () => {
  it('rearrange maps a placed wildcard to REARRANGE_WILDCARD (free, no play)', () => {
    const actions: Action[] = [
      { type: 'REARRANGE_WILDCARD', cardId: 'wild_1', toSet: 'mumbai' },
      { type: 'REARRANGE_WILDCARD', cardId: 'wild_1', toSet: 'jaipur' },
    ];
    const destinations = rearrangeDestinations(actions, 'wild_1');
    expect(destinations.map((destination) => destination.set)).toEqual(['mumbai', 'jaipur']);
    expect(destinations.every((destination) => destination.action.type === 'REARRANGE_WILDCARD')).toBe(true);
  });

  it('auto-draw returns DRAW only when it is offered (turn start), never mid-turn', () => {
    expect(autoDrawAction([{ type: 'DRAW' }, { type: 'DECLARE_WIN' }])?.type).toBe('DRAW');
    expect(autoDrawAction([{ type: 'END_TURN' }, { type: 'BANK_CARD', cardId: 'x' }])).toBeNull();
  });

  it('C4: a zero-payable charge auto-submits the empty RESPOND_PAY (no sheet)', () => {
    expect(zeroPayableResponse([{ type: 'RESPOND_PAY', cardIds: [] }], 0)?.type).toBe('RESPOND_PAY');
    // C3 (table can pay something) is NOT auto-resolved — the sheet opens.
    expect(zeroPayableResponse([{ type: 'RESPOND_PAY', cardIds: ['money_1'] }], 1)).toBeNull();
  });
});

describe('interaction reducer — drag/tap/legalActions parity (every card category)', () => {
  const scenarios: { name: string; card: CardId; actions: Action[] }[] = [
    { name: 'money', card: 'money_1', actions: [{ type: 'BANK_CARD', cardId: 'money_1' }] },
    { name: 'property', card: 'prop_1', actions: [{ type: 'PLACE_PROPERTY', cardId: 'prop_1', set: 'mumbai' }] },
    {
      name: 'dual wildcard',
      card: 'wild_1',
      actions: [
        { type: 'PLACE_PROPERTY', cardId: 'wild_1', set: 'mumbai' },
        { type: 'PLACE_PROPERTY', cardId: 'wild_1', set: 'jaipur' },
      ],
    },
    { name: 'ANY wildcard', card: 'wild_any', actions: ALL_SETS.map((set) => ({ type: 'PLACE_PROPERTY', cardId: 'wild_any', set })) },
    {
      name: 'untargeted action (SHAGUN) + bank',
      card: 'act_s',
      actions: [
        { type: 'PLAY_ACTION', cardId: 'act_s', params: { action: 'shagun' } },
        { type: 'BANK_CARD', cardId: 'act_s' },
      ],
    },
    {
      name: 'targeted action (VASOOLI) + bank',
      card: 'act_v',
      actions: [
        { type: 'PLAY_ACTION', cardId: 'act_v', params: { action: 'vasooli', target: 1 } },
        { type: 'PLAY_ACTION', cardId: 'act_v', params: { action: 'vasooli', target: 2 } },
        { type: 'BANK_CARD', cardId: 'act_v' },
      ],
    },
    {
      name: 'KABZA (target + set)',
      card: 'act_k',
      actions: [
        { type: 'PLAY_ACTION', cardId: 'act_k', params: { action: 'kabza', target: 1, set: 'mumbai' } },
        { type: 'PLAY_ACTION', cardId: 'act_k', params: { action: 'kabza', target: 2, set: 'jaipur' } },
        { type: 'BANK_CARD', cardId: 'act_k' },
      ],
    },
    {
      name: 'HAATH KI SAFAI (target + property)',
      card: 'act_h',
      actions: [
        { type: 'PLAY_ACTION', cardId: 'act_h', params: { action: 'haathKiSafai', target: 1, cardId: 'prop_a' } },
        { type: 'PLAY_ACTION', cardId: 'act_h', params: { action: 'haathKiSafai', target: 1, cardId: 'prop_b' } },
        { type: 'BANK_CARD', cardId: 'act_h' },
      ],
    },
    {
      name: 'ADLA-BADLI (mine × theirs)',
      card: 'act_a',
      actions: [
        { type: 'PLAY_ACTION', cardId: 'act_a', params: { action: 'adlaBadli', myCardId: 'mine_1', target: 1, theirCardId: 'their_1' } },
        { type: 'PLAY_ACTION', cardId: 'act_a', params: { action: 'adlaBadli', myCardId: 'mine_1', target: 1, theirCardId: 'their_2' } },
        { type: 'PLAY_ACTION', cardId: 'act_a', params: { action: 'adlaBadli', myCardId: 'mine_2', target: 1, theirCardId: 'their_1' } },
      ],
    },
    {
      name: 'MAKAAN build + bank',
      card: 'act_m',
      actions: [
        { type: 'PLAY_ACTION', cardId: 'act_m', params: { action: 'makaan', set: 'mumbai' } },
        { type: 'BANK_CARD', cardId: 'act_m' },
      ],
    },
    {
      name: 'wild LAGAAN (colour × target × dugna) + bank',
      card: 'kir_w',
      actions: [
        { type: 'PLAY_KIRAYA', cardId: 'kir_w', color: 'mumbai', target: 1, dugnaCardIds: [] },
        { type: 'PLAY_KIRAYA', cardId: 'kir_w', color: 'mumbai', target: 2, dugnaCardIds: [] },
        { type: 'PLAY_KIRAYA', cardId: 'kir_w', color: 'mumbai', target: 1, dugnaCardIds: ['dug_1'] },
        { type: 'PLAY_KIRAYA', cardId: 'kir_w', color: 'jaipur', target: 1, dugnaCardIds: [] },
        { type: 'BANK_CARD', cardId: 'kir_w' },
      ],
    },
  ];

  for (const { name, card, actions } of scenarios) {
    it(`${name}: drag == tap == legalActions`, () => {
      const legal = sortedKeys(handPlaysFor(actions, card));
      expect(sortedKeys(reachableActionsForCard(actions, card, 0))).toEqual(legal);
      expect(sortedKeys(flattenRail(actions, card))).toEqual(legal);
    });
  }

  it('illegal drops produce no engine action (a card the engine offers nothing for)', () => {
    const actions: Action[] = [{ type: 'PLACE_PROPERTY', cardId: 'someone_else', set: 'mumbai' }, { type: 'END_TURN' }];
    expect(dropZonesForCard(actions, 'not_playable')).toEqual([]);
    expect(reachableActionsForCard(actions, 'not_playable', 0)).toEqual([]);
  });
});

// F2 (owner playtest 30 Jul): the turn auto-ends ONLY on the exact [END_TURN] singleton.
describe('shouldAutoEndTurn — auto-end only when nothing else is legal (F2)', () => {
  it('auto-fires when END_TURN is the sole legal move', () => {
    expect(shouldAutoEndTurn([{ type: 'END_TURN' }])).toBe(true);
  });

  it('NEVER fires when a declarable win is also legal', () => {
    expect(shouldAutoEndTurn([{ type: 'DECLARE_WIN' }, { type: 'END_TURN' }])).toBe(false);
  });

  it('NEVER fires when a free wildcard rearrange is also legal', () => {
    const actions: Action[] = [
      { type: 'REARRANGE_WILDCARD', cardId: 'wild_jaipur_kolkata_0', toSet: 'kolkata' },
      { type: 'END_TURN' },
    ];
    expect(shouldAutoEndTurn(actions)).toBe(false);
  });

  it('NEVER fires when a play (e.g. Bank) is still legal', () => {
    const actions: Action[] = [{ type: 'BANK_CARD', cardId: 'money_2_0' }, { type: 'END_TURN' }];
    expect(shouldAutoEndTurn(actions)).toBe(false);
  });

  it('does not fire on an empty or non-END_TURN list', () => {
    expect(shouldAutoEndTurn([])).toBe(false);
    expect(shouldAutoEndTurn([{ type: 'DRAW' }])).toBe(false);
  });
});
