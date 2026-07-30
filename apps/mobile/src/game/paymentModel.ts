/**
 * Presentation model for the payment sheet (STATE_MATRIX C-rows; INTERACTION_SPEC §6).
 * When a charge stands against me, the engine opens an `awaitingPayment` step and offers
 * one pre-filled RESPOND_PAY (its suggestPayment). This helper reads the same public
 * observation the sheet renders from and returns the debt facts + the cards I may hand
 * over — so the component holds only selection state, no rules.
 *
 * It reuses the engine's own pay-value rule (cardPayValue / isAnyWildcard) rather than
 * reimplementing §4.5: the ANY wildcard is worth ₹0 and can never pay, so it is excluded
 * from the payable list. reduce re-validates whatever the sheet finally submits.
 */
import { SETS, buildDeck, cardPayValue, isAnyWildcard } from '@sauda/engine';
import type { Card, CardId, Observation, PlayerId, SetId } from '@sauda/engine';

const ALL_SETS = Object.keys(SETS) as SetId[];
const CARD_BY_ID = new Map<string, Card>(buildDeck().map((card) => [card.id, card]));

export interface PayableCard {
  id: CardId;
  value: number; // its ₹ pay value (an ANY wildcard would be 0, but those are excluded)
  isMoney: boolean; // a bank money note vs a property / building / colour wildcard (F3 disclosure)
}

export interface PaymentDetails {
  amount: number; // ₹ Cr owed
  creditor: PlayerId; // who I pay (the charger)
  payable: PayableCard[]; // every table card I could hand over
  tableTotal: number; // sum of payable values
  mustPayAll: boolean; // table worth <= debt → hand over everything (C3)
}

// The debt facing me right now, or null when there is no charge for me to pay. Only a
// standing charge (`awaitingPayment`, kind `charge`) whose target is me is a payment.
export function paymentDetails(observation: Observation): PaymentDetails | null {
  const interrupt = observation.interrupt;
  if (
    interrupt === null ||
    interrupt.status !== 'awaitingPayment' ||
    interrupt.effect.kind !== 'charge' ||
    interrupt.target !== observation.me
  ) {
    return null;
  }

  // Everything on my table that could pay: bank cards, property cards, and buildings —
  // minus ANY wildcards (§4.5 edge #4). Mirrors the engine's payableCards.
  const tableIds: CardId[] = [...observation.myBank];
  for (const set of ALL_SETS) {
    for (const group of observation.myProperties[set]) {
      tableIds.push(...group.cards, ...group.buildings);
    }
  }

  const payable: PayableCard[] = [];
  let tableTotal = 0;
  for (const id of tableIds) {
    const card = CARD_BY_ID.get(id);
    if (!card || isAnyWildcard(card)) {
      continue;
    }
    const value = cardPayValue(card);
    payable.push({ id, value, isMoney: card.kind === 'money' });
    tableTotal += value;
  }

  return {
    amount: interrupt.effect.amount,
    creditor: interrupt.origin,
    payable,
    tableTotal,
    mustPayAll: tableTotal <= interrupt.effect.amount,
  };
}

// Sum the pay value of the currently selected cards — the sheet's running meter.
export function selectedTotal(payable: PayableCard[], selected: ReadonlySet<CardId>): number {
  let total = 0;
  for (const card of payable) {
    if (selected.has(card.id)) {
      total += card.value;
    }
  }
  return total;
}

// F3 (owner playtest 30 Jul): the trustworthy DEFAULT selection. The engine's suggestPayment is
// already minimal-overpay (audit: 0 of 2638 charges overpaid while a smaller subset existed), but
// it is the engine's and we must not edit it. This UI-side pick makes the same two guarantees
// explicit AND prefers money: over all subsets it takes the SMALLEST sum >= the debt (so it never
// overpays when an exact selection exists), and within that sum it prefers fewer properties (money
// first) then fewer cards. A tiny subset-sum — values are <= 10 and the table total is small.
export function refinePaymentSelection(payable: PayableCard[], amount: number): CardId[] {
  const tableTotal = payable.reduce((sum, card) => sum + card.value, 0);
  if (tableTotal <= amount) {
    return payable.map((card) => card.id); // §4.5: table short → hand over everything (C3)
  }

  interface Combo {
    ids: CardId[];
    propertyCount: number; // how many non-money cards it spends (fewer = better)
  }
  const bestForSum = new Map<number, Combo>();
  bestForSum.set(0, { ids: [], propertyCount: 0 });
  for (const card of payable) {
    for (const [sum, combo] of [...bestForSum]) {
      const nextSum = sum + card.value;
      const next: Combo = { ids: [...combo.ids, card.id], propertyCount: combo.propertyCount + (card.isMoney ? 0 : 1) };
      const existing = bestForSum.get(nextSum);
      if (!existing || isBetterCombo(next, existing)) {
        bestForSum.set(nextSum, next);
      }
    }
  }

  let bestSum = -1;
  for (const sum of bestForSum.keys()) {
    if (sum >= amount && (bestSum === -1 || sum < bestSum)) {
      bestSum = sum; // smallest sufficient sum ⇒ never overpay when an exact subset exists
    }
  }
  return bestForSum.get(bestSum)?.ids ?? payable.map((card) => card.id);
}

// Prefer the combination that spends fewer properties (money first), then fewer cards.
function isBetterCombo(a: { propertyCount: number; ids: CardId[] }, b: { propertyCount: number; ids: CardId[] }): boolean {
  if (a.propertyCount !== b.propertyCount) {
    return a.propertyCount < b.propertyCount;
  }
  return a.ids.length < b.ids.length;
}

// F3 progressive disclosure (L6): what the sheet shows by default. Money notes are always
// visible; the default selection's own property cards stay visible; every OTHER property hides
// behind the "Pay with property instead" expander so a money-covered debt reads as money only.
// When the table is short (mustPayAll) nothing hides — everything is shown and locked.
export interface PaymentDisclosure {
  defaultSelection: CardId[]; // pre-selected cards (the trustworthy default)
  money: PayableCard[]; // always shown
  shownProperties: PayableCard[]; // properties that are part of the default (shown)
  hiddenProperties: PayableCard[]; // properties behind the expander (collapsed by default)
  moneyOnly: boolean; // the default spends no property — the debt is covered by money alone
}

export function paymentDisclosure(details: PaymentDetails): PaymentDisclosure {
  const defaultSelection = details.mustPayAll
    ? details.payable.map((card) => card.id)
    : refinePaymentSelection(details.payable, details.amount);
  const selected = new Set(defaultSelection);
  const money = details.payable.filter((card) => card.isMoney);
  const properties = details.payable.filter((card) => !card.isMoney);
  // When the table is short every card must go, so nothing hides behind the expander.
  const shownProperties = details.mustPayAll ? properties : properties.filter((card) => selected.has(card.id));
  const hiddenProperties = details.mustPayAll ? [] : properties.filter((card) => !selected.has(card.id));
  return { defaultSelection, money, shownProperties, hiddenProperties, moneyOnly: shownProperties.length === 0 };
}
