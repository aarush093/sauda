/**
 * THE SINGLE SOURCE OF PLAYER-FACING TEXT AND CARD DATA (§2, §6).
 *
 * Everything a player reads — the game name, set labels, street names, action
 * card names and flavour — lives in this one file. A full rebrand must be
 * possible by editing only this file. Structural identity (the keys used to
 * build card IDs) lives in types.ts, so editing text here can never change an
 * ID or corrupt a saved game.
 *
 * IP guardrail (§2): no third-party names, card names, or trade dress. A
 * whole-repo test (ip-guard.test.ts) enforces this automatically.
 */
import type { SetId, ActionKind } from './types';

// Product identity (§3).
export const GAME = {
  name: 'SAUDA',
  nameDevanagari: 'सौदा',
  tagline: 'Collect. Conquer. Win.',
  currency: '₹ Cr',
} as const;

// Display + gameplay data for one property colour group (§6.1).
export interface SetTheme {
  label: string; // shown to the player
  hex: string; // set colour (also drives the SVG card face)
  icon: string; // which woodcut glyph the CardFace renders (§10)
  size: number; // properties needed to complete the set
  value: number; // ₹ bank value of each property in the set
  rent: number[]; // rent[i] = kiraya when owning i+1 properties; last entry = full set
}

// §6.1: the ten sets. Keys are the structural SetIds; values are display/gameplay data.
export const SETS: Record<SetId, SetTheme> = {
  puraniDilli: { label: 'Purani Dilli', hex: '#8C4A2F', icon: 'jalebi', size: 2, value: 1, rent: [1, 2] },
  kashi: { label: 'Kashi Ghats', hex: '#2FA8C9', icon: 'diya', size: 3, value: 1, rent: [1, 2, 3] },
  jaipur: { label: 'Jaipur', hex: '#D6337A', icon: 'jharokha', size: 3, value: 2, rent: [1, 2, 4] },
  kolkata: { label: 'Kolkata', hex: '#E8842C', icon: 'tram', size: 3, value: 2, rent: [1, 3, 5] },
  chennai: { label: 'Chennai', hex: '#C6342B', icon: 'filterCoffee', size: 3, value: 3, rent: [2, 3, 6] },
  bangalore: { label: 'Bangalore', hex: '#E3B505', icon: 'circuit', size: 3, value: 3, rent: [2, 4, 6] },
  newDelhi: { label: 'New Delhi', hex: '#1E7A46', icon: 'pillar', size: 3, value: 4, rent: [2, 4, 7] },
  mumbai: { label: 'Mumbai', hex: '#1D3F8F', icon: 'wave', size: 2, value: 4, rent: [3, 8] },
  junction: { label: 'Junctions', hex: '#22222A', icon: 'train', size: 4, value: 2, rent: [1, 2, 3, 4] },
  utility: { label: 'Utilities', hex: '#7C8A6E', icon: 'bulb', size: 2, value: 2, rent: [1, 2] },
};

// §6.1: the property card names, per set. A property card stores its set + its
// index into this list, and looks its name up here — so it holds no display text.
export const PROPERTY_NAMES: Record<SetId, string[]> = {
  puraniDilli: ['Chandni Chowk', 'Chawri Bazaar'],
  kashi: ['Assi Ghat', 'Tulsi Ghat', 'Dashashwamedh Ghat'],
  jaipur: ['Hawa Mahal Road', 'Johari Bazaar', 'MI Road'],
  kolkata: ['Park Street', 'College Street', 'Ballygunge'],
  chennai: ['T. Nagar', 'Anna Salai', 'Besant Nagar'],
  bangalore: ['MG Road', 'Indiranagar', 'Koramangala'],
  newDelhi: ['Connaught Place', 'Khan Market', 'Lodhi Road'],
  mumbai: ['Marine Drive', 'Altamount Road'],
  junction: ['Howrah Junction', 'Mumbai CST', 'New Delhi Station', 'Chennai Central'],
  utility: ['Bijli Ghar', 'Jal Board'],
};

