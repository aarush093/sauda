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
    const group = player.properties[set];
    ids.push(...group.cards, ...group.buildings);
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
    creditor.properties[card.set].cards.push(id);
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
    const group = player.properties[set];
    if (removeId(group.cards, id) || removeId(group.buildings, id)) {
      return;
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
    const group = player.properties[set];
    if (group.buildings.length > 0 && !isSetComplete(group)) {
      events.push({ type: 'SetBroken', player: playerId, set });
      for (const buildingId of group.buildings) {
        player.bank.push(buildingId);
        events.push({ type: 'BuildingRelocated', player: playerId, cardId: buildingId, set });
      }
      group.buildings = [];
    }
  }
  return events;
}

// The one canonical way to PICK a payment: always minimise overpay (never hand over
// more than necessary). Bots use this in M2; the UI offers it as "auto-pay" in M3.
export function suggestPayment(state: GameState, request: PaymentRequest): CardId[] {
  const payableIds = payableCards(state, request.debtor);
  const tableTotal = totalPayableValue(state, request.debtor);

  // Table can't cover the debt ⇒ forced to pay everything.
  if (tableTotal <= request.amountOwed) {
    return payableIds;
  }

  // Otherwise find a subset whose value is the smallest total that still covers the
  // debt. This is a tiny subset-sum (values ≤ 10, table total ≤ 57), so we track,
  // for each reachable sum, one card combination that reaches it.
  const combinationForSum = new Map<number, CardId[]>();
  combinationForSum.set(0, []);
  for (const id of payableIds) {
    const value = cardPayValue(getCard(state, id));
    for (const [sum, cards] of [...combinationForSum]) {
      const nextSum = sum + value;
      if (!combinationForSum.has(nextSum)) {
        combinationForSum.set(nextSum, [...cards, id]);
      }
    }
  }

  let bestSum = -1;
  for (const sum of combinationForSum.keys()) {
    if (sum >= request.amountOwed && (bestSum === -1 || sum < bestSum)) {
      bestSum = sum;
    }
  }
  return combinationForSum.get(bestSum) ?? payableIds;
}
