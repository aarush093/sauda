/**
 * Presentation-only helpers: turn engine data (card ids, actions, events) into
 * readable strings. This is NOT game logic — it only reads the engine's theme.
 * All rules live in @sauda/engine.
 */
import { ACTIONS, KIRAYA_DESCRIPTOR, KIRAYA_NAME, PROPERTY_NAMES, SETS, buildDeck } from '@sauda/engine';
import type { Action, GameEvent, InterruptView, SetId } from '@sauda/engine';

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

// F7 (owner playtest 30 Jul): when a staged card's canonical verb is missing from legalActions,
// the rail shows ONE greyed hint so its absence reads as a RULE, not an arbitrary UI. This maps a
// card to its verb + a short reason; the caller shows the reason only when that verb isn't offered.
// UI COPY ONLY — the engine decides legality; this never does. Just these six teachable cases.
const VERB_HINTS: Record<string, { verbKey: string; reason: string }> = {
  makaan: { verbKey: 'build', reason: 'needs a complete set' },
  haveli: { verbKey: 'build', reason: 'needs a MAKAAN first' },
  kabza: { verbKey: 'play', reason: 'no full set to seize' },
  haathKiSafai: { verbKey: 'play', reason: 'nothing stealable' },
  adlaBadli: { verbKey: 'play', reason: 'needs one of yours + one of theirs' },
  kiraya: { verbKey: 'charge', reason: 'no matching property' },
};

export function cardVerbHint(cardId: string): { verbKey: string; reason: string } | null {
  const card = CARD_BY_ID.get(cardId);
  if (!card) {
    return null;
  }
  const key = card.kind === 'kiraya' ? 'kiraya' : card.kind === 'action' ? card.action : null;
  return key !== null ? (VERB_HINTS[key] ?? null) : null;
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

// The threat an open interrupt poses to me, in one line — shared by the interim panel
// and the interrupt prompt (D1). Reads the public interrupt effect; decides nothing.
export function describeThreat(interrupt: InterruptView): string {
  const effect = interrupt.effect;
  switch (effect.kind) {
    case 'charge':
      return `Player ${interrupt.origin} charges you ₹${effect.amount} Cr.`;
    case 'stealSet':
      return `Player ${interrupt.origin} is grabbing your ${SETS[effect.set].label} set (KABZA).`;
    case 'stealProperty':
      return `Player ${interrupt.origin} is taking your ${describeCard(effect.cardId)}.`;
    case 'swap':
      return `Player ${interrupt.origin} wants to swap ${describeCard(effect.theirCardId)} for your ${describeCard(effect.myCardId)}.`;
    default:
      return `Player ${interrupt.origin} played something against you.`;
  }
}
