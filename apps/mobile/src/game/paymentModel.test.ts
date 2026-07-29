/**
 * Unit tests for paymentDetails / selectedTotal — the payment-sheet model (C-rows). They
 * pin the debt read (amount, creditor), the payable derivation, the mustPayAll (C3) flag,
 * and the running-meter sum. Built over minimal Observation fixtures with real deck ids
 * so the engine's cardPayValue applies.
 */
import { describe, it, expect } from 'vitest';
import { SET_IDS, buildDeck } from '@sauda/engine';
import type { InterruptView, Observation, PropertyGroup, SetId } from '@sauda/engine';
import { paymentDetails, selectedTotal } from './paymentModel';

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
