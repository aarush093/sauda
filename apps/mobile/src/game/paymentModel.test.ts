/**
 * Unit tests for paymentDetails / selectedTotal — the payment-sheet model (C-rows). They
 * pin the debt read (amount, creditor), the payable derivation, the mustPayAll (C3) flag,
 * and the running-meter sum. Built over minimal Observation fixtures with real deck ids
 * so the engine's cardPayValue applies.
 */
import { describe, it, expect } from 'vitest';
import { SET_IDS, buildDeck } from '@sauda/engine';
import type { InterruptView, Observation, PropertyGroup, SetId } from '@sauda/engine';
import { paymentDetails, paymentDisclosure, refinePaymentSelection, selectedTotal } from './paymentModel';
import type { PayableCard } from './paymentModel';

const deck = buildDeck();
const money3 = deck.find((card) => card.kind === 'money' && card.value === 3)!.id;
const money5 = deck.find((card) => card.kind === 'money' && card.value === 5)!.id;

function emptyProps(): Record<SetId, PropertyGroup[]> {
  const record = {} as Record<SetId, PropertyGroup[]>;
  for (const set of SET_IDS) {
    record[set] = [];
  }
  return record;
}
function emptyKiraya(): Record<SetId, number[]> {
  const record = {} as Record<SetId, number[]>;
  for (const set of SET_IDS) {
    record[set] = [];
  }
  return record;
}

function observationWith(interrupt: InterruptView | null, bank: string[]): Observation {
  return {
    me: 0,
    phase: 'playing',
    currentPlayer: 1,
    playsRemaining: 0,
    turnCount: 3,
    myHand: [],
    myBank: bank,
    myBankTotal: 0,
    myProperties: emptyProps(),
    myKiraya: emptyKiraya(),
    opponents: [],
    drawPileCount: 50,
    discardPile: [],
    interrupt,
    winnerIndex: null,
  };
}

const chargeOnMe: InterruptView = {
  origin: 1,
  target: 0,
  status: 'awaitingPayment',
  effect: { kind: 'charge', amount: 4 },
};

describe('paymentDetails (payment sheet model)', () => {
  it('is null when there is no interrupt', () => {
    expect(paymentDetails(observationWith(null, [money3]))).toBeNull();
  });

  it('is null when the charge awaits someone else', () => {
    const notMine: InterruptView = { ...chargeOnMe, target: 2 };
    expect(paymentDetails(observationWith(notMine, [money3]))).toBeNull();
  });

  it('reads the amount and creditor, and lists my payable bank cards', () => {
    const details = paymentDetails(observationWith(chargeOnMe, [money3, money5]));
    expect(details).not.toBeNull();
    expect(details!.amount).toBe(4);
    expect(details!.creditor).toBe(1);
    expect(details!.payable.map((card) => card.id)).toEqual([money3, money5]);
    expect(details!.tableTotal).toBe(8);
    expect(details!.mustPayAll).toBe(false); // 8 > 4
  });

  it('flags mustPayAll when the table is worth <= the debt (C3)', () => {
    const details = paymentDetails(observationWith(chargeOnMe, [money3]));
    expect(details!.mustPayAll).toBe(true); // 3 <= 4
  });

  it('selectedTotal sums only the chosen cards', () => {
    const details = paymentDetails(observationWith(chargeOnMe, [money3, money5]))!;
    expect(selectedTotal(details.payable, new Set([money5]))).toBe(5);
    expect(selectedTotal(details.payable, new Set([money3, money5]))).toBe(8);
    expect(selectedTotal(details.payable, new Set())).toBe(0);
  });
});

