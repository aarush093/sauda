/**
 * Payment resolution (§4.5) — the heart of the game.
 *
 * Rules, in one place:
 *  - You pay ONLY with cards on your table (bank + property area), never from hand.
 *  - The payer chooses which cards; no change is given (overpay allowed / forced).
 *  - If your table is worth less than the debt, you hand over everything payable.
 *  - The ANY wildcard is worth ₹0 and can never be used to pay.
 *  - Paying with a property may break your own complete set; if that set had a
 *    building, the building relocates to your bank (rules.orphanedBuildings).
 *
 * Two design notes (see DECISIONS.md):
 *  - `validatePayment` is PERMISSIVE: any selection worth >= the debt is legal.
 *    Minimality is a strategy concern, handled by `suggestPayment`, not a rule.
 *  - `suggestPayment` is the one shared, tested way for bots/UI to pick cards; it
 *    always minimises overpay.
 */
import type { Card, SetId } from './types';
import { SETS } from './theme';
import type { CardId, GameEvent, GameState, PlayerId, ReceiveItem } from './state';
import { fail, ok } from './state';
import type { Result } from './state';
import { getCard, isAnyWildcard, isSetComplete } from './sets';
import { addToColor, pruneEmpty } from './groups';

const ALL_SETS = Object.keys(SETS) as SetId[];

export interface PaymentRequest {
  debtor: PlayerId;
  creditor: PlayerId;
  amountOwed: number;
}

// §4.5, edge #4: the ANY wildcard is worth ₹0 and never counts as payment.
export function cardPayValue(card: Card): number {
  return isAnyWildcard(card) ? 0 : card.value;
}

// Every card on a player's table that could be handed over: bank cards, property
// cards, colour wildcards, and buildings (see DECISIONS.md — buildings are payable).
// ANY wildcards are excluded because they can never pay.
export function payableCards(state: GameState, playerId: PlayerId): CardId[] {
  const player = state.players[playerId]!;
  const ids: CardId[] = [...player.bank];
  for (const set of ALL_SETS) {
    for (const group of player.properties[set]) {
      ids.push(...group.cards, ...group.buildings);
    }
  }
  return ids.filter((id) => !isAnyWildcard(getCard(state, id)));
}

export function totalPayableValue(state: GameState, playerId: PlayerId): number {
  let total = 0;
  for (const id of payableCards(state, playerId)) {
    total += cardPayValue(getCard(state, id));
  }
  return total;
}

// Validates a chosen selection against §4.5. Returns a distinct RuleViolation code
// per failure mode, because RESPOND_PAY is the one action not fully enumerated by
// legalActions, so reduce must defend every rule here (see DECISIONS.md).
export function validatePayment(
  state: GameState,
  request: PaymentRequest,
  selection: CardId[],
): Result<void> {
  const payable = new Set(payableCards(state, request.debtor));

  const seen = new Set<CardId>();
  for (const id of selection) {
    if (seen.has(id)) {
      return fail('PAYMENT_DUPLICATE', `card ${id} listed twice in payment`);
    }
    seen.add(id);
    // Not payable ⇒ not on the debtor's table, or an ANY wildcard, or from hand.
    if (!payable.has(id)) {
      return fail('PAYMENT_INVALID_CARD', `card ${id} is not a payable table card`);
    }
  }

  const tableTotal = totalPayableValue(state, request.debtor);
  const selectionTotal = sumValues(state, selection);

  if (tableTotal <= request.amountOwed) {
    // §4.5: if the table is worth less than (or exactly) the debt, pay everything.
    if (selection.length !== payable.size) {
      return fail('PAYMENT_MUST_PAY_ALL', 'table is short: must pay all payable cards');
    }
    return ok(undefined);
  }

  // Table can cover the debt ⇒ underpaying is illegal; overpay is allowed.
  if (selectionTotal < request.amountOwed) {
    return fail('PAYMENT_UNDERPAY', `paid ₹${selectionTotal} < owed ₹${request.amountOwed}`);
  }
  return ok(undefined);
}

function sumValues(state: GameState, ids: CardId[]): number {
  let total = 0;
  for (const id of ids) {
    total += cardPayValue(getCard(state, id));
  }
  return total;
}

// Applies a VALID payment: moves each selected card from debtor to creditor, then
// relocates any building orphaned by a broken set. Mutates `state` (the caller has
// already cloned it). Returns the events and the wildcards the creditor must place.
export function applyPayment(
  state: GameState,
  request: PaymentRequest,
  selection: CardId[],
): { events: GameEvent[]; received: ReceiveItem[] } {
  const events: GameEvent[] = [];
  const received: ReceiveItem[] = [];

  for (const id of selection) {
    const card = getCard(state, id);
    removeFromTable(state, request.debtor, id);
    routeCardToCreditor(state, request, card, id, events, received);
  }

  events.push({
    type: 'Paid',
    debtor: request.debtor,
    creditor: request.creditor,
    cardIds: [...selection],
    amount: request.amountOwed,
  });

  // §4.5 last bullet: a property paid away may have broken a complete set.
  events.push(...relocateOrphanedBuildings(state, request.debtor));
  return { events, received };
}

