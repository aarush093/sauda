/**
 * Core structural types for SAUDA.
 *
 * IMPORTANT (§8, readability contract #6): the *structural* identity of the game
 * lives here — the set keys and action keys that card IDs are built from. These
 * values are effectively permanent: saved games (M4) reference cards by ID, so
 * renaming a structural key would corrupt existing saves. Player-facing display
 * text (labels, flavour) lives entirely in `theme.ts`, keyed by these same keys.
 *
 * Rule of thumb: if a string is shown to a player, it belongs in theme.ts.
 * If a string identifies a card structurally, it belongs here.
 */

// §6.1: the ten property colour groups, keyed by stable structural ids.
// The order here is the canonical deck order used by `deck.ts`.
export const SET_IDS = [
  'puraniDilli',
  'kashi',
  'jaipur',
  'kolkata',
  'chennai',
  'bangalore',
  'newDelhi',
  'mumbai',
  'junction',
  'utility',
] as const;

export type SetId = (typeof SET_IDS)[number];

// §5: the ten kinds of action card. KIRAYA (rent) cards are modelled separately
// (they carry colour choices), so they are not in this list.
export const ACTION_KINDS = [
  'kabza',
  'haathKiSafai',
  'adlaBadli',
  'nahiChalega',
  'vasooli',
  'shagun',
  'aageBadho',
  'makaan',
  'haveli',
  'dugna',
] as const;

export type ActionKind = (typeof ACTION_KINDS)[number];

// Every card is exactly one of these five kinds. `kind` is the discriminant so
// TypeScript can narrow a `Card` to the right shape (readability contract #6:
// this is the one place a discriminated union genuinely earns its keep).
export type CardKind = 'property' | 'wildcard' | 'action' | 'kiraya' | 'money';

// A single-colour property card (§6.1). `index` is its position within the set's
// name list in theme.ts — that is how we recover its display name without the
// card holding any display text itself.
export interface PropertyCard {
  id: string;
  kind: 'property';
  set: SetId;
  index: number;
  value: number;
}

// A property wildcard (§6.2). `colors` is the list of groups it may join, or
// 'ANY' for the multi-colour wildcard that has ₹0 value and can never be paid.
export interface WildcardCard {
  id: string;
  kind: 'wildcard';
  colors: SetId[] | 'ANY';
  value: number;
}

// An action card (§5). `action` says which effect it resolves; `value` is what
// it is worth if banked as money instead of played.
export interface ActionCard {
  id: string;
  kind: 'action';
  action: ActionKind;
  value: number;
}

// A KIRAYA (rent) card (§6.4). `targeted` is true for the wild rent card, which
// hits one chosen opponent; the colour-pair cards hit all opponents.
export interface KirayaCard {
  id: string;
  kind: 'kiraya';
  colors: SetId[] | 'ANY';
  value: number;
  targeted: boolean;
}

// A money card (§6.5). Its only property is its ₹ Cr face value.
export interface MoneyCard {
  id: string;
  kind: 'money';
  value: number;
}

export type Card = PropertyCard | WildcardCard | ActionCard | KirayaCard | MoneyCard;
