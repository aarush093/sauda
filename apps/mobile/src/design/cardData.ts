/**
 * Read-only card lookup + a de-duplicated list of every distinct card FACE, for
 * CardFace and the /dev/plates sheet. Pure presentation over engine data — no
 * rules here.
 */
import { ACTIONS, PROPERTY_NAMES, SETS, buildDeck } from '@sauda/engine';
import type { ActionKind, Card, SetId } from '@sauda/engine';

const DECK = buildDeck();
const BY_ID = new Map(DECK.map((card) => [card.id, card]));

export function cardById(id: string): Card | undefined {
  return BY_ID.get(id);
}

// The filename stem for a card's art plate. Two kinds share ONE plate across their
// copies so the owner paints once, not per copy: action cards key by kind
// (every KABZA copy → action_kabza.webp) and money notes key by denomination
// (every ₹5 note → money_5.webp). Everything else keys by its own id.
export function plateKey(card: Card): string {
  if (card.kind === 'action') return `action_${card.action}`;
  if (card.kind === 'money') return `money_${card.value}`;
  return card.id;
}

// The display name of a property card (from theme, by set + index).
export function propertyName(card: Extract<Card, { kind: 'property' }>): string {
  return PROPERTY_NAMES[card.set][card.index] ?? card.id;
}

export function setLabels(colors: SetId[]): string {
  return colors.map((c) => SETS[c].label).join(' / ');
}

// One representative card id per distinct face (so the dev sheet shows each unique
// design once rather than all 106 physical cards). Order: properties, wildcards,
// actions, kiraya, money.
export function representativeCardIds(): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const card of DECK) {
    const key = faceKey(card);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    ids.push(card.id);
  }
  return ids;
}

function faceKey(card: Card): string {
  switch (card.kind) {
    case 'property':
      return `prop:${card.set}:${card.index}`;
    case 'wildcard':
      return `wild:${card.colors === 'ANY' ? 'any' : card.colors.join('-')}`;
    case 'action':
      return `action:${card.action}`;
    case 'kiraya':
      return `kiraya:${card.colors === 'ANY' ? 'any' : card.colors.join('-')}`;
    case 'money':
      return `money:${card.value}`;
  }
}

// The action descriptor / other short English tag shown under a card name.
export function actionInfo(action: keyof typeof ACTIONS): { name: string; descriptor: string } {
  return { name: ACTIONS[action].name, descriptor: ACTIONS[action].descriptor };
}

// P8 Book: a real card id to RENDER for a set / an action, so the rules book shows the actual
// CardFace (never a redrawn stand-in). Reads the deck, so it can never drift from the real cards.
export function representativePropertyId(set: SetId): string | undefined {
  return DECK.find((card) => card.kind === 'property' && card.set === set)?.id;
}

export function actionCardId(action: ActionKind): string | undefined {
  return DECK.find((card) => card.kind === 'action' && card.action === action)?.id;
}