// Sends a paid card to the right creditor zone. Money/action/kiraya (incl. paid
// buildings) go to the bank; fixed properties to their set; colour wildcards wait
// for the creditor's group choice (§4.5: receiver chooses).
function routeCardToCreditor(
  state: GameState,
  request: PaymentRequest,
  card: Card,
  id: CardId,
  events: GameEvent[],
  received: ReceiveItem[],
): void {
  const creditor = state.players[request.creditor]!;
  if (card.kind === 'money' || card.kind === 'action' || card.kind === 'kiraya') {
    creditor.bank.push(id);
    return;
  }
  if (card.kind === 'property') {
    addToColor(creditor, card.set, id); // routes to a non-full group of the colour
    events.push({ type: 'CardReceived', player: request.creditor, cardId: id, set: card.set });
    return;
  }
  // Colour wildcard: the receiver picks the group later (edge #19).
  received.push({ cardId: id, receiver: request.creditor });
}

// Removes a card id from wherever it sits on a player's table (bank / group cards /
// group buildings). Throws if it is not on the table — callers must validate first.
export function removeFromTable(state: GameState, playerId: PlayerId, id: CardId): void {
  const player = state.players[playerId]!;
  if (removeId(player.bank, id)) {
    return;
  }
  for (const set of ALL_SETS) {
    for (const group of player.properties[set]) {
      if (removeId(group.cards, id) || removeId(group.buildings, id)) {
        pruneEmpty(player, set); // a group emptied by payment is dropped
        return;
      }
    }
  }
  throw new Error(`card ${id} not found on player ${playerId}'s table`);
}

function removeId(list: CardId[], id: CardId): boolean {
  const index = list.indexOf(id);
  if (index === -1) {
    return false;
  }
  list.splice(index, 1);
  return true;
}

// §4.5: after a set drops below complete, any MAKAAN/HAVELI on it moves to the
// owner's bank at face value (config 'toBank'; 'stay' leaves buildings in place).
export function relocateOrphanedBuildings(state: GameState, playerId: PlayerId): GameEvent[] {
  const events: GameEvent[] = [];
  if (state.rules.orphanedBuildings === 'stay') {
    return events;
  }
  const player = state.players[playerId]!;
  for (const set of ALL_SETS) {
    for (const group of player.properties[set]) {
      if (group.buildings.length > 0 && !isSetComplete(group)) {
        events.push({ type: 'SetBroken', player: playerId, set });
        for (const buildingId of group.buildings) {
          player.bank.push(buildingId);
          events.push({ type: 'BuildingRelocated', player: playerId, cardId: buildingId, set });
        }
        group.buildings = [];
      }
    }
    pruneEmpty(player, set); // drop any group left empty after relocation
  }
  return events;
}

// How costly it is to GIVE UP a card, so payment prefers cash over property and
// never breaks a complete set unless forced. Lower = give this away first.
interface PayableItem {
  id: CardId;
  value: number;
  damage: number;
}

function payableItems(state: GameState, playerId: PlayerId): PayableItem[] {
  const player = state.players[playerId]!;
  const items: PayableItem[] = [];
  for (const id of player.bank) {
    const card = getCard(state, id);
    items.push({ id, value: cardPayValue(card), damage: card.kind === 'money' ? 1 : 2 });
  }
  for (const set of ALL_SETS) {
    for (const group of player.properties[set]) {
      const complete = isSetComplete(group);
      for (const id of group.cards) {
        const card = getCard(state, id);
        if (isAnyWildcard(card)) {
          continue; // never payable
        }
        // Breaking a complete set is the worst; a spare wildcard the least bad.
        const damage = complete ? 40 : card.kind === 'wildcard' ? 4 : 12;
        items.push({ id, value: cardPayValue(card), damage });
      }
      for (const id of group.buildings) {
        items.push({ id, value: cardPayValue(getCard(state, id)), damage: 8 });
      }
    }
  }
  return items;
}

// The one canonical way to PICK a payment: minimise overpay first (never hand over
// more value than necessary), then minimise damage (cash before property, keep
// complete sets). Bots use this in M2; the UI offers it as "auto-pay" in M3.
export function suggestPayment(state: GameState, request: PaymentRequest): CardId[] {
  const items = payableItems(state, request.debtor);
  const tableTotal = items.reduce((sum, item) => sum + item.value, 0);

  // Table can't cover the debt ⇒ forced to pay everything.
  if (tableTotal <= request.amountOwed) {
    return items.map((item) => item.id);
  }

  // Tiny subset-sum (values ≤ 10, total ≤ 57): for each reachable total, keep the
  // combination with the least damage. We then take the smallest total ≥ the debt.
  const bestForSum = new Map<number, { cards: CardId[]; damage: number }>();
  bestForSum.set(0, { cards: [], damage: 0 });
  for (const item of items) {
    for (const [sum, entry] of [...bestForSum]) {
      const nextSum = sum + item.value;
      const nextDamage = entry.damage + item.damage;
      const existing = bestForSum.get(nextSum);
      if (!existing || nextDamage < existing.damage) {
        bestForSum.set(nextSum, { cards: [...entry.cards, item.id], damage: nextDamage });
      }
    }
  }

  let bestSum = -1;
  for (const sum of bestForSum.keys()) {
    if (sum >= request.amountOwed && (bestSum === -1 || sum < bestSum)) {
      bestSum = sum;
    }
  }
  return bestForSum.get(bestSum)?.cards ?? items.map((item) => item.id);
}