// F3 (owner playtest 30 Jul): the trustworthy bank-first default (R4: bank cards, not just money).
describe('refinePaymentSelection — never overpay when exact exists; prefer the bank (F3)', () => {
  const pay = (id: string, value: number, fromBank: boolean): PayableCard => ({ id, value, fromBank });

  it('picks the exact subset rather than overpaying (2 owed, a 2 and a 3 available)', () => {
    expect(refinePaymentSelection([pay('m2', 2, true), pay('m3', 3, true)], 2)).toEqual(['m2']);
  });

  it('prefers a bank card over a table property at the same minimal sum', () => {
    expect(refinePaymentSelection([pay('p2', 2, false), pay('m2', 2, true)], 2)).toEqual(['m2']);
  });

  it('takes the smallest sufficient sum when no exact subset exists (minimal legal overpay)', () => {
    expect(refinePaymentSelection([pay('m1', 1, true), pay('m3', 3, true)], 2)).toEqual(['m3']);
  });

  it('pays everything when the table is short (C3)', () => {
    expect(new Set(refinePaymentSelection([pay('m1', 1, true), pay('p1', 1, false)], 5))).toEqual(new Set(['m1', 'p1']));
  });

  it('guarantee: over generated hands the default sum is always the SMALLEST sufficient sum', () => {
    for (let trial = 0; trial < 400; trial++) {
      const count = 1 + (trial % 6);
      const payable = Array.from({ length: count }, (_, index) =>
        pay(`c${index}`, 1 + ((trial * 7 + index * 3) % 5), index % 2 === 0),
      );
      const total = payable.reduce((sum, card) => sum + card.value, 0);
      const debt = 1 + ((trial * 3) % total);
      if (total <= debt) {
        continue; // must-pay-all case, covered separately
      }
      const selection = refinePaymentSelection(payable, debt);
      const selectionSum = selection.reduce((sum, id) => sum + payable.find((card) => card.id === id)!.value, 0);
      let smallestSufficient = Infinity;
      for (let mask = 0; mask < 1 << count; mask++) {
        let subsetSum = 0;
        for (let index = 0; index < count; index++) {
          if (mask & (1 << index)) subsetSum += payable[index]!.value;
        }
        if (subsetSum >= debt) smallestSufficient = Math.min(smallestSufficient, subsetSum);
      }
      expect(selectionSum).toBe(smallestSufficient); // never overpays beyond the minimal legal sum
    }
  });
});

describe('paymentDisclosure — bank-first split (F3 · R4)', () => {
  it('hides non-selected property behind the expander; bank covers ⇒ bankOnly', () => {
    const details = paymentDetails(observationWith(chargeOnMe, [money5]))!; // debt 4, one ₹5 note
    const disclosure = paymentDisclosure(details);
    expect(disclosure.defaultSelection).toEqual([money5]);
    expect(disclosure.bankOnly).toBe(true);
    expect(disclosure.bankCards.map((card) => card.id)).toEqual([money5]);
    expect(disclosure.hiddenProperties).toEqual([]); // no properties here
  });
});

// R4 (owner: "make no mistake, add this properly") — the payable roster must carry EVERY payable
// card, banked actions included, and NEVER an ANY wildcard; a deliberate overpay must be selectable.
const deckAll = buildDeck();
const bankedAction = deckAll.find((card) => card.kind === 'action' && card.action === 'aageBadho')!.id;
const anyWild = deckAll.find((card) => card.kind === 'wildcard' && card.colors === 'ANY')!.id;
const colourProp = deckAll.find((card) => card.kind === 'property')!.id;

describe('payment roster (R4 payment freedom)', () => {
  it('includes a banked ACTION card, marked as a bank card at its ₹ value', () => {
    const details = paymentDetails(observationWith(chargeOnMe, [bankedAction]))!;
    const entry = details.payable.find((card) => card.id === bankedAction);
    expect(entry).toBeDefined();
    expect(entry!.fromBank).toBe(true); // it belongs with the money, not behind the property expander
    expect(entry!.value).toBeGreaterThan(0);
  });

  it('shows a banked action in the always-visible bank row (not hidden as a property)', () => {
    const details = paymentDetails(observationWith(chargeOnMe, [bankedAction, money5]))!;
    const disclosure = paymentDisclosure(details);
    expect(disclosure.bankCards.map((card) => card.id)).toContain(bankedAction);
    expect(disclosure.hiddenProperties.map((card) => card.id)).not.toContain(bankedAction);
  });

  it('NEVER lists an ANY wildcard, even when one sits in a property group', () => {
    const observation = observationWith(chargeOnMe, [money5]);
    observation.myProperties.mumbai = [{ set: 'mumbai', cards: [anyWild, colourProp], buildings: [] }];
    const details = paymentDetails(observation)!;
    expect(details.payable.map((card) => card.id)).not.toContain(anyWild);
    expect(details.payable.map((card) => card.id)).toContain(colourProp); // the real property still pays
  });

  it('lets a deliberate overpay stand — a bank subset summing OVER the debt is a valid selection', () => {
    const details = paymentDetails(observationWith(chargeOnMe, [money5]))!; // debt 4, a ₹5 note
    // selecting the ₹5 overpays the ₹4 debt: legal (no change given), and the meter reflects it.
    expect(selectedTotal(details.payable, new Set([money5]))).toBe(5);
    expect(5).toBeGreaterThan(details.amount);
  });
});
