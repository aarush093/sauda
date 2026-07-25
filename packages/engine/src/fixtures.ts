/**
 * Curated scenario fixtures (§8.2). Each fixture is an initial state plus a scripted
 * list of actions. `fixtures.gen.test.ts` folds them through `reduce`, asserts the
 * outcome, and writes the golden JSON to `packages/engine/fixtures/`. The Python
 * env in M6 must replay each fixture bit-for-bit (the parity gate).
 */
import type { Action } from './actions';
import type { GameState } from './state';
import { makeState } from './testkit';

export interface Fixture {
  name: string;
  description: string;
  build: () => GameState;
  actions: Action[];
}

const winningBoard = {
  mumbai: { cards: ['prop_mumbai_0', 'prop_mumbai_1'] },
  puraniDilli: { cards: ['prop_puraniDilli_0', 'prop_puraniDilli_1'] },
  utility: { cards: ['prop_utility_0', 'prop_utility_1'] },
};

export const FIXTURES: Fixture[] = [
  {
    name: 'bank-then-place',
    description: 'Bank a money card, place a property, end the turn (§4.4).',
    build: () =>
      makeState({ players: [{ hand: ['money_5_0', 'prop_mumbai_0'] }, {}], playsRemaining: 3 }),
    actions: [
      { type: 'BANK_CARD', cardId: 'money_5_0' },
      { type: 'PLACE_PROPERTY', cardId: 'prop_mumbai_0', set: 'mumbai' },
      { type: 'END_TURN' },
    ],
  },
  {
    name: 'empty-hand-draw-five',
    description: 'An empty hand draws 5 at the start of the turn (§4.4, #14).',
    build: () => makeState({ players: [{ hand: [] }, {}], phase: 'awaitingDraw' }),
    actions: [{ type: 'DRAW' }],
  },
  {
    name: 'vasooli-paid',
    description: 'VASOOLI stands and the target pays ₹5 (§5, §4.5).',
    build: () =>
      makeState({ players: [{ hand: ['action_vasooli_0'] }, { bank: ['money_5_0'] }] }),
    actions: [
      { type: 'PLAY_ACTION', cardId: 'action_vasooli_0', params: { action: 'vasooli', target: 1 } },
      { type: 'RESPOND_ALLOW' },
      { type: 'RESPOND_PAY', cardIds: ['money_5_0'] },
    ],
  },
  {
    name: 'vasooli-cancelled-depth-3',
    description: 'A depth-3 NAHI CHALEGA chain cancels the charge (§5, #8).',
    build: () =>
      makeState({
        players: [
          { hand: ['action_vasooli_0', 'action_nahiChalega_2'] },
          { hand: ['action_nahiChalega_0', 'action_nahiChalega_1'], bank: ['money_5_0'] },
        ],
      }),
    actions: [
      { type: 'PLAY_ACTION', cardId: 'action_vasooli_0', params: { action: 'vasooli', target: 1 } },
      { type: 'RESPOND_NAHI_CHALEGA', cardId: 'action_nahiChalega_0' },
      { type: 'RESPOND_NAHI_CHALEGA', cardId: 'action_nahiChalega_2' },
      { type: 'RESPOND_NAHI_CHALEGA', cardId: 'action_nahiChalega_1' },
      { type: 'RESPOND_ALLOW' },
    ],
  },
  {
    name: 'shagun-mixed-responses',
    description: 'SHAGUN: one opponent cancels, the others pay (§5, #10).',
    build: () =>
      makeState({
        players: [
          { hand: ['action_shagun_0'] },
          { hand: ['action_nahiChalega_0'] },
          { bank: ['money_2_0'] },
          { bank: ['money_2_1'] },
        ],
      }),
    actions: [
      { type: 'PLAY_ACTION', cardId: 'action_shagun_0', params: { action: 'shagun' } },
      { type: 'RESPOND_ALLOW' }, // player 3
      { type: 'RESPOND_PAY', cardIds: ['money_2_1'] },
      { type: 'RESPOND_ALLOW' }, // player 2
      { type: 'RESPOND_PAY', cardIds: ['money_2_0'] },
      { type: 'RESPOND_NAHI_CHALEGA', cardId: 'action_nahiChalega_0' }, // player 1 cancels
      { type: 'RESPOND_ALLOW' },
    ],
  },
  {
    name: 'kabza-takes-buildings',
    description: 'KABZA takes a complete set with its MAKAAN (§5, #7).',
    build: () =>
      makeState({
        players: [
          { hand: ['action_kabza_0'] },
          {
            properties: {
              mumbai: { cards: ['prop_mumbai_0', 'prop_mumbai_1'], buildings: ['action_makaan_0'] },
            },
          },
        ],
      }),
    actions: [
      { type: 'PLAY_ACTION', cardId: 'action_kabza_0', params: { action: 'kabza', target: 1, set: 'mumbai' } },
      { type: 'RESPOND_ALLOW' },
    ],
  },
  {
    name: 'payment-breaks-set-relocates-building',
    description: 'Paying with properties breaks a set; its MAKAAN relocates to the bank (§4.5, #5).',
    build: () =>
      makeState({
        players: [
          { hand: ['action_vasooli_0'] },
          {
            properties: {
              mumbai: { cards: ['prop_mumbai_0', 'prop_mumbai_1'], buildings: ['action_makaan_0'] },
            },
          },
        ],
      }),
    actions: [
      { type: 'PLAY_ACTION', cardId: 'action_vasooli_0', params: { action: 'vasooli', target: 1 } },
      { type: 'RESPOND_ALLOW' },
      { type: 'RESPOND_PAY', cardIds: ['prop_mumbai_0', 'prop_mumbai_1'] },
    ],
  },
  {
    name: 'dugna-stacked-kiraya',
    description: 'KIRAYA on a complete jaipur set doubled twice = ₹16 (§5, #11).',
    build: () =>
      makeState({
        players: [
          {
            hand: ['kiraya_jaipur_kolkata_0', 'action_dugna_0', 'action_dugna_1'],
            properties: { jaipur: { cards: ['prop_jaipur_0', 'prop_jaipur_1', 'prop_jaipur_2'] } },
          },
          { bank: ['money_10_0', 'money_5_0', 'money_1_0'] },
        ],
      }),
    actions: [
      {
        type: 'PLAY_KIRAYA',
        cardId: 'kiraya_jaipur_kolkata_0',
        color: 'jaipur',
        target: null,
        dugnaCardIds: ['action_dugna_0', 'action_dugna_1'],
      },
      { type: 'RESPOND_ALLOW' },
      { type: 'RESPOND_PAY', cardIds: ['money_10_0', 'money_5_0', 'money_1_0'] },
    ],
  },
  {
    name: 'rearrange-wildcard-free',
    description: 'Rearranging a wildcard is free and does not consume a play (§4.4, #17).',
    build: () =>
      makeState({
        players: [{ properties: { jaipur: { cards: ['wild_jaipur_kolkata_0'] } } }, {}],
        playsRemaining: 3,
      }),
    actions: [{ type: 'REARRANGE_WILDCARD', cardId: 'wild_jaipur_kolkata_0', toSet: 'kolkata' }],
  },
  {
    name: 'declare-win',
    description: 'Three complete sets declared on the own turn (§4.1, #18).',
    build: () =>
      makeState({
        players: [{ properties: winningBoard }, {}],
        currentPlayerIndex: 0,
        phase: 'awaitingDraw',
      }),
    actions: [{ type: 'DECLARE_WIN' }],
  },
];
