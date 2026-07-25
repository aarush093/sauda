/**
 * The game's state shape and the supporting result/event types (§4, §8.1).
 *
 * Two design decisions drive everything here:
 *  1. There is ONE immutable registry of all 106 cards (`GameState.cards`). Every
 *     zone stores only card IDs. Moving a card = moving an ID between arrays. This
 *     makes the "106 cards always accounted for" invariant cheap to check and
 *     makes it impossible to duplicate or lose a card.
 *  2. The RNG lives in the state as a single integer (`rngState`), so the whole
 *     game is deterministic and replayable from its seed, and the state can be
 *     saved to disk (M4) and resumed exactly.
 */
import type { SetId } from './types';
import type { Card } from './types';
import type { Rules } from './rules';

export type CardId = string;
export type PlayerId = number; // index into GameState.players

// One colour group in a player's property area. A wildcard's *current colour* is
// simply which group it sits in, so "rearranging wildcards" is moving an ID here.
export interface PropertyGroup {
  set: SetId;
  cards: CardId[]; // property + wildcard IDs assigned to this colour
  buildings: CardId[]; // MAKAAN / HAVELI IDs — only ever placed on a complete set
}

export interface PlayerState {
  id: PlayerId;
  hand: CardId[]; // secret zone
  bank: CardId[]; // face-up money pile
  // Each colour maps to a LIST of groups. Normally one group per colour, but a
  // colour can hold a second (or more) set when wildcards give you surplus cards
  // (§ set overflow): the surplus forms a new set of that colour rather than
  // overfilling the first. A group is complete once it holds its set's size.
  properties: Record<SetId, PropertyGroup[]>;
}

// Where the current player's turn is (§4.4). While an interrupt is open the phase
// stays 'playing' but control passes to the interrupt's responder.
export type TurnPhase = 'awaitingDraw' | 'playing' | 'awaitingDiscard' | 'gameOver';

// --- Interrupt stack (§5, §8.1) ---
//
// A charge/steal is not applied immediately: it becomes a frame here and opens a
// response window. See interrupts.ts for the parity rule that resolves NAHI chains.

// What a pending interrupt will do if it stands.
export type PendingEffect =
  | { kind: 'charge'; amount: number } // target pays `amount` to origin (VASOOLI/SHAGUN/KIRAYA)
  | { kind: 'stealSet'; set: SetId } // KABZA: take target's complete set + its buildings
  | { kind: 'stealProperty'; cardId: CardId } // HAATH KI SAFAI: take one property
  | { kind: 'swap'; myCardId: CardId; theirCardId: CardId }; // ADLA-BADLI

export type InterruptStatus =
  | 'awaitingResponse' // waiting for NAHI CHALEGA / allow from `responder`
  | 'awaitingPayment' // charge stood; `responder` (the target) must choose cards
  | 'awaitingReceive'; // `responder` must place received wildcard(s) into a group

// A wildcard that has moved to a new owner who must still choose its colour group
// (§4.5, edge #19). We remember the receiver because in a swap the two received
// cards can have two different receivers.
export interface ReceiveItem {
  cardId: CardId;
  receiver: PlayerId;
}

// NOTE on card accounting: the *source* action card (VASOOLI, KABZA, KIRAYA, …) is
// moved to the discard pile the instant it is played — you spent it whether or not
// it is later cancelled, and it never returns to a hand. So a frame only needs to
// track the NAHI CHALEGA cards mid-air (`nahiChain`) and any wildcards awaiting a
// group choice (`pendingReceive`). This also means a single SHAGUN card that opens
// several frames is never double-counted.
export interface Interrupt {
  id: string; // deterministic (int_<n>)
  origin: PlayerId; // who played the charge/steal
  target: PlayerId; // who it is against
  effect: PendingEffect;
  nahiChain: CardId[]; // NAHI CHALEGA cards, in play order (parity decides the outcome)
  responder: PlayerId; // whose decision we currently await (may be off-turn)
  status: InterruptStatus;
  pendingReceive: ReceiveItem[]; // wildcards awaiting a group choice by their receiver
}

export interface GameState {
  rules: Rules;
  cards: Readonly<Record<CardId, Card>>; // all 106, immutable ground truth
  players: PlayerState[];
  drawPile: CardId[]; // top of pile = last element
  discardPile: CardId[];
  currentPlayerIndex: number;
  playsRemaining: number; // reset to rules.playsPerTurn at the start of each turn
  turnCount: number;
  phase: TurnPhase;
  pendingInterrupts: Interrupt[]; // the interrupt stack; empty except during a charge
  nextInterruptId: number; // deterministic id counter
  rngState: number; // serialisable mulberry32 cursor
  winnerIndex: number | null;
}

// --- Results and rule violations ---
//
// reduce returns a Result so illegal actions surface as data, not exceptions.
export interface RuleViolation {
  code: string; // stable machine code, e.g. 'NOT_YOUR_TURN'
  message: string; // human-readable explanation (English, light Hinglish ok)
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: RuleViolation };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function fail<T>(code: string, message: string): Result<T> {
  return { ok: false, error: { code, message } };
}

// --- Events (§8.1) ---
//
// reduce returns the delta of what happened as GameEvent[]. The full log enables
// replay, debugging and ML trajectory extraction. Events are engine-internal (they
// may name hidden card ids); the UI consumes `observe`, not raw events.
export type GameEvent =
  | { type: 'GameStarted'; playerCount: number; seed: number }
  | { type: 'TurnStarted'; player: PlayerId; turn: number }
  | { type: 'DrawPileReshuffled'; count: number }
  | { type: 'CardsDrawn'; player: PlayerId; cardIds: CardId[] }
  | { type: 'CardBanked'; player: PlayerId; cardId: CardId; value: number }
  | { type: 'PropertyPlaced'; player: PlayerId; cardId: CardId; set: SetId }
  | { type: 'WildcardRearranged'; player: PlayerId; cardId: CardId; fromSet: SetId; toSet: SetId }
  | { type: 'BuildingPlaced'; player: PlayerId; cardId: CardId; set: SetId; building: 'makaan' | 'haveli' }
  | { type: 'ActionPlayed'; player: PlayerId; cardId: CardId; action: string }
  | { type: 'ChargeOpened'; interruptId: string; origin: PlayerId; target: PlayerId }
  | { type: 'NahiChalegaPlayed'; interruptId: string; player: PlayerId; chainLength: number }
  | { type: 'InterruptCancelled'; interruptId: string }
  | { type: 'InterruptResolved'; interruptId: string }
  | { type: 'Paid'; debtor: PlayerId; creditor: PlayerId; cardIds: CardId[]; amount: number }
  | { type: 'SetBroken'; player: PlayerId; set: SetId }
  | { type: 'BuildingRelocated'; player: PlayerId; cardId: CardId; set: SetId }
  | { type: 'SetStolen'; from: PlayerId; to: PlayerId; set: SetId }
  | { type: 'PropertyStolen'; from: PlayerId; to: PlayerId; cardId: CardId }
  | { type: 'PropertiesSwapped'; a: PlayerId; b: PlayerId; aCardId: CardId; bCardId: CardId }
  | { type: 'CardReceived'; player: PlayerId; cardId: CardId; set: SetId }
  | { type: 'CardsDiscarded'; player: PlayerId; cardIds: CardId[] }
  | { type: 'TurnEnded'; player: PlayerId }
  | { type: 'WinDeclared'; player: PlayerId };
