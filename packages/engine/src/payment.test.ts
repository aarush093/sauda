/**
 * Payment resolution (§4.5, §8.2). Edge cases: #1 overpay with no change,
 * #2 partial payment when the table is short, #3 zero table pays nothing,
 * #4 ANY wildcard never payable, #5 paying with a property breaks a set and
 * relocates its building. Also: buildings ARE payable (DECISIONS.md), and
 * suggestPayment always minimises overpay.
 */
import { describe, it, expect } from 'vitest';
import {
  applyPayment,
  cardPayValue,
  payableCards,
  suggestPayment,
  totalPayableValue,
  validatePayment,
} from './payment';
import type { PaymentRequest } from './payment';
import { getCard } from './sets';
import { checkInvariants } from './invariants';
import { makeState } from './testkit';

function sum(state: ReturnType<typeof makeState>, ids: string[]): number {
  return ids.reduce((total, id) => total + cardPayValue(getCard(state, id)), 0);
}

describe('validatePayment (§4.5)', () => {
  it('allows overpay with no change (#1)', () => {
    const state = makeState({ players: [{}, { bank: ['money_5_0'] }] });
    const request: PaymentRequest = { debtor: 1, creditor: 0, amountOwed: 2 };
    // Only a ₹5 card exists; paying it for a ₹2 debt is legal (no change given).
    expect(validatePayment(state, request, ['money_5_0']).ok).toBe(true);
  });

  it('rejects underpay when the table can cover the debt', () => {
    const state = makeState({ players: [{}, { bank: ['money_5_0', 'money_1_0'] }] });
    const request: PaymentRequest = { debtor: 1, creditor: 0, amountOwed: 4 };
    const result = validatePayment(state, request, ['money_1_0']);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PAYMENT_UNDERPAY');
    }
  });

  it('requires paying everything when the table is short (#2)', () => {
    const state = makeState({ players: [{}, { bank: ['money_1_0'] }] });
    const request: PaymentRequest = { debtor: 1, creditor: 0, amountOwed: 5 };
    expect(validatePayment(state, request, ['money_1_0']).ok).toBe(true); // pay-all settles it
    const partial = validatePayment(state, request, []);
    expect(partial.ok).toBe(false);
    if (!partial.ok) {
      expect(partial.error.code).toBe('PAYMENT_MUST_PAY_ALL');
    }
  });

  it('pays nothing from an empty table (#3)', () => {
    const state = makeState({ players: [{}, {}] });
    const request: PaymentRequest = { debtor: 1, creditor: 0, amountOwed: 5 };
    expect(totalPayableValue(state, 1)).toBe(0);
    expect(validatePayment(state, request, []).ok).toBe(true);
  });

  it('never counts or accepts an ANY wildcard as payment (#4)', () => {
    const state = makeState({
      players: [{}, { bank: ['money_1_0'], properties: { jaipur: { cards: ['wild_any_0'] } } }],
    });
    // The ANY wildcard is excluded from payable cards and from the table total.
    expect(payableCards(state, 1)).not.toContain('wild_any_0');
    expect(totalPayableValue(state, 1)).toBe(1);
    const request: PaymentRequest = { debtor: 1, creditor: 0, amountOwed: 5 };
    const result = validatePayment(state, request, ['wild_any_0']);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PAYMENT_INVALID_CARD');
    }
  });
});

describe('applyPayment (§4.5)', () => {
  it('breaks a complete set and relocates its building to the bank (#5)', () => {
    const state = makeState({
      players: [
        {}, // creditor
        {
          properties: {
            mumbai: { cards: ['prop_mumbai_0', 'prop_mumbai_1'], buildings: ['action_makaan_0'] },
          },
        },
      ],
    });
    const request: PaymentRequest = { debtor: 1, creditor: 0, amountOwed: 3 };
    // Pay with one mumbai property (₹4). That drops mumbai below complete → makaan orphaned.
    expect(validatePayment(state, request, ['prop_mumbai_0']).ok).toBe(true);
    const { events } = applyPayment(state, request, ['prop_mumbai_0']);

    expect(state.players[1]!.properties.mumbai.cards).toEqual(['prop_mumbai_1']);
    expect(state.players[1]!.properties.mumbai.buildings).toHaveLength(0);
    expect(state.players[1]!.bank).toContain('action_makaan_0'); // building relocated
    expect(state.players[0]!.properties.mumbai.cards).toContain('prop_mumbai_0'); // creditor received it
    expect(events.some((e) => e.type === 'SetBroken')).toBe(true);
    expect(events.some((e) => e.type === 'BuildingRelocated')).toBe(true);
    expect(checkInvariants(state).ok).toBe(true);
  });

  it('lets a building be paid, leaving the set complete but stripped (DECISIONS.md)', () => {
    const state = makeState({
      players: [
        {},
        {
          properties: {
            mumbai: { cards: ['prop_mumbai_0', 'prop_mumbai_1'], buildings: ['action_makaan_0'] },
          },
        },
      ],
    });
    const request: PaymentRequest = { debtor: 1, creditor: 0, amountOwed: 3 };
    expect(validatePayment(state, request, ['action_makaan_0']).ok).toBe(true);
    applyPayment(state, request, ['action_makaan_0']);

    expect(state.players[1]!.properties.mumbai.cards).toHaveLength(2); // set intact
    expect(state.players[1]!.properties.mumbai.buildings).toHaveLength(0); // but stripped
    expect(state.players[0]!.bank).toContain('action_makaan_0'); // paid building → creditor bank
    expect(checkInvariants(state).ok).toBe(true);
  });
});

describe('suggestPayment — minimal overpay (DECISIONS.md)', () => {
  it('never overpays when an exact combination exists', () => {
    const state = makeState({
      players: [{}, { bank: ['money_5_0', 'money_1_0', 'money_1_1'] }],
    });
    const request: PaymentRequest = { debtor: 1, creditor: 0, amountOwed: 2 };
    const chosen = suggestPayment(state, request);
    expect(sum(state, chosen)).toBe(2); // picks ₹1 + ₹1, not the ₹5
  });

  it('picks the smallest sum that still covers the debt', () => {
    const state = makeState({
      players: [{}, { bank: ['money_5_0', 'money_4_0'] }],
    });
    const request: PaymentRequest = { debtor: 1, creditor: 0, amountOwed: 3 };
    const chosen = suggestPayment(state, request);
    expect(sum(state, chosen)).toBe(4); // ₹4 beats ₹5, and 3 is not exactly reachable
  });

  it('hands over everything when the table cannot cover the debt', () => {
    const state = makeState({ players: [{}, { bank: ['money_1_0'] }] });
    const request: PaymentRequest = { debtor: 1, creditor: 0, amountOwed: 5 };
    expect(suggestPayment(state, request)).toEqual(['money_1_0']);
  });
});