// Display + deck data for one action card kind (§5).
//
// LANGUAGE POLICY (see DECISIONS.md): `name` is the card's proper-noun identity and
// stays as a desi term (KABZA, VASOOLI, …). `descriptor` is a short CLEAN-ENGLISH
// explanation shown next to the name so its meaning is always in English. No other
// player-facing string anywhere is Hinglish.
export interface ActionTheme {
  name: string; // shown on the card (desi proper noun — never translated)
  descriptor: string; // short English explanation shown next to the name
  value: number; // ₹ bank value if banked as money instead of played
  count: number; // how many of this card are in the deck
}

// §5: the ten action kinds. `count` values sum to 34 (asserted in deck.test.ts).
export const ACTIONS: Record<ActionKind, ActionTheme> = {
  kabza: { name: 'Kabza', descriptor: 'Steal a complete set', value: 5, count: 2 },
  haathKiSafai: { name: 'Haath Ki Safai', descriptor: 'Steal one property (not from a complete set)', value: 3, count: 3 },
  adlaBadli: { name: 'Adla-Badli', descriptor: 'Swap one property with an opponent', value: 3, count: 3 },
  nahiChalega: { name: 'Nahi Chalega!', descriptor: 'Cancel an action played against you', value: 4, count: 3 },
  vasooli: { name: 'Vasooli', descriptor: 'One opponent pays you ₹5 Cr', value: 3, count: 3 },
  shagun: { name: 'Shagun', descriptor: 'Every opponent pays you ₹2 Cr', value: 2, count: 3 },
  aageBadho: { name: 'Aage Badho', descriptor: 'Draw 2 cards', value: 1, count: 10 },
  makaan: { name: 'Makaan', descriptor: 'Add ₹3 Cr rent to a complete set', value: 3, count: 3 },
  haveli: { name: 'Haveli', descriptor: 'Add ₹4 Cr rent (needs a makaan first)', value: 4, count: 2 },
  dugna: { name: 'Dugna!', descriptor: 'Double a rent charge', value: 1, count: 2 },
};

// KIRAYA cards are modelled separately (§6.4) but shown to players, so they get an
// English descriptor too.
export const KIRAYA_DESCRIPTOR = 'Charge rent for a colour you own';

// One property-wildcard type: which groups it may join, its value, and how many exist.
export interface WildcardTheme {
  colors: SetId[] | 'ANY';
  value: number;
  count: number;
}

// §6.2: the eleven wildcards. The 'ANY' wildcard has ₹0 value and is never payable.
export const WILDCARDS: WildcardTheme[] = [
  { colors: ['jaipur', 'kolkata'], value: 2, count: 2 },
  { colors: ['chennai', 'bangalore'], value: 3, count: 2 },
  { colors: ['kashi', 'puraniDilli'], value: 1, count: 1 },
  { colors: ['kashi', 'junction'], value: 4, count: 1 },
  { colors: ['mumbai', 'newDelhi'], value: 4, count: 1 },
  { colors: ['newDelhi', 'junction'], value: 4, count: 1 },
  { colors: ['junction', 'utility'], value: 2, count: 1 },
  { colors: 'ANY', value: 0, count: 2 },
];

// One KIRAYA (rent) card type (§6.4).
export interface KirayaTheme {
  colors: SetId[] | 'ANY';
  value: number;
  count: number;
  targeted: boolean; // true = wild rent (one chosen opponent); false = colour pair (all opponents)
}

// §6.4: the thirteen KIRAYA cards.
export const KIRAYA: KirayaTheme[] = [
  { colors: ['puraniDilli', 'kashi'], value: 1, count: 2, targeted: false },
  { colors: ['jaipur', 'kolkata'], value: 1, count: 2, targeted: false },
  { colors: ['chennai', 'bangalore'], value: 1, count: 2, targeted: false },
  { colors: ['newDelhi', 'mumbai'], value: 1, count: 2, targeted: false },
  { colors: ['junction', 'utility'], value: 1, count: 2, targeted: false },
  { colors: 'ANY', value: 3, count: 3, targeted: true },
];

// One money denomination: its ₹ face value and how many are in the deck.
export interface MoneyTheme {
  value: number;
  count: number;
}

// §6.5: twenty money cards totalling ₹57 Cr (both asserted in deck.test.ts).
export const MONEY: MoneyTheme[] = [
  { value: 1, count: 6 },
  { value: 2, count: 5 },
  { value: 3, count: 3 },
  { value: 4, count: 3 },
  { value: 5, count: 2 },
  { value: 10, count: 1 },
];
