/**
 * Turns engine data into readable terminal text for `pnpm play`. All player-facing
 * wording comes from the engine's theme (§2 — no third-party names anywhere).
 */
import { ACTIONS, KIRAYA_NAME, PROPERTY_NAMES, SETS, buildDeck } from '@sauda/engine';
import type { Action, GameEvent, Observation, SetId } from '@sauda/engine';

const CARD_BY_ID = new Map(buildDeck().map((card) => [card.id, card]));

function setLabels(colors: SetId[]): string {
  return colors.map((c) => SETS[c].label).join('/');
}

// A short human name for a card id, e.g. "Marine Drive (Mumbai)" or "₹5 Cr".
export function describeCard(id: string): string {
  const card = CARD_BY_ID.get(id);
  if (!card) {
    return id;
  }
  switch (card.kind) {
    case 'property':
      return `${PROPERTY_NAMES[card.set][card.index]} (${SETS[card.set].label})`;
    case 'wildcard':
      return card.colors === 'ANY' ? 'Wildcard (any colour)' : `Wildcard (${setLabels(card.colors)})`;
    case 'action':
      return ACTIONS[card.action].name;
    case 'kiraya':
      return card.colors === 'ANY' ? `${KIRAYA_NAME} (wild)` : `${KIRAYA_NAME} (${setLabels(card.colors)})`;
    case 'money':
      return `₹${card.value} Cr`;
    default:
      return id;
  }
}

// A one-line menu label for a legal action.
export function describeAction(action: Action): string {
  switch (action.type) {
    case 'DRAW':
      return 'Draw cards';
    case 'END_TURN':
      return 'End turn';
    case 'DECLARE_WIN':
      return 'DECLARE WIN!';
    case 'DISCARD':
      return `Discard ${describeCard(action.cardId)}`;
    case 'BANK_CARD':
      return `Bank ${describeCard(action.cardId)}`;
    case 'PLACE_PROPERTY':
      return `Place ${describeCard(action.cardId)} in ${SETS[action.set].label}`;
    case 'REARRANGE_WILDCARD':
      return `Move ${describeCard(action.cardId)} to ${SETS[action.toSet].label}`;
    case 'PLAY_ACTION':
      return describePlayAction(action);
    case 'PLAY_KIRAYA':
      return `Play ${KIRAYA_NAME} on ${SETS[action.color].label}${action.dugnaCardIds.length ? ` ×${2 ** action.dugnaCardIds.length}` : ''}${action.target !== null ? ` → P${action.target}` : ' (all)'}`;
    case 'RESPOND_NAHI_CHALEGA':
      return 'Play NAHI CHALEGA! (cancel)';
    case 'RESPOND_ALLOW':
      return 'Allow it';
    case 'RESPOND_PAY':
      return `Pay: ${action.cardIds.map(describeCard).join(', ') || '(nothing)'}`;
    case 'RESPOND_PLACE_RECEIVED':
      return `Keep ${describeCard(action.cardId)} in ${SETS[action.set].label}`;
    default:
      return JSON.stringify(action);
  }
}

function describePlayAction(action: Extract<Action, { type: 'PLAY_ACTION' }>): string {
  const params = action.params;
  switch (params.action) {
    case 'aageBadho':
      return 'Play Aage Badho (draw 2)';
    case 'makaan':
      return `Build Makaan on ${SETS[params.set].label}`;
    case 'haveli':
      return `Build Haveli on ${SETS[params.set].label}`;
    case 'vasooli':
      return `Play Vasooli on P${params.target} (₹5)`;
    case 'shagun':
      return 'Play Shagun (all pay ₹2)';
    case 'kabza':
      return `Play Kabza on P${params.target}'s ${SETS[params.set].label}`;
    case 'haathKiSafai':
      return `Play Haath Ki Safai on P${params.target}`;
    case 'adlaBadli':
      return `Play Adla-Badli with P${params.target}`;
    default:
      return 'Play action';
  }
}

// A short transcript line for an event.
export function describeEvent(event: GameEvent): string | null {
  switch (event.type) {
    case 'TurnStarted':
      return `\n— Turn ${event.turn}: Player ${event.player} —`;
    case 'CardsDrawn':
      return `  P${event.player} drew ${event.cardIds.length} card(s)`;
    case 'CardBanked':
      return `  P${event.player} banked ${describeCard(event.cardId)}`;
    case 'PropertyPlaced':
      return `  P${event.player} placed ${describeCard(event.cardId)}`;
    case 'BuildingPlaced':
      return `  P${event.player} built a ${event.building} on ${SETS[event.set].label}`;
    case 'ActionPlayed':
      return `  P${event.player} played ${describeCard(event.cardId)}`;
    case 'NahiChalegaPlayed':
      return `  P${event.player} played NAHI CHALEGA! (chain ${event.chainLength})`;
    case 'InterruptCancelled':
      return `  → cancelled`;
    case 'Paid':
      return `  P${event.debtor} paid P${event.creditor}: ${event.cardIds.map(describeCard).join(', ') || 'nothing'}`;
    case 'SetStolen':
      return `  P${event.to} grabbed P${event.from}'s ${SETS[event.set].label} (KABZA)`;
    case 'BuildingRelocated':
      return `  a building fell back to P${event.player}'s bank`;
    case 'DrawPileReshuffled':
      return `  (draw pile reshuffled)`;
    case 'WinDeclared':
      return `\n★ Player ${event.player} declares SAUDA — game over!`;
    default:
      return null;
  }
}

// A compact scoreboard of everyone's public position.
export function renderBoard(observation: Observation): string {
  const lines: string[] = [];
  lines.push(
    `You are P${observation.me} | turn ${observation.turnCount} | current: P${observation.currentPlayer} | plays left: ${observation.playsRemaining}`,
  );
  lines.push(`  You  — ${renderPlayerLine(observation.myBank, observation.myProperties)}`);
  for (const opponent of observation.opponents) {
    lines.push(
      `  P${opponent.id}   — hand:${opponent.handCount} ${renderPlayerLine(opponent.bank, opponent.properties)}`,
    );
  }
  lines.push(`  draw:${observation.drawPileCount} discard:${observation.discardPile.length}`);
  return lines.join('\n');
}

function renderPlayerLine(bank: string[], properties: Observation['myProperties']): string {
  let bankTotal = 0;
  for (const id of bank) {
    const card = CARD_BY_ID.get(id);
    if (card && !(card.kind === 'wildcard' && card.colors === 'ANY')) {
      bankTotal += card.value;
    }
  }
  const sets: string[] = [];
  for (const groups of Object.values(properties) as Observation['myProperties'][SetId][]) {
    for (const group of groups) {
      if (group.cards.length === 0) {
        continue;
      }
      const size = SETS[group.set].size;
      const done = group.cards.length >= size ? '✓' : `${group.cards.length}/${size}`;
      const buildings = group.buildings.length > 0 ? `+${group.buildings.length}b` : '';
      sets.push(`${SETS[group.set].label} ${done}${buildings}`);
    }
  }
  return `bank:₹${bankTotal} | ${sets.join(', ') || 'no sets'}`;
}
