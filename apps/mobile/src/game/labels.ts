/**
 * Presentation-only helpers: turn engine data (card ids, actions, events) into
 * readable strings. This is NOT game logic — it only reads the engine's theme.
 * All rules live in @sauda/engine.
 */
import { ACTIONS, KIRAYA_DESCRIPTOR, KIRAYA_NAME, PROPERTY_NAMES, SETS, buildDeck } from '@sauda/engine';
import type { Action, GameEvent, SetId } from '@sauda/engine';

const CARD_BY_ID = new Map(buildDeck().map((card) => [card.id, card]));

function labels(colors: SetId[]): string {
  return colors.map((c) => SETS[c].label).join('/');
}

// The short English descriptor shown next to a desi card name, or null if the
// card has none (money, property, wildcard). All ₹ totals come from the engine
// via the Observation — the app never computes a card's value itself.
export function cardDescriptor(id: string): string | null {
  const card = CARD_BY_ID.get(id);
  if (!card) {
    return null;
  }
  if (card.kind === 'action') {
    return ACTIONS[card.action].descriptor;
  }
  if (card.kind === 'kiraya') {
    return KIRAYA_DESCRIPTOR;
  }
  return null;
}

// The ₹ Cr value a card is worth if banked — a money card's face value, or an
// action/kiraya card's bank value. Every card kind carries a `value`. Used to label
// the Bank button on the action rail ("Bank ₹N Cr", row B10).
export function cardValue(id: string): number | null {
  const card = CARD_BY_ID.get(id);
  return card ? card.value : null;
}

export function describeCard(id: string): string {
  const card = CARD_BY_ID.get(id);
  if (!card) {
    return id;
  }
  switch (card.kind) {
    case 'property':
      return PROPERTY_NAMES[card.set][card.index] ?? id;
    case 'wildcard':
      return card.colors === 'ANY' ? 'Wildcard (any)' : `Wildcard (${labels(card.colors)})`;
    case 'action':
      return ACTIONS[card.action].name;
    case 'kiraya':
      return card.colors === 'ANY' ? `${KIRAYA_NAME} (wild)` : `${KIRAYA_NAME} (${labels(card.colors)})`;
    case 'money':
      return `₹${card.value} Cr`;
    default:
      return id;
  }
}

export function describeAction(action: Action): string {
  switch (action.type) {
    case 'DRAW':
      return 'Draw';
    case 'END_TURN':
      return 'End turn';
    case 'DECLARE_WIN':
      return 'DECLARE WIN!';
    case 'DISCARD':
      return `Discard ${describeCard(action.cardId)}`;
    case 'BANK_CARD':
      return `Bank ${describeCard(action.cardId)}`;
    case 'PLACE_PROPERTY':
      return `Place in ${SETS[action.set].label}`;
    case 'REARRANGE_WILDCARD':
      return `Move to ${SETS[action.toSet].label}`;
    case 'PLAY_ACTION':
      return describePlayAction(action);
    case 'PLAY_KIRAYA':
      return `Charge ${SETS[action.color].label}${action.dugnaCardIds.length ? ` ×${2 ** action.dugnaCardIds.length}` : ''}${action.target !== null ? ` on P${action.target}` : ' (all)'}`;
    case 'RESPOND_NAHI_CHALEGA':
      return 'Play NAHI CHALEGA!';
    case 'RESPOND_ALLOW':
      return 'Allow it';
    case 'RESPOND_PAY':
      return `Pay: ${action.cardIds.map(describeCard).join(', ') || 'nothing'}`;
    case 'RESPOND_PLACE_RECEIVED':
      return `Keep in ${SETS[action.set].label}`;
    default:
      return 'Action';
  }
}

function describePlayAction(action: Extract<Action, { type: 'PLAY_ACTION' }>): string {
  const p = action.params;
  switch (p.action) {
    case 'aageBadho':
      return 'Aage Badho (draw 2)';
    case 'makaan':
      return `Build Makaan on ${SETS[p.set].label}`;
    case 'haveli':
      return `Build Haveli on ${SETS[p.set].label}`;
    case 'vasooli':
      return `Vasooli on P${p.target}`;
    case 'shagun':
      return 'Shagun (all pay ₹2)';
    case 'kabza':
      return `Kabza P${p.target}'s ${SETS[p.set].label}`;
    case 'haathKiSafai':
      return `Haath Ki Safai on P${p.target}`;
    case 'adlaBadli':
      return `Adla-Badli with P${p.target}`;
    default:
      return 'Play';
  }
}

// The hand card an action operates on (for grouping in the UI), or null.
export function actionCardId(action: Action): string | null {
  switch (action.type) {
    case 'BANK_CARD':
    case 'PLACE_PROPERTY':
    case 'DISCARD':
    case 'REARRANGE_WILDCARD':
    case 'PLAY_ACTION':
    case 'PLAY_KIRAYA':
      return action.cardId;
    default:
      return null;
  }
}

export function describeEvent(event: GameEvent): string | null {
  switch (event.type) {
    case 'TurnStarted':
      return `— Turn ${event.turn}: Player ${event.player}`;
    case 'CardsDrawn':
      return `P${event.player} drew ${event.cardIds.length}`;
    case 'CardBanked':
      return `P${event.player} banked ${describeCard(event.cardId)}`;
    case 'PropertyPlaced':
      return `P${event.player} placed ${describeCard(event.cardId)}`;
    case 'BuildingPlaced':
      return `P${event.player} built ${event.building} on ${SETS[event.set].label}`;
    case 'ActionPlayed':
      return `P${event.player} played ${describeCard(event.cardId)}`;
    case 'NahiChalegaPlayed':
      return `P${event.player} NAHI CHALEGA! (chain ${event.chainLength})`;
    case 'InterruptCancelled':
      return `→ cancelled`;
    case 'Paid':
      return `P${event.debtor} paid P${event.creditor}: ${event.cardIds.map(describeCard).join(', ') || 'nothing'}`;
    case 'SetStolen':
      return `P${event.to} grabbed P${event.from}'s ${SETS[event.set].label}`;
    case 'WinDeclared':
      return `★ Player ${event.player} wins!`;
    default:
      return null;
  }
}
