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
  // R4 (owner landscape directive, 2 Aug): a card is either a BANK card — a money note OR a banked
  // action (a banked AAGE BADHO / HAVELI is simply a bank card at its rupee value) — or a TABLE
  // property (a property card / building, whose spending BREAKS a set). This is what F3 protects, so
  // it drives both the never-break-sets default and the disclosure. It replaces the old `isMoney`,
  // which mis-bucketed a banked action as a property and hid it from the owner behind the expander.
  fromBank: boolean;
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

  // Everything on my table that could pay, split by SOURCE so the roster is honest (R4): every bank
  // card — money notes AND banked action cards alike — then every table property + building. ANY
  // wildcards are excluded (§4.5 edge #4, worth ₹0). Mirrors the engine's payableCards; reduce
  // re-validates whatever the sheet finally submits.
  const bankIds = new Set<CardId>(observation.myBank);
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
    payable.push({ id, value, fromBank: bankIds.has(id) });
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
// explicit AND never breaks a set: over all subsets it takes the SMALLEST sum >= the debt (so it
// never overpays when an exact selection exists), and within that sum it spends the FEWEST table
// PROPERTIES (bank cards — money and banked actions — go first, since spending them costs no set)
// then the fewest cards. A tiny subset-sum — values are <= 10 and the table total is small.
export function refinePaymentSelection(payable: PayableCard[], amount: number): CardId[] {
  const tableTotal = payable.reduce((sum, card) => sum + card.value, 0);
  if (tableTotal <= amount) {
    return payable.map((card) => card.id); // §4.5: table short → hand over everything (C3)
  }

  interface Combo {
    ids: CardId[];
    propertyCount: number; // how many TABLE properties it spends (fewer = better; bank cards are free)
  }
  const bestForSum = new Map<number, Combo>();
  bestForSum.set(0, { ids: [], propertyCount: 0 });
  for (const card of payable) {
    for (const [sum, combo] of [...bestForSum]) {
      const nextSum = sum + card.value;
      const next: Combo = { ids: [...combo.ids, card.id], propertyCount: combo.propertyCount + (card.fromBank ? 0 : 1) };
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

// Prefer the combination that spends fewer TABLE properties (bank cards first, so no set breaks),
// then fewer cards overall.
function isBetterCombo(a: { propertyCount: number; ids: CardId[] }, b: { propertyCount: number; ids: CardId[] }): boolean {
  if (a.propertyCount !== b.propertyCount) {
    return a.propertyCount < b.propertyCount;
  }
  return a.ids.length < b.ids.length;
}

// F3 progressive disclosure (L6) — R4 corrected. BANK cards (money notes AND banked actions) are
// always visible and directly tappable, since spending them costs no set; the default's own table
// properties stay visible; every OTHER table property hides behind the "Choose differently" expander
// so a bank-covered debt reads as bank-only. When the table is short (mustPayAll) nothing hides —
// everything is shown and locked. This is the fix for "I could not pick banked action cards": a
// banked action now sits with the money, not buried under a "property" expander.
export interface PaymentDisclosure {
  defaultSelection: CardId[]; // pre-selected cards (the trustworthy default)
  bankCards: PayableCard[]; // money notes + banked actions — always shown, always tappable
  shownProperties: PayableCard[]; // table properties that are part of the default (shown)
  hiddenProperties: PayableCard[]; // table properties behind the expander (collapsed by default)
  bankOnly: boolean; // the default spends no table property — the debt is covered from the bank alone
}

export function paymentDisclosure(details: PaymentDetails): PaymentDisclosure {
  const defaultSelection = details.mustPayAll
    ? details.payable.map((card) => card.id)
    : refinePaymentSelection(details.payable, details.amount);
  const selected = new Set(defaultSelection);
  const bankCards = details.payable.filter((card) => card.fromBank);
  const properties = details.payable.filter((card) => !card.fromBank);
  // When the table is short every card must go, so nothing hides behind the expander.
  const shownProperties = details.mustPayAll ? properties : properties.filter((card) => selected.has(card.id));
  const hiddenProperties = details.mustPayAll ? [] : properties.filter((card) => !selected.has(card.id));
  return { defaultSelection, bankCards, shownProperties, hiddenProperties, bankOnly: shownProperties.length === 0 };
}
