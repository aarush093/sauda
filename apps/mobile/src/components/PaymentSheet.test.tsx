/**
 * R4 (owner: "make no mistake, add this properly") — the payment sheet must let me pay with any
 * combination the engine accepts, INCLUDING a deliberate overpay, exactly as easily as the suggestion,
 * and a banked ACTION card must be pickable (it is a bank card, not hidden behind the property
 * expander). These tests drive the real sheet over minimal Observation fixtures.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SET_IDS, buildDeck } from '@sauda/engine';
import type { InterruptView, Observation, PropertyGroup, SetId } from '@sauda/engine';
import { PaymentSheet } from './PaymentSheet';

afterEach(cleanup);

const deck = buildDeck();
const money3 = deck.find((c) => c.kind === 'money' && c.value === 3)!.id;
const money5 = deck.find((c) => c.kind === 'money' && c.value === 5)!.id;
const bankedAction = deck.find((c) => c.kind === 'action' && c.action === 'aageBadho')!.id;

function empty<T>(): Record<SetId, T[]> {
  const record = {} as Record<SetId, T[]>;
  for (const set of SET_IDS) {
    record[set] = [];
  }
  return record;
}

function chargeObservation(amount: number, bank: string[]): Observation {
  const interrupt: InterruptView = { origin: 1, target: 0, status: 'awaitingPayment', effect: { kind: 'charge', amount } };
  return {
    me: 0,
    phase: 'playing',
    currentPlayer: 1,
    playsRemaining: 0,
    turnCount: 3,
    myHand: [],
    myBank: bank,
    myBankTotal: 0,
    myProperties: empty<PropertyGroup>(),
    myKiraya: empty<number>(),
    opponents: [],
    drawPileCount: 40,
    discardPile: [],
    interrupt,
    winnerIndex: null,
  };
}

const seats = [{ kind: 'human' as const }, { kind: 'bot' as const, difficulty: 'medium' as const }];

describe('PaymentSheet (R4 payment freedom)', () => {
  it('submits a deliberate overpay — adding a second bank card past the debt still pays', () => {
    const onPay = vi.fn();
    // debt 4; the default picks the ₹5 alone (smallest sufficient). I ADD the ₹3 on top: 8 > 4.
    render(<PaymentSheet observation={chargeObservation(4, [money3, money5])} seats={seats} onPay={onPay} />);
    fireEvent.click(document.querySelector(`[data-pay-card="${money3}"]`)!);
    expect(screen.getByText(/no change given/)).toBeTruthy(); // the overpay is disclosed, not blocked
    fireEvent.click(screen.getByRole('button', { name: /Pay ₹4/ }));
    expect(onPay).toHaveBeenCalledTimes(1);
    const paid = new Set(onPay.mock.calls[0]![0] as string[]);
    expect(paid.has(money3)).toBe(true);
    expect(paid.has(money5)).toBe(true); // both handed over — a real overpay submitted
  });

  it('renders a banked action as a directly pickable bank card (not hidden behind the expander)', () => {
    const onPay = vi.fn();
    render(<PaymentSheet observation={chargeObservation(4, [bankedAction, money5])} seats={seats} onPay={onPay} />);
    // the banked action is present as a tappable pay card without expanding anything
    expect(document.querySelector(`[data-pay-card="${bankedAction}"]`)).not.toBeNull();
  });
});
