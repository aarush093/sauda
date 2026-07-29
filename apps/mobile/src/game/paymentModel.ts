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
    payable.push({ id, value });
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
